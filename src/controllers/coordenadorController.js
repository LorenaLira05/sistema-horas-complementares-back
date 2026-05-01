const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const registrarLog = require('../utils/logger');
const { emailResultadoSubmissao } = require('../services/emailService');

exports.postCriarCategoria = async (req, res) => {
    const { name, description } = req.body;

    try {
        const resultado = await pool.query(
            `INSERT INTO categories (name, description)
             VALUES ($1, $2)
             RETURNING *`,
            [name, description]
        );

        await registrarLog(req.usuario.id, 'CRIAR_CATEGORIA', 'categories', resultado.rows[0].id, { name });
        res.status(201).json({ mensagem: "Categoria criada!", categoria: resultado.rows[0] });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.getListaCategorias = async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM categories WHERE is_active = true ORDER BY name');
        res.status(200).json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.getTodasRegras = async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT car.*, cat.name AS category_name, c.name AS course_name
             FROM course_activity_rules car
             JOIN categories cat ON cat.id = car.category_id
             JOIN courses c ON c.id = car.course_id
             JOIN course_coordinators cc ON cc.course_id = c.id
             WHERE cc.user_id = $1 AND cc.is_active = true`,
            [req.usuario.id]
        );
        res.status(200).json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.postCriarRegra = async (req, res) => {
    const { course_id, category_id, min_hours, max_hours, is_required, notes } = req.body;

    try {
        const categoria = await pool.query(
            `SELECT * FROM categories WHERE id = $1 AND is_active = true`,
            [category_id]
        );
        if (categoria.rows.length === 0) {
            return res.status(404).json({ erro: "Categoria não encontrada." });
        }

        const resultado = await pool.query(
            `INSERT INTO course_activity_rules (course_id, category_id, min_hours, max_hours, is_required, notes)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
            [course_id, category_id, min_hours, max_hours, is_required, notes]
        );

        await registrarLog(req.usuario.id, 'CRIAR_REGRA', 'course_activity_rules', resultado.rows[0].id, { course_id, category_id });
        res.status(201).json({ mensagem: "Regra cadastrada com sucesso!", regra: resultado.rows[0] });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao criar regra: " + err.message });
    }
};

exports.getRegrasPorCurso = async (req, res) => {
    const { course_id } = req.params;
    const isSuperAdmin = req.usuario.perfis && req.usuario.perfis.includes('super_admin');

    if (!isSuperAdmin) {
        const acesso = await pool.query(
            `SELECT id FROM course_coordinators 
             WHERE user_id = $1 AND course_id = $2 AND is_active = true`,
            [req.usuario.id, course_id]
        );
        if (acesso.rows.length === 0) {
            return res.status(403).json({ erro: "Você não tem acesso a este curso." });
        }
    }

    try {
        const resultado = await pool.query(
            `SELECT car.*, cat.name AS category_name, cat.description AS category_description
             FROM course_activity_rules car
             JOIN categories cat ON cat.id = car.category_id
             WHERE car.course_id = $1`,
            [course_id]
        );
        res.status(200).json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar regras: " + err.message });
    }
};

