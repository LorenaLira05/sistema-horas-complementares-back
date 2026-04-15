const pool = require('../src/config/database');
const bcrypt = require('bcrypt');

async function migrarUsuarios() {
  try {
    console.log('Iniciando migração de usuários...');

    const senhaPadrao = await bcrypt.hash('123456', 10);

    const students = await pool.query('SELECT id, email FROM students');

    for (const student of students.rows) {

      const existe = await pool.query(
        'SELECT id FROM usuarios WHERE referencia_id = $1 AND perfil = $2',
        [student.id, 'STUDENT']
      );

      if (existe.rows.length === 0) {
        await pool.query(
          'INSERT INTO usuarios (referencia_id, login, senha, perfil) VALUES ($1, $2, $3, $4)',
          [student.id, student.email, senhaPadrao, 'STUDENT']
        );
      }
    }

    console.log('Students migrados com sucesso!');

    const coordinators = await pool.query('SELECT id FROM coordinators');

    for (const coordinator of coordinators.rows) {

      const existe = await pool.query(
        'SELECT id FROM usuarios WHERE referencia_id = $1 AND perfil = $2',
        [coordinator.id, 'COORDINATOR']
      );

      if (existe.rows.length === 0) {

        const loginGerado = `coord_${coordinator.id}`;

        await pool.query(
          'INSERT INTO usuarios (login, senha, perfil, referencia_id) VALUES ($1, $2, $3, $4)',
          [loginGerado, senhaPadrao, 'COORDINATOR', coordinator.id]
        );
      }
    }

    console.log('Coordinators migrados com sucesso.');
    console.log('Migração finalizada.');

    process.exit();

  } catch (err) {
    console.error("Erro na migração:", err);
    process.exit(1);
  }
}

migrarUsuarios();