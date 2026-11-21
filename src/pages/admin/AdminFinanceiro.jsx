import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchWorkRecordsByPeriod, fetchLancamentos,
  fetchDividas, createDivida, deleteDivida,
  fetchCustosFixos, createCustoFixo, updateCustoFixo, deleteCustoFixo,
  gerarVencimentosCustoFixo, CUSTO_FIXO_HORIZONTE, statusPorVencimento,
  createLancamentoManual, deleteLancamento, updateLancamentoStatus, updateLancamentoData, updateLancamento,
  fetchAdiantamentosPorQuinzena, createAdiantamento, deleteAdiantamento,
  fetchPagosPorQuinzena, marcarPago, desmarcarPago,
  fetchClassificacoes, createClassificacao,
  fetchLancamentoFolha, fecharFolha,
} from '../../lib/db';
import { fmtCurrency } from '../../data/mockData';
import { overtimeToMinutes, recordRevenue } from '../../lib/timeUtils';
import {
  ComposedChart, Bar, Line, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, ReferenceDot,
  ReferenceLine,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Percent,
  ChevronLeft, ChevronRight, ChevronDown,
  Plus, Trash2, BarChart2, CreditCard, FileText, Wallet, Building2, X, Pencil, AlertTriangle,
  Maximize2, Users, Clock, CalendarDays, HandCoins, Check,
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

function buildChartData(type, start, end, records, lancamentos, companiesById) {
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

  let acumulado = 0;
  return buckets.map(b => {
    const match = (date) => isDay ? date === b.key : date.startsWith(b.key);
    const lancReceber = lancamentos.filter(l => l.tipo === 'a_receber' && match(l.data_vencimento));
    const lancPagar   = lancamentos.filter(l => l.tipo === 'a_pagar'   && match(l.data_vencimento));
    // O gráfico só trabalha com FATOS: lançamentos com status 'pago'/'recebido'.
    // Serviços realizados (records) entram como receita da operação — mas só a
    // partir de hoje, para casar com o status identificado pela data.
    const aReceber =
      records.filter(r => r.status !== 'absent' && match(r.date) && r.date <= TODAY_ISO)
        .reduce((s, r) => s + recordRevenue(r, companiesById), 0) +
      lancReceber.filter(l => statusOf(l) === 'recebido').reduce((s, l) => s + Number(l.valor || 0), 0);
    const aPagar = lancPagar.filter(l => statusOf(l) === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
    // Pendentes (fora dos fatos) — só para sinalizar no gráfico e nos totais.
    const aReceberPend = lancReceber.filter(l => statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
    const aPagarPend   = lancPagar.filter(l => statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
    const aReceberVenc = lancReceber.filter(isVencido).reduce((s, l) => s + Number(l.valor || 0), 0);
    const aPagarVenc   = lancPagar.filter(isVencido).reduce((s, l) => s + Number(l.valor || 0), 0);
    const saldo = aReceber - aPagar;
    acumulado += saldo;
    // A coluna de saída é desenhada com o valor limitado ao teto para manter o
    // topo arredondado (igual às demais), sem achatar o eixo dos dias comuns.
    return {
      ...b, aReceber, aPagar, aPagarPlot: Math.min(aPagar, CASH_CAP), saldo, saldoAcum: acumulado,
      aReceberPend, aPagarPend, aReceberVenc, aPagarVenc, pendTotal: aReceberPend + aPagarPend,
    };
  }).filter(b => b.aReceber > 0 || b.aPagar > 0 || b.pendTotal > 0); // datas com movimento ou pendência
}

// ── Shared components ──────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, bg, sub }) {
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
  if (!payload || payload.saldo >= 0) return null;
  return <circle cx={cx} cy={cy} r={2.8} fill={CASH_OUT} stroke="#fff" strokeWidth={0.8} />;
}

function ChartTip({ active, payload, label, mode, breakdown }) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload ?? {};

  if (mode === 'saldo') {
    const net = Number(bucket.saldo || 0);
    const acumulado = Number(bucket.saldoAcum || 0);
    const pos = net >= 0;
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
          <span style={{ color: '#F5F5F5', fontSize: '11.5px', fontWeight: 700 }}>Saldo previsto no dia</span>
          <span style={{ color: '#FFFFFF', fontSize: '12.5px', fontWeight: 900 }}>{fmtCurrency(net)}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '7px', paddingLeft: '2px' }}>
          {row(CASH_IN, 'Entrada do dia', bucket.aReceber)}
          {row(CASH_OUT, 'Saída do dia', bucket.aPagar)}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', marginTop: '7px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.10)' }}>
          <span style={{ color: '#9C9C9C', fontSize: '10.5px', fontWeight: 600 }}>Saldo acumulado</span>
          <span style={{ color: acumulado < 0 ? '#F0A08C' : '#F5F5F5', fontSize: '11px', fontWeight: 800 }}>{fmtCurrency(acumulado)}</span>
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

// ── Tab: Visão Geral ───────────────────────────────────────────────────────
function TabVisaoGeral({ records, lancamentos, employees, companies, classificacoes }) {
  const active = records.filter(r => r.status !== 'absent');
  const companiesById = Object.fromEntries((companies || []).map(c => [c.id, c]));

  // Faturamento: diária da empresa (admin) + HE proporcional (diária ÷ 8 × 1,5)
  const fat = active.reduce((s, r) => s + recordRevenue(r, companiesById), 0);

  // Folha de pagamento: diárias + horas extras dos ajudantes
  const folha = active.reduce((s, r) => {
    const emp = employees.find(e => e.id === r.employeeId);
    return s + Number(emp?.dailyRate ?? 0) + (overtimeToMinutes(r.overtime) / 60) * Number(emp?.overtimeRate ?? 50);
  }, 0);

  // Benefícios (VT/VR): valor/dia cadastrado do ajudante × dias efetivamente trabalhados
  // no período (datas distintas presentes). Ex.: VT R$ 10/dia × 5 diárias = R$ 50.
  const diasTrabalhados = {};
  active.forEach(r => {
    if (r.status === 'absent') return;
    if (!diasTrabalhados[r.employeeId]) diasTrabalhados[r.employeeId] = new Set();
    diasTrabalhados[r.employeeId].add(r.date);
  });
  let beneficiosVT = 0;
  let beneficiosVR = 0;
  Object.entries(diasTrabalhados).forEach(([empId, dias]) => {
    const emp = employees.find(e => e.id === empId);
    beneficiosVT += dias.size * Number(emp?.vtDiario ?? 0);
    beneficiosVR += dias.size * Number(emp?.vrDiario ?? 0);
  });
  const beneficios = beneficiosVT + beneficiosVR;

  // Custos lançados só entram quando confirmados (status 'pago') — o painel
  // trabalha com fatos, igual ao Fluxo de Caixa.
  const custoFixo    = lancamentos.filter(l => l.origem_tipo === 'custo_fixo' && statusOf(l) === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
  const endivPeriodo = lancamentos.filter(l => l.origem_tipo === 'divida'     && statusOf(l) === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);

  // Pendentes do período (ficam fora dos números; sinalizados no aviso).
  const pendCustos   = lancamentos.filter(l => l.tipo === 'a_pagar'   && l.origem_tipo !== 'folha' && l.origem_tipo !== 'beneficio' && statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
  const pendReceitas = lancamentos.filter(l => l.tipo === 'a_receber' && statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
  const pendVencidos = lancamentos.filter(l => statusOf(l) === 'pendente' && isVencido(l)).reduce((s, l) => s + Number(l.valor || 0), 0);

  // Totais por classificação, a partir dos lançamentos a pagar CONFIRMADOS. Folha e
  // Benefícios entram por competência (registros de ponto), então os lançamentos
  // dessas duas origens não são somados aqui — evita duplicidade.
  const totalsPorClasse = {};
  lancamentos
    .filter(l => l.tipo === 'a_pagar' && l.origem_tipo !== 'folha' && l.origem_tipo !== 'beneficio' && statusOf(l) === 'pago')
    .forEach(l => {
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
    { label: 'Faturamento', value: fmtCurrency(fat), icon: DollarSign, color: '#0B0B0B', bg: '#F5F5F5' },
    { label: 'Margem de Contribuição', value: fmtCurrency(margemContribValor), icon: Percent,
      color: margemContribValor >= 0 ? '#BC4A2A' : '#4A4A4A',
      bg:    margemContribValor >= 0 ? '#FAF4F1' : '#F5F5F5',
      sub:   `${margemContrib.toFixed(1)}% do faturamento` },
    { label: 'Lucro Líquido', value: fmtCurrency(lucroLiquido), icon: TrendingUp,
      color: lucroLiquido >= 0 ? PROFIT_COLOR : '#8C3B4A',
      bg:    lucroLiquido >= 0 ? '#EAF4EE' : '#F7EDEF',
      sub:   `${margemLucro.toFixed(1)}% do faturamento` },
  ];

  return (
    <div className="space-y-5">
      {/* 3 KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      <PendenciaNote custos={pendCustos} receitas={pendReceitas} vencidos={pendVencidos} where="nos totais e no gráfico" />

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
  // O app identifica o status pela data: vencimento até hoje = já liquidado.
  const statusPreview = statusPorVencimento(form.tipo, form.data);
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

  const canSave = form.descricao.trim() && form.valor && form.data && !saving
    && (classificacoes.length === 0 || form.classificacaoId);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave({
      tipo: form.tipo, descricao: form.descricao.trim(), valor: Number(form.valor),
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
              <input className="input-field" type="number" min="0" step="0.01" placeholder="0,00"
                value={form.valor} onChange={e => setForm(f => ({...f, valor: e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Data de vencimento</label>
              <input className="input-field" type="date" value={form.data}
                onChange={e => setForm(f => ({...f, data: e.target.value}))} />
            </div>
          </div>

          {/* Status identificado automaticamente pela data */}
          {form.data && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F7F7F7', border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', padding: '9px 12px' }}>
              <span style={{ fontSize: '11px', color: '#6B6B6B', fontWeight: 600 }}>Status identificado</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', borderRadius: '6px',
                background: statusPreview === 'pendente' ? AMBER_BG : (statusPreview === 'recebido' ? CASH_IN_BG : '#EFEFEF'),
                color: statusPreview === 'pendente' ? '#7A5B12' : (statusPreview === 'recebido' ? CASH_IN : '#4A4A4A'),
                fontSize: '11px', fontWeight: 700 }}>
                {statusPreview === 'pendente' ? <Clock size={11} /> : <Check size={11} />}
                {statusPreview === 'pendente' ? (isPagar ? 'A pagar (pendente)' : 'A receber (pendente)') : (statusPreview === 'recebido' ? 'Recebido' : 'Pago')}
              </span>
            </div>
          )}
          <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '-6px' }}>
            {statusPreview === 'pendente'
              ? 'Vencimento futuro: entra como pendente até você confirmar o pagamento/recebimento.'
              : 'Vencimento até hoje: o app considera já liquidado (pago/recebido).'}
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

