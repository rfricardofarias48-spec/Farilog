import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchWorkRecordsByPeriod, fetchLancamentos } from '../../lib/db';
import { sumOvertimeMinutes, minutesToOvertimeString, recordRevenue } from '../../lib/timeUtils';
import { agruparPorFechamento } from '../../lib/fechamento';
import { fmtCurrency } from '../../data/mockData';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { TrendingUp, Users, Building2, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';

// ── Constantes ─────────────────────────────────────────────────────────────
const TODAY      = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const TODAY_DATE = new Date(TODAY + 'T12:00:00Z'); // UTC noon no dia SP — getUTC* sempre correto
// Paleta das fatias: cores distintas (sem preto/cinza) e em quantidade
// suficiente para todas as empresas — a última fatia já caía no fill preto
// padrão do SVG quando passava do fim do array.
const PIE_COLORS = [
  '#BC4A2A', '#3A4F6B', '#2F7A4F', '#96671F', '#7B5EA7',
  '#2F6F73', '#A3567E', '#4A6FA5', '#B8891F', '#8C3B4A',
];
const BASE_YEAR  = 2000;

const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

const T  = { color: '#0B0B0B' };
const TM = { color: '#9A9A9A' };

// ── Cálculo de período ──────────────────────────────────────────────────────
function getPeriodBounds(period, offset) {
  const day   = TODAY_DATE.getUTCDate();
  const month = TODAY_DATE.getUTCMonth();
  const year  = TODAY_DATE.getUTCFullYear();

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
    const end     = tNum === 1 ? `${tYear}-${mm}-15`  : `${tYear}-${mm}-${String(lastDay).padStart(2,'0')}`;
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
      end:   `${y}-${mm}-${String(lastDay).padStart(2,'0')}`,
      label: `${MONTH_FULL[m]} ${y}`,
      tYear: y, tMonth: m,
    };
  }

  // anual
  const y = year + offset;
  return { start: `${y}-01-01`, end: `${y}-12-31`, label: String(y), tYear: y, tMonth: null };
}

