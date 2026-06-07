import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchWorkRecordsByPeriod, fetchLancamentos,
  fetchDividas, createDivida, deleteDivida,
  fetchCustosFixos, createCustoFixo, deleteCustoFixo,
} from '../../lib/db';
import { fmtCurrency } from '../../data/mockData';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, Percent,
  ChevronLeft, ChevronRight, ChevronDown,
  Plus, Trash2, BarChart2, CreditCard, FileText, Wallet, Building2,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────
const T  = { color: '#0F172A' };
const TM = { color: '#94A3B8' };
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const PIE_COLORS  = ['#FF4D0C','#2563EB','#059669','#7C3AED','#D97706','#0891B2','#E11D48','#94A3B8'];
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

function buildChartData(type, start, end, records, lancamentos) {
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

  return buckets.map(b => {
    const match = (date) => isDay ? date === b.key : date.startsWith(b.key);
    const aReceber = records.filter(r => r.status !== 'absent' && match(r.date))
      .reduce((s, r) => s + Number(r.value || 0), 0);
    const aPagar = lancamentos.filter(l => match(l.data_vencimento))
      .reduce((s, l) => s + Number(l.valor || 0), 0);
    return { ...b, aReceber, aPagar, saldo: aReceber - aPagar };
  });
}

// ── Shared components ──────────────────────────────────────────────────────
function KpiCard({ label, value, icon: Icon, color, bg, sub }) {
  return (
    <div className="card" style={{ padding: '16px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>{label}</p>
        <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={13} style={{ color }} />
        </div>
      </div>
      <p style={{ fontSize: '20px', fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
      {sub && <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>{sub}</p>}
    </div>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ color: '#94A3B8', fontSize: '11px', marginBottom: '6px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color ?? '#F1F5F9', fontSize: '12px', fontWeight: 600, marginBottom: '2px' }}>
          {p.name}: {fmtCurrency(p.value)}
        </p>
      ))}
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
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 13px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#F1F5F9', fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>
          {bounds.label}
          <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500 }}>· {typeLabel}</span>
          <ChevronDown size={12} style={{ color: '#94A3B8' }} />
        </button>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: '#fff', borderRadius: '12px', padding: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', border: '1px solid rgba(0,0,0,0.07)', minWidth: '150px' }}>
            {[['quinzenal','Quinzenal'],['mensal','Mensal'],['semestral','Semestral'],['anual','Anual']].map(([val, lbl]) => (
              <button key={val} onClick={() => { onChangeType(val); setOpen(false); }}
                style={{ width: '100%', display: 'block', padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '12px', fontWeight: 600, background: type === val ? '#FFF2EE' : 'transparent', color: type === val ? '#FF4D0C' : '#374151' }}
                onMouseEnter={e => { if (type !== val) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={e => { if (type !== val) e.currentTarget.style.background = 'transparent'; }}>
                {lbl}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={() => onChangeOffset(o => o - 1)}
        style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronLeft size={13} />
      </button>
      <button onClick={() => onChangeOffset(o => Math.min(o + 1, 0))}
        style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ChevronRight size={13} />
      </button>
    </div>
  );
}

// ── Tab: Visão Geral ───────────────────────────────────────────────────────
function TabVisaoGeral({ records, lancamentos, employees }) {
  const active = records.filter(r => r.status !== 'absent');

  const fat = active.reduce((s, r) => s + Number(r.value || 0), 0);

  // Folha de pagamento (diárias) e benefícios (horas extras) separados
  const folha = active.reduce((s, r) => {
    const emp = employees.find(e => e.id === r.employeeId);
    return s + Number(emp?.dailyRate ?? 0);
  }, 0);
  const beneficios = active.reduce((s, r) => {
    if (!r.overtime) return s;
    const emp = employees.find(e => e.id === r.employeeId);
    return s + Number(emp?.overtimeRate ?? 50);
  }, 0);

  const custoFixo    = lancamentos.filter(l => l.origem_tipo === 'custo_fixo').reduce((s, l) => s + Number(l.valor || 0), 0);
  const endivPeriodo = lancamentos.filter(l => l.origem_tipo === 'divida').reduce((s, l) => s + Number(l.valor || 0), 0);

  const totalCustos   = folha + beneficios + custoFixo + endivPeriodo;
  const lucroLiquido  = fat - totalCustos;
  const margemContrib = fat > 0 ? ((fat - folha - beneficios) / fat) * 100 : 0;
  const margemLucro   = fat > 0 ? (lucroLiquido / fat) * 100 : 0;

  // Fatias do gráfico — devem somar ao faturamento
  const slices = [
    { name: 'Lucro Líquido',        value: Math.max(0, lucroLiquido), color: '#059669' },
    { name: 'Folha de Pagamento',   value: folha,                     color: '#2563EB' },
    { name: 'Benefícios (H. Extra)',value: beneficios,                color: '#7C3AED' },
    { name: 'Custos Fixos',         value: custoFixo,                 color: '#D97706' },
    { name: 'Endividamento',        value: endivPeriodo,              color: '#E11D48' },
  ].filter(s => s.value > 0);

  const kpis = [
    { label: 'Faturamento',           value: fmtCurrency(fat),             icon: DollarSign, color: '#059669', bg: '#F0FDF4' },
    { label: 'Margem de Contribuição',value: `${margemContrib.toFixed(1)}%`,icon: Percent,    color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Lucro Líquido',         value: fmtCurrency(lucroLiquido),    icon: TrendingUp,
      color: lucroLiquido >= 0 ? '#059669' : '#E11D48',
      bg:    lucroLiquido >= 0 ? '#F0FDF4' : '#FFF1F2' },
    { label: 'Margem de Lucro',       value: `${margemLucro.toFixed(1)}%`, icon: BarChart2,
      color: margemLucro >= 0 ? '#059669' : '#E11D48',
      bg:    margemLucro >= 0 ? '#F0FDF4' : '#FFF1F2' },
  ];

  return (
    <div className="space-y-5">
      {/* 4 KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        {kpis.map(k => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Gráfico + legenda */}
      <div className="card p-6">
        {fat === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#CBD5E1' }}>Sem faturamento no período selecionado</p>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
            {/* Donut chart */}
            <div style={{ flexShrink: 0 }}>
              <PieChart width={220} height={220}>
                <Pie data={slices} cx="50%" cy="50%" innerRadius={62} outerRadius={100} paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                  {slices.map((s, i) => <Cell key={i} fill={s.color} />)}
                </Pie>
                <Tooltip formatter={v => fmtCurrency(v)} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#F1F5F9' }} />
              </PieChart>
              {/* Valor central */}
              <p style={{ textAlign: 'center', fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginTop: '-8px' }}>
                Faturamento total
              </p>
              <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 900, color: '#0F172A', lineHeight: 1.1 }}>
                {fmtCurrency(fat)}
              </p>
            </div>

            {/* Legenda */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {slices.map(s => {
                const pct = fat > 0 ? (s.value / fat) * 100 : 0;
                return (
                  <div key={s.name}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{s.name}</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: s.color }}>{fmtCurrency(s.value)}</p>
                        <p style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 500, minWidth: '38px', textAlign: 'right' }}>{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                    {/* Barra de progresso */}
                    <div style={{ height: '4px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                );
              })}

              {/* Caso o lucro seja negativo, mostra aviso */}
              {lucroLiquido < 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: '#FFF1F2', marginTop: '4px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E11D48', flexShrink: 0 }} />
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#E11D48' }}>
                    Prejuízo de {fmtCurrency(Math.abs(lucroLiquido))} no período — custos superam o faturamento
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

// ── Tab: Fluxo de Caixa ────────────────────────────────────────────────────
function TabFluxoCaixa({ records, lancamentos, type: periodType, bounds, companies }) {
  const [view, setView] = useState('all');

  const chartData = useMemo(
    () => buildChartData(periodType, bounds.start, bounds.end, records, lancamentos),
    [periodType, bounds.start, bounds.end, records, lancamentos]
  );
  const hasChart = chartData.some(b => b.aReceber > 0 || b.aPagar > 0);

  // a_receber: group registros by date + company
  const recGroups = useMemo(() => {
    const map = {};
    records.filter(r => r.status !== 'absent').forEach(r => {
      const key = `${r.date}__${r.companyId}`;
      if (!map[key]) map[key] = { date: r.date, companyId: r.companyId, valor: 0, count: 0 };
      map[key].valor += Number(r.value || 0);
      map[key].count++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [records]);

  const pagItems = useMemo(
    () => [...lancamentos].sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento)),
    [lancamentos]
  );

  const totalRec = recGroups.reduce((s, g) => s + g.valor, 0);
  const totalPag = pagItems.reduce((s, l) => s + Number(l.valor || 0), 0);

  return (
    <div className="space-y-5">
      {/* Totais rápidos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
        <KpiCard label="A Receber no Período" value={fmtCurrency(totalRec)} icon={TrendingUp}   color="#059669" bg="#F0FDF4" />
        <KpiCard label="A Pagar no Período"   value={fmtCurrency(totalPag)} icon={TrendingDown} color="#E11D48" bg="#FFF1F2" />
        <KpiCard label="Saldo Projetado"       value={fmtCurrency(totalRec - totalPag)} icon={BarChart2}
          color={(totalRec - totalPag) >= 0 ? '#059669' : '#E11D48'}
          bg={(totalRec - totalPag) >= 0 ? '#F0FDF4' : '#FFF1F2'} />
      </div>

      {/* Gráfico — sempre visível */}
      <div className="card p-5">
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, ...T }}>Fluxo de Caixa</p>
            <p style={{ fontSize: '11px', ...TM, marginTop: '2px' }}>Entradas vs. Saídas — {bounds.label}</p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {[['#059669','A Receber'],['#E11D48','A Pagar'],['#2563EB','Saldo']].map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: c }} />
                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: 500 }}>{l}</span>
              </div>
            ))}
          </div>
        </div>
        {!hasChart ? (
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <p style={{ fontSize: '13px', color: '#CBD5E1' }}>Sem dados no período</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false}
                interval={periodType === 'mensal' ? 4 : 0} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v === 0 ? '' : `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
              <Bar dataKey="aReceber" name="A Receber" fill="#059669" radius={[3,3,0,0]} barSize={7} opacity={0.85} />
              <Bar dataKey="aPagar"   name="A Pagar"   fill="#E11D48" radius={[3,3,0,0]} barSize={7} opacity={0.85} />
              <Line dataKey="saldo" name="Saldo" stroke="#2563EB" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Filtros da lista */}
      <div>
        <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
          {[['all','Todos'],['receber','A Receber'],['pagar','A Pagar']].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, transition: 'all 0.12s',
                background: view === v ? (v === 'receber' ? '#F0FDF4' : v === 'pagar' ? '#FFF1F2' : '#0F172A') : '#F1F5F9',
                color:      view === v ? (v === 'receber' ? '#059669' : v === 'pagar' ? '#E11D48' : 'white')    : '#64748B',
              }}>{l}</button>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 100px', padding: '9px 16px', background: '#F8FAFC', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '8px' }}>
            <span>Data</span><span>Descrição</span><span>Origem</span><span style={{ textAlign: 'right' }}>Valor</span>
          </div>
          {(() => {
            const items = [];
            if (view !== 'pagar') {
              recGroups.forEach(g => {
                const co = companies?.find(c => c.id === g.companyId);
                items.push({ date: g.date, descricao: `${co?.name || g.companyId} — ${g.count} ajudante${g.count !== 1 ? 's' : ''}`, origem: 'A Receber', valor: g.valor, tipo: 'a_receber' });
              });
            }
            if (view !== 'receber') {
              pagItems.forEach(l => items.push({ date: l.data_vencimento, descricao: l.descricao, origem: l.origem_tipo === 'divida' ? 'Dívida' : l.origem_tipo === 'custo_fixo' ? 'Custo Fixo' : 'Manual', valor: Number(l.valor || 0), tipo: 'a_pagar' }));
            }
            items.sort((a, b) => a.date.localeCompare(b.date));
            if (items.length === 0) return (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#CBD5E1' }}>Nenhum lançamento no período</p>
              </div>
            );
            return items.map((item, idx) => {
              const [yr, mo, dd] = item.date.split('-');
              return (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 110px 100px', padding: '11px 16px', borderBottom: idx < items.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>{dd}/{mo}/{yr.slice(2)}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, ...T, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.descricao}</span>
                  <span>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '5px', background: item.tipo === 'a_receber' ? '#F0FDF4' : '#FFF1F2', color: item.tipo === 'a_receber' ? '#059669' : '#E11D48' }}>
                      {item.origem}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: item.tipo === 'a_receber' ? '#059669' : '#E11D48' }}>
                    {item.tipo === 'a_pagar' ? '−' : '+'}{fmtCurrency(item.valor)}
                  </span>
                </div>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Endividamento ─────────────────────────────────────────────────────
function TabEndividamento({ dividas, setDividas }) {
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [form, setForm] = useState({ nome: '', valorTotal: '', valorParcela: '', numParcelas: '', dataInicio: TODAY_ISO });

  const numAuto = (form.valorTotal && form.valorParcela)
    ? Math.ceil(Number(form.valorTotal) / Number(form.valorParcela))
    : '';

  const handleSave = async () => {
    if (!form.nome || !form.valorTotal || !form.valorParcela || !form.dataInicio) return;
    setSaving(true);
    const num = Number(form.numParcelas) || numAuto || 1;
    const d = await createDivida({ nome: form.nome, valorTotal: Number(form.valorTotal), valorParcela: Number(form.valorParcela), numParcelas: num, dataInicio: form.dataInicio });
    if (d) { setDividas(prev => [d, ...prev]); setForm({ nome: '', valorTotal: '', valorParcela: '', numParcelas: '', dataInicio: TODAY_ISO }); setShowForm(false); }
    setSaving(false);
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
          <p style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total em dívidas</p>
          <p style={{ fontSize: '26px', fontWeight: 900, ...T, lineHeight: 1.1 }}>{fmtCurrency(totalDiv)}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#FF4D0C', color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(255,77,12,0.3)' }}>
          <Plus size={13} /> Nova Dívida
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <p style={{ fontSize: '14px', fontWeight: 700, ...T }}>Lançar Nova Dívida</p>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Nome da dívida</label>
            <input className="input-field" placeholder="Ex: Empréstimo bancário" value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Valor total (R$)</label>
              <input className="input-field" type="number" min="0" step="0.01" placeholder="0,00" value={form.valorTotal} onChange={e => setForm(f => ({...f, valorTotal: e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Valor da parcela (R$)</label>
              <input className="input-field" type="number" min="0" step="0.01" placeholder="0,00" value={form.valorParcela} onChange={e => setForm(f => ({...f, valorParcela: e.target.value}))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>
                Qtd. parcelas
                {numAuto ? <span style={{ color: '#94A3B8', fontWeight: 400 }}> — calculado: {numAuto}x</span> : ''}
              </label>
              <input className="input-field" type="number" min="1" placeholder={numAuto || '24'} value={form.numParcelas} onChange={e => setForm(f => ({...f, numParcelas: e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Data da 1ª parcela</label>
              <input className="input-field" type="date" value={form.dataInicio} onChange={e => setForm(f => ({...f, dataInicio: e.target.value}))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#F1F5F9', color: '#64748B', fontSize: '13px', fontWeight: 600 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.nome || !form.valorTotal || !form.valorParcela}
              style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: (!form.nome || !form.valorTotal || !form.valorParcela) ? '#E2E8F0' : '#FF4D0C', color: (!form.nome || !form.valorTotal || !form.valorParcela) ? '#94A3B8' : 'white', fontSize: '13px', fontWeight: 700 }}>
              {saving ? 'Salvando...' : 'Lançar Dívida'}
            </button>
          </div>
        </div>
      )}

      {dividas.length === 0 ? (
        <div className="card" style={{ padding: '56px', textAlign: 'center' }}>
          <CreditCard size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 600 }}>Nenhuma dívida cadastrada</p>
          <p style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '4px' }}>Lançamentos de dívidas aparecem automaticamente no Fluxo de Caixa</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px', padding: '9px 16px', background: '#F8FAFC', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '8px' }}>
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
                  <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Início: {day}/{mo}/{yr} · {d.num_parcelas}x</p>
                </div>
                <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, ...T }}>{fmtCurrency(d.valor_total)}</p>
                <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#E11D48' }}>{fmtCurrency(d.valor_parcela)}<span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 400 }}>/mês</span></p>
                <p style={{ textAlign: 'right', fontSize: '13px', color: '#64748B' }}>{d.num_parcelas}x</p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {confirmDel === d.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleDelete(d.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#E11D48', color: 'white', fontSize: '10px', fontWeight: 700 }}>Sim</button>
                      <button onClick={() => setConfirmDel(null)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#F1F5F9', color: '#64748B', fontSize: '10px' }}>Não</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', display: 'flex' }}>
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

// ── Tab: Custos Fixos ──────────────────────────────────────────────────────
function TabCustosFixos({ custosFixos, setCustosFixos }) {
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [form, setForm] = useState({ nome: '', valor: '', diaVencimento: '10' });

  const total    = custosFixos.reduce((s, c) => s + Number(c.valor || 0), 0);
  const pieData  = custosFixos.filter(c => Number(c.valor) > 0).map(c => ({ name: c.nome, value: Number(c.valor) }));

  const handleSave = async () => {
    if (!form.nome || !form.valor) return;
    setSaving(true);
    const c = await createCustoFixo({ nome: form.nome, valor: Number(form.valor), diaVencimento: Number(form.diaVencimento) || 10 });
    if (c) { setCustosFixos(prev => [c, ...prev]); setForm({ nome: '', valor: '', diaVencimento: '10' }); setShowForm(false); }
    setSaving(false);
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
          <p style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>Total de custos fixos / mês</p>
          <p style={{ fontSize: '26px', fontWeight: 900, ...T, lineHeight: 1.1 }}>{fmtCurrency(total)}</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#FF4D0C', color: 'white', fontSize: '12px', fontWeight: 700, boxShadow: '0 2px 8px rgba(255,77,12,0.3)' }}>
          <Plus size={13} /> Novo Custo
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <p style={{ fontSize: '14px', fontWeight: 700, ...T }}>Novo Custo Fixo</p>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Nome</label>
            <input className="input-field" placeholder="Ex: Aluguel, Energia elétrica..." value={form.nome} onChange={e => setForm(f => ({...f, nome: e.target.value}))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Valor mensal (R$)</label>
              <input className="input-field" type="number" min="0" step="0.01" placeholder="0,00" value={form.valor} onChange={e => setForm(f => ({...f, valor: e.target.value}))} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '6px' }}>Dia do vencimento</label>
              <input className="input-field" type="number" min="1" max="31" placeholder="10" value={form.diaVencimento} onChange={e => setForm(f => ({...f, diaVencimento: e.target.value}))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#F1F5F9', color: '#64748B', fontSize: '13px', fontWeight: 600 }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.nome || !form.valor}
              style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', background: (!form.nome || !form.valor) ? '#E2E8F0' : '#FF4D0C', color: (!form.nome || !form.valor) ? '#94A3B8' : 'white', fontSize: '13px', fontWeight: 700 }}>
              {saving ? 'Salvando...' : 'Lançar Custo'}
            </button>
          </div>
        </div>
      )}

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
                <Tooltip formatter={v => fmtCurrency(v)} contentStyle={{ background: '#1E293B', border: 'none', borderRadius: '8px', fontSize: '12px', color: '#F1F5F9' }} />
              </PieChart>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
              {pieData.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                  <p style={{ fontSize: '11px', color: '#64748B', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                  <p style={{ fontSize: '11px', fontWeight: 700, ...T, flexShrink: 0 }}>{total > 0 ? `${((item.value / total) * 100).toFixed(0)}%` : '—'}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista */}
        {custosFixos.length === 0 ? (
          <div className="card" style={{ padding: '56px', textAlign: 'center' }}>
            <Wallet size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 600 }}>Nenhum custo fixo cadastrado</p>
            <p style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '4px' }}>Custos fixos são lançados automaticamente no Fluxo de Caixa</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 80px', padding: '9px 16px', background: '#F8FAFC', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '8px' }}>
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
                <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: '#E11D48' }}>{fmtCurrency(c.valor)}</p>
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#64748B' }}>Dia {c.dia_vencimento}</p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {confirmDel === c.id ? (
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button onClick={() => handleDelete(c.id)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#E11D48', color: 'white', fontSize: '10px', fontWeight: 700 }}>Sim</button>
                      <button onClick={() => setConfirmDel(null)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#F1F5F9', color: '#64748B', fontSize: '10px' }}>Não</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', display: 'flex' }}>
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
function TabDRE({ records, lancamentos, employees, bounds }) {
  const active = records.filter(r => r.status !== 'absent');

  const receitaBruta   = active.reduce((s, r) => s + Number(r.value || 0), 0);
  const custServicos   = active.reduce((s, r) => {
    const emp = employees.find(e => e.id === r.employeeId);
    return s + Number(emp?.dailyRate ?? 0) + (r.overtime ? Number(emp?.overtimeRate ?? 50) : 0);
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${bold ? '10px' : '7px'} ${16 + indent * 16}px`, background: bold && sep ? '#F8FAFC' : 'transparent' }}>
        <p style={{ fontSize: bold ? '13px' : '12px', fontWeight: bold ? 700 : 400, color: muted ? '#64748B' : '#0F172A' }}>{label}</p>
        <p style={{ fontSize: bold ? '14px' : '12px', fontWeight: bold ? 800 : 600, color: positive ? '#059669' : negative ? '#E11D48' : '#0F172A', whiteSpace: 'nowrap' }}>
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
        {/* Header escuro */}
        <div style={{ padding: '14px 16px', background: '#1E293B' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.09em' }}>
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
            <div key={lbl} style={{ background: '#F8FAFC', padding: '14px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>{lbl}</p>
              <p style={{ fontSize: '20px', fontWeight: 800, ...T }}>{val}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
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
  const [loading,     setLoading]     = useState(true);

  const bounds = useMemo(() => getBounds(periodType, offset), [periodType, offset]);

  const handleChangePeriodType = (type) => { setPeriodType(type); setOffset(0); };

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
        <div style={{ padding: '60px', textAlign: 'center', fontSize: '13px', color: '#94A3B8' }}>
          Carregando dados...
        </div>
      ) : (
        <>
          {activeTab === 'visao'   && <TabVisaoGeral   records={records} lancamentos={lancamentos} dividas={dividas} employees={employees} />}
          {activeTab === 'fluxo'   && <TabFluxoCaixa   records={records} lancamentos={lancamentos} type={periodType} bounds={bounds} companies={companies} />}
          {activeTab === 'dividas' && <TabEndividamento dividas={dividas} setDividas={setDividas} />}
          {activeTab === 'custos'  && <TabCustosFixos   custosFixos={custosFixos} setCustosFixos={setCustosFixos} />}
          {activeTab === 'dre'     && <TabDRE           records={records} lancamentos={lancamentos} employees={employees} bounds={bounds} />}
        </>
      )}
    </div>
  );
}
