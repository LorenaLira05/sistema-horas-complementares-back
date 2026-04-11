const pool = require('../config/database');

exports.getRelatorios = async (req, res) => {
    const curso_id = req.usuario.curso_id;

    try {
        // Total de horas processadas
        const horasProcessadas = await pool.query(`
            SELECT 
                COALESCE(SUM(horas_aprovadas), 0) as total_horas
            FROM atividades_enviadas a
            JOIN usuarios u ON a.aluno_id = u.id
            WHERE a.status = 'APROVADO' 
            AND u.curso_id = $1`,
            [curso_id]
        );

        // Eficiência média (% de aprovações)
        const eficiencia = await pool.query(`
            SELECT
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE status = 'APROVADO') as aprovadas,
                CASE 
                    WHEN COUNT(*) > 0 
                    THEN ROUND((COUNT(*) FILTER (WHERE status = 'APROVADO')::numeric / COUNT(*)) * 100, 1)
                    ELSE 0
                END as eficiencia_percentual
            FROM atividades_enviadas a
            JOIN usuarios u ON a.aluno_id = u.id
            WHERE u.curso_id = $1`,
            [curso_id]
        );

        // Horas processadas por mês (últimos 6 meses)
        const horasMensais = await pool.query(`
            SELECT 
                TO_CHAR(data_validacao, 'Mon/YY') as mes,
                COALESCE(SUM(horas_aprovadas), 0) as horas
            FROM atividades_enviadas a
            JOIN usuarios u ON a.aluno_id = u.id
            WHERE u.curso_id = $1
                AND status = 'APROVADO'
                AND data_validacao >= NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(data_validacao, 'Mon/YY'), DATE_TRUNC('month', data_validacao)
            ORDER BY DATE_TRUNC('month', data_validacao)`,
            [curso_id]
        );

        // Eficiência por curso
        const eficienciaPorCurso = await pool.query(`
            SELECT 
                c.nome_curso,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE a.status = 'APROVADO') as aprovadas,
                CASE 
                    WHEN COUNT(*) > 0 
                    THEN ROUND((COUNT(*) FILTER (WHERE a.status = 'APROVADO')::numeric / COUNT(*)) * 100, 1)
                    ELSE 0
                END as eficiencia
            FROM atividades_enviadas a
            JOIN usuarios u ON a.aluno_id = u.id
            JOIN cursos c ON c.id = u.curso_id
            GROUP BY c.nome_curso
            ORDER BY eficiencia DESC`
        );

        // Log de atividades recentes
        const logAtividades = await pool.query(`
            SELECT 
                a.id,
                a.descricao,
                a.status,
                a.data_envio,
                a.data_validacao,
                u.nome as nome_aluno,
                r.nome_categoria as categoria,
                a.horas_aprovadas,
                a.feedback
            FROM atividades_enviadas a
            JOIN usuarios u ON a.aluno_id = u.id
            LEFT JOIN regras_atividades r ON a.regra_id = r.id
            WHERE u.curso_id = $1
            ORDER BY a.data_envio DESC
            LIMIT 10`,
            [curso_id]
        );

        // Avaliação dos alunos
        const avaliacaoAlunos = await pool.query(`
            SELECT 
                u.nome,
                u.matricula,
                COUNT(*) as total_submissoes,
                COALESCE(SUM(a.horas_aprovadas) FILTER (WHERE a.status = 'APROVADO'), 0) as horas_acumuladas,
                COUNT(*) FILTER (WHERE a.status = 'PENDENTE') as pendentes
            FROM usuarios u
            LEFT JOIN atividades_enviadas a ON a.aluno_id = u.id
            WHERE u.curso_id = $1 AND u.perfil = 'ALUNO'
            GROUP BY u.id, u.nome, u.matricula
            ORDER BY horas_acumuladas DESC`,
            [curso_id]
        );

        res.status(200).json({
            total_horas: horasProcessadas.rows[0].total_horas,
            eficiencia: eficiencia.rows[0],
            horas_mensais: horasMensais.rows,
            eficiencia_por_curso: eficienciaPorCurso.rows,
            log_atividades: logAtividades.rows,
            avaliacao_alunos: avaliacaoAlunos.rows
        });

    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
};