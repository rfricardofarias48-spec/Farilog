import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { WORK_RECORDS, PAYMENTS, fmtCurrency, WEEKDAYS, MONTHS } from '../../data/mockData';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { TrendingUp, Users, Building2, DollarSign, Activity, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Constantes ─────────────────────────────────────────────────────────────
const TODAY      = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const TODAY_DATE = new Date(TODAY + 'T12:00:00-03:00');
const PIE_COLORS = ['#FF4D0C', '#7C3AED', '#059669', '#0891B2', '#D97706'];
const BASE_YEAR  = 2000;

const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

const VALOR_DIARIA = 150;
const VALOR_HE     = 50;

// ── Cálculo de período ──────────────────────────────────────────────────────
function getPeriodBounds(period, offset) {
  const day   = TODAY_DATE.getDate();
  const month = TODAY_DATE.getMonth();
  const year  = TODAY_DATE.getFullYear();

  if (period === 'quinzena') {
    const num     = day <= 15 ? 1 : 2;
    const baseIdx = (year - BASE_YEAR) * 24 + month * 2 + (num - 1);
    const idx     = baseIdx + offset;
    const tYear   = BASE_YEAR + Math.floor(idx / 24);
    const rem     = ((idx % 24) + 24) % 24;
    const tMonth  = Math.floor(rem / 2);
    const tNum    = (rem % 2) + 1;
    const mm      = String(tMonth + 1).padStart(2, '0');
    const lastDay = new Date(tYear, tMonth + 1, 0).getDate();
    const start   = tNum === 1 ? `${tYear}-${mm}-01`  : `${tYear}-${mm}-16`;
    const end     = tNum === 1 ? `${tYear}-${mm}-15`  : `${tYear}-${mm}-${String(lastDay).padStart(2, '0')}`;
    return { start, end, label: `${MONTH_FULL[tMonth]}/${tYear} — Quinzena ${tNum}`, tYear, tMonth };
  }

  if (period === 'mes') {
    let m = month + offset, y = year;
    while (m < 0)  { m += 12; y--; }
    while (m >= 12) { m -= 12; y++; }
    const mm      = String(m + 1).padStart(2, '0');
    const lastDay = new Date(y, m + 1, 0).getDate();
    return {
      start: `${y}-${mm}-01`,
      end:   `${y}-${mm}-${String(lastDay).padStart(2, '0')}`,
      label: `${MONTH_FULL[m]} ${y}`,
      tYear: y, tMonth: m,
    };
  }

  // anual
  const y = year + offset;
  return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y), tYear: y, tMonth: null };
}

