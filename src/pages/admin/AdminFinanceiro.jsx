import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchWorkRecordsByPeriod, fetchLancamentos,
  fetchDividas, createDivida, deleteDivida,
  fetchCustosFixos, createCustoFixo, updateCustoFixo, deleteCustoFixo,
  gerarVencimentosCustoFixo, CUSTO_FIXO_HORIZONTE,
  createLancamentoManual, deleteLancamento, updateLancamentoStatus, updateLancamentoData, updateLancamento,
  fetchFluxoStatus, setFluxoStatusDerivado, setFluxoDateDerivado,
  fetchAdiantamentosPorQuinzena, createAdiantamento, deleteAdiantamento,
  fetchClassificacoes, createClassificacao,
} from '../../lib/db';
import { fmtCurrency } from '../../data/mockData';
import { overtimeToMinutes, recordRevenue } from '../../lib/timeUtils';
import { agruparPorFechamento, getFechamentoBounds } from '../../lib/fechamento';
import { payablesAutomaticos, quinzenaDaData } from '../../lib/folha';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, ReferenceDot,
  ReferenceLine,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Percent,
  ChevronLeft, ChevronRight, ChevronDown,
  Plus, Trash2, BarChart2, CreditCard, FileText, Wallet, Building2, X, Pencil, AlertTriangle,
  Maximize2, Users, Clock, CalendarDays, HandCoins, Check, RotateCcw,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────
const T  = { color: '#0B0B0B' };
const TM = { color: '#9A9A9A' };
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
// Paleta das fatias (custos fixos): cores distintas e legíveis, nunca preto/cinza.
const PIE_COLORS  = ['#BC4A2A','#3A4F6B','#96671F','#2F6F73','#7B5EA7','#8C3B4A','#2F7A4F','#B8891F','#4A6FA5','#A3567E'];
// Paleta das fatias do faturamento (Visão Geral): cores distintas, sóbrias e
// com contraste suficiente para o valor também ser legível colorido no branco.
const REVENUE_COLORS = {
  lucro:  '#BC4A2A', // terracota (marca)
  folha:  '#3A4F6B', // azul-aço
  vt:     '#96671F', // bronze
  vr:     '#557A3E', // verde-oliva
  fixos:  '#6E5A8A', // ameixa
  divida: '#2F6F73', // petróleo
};
// Cores semânticas do fluxo de caixa: entrada, saída e saldo.
const CASH_IN     = '#2F7A4F'; // verde — a receber
const CASH_OUT    = '#BC4A2A'; // terracota — a pagar
const CASH_BAL    = '#3A4F6B'; // azul-aço — saldo
const CASH_IN_BG  = '#EAF4EE';
const CASH_OUT_BG = '#FBEDE8';
// Teto visual do eixo de saídas: acima disso a coluna é cortada e anotada.
const CASH_CAP = 6000;
// Lucro líquido é sempre verde (dinheiro que sobra).
const PROFIT_COLOR = '#2F7A4F';
// Paleta usada ao criar uma nova classificação (cicla por índice).
const CLASS_PALETTE = ['#BC4A2A', '#3A4F6B', '#7B5EA7', '#96671F', '#8C3B4A', '#2F6F73', '#2F7A4F'];
const TODAY_ISO   = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

// Status dos lançamentos: 'pendente' (não confirmado) | 'pago' (a pagar) | 'recebido' (a receber).
// "Vencido" não é armazenado — é derivado de pendente + data no passado.
const AMBER    = '#B8891F';
const AMBER_BG = '#FBF3E2';
const statusOf = (l) => {
  const s = l?.status;
  return s === 'pago' || s === 'recebido' ? s : 'pendente';
};
const isVencido = (l) => statusOf(l) === 'pendente' && !!l?.data_vencimento && l.data_vencimento < TODAY_ISO;

// Grade do Fluxo de Caixa: Descrição · Classificação · Valor · Data de pagamento · Status · Ações.
const FLUXO_COLS = 'minmax(0, 2fr) minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1.05fr) minmax(180px, 1.5fr) 60px';

// ── Period helpers ─────────────────────────────────────────────────────────
function getBounds(type, offset) {
  const [y, m] = TODAY_ISO.split('-').map(Number);
  const day    = Number(TODAY_ISO.split('-')[2]);

  if (type === 'quinzenal') {
    const curQ = day <= 15 ? 0 : 1;
    const base = (y - 2000) * 24 + (m - 1) * 2 + curQ;
    const idx  = base + offset;
    const tYr  = 2000 + Math.floor(idx / 24);
    const rem  = ((idx % 24) + 24) % 24;
    const tM   = Math.floor(rem / 2);
    const tQ   = rem % 2;
    const mm   = String(tM + 1).padStart(2, '0');
    const last = new Date(tYr, tM + 1, 0).getDate();
    return {
      start: tQ === 0 ? `${tYr}-${mm}-01`  : `${tYr}-${mm}-16`,
      end:   tQ === 0 ? `${tYr}-${mm}-15`  : `${tYr}-${mm}-${String(last).padStart(2,'0')}`,
      label: `${MONTH_SHORT[tM]}/${tYr} · Q${tQ + 1}`,
    };
  }
  if (type === 'mensal') {
    let mo = m - 1 + offset, yr = y;
    while (mo < 0) { mo += 12; yr--; }
    while (mo >= 12) { mo -= 12; yr++; }
    const mm   = String(mo + 1).padStart(2, '0');
    const last = new Date(yr, mo + 1, 0).getDate();
    return { start: `${yr}-${mm}-01`, end: `${yr}-${mm}-${String(last).padStart(2,'0')}`, label: `${MONTH_FULL[mo]} ${yr}` };
  }
  if (type === 'semestral') {
    const curS = m <= 6 ? 0 : 1;
    let s = curS + offset, yr = y;
    while (s < 0) { s += 2; yr--; }
    while (s >= 2) { s -= 2; yr++; }
    const sm   = s * 6 + 1;
    const em   = sm + 5;
    const last = new Date(yr, em, 0).getDate();
    return {
      start: `${yr}-${String(sm).padStart(2,'0')}-01`,
      end:   `${yr}-${String(em).padStart(2,'0')}-${String(last).padStart(2,'0')}`,
      label: `${s === 0 ? '1° Semestre' : '2° Semestre'} ${yr}`,
    };
  }
  const yr = y + offset;
  return { start: `${yr}-01-01`, end: `${yr}-12-31`, label: String(yr) };
}

function buildChartData(type, start, end, lancamentos, pagDerivados = [], recDerivados = []) {
  const isDay = type === 'quinzenal' || type === 'mensal';
  const buckets = [];

  if (isDay) {
    const cur = new Date(start + 'T12:00:00');
    const fin = new Date(end   + 'T12:00:00');
    while (cur <= fin) {
      const iso = cur.toISOString().slice(0, 10);
      const [, mo, dd] = iso.split('-');
      buckets.push({ key: iso, label: `${Number(dd)}/${Number(mo)}` });
      cur.setDate(cur.getDate() + 1);
    }
  } else {
    const [sy, sm] = start.split('-').map(Number);
    const [ey, em] = end.split('-').map(Number);
    let yr = sy, mo = sm;
    while (yr < ey || (yr === ey && mo <= em)) {
      buckets.push({ key: `${yr}-${String(mo).padStart(2,'0')}`, label: MONTH_SHORT[mo - 1] });
      mo++;
      if (mo > 12) { mo = 1; yr++; }
    }
  }

  // PREVISÃO de caixa: entradas e saídas ESPERADAS, pela data de vencimento,
  // sem olhar o status (o pendente também entra). É o que responde "vai ter
  // caixa para pagar?" — por isso a projeção não pode ficar vazia.
  // Usa a data do item derivado (que pode ter vencimento especial escolhido na
  // tela) e, como nas saídas, também os lançamentos manuais a receber.
  const prevEntradas = [
    ...recDerivados.map(d => ({ date: d.date, valor: Number(d.valor || 0) })),
    ...lancamentos.filter(l => l.tipo === 'a_receber').map(l => ({ date: l.data_vencimento, valor: Number(l.valor || 0) })),
  ].filter(x => x.date);
  const prevSaidas = [
    ...lancamentos.filter(l => l.tipo === 'a_pagar').map(l => ({ date: l.data_vencimento, valor: Number(l.valor || 0) })),
    ...pagDerivados.map(d => ({ date: d.date, valor: Number(d.valor || 0) })),
  ].filter(x => x.date);

  let acumulado = 0;
  let prevAcum = 0;
  return buckets.map(b => {
    const match = (date) => isDay ? date === b.key : date.startsWith(b.key);
    const lancReceber = lancamentos.filter(l => l.tipo === 'a_receber' && match(l.data_vencimento));
    const lancPagar   = lancamentos.filter(l => l.tipo === 'a_pagar'   && match(l.data_vencimento));
    // Custos automáticos do período (Folha/VT/VR) — derivados dos registros.
    const pagAuto     = pagDerivados.filter(d => match(d.date));
    // Receitas de serviço do período (fechamentos) — também derivadas.
    const recAuto     = recDerivados.filter(d => match(d.date));
    // O gráfico só trabalha com FATOS: linhas confirmadas como 'pago'/'recebido'.
    // Serviço/folha não confirmados ficam de fora (entram só como pendente); o
    // app não considera no caixa o que ainda não foi recebido/pago.
    const aReceber =
      recAuto.filter(d => d.status !== 'pendente').reduce((s, d) => s + Number(d.valor || 0), 0) +
      lancReceber.filter(l => statusOf(l) === 'recebido').reduce((s, l) => s + Number(l.valor || 0), 0);
    const aPagar = lancPagar.filter(l => statusOf(l) === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0)
                 + pagAuto.filter(d => d.status === 'pago').reduce((s, d) => s + Number(d.valor || 0), 0);
    // Pendentes (fora dos fatos) — só para sinalizar no gráfico e nos totais.
    const aReceberPend = recAuto.filter(d => d.status === 'pendente').reduce((s, d) => s + Number(d.valor || 0), 0)
                       + lancReceber.filter(l => statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
    const aPagarPend   = lancPagar.filter(l => statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0)
                       + pagAuto.filter(d => d.status === 'pendente').reduce((s, d) => s + Number(d.valor || 0), 0);
    const aReceberVenc = lancReceber.filter(isVencido).reduce((s, l) => s + Number(l.valor || 0), 0)
                       + recAuto.filter(d => d.status === 'pendente' && d.date < TODAY_ISO).reduce((s, d) => s + Number(d.valor || 0), 0);
    const aPagarVenc   = lancPagar.filter(isVencido).reduce((s, l) => s + Number(l.valor || 0), 0)
                       + pagAuto.filter(d => d.status === 'pendente' && d.date < TODAY_ISO).reduce((s, d) => s + Number(d.valor || 0), 0);
    const saldo = aReceber - aPagar;
    acumulado += saldo;

    const prevIn  = prevEntradas.filter(x => match(x.date)).reduce((s, x) => s + x.valor, 0);
    const prevOut = prevSaidas.filter(x => match(x.date)).reduce((s, x) => s + x.valor, 0);
    prevAcum += prevIn - prevOut;

    // A coluna de saída é desenhada com o valor limitado ao teto para manter o
    // topo arredondado (igual às demais), sem achatar o eixo dos dias comuns.
    return {
      ...b, aReceber, aPagar, aPagarPlot: Math.min(aPagar, CASH_CAP), saldo, saldoAcum: acumulado,
      aReceberPend, aPagarPend, aReceberVenc, aPagarVenc, pendTotal: aReceberPend + aPagarPend,
      prevIn, prevOut, prevNet: prevIn - prevOut, prevAcum,
    };
  }).filter(b => b.aReceber > 0 || b.aPagar > 0 || b.pendTotal > 0 || b.prevIn > 0 || b.prevOut > 0); // datas com movimento ou previsão
}

// ── Shared components ──────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, bg, sub, dark = false, darkColor }) {
  if (dark) {
    return (
      <div className="card" style={{
        padding: '16px', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0B0B0B 0%, #1C1C1C 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 14px 34px -18px rgba(11,11,11,0.60)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#BDBDBD' }}>{label}</p>
          <div style={{
            width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(188,74,42,0.16)', border: '1px solid rgba(188,74,42,0.30)',
          }}>
            <Icon size={13} style={{ color: '#E08A70' }} />
          </div>
        </div>
        <p style={{ fontSize: '20px', fontWeight: 900, color: darkColor ?? '#FFFFFF', lineHeight: 1 }}>{value}</p>
        {sub && <p style={{ fontSize: '11px', color: '#BDBDBD', marginTop: '4px' }}>{sub}</p>}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '16px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#6B6B6B' }}>{label}</p>
        <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <p style={{ fontSize: '20px', fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '4px' }}>{sub}</p>}
    </div>
  );
}

// Marca só os dias em que a operação (saldo do dia) fica negativa.
function SaldoNegativeDot({ cx, cy, payload }) {
  if (!payload || payload.prevAcum >= 0) return null;
  return <circle cx={cx} cy={cy} r={2.8} fill={CASH_OUT} stroke="#fff" strokeWidth={0.8} />;
}

function ChartTip({ active, payload, label, mode, breakdown }) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload ?? {};

  if (mode === 'saldo') {
    const entradas  = Number(bucket.prevIn ?? 0);
    const saidas    = Number(bucket.prevOut ?? 0);
    const net       = entradas - saidas;
    const acumulado = Number(bucket.prevAcum ?? 0);
    const pos = acumulado >= 0;
    const accent = pos ? CASH_IN : CASH_OUT;
    const accentBg = pos ? 'rgba(47,122,79,0.26)' : 'rgba(188,74,42,0.30)';
    const row = (cor, nome, valor) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: cor, flexShrink: 0 }} />
        <span style={{ color: '#C9C9C9', fontSize: '11.5px', fontWeight: 500 }}>{nome}</span>
        <span style={{ color: '#F5F5F5', fontSize: '11.5px', fontWeight: 700, marginLeft: 'auto' }}>{fmtCurrency(valor)}</span>
      </div>
    );
    return (
      <div style={{ background: '#1C1C1C', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)', minWidth: '196px', boxShadow: '0 8px 24px rgba(0,0,0,0.22)' }}>
        <p style={{ color: '#A8A8A8', fontSize: '11px', fontWeight: 600, marginBottom: '7px' }}>{label}</p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', padding: '6px 8px', borderRadius: '7px', background: accentBg, borderLeft: `3px solid ${accent}` }}>
          <span style={{ color: '#F5F5F5', fontSize: '11.5px', fontWeight: 700 }}>Previsão acumulada</span>
          <span style={{ color: '#FFFFFF', fontSize: '12.5px', fontWeight: 900 }}>{fmtCurrency(acumulado)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '7px', paddingLeft: '2px' }}>
          {row(CASH_IN, 'Entradas previstas', entradas)}
          {row(CASH_OUT, 'Saídas previstas', saidas)}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginTop: '7px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          <span style={{ color: '#9C9C9C', fontSize: '10.5px', fontWeight: 600 }}>Resultado do dia</span>
          <span style={{ color: net < 0 ? '#F0A08C' : '#F5F5F5', fontSize: '11px', fontWeight: 800 }}>{fmtCurrency(net)}</span>
        </div>
      </div>
    );
  }

  const isIn = mode === 'entrada';
  const total = isIn ? bucket.aReceber : bucket.aPagar;
  const totalLabel = isIn ? 'Total a receber' : 'Total a pagar';
  const accent = isIn ? CASH_IN : CASH_OUT;
  const accentBg = isIn ? 'rgba(47,122,79,0.26)' : 'rgba(188,74,42,0.28)';
  const items = breakdown?.[bucket.key] ?? [];
  const pend = isIn ? Number(bucket.aReceberPend || 0) : Number(bucket.aPagarPend || 0);
  const venc = isIn ? Number(bucket.aReceberVenc || 0) : Number(bucket.aPagarVenc || 0);
  return (
    <div style={{ background: '#1C1C1C', borderRadius: '10px', padding: '10px 12px', border: '1px solid rgba(255,255,255,0.08)', minWidth: '178px', boxShadow: '0 8px 24px rgba(0,0,0,0.22)' }}>
      <p style={{ color: '#A8A8A8', fontSize: '11px', fontWeight: 600, marginBottom: '7px' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', padding: '6px 8px', borderRadius: '7px', background: accentBg, borderLeft: `3px solid ${accent}` }}>
        <span style={{ color: '#F5F5F5', fontSize: '11.5px', fontWeight: 700 }}>{totalLabel}</span>
        <span style={{ color: '#FFFFFF', fontSize: '12.5px', fontWeight: 900 }}>{fmtCurrency(total)}</span>
      </div>
      {items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '7px', paddingLeft: '2px' }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '2px', background: it.cor ?? '#9A9A9A', flexShrink: 0 }} />
              <span style={{ color: '#C9C9C9', fontSize: '11.5px', fontWeight: 500 }}>{it.nome}</span>
              <span style={{ color: '#F5F5F5', fontSize: '11.5px', fontWeight: 700, marginLeft: 'auto' }}>{fmtCurrency(it.valor)}</span>
            </div>
          ))}
        </div>
      )}
      {pend > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginTop: '7px', padding: '5px 8px', borderRadius: '7px', background: 'rgba(184,137,31,0.18)', borderLeft: `3px solid ${AMBER}` }}>
          <span style={{ color: '#E8C97A', fontSize: '10.5px', fontWeight: 700 }}>Pendente{venc > 0 ? ' · vencido' : ''} (fora do total)</span>
          <span style={{ color: '#F5E3B8', fontSize: '11px', fontWeight: 800 }}>{fmtCurrency(pend)}</span>
        </div>
      )}
    </div>
  );
}

// Aviso de pendências: os números/gráficos consideram só fatos (pago/recebido).
function PendenciaNote({ custos = 0, receitas = 0, vencidos = 0, where = 'no painel' }) {
  if (!(custos > 0 || receitas > 0)) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: AMBER_BG, border: '1px solid rgba(184,137,31,0.28)', borderRadius: '10px', padding: '9px 12px' }}>
      <AlertTriangle size={13} style={{ color: AMBER, flexShrink: 0, marginTop: '1px' }} />
      <p style={{ fontSize: '11px', color: '#7A5B12', lineHeight: 1.5 }}>
        <b>{fmtCurrency(custos + receitas)}</b> em lançamentos pendentes
        {vencidos > 0 && <> (<b style={{ color: CASH_OUT }}>{fmtCurrency(vencidos)} já vencidos</b>)</>}
        {' '}não entram {where} — só o que já foi <b>pago</b> ou <b>recebido</b> é considerado.
        {custos > 0 && <> Custos pendentes: <b>{fmtCurrency(custos)}</b>.</>}
        {receitas > 0 && <> Receitas pendentes: <b>{fmtCurrency(receitas)}</b>.</>}
        {' '}Confirme no <b>Fluxo de Caixa</b>.
      </p>
    </div>
  );
}

