const express = require('express');
const router = express.Router();

router.get('/teste', (req, res) => res.json({ msg: "Rota Aluno funcionando!" }));

module.exports = router;