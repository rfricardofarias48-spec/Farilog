// Fechamento de faturamento por empresa.
//
// São dois modos:
//   diaria → cada diária é um fechamento (vencimento = dia do serviço + prazo)
//   datas  → a empresa fecha nos dias informados (ex.: 10, 20 e 31). O período
//            termina em cada data de fechamento e as diárias do período entram
//            num único lançamento a receber, com vencimento =
//            data de fechamento + prazo de pagamento.
//
// O dia 31 vale como "último dia do mês" nos meses menores (30, 29, 28).

export const MODOS_FECHAMENTO = [
  { val: 'diaria', label: 'Diária (cada diária é um fechamento)' },
  { val: 'datas',  label: 'Datas de fechamento' },
];

const pad = (n) => String(n).padStart(2, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const ultimoDiaDoMes = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12
const ddmm = (dateIso) => `${dateIso.slice(8, 10)}/${dateIso.slice(5, 7)}`;

function addDias(dateIso, n) {
  const d = new Date(`${dateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Aceita [10,20,31] ou "10, 20, 31" e devolve dias únicos e ordenados (1..31).
export function normalizarDias(dias) {
  const bruto = Array.isArray(dias) ? dias : String(dias ?? '').split(/[^\d]+/);
  const nums = bruto.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 31);
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function normalizarModo(valor) {
  return valor === 'datas' ? 'datas' : 'diaria';
}

// Texto curto para exibir no cadastro/lista da empresa.
export function rotuloFechamento(modo, dias) {
  if (normalizarModo(modo) !== 'datas') return 'Diária';
  const d = normalizarDias(dias);
  return d.length ? `Dias ${d.join(', ')}` : 'Sem datas definidas';
}

// Período de fechamento que contém a data informada.
// Devolve { inicio, fim, vencimento, modo, rotulo } ou null.
export function periodoDeFechamento(dateIso, { modo = 'diaria', dias = [], prazo = 5 } = {}) {
  const [y, m, d] = String(dateIso || '').split('-').map(Number);
  if (!y || !m || !d) return null;

  const last = ultimoDiaDoMes(y, m);
  const listaDias = normalizarDias(dias);

  let inicio;
  let fim;
  let rotulo;

  if (normalizarModo(modo) !== 'datas' || listaDias.length === 0) {
    inicio = fim = iso(y, m, d);
    rotulo = ddmm(inicio);
  } else {
    // Só valem as datas que existem neste mês; se nenhuma sobrar (ex.: só 31 em
    // fevereiro), o fechamento cai no último dia do mês.
    const pontos = listaDias.filter(dd => dd <= last);
    if (pontos.length === 0) pontos.push(last);

    // O período termina na próxima data de fechamento (>= dia do serviço).
    let fechamento = pontos.find(dd => dd >= d);
    if (fechamento == null) fechamento = last;

    const anteriores = pontos.filter(dd => dd < fechamento);
    const fimAnterior = anteriores.length ? anteriores[anteriores.length - 1] : 0;

    inicio = iso(y, m, fimAnterior + 1);
    fim = iso(y, m, fechamento);
    rotulo = `${ddmm(inicio)} a ${ddmm(fim)}`;
  }

  const prazoNum = Number.isFinite(Number(prazo)) ? Number(prazo) : 5;
  return { inicio, fim, vencimento: addDias(fim, prazoNum), modo: normalizarModo(modo), rotulo };
}

// Agrupa registros ({ companyId, date, valor }) por empresa + período de
// fechamento. Devolve uma lista de grupos: { key, companyId, empresa, inicio,
// fim, vencimento, rotulo, valor, count, dias }.
export function agruparPorFechamento(registros = [], empresasPorId = {}) {
  const map = new Map();

  for (const r of registros) {
    if (!r?.companyId || !r?.date) continue;
    const co = empresasPorId[r.companyId];
    const periodo = periodoDeFechamento(r.date, {
      modo: co?.closingCycle,
      dias: co?.closingDays,
      prazo: co?.prazoPagamento,
    });
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