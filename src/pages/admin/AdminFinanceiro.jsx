import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchWorkRecordsByPeriod } from '../../lib/db';
import { fmtCurrency } from '../../data/mockData';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import {
  DollarSign, TrendingUp, Users, Building2, ChevronLeft, ChevronRight,
  Percent, Minus,
} from 'lucide-react';

const T  = { color: '#0F172A' };
const TM = { color: '#94A3B8' };

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// ── helpers de período ────────────────────────────────────────────────────
function getBounds(period, offset) {
  const [y, m] = TODAY.split('-').map(Number);

  if (period === 'mes') {
    let mo = m - 1 + offset, yr = y;
    while (mo < 0) { mo += 12; yr--; }
    while (mo > 11) { mo -= 12; yr++; }
    const mm = String(mo + 1).padStart(2, '0');
    const last = new Date(yr, mo + 1, 0).getDate();
    return {
      start: `${yr}-${mm}-01`,
      end:   `${yr}-${mm}-${String(last).padStart(2,'0')}`,
      label: `${MONTH_FULL[mo]} ${yr}`,
    };
  }

  if (period === 'trimestre') {
    const curQ = Math.floor((m - 1) / 3);
    let q = curQ + offset, yr = y;
    while (q < 0) { q += 4; yr--; }
    while (q > 3) { q -= 4; yr++; }
    const startM = q * 3;
    const endM   = startM + 2;
    const last   = new Date(yr, endM + 1, 0).getDate();
    return {
      start: `${yr}-${String(startM + 1).padStart(2,'0')}-01`,
      end:   `${yr}-${String(endM + 1).padStart(2,'0')}-${String(last).padStart(2,'0')}`,
      label: `T${q + 1} ${yr}`,
    };
  }

  // ano
  const yr = y + offset;
  return { start: `${yr}-01-01`, end: `${yr}-12-31`, label: `${yr}` };
}

// ── tooltip customizado ───────────────────────────────────────────────────
function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1E293B', borderRadius: '10px', padding: '10px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
      <p style={{ color: '#94A3B8', fontSize: '11px', marginBottom: '6px' }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: '#F1F5F9', fontSize: '12px', fontWeight: 600 }}>
          {p.name}: {fmtCurrency(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── card KPI neutro ───────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon }) {
  return (
    <div className="stat-card" style={{ border: '1px solid rgba(0,0,0,0.18)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#F1F5F9' }}>
          <Icon size={17} style={{ color: '#64748B' }} />
        </div>
      </div>
      <p className="text-xs mb-1" style={TM}>{label}</p>
      <p className="text-2xl font-black leading-none" style={T}>{value}</p>
      {sub && <p className="text-xs mt-1.5" style={TM}>{sub}</p>}
    </div>
  );
}

