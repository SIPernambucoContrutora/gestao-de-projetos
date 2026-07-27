const { useState, useEffect } = React;

/* ------------------------------------------------------------------ *
 * Reference date. The whole app reasons about "atrasado" relative to
 * this. Matches the design document (27/07/2026).
 * ------------------------------------------------------------------ */
const TODAY = new Date(2026, 6, 27);

/* Table presentation knobs (adjustable "props" in the source design). */
const DENSIDADE = "Compacta";        // "Compacta" | "Confortável"
const MOSTRAR_META = true;           // show the "Meta" column on the detail board
const DESTACAR_ATRASADOS = true;     // tint rows of overdue items

const ETAPAS = ["Estudo preliminar", "Anteprojeto", "Pré-executivo", "Executivo", "Detalhamento"];
const DISCIPLINAS = ["Arquitetura", "Estrutura", "Fundação", "Instalações Elétricas", "Instalações Hidráulicas", "Incêndio", "Ar-condicionado", "Paisagismo", "Ambientação", "Automação", "Compatibilização"];

const EMPS = [
  { id: "e1", nome: "Aurora Prince", resp: "Marina Duarte", rev: "R03", revData: "12/06/2026" },
  { id: "e2", nome: "My Beach", resp: "Rafael Antunes", rev: "R01", revData: "28/05/2026" },
  { id: "e3", nome: "Rosarinho", resp: "Camila Rocha", rev: "R00", revData: "02/07/2026" },
  { id: "e4", nome: "Makai", resp: "Diego Salles", rev: "R02", revData: "19/06/2026" }
];

// emp, n, disciplina, etapa, planta, status, ini, prev, repro, real, meta, obs
const RAW = [
  ["e1", 1, "Arquitetura", "Executivo", "Plantas de pavimento tipo — torre A", "Finalizado", "04/03/2026", "10/04/2026", "", "08/04/2026", "D+30", "Aprovado pela incorporação."],
  ["e1", 2, "Arquitetura", "Detalhamento", "Detalhes de fachada e caixilhos", "Em andamento", "13/04/2026", "05/08/2026", "", "", "D+45", "Aguardando definição de esquadria."],
  ["e1", 3, "Estrutura", "Executivo", "Formas e armação — subsolo 1 e 2", "Em andamento", "02/04/2026", "15/07/2026", "07/08/2026", "", "D+60", "Reprogramado após revisão de fundação."],
  ["e1", 4, "Fundação", "Executivo", "Estaqueamento e blocos", "Finalizado", "18/02/2026", "20/03/2026", "", "24/03/2026", "D+30", "Entregue com 4 dias de atraso."],
  ["e1", 5, "Instalações Elétricas", "Pré-executivo", "Prumadas e quadros de distribuição", "Em andamento", "05/05/2026", "10/07/2026", "", "", "D+45", "Compatibilização pendente com estrutura."],
  ["e1", 6, "Instalações Hidráulicas", "Pré-executivo", "Água fria, esgoto e pluvial — torre A", "Em andamento", "05/05/2026", "18/07/2026", "", "", "D+45", ""],
  ["e1", 7, "Incêndio", "Anteprojeto", "Projeto de combate a incêndio — AVCB", "Pendente", "", "20/08/2026", "", "", "D+30", "Depende de arquitetura R04."],
  ["e1", 8, "Ar-condicionado", "Anteprojeto", "Infra de climatização — unidades tipo", "Em andamento", "12/06/2026", "30/07/2026", "", "", "D+30", ""],
  ["e1", 9, "Paisagismo", "Estudo preliminar", "Térreo, deck e área de piscina", "Pendente", "", "12/09/2026", "", "", "D+20", ""],
  ["e1", 10, "Ambientação", "Estudo preliminar", "Áreas comuns — hall e salão de festas", "Pendente", "", "25/09/2026", "", "", "D+20", "Escopo a confirmar com marketing."],
  ["e1", 11, "Automação", "Anteprojeto", "Portaria remota e controle de acesso", "Pendente", "", "05/07/2026", "", "", "D+25", "Fornecedor ainda não contratado."],
  ["e1", 12, "Compatibilização", "Executivo", "Rodada 2 — arquitetura x estrutura x instalações", "Em andamento", "01/06/2026", "14/07/2026", "05/08/2026", "", "D+15", "Rodada 3 prevista para agosto."],
  ["e1", 13, "Arquitetura", "Anteprojeto", "Implantação e acessos", "Finalizado", "10/01/2026", "20/02/2026", "", "17/02/2026", "D+40", ""],
  ["e1", 14, "Estrutura", "Anteprojeto", "Pré-dimensionamento da torre B", "Finalizado", "15/01/2026", "28/02/2026", "", "02/03/2026", "D+40", ""],
  ["e2", 1, "Arquitetura", "Executivo", "Planta de lajes corporativas 3º–12º", "Em andamento", "20/04/2026", "22/07/2026", "", "", "D+60", ""],
  ["e2", 2, "Estrutura", "Pré-executivo", "Núcleo rígido e lajes protendidas", "Em andamento", "28/04/2026", "10/08/2026", "", "", "D+60", ""],
  ["e2", 3, "Instalações Elétricas", "Anteprojeto", "Subestação e grupo gerador", "Pendente", "", "30/06/2026", "", "", "D+45", "Atrasado: concessionária não respondeu."],
  ["e2", 4, "Ar-condicionado", "Pré-executivo", "Central de água gelada", "Em andamento", "11/05/2026", "28/08/2026", "", "", "D+50", ""],
  ["e2", 5, "Incêndio", "Executivo", "Sprinklers e pressurização de escada", "Em andamento", "02/06/2026", "18/07/2026", "31/07/2026", "", "D+40", ""],
  ["e2", 6, "Compatibilização", "Pré-executivo", "Rodada 1 — todas as disciplinas", "Finalizado", "05/05/2026", "10/06/2026", "", "09/06/2026", "D+15", ""],
  ["e2", 7, "Ambientação", "Estudo preliminar", "Lobby e mezanino", "Pendente", "", "15/10/2026", "", "", "D+25", ""],
  ["e2", 8, "Automação", "Anteprojeto", "BMS e controle de iluminação", "Pendente", "", "20/07/2026", "", "", "D+30", ""],
  ["e3", 1, "Arquitetura", "Estudo preliminar", "Estudo de massas — 42 unidades", "Finalizado", "02/06/2026", "04/07/2026", "", "03/07/2026", "D+30", ""],
  ["e3", 2, "Fundação", "Estudo preliminar", "Sondagem e laudo geotécnico", "Em andamento", "08/07/2026", "10/08/2026", "", "", "D+30", ""],
  ["e3", 3, "Paisagismo", "Estudo preliminar", "Área de lazer central", "Pendente", "", "30/08/2026", "", "", "D+20", ""],
  ["e3", 4, "Instalações Hidráulicas", "Estudo preliminar", "Concepção de reservatórios", "Pendente", "", "12/07/2026", "", "", "D+20", "Atrasado desde a semana passada."],
  ["e3", 5, "Compatibilização", "Estudo preliminar", "Checagem inicial de viabilidade", "Em andamento", "10/07/2026", "05/08/2026", "", "", "D+15", ""],
  ["e4", 1, "Arquitetura", "Executivo", "Loteamento — 186 lotes, sistema viário", "Em andamento", "15/03/2026", "30/07/2026", "", "", "D+90", ""],
  ["e4", 2, "Instalações Elétricas", "Executivo", "Rede de distribuição e iluminação pública", "Em andamento", "01/04/2026", "20/07/2026", "12/08/2026", "", "D+60", "Reprogramado por exigência da concessionária."],
  ["e4", 3, "Instalações Hidráulicas", "Executivo", "Rede de água e esgoto", "Finalizado", "01/04/2026", "15/06/2026", "", "12/06/2026", "D+60", ""],
  ["e4", 4, "Paisagismo", "Anteprojeto", "Praças e faixas verdes", "Pendente", "", "18/07/2026", "", "", "D+30", ""],
  ["e4", 5, "Compatibilização", "Executivo", "Rodada 2 — infraestrutura urbana", "Em andamento", "20/05/2026", "08/08/2026", "", "", "D+15", ""],
  ["e4", 6, "Estrutura", "Executivo", "Muros de arrimo e contenções", "Finalizado", "12/03/2026", "28/05/2026", "", "05/06/2026", "D+45", "Entregue com atraso de 8 dias."]
];

