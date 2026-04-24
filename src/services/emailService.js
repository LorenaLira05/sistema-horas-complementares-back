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
exports.emailNovaSubmissao = async (emailCoordenador, tituloAtividade) => {
    try {
        await transporter.sendMail({
            from: `"Sistema SENAC" <${process.env.MAIL_USER}>`,
            to: emailCoordenador,
            subject: 'Nova submissão de atividade complementar',
            html: `
                <h2>Nova Submissão Recebida</h2>
                <p>Uma nova atividade complementar foi submetida para avaliação:</p>
                <p><strong>Título:</strong> ${tituloAtividade}</p>
                <p>Acesse o sistema para analisar a submissão.</p>
                <br>
                <p>Sistema de Gestão de Atividades Complementares — SENAC</p>
            `
        });
        console.log(`E-mail enviado para ${emailCoordenador}`);
    } catch (err) {
        console.error('Erro ao enviar e-mail:', err.message);
    }
};

// E-mail para aluno após validação
exports.emailResultadoSubmissao = async (emailAluno, nomeAluno, status, tituloAtividade, comment) => {
    const statusMap = {
        approved: { texto: 'Aprovada', cor: '#10b981' },
        rejected: { texto: 'Reprovada', cor: '#ef4444' },
        returned_for_adjustment: { texto: 'Devolvida para Ajuste', cor: '#f59e0b' }
    };

    const { texto: statusTexto, cor: corStatus } = statusMap[status] ?? { texto: status, cor: '#6b7280' };

    try {
        await transporter.sendMail({
            from: `"Sistema SENAC" <${process.env.MAIL_USER}>`,
            to: emailAluno,
            subject: `Resultado da sua submissão: ${statusTexto}`,
            html: `
                <h2>Resultado da sua Submissão</h2>
                <p>Olá, <strong>${nomeAluno}</strong>!</p>
                <p>Sua atividade complementar foi analisada:</p>
                <p><strong>Título:</strong> ${tituloAtividade}</p>
                <p><strong>Status:</strong> <span style="color:${corStatus}">${statusTexto}</span></p>
                ${comment ? `<p><strong>Comentário do coordenador:</strong> ${comment}</p>` : ''}
                <br>
                <p>Sistema de Gestão de Atividades Complementares — SENAC</p>
            `
        });
        console.log(`E-mail enviado para ${emailAluno}`);
    } catch (err) {
        console.error('Erro ao enviar e-mail:', err.message);
    }
};

// E-mail de código 2FA
exports.emailCodigo2FA = async (emailUsuario, nomeUsuario, codigo) => {
    try {
        await transporter.sendMail({
            from: `"Sistema SENAC" <${process.env.MAIL_USER}>`,
            to: emailUsuario,
            subject: 'Código de verificação de acesso',
            html: `
                <h2>Verificação de Acesso</h2>
                <p>Olá, <strong>${nomeUsuario}</strong>!</p>
                <p>Seu código de verificação é:</p>
                <h1 style="letter-spacing: 8px; color: #1d4ed8">${codigo}</h1>
                <p>Válido por <strong>10 minutos</strong>. Não compartilhe com ninguém.</p>
                <br>
                <p>Sistema de Gestão de Atividades Complementares — SENAC</p>
            `
        });
        console.log(`Código 2FA enviado para ${emailUsuario}`);
    } catch (err) {
        console.error('Erro ao enviar código 2FA:', err.message);
    }
};