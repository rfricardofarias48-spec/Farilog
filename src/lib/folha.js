// ── Contas a pagar automáticas (Folha, VT e VR) ────────────────────────────
//
// Mesma lógica do faturamento: as diárias realizadas geram custos que entram no
// Fluxo de Caixa sem precisar de lançamento manual. Os valores vêm do cadastro
// de cada ajudante (diaria, hora_extra, vt_diario, vr_diario).
//
// Regras:
//   • "Trabalhou" = registro com entrada (checkIn) ou já ativo/concluído.
//     Ausente e diárias apenas agendadas (scheduled) não contam.
//   • Dias = dias DISTINTOS trabalhados por ajudante na quinzena.
//   • Folha = dias × diaria + minutos de HE × hora_extra.
//   • VT    = dias × vt_diario   ·   VR = dias × vr_diario.
//   • Cada linha é datada no pagamento: fim da quinzena + prazo_folha do
//     cadastro da empresa (padrão 7 dias). A linha nasce PENDENTE e só é
//     confirmada como paga no Fluxo de Caixa.

import { overtimeToMinutes } from './timeUtils';

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const ultimoDiaDoMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Cores usadas nas fatias/etiquetas quando não há classificação no cadastro.
const COR_FOLHA = '#3A4F6B';
const COR_VT    = '#96671F';
const COR_VR    = '#557A3E';

// O ajudante trabalhou neste registro?
export function trabalhou(r) {
  if (!r || !r.employeeId || !r.date) return false;
  if (r.status === 'absent') return false;
  return Boolean(r.checkIn) || r.status === 'active' || r.status === 'completed';
}

