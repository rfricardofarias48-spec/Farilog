import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchWorkRecordsByPeriod, fetchLancamentos,
  fetchDividas, createDivida, deleteDivida,
  fetchCustosFixos, createCustoFixo, deleteCustoFixo,
  createLancamentoManual, deleteLancamento,
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
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Percent,
  ChevronLeft, ChevronRight, ChevronDown,
  Plus, Trash2, BarChart2, CreditCard, FileText, Wallet, Building2, X,
  Maximize2, Users, Clock, CalendarDays, HandCoins, Check,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────
const T  = { color: '#0B0B0B' };
const TM = { color: '#9A9A9A' };
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const PIE_COLORS  = ['#BC4A2A','#4A4A4A','#0B0B0B','#4A4A4A','#6B6B6B','#4A4A4A','#4A4A4A','#9A9A9A'];
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
    const aReceber =
      records.filter(r => r.status !== 'absent' && match(r.date))
        .reduce((s, r) => s + recordRevenue(r, companiesById), 0) +
      lancamentos.filter(l => l.tipo === 'a_receber' && match(l.data_vencimento))
        .reduce((s, l) => s + Number(l.valor || 0), 0);
    const aPagar = lancamentos.filter(l => l.tipo === 'a_pagar' && match(l.data_vencimento))
      .reduce((s, l) => s + Number(l.valor || 0), 0);
    const saldo = aReceber - aPagar;
    acumulado += saldo;
    // A coluna de saída é desenhada com o valor limitado ao teto para manter o
    // topo arredondado (igual às demais), sem achatar o eixo dos dias comuns.
    return { ...b, aReceber, aPagar, aPagarPlot: Math.min(aPagar, CASH_CAP), saldo, saldoAcum: acumulado };
  }).filter(b => b.aReceber > 0 || b.aPagar > 0); // só datas com movimentação
}

// ── Shared components ──────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, bg, sub }) {
  return (
    <div className="card" style={{ padding: '16px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B' }}>{label}</p>
        <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <p style={{ fontSize: '20px', fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '4px' }}>{sub}</p>}
    </div>
  );
}