function PeriodSelector({ type, offset, bounds, onChangeType, onChangeOffset }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const typeLabel = { quinzenal: 'Quinzenal', mensal: 'Mensal', semestral: 'Semestral', anual: 'Anual' }[type];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div ref={ref} style={{ position: 'relative' }}>
        <button onClick={() => setOpen(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 13px', borderRadius: '10px', border: '1px solid rgba(11, 11, 11,0.08)', cursor: 'pointer', background: '#fff', fontSize: '12px', fontWeight: 600, color: '#0B0B0B', boxShadow: '0 1px 3px rgba(11, 11, 11,0.06)' }}>
          {bounds.label}
          <span style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 500 }}>· {typeLabel}</span>
          <ChevronDown size={12} style={{ color: '#9A9A9A' }} />
        </button>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#fff', borderRadius: '12px', padding: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.07)', minWidth: '150px' }}>
            {[['quinzenal','Quinzenal'],['mensal','Mensal'],['semestral','Semestral'],['anual','Anual']].map(([val, lbl]) => (
              <button key={val} onClick={() => { onChangeType(val); setOpen(false); }}
                style={{ width: '100%', display: 'block', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '12px', fontWeight: 600, background: type === val ? '#FAF4F1' : 'transparent', color: type === val ? '#BC4A2A' : '#333333' }}
                onMouseEnter={e => { if (type !== val) e.currentTarget.style.background = '#F7F7F7'; }}
                onMouseLeave={e => { if (type !== val) e.currentTarget.style.background = 'transparent'; }}>
                {lbl}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => onChangeOffset(o => o - 1)}
        style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fff', border: '1px solid rgba(11, 11, 11,0.08)', cursor: 'pointer', color: '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(11, 11, 11,0.06)' }}>
        <ChevronLeft size={13} />
      </button>
      <button onClick={() => onChangeOffset(o => Math.min(o + 1, 0))}
        style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fff', border: '1px solid rgba(11, 11, 11,0.08)', cursor: 'pointer', color: '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(11, 11, 11,0.06)' }}>
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

// Custos diretos da operação, derivados dos registros de ponto do período.
// Ficam em helpers para a Visão Geral e o DRE usarem exatamente a mesma base.
// Folha = diárias + horas extras dos ajudantes.
function folhaDosRegistros(activeRecords, employees) {
  return activeRecords.reduce((s, r) => {
    const emp = employees.find(e => e.id === r.employeeId);
    return s + Number(emp?.dailyRate ?? 0) + (overtimeToMinutes(r.overtime) / 60) * Number(emp?.overtimeRate ?? 50);
  }, 0);
}

// Benefícios (VT/VR) = valor/dia cadastrado do ajudante × dias distintos
// trabalhados no período. Ex.: VT R$ 10/dia × 5 diárias = R$ 50.
function beneficiosDosRegistros(activeRecords, employees) {
  const porAjudante = {};
  activeRecords.forEach(r => {
    if (!porAjudante[r.employeeId]) porAjudante[r.employeeId] = new Set();
    porAjudante[r.employeeId].add(r.date);
  });
  let vt = 0;
  let vr = 0;
  Object.entries(porAjudante).forEach(([empId, dias]) => {
    const emp = employees.find(e => e.id === empId);
    vt += dias.size * Number(emp?.vtDiario ?? 0);
    vr += dias.size * Number(emp?.vrDiario ?? 0);
  });
  return { vt, vr, total: vt + vr };
}

// ── Tab: Visão Geral ───────────────────────────────────────────────────────
function TabVisaoGeral({ records, lancamentos, employees, companies, classificacoes, fluxoStatus = {} }) {
  const active = records.filter(r => r.status !== 'absent');
  const companiesById = Object.fromEntries((companies || []).map(c => [c.id, c]));

  // Faturamento na mesma base do Fluxo de Caixa: diárias agrupadas pelo
  // fechamento de cada empresa + lançamentos manuais a receber do período.
  // O total é Recebido + A Receber. Só entra como Recebido o que foi confirmado
  // no Fluxo de Caixa — serviço pendente fica em "A Receber".
  let fatRecebido = 0;
  let fatAReceber = 0;
  for (const g of agruparPorFechamento(
    active.map(r => ({ ...r, valor: recordRevenue(r, companiesById) })),
    companiesById
  )) {
    const recebido = (fluxoStatus[`REC:${g.key}`]?.status || 'pendente') !== 'pendente';
    if (recebido) fatRecebido += g.valor;
    else fatAReceber += g.valor;
  }
  for (const l of (lancamentos || [])) {
    if (l.tipo !== 'a_receber') continue;
    const valor = Number(l.valor || 0);
    if (statusOf(l) === 'recebido') fatRecebido += valor;
    else fatAReceber += valor;
  }
  const fat = fatRecebido + fatAReceber;

  // Custos diretos derivados dos registros de ponto (mesma base usada no DRE).
  const folha = folhaDosRegistros(active, employees);
  const { vt: beneficiosVT, vr: beneficiosVR, total: beneficios } = beneficiosDosRegistros(active, employees);

  // Custos lançados só entram quando confirmados (status 'pago') — o painel
  // trabalha com fatos, igual ao Fluxo de Caixa.
  const custoFixo    = lancamentos.filter(l => l.origem_tipo === 'custo_fixo' && statusOf(l) === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
  const endivPeriodo = lancamentos.filter(l => l.origem_tipo === 'divida'     && statusOf(l) === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);

  // Pendentes do período. Receitas já entram no faturamento (Recebido + A
  // Receber), então só os custos pendentes ficam fora dos totais.
  const pendCustos   = lancamentos.filter(l => l.tipo === 'a_pagar'   && l.origem_tipo !== 'folha' && l.origem_tipo !== 'beneficio' && statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
  const pendVencidos = lancamentos.filter(l => l.tipo === 'a_pagar' && statusOf(l) === 'pendente' && isVencido(l)).reduce((s, l) => s + Number(l.valor || 0), 0);

  // Totais por classificação, a partir dos lançamentos a pagar CONFIRMADOS. Folha e
  // Benefícios entram por competência (registros de ponto), então os lançamentos
  // dessas duas origens não são somados aqui — evita duplicidade.
  const totalsPorClasse = {};
  const nomePorClasse = Object.fromEntries((classificacoes || []).map(c => [c.id, c.nome]));
  lancamentos
    .filter(l => l.tipo === 'a_pagar' && l.origem_tipo !== 'folha' && l.origem_tipo !== 'beneficio' && statusOf(l) === 'pago')
    .forEach(l => {
      // Classes Folha/Benefícios não entram aqui: esses custos vêm por competência
      // (registros de ponto) e duplicariam o valor. O banco grava os lançamentos
      // de benefícios como 'manual' (fallback), por isso filtramos pela classe.
      if (['Folha de Pagamento', 'Benefícios'].includes(nomePorClasse[l.classificacao_id])) return;
      const key = l.classificacao_id || '__sem';
      totalsPorClasse[key] = (totalsPorClasse[key] || 0) + Number(l.valor || 0);
    });

  const temClassificacoes = (classificacoes || []).length > 0;
  const classSlices = (classificacoes || [])
    .filter(c => c.tipo !== 'receita')
    .map(c => ({
      name:  c.nome,
      color: c.cor,
      value: c.nome === 'Folha de Pagamento' ? folha
           : c.nome === 'Benefícios'         ? beneficios
           : (totalsPorClasse[c.id] || 0),
    }))
    .filter(s => s.value > 0);

  // Custos totais: usa as classificações quando existem; senão, o modelo antigo.
  const totalCustos = temClassificacoes
    ? classSlices.reduce((s, x) => s + x.value, 0)
    : folha + beneficios + custoFixo + endivPeriodo;
  const lucroLiquido  = fat - totalCustos;
  // Margem de contribuição = faturamento − salários (diárias + HE) − VT − VR.
  // É a margem bruta do negócio, antes de custos fixos, dívidas e despesas variáveis.
  const margemContribValor = fat - folha - beneficios;
  const margemContrib = fat > 0 ? (margemContribValor / fat) * 100 : 0;
  const margemLucro   = fat > 0 ? (lucroLiquido / fat) * 100 : 0;

  // Fatias do gráfico: Lucro Líquido (verde) + uma fatia por classificação.
  // Somam ao faturamento. Sem classificações, cai no modelo antigo.
  const slices = temClassificacoes
    ? [
        { name: 'Lucro Líquido', value: Math.max(0, lucroLiquido), color: PROFIT_COLOR },
        ...classSlices,
      ]
    : [
        { name: 'Lucro Líquido',        value: Math.max(0, lucroLiquido), color: PROFIT_COLOR },
        { name: 'Folha de Pagamento',   value: folha,                     color: REVENUE_COLORS.folha },
        { name: 'Vale Transporte (VT)', value: beneficiosVT,              color: REVENUE_COLORS.vt },
        { name: 'Vale Refeição (VR)',   value: beneficiosVR,              color: REVENUE_COLORS.vr },
        { name: 'Custos Fixos',         value: custoFixo,                 color: REVENUE_COLORS.fixos },
        { name: 'Endividamento',        value: endivPeriodo,              color: REVENUE_COLORS.divida },
      ].filter(s => s.value > 0);

  const kpis = [
    { label: 'Faturamento', value: fmtCurrency(fat), icon: DollarSign, dark: true, darkColor: '#FFFFFF',
      sub: `${fmtCurrency(fatRecebido)} recebido · ${fmtCurrency(fatAReceber)} a receber` },
    { label: 'Margem de Contribuição', value: fmtCurrency(margemContribValor), icon: Percent,
      dark: true,
      darkColor: margemContribValor >= 0 ? '#E59A82' : '#C9C9C9',
      sub:   `${margemContrib.toFixed(1)}% do faturamento` },
    { label: 'Lucro Líquido', value: fmtCurrency(lucroLiquido), icon: TrendingUp,
      dark: true,
      darkColor: lucroLiquido >= 0 ? '#7CC79B' : '#E39AA6',
      sub:   `${margemLucro.toFixed(1)}% do faturamento` },
  ];

  return (
    <div className="space-y-5">
      {/* 3 KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      <PendenciaNote custos={pendCustos} receitas={0} vencidos={pendVencidos} where="nos totais e no gráfico" />

      {/* Gráfico + legenda */}
      <div className="card" style={{ padding: '32px' }}>
        {fat === 0 ? (
          <div style={{ padding: '64px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#C8C8C8' }}>Sem faturamento no período selecionado</p>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
            {/* Donut chart grande */}
            <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <PieChart width={340} height={340}>
                <Pie data={slices} cx="50%" cy="50%" innerRadius={95} outerRadius={155} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                  {slices.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={v => fmtCurrency(v)} itemStyle={{ color: '#F5F5F5', fontWeight: 600 }} labelStyle={{ color: '#B9B9B9' }} contentStyle={{ background: '#1C1C1C', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#F5F5F5' }} />
              </PieChart>
              <p style={{ fontSize: '12px', color: '#9A9A9A', fontWeight: 600, marginTop: '-12px' }}>
                Faturamento total
              </p>
              <p style={{ fontSize: '22px', fontWeight: 900, color: '#0B0B0B', lineHeight: 1.1, marginTop: '2px' }}>
                {fmtCurrency(fat)}
              </p>
            </div>

            {/* Legenda */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {slices.map(s => {
                const pct = fat > 0 ? (s.value / fat) * 100 : 0;
                return (
                  <div key={s.name}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#0B0B0B' }}>{s.name}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <p style={{ fontSize: '15px', fontWeight: 800, color: s.color }}>{fmtCurrency(s.value)}</p>
                        <p style={{ fontSize: '13px', color: '#9A9A9A', fontWeight: 500, minWidth: '44px', textAlign: 'right' }}>{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div style={{ height: '5px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}

              {lucroLiquido < 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: '#F5F5F5', marginTop: '4px' }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4A4A4A', flexShrink: 0 }} />
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>
                    Prejuízo de {fmtCurrency(Math.abs(lucroLiquido))} — custos superam o faturamento
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Máscara de moeda (inputs de valor) ─────────────────────────────────────
// Separa o que foi digitado em parte inteira e decimal, aceitando vírgula ou
// ponto. Um separador seguido de até 2 dígitos é tratado como decimal; senão,
// os separadores são milhar.
function separarValor(raw) {
  const s = String(raw ?? '').replace(/[^\d.,]/g, '');
  if (!s) return { inteira: '', decimal: '' };
  const i = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (i >= 0 && /^\d{0,2}$/.test(s.slice(i + 1))) {
    return { inteira: s.slice(0, i).replace(/[^\d]/g, ''), decimal: s.slice(i + 1) };
  }
  return { inteira: s.replace(/[^\d]/g, ''), decimal: '' };
}

// Formata enquanto digita (milhar com ponto, decimais com vírgula), sem forçar
// as 2 casas — isso evita o cursor "pular" durante a digitação.
function formatarValorInput(raw) {
  const { inteira, decimal } = separarValor(raw);
  const intFmt = inteira.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return /[.,]/.test(String(raw ?? '')) ? `${intFmt},${decimal}` : intFmt;
}

// Ao sair do campo, completa com ,00 para o valor ficar no formato R$ completo.
function completarValor(raw) {
  const { inteira, decimal } = separarValor(raw);
  if (!inteira && !decimal) return '';
  const intFmt = (inteira || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${intFmt},${decimal.padEnd(2, '0').slice(0, 2)}`;
}

function valorParaNumero(raw) {
  const { inteira, decimal } = separarValor(raw);
  if (!inteira && !decimal) return 0;
  const n = Number(`${inteira || '0'}.${decimal || '0'}`);
  return Number.isFinite(n) ? n : 0;
}

// ── Modal adicionar lançamento ─────────────────────────────────────────────
function AddLancamentoModal({ onSave, onClose, classificacoes = [], onCreateClassificacao }) {
  const [form,   setForm]   = useState({ tipo: 'a_pagar', descricao: '', valor: '', data: TODAY_ISO, classificacaoId: '' });
  const [saving, setSaving] = useState(false);
  const [creating,   setCreating]   = useState(false);
  const [newName,    setNewName]    = useState('');
  const [savingNew,  setSavingNew]  = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const isPagar = form.tipo === 'a_pagar';
  // Todo lançamento nasce PENDENTE: só vira pago/recebido quando o status é
  // confirmado no Fluxo de Caixa.
  const statusPreview = 'pendente';
  const classOptions = (classificacoes || []).filter(c => c.tipo === (isPagar ? 'despesa' : 'receita'));

  // Mantém sempre uma classificação válida para o tipo selecionado.
  useEffect(() => {
    if (classOptions.length === 0) {
      if (form.classificacaoId) setForm(f => ({ ...f, classificacaoId: '' }));
      return;
    }
    if (!classOptions.some(c => c.id === form.classificacaoId)) {
      setForm(f => ({ ...f, classificacaoId: classOptions[0].id }));
    }
  }, [form.tipo, classificacoes]); // eslint-disable-line react-hooks/exhaustive-deps

  const canSave = form.descricao.trim() && valorParaNumero(form.valor) > 0 && form.data && !saving
    && (classificacoes.length === 0 || form.classificacaoId);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave({
      tipo: form.tipo, descricao: form.descricao.trim(), valor: valorParaNumero(form.valor),
      dataVencimento: form.data, classificacaoId: form.classificacaoId || null,
    });
    setSaving(false);
  };

  const handleCreate = async () => {
    if (!newName.trim() || !onCreateClassificacao || savingNew) return;
    setSavingNew(true);
    const created = await onCreateClassificacao({ nome: newName.trim(), tipo: isPagar ? 'despesa' : 'receita' });
    setSavingNew(false);
    if (created) { setForm(f => ({ ...f, classificacaoId: created.id })); setNewName(''); setCreating(false); }
  };

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11, 11, 11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '460px', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 18px', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose}
            style={{ position: 'absolute', top: '18px', right: '18px', width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Novo Lançamento</p>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0B0B0B', lineHeight: 1.2 }}>
            {isPagar ? 'Conta a Pagar' : 'Conta a Receber'}
          </p>
        </div>

        {/* Corpo */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Toggle tipo */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', marginBottom: '8px' }}>Tipo</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[['a_pagar','Conta a Pagar','#4A4A4A','#F5F5F5'],['a_receber','Conta a Receber','#0B0B0B','#F5F5F5']].map(([v, l, c, bg]) => (
                <button key={v} onClick={() => setForm(f => ({...f, tipo: v}))}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: '1.5px solid',
                    borderColor: form.tipo === v ? c : 'rgba(0,0,0,0.08)',
                    cursor: 'pointer', fontSize: '12px', fontWeight: 700,
                    background: form.tipo === v ? bg : '#F7F7F7',
                    color: form.tipo === v ? c : '#9A9A9A',
                    transition: 'all 0.15s',
                  }}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Classificação */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B' }}>Classificação</p>
              {!creating && onCreateClassificacao && (
                <button onClick={() => setCreating(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', color: '#BC4A2A', fontSize: '11px', fontWeight: 700 }}>
                  <Plus size={11} /> Nova classificação
                </button>
              )}
            </div>
            {creating ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="input-field" placeholder="Nome da nova classificação" value={newName} autoFocus
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                <button onClick={handleCreate} disabled={!newName.trim() || savingNew}
                  style={{ padding: '0 14px', borderRadius: '10px', border: 'none', cursor: newName.trim() ? 'pointer' : 'not-allowed', background: newName.trim() ? '#BC4A2A' : '#E4E4E4', color: newName.trim() ? '#fff' : '#9A9A9A', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {savingNew ? '...' : 'Criar'}
                </button>
                <button onClick={() => { setCreating(false); setNewName(''); }} title="Cancelar"
                  style={{ padding: '0 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: '#6B6B6B', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <select className="input-field" value={form.classificacaoId}
                onChange={e => setForm(f => ({...f, classificacaoId: e.target.value}))}>
                {classOptions.length === 0 && <option value="">Nenhuma classificação cadastrada</option>}
                {classOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
          </div>

          {/* Descrição */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Descrição</label>
            <input className="input-field" placeholder="Ex: Aluguel, Cliente XYZ..." value={form.descricao}
              onChange={e => setForm(f => ({...f, descricao: e.target.value}))} />
          </div>

          {/* Valor + Data */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Valor (R$)</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '13px', fontWeight: 700, color: '#9A9A9A', pointerEvents: 'none' }}>R$</span>
                <input className="input-field" type="text" inputMode="decimal" placeholder="0,00"
                  style={{ paddingLeft: '40px' }}
                  value={form.valor}
                  onChange={e => setForm(f => ({ ...f, valor: formatarValorInput(e.target.value) }))}
                  onBlur={() => setForm(f => ({ ...f, valor: completarValor(f.valor) }))} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Data de vencimento</label>
              <input className="input-field" type="date" value={form.data}
                onChange={e => setForm(f => ({...f, data: e.target.value}))} />
            </div>
          </div>

          {/* Status inicial do lançamento */}
          {form.data && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F7F7F7', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', padding: '9px 12px' }}>
              <span style={{ fontSize: '11px', color: '#6B6B6B', fontWeight: 600 }}>Status inicial</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', borderRadius: '6px',
                background: AMBER_BG, color: '#7A5B12', fontSize: '11px', fontWeight: 700 }}>
                <Clock size={11} />
                {isPagar ? 'A pagar (pendente)' : 'A receber (pendente)'}
              </span>
            </div>
          )}
          <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '-6px' }}>
            Entra como <b>pendente</b> e só vira pago/recebido quando você confirmar o status no Fluxo de Caixa.
          </p>

          {/* Ações */}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '13px', fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!canSave}
              style={{
                flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
                cursor: canSave ? 'pointer' : 'not-allowed',
                background: canSave ? (isPagar ? '#4A4A4A' : '#0B0B0B') : '#E4E4E4',
                color: canSave ? 'white' : '#9A9A9A',
                fontSize: '13px', fontWeight: 700,
                boxShadow: canSave ? `0 2px 10px ${isPagar ? 'rgba(74, 74, 74,0.3)' : 'rgba(11, 11, 11,0.3)'}` : 'none',
                transition: 'all 0.15s',
              }}>
              {saving ? 'Salvando...' : `Lançar ${isPagar ? 'Conta a Pagar' : 'Conta a Receber'}`}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Modal lista completa ───────────────────────────────────────────────────
// ── Células de Status e Data (Fluxo de Caixa) ──────────────────────────────
function fmtShortDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

// DD/MM — usada no rótulo "Recebido em 10/05".
function fmtDayMonth(iso) {
  if (!iso) return '';
  const [, m, d] = String(iso).slice(0, 10).split('-');
  return `${d}/${m}`;
}

// Confirmação da liquidação: pede a data efetiva (padrão = vencimento).
function ConfirmarStatusModal({ rec, dataVencimento, onConfirm, onClose }) {
  const [data, setData] = useState(dataVencimento || TODAY_ISO);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11, 11, 11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '400px', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 22px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '16px', fontWeight: 800, color: '#0B0B0B' }}>{rec ? 'Confirmar recebimento' : 'Confirmar pagamento'}</p>
            <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '3px' }}>
              Informe a data em que o valor foi {rec ? 'recebido' : 'pago'}.
            </p>
          </div>
          <button onClick={onClose} style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: '20px 22px 22px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>
            {rec ? 'Data de recebimento' : 'Data de pagamento'}
          </label>
          <input type="date" autoFocus value={data} onChange={e => setData(e.target.value)}
            className="input-field" style={{ width: '100%', boxSizing: 'border-box' }} />
          <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '7px' }}>
            A data padrão é o vencimento ({fmtShortDate(dataVencimento)}). Clique para mudar.
          </p>

          <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '11px', borderRadius: '11px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '13px', fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={() => data && onConfirm(data)} disabled={!data}
              style={{ flex: 2, padding: '11px', borderRadius: '11px', border: 'none', cursor: data ? 'pointer' : 'not-allowed',
                background: data ? (rec ? CASH_IN : CASH_OUT) : '#E4E4E4', color: data ? 'white' : '#9A9A9A', fontSize: '13px', fontWeight: 700 }}>
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Status por linha, sempre editável: toda linha nasce pendente e só vira
// "Pago"/"Recebido" quando confirmada aqui — tanto os lançamentos gravados
// quanto as linhas derivadas (serviços e folha). A coluna nunca fica vazia.
function StatusCell({ item, rec, status, vencido, onStatus }) {
  const [confirming, setConfirming] = useState(false);
  const settled = status === 'pago' || status === 'recebido';
  const actionLabel = rec ? 'Recebido' : 'Pago';
  const quando = item.dataRecebimento ? ` em ${fmtDayMonth(item.dataRecebimento)}` : '';

  if (settled) {
    return (
      <button onClick={() => onStatus(item, 'pendente')}
        title="Clique para voltar a pendente"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: 'none',
          cursor: 'pointer', whiteSpace: 'nowrap',
          background: rec ? CASH_IN_BG : '#EFEFEF', color: rec ? CASH_IN : '#4A4A4A', fontSize: '11px', fontWeight: 700 }}>
        <Check size={11} /> {actionLabel}{quando}
      </button>
    );
  }

  // Não liquidado: rótulo de estado (Pendente / A receber / A pagar) + ação.
  const stateLabel = vencido ? 'Pendente' : (rec ? 'A receber' : 'A pagar');
  const stateColor = vencido ? CASH_OUT : '#8A6A5E';
  const stateBg    = vencido ? CASH_OUT_BG : AMBER_BG;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}>
      <span title={vencido ? 'Vencido e ainda não confirmado' : `Vencimento em ${item.date.split('-').reverse().join('/')}`}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', background: stateBg, color: stateColor, fontSize: '10.5px', fontWeight: 700, whiteSpace: 'nowrap' }}>
        {vencido ? <AlertTriangle size={9} /> : <Clock size={9} />} {stateLabel}
      </span>
      <button onClick={() => setConfirming(true)}
        title={rec ? 'Confirmar recebimento' : 'Confirmar pagamento'}
        style={{ padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: 700,
          background: '#fff', color: vencido ? CASH_OUT : '#4A4A4A',
          border: `1px solid ${vencido ? 'rgba(188,74,42,0.45)' : 'rgba(11,11,11,0.12)'}` }}>
        {actionLabel}
      </button>
      {confirming && (
        <ConfirmarStatusModal
          rec={rec}
          dataVencimento={item.date}
          onConfirm={(data) => { setConfirming(false); onStatus(item, rec ? 'recebido' : 'pago', data); }}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

// Data de vencimento editável: clique abre um input de data; salva no blur/Enter.
// Vale para lançamentos gravados (id) e para as linhas derivadas (serviço/folha),
// que guardam o vencimento especial pela chave derivada. Nas derivadas, o
// "voltar" limpa o ajuste e devolve a data calculada automaticamente.
function DateCell({ item, onChange, onOverride }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(item.date);
  useEffect(() => { setValue(item.date); }, [item.date]);

  const editable = !!item.id || !!item.derivKey;
  if (!editable) return <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B6B6B' }}>{fmtShortDate(item.date)}</span>;

  const commit = () => {
    setEditing(false);
    if (!value || value === item.date) return;
    if (item.id) onChange(item.id, value);
    else onOverride(item.derivKey, value);
  };

  if (!editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
        <button onClick={() => setEditing(true)}
          title={item.dateOverridden ? 'Vencimento ajustado — clique para mudar' : 'Mudar a data'}
          style={{ background: item.dateOverridden ? 'rgba(188,74,42,0.08)' : 'none', border: 'none', cursor: 'pointer', padding: '3px 7px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: item.dateOverridden ? '#BC4A2A' : '#6B6B6B' }}>
          {fmtShortDate(item.date)}
        </button>
        {item.dateOverridden && (
          <button onClick={() => onOverride(item.derivKey, null)} title="Voltar à data automática"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
            <RotateCcw size={11} />
          </button>
        )}
      </span>
    );
  }
  return (
    <input type="date" autoFocus value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setValue(item.date); setEditing(false); } }}
      style={{ width: '100%', padding: '5px 6px', borderRadius: '7px', border: '1px solid rgba(188,74,42,0.5)', fontSize: '11px', fontWeight: 600, color: '#0B0B0B', outline: 'none' }} />
  );
}

// Modal de edição de um lançamento do Fluxo de Caixa. Salva SOMENTE este item:
// mudar a data aqui não altera os demais lançamentos da série.
function EditarLancamentoModal({ item, classificacoes = [], onSave, onClose }) {
  const rec = item.tipo === 'a_receber';
  const classOptions = (classificacoes || []).filter(c => c.tipo === (rec ? 'receita' : 'despesa'));
  const [form, setForm] = useState({
    descricao:       item.descricao || '',
    valor:           item.valor != null ? String(item.valor) : '',
    data:            item.date || TODAY_ISO,
    classificacaoId: item.classificacaoId || '',
    status:          item.status === 'pago' || item.status === 'recebido' ? item.status : 'pendente',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const canSave = form.descricao.trim() && form.valor !== '' && form.data && !saving;

  const statusOpts = rec
    ? [['pendente', 'A receber'], ['recebido', 'Recebido']]
    : [['pendente', 'A pagar'], ['pago', 'Pago']];

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave(item.id, {
      descricao:        form.descricao.trim(),
      valor:            Number(form.valor),
      data_vencimento:  form.data,
      classificacao_id: form.classificacaoId || null,
      status:           form.status,
    });
    setSaving(false);
  };

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11, 11, 11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '22px 24px 18px', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '18px', right: '18px', width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Editar lançamento</p>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0B0B0B' }}>{rec ? 'Conta a Receber' : 'Conta a Pagar'}</p>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Descrição</label>
            <input className="input-field" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>

          {classOptions.length > 0 && (
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Classificação</label>
              <select className="input-field" value={form.classificacaoId} onChange={e => setForm(f => ({ ...f, classificacaoId: e.target.value }))}>
                <option value="">Sem classificação</option>
                {classOptions.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Valor (R$)</label>
              <input className="input-field" type="number" min="0" step="0.01" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Data de vencimento</label>
              <input className="input-field" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Status</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              {statusOpts.map(([key, lbl]) => {
                const active = form.status === key;
                return (
                  <button key={key} type="button" onClick={() => setForm(f => ({ ...f, status: key }))}
                    style={{ flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                      border: `1px solid ${active ? '#0B0B0B' : 'rgba(11,11,11,0.10)'}`,
                      background: active ? '#0B0B0B' : '#fff', color: active ? '#fff' : '#6B6B6B' }}>
                    {lbl}
                  </button>
                );
              })}
            </div>
          </div>

          <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '-4px' }}>
            A alteração vale só para este lançamento — os próximos da série (custo fixo/dívida) mantêm suas datas.
          </p>

          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '13px', fontWeight: 600 }}>Cancelar</button>
            <button onClick={handleSave} disabled={!canSave}
              style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed',
                background: canSave ? '#BC4A2A' : '#E4E4E4', color: canSave ? 'white' : '#9A9A9A', fontSize: '13px', fontWeight: 700,
                boxShadow: canSave ? '0 2px 10px rgba(188,74,42,0.3)' : 'none' }}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ListModal({ title, items, onDelete, onStatus, onDate, onDateOverride, onEdit, onRowClick, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const nPend = items.filter(i => (i.status || 'pendente') === 'pendente').length;

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11, 11, 11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '820px', maxHeight: '84vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#0B0B0B' }}>{title}</p>
            <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '2px' }}>
              {items.length} lançamento{items.length !== 1 ? 's' : ''}
              {nPend > 0 && <span style={{ color: AMBER, fontWeight: 700 }}> · {nPend} pendente{nPend !== 1 ? 's' : ''}</span>}
            </p>
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
        </div>
        {/* Cabeçalho tabela */}
        <div style={{ display: 'grid', gridTemplateColumns: FLUXO_COLS, padding: '9px 24px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '10px', alignItems: 'center' }}>
          <span style={{ textAlign: 'center' }}>Descrição</span>
          <span style={{ textAlign: 'center' }}>Classificação</span>
          <span style={{ textAlign: 'center' }}>Valor</span>
          <span style={{ textAlign: 'center' }}>Data de pagamento</span>
          <span style={{ textAlign: 'center' }}>Status</span>
          <span style={{ textAlign: 'center' }}>Ações</span>
        </div>
        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {items.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#C8C8C8' }}>Nenhum lançamento</p>
            </div>
          ) : items.map((item, idx) => {
            const rec = item.tipo === 'a_receber';
            const pend = (item.status || 'pendente') === 'pendente';
            return (
              <div key={idx} onClick={onRowClick ? () => onRowClick(item) : undefined} title="Ver detalhes"
                style={{ display: 'grid', gridTemplateColumns: FLUXO_COLS, padding: '12px 24px', borderBottom: idx < items.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '10px', cursor: onRowClick ? 'pointer' : 'default', boxShadow: `inset 3px 0 0 ${rec ? CASH_IN : CASH_OUT}`, background: item.vencido ? 'rgba(188,74,42,0.045)' : undefined }}>
                <span style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#0B0B0B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.descricao}>{item.descricao}</span>
                <span style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: `${item.classificacaoCor || CASH_OUT}1A`, color: item.classificacaoCor || '#6B6B6B', whiteSpace: 'nowrap' }}>
                    {item.classificacaoNome || '—'}
                  </span>
                </span>
                <span style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: pend ? '#9A9A9A' : (rec ? CASH_IN : CASH_OUT) }}>
                  {rec ? '+' : '−'}{fmtCurrency(item.valor)}
                </span>
                <span style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  <DateCell item={item} onChange={onDate} onOverride={onDateOverride} />
                </span>
                <span style={{ display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                  <StatusCell item={item} rec={rec} status={item.status || 'pendente'} vencido={!!item.vencido} onStatus={onStatus} />
                </span>
                <span style={{ display: 'flex', justifyContent: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                  {item.id && onEdit ? (
                    <button onClick={() => onEdit(item)} title="Editar lançamento" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
                      <Pencil size={13} />
                    </button>
                  ) : null}
                  {item.id && onDelete ? (
                    <button onClick={() => onDelete(item.id, item.descricao)} title="Excluir lançamento" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
                      <Trash2 size={13} />
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Detalhes de um lançamento (abre ao clicar na linha) ────────────────────
// Para linhas de Folha/VT/VR mostra os recebedores (nome, diárias e valor) e o
// total a pagar; para os demais mostra os dados do lançamento.
function FluxoDetalheModal({ item, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  if (!item) return null;
  const rec  = item.tipo === 'a_receber';
  const pend = (item.status || 'pendente') === 'pendente';
  const fmtDia = iso => {
    if (!iso) return '—';
    const [y, m, d] = String(iso).slice(0, 10).split('-');
    return (d && m && y) ? `${d}/${m}/${y}` : '—';
  };
  const bd = Array.isArray(item.breakdown) ? item.breakdown : null;
  const totalBd = bd ? bd.reduce((s, x) => s + Number(x.valor || 0), 0) : 0;

  const info = (label, value, cor) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
      <span style={{ fontSize: '12px', color: '#9A9A9A', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: '12px', color: cor || '#0B0B0B', fontWeight: 700, textAlign: 'right' }}>{value}</span>
    </div>
  );

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(11,11,11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '560px', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} title="Fechar"
            style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: `${item.classificacaoCor || '#4A4A4A'}1A`, color: item.classificacaoCor || '#6B6B6B' }}>
            {item.classificacaoNome || '—'}
          </span>
          <p style={{ fontSize: '16px', fontWeight: 800, ...T, marginTop: '10px', lineHeight: 1.25, paddingRight: '36px' }}>{item.descricao}</p>
          <p style={{ fontSize: '24px', fontWeight: 900, color: pend ? '#9A9A9A' : (rec ? CASH_IN : CASH_OUT), marginTop: '6px' }}>
            {rec ? '+' : '−'}{fmtCurrency(item.valor)}
          </p>
        </div>

        {/* Corpo */}
        <div style={{ padding: '8px 24px 20px', overflowY: 'auto' }}>
          {info('Tipo', rec ? 'A receber (entrada)' : 'A pagar (saída)')}
          {info('Data de pagamento', fmtDia(item.date))}
          {info('Status', pend ? 'Pendente' : (rec ? 'Recebido' : 'Pago'), pend ? AMBER : '#0B0B0B')}
          {item.origem ? info('Origem', item.origem) : null}
          {item.periodo ? info('Período', `${item.periodo.rotulo} · ${item.periodo.ajudantes} ajudante(s) · ${item.periodo.dias} diária(s)`) : null}

          {bd && bd.length > 0 ? (
            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                Recebedores ({bd.length})
              </p>
              <div style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 110px', padding: '8px 12px', background: '#F7F7F7', fontSize: '10px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.05em', gap: '8px' }}>
                  <span>Ajudante</span>
                  <span style={{ textAlign: 'center' }}>Diárias</span>
                  <span style={{ textAlign: 'right' }}>Valor</span>
                </div>
                {bd.map((b, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 110px', padding: '9px 12px', gap: '8px', borderTop: '1px solid rgba(0,0,0,0.05)', alignItems: 'center' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, ...T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.nome}</span>
                    <span style={{ fontSize: '12.5px', textAlign: 'center', color: '#6B6B6B', fontWeight: 600 }}>{b.dias}</span>
                    <span style={{ fontSize: '12.5px', textAlign: 'right', fontWeight: 700, color: CASH_OUT }}>{fmtCurrency(b.valor)}</span>
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 70px 110px', padding: '10px 12px', gap: '8px', borderTop: '1px solid rgba(0,0,0,0.10)', background: '#F7F7F7', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total a pagar</span>
                  <span />
                  <span style={{ fontSize: '14px', textAlign: 'right', fontWeight: 900, color: CASH_OUT }}>{fmtCurrency(totalBd)}</span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Fluxo de Caixa ────────────────────────────────────────────────────
function TabFluxoCaixa({ records, lancamentos, setLancamentos, type: periodType, bounds, companies, employees, classificacoes, onCreateClassificacao, fluxoStatus, setFluxoStatus }) {
  const [modal,    setModal]    = useState(null); // 'receber' | 'pagar' | 'all'
  const [showAdd,  setShowAdd]  = useState(false);
  const [chartMode, setChartMode] = useState('entrada'); // entrada | saida | saldo
  const [editItem, setEditItem]   = useState(null); // lançamento em edição
  const [erroPersist, setErroPersist] = useState(null); // falha ao gravar status/vencimento derivado
  const [filtroClasse, setFiltroClasse] = useState('');   // '' = todas as categorias
  const [detalheItem, setDetalheItem]   = useState(null); // lançamento aberto em detalhes

  const companiesById = useMemo(
    () => Object.fromEntries((companies || []).map(c => [c.id, c])),
    [companies]
  );

  const classById = useMemo(
    () => Object.fromEntries((classificacoes || []).map(c => [c.id, c])),
    [classificacoes]
  );
  const receitasClass = (classificacoes || []).find(c => c.nome === 'Receitas') || { nome: 'Receitas', cor: CASH_IN };
  // Classificação de um lançamento. Sem classificação (base antiga), deriva do origem_tipo.
  const classOf = (l) => {
    const c = l.classificacao_id ? classById[l.classificacao_id] : null;
    if (c) return c;
    const nome = l.origem_tipo === 'custo_fixo' ? 'Custo Fixo'
               : l.origem_tipo === 'divida'     ? 'Endividamento'
               : l.origem_tipo === 'beneficio'  ? 'Benefícios'
               : l.origem_tipo === 'folha'      ? 'Folha de Pagamento'
               : 'Despesas Variáveis';
    return (classificacoes || []).find(x => x.nome === nome) || { nome, cor: '#4A4A4A' };
  };

  // Status confirmado das linhas derivadas (serviço/folha) vem do componente
  // pai (fluxoStatus), compartilhado com a Visão Geral. Sem registro é pendente.
  const derivSt = fluxoStatus;

  // Receitas de serviço (fechamentos) derivadas dos registros, com o status
  // confirmado na tela — a linha nasce pendente e só é confirmada manualmente.
  const recDerivados = useMemo(() => {
    const grupos = agruparPorFechamento(
      records
        .filter(r => r.status !== 'absent')
        .map(r => ({ ...r, valor: recordRevenue(r, companiesById) })),
      companiesById
    );

    return grupos.map(g => {
      const chave = `REC:${g.key}`;
      const o = derivSt[chave];
      const status = o?.status || 'pendente';
      // Vencimento especial escolhido na tela (ex.: cobrança em data própria).
      const date = o?.data_vencimento || g.vencimento;
      return {
        date, dateAuto: g.vencimento, dateOverridden: !!o?.data_vencimento,
        descricao: `${g.rotulo} - ${g.empresa}`,
        origem: 'Serviço', valor: g.valor, tipo: 'a_receber', isManual: false, derivado: true,
        derivKey: chave, status, dataRecebimento: o?.data_recebimento || null,
        vencido: status === 'pendente' && date < TODAY_ISO,
        classificacaoNome: receitasClass.nome, classificacaoCor: receitasClass.cor,
        periodo: { inicio: g.inicio, fim: g.fim, rotulo: g.rotulo, ajudantes: g.count, dias: g.dias.size },
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [records, companiesById, receitasClass, derivSt]);

  // Custos automáticos (Folha/VT/VR) derivados das diárias realizadas; a data
  // de pagamento usa o prazo de folha do cadastro de cada empresa.
  // O status também vem da confirmação na tela (pendente por padrão).
  const payablesAuto = useMemo(
    () => payablesAutomaticos(records, employees, companies, TODAY_ISO).map(d => {
      const o = derivSt[d.derivKey];
      const status = o?.status || 'pendente';
      const date = o?.data_vencimento || d.date;
      return { ...d, date, dateAuto: d.date, dateOverridden: !!o?.data_vencimento,
               status, dataRecebimento: o?.data_recebimento || null,
               vencido: status === 'pendente' && date < TODAY_ISO };
    }),
    [records, employees, companies, derivSt]
  );

  const chartData = useMemo(
    () => buildChartData(periodType, bounds.start, bounds.end, lancamentos, payablesAuto, recDerivados),
    [periodType, bounds.start, bounds.end, lancamentos, payablesAuto, recDerivados]
  );
  const hasChart = chartData.some(b => b.aReceber > 0 || b.aPagar > 0 || b.pendTotal > 0 || b.prevIn > 0 || b.prevOut > 0);
  // Dia com pagamento acima do teto do eixo (ex.: folha) — recebe etiqueta.
  const clippedDay = chartData.find(b => b.aPagar > CASH_CAP);
  const CHART_MODES = [
    { key: 'entrada', label: 'Entrada',  color: CASH_IN },
    { key: 'saida',   label: 'Saída',    color: CASH_OUT },
    { key: 'saldo',   label: 'Previsão', color: CASH_BAL },
  ];
  const activeMode = CHART_MODES.find(m => m.key === chartMode) || CHART_MODES[0];
  const isPrevisao = chartMode === 'saldo';
  // Dias com itens pendentes (fora dos fatos): marcados com um ponto âmbar.
  const pendKey  = chartMode === 'entrada' ? 'aReceberPend' : chartMode === 'saida' ? 'aPagarPend' : 'pendTotal';
  const pendDays = chartData.filter(b => b[pendKey] > 0);
  const markY    = (b) => isPrevisao ? b.prevAcum : chartMode === 'entrada' ? b.aReceber : b.aPagarPlot;
  // A Previsão acumula o que entra e o que sai PELA DATA (pendente incluído):
  // é ela que mostra se o caixa fica negativo em algum momento do período.
  const prevVals = chartData.map(b => b.prevAcum);
  const saldoDataMax = prevVals.length ? Math.max(...prevVals) : 0;
  const saldoDataMin = prevVals.length ? Math.min(...prevVals) : 0;
  const hasNegSaldo = saldoDataMin < 0;
  // Quando a previsão fica negativa e qual o pior ponto do período.
  const prevNegativa = chartData.find(b => b.prevAcum < 0) || null;
  const prevPior     = chartData.length
    ? chartData.reduce((a, b) => (b.prevAcum < a.prevAcum ? b : a), chartData[0])
    : null;
  // Saldo projetado para o fim do período (último ponto da previsão acumulada).
  const prevFinal    = prevVals.length ? prevVals[prevVals.length - 1] : 0;
  const saldoAbs = Math.max(Math.abs(saldoDataMax), Math.abs(saldoDataMin), 1);
  const saldoFloor = -saldoAbs;
  const saldoCeil = saldoAbs;
  // Posição do zero dentro do traço e da área, para o gradiente azul/vermelho.
  const clamp01 = x => Math.min(1, Math.max(0, x));
  const saldoZeroFracLine = saldoDataMax > saldoDataMin
    ? clamp01(saldoDataMax / (saldoDataMax - saldoDataMin)) : 0;
  const saldoZeroFracFill = saldoDataMax + saldoAbs > 0
    ? clamp01(saldoDataMax / (saldoDataMax + saldoAbs)) : 0;

  const isDaily = periodType === 'quinzenal' || periodType === 'mensal';

  // a_receber: diárias agrupadas pelo FECHAMENTO de cada empresa + manuais.
  // Cada empresa fecha na sua cadência (diária/semanal/10 dias/quinzenal): as
  // diárias do período viram UM único lançamento ("Nov 2 - Fitlog"), com
  // vencimento = fim do período + prazo de pagamento da empresa.
  const recGroups = useMemo(() => {
    const fromManual = lancamentos
      .filter(l => l.tipo === 'a_receber')
      .map(l => { const cl = classOf(l); return { date: l.data_vencimento, descricao: l.descricao, origem: 'Manual', valor: Number(l.valor || 0), tipo: 'a_receber', isManual: true, id: l.id, status: statusOf(l), dataRecebimento: l.data_recebimento || null, vencido: isVencido(l), classificacaoId: l.classificacao_id || '', classificacaoNome: cl.nome, classificacaoCor: cl.cor }; });
    return [...recDerivados, ...fromManual].sort((a, b) => a.date.localeCompare(b.date));
  }, [recDerivados, lancamentos, classificacoes]);

  // a_pagar: lançamentos gravados (dívida/custo fixo/benefício/manual) + os
  // custos automáticos do período (Folha/VT/VR). A folha gravada pelo antigo
  // "Fechar folha" é ignorada para não duplicar a linha automática.
  const pagItems = useMemo(() => {
    const fromStored = lancamentos
      .filter(l => l.tipo === 'a_pagar' && l.origem_tipo !== 'folha')
      .map(l => {
        const cl = classOf(l);
        return {
          date: l.data_vencimento, descricao: l.descricao,
          origem: l.origem_tipo === 'divida' ? 'Dívida' : l.origem_tipo === 'custo_fixo' ? 'Custo Fixo' : l.origem_tipo === 'beneficio' ? 'Benefício' : l.origem_tipo === 'folha' ? 'Folha' : 'Manual',
          valor: Number(l.valor || 0), tipo: 'a_pagar', isManual: l.origem_tipo === 'manual', id: l.id,
          status: statusOf(l), dataRecebimento: l.data_recebimento || null, vencido: isVencido(l), classificacaoId: l.classificacao_id || '',
          classificacaoNome: cl.nome, classificacaoCor: cl.cor,
        };
      });
    return [...fromStored, ...payablesAuto].sort((a, b) => a.date.localeCompare(b.date));
  }, [lancamentos, classificacoes, payablesAuto]);

  // Totais: realizados (fatos — confirmados como pago/recebido) x pendentes.
  // Serviço/folha só entram nos fatos depois de confirmados na coluna Status.
  const totalRec    = recGroups.reduce((s, g) => s + g.valor, 0);
  const totalPag    = pagItems.reduce((s, l) => s + l.valor, 0);
  const recPend     = recGroups.filter(i => i.status === 'pendente').reduce((s, i) => s + i.valor, 0);
  const pagPend     = pagItems.filter(i => i.status === 'pendente').reduce((s, i) => s + i.valor, 0);
  const recSettled  = totalRec - recPend;
  const pagSettled  = totalPag - pagPend;
  const pendentes   = [...recGroups.filter(i => i.status === 'pendente'), ...pagItems.filter(i => i.status === 'pendente')];
  const nVencidos   = pendentes.filter(i => i.vencido).length;
  const totalPend   = recPend + pagPend;
  const totalVenc   = pendentes.filter(i => i.vencido).reduce((s, i) => s + i.valor, 0);

  // Itens do dia para o tooltip do gráfico: Entrada detalha cada recebimento
  // (empresa/serviço ou lançamento), Saída agrupa as contas por classificação.
  const breakdownByBucket = useMemo(() => {
    const map = {};
    chartData.forEach(b => {
      const match = d => (isDaily ? d === b.key : String(d).startsWith(b.key));
      if (chartMode === 'entrada') {
        map[b.key] = recGroups
          .filter(it => match(it.date) && it.status !== 'pendente')
          .map(it => ({
            nome: it.origem === 'Serviço' ? String(it.descricao).split(' — ')[0] : (it.descricao || 'Receita'),
            cor: CASH_IN,
            valor: it.valor,
          }))
          .sort((a, b2) => b2.valor - a.valor);
        return;
      }
      if (chartMode === 'saida') {
        const groups = {};
        pagItems.forEach(it => {
          if (!match(it.date) || it.status !== 'pago') return;
          const nome = it.classificacaoNome || 'Outros';
          if (!groups[nome]) groups[nome] = { nome, cor: it.classificacaoCor, valor: 0 };
          groups[nome].valor += it.valor;
        });
        map[b.key] = Object.values(groups).sort((a, b2) => b2.valor - a.valor);
        return;
      }
      map[b.key] = [];
    });
    return map;
  }, [chartData, recGroups, pagItems, isDaily, chartMode]);

  // A lista abaixo do gráfico segue o seletor: Entrada → só receber,
  // Saída → só pagar, Saldo → os dois.
  const inlineMode = chartMode === 'entrada' ? 'receber' : chartMode === 'saida' ? 'pagar' : 'all';

  // Lista exibida inline (limitada a 8 itens)
  // Categorias presentes na lista (para o filtro de classificação).
  const todasCategorias = useMemo(() => {
    const set = new Set();
    [...recGroups, ...pagItems].forEach(i => { if (i.classificacaoNome) set.add(i.classificacaoNome); });
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [recGroups, pagItems]);

  const inlineSource = useMemo(() => {
    const items = [];
    if (inlineMode !== 'pagar')   items.push(...recGroups);
    if (inlineMode !== 'receber') items.push(...pagItems);
    return items
      .filter(i => !filtroClasse || i.classificacaoNome === filtroClasse)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [inlineMode, recGroups, pagItems, filtroClasse]);
  const inlineItems = inlineSource.slice(0, 8);

  const handleSave = async ({ tipo, descricao, valor, dataVencimento, classificacaoId }) => {
    const l = await createLancamentoManual({ tipo, descricao, valor, dataVencimento, classificacaoId });
    if (l) {
      setLancamentos(prev => [...prev, l].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)));
      setShowAdd(false);
    }
  };

  const handleDelete = async (id, descricao = '') => {
    const ok = window.confirm(`Excluir o lançamento${descricao ? ` "${descricao}"` : ''}? Esta ação não pode ser desfeita.`);
    if (!ok) return;
    await deleteLancamento(id);
    setLancamentos(prev => prev.filter(l => l.id !== id));
  };

  // Confirma/reverte o status (Pago / Recebido / Pendente). Vale para os
  // lançamentos gravados (id) e para as linhas derivadas (serviço/folha), que
  // guardam a confirmação em financeiro_fluxo_status pela chave derivada.
  const handleStatus = async (item, status, dataRecebimento = null) => {
    const settled = status === 'pago' || status === 'recebido';
    const data = settled ? (dataRecebimento || null) : null;

    if (item.id) {
      await updateLancamentoStatus(item.id, status, dataRecebimento);
      setLancamentos(prev => prev.map(l => l.id === item.id
        ? { ...l, status, data_recebimento: data || (settled ? l.data_recebimento : null) }
        : l));
      return;
    }

    if (!item.derivKey) return;
    const salvo = await setFluxoStatusDerivado(item.derivKey, status, dataRecebimento);
    if (!salvo) {
      console.error('[fluxo] não foi possível salvar o status da linha derivada', item.derivKey);
      setErroPersist('status');
    } else {
      setErroPersist(null);
    }
    setFluxoStatus(prev => ({ ...prev, [item.derivKey]: { ...prev[item.derivKey], chave: item.derivKey, status, data_recebimento: data } }));
  };

  // Vencimento especial de uma linha derivada (cobrança com data própria).
  // novaData = null volta à data calculada automaticamente.
  const handleDateOverride = async (chave, novaData) => {
    const salvo = await setFluxoDateDerivado(chave, novaData);
    if (!salvo) {
      console.error('[fluxo] não foi possível salvar o vencimento da linha derivada', chave);
      setErroPersist('vencimento');
    } else {
      setErroPersist(null);
    }
    setFluxoStatus(prev => ({
      ...prev,
      [chave]: { ...prev[chave], chave, data_vencimento: novaData || null },
    }));
  };

  // Reagenda o vencimento (mudar a data).
  const handleDate = async (id, novaData) => {
    await updateLancamentoData(id, novaData);
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, data_vencimento: novaData } : l));
  };

  // Salva a edição de um lançamento específico. NÃO propaga para os demais
  // lançamentos da série (custo fixo/dívida): só esta linha muda.
  const handleEditSave = async (id, patch) => {
    const ok = await updateLancamento(id, patch);
    if (ok) {
      setLancamentos(prev => prev
        .map(l => l.id === id ? { ...l, ...patch } : l)
        .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)));
      setEditItem(null);
    }
  };

  const modalItems = (modal === 'receber' ? recGroups : modal === 'pagar' ? pagItems : [...recGroups, ...pagItems])
    .filter(i => !filtroClasse || i.classificacaoNome === filtroClasse)
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-5">
      {/* Falha ao gravar o status/vencimento das linhas derivadas (Serviço/Folha/VT/VR).
          Em geral é a tabela financeiro_fluxo_status ausente no Supabase. */}
      {erroPersist && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#FBEDE8', border: '1px solid rgba(188,74,42,0.28)', borderRadius: '10px', padding: '9px 12px' }}>
          <AlertTriangle size={13} style={{ color: CASH_OUT, flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '11px', color: '#7A3B2A', lineHeight: 1.5, flex: 1 }}>
            Não foi possível salvar o {erroPersist === 'status' ? 'status' : 'vencimento'} das linhas automáticas (Serviço/Folha/VT/VR).
            Falta a tabela <b>financeiro_fluxo_status</b> no Supabase — rode <b>supabase/fluxo-status-derivados.sql</b> no SQL Editor (uma vez).
            Lançamentos manuais salvam normalmente.
          </p>
          <button onClick={() => setErroPersist(null)} title="Fechar"
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7A3B2A', padding: 0, lineHeight: 1 }}>
            <X size={13} />
          </button>
        </div>
      )}

      {/* Totais — valores do período com o quanto já é fato (pago/recebido) e o pendente */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <KpiCard label="A Receber no Período" value={fmtCurrency(totalRec)} icon={TrendingUp} dark darkColor="#7CC79B"
          sub={recPend > 0 ? `${fmtCurrency(recSettled)} confirmado · ${fmtCurrency(recPend)} pendente` : `${fmtCurrency(recSettled)} confirmado`} />
        <KpiCard label="A Pagar no Período" value={fmtCurrency(totalPag)} icon={TrendingDown} dark darkColor="#E59A82"
          sub={pagPend > 0 ? `${fmtCurrency(pagSettled)} pago · ${fmtCurrency(pagPend)} pendente` : `${fmtCurrency(pagSettled)} pago`} />
        <KpiCard label={hasNegSaldo ? 'Caixa negativo previsto' : 'Previsão de Caixa'} icon={hasNegSaldo ? AlertTriangle : BarChart2} dark
          value={chartData.length ? fmtCurrency(hasNegSaldo ? prevPior.prevAcum : prevFinal) : '—'}
          darkColor={!chartData.length ? '#9DB2CC' : hasNegSaldo ? '#E39AA6' : '#7CC79B'}
          sub={!chartData.length ? 'Sem movimento no período'
            : hasNegSaldo
              ? `Pior em ${prevPior?.label} · termina em ${fmtCurrency(prevFinal)}`
              : `Sem caixa negativo · mínimo ${fmtCurrency(saldoDataMin)}`} />
      </div>

      {/* Gráfico */}
      <div className="card p-5">
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 800, ...T }}>Fluxo de Caixa — {bounds.label}</p>
            <p style={{ fontSize: '11px', ...TM, marginTop: '2px' }}>
              {isPrevisao
                ? 'Previsão: entradas e saídas esperadas por data de vencimento (pendentes incluídos)'
                : 'Entradas vs. Saídas por período'}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: activeMode.color }} />
                <span style={{ fontSize: '11px', color: '#6B6B6B', fontWeight: 500 }}>
                  {isPrevisao ? 'Previsão de caixa (acumulado)' : activeMode.label}
                </span>
              </div>
              {totalPend > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: AMBER }} />
                  <span style={{ fontSize: '11px', color: '#6B6B6B', fontWeight: 500 }}>Dia com lançamento pendente</span>
                </div>
              )}
            </div>
          </div>
          {/* Seletor discreto das 4 apresentações */}
          <div style={{ display: 'flex', gap: '2px', background: '#F3F3F3', border: '1px solid #E8E8E8', borderRadius: '9px', padding: '3px' }}>
            {CHART_MODES.map(m => (
              <button key={m.key} onClick={() => setChartMode(m.key)}
                style={{
                  padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                  fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 0.15s',
                  background: chartMode === m.key ? m.color : 'transparent',
                  color: chartMode === m.key ? '#fff' : '#7A7A7A',
                }}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Entrada/Saída plotam só fatos; a Previsão inclui também os pendentes. */}
        {totalPend > 0 && !isPrevisao && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: AMBER_BG, border: '1px solid rgba(184,137,31,0.28)', borderRadius: '10px', padding: '9px 12px', marginBottom: '12px' }}>
            <AlertTriangle size={13} style={{ color: AMBER, flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '11px', color: '#7A5B12', lineHeight: 1.5 }}>
              <b>{fmtCurrency(totalPend)}</b> em lançamentos pendentes
              {totalVenc > 0 && <> (<b style={{ color: CASH_OUT }}>{fmtCurrency(totalVenc)} já vencidos</b>)</>}
              {' '}não entram no gráfico — ele considera apenas o que já foi <b>pago</b> ou <b>recebido</b>.
              {recPend > 0 && <> Entradas pendentes: <b>{fmtCurrency(recPend)}</b>.</>}
              {pagPend > 0 && <> Saídas pendentes: <b>{fmtCurrency(pagPend)}</b>.</>}
              {' '}Confirme ou reagende na coluna <b>Status</b>.
            </p>
          </div>
        )}

        {/* Aviso da Previsão: quando (e quanto) o caixa fica negativo. */}
        {isPrevisao && chartData.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px',
            background: hasNegSaldo ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${hasNegSaldo ? '#FECACA' : '#BBF7D0'}`,
          }}>
            <AlertTriangle size={14} style={{ color: hasNegSaldo ? '#B91C1C' : '#047857', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '11.5px', lineHeight: 1.5, color: hasNegSaldo ? '#B91C1C' : '#047857' }}>
              {hasNegSaldo ? (
                <>
                  <b>Previsão negativa:</b> o caixa fica negativo a partir de <b>{prevNegativa?.label}</b> e chega a
                  {' '}<b>{fmtCurrency(prevPior?.prevAcum)}</b> em <b>{prevPior?.label}</b>.
                  {' '}Antecipe recebimentos ou reagende pagamentos.
                </>
              ) : (
                <><b>Previsão positiva</b> no período: o caixa se mantém no positivo (mínimo {fmtCurrency(saldoDataMin)}).</>
              )}
              {' '}A projeção considera <b>todas</b> as entradas e saídas pela data de vencimento
              {totalPend > 0 && <> — os <b>{fmtCurrency(totalPend)}</b> pendentes já estão incluídos</>}.
            </p>
          </div>
        )}

        {!hasChart ? (
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: '13px', color: '#C8C8C8' }}>Sem dados no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={periodType === 'mensal' ? 320 : 280}>
            <ComposedChart data={chartData} margin={{ top: 30, right: chartMode === 'saldo' ? 104 : 12, bottom: 8, left: -10 }} barCategoryGap="30%">
              <defs>
                <linearGradient id="gradSerie" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeMode.color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={activeMode.color} stopOpacity={0.01} />
                </linearGradient>
                {chartMode === 'saldo' && hasNegSaldo && (
                  <>
                    <linearGradient id="gradSaldoLine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset={saldoZeroFracLine} stopColor={CASH_BAL} />
                      <stop offset={saldoZeroFracLine} stopColor={CASH_OUT} />
                    </linearGradient>
                    <linearGradient id="gradSaldoFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset={saldoZeroFracFill} stopColor={CASH_BAL} stopOpacity={0.16} />
                      <stop offset={saldoZeroFracFill} stopColor={CASH_OUT} stopOpacity={0.16} />
                    </linearGradient>
                  </>
                )}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9A9A9A', fontSize: isDaily ? 9.5 : 11 }} axisLine={false} tickLine={false} interval={0}
                height={30} />
              <YAxis domain={chartMode === 'saida' ? [0, CASH_CAP]
                  : chartMode === 'saldo' ? [saldoFloor, saldoCeil]
                  : [0, 'auto']}
                ticks={chartMode === 'saldo' ? [saldoFloor, 0, saldoCeil] : undefined}
                tick={{ fill: '#9A9A9A', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v === 0 ? 'R$0' : `${v < 0 ? '-' : ''}R$${(Math.abs(v) / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTip mode={chartMode} breakdown={breakdownByBucket} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />

              {isPrevisao ? (
                <>
                  <Area type="monotone" dataKey="prevAcum" name="Previsão de caixa" stroke="none"
                    fill={hasNegSaldo ? 'url(#gradSaldoFill)' : 'url(#gradSerie)'} tooltipType="none" />
                  <Line type="monotone" dataKey="prevAcum" name="Previsão de caixa"
                    stroke={hasNegSaldo ? 'url(#gradSaldoLine)' : CASH_BAL} strokeWidth={2.8} dot={SaldoNegativeDot} />
                  <ReferenceLine y={0} stroke={hasNegSaldo ? CASH_OUT : '#9A9A9A'} strokeOpacity={hasNegSaldo ? 0.7 : 0.45} strokeDasharray="4 4" />
                </>
              ) : (
                <>
                  <Area type="monotone" dataKey={chartMode === 'entrada' ? 'aReceber' : 'aPagarPlot'} stroke="none" fill="url(#gradSerie)" tooltipType="none" />
                  <Bar dataKey={chartMode === 'entrada' ? 'aReceber' : 'aPagarPlot'} name={activeMode.label} fill={activeMode.color} fillOpacity={0.55} radius={[3,3,0,0]} maxBarSize={22} />
                  <Line type="monotone" dataKey={chartMode === 'entrada' ? 'aReceber' : 'aPagarPlot'} name={activeMode.label} stroke={activeMode.color} strokeWidth={2.6} dot={false} tooltipType="none" />
                  {chartMode === 'saida' && clippedDay && (
                    <ReferenceDot x={clippedDay.label} y={CASH_CAP} r={0} fill="none" stroke="none"
                      label={{ value: fmtCurrency(clippedDay.aPagar), position: 'top', fill: CASH_OUT, fontSize: 10, fontWeight: 800 }} />
                  )}
                </>
              )}

              {/* Pontos âmbar: dias com lançamentos pendentes (fora dos fatos do gráfico). */}
              {pendDays.map(b => (
                <ReferenceDot key={`pend-${b.key}`} x={b.label} y={markY(b)} r={3.4}
                  fill={AMBER} stroke="#fff" strokeWidth={1} ifOverflow="extendDomain" />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Barra de ações */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Filtro por categoria/classificação */}
          <select value={filtroClasse} onChange={e => setFiltroClasse(e.target.value)}
            title="Filtrar por categoria"
            style={{ width: 'auto', minWidth: '190px', padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(11,11,11,0.08)', background: filtroClasse ? '#FAF4F1' : '#fff', color: filtroClasse ? '#8C3B4A' : '#4A4A4A', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(11,11,11,0.06)' }}>
            <option value="">Todas as categorias</option>
            {todasCategorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {filtroClasse && (
            <button onClick={() => setFiltroClasse('')} title="Limpar filtro"
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid rgba(188,74,42,0.20)', background: '#FAF4F1', color: '#8C3B4A', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
              <X size={11} /> {filtroClasse}
            </button>
          )}
          {/* Ver lista completa (segue o seletor do gráfico) */}
          <button onClick={() => setModal(inlineMode)} title="Ver lista completa"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(11, 11, 11,0.08)', background: '#fff', color: '#6B6B6B', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(11, 11, 11,0.06)' }}>
            <Maximize2 size={11} /> Ver lista completa
          </button>
          {/* Sinalização de pendências na lista */}
          {pendentes.length > 0 && (
            <span title="Itens ainda não confirmados como pagos/recebidos"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', background: AMBER_BG, border: '1px solid rgba(184,137,31,0.28)', color: '#7A5B12', fontSize: '11px', fontWeight: 700 }}>
              <AlertTriangle size={11} />
              {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
              {nVencidos > 0 && <span style={{ color: CASH_OUT }}>· {nVencidos} vencido{nVencidos !== 1 ? 's' : ''}</span>}
            </span>
          )}
        </div>

        {/* Adicionar */}
        <button onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#BC4A2A', color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(188,74,42,0.3)' }}>
          <Plus size={12} /> Adicionar
        </button>
      </div>

      {/* Lista inline (preview — máx 8 itens) */}
      <div className="card overflow-hidden">
        <div style={{ display: 'grid', gridTemplateColumns: FLUXO_COLS, padding: '10px 16px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '10px', alignItems: 'center' }}>
          <span style={{ textAlign: 'center' }}>Descrição</span>
          <span style={{ textAlign: 'center' }}>Classificação</span>
          <span style={{ textAlign: 'center' }}>Valor</span>
          <span style={{ textAlign: 'center' }}>Data de pagamento</span>
          <span style={{ textAlign: 'center' }}>Status</span>
          <span style={{ textAlign: 'center' }}>Ações</span>
        </div>
        {inlineItems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#C8C8C8' }}>
              {filtroClasse ? `Nenhum lançamento em "${filtroClasse}"` : 'Nenhum lançamento no período'}
            </p>
          </div>
        ) : (
          <>
            {inlineItems.map((item, idx) => {
              const rec  = item.tipo === 'a_receber';
              const pend = (item.status || 'pendente') === 'pendente';
              return (
                <div key={idx} onClick={() => setDetalheItem(item)} title="Ver detalhes"
                  style={{ display: 'grid', gridTemplateColumns: FLUXO_COLS, padding: '11px 16px', borderBottom: idx < inlineItems.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '10px', cursor: 'pointer', boxShadow: `inset 3px 0 0 ${rec ? CASH_IN : CASH_OUT}`, background: item.vencido ? 'rgba(188,74,42,0.045)' : undefined }}>
                  <span style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, ...T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.descricao}>{item.descricao}</span>
                  <span style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: `${item.classificacaoCor || '#4A4A4A'}1A`, color: item.classificacaoCor || '#6B6B6B', whiteSpace: 'nowrap' }}>
                      {item.classificacaoNome || '—'}
                    </span>
                  </span>
                  <span style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: pend ? '#9A9A9A' : (rec ? CASH_IN : CASH_OUT) }} title={pend ? 'Valor ainda não confirmado' : undefined}>
                    {rec ? '+' : '−'}{fmtCurrency(item.valor)}
                  </span>
                  <span style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <DateCell item={item} onChange={handleDate} onOverride={handleDateOverride} />
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'center' }} onClick={e => e.stopPropagation()}>
                    <StatusCell item={item} rec={rec} status={item.status || 'pendente'} vencido={!!item.vencido} onStatus={handleStatus} />
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
                    {item.id ? (
                      <button onClick={() => setEditItem(item)} title="Editar lançamento"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
                        <Pencil size={13} />
                      </button>
                    ) : null}
                    {item.id ? (
                      <button onClick={() => handleDelete(item.id, item.descricao)} title="Excluir lançamento"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
                        <Trash2 size={13} />
                      </button>
                    ) : null}
                  </span>
                </div>
              );
            })}
            {/* Rodapé com total de itens ocultos */}
            {inlineSource.length > 8 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => setModal(inlineMode)}
                  style={{ fontSize: '12px', fontWeight: 600, color: '#BC4A2A', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Ver lista completa →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Ver mais */}
      {modal && (
        <ListModal
          title={modal === 'receber' ? 'A Receber' : modal === 'pagar' ? 'A Pagar' : 'Todos os lançamentos'}
          items={modalItems}
          onDelete={handleDelete}
          onStatus={handleStatus}
          onDate={handleDate}
          onDateOverride={handleDateOverride}
          onEdit={setEditItem}
          onRowClick={setDetalheItem}
          onClose={() => setModal(null)}
        />
      )}

      {/* Detalhes do lançamento (clique na linha) */}
      {detalheItem && <FluxoDetalheModal item={detalheItem} onClose={() => setDetalheItem(null)} />}

      {/* Modal Editar lançamento */}
      {editItem && (
        <EditarLancamentoModal
          item={editItem}
          classificacoes={classificacoes}
          onSave={handleEditSave}
          onClose={() => setEditItem(null)}
        />
      )}

      {/* Modal Adicionar */}
      {showAdd && (
        <AddLancamentoModal
          onSave={handleSave}
          onClose={() => setShowAdd(false)}
          classificacoes={classificacoes}
          onCreateClassificacao={onCreateClassificacao}
        />
      )}
    </div>
  );
}

// ── Endividamento: cálculo das parcelas ────────────────────────────────────

// Soma meses a uma data ISO mantendo o dia (ajusta para o último dia do mês).
function addMonthsIso(iso, months) {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  let mm = m - 1 + months, yy = y;
  yy += Math.floor(mm / 12); mm = ((mm % 12) + 12) % 12;
  const last = new Date(yy, mm + 1, 0).getDate();
  const dd = String(Math.min(d, last)).padStart(2, '0');
  return `${yy}-${String(mm + 1).padStart(2, '0')}-${dd}`;
}

function fmtDateIso(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// Taxa mensal implícita (juros compostos) de um financiamento:
// PV = PMT * (1 - (1+i)^-n) / i, resolvida por bisseção.
function taxaJurosMensal(pv, pmt, n) {
  if (!(pv > 0) || !(pmt > 0) || !(n > 0)) return null;
  const f = i => i === 0 ? pmt * n - pv : pmt * (1 - Math.pow(1 + i, -n)) / i - pv;
  if (f(1e-9) <= 0) return 0;      // principal maior/igual ao total → sem juros
  let lo = 1e-9, hi = 10;          // busca até 1000% a.m.
  if (f(hi) > 0) return null;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Datas e valores derivados de uma dívida (he compatível com dados antigos).
function dividaMetrics(d) {
  const n        = Math.max(0, Number(d.num_parcelas) || 0);
  const parcela  = Number(d.valor_parcela) || 0;
  const temPrinc = d.valor_principal != null && d.valor_principal !== '';
  const principal = temPrinc ? Number(d.valor_principal) || 0 : Number(d.valor_total) || 0;
  const total    = parcela * n || Number(d.valor_total) || 0;
  const juros    = Math.max(0, total - principal);
  const taxa     = taxaJurosMensal(principal, parcela, n);
  const inicio   = d.data_inicio || null;
  const ultima   = inicio && n > 0 ? addMonthsIso(inicio, n - 1) : null;

  // Próximo vencimento a partir de hoje; se todas as parcelas passaram, a última.
  let proximo = inicio;
  let restantes = 0;
  if (inicio && n > 0) {
    for (let i = 0; i < n; i++) {
      const dt = addMonthsIso(inicio, i);
      if (dt >= TODAY_ISO) {
        restantes++;
        if (!proximo || proximo < TODAY_ISO) proximo = dt;
      }
    }
    if (restantes === 0) proximo = addMonthsIso(inicio, n - 1);
  }
  const vencido = !!proximo && proximo < TODAY_ISO;
  return { n, parcela, principal, temPrincipal: temPrinc, total, juros, taxa, inicio, ultima, proximo, restantes, vencido };
}

// ── Modal: Nova Dívida ─────────────────────────────────────────────────────
function NovaDividaModal({ onSave, onClose }) {
  const [form,   setForm]   = useState({ nome: '', valorPrincipal: '', valorParcela: '', numParcelas: '', dataInicio: TODAY_ISO });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const numAuto = (form.valorPrincipal && form.valorParcela)
    ? Math.ceil(Number(form.valorPrincipal) / Number(form.valorParcela)) : '';
  const canSave = form.nome.trim() && form.valorParcela && form.dataInicio && !saving;

  // Prévia dos cálculos enquanto digita (mesma regra da lista).
  const preview = dividaMetrics({
    nome: form.nome,
    valor_principal: form.valorPrincipal,
    valor_parcela: form.valorParcela,
    num_parcelas: Number(form.numParcelas) || numAuto || 0,
    data_inicio: form.dataInicio,
  });

  // Juros só existem quando o valor financiado (à vista) é informado.
  // O % é a fatia dos juros no total a pagar (mesma regra da coluna "Juros %").
  const pvTemJuros = preview.temPrincipal && preview.principal > 0;
  const pvJurosPct = pvTemJuros && preview.total > 0 ? (preview.juros / preview.total) * 100 : null;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const num = Number(form.numParcelas) || numAuto || 1;
    await onSave({
      nome: form.nome.trim(),
      valorPrincipal: form.valorPrincipal === '' ? null : Number(form.valorPrincipal),
      valorParcela: Number(form.valorParcela),
      numParcelas: num,
      dataInicio: form.dataInicio,
    });
    setSaving(false);
  };

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11, 11, 11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '480px', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '22px 24px 18px', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '18px', right: '18px', width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Endividamento</p>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0B0B0B' }}>Nova Dívida</p>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Nome da dívida</label>
            <input className="input-field" placeholder="Ex: Empréstimo bancário" value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Valor financiado (R$)</label>
              <input className="input-field" type="number" min="0" step="0.01" placeholder="Valor à vista" value={form.valorPrincipal} onChange={e => setForm(f => ({...f, valorPrincipal: e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Valor da parcela (R$)</label>
              <input className="input-field" type="number" min="0" step="0.01" placeholder="0,00" value={form.valorParcela} onChange={e => setForm(f => ({...f, valorParcela: e.target.value}))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>
                Qtd. parcelas {numAuto ? <span style={{ color: '#9A9A9A', fontWeight: 400 }}>— auto: {numAuto}x</span> : ''}
              </label>
              <input className="input-field" type="number" min="1" placeholder={numAuto || '24'} value={form.numParcelas} onChange={e => setForm(f => ({...f, numParcelas: e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Vencimento da 1ª parcela</label>
              <input className="input-field" type="date" value={form.dataInicio} onChange={e => setForm(f => ({...f, dataInicio: e.target.value}))} />
            </div>
          </div>

          {/* Prévia calculada das parcelas */}
          {(preview.n > 0 && preview.parcela > 0) && (
            <div style={{ background: '#FAF4F1', border: '1px solid rgba(188,74,42,0.16)', borderRadius: '14px', padding: '14px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px' }}>
                {[
                  ['Total a pagar', fmtCurrency(preview.total)],
                  ['Valor dos juros', pvTemJuros ? fmtCurrency(preview.juros) : '—'],
                  ['% de juros', pvJurosPct == null ? '—' : `${pvJurosPct.toFixed(1).replace('.', ',')}%`],
                  ['Taxa mensal', preview.taxa == null ? '—' : `${(preview.taxa * 100).toFixed(2).replace('.', ',')}% a.m.`],
                  ['Tempo para quitar', `${preview.n} ${preview.n === 1 ? 'mês' : 'meses'}`],
                  ['Última parcela', fmtDateIso(preview.ultima)],
                  ['Vencimento', `dia ${Number((preview.inicio || '').slice(8, 10)) || '—'}`],
                ].map(([rotulo, valor]) => (
                  <div key={rotulo} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8A6A5E', fontWeight: 600 }}>{rotulo}</span>
                    <span style={{ fontSize: '12px', color: '#0B0B0B', fontWeight: 800 }}>{valor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '13px', fontWeight: 600 }}>Cancelar</button>
            <button onClick={handleSave} disabled={!canSave}
              style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', background: canSave ? '#BC4A2A' : '#E4E4E4', color: canSave ? 'white' : '#9A9A9A', fontSize: '13px', fontWeight: 700, boxShadow: canSave ? '0 2px 10px rgba(188,74,42,0.3)' : 'none' }}>
              {saving ? 'Salvando...' : 'Lançar Dívida'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Endividamento ─────────────────────────────────────────────────────
// Larguras fixas por coluna: cada título fica centralizado sobre os valores e
// a grade nunca "espreme" as colunas (a lista rola na horizontal se faltar espaço).
const DIV_GRID = 'minmax(150px, 1.7fr) 92px 108px 100px 98px 74px 80px 104px 112px 64px';
const DIV_MIN  = 1100;

const DIV_HEADERS = [
  ['Dívida',          'left'],
  ['Vencimento',      'center'],
  ['Valor total',     'center'],
  ['Parcela',         'center'],
  ['Juros',           'center'],
  ['Juros %',         'center'],
  ['Taxa a.m.',       'center'],
  ['Última parcela',  'center'],
  ['Total a pagar',   'center'],
  ['Ação',            'center'],
];

function TabEndividamento({ dividas, setDividas, showModal, setShowModal }) {
  const [confirmDel, setConfirmDel] = useState(null);

  const handleSave = async (data) => {
    const d = await createDivida(data);
    if (d) { setDividas(prev => [d, ...prev]); setShowModal(false); }
  };

  const handleDelete = async (id) => {
    await deleteDivida(id);
    setDividas(prev => prev.filter(d => d.id !== id));
    setConfirmDel(null);
  };

  const rows = useMemo(() => dividas.map(d => ({ d, m: dividaMetrics(d) })), [dividas]);
  const totalPagar    = rows.reduce((s, r) => s + r.m.total, 0);
  const totalFinanc   = rows.reduce((s, r) => s + r.m.principal, 0);
  const totalJuros    = rows.reduce((s, r) => s + (r.m.temPrincipal ? r.m.juros : 0), 0);
  const custoMensal   = rows.reduce((s, r) => s + r.m.parcela, 0);
  const pctJuros      = totalFinanc > 0 ? (totalJuros / totalFinanc) * 100 : 0;

  const pct = v => `${(v * 100).toFixed(2).replace('.', ',')}%`;

  return (
    <div className="space-y-5">
      {rows.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
          <KpiCard label="Valor total (dívida)" value={fmtCurrency(totalFinanc)} icon={Wallet} dark darkColor="#9DB2CC"
            sub={`${rows.length} ${rows.length === 1 ? 'dívida' : 'dívidas'} ativas`} />
          <KpiCard label="Juros totais" value={fmtCurrency(totalJuros)} icon={Percent} dark darkColor="#E39AA6"
            sub={totalFinanc > 0 ? `${pctJuros.toFixed(1).replace('.', ',')}% sobre o financiado` : 'Sem valor financiado'} />
          <KpiCard label="Custo mensal" value={fmtCurrency(custoMensal)} icon={CalendarDays} dark darkColor="#C9C9C9"
            sub="Soma das parcelas" />
          <KpiCard label="Total a pagar" value={fmtCurrency(totalPagar)} icon={FileText} dark darkColor="#FFFFFF"
            sub="Financiado + juros" />
        </div>
      )}

      {showModal && <NovaDividaModal onSave={handleSave} onClose={() => setShowModal(false)} />}

      {dividas.length === 0 ? (
        <div className="card" style={{ padding: '56px', textAlign: 'center' }}>
          <CreditCard size={32} style={{ color: '#C8C8C8', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '13px', color: '#9A9A9A', fontWeight: 600 }}>Nenhuma dívida cadastrada</p>
          <p style={{ fontSize: '12px', color: '#C8C8C8', marginTop: '4px' }}>Lançamentos de dívidas aparecem automaticamente no Fluxo de Caixa</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: DIV_MIN }}>
              <div style={{ display: 'grid', gridTemplateColumns: DIV_GRID, padding: '10px 16px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '8px', alignItems: 'center' }}>
                {DIV_HEADERS.map(([label, align]) => (
                  <span key={label} style={{ textAlign: align }}>{label}</span>
                ))}
              </div>
              {rows.map(({ d, m }, idx) => {
                const dia = Number(String(m.inicio || '').slice(8, 10));
                const jurosPct = m.total > 0 ? (m.juros / m.total) * 100 : 0;
                return (
                  <div key={d.id} style={{ display: 'grid', gridTemplateColumns: DIV_GRID, padding: '12px 16px', borderBottom: idx < rows.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '8px' }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 700, ...T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.nome}</p>
                      <p style={{ fontSize: '10.5px', color: '#9A9A9A', marginTop: '2px' }}>{m.n} parcelas · início {fmtDateIso(m.inicio)}</p>
                    </div>
                    <div style={{ minWidth: 0, textAlign: 'center' }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#4A4A4A' }}>{dia ? `dia ${dia}` : '—'}</p>
                      <p style={{ fontSize: '10.5px', marginTop: '2px', color: m.restantes === 0 ? '#9A9A9A' : '#6B6B6B' }}>
                        {m.restantes === 0 ? 'encerrada' : `próx. ${fmtDateIso(m.proximo)}`}
                      </p>
                    </div>
                    <p style={{ textAlign: 'center', fontSize: '12.5px', fontWeight: 600, ...T, whiteSpace: 'nowrap' }}>
                      {m.temPrincipal ? fmtCurrency(m.principal) : '—'}
                    </p>
                    <p style={{ textAlign: 'center', fontSize: '12.5px', fontWeight: 700, color: '#4A4A4A', whiteSpace: 'nowrap' }}>
                      {fmtCurrency(m.parcela)}<span style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 400 }}>/mês</span>
                    </p>
                    <p style={{ textAlign: 'center', fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap', color: m.temPrincipal && m.juros > 0 ? '#BC4A2A' : '#9A9A9A' }}>
                      {m.temPrincipal ? fmtCurrency(m.juros) : '—'}
                    </p>
                    <p style={{ textAlign: 'center', fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap', color: m.temPrincipal && m.juros > 0 ? '#BC4A2A' : '#9A9A9A' }}>
                      {m.temPrincipal ? `${jurosPct.toFixed(1).replace('.', ',')}%` : '—'}
                    </p>
                    <p style={{ textAlign: 'center', fontSize: '12.5px', fontWeight: 700, whiteSpace: 'nowrap', color: m.taxa != null && m.taxa > 0 ? '#BC4A2A' : '#9A9A9A' }}>
                      {m.taxa == null ? '—' : pct(m.taxa)}
                    </p>
                    <p style={{ textAlign: 'center', fontSize: '12.5px', color: '#6B6B6B', whiteSpace: 'nowrap' }}>{fmtDateIso(m.ultima)}</p>
                    <p style={{ textAlign: 'center', fontSize: '13px', fontWeight: 800, ...T, whiteSpace: 'nowrap' }}>{fmtCurrency(m.total)}</p>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      {confirmDel === d.id ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => handleDelete(d.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#4A4A4A', color: 'white', fontSize: '10px', fontWeight: 700 }}>Sim</button>
                          <button onClick={() => setConfirmDel(null)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '10px' }}>Não</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDel(d.id)} title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal: Novo / Editar Custo Fixo ────────────────────────────────────────
function NovoCustoModal({ custo, onSave, onClose }) {
  const edit = !!custo;
  const todayDay = Number(TODAY_ISO.slice(8, 10));
  const [form,   setForm]   = useState({
    nome:          custo?.nome || '',
    valor:         custo?.valor != null ? String(custo.valor) : '',
    diaVencimento: String(custo?.dia_vencimento ?? todayDay),
    inicio:        TODAY_ISO,
    indeterminado: false,
    meses:         '12',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const mesesNum = Math.floor(Number(form.meses) || 0);
  const duracaoOk = edit || form.indeterminado || mesesNum >= 1;
  const canSave = form.nome.trim() && form.valor && duracaoOk && !saving;

  // Prévia das datas que serão lançadas no Fluxo de Caixa (mesma regra do banco).
  const vencimentos = useMemo(() => {
    if (edit) return [];
    const meses = form.indeterminado ? 0 : mesesNum;
    if (!form.indeterminado && meses < 1) return [];
    return gerarVencimentosCustoFixo({ dataInicio: form.inicio, diaVencimento: Number(form.diaVencimento), meses });
  }, [edit, form.inicio, form.diaVencimento, mesesNum, form.indeterminado]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave({
      nome: form.nome.trim(),
      valor: Number(form.valor),
      diaVencimento: Number(form.diaVencimento) || todayDay,
      ...(edit ? {} : { dataInicio: form.inicio, meses: form.indeterminado ? 0 : mesesNum }),
    });
    setSaving(false);
  };

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11, 11, 11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}>
        <div style={{ padding: '22px 24px 18px', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '18px', right: '18px', width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Custos Fixos</p>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0B0B0B' }}>{edit ? 'Editar Custo Fixo' : 'Novo Custo Fixo'}</p>
        </div>
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Nome do custo</label>
            <input className="input-field" placeholder="Ex: Aluguel, Energia elétrica, Internet..." value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Valor mensal (R$)</label>
              <input className="input-field" type="number" min="0" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setForm(f => ({...f, valor: e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Dia de pagamento</label>
              <input className="input-field" type="number" min="1" max="31" placeholder={String(todayDay)} value={form.diaVencimento} onChange={e => setForm(f => ({...f, diaVencimento: e.target.value}))} />
            </div>
          </div>

          {!edit && (
            <>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Duração</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[['det', 'Tempo determinado'], ['ind', 'Indeterminado']].map(([key, lbl]) => {
                    const active = (key === 'ind') === form.indeterminado;
                    return (
                      <button key={key} type="button" onClick={() => setForm(f => ({ ...f, indeterminado: key === 'ind' }))}
                        style={{ flex: 1, padding: '10px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                          border: `1px solid ${active ? '#0B0B0B' : 'rgba(11,11,11,0.10)'}`,
                          background: active ? '#0B0B0B' : '#fff', color: active ? '#fff' : '#6B6B6B' }}>
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Início (1º lançamento)</label>
                  <input className="input-field" type="date" value={form.inicio} onChange={e => setForm(f => ({...f, inicio: e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>
                    Qtd. de meses {form.indeterminado && <span style={{ color: '#9A9A9A', fontWeight: 400 }}>— n/a</span>}
                  </label>
                  <input className="input-field" type="number" min="1" placeholder={String(CUSTO_FIXO_HORIZONTE)}
                    disabled={form.indeterminado} value={form.indeterminado ? '' : form.meses}
                    onChange={e => setForm(f => ({...f, meses: e.target.value}))}
                    style={{ opacity: form.indeterminado ? 0.5 : 1, cursor: form.indeterminado ? 'not-allowed' : 'text' }} />
                </div>
              </div>

              {/* Prévia dos lançamentos gerados */}
              {vencimentos.length > 0 && (
                <div style={{ background: '#FAF4F1', border: '1px solid rgba(188,74,42,0.16)', borderRadius: '14px', padding: '14px 16px' }}>
                  {[
                    ['Lançamentos', `${vencimentos.length}x ${fmtCurrency(Number(form.valor) || 0)}`],
                    form.indeterminado
                      // Sem prazo definido: nada de data final.
                      ? ['Período', `A partir de ${fmtDateIso(vencimentos[0])} · sem data limite`]
                      : ['Período', `${fmtDateIso(vencimentos[0])} → ${fmtDateIso(vencimentos[vencimentos.length - 1])}`],
                    ['Total lançado', fmtCurrency((Number(form.valor) || 0) * vencimentos.length)],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', color: '#8A6A5E', fontWeight: 600 }}>{rotulo}</span>
                      <span style={{ fontSize: '12px', color: '#0B0B0B', fontWeight: 800 }}>{valor}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '-4px' }}>
            {edit
              ? 'As alterações valem para os lançamentos a partir de hoje no Fluxo de Caixa; meses já lançados não mudam.'
              : form.indeterminado
                ? `Sem prazo de término: os lançamentos seguem indefinidamente (projetamos os próximos ${CUSTO_FIXO_HORIZONTE} meses). Se o dia de pagamento for anterior ao início, a 1a cobrança cai no mês seguinte.`
                : 'Um lançamento a pagar é criado no Fluxo de Caixa por mês, no dia de pagamento informado. Se o dia for anterior ao início, a 1a cobrança cai no mês seguinte.'}
          </p>
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '13px', fontWeight: 600 }}>Cancelar</button>
            <button onClick={handleSave} disabled={!canSave}
              style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', background: canSave ? '#BC4A2A' : '#E4E4E4', color: canSave ? 'white' : '#9A9A9A', fontSize: '13px', fontWeight: 700, boxShadow: canSave ? '0 2px 10px rgba(188,74,42,0.3)' : 'none' }}>
              {saving ? 'Salvando...' : (edit ? 'Salvar Alterações' : 'Lançar Custo Fixo')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Custos Fixos ──────────────────────────────────────────────────────
const CUSTO_COLS = 'minmax(0, 1.7fr) 108px 66px 72px 76px';

function TabCustosFixos({ custosFixos, setCustosFixos }) {
  const [showModal,  setShowModal]  = useState(false);
  const [editing,    setEditing]    = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const total   = custosFixos.reduce((s, c) => s + Number(c.valor || 0), 0);
  const pieData = custosFixos.filter(c => Number(c.valor) > 0).map(c => ({ name: c.nome, value: Number(c.valor) }));

  const handleCreate = async (data) => {
    const c = await createCustoFixo(data);
    if (c) { setCustosFixos(prev => [c, ...prev]); setShowModal(false); }
  };

  const handleUpdate = async (data) => {
    const c = await updateCustoFixo(editing.id, data);
    if (c) { setCustosFixos(prev => prev.map(x => x.id === editing.id ? { ...x, ...c } : x)); setEditing(null); }
  };

  const handleDelete = async (id) => {
    await deleteCustoFixo(id);
    setCustosFixos(prev => prev.filter(c => c.id !== id));
    setConfirmDel(null);
  };

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '13px', color: '#6B6B6B', fontWeight: 700 }}>Total de custos fixos / mês</p>
          <p style={{ fontSize: '26px', fontWeight: 900, ...T, lineHeight: 1.1 }}>{fmtCurrency(total)}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#BC4A2A', color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(188,74,42,0.3)' }}>
          <Plus size={13} /> Novo Custo
        </button>
      </div>

      {showModal && <NovoCustoModal onSave={handleCreate} onClose={() => setShowModal(false)} />}
      {editing   && <NovoCustoModal custo={editing} onSave={handleUpdate} onClose={() => setEditing(null)} />}

      <div style={{ display: 'grid', gridTemplateColumns: pieData.length > 0 ? 'minmax(320px, 1fr) minmax(0, 1.18fr)' : '1fr', gap: '16px', alignItems: 'start' }}>
        {/* Gráfico pizza */}
        {pieData.length > 0 && (
          <div className="card p-5" style={{ display: 'flex', flexDirection: 'column' }}>
            <p style={{ fontSize: '15px', fontWeight: 800, ...T, marginBottom: '12px' }}>Distribuição dos custos fixos</p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <PieChart width={270} height={320}>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={72} outerRadius={126} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmtCurrency(v)} itemStyle={{ color: '#F5F5F5', fontWeight: 600 }} labelStyle={{ color: '#B9B9B9' }} contentStyle={{ background: '#1C1C1C', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#F5F5F5' }} />
              </PieChart>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
              {pieData.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <p style={{ fontSize: '12px', color: '#6B6B6B', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                  <p style={{ fontSize: '12px', fontWeight: 700, ...T, flexShrink: 0 }}>{total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista */}
        {custosFixos.length === 0 ? (
          <div className="card" style={{ padding: '56px', textAlign: 'center' }}>
            <Wallet size={32} style={{ color: '#C8C8C8', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', color: '#9A9A9A', fontWeight: 600 }}>Nenhum custo fixo cadastrado</p>
            <p style={{ fontSize: '12px', color: '#C8C8C8', marginTop: '4px' }}>Custos fixos são lançados automaticamente no Fluxo de Caixa</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 16px 10px' }}>
              <p style={{ fontSize: '15px', fontWeight: 800, ...T }}>Itens cadastrados</p>
              <p style={{ fontSize: '11px', color: '#9A9A9A', fontWeight: 600 }}>{custosFixos.length} {custosFixos.length === 1 ? 'item' : 'itens'}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: CUSTO_COLS, padding: '9px 16px', background: '#F7F7F7', borderTop: '1px solid rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '10px' }}>
              <span>Nome</span>
              <span style={{ textAlign: 'right' }}>Valor/mês</span>
              <span style={{ textAlign: 'right' }} title="Participação no total de custos fixos">% total</span>
              <span style={{ textAlign: 'center' }}>Venc.</span>
              <span style={{ textAlign: 'center' }}>Ações</span>
            </div>
            {custosFixos.map((c, idx) => {
              const pct = total > 0 ? (Number(c.valor || 0) / total) * 100 : 0;
              return (
                <div key={c.id} style={{ display: 'grid', gridTemplateColumns: CUSTO_COLS, padding: '12px 16px', borderBottom: idx < custosFixos.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: PIE_COLORS[idx % PIE_COLORS.length], flexShrink: 0 }} />
                    <p style={{ fontSize: '13px', fontWeight: 600, ...T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nome}</p>
                  </div>
                  <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#4A4A4A' }}>{fmtCurrency(c.valor)}</p>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#BC4A2A' }}>{total > 0 ? `${pct.toFixed(1).replace('.', ',')}%` : '—'}</span>
                  </div>
                  <p style={{ textAlign: 'center', fontSize: '12px', color: '#6B6B6B' }}>Dia {c.dia_vencimento}</p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                    {confirmDel === c.id ? (
                      <>
                        <button onClick={() => handleDelete(c.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#4A4A4A', color: 'white', fontSize: '10px', fontWeight: 700 }}>Sim</button>
                        <button onClick={() => setConfirmDel(null)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '10px' }}>Não</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => setEditing(c)} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => setConfirmDel(c.id)} title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab: DRE ───────────────────────────────────────────────────────────────
function TabDRE({ records, lancamentos, employees, bounds, companies, classificacoes }) {
  const active = records.filter(r => r.status !== 'absent');
  const companiesById = Object.fromEntries((companies || []).map(c => [c.id, c]));
  const nomePorClasse = Object.fromEntries((classificacoes || []).map(c => [c.id, c.nome]));

  // Receita bruta: diária da empresa (admin) + HE proporcional (diária ÷ 8 × 1,5)
  const receitaBruta   = active.reduce((s, r) => s + recordRevenue(r, companiesById), 0);
  // Custo dos serviços = custos diretos: folha (diárias + HE) e benefícios VT/VR.
  const folha          = folhaDosRegistros(active, employees);
  const beneficios     = beneficiosDosRegistros(active, employees).total;
  const custServicos   = folha + beneficios;
  const lucroBruto     = receitaBruta - custServicos;
  // Despesas lançadas entram apenas quando confirmadas (status 'pago'): o DRE,
  // como o Fluxo de Caixa, só considera fatos. Folha e benefícios entram por
  // competência (acima), então seus lançamentos são ignorados mesmo quando o
  // banco os grava como 'manual' (fallback) — evitando dupla contagem.
  const custosConfirmados = lancamentos.filter(l =>
    l.tipo === 'a_pagar'
    && l.origem_tipo !== 'folha'
    && l.origem_tipo !== 'beneficio'
    && !['Folha de Pagamento', 'Benefícios'].includes(nomePorClasse[l.classificacao_id])
    && statusOf(l) === 'pago');
  const somaPorClasse = nome => custosConfirmados
    .filter(l => nomePorClasse[l.classificacao_id] === nome)
    .reduce((s, l) => s + Number(l.valor || 0), 0);
  const custFixoPer    = somaPorClasse('Custo Fixo');
  const encargosDiv    = somaPorClasse('Endividamento');
  // Demais despesas confirmadas (ex.: "Despesas Variáveis").
  const despVariaveis  = custosConfirmados
    .filter(l => !['Custo Fixo', 'Endividamento'].includes(nomePorClasse[l.classificacao_id]))
    .reduce((s, l) => s + Number(l.valor || 0), 0);
  // Pendentes do período (não entram no resultado).
  const pendCustos     = lancamentos.filter(l => l.tipo === 'a_pagar'   && l.origem_tipo !== 'folha' && l.origem_tipo !== 'beneficio' && statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
  const pendReceitas   = lancamentos.filter(l => l.tipo === 'a_receber' && statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
  const pendVencidos   = lancamentos.filter(l => statusOf(l) === 'pendente' && isVencido(l)).reduce((s, l) => s + Number(l.valor || 0), 0);
  const totalDespesas  = custFixoPer + encargosDiv + despVariaveis;
  const resultado      = lucroBruto - totalDespesas;
  const margemBruta    = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;
  const margemOp       = receitaBruta > 0 ? (resultado  / receitaBruta) * 100 : 0;

  const Row = ({ label, value, indent = 0, bold = false, sep = false, positive, negative, muted }) => (
    <>
      {sep && <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', margin: '2px 0' }} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${bold ? '10px' : '7px'} ${16 + indent * 16}px`, background: bold && sep ? '#F7F7F7' : 'transparent' }}>
        <p style={{ fontSize: bold ? '13px' : '12px', fontWeight: bold ? 700 : 400, color: muted ? '#6B6B6B' : '#0B0B0B' }}>{label}</p>
        <p style={{ fontSize: bold ? '14px' : '12px', fontWeight: bold ? 800 : 600, color: positive ? '#0B0B0B' : negative ? '#4A4A4A' : '#0B0B0B', whiteSpace: 'nowrap' }}>
          {value < 0 ? `(${fmtCurrency(Math.abs(value))})` : fmtCurrency(value)}
        </p>
      </div>
    </>
  );

  return (
    <div className="space-y-5">
      <div>
        <p style={{ fontSize: '16px', fontWeight: 800, ...T }}>Demonstrativo de Resultado do Exercício</p>
        <p style={{ fontSize: '12px', ...TM, marginTop: '2px' }}>{bounds.label} — dados operacionais do período</p>
      </div>

      <div className="card overflow-hidden">
        {/* Header */}
        <div style={{ padding: '14px 16px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
            DRE — {bounds.label}
          </p>
        </div>

        <Row label="(+) Receita Bruta de Serviços" value={receitaBruta} bold positive={receitaBruta > 0} />
        <Row label="(−) Custo dos Serviços" value={-custServicos} indent={1} muted negative={custServicos > 0} />
        <Row label="Mão de obra (diárias + H.E.)" value={-folha} indent={2} muted />
        <Row label="Benefícios (VT/VR)" value={-beneficios} indent={2} muted />
        <Row label="= LUCRO BRUTO" value={lucroBruto} bold sep positive={lucroBruto >= 0} negative={lucroBruto < 0} />

        <Row label="DESPESAS OPERACIONAIS" value={-totalDespesas} bold sep />
        <Row label="(−) Custos Fixos" value={-custFixoPer} indent={1} muted />
        <Row label="(−) Encargos de Dívidas" value={-encargosDiv} indent={1} muted />
        <Row label="(−) Despesas Variáveis" value={-despVariaveis} indent={1} muted />

        <Row label="= RESULTADO OPERACIONAL" value={resultado} bold sep positive={resultado >= 0} negative={resultado < 0} />

        {/* Margens */}
        <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'rgba(0,0,0,0.06)' }}>
          {[
            ['Margem Bruta',       `${margemBruta.toFixed(1)}%`],
            ['Margem Operacional', `${margemOp.toFixed(1)}%`],
            ['Diárias no Período', String(active.length)],
          ].map(([lbl, val]) => (
            <div key={lbl} style={{ background: '#F7F7F7', padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{lbl}</p>
              <p style={{ fontSize: '20px', fontWeight: 800, ...T }}>{val}</p>
            </div>
          ))}
        </div>
      </div>

      <PendenciaNote custos={pendCustos} receitas={pendReceitas} vencidos={pendVencidos} where="no resultado" />
    </div>
  );
}

// ── Tab: Resultados ────────────────────────────────────────────────────────
// Mesmo desenho da Visão Geral (3 KPIs escuros + rosca do faturamento), porém o
// resultado é de UM cliente no período escolhido: Mensal (mês inteiro) ou Por
// fechamento (o ciclo de faturamento daquele cliente). A seta ao lado troca o
// período de acordo com o tipo selecionado. Custos fixos e dívidas não são
// rateados por cliente, então o resultado aqui é a margem do cliente:
// faturamento menos a mão de obra e os benefícios dos dias trabalhados para ele.
function TabResultados({ employees, companies }) {
  const companiesById   = Object.fromEntries((companies || []).map(c => [c.id, c]));
  const companiesAtivas = (companies || []).filter(c => c.isActive !== false);

  const [mode,      setMode]      = useState('mensal');   // 'mensal' | 'fechamento'
  const [offset,    setOffset]    = useState(0);
  const [companyId, setCompanyId] = useState('');
  const [openEmp,   setOpenEmp]   = useState(false);
  const empRef = useRef(null);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);

  // Cliente padrão: o primeiro ativo.
  useEffect(() => {
    if (!companyId && companiesAtivas.length) setCompanyId(companiesAtivas[0].id);
  }, [companyId, companiesAtivas]);

  // Fecha o menu de empresas ao clicar fora.
  useEffect(() => {
    const h = e => { if (empRef.current && !empRef.current.contains(e.target)) setOpenEmp(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const GERAL   = '__geral__';                 // opção que agrega todas as empresas
  const isGeral = companyId === GERAL;
  const company = isGeral ? null : (companiesById[companyId] || null);
  const cfg = { modo: company?.closingCycle, dias: company?.closingDays, prazo: company?.prazoPagamento, uteis: company?.prazoDiasUteis };
  // No modo Geral o fechamento não se aplica (cada cliente fecha num ciclo
  // próprio), então só há o corte mensal; nos demais o período segue o tipo.
  const effMode = isGeral ? 'mensal' : mode;
  const bounds = effMode === 'mensal' ? getBounds('mensal', offset) : getFechamentoBounds(cfg, false, offset);

  useEffect(() => {
    if (!companyId) { setRecords([]); return; }
    let vivo = true;
    setLoading(true);
    const alvo = companyId === GERAL ? null : companyId;   // null = todas as empresas
    fetchWorkRecordsByPeriod(alvo, null, bounds.start, bounds.end).then(recs => {
      if (!vivo) return;
      setRecords(recs || []);
      setLoading(false);
    });
    return () => { vivo = false; };
  }, [companyId, bounds.start, bounds.end]);

  const active     = records.filter(r => r.status !== 'absent');
  const receita    = active.reduce((s, r) => s + recordRevenue(r, companiesById), 0);
  const folha      = folhaDosRegistros(active, employees);
  const beneficios = beneficiosDosRegistros(active, employees).total;
  const custos     = folha + beneficios;
  const lucro      = receita - custos;
  const margem     = receita > 0 ? (lucro / receita) * 100 : 0;

  // Recebido vs. a receber pelo vencimento dos fechamentos do cliente.
  let recebido = 0;
  for (const g of agruparPorFechamento(active.map(r => ({ ...r, valor: recordRevenue(r, companiesById) })), companiesById)) {
    if (g.vencimento <= TODAY_ISO) recebido += g.valor;
  }

  const slices = [
    { name: 'Lucro Líquido',      value: Math.max(0, lucro), color: PROFIT_COLOR },
    { name: 'Folha de Pagamento', value: folha,              color: REVENUE_COLORS.folha },
    { name: 'Benefícios (VT/VR)', value: beneficios,         color: REVENUE_COLORS.fixos },
  ].filter(s => s.value > 0);

  const trocarModo = (v) => {
    if (v === 'fechamento' && isGeral) return;   // fechamento é sempre de um cliente
    setMode(v);
    setOffset(0);
  };
  const trocarEmpresa = (id) => {
    setCompanyId(id);
    setOffset(0);
    setOpenEmp(false);
    if (id === GERAL) setMode('mensal');
  };

  const kpis = [
    { label: 'Faturamento', value: fmtCurrency(receita), icon: DollarSign, dark: true, darkColor: '#FFFFFF',
      sub: `${fmtCurrency(recebido)} recebido · ${fmtCurrency(receita - recebido)} a receber` },
    { label: 'Custos Diretos', value: fmtCurrency(custos), icon: TrendingDown, dark: true,
      darkColor: custos > 0 ? '#E59A82' : '#FFFFFF',
      sub: `${fmtCurrency(folha)} de folha · ${fmtCurrency(beneficios)} de benefícios` },
    { label: 'Lucro Líquido', value: fmtCurrency(lucro), icon: TrendingUp, dark: true,
      darkColor: lucro >= 0 ? '#7CC79B' : '#E39AA6',
      sub: `${margem.toFixed(1)}% do faturamento` },
  ];

  const carregando = loading || (!companyId && companiesAtivas.length > 0);

  return (
    <div className="space-y-5">
      {/* Filtro: empresa + tipo de período; a seta troca o mês ou o fechamento */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '10px' }}>
        {/* Empresa */}
        <div ref={empRef} style={{ position: 'relative' }}>
          <button onClick={() => setOpenEmp(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 13px', borderRadius: '10px', border: '1px solid rgba(11,11,11,0.08)', cursor: 'pointer', background: '#fff', fontSize: '12px', fontWeight: 600, color: '#0B0B0B', boxShadow: '0 1px 3px rgba(11,11,11,0.06)' }}>
            <Building2 size={13} style={{ color: '#9A9A9A' }} />
            {isGeral ? 'Geral (todas as empresas)' : (company?.name || 'Selecione a empresa')}
            <ChevronDown size={12} style={{ color: '#9A9A9A' }} />
          </button>
          {openEmp && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 200, background: '#fff', borderRadius: '12px', padding: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.07)', minWidth: '210px', maxHeight: '320px', overflowY: 'auto' }}>
              <button onClick={() => trocarEmpresa(GERAL)}
                style={{ width: '100%', display: 'block', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '12px', fontWeight: 700, background: isGeral ? '#FAF4F1' : 'transparent', color: isGeral ? '#BC4A2A' : '#333333' }}
                onMouseEnter={e => { if (!isGeral) e.currentTarget.style.background = '#F7F7F7'; }}
                onMouseLeave={e => { if (!isGeral) e.currentTarget.style.background = 'transparent'; }}>
                Geral (todas as empresas)
              </button>
              <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)', margin: '5px 6px' }} />
              {companiesAtivas.length === 0 && <p style={{ fontSize: '12px', color: '#9A9A9A', padding: '8px 12px' }}>Nenhuma empresa cadastrada</p>}
              {companiesAtivas.map(c => (
                <button key={c.id} onClick={() => trocarEmpresa(c.id)}
                  style={{ width: '100%', display: 'block', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '12px', fontWeight: 600, background: c.id === companyId ? '#FAF4F1' : 'transparent', color: c.id === companyId ? '#BC4A2A' : '#333333' }}
                  onMouseEnter={e => { if (c.id !== companyId) e.currentTarget.style.background = '#F7F7F7'; }}
                  onMouseLeave={e => { if (c.id !== companyId) e.currentTarget.style.background = 'transparent'; }}>
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tipo de período */}
        <div style={{ display: 'flex', gap: '2px', background: '#F3F3F3', border: '1px solid #E8E8E8', borderRadius: '10px', padding: '3px' }}>
          {[['mensal', 'Mensal'], ['fechamento', 'Por fechamento']].map(([v, l]) => {
            const bloq = v === 'fechamento' && isGeral;
            return (
              <button key={v} onClick={() => trocarModo(v)} disabled={bloq}
                title={bloq ? 'O fechamento é por cliente — escolha uma empresa para usar' : undefined}
                style={{ padding: '5px 13px', borderRadius: '7px', border: 'none', cursor: bloq ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', fontSize: '11.5px', fontWeight: 700, transition: 'all 0.15s',
                  background: effMode === v ? '#0B0B0B' : 'transparent', color: bloq ? '#C4C4C4' : (effMode === v ? '#fff' : '#7A7A7A') }}>
                {l}
              </button>
            );
          })}
        </div>

        {/* Período + seta */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button onClick={() => setOffset(o => o - 1)} title="Período anterior"
            style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fff', border: '1px solid rgba(11,11,11,0.08)', cursor: 'pointer', color: '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(11,11,11,0.06)' }}>
            <ChevronLeft size={13} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '7px 13px', borderRadius: '10px', border: '1px solid rgba(11,11,11,0.08)', background: '#fff', fontSize: '12px', fontWeight: 600, color: '#0B0B0B', boxShadow: '0 1px 3px rgba(11,11,11,0.06)', minWidth: '150px' }}>
            {bounds.label}
            <span style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 500 }}>· {effMode === 'mensal' ? 'Mensal' : 'Fechamento'}</span>
          </div>
          <button onClick={() => setOffset(o => Math.min(o + 1, 0))} disabled={offset >= 0} title="Próximo período"
            style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fff', border: '1px solid rgba(11,11,11,0.08)', cursor: offset >= 0 ? 'not-allowed' : 'pointer', color: offset >= 0 ? '#D1D1D1' : '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(11,11,11,0.06)' }}>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {carregando ? (
        <div style={{ padding: '60px', textAlign: 'center', fontSize: '13px', color: '#9A9A9A' }}>Carregando dados...</div>
      ) : !companyId ? (
        <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#C8C8C8' }}>Nenhuma empresa cadastrada</p>
        </div>
      ) : (
        <>
          {/* 3 KPIs do cliente no período */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {kpis.map(k => <KpiCard key={k.label} {...k} />)}
          </div>

          {/* Rosca do faturamento do cliente, com o valor no centro */}
          <div className="card" style={{ padding: '32px' }}>
            {receita === 0 ? (
              <div style={{ padding: '64px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#C8C8C8' }}>Sem faturamento no período selecionado</p>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '48px' }}>
                {/* Rosca com o faturamento no centro */}
                <div style={{ position: 'relative', width: 340, height: 340, flexShrink: 0 }}>
                  <PieChart width={340} height={340}>
                    <Pie data={slices} cx="50%" cy="50%" innerRadius={95} outerRadius={155} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                      {slices.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Pie>
                    <Tooltip formatter={v => fmtCurrency(v)} itemStyle={{ color: '#F5F5F5', fontWeight: 600 }} labelStyle={{ color: '#B9B9B9' }} contentStyle={{ background: '#1C1C1C', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#F5F5F5' }} />
                  </PieChart>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', textAlign: 'center', padding: '0 70px' }}>
                    <p style={{ fontSize: '11px', color: '#9A9A9A', fontWeight: 600 }}>Faturamento total</p>
                    <p style={{ fontSize: '21px', fontWeight: 900, color: '#0B0B0B', lineHeight: 1.15, marginTop: '2px' }}>{fmtCurrency(receita)}</p>
                  </div>
                </div>

                {/* Legenda */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {slices.map(s => {
                    const pct = receita > 0 ? (s.value / receita) * 100 : 0;
                    return (
                      <div key={s.name}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
                            <p style={{ fontSize: '14px', fontWeight: 600, color: '#0B0B0B' }}>{s.name}</p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <p style={{ fontSize: '15px', fontWeight: 800, color: s.color }}>{fmtCurrency(s.value)}</p>
                            <p style={{ fontSize: '13px', color: '#9A9A9A', fontWeight: 500, minWidth: '44px', textAlign: 'right' }}>{pct.toFixed(1)}%</p>
                          </div>
                        </div>
                        <div style={{ height: '5px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    );
                  })}

                  {lucro < 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', background: '#F5F5F5', marginTop: '4px' }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4A4A4A', flexShrink: 0 }} />
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>
                        Prejuízo de {fmtCurrency(Math.abs(lucro))} — custos diretos superam o faturamento do cliente
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Modal: Lançar Adiantamento ─────────────────────────────────────────────
function LancarAdiantamentoModal({ employees, defaultIdx, maxIdx, onSave, onClose }) {
  const [form,   setForm]   = useState({ employeeId: '', valor: '', data: TODAY_ISO, idx: String(defaultIdx) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  // Opções: 4 quinzenas anteriores até a quinzena atual (máx. de navegação da folha)
  const idxOptions = useMemo(() => {
    const cur = Number(form.idx);
    const list = [];
    for (let i = Math.max(cur - 4, 0); i <= Math.max(cur, maxIdx); i++) list.push(i);
    return list;
  }, [form.idx, maxIdx]);

  const selQ  = quinzenaBounds(Number(form.idx));
  const canSave = form.employeeId && form.valor && form.data && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await onSave({
      employeeId:  form.employeeId,
      quinzenaIdx: Number(form.idx),
      valor:       Number(form.valor),
      data:        form.data,
    });
    setSaving(false);
    if (ok) onClose();
  };

  const fmtBR = iso => `${iso.split('-')[2]}/${iso.split('-')[1]}/${iso.split('-')[0]}`;

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11, 11, 11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '460px', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 18px', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose}
            style={{ position: 'absolute', top: '18px', right: '18px', width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Lançar Adiantamento</p>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0B0B0B', lineHeight: 1.2 }}>Pagamento antecipado</p>
        </div>

        {/* Corpo */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Ajudante */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Ajudante</label>
            <select className="input-field" value={form.employeeId}
              onChange={e => setForm(f => ({...f, employeeId: e.target.value}))}>
              <option value="">Selecione o ajudante...</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          {/* Valor + Data */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Valor adiantado (R$)</label>
              <input className="input-field" type="number" min="0.01" step="0.01" placeholder="0,00"
                value={form.valor} onChange={e => setForm(f => ({...f, valor: e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Data do adiantamento</label>
              <input className="input-field" type="date" value={form.data}
                onChange={e => setForm(f => ({...f, data: e.target.value}))} />
            </div>
          </div>

          {/* Quinzena em que será descontado */}
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Descontar na quinzena</label>
            <select className="input-field" value={form.idx}
              onChange={e => setForm(f => ({...f, idx: e.target.value}))}>
              {idxOptions.map(i => {
                const b = quinzenaBounds(i);
                return <option key={i} value={i}>{b.label} · {b.monthLabel} (pagamento em {fmtBR(b.payDate)})</option>;
              })}
            </select>
            <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '6px' }}>
              {selQ.label} · {selQ.monthLabel} — esse valor será descontado do total a pagar dessa quinzena.
            </p>
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '13px', fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!canSave}
              style={{
                flex: 2, padding: '12px', borderRadius: '12px', border: 'none',
                cursor: canSave ? 'pointer' : 'not-allowed',
                background: canSave ? '#4A4A4A' : '#E4E4E4',
                color: canSave ? 'white' : '#9A9A9A',
                fontSize: '13px', fontWeight: 700,
                boxShadow: canSave ? '0 2px 10px rgba(74, 74, 74,0.3)' : 'none',
              }}>
              {saving ? 'Salvando...' : 'Lançar Adiantamento'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Modal: Detalhes do Adiantamento ────────────────────────────────────────
function AdiantamentoDetalheModal({ empName, itens, onDelete, onClose }) {
  const [confirmId, setConfirmId] = useState(null);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const total = itens.reduce((s, a) => s + a.valor, 0);
  const fmtBR = iso => `${String(iso).split('-')[2]}/${String(iso).split('-')[1]}/${String(iso).split('-')[0]}`;

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11, 11, 11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '22px 24px 18px', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose}
            style={{ position: 'absolute', top: '18px', right: '18px', width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Adiantamentos</p>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0B0B0B', lineHeight: 1.2 }}>{empName}</p>
        </div>

        {/* Corpo */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {itens.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#9A9A9A', textAlign: 'center', padding: '16px 0' }}>Nenhum adiantamento lançado.</p>
          ) : (
            <>
              {itens.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 14px', borderRadius: '12px', background: '#F5F5F5', border: '1px solid #E6E6E6' }}>
                  <div>
                    <p style={{ fontSize: '15px', fontWeight: 800, color: '#4A4A4A' }}>{fmtCurrency(a.valor)}</p>
                    <p style={{ fontSize: '11px', color: '#4A4A4A', marginTop: '2px' }}>Adiantado em {fmtBR(a.data)}</p>
                  </div>
                  {confirmId === a.id ? (
                    <button onClick={() => { setConfirmId(null); onDelete(a.id); }}
                      style={{ padding: '7px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#4A4A4A', color: '#fff', fontSize: '11px', fontWeight: 700 }}>
                      Excluir?
                    </button>
                  ) : (
                    <button onClick={() => setConfirmId(a.id)} title="Excluir adiantamento"
                      style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#fff', color: '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: '12px', background: '#F7F7F7', border: '1px solid rgba(0,0,0,0.06)' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total adiantado</span>
                <span style={{ fontSize: '15px', fontWeight: 800, color: '#4A4A4A' }}>{fmtCurrency(total)}</span>
              </div>
            </>
          )}

          <button onClick={onClose}
            style={{ padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '13px', fontWeight: 600 }}>
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Folha de Pagamento ────────────────────────────────────────────────
// Quinzena 1 (dias 01–15) → pagamento no dia 22 do mesmo mês.
// Quinzena 2 (dias 16–fim) → pagamento no dia 7 do mês seguinte.
function quinzenaBounds(idx) {
  const tYr = 2000 + Math.floor(idx / 24);
  const rem = ((idx % 24) + 24) % 24;
  const tM  = Math.floor(rem / 2);
  const tQ  = rem % 2;
  const mm  = String(tM + 1).padStart(2, '0');
  const last = new Date(tYr, tM + 1, 0).getDate();
  const payYr = tQ === 0 ? tYr : (tM === 11 ? tYr + 1 : tYr);
  const payM  = tQ === 0 ? tM  : (tM + 1) % 12;
  return {
    start: tQ === 0 ? `${tYr}-${mm}-01` : `${tYr}-${mm}-16`,
    end:   tQ === 0 ? `${tYr}-${mm}-15` : `${tYr}-${mm}-${String(last).padStart(2, '0')}`,
    payDate: `${payYr}-${String(payM + 1).padStart(2, '0')}-${tQ === 0 ? '22' : '07'}`,
    label: `Quinzena ${tQ + 1} · ${tQ === 0 ? '01 a 15' : `16 a ${last}`}`,
    monthLabel: `${MONTH_FULL[tM]} ${tYr}`,
  };
}

// ── Tab: Folha de Pagamento ────────────────────────────────────────────────
// Lista por DATA DE PAGAMENTO (e não por quinzena). Cada linha é exatamente o
// lançamento de Folha que aparece no Fluxo de Caixa (empresa × período), então
// os valores batem com o caixa. Clicar na linha abre os detalhes daquele
// pagamento, ajudante por ajudante (diárias, HE e valores).
function fmtHorasMin(min) {
  const m = Math.max(0, Number(min) || 0);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

function PagamentoDetalheModal({ pagamento, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  if (!pagamento) return null;
  const itens = Array.isArray(pagamento.breakdown) ? pagamento.breakdown : [];
  const COLS = '1fr 1.4fr 64px 76px 96px 96px 100px';
  const th = { fontSize: '10px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(11,11,11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '940px', maxHeight: '86vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', position: 'relative' }}>
          <button onClick={onClose} title="Fechar"
            style={{ position: 'absolute', top: '16px', right: '16px', width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: 'rgba(58,79,107,0.12)', color: '#3A4F6B' }}>
            Folha de Pagamento
          </span>
          <p style={{ fontSize: '16px', fontWeight: 800, ...T, marginTop: '10px', paddingRight: '36px' }}>{pagamento.empresa}</p>
          <p style={{ fontSize: '12px', ...TM }}>
            {pagamento.periodoLabel} · Pagamento em {fmtShortDate(pagamento.date)}
            {pagamento.status === 'pago' ? ' · Pago' : ''}
          </p>
          <p style={{ fontSize: '24px', fontWeight: 900, color: CASH_OUT, marginTop: '6px' }}>{fmtCurrency(pagamento.valor)}</p>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 22px 20px' }}>
          {itens.length === 0 ? (
            <p style={{ padding: '32px 0', textAlign: 'center', fontSize: '13px', color: '#C8C8C8' }}>Sem detalhe por ajudante</p>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: '8px', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                <span style={th}>Empresa</span>
                <span style={th}>Ajudante</span>
                <span style={{ ...th, textAlign: 'center' }}>Diárias</span>
                <span style={{ ...th, textAlign: 'center' }}>H. extra</span>
                <span style={{ ...th, textAlign: 'right' }}>Diárias (R$)</span>
                <span style={{ ...th, textAlign: 'right' }}>H. extras (R$)</span>
                <span style={{ ...th, textAlign: 'right' }}>Total</span>
              </div>
              {itens.map((b, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: COLS, gap: '8px', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.04)', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, ...TM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={pagamento.empresa}>{pagamento.empresa}</span>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, ...T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.nome}</span>
                  <span style={{ fontSize: '12.5px', textAlign: 'center', color: '#4A4A4A', fontWeight: 600 }}>{b.dias}</span>
                  <span style={{ fontSize: '12.5px', textAlign: 'center', color: '#6B6B6B', fontWeight: 600 }}>{fmtHorasMin(b.heMin)}</span>
                  <span style={{ fontSize: '12.5px', textAlign: 'right', color: '#4A4A4A', fontWeight: 600 }}>{fmtCurrency(b.diarias)}</span>
                  <span style={{ fontSize: '12.5px', textAlign: 'right', color: '#6B6B6B', fontWeight: 600 }}>{fmtCurrency(b.he)}</span>
                  <span style={{ fontSize: '12.5px', textAlign: 'right', fontWeight: 800, color: '#0B0B0B' }}>{fmtCurrency(b.valor)}</span>
                </div>
              ))}
              <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: '8px', padding: '12px 0 0', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
                <span />
                <span style={{ fontSize: '12.5px', textAlign: 'center', fontWeight: 800, color: '#4A4A4A' }}>{pagamento.dias}</span>
                <span style={{ fontSize: '12.5px', textAlign: 'center', fontWeight: 800, color: '#4A4A4A' }}>{fmtHorasMin(pagamento.heMin)}</span>
                <span />
                <span />
                <span style={{ fontSize: '14px', textAlign: 'right', fontWeight: 900, color: CASH_OUT }}>{fmtCurrency(pagamento.valor)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function TabFolhaPagamento({ employees, companies, fluxoStatus = {}, setFluxoStatus }) {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [detalhe, setDetalhe]   = useState(null);
  const [adiantamentos, setAdiantamentos] = useState([]);
  const [showLancarModal, setShowLancarModal] = useState(false);

  // Quinzena atual (para o lançamento de adiantamento).
  const curIdx = (Number(TODAY_ISO.split('-')[0]) - 2000) * 24
    + (Number(TODAY_ISO.split('-')[1]) - 1) * 2
    + (Number(TODAY_ISO.split('-')[2]) <= 15 ? 0 : 1);
  const nextPayIdx = quinzenaBounds(curIdx - 1).payDate >= TODAY_ISO ? curIdx - 1 : curIdx;

  // Janela de registros: mês anterior até 2 meses à frente — cobre os próximos
  // pagamentos (que podem cair no mês seguinte ao período trabalhado).
  const janela = useMemo(() => {
    const [y, m] = TODAY_ISO.split('-').map(Number);
    const iso = d => d.toISOString().slice(0, 10);
    return {
      start: iso(new Date(Date.UTC(y, m - 2, 1))),
      end:   iso(new Date(Date.UTC(y, m + 2, 0))),
    };
  }, []);

  // Mostra do mês anterior em diante: próximos pagamentos + pendentes recentes.
  const limitePassado = useMemo(() => {
    const d = new Date(`${TODAY_ISO}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    fetchWorkRecordsByPeriod(null, null, janela.start, janela.end).then(recs => {
      if (!vivo) return;
      setRecords(recs || []);
      setLoading(false);
    });
    return () => { vivo = false; };
  }, [janela.start, janela.end]);

  // Adiantamentos lançados no intervalo de quinzenas coberto pela janela.
  useEffect(() => {
    const ini = quinzenaDaData(janela.start)?.idx;
    const fim = quinzenaDaData(janela.end)?.idx;
    if (ini == null || fim == null) return;
    let vivo = true;
    const idxs = [];
    for (let i = ini; i <= fim; i++) idxs.push(i);
    Promise.all(idxs.map(fetchAdiantamentosPorQuinzena))
      .then(arr => { if (vivo) setAdiantamentos(arr.flatMap(x => x || [])); });
    return () => { vivo = false; };
  }, [janela.start, janela.end]);

  // Pagamentos = linhas de Folha do Fluxo de Caixa, com a confirmação de status.
  const pagamentos = useMemo(() => {
    return payablesAutomaticos(records, employees, companies, TODAY_ISO)
      .filter(p => p.origem === 'Folha')
      .map(p => {
        const o = fluxoStatus[p.derivKey];
        const status = o?.status || 'pendente';
        const date = o?.data_vencimento || p.date;
        return {
          ...p, date, status, dataRecebimento: o?.data_recebimento || null,
          vencido: status === 'pendente' && date < TODAY_ISO,
        };
      })
      .filter(p => p.date >= limitePassado)
      .sort((a, b) => a.date.localeCompare(b.date) || String(a.empresa).localeCompare(String(b.empresa)));
  }, [records, employees, companies, fluxoStatus, limitePassado]);

  const totalPagar = pagamentos.reduce((s, p) => s + Number(p.valor || 0), 0);
  const totalDias  = pagamentos.reduce((s, p) => s + Number(p.dias || 0), 0);
  const totalHe    = pagamentos.reduce((s, p) => s + Number(p.heMin || 0), 0);
  const nAjudantes = new Set(pagamentos.flatMap(p => (p.breakdown || []).map(b => b.nome))).size;

  const handleStatus = async (item, status, dataRecebimento = null) => {
    if (!item.derivKey) return;
    const settled = status === 'pago' || status === 'recebido';
    const data = settled ? (dataRecebimento || null) : null;
    const salvo = await setFluxoStatusDerivado(item.derivKey, status, dataRecebimento);
    if (!salvo) console.error('[folha] não foi possível salvar o status do pagamento', item.derivKey);
    setFluxoStatus?.(prev => ({
      ...prev,
      [item.derivKey]: { ...prev?.[item.derivKey], chave: item.derivKey, status, data_recebimento: data },
    }));
  };

  const handleSalvarAdiantamento = async (dados) => {
    const criado = await createAdiantamento(dados);
    if (!criado) return false;
    setAdiantamentos(prev => [...prev, criado].sort((a, b) => a.data.localeCompare(b.data)));
    return true;
  };

  const handleExcluirAdiantamento = async (id) => {
    await deleteAdiantamento(id);
    setAdiantamentos(prev => prev.filter(a => a.id !== id));
  };

  const Card = ({ label, value, icon: Icon, valueColor = '#FFFFFF' }) => (
    <div style={{
      background: 'linear-gradient(135deg, #0B0B0B 0%, #1C1C1C 100%)',
      borderRadius: '14px', padding: '16px 18px',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 14px 34px -18px rgba(11,11,11,0.60)',
      display: 'flex', alignItems: 'center', gap: '12px',
    }}>
      <div style={{
        width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
        background: 'rgba(188,74,42,0.16)', border: '1px solid rgba(188,74,42,0.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={18} style={{ color: '#E08A70' }} />
      </div>
      <div>
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#BDBDBD', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
        <p style={{ fontSize: '17px', fontWeight: 800, color: valueColor }}>{value}</p>
      </div>
    </div>
  );

  const COLS = '1.5fr 1.2fr 0.95fr 0.6fr 0.65fr 0.95fr 1.15fr 30px';

  return (
    <div className="space-y-4">
      {/* Barra superior: contexto + lançar adiantamento */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', background: 'linear-gradient(135deg, #0B0B0B 0%, #1C1C1C 100%)', borderRadius: '14px', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 14px 34px -18px rgba(11,11,11,0.60)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 13px', borderRadius: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <CalendarDays size={14} style={{ color: '#FFFFFF' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>Próximos pagamentos por data</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '10px', background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.14)' }}>
            <FileText size={13} style={{ color: '#C9C9C9' }} />
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#C9C9C9' }}>
              Mesmos lançamentos do Fluxo de Caixa (empresa × período)
            </span>
          </div>
        </div>
        <button onClick={() => setShowLancarModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.16)', cursor: 'pointer', background: 'rgba(255,255,255,0.12)', color: '#FFFFFF', fontSize: '12px', fontWeight: 700 }}>
          <HandCoins size={14} />
          Lançar Adiantamento
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', fontSize: '13px', color: '#9A9A9A' }}>Carregando folha...</div>
      ) : (
        <>
          {/* KPIs dos pagamentos listados */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px' }}>
            <Card label="Total a Pagar" value={fmtCurrency(totalPagar)} icon={Wallet} />
            <Card label="Diárias" value={`${totalDias} dia${totalDias !== 1 ? 's' : ''}`} icon={DollarSign} />
            <Card label="Horas Extras" value={fmtHorasMin(totalHe)} icon={Clock} />
            <Card label="Ajudantes" value={String(nAjudantes)} icon={Users} valueColor="#E08A70" />
          </div>

          {/* Lista por data de pagamento */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid rgba(11, 11, 11,0.06)', boxShadow: '0 1px 3px rgba(11, 11, 11,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                Pagamentos por data — clique para ver os detalhes
              </p>
              <span style={{ fontSize: '11px', color: '#9A9A9A', fontWeight: 600 }}>{pagamentos.length} pagamento{pagamentos.length !== 1 ? 's' : ''}</span>
            </div>

            {pagamentos.length === 0 ? (
              <div style={{ padding: '50px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#6B6B6B' }}>Nenhum pagamento previsto</p>
                <p style={{ fontSize: '12px', color: '#9A9A9A', marginTop: '4px' }}>Os pagamentos aparecem conforme os registros de ponto.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: '8px', padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA' }}>
                  {['Empresa', 'Período', 'Pagamento', 'Diárias', 'H. extra', 'Total a pagar', 'Status', ''].map((h, i) => (
                    <span key={i} style={{ fontSize: '10px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i >= 3 && i <= 6 ? 'center' : 'left' }}>{h}</span>
                  ))}
                </div>
                {pagamentos.map(p => (
                  <div key={p.derivKey}
                    onClick={() => setDetalhe(p)}
                    style={{ display: 'grid', gridTemplateColumns: COLS, gap: '8px', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', cursor: 'pointer' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FAFAFA'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(188,74,42,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Building2 size={13} style={{ color: '#BC4A2A' }} />
                      </div>
                      <p style={{ fontSize: '13px', fontWeight: 700, ...T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.empresa}>{p.empresa}</p>
                    </div>
                    <span style={{ fontSize: '12px', color: '#6B6B6B', fontWeight: 600 }}>{p.periodoLabel}</span>
                    <span style={{ fontSize: '12px', fontWeight: 700, color: p.vencido ? CASH_OUT : '#0B0B0B' }}>
                      {fmtShortDate(p.date)}
                      {p.vencido && <span style={{ display: 'block', fontSize: '10px', fontWeight: 600 }}>vencido</span>}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A', textAlign: 'center' }}>{p.dias}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B6B6B', textAlign: 'center' }}>{fmtHorasMin(p.heMin)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#0B0B0B', textAlign: 'center' }}>{fmtCurrency(p.valor)}</span>
                    <div onClick={e => e.stopPropagation()} style={{ display: 'flex', justifyContent: 'center' }}>
                      <StatusCell item={p} rec={false} status={p.status} vencido={p.vencido} onStatus={handleStatus} />
                    </div>
                    <ChevronRight size={14} style={{ color: '#C8C8C8' }} />
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: '8px', alignItems: 'center', padding: '14px 16px', background: '#F7F7F7' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, ...T, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</span>
                  <span />
                  <span />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#4A4A4A', textAlign: 'center' }}>{totalDias}</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#4A4A4A', textAlign: 'center' }}>{fmtHorasMin(totalHe)}</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#0B0B0B', textAlign: 'center' }}>{fmtCurrency(totalPagar)}</span>
                  <span />
                  <span />
                </div>
              </>
            )}
          </div>

          {/* Adiantamentos lançados (mantém o lançamento/exclusão) */}
          {adiantamentos.length > 0 && (
            <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid rgba(11, 11, 11,0.06)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.09em' }}>Adiantamentos lançados</p>
              </div>
              {adiantamentos.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, ...T, flex: 1 }}>{employees.find(e => e.id === a.employeeId)?.name || '—'}</span>
                  <span style={{ fontSize: '12px', color: '#6B6B6B' }}>{fmtShortDate(a.data)}</span>
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0B0B0B' }}>{fmtCurrency(a.valor)}</span>
                  <button onClick={() => handleExcluirAdiantamento(a.id)} title="Excluir adiantamento"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {detalhe && <PagamentoDetalheModal pagamento={detalhe} onClose={() => setDetalhe(null)} />}

      {showLancarModal && (
        <LancarAdiantamentoModal
          employees={employees}
          defaultIdx={nextPayIdx}
          maxIdx={curIdx}
          onSave={handleSalvarAdiantamento}
          onClose={() => setShowLancarModal(false)}
        />
      )}
    </div>
  );
}

export default function AdminFinanceiro() {
  const { employees, companies } = useAuth();
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'visao';
  const [periodType,  setPeriodType]  = useState('mensal');
  const [offset,      setOffset]      = useState(0);
  const [records,     setRecords]     = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [dividas,     setDividas]     = useState([]);
  const [custosFixos, setCustosFixos] = useState([]);
  const [classificacoes, setClassificacoes] = useState([]);
  // Status confirmado das linhas DERIVADAS do Fluxo de Caixa (serviços e folha),
  // por chave derivada. Sem entrada, a linha é pendente. Fica aqui porque tanto
  // o Fluxo de Caixa quanto a Visão Geral precisam da mesma confirmação.
  const [fluxoStatus, setFluxoStatus] = useState({});
  const [loading,     setLoading]     = useState(true);
  // Modal "Nova Dívida": o botão fica no header (ao lado do filtro de período).
  const [showNovaDivida, setShowNovaDivida] = useState(false);

  const bounds = useMemo(() => getBounds(periodType, offset), [periodType, offset]);

  const handleChangePeriodType = (type) => { setPeriodType(type); setOffset(0); };

  // Cria uma nova classificação com uma cor da paleta (cicla por índice).
  const handleCreateClassificacao = async ({ nome, tipo }) => {
    const cor = CLASS_PALETTE[classificacoes.length % CLASS_PALETTE.length];
    const c = await createClassificacao({ nome, tipo, cor });
    if (c) setClassificacoes(prev => [...prev, c].sort((a, b) => a.nome.localeCompare(b.nome)));
    return c;
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchWorkRecordsByPeriod(null, null, bounds.start, bounds.end),
      fetchLancamentos(bounds.start, bounds.end),
    ]).then(([recs, lncs]) => {
      setRecords(recs || []);
      setLancamentos(lncs || []);
      setLoading(false);
    });
  }, [bounds.start, bounds.end]);

  useEffect(() => {
    fetchDividas().then(d => setDividas(d || []));
    fetchCustosFixos().then(c => setCustosFixos(c || []));
    fetchClassificacoes().then(c => setClassificacoes(c || []));
    fetchFluxoStatus().then(rows => setFluxoStatus(Object.fromEntries((rows || []).map(r => [r.chave, r]))));
  }, []);

  // Ao sair da sub-aba de endividamento, fecha o modal de nova dívida.
  useEffect(() => { if (activeTab !== 'dividas') setShowNovaDivida(false); }, [activeTab]);

  return (
    <div className="space-y-5">
      {/* Header — o título da sub-aba é exibido pela topbar do AdminLayout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        {/* As abas Folha e Resultados têm o seu próprio filtro de período, então o
            seletor geral do cabeçalho fica oculto nelas — evita 2 filtros na tela. */}
        {activeTab !== 'folha' && activeTab !== 'resultados' && (
          <PeriodSelector
            type={periodType}
            offset={offset}
            bounds={bounds}
            onChangeType={handleChangePeriodType}
            onChangeOffset={setOffset}
          />
        )}
        {activeTab === 'dividas' && (
          <button onClick={() => setShowNovaDivida(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#BC4A2A', color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(188,74,42,0.3)' }}>
            <Plus size={13} /> Nova Dívida
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', fontSize: '13px', color: '#9A9A9A' }}>
          Carregando dados...
        </div>
      ) : (
        <>
          {activeTab === 'visao'   && <TabVisaoGeral   records={records} lancamentos={lancamentos} dividas={dividas} employees={employees} companies={companies} classificacoes={classificacoes} fluxoStatus={fluxoStatus} />}
          {activeTab === 'fluxo'   && <TabFluxoCaixa   records={records} lancamentos={lancamentos} setLancamentos={setLancamentos} type={periodType} bounds={bounds} companies={companies} employees={employees} classificacoes={classificacoes} onCreateClassificacao={handleCreateClassificacao} fluxoStatus={fluxoStatus} setFluxoStatus={setFluxoStatus} />}
          {activeTab === 'resultados' && <TabResultados employees={employees} companies={companies} />}
          {activeTab === 'folha'   && <TabFolhaPagamento employees={employees} companies={companies} fluxoStatus={fluxoStatus} setFluxoStatus={setFluxoStatus} />}
          {activeTab === 'dividas' && <TabEndividamento dividas={dividas} setDividas={setDividas} showModal={showNovaDivida} setShowModal={setShowNovaDivida} />}
          {activeTab === 'custos'  && <TabCustosFixos   custosFixos={custosFixos} setCustosFixos={setCustosFixos} />}
          {activeTab === 'dre'     && <TabDRE           records={records} lancamentos={lancamentos} employees={employees} bounds={bounds} companies={companies} classificacoes={classificacoes} />}
        </>
      )}
    </div>
  );
}
