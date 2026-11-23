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
//     cadastro da empresa (padrão 7 dias). A folha fica pendente até essa data
//     passar; VT/VR entram como já pagos.

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

function addDias(dateIso, n) {
  const d = new Date(`${dateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(n || 0));
  return d.toISOString().slice(0, 10);
}

// Linhas a pagar derivadas (Folha/VT/VR) por empresa × quinzena de competência.
// A data de pagamento = fim da quinzena + prazo_folha do cadastro da empresa
// (padrão 7 dias). Devolve itens no formato das linhas derivadas de receita.
export function payablesAutomaticos(records, employees, companies, hojeIso) {
  const empById = new Map((employees || []).map(e => [e.id, e]));
  const coById  = new Map((companies || []).map(c => [c.id, c]));
  const porGrupo = new Map();

  for (const r of (records || [])) {
    if (!trabalhou(r)) continue;
    const emp = empById.get(r.employeeId);
    if (!emp) continue;
    const q = quinzenaDaData(r.date);
    if (!q) continue;
    const co = r.companyId ? coById.get(r.companyId) : null;
    const key = `${r.companyId || 'sem'}__${q.idx}`;
    if (!porGrupo.has(key)) porGrupo.set(key, { q, co, dias: new Map(), heMin: new Map() });
    const g = porGrupo.get(key);
    if (!g.dias.has(emp.id)) g.dias.set(emp.id, new Set());
    g.dias.get(emp.id).add(r.date);
    g.heMin.set(emp.id, (g.heMin.get(emp.id) || 0) + overtimeToMinutes(r.overtime));
  }

  const itens = [];
  for (const { q, co, dias, heMin } of porGrupo.values()) {
    let folha = 0, vt = 0, vr = 0, nAjudantes = 0, nDias = 0;
    for (const [empId, datas] of dias) {
      const emp = empById.get(empId);
      const d = datas.size;
      nAjudantes += 1;
      nDias += d;
      folha += d * Number(emp.dailyRate || 0)
             + (heMin.get(empId) || 0) / 60 * Number(emp.overtimeRate || 0);
      vt += d * Number(emp.vtDiario || 0);
      vr += d * Number(emp.vrDiario || 0);
    }
    const resumo = `${nAjudantes} ajudante${nAjudantes !== 1 ? 's' : ''} · ${nDias} diária${nDias !== 1 ? 's' : ''}`;
    const prazo = Number(co?.prazoFolha ?? 7);
    const dataPagamento = addDias(q.fim, prazo);
    const periodo = co?.name ? `${q.label} · ${co.name}` : q.label;
    const base = { date: dataPagamento, tipo: 'a_pagar', isManual: false, derivado: true, vencido: false };

    if (folha > 0) {
      itens.push({
        ...base, origem: 'Folha', valor: folha, status: dataPagamento <= hojeIso ? 'pago' : 'pendente',
        descricao: `Folha de Pagamento — ${periodo} (${resumo})`,
        classificacaoNome: 'Folha de Pagamento', classificacaoCor: COR_FOLHA,
      });
    }
    if (vt > 0) {
      itens.push({
        ...base, origem: 'Benefício', valor: vt, status: 'pago',
        descricao: `Vale Transporte (VT) — ${periodo} (${resumo})`,
        classificacaoNome: 'Benefícios', classificacaoCor: COR_VT,
      });
    }
    if (vr > 0) {
      itens.push({
        ...base, origem: 'Benefício', valor: vr, status: 'pago',
        descricao: `Vale Refeição (VR) — ${periodo} (${resumo})`,
        classificacaoNome: 'Benefícios', classificacaoCor: COR_VR,
      });
    }
  }

  return itens.sort((a, b) => a.date.localeCompare(b.date));
}
