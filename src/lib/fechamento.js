// Fechamento de faturamento por empresa.
//
// Cada empresa fecha em uma cadência (diária, semanal, a cada 10 dias ou
// quinzenal). As diárias do período NÃO viram lançamentos soltos: entram num
// único lançamento (a receber) por empresa + período, com vencimento =
// fim do período + prazo de pagamento da empresa.

export const CADENCIAS = [
  { val: 'diaria',    label: 'Diária (fecha todo dia)' },
  { val: 'semanal',   label: 'Semanal (a cada 7 dias)' },
  { val: 'decenal',   label: 'A cada 10 dias' },
  { val: 'quinzenal', label: 'Quinzenal (1–15 e 16–fim)' },
];

export const CADENCIA_CURTA = {
  diaria:    'Diária',
  semanal:   'Semanal',
  decenal:   '10 dias',
  quinzenal: 'Quinzenal',
};

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const ultimoDiaDoMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12

function addDias(dateIso, n) {
  const d = new Date(`${dateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const ddmm = (dateIso) => `${dateIso.slice(8, 10)}/${dateIso.slice(5, 7)}`;

export function normalizarCadencia(valor) {
  return CADENCIAS.some(c => c.val === valor) ? valor : 'quinzenal';
}

// Período de fechamento que contém a data informada.
// Devolve { inicio, fim, vencimento, cadencia, rotulo } ou null.
// O rótulo segue o modelo usado no Financeiro: "Nov 2" para a 2ª quinzena;
// para as demais cadências, o intervalo de datas (ex.: "11/11 a 20/11").
export function periodoDeFechamento(dateIso, cadencia, prazoDias = 5) {
  const [y, m, d] = String(dateIso || '').split('-').map(Number);
  if (!y || !m || !d) return null;

  const cad = normalizarCadencia(cadencia);
  const last = ultimoDiaDoMes(y, m);
  let inicio;
  let fim;
  let rotulo;

  if (cad === 'diaria') {
    inicio = fim = iso(y, m, d);
    rotulo = ddmm(inicio);
  } else if (cad === 'semanal') {
    // Semana de segunda a domingo.
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = domingo
    const desdeSegunda = (dow + 6) % 7;
    inicio = addDias(iso(y, m, d), -desdeSegunda);
    fim = addDias(inicio, 6);
    rotulo = `${ddmm(inicio)} a ${ddmm(fim)}`;
  } else if (cad === 'decenal') {
    if (d <= 10)      { inicio = iso(y, m, 1);  fim = iso(y, m, 10); }
    else if (d <= 20) { inicio = iso(y, m, 11); fim = iso(y, m, 20); }
    else              { inicio = iso(y, m, 21); fim = iso(y, m, last); }
    rotulo = `${ddmm(inicio)} a ${ddmm(fim)}`;
  } else {
    if (d <= 15) { inicio = iso(y, m, 1);  fim = iso(y, m, 15); rotulo = `${MESES_CURTOS[m - 1]} 1`; }
    else         { inicio = iso(y, m, 16); fim = iso(y, m, last); rotulo = `${MESES_CURTOS[m - 1]} 2`; }
  }

  const prazo = Number.isFinite(Number(prazoDias)) ? Number(prazoDias) : 5;
  const vencimento = addDias(fim, prazo);

  return { inicio, fim, vencimento, cadencia: cad, rotulo };
}

// Agrupa registros ({ companyId, date, valor }) por empresa + período de
// fechamento. Use `periodoDeFechamento` indiretamente via a cadência da empresa.
// Devolve uma lista de grupos: { key, companyId, empresa, inicio, fim,
// vencimento, rotulo, valor, count, dias }.
export function agruparPorFechamento(registros = [], empresasPorId = {}) {
  const map = new Map();

  for (const r of registros) {
    if (!r?.companyId || !r?.date) continue;
    const co = empresasPorId[r.companyId];
    const periodo = periodoDeFechamento(r.date, co?.closingCycle, co?.prazoPagamento);
    if (!periodo) continue;

    const key = `${r.companyId}__${periodo.inicio}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        companyId: r.companyId,
        empresa: co?.name || r.companyId,
        inicio:    periodo.inicio,
        fim:       periodo.fim,
        vencimento: periodo.vencimento,
        rotulo:    periodo.rotulo,
        valor: 0,
        count: 0,
        dias: new Set(),
      });
    }
    const g = map.get(key);
    g.valor += Number(r.valor || 0);
    g.count += 1;
    g.dias.add(r.date);
  }

  return [...map.values()];
}