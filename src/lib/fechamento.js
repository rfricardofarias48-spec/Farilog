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
  { val: 'diaria',  label: 'Diária (cada diária é um fechamento)' },
  { val: 'datas',   label: 'Datas de fechamento' },
  { val: 'semanal', label: 'Semanal (dia da semana)' },
];

// Dias da semana no padrão ISO (1 = segunda … 7 = domingo), usados no modo
// semanal: o fechamento cai num dia da semana e o pagamento no dia escolhido.
export const DIAS_SEMANA = [
  { val: 1, label: 'Segunda-feira' },
  { val: 2, label: 'Terça-feira' },
  { val: 3, label: 'Quarta-feira' },
  { val: 4, label: 'Quinta-feira' },
  { val: 5, label: 'Sexta-feira' },
  { val: 6, label: 'Sábado' },
  { val: 7, label: 'Domingo' },
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

// Próxima data (>= dateIso) que cai no dia da semana ISO informado (1=seg..7=dom).
function diaSemanaAtualOuSeguinte(dateIso, isoDow) {
  const alvo = isoDow % 7; // Date.getUTCDay: 0=domingo … 6=sábado
  const d = new Date(`${dateIso}T12:00:00Z`);
  const delta = (alvo - d.getUTCDay() + 7) % 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Próxima data (> dateIso) no dia da semana ISO informado.
function diaSemanaSeguinte(dateIso, isoDow) {
  const alvo = isoDow % 7;
  const d = new Date(`${dateIso}T12:00:00Z`);
  let delta = (alvo - d.getUTCDay() + 7) % 7;
  if (delta === 0) delta = 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Soma dias ÚTEIS (pula sábado e domingo), começando a contar no dia seguinte.
// Ex.: sexta 20/11 + 5 dias úteis = sexta 27/11.
// Não considera feriados — só fins de semana.
export function addDiasUteis(dateIso, n) {
  const d = new Date(`${dateIso}T12:00:00Z`);
  let restantes = Math.max(0, Number(n) || 0);
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) restantes -= 1;
  }
  return d.toISOString().slice(0, 10);
}

// Aceita [10,20,31] ou "10, 20, 31" e devolve dias únicos e ordenados (1..31).
export function normalizarDias(dias) {
  const bruto = Array.isArray(dias) ? dias : String(dias ?? '').split(/[^\d]+/);
  const nums = bruto.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 31);
  return [...new Set(nums)].sort((a, b) => a - b);
}

export function normalizarModo(valor) {
  if (valor === 'datas') return 'datas';
  if (valor === 'semanal') return 'semanal';
  return 'diaria';
}

// Configuração semanal: até 2 dias ISO (1..7) — [dia do fechamento, dia do
// pagamento]. Mantém a ordem (não ordena) porque a posição tem significado.
export function normalizarSemanaDias(dias) {
  const bruto = Array.isArray(dias) ? dias : String(dias ?? '').split(/[^\d]+/);
  return [...new Set(bruto.map(Number).filter(n => Number.isInteger(n) && n >= 1 && n <= 7))].slice(0, 2);
}

// Texto curto para exibir no cadastro/lista da empresa.
export function rotuloFechamento(modo, dias) {
  const m = normalizarModo(modo);
  if (m === 'semanal') {
    const d = normalizarSemanaDias(dias);
    const nome = (DIAS_SEMANA.find(x => x.val === d[0]) || {}).label;
    return nome ? `Semanal · ${nome}` : 'Semanal (dia não definido)';
  }
  if (m !== 'datas') return 'Diária';
  const d = normalizarDias(dias);
  return d.length ? `Dias ${d.join(', ')}` : 'Sem datas definidas';
}

