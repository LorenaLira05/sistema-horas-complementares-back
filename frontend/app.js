/**
 * app.js — Integração Front-end ↔ Back-end
 * Portal Senac · Gestão de Horas Complementares
 *
 * Conecta as telas do index.html com a API Express (server.js).
 * Inclua este script no final do <body>:
 *   <script src="app.js"></script>
 */

// ─── CONFIG ────────────────────────────────────────────────────────────────
const API = 'http://localhost:3001'; // ajuste para o endereço do seu servidor

// ─── ESTADO ────────────────────────────────────────────────────────────────
let session = {
  token: localStorage.getItem('token') || null,
  perfil: localStorage.getItem('perfil') || null,
  curso_id: localStorage.getItem('curso_id') || null,
  nome: localStorage.getItem('nome') || null,
};

// ─── UTILITÁRIOS ───────────────────────────────────────────────────────────

/** Requisição autenticada genérica */
async function req(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API}${path}`, opts);
  const data = await res.json();

  if (!res.ok) throw new Error(data.erro || `Erro ${res.status}`);
  return data;
}

/** Exibe uma mensagem de toast temporária na tela */
function toast(msg, tipo = 'ok') {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position:fixed;bottom:28px;right:28px;z-index:9999;
    padding:12px 20px;border-radius:10px;font-size:13px;font-weight:600;
    color:#fff;box-shadow:0 4px 20px rgba(0,0,0,.2);
    background:${tipo === 'ok' ? '#1fa06a' : '#c94058'};
    animation:fadeIn .2s ease;
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/** Cria/atualiza uma linha de <tbody> com o template fornecido */
function setTbody(tbodyId, html) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = html;
}

/** Badge de status */
function badge(status) {
  const map = {
    PENDENTE: 'tp',
    APROVADO: 'ta',
    REJEITADO: 'tr2',
  };
  const label = { PENDENTE: 'Pendente', APROVADO: 'Aprovado', REJEITADO: 'Reprovado' };
  return `<span class="tag ${map[status] || ''}">${label[status] || status}</span>`;
}

// ─── NAVEGAÇÃO ─────────────────────────────────────────────────────────────

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  const el = document.getElementById(id);
  if (el) el.classList.add('on');
}

function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  const el = document.getElementById(id);
  if (el) el.classList.add('on');

  // Atualiza botões ativos na sidebar e topbar
  document.querySelectorAll('.sb-btn, .tt').forEach(b => {
    b.classList.toggle('on', b.dataset.v === id);
  });

  // Carrega dados sob demanda
  loadView(id);
}

// ─── ATUALIZAÇÃO DO PERFIL NA SIDEBAR ──────────────────────────────────────

function updateSidebarProfile() {
  const nameEl = document.querySelector('.pi2 strong');
  const roleEl = document.querySelector('.pi2 small');
  const avatarEl = document.querySelector('.pav');

  if (nameEl && session.nome) {
    nameEl.textContent = session.nome;
  }
  if (roleEl && session.perfil) {
    const perfilLabel = {
      COORDENADOR: 'Coordenador',
      SUPER_ADMIN: 'Super Admin',
      ALUNO: 'Aluno',
    };
    roleEl.textContent = perfilLabel[session.perfil] || session.perfil;
  }
  if (avatarEl && session.nome) {
    const initials = session.nome
      .split(' ')
      .slice(0, 2)
      .map(n => n[0])
      .join('');
    avatarEl.textContent = initials.toUpperCase();
  }
}

// ─── LOGIN ─────────────────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  const inputs = document.querySelectorAll('#lf input');
  const email = inputs[0].value.trim();
  const senha = inputs[1].value;

  const btn = document.querySelector('#lf .btn-in');
  btn.textContent = 'Entrando...';
  btn.disabled = true;

  try {
    const data = await req('POST', '/auth/login', { email, senha });

    // Persiste a sessão
    session.token = data.token;
    session.perfil = data.perfil;

    // Decodifica o JWT para extrair curso_id e nome (sem dependência externa)
    const payload = JSON.parse(atob(data.token.split('.')[1]));
    session.curso_id = payload.curso_id || null;
    session.nome = payload.nome || email;

    localStorage.setItem('token', session.token);
    localStorage.setItem('perfil', session.perfil);
    localStorage.setItem('curso_id', session.curso_id);
    localStorage.setItem('nome', session.nome);

    updateSidebarProfile();
    showScreen('ps');
    showView('dv');
    toast('Login realizado com sucesso!');
  } catch (err) {
    toast(err.message, 'err');
    btn.textContent = 'Entrar no Portal';
    btn.disabled = false;
  }
}

// ─── LOGOUT ────────────────────────────────────────────────────────────────

function handleLogout() {
  session = { token: null, perfil: null, curso_id: null, nome: null };
  ['token', 'perfil', 'curso_id', 'nome'].forEach(k => localStorage.removeItem(k));
  showScreen('ls');
}

// ─── CARGA DE DADOS POR VIEW ───────────────────────────────────────────────

function loadView(id) {
  switch (id) {
    case 'dv': loadDashboard(); break;
    case 'pv': loadProtocolos(); break;
    case 'sv': loadAlunos(); break;
    case 'rv': loadRegras(); break;
    default: break;
  }
}

// ── Dashboard ──────────────────────────────────────────────────────────────

async function loadDashboard() {
  if (!session.curso_id) return;
  try {
    const submissoes = await req('GET', `/coordenador/submissoes/${session.curso_id}`);
    const pendentes = submissoes.filter(s => s.status === 'PENDENTE').length;

    // Atualiza KPI "Protocolos Pendentes"
    const kvEls = document.querySelectorAll('.kv.r');
    if (kvEls[0]) kvEls[0].textContent = pendentes;

    // Preenche feed de atividades recentes (últimas 3)
    const feedEl = document.querySelector('.feed');
    if (feedEl && submissoes.length) {
      const recentes = submissoes.slice(0, 3);
      feedEl.innerHTML = recentes.map(s => `
        <li class="fi">
          <div class="fii fd">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="1" width="12" height="14" rx="1"/>
              <path d="M5 5h6M5 8h6M5 11h3"/>
            </svg>
          </div>
          <div class="fb">
            <strong>${s.nome_aluno || 'Aluno'}</strong> enviou certificado
            <small>Status: ${s.status} · ${s.horas_solicitadas || '–'}h solicitadas</small>
            <div class="fac">
              <button class="fbt fv" onclick="abrirValidacao(${s.id})">Validar</button>
              <button class="fbt fdt" onclick="showView('pv')">Detalhes</button>
            </div>
          </div>
          <span class="fm">${formatarData(s.created_at)}</span>
        </li>
      `).join('');
    }
  } catch (err) {
    console.warn('Dashboard:', err.message);
  }
}

// ── Protocolos ─────────────────────────────────────────────────────────────

async function loadProtocolos() {
  if (!session.curso_id) return;

  const tbody = document.querySelector('.ptab tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#627490">Carregando...</td></tr>';

  try {
    const data = await req('GET', `/coordenador/submissoes/${session.curso_id}`);

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:#627490">Nenhum protocolo encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map((s, i) => `
      <tr>
        <td><strong style="font-family:'Sora',sans-serif;font-size:12px">#PRT-${String(s.id).padStart(4, '0')}</strong></td>
        <td>
          <div class="sc">
            <div class="av ab">${initials(s.nome_aluno)}</div>
            ${s.nome_aluno || '–'}
          </div>
        </td>
        <td>${s.curso_id || '–'}</td>
        <td>${s.tipo_atividade || s.categoria || '–'}</td>
        <td><strong>${s.horas_solicitadas || '–'}h</strong></td>
        <td>${badge(s.status)}</td>
        <td class="dt">${formatarData(s.created_at)}</td>
        <td>
          <button class="vb" onclick="abrirValidacao(${s.id}, '${s.nome_aluno}', ${s.horas_solicitadas || 0})">
            Ver Detalhes
          </button>
        </td>
      </tr>
    `).join('');

    // Atualiza contador de pendentes no header
    const pkEls = document.querySelectorAll('.pk strong');
    if (pkEls[0]) pkEls[0].textContent = data.filter(s => s.status === 'PENDENTE').length;
    if (pkEls[1]) pkEls[1].textContent = data.filter(s => s.status !== 'PENDENTE').length;

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:24px;color:#c94058">${err.message}</td></tr>`;
  }
}

