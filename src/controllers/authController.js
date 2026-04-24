const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { emailCodigo2FA } = require('../services/emailService');

exports.login = async (req, res) => {
    console.log('Entrou no login');
    const { email, senha } = req.body;
    console.log('Login tentativa:', email);

    try {
        const resultado = await pool.query(
            `SELECT u.*, array_agg(r.name) AS roles
             FROM users u
             JOIN user_roles ur ON ur.user_id = u.id
             JOIN roles r ON r.id = ur.role_id
             WHERE u.email = $1 AND u.status = 'active'
             GROUP BY u.id`,
            [email]
        );

        const usuario = resultado.rows[0];
        if (!usuario) return res.status(401).json({ erro: "Email ou senha incorretos." });

        const senhaCorreta = await bcrypt.compare(senha, usuario.password_hash);
        if (!senhaCorreta) return res.status(401).json({ erro: "Email ou senha incorretos." });

        // Verifica se o dispositivo já é confiável pelo cookie
        const deviceToken = req.cookies?.device_token;
        if (deviceToken) {
            const dispositivo = await pool.query(
                `SELECT id FROM trusted_devices WHERE user_id = $1 AND device_token = $2`,
                [usuario.id, deviceToken]
            );

            if (dispositivo.rows.length > 0) {
                // Dispositivo conhecido — login direto sem 2FA
                const primeiroAcesso = usuario.last_login_at === null;
                await pool.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [usuario.id]);

                const token = jwt.sign(
                    { id: usuario.id, email: usuario.email, perfis: usuario.roles },
                    process.env.JWT_SECRET,
                    { expiresIn: '8h' }
                );

                return res.status(200).json({
                    mensagem: "Login realizado com sucesso!",
                    token,
                    perfis: usuario.roles,
                    primeiroAcesso
                });
            }
        }

        // Dispositivo desconhecido — inicia fluxo 2FA
        const codigo = crypto.randomInt(100000, 999999).toString();
        const codigoHash = await bcrypt.hash(codigo, 10);
        const expiraEm = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        await pool.query(
            `UPDATE users 
             SET two_factor_code = $1, two_factor_expires_at = $2, two_factor_attempts = 0
             WHERE id = $3`,
            [codigoHash, expiraEm, usuario.id]
        );

        await emailCodigo2FA(usuario.email, usuario.full_name, codigo);

        const tokenTemp = jwt.sign(
            { id: usuario.id, etapa: '2fa_pendente' },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.status(200).json({
            mensagem: "Código de verificação enviado para seu e-mail.",
            tokenTemp
        });

    } catch (err) {
        res.status(500).json({ erro: "Erro no login: " + err.message });
    }
};

exports.verificar2FA = async (req, res) => {
    const { codigo } = req.body;
    const userId = req.usuario.id;

    try {
        const resultado = await pool.query(
            `SELECT u.*, array_agg(r.name) AS roles
             FROM users u
             JOIN user_roles ur ON ur.user_id = u.id
             JOIN roles r ON r.id = ur.role_id
             WHERE u.id = $1
             GROUP BY u.id`,
            [userId]
        );

        const usuario = resultado.rows[0];
        if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

        if (usuario.two_factor_attempts >= 3) {
            return res.status(429).json({ erro: "Muitas tentativas. Faça login novamente." });
        }

        if (!usuario.two_factor_expires_at || new Date() > usuario.two_factor_expires_at) {
            return res.status(400).json({ erro: "Código expirado. Faça login novamente." });
        }

        const codigoValido = await bcrypt.compare(codigo, usuario.two_factor_code);
        if (!codigoValido) {
            await pool.query(
                `UPDATE users SET two_factor_attempts = two_factor_attempts + 1 WHERE id = $1`,
                [userId]
            );
            return res.status(400).json({ erro: "Código inválido." });
        }

        // Limpa o código após uso
        await pool.query(
            `UPDATE users 
             SET two_factor_code = NULL, two_factor_expires_at = NULL,
                 two_factor_attempts = 0, last_login_at = NOW()
             WHERE id = $1`,
            [userId]
        );

        // Gera e salva token do dispositivo
        const deviceToken = crypto.randomBytes(32).toString('hex');
        await pool.query(
            `INSERT INTO trusted_devices (user_id, device_token) VALUES ($1, $2)`,
            [userId, deviceToken]
        );

        // Salva cookie persistente por 30 dias
        res.cookie('device_token', deviceToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        const primeiroAcesso = usuario.last_login_at === null;

        const token = jwt.sign(
            { id: usuario.id, email: usuario.email, perfis: usuario.roles },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.status(200).json({
            mensagem: "Login realizado com sucesso!",
            token,
            perfis: usuario.roles,
            primeiroAcesso
        });

    } catch (err) {
        res.status(500).json({ erro: "Erro na verificação: " + err.message });
    }
};

exports.setup = async (req, res) => {
    const { email, senha, nome } = req.body;

    try {
        const existe = await pool.query(
            `SELECT u.id FROM users u
             JOIN user_roles ur ON ur.user_id = u.id
             JOIN roles r ON r.id = ur.role_id
             WHERE r.name = 'super_admin'`
        );

        if (existe.rows.length > 0) {
            return res.status(400).json({ erro: "Super Admin já existe. Rota desativada." });
        }

        const senhaCripto = await bcrypt.hash(senha, 10);

        const novoUsuario = await pool.query(
            `INSERT INTO users (full_name, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, full_name, email`,
            [nome, email, senhaCripto]
        );

        const userId = novoUsuario.rows[0].id;

        const role = await pool.query(`SELECT id FROM roles WHERE name = 'super_admin'`);

        await pool.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
            [userId, role.rows[0].id]
        );

        res.status(201).json({
            mensagem: "Super Admin criado com sucesso!",
            dados: novoUsuario.rows[0]
        });

    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.trocarSenha = async (req, res) => {
    const { senhaAtual, novaSenha } = req.body;
    const userId = req.usuario.id;

    try {
        const resultado = await pool.query(`SELECT * FROM users WHERE id = $1`, [userId]);
        const usuario = resultado.rows[0];

        if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado." });

        const senhaCorreta = await bcrypt.compare(senhaAtual, usuario.password_hash);
        if (!senhaCorreta) return res.status(401).json({ erro: "Senha atual incorreta." });

        if (novaSenha.length < 6) {
            return res.status(400).json({ erro: "A nova senha deve ter pelo menos 6 caracteres." });
        }

        const novaSenhaCripto = await bcrypt.hash(novaSenha, 10);

        await pool.query(
            `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`,
            [novaSenhaCripto, userId]
        );

        res.status(200).json({ mensagem: "Senha alterada com sucesso!" });

    } catch (err) {
        res.status(500).json({ erro: "Erro ao trocar senha: " + err.message });
    }
};