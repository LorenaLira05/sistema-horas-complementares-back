const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const dashboardController = require('../controllers/dashboardController');
const relatoriosController = require('../controllers/relatoriosController');

router.get('/coordenador', authMiddleware(['COORDENADOR']), dashboardController.getDashboardCoordenador);
router.get('/relatorios', authMiddleware(['COORDENADOR']), relatoriosController.getRelatorios);

module.exports = router;