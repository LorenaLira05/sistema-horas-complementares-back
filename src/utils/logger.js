const pool = require('../config/database');

const registrarLog = async (usuario_id, perfil, acao, detalhes, ip) => {
    try {
        if (!usuario_id) return;
        await pool.query(
            `INSERT INTO logs (usuario_id, perfil, acao, detalhes, ip) 
             VALUES ($1, $2, $3, $4, $5)`,
            [usuario_id, perfil, acao, detalhes, ip]
        );
    } catch (err) {
        console.error('Erro ao registrar log:', err.message);
    }
};

module.exports = registrarLog;