const SEED_HISTORY = [
  ["e1", 3, "Isabela Nunes", "Prazo reprogramado", "—", "07/08/2026", "18/06/2026 14:32"],
  ["e1", 3, "Isabela Nunes", "Status", "Pendente", "Em andamento", "02/04/2026 09:05"],
  ["e1", 12, "Marina Duarte", "Prazo reprogramado", "14/07/2026", "05/08/2026", "26/06/2026 17:48"],
  ["e1", 2, "Rafael Antunes", "Etapa", "Executivo", "Detalhamento", "13/04/2026 11:20"],
  ["e1", 4, "Marina Duarte", "Status", "Em andamento", "Finalizado", "24/03/2026 16:02"],
  ["e2", 5, "Camila Rocha", "Prazo reprogramado", "—", "31/07/2026", "10/07/2026 10:14"],
  ["e2", 3, "Diego Salles", "Observações", "—", "Atrasado: concessionária não respondeu.", "08/07/2026 08:41"],
  ["e4", 2, "Diego Salles", "Prazo reprogramado", "—", "12/08/2026", "01/07/2026 15:27"]
];

const USERS = [
  { nome: "Marina Duarte", email: "marina.duarte@incorp.com.br", papel: "Admin", acesso: "27/07/2026 08:52" },
  { nome: "Rafael Antunes", email: "rafael.antunes@incorp.com.br", papel: "Equipe", acesso: "26/07/2026 18:10" },
  { nome: "Camila Rocha", email: "camila.rocha@incorp.com.br", papel: "Equipe", acesso: "27/07/2026 07:33" },
  { nome: "Isabela Nunes", email: "isabela.nunes@incorp.com.br", papel: "Equipe", acesso: "24/07/2026 16:45" },
  { nome: "Diego Salles", email: "diego.salles@incorp.com.br", papel: "Equipe", acesso: "25/07/2026 11:02" },
  { nome: "Paulo Vasques", email: "paulo@construtoravasques.com.br", papel: "Leitura", acesso: "21/07/2026 09:18" }
];

const TONE = {
  verde: { fg: "#155f3f", bg: "#e8f3ec", dot: "#1a7a4f" },
  ambar: { fg: "#875206", bg: "#fbf0da", dot: "#b57312" },
  vermelho: { fg: "#93281f", bg: "#fbe8e5", dot: "#b23a2b" },
  cinza: { fg: "#436469", bg: "#e4eff0", dot: "#8fb9bd" }
};

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

// Parse a "dd/mm/yyyy" string into a Date, or null when empty.
function parseBR(s) {
  if (!s) return null;
  const p = s.split("/");
  return new Date(+p[2], +p[1] - 1, +p[0]);
}
function days(a, b) { return Math.round((a - b) / 86400000); }

// Turn a "prop: value; prop2: value2;" string into a React style object.
function css(str) {
  const o = {};
  if (!str) return o;
  str.split(";").forEach(function (part) {
    const i = part.indexOf(":");
    if (i < 0) return;
    let k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;
    if (k.charAt(0) === "-" && k.charAt(1) === "-") { o[k] = v; return; }
    k = k.replace(/-([a-z])/g, function (_, c) { return c.toUpperCase(); });
    o[k] = v;
  });
  return o;
}

// Compute the visual status (tone/label) and schedule deviation for an item.
function derive(it) {
  const alvo = parseBR(it.repro || it.prev);
  const real = parseBR(it.real);
  let tone = "cinza", label = it.status;
  if (it.status === "Finalizado") { tone = "verde"; }
  else if (alvo && alvo < TODAY) { tone = "vermelho"; label = "Atrasado"; }
  else if (it.status === "Em andamento") { tone = "ambar"; }
  let desvio = "—";
  if (real && alvo) { const d = days(real, alvo); desvio = d === 0 ? "no prazo" : (d > 0 ? "+" + d + "d" : d + "d"); }
  else if (alvo && it.status !== "Finalizado") { const d = days(TODAY, alvo); desvio = d > 0 ? "+" + d + "d" : d + "d"; }
  return { tone: tone, label: label, desvio: desvio, atrasado: tone === "vermelho" };
}

function badgeStyle(tone) {
  const t = TONE[tone];
  return "display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px 2px 7px; border-radius: 4px; font-size: 11.5px; font-weight: 500; white-space: nowrap; color: " + t.fg + "; background: " + t.bg + ";";
}
function dotStyle(tone) {
  return "width: 6px; height: 6px; border-radius: 50%; flex: 0 0 6px; background: " + TONE[tone].dot + ";";
}

