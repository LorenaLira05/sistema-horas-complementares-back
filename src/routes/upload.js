const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const uploadController = require('../controllers/uploadController');

router.post('/certificado/:atividade_id', authMiddleware(['coordinator', 'student']), uploadController.uploadCertificado);
router.get('/certificado/:atividade_id', authMiddleware(['coordinator', 'student']), uploadController.getCertificado);

module.exports = router;