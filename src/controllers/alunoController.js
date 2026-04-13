const pool = require('../config/database');
const registrarLog = require('../utils/logger');


exports.postSubmeterAtividade = async (req, res) => {
    const { regra_id, descricao, horas_solicitadas } = req.body;
    const aluno_id = req.usuario.id;
    const curso_id = req.usuario.curso_id;

    try {
        // Verifica se a regra pertence ao curso do aluno
        const regra = await pool.query(
            'SELECT * FROM regras_atividades WHERE id = $1 AND curso_id = $2',
            [regra_id, curso_id]
        );

        if (regra.rows.length === 0) {
            return res.status(404).json({ erro: "Categoria não encontrada para o seu curso." });
        }

        const query = `
            INSERT INTO atividades_enviadas 
                (aluno_id, regra_id, curso_id, descricao, categoria, horas_solicitadas, status)
            VALUES 
                ($1, $2, $3, $4, $5, $6, 'PENDENTE')
            RETURNING *`;

        const resultado = await pool.query(query, [
            aluno_id,
            regra_id,
            curso_id,
            descricao,
            regra.rows[0].nome_categoria,
            horas_solicitadas
        ]);
        // Busca o coordenador do curso para notificar
    const coordenador = await pool.query(`
        SELECT u.email, u.nome 
        FROM usuarios u
        JOIN coordenador_curso cc ON cc.coordenador_id = u.id
        WHERE cc.curso_id = $1 
        LIMIT 1`,
        [curso_id]
    );

    // Busca o nome do aluno
    const aluno = await pool.query(
        'SELECT nome FROM usuarios WHERE id = $1',
        [aluno_id]
    );

    // Envia o e-mail para o coordenador
    if (coordenador.rows.length > 0) {
        await emailNovaSubmissao(
            coordenador.rows[0].email,
            coordenador.rows[0].nome,
            aluno.rows[0].nome,
            descricao
        );
    }
        res.status(201).json({ mensagem: "Atividade submetida!", atividade: resultado.rows[0] });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// só se ainda estiver PENDENTE
exports.putEditarSubmissao = async (req, res) => {
    const { id } = req.params;
    const { descricao, horas_solicitadas } = req.body;
    const aluno_id = req.usuario.id;

    try {
        const submissao = await pool.query(
            'SELECT * FROM atividades_enviadas WHERE id = $1 AND aluno_id = $2',
            [id, aluno_id]
        );

        if (submissao.rows.length === 0) {
            return res.status(404).json({ erro: "Submissão não encontrada." });
        }

        if (submissao.rows[0].status !== 'PENDENTE') {
            return res.status(400).json({ 
                erro: "Você só pode editar submissões que ainda estão pendentes." 
            });
        }

        const query = `
            UPDATE atividades_enviadas 
            SET descricao = $1, horas_solicitadas = $2
            WHERE id = $3 AND aluno_id = $4
            RETURNING *`;

        const resultado = await pool.query(query, [descricao, horas_solicitadas, id, aluno_id]);
        await registrarLog(aluno_id, req.usuario.perfil, 'EDITAR_SUBMISSAO', `Submissão editada: id ${id}`, req.ip);
        res.status(200).json({ mensagem: "Submissão atualizada!", atividade: resultado.rows[0] });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

// só se ainda estiver PENDENTE
exports.deleteSubmissao = async (req, res) => {
    const { id } = req.params;
    const aluno_id = req.usuario.id;
    try {
        const submissao = await pool.query(
            'SELECT * FROM atividades_enviadas WHERE id = $1 AND aluno_id = $2', [id, aluno_id]
        );
        if (submissao.rows.length === 0) {
            return res.status(404).json({ erro: "Submissão não encontrada." });
        }
        if (submissao.rows[0].status !== 'PENDENTE') {
            return res.status(400).json({ erro: "Você só pode deletar submissões pendentes." });
        }
        await pool.query('DELETE FROM atividades_enviadas WHERE id = $1', [id]);
        await registrarLog(aluno_id, req.usuario.perfil, 'DELETAR_SUBMISSAO', `Submissão deletada: id ${id}`, req.ip);
        res.status(200).json({ mensagem: "Submissão deletada com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};