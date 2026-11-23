import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { fetchTodayAllRecords, fetchWorkRecordsByPeriod } from '../../lib/db';
import { fmtCurrency, fmtDate } from '../../data/mockData';
import { overtimeToMinutes, sumOvertimeMinutes, minutesToOvertimeString, recordRevenue } from '../../lib/timeUtils';
import { getFechamentoBounds } from '../../lib/fechamento';
import AdminConvocacoes from './AdminConvocacoes';
import AdminEncarregados from './AdminEncarregados';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Activity, Building2, Users, DollarSign, CheckCircle2,
  Clock, Send, ClipboardList, BarChart2, FileDown,
  ChevronLeft, ChevronRight, Filter, Search, X, Plus, TrendingUp,
  CalendarDays,
} from 'lucide-react';

const TODAY      = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const TODAY_DATE = new Date(TODAY + 'T12:00:00Z'); // UTC noon no dia SP — getUTC* sempre correto

const T  = { color: '#0B0B0B' };
const T2 = { color: '#4A4A4A' };
const TM = { color: '#9A9A9A' };

const MONTH_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DOW_SHORT  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const BASE_YEAR  = 2000;

const fmtOvertime = (min) => (!min ? '—' : minutesToOvertimeString(min));

function getQuinzenaInfo() {
  const day = TODAY_DATE.getUTCDate(), month = TODAY_DATE.getUTCMonth(), year = TODAY_DATE.getUTCFullYear();
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
  const [records, setRecords]   = useState([]);

  useEffect(() => {
    fetchTodayAllRecords(TODAY).then(setRecords);
  }, []);

  const todayDemands   = demands.filter(d => d.date === TODAY);
  const activeRecs     = records.filter(r => r.status === 'active');
  const doneRecs       = records.filter(r => r.status === 'completed');
  const allWorkedRecs  = [...activeRecs, ...doneRecs];

  const companiesWorking = [...new Set(allWorkedRecs.map(r => r.companyId))];
  const helpersWorking   = [...new Set(allWorkedRecs.map(r => r.employeeId))];

  // Faturamento do dia: diária da empresa (admin) + HE proporcional por registro
  const companiesById = Object.fromEntries((companies || []).map(c => [c.id, c]));
  const faturamentoDia = allWorkedRecs.reduce((s, r) => s + recordRevenue(r, companiesById), 0);

  // Assertividade = % de presença do dia (escalados na demanda menos faltas)
  const totalEscalados = todayDemands.reduce((s, d) => s + (d.employees?.length ?? 0), 0);
  const totalFaltas    = todayDemands.reduce((s, d) => s + (d.employees?.filter(e => e.status === 'falta').length ?? 0), 0);
  const assertividade  = totalEscalados > 0 ? Math.round(((totalEscalados - totalFaltas) / totalEscalados) * 100) : null;

  const dateLabel = `${DOW_PT[TODAY_DATE.getUTCDay()]}, ${TODAY_DATE.getUTCDate()} de ${MONTH_FULL[TODAY_DATE.getUTCMonth()]}`;

  const kpis = [
    { label: 'Empresas',      value: companiesWorking.length,                           icon: Building2,    accent: '#8FA6C4' },
    { label: 'Ajudantes',     value: helpersWorking.length,                             icon: Users,        accent: '#E08A70' },
    { label: 'Concluídas',    value: doneRecs.length,                                   icon: CheckCircle2, accent: '#7CC79B' },
    { label: 'Em andamento',  value: activeRecs.length,                                 icon: Activity,     accent: '#B9B9B9' },
    { label: 'Assertividade', value: assertividade !== null ? `${assertividade}%` : '—', icon: TrendingUp,   accent: '#D3B36A' },
  ];

  return (
    <div className="space-y-5">

      {/* Banner de data */}
      <div className="rounded-2xl p-5 flex items-center justify-between animate-fade-up"
        style={{
          background: 'linear-gradient(135deg, #0B0B0B 0%, #1C1C1C 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 14px 34px -18px rgba(11,11,11,0.60)',
        }}>
        <div className="flex items-center gap-3">
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(188,74,42,0.16)', border: '1px solid rgba(188,74,42,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CalendarDays size={20} style={{ color: '#E08A70' }} />
          </div>
          <div>
            <p style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15, color: '#FFFFFF' }}>{dateLabel}</p>
            <p style={{ fontSize: '12px', color: '#BDBDBD', marginTop: '3px' }}>Dados em tempo real</p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: '11px', color: '#BDBDBD', marginBottom: '4px' }}>Faturamento do dia</p>
          <p style={{ fontSize: '28px', fontWeight: 900, color: '#E08A70', lineHeight: 1 }}>{fmtCurrency(faturamentoDia)}</p>
        </div>
      </div>

      {/* KPIs — 5 colunas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
        {kpis.map(({ label, value, icon: Icon, accent }) => (
          <div key={label} className="card p-4" style={{
            overflow: 'hidden', position: 'relative',
            background: 'linear-gradient(135deg, #0B0B0B 0%, #1C1C1C 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 14px 34px -18px rgba(11,11,11,0.60)',
          }}>
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: accent, opacity: 0.9, borderRadius: '8px 0 0 8px' }} />
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold" style={{ color: '#BDBDBD' }}>{label}</p>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                <Icon size={14} style={{ color: accent }} />
              </div>
            </div>
            <p style={{ fontSize: '28px', fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Demandas do dia — tabela */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <div className="flex items-center gap-2">
            <ClipboardList size={14} style={{ color: '#BC4A2A' }} />
            <p className="text-sm font-bold" style={T}>Demandas de Hoje</p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F5F5F5', color: '#6B6B6B' }}>
            {todayDemands.length} demanda{todayDemands.length !== 1 ? 's' : ''}
          </span>
        </div>

        {todayDemands.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#F5F5F5' }}>
              <ClipboardList size={22} style={{ color: '#C8C8C8' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#9A9A9A' }}>Nenhuma demanda hoje</p>
            <p className="text-xs mt-1" style={{ color: '#C8C8C8' }}>Use Lançar Demanda para escalar ajudantes</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  {[['Empresa','left'],['Ajudantes','center'],['Atrasos','center'],['Faltas','center'],['Presença','center'],['Status','center']].map(([h, align]) => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: align, fontSize: '11px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {todayDemands.map((dem, idx) => {
                  const co          = companies.find(c => c.id === dem.companyId);
                  const total       = dem.employees?.length ?? 0;
                  const faltas      = dem.employees?.filter(e => e.status === 'falta').length ?? 0;
                  const atrasos     = dem.employees?.filter(e => e.status === 'atraso').length ?? 0;
                  const presentes   = total - faltas;
                  const presencaPct = total > 0 ? Math.round((presentes / total) * 100) : 0;
                  const compRecs    = records.filter(r => r.companyId === dem.companyId);
                  const hasActive   = compRecs.some(r => r.status === 'active');
                  const hasDone     = compRecs.some(r => r.status === 'completed');
                  const statusLabel = hasActive ? 'Em andamento' : hasDone ? 'Finalizado' : 'Agendado';
                  const statusColor = hasActive ? '#4A4A4A' : hasDone ? '#0B0B0B' : '#6B6B6B';
                  const statusBg    = hasActive ? '#F5F5F5'  : hasDone ? '#F5F5F5' : '#F7F7F7';

                  return (
                    <tr key={dem.id} style={{ borderBottom: idx < todayDemands.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#0B0B0B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                            {(co?.name ?? 'E').slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0B0B0B' }}>{co?.name ?? dem.companyId}</p>
                            <p style={{ fontSize: '11px', color: '#9A9A9A' }}>{dem.time} · {dem.service}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center', fontSize: '15px', fontWeight: 700, color: '#0B0B0B' }}>{total}</td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {atrasos > 0
                          ? <span style={{ fontSize: '13px', fontWeight: 700, color: '#6B6B6B' }}>{atrasos}</span>
                          : <span style={{ fontSize: '13px', color: '#C8C8C8' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        {faltas > 0
                          ? <span style={{ fontSize: '13px', fontWeight: 700, color: '#4A4A4A' }}>{faltas}</span>
                          : <span style={{ fontSize: '13px', color: '#C8C8C8' }}>—</span>}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: presencaPct >= 80 ? '#0B0B0B' : presencaPct >= 60 ? '#6B6B6B' : '#4A4A4A' }}>
                          {total > 0 ? `${presencaPct}%` : '—'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '20px', background: statusBg, color: statusColor, whiteSpace: 'nowrap' }}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}

// ── HISTÓRICO ──────────────────────────────────────────────────────────────
function Historico() {
  const { companies, employees } = useAuth();
  const [viewBy,      setViewBy]      = useState('empresa');
  const [selected,    setSelected]    = useState('');
  const [mensal,      setMensal]      = useState(false);
  const [offset,      setOffset]      = useState(0);
  const [histRecords, setHistRecords] = useState([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  const handleViewBy = (v) => { setViewBy(v); setSelected(''); setHistRecords([]); setSelectedDay(null); setOffset(0); };

  const company = viewBy === 'empresa' ? companies.find(c => c.id === selected) : null;
  const cfgFechamento = company
    ? { modo: company.closingCycle, dias: company.closingDays }
    : { modo: 'datas', dias: [15, 31] };
  const { start, end, label, sday, eday, sm, tYear } = getFechamentoBounds(cfgFechamento, mensal, offset);

  useEffect(() => {
    if (!selected) { setHistRecords([]); return; }
    setLoadingHist(true);
    const cId = viewBy === 'empresa'  ? selected : null;
    const eId = viewBy === 'ajudante' ? selected : null;
    fetchWorkRecordsByPeriod(cId, eId, start, end)
      .then(setHistRecords)
      .finally(() => setLoadingHist(false));
  }, [selected, start, end, viewBy]);

  const employee = viewBy === 'ajudante' ? employees.find(e => e.id === selected) : null;
  const selectedName = company?.name ?? employee?.name ?? '';
  const dailyRate = viewBy === 'empresa' ? Number(company?.dailyRate ?? 150) : Number(employee?.dailyRate ?? 150);
  const heRate    = viewBy === 'empresa' ? dailyRate / 8 * 1.5 : Number(employee?.overtimeRate ?? 50);

  // Montar dias do período
  const allDays = [];
  for (let day = sday; day <= eday; day++) {
    const iso      = `${tYear}-${String(sm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dow      = new Date(`${iso}T12:00:00Z`).getUTCDay();
    const recs     = histRecords.filter(r => r.date === iso);
    const presentes = recs.filter(r => r.status !== 'absent');
    const diarias   = viewBy === 'empresa' ? presentes.length : (presentes.length > 0 ? 1 : 0);
    const heMin     = sumOvertimeMinutes(presentes);
    const total     = diarias * dailyRate + (heMin / 60) * heRate;
    allDays.push({
      date: iso, dow,
      label: `${DOW_SHORT[dow]}, ${String(day).padStart(2,'0')}/${String(sm).padStart(2,'0')}`,
      isWeekend: dow === 0 || dow === 6,
      recs, presentes,
      diarias, heMin, total,
    });
  }

  const totalDias      = allDays.reduce((s, d) => s + d.diarias, 0);
  const totalHEMin     = allDays.reduce((s, d) => s + d.heMin, 0);
  const totalCobranca  = allDays.reduce((s, d) => s + d.total, 0);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs mt-0.5" style={TM}>Consulte por empresa ou ajudante — clique no dia para ver os detalhes</p>
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-4" style={{
        background: 'linear-gradient(135deg, #0B0B0B 0%, #1C1C1C 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 14px 34px -18px rgba(11,11,11,0.60)',
      }}>
        {/* Período */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#BDBDBD' }}>Período</p>
          <div className="flex items-center gap-2">
            <button onClick={() => { setMensal(v => !v); setOffset(0); }}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: mensal ? '#FFFFFF' : 'rgba(255,255,255,0.06)',
                color: mensal ? '#0B0B0B' : '#BDBDBD',
                border: `1px solid ${mensal ? '#FFFFFF' : 'rgba(255,255,255,0.14)'}`,
                cursor: 'pointer',
              }}>
              Mensal
            </button>
            <button onClick={() => setOffset(o => o - 1)} className="p-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: '#E4E4E4', display: 'flex' }}>
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-bold flex-1 text-center" style={{ color: '#FFFFFF' }}>{label}</span>
            <button onClick={() => setOffset(o => Math.min(o + 1, 0))} className="p-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: '#E4E4E4', display: 'flex' }}>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Toggle Empresa/Ajudante */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#BDBDBD' }}>Ver por</p>
          <div className="flex gap-2">
            {[['empresa','Empresa', Building2],['ajudante','Ajudante', Users]].map(([val, lbl, Icon]) => (
              <button key={val} onClick={() => handleViewBy(val)}
                className="flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl text-xs font-semibold border transition-all"
                style={{
                  background:  viewBy === val ? 'rgba(188,74,42,0.18)' : 'rgba(255,255,255,0.04)',
                  borderColor: viewBy === val ? '#E08A70' : 'rgba(255,255,255,0.12)',
                  color:       viewBy === val ? '#FFFFFF' : '#BDBDBD',
                  cursor: 'pointer',
                }}>
                <Icon size={13} /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Seletor */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#BDBDBD' }}>
            {viewBy === 'empresa' ? 'Selecionar empresa' : 'Selecionar ajudante'}
          </p>
          {viewBy === 'empresa' ? (
            <select value={selected} onChange={e => { setSelected(e.target.value); setSelectedDay(null); setOffset(0); }} className="input-field"
              style={{ background: '#1C1C1C', color: '#F5F5F5', borderColor: 'rgba(255,255,255,0.14)', colorScheme: 'dark' }}>
              <option value="">Escolha uma empresa...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <select value={selected} onChange={e => { setSelected(e.target.value); setSelectedDay(null); setOffset(0); }} className="input-field"
              style={{ background: '#1C1C1C', color: '#F5F5F5', borderColor: 'rgba(255,255,255,0.14)', colorScheme: 'dark' }}>
              <option value="">Escolha um ajudante...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* Resultados */}
      {!selected ? (
        <div className="card py-12 text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#F5F5F5' }}>
            <Filter size={20} style={{ color: '#C8C8C8' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: '#9A9A9A' }}>
            Selecione {viewBy === 'empresa' ? 'uma empresa' : 'um ajudante'}
          </p>
          <p className="text-xs mt-1" style={{ color: '#C8C8C8' }}>para ver o histórico do período</p>
        </div>
      ) : loadingHist ? (
        <div className="card py-10 text-center text-xs" style={TM}>Carregando...</div>
      ) : (
        <>
          {/* Totais do período */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#F7F7F7' }}>
              <p className="text-sm font-bold" style={T}>{selectedName}</p>
              <span className="text-xs font-semibold" style={TM}>{label}</span>
            </div>
            <div className="grid grid-cols-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              {[
                ['Diárias', totalDias, '#0B0B0B'],
                ['Horas extras', totalHEMin > 0 ? minutesToOvertimeString(totalHEMin) : '—', '#0B0B0B'],
                ['Total cobrança', fmtCurrency(totalCobranca), '#4A4A4A'],
              ].map(([lbl, val, color], i) => (
                <div key={lbl} className="py-3 text-center" style={{ borderRight: i < 2 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                  <p className="text-xs" style={TM}>{lbl}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Cabeçalho tabela */}
            <div className="px-5 py-2 grid text-xs font-semibold"
              style={{ gridTemplateColumns: '130px 1fr 1fr 1fr', color: '#9A9A9A', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '8px' }}>
              <span>Data</span>
              <span className="text-center">Ajudantes</span>
              <span className="text-center">H. Extras</span>
              <span className="text-center">Total</span>
            </div>

            {/* Linhas por dia */}
            {allDays.map((d, idx) => {
              const hasData = d.diarias > 0 || d.heMin > 0;
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
                    background: isSelected ? '#F5F5F5'
                      : d.isWeekend ? 'rgba(245, 245, 245,0.7)'
                      : 'transparent',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (hasData && !isSelected) e.currentTarget.style.background = '#F7F7F7'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#F5F5F5' : d.isWeekend ? 'rgba(245, 245, 245,0.7)' : 'transparent'; }}
                >
                  <span style={{ fontWeight: hasData ? 600 : 400, color: d.isWeekend ? '#C8C8C8' : hasData ? '#0B0B0B' : '#9A9A9A' }}>
                    {d.label}
                  </span>
                  <span className="text-center" style={{ color: d.diarias > 0 ? '#0B0B0B' : '#E4E4E4', fontWeight: d.diarias > 0 ? 600 : 400 }}>
                    {d.diarias > 0 ? d.diarias : '—'}
                  </span>
                  <span className="text-center" style={{ color: d.heMin > 0 ? '#4A4A4A' : '#E4E4E4', fontWeight: d.heMin > 0 ? 600 : 400 }}>
                    {d.heMin > 0 ? minutesToOvertimeString(d.heMin) : '—'}
                  </span>
                  <span className="text-center font-bold" style={{ color: d.total > 0 ? '#0B0B0B' : '#E4E4E4' }}>
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
  const presentes  = day.presentes ?? day.recs?.filter(r => r.status !== 'absent') ?? [];
  const totalValor = day.total;

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(11, 11, 11,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '600px',
        maxHeight: '82vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
      }}>
        {/* Cabeçalho */}
        <div style={{
          padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          background: '#F7F7F7',
        }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0B0B0B' }}>{day.label}</p>
            <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '2px' }}>
              {presentes.length} ajudante{presentes.length !== 1 ? 's' : ''} · {minutesToOvertimeString(day.heMin)} H.E. · Total: {fmtCurrency(totalValor)}
            </p>
          </div>
          <button onClick={onClose} style={{ background: '#F5F5F5', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', color: '#9A9A9A', display: 'flex' }}>
            <X size={15} />
          </button>
        </div>

        {/* KPIs do dia */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1px', background: 'rgba(0,0,0,0.06)', flexShrink: 0 }}>
          {[
            ['Ajudantes',    presentes.length,                              '#0B0B0B'],
            ['Horas extras', day.heMin > 0 ? minutesToOvertimeString(day.heMin) : '—',   '#0B0B0B'],
            ['Total do dia', fmtCurrency(totalValor),                      '#4A4A4A'],
          ].map(([lbl, val, color]) => (
            <div key={lbl} style={{ background: '#F7F7F7', padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 600, marginBottom: '4px' }}>{lbl}</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color }}>{val}</p>
            </div>
          ))}
        </div>

        {/* Conteúdo rolável */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Lista de ajudantes */}
          {presentes.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9A9A9A', fontSize: '13px' }}>
              Nenhum registro neste dia
            </div>
          ) : (
            <>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 60px 70px 70px',
                gap: '4px', padding: '8px 20px',
                background: '#F5F5F5', borderBottom: '1px solid rgba(0,0,0,0.06)',
                fontSize: '10px', fontWeight: 700, color: '#6B6B6B',
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
                const emp     = viewBy === 'empresa' ? employees.find(e => e.id === rec.employeeId) : null;
                // Valor faturado: diária da empresa (admin) + HE proporcional (diária ÷ 8 × 1,5) —
                // não usa o salário do ajudante, que é custo interno
                const recVal  = dailyRate + (overtimeToMinutes(rec.overtime) / 60) * heRate;
                return (
                  <div key={rec.id ?? idx} style={{
                    display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px 60px 70px 70px',
                    gap: '4px', padding: '11px 20px', alignItems: 'center',
                    borderBottom: idx < presentes.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                    background: idx % 2 === 1 ? '#FAFAFA' : 'transparent',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      {viewBy === 'empresa' && (
                        <div style={{
                          width: '26px', height: '26px', borderRadius: '8px', flexShrink: 0,
                          background: emp?.color ?? '#9A9A9A',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '9px', fontWeight: 800, color: 'white',
                        }}>
                          {emp?.initials ?? '?'}
                        </div>
                      )}
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#0B0B0B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {viewBy === 'empresa' ? (emp?.name ?? rec.employeeId) : (rec.service ?? '—')}
                      </p>
                    </div>
                    {[rec.checkIn, rec.lunchOut, rec.lunchReturn, rec.checkOut].map((t, i) => (
                      <p key={i} style={{ fontSize: '11px', fontWeight: t ? 600 : 400, color: t ? '#0B0B0B' : '#C8C8C8', textAlign: 'center' }}>
                        {t ?? '—'}
                      </p>
                    ))}
                    <p style={{ fontSize: '11px', fontWeight: rec.overtime ? 700 : 400, color: rec.overtime ? '#4A4A4A' : '#C8C8C8', textAlign: 'center' }}>
                      {rec.overtime ?? '—'}
                    </p>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#0B0B0B', textAlign: 'center' }}>
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
  const [mensal,   setMensal]   = useState(false);
  const [offset,   setOffset]   = useState(0);
  const [records,  setRecords]  = useState([]);
  const [loading,  setLoading]  = useState(false);

  const handleViewBy = (v) => { setViewBy(v); setSelected(''); setRecords([]); setOffset(0); };

  const company = viewBy === 'empresa' ? companies.find(c => c.id === selected) : null;
  const cfgFechamento = company
    ? { modo: company.closingCycle, dias: company.closingDays }
    : { modo: 'datas', dias: [15, 31] };
  const { start, end, label, sday, eday, sm, tYear } = getFechamentoBounds(cfgFechamento, mensal, offset);

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
    const dow  = new Date(`${iso}T12:00:00Z`).getUTCDay();
    const recs = records.filter(r => r.date === iso);
    const presentes    = recs.filter(r => r.status !== 'absent');
    const diarias      = viewBy === 'empresa' ? presentes.length : (presentes.length > 0 ? 1 : 0);
    const heMin        = sumOvertimeMinutes(presentes);
    const valorDiarias = diarias * dailyRate;
    const valorHE      = (heMin / 60) * heRate;
    allDays.push({
      date: iso, dow,
      label: `${DOW_SHORT[dow]}, ${String(day).padStart(2,'0')}/${String(sm).padStart(2,'0')}`,
      isWeekend: dow === 0 || dow === 6,
      diarias, heMin, valorDiarias, valorHE,
      total: valorDiarias + valorHE,
    });
  }

  const totalDiarias      = allDays.reduce((s, d) => s + d.diarias, 0);
  const totalHE           = allDays.reduce((s, d) => s + d.heMin, 0);
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
    doc.text(`Relatório ${mensal ? 'Mensal' : 'por período'} — ${viewBy === 'empresa' ? 'Empresa' : 'Funcionário'}`, 10, headerH / 2 + 3);
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
      body: [[String(totalDiarias), fmtCurrency(totalValorDiarias), fmtOvertime(totalHE), fmtCurrency(totalValorHE), fmtCurrency(totalGeral)]],
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
        fmtOvertime(d.heMin),
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
    <button onClick={fn} className="p-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer', color: '#E4E4E4', display: 'flex' }}>
      {icon}
    </button>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs mt-0.5" style={TM}>Extrato quinzenal ou mensal</p>
        </div>
        <button onClick={exportPDF} disabled={!selected}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: selected ? '#BC4A2A' : '#E4E4E4', color: selected ? 'white' : '#9A9A9A', border: 'none', cursor: selected ? 'pointer' : 'not-allowed', boxShadow: selected ? '0 2px 8px rgba(188,74,42,0.3)' : 'none' }}>
          <FileDown size={13} /> Exportar PDF
        </button>
      </div>

      {/* Controles */}
      <div className="card p-4 space-y-4" style={{
        background: 'linear-gradient(135deg, #0B0B0B 0%, #1C1C1C 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 14px 34px -18px rgba(11,11,11,0.60)',
      }}>

        {/* Toggle Empresa / Ajudante */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#BDBDBD' }}>Tipo de relatório</p>
          <div className="flex gap-2">
            {[['empresa','Empresa', Building2],['ajudante','Funcionário', Users]].map(([val, lbl, Icon]) => (
              <button key={val} onClick={() => handleViewBy(val)}
                className="flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl text-xs font-semibold border transition-all"
                style={{
                  background:  viewBy === val ? 'rgba(188,74,42,0.18)' : 'rgba(255,255,255,0.04)',
                  borderColor: viewBy === val ? '#E08A70' : 'rgba(255,255,255,0.12)',
                  color:       viewBy === val ? '#FFFFFF' : '#BDBDBD',
                  cursor: 'pointer',
                }}>
                <Icon size={13} /> {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Seletor */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#BDBDBD' }}>
            {viewBy === 'empresa' ? 'Selecionar empresa' : 'Selecionar funcionário'}
          </p>
          {viewBy === 'empresa' ? (
            <select value={selected} onChange={e => { setSelected(e.target.value); setOffset(0); }} className="input-field"
              style={{ background: '#1C1C1C', color: '#F5F5F5', borderColor: 'rgba(255,255,255,0.14)', colorScheme: 'dark' }}>
              <option value="">Escolha uma empresa...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <select value={selected} onChange={e => { setSelected(e.target.value); setOffset(0); }} className="input-field"
              style={{ background: '#1C1C1C', color: '#F5F5F5', borderColor: 'rgba(255,255,255,0.14)', colorScheme: 'dark' }}>
              <option value="">Escolha um funcionário...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
        </div>

        {/* Período */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#BDBDBD' }}>Período</p>
          <div className="flex gap-1 p-0.5 rounded-xl w-fit mb-3">
            <button onClick={() => { setMensal(v => !v); setOffset(0); }}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: mensal ? '#FFFFFF' : 'transparent',
                color: mensal ? '#0B0B0B' : '#BDBDBD',
                border: 'none', cursor: 'pointer',
              }}>
              Mensal
            </button>
          </div>
          <div className="flex items-center gap-3">
            {navBtn(<ChevronLeft size={15} />, () => setOffset(o => o - 1))}
            <div className="flex-1 text-center">
              <p className="text-sm font-bold" style={{ color: '#FFFFFF' }}>{label}</p>
              <p className="text-xs" style={{ color: '#BDBDBD' }}>{String(sday).padStart(2,'0')}/{String(sm).padStart(2,'0')} — {String(eday).padStart(2,'0')}/{String(sm).padStart(2,'0')}/{tYear}</p>
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
            <p className="text-base font-bold" style={{ color: '#0B0B0B' }}>R$ {dailyRate}</p>
          </div>
          <div className="card flex-1 p-3 text-center">
            <p className="text-xs" style={TM}>{viewBy === 'empresa' ? 'HE 50%' : 'Hora extra'}</p>
            <p className="text-base font-bold" style={{ color: '#4A4A4A' }}>R$ {heRate.toFixed(2)}</p>
          </div>
          {viewBy === 'empresa' && (
            <div className="card flex-1 p-3 text-center">
              <p className="text-xs" style={TM}>HE 100%</p>
              <p className="text-base font-bold" style={{ color: '#4A4A4A' }}>R$ {he100Rate.toFixed(2)}</p>
            </div>
          )}
        </div>
      )}

      {/* Tabela */}
      {selected ? (
        <div className="card overflow-hidden">
          {/* Totais */}
          <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#F7F7F7' }}>
            <div className="grid grid-cols-5 gap-3 text-center">
              {[
                ['Diárias',      totalDiarias,                    '#0B0B0B'],
                ['Valor Diárias',fmtCurrency(totalValorDiarias),  '#4A4A4A'],
                ['H. Extras',    fmtOvertime(totalHE),            '#0B0B0B'],
                ['Valor HE',     fmtCurrency(totalValorHE),       '#4A4A4A'],
                ['Total',        fmtCurrency(totalGeral),         '#0B0B0B'],
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
                style={{ gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr', color: '#9A9A9A', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '8px' }}>
                <span>Data</span>
                <span className="text-center">Diárias</span>
                <span className="text-center">Val. Diária</span>
                <span className="text-center">H. Extra</span>
                <span className="text-center">Val. HE</span>
                <span className="text-center">Total</span>
              </div>
              {allDays.map((d, idx) => {
                const hasData = d.diarias > 0 || d.heMin > 0;
                const isLast  = idx === allDays.length - 1;
                return (
                  <div key={d.date} className="px-5 py-2.5 grid text-xs"
                    style={{
                      gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr',
                      gap: '8px',
                      borderBottom: !isLast ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      background: d.isWeekend ? 'rgba(245, 245, 245,0.7)' : 'transparent',
                    }}
                  >
                    {/* Data */}
                    <span style={{
                      fontWeight: hasData ? 600 : 400,
                      color: d.isWeekend ? '#C8C8C8' : hasData ? '#0B0B0B' : '#9A9A9A',
                    }}>
                      {d.label}
                    </span>
                    {/* Diárias */}
                    <span className="text-center" style={{ color: d.diarias > 0 ? '#0B0B0B' : '#E4E4E4', fontWeight: d.diarias > 0 ? 600 : 400 }}>
                      {d.diarias > 0 ? d.diarias : '—'}
                    </span>
                    {/* Val. Diária */}
                    <span className="text-center" style={{ color: d.valorDiarias > 0 ? '#4A4A4A' : '#E4E4E4', fontWeight: d.valorDiarias > 0 ? 600 : 400 }}>
                      {d.valorDiarias > 0 ? fmtCurrency(d.valorDiarias) : '—'}
                    </span>
                    {/* H. Extra */}
                    <span className="text-center" style={{ color: d.heMin > 0 ? '#0B0B0B' : '#E4E4E4', fontWeight: d.heMin > 0 ? 600 : 400 }}>
                      {fmtOvertime(d.heMin)}
                    </span>
                    {/* Val. HE */}
                    <span className="text-center" style={{ color: d.valorHE > 0 ? '#4A4A4A' : '#E4E4E4', fontWeight: d.valorHE > 0 ? 600 : 400 }}>
                      {d.valorHE > 0 ? fmtCurrency(d.valorHE) : '—'}
                    </span>
                    {/* Total */}
                    <span className="text-center font-bold" style={{ color: d.total > 0 ? '#0B0B0B' : '#E4E4E4' }}>
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
          <BarChart2 size={28} className="mx-auto mb-2" style={{ color: '#C8C8C8' }} />
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
      {tab === 'resumo'      && <ResumoDia />}
      {(tab === 'convocacao' || tab === 'demanda') && <AdminConvocacoes key={tab} />}
      {tab === 'historico'   && <Historico />}
      {tab === 'relatorios'  && <Relatorios />}
      {tab === 'encarregados' && <AdminEncarregados />}
    </div>
  );
}