// ── Tooltip dos gráficos ───────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 14px' }}>
      <p style={{ color: '#F1F5F9', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: '12px' }}>
          {p.name}: {p.name === 'Receita' ? fmtCurrency(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

// ── Componente principal ───────────────────────────────────────────────────
export default function AdminDashboard() {
  const { employees, companies } = useAuth();

  const [period, setPeriod] = useState('mes');      // 'quinzena' | 'mes' | 'ano'
  const [offset, setOffset] = useState(0);

  const handlePeriod = (p) => { setPeriod(p); setOffset(0); };

  const { start, end, label, tYear, tMonth } = getPeriodBounds(period, offset);

  // ── Dados filtrados pelo período ──────────────────────────────────────────
  const periodRecords  = WORK_RECORDS.filter(r => r.date >= start && r.date <= end);
  const periodPayments = PAYMENTS.filter(p => {
    const d = p.paidDate || p.dueDate;
    return d && d >= start && d <= end;
  });

  const activeToday     = WORK_RECORDS.filter(r => r.date === TODAY && r.status === 'active').length;
  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const periodRevenue   = periodPayments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount ?? p.valor ?? 0), 0);
  const periodDiarias   = periodRecords.filter(r => r.status !== 'absent').length;
  const periodHE        = periodRecords.filter(r => r.overtime).length;

  // ── Dados dos gráficos baseados no período ────────────────────────────────
  const buildChartData = () => {
    if (period === 'quinzena' || period === 'mes') {
      // Dia a dia
      const [sy, sm] = start.split('-').map(Number);
      const [, , ed] = end.split('-').map(Number);
      const sd       = Number(start.split('-')[2]);
      const days = [];
      for (let d = sd; d <= ed; d++) {
        const iso  = `${sy}-${String(sm).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dow  = new Date(`${iso}T12:00:00`).getDay();
        if (dow === 0 || dow === 6) continue; // pula fim de semana
        const recs = WORK_RECORDS.filter(r => r.date === iso);
        days.push({
          day:       `${String(d).padStart(2,'0')}/${String(sm).padStart(2,'0')}`,
          ajudantes: recs.filter(r => r.status !== 'absent').length,
          receita:   recs.filter(r => r.status !== 'absent').length * VALOR_DIARIA
                   + recs.filter(r => r.overtime).length * VALOR_HE,
        });
      }
      return days;
    }

    // Anual — mês a mês
    const months = [];
    for (let m = 0; m < 12; m++) {
      const mm    = String(m + 1).padStart(2, '0');
      const mEnd  = new Date(tYear, m + 1, 0).getDate();
      const mStart = `${tYear}-${mm}-01`;
      const mEndS  = `${tYear}-${mm}-${String(mEnd).padStart(2,'0')}`;
      const recs   = WORK_RECORDS.filter(r => r.date >= mStart && r.date <= mEndS);
      months.push({
        month:     MONTH_SHORT[m],
        ajudantes: recs.filter(r => r.status !== 'absent').length,
        receita:   recs.filter(r => r.status !== 'absent').length * VALOR_DIARIA
                 + recs.filter(r => r.overtime).length * VALOR_HE,
      });
    }
    return months;
  };

  const chartData  = buildChartData();
  const xKey       = period === 'ano' ? 'month' : 'day';

  // Receita por empresa no período
  const pieData = companies
    .map(c => ({
      name:  c.name.split(' ')[0],
      value: periodPayments.filter(p => p.companyId === c.id && p.status === 'paid')
                           .reduce((s, p) => s + (p.amount ?? p.valor ?? 0), 0),
    }))
    .filter(d => d.value > 0);

  const weekday = WEEKDAYS[TODAY_DATE.getDay()];
  const monthPT = MONTHS[TODAY_DATE.getMonth()];

  return (
    <div className="space-y-5">

      {/* Header + seletor de período */}
      <div className="animate-fade-up">
        <p className="text-xs capitalize" style={TM}>
          {weekday}, {TODAY_DATE.getDate()} de {monthPT} de {TODAY_DATE.getFullYear()}
        </p>
        <div className="flex items-center justify-between mt-1.5 flex-wrap gap-3">
          <h1 className="text-xl font-bold" style={T}>Visão Geral</h1>

          {/* Seletor de tipo de período */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.06)' }}>
              {[['quinzena','Quinzenal'],['mes','Mensal'],['ano','Anual']].map(([val, lbl]) => (
                <button key={val} onClick={() => handlePeriod(val)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: period === val ? '#FF4D0C' : 'transparent',
                    color:      period === val ? 'white'   : '#64748B',
                    border:     'none', cursor: 'pointer',
                  }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* Navegação do período */}
            <div className="flex items-center gap-1.5">
              <button onClick={() => setOffset(o => o - 1)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}>
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold px-2 min-w-[140px] text-center" style={T}>{label}</span>
              <button onClick={() => setOffset(o => Math.min(o + 1, 0))}
                className="p-1.5 rounded-lg transition-colors"
                style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up delay-1">
        {[
          { label: `Faturamento (${period === 'ano' ? label : period === 'mes' ? MONTH_SHORT[tMonth] : 'Quinzena'})`,
            value: fmtCurrency(periodRevenue), icon: DollarSign, small: true },
          { label: 'Func. ativos',
            value: activeEmployees,            icon: Users },
          { label: 'Empresas',
            value: companies.length,           icon: Building2 },
          { label: 'Diárias no período',
            value: periodDiarias,              icon: Activity },
        ].map((k, i) => (
          <div key={i} className="stat-card" style={{ border: '1px solid rgba(0,0,0,0.18)' }}>
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#F1F5F9' }}>
                <k.icon size={17} style={{ color: '#64748B' }} />
              </div>
            </div>
            <p className={`font-bold leading-none ${k.small ? 'text-base' : 'text-2xl'}`} style={{ color: '#0F172A' }}>
              {k.value}
            </p>
            <p className="text-xs mt-2" style={{ color: '#94A3B8' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Gráfico de receita + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up delay-2">
        {/* Area / Bar chart de faturamento */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold" style={T}>
                {period === 'ano' ? `Faturamento Mensal — ${label}` : `Faturamento — ${label}`}
              </h3>
              <p className="text-xs" style={TM}>
                {period === 'quinzena' ? 'Dias úteis da quinzena'
                 : period === 'mes'    ? 'Dias úteis do mês'
                 : 'Meses do ano'}
              </p>
            </div>
            {periodHE > 0 && (
              <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                {periodHE} H.E.
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FF4D0C" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#FF4D0C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey={xKey} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v === 0 ? '0' : `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="receita" name="Receita" stroke="#FF4D0C" strokeWidth={2.5}
                fill="url(#revenueGrad)" dot={{ fill: '#FF4D0C', strokeWidth: 0, r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-1" style={T}>Receita por Empresa</h3>
          <p className="text-xs mb-4" style={TM}>{label}</p>
          {pieData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2">
              <Building2 size={28} style={{ color: '#E2E8F0' }} />
              <p className="text-xs" style={TM}>Sem dados no período</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={46} outerRadius={68}
                    paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-1">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i] }} />
                      <span className="text-xs" style={T2}>{d.name}</span>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: PIE_COLORS[i] }}>{fmtCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Gráfico ajudantes por dia */}
      <div className="card p-5 animate-fade-up delay-3">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold" style={T}>
              {period === 'ano' ? 'Ajudantes por Mês' : 'Ajudantes por Dia'}
            </h3>
            <p className="text-xs" style={TM}>{label}</p>
          </div>
          <span className="badge badge-active">{activeToday} hoje</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey={xKey} tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="ajudantes" name="Ajudantes" fill="#FF4D0C" radius={[5,5,0,0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  );
}
