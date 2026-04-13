const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// E-mail para coordenador quando receber nova submissão
exports.emailNovaSubmissao = async (emailCoordenador, nomeCoordenador, nomeAluno, descricao) => {
    try {
        await transporter.sendMail({
            from: `"Sistema SENAC" <${process.env.MAIL_USER}>`,
            to: emailCoordenador,
            subject: 'Nova submissão de atividade complementar',
            html: `
                <h2>Nova Submissão Recebida</h2>
                <p>Olá, <strong>${nomeCoordenador}</strong>!</p>
                <p>O aluno <strong>${nomeAluno}</strong> enviou uma nova atividade complementar:</p>
                <p><strong>Descrição:</strong> ${descricao}</p>
                <p>Acesse o sistema para analisar a submissão.</p>
                <br>
                <p>Sistema de Gestão de Atividades Complementares — SENAC</p>
            `
        });
        console.log(`✅ E-mail enviado para ${emailCoordenador}`);
    } catch (err) {
        console.error('❌ Erro ao enviar e-mail:', err.message);
    }
};

// E-mail para aluno após aprovação ou reprovação
exports.emailResultadoSubmissao = async (emailAluno, nomeAluno, status, descricao, feedback) => {
    const statusTexto = status === 'APROVADO' ? '✅ Aprovada' : '❌ Reprovada';
    const corStatus = status === 'APROVADO' ? '#10b981' : '#ef4444';

    try {
        await transporter.sendMail({
            from: `"Sistema SENAC" <${process.env.MAIL_USER}>`,
            to: emailAluno,
            subject: `Resultado da sua submissão: ${statusTexto}`,
            html: `
                <h2>Resultado da sua Submissão</h2>
                <p>Olá, <strong>${nomeAluno}</strong>!</p>
                <p>Sua atividade complementar foi analisada:</p>
                <p><strong>Descrição:</strong> ${descricao}</p>
                <p><strong>Status:</strong> <span style="color:${corStatus}">${statusTexto}</span></p>
                ${feedback ? `<p><strong>Feedback do coordenador:</strong> ${feedback}</p>` : ''}
                <br>
                <p>Sistema de Gestão de Atividades Complementares — SENAC</p>
            `
        });
        console.log(`E-mail enviado para ${emailAluno}`);
    } catch (err) {
        console.error('Erro ao enviar e-mail:', err.message);
    }
};