// ── Alunos ─────────────────────────────────────────────────────────────────

async function loadAlunos() {
  if (!session.curso_id) return;

  const section = document.getElementById('sv');
  if (!section) return;

  // Remove "empty state" padrão e cria tabela dinâmica
  section.innerHTML = `
    <h1 class="ptitle" style="margin-bottom:20px">Alunos</h1>
    <div class="card" style="padding:0;overflow:hidden">
      <table class="ptab">
        <thead>
          <tr>
            <th>Nome</th>
            <th>E-mail</th>
            <th>Matrícula</th>
          </tr>
        </thead>
        <tbody id="alunos-tbody">
          <tr><td colspan="3" style="text-align:center;padding:24px;color:#627490">Carregando...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  try {
    const data = await req('GET', `/coordenador/alunos/${session.curso_id}`);
    const tbody = document.getElementById('alunos-tbody');

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;padding:24px;color:#627490">Nenhum aluno cadastrado.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(a => `
      <tr>
        <td>
          <div class="sc">
            <div class="av ab">${initials(a.nome)}</div>
            ${a.nome}
          </div>
        </td>
        <td style="color:#627490">${a.email}</td>
        <td>${a.matricula || '–'}</td>
      </tr>
    `).join('');
  } catch (err) {
    const tbody = document.getElementById('alunos-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#c94058;padding:24px">${err.message}</td></tr>`;
  }
}

// ── Regulamento / Regras ───────────────────────────────────────────────────

