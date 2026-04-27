const Tesseract = require('tesseract.js');
const sharp = require('sharp');
const { fromPath } = require('pdf2pic');
const path = require('path');
const fs = require('fs');

const processarImagem = async (caminhoArquivo) => {
    const dir = path.dirname(caminhoArquivo);
    const nomeTemporario = `ocr_temp_${Date.now()}.png`;
    const caminhoProcessado = path.join(dir, nomeTemporario);

    await sharp(caminhoArquivo)
        .grayscale()
        .normalize()
        .toFile(caminhoProcessado);

    const { data } = await Tesseract.recognize(
        caminhoProcessado,
        'por+eng'
    );

    // remove arquivo temporário
    fs.unlinkSync(caminhoProcessado);

    return {
        texto: data.text.trim(),
        confianca: parseFloat(data.confidence.toFixed(2))
    };
};

const processarPdf = async (caminhoArquivo) => {
    const tmpDir = path.join(__dirname, '../../uploads/tmp');

    // 1️⃣ cria pasta antes de tudo
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }

    // 2️⃣ configura conversor
    const convert = fromPath(caminhoArquivo, {
        density: 300,
        saveFilename: `ocr_${Date.now()}`,
        savePath: tmpDir,
        format: 'png',
    });

    // 3️⃣ converte primeira página
    const pagina = await convert(1);

    // 🔎 DEBUG
    console.log("Imagem gerada:", pagina.path);
    console.log("Existe?", fs.existsSync(pagina.path));

    // 4️⃣ processa imagem
    const resultado = await processarImagem(pagina.path);

    // 5️⃣ remove imagem temporária
    if (fs.existsSync(pagina.path)) {
        fs.unlinkSync(pagina.path);
    }

    return resultado;
};

exports.executarOCR = async (caminhoArquivo, mimetype) => {
    try {

        const ehPdf =
            mimetype === 'application/pdf' ||
            caminhoArquivo.toLowerCase().endsWith('.pdf');

        if (ehPdf) {
            return await processarPdf(caminhoArquivo);
        } else {
            return await processarImagem(caminhoArquivo);
        }

    } catch (err) {
        console.error('Erro no OCR:', err.message);
        return { texto: null, confianca: null };
    }
};