// ── barra de progresso neutra ─────────────────────────────────────────────
function ProgressBar({ pct }) {
  return (
    <div style={{ height: '4px', borderRadius: '4px', background: 'rgba(0,0,0,0.07)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: '#0F172A', borderRadius: '4px', transition: 'width 0.4s ease' }} />
    </div>
  );
}

export default function AdminFinanceiro() {
  const { employees, companies } = useAuth();
  const [period, setPeriod] = useState('mes');
  const [offset, setOffset] = useState(0);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const bounds = getBounds(period, offset);

  useEffect(() => {
    setLoading(true);
    fetchWorkRecordsByPeriod(null, null, bounds.start, bounds.end)
      .then(recs => { setRecords(recs); setLoading(false); });
  }, [bounds.start, bounds.end]);

  // ── registros válidos (excluindo ausências) ───────────────────────────
  const active = useMemo(() => records.filter(r => r.status !== 'absent'), [records]);

  // ── KPIs globais ──────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const fat  = active.reduce((s, r) => s + (r.value || 150), 0);
    const cost = active.reduce((s, r) => {
      const emp = employees.find(e => e.id === r.employeeId);
      return s + (emp?.dailyRate ?? 0);
    }, 0);
    const lucro  = fat - cost;
    const margem = fat > 0 ? (lucro / fat) * 100 : 0;
    return { fat, cost, lucro, margem, diarias: active.length };
  }, [active, employees]);

  // ── por empresa ───────────────────────────────────────────────────────
  const byCompany = useMemo(() => {
    return companies.map(c => {
      const recs = active.filter(r => r.companyId === c.id);
      const fat  = recs.reduce((s, r) => s + (r.value || 150), 0);
      const cost = recs.reduce((s, r) => {
        const emp = employees.find(e => e.id === r.employeeId);
        return s + (emp?.dailyRate ?? 0);
      }, 0);
      const lucro  = fat - cost;
      const margem = fat > 0 ? (lucro / fat) * 100 : 0;
      return { id: c.id, name: c.name, fat, cost, lucro, margem, diarias: recs.length };
    }).filter(c => c.fat > 0).sort((a, b) => b.fat - a.fat);
  }, [active, companies, employees]);

  // ── por ajudante ──────────────────────────────────────────────────────
  const byEmployee = useMemo(() => {
    return employees.map(e => {
      const recs = active.filter(r => r.employeeId === e.id);
      const fat  = recs.reduce((s, r) => s + (r.value || 150), 0);
      const cost = recs.length * (e.dailyRate ?? 0);
      const lucro  = fat - cost;
      const margem = fat > 0 ? (lucro / fat) * 100 : 0;
      return { ...e, fat, cost, lucro, margem, diarias: recs.length };
    }).filter(e => e.fat > 0).sort((a, b) => b.lucro - a.lucro).slice(0, 8);
  }, [active, employees]);

  // ── evolução mensal (só no modo ano) ──────────────────────────────────
  const monthlyChart = useMemo(() => {
    if (period !== 'ano') return [];
    return MONTH_SHORT.map((m, i) => {
      const mo   = String(i + 1).padStart(2, '0');
      const yr   = bounds.start.slice(0, 4);
      const recs = active.filter(r => r.date.startsWith(`${yr}-${mo}`));
      const fat  = recs.reduce((s, r) => s + (r.value || 150), 0);
      const cost = recs.reduce((s, r) => {
        const emp = employees.find(e => e.id === r.employeeId);
        return s + (emp?.dailyRate ?? 0);
      }, 0);
      return { month: m, fat, lucro: fat - cost };
    });
  }, [period, active, employees, bounds.start]);

  const maxFat = byCompany[0]?.fat || 1;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-xl font-bold" style={T}>Financeiro</h1>
          <p className="text-xs mt-0.5" style={TM}>Faturamento, lucro e margem por período</p>
        </div>

        {/* Seletor de período */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.08)' }}>
            {[['mes','Mês'],['trimestre','Trimestre'],['ano','Ano']].map(([val, lbl]) => (
              <button key={val} onClick={() => { setPeriod(val); setOffset(0); }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: period === val ? '#FF4D0C' : 'transparent', color: period === val ? 'white' : '#64748B', border: 'none', cursor: 'pointer' }}>
                {lbl}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => setOffset(o => o - 1)}
              className="p-1.5 rounded-lg"
              style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex' }}>
              <ChevronLeft size={15} />
            </button>
            <span className="text-sm font-semibold px-2" style={T}>{bounds.label}</span>
            <button onClick={() => setOffset(o => Math.min(o + 1, 0))}
              className="p-1.5 rounded-lg"
              style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex' }}>
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={TM}>Carregando dados...</div>
      ) : (
        <>

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-up delay-1">
            <KpiCard label="Faturamento"   value={fmtCurrency(kpis.fat)}    sub={`${kpis.diarias} diária${kpis.diarias !== 1 ? 's' : ''}`} icon={DollarSign} />
            <KpiCard label="Custo (ajud.)" value={fmtCurrency(kpis.cost)}   sub="Soma das diárias pagas"  icon={Users} />
            <KpiCard label="Lucro"         value={fmtCurrency(kpis.lucro)}  sub="Faturamento − Custo"    icon={TrendingUp} />
            <KpiCard label="Margem"        value={`${kpis.margem.toFixed(1)}%`} sub="Lucro / Faturamento" icon={Percent} />
          </div>

          {/* ── Evolução mensal (só no modo ano) ── */}
          {period === 'ano' && monthlyChart.some(m => m.fat > 0) && (
            <div className="card p-5 animate-fade-up delay-2">
              <h3 className="text-sm font-semibold mb-1" style={T}>Evolução Mensal — {bounds.label}</h3>
              <p className="text-xs mb-4" style={TM}>Faturamento e lucro mês a mês</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyChart} margin={{ top: 0, right: 0, bottom: 0, left: -10 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#94A3B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? '' : `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                  <Bar dataKey="fat"   name="Faturamento" fill="#0F172A" radius={[4,4,0,0]} barSize={14} />
                  <Bar dataKey="lucro" name="Lucro"       fill="#94A3B8" radius={[4,4,0,0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Por Empresa ── */}
          <div className="animate-fade-up delay-2">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={14} style={{ color: '#94A3B8' }} />
              <h2 className="text-sm font-bold" style={T}>Por Empresa</h2>
            </div>

            {byCompany.length === 0 ? (
              <div className="card p-10 text-center" style={TM}>Sem dados no período</div>
            ) : (
              <div className="card overflow-hidden">
                {/* Cabeçalho */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 60px', padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <span>Empresa</span>
                  <span style={{ textAlign: 'right' }}>Faturamento</span>
                  <span style={{ textAlign: 'right' }}>Custo</span>
                  <span style={{ textAlign: 'right' }}>Lucro</span>
                  <span style={{ textAlign: 'right' }}>Margem</span>
                  <span style={{ textAlign: 'right' }}>Diárias</span>
                </div>

                {byCompany.map((c, i) => (
                  <div key={c.id} style={{ borderBottom: i < byCompany.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 60px', padding: '13px 20px', alignItems: 'center', fontSize: '13px' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <div>
                        <p style={{ fontWeight: 600, color: '#0F172A' }}>{c.name}</p>
                        <div style={{ marginTop: '5px' }}>
                          <ProgressBar pct={(c.fat / maxFat) * 100} />
                        </div>
                      </div>
                      <p style={{ textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>{fmtCurrency(c.fat)}</p>
                      <p style={{ textAlign: 'right', color: '#64748B' }}>{fmtCurrency(c.cost)}</p>
                      <p style={{ textAlign: 'right', fontWeight: 700, color: c.lucro >= 0 ? '#0F172A' : '#E11D48' }}>{fmtCurrency(c.lucro)}</p>
                      <p style={{ textAlign: 'right', fontWeight: 700, color: c.margem >= 20 ? '#0F172A' : '#94A3B8' }}>{c.margem.toFixed(1)}%</p>
                      <p style={{ textAlign: 'right', color: '#94A3B8' }}>{c.diarias}</p>
                    </div>
                  </div>
                ))}

                {/* Totais */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 60px', padding: '13px 20px', background: '#F8FAFC', borderTop: '2px solid rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: 700 }}>
                  <p style={{ color: '#64748B', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</p>
                  <p style={{ textAlign: 'right', color: '#0F172A' }}>{fmtCurrency(kpis.fat)}</p>
                  <p style={{ textAlign: 'right', color: '#64748B' }}>{fmtCurrency(kpis.cost)}</p>
                  <p style={{ textAlign: 'right', color: kpis.lucro >= 0 ? '#0F172A' : '#E11D48' }}>{fmtCurrency(kpis.lucro)}</p>
                  <p style={{ textAlign: 'right', color: '#0F172A' }}>{kpis.margem.toFixed(1)}%</p>
                  <p style={{ textAlign: 'right', color: '#94A3B8' }}>{kpis.diarias}</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Ajudantes mais rentáveis ── */}
          <div className="animate-fade-up delay-3">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} style={{ color: '#94A3B8' }} />
              <h2 className="text-sm font-bold" style={T}>Ajudantes Mais Rentáveis</h2>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>— lucro gerado no período</span>
            </div>

            {byEmployee.length === 0 ? (
              <div className="card p-10 text-center" style={TM}>Sem dados no período</div>
            ) : (
              <div className="card overflow-hidden">
                {/* Cabeçalho */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 60px', padding: '10px 20px', background: '#F8FAFC', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <span>Ajudante</span>
                  <span style={{ textAlign: 'right' }}>Faturado</span>
                  <span style={{ textAlign: 'right' }}>Custo</span>
                  <span style={{ textAlign: 'right' }}>Lucro</span>
                  <span style={{ textAlign: 'right' }}>Margem</span>
                  <span style={{ textAlign: 'right' }}>Diárias</span>
                </div>

                {byEmployee.map((e, i) => {
                  const maxLucro = byEmployee[0]?.lucro || 1;
                  return (
                    <div key={e.id} style={{ borderBottom: i < byEmployee.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 80px 60px', padding: '12px 20px', alignItems: 'center' }}
                        onMouseEnter={ev => ev.currentTarget.style.background = '#F8FAFC'}
                        onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: e.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                            {e.initials}
                          </div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{e.name}</p>
                            <div style={{ marginTop: '4px' }}>
                              <ProgressBar pct={(e.lucro / maxLucro) * 100} />
                            </div>
                          </div>
                        </div>
                        <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{fmtCurrency(e.fat)}</p>
                        <p style={{ textAlign: 'right', fontSize: '13px', color: '#64748B' }}>{fmtCurrency(e.cost)}</p>
                        <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: e.lucro >= 0 ? '#0F172A' : '#E11D48' }}>{fmtCurrency(e.lucro)}</p>
                        <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: e.margem >= 20 ? '#0F172A' : '#94A3B8' }}>{e.margem.toFixed(1)}%</p>
                        <p style={{ textAlign: 'right', fontSize: '13px', color: '#94A3B8' }}>{e.diarias}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </>
      )}
    </div>
  );
}
