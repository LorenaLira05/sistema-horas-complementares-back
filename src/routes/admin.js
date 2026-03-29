const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const adminController = require('../controllers/adminController'); // Importa o gerente

// Agora, para ver os cursos, precisa ser SUPER_ADMIN
router.get('/cursos', authMiddleware(['SUPER_ADMIN']), adminController.getListaCursos);
// ... (mantenha o que já tem)
router.post('/coordenador', authMiddleware(['SUPER_ADMIN']), adminController.postCadastrarCoordenador);
router.post('/curso', authMiddleware(['SUPER_ADMIN']), adminController.postCriarCurso);

module.exports = router;