// Status por linha. Linhas com lançamento salvo são acionáveis (botão
// "Pago"/"Recebido"); linhas derivadas dos serviços mostram o status, que é
// identificado automaticamente pela data (vencido → Pendente, futuro → A receber).
// A coluna nunca fica vazia.
function StatusCell({ item, rec, stored, status, vencido, onStatus }) {
  const settled = status === 'pago' || status === 'recebido';
  const actionLabel = rec ? 'Recebido' : 'Pago';

  if (settled) {
    return (
      <button onClick={() => stored && onStatus(item.id, 'pendente')} disabled={!stored}
        title={stored ? 'Clique para voltar a pendente' : 'Confirmado automaticamente pela data'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '7px', border: 'none',
          cursor: stored ? 'pointer' : 'default', whiteSpace: 'nowrap',
          background: rec ? CASH_IN_BG : '#EFEFEF', color: rec ? CASH_IN : '#4A4A4A', fontSize: '11px', fontWeight: 700 }}>
        <Check size={11} /> {actionLabel}
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
      {stored && (
        <button onClick={() => onStatus(item.id, rec ? 'recebido' : 'pago')}
          title={rec ? 'Confirmar recebimento' : 'Confirmar pagamento'}
          style={{ padding: '5px 10px', borderRadius: '7px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: 700,
            background: '#fff', color: vencido ? CASH_OUT : '#4A4A4A',
            border: `1px solid ${vencido ? 'rgba(188,74,42,0.45)' : 'rgba(11,11,11,0.12)'}` }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// Data de pagamento editável: clique abre um input de data; salva no blur/Enter.
function DateCell({ item, stored, onChange }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue]     = useState(item.date);
  useEffect(() => { setValue(item.date); }, [item.date]);

  if (!stored) return <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B6B6B' }}>{fmtShortDate(item.date)}</span>;

  const commit = () => { setEditing(false); if (value && value !== item.date) onChange(item.id, value); };

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} title="Mudar a data"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px 7px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#6B6B6B' }}>
        {fmtShortDate(item.date)}
      </button>
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

function ListModal({ title, items, onDelete, onStatus, onDate, onEdit, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const nPend = items.filter(i => i.id && (i.status || 'pendente') === 'pendente').length;

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
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: FLUXO_COLS, padding: '12px 24px', borderBottom: idx < items.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '10px', boxShadow: `inset 3px 0 0 ${rec ? CASH_IN : CASH_OUT}`, background: item.vencido ? 'rgba(188,74,42,0.045)' : undefined }}>
                <span style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, color: '#0B0B0B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.descricao}>{item.descricao}</span>
                <span style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: `${item.classificacaoCor || CASH_OUT}1A`, color: item.classificacaoCor || '#6B6B6B', whiteSpace: 'nowrap' }}>
                    {item.classificacaoNome || '—'}
                  </span>
                </span>
                <span style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: pend ? '#9A9A9A' : (rec ? CASH_IN : CASH_OUT) }}>
                  {rec ? '+' : '−'}{fmtCurrency(item.valor)}
                </span>
                <span style={{ textAlign: 'center' }}>
                  <DateCell item={item} stored={!!item.id} onChange={onDate} />
                </span>
                <span style={{ display: 'flex', justifyContent: 'center' }}>
                  <StatusCell item={item} rec={rec} stored={!!item.id} status={item.status || 'pendente'} vencido={!!item.vencido} onStatus={onStatus} />
                </span>
                <span style={{ display: 'flex', justifyContent: 'center', gap: '4px' }}>
                  {item.id && onEdit ? (
                    <button onClick={() => onEdit(item)} title="Editar lançamento" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
                      <Pencil size={13} />
                    </button>
                  ) : null}
                  {item.isManual && onDelete ? (
                    <button onClick={() => onDelete(item.id)} title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
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

// ── Tab: Fluxo de Caixa ────────────────────────────────────────────────────
function TabFluxoCaixa({ records, lancamentos, setLancamentos, type: periodType, bounds, companies, classificacoes, onCreateClassificacao }) {
  const [modal,    setModal]    = useState(null); // 'receber' | 'pagar' | 'all'
  const [showAdd,  setShowAdd]  = useState(false);
  const [chartMode, setChartMode] = useState('entrada'); // entrada | saida | saldo
  const [editItem, setEditItem]   = useState(null); // lançamento em edição

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

  const chartData = useMemo(
    () => buildChartData(periodType, bounds.start, bounds.end, records, lancamentos, companiesById),
    [periodType, bounds.start, bounds.end, records, lancamentos, companiesById]
  );
  const hasChart = chartData.some(b => b.aReceber > 0 || b.aPagar > 0 || b.pendTotal > 0);
  // Dia com pagamento acima do teto do eixo (ex.: folha) — recebe etiqueta.
  const clippedDay = chartData.find(b => b.aPagar > CASH_CAP);
  const CHART_MODES = [
    { key: 'entrada', label: 'Entrada', color: CASH_IN },
    { key: 'saida',   label: 'Saída',   color: CASH_OUT },
    { key: 'saldo',   label: 'Saldo',   color: CASH_BAL },
  ];
  const activeMode = CHART_MODES.find(m => m.key === chartMode) || CHART_MODES[0];
  // Dias com itens pendentes (fora dos fatos): marcados com um ponto âmbar.
  const pendKey  = chartMode === 'entrada' ? 'aReceberPend' : chartMode === 'saida' ? 'aPagarPend' : 'pendTotal';
  const pendDays = chartData.filter(b => b[pendKey] > 0);
  const markY    = (b) => chartMode === 'saldo' ? b.saldo : chartMode === 'entrada' ? b.aReceber : b.aPagarPlot;
  // O gráfico de saldo plota o resultado do dia (operação), não o acumulado:
  // dias com operação negativa caem abaixo da linha do zero.
  const saldoVals = chartData.map(b => b.saldo);
  const saldoDataMax = chartData.length ? Math.max(...saldoVals) : 0;
  const saldoDataMin = chartData.length ? Math.min(...saldoVals) : 0;
  const hasNegSaldo = saldoDataMin < 0;
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

  // a_receber: registros agrupados + manuais
  const recGroups = useMemo(() => {
    const map = {};
    records.filter(r => r.status !== 'absent').forEach(r => {
      const key = `${r.date}__${r.companyId}`;
      if (!map[key]) map[key] = { date: r.date, companyId: r.companyId, valor: 0, count: 0 };
      map[key].valor += recordRevenue(r, companiesById);
      map[key].count++;
    });
    const fromRecs = Object.values(map).map(g => {
      const co = companies?.find(c => c.id === g.companyId);
      // Receita de serviço: o status é identificado pela data (até hoje = recebido;
      // futuro = a receber), então a coluna Status nunca fica vazia.
      const recebido = g.date <= TODAY_ISO;
      return {
        date: g.date, descricao: `${co?.name || g.companyId} — ${g.count} ajudante${g.count !== 1 ? 's' : ''}`,
        origem: 'Serviço', valor: g.valor, tipo: 'a_receber', isManual: false, derivado: true,
        status: recebido ? 'recebido' : 'pendente', vencido: false,
        classificacaoNome: receitasClass.nome, classificacaoCor: receitasClass.cor,
      };
    });
    const fromManual = lancamentos
      .filter(l => l.tipo === 'a_receber')
      .map(l => { const cl = classOf(l); return { date: l.data_vencimento, descricao: l.descricao, origem: 'Manual', valor: Number(l.valor || 0), tipo: 'a_receber', isManual: true, id: l.id, status: statusOf(l), vencido: isVencido(l), classificacaoId: l.classificacao_id || '', classificacaoNome: cl.nome, classificacaoCor: cl.cor }; });
    return [...fromRecs, ...fromManual].sort((a, b) => a.date.localeCompare(b.date));
  }, [records, lancamentos, companies, classificacoes]);

  const pagItems = useMemo(() =>
    lancamentos.filter(l => l.tipo === 'a_pagar').map(l => {
      const cl = classOf(l);
      return {
        date: l.data_vencimento, descricao: l.descricao,
        origem: l.origem_tipo === 'divida' ? 'Dívida' : l.origem_tipo === 'custo_fixo' ? 'Custo Fixo' : l.origem_tipo === 'beneficio' ? 'Benefício' : l.origem_tipo === 'folha' ? 'Folha' : 'Manual',
        valor: Number(l.valor || 0), tipo: 'a_pagar', isManual: l.origem_tipo === 'manual', id: l.id,
        status: statusOf(l), vencido: isVencido(l), classificacaoId: l.classificacao_id || '',
        classificacaoNome: cl.nome, classificacaoCor: cl.cor,
      };
    }).sort((a, b) => a.date.localeCompare(b.date)),
    [lancamentos, classificacoes]
  );

  // Totais: realizados (fatos — pago/recebido) x pendentes.
  // Serviços realizados sempre contam como entrada (receita da operação).
  const totalRec    = recGroups.reduce((s, g) => s + g.valor, 0);
  const totalPag    = pagItems.reduce((s, l) => s + l.valor, 0);
  const recPend     = recGroups.filter(i => i.status === 'pendente').reduce((s, i) => s + i.valor, 0);
  const pagPend     = pagItems.filter(i => i.status === 'pendente').reduce((s, i) => s + i.valor, 0);
  const recSettled  = totalRec - recPend;
  const pagSettled  = totalPag - pagPend;
  const saldoReal   = recSettled - pagSettled;
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
  const inlineItems = useMemo(() => {
    const items = [];
    if (inlineMode !== 'pagar')   items.push(...recGroups);
    if (inlineMode !== 'receber') items.push(...pagItems);
    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);
  }, [inlineMode, recGroups, pagItems]);

  const handleSave = async ({ tipo, descricao, valor, dataVencimento, classificacaoId }) => {
    const l = await createLancamentoManual({ tipo, descricao, valor, dataVencimento, classificacaoId });
    if (l) {
      setLancamentos(prev => [...prev, l].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)));
      setShowAdd(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteLancamento(id);
    setLancamentos(prev => prev.filter(l => l.id !== id));
  };

  // Confirma/reverte o status (Pago / Recebido / Pendente).
  const handleStatus = async (id, status) => {
    await updateLancamentoStatus(id, status);
    setLancamentos(prev => prev.map(l => l.id === id ? { ...l, status } : l));
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

  const modalItems = modal === 'receber' ? recGroups
    : modal === 'pagar' ? pagItems
    : [...recGroups, ...pagItems].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-5">
      {/* Totais — valores do período com o quanto já é fato (pago/recebido) e o pendente */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <KpiCard label="A Receber no Período" value={fmtCurrency(totalRec)} icon={TrendingUp} color={CASH_IN} bg={CASH_IN_BG}
          sub={recPend > 0 ? `${fmtCurrency(recSettled)} confirmado · ${fmtCurrency(recPend)} pendente` : `${fmtCurrency(recSettled)} confirmado`} />
        <KpiCard label="A Pagar no Período" value={fmtCurrency(totalPag)} icon={TrendingDown} color={CASH_OUT} bg={CASH_OUT_BG}
          sub={pagPend > 0 ? `${fmtCurrency(pagSettled)} pago · ${fmtCurrency(pagPend)} pendente` : `${fmtCurrency(pagSettled)} pago`} />
        <KpiCard label="Saldo realizado" value={fmtCurrency(saldoReal)} icon={BarChart2}
          color={saldoReal >= 0 ? CASH_BAL : CASH_OUT}
          bg={saldoReal >= 0 ? '#EDF1F6' : CASH_OUT_BG}
          sub={totalPend > 0 ? `Só fatos · ${fmtCurrency(totalPend)} pendente fora do cálculo` : 'Só itens pagos/recebidos'} />
      </div>

      {/* Gráfico */}
      <div className="card p-5">
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 800, ...T }}>Fluxo de Caixa — {bounds.label}</p>
            <p style={{ fontSize: '11px', ...TM, marginTop: '2px' }}>Entradas vs. Saídas por período</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: activeMode.color }} />
                <span style={{ fontSize: '11px', color: '#6B6B6B', fontWeight: 500 }}>
                  {chartMode === 'saldo' ? 'Saldo do dia' : activeMode.label}
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

        {/* Sinalização de pendências: o gráfico só plota fatos (pago/recebido). */}
        {totalPend > 0 && (
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

              {chartMode === 'saldo' ? (
                <>
                  <Area type="monotone" dataKey="saldo" name="Saldo do dia" stroke="none"
                    fill={hasNegSaldo ? 'url(#gradSaldoFill)' : 'url(#gradSerie)'} tooltipType="none" />
                  <Line type="monotone" dataKey="saldo" name="Saldo do dia"
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
            <p style={{ fontSize: '13px', color: '#C8C8C8' }}>Nenhum lançamento no período</p>
          </div>
        ) : (
          <>
            {inlineItems.map((item, idx) => {
              const rec  = item.tipo === 'a_receber';
              const pend = (item.status || 'pendente') === 'pendente';
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: FLUXO_COLS, padding: '11px 16px', borderBottom: idx < inlineItems.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '10px', boxShadow: `inset 3px 0 0 ${rec ? CASH_IN : CASH_OUT}`, background: item.vencido ? 'rgba(188,74,42,0.045)' : undefined }}>
                  <span style={{ textAlign: 'center', fontSize: '13px', fontWeight: 600, ...T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.descricao}>{item.descricao}</span>
                  <span style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: `${item.classificacaoCor || '#4A4A4A'}1A`, color: item.classificacaoCor || '#6B6B6B', whiteSpace: 'nowrap' }}>
                      {item.classificacaoNome || '—'}
                    </span>
                  </span>
                  <span style={{ textAlign: 'center', fontSize: '13px', fontWeight: 700, color: pend ? '#9A9A9A' : (rec ? CASH_IN : CASH_OUT) }} title={pend ? 'Valor ainda não confirmado' : undefined}>
                    {rec ? '+' : '−'}{fmtCurrency(item.valor)}
                  </span>
                  <span style={{ textAlign: 'center' }}>
                    <DateCell item={item} stored={!!item.id} onChange={handleDate} />
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'center' }}>
                    <StatusCell item={item} rec={rec} stored={!!item.id} status={item.status || 'pendente'} vencido={!!item.vencido} onStatus={handleStatus} />
                  </span>
                  <span style={{ display: 'flex', justifyContent: 'center' }}>
                    {item.id ? (
                      <button onClick={() => setEditItem(item)} title="Editar lançamento"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
                        <Pencil size={13} />
                      </button>
                    ) : null}
                  </span>
                </div>
              );
            })}
            {/* Rodapé com total de itens ocultos */}
            {(inlineMode !== 'pagar' ? recGroups : []).length + (inlineMode !== 'receber' ? pagItems : []).length > 8 && (
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
          onEdit={setEditItem}
          onClose={() => setModal(null)}
        />
      )}

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
          <KpiCard label="Valor total (dívida)" value={fmtCurrency(totalFinanc)} icon={Wallet} color="#3A4F6B" bg="#EDF1F6"
            sub={`${rows.length} ${rows.length === 1 ? 'dívida' : 'dívidas'} ativas`} />
          <KpiCard label="Juros totais" value={fmtCurrency(totalJuros)} icon={Percent} color="#8C3B4A" bg="#F7EDEF"
            sub={totalFinanc > 0 ? `${pctJuros.toFixed(1).replace('.', ',')}% sobre o financiado` : 'Sem valor financiado'} />
          <KpiCard label="Custo mensal" value={fmtCurrency(custoMensal)} icon={CalendarDays} color="#4A4A4A" bg="#F5F5F5"
            sub="Soma das parcelas" />
          <KpiCard label="Total a pagar" value={fmtCurrency(totalPagar)} icon={FileText} color="#0B0B0B" bg="#F0F0F0"
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
function TabDRE({ records, lancamentos, employees, bounds, companies }) {
  const active = records.filter(r => r.status !== 'absent');
  const companiesById = Object.fromEntries((companies || []).map(c => [c.id, c]));

  // Receita bruta: diária da empresa (admin) + HE proporcional (diária ÷ 8 × 1,5)
  const receitaBruta   = active.reduce((s, r) => s + recordRevenue(r, companiesById), 0);
  const custServicos   = active.reduce((s, r) => {
    const emp = employees.find(e => e.id === r.employeeId);
    return s + Number(emp?.dailyRate ?? 0) + (overtimeToMinutes(r.overtime) / 60) * Number(emp?.overtimeRate ?? 50);
  }, 0);
  const lucroBruto     = receitaBruta - custServicos;
  // Despesas lançadas entram apenas quando confirmadas (status 'pago'): o DRE,
  // como o Fluxo de Caixa, só considera fatos.
  const custFixoPer    = lancamentos.filter(l => l.origem_tipo === 'custo_fixo' && statusOf(l) === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
  const encargosDiv    = lancamentos.filter(l => l.origem_tipo === 'divida'     && statusOf(l) === 'pago').reduce((s, l) => s + Number(l.valor || 0), 0);
  // Pendentes do período (não entram no resultado).
  const pendCustos     = lancamentos.filter(l => l.tipo === 'a_pagar'   && l.origem_tipo !== 'folha' && l.origem_tipo !== 'beneficio' && statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
  const pendReceitas   = lancamentos.filter(l => l.tipo === 'a_receber' && statusOf(l) === 'pendente').reduce((s, l) => s + Number(l.valor || 0), 0);
  const pendVencidos   = lancamentos.filter(l => statusOf(l) === 'pendente' && isVencido(l)).reduce((s, l) => s + Number(l.valor || 0), 0);
  const totalDespesas  = custFixoPer + encargosDiv;
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
        <Row label="= LUCRO BRUTO" value={lucroBruto} bold sep positive={lucroBruto >= 0} negative={lucroBruto < 0} />

        <Row label="DESPESAS OPERACIONAIS" value={-totalDespesas} bold sep />
        <Row label="(−) Custos Fixos" value={-custFixoPer} indent={1} muted />
        <Row label="(−) Encargos de Dívidas" value={-encargosDiv} indent={1} muted />

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

function TabFolhaPagamento({ employees, onFolhaFechada }) {
  const curIdx = (Number(TODAY_ISO.split('-')[0]) - 2000) * 24
    + (Number(TODAY_ISO.split('-')[1]) - 1) * 2
    + (Number(TODAY_ISO.split('-')[2]) <= 15 ? 0 : 1);
  const [qi, setQi]     = useState(curIdx);
  const [modo, setModo] = useState('quinzena'); // 'quinzena' | 'mes'
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adiantamentos, setAdiantamentos] = useState([]);
  const [showLancarModal, setShowLancarModal] = useState(false);
  const [detalheEmp, setDetalheEmp] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [folhaLanc, setFolhaLanc] = useState(null);
  const [closing, setClosing] = useState(false);

  // Índices das quinzenas cobertas pela seleção (1 no modo quinzenal, 2 no mensal).
  const monthQ1 = Math.floor(qi / 2) * 2;

  const q = useMemo(() => {
    if (modo === 'quinzena') return quinzenaBounds(qi);
    const a = quinzenaBounds(monthQ1), b = quinzenaBounds(monthQ1 + 1);
    return { start: a.start, end: b.end, payDate: a.payDate, label: a.monthLabel, monthLabel: a.monthLabel };
  }, [qi, modo, monthQ1]);

  useEffect(() => {
    if (!menuOpen) return;
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [menuOpen]);

  // Quinzena padrão do lançamento = a do próximo pagamento que ainda vai ocorrer:
  // dias 01–07 → Q2 do mês anterior (paga dia 07); dias 08–22 → Q1 do mês (paga dia 22);
  // dias 23–31 → Q2 do mês (paga dia 07 do mês seguinte).
  const nextPayIdx = useMemo(
    () => (quinzenaBounds(curIdx - 1).payDate >= TODAY_ISO ? curIdx - 1 : curIdx),
    [curIdx]
  );

  useEffect(() => {
    setLoading(true);
    fetchWorkRecordsByPeriod(null, null, q.start, q.end).then(recs => {
      setRecords(recs || []);
      setLoading(false);
    });
    const list = modo === 'quinzena' ? [qi] : [monthQ1, monthQ1 + 1];
    Promise.all(list.map(i => fetchAdiantamentosPorQuinzena(i))).then(arr => setAdiantamentos(arr.flatMap(x => x || [])));
    Promise.all(list.map(i => fetchPagosPorQuinzena(i))).then(arr => setPagos(arr.flatMap(x => x || [])));
  }, [q.start, q.end, modo, qi]);

  useEffect(() => {
    const list = modo === 'quinzena' ? [qi] : [monthQ1, monthQ1 + 1];
    Promise.all(list.map(i => fetchLancamentoFolha(i))).then(arr => {
      const found = arr.filter(Boolean);
      setFolhaLanc(found.length === 0 ? null : found.length === 1 ? found[0] : { valor: found.reduce((s, x) => s + Number(x.valor || 0), 0) });
    });
  }, [qi, modo]);

  const handleSalvarAdiantamento = async (dados) => {
    const criado = await createAdiantamento(dados);
    if (!criado) return false;
    if (criado.quinzenaIdx === qi) {
      setAdiantamentos(prev => [...prev, criado].sort((a, b) => a.data.localeCompare(b.data)));
    }
    return true;
  };

  const handleExcluirAdiantamento = async (id) => {
    await deleteAdiantamento(id);
    setAdiantamentos(prev => prev.filter(a => a.id !== id));
  };

  // Marca/desmarca o pagamento de um ajudante na quinzena exibida.
  const handleTogglePago = async (employeeId) => {
    if (modo !== 'quinzena') return; // pagamento é sempre por quinzena
    const jaPago = pagos.find(p => p.employeeId === employeeId);
    if (jaPago) {
      await desmarcarPago(employeeId, qi);
      setPagos(prev => prev.filter(p => p.employeeId !== employeeId));
    } else {
      const criado = await marcarPago(employeeId, qi);
      if (criado) setPagos(prev => [...prev, criado]);
    }
  };

  // Agrupa por ajudante: diárias (dias distintos trabalhados) + HE (taxa do próprio cadastro).
  // Adiantamentos lançados para a quinzena são descontados do total a pagar.
  const linhas = useMemo(() => {
    const byEmp = {};
    records.forEach(r => {
      if (r.status === 'absent' || !r.employeeId) return;
      const emp = employees.find(e => e.id === r.employeeId);
      if (!emp) return;
      if (!byEmp[r.employeeId]) {
        byEmp[r.employeeId] = { emp, days: new Set(), heMin: 0 };
      }
      byEmp[r.employeeId].days.add(r.date);
      byEmp[r.employeeId].heMin += overtimeToMinutes(r.overtime);
    });
    return Object.values(byEmp).map(({ emp, days, heMin }) => {
      const diarias = days.size * Number(emp.dailyRate || 0);
      const he      = (heMin / 60) * Number(emp.overtimeRate || 0);
      const adiantado = adiantamentos
        .filter(a => a.employeeId === emp.id)
        .reduce((s, a) => s + a.valor, 0);
      return { emp, dias: days.size, heMin, diarias, he, total: diarias + he, adiantado, aPagar: diarias + he - adiantado };
    }).sort((a, b) => b.total - a.total);
  }, [records, employees, adiantamentos]);

  const totalGeral    = linhas.reduce((s, l) => s + l.total, 0);
  const totalHE       = linhas.reduce((s, l) => s + l.he, 0);
  const totalDiar     = linhas.reduce((s, l) => s + l.diarias, 0);
  const totalAdiant   = adiantamentos.reduce((s, a) => s + a.valor, 0);
  const totalAPagar   = totalGeral - totalAdiant;
  const payLabel   = `${q.payDate.split('-')[2]}/${q.payDate.split('-')[1]}/${q.payDate.split('-')[0]}`;
  const isPaid     = q.payDate < TODAY_ISO;

  // Fecha a folha da quinzena: cria (ou atualiza) o lançamento no fluxo de caixa,
  // classificado como "Folha de Pagamento".
  const handleFecharFolha = async () => {
    if (modo !== 'quinzena' || closing || totalAPagar <= 0) return;
    setClosing(true);
    const label = `${q.monthLabel} · ${qi % 2 === 0 ? 'Q1' : 'Q2'}`;
    const l = await fecharFolha({ quinzenaIdx: qi, total: totalAPagar, dataVencimento: q.payDate, label });
    setFolhaLanc(l);
    setClosing(false);
    if (onFolhaFechada) onFolhaFechada();
  };

  const Card = ({ label, value, color, bg, icon: Icon }) => (
    <div style={{ background: '#fff', borderRadius: '14px', padding: '16px 18px', border: '1px solid rgba(11, 11, 11,0.06)', boxShadow: '0 1px 3px rgba(11, 11, 11,0.05)', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div>
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
        <p style={{ fontSize: '17px', fontWeight: 800, color }}>{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Seletor de quinzena */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', background: '#fff', borderRadius: '14px', padding: '12px 16px', border: '1px solid rgba(11, 11, 11,0.06)', boxShadow: '0 1px 3px rgba(11, 11, 11,0.05)' }}>
        {/* Filtro único da folha: Mensal/Quinzenal no estilo do seletor do cabeçalho */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button onClick={() => setMenuOpen(v => !v)}
              style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 13px', borderRadius: '10px', border: '1px solid rgba(11, 11, 11,0.08)', cursor: 'pointer', background: '#fff', fontSize: '12px', fontWeight: 600, color: '#0B0B0B', boxShadow: '0 1px 3px rgba(11, 11, 11,0.06)', whiteSpace: 'nowrap' }}>
              {modo === 'mes' ? q.monthLabel : `${q.label} — ${q.monthLabel}`}
              <span style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 500 }}>· {modo === 'mes' ? 'Mensal' : 'Quinzenal'}</span>
              <ChevronDown size={12} style={{ color: '#9A9A9A' }} />
            </button>
            {menuOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#fff', borderRadius: '12px', padding: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.07)', minWidth: '150px' }}>
                {[['quinzena', 'Quinzenal'], ['mes', 'Mensal']].map(([val, lbl]) => (
                  <button key={val} onClick={() => { setModo(val); setMenuOpen(false); }}
                    style={{ width: '100%', display: 'block', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '12px', fontWeight: 600, background: modo === val ? '#FAF4F1' : 'transparent', color: modo === val ? '#BC4A2A' : '#333333' }}
                    onMouseEnter={e => { if (modo !== val) e.currentTarget.style.background = '#F7F7F7'; }}
                    onMouseLeave={e => { if (modo !== val) e.currentTarget.style.background = 'transparent'; }}>
                    {lbl}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => setQi(v => (modo === 'mes' ? v - 2 : v - 1))}
            title="Anterior"
            style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fff', border: '1px solid rgba(11, 11, 11,0.08)', cursor: 'pointer', color: '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(11, 11, 11,0.06)' }}>
            <ChevronLeft size={13} />
          </button>
          <button onClick={() => setQi(v => Math.min(modo === 'mes' ? v + 2 : v + 1, curIdx))}
            disabled={modo === 'mes' ? monthQ1 + 2 > curIdx : qi >= curIdx}
            title="Próximo"
            style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fff', border: '1px solid rgba(11, 11, 11,0.08)', cursor: (modo === 'mes' ? monthQ1 + 2 > curIdx : qi >= curIdx) ? 'not-allowed' : 'pointer', color: (modo === 'mes' ? monthQ1 + 2 > curIdx : qi >= curIdx) ? '#C8C8C8' : '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(11, 11, 11,0.06)', opacity: (modo === 'mes' ? monthQ1 + 2 > curIdx : qi >= curIdx) ? 0.5 : 1 }}>
            <ChevronRight size={13} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {modo === 'quinzena' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 13px', borderRadius: '10px', background: isPaid ? '#F5F5F5' : '#F7F7F7', border: `1px solid ${isPaid ? '#E6E6E6' : '#E4C9BF'}` }}>
            <CalendarDays size={14} style={{ color: isPaid ? '#0B0B0B' : '#6B6B6B' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: isPaid ? '#0B0B0B' : '#6B6B6B' }}>
              {isPaid ? 'Pago em' : 'Pagamento em'} {payLabel}
            </span>
          </div>
          )}
          {folhaLanc && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '10px', background: '#EAF4EE', border: '1px solid #CDE5D5' }}>
              <FileText size={13} style={{ color: PROFIT_COLOR }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: PROFIT_COLOR }}>
                No fluxo: {fmtCurrency(Number(folhaLanc.valor))}
              </span>
            </div>
          )}
          {modo === 'quinzena' && (
          <button onClick={handleFecharFolha} disabled={closing || totalAPagar <= 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: (closing || totalAPagar <= 0) ? 'not-allowed' : 'pointer', background: '#BC4A2A', color: '#fff', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(188,74,42,0.3)', opacity: (closing || totalAPagar <= 0) ? 0.5 : 1 }}>
            <FileText size={14} />
            {closing ? 'Fechando...' : folhaLanc ? 'Atualizar no fluxo' : 'Fechar folha'}
          </button>
          )}
          <button onClick={() => setShowLancarModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#4A4A4A', color: '#fff', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(74, 74, 74,0.3)' }}>
            <HandCoins size={14} />
            Lançar Adiantamento
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', fontSize: '13px', color: '#9A9A9A' }}>
          Carregando folha...
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <Card label="Total a Pagar" value={fmtCurrency(totalAPagar)} color="#0B0B0B" bg="#F5F5F5" icon={Wallet} />
            <Card label="Diárias" value={fmtCurrency(totalDiar)} color="#4A4A4A" bg="#F5F5F5" icon={DollarSign} />
            <Card label="Horas Extras" value={fmtCurrency(totalHE)} color="#6B6B6B" bg="#F7F7F7" icon={Clock} />
            <Card label="Adiantamentos" value={fmtCurrency(totalAdiant)} color="#4A4A4A" bg="#F5F5F5" icon={HandCoins} />
            <Card label="Ajudantes na Quinzena" value={String(linhas.length)} color="#BC4A2A" bg="#FAF4F1" icon={Users} />
          </div>

          {/* Lista de ajudantes */}
          <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid rgba(11, 11, 11,0.06)', boxShadow: '0 1px 3px rgba(11, 11, 11,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
                Pagamentos por Ajudante — {modo === 'mes' ? `${q.monthLabel} (mês)` : q.label}
              </p>
            </div>
            {linhas.length === 0 ? (
              <div style={{ padding: '50px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#6B6B6B' }}>Nenhum trabalho registrado {modo === 'mes' ? 'neste mês' : 'nesta quinzena'}</p>
                <p style={{ fontSize: '12px', color: '#9A9A9A', marginTop: '4px' }}>Os pagamentos aparecem conforme os registros de ponto.</p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.7fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr 0.55fr', gap: '8px', padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA' }}>
                  {['Ajudante', 'Diárias', 'Horas Extra', 'Diárias (R$)', 'H. Extras (R$)', 'Adiantamento', 'A Pagar', 'Pago'].map(h => (
                    <span key={h} style={{ fontSize: '10px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</span>
                  ))}
                </div>
                {linhas.map(l => {
                  const registroPago = modo === 'quinzena' ? pagos.find(p => p.employeeId === l.emp.id) : null;
                  const fmtDataPago = registroPago
                    ? (() => { const d = new Date(registroPago.pagoEm); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; })()
                    : null;
                  return (
                    <div key={l.emp.id} style={{ display: 'grid', gridTemplateColumns: '2fr 0.7fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr 0.55fr', gap: '8px', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', background: registroPago ? '#F5F5F5' : 'transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: l.emp.color || '#0B0B0B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                        {l.emp.initials || l.emp.name?.split(' ').map(p => p[0]).slice(0, 2).join('')}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, ...T, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.emp.name}</p>
                        <p style={{ fontSize: '11px', ...TM }}>Diária {fmtCurrency(Number(l.emp.dailyRate || 0))} · HE {fmtCurrency(Number(l.emp.overtimeRate || 0))}/h</p>
                      </div>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>{l.dias} {l.dias === 1 ? 'dia' : 'dias'}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>
                      {Math.floor(l.heMin / 60)}h{String(l.heMin % 60).padStart(2, '0')}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#4A4A4A' }}>{fmtCurrency(l.diarias)}</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#6B6B6B' }}>{fmtCurrency(l.he)}</span>
                    <div>
                      {l.adiantado > 0 ? (
                        <button onClick={() => setDetalheEmp(l.emp.id)} title="Ver detalhes dos adiantamentos"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '8px', background: '#F5F5F5', border: '1px dashed #E6E6E6', cursor: 'pointer', fontSize: '12px', fontWeight: 800, color: '#4A4A4A' }}>
                          −{fmtCurrency(l.adiantado)}
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#C8C8C8' }}>—</span>
                      )}
                    </div>
                    <div>
                      <p style={{ fontSize: '14px', fontWeight: 800, color: l.aPagar < 0 ? '#4A4A4A' : registroPago ? '#9A9A9A' : '#0B0B0B' }}>{fmtCurrency(l.aPagar)}</p>
                      {registroPago ? (
                        <p style={{ fontSize: '10px', fontWeight: 700, color: '#0B0B0B' }}>Pago {fmtDataPago}</p>
                      ) : l.adiantado > 0 ? (
                        <p style={{ fontSize: '10px', color: '#9A9A9A', textDecoration: 'line-through' }}>Bruto {fmtCurrency(l.total)}</p>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      {modo === 'mes' ? (
                        <span style={{ fontSize: '12px', color: '#C8C8C8' }} title="Marque os pagamentos na visão por quinzena">—</span>
                      ) : (
                      <button onClick={() => handleTogglePago(l.emp.id)}
                        title={registroPago ? `Pago em ${fmtDataPago} — clique para desfazer` : 'Marcar como pago'}
                        style={{ width: '27px', height: '27px', borderRadius: '9px', border: registroPago ? 'none' : '1.5px solid #C8C8C8', background: registroPago ? '#0B0B0B' : '#fff', color: registroPago ? '#fff' : '#C8C8C8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: registroPago ? '0 2px 6px rgba(11, 11, 11,0.35)' : 'none', transition: 'all 0.15s' }}>
                        <Check size={15} strokeWidth={3.5} />
                      </button>
                      )}
                    </div>
                  </div>
                  );
                })}
                {/* Total */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 0.7fr 0.8fr 0.9fr 0.9fr 0.9fr 1fr 0.55fr', gap: '8px', alignItems: 'center', padding: '14px 16px', background: '#F7F7F7' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, ...T }}>TOTAL</span>
                  <span />
                  <span />
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#4A4A4A' }}>{fmtCurrency(totalDiar)}</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#6B6B6B' }}>{fmtCurrency(totalHE)}</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: '#4A4A4A' }}>−{fmtCurrency(totalAdiant)}</span>
                  <span style={{ fontSize: '15px', fontWeight: 800, color: '#0B0B0B' }}>{fmtCurrency(totalAPagar)}</span>
                  <span />
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Modais de adiantamento */}
      {showLancarModal && (
        <LancarAdiantamentoModal
          employees={employees}
          defaultIdx={nextPayIdx}
          maxIdx={curIdx}
          onSave={handleSalvarAdiantamento}
          onClose={() => setShowLancarModal(false)}
        />
      )}
      {detalheEmp && (
        <AdiantamentoDetalheModal
          empName={employees.find(e => e.id === detalheEmp)?.name || ''}
          itens={adiantamentos.filter(a => a.employeeId === detalheEmp)}
          onDelete={handleExcluirAdiantamento}
          onClose={() => setDetalheEmp(null)}
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
  const [loading,     setLoading]     = useState(true);
  // Modal "Nova Dívida": o botão fica no header (ao lado do filtro de período).
  const [showNovaDivida, setShowNovaDivida] = useState(false);

  const bounds = useMemo(() => getBounds(periodType, offset), [periodType, offset]);

  const handleChangePeriodType = (type) => { setPeriodType(type); setOffset(0); };

  const reloadLancamentos = () => fetchLancamentos(bounds.start, bounds.end).then(l => setLancamentos(l || []));

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
  }, []);

  // Ao sair da sub-aba de endividamento, fecha o modal de nova dívida.
  useEffect(() => { if (activeTab !== 'dividas') setShowNovaDivida(false); }, [activeTab]);

  return (
    <div className="space-y-5">
      {/* Header — o título da sub-aba é exibido pela topbar do AdminLayout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        {/* A aba Folha tem o seu próprio filtro (Mensal/Quinzenal), então o
            seletor geral do cabeçalho fica oculto nela — evita 2 filtros na tela. */}
        {activeTab !== 'folha' && (
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
          {activeTab === 'visao'   && <TabVisaoGeral   records={records} lancamentos={lancamentos} dividas={dividas} employees={employees} companies={companies} classificacoes={classificacoes} />}
          {activeTab === 'fluxo'   && <TabFluxoCaixa   records={records} lancamentos={lancamentos} setLancamentos={setLancamentos} type={periodType} bounds={bounds} companies={companies} classificacoes={classificacoes} onCreateClassificacao={handleCreateClassificacao} />}
          {activeTab === 'folha'   && <TabFolhaPagamento employees={employees} onFolhaFechada={reloadLancamentos} />}
          {activeTab === 'dividas' && <TabEndividamento dividas={dividas} setDividas={setDividas} showModal={showNovaDivida} setShowModal={setShowNovaDivida} />}
          {activeTab === 'custos'  && <TabCustosFixos   custosFixos={custosFixos} setCustosFixos={setCustosFixos} />}
          {activeTab === 'dre'     && <TabDRE           records={records} lancamentos={lancamentos} employees={employees} bounds={bounds} companies={companies} />}
        </>
      )}
    </div>
  );
}