// Aggregate stats (total / finalizados / em andamento / atrasados / %) for one empreendimento.
function empStats(items, id) {
  const list = items.filter(function (i) { return i.emp === id; });
  let fin = 0, and = 0, atr = 0;
  list.forEach(function (i) {
    const d = derive(i);
    if (i.status === "Finalizado") fin++;
    else if (d.atrasado) atr++;
    else if (i.status === "Em andamento") and++;
  });
  const pct = list.length ? Math.round((fin / list.length) * 100) : 0;
  return { total: list.length, fin: fin, and: and, atr: atr, pct: pct };
}

function navStyle(active) {
  return "display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border: none; border-radius: 5px; font-size: 13px; text-align: left; cursor: pointer; "
    + (active ? "background: rgba(255,255,255,0.16); color: #ffffff; font-weight: 500;" : "background: transparent; color: #a8d6db;");
}

/* ------------------------------------------------------------------ *
 * Persistence — edits to items/history survive a reload.
 * ------------------------------------------------------------------ */
const STORE_KEY = "gestao-obras-v1";

function loadPersisted() {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* storage unavailable — fall back to seed data */ }
  return null;
}
function persist(items, history) {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify({ items: items, history: history })); }
  catch (e) { /* ignore quota/availability errors */ }
}

function makeInitialState() {
  const saved = loadPersisted();
  return {
    logged: false,
    loginEmail: "marina.duarte@incorp.com.br",
    loginSenha: "",
    screen: "dashboard",
    empId: "e1",
    fEmp: "all",
    fDisc: "all",
    fEtapa: "all",
    fStatus: "all",
    busca: "",
    open: null,
    draft: null,
    items: (saved && saved.items) || RAW.map(function (r, i) {
      return { key: i, emp: r[0], n: r[1], disc: r[2], etapa: r[3], planta: r[4], status: r[5], ini: r[6], prev: r[7], repro: r[8], real: r[9], meta: r[10], obs: r[11] };
    }),
    history: (saved && saved.history) || SEED_HISTORY.map(function (h) {
      return { emp: h[0], n: h[1], user: h[2], campo: h[3], de: h[4], para: h[5], data: h[6] };
    })
  };
}

/* ------------------------------------------------------------------ *
 * Small reusable pieces
 * ------------------------------------------------------------------ */
function NavIcon({ name }) {
  const common = { width: 15, height: 15, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4 };
  if (name === "dash") return (
    <svg {...common}><rect x="1.5" y="1.5" width="5" height="5" /><rect x="9.5" y="1.5" width="5" height="5" /><rect x="1.5" y="9.5" width="5" height="5" /><rect x="9.5" y="9.5" width="5" height="5" /></svg>
  );
  if (name === "emps") return (
    <svg {...common}><rect x="1.5" y="4.5" width="6" height="10" /><rect x="9.5" y="1.5" width="5" height="13" /></svg>
  );
  if (name === "board") return (
    <svg {...common}><rect x="1.5" y="1.5" width="13" height="13" /><line x1="1.5" y1="5.5" x2="14.5" y2="5.5" /><line x1="6" y1="5.5" x2="6" y2="14.5" /></svg>
  );
  if (name === "hist") return (
    <svg {...common}><circle cx="8" cy="8" r="6.2" /><polyline points="8,4.4 8,8 10.6,9.6" /></svg>
  );
  return (
    <svg {...common}><circle cx="8" cy="5.5" r="2.8" /><path d="M2.6 14.2c0-2.6 2.4-4.2 5.4-4.2s5.4 1.6 5.4 4.2" /></svg>
  );
}

function StatusBadge({ tone, label }) {
  return (
    <span style={css(badgeStyle(tone))}>
      <span style={css(dotStyle(tone))}></span>{label}
    </span>
  );
}

