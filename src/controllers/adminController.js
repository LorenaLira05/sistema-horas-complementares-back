const pool = require('../config/database');
const bcrypt = require('bcryptjs');

exports.postCriarCurso = async (req, res) => {
    const { nome_curso, sigla, carga_horaria, duracao } = req.body;
    try {
        const query = `INSERT INTO cursos (nome_curso, sigla, carga_horaria, duracao) 
                       VALUES ($1, $2, $3, $4) RETURNING *`;
        const resultado = await pool.query(query, [nome_curso, sigla, carga_horaria, duracao]);
        res.status(201).json({ mensagem: "Curso criado!", curso: resultado.rows[0] });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};

exports.getListaCursos = async (req, res) => {
    try {
        // O gerente pede ao banco todos os cursos
        const resultado = await pool.query('SELECT * FROM cursos');
        
        res.status(200).json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar cursos: " + err.message });
    }
};

exports.getListaCoordenadores = async (req, res) => {
    try {
        const resultado = await pool.query(
            `SELECT id, nome, email, curso_id 
             FROM usuarios 
             WHERE perfil = 'COORDENADOR'`
        );
        res.status(200).json(resultado.rows);
    } catch (err) {
        res.status(500).json({ erro: "Erro ao buscar coordenadores: " + err.message });
    }
};

exports.postCadastrarCoordenador = async (req, res) => {
    const { nome, email, senha, curso_id } = req.body;

    try {
        // Protege a senha antes de salvar no banco
        const senhaCripto = await bcrypt.hash(senha, 10);

        const query = `
            INSERT INTO usuarios (nome, email, senha, perfil, curso_id) 
            VALUES ($1, $2, $3, 'COORDENADOR', $4) 
            RETURNING id, nome, email`;
        
        const resultado = await pool.query(query, [nome, email, senhaCripto, curso_id]);
        
        res.status(201).json({
            mensagem: "Coordenador cadastrado com sucesso!",
            dados: resultado.rows[0]
        });
    } catch (err) {
        res.status(500).json({ erro: "Erro ao cadastrar: " + err.message });
    }
};