// ── Tooltip dos gráficos ───────────────────────────────────────────────────
// O texto não usa a cor da série: fatias escuras (preto/cinza) deixavam o
// valor invisível sobre o fundo escuro do tooltip. A cor fica só no marcador.
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#1C1C1C', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', padding: '10px 14px', minWidth: '140px' }}>
      {label && (
        <p style={{ color: '#F5F5F5', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>{label}</p>
      )}
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: i > 0 ? '4px' : 0 }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0, background: p.color ?? p.payload?.color ?? '#BC4A2A' }} />
          <span style={{ color: '#C9C9C9', fontSize: '12px' }}>{p.name}</span>
          <span style={{ color: '#FFFFFF', fontSize: '12px', fontWeight: 700, marginLeft: 'auto', paddingLeft: '12px' }}>
            {p.name === 'Ajudantes' ? p.value : fmtCurrency(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Componente principal ───────────────────────────────────────────────────
export default function AdminDashboard() {
  const { employees, companies } = useAuth();

  const [period,  setPeriod]  = useState('mes');
  const [offset,  setOffset]  = useState(0);
  const [records, setRecords] = useState([]);
  const [lancamentos, setLancamentos] = useState([]);
  const [loading, setLoading] = useState(true);

  const handlePeriod = (p) => { setPeriod(p); setOffset(0); };

  const { start, end, label, tYear, tMonth } = getPeriodBounds(period, offset);

  // ── Busca dados reais do Supabase ─────────────────────────────────────────
  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchWorkRecordsByPeriod(null, null, start, end),
      fetchLancamentos(start, end),
    ])
      .then(([recs, lancs]) => {
        setRecords(recs || []);
        setLancamentos(lancs || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [start, end]);

  useEffect(() => { loadData(); }, [loadData]);

  // Recarrega ao voltar para a aba, para o painel não ficar com dados velhos.
  useEffect(() => {
    const onFocus = () => loadData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadData]);

  // ── KPIs calculados dos dados reais ──────────────────────────────────────
  const periodRecs = records.filter(r => r.status !== 'absent'); // não-ausentes (agendado, ativo ou concluído)

  // Mapa id → empresa: faturamento usa a diária cadastrada no admin
  const companiesById = useMemo(() => Object.fromEntries((companies || []).map(c => [c.id, c])), [companies]);

  const activeToday     = records.filter(r => r.date === TODAY && r.status !== 'absent').length;
  const activeEmployees = employees.filter(e => e.status === 'active').length;
  const periodHEMin    = sumOvertimeMinutes(periodRecs);

  // Faturamento na MESMA base da aba Faturamento (Fluxo de Caixa): as diárias
  // agrupadas pelo fechamento de cada empresa + os lançamentos manuais a receber
  // do período. O total exibido é Recebido + A Receber.
  const faturamento = useMemo(() => {
    const grupos = agruparPorFechamento(
      periodRecs.map(r => ({ ...r, valor: recordRevenue(r, companiesById) })),
      companiesById
    );
    let recebido = 0;
    let aReceber = 0;
    for (const g of grupos) {
      if (g.vencimento <= TODAY) recebido += g.valor;
      else aReceber += g.valor;
    }
    for (const l of (lancamentos || [])) {
      if (l.tipo !== 'a_receber') continue;
      const valor = Number(l.valor || 0);
      if (l.status === 'recebido') recebido += valor;
      else aReceber += valor;
    }
    return { recebido, aReceber, total: recebido + aReceber };
  }, [periodRecs, companiesById, lancamentos]);

  const periodRevenue = faturamento.total;

  // ── Dados dos gráficos ────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (period !== 'ano') {
      const [sy, sm] = start.split('-').map(Number);
      const sd       = Number(start.split('-')[2]);
      const ed       = Number(end.split('-')[2]);
      const days = [];
      for (let d = sd; d <= ed; d++) {
        const iso = `${sy}-${String(sm).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dow = new Date(`${iso}T12:00:00Z`).getUTCDay();
        if (dow === 0 || dow === 6) continue;
        const recs = periodRecs.filter(r => r.date === iso);
        days.push({
          day:       `${String(d).padStart(2,'0')}/${String(sm).padStart(2,'0')}`,
          ajudantes: recs.length,
          receita:   recs.reduce((s, r) => s + recordRevenue(r, companiesById), 0),
        });
      }
      return days;
    }
    // anual — mês a mês
    return Array.from({ length: 12 }, (_, m) => {
      const mm   = String(m + 1).padStart(2, '0');
      const mEnd = new Date(tYear, m + 1, 0).getDate();
      const recs = periodRecs.filter(r =>
        r.date >= `${tYear}-${mm}-01` && r.date <= `${tYear}-${mm}-${String(mEnd).padStart(2,'0')}`
      );
        return {
          month:     MONTH_SHORT[m],
          ajudantes: recs.length,
          receita:   recs.reduce((s, r) => s + recordRevenue(r, companiesById), 0),
        };
    });
  }, [periodRecs, period, start, end, tYear, companiesById]);

  const xKey = period === 'ano' ? 'month' : 'day';

  // Receita por empresa no período: serviços (registros de ponto) + lançamentos
  // manuais a receber, atribuídos pela empresa citada na descrição. Assim a soma
  // bate com o card de Faturamento (que também inclui os lançamentos).
  const pieData = useMemo(() => {
    const porEmpresa = new Map(companies.map(c => [c.id, 0]));

    for (const r of periodRecs) {
      if (!r.companyId) continue;
      porEmpresa.set(r.companyId, (porEmpresa.get(r.companyId) || 0) + recordRevenue(r, companiesById));
    }

    const nomes = companies
      .filter(c => c.name)
      .map(c => ({ id: c.id, nome: c.name.toLowerCase() }))
      .sort((a, b) => b.nome.length - a.nome.length);
    let outros = 0;
    for (const l of (lancamentos || [])) {
      if (l.tipo !== 'a_receber') continue;
      const desc = String(l.descricao || '').toLowerCase();
      const match = nomes.find(n => desc.includes(n.nome));
      const valor = Number(l.valor || 0);
      if (match) porEmpresa.set(match.id, (porEmpresa.get(match.id) || 0) + valor);
      else outros += valor;
    }

    const arr = companies
      .map(c => ({ name: c.name.split(' ')[0], value: porEmpresa.get(c.id) || 0 }))
      .filter(d => d.value > 0);
    if (outros > 0) arr.push({ name: 'Outros', value: outros });
    return arr;
  }, [periodRecs, companies, companiesById, lancamentos]);

  return (
    <div className="space-y-4">

      {/* Header + seletor de período */}
      <div className="animate-fade-up">
        <div className="flex items-center justify-end flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#FFFFFF', border: '1px solid rgba(11, 11, 11,0.08)', boxShadow: '0 1px 2px rgba(11, 11, 11,0.05)' }}>
              {[['quinzena','Quinzenal'],['mes','Mensal'],['ano','Anual']].map(([val, lbl]) => (
                <button key={val} onClick={() => handlePeriod(val)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: period === val ? '#0B0B0B' : 'transparent', color: period === val ? 'white' : '#6B6B6B', border: 'none', cursor: 'pointer', boxShadow: 'none' }}>
                  {lbl}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setOffset(o => o - 1)}
                className="p-1.5 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid rgba(11, 11, 11,0.08)', cursor: 'pointer', color: '#4A4A4A', display: 'flex', boxShadow: '0 1px 2px rgba(11, 11, 11,0.05)' }}>
                <ChevronLeft size={14} />
              </button>
              <span className="text-xs font-bold px-2 min-w-[160px] text-center" style={T}>{label}</span>
              <button onClick={() => setOffset(o => Math.min(o + 1, 0))}
                className="p-1.5 rounded-lg" style={{ background: '#FFFFFF', border: '1px solid rgba(11, 11, 11,0.08)', cursor: 'pointer', color: '#4A4A4A', display: 'flex', boxShadow: '0 1px 2px rgba(11, 11, 11,0.05)' }}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16" style={TM}>Carregando dados...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-up delay-1">
            {[
              { label: 'Faturamento', value: fmtCurrency(periodRevenue), icon: DollarSign,
                extra: { recebido: faturamento.recebido, aReceber: faturamento.aReceber } },
              { label: 'Func. ativos', value: activeEmployees, icon: Users },
              { label: 'Empresas',     value: companies.length, icon: Building2 },
            ].map((k, i) => (
              <div key={i} className="stat-card"
                style={{
                  background: 'linear-gradient(135deg, #0B0B0B 0%, #1C1C1C 100%)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 14px 34px -18px rgba(11,11,11,0.60)',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(188,74,42,0.16)', border: '1px solid rgba(188,74,42,0.30)',
                  }}>
                    <k.icon size={16} style={{ color: '#E08A70' }} />
                  </div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#BDBDBD', letterSpacing: '0.01em' }}>{k.label}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px', marginTop: '12px' }}>
                  <p style={{
                    fontSize: i === 0 ? '32px' : '30px',
                    fontWeight: 800,
                    lineHeight: 1.05,
                    letterSpacing: '-0.02em',
                    color: '#FFFFFF',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {k.value}
                  </p>
                  {k.extra && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexShrink: 0, paddingBottom: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '6px' }}>
                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#8F8F8F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recebido</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#7CC79B' }}>{fmtCurrency(k.extra.recebido)}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: '6px' }}>
                        <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#8F8F8F', textTransform: 'uppercase', letterSpacing: '0.05em' }}>A Receber</span>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#E59A82' }}>{fmtCurrency(k.extra.aReceber)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico receita + Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-fade-up delay-2">
            <div className="card p-5 lg:col-span-2" style={{ display: 'flex', flexDirection: 'column' }}>
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
                {periodHEMin > 0 && (
                  <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: '#F5F5F5', color: '#4A4A4A' }}>
                    {minutesToOvertimeString(periodHEMin)} H.E.
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minHeight: '180px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#BC4A2A" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#BC4A2A" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey={xKey} tick={{ fill: '#9A9A9A', fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#9A9A9A', fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={v => v === 0 ? '0' : `R$${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="receita" name="Receita" stroke="#BC4A2A" strokeWidth={2.5}
                      fill="url(#revenueGrad)" dot={{ fill: '#BC4A2A', strokeWidth: 0, r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-5" style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 className="text-sm font-semibold mb-1" style={T}>Receita por Empresa</h3>
              <p className="text-xs mb-4" style={TM}>{label}</p>
              {pieData.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-2" style={{ minHeight: '160px' }}>
                  <Building2 size={28} style={{ color: '#E4E4E4' }} />
                  <p className="text-xs" style={TM}>Sem dados no período</p>
                </div>
              ) : (
                <div className="flex items-center gap-4 flex-1">
                  <div style={{ width: '150px', height: '150px', flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={42} outerRadius={64}
                          paddingAngle={3} dataKey="value" stroke="#FFFFFF" strokeWidth={2}>
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {pieData.map((d, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="text-xs" style={{ color: '#4A4A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                        </div>
                        <span className="text-xs font-semibold" style={{ color: '#0B0B0B', whiteSpace: 'nowrap' }}>{fmtCurrency(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
                <XAxis dataKey={xKey} tick={{ fill: '#9A9A9A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9A9A9A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="ajudantes" name="Ajudantes" fill="#BC4A2A" radius={[5,5,0,0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