exports.putAtualizarRegra = async (req, res) => {
    const { id } = req.params;
    const { min_hours, max_hours, is_required, notes } = req.body;

    try {
        const regra = await pool.query(
            `SELECT * FROM course_activity_rules WHERE id = $1`,
            [id]
        );
        if (regra.rows.length === 0) {
            return res.status(404).json({ erro: "Regra não encontrada." });
        }

        const resultado = await pool.query(
            `UPDATE course_activity_rules
             SET min_hours = $1, max_hours = $2, is_required = $3, notes = $4, updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [min_hours, max_hours, is_required, notes, id]
        );

        await registrarLog(req.usuario.id, 'ATUALIZAR_REGRA', 'course_activity_rules', id, { min_hours, max_hours });
        res.status(200).json({ mensagem: "Regra atualizada!", regra: resultado.rows[0] });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.deleteRegra = async (req, res) => {
    const { id } = req.params;

    try {
        const regra = await pool.query(
            `SELECT * FROM course_activity_rules WHERE id = $1`, [id]
        );
        if (regra.rows.length === 0) {
            return res.status(404).json({ erro: "Regra não encontrada." });
        }

        await pool.query(`DELETE FROM course_activity_rules WHERE id = $1`, [id]);
        await registrarLog(req.usuario.id, 'DELETAR_REGRA', 'course_activity_rules', id, {});
        res.status(200).json({ mensagem: "Regra deletada com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.postCadastrarAluno = async (req, res) => {
    const { full_name, email, cpf, phone, course_id, ra, status_matricula } = req.body;
    const isSuperAdmin = req.usuario.perfis && req.usuario.perfis.includes('super_admin');

    if (!isSuperAdmin) {
        const acesso = await pool.query(
            `SELECT id FROM course_coordinators 
             WHERE user_id = $1 AND course_id = $2 AND is_active = true`,
            [req.usuario.id, course_id]
        );
        if (acesso.rows.length === 0) {
            return res.status(403).json({ erro: "Você não tem acesso a este curso." });
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const senhaCripto = await bcrypt.hash('123456', 10);
        const novoUsuario = await client.query(
            `INSERT INTO users (full_name, email, password_hash, cpf, phone)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, full_name, email`,
            [full_name, email, senhaCripto, cpf, phone]
        );
        const userId = novoUsuario.rows[0].id;

        const role = await client.query(`SELECT id FROM roles WHERE name = 'student'`);
        await client.query(
            `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
            [userId, role.rows[0].id]
        );

        await client.query(
            `INSERT INTO student_profiles (user_id, ra) VALUES ($1, $2)`,
            [userId, ra]
        );

        await client.query(
            `INSERT INTO user_courses (user_id, course_id, status_matricula)
             VALUES ($1, $2, $3)`,
            [userId, course_id, status_matricula || 'ativo']
        );

        await client.query('COMMIT');
        await registrarLog(req.usuario.id, 'CRIAR_ALUNO', 'users', userId, { full_name, email, course_id, ra });
        res.status(201).json({ mensagem: "Aluno cadastrado com sucesso!", aluno: novoUsuario.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ erro: err.message });
    } finally {
        client.release();
    }
};

exports.getAlunosDoCurso = async (req, res) => {
    const { course_id } = req.params;
    const isSuperAdmin = req.usuario.perfis && req.usuario.perfis.includes('super_admin');

    if (!isSuperAdmin) {
        const acesso = await pool.query(
            `SELECT id FROM course_coordinators 
             WHERE user_id = $1 AND course_id = $2 AND is_active = true`,
            [req.usuario.id, course_id]
        );
        if (acesso.rows.length === 0) {
            return res.status(403).json({ erro: "Você não tem acesso a este curso." });
        }
    }

    try {
        const resultado = await pool.query(
            `SELECT
                u.id, u.full_name, u.email, u.phone, u.status,
                sp.ra,
                uc.enrollment_date, uc.status_matricula
             FROM users u
             JOIN user_courses uc ON uc.user_id = u.id
             JOIN user_roles ur ON ur.user_id = u.id
             JOIN roles r ON r.id = ur.role_id
             LEFT JOIN student_profiles sp ON sp.user_id = u.id
             WHERE uc.course_id = $1 AND r.name = 'student' AND uc.is_active = true`,
            [course_id]
        );
        res.status(200).json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.putAtualizarAluno = async (req, res) => {
    const { id } = req.params;
    const { 
        full_name, email, phone, ra, status_matricula, course_id, cpf 
    } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const aluno = await client.query(`SELECT * FROM users WHERE id = $1`, [id]);
        if (aluno.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: "Aluno não encontrado." });
        }

        // 1. Atualizar Usuário
        await client.query(
            `UPDATE users SET full_name = $1, email = $2, phone = $3, cpf = $4, updated_at = NOW()
             WHERE id = $5`,
            [full_name, email, phone, cpf, id]
        );

        // 2. Atualizar Perfil (RA)
        await client.query(
            `INSERT INTO student_profiles (user_id, ra, updated_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (user_id) DO UPDATE SET 
                ra = EXCLUDED.ra, 
                updated_at = NOW()`,
            [id, ra]
        );

        // 3. Atualizar Vínculo com Curso (Status)
        if (course_id) {
            await client.query(
                `UPDATE user_courses SET 
                    status_matricula = COALESCE($1, status_matricula),
                    updated_at = NOW()
                 WHERE user_id = $2 AND course_id = $3`,
                [status_matricula, id, course_id]
            );
        }

        await client.query('COMMIT');
        await registrarLog(req.usuario.id, 'ATUALIZAR_ALUNO', 'users', id, { full_name, email, ra });
        res.status(200).json({ mensagem: "Aluno atualizado!" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ erro: err.message });
    } finally {
        client.release();
    }
};

