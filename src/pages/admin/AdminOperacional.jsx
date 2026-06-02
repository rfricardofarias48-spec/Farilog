import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchTodayAllRecords, fetchWorkRecordsByPeriod } from '../../lib/db';
import { fmtCurrency, fmtDate } from '../../data/mockData';
import AdminDemanda from './AdminDemanda';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Activity, Building2, Users, DollarSign, CheckCircle2,
  Clock, Send, ClipboardList, BarChart2, FileDown,
  ChevronLeft, ChevronRight, Filter, Search,
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
  const [records, setRecords] = useState([]);

  useEffect(() => { fetchTodayAllRecords(TODAY).then(setRecords); }, []);

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
    </div>
  );
}

// ── HISTÓRICO ──────────────────────────────────────────────────────────────
function Historico() {
  const { demands, companies, employees } = useAuth();
  const [viewBy,   setViewBy]   = useState('empresa');   // 'empresa' | 'ajudante'
  const [selected, setSelected] = useState('');
  const [period,   setPeriod]   = useState('quinzena');
  const [offset,   setOffset]   = useState(0);

  // Reset seleção ao trocar tipo
  const handleViewBy = (v) => { setViewBy(v); setSelected(''); };

  const { start, end, label } = getPeriodBounds(period, offset);

  const filtered = demands.filter(d => {
    if (d.date < start || d.date > end) return false;
    if (!selected) return false;
    if (viewBy === 'empresa')   return d.companyId === selected;
    if (viewBy === 'ajudante')  return d.employees.some(e => e.employeeId === selected);
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  const selectedName = viewBy === 'empresa'
    ? companies.find(c => c.id === selected)?.name
    : employees.find(e => e.id === selected)?.name;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={T}>Histórico de Demandas</h2>
        <p className="text-xs mt-0.5" style={TM}>Consulte por empresa ou ajudante</p>
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-4">

        {/* Linha 1 — Período */}
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

        {/* Linha 2 — Toggle Empresa/Ajudante */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Ver por</p>
          <div className="flex gap-2">
            {[['empresa','Empresa', Building2],['ajudante','Ajudante', Users]].map(([val, lbl, Icon]) => (
              <button key={val} onClick={() => handleViewBy(val)}
                className="flex items-center gap-2 flex-1 justify-center py-2.5 rounded-xl text-xs font-semibold border transition-all"
                style={{
                  background:   viewBy === val ? (val === 'empresa' ? '#FFF2EE' : '#F0F9FF') : '#F8FAFC',
                  borderColor:  viewBy === val ? (val === 'empresa' ? '#FF4D0C' : '#0891B2') : 'rgba(0,0,0,0.08)',
                  color:        viewBy === val ? (val === 'empresa' ? '#FF4D0C' : '#0891B2') : '#94A3B8',
                  cursor: 'pointer',
                }}>
                <Icon size={13} />
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Linha 3 — Seletor dinâmico */}
        <div>
          <p className="text-xs font-semibold mb-2" style={{ color: '#64748B' }}>
            {viewBy === 'empresa' ? 'Selecionar empresa' : 'Selecionar ajudante'}
          </p>
          {viewBy === 'empresa' ? (
            <select value={selected} onChange={e => setSelected(e.target.value)} className="input-field">
              <option value="">Escolha uma empresa...</option>
              {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          ) : (
            <select value={selected} onChange={e => setSelected(e.target.value)} className="input-field">
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
      ) : (
        <>
          <div className="flex items-center justify-between px-1">
            <p className="text-sm font-bold" style={T}>{selectedName}</p>
            <span className="text-xs font-semibold" style={TM}>{filtered.length} demanda{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="card py-10 text-center">
              <ClipboardList size={26} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
              <p className="text-sm" style={TM}>Nenhuma demanda neste período</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              {filtered.map((d, idx) => {
                const co = companies.find(c => c.id === d.companyId);
                const myEmps    = viewBy === 'ajudante'
                  ? d.employees.filter(e => e.employeeId === selected)
                  : d.employees;
                const confirmed = myEmps.filter(e => e.status === 'confirmado').length;
                const falta     = myEmps.filter(e => e.status === 'falta').length;
                const total     = myEmps.length;

                return (
                  <div key={d.id} className="px-5 py-4 flex items-start gap-4"
                    style={{ borderBottom: idx < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                    {/* Data */}
                    <div className="flex-shrink-0 text-center rounded-xl px-3 py-2" style={{ background: '#F8FAFC', minWidth: '52px' }}>
                      <p style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>
                        {d.date.split('-')[2]}
                      </p>
                      <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>
                        {DOW_SHORT[new Date(d.date + 'T12:00:00').getDay()]}
                      </p>
                    </div>

                    {/* Detalhe */}
                    <div className="flex-1 min-w-0">
                      {viewBy === 'ajudante' && (
                        <p className="text-sm font-bold truncate" style={T}>{co?.name ?? d.companyId}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Clock size={10} style={{ color: '#94A3B8' }} />
                        <p className="text-xs" style={TM}>{d.time} · {d.service}</p>
                      </div>
                      {viewBy === 'empresa' && (
                        <p className="text-xs mt-1" style={{ color: '#475569' }}>
                          {total} ajudante{total !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ background: confirmed === total ? '#DCFCE7' : '#FEF3C7', color: confirmed === total ? '#059669' : '#D97706' }}>
                        {confirmed}/{total} confirm.
                      </span>
                      {falta > 0 && (
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: '#FFE4E6', color: '#E11D48' }}>
                          {falta} falta{falta > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
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
    try {
      const img = await new Promise((res, rej) => {
        const i = new Image(); i.crossOrigin = 'anonymous';
        i.onload = () => res(i); i.onerror = rej;
        i.src = 'https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png';
      });
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
    if (logoDataUrl) doc.addImage(logoDataUrl, 'PNG', 165, (headerH - 10) / 2, 35, 10);

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
            <p className="text-base font-black" style={{ color: '#FF4D0C' }}>R$ {dailyRate}</p>
          </div>
          <div className="card flex-1 p-3 text-center">
            <p className="text-xs" style={TM}>{viewBy === 'empresa' ? 'HE 50%' : 'Hora extra'}</p>
            <p className="text-base font-black" style={{ color: '#7C3AED' }}>R$ {heRate.toFixed(2)}</p>
          </div>
          {viewBy === 'empresa' && (
            <div className="card flex-1 p-3 text-center">
              <p className="text-xs" style={TM}>HE 100%</p>
              <p className="text-base font-black" style={{ color: '#0891B2' }}>R$ {he100Rate.toFixed(2)}</p>
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
                ['Diárias', totalDiarias, '#0F172A'],
                ['Valor Diárias', fmtCurrency(totalValorDiarias), '#475569'],
                ['H. Extras', fmtHoursCount(totalHE), '#0F172A'],
                ['Valor HE', fmtCurrency(totalValorHE), '#475569'],
                ['Total', fmtCurrency(totalGeral), '#FF4D0C'],
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
                      borderLeft: hasData ? '3px solid #FF4D0C' : '3px solid transparent',
                      background: d.isWeekend
                        ? 'rgba(238,242,247,0.7)'
                        : d.date === TODAY ? '#FFFBF5' : 'transparent',
                    }}>
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
                    <span className="text-center" style={{ color: d.valorDiarias > 0 ? '#059669' : '#E2E8F0', fontWeight: d.valorDiarias > 0 ? 600 : 400 }}>
                      {d.valorDiarias > 0 ? fmtCurrency(d.valorDiarias) : '—'}
                    </span>
                    {/* H. Extra */}
                    <span className="text-center" style={{ color: d.heCount > 0 ? '#0F172A' : '#E2E8F0', fontWeight: d.heCount > 0 ? 600 : 400 }}>
                      {fmtHoursCount(d.heCount)}
                    </span>
                    {/* Val. HE */}
                    <span className="text-center" style={{ color: d.valorHE > 0 ? '#059669' : '#E2E8F0', fontWeight: d.valorHE > 0 ? 600 : 400 }}>
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
const TABS = [
  { key: 'resumo',     label: 'Resumo do Dia',  icon: Activity },
  { key: 'demanda',    label: 'Lançar Demanda',  icon: Send },
  { key: 'historico',  label: 'Histórico',        icon: ClipboardList },
  { key: 'relatorios', label: 'Relatórios',       icon: BarChart2 },
];

export default function AdminOperacional() {
  const [tab, setTab] = useState('resumo');

  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-2xl w-fit" style={{ background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.06)' }}>
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: tab === key ? 'white' : 'transparent',
              color: tab === key ? '#FF4D0C' : '#64748B',
              border: 'none', cursor: 'pointer',
              boxShadow: tab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'resumo'     && <ResumoDia />}
      {tab === 'demanda'    && <AdminDemanda />}
      {tab === 'historico'  && <Historico />}
      {tab === 'relatorios' && <Relatorios />}
    </div>
  );
}