// Período de fechamento que contém a data informada.
// `uteis` = true conta o prazo em dias úteis (pula fins de semana).
// Devolve { inicio, fim, vencimento, modo, rotulo } ou null.
export function periodoDeFechamento(dateIso, { modo = 'diaria', dias = [], prazo = 5, uteis = false } = {}) {
  const [y, m, d] = String(dateIso || '').split('-').map(Number);
  if (!y || !m || !d) return null;

  // Modo semanal: o período é a semana que termina no dia de fechamento; o
  // vencimento cai no dia de pagamento seguinte (ou fechamento + prazo).
  if (normalizarModo(modo) === 'semanal') {
    const semana   = normalizarSemanaDias(dias);
    const closeIso = semana[0] || 5;             // padrão: sexta-feira
    const payIso   = semana[1] || null;          // dia do pagamento (opcional)
    const prazoNum = Number.isFinite(Number(prazo)) ? Number(prazo) : 5;
    const fim      = diaSemanaAtualOuSeguinte(dateIso, closeIso);
    const inicio   = addDias(fim, -6);           // 7 dias terminando no fechamento
    const vencimento = payIso ? diaSemanaSeguinte(fim, payIso) : addDias(fim, prazoNum);
    return { inicio, fim, vencimento, modo: 'semanal', rotulo: `${ddmm(inicio)} a ${ddmm(fim)}` };
  }

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
  const vencimento = uteis ? addDiasUteis(fim, prazoNum) : addDias(fim, prazoNum);
  return { inicio, fim, vencimento, modo: normalizarModo(modo), rotulo };
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
      uteis: co?.prazoDiasUteis,
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

const MESES_LONGOS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Períodos de fechamento de um mês, em ordem. Cada período fica dentro do mês.
function periodosDoMes(ano, mes, config = {}) {
  const last = ultimoDiaDoMes(ano, mes);
  const mm = pad(mes);
  const out = [];

  // Modo diária: cada dia é um período.
  if (normalizarModo(config.modo) !== 'datas' || normalizarDias(config.dias).length === 0) {
    for (let d = 1; d <= last; d++) {
      const dia = `${ano}-${mm}-${pad(d)}`;
      out.push({ inicio: dia, fim: dia, label: ddmm(dia), sday: d, eday: d, sm: mes, tYear: ano });
    }
    return out;
  }

  const pontos = normalizarDias(config.dias).filter(dd => dd <= last);
  if (pontos.length === 0) pontos.push(last);

  let inicioDia = 1;
  for (const fechamento of pontos) {
    out.push({
      inicio: `${ano}-${mm}-${pad(inicioDia)}`,
      fim:    `${ano}-${mm}-${pad(fechamento)}`,
      label:  `${pad(inicioDia)}/${mm} a ${pad(fechamento)}/${mm}`,
      sday: inicioDia, eday: fechamento, sm: mes, tYear: ano,
    });
    inicioDia = fechamento + 1;
  }
  // Sobras depois do último fechamento (ex.: fechamento nos dias 10 e 20) viram
  // um último período até o fim do mês.
  if (inicioDia <= last) {
    out.push({
      inicio: `${ano}-${mm}-${pad(inicioDia)}`,
      fim:    `${ano}-${mm}-${pad(last)}`,
      label:  `${pad(inicioDia)}/${mm} a ${pad(last)}/${mm}`,
      sday: inicioDia, eday: last, sm: mes, tYear: ano,
    });
  }
  return out;
}

// Limites do período exibido nos relatórios/histórico:
//   mensal = true  → mês inteiro (offset em meses)
//   mensal = false → períodos de fechamento da empresa (offset em períodos)
// Devolve { start, end, label, sday, eday, sm, tYear }.
export function getFechamentoBounds(config = {}, mensal = false, offset = 0) {
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [cy, cm] = hoje.split('-').map(Number);

  // Modo semanal: navega por semanas (offset em semanas), terminando no dia de
  // fechamento do cliente. O vencimento cai no dia de pagamento seguinte.
  if (!mensal && normalizarModo(config.modo) === 'semanal') {
    const semana   = normalizarSemanaDias(config.dias);
    const closeIso = semana[0] || 5;
    const payIso   = semana[1] || null;
    const prazoNum = Number.isFinite(Number(config.prazo)) ? Number(config.prazo) : 5;
    const fechamentoAtual = diaSemanaAtualOuSeguinte(hoje, closeIso);
    const fim      = addDias(fechamentoAtual, offset * 7);
    const inicio   = addDias(fim, -6);
    const vencimento = payIso ? diaSemanaSeguinte(fim, payIso) : addDias(fim, prazoNum);
    return {
      start: inicio, end: fim,
      label: `${ddmm(inicio)} a ${ddmm(fim)}`,
      vencimento,
      sday: Number(inicio.slice(8, 10)), eday: Number(fim.slice(8, 10)),
      sm: Number(fim.slice(5, 7)), tYear: Number(fim.slice(0, 4)),
    };
  }

  if (mensal) {
    let m = (cm - 1) + offset;
    let y = cy;
    while (m < 0) { m += 12; y -= 1; }
    while (m >= 12) { m -= 12; y += 1; }
    const last = ultimoDiaDoMes(y, m + 1);
    const mm = pad(m + 1);
    return {
      start: `${y}-${mm}-01`,
      end:   `${y}-${mm}-${pad(last)}`,
      label: `${MESES_LONGOS[m]} ${y}`,
      sday: 1, eday: last, sm: m + 1, tYear: y,
    };
  }

  // Navega pelos períodos de fechamento a partir do período atual.
  let ano = cy;
  let mes = cm;
  let lista = periodosDoMes(ano, mes, config);
  let idx = lista.findIndex(p => hoje >= p.inicio && hoje <= p.fim);
  if (idx < 0) idx = lista.length - 1;

  let i = idx + offset;
  while (i < 0) {
    mes -= 1;
    if (mes < 1) { mes = 12; ano -= 1; }
    lista = periodosDoMes(ano, mes, config);
    i += lista.length;
  }
  while (i >= lista.length) {
    i -= lista.length;
    mes += 1;
    if (mes > 12) { mes = 1; ano += 1; }
    lista = periodosDoMes(ano, mes, config);
  }

  const p = lista[i];
  return { start: p.inicio, end: p.fim, label: p.label, sday: p.sday, eday: p.eday, sm: p.sm, tYear: p.tYear };
}