exports.getAlunoById = async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT u.id, u.full_name, u.email, u.phone, u.cpf,
                   sp.ra,
                   uc.course_id, uc.status_matricula, uc.enrollment_date,
                   c.name as course_name
            FROM users u
            LEFT JOIN student_profiles sp ON u.id = sp.user_id
            LEFT JOIN user_courses uc ON u.id = uc.user_id
            LEFT JOIN courses c ON uc.course_id = c.id
            WHERE u.id = $1
        `;
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ erro: "Aluno não encontrado." });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.getMeusCursos = async (req, res) => {
    try {
        const isSuperAdmin = req.usuario.perfis && req.usuario.perfis.includes('super_admin');
        
        let query;
        let params = [];

        if (isSuperAdmin) {
            query = `SELECT id, name, code FROM courses WHERE is_active = true ORDER BY name`;
        } else {
            query = `SELECT c.id, c.name, c.code 
                     FROM courses c
                     JOIN course_coordinators cc ON cc.course_id = c.id
                     WHERE cc.user_id = $1 AND cc.is_active = true AND c.is_active = true
                     ORDER BY c.name`;
            params = [req.usuario.id];
        }

        const resultado = await pool.query(query, params);
        res.status(200).json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.patchInativarAluno = async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(`UPDATE users SET status = 'inativo', updated_at = NOW() WHERE id = $1`, [id]);
        await pool.query(`UPDATE user_courses SET is_active = false WHERE user_id = $1`, [id]);
        await registrarLog(req.usuario.id, 'INATIVAR_ALUNO', 'users', id, {});
        res.status(200).json({ mensagem: "Aluno inativado com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.patchStatusAluno = async (req, res) => {
    const { id } = req.params;
    const { status_matricula } = req.body;
    try {
        await pool.query(
            `UPDATE user_courses SET status_matricula = $1, updated_at = NOW() WHERE user_id = $2`,
            [status_matricula, id]
        );
        await registrarLog(req.usuario.id, 'ALTERAR_STATUS_ALUNO', 'user_courses', id, { status_matricula });
        res.status(200).json({ mensagem: "Status atualizado!" });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.deleteAluno = async (req, res) => {
    const { id } = req.params;

    try {
        const aluno = await pool.query(`SELECT * FROM users WHERE id = $1`, [id]);
        if (aluno.rows.length === 0) {
            return res.status(404).json({ erro: "Aluno não encontrado." });
        }

        // ON DELETE CASCADE cuida de user_roles, user_courses, submissions
        await pool.query(`DELETE FROM users WHERE id = $1`, [id]);
        await registrarLog(req.usuario.id, 'DELETAR_ALUNO', 'users', id, {});
        res.status(200).json({ mensagem: "Aluno deletado com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};
exports.getSubmissoesGeral = async (req, res) => {
    const user_id = parseInt(req.usuario.id);
    const { status, pagina = 1 } = req.query;
    const itensPorPagina = 10;
    const offset = (pagina - 1) * itensPorPagina;

    try {
        const isSuperAdmin = req.usuario.perfis && req.usuario.perfis.includes('super_admin');
        let course_ids = [];

        if (isSuperAdmin) {
            const todos = await pool.query(`SELECT id FROM courses WHERE is_active = true`);
            course_ids = todos.rows.map(r => parseInt(r.id));
        } else {
            const cursos = await pool.query(
                `SELECT course_id FROM course_coordinators WHERE user_id = $1 AND is_active = true`,
                [user_id]
            );
            course_ids = cursos.rows.map(r => parseInt(r.course_id));
        }

        if (course_ids.length === 0) {
            return res.status(200).json({ submissoes: [], contadores: { pendentes: 0, aprovadas: 0, reprovadas: 0, total: 0 }, total_paginas: 0 });
        }

        let params = [course_ids];
        let filtroStatus = '';
        if (status && status === 'PENDENTE') {
            filtroStatus = `AND s.status NOT IN ('approved', 'rejected')`;
            params.push(itensPorPagina, offset);
        } else if (status && status !== 'TODAS') {
            filtroStatus = `AND s.status = $2::submission_status_enum`;
            params.push(status, itensPorPagina, offset);
        } else {
            params.push(itensPorPagina, offset);
        }

        const resultado = await pool.query(
            `SELECT
                s.*, u.full_name AS student_name, u.email AS student_email,
                sp.ra AS ra,
                c.name AS course_name, cat.name AS category_name
             FROM submissions s
             JOIN user_courses uc ON uc.id = s.user_course_id
             JOIN users u ON u.id = uc.user_id
             LEFT JOIN student_profiles sp ON sp.user_id = u.id
             JOIN courses c ON c.id = uc.course_id
             JOIN categories cat ON cat.id = s.category_id
             WHERE uc.course_id = ANY($1)
             ${filtroStatus}
             ORDER BY s.submitted_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const contadores = await pool.query(
            `SELECT
                COUNT(*) FILTER (WHERE s.status NOT IN ('approved', 'rejected')) AS pendentes,
                COUNT(*) FILTER (WHERE s.status = 'approved') AS aprovadas,
                COUNT(*) FILTER (WHERE s.status = 'rejected') AS reprovadas,
                COUNT(*) AS total,
                COUNT(DISTINCT uc.course_id) AS total_cursos
             FROM submissions s
             JOIN user_courses uc ON uc.id = s.user_course_id
             WHERE uc.course_id = ANY($1)`,
            [course_ids]
        );

        res.status(200).json({
            submissoes: resultado.rows,
            contadores: contadores.rows[0],
            pagina: parseInt(pagina),
            total_paginas: Math.ceil(contadores.rows[0].total / itensPorPagina)
        });
    } catch (err) {
        console.error('Erro em getSubmissoesGeral:', err);
        res.status(500).json({ erro: err.message });
    }
};


