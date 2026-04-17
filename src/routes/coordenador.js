const express = require('express');
const router = express.Router();
const coordenadorController = require('../controllers/coordenadorController');
const authMiddleware = require('../middleware/auth');

router.get('/teste', (req, res) => res.json({ msg: "Rota Coordenador funcionando!" }));

// Categorias
router.post('/categoria', authMiddleware(['coordinator', 'super_admin']), coordenadorController.postCriarCategoria);

// Regras
router.post('/regras', authMiddleware(['coordinator', 'super_admin']), coordenadorController.postCriarRegra);
router.get('/regras/:course_id', authMiddleware(['coordinator', 'student']), coordenadorController.getRegrasPorCurso);
router.put('/regras/:id', authMiddleware(['coordinator', 'super_admin']), coordenadorController.putAtualizarRegra);
router.delete('/regras/:id', authMiddleware(['coordinator', 'super_admin']), coordenadorController.deleteRegra);

// Alunos
router.post('/aluno', authMiddleware(['coordinator']), coordenadorController.postCadastrarAluno);
router.get('/alunos/:course_id', authMiddleware(['coordinator']), coordenadorController.getAlunosDoCurso);
router.put('/aluno/:id', authMiddleware(['coordinator']), coordenadorController.putAtualizarAluno);
router.delete('/aluno/:id', authMiddleware(['coordinator']), coordenadorController.deleteAluno);

// Submissões
router.get('/submissoes/:course_id', authMiddleware(['coordinator']), coordenadorController.getSubmissoes);
router.get('/submissao/:id', authMiddleware(['coordinator']), coordenadorController.getSubmissaoPorId);
router.patch('/validar/:id', authMiddleware(['coordinator']), coordenadorController.patchValidarSubmissao);

module.exports = router;