async function loadRegras() {
  if (!session.curso_id) return;

  const section = document.getElementById('rv');
  if (!section) return;

  section.innerHTML = `
    <h1 class="ptitle" style="margin-bottom:20px">Regulamento</h1>
    <div class="card" id="regras-container" style="color:#627490;line-height:1.8">
      Carregando regras...
    </div>
  `;

  try {
    const data = await req('GET', `/coordenador/regras/${session.curso_id}`);
    const container = document.getElementById('regras-container');

    if (!data.length) {
      container.innerHTML = '<p>Nenhuma regra cadastrada para este curso.</p>';
      return;
    }

    container.innerHTML = `
      <table class="ptab">
        <thead>
          <tr>
            <th>Categoria</th>
            <th>Limite de Horas</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td>${r.nome_categoria}</td>
              <td><strong>${r.limite_horas}h</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    const container = document.getElementById('regras-container');
    if (container) container.innerHTML = `<p style="color:#c94058">${err.message}</p>`;
  }
}

// ─── MODAL DE VALIDAÇÃO ────────────────────────────────────────────────────

function abrirValidacao(submissaoId, nomeAluno = '', horas = 0) {
  // Remove modal anterior se existir
  document.getElementById('modal-validacao')?.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-validacao';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9000;
    background:rgba(7,27,62,.55);backdrop-filter:blur(4px);
    display:flex;align-items:center;justify-content:center;
  `;
  modal.innerHTML = `
    <div style="background:#fff;border-radius:16px;padding:32px;width:440px;max-width:95vw;box-shadow:0 8px 40px rgba(0,0,0,.2)">
      <h3 style="font-family:'Sora',sans-serif;font-size:18px;font-weight:800;color:#0f2240;margin-bottom:6px">
        Validar Protocolo #${String(submissaoId).padStart(4, '0')}
      </h3>
      <p style="font-size:13px;color:#627490;margin-bottom:20px">
        ${nomeAluno ? `Aluno: <strong>${nomeAluno}</strong> · ` : ''}${horas}h solicitadas
      </p>

      <label style="display:block;font-size:10px;font-weight:700;letter-spacing:.12em;color:#627490;text-transform:uppercase;margin-bottom:8px">
        Observações (opcional)
      </label>
      <textarea id="obs-validacao" style="width:100%;border:1.5px solid #dfe7f5;border-radius:8px;padding:10px 12px;font-size:13px;resize:vertical;min-height:90px;font-family:inherit;color:#0f2240" placeholder="Justifique o parecer..."></textarea>

      <div style="display:flex;gap:10px;margin-top:20px">
        <button id="btn-reprovar" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border-radius:8px;border:none;background:#fdeaed;color:#c94058;font-weight:700;font-size:13px;cursor:pointer">
          ✕ REPROVAR
        </button>
        <button id="btn-aprovar" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border-radius:8px;border:none;background:#1059a8;color:#fff;font-weight:700;font-size:13px;cursor:pointer">
          ✓ APROVAR
        </button>
      </div>
      <button onclick="document.getElementById('modal-validacao').remove()" style="width:100%;margin-top:10px;padding:9px;border-radius:8px;border:1.5px solid #dfe7f5;background:transparent;color:#627490;cursor:pointer;font-size:13px">
        Cancelar
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('btn-aprovar').onclick = () => validar(submissaoId, 'APROVADO');
  document.getElementById('btn-reprovar').onclick = () => validar(submissaoId, 'REJEITADO');

  // Fecha ao clicar fora
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function validar(id, status_final) {
  try {
    await req('PATCH', `/coordenador/validar/${id}`, { status_final });
    document.getElementById('modal-validacao')?.remove();
    toast(`Protocolo ${status_final === 'APROVADO' ? 'aprovado' : 'reprovado'} com sucesso!`);
    loadProtocolos(); // Recarrega a tabela
  } catch (err) {
    toast(err.message, 'err');
  }
}

// ─── HELPERS ───────────────────────────────────────────────────────────────

function initials(nome = '') {
  return nome.split(' ').slice(0, 2).map(n => n[0] || '').join('').toUpperCase() || '?';
}

function formatarData(iso) {
  if (!iso) return '–';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── INICIALIZAÇÃO ─────────────────────────────────────────────────────────

function init() {
  // Formulário de login
  document.getElementById('lf')?.addEventListener('submit', handleLogin);

  // Botão logout
  document.getElementById('lb')?.addEventListener('click', handleLogout);

  // Navegação: sidebar e topbar
  document.querySelectorAll('[data-v]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.v));
  });

  // Botão "Novo Protocolo" (placeholder — implemente conforme seu formulário)
  document.getElementById('bnp')?.addEventListener('click', () => {
    toast('Funcionalidade de novo protocolo em desenvolvimento.', 'err');
  });

  // Botões de aprovar/reprovar na view de Certificados (view estática existente)
  document.querySelector('.bapr')?.addEventListener('click', () => {
    toast('Use a tabela de Protocolos para validar submissões.', 'err');
  });
  document.querySelector('.brep')?.addEventListener('click', () => {
    toast('Use a tabela de Protocolos para reprovar submissões.', 'err');
  });

  // Se já logado, vai direto para o painel
  if (session.token) {
    updateSidebarProfile();
    showScreen('ps');
    showView('dv');
  } else {
    showScreen('ls');
  }
}

document.addEventListener('DOMContentLoaded', init);