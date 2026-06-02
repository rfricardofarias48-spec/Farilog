import { useAuth } from '../../context/AuthContext';
import { WORK_RECORDS, PAYMENTS, MONTHLY_REVENUE, DAILY_HELPERS, fmtCurrency, WEEKDAYS, MONTHS } from '../../data/mockData';

const VALOR_DIARIA = 150;
const VALOR_HE     = 50;
function parsePStart(period) { const m = period.match(/^(\d{2})\/(\d{2}) - \d{2}\/\d{2}\/(\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; }
function parsePEnd(period)   { const m = period.match(/^(\d{2})\/(\d{2}) - (\d{2})\/(\d{2})\/(\d{4})/); return m ? `${m[5]}-${m[4]}-${m[3]}` : null; }
function payAmount(p) {
  const s = parsePStart(p.period), e = parsePEnd(p.period);
  if (!s || !e) return 0;
  const recs = WORK_RECORDS.filter(r => r.companyId === p.companyId && r.date >= s && r.date <= e);
  return recs.filter(r => r.status !== 'absent').length * VALOR_DIARIA + recs.filter(r => r.overtime).length * VALOR_HE;
}
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import { TrendingUp, Users, Building2, DollarSign, Activity } from 'lucide-react';

const TODAY      = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const TODAY_DATE = new Date(TODAY + 'T12:00:00-03:00');
const PIE_COLORS = ['#FF4D0C', '#7C3AED', '#059669'];

const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

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

export default function AdminDashboard() {
  const { employees, companies } = useAuth();

  const todayRecords  = WORK_RECORDS.filter(r => r.date === TODAY);
  const activeToday   = todayRecords.filter(r => r.status === 'active').length;
  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const totalRevenue   = PAYMENTS.filter(p => p.status === 'paid').reduce((s,p) => s + payAmount(p), 0);
  const pendingRevenue = PAYMENTS.filter(p => p.status !== 'paid').reduce((s,p) => s + payAmount(p), 0);

  const weekday = WEEKDAYS[TODAY_DATE.getDay()];
  const month   = MONTHS[TODAY_DATE.getMonth()];

  const pieData = companies.map(c => ({
    name:  c.name.split(' ')[0],
    value: PAYMENTS.filter(p => p.companyId === c.id && p.status === 'paid').reduce((s,p) => s + payAmount(p), 0),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <p className="text-xs capitalize" style={TM}>{weekday}, {TODAY_DATE.getDate()} de {month} de 2026</p>
        <h1 className="text-xl font-bold mt-0.5" style={T}>Visão Geral</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up delay-1">
        {[
          { label: 'Faturamento Total', value: fmtCurrency(totalRevenue), icon: DollarSign, color: '#059669', bg: '#ECFDF5', small: true },
          { label: 'Func. ativos',      value: activeEmployees,           icon: Users,      color: '#FF4D0C', bg: '#FFF2EE' },
          { label: 'Empresas',          value: companies.length,          icon: Building2,  color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Atuando hoje',      value: activeToday,               icon: Activity,   color: '#D97706', bg: '#FFFBEB' },
        ].map((k, i) => (
          <div key={i} className="stat-card">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: k.bg }}>
                <k.icon size={18} style={{ color: k.color }} />
              </div>
            </div>
            <p className={`font-bold leading-none ${k.small ? 'text-base' : 'text-2xl'}`} style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-2" style={TM}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Revenue + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up delay-2">
        {/* Area chart */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold" style={T}>Faturamento Mensal</h3>
              <p className="text-xs" style={TM}>Últimos 6 meses</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#059669' }}>
              <TrendingUp size={13} /> +12% vs anterior
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={MONTHLY_REVENUE} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FF4D0C" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#FF4D0C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Receita" stroke="#FF4D0C" strokeWidth={2.5}
                fill="url(#revenueGrad)" dot={{ fill: '#FF4D0C', strokeWidth: 0, r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-1" style={T}>Receita por Empresa</h3>
          <p className="text-xs mb-4" style={TM}>Pagamentos realizados</p>
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
        </div>
      </div>

      {/* Bar chart */}
      <div className="card p-5 animate-fade-up delay-3">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold" style={T}>Ajudantes por Dia</h3>
            <p className="text-xs" style={TM}>Últimos 7 dias úteis</p>
          </div>
          <span className="badge badge-active">{activeToday} hoje</span>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={DAILY_HELPERS} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
            <XAxis dataKey="day" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <Bar dataKey="count" name="Ajudantes" fill="#FF4D0C" radius={[5,5,0,0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Pending alert */}
      {pendingRevenue > 0 && (
        <div className="card p-4 flex items-center justify-between animate-fade-up delay-4"
          style={{ borderLeft: '4px solid #D97706' }}>
          <div>
            <p className="text-sm font-semibold" style={T}>Pagamentos pendentes</p>
            <p className="text-xs" style={TM}>
              {PAYMENTS.filter(p => p.status !== 'paid').length} faturas em aberto — vencimento próximo
            </p>
          </div>
          <p className="font-bold text-lg" style={{ color: '#D97706' }}>{fmtCurrency(pendingRevenue)}</p>
        </div>
      )}
    </div>
  );
}
