const jwt = require('jsonwebtoken');

// Middleware normal — rotas protegidas (já existia)
const authMiddleware = (perfisPermitidos) => {
    return (req, res, next) => {
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(401).json({ erro: "Token não enviado." });
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ erro: "Token inválido." });
        }

        try {
            const dados = jwt.verify(token, process.env.JWT_SECRET);
            req.usuario = dados;

            const temPermissao = dados.perfis.some(p => perfisPermitidos.includes(p));
            if (!temPermissao) {
                return res.status(403).json({ erro: "Você não tem permissão para acessar esta área." });
            }

            next();

        } catch (err) {
            return res.status(401).json({ erro: "Token expirado ou inválido." });
        }
    };
};

// Middleware exclusivo para a etapa de verificação 2FA (novo)
const authMiddleware2FA = (req, res, next) => {
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(401).json({ erro: "Token não enviado." });
    }

    const token = authHeader.split(' ')[1];

    try {
        const dados = jwt.verify(token, process.env.JWT_SECRET);

        if (dados.etapa !== '2fa_pendente') {
            return res.status(403).json({ erro: "Token inválido para esta etapa." });
        }

        req.usuario = dados;
        next();

    } catch (err) {
        return res.status(401).json({ erro: "Token expirado ou inválido." });
    }
};

module.exports = { authMiddleware, authMiddleware2FA };