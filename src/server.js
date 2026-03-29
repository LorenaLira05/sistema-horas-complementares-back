const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();


app.use(cors());
app.use(express.json()); 


const rotasAdmin = require('./routes/admin');
const rotasCoordenador = require('./routes/coordenador');
const rotasAluno = require('./routes/aluno');
const rotasAuth = require('./routes/authRoutes');

app.use('/admin', rotasAdmin);
app.use('/coordenador', rotasCoordenador);
app.use('/aluno', rotasAluno);
app.use('/auth', rotasAuth);


app.get('/', (req, res) => {
    res.send(' Servidor de Atividades Complementares Online!');
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
    console.log(`Server rodando na porta ${PORT}`);
});