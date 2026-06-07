import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchTodayAllRecords, fetchWorkRecordsByPeriod, fetchPresencaEquipeHoje } from '../../lib/db';
import { fmtCurrency, fmtDate } from '../../data/mockData';
import AdminDemanda from './AdminDemanda';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Activity, Building2, Users, DollarSign, CheckCircle2,
  Clock, Send, ClipboardList, BarChart2, FileDown,
  ChevronLeft, ChevronRight, Filter, Search, X, Plus,
} from 'lucide-react';

const TODAY      = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const TODAY_DATE = new Date(TODAY + 'T12:00:00-03:00');

const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

const MONTH_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW_SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const BASE_YEAR  = 2000;

const fmtHoursCount = (n) => (!n ? '—' : `${String(n).padStart(2,'0')}:00`);

function getQuinzenaInfo() {
  const day = TODAY_DATE.getDate(), month = TODAY_DATE.getMonth(), year = TODAY_DATE.getFullYear();
  const num = day <= 15 ? 1 : 2;
  return { num, month, year };
}

function getPeriodBounds(period, offset) {
  const { num, month, year } = getQuinzenaInfo();

  if (period === 'quinzena') {
    const baseIdx = (year - BASE_YEAR) * 24 + month * 2 + (num - 1);
    const idx = baseIdx + offset;
    const tYear = BASE_YEAR + Math.floor(idx / 24);
    const rem   = ((idx % 24) + 24) % 24;
    const tMonth = Math.floor(rem / 2);
    const tNum   = (rem % 2) + 1;
    const mm = String(tMonth + 1).padStart(2, '0');
    const lastDay = new Date(tYear, tMonth + 1, 0).getDate();
    const start = tNum === 1 ? `${tYear}-${mm}-01`  : `${tYear}-${mm}-16`;
    const end   = tNum === 1 ? `${tYear}-${mm}-15`  : `${tYear}-${mm}-${String(lastDay).padStart(2,'0')}`;
    return { start, end, label: `${MONTH_FULL[tMonth]}/${tYear} — Quinzena ${tNum}`, tMonth, tYear, tNum, sday: Number(start.split('-')[2]), eday: Number(end.split('-')[2]), sm: tMonth + 1 };
  }

  let m = month + offset, y = year;
  while (m < 0) { m += 12; y--; }
  while (m >= 12) { m -= 12; y++; }
  const mm = String(m + 1).padStart(2, '0');
  const lastDay = new Date(y, m + 1, 0).getDate();
  return { start: `${y}-${mm}-01`, end: `${y}-${mm}-${String(lastDay).padStart(2,'0')}`, label: `${MONTH_FULL[m]} ${y}`, tMonth: m, tYear: y, sm: m + 1, sday: 1, eday: lastDay };
}

// ── RESUMO DO DIA ──────────────────────────────────────────────────────────
const DOW_PT = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];

