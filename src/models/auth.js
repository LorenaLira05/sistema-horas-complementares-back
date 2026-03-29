const jwt = require('jsonwebtoken');

const authMiddleware = (perfisPermitidos) => {
    return (req, res, next) => {
        // 1. Pega o token do header
        const authHeader = req.headers['authorization'];

        if (!authHeader) {
            return res.status(401).json({ erro: "Token não enviado." });
        }

        // 2. O token vem assim: "Bearer eyJhbGci..."
        // Precisamos pegar só a parte depois de "Bearer "
        const token = authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ erro: "Token inválido." });
        }

        try {
            // 3. Verifica se o token é válido e não expirou
            const dados = jwt.verify(token, process.env.JWT_SECRET);

            // 4. Salva os dados do usuário na requisição para usar depois
            req.usuario = dados;

            // 5. Verifica se o perfil tem permissão
            if (!perfisPermitidos.includes(dados.perfil)) {
                return res.status(403).json({ erro: "Você não tem permissão para acessar esta área." });
            }

            next(); // Pode passar!

        } catch (err) {
            return res.status(401).json({ erro: "Token expirado ou inválido." });
        }
    };
};

module.exports = authMiddleware;