import { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PAYMENTS, COMPANIES, MONTHLY_REVENUE, WORK_RECORDS, fmtCurrency, fmtDate } from '../../data/mockData';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Clock, Building2, ArrowUpRight, ArrowDownRight, FileDown, Download, Calendar,
  Filter, Search, ChevronRight, Receipt,
} from 'lucide-react';

const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

const TODAY      = '2026-05-26';
const TODAY_DATE = new Date(2026, 4, 26);

const PIE_COLORS = ['#FF4D0C', '#7C3AED', '#059669', '#0EA5E9', '#F59E0B'];

const VALOR_DIARIA     = 150;
const VALOR_HORA_EXTRA = 50;

// Parse "01/05 - 15/05/2026" → ISO dates
function parsePeriodStart(period) {
  const m = period.match(/^(\d{2})\/(\d{2}) - \d{2}\/\d{2}\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
function parsePeriodEnd(period) {
  const m = period.match(/^(\d{2})\/(\d{2}) - (\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[5]}-${m[4]}-${m[3]}` : null;
}

// Calcula o valor total de uma fatura como (diárias × 150) + (horas extras × 50)
function calcPaymentTotal(payment) {
  const pStart = parsePeriodStart(payment.period);
  const pEnd   = parsePeriodEnd(payment.period);
  if (!pStart || !pEnd) return { total: 0, diarias: 0, heCount: 0 };
  const recs = WORK_RECORDS.filter(r => r.companyId === payment.companyId && r.date >= pStart && r.date <= pEnd);
  const diarias = recs.filter(r => r.status !== 'absent').length;
  const heCount = recs.filter(r => r.overtime).length;
  return { total: diarias * VALOR_DIARIA + heCount * VALOR_HORA_EXTRA, diarias, heCount };
}

function payAmount(p) { return calcPaymentTotal(p).total; }

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
      <p style={{ color: '#F1F5F9', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, fontSize: '12px' }}>
          {p.name}: {typeof p.value === 'number' && p.name.toLowerCase().includes('receita') ? fmtCurrency(p.value) : (p.name === 'Pago' || p.name === 'Pendente' || p.name === 'Atrasado' ? fmtCurrency(p.value) : p.value)}
        </p>
      ))}
    </div>
  );
};

export default function AdminFinanceiro() {
  const { companies } = useAuth();
  const [period, setPeriod]         = useState('mes');    // mes | trimestre | ano
  const [statusFilter, setStatus]   = useState('todos');  // todos | paid | pending | overdue
  const [search, setSearch]         = useState('');

  // ── Calculos gerais ───────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const paid     = PAYMENTS.filter(p => p.status === 'paid');
    const pending  = PAYMENTS.filter(p => p.status === 'pending');
    const overdue  = PAYMENTS.filter(p => p.status === 'overdue');
    return {
      totalRevenue:  paid.reduce((s, p) => s + payAmount(p), 0),
      totalPending:  pending.reduce((s, p) => s + payAmount(p), 0),
      totalOverdue:  overdue.reduce((s, p) => s + payAmount(p), 0),
      totalInvoiced: PAYMENTS.reduce((s, p) => s + payAmount(p), 0),
      countPaid:     paid.length,
      countPending:  pending.length,
      countOverdue:  overdue.length,
    };
  }, []);

  // Variação vs mês anterior
  const lastTwo = MONTHLY_REVENUE.slice(-2);
  const growth  = lastTwo.length === 2 ? ((lastTwo[1].revenue - lastTwo[0].revenue) / lastTwo[0].revenue) * 100 : 0;

  // ── Receita por empresa (pie) ─────────────────────────────────────────────
  const revenueByCompany = useMemo(() => {
    return companies.map(c => ({
      name:  c.name.split(' ')[0],
      fullName: c.name,
      value: PAYMENTS.filter(p => p.companyId === c.id && p.status === 'paid').reduce((s, p) => s + payAmount(p), 0),
      pending: PAYMENTS.filter(p => p.companyId === c.id && p.status !== 'paid').reduce((s, p) => s + payAmount(p), 0),
    })).filter(d => d.value > 0 || d.pending > 0);
  }, [companies]);

  const totalForPct = revenueByCompany.reduce((s, c) => s + c.value, 0);

  // ── Status breakdown (bar) ────────────────────────────────────────────────
  const statusBreakdown = [
    { name: 'Pago',     value: totals.totalRevenue, color: '#059669' },
    { name: 'Pendente', value: totals.totalPending, color: '#D97706' },
    { name: 'Atrasado', value: totals.totalOverdue, color: '#E11D48' },
  ];

  // ── Faturas filtradas ─────────────────────────────────────────────────────
  const filteredPayments = useMemo(() => {
    return PAYMENTS
      .filter(p => statusFilter === 'todos' || p.status === statusFilter)
      .filter(p => {
        if (!search) return true;
        const c = companies.find(c => c.id === p.companyId);
        return c?.name.toLowerCase().includes(search.toLowerCase()) ||
               p.period.toLowerCase().includes(search.toLowerCase());
      })
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }, [statusFilter, search, companies]);

  // ── Top empresas (ranking) ────────────────────────────────────────────────
  const topCompanies = [...revenueByCompany].sort((a, b) => b.value - a.value).slice(0, 5);

  // ── Próximos vencimentos ──────────────────────────────────────────────────
  const upcomingPayments = PAYMENTS
    .filter(p => p.status !== 'paid')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  // ── Ticket médio ──────────────────────────────────────────────────────────
  const ticketMedio = totals.countPaid > 0 ? totals.totalRevenue / totals.countPaid : 0;

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="flex items-end justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold" style={T}>Financeiro</h1>
          <p className="text-sm mt-0.5" style={TM}>Visão consolidada de receita, faturas e empresas</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background:'#F1F5F9', border:'1px solid rgba(0,0,0,0.06)' }}>
            {[['mes','Mês'],['trimestre','Trimestre'],['ano','Ano']].map(([val, lbl]) => (
              <button key={val} onClick={() => setPeriod(val)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: period===val ? '#FF4D0C' : 'transparent', color: period===val ? 'white' : '#64748B', border:'none', cursor:'pointer' }}>
                {lbl}
              </button>
            ))}
          </div>
          <button className="btn-primary" style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 18px' }}>
            <FileDown size={14} /> Exportar
          </button>
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-up delay-1">
        {/* Receita Total */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#DCFCE7' }}>
              <DollarSign size={17} style={{ color: '#059669' }} />
            </div>
            <span style={{ display:'inline-flex', alignItems:'center', gap:'3px', fontSize:'11px', fontWeight:700, padding:'3px 8px', borderRadius:'6px', background: growth >= 0 ? '#DCFCE7' : '#FFE4E6', color: growth >= 0 ? '#15803D' : '#BE123C' }}>
              {growth >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
              {Math.abs(growth).toFixed(1)}%
            </span>
          </div>
          <p className="text-xs mb-1" style={TM}>Receita Total</p>
          <p className="text-2xl font-black leading-none" style={T}>{fmtCurrency(totals.totalRevenue)}</p>
          <p className="text-xs mt-2" style={TM}>{totals.countPaid} faturas pagas</p>
        </div>

        {/* Pendente */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FEF3C7' }}>
              <Clock size={17} style={{ color: '#D97706' }} />
            </div>
            <span className="badge badge-pending">{totals.countPending}</span>
          </div>
          <p className="text-xs mb-1" style={TM}>A Receber</p>
          <p className="text-2xl font-black leading-none" style={{ color: '#D97706' }}>{fmtCurrency(totals.totalPending)}</p>
          <p className="text-xs mt-2" style={TM}>Próximos vencimentos</p>
        </div>

        {/* Atrasado */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#FFE4E6' }}>
              <AlertTriangle size={17} style={{ color: '#E11D48' }} />
            </div>
            <span className="badge badge-overdue">{totals.countOverdue}</span>
          </div>
          <p className="text-xs mb-1" style={TM}>Em Atraso</p>
          <p className="text-2xl font-black leading-none" style={{ color: '#E11D48' }}>{fmtCurrency(totals.totalOverdue)}</p>
          <p className="text-xs mt-2" style={TM}>Requer ação</p>
        </div>

        {/* Ticket médio */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#EDE9FE' }}>
              <Receipt size={17} style={{ color: '#7C3AED' }} />
            </div>
            <TrendingUp size={14} style={{ color: '#7C3AED' }} />
          </div>
          <p className="text-xs mb-1" style={TM}>Ticket Médio</p>
          <p className="text-2xl font-black leading-none" style={{ color: '#7C3AED' }}>{fmtCurrency(ticketMedio)}</p>
          <p className="text-xs mt-2" style={TM}>Por fatura paga</p>
        </div>
      </div>

      {/* ─── Gráficos principais ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up delay-2">
        {/* Faturamento mensal (Area chart) */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold" style={T}>Evolução do Faturamento</h3>
              <p className="text-xs" style={TM}>Últimos 6 meses</p>
            </div>
            <div className="text-right">
              <p className="text-xs" style={TM}>Total no período</p>
              <p className="font-bold text-base" style={{ color:'#059669' }}>
                {fmtCurrency(MONTHLY_REVENUE.reduce((s, m) => s + m.revenue, 0))}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={MONTHLY_REVENUE} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#FF4D0C" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#FF4D0C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="revenue" name="Receita" stroke="#FF4D0C" strokeWidth={2.5}
                fill="url(#adminRevGrad)" dot={{ fill: '#FF4D0C', strokeWidth: 0, r: 4 }}
                activeDot={{ r: 6, fill: '#FF4D0C' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-1" style={T}>Status de Faturas</h3>
          <p className="text-xs mb-4" style={TM}>Distribuição por situação</p>
          <div className="space-y-3.5">
            {statusBreakdown.map((s, i) => {
              const pct = totals.totalInvoiced > 0 ? (s.value / totals.totalInvoiced) * 100 : 0;
              return (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                      <span className="text-xs font-semibold" style={T}>{s.name}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: s.color }}>{fmtCurrency(s.value)}</span>
                  </div>
                  <div style={{ height: '6px', borderRadius: '4px', background: 'rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: s.color, borderRadius: '4px', transition: 'width 0.5s ease' }} />
                  </div>
                  <p className="text-xs mt-1" style={TM}>{pct.toFixed(1)}%</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Receita por Empresa + Top Empresas ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-fade-up delay-3">
        {/* Pie chart */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold" style={T}>Receita por Empresa</h3>
              <p className="text-xs" style={TM}>Total recebido</p>
            </div>
            <Building2 size={16} style={{ color:'#94A3B8' }} />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={revenueByCompany} cx="50%" cy="50%" innerRadius={50} outerRadius={78}
                paddingAngle={3} dataKey="value">
                {revenueByCompany.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {revenueByCompany.map((d, i) => {
              const pct = totalForPct > 0 ? (d.value / totalForPct) * 100 : 0;
              return (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span style={{ width:'9px', height:'9px', borderRadius:'2px', background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-xs" style={T2}>{d.fullName}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold" style={T}>{fmtCurrency(d.value)}</span>
                    <span className="text-xs" style={TM}>{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Empresas */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold" style={T}>Top Empresas</h3>
              <p className="text-xs" style={TM}>Ranking por faturamento</p>
            </div>
            <TrendingUp size={16} style={{ color:'#94A3B8' }} />
          </div>
          <div className="space-y-2.5">
            {topCompanies.map((c, i) => {
              const pct = topCompanies[0]?.value > 0 ? (c.value / topCompanies[0].value) * 100 : 0;
              return (
                <div key={i} className="p-3 rounded-xl" style={{ background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.04)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div style={{
                        width:'26px', height:'26px', borderRadius:'8px',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background: i === 0 ? '#FFEDD5' : i === 1 ? '#EDE9FE' : '#F1F5F9',
                        color: i === 0 ? '#EA580C' : i === 1 ? '#7C3AED' : '#64748B',
                        fontWeight:800, fontSize:'11px',
                      }}>
                        #{i + 1}
                      </div>
                      <div>
                        <p className="text-xs font-semibold" style={T}>{c.fullName}</p>
                        {c.pending > 0 && <p className="text-xs" style={{ color:'#D97706' }}>{fmtCurrency(c.pending)} a receber</p>}
                      </div>
                    </div>
                    <span className="text-sm font-bold" style={{ color:'#059669' }}>{fmtCurrency(c.value)}</span>
                  </div>
                  <div style={{ height:'4px', borderRadius:'4px', background:'rgba(0,0,0,0.05)', overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg, #FF4D0C, #FB923C)', borderRadius:'4px', transition:'width 0.4s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Próximos Vencimentos ─── */}
      <div className="card p-5 animate-fade-up delay-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold" style={T}>Próximos Vencimentos</h3>
            <p className="text-xs" style={TM}>Faturas pendentes e em atraso</p>
          </div>
          <Calendar size={16} style={{ color:'#94A3B8' }} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          {upcomingPayments.map(p => {
            const c = companies.find(c => c.id === p.companyId);
            const due = new Date(p.dueDate);
            const days = Math.ceil((due - TODAY_DATE) / 86400000);
            const isOverdue = p.status === 'overdue';
            return (
              <div key={p.id} className="card-inner" style={{ padding:'14px', borderLeft:`3px solid ${isOverdue ? '#E11D48' : '#D97706'}` }}>
                <p className="text-xs font-semibold mb-1" style={T}>{c?.name}</p>
                <p className="text-xs mb-2" style={TM}>{p.period}</p>
                <p className="text-base font-black" style={{ color: isOverdue ? '#E11D48' : '#D97706' }}>{fmtCurrency(payAmount(p))}</p>
                <p className="text-xs mt-1" style={TM}>
                  {isOverdue ? `Atrasado ${Math.abs(days)} dias` : days === 0 ? 'Vence hoje' : `Vence em ${days} dias`}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Tabela de Faturas ─── */}
      <div className="card overflow-hidden animate-fade-up delay-5">
        {/* Header + filtros */}
        <div className="p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{ borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
          <div>
            <h3 className="text-sm font-semibold" style={T}>Todas as Faturas</h3>
            <p className="text-xs" style={TM}>{filteredPayments.length} {filteredPayments.length === 1 ? 'fatura' : 'faturas'}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div style={{ position:'relative' }}>
              <Search size={13} style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'#94A3B8' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar empresa ou período…"
                className="input-field"
                style={{ paddingLeft:'34px', minWidth:'220px' }}
              />
            </div>
            <div className="flex gap-1 p-1 rounded-xl" style={{ background:'#F1F5F9', border:'1px solid rgba(0,0,0,0.06)' }}>
              {[['todos','Todos'],['paid','Pagos'],['pending','Pendentes'],['overdue','Atrasados']].map(([val, lbl]) => (
                <button key={val} onClick={() => setStatus(val)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: statusFilter===val ? '#FF4D0C' : 'transparent', color: statusFilter===val ? 'white' : '#64748B', border:'none', cursor:'pointer', whiteSpace:'nowrap' }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista de faturas */}
        <div>
          {/* Cabeçalho */}
          <div className="hidden md:grid" style={{
            gridTemplateColumns: '1fr 1fr 1fr 120px 120px 50px',
            padding: '10px 20px',
            fontSize: '10px',
            fontWeight: 700,
            color: '#94A3B8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            background: '#F8FAFC',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
          }}>
            <span>Empresa</span>
            <span>Período</span>
            <span>Vencimento</span>
            <span style={{ textAlign:'right' }}>Valor</span>
            <span style={{ textAlign:'center' }}>Status</span>
            <span />
          </div>

          {filteredPayments.length === 0 ? (
            <div className="py-10 text-center text-sm" style={TM}>Nenhuma fatura encontrada</div>
          ) : filteredPayments.map((p, idx) => {
            const c = companies.find(c => c.id === p.companyId);
            const sColor = p.status === 'paid' ? '#059669' : p.status === 'overdue' ? '#E11D48' : '#D97706';
            const sBg    = p.status === 'paid' ? '#DCFCE7' : p.status === 'overdue' ? '#FFE4E6' : '#FEF3C7';
            const sLabel = p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : 'Atrasado';
            return (
              <div key={p.id} className="grid items-center md:items-center transition-colors"
                style={{
                  gridTemplateColumns: '1fr 1fr 1fr 120px 120px 50px',
                  padding: '14px 20px',
                  borderBottom: idx < filteredPayments.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                {/* Empresa */}
                <div className="flex items-center gap-2.5">
                  <div style={{ width:'32px', height:'32px', borderRadius:'10px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: sBg }}>
                    <DollarSign size={14} style={{ color: sColor }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold" style={T}>{c?.name}</p>
                    <p className="text-xs" style={TM}>{c?.sector}</p>
                  </div>
                </div>
                {/* Período */}
                <div>
                  <p className="text-xs" style={T2}>{p.period}</p>
                </div>
                {/* Vencimento */}
                <div>
                  <p className="text-xs" style={T2}>{fmtDate(p.dueDate)}</p>
                  {p.paidDate && <p className="text-xs" style={{ color:'#059669' }}>Pago em {fmtDate(p.paidDate)}</p>}
                </div>
                {/* Valor */}
                <div style={{ textAlign:'right' }}>
                  <p className="text-sm font-bold" style={T}>{fmtCurrency(payAmount(p))}</p>
                </div>
                {/* Status */}
                <div style={{ textAlign:'center' }}>
                  <span className={`badge badge-${p.status}`}>{sLabel}</span>
                </div>
                {/* Action */}
                <div style={{ textAlign:'right' }}>
                  <ChevronRight size={14} style={{ color:'#CBD5E1' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