// Quinzena de competência de uma data: { idx, inicio, fim, payDate, label }.
export function quinzenaDaData(dateIso) {
  const [y, m, d] = String(dateIso || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  const q = d <= 15 ? 0 : 1;
  const idx = (y - 2000) * 24 + (m - 1) * 2 + q;
  const last = ultimoDiaDoMes(y, m);
  const inicio = q === 0 ? iso(y, m, 1) : iso(y, m, 16);
  const fim    = q === 0 ? iso(y, m, 15) : iso(y, m, last);
  const payY   = q === 0 ? y : (m === 12 ? y + 1 : y);
  const payM   = q === 0 ? m : (m % 12) + 1;
  const payDate = iso(payY, payM, q === 0 ? 22 : 7);
  return { idx, inicio, fim, payDate, label: `${MESES_CURTOS[m - 1]}/${y} · Q${q + 1}` };
}

// Dias distintos trabalhados por ajudante. Devolve Map(employeeId → Set(datas)).
export function diasTrabalhadosPorAjudante(records) {
  const mapa = new Map();
  for (const r of (records || [])) {
    if (!trabalhou(r)) continue;
    if (!mapa.has(r.employeeId)) mapa.set(r.employeeId, new Set());
    mapa.get(r.employeeId).add(r.date);
  }
  return mapa;
}

const ddmm = (dateIso) => `${String(dateIso).slice(8, 10)}/${String(dateIso).slice(5, 7)}`;

function addDias(dateIso, n) {
  const d = new Date(`${dateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
}

// Sexta-feira que fecha a semana da data. Sábado/domingo caem na sexta seguinte,
// então entram no lote da semana que está por vir.
function sextaDaSemana(dateIso) {
  const d = new Date(`${dateIso}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0=Dom ... 6=Sáb
  const delta = dow === 5 ? 0 : dow === 6 ? 6 : dow === 0 ? 5 : 5 - dow;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Linhas a pagar derivadas (Folha/VT/VR) por empresa × período de pagamento.
//   • modo 'quinzena' → agrupa por quinzena e paga fim da quinzena + prazo_folha;
//   • modo 'semanal'  → agrupa por semana (fecha na sexta) e paga na quarta
//     seguinte (sexta + 5 dias).
// Devolve itens no formato das linhas derivadas de receita (sem id).
export function payablesAutomaticos(records, employees, companies, hojeIso) {
  const empById = new Map((employees || []).map(e => [e.id, e]));
  const coById  = new Map((companies || []).map(c => [c.id, c]));
  const porGrupo = new Map();

  for (const r of (records || [])) {
    if (!trabalhou(r)) continue;
    const emp = empById.get(r.employeeId);
    if (!emp) continue;
    const co = r.companyId ? coById.get(r.companyId) : null;
    const semanal = co?.folhaModo === 'semanal';

    let key, ref;
    if (semanal) {
      ref = sextaDaSemana(r.date);            // sexta que fecha a semana da diária
      key = `${r.companyId || 'sem'}__W${ref}`;
    } else {
      const q = quinzenaDaData(r.date);
      if (!q) continue;
      ref = q;
      key = `${r.companyId || 'sem'}__Q${q.idx}`;
    }

    if (!porGrupo.has(key)) porGrupo.set(key, { semanal, ref, co, dias: new Map(), heMin: new Map() });
    const g = porGrupo.get(key);
    if (!g.dias.has(emp.id)) g.dias.set(emp.id, new Set());
    g.dias.get(emp.id).add(r.date);
    g.heMin.set(emp.id, (g.heMin.get(emp.id) || 0) + overtimeToMinutes(r.overtime));
  }

  const itens = [];
  for (const [key, { semanal, ref, co, dias, heMin }] of porGrupo.entries()) {
    let folha = 0, vt = 0, vr = 0, nAjudantes = 0, nDias = 0, heTotal = 0;
    const detalhe = []; // por ajudante: diárias, HE e valor de cada componente
    for (const [empId, datas] of dias) {
      const emp = empById.get(empId);
      const d = datas.size;
      const he = heMin.get(empId) || 0;
      const vDiarias = d * Number(emp.dailyRate || 0);
      const vHe = he / 60 * Number(emp.overtimeRate || 0);
      const vFolha = vDiarias + vHe;
      const vVt = d * Number(emp.vtDiario || 0);
      const vVr = d * Number(emp.vrDiario || 0);
      nAjudantes += 1;
      nDias += d;
      heTotal += he;
      folha += vFolha; vt += vVt; vr += vVr;
      detalhe.push({
        nome: emp.name || '—', dias: d, heMin: he,
        diarias: vDiarias, he: vHe, folha: vFolha, vt: vVt, vr: vVr,
      });
    }

    // Recebedores do item: só quem tem valor no componente (folha/VT/VR).
    // Mantém os campos de detalhe (dias, HE, diárias) para a tela de Folha.
    const detalheDe = (campo) => detalhe
      .filter(x => x[campo] > 0)
      .map(x => ({ ...x, valor: x[campo] }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
    const resumo = `${nAjudantes} ajudante${nAjudantes !== 1 ? 's' : ''} · ${nDias} diária${nDias !== 1 ? 's' : ''}`;

    let dataPagamento, periodo, periodoLabel;
    if (semanal) {
      dataPagamento = addDias(ref, 5); // sexta + 5 = quarta-feira seguinte
      periodoLabel = `Semana ${ddmm(addDias(ref, -4))} a ${ddmm(ref)}`;
      periodo = `${periodoLabel}${co?.name ? ` · ${co.name}` : ''}`;
    } else {
      dataPagamento = addDias(ref.fim, Number(co?.prazoFolha ?? 7));
      periodoLabel = ref.label;
      periodo = co?.name ? `${ref.label} · ${co.name}` : ref.label;
    }

    // Empresa, período, quantidade de diárias e HE ficam no item para a lista
    // de pagamentos (por data) da aba Folha, sem recalcular nada lá.
    const base = {
      date: dataPagamento, tipo: 'a_pagar', isManual: false, derivado: true, vencido: false,
      empresa: co?.name || 'Sem empresa', companyId: co?.id || null,
      periodoLabel, dias: nDias, heMin: heTotal,
    };

    if (folha > 0) {
      itens.push({
        ...base, origem: 'Folha', valor: folha,
        // Chave estável da linha derivada: por ela o Fluxo de Caixa guarda a
        // confirmação de pagamento (tabela financeiro_fluxo_status).
        derivKey: `PAG:${key}`,
        // Nasce PENDENTE: só vira 'pago' quando confirmada na tela.
        status: 'pendente',
        descricao: `Folha de Pagamento — ${periodo} (${resumo})`,
        classificacaoNome: 'Folha de Pagamento', classificacaoCor: COR_FOLHA,
        breakdown: detalheDe('folha'),
      });
    }
    if (vt > 0) {
      itens.push({
        ...base, origem: 'Benefício', valor: vt,
        // Chave própria da linha de VT (mesmo grupo, linha separada).
        derivKey: `PAG:${key}:VT`,
        status: 'pendente',
        descricao: `Vale Transporte (VT) — ${periodo} (${resumo})`,
        classificacaoNome: 'Benefícios', classificacaoCor: COR_VT,
        breakdown: detalheDe('vt'),
      });
    }
    if (vr > 0) {
      itens.push({
        ...base, origem: 'Benefício', valor: vr,
        derivKey: `PAG:${key}:VR`,
        status: 'pendente',
        descricao: `Vale Refeição (VR) — ${periodo} (${resumo})`,
        classificacaoNome: 'Benefícios', classificacaoCor: COR_VR,
        breakdown: detalheDe('vr'),
      });
    }
  }

  return itens.sort((a, b) => a.date.localeCompare(b.date));
}