const TH = { textAlign: "left", padding: "9px 12px", fontSize: "10.5px", fontWeight: 600, color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em" };
const THR = Object.assign({}, TH, { textAlign: "right" });

/* ------------------------------------------------------------------ *
 * App
 * ------------------------------------------------------------------ */
function App() {
  const [state, setStateRaw] = useState(makeInitialState);

  // class-component-style merge (mirrors the design's this.setState).
  const setState = function (patch) {
    setStateRaw(function (s) {
      const p = typeof patch === "function" ? patch(s) : patch;
      return Object.assign({}, s, p);
    });
  };

  useEffect(function () { persist(state.items, state.history); }, [state.items, state.history]);

  // ---- handlers ----
  const go = function (s) { return function () { setState({ screen: s, open: null, draft: null }); }; };
  const openItem = function (key) {
    return function () {
      const it = state.items.filter(function (i) { return i.key === key; })[0];
      setState({ open: key, draft: Object.assign({}, it) });
    };
  };
  const draftHandler = function (field) {
    return function (e) {
      const v = e.target.value;
      setState(function (s) { return { draft: Object.assign({}, s.draft, { [field]: v }) }; });
    };
  };
  const closeDrawer = function () { setState({ open: null, draft: null }); };
  const saveDraft = function () {
    const d = state.draft;
    if (!d) return;
    const orig = state.items.filter(function (i) { return i.key === d.key; })[0];
    const labels = { status: "Status", etapa: "Etapa", ini: "Data de início", prev: "Prazo previsto", repro: "Prazo reprogramado", real: "Prazo realizado", obs: "Observações" };
    const novas = [];
    Object.keys(labels).forEach(function (f) {
      if ((orig[f] || "") !== (d[f] || "")) {
        novas.push({ emp: d.emp, n: d.n, user: "Marina Duarte", campo: labels[f], de: orig[f] || "—", para: d[f] || "—", data: "27/07/2026 09:14" });
      }
    });
    setState(function (s) {
      return {
        items: s.items.map(function (i) { return i.key === d.key ? Object.assign({}, d) : i; }),
        history: novas.concat(s.history),
        open: null, draft: null
      };
    });
  };

  // ================= LOGIN =================
  if (!state.logged) {
    return (
      <div style={{ minHeight: "100vh", width: "100%", background: "#eef6f7", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ width: "100%", maxWidth: "372px" }}>
          <div style={{ textAlign: "center", marginBottom: "26px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase" }}>GESTÃO DAS OBRAS</div>
            <div style={{ fontSize: "12px", color: "#5f8b90", marginTop: "4px" }}>Acompanhamento de projetos técnicos</div>
          </div>
          <form onSubmit={function (e) { e.preventDefault(); setState({ logged: true, screen: "dashboard" }); }} style={{ background: "#fff", border: "1px solid #d3e4e6", borderRadius: "8px", padding: "26px 26px 24px" }}>
            <h1 style={{ margin: "0 0 18px", fontSize: "16px", fontWeight: 600 }}>Entrar</h1>
            <label style={{ display: "block", marginBottom: "14px" }}>
              <span style={{ display: "block", fontSize: "10.5px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>E-mail</span>
              <input type="email" value={state.loginEmail} onChange={function (e) { setState({ loginEmail: e.target.value }); }} placeholder="nome.sobrenome@pernambucoconstrutora.com.br" style={{ width: "100%", padding: "9px 11px", border: "1px solid #c8dde0", borderRadius: "5px", fontSize: "13.5px" }} />
            </label>
            <label style={{ display: "block", marginBottom: "18px" }}>
              <span style={{ display: "block", fontSize: "10.5px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "6px" }}>Senha</span>
              <input type="password" value={state.loginSenha} onChange={function (e) { setState({ loginSenha: e.target.value }); }} placeholder="••••••••" style={{ width: "100%", padding: "9px 11px", border: "1px solid #c8dde0", borderRadius: "5px", fontSize: "13.5px" }} />
            </label>
            <button type="submit" className="btn-primary" style={{ width: "100%", padding: "10px 16px", border: "1px solid #0099A5", borderRadius: "5px", background: "#0099A5", color: "#fff", fontSize: "13.5px", fontWeight: 500, cursor: "pointer" }}>Entrar</button>
          </form>
          <div style={{ textAlign: "center", fontSize: "11.5px", color: "#7ba3a8", marginTop: "16px" }}>Acesso restrito à equipe. Novos usuários são cadastrados por um administrador.</div>
        </div>
      </div>
    );
  }

  // ================= computed values (mirrors renderVals) =================
  const s = state;
  const dense = DENSIDADE === "Compacta";
  const pad = dense ? "8px 12px" : "12px 12px";
  const destaque = DESTACAR_ATRASADOS !== false;
  const showMeta = MOSTRAR_META !== false;
  const isDetail = s.screen === "detail";

  const empName = {};
  EMPS.forEach(function (e) { empName[e.id] = e.nome; });

  const cell = "padding: " + pad + "; border-bottom: 1px solid #e7f3f4; vertical-align: middle;";
  const cellMono = cell + " font-family: 'IBM Plex Mono', monospace; font-size: 12px; color: #3f6166; white-space: nowrap;";
  const cellStrong = cell + " font-weight: 500;";
  const cellWide = cell + " color: #3f6166; max-width: 300px;";

  const rows = s.items.filter(function (i) {
    if (isDetail && i.emp !== s.empId) return false;
    if (!isDetail && s.fEmp !== "all" && i.emp !== s.fEmp) return false;
    if (s.fDisc !== "all" && i.disc !== s.fDisc) return false;
    if (s.fEtapa !== "all" && i.etapa !== s.fEtapa) return false;
    if (s.busca) {
      const q = s.busca.toLowerCase();
      if ((i.planta + " " + i.disc + " " + i.etapa).toLowerCase().indexOf(q) < 0) return false;
    }
    if (s.fStatus !== "all") {
      const d = derive(i);
      if (s.fStatus === "Atrasado" ? !d.atrasado : (i.status !== s.fStatus || d.atrasado)) return false;
    }
    return true;
  });

  const mapped = rows.map(function (i) {
    const d = derive(i);
    const desvioNeg = d.desvio.indexOf("+") === 0;
    return {
      key: i.key,
      n: String(i.n).padStart(2, "0"),
      empNome: empName[i.emp],
      disc: i.disc, etapa: i.etapa, planta: i.planta, meta: i.meta,
      ini: i.ini || "—", prev: i.prev || "—", repro: i.repro || "—", real: i.real || "—",
      statusLabel: d.label, tone: d.tone,
      desvio: d.desvio,
      desvioStyle: cell + " text-align: right; font-family: 'IBM Plex Mono', monospace; font-size: 12px; white-space: nowrap; color: " + (desvioNeg && i.status !== "Finalizado" ? "#b23a2b" : "#679297") + ";",
      rowStyle: "cursor: pointer; " + (destaque && d.atrasado ? "background: #fefaf9;" : ""),
      onOpen: openItem(i.key)
    };
  });

  const all = s.items.filter(function (i) { return s.fEmp === "all" || i.emp === s.fEmp; });
  let fin = 0, and = 0, atr = 0;
  all.forEach(function (i) {
    const d = derive(i);
    if (i.status === "Finalizado") fin++; else if (d.atrasado) atr++; else if (i.status === "Em andamento") and++;
  });
  const pctFin = all.length ? Math.round((fin / all.length) * 100) : 0;
  const mDot = function (tone) { return "width: 7px; height: 7px; border-radius: 50%; background: " + (tone ? TONE[tone].dot : "#a8c8cc") + ";"; };

  const chips = [
    { key: "all", label: "Todos" },
    { key: "Finalizado", label: "Finalizados" },
    { key: "Em andamento", label: "Em andamento" },
    { key: "Atrasado", label: "Atrasados" },
    { key: "Pendente", label: "Pendentes" }
  ].map(function (c) {
    const on = s.fStatus === c.key;
    return {
      key: c.key,
      label: c.label,
      onClick: function () { setState({ fStatus: c.key }); },
      style: "padding: 7px 11px; border-radius: 5px; font-size: 12.5px; cursor: pointer; border: 1px solid " + (on ? "#0099A5" : "#c8dde0") + "; background: " + (on ? "#0099A5" : "#fff") + "; color: " + (on ? "#fff" : "#3f6166") + ";"
    };
  });

  const st = empStats(s.items, s.empId);
  const empRow = EMPS.filter(function (e) { return e.id === s.empId; })[0];
  const emp = Object.assign({}, empRow, st, { barStyle: "height: 100%; width: " + st.pct + "%; background: #0099A5; border-radius: 3px;" });

  const empCards = EMPS.map(function (e) {
    const k = empStats(s.items, e.id);
    return Object.assign({}, e, k, {
      barStyle: "height: 100%; width: " + k.pct + "%; background: #0099A5; border-radius: 3px;",
      badgeAnd: badgeStyle("ambar"),
      badgeAtr: badgeStyle(k.atr ? "vermelho" : "cinza"),
      onOpen: function () { setState({ screen: "detail", empId: e.id, fStatus: "all", fDisc: "all", busca: "" }); }
    });
  });

  const metrics = [
    { label: "Total de itens", value: all.length, sub: (s.fEmp === "all" ? EMPS.length + " empreendimentos" : empName[s.fEmp]), dot: mDot(null) },
    { label: "Finalizados", value: pctFin + "%", sub: fin + " de " + all.length + " itens", dot: mDot("verde") },
    { label: "Em andamento", value: and, sub: "dentro do prazo", dot: mDot("ambar") },
    { label: "Atrasados", value: atr, sub: "exigem reprogramação", dot: mDot("vermelho") }
  ];

  const historyAll = s.history.map(function (h) {
    return Object.assign({}, h, { ctx: empName[h.emp] + " · item " + String(h.n).padStart(2, "0") });
  });

  const users = USERS.map(function (u) {
    return Object.assign({}, u, { roleStyle: badgeStyle("cinza") + (u.papel === "Admin" ? " border: 1px solid #c8dde0;" : "") });
  });

  const draft = s.draft;
  let draftVals = null, draftHistory = [];
  if (draft) {
    const d = derive(draft);
    draftVals = Object.assign({}, draft, {
      nP: String(draft.n).padStart(2, "0"),
      empNome: empName[draft.emp],
      statusLabel: d.label, tone: d.tone,
      desvio: d.desvio,
      desvioStyle: "font-family: 'IBM Plex Mono', monospace; font-size: 13px; margin-top: 3px; color: " + (d.atrasado ? "#b23a2b" : "#0e3438") + ";"
    });
    draftHistory = s.history.filter(function (h) { return h.emp === draft.emp && h.n === draft.n; });
  }

  const navItems = [
    { name: "dash", label: "Dashboard", active: s.screen === "dashboard", onClick: go("dashboard"), icon: "dash" },
    { name: "emps", label: "Empreendimentos", active: s.screen === "emps", onClick: go("emps"), icon: "emps" },
    { name: "detail", label: "Quadro de itens", active: isDetail, onClick: go("detail"), icon: "board" },
    { name: "hist", label: "Histórico", active: s.screen === "hist", onClick: go("hist"), icon: "hist" },
    { name: "users", label: "Usuários", active: s.screen === "users", onClick: go("users"), icon: "users" }
  ];

  // ================= APP SHELL =================
  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%", background: "#eef6f7" }}>

      {/* ---------- sidebar ---------- */}
      <aside style={{ width: "228px", flex: "0 0 228px", background: "#064a52", borderRight: "1px solid #064a52", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "22px 20px 18px", borderBottom: "1px solid rgba(255,255,255,0.14)" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ffffff" }}>GESTÃO DAS OBRAS</div>
          <div style={{ fontSize: "11px", color: "#8fc9cf", marginTop: "3px" }}>Gestão de projetos técnicos</div>
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "2px", padding: "12px 10px" }}>
          {navItems.map(function (n) {
            return (
              <button key={n.name} className="nav-item" onClick={n.onClick} style={css(navStyle(n.active))}>
                <NavIcon name={n.icon} />
                <span>{n.label}</span>
              </button>
            );
          })}
        </nav>

        <div style={{ marginTop: "auto", borderTop: "1px solid rgba(255,255,255,0.14)", padding: "14px 16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(255,255,255,0.16)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "#ffffff" }}>MD</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#ffffff" }}>Hugo Duarte</div>
            <div style={{ fontSize: "10.5px", color: "#8fc9cf", letterSpacing: "0.04em", textTransform: "uppercase" }}>Admin</div>
          </div>
        </div>
      </aside>

      {/* ---------- main ---------- */}
      <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

        {/* ===== DASHBOARD ===== */}
        {s.screen === "dashboard" && (
          <div>
            <header style={{ background: "#ffffff", borderBottom: "1px solid #d3e4e6", padding: "20px 28px 0" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 600, letterSpacing: "-0.01em" }}>Dashboard</h1>
                  <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#5f8b90" }}>Visão consolidada dos itens de projeto — atualizada em 27/07/2026, 09:12</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingTop: "2px" }}>
                  <span style={{ fontSize: "11px", color: "#5f8b90", textTransform: "uppercase", letterSpacing: "0.06em" }}>Empreendimento</span>
                  <select value={s.fEmp} onChange={function (e) { setState({ fEmp: e.target.value }); }} style={{ minWidth: "240px", padding: "7px 10px", border: "1px solid #c8dde0", borderRadius: "5px", background: "#fff", fontSize: "13px" }}>
                    <option value="all">Todos os empreendimentos</option>
                    {EMPS.map(function (e) { return <option key={e.id} value={e.id}>{e.nome}</option>; })}
                  </select>
                </div>
              </div>
              <div style={{ display: "flex", gap: "20px", padding: "22px 0 0" }}>
                {metrics.map(function (m, i) {
                  return (
                    <div key={i} style={{ flex: 1, border: "1px solid #d3e4e6", borderRadius: "7px", padding: "14px 16px", background: "#fbfeff" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                        <span style={css(m.dot)}></span>
                        <span style={{ fontSize: "11px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.07em" }}>{m.label}</span>
                      </div>
                      <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "27px", fontWeight: 500, marginTop: "8px", letterSpacing: "-0.02em" }}>{m.value}</div>
                      <div style={{ fontSize: "11.5px", color: "#679297", marginTop: "2px" }}>{m.sub}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ height: "20px" }}></div>
            </header>

            <section style={{ padding: "18px 28px 40px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                <input value={s.busca} onChange={function (e) { setState({ busca: e.target.value }); }} placeholder="Buscar planta, escopo ou disciplina…" style={{ width: "280px", padding: "7px 10px", border: "1px solid #c8dde0", borderRadius: "5px", background: "#fff", fontSize: "13px" }} />
                <select value={s.fDisc} onChange={function (e) { setState({ fDisc: e.target.value }); }} style={{ padding: "7px 10px", border: "1px solid #c8dde0", borderRadius: "5px", background: "#fff", fontSize: "13px" }}>
                  <option value="all">Todas as disciplinas</option>
                  {DISCIPLINAS.map(function (d) { return <option key={d} value={d}>{d}</option>; })}
                </select>
                <select value={s.fEtapa} onChange={function (e) { setState({ fEtapa: e.target.value }); }} style={{ padding: "7px 10px", border: "1px solid #c8dde0", borderRadius: "5px", background: "#fff", fontSize: "13px" }}>
                  <option value="all">Todas as etapas</option>
                  {ETAPAS.map(function (et) { return <option key={et} value={et}>{et}</option>; })}
                </select>
                <div style={{ display: "flex", gap: "4px", marginLeft: "4px" }}>
                  {chips.map(function (c) { return <button key={c.key} onClick={c.onClick} style={css(c.style)}>{c.label}</button>; })}
                </div>
                <div style={{ marginLeft: "auto", fontSize: "12px", color: "#5f8b90", fontFamily: "'IBM Plex Mono', monospace" }}>{mapped.length} itens</div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #d3e4e6", borderRadius: "7px", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "980px", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ background: "#f4fafb", borderBottom: "1px solid #d3e4e6" }}>
                      <th style={Object.assign({}, TH, { width: "44px" })}>#</th>
                      <th style={TH}>Empreendimento</th>
                      <th style={TH}>Disciplina</th>
                      <th style={TH}>Etapa</th>
                      <th style={TH}>Status</th>
                      <th style={TH}>Prazo previsto</th>
                      <th style={TH}>Reprogramado</th>
                      <th style={TH}>Realizado</th>
                      <th style={THR}>Desvio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.map(function (r) {
                      return (
                        <tr key={r.key} className="row-item" onClick={r.onOpen} style={css(r.rowStyle)}>
                          <td style={css(cellMono)}>{r.n}</td>
                          <td style={css(cell)}><span style={{ color: "#3f6166" }}>{r.empNome}</span></td>
                          <td style={css(cellStrong)}>{r.disc}</td>
                          <td style={css(cell)}>{r.etapa}</td>
                          <td style={css(cell)}><StatusBadge tone={r.tone} label={r.statusLabel} /></td>
                          <td style={css(cellMono)}>{r.prev}</td>
                          <td style={css(cellMono)}>{r.repro}</td>
                          <td style={css(cellMono)}>{r.real}</td>
                          <td style={css(r.desvioStyle)}>{r.desvio}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ===== DETALHE / QUADRO DE ITENS ===== */}
        {isDetail && (
          <div>
            <header style={{ background: "#ffffff", borderBottom: "1px solid #d3e4e6", padding: "20px 28px 18px" }}>
              <div style={{ fontSize: "11px", color: "#679297", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "7px" }}>Empreendimentos / Detalhe</div>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "32px" }}>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 600, letterSpacing: "-0.01em" }}>{emp.nome}</h1>
                  <div style={{ display: "flex", gap: "22px", marginTop: "10px", flexWrap: "wrap" }}>
                    <div><div style={{ fontSize: "10.5px", color: "#679297", textTransform: "uppercase", letterSpacing: "0.06em" }}>Responsável</div><div style={{ fontSize: "13px", marginTop: "2px" }}>{emp.resp}</div></div>
                    <div><div style={{ fontSize: "10.5px", color: "#679297", textTransform: "uppercase", letterSpacing: "0.06em" }}>Revisão atual</div><div style={{ fontSize: "13px", marginTop: "2px", fontFamily: "'IBM Plex Mono', monospace" }}>{emp.rev}</div></div>
                    <div><div style={{ fontSize: "10.5px", color: "#679297", textTransform: "uppercase", letterSpacing: "0.06em" }}>Data da revisão</div><div style={{ fontSize: "13px", marginTop: "2px", fontFamily: "'IBM Plex Mono', monospace" }}>{emp.revData}</div></div>
                    <div><div style={{ fontSize: "10.5px", color: "#679297", textTransform: "uppercase", letterSpacing: "0.06em" }}>Itens</div><div style={{ fontSize: "13px", marginTop: "2px", fontFamily: "'IBM Plex Mono', monospace" }}>{emp.total}</div></div>
                  </div>
                </div>
                <div style={{ width: "260px", flex: "0 0 260px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    <span>Progresso</span><span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#0e3438" }}>{emp.pct}%</span>
                  </div>
                  <div style={{ height: "6px", background: "#dfedef", borderRadius: "3px", marginTop: "7px", overflow: "hidden" }}>
                    <div style={css(emp.barStyle)}></div>
                  </div>
                  <div style={{ display: "flex", gap: "12px", marginTop: "10px", fontSize: "11.5px", color: "#679297" }}>
                    <span>{emp.fin} finalizados</span><span>·</span><span>{emp.and} em andamento</span><span>·</span><span style={{ color: "#9b2c22" }}>{emp.atr} atrasados</span>
                  </div>
                </div>
              </div>
            </header>

            <section style={{ padding: "16px 28px 48px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
                <input value={s.busca} onChange={function (e) { setState({ busca: e.target.value }); }} placeholder="Buscar item…" style={{ width: "240px", padding: "7px 10px", border: "1px solid #c8dde0", borderRadius: "5px", background: "#fff", fontSize: "13px" }} />
                <select value={s.fDisc} onChange={function (e) { setState({ fDisc: e.target.value }); }} style={{ padding: "7px 10px", border: "1px solid #c8dde0", borderRadius: "5px", background: "#fff", fontSize: "13px" }}>
                  <option value="all">Todas as disciplinas</option>
                  {DISCIPLINAS.map(function (d) { return <option key={d} value={d}>{d}</option>; })}
                </select>
                <div style={{ display: "flex", gap: "4px" }}>
                  {chips.map(function (c) { return <button key={c.key} onClick={c.onClick} style={css(c.style)}>{c.label}</button>; })}
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: "8px", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", color: "#5f8b90", fontFamily: "'IBM Plex Mono', monospace" }}>{mapped.length} itens</span>
                  <button className="btn-soft" style={{ padding: "7px 13px", border: "1px solid #c8dde0", borderRadius: "5px", background: "#fff", fontSize: "12.5px", cursor: "pointer" }}>Exportar</button>
                  <button className="btn-primary" style={{ padding: "7px 13px", border: "1px solid #0099A5", borderRadius: "5px", background: "#0099A5", color: "#fff", fontSize: "12.5px", cursor: "pointer" }}>Novo item</button>
                </div>
              </div>

              <div style={{ background: "#fff", border: "1px solid #d3e4e6", borderRadius: "7px", overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: "1180px", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ background: "#f4fafb", borderBottom: "1px solid #d3e4e6" }}>
                      <th style={Object.assign({}, TH, { width: "44px" })}>#</th>
                      <th style={TH}>Disciplina</th>
                      <th style={TH}>Etapa</th>
                      <th style={TH}>Planta / escopo</th>
                      <th style={TH}>Status</th>
                      <th style={TH}>Início</th>
                      <th style={TH}>Previsto</th>
                      <th style={TH}>Reprog.</th>
                      <th style={TH}>Realizado</th>
                      {showMeta && <th style={TH}>Meta</th>}
                      <th style={THR}>Desvio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mapped.map(function (r) {
                      return (
                        <tr key={r.key} className="row-item" onClick={r.onOpen} style={css(r.rowStyle)}>
                          <td style={css(cellMono)}>{r.n}</td>
                          <td style={css(cellStrong)}>{r.disc}</td>
                          <td style={css(cell)}>{r.etapa}</td>
                          <td style={css(cellWide)}>{r.planta}</td>
                          <td style={css(cell)}><StatusBadge tone={r.tone} label={r.statusLabel} /></td>
                          <td style={css(cellMono)}>{r.ini}</td>
                          <td style={css(cellMono)}>{r.prev}</td>
                          <td style={css(cellMono)}>{r.repro}</td>
                          <td style={css(cellMono)}>{r.real}</td>
                          {showMeta && <td style={css(cellMono)}>{r.meta}</td>}
                          <td style={css(r.desvioStyle)}>{r.desvio}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ===== EMPREENDIMENTOS ===== */}
        {s.screen === "emps" && (
          <div>
            <header style={{ background: "#ffffff", borderBottom: "1px solid #d3e4e6", padding: "20px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 600 }}>Empreendimentos</h1>
                  <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#5f8b90" }}>{EMPS.length} empreendimentos ativos</p>
                </div>
                <button className="btn-primary" style={{ padding: "8px 14px", border: "1px solid #0099A5", borderRadius: "5px", background: "#0099A5", color: "#fff", fontSize: "12.5px", cursor: "pointer" }}>Novo empreendimento</button>
              </div>
            </header>
            <section style={{ padding: "20px 28px 48px", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: "14px" }}>
              {empCards.map(function (e) {
                return (
                  <div key={e.id} className="card-item" onClick={e.onOpen} style={{ background: "#fff", border: "1px solid #d3e4e6", borderRadius: "7px", padding: "16px 18px", cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                      <div style={{ fontSize: "14.5px", fontWeight: 600, letterSpacing: "-0.01em" }}>{e.nome}</div>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "11px", color: "#3f6166", border: "1px solid #cfe1e3", borderRadius: "4px", padding: "2px 6px", whiteSpace: "nowrap" }}>{e.rev}</span>
                    </div>
                    <div style={{ fontSize: "12px", color: "#5f8b90", marginTop: "5px" }}>{e.resp} · revisão {e.revData}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "#517d83", marginTop: "16px" }}>
                      <span>{e.fin}/{e.total} itens finalizados</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: "#0e3438" }}>{e.pct}%</span>
                    </div>
                    <div style={{ height: "6px", background: "#dfedef", borderRadius: "3px", marginTop: "7px", overflow: "hidden" }}>
                      <div style={css(e.barStyle)}></div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "14px" }}>
                      <span style={css(e.badgeAnd)}>{e.and} em andamento</span>
                      <span style={css(e.badgeAtr)}>{e.atr} atrasados</span>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {/* ===== HISTÓRICO ===== */}
        {s.screen === "hist" && (
          <div>
            <header style={{ background: "#ffffff", borderBottom: "1px solid #d3e4e6", padding: "20px 28px" }}>
              <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 600 }}>Histórico de alterações</h1>
              <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#5f8b90" }}>Auditoria de todos os campos editados nos itens de projeto</p>
            </header>
            <section style={{ padding: "22px 28px 48px", maxWidth: "900px" }}>
              {historyAll.map(function (h, i) {
                return (
                  <div key={i} style={{ display: "flex", gap: "14px", paddingBottom: "18px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "4px" }}>
                      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#86adb1" }}></span>
                      <span style={{ flex: 1, width: "1px", background: "#d3e4e6", marginTop: "4px" }}></span>
                    </div>
                    <div style={{ flex: 1, background: "#fff", border: "1px solid #d3e4e6", borderRadius: "6px", padding: "11px 14px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
                        <div style={{ fontSize: "12.5px" }}><span style={{ fontWeight: 600 }}>{h.user}</span> alterou <span style={{ fontWeight: 500 }}>{h.campo}</span></div>
                        <div style={{ fontSize: "11.5px", color: "#679297", fontFamily: "'IBM Plex Mono', monospace", whiteSpace: "nowrap" }}>{h.data}</div>
                      </div>
                      <div style={{ fontSize: "12px", color: "#517d83", marginTop: "6px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <span style={{ textDecoration: "line-through", color: "#7ba3a8" }}>{h.de}</span>
                        <span>→</span>
                        <span style={{ color: "#0e3438", fontWeight: 500 }}>{h.para}</span>
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#679297", marginTop: "7px" }}>{h.ctx}</div>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        )}

        {/* ===== USUÁRIOS ===== */}
        {s.screen === "users" && (
          <div>
            <header style={{ background: "#ffffff", borderBottom: "1px solid #d3e4e6", padding: "20px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "19px", fontWeight: 600 }}>Usuários</h1>
                  <p style={{ margin: "4px 0 0", fontSize: "12.5px", color: "#5f8b90" }}>Somente administradores podem convidar ou alterar papéis</p>
                </div>
              </div>
            </header>
            <section style={{ padding: "20px 28px 48px", maxWidth: "900px" }}>
              <div style={{ background: "#fff", border: "1px solid #d3e4e6", borderRadius: "7px", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "#f4fafb", borderBottom: "1px solid #d3e4e6" }}>
                      <th style={Object.assign({}, TH, { padding: "9px 14px" })}>Nome</th>
                      <th style={Object.assign({}, TH, { padding: "9px 14px" })}>E-mail</th>
                      <th style={Object.assign({}, TH, { padding: "9px 14px" })}>Papel</th>
                      <th style={Object.assign({}, TH, { padding: "9px 14px" })}>Último acesso</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(function (u, i) {
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #e6f1f2" }}>
                          <td style={{ padding: "11px 14px" }}>{u.nome}</td>
                          <td style={{ padding: "11px 14px", color: "#517d83" }}>{u.email}</td>
                          <td style={{ padding: "11px 14px" }}><span style={css(u.roleStyle)}>{u.papel}</span></td>
                          <td style={{ padding: "11px 14px", color: "#517d83", fontFamily: "'IBM Plex Mono', monospace", fontSize: "12px" }}>{u.acesso}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

      </main>

      {/* ---------- drawer (edit item) ---------- */}
      {draftVals && (
        <div>
          <div onClick={closeDrawer} style={{ position: "fixed", inset: 0, background: "rgba(5,52,57,0.32)", animation: "dcFade 140ms ease-out" }}></div>
          <aside style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: "460px", background: "#fff", borderLeft: "1px solid #d3e4e6", boxShadow: "-8px 0 32px rgba(5,52,57,0.12)", display: "flex", flexDirection: "column", animation: "dcSlideIn 160ms ease-out" }}>
            <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid #dfedef" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
                <div>
                  <div style={{ fontSize: "11px", color: "#679297", fontFamily: "'IBM Plex Mono', monospace" }}>ITEM {draftVals.nP} · {draftVals.empNome}</div>
                  <h2 style={{ margin: "6px 0 0", fontSize: "17px", fontWeight: 600 }}>{draftVals.disc}</h2>
                  <div style={{ fontSize: "12.5px", color: "#517d83", marginTop: "3px" }}>{draftVals.planta}</div>
                </div>
                <button onClick={closeDrawer} className="btn-soft" style={{ border: "1px solid #cfe1e3", background: "#fff", borderRadius: "5px", width: "28px", height: "28px", cursor: "pointer", color: "#517d83", fontSize: "15px", lineHeight: 1 }}>×</button>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: "10.5px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Status</span>
                  <select value={draftVals.status} onChange={draftHandler("status")} style={{ width: "100%", padding: "8px 10px", border: "1px solid #c8dde0", borderRadius: "5px", background: "#fff", fontSize: "13px" }}>
                    <option value="Pendente">Pendente</option>
                    <option value="Em andamento">Em andamento</option>
                    <option value="Finalizado">Finalizado</option>
                  </select>
                  <span style={{ display: "block", fontSize: "11px", color: "#7ba3a8", marginTop: "5px" }}>A cor do badge é calculada automaticamente (atraso vem do prazo).</span>
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: "10.5px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Etapa</span>
                  <select value={draftVals.etapa} onChange={draftHandler("etapa")} style={{ width: "100%", padding: "8px 10px", border: "1px solid #c8dde0", borderRadius: "5px", background: "#fff", fontSize: "13px" }}>
                    {ETAPAS.map(function (et) { return <option key={et} value={et}>{et}</option>; })}
                  </select>
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: "10.5px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Data de início</span>
                  <input value={draftVals.ini || ""} onChange={draftHandler("ini")} style={{ width: "100%", padding: "8px 10px", border: "1px solid #c8dde0", borderRadius: "5px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: "10.5px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Prazo previsto</span>
                  <input value={draftVals.prev || ""} onChange={draftHandler("prev")} style={{ width: "100%", padding: "8px 10px", border: "1px solid #c8dde0", borderRadius: "5px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: "10.5px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Prazo reprogramado</span>
                  <input value={draftVals.repro || ""} onChange={draftHandler("repro")} style={{ width: "100%", padding: "8px 10px", border: "1px solid #c8dde0", borderRadius: "5px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }} />
                </label>
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: "10.5px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Prazo realizado</span>
                  <input value={draftVals.real || ""} onChange={draftHandler("real")} style={{ width: "100%", padding: "8px 10px", border: "1px solid #c8dde0", borderRadius: "5px", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }} />
                </label>
              </div>

              <label style={{ display: "block", marginTop: "14px" }}>
                <span style={{ display: "block", fontSize: "10.5px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "5px" }}>Observações</span>
                <textarea value={draftVals.obs || ""} onChange={draftHandler("obs")} rows="3" style={{ width: "100%", padding: "9px 10px", border: "1px solid #c8dde0", borderRadius: "5px", fontSize: "13px", resize: "vertical" }}></textarea>
              </label>

              <div style={{ display: "flex", gap: "10px", marginTop: "16px", padding: "12px 14px", background: "#f4fafb", border: "1px solid #dfedef", borderRadius: "6px" }}>
                <div style={{ flex: 1 }}><div style={{ fontSize: "10.5px", color: "#679297", textTransform: "uppercase", letterSpacing: "0.06em" }}>Meta</div><div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px", marginTop: "3px" }}>{draftVals.meta}</div></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: "10.5px", color: "#679297", textTransform: "uppercase", letterSpacing: "0.06em" }}>Desvio</div><div style={css(draftVals.desvioStyle)}>{draftVals.desvio}</div></div>
                <div style={{ flex: 1 }}><div style={{ fontSize: "10.5px", color: "#679297", textTransform: "uppercase", letterSpacing: "0.06em" }}>Situação</div><div style={{ marginTop: "3px" }}><StatusBadge tone={draftVals.tone} label={draftVals.statusLabel} /></div></div>
              </div>

              <div style={{ marginTop: "22px" }}>
                <div style={{ fontSize: "10.5px", color: "#517d83", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>Histórico do item</div>
                {draftHistory.map(function (h, i) {
                  return (
                    <div key={i} style={{ display: "flex", gap: "11px", paddingBottom: "14px" }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: "5px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#93bcc1" }}></span>
                        <span style={{ flex: 1, width: "1px", background: "#dfedef", marginTop: "4px" }}></span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "12.5px" }}><span style={{ fontWeight: 600 }}>{h.user}</span> · <span>{h.campo}</span></div>
                        <div style={{ fontSize: "12px", color: "#517d83", marginTop: "3px" }}><span style={{ textDecoration: "line-through", color: "#7ba3a8" }}>{h.de}</span> → <span style={{ color: "#0e3438" }}>{h.para}</span></div>
                        <div style={{ fontSize: "11px", color: "#7ba3a8", marginTop: "3px", fontFamily: "'IBM Plex Mono', monospace" }}>{h.data}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ borderTop: "1px solid #dfedef", padding: "13px 22px", display: "flex", justifyContent: "flex-end", gap: "8px", background: "#fff" }}>
              <button onClick={closeDrawer} className="btn-soft" style={{ padding: "8px 14px", border: "1px solid #c8dde0", borderRadius: "5px", background: "#fff", fontSize: "12.5px", cursor: "pointer" }}>Cancelar</button>
              <button onClick={saveDraft} className="btn-primary" style={{ padding: "8px 16px", border: "1px solid #0099A5", borderRadius: "5px", background: "#0099A5", color: "#fff", fontSize: "12.5px", cursor: "pointer" }}>Salvar alterações</button>
            </div>
          </aside>
        </div>
      )}

    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