exports.getSubmissoes = async (req, res) => {
    const { course_id } = req.params;
    const { status, pagina = 1 } = req.query;
    const itensPorPagina = 10;
    const offset = (pagina - 1) * itensPorPagina;
    const isSuperAdmin = req.usuario.perfis && req.usuario.perfis.includes('super_admin');

    if (!isSuperAdmin) {
        const acesso = await pool.query(
            `SELECT id FROM course_coordinators 
             WHERE user_id = $1 AND course_id = $2 AND is_active = true`,
            [req.usuario.id, course_id]
        );
        if (acesso.rows.length === 0) {
            return res.status(403).json({ erro: "Você não tem acesso a este curso." });
        }
    }

    try {
        let params = [course_id];
        let filtroStatus = '';

        if (status && status === 'PENDENTE') {
            filtroStatus = `AND s.status NOT IN ('approved', 'rejected')`;
            params.push(itensPorPagina, offset);
        } else if (status && status !== 'TODAS') {
            filtroStatus = `AND s.status = $2::submission_status_enum`;
            params.push(status, itensPorPagina, offset);
        } else {
            params.push(itensPorPagina, offset);
        }

        const resultado = await pool.query(
            `SELECT
                s.*,
                u.full_name AS student_name,
                u.email AS student_email,
                c.name AS course_name,
                cat.name AS category_name
             FROM submissions s
             JOIN user_courses uc ON uc.id = s.user_course_id
             JOIN users u ON u.id = uc.user_id
             JOIN courses c ON c.id = uc.course_id
             JOIN categories cat ON cat.id = s.category_id
             WHERE uc.course_id = $1
             ${filtroStatus}
             ORDER BY s.submitted_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length}`,
            params
        );

        const contadores = await pool.query(
            `SELECT
                COUNT(*) FILTER (WHERE s.status NOT IN ('approved', 'rejected')) AS pendentes,
                COUNT(*) FILTER (WHERE s.status = 'approved') AS aprovadas,
                COUNT(*) FILTER (WHERE s.status = 'rejected') AS reprovadas,
                COUNT(*) AS total
             FROM submissions s
             JOIN user_courses uc ON uc.id = s.user_course_id
             WHERE uc.course_id = $1`,
            [course_id]
        );

        res.status(200).json({
            submissoes: resultado.rows,
            contadores: contadores.rows[0],
            pagina: parseInt(pagina),
            total_paginas: Math.ceil(contadores.rows[0].total / itensPorPagina)
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.getSubmissaoPorId = async (req, res) => {
    const { id } = req.params;

    try {
        const resultado = await pool.query(
            `SELECT
                s.*,
                u.full_name AS student_name,
                u.email AS student_email,
                c.name AS course_name,
                cat.name AS category_name,
                sf.original_filename,
                sf.storage_path,
                sf.file_type,
                sf.ocr_extracted_text,
                sf.ocr_confidence
             FROM submissions s
             JOIN user_courses uc ON uc.id = s.user_course_id
             JOIN users u ON u.id = uc.user_id
             JOIN courses c ON c.id = uc.course_id
             JOIN categories cat ON cat.id = s.category_id
             LEFT JOIN submission_files sf ON sf.submission_id = s.id
             WHERE s.id = $1`,
            [id]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({ erro: "Submissão não encontrada." });
        }

        res.status(200).json(resultado.rows[0]);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.patchValidarSubmissao = async (req, res) => {
    const { id } = req.params;
    const { status_final, comment, approved_hours } = req.body;
    const validator_user_id = req.usuario.id; // vem do token

    const statusValidos = ['approved', 'rejected', 'returned_for_adjustment'];
    if (!statusValidos.includes(status_final)) {
        return res.status(400).json({ erro: `Status deve ser: ${statusValidos.join(', ')}.` });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Busca status atual antes de atualizar
        const submissaoAtual = await client.query(
            `SELECT status FROM submissions WHERE id = $1`, [id]
        );
        if (submissaoAtual.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ erro: "Submissão não encontrada." });
        }

        const previousStatus = submissaoAtual.rows[0].status;

        const submissao = await client.query(
            `UPDATE submissions
             SET status = $1::submission_status_enum,
                 approved_hours = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING *`,
            [status_final, approved_hours, id]
        );

        await client.query(
            `INSERT INTO validations (submission_id, validator_user_id, validation_status, previous_status, comment, approved_hours)
             VALUES ($1, $2, $3::validation_status_enum, $4::submission_status_enum, $5, $6)`,
            [id, validator_user_id, status_final, previousStatus, comment, approved_hours]
        );

        await client.query('COMMIT');

        const aluno = await pool.query(
            `SELECT u.full_name, u.email
             FROM submissions s
             JOIN user_courses uc ON uc.id = s.user_course_id
             JOIN users u ON u.id = uc.user_id
             WHERE s.id = $1`,
            [id]
        );

        if (aluno.rows.length > 0) {
            await emailResultadoSubmissao(
                aluno.rows[0].email,
                aluno.rows[0].full_name,
                status_final,
                submissao.rows[0].title,
                comment
            );

            await pool.query(
                `INSERT INTO notifications (user_id, submission_id, type, title, message)
            VALUES (
                (SELECT uc.user_id FROM submissions s JOIN user_courses uc ON uc.id = s.user_course_id WHERE s.id = $2),
                $2,
                $3::notification_type_enum,
                $4,
                $5
            )`,
                [
                    submissao.rows[0].user_course_id,
                    submissao.rows[0].id,
                    `submission_${status_final}`,
                    `Sua submissão foi ${status_final === 'approved' ? 'aprovada' : status_final === 'rejected' ? 'reprovada' : 'devolvida para ajuste'}`,
                    comment || ''
                ]
            );
        }

        await registrarLog(req.usuario.id, 'VALIDAR_SUBMISSAO', 'submissions', id, { status_final, approved_hours });
        res.status(200).json({ mensagem: "Submissão validada!", dados: submissao.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ erro: err.message });
    } finally {
        client.release();
    }
};

exports.getResumoGeral = async (req, res) => {
    const user_id = parseInt(req.usuario.id);
    const isSuperAdmin = req.usuario.perfis && req.usuario.perfis.includes('super_admin');

    try {
        let course_ids = [];

        // 1. Cursos do usuário
        if (isSuperAdmin) {
            const todos = await pool.query(
                `SELECT id FROM courses WHERE is_active = true`
            );
            course_ids = todos.rows.map(r => parseInt(r.id));
        } else {
            const cursos = await pool.query(
                `SELECT course_id 
                 FROM course_coordinators 
                 WHERE user_id = $1 AND is_active = true`,
                [user_id]
            );
            course_ids = cursos.rows.map(r => parseInt(r.course_id));
        }

        if (course_ids.length === 0) {
            return res.status(200).json({
                alunos: [],
                categorias: [],
                contadores: {}
            });
        }

        // 2. RESUMO POR ALUNO (geral)
        const alunos = await pool.query(
            `SELECT
                u.id,
                u.full_name,
                u.email,
                sp.ra,
                c.id AS course_id,
                c.name AS course_name,
                c.minimum_required_hours AS total_obrigatorio,

                COALESCE(
                    SUM(s.approved_hours) FILTER (WHERE s.status = 'approved'),
                    0
                ) AS total_integralizado,

                COUNT(s.id) AS total_submissoes

             FROM users u
             JOIN user_courses uc ON uc.user_id = u.id
             JOIN courses c ON c.id = uc.course_id
             LEFT JOIN student_profiles sp ON sp.user_id = u.id
             LEFT JOIN submissions s ON s.user_course_id = uc.id
             JOIN user_roles ur ON ur.user_id = u.id
             JOIN roles r ON r.id = ur.role_id

             WHERE uc.course_id = ANY($1)
               AND r.name = 'student'
               AND uc.is_active = true

             GROUP BY 
                u.id, u.full_name, u.email,
                sp.ra,
                c.id, c.name, c.minimum_required_hours

             ORDER BY u.full_name`,
            [course_ids]
        );

        // 3. 🔥 RESUMO POR CATEGORIA (NÚCLEO DO QUE VOCÊ QUER)
        const categorias = await pool.query(
            `SELECT
                u.id AS user_id,
                u.full_name,
                c.id AS course_id,
                c.name AS course_name,

                cat.id AS category_id,
                cat.name AS category_name,

                car.min_hours,
                car.max_hours,

                COALESCE(
                    SUM(s.approved_hours) FILTER (WHERE s.status = 'approved'),
                    0
                ) AS horas_aprovadas,

                COALESCE(
                    SUM(s.requested_hours) FILTER (WHERE s.status NOT IN ('approved','rejected')),
                    0
                ) AS horas_em_analise,

                (
                    car.max_hours - COALESCE(
                        SUM(s.approved_hours) FILTER (WHERE s.status = 'approved'),
                        0
                    )
                ) AS horas_restantes

             FROM users u

             JOIN user_courses uc 
                ON uc.user_id = u.id

             JOIN courses c 
                ON c.id = uc.course_id

             JOIN course_activity_rules car
                ON car.course_id = uc.course_id

             JOIN categories cat
                ON cat.id = car.category_id

             LEFT JOIN submissions s
                ON s.user_course_id = uc.id
               AND s.category_id = cat.id

             JOIN user_roles ur 
                ON ur.user_id = u.id

             JOIN roles r 
                ON r.id = ur.role_id

             WHERE uc.course_id = ANY($1)
               AND r.name = 'student'
               AND uc.is_active = true

             GROUP BY 
                u.id, u.full_name,
                c.id, c.name,
                cat.id, cat.name,
                car.min_hours,
                car.max_hours

             ORDER BY u.full_name, cat.name`,
            [course_ids]
        );

        // 4. CONTADORES GERAIS
        const contadores = await pool.query(
            `SELECT
                COUNT(DISTINCT u.id) AS total_alunos,

                COUNT(s.id) FILTER (
                    WHERE s.status NOT IN ('approved','rejected')
                ) AS pendentes,

                COUNT(s.id) FILTER (
                    WHERE s.status = 'approved'
                ) AS aprovadas

             FROM users u
             JOIN user_courses uc ON uc.user_id = u.id
             JOIN user_roles ur ON ur.user_id = u.id
             JOIN roles r ON r.id = ur.role_id
             LEFT JOIN submissions s ON s.user_course_id = uc.id

             WHERE uc.course_id = ANY($1)
               AND r.name = 'student'
               AND uc.is_active = true`,
            [course_ids]
        );

        return res.status(200).json({
            alunos: alunos.rows,
            categorias: categorias.rows,
            contadores: contadores.rows[0]
        });

    } catch (err) {
        console.error("ERRO RESUMO POR CATEGORIA:", err);
        console.error(err.stack);

        return res.status(500).json({
            erro: err.message
        });
    }
};