function ChartTip({ active, payload, label, mode, breakdown }) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload ?? {};
  const isSaldo = mode === 'saldo';
  const isIn = mode === 'entrada';
  const total = isSaldo ? bucket.saldoAcum : isIn ? bucket.aReceber : bucket.aPagar;
  const totalLabel = isSaldo ? 'Saldo acumulado' : isIn ? 'Total a receber' : 'Total a pagar';
  const accent = isSaldo ? CASH_BAL : isIn ? CASH_IN : CASH_OUT;
  const accentBg = isSaldo ? 'rgba(58,79,107,0.32)' : isIn ? 'rgba(47,122,79,0.26)' : 'rgba(188,74,42,0.28)';
  const items = breakdown?.[bucket.key] ?? [];
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

  const custoFixo    = lancamentos.filter(l => l.origem_tipo === 'custo_fixo').reduce((s, l) => s + Number(l.valor || 0), 0);
  const endivPeriodo = lancamentos.filter(l => l.origem_tipo === 'divida').reduce((s, l) => s + Number(l.valor || 0), 0);

  // Totais por classificação, a partir dos lançamentos a pagar. Folha e
  // Benefícios entram por competência (registros de ponto), então os lançamentos
  // dessas duas origens não são somados aqui — evita duplicidade.
  const totalsPorClasse = {};
  lancamentos
    .filter(l => l.tipo === 'a_pagar' && l.origem_tipo !== 'folha' && l.origem_tipo !== 'beneficio')
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
function ListModal({ title, items, onDelete, onClose }) {
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11, 11, 11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '680px', maxHeight: '84vh', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#0B0B0B' }}>{title}</p>
            <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '2px' }}>{items.length} lançamento{items.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
        </div>
        {/* Cabeçalho tabela */}
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 100px 40px', padding: '9px 24px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '8px' }}>
          <span>Data</span><span>Descrição</span><span>Classificação</span><span style={{ textAlign: 'right' }}>Valor</span><span />
        </div>
        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {items.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center' }}>
              <p style={{ fontSize: '13px', color: '#C8C8C8' }}>Nenhum lançamento</p>
            </div>
          ) : items.map((item, idx) => {
            const [yr, mo, dd] = item.date.split('-');
            const rec = item.tipo === 'a_receber';
            return (
              <div key={idx} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 100px 40px', padding: '12px 24px', borderBottom: idx < items.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '8px', boxShadow: `inset 3px 0 0 ${rec ? CASH_IN : CASH_OUT}` }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B6B6B' }}>{dd}/{mo}/{yr.slice(2)}</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#0B0B0B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</span>
                <span>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: `${item.classificacaoCor || CASH_OUT}1A`, color: item.classificacaoCor || '#6B6B6B', whiteSpace: 'nowrap' }}>
                    {item.classificacaoNome || '—'}
                  </span>
                </span>
                <span style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: rec ? CASH_IN : CASH_OUT }}>
                  {rec ? '+' : '−'}{fmtCurrency(item.valor)}
                </span>
                <span style={{ display: 'flex', justifyContent: 'center' }}>
                  {item.isManual && onDelete ? (
                    <button onClick={() => onDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex', padding: '2px' }}>
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
  const hasChart = chartData.some(b => b.aReceber > 0 || b.aPagar > 0);
  // Dia com pagamento acima do teto do eixo (ex.: folha) — recebe etiqueta.
  const clippedDay = chartData.find(b => b.aPagar > CASH_CAP);
  const CHART_MODES = [
    { key: 'entrada', label: 'Entrada', color: CASH_IN },
    { key: 'saida',   label: 'Saída',   color: CASH_OUT },
    { key: 'saldo',   label: 'Saldo',   color: CASH_BAL },
  ];
  const activeMode = CHART_MODES.find(m => m.key === chartMode) || CHART_MODES[0];
  const lastSaldo = chartData.length ? chartData[chartData.length - 1] : null;
  const minSaldo = chartData.length
    ? chartData.reduce((a, b) => (b.saldoAcum < a.saldoAcum ? b : a), chartData[0])
    : null;

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
      return { date: g.date, descricao: `${co?.name || g.companyId} — ${g.count} ajudante${g.count !== 1 ? 's' : ''}`, origem: 'Serviço', valor: g.valor, tipo: 'a_receber', isManual: false, classificacaoNome: receitasClass.nome, classificacaoCor: receitasClass.cor };
    });
    const fromManual = lancamentos
      .filter(l => l.tipo === 'a_receber')
      .map(l => { const cl = classOf(l); return { date: l.data_vencimento, descricao: l.descricao, origem: 'Manual', valor: Number(l.valor || 0), tipo: 'a_receber', isManual: true, id: l.id, classificacaoNome: cl.nome, classificacaoCor: cl.cor }; });
    return [...fromRecs, ...fromManual].sort((a, b) => a.date.localeCompare(b.date));
  }, [records, lancamentos, companies, classificacoes]);

  const pagItems = useMemo(() =>
    lancamentos.filter(l => l.tipo === 'a_pagar').map(l => {
      const cl = classOf(l);
      return {
        date: l.data_vencimento, descricao: l.descricao,
        origem: l.origem_tipo === 'divida' ? 'Dívida' : l.origem_tipo === 'custo_fixo' ? 'Custo Fixo' : l.origem_tipo === 'beneficio' ? 'Benefício' : l.origem_tipo === 'folha' ? 'Folha' : 'Manual',
        valor: Number(l.valor || 0), tipo: 'a_pagar', isManual: l.origem_tipo === 'manual', id: l.id,
        classificacaoNome: cl.nome, classificacaoCor: cl.cor,
      };
    }).sort((a, b) => a.date.localeCompare(b.date)),
    [lancamentos, classificacoes]
  );

  const totalRec = recGroups.reduce((s, g) => s + g.valor, 0);
  const totalPag = pagItems.reduce((s, l) => s + l.valor, 0);

  // Itens do dia para o tooltip do gráfico: Entrada detalha cada recebimento
  // (empresa/serviço ou lançamento), Saída agrupa as contas por classificação.
  const breakdownByBucket = useMemo(() => {
    const map = {};
    chartData.forEach(b => {
      const match = d => (isDaily ? d === b.key : String(d).startsWith(b.key));
      if (chartMode === 'entrada') {
        map[b.key] = recGroups
          .filter(it => match(it.date))
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
          if (!match(it.date)) return;
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

  const modalItems = modal === 'receber' ? recGroups
    : modal === 'pagar' ? pagItems
    : [...recGroups, ...pagItems].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="space-y-5">
      {/* Totais */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <KpiCard label="A Receber no Período" value={fmtCurrency(totalRec)} icon={TrendingUp}   color={CASH_IN}  bg={CASH_IN_BG} />
        <KpiCard label="A Pagar no Período"   value={fmtCurrency(totalPag)} icon={TrendingDown} color={CASH_OUT} bg={CASH_OUT_BG} />
        <KpiCard label="Saldo Projetado" value={fmtCurrency(totalRec - totalPag)} icon={BarChart2}
          color={(totalRec - totalPag) >= 0 ? CASH_BAL : CASH_OUT}
          bg={(totalRec - totalPag) >= 0 ? '#EDF1F6' : CASH_OUT_BG} />
      </div>

      {/* Gráfico */}
      <div className="card p-5">
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, ...T }}>Fluxo de Caixa — {bounds.label}</p>
            <p style={{ fontSize: '11px', ...TM, marginTop: '2px' }}>Entradas vs. Saídas por período</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: activeMode.color }} />
              <span style={{ fontSize: '11px', color: '#6B6B6B', fontWeight: 500 }}>
                {chartMode === 'saldo' ? 'Saldo acumulado' : activeMode.label}
              </span>
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
        {!hasChart ? (
          <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: '13px', color: '#C8C8C8' }}>Sem dados no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={periodType === 'mensal' ? 320 : 280}>
            <ComposedChart data={chartData} margin={{ top: 30, right: 12, bottom: 8, left: -10 }} barCategoryGap="30%">
              <defs>
                <linearGradient id="gradSerie" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeMode.color} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={activeMode.color} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#9A9A9A', fontSize: isDaily ? 9.5 : 11 }} axisLine={false} tickLine={false} interval={0}
                height={30} />
              <YAxis domain={chartMode === 'saida' ? [0, CASH_CAP] : [0, 'auto']}
                tick={{ fill: '#9A9A9A', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v === 0 ? '' : `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTip mode={chartMode} breakdown={breakdownByBucket} />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />

              {chartMode === 'saldo' ? (
                <>
                  <Area type="monotone" dataKey="saldoAcum" name="Saldo acumulado" stroke="none" fill="url(#gradSerie)" tooltipType="none" />
                  <Line type="monotone" dataKey="saldoAcum" name="Saldo acumulado" stroke={CASH_BAL} strokeWidth={2.8} dot={false} />
                  {minSaldo && (
                    <ReferenceDot x={minSaldo.label} y={minSaldo.saldoAcum} r={4} fill="#fff" stroke={CASH_BAL} strokeWidth={2.2}
                      label={{ value: `menor: ${fmtCurrency(minSaldo.saldoAcum)}`, position: 'top', fill: '#6B6B6B', fontSize: 9, fontWeight: 700 }} />
                  )}
                  {lastSaldo && (
                    <ReferenceDot x={lastSaldo.label} y={lastSaldo.saldoAcum} r={4} fill="#fff" stroke={CASH_BAL} strokeWidth={2.2}
                      label={{ value: `final: ${fmtCurrency(lastSaldo.saldoAcum)}`, position: 'bottom', fill: '#0B0B0B', fontSize: 9, fontWeight: 700 }} />
                  )}
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
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Barra de ações */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        {/* Ver lista completa (segue o seletor do gráfico) */}
        <button onClick={() => setModal(inlineMode)} title="Ver lista completa"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(11, 11, 11,0.08)', background: '#fff', color: '#6B6B6B', fontSize: '12px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 3px rgba(11, 11, 11,0.06)' }}>
          <Maximize2 size={11} /> Ver lista completa
        </button>

        {/* Adicionar */}
        <button onClick={() => setShowAdd(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', background: '#BC4A2A', color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(188,74,42,0.3)' }}>
          <Plus size={12} /> Adicionar
        </button>
      </div>

      {/* Lista inline (preview — máx 8 itens) */}
      <div className="card overflow-hidden">
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 100px', padding: '9px 16px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '8px' }}>
          <span>Data</span><span>Descrição</span><span>Classificação</span><span style={{ textAlign: 'right' }}>Valor</span>
        </div>
        {inlineItems.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#C8C8C8' }}>Nenhum lançamento no período</p>
          </div>
        ) : (
          <>
            {inlineItems.map((item, idx) => {
              const [yr, mo, dd] = item.date.split('-');
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 100px', padding: '11px 16px', borderBottom: idx < inlineItems.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '8px', boxShadow: `inset 3px 0 0 ${item.tipo === 'a_receber' ? CASH_IN : CASH_OUT}` }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#6B6B6B' }}>{dd}/{mo}/{yr.slice(2)}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, ...T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</span>
                  <span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: `${item.classificacaoCor || '#4A4A4A'}1A`, color: item.classificacaoCor || '#6B6B6B', whiteSpace: 'nowrap' }}>
                      {item.classificacaoNome || '—'}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: item.tipo === 'a_receber' ? CASH_IN : CASH_OUT }}>
                    {item.tipo === 'a_pagar' ? '−' : '+'}{fmtCurrency(item.valor)}
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
          onClose={() => setModal(null)}
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

// ── Modal: Nova Dívida ─────────────────────────────────────────────────────
function NovaDividaModal({ onSave, onClose }) {
  const [form,   setForm]   = useState({ nome: '', valorTotal: '', valorParcela: '', numParcelas: '', dataInicio: TODAY_ISO });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const numAuto = (form.valorTotal && form.valorParcela)
    ? Math.ceil(Number(form.valorTotal) / Number(form.valorParcela)) : '';
  const canSave = form.nome.trim() && form.valorTotal && form.valorParcela && form.dataInicio && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    const num = Number(form.numParcelas) || numAuto || 1;
    await onSave({ nome: form.nome.trim(), valorTotal: Number(form.valorTotal), valorParcela: Number(form.valorParcela), numParcelas: num, dataInicio: form.dataInicio });
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
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Valor total (R$)</label>
              <input className="input-field" type="number" min="0" step="0.01" placeholder="0,00" value={form.valorTotal} onChange={e => setForm(f => ({...f, valorTotal: e.target.value}))} />
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
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Data da 1ª parcela</label>
              <input className="input-field" type="date" value={form.dataInicio} onChange={e => setForm(f => ({...f, dataInicio: e.target.value}))} />
            </div>
          </div>
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
function TabEndividamento({ dividas, setDividas }) {
  const [showModal,  setShowModal]  = useState(false);
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

  const totalDiv = dividas.reduce((s, d) => s + Number(d.valor_total || 0), 0);

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '11px', color: '#6B6B6B', fontWeight: 600 }}>Total em dívidas</p>
          <p style={{ fontSize: '26px', fontWeight: 900, ...T, lineHeight: 1.1 }}>{fmtCurrency(totalDiv)}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#BC4A2A', color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(188,74,42,0.3)' }}>
          <Plus size={13} /> Nova Dívida
        </button>
      </div>

      {showModal && <NovaDividaModal onSave={handleSave} onClose={() => setShowModal(false)} />}

      {dividas.length === 0 ? (
        <div className="card" style={{ padding: '56px', textAlign: 'center' }}>
          <CreditCard size={32} style={{ color: '#C8C8C8', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '13px', color: '#9A9A9A', fontWeight: 600 }}>Nenhuma dívida cadastrada</p>
          <p style={{ fontSize: '12px', color: '#C8C8C8', marginTop: '4px' }}>Lançamentos de dívidas aparecem automaticamente no Fluxo de Caixa</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '9px 16px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '8px' }}>
            <span>Dívida</span>
            <span style={{ textAlign: 'right' }}>Valor Total</span>
            <span style={{ textAlign: 'right' }}>Parcela</span>
            <span style={{ textAlign: 'right' }}>Parcelas</span>
            <span style={{ textAlign: 'center' }}>Ação</span>
          </div>
          {dividas.map((d, idx) => {
            const [yr, mo, day] = (d.data_inicio || '').split('-');
            return (
              <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '14px 16px', borderBottom: idx < dividas.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '8px' }}>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, ...T }}>{d.nome}</p>
                  <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '2px' }}>Início: {day}/{mo}/{yr} · {d.num_parcelas}x</p>
                </div>
                <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, ...T }}>{fmtCurrency(d.valor_total)}</p>
                <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#4A4A4A' }}>{fmtCurrency(d.valor_parcela)}<span style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 400 }}>/mês</span></p>
                <p style={{ textAlign: 'right', fontSize: '13px', color: '#6B6B6B' }}>{d.num_parcelas}x</p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {confirmDel === d.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleDelete(d.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#4A4A4A', color: 'white', fontSize: '10px', fontWeight: 700 }}>Sim</button>
                      <button onClick={() => setConfirmDel(null)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '10px' }}>Não</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Modal: Novo Custo Fixo ─────────────────────────────────────────────────
function NovoCustoModal({ onSave, onClose }) {
  const [form,   setForm]   = useState({ nome: '', valor: '', diaVencimento: '10' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const canSave = form.nome.trim() && form.valor && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    await onSave({ nome: form.nome.trim(), valor: Number(form.valor), diaVencimento: Number(form.diaVencimento) || 10 });
    setSaving(false);
  };

  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11, 11, 11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '440px', boxShadow: '0 32px 80px rgba(0,0,0,0.22)', overflow: 'hidden' }}>
        <div style={{ padding: '22px 24px 18px', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onClose} style={{ position: 'absolute', top: '18px', right: '18px', width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={15} />
          </button>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>Custos Fixos</p>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0B0B0B' }}>Novo Custo Fixo</p>
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
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B', display: 'block', marginBottom: '6px' }}>Dia do vencimento</label>
              <input className="input-field" type="number" min="1" max="31" placeholder="10" value={form.diaVencimento} onChange={e => setForm(f => ({...f, diaVencimento: e.target.value}))} />
            </div>
          </div>
          <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '-4px' }}>
            O custo será lançado automaticamente no Fluxo de Caixa pelos próximos 24 meses.
          </p>
          <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '13px', fontWeight: 600 }}>Cancelar</button>
            <button onClick={handleSave} disabled={!canSave}
              style={{ flex: 2, padding: '12px', borderRadius: '12px', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', background: canSave ? '#BC4A2A' : '#E4E4E4', color: canSave ? 'white' : '#9A9A9A', fontSize: '13px', fontWeight: 700, boxShadow: canSave ? '0 2px 10px rgba(188,74,42,0.3)' : 'none' }}>
              {saving ? 'Salvando...' : 'Lançar Custo Fixo'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Tab: Custos Fixos ──────────────────────────────────────────────────────
function TabCustosFixos({ custosFixos, setCustosFixos }) {
  const [showModal,  setShowModal]  = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const total   = custosFixos.reduce((s, c) => s + Number(c.valor || 0), 0);
  const pieData = custosFixos.filter(c => Number(c.valor) > 0).map(c => ({ name: c.nome, value: Number(c.valor) }));

  const handleSave = async (data) => {
    const c = await createCustoFixo(data);
    if (c) { setCustosFixos(prev => [c, ...prev]); setShowModal(false); }
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
          <p style={{ fontSize: '11px', color: '#6B6B6B', fontWeight: 600 }}>Total de custos fixos / mês</p>
          <p style={{ fontSize: '26px', fontWeight: 900, ...T, lineHeight: 1.1 }}>{fmtCurrency(total)}</p>
        </div>
        <button onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#BC4A2A', color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(188,74,42,0.3)' }}>
          <Plus size={13} /> Novo Custo
        </button>
      </div>

      {showModal && <NovoCustoModal onSave={handleSave} onClose={() => setShowModal(false)} />}

      <div style={{ display: 'grid', gridTemplateColumns: pieData.length > 0 ? '260px 1fr' : '1fr', gap: '16px', alignItems: 'start' }}>
        {/* Gráfico pizza */}
        {pieData.length > 0 && (
          <div className="card p-4">
            <p style={{ fontSize: '12px', fontWeight: 700, ...T, marginBottom: '12px' }}>Distribuição</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <PieChart width={200} height={200}>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmtCurrency(v)} itemStyle={{ color: '#F5F5F5', fontWeight: 600 }} labelStyle={{ color: '#B9B9B9' }} contentStyle={{ background: '#1C1C1C', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#F5F5F5' }} />
              </PieChart>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              {pieData.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <p style={{ fontSize: '11px', color: '#6B6B6B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                  <p style={{ fontSize: '11px', fontWeight: 700, ...T, flexShrink: 0 }}>{total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : '—'}</p>
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px', padding: '9px 16px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '8px' }}>
              <span>Nome</span>
              <span style={{ textAlign: 'right' }}>Valor/mês</span>
              <span style={{ textAlign: 'center' }}>Venc.</span>
              <span style={{ textAlign: 'center' }}>Ação</span>
            </div>
            {custosFixos.map((c, idx) => (
              <div key={c.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px', padding: '13px 16px', borderBottom: idx < custosFixos.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: PIE_COLORS[idx % PIE_COLORS.length], flexShrink: 0 }} />
                  <p style={{ fontSize: '13px', fontWeight: 600, ...T }}>{c.nome}</p>
                </div>
                <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#4A4A4A' }}>{fmtCurrency(c.valor)}</p>
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#6B6B6B' }}>Dia {c.dia_vencimento}</p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {confirmDel === c.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleDelete(c.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#4A4A4A', color: 'white', fontSize: '10px', fontWeight: 700 }}>Sim</button>
                      <button onClick={() => setConfirmDel(null)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#F5F5F5', color: '#6B6B6B', fontSize: '10px' }}>Não</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C8C8C8', display: 'flex' }}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
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
  const custFixoPer    = lancamentos.filter(l => l.origem_tipo === 'custo_fixo').reduce((s, l) => s + Number(l.valor || 0), 0);
  const encargosDiv    = lancamentos.filter(l => l.origem_tipo === 'divida').reduce((s, l) => s + Number(l.valor || 0), 0);
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
        <p style={{ fontSize: '14px', fontWeight: 800, ...T }}>Demonstrativo de Resultado do Exercício</p>
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
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adiantamentos, setAdiantamentos] = useState([]);
  const [showLancarModal, setShowLancarModal] = useState(false);
  const [detalheEmp, setDetalheEmp] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [folhaLanc, setFolhaLanc] = useState(null);
  const [closing, setClosing] = useState(false);

  const q = useMemo(() => quinzenaBounds(qi), [qi]);

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
    fetchAdiantamentosPorQuinzena(qi).then(setAdiantamentos);
    fetchPagosPorQuinzena(qi).then(setPagos);
  }, [q.start, q.end, qi]);

  useEffect(() => { fetchLancamentoFolha(qi).then(setFolhaLanc); }, [qi]);

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
    if (closing || totalAPagar <= 0) return;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={() => setQi(v => v - 1)}
            style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F7F7F7', border: '1px solid rgba(11, 11, 11,0.08)', cursor: 'pointer', color: '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ChevronLeft size={13} />
          </button>
          <div style={{ textAlign: 'center', minWidth: '230px' }}>
            <p style={{ fontSize: '13px', fontWeight: 800, ...T }}>{q.label}</p>
            <p style={{ fontSize: '11px', ...TM }}>{q.monthLabel}</p>
          </div>
          <button onClick={() => setQi(v => Math.min(v + 1, curIdx))} disabled={qi >= curIdx}
            style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F7F7F7', border: '1px solid rgba(11, 11, 11,0.08)', cursor: qi >= curIdx ? 'not-allowed' : 'pointer', color: qi >= curIdx ? '#C8C8C8' : '#4A4A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: qi >= curIdx ? 0.5 : 1 }}>
            <ChevronRight size={13} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 13px', borderRadius: '10px', background: isPaid ? '#F5F5F5' : '#F7F7F7', border: `1px solid ${isPaid ? '#E6E6E6' : '#E4C9BF'}` }}>
            <CalendarDays size={14} style={{ color: isPaid ? '#0B0B0B' : '#6B6B6B' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: isPaid ? '#0B0B0B' : '#6B6B6B' }}>
              {isPaid ? 'Pago em' : 'Pagamento em'} {payLabel}
            </span>
          </div>
          {folhaLanc && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '10px', background: '#EAF4EE', border: '1px solid #CDE5D5' }}>
              <FileText size={13} style={{ color: PROFIT_COLOR }} />
              <span style={{ fontSize: '12px', fontWeight: 700, color: PROFIT_COLOR }}>
                No fluxo: {fmtCurrency(Number(folhaLanc.valor))}
              </span>
            </div>
          )}
          <button onClick={handleFecharFolha} disabled={closing || totalAPagar <= 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: (closing || totalAPagar <= 0) ? 'not-allowed' : 'pointer', background: '#BC4A2A', color: '#fff', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(188,74,42,0.3)', opacity: (closing || totalAPagar <= 0) ? 0.5 : 1 }}>
            <FileText size={14} />
            {closing ? 'Fechando...' : folhaLanc ? 'Atualizar no fluxo' : 'Fechar folha'}
          </button>
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
                Pagamentos por Ajudante — {q.label}
              </p>
            </div>
            {linhas.length === 0 ? (
              <div style={{ padding: '50px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#6B6B6B' }}>Nenhum trabalho registrado nesta quinzena</p>
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
                  const registroPago = pagos.find(p => p.employeeId === l.emp.id);
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
                      <button onClick={() => handleTogglePago(l.emp.id)}
                        title={registroPago ? `Pago em ${fmtDataPago} — clique para desfazer` : 'Marcar como pago'}
                        style={{ width: '27px', height: '27px', borderRadius: '9px', border: registroPago ? 'none' : '1.5px solid #C8C8C8', background: registroPago ? '#0B0B0B' : '#fff', color: registroPago ? '#fff' : '#C8C8C8', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: registroPago ? '0 2px 6px rgba(11, 11, 11,0.35)' : 'none', transition: 'all 0.15s' }}>
                        <Check size={15} strokeWidth={3.5} />
                      </button>
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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, ...T }}>Financeiro</h1>
          <p style={{ fontSize: '12px', ...TM, marginTop: '2px' }}>Gestão financeira integrada</p>
        </div>
        <PeriodSelector
          type={periodType}
          offset={offset}
          bounds={bounds}
          onChangeType={handleChangePeriodType}
          onChangeOffset={setOffset}
        />
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
          {activeTab === 'dividas' && <TabEndividamento dividas={dividas} setDividas={setDividas} />}
          {activeTab === 'custos'  && <TabCustosFixos   custosFixos={custosFixos} setCustosFixos={setCustosFixos} />}
          {activeTab === 'dre'     && <TabDRE           records={records} lancamentos={lancamentos} employees={employees} bounds={bounds} companies={companies} />}
        </>
      )}
    </div>
  );
}