function ResumoDia() {
  const { demands, companies, employees } = useAuth();
  const [records, setRecords]       = useState([]);
  const [presenca, setPresenca]     = useState([]);

  useEffect(() => {
    fetchTodayAllRecords(TODAY).then(setRecords);
    fetchPresencaEquipeHoje(TODAY).then(setPresenca);
  }, []);

  const todayDemands     = demands.filter(d => d.date === TODAY);
  const activeRecs       = records.filter(r => r.status === 'active');
  const doneRecs         = records.filter(r => r.status === 'completed');
  const scheduledRecs    = records.filter(r => r.status === 'scheduled');
  const companiesWorking = [...new Set(activeRecs.map(r => r.companyId))];
  const helpersWorking   = [...new Set(activeRecs.map(r => r.employeeId))];
  const faturamentoDia   = [...activeRecs, ...doneRecs].reduce((s, r) => s + Number(r.value ?? 150), 0);

  const [dayOfWeek] = [DOW_PT[TODAY_DATE.getDay()]];
  const [d, m, y]   = TODAY.split('-');

  const kpis = [
    { label: 'Concluídas',     value: doneRecs.length,        icon: CheckCircle2, color: '#059669', bg: '#F0FDF4', bar: '#059669' },
    { label: 'Em andamento',   value: activeRecs.length,      icon: Activity,     color: '#2563EB', bg: '#EFF6FF', bar: '#2563EB' },
    { label: 'Empresas',       value: companiesWorking.length, icon: Building2,   color: '#7C3AED', bg: '#F5F3FF', bar: '#7C3AED' },
    { label: 'Ajudantes',      value: helpersWorking.length,   icon: Users,       color: '#EA580C', bg: '#FFF7ED', bar: '#EA580C' },
  ];

  return (
    <div className="space-y-5">

      {/* Banner de data */}
      <div className="rounded-2xl p-5 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #111827 0%, #1E293B 100%)', color: 'white' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{dayOfWeek}</p>
          <p style={{ fontSize: '26px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{d}/{m}/{y}</p>
          <p style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Dados em tempo real</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>Faturamento do dia</p>
          <p style={{ fontSize: '28px', fontWeight: 900, color: '#FF4D0C', lineHeight: 1 }}>{fmtCurrency(faturamentoDia)}</p>
          <p style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>
            {doneRecs.length + activeRecs.length} diária{doneRecs.length + activeRecs.length !== 1 ? 's' : ''} no total
          </p>
        </div>
      </div>

      {/* KPIs — 2×2 */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map(({ label, value, icon: Icon, color, bg, bar }) => (
          <div key={label} className="card p-4" style={{ background: '#fff', overflow: 'hidden', position: 'relative' }}>
            {/* barra colorida esquerda */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: bar, borderRadius: '8px 0 0 8px' }} />
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold" style={{ color: '#64748B' }}>{label}</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: bg }}>
                <Icon size={14} style={{ color }} />
              </div>
            </div>
            <p style={{ fontSize: '32px', fontWeight: 900, color, lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Demandas do dia */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-2">
            <ClipboardList size={14} style={{ color: '#FF4D0C' }} />
            <p className="text-sm font-bold" style={T}>Demandas de Hoje</p>
          </div>
          <div className="flex items-center gap-2">
            {scheduledRecs.length > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                {scheduledRecs.length} aguardando
              </span>
            )}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>
              {todayDemands.length} demanda{todayDemands.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {todayDemands.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#F1F5F9' }}>
              <ClipboardList size={22} style={{ color: '#CBD5E1' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#94A3B8' }}>Nenhuma demanda hoje</p>
            <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Use Lançar Demanda para escalar ajudantes</p>
          </div>
        ) : todayDemands.map((d, idx) => {
          const co        = companies.find(c => c.id === d.companyId);
          const confirmed = d.employees.filter(e => e.status === 'confirmado').length;
          const falta     = d.employees.filter(e => e.status === 'falta').length;
          const total     = d.employees.length;
          const allOk     = confirmed === total;
          const hasFalta  = falta > 0;
          return (
            <div key={d.id} className="px-5 py-4 flex items-center gap-4"
              style={{ borderBottom: idx < todayDemands.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
              {/* Avatar empresa */}
              <div className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#FF4D0C,#E03A00)', fontSize: '11px', fontWeight: 800, color: 'white', letterSpacing: '0.01em' }}>
                {(co?.name ?? 'E').slice(0,2).toUpperCase()}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={T}>{co?.name ?? d.companyId}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Clock size={10} style={{ color: '#94A3B8' }} />
                  <p className="text-xs" style={TM}>{d.time} · {d.service}</p>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                  style={{ background: allOk ? '#DCFCE7' : '#FEF3C7', color: allOk ? '#059669' : '#D97706' }}>
                  {confirmed}/{total} confirm.
                </span>
                {hasFalta && (
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FFE4E6', color: '#E11D48' }}>
                    {falta} falta{falta > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Presença por equipe */}
      {presenca.length > 0 && (
        <div className="card overflow-hidden">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>Presença por equipe — hoje</p>
          </div>
          {presenca.map(p => (
            <div key={p.escalaId} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: p.liderCor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {p.liderIni}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{p.liderNome}</p>
                <p style={{ fontSize: '11px', color: '#64748B' }}>{p.presentes}/{p.total} presentes · {p.ausentes} falta{p.ausentes !== 1 ? 's' : ''}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '18px', fontWeight: 800, color: p.sla >= 80 ? '#059669' : p.sla >= 60 ? '#D97706' : '#E11D48', lineHeight: 1 }}>
                  {p.sla !== null ? `${p.sla}%` : '—'}
                </p>
                <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>SLA</p>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

// ── HISTÓRICO ──────────────────────────────────────────────────────────────
function Historico() {
  const { companies, employees } = useAuth();
  const [viewBy,      setViewBy]      = useState('empresa');
  const [selected,    setSelected]    = useState('');
  const [period,      setPeriod]      = useState('quinzena');
  const [offset,      setOffset]      = useState(0);
  const [histRecords, setHistRecords] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const handleViewBy = (v) => { setViewBy(v); setSelected(''); setHistRecords([]); setSelectedDay(null); };

  const { start, end, label, sday, eday, sm, tYear } = getPeriodBounds(period, offset);

  useEffect(() => {
    if (!selected) { setHistRecords([]); return; }
    setLoadingHist(true);
    const cId = viewBy === 'empresa'  ? selected : null;
    const eId = viewBy === 'ajudante' ? selected : null;
    fetchWorkRecordsByPeriod(cId, eId, start, end)
      .then(setHistRecords)
      .finally(() => setLoadingHist(false));
  }, [selected, start, end, viewBy]);

  const company  = viewBy === 'empresa'  ? companies.find(c => c.id === selected) : null;
  const employee = viewBy === 'ajudante' ? employees.find(e => e.id === selected) : null;
  const selectedName = company?.name ?? employee?.name ?? '';
  const dailyRate = viewBy === 'empresa' ? Number(company?.dailyRate ?? 150) : Number(employee?.dailyRate ?? 150);
  const heRate    = viewBy === 'empresa' ? dailyRate / 8 * 1.5 : Number(employee?.overtimeRate ?? 50);

  // Montar dias do período
  const allDays = [];
  for (let day = sday; day <= eday; day++) {
    const iso      = `${tYear}-${String(sm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dow      = new Date(`${iso}T12:00:00`).getDay();
    const recs     = histRecords.filter(r => r.date === iso);
    const presentes = recs.filter(r => r.status !== 'absent');
    const diarias   = viewBy === 'empresa' ? presentes.length : (presentes.length > 0 ? 1 : 0);
    const heCount   = presentes.filter(r => r.overtime).length;
    const total     = diarias * dailyRate + heCount * heRate;
    allDays.push({
      date: iso, dow,
      label: `${DOW_SHORT[dow]}, ${String(day).padStart(2,'0')}/${String(sm).padStart(2,'0')}`,
      isWeekend: dow === 0 || dow === 6,
      recs, presentes,
      diarias, heCount, total,
    });
  }

  const totalDias      = allDays.reduce((s, d) => s + d.diarias, 0);
  const totalHEGeral   = allDays.reduce((s, d) => s + d.heCount, 0);
  const totalCobranca  = allDays.reduce((s, d) => s + d.total, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={T}>Histórico</h2>
        <p className="text-xs mt-0.5" style={TM}>Consulte por empresa ou ajudante — clique no dia para ver os detalhes</p>
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-4">
        {/* Período */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Período</p>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.06)' }}>
              {[['quinzena','Quinzenal'],['mes','Mensal']].map(([val, lbl]) => (
                <button key={val} onClick={() => { setPeriod(val); setOffset(0); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ background: period === val ? '#FF4D0C' : 'transparent', color: period === val ? 'white' : '#64748B', border: 'none', cursor: 'pointer' }}>
                  {lbl}
                </button>
              ))}
            </div>
            <button onClick={() => setOffset(o => o - 1)} className="p-1.5 rounded-lg"
              style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}>
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-bold flex-1 text-center" style={T}>{label}</span>
            <button onClick={() => setOffset(o => Math.min(o + 1, 0))} className="p-1.5 rounded-lg"
              style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Toggle Empresa/Ajudante */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Ver por</p>
          <div className="flex gap-2">
            {[['empresa','Empresa', Building2],['ajudante','Ajudante', Users]].map(([val, lbl, Icon]) => (
              <button key={val} onClick={() => handleViewBy(val)}
                className="flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl text-xs font-semibold border transition-all"
                style={{
                  background:  viewBy === val ? (val === 'empresa' ? '#FFF2EE' : '#F0F9FF') : '#F8FAFC',
                  borderColor: viewBy === val ? (val === 'empresa' ? '#FF4D0C' : '#0891B2') : 'rgba(0,0,0,0.08)',
                  color:       viewBy === val ? (val === 'empresa' ? '#FF4D0C' : '#0891B2') : '#94A3B8',
                  cursor: 'pointer',
                }}>
                <Icon size={13} /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Seletor */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>
            {viewBy === 'empresa' ? 'Selecionar empresa' : 'Selecionar ajudante'}
          </p>
          {viewBy === 'empresa' ? (
            <select value={selected} onChange={e => { setSelected(e.target.value); setSelectedDay(null); }} className="input-field">
              <option value="">Escolha uma empresa...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <select value={selected} onChange={e => { setSelected(e.target.value); setSelectedDay(null); }} className="input-field">
              <option value="">Escolha um ajudante...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Resultados */}
      {!selected ? (
        <div className="card py-12 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#F1F5F9' }}>
            <Filter size={20} style={{ color: '#CBD5E1' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: '#94A3B8' }}>
            Selecione {viewBy === 'empresa' ? 'uma empresa' : 'um ajudante'}
          </p>
          <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>para ver o histórico do período</p>
        </div>
      ) : loadingHist ? (
        <div className="card py-10 text-center text-xs" style={TM}>Carregando...</div>
      ) : (
        <>
          {/* Totais do período */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#F8FAFC' }}>
              <p className="text-sm font-bold" style={T}>{selectedName}</p>
              <span className="text-xs font-semibold" style={TM}>{label}</span>
            </div>
            <div className="grid grid-cols-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              {[
                ['Diárias', totalDias, '#0F172A'],
                ['Horas extras', totalHEGeral > 0 ? `${totalHEGeral}x` : '—', '#0F172A'],
                ['Total cobrança', fmtCurrency(totalCobranca), '#1E40AF'],
              ].map(([lbl, val, color], i) => (
                <div key={lbl} className="py-3 text-center" style={{ borderRight: i < 2 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <p className="text-xs" style={TM}>{lbl}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Cabeçalho tabela */}
            <div className="px-5 py-2 grid text-xs font-semibold"
              style={{ gridTemplateColumns: '130px 1fr 1fr 1fr', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '8px' }}>
              <span>Data</span>
              <span className="text-center">Ajudantes</span>
              <span className="text-center">H. Extras</span>
              <span className="text-center">Total</span>
            </div>

            {/* Linhas por dia */}
            {allDays.map((d, idx) => {
              const hasData = d.diarias > 0 || d.heCount > 0;
              const isLast  = idx === allDays.length - 1;
              const isSelected = selectedDay === d.date;
              return (
                <div key={d.date}
                  onClick={() => hasData && setSelectedDay(isSelected ? null : d.date)}
                  className="px-5 py-2.5 grid text-xs"
                  style={{
                    gridTemplateColumns: '130px 1fr 1fr 1fr',
                    gap: '8px',
                    borderBottom: !isLast ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    cursor: hasData ? 'pointer' : 'default',
                    background: isSelected ? '#EFF6FF'
                      : d.isWeekend ? 'rgba(238,242,247,0.7)'
                      : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (hasData && !isSelected) e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#EFF6FF' : d.isWeekend ? 'rgba(238,242,247,0.7)' : 'transparent'; }}
                >
                  <span style={{ fontWeight: hasData ? 600 : 400, color: d.isWeekend ? '#CBD5E1' : hasData ? '#0F172A' : '#94A3B8' }}>
                    {d.label}
                  </span>
                  <span className="text-center" style={{ color: d.diarias > 0 ? '#0F172A' : '#E2E8F0', fontWeight: d.diarias > 0 ? 600 : 400 }}>
                    {d.diarias > 0 ? d.diarias : '—'}
                  </span>
                  <span className="text-center" style={{ color: d.heCount > 0 ? '#1E40AF' : '#E2E8F0', fontWeight: d.heCount > 0 ? 600 : 400 }}>
                    {d.heCount > 0 ? `${d.heCount}x` : '—'}
                  </span>
                  <span className="text-center font-bold" style={{ color: d.total > 0 ? '#0F172A' : '#E2E8F0' }}>
                    {d.total > 0 ? fmtCurrency(d.total) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal detalhe do dia */}
      {selectedDay && (() => {
        const day = allDays.find(d => d.date === selectedDay);
        return day ? (
          <DayDetailModal
            day={day}
            employees={employees}
            companies={companies}
            viewBy={viewBy}
            dailyRate={dailyRate}
            heRate={heRate}
            onClose={() => setSelectedDay(null)}
          />
        ) : null;
      })()}
    </div>
  );
}

// ── MODAL DETALHE DO DIA ──────────────────────────────────────────────────
function DayDetailModal({ day, employees, companies, viewBy, dailyRate, heRate, onClose }) {
  if (!day) return null;

  const presentes = day.presentes ?? day.recs?.filter(r => r.status !== 'absent') ?? [];
  const totalValor = day.total;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '600px',
        maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
      }}>
        {/* Cabeçalho */}
        <div style={{
          padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          background: '#1E293B', borderRadius: '20px 20px 0 0',
        }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#F1F5F9' }}>{day.label}</p>
            <p style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              {presentes.length} ajudante{presentes.length !== 1 ? 's' : ''} · {day.heCount} H.E. · Total: {fmtCurrency(totalValor)}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        {/* Resumo do dia */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'rgba(0,0,0,0.06)' }}>
          {[
            ['Ajudantes',    presentes.length,           '#0F172A'],
            ['Horas extras', day.heCount > 0 ? `${day.heCount}x` : '—', '#0F172A'],
            ['Total do dia', fmtCurrency(totalValor),    '#1E40AF'],
          ].map(([lbl, val, color]) => (
            <div key={lbl} style={{ background: '#F8FAFC', padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '4px' }}>{lbl}</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color }}>{val}</p>
            </div>
          ))}
        </div>

        {/* Lista de ajudantes */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {presentes.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
              Nenhum registro neste dia
            </div>
          ) : (
            <>
              {/* Cabeçalho da tabela */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 60px 70px 70px',
                gap: '4px', padding: '8px 20px',
                background: '#F1F5F9', borderBottom: '1px solid rgba(0,0,0,0.06)',
                fontSize: '10px', fontWeight: 700, color: '#64748B',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                <span>{viewBy === 'empresa' ? 'Ajudante' : 'Serviço'}</span>
                <span style={{ textAlign: 'center' }}>Entrada</span>
                <span style={{ textAlign: 'center' }}>S.Almoço</span>
                <span style={{ textAlign: 'center' }}>Retorno</span>
                <span style={{ textAlign: 'center' }}>Saída</span>
                <span style={{ textAlign: 'center' }}>H. Extra</span>
                <span style={{ textAlign: 'center' }}>Valor</span>
              </div>

              {presentes.map((rec, idx) => {
                const emp    = viewBy === 'empresa' ? employees.find(e => e.id === rec.employeeId) : null;
                const empRate = viewBy === 'empresa'
                  ? Number(employees.find(e => e.id === rec.employeeId)?.dailyRate ?? dailyRate)
                  : dailyRate;
                const empHE  = viewBy === 'empresa'
                  ? Number(employees.find(e => e.id === rec.employeeId)?.overtimeRate ?? heRate)
                  : heRate;
                const recVal = empRate + (rec.overtime ? empHE : 0);

                return (
                  <div key={rec.id ?? idx} style={{
                    display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 60px 70px 70px',
                    gap: '4px', padding: '11px 20px', alignItems: 'center',
                    borderBottom: idx < presentes.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    background: idx % 2 === 1 ? '#FAFAFA' : 'transparent',
                  }}>
                    {/* Nome / serviço */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      {viewBy === 'empresa' && (
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                          background: emp?.color ?? '#94A3B8',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 800, color: 'white',
                        }}>
                          {emp?.initials ?? '?'}
                        </div>
                      )}
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {viewBy === 'empresa' ? (emp?.name ?? rec.employeeId) : (rec.service ?? '—')}
                      </p>
                    </div>

                    {/* Horários */}
                    {[rec.checkIn, rec.lunchOut, rec.lunchReturn, rec.checkOut].map((t, i) => (
                      <p key={i} style={{ fontSize: '11px', fontWeight: t ? 600 : 400, color: t ? '#0F172A' : '#CBD5E1', textAlign: 'center' }}>
                        {t ?? '—'}
                      </p>
                    ))}

                    {/* H. Extra */}
                    <p style={{ fontSize: '11px', fontWeight: rec.overtime ? 700 : 400, color: rec.overtime ? '#1E40AF' : '#CBD5E1', textAlign: 'center' }}>
                      {rec.overtime ?? '—'}
                    </p>

                    {/* Valor */}
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', textAlign: 'center' }}>
                      {fmtCurrency(recVal)}
                    </p>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── RELATÓRIOS ─────────────────────────────────────────────────────────────
function Relatorios() {
  const { companies, employees } = useAuth();
  const [viewBy,   setViewBy]   = useState('empresa');   // 'empresa' | 'ajudante'
  const [selected, setSelected] = useState('');
  const [period,   setPeriod]   = useState('quinzena');
  const [offset,   setOffset]   = useState(0);
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(false);

  const handleViewBy = (v) => { setViewBy(v); setSelected(''); setRecords([]); };

  const { start, end, label, sday, eday, sm, tYear } = getPeriodBounds(period, offset);

  useEffect(() => {
    if (!selected) { setRecords([]); return; }
    setLoading(true);
    const cId = viewBy === 'empresa'  ? selected : null;
    const eId = viewBy === 'ajudante' ? selected : null;
    fetchWorkRecordsByPeriod(cId, eId, start, end)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [selected, start, end, viewBy]);

  // Taxas
  const company  = viewBy === 'empresa'  ? companies.find(c => c.id === selected) : null;
  const employee = viewBy === 'ajudante' ? employees.find(e => e.id === selected) : null;
  const subject  = company || employee;
  const subjectName = company?.name ?? employee?.name ?? '';

  const dailyRate    = viewBy === 'empresa'  ? Number(company?.dailyRate ?? 150) : Number(employee?.dailyRate ?? 150);
  const heRate       = viewBy === 'empresa'  ? dailyRate / 8 * 1.5              : Number(employee?.overtimeRate ?? 50);
  const he100Rate    = viewBy === 'empresa'  ? dailyRate / 8 * 2                : null;

  // Montar dias do período
  const allDays = [];
  for (let day = sday; day <= eday; day++) {
    const iso  = `${tYear}-${String(sm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dow  = new Date(`${iso}T12:00:00`).getDay();
    const recs = records.filter(r => r.date === iso);
    const presentes    = recs.filter(r => r.status !== 'absent');
    const diarias      = viewBy === 'empresa' ? presentes.length : (presentes.length > 0 ? 1 : 0);
    const heCount      = presentes.filter(r => r.overtime).length;
    const valorDiarias = diarias * dailyRate;
    const valorHE      = heCount * heRate;
    allDays.push({
      date: iso, dow,
      label: `${DOW_SHORT[dow]}, ${String(day).padStart(2,'0')}/${String(sm).padStart(2,'0')}`,
      isWeekend: dow === 0 || dow === 6,
      diarias, heCount, valorDiarias, valorHE,
      total: valorDiarias + valorHE,
    });
  }

  const totalDiarias      = allDays.reduce((s, d) => s + d.diarias, 0);
  const totalHE           = allDays.reduce((s, d) => s + d.heCount, 0);
  const totalValorDiarias = allDays.reduce((s, d) => s + d.valorDiarias, 0);
  const totalValorHE      = allDays.reduce((s, d) => s + d.valorHE, 0);
  const totalGeral        = totalValorDiarias + totalValorHE;
  const pdfRange = `(${String(sday).padStart(2,'0')}/${String(sm).padStart(2,'0')} a ${String(eday).padStart(2,'0')}/${String(sm).padStart(2,'0')})`;

  const exportPDF = async () => {
    if (!selected) return;
    const dark = [15,23,42], mid = [71,85,105], light = [148,163,184], headBg = [30,41,59], rowAlt = [248,250,252];
    let logoDataUrl = null;
    let logoAspect  = 4;
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image(); i.crossOrigin = 'anonymous';
        i.onload = () => res(i); i.onerror = rej;
        i.src = 'https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png';
      });
      logoAspect = img.width / img.height;
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      logoDataUrl = c.toDataURL('image/png');
    } catch (_) {}

    const doc = new jsPDF();
    const headerH = 26;
    doc.setFillColor(...headBg);
    doc.rect(0, 0, 210, headerH, 'F');
    doc.setTextColor(255,255,255); doc.setFontSize(15); doc.setFont('helvetica','bold');
    doc.text(`Relatório ${period === 'quinzena' ? 'Quinzenal' : 'Mensal'} — ${viewBy === 'empresa' ? 'Empresa' : 'Funcionário'}`, 10, headerH / 2 + 3);
    if (logoDataUrl) {
      const lH = 30;
      const lW = lH * logoAspect;
      doc.addImage(logoDataUrl, 'PNG', 210 - 10 - lW, (headerH - lH) / 2, lW, lH);
    }

    doc.setFontSize(9.5); doc.setFont('helvetica','normal'); doc.setTextColor(...mid);
    doc.text(`${viewBy === 'empresa' ? 'Empresa' : 'Funcionário'}: ${subjectName}`, 10, headerH + 9);
    doc.text(`Período: ${label}  ${pdfRange}`, 10, headerH + 15);
    if (viewBy === 'empresa') {
      doc.text(`Diária: R$ ${dailyRate}  |  HE 50%: R$ ${heRate.toFixed(2)}/h  |  HE 100%: R$ ${he100Rate.toFixed(2)}/h`, 10, headerH + 21);
    } else {
      doc.text(`Diária: R$ ${dailyRate}  |  Hora extra: R$ ${heRate.toFixed(2)}`, 10, headerH + 21);
    }
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 150, headerH + 9);

    doc.setFontSize(10.5); doc.setFont('helvetica','bold'); doc.setTextColor(...dark);
    doc.text('Resumo do Período', 10, 57);
    autoTable(doc, {
      startY: 60,
      head: [['Diárias', 'Valor Diárias', 'H. Extras', 'Valor HE', 'Total Geral']],
      body: [[String(totalDiarias), fmtCurrency(totalValorDiarias), fmtHoursCount(totalHE), fmtCurrency(totalValorHE), fmtCurrency(totalGeral)]],
      headStyles: { fillColor: headBg, textColor: 255, fontSize: 9.5, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 10, fontStyle: 'bold', halign: 'center', textColor: dark },
      margin: { left: 10, right: 10 },
    });

    const y2 = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10.5); doc.setFont('helvetica','bold'); doc.setTextColor(...dark);
    doc.text('Extrato por Dia', 10, y2);
    autoTable(doc, {
      startY: y2 + 4,
      head: [['Data', 'Diárias', 'Val. Diária', 'H. Extra', 'Val. HE', 'Total Dia']],
      body: allDays.filter(d => !d.isWeekend).map(d => [
        d.label,
        d.diarias > 0 ? String(d.diarias) : '—',
        d.valorDiarias > 0 ? fmtCurrency(d.valorDiarias) : '—',
        fmtHoursCount(d.heCount),
        d.valorHE > 0 ? fmtCurrency(d.valorHE) : '—',
        d.total > 0 ? fmtCurrency(d.total) : '—',
      ]),
      headStyles: { fillColor: [241,245,249], textColor: mid, fontSize: 9.5, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 9.5, textColor: dark, halign: 'center' },
      alternateRowStyles: { fillColor: rowAlt },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', textColor: dark }, 5: { fontStyle: 'bold', textColor: dark } },
      margin: { left: 10, right: 10 },
    });

    const y3 = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(...rowAlt); doc.setDrawColor(200,210,220);
    doc.roundedRect(14, y3, 182, 16, 2, 2, 'FD');
    doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.setTextColor(...dark);
    doc.text(`Total ${viewBy === 'empresa' ? 'da Cobrança' : 'a Receber'}: ${fmtCurrency(totalGeral)}`, 16, y3 + 10);
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(...light);
      doc.text(`FariLog © ${new Date().getFullYear()}   |   Página ${i} de ${pages}`, 105, 290, { align: 'center' });
    }
    doc.save(`relatorio-${subjectName.replace(/\s+/g,'-')}-${label.replace(/[\/\s—]+/g,'-')}.pdf`);
  };

  const navBtn = (icon, fn) => (
    <button onClick={fn} className="p-1.5 rounded-lg" style={{ background: '#EEF2F7', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}>
      {icon}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold" style={T}>Relatórios</h2>
          <p className="text-xs mt-0.5" style={TM}>Extrato quinzenal ou mensal</p>
        </div>
        <button onClick={exportPDF} disabled={!selected}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: selected ? '#FF4D0C' : '#E2E8F0', color: selected ? 'white' : '#94A3B8', border: 'none', cursor: selected ? 'pointer' : 'not-allowed', boxShadow: selected ? '0 2px 8px rgba(255,77,12,0.3)' : 'none' }}>
          <FileDown size={13} /> Exportar PDF
        </button>
      </div>

      {/* Controles */}
      <div className="card p-4 space-y-4">

        {/* Toggle Empresa / Ajudante */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Tipo de relatório</p>
          <div className="flex gap-2">
            {[['empresa','Empresa', Building2],['ajudante','Funcionário', Users]].map(([val, lbl, Icon]) => (
              <button key={val} onClick={() => handleViewBy(val)}
                className="flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl text-xs font-semibold border transition-all"
                style={{
                  background:  viewBy === val ? (val === 'empresa' ? '#FFF2EE' : '#F0F9FF') : '#F8FAFC',
                  borderColor: viewBy === val ? (val === 'empresa' ? '#FF4D0C' : '#0891B2') : 'rgba(0,0,0,0.08)',
                  color:       viewBy === val ? (val === 'empresa' ? '#FF4D0C' : '#0891B2') : '#94A3B8',
                  cursor: 'pointer',
                }}>
                <Icon size={13} /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Seletor */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>
            {viewBy === 'empresa' ? 'Selecionar empresa' : 'Selecionar funcionário'}
          </p>
          {viewBy === 'empresa' ? (
            <select value={selected} onChange={e => setSelected(e.target.value)} className="input-field">
              <option value="">Escolha uma empresa...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <select value={selected} onChange={e => setSelected(e.target.value)} className="input-field">
              <option value="">Escolha um funcionário...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
        </div>

        {/* Período */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Período</p>
          <div className="flex gap-1 p-0.5 rounded-xl w-fit mb-3" style={{ background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.06)' }}>
            {[['quinzena','Quinzenal'],['mes','Mensal']].map(([val, lbl]) => (
              <button key={val} onClick={() => { setPeriod(val); setOffset(0); }}
                className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: period === val ? '#FF4D0C' : 'transparent', color: period === val ? 'white' : '#64748B', border: 'none', cursor: 'pointer' }}>
                {lbl}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            {navBtn(<ChevronLeft size={15} />, () => setOffset(o => o - 1))}
            <div className="flex-1 text-center">
              <p className="text-sm font-bold" style={T}>{label}</p>
              <p className="text-xs" style={TM}>{String(sday).padStart(2,'0')}/{String(sm).padStart(2,'0')} — {String(eday).padStart(2,'0')}/{String(sm).padStart(2,'0')}/{tYear}</p>
            </div>
            {navBtn(<ChevronRight size={15} />, () => setOffset(o => Math.min(o + 1, 0)))}
          </div>
        </div>
      </div>

      {/* Taxas */}
      {subject && (
        <div className="flex gap-3">
          <div className="card flex-1 p-3 text-center">
            <p className="text-xs" style={TM}>Diária</p>
            <p className="text-base font-bold" style={{ color: '#0F172A' }}>R$ {dailyRate}</p>
          </div>
          <div className="card flex-1 p-3 text-center">
            <p className="text-xs" style={TM}>{viewBy === 'empresa' ? 'HE 50%' : 'Hora extra'}</p>
            <p className="text-base font-bold" style={{ color: '#1E40AF' }}>R$ {heRate.toFixed(2)}</p>
          </div>
          {viewBy === 'empresa' && (
            <div className="card flex-1 p-3 text-center">
              <p className="text-xs" style={TM}>HE 100%</p>
              <p className="text-base font-bold" style={{ color: '#1E40AF' }}>R$ {he100Rate.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabela */}
      {selected ? (
        <div className="card overflow-hidden">
          {/* Totais */}
          <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#F8FAFC' }}>
            <div className="grid grid-cols-5 gap-3 text-center">
              {[
                ['Diárias',      totalDiarias,                    '#0F172A'],
                ['Valor Diárias',fmtCurrency(totalValorDiarias),  '#1E40AF'],
                ['H. Extras',    fmtHoursCount(totalHE),          '#0F172A'],
                ['Valor HE',     fmtCurrency(totalValorHE),       '#1E40AF'],
                ['Total',        fmtCurrency(totalGeral),         '#0F172A'],
              ].map(([lbl, val, color]) => (
                <div key={lbl}>
                  <p className="text-xs font-medium" style={TM}>{lbl}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color }}>{val}</p>
                </div>
              ))}
            </div>
          </div>
          {/* Dias */}
          {loading ? (
            <div className="py-10 text-center text-xs" style={TM}>Carregando...</div>
          ) : (
            <div>
              <div className="px-5 py-2 grid text-xs font-semibold"
                style={{ gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '8px' }}>
                <span>Data</span>
                <span className="text-center">Diárias</span>
                <span className="text-center">Val. Diária</span>
                <span className="text-center">H. Extra</span>
                <span className="text-center">Val. HE</span>
                <span className="text-center">Total</span>
              </div>
              {allDays.map((d, idx) => {
                const hasData = d.diarias > 0 || d.heCount > 0;
                const isLast  = idx === allDays.length - 1;
                return (
                  <div key={d.date} className="px-5 py-2.5 grid text-xs"
                    style={{
                      gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr',
                      gap: '8px',
                      borderBottom: !isLast ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      background: d.isWeekend ? 'rgba(238,242,247,0.7)' : 'transparent',
                    }}
                  >
                    {/* Data */}
                    <span style={{
                      fontWeight: hasData ? 600 : 400,
                      color: d.isWeekend ? '#CBD5E1' : hasData ? '#0F172A' : '#94A3B8',
                    }}>
                      {d.label}
                    </span>
                    {/* Diárias */}
                    <span className="text-center" style={{ color: d.diarias > 0 ? '#0F172A' : '#E2E8F0', fontWeight: d.diarias > 0 ? 600 : 400 }}>
                      {d.diarias > 0 ? d.diarias : '—'}
                    </span>
                    {/* Val. Diária */}
                    <span className="text-center" style={{ color: d.valorDiarias > 0 ? '#1E40AF' : '#E2E8F0', fontWeight: d.valorDiarias > 0 ? 600 : 400 }}>
                      {d.valorDiarias > 0 ? fmtCurrency(d.valorDiarias) : '—'}
                    </span>
                    {/* H. Extra */}
                    <span className="text-center" style={{ color: d.heCount > 0 ? '#0F172A' : '#E2E8F0', fontWeight: d.heCount > 0 ? 600 : 400 }}>
                      {fmtHoursCount(d.heCount)}
                    </span>
                    {/* Val. HE */}
                    <span className="text-center" style={{ color: d.valorHE > 0 ? '#1E40AF' : '#E2E8F0', fontWeight: d.valorHE > 0 ? 600 : 400 }}>
                      {d.valorHE > 0 ? fmtCurrency(d.valorHE) : '—'}
                    </span>
                    {/* Total */}
                    <span className="text-center font-bold" style={{ color: d.total > 0 ? '#0F172A' : '#E2E8F0' }}>
                      {d.total > 0 ? fmtCurrency(d.total) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="card py-14 text-center">
          <BarChart2 size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={TM}>
            Selecione {viewBy === 'empresa' ? 'uma empresa' : 'um funcionário'} para ver o relatório
          </p>
        </div>
      )}
    </div>
  );
}

// ── PÁGINA PRINCIPAL ───────────────────────────────────────────────────────
export default function AdminOperacional() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'resumo';

  return (
    <div className="space-y-5">
      {tab === 'resumo'     && <ResumoDia />}
      {tab === 'demanda'    && <AdminDemanda />}
      {tab === 'historico'  && <Historico />}
      {tab === 'relatorios' && <Relatorios />}
    </div>
  );
}
