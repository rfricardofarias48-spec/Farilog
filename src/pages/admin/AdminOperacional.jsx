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
function ResumoDia() {
  const { demands, companies, employees } = useAuth();
  const [records, setRecords] = useState([]);

  useEffect(() => {
    fetchTodayAllRecords(TODAY).then(setRecords);
  }, []);

  const todayDemands = demands.filter(d => d.date === TODAY);
  const activeRecs   = records.filter(r => r.status === 'active');
  const doneRecs     = records.filter(r => r.status === 'completed');
  const companiesWorking = [...new Set(activeRecs.map(r => r.companyId))];
  const helpersWorking   = [...new Set(activeRecs.map(r => r.employeeId))];
  const faturamentoDia   = [...activeRecs, ...doneRecs].reduce((s, r) => s + Number(r.value ?? 150), 0);

  const stats = [
    { label: 'Diárias Concluídas', value: doneRecs.length,          icon: CheckCircle2, color: '#059669', bg: '#F0FDF4' },
    { label: 'Em Andamento',       value: activeRecs.length,         icon: Activity,     color: '#2563EB', bg: '#EFF6FF' },
    { label: 'Empresas Ativas',    value: companiesWorking.length,   icon: Building2,    color: '#7C3AED', bg: '#F5F3FF' },
    { label: 'Ajudantes Ativos',   value: helpersWorking.length,     icon: Users,        color: '#EA580C', bg: '#FFF7ED' },
    { label: 'Faturamento do Dia', value: fmtCurrency(faturamentoDia), icon: DollarSign, color: '#FF4D0C', bg: '#FFF2EE', wide: true },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold" style={T}>Resumo do Dia</h2>
        <p className="text-xs mt-0.5" style={TM}>{fmtDate(TODAY)} — dados em tempo real</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {stats.map(({ label, value, icon: Icon, color, bg, wide }) => (
          <div key={label} className={`card p-4 ${wide ? 'col-span-2' : ''}`} style={{ background: '#fff' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
                <Icon size={16} style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-medium" style={TM}>{label}</p>
                <p className="text-xl font-black mt-0.5" style={{ color }}>{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Demandas do dia */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <p className="text-sm font-bold" style={T}>Demandas de Hoje</p>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: '#F1F5F9', color: '#64748B' }}>
            {todayDemands.length} demanda{todayDemands.length !== 1 ? 's' : ''}
          </span>
        </div>
        {todayDemands.length === 0 ? (
          <div className="py-10 text-center">
            <ClipboardList size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={TM}>Nenhuma demanda lançada para hoje</p>
          </div>
        ) : todayDemands.map(d => {
          const co = companies.find(c => c.id === d.companyId);
          const confirmed = d.employees.filter(e => e.status === 'confirmado').length;
          const total     = d.employees.length;
          return (
            <div key={d.id} className="px-5 py-3 flex items-center gap-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#FF4D0C,#E03A00)', fontSize: '10px', fontWeight: 700, color: 'white' }}>
                {(co?.name ?? 'E').slice(0,2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={T}>{co?.name ?? d.companyId}</p>
                <p className="text-xs" style={TM}>{d.time} · {d.service}</p>
              </div>
              <span className="text-xs font-bold" style={{ color: confirmed === total ? '#059669' : '#D97706' }}>
                {confirmed}/{total} confirmados
              </span>
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
  const [filterCompany,  setFilterCompany]  = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [period,  setPeriod]  = useState('quinzena');
  const [offset,  setOffset]  = useState(0);
  const [search,  setSearch]  = useState('');

  const { start, end, label } = getPeriodBounds(period, offset);

  const filtered = demands.filter(d => {
    if (d.date < start || d.date > end) return false;
    if (filterCompany && d.companyId !== filterCompany) return false;
    if (filterEmployee && !d.employees.some(e => e.employeeId === filterEmployee)) return false;
    if (search) {
      const co = companies.find(c => c.id === d.companyId);
      const term = search.toLowerCase();
      if (!co?.name.toLowerCase().includes(term) && !(d.service || '').toLowerCase().includes(term)) return false;
    }
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold" style={T}>Histórico de Demandas</h2>
        <p className="text-xs mt-0.5" style={TM}>Todas as escalas lançadas</p>
      </div>

      {/* Filtros */}
      <div className="card p-4 space-y-3">
        {/* Período */}
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
          <button onClick={() => setOffset(o => o - 1)} className="p-1.5 rounded-lg" style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569' }}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-semibold flex-1 text-center" style={T}>{label}</span>
          <button onClick={() => setOffset(o => Math.min(o + 1, 0))} className="p-1.5 rounded-lg" style={{ background: '#F1F5F9', border: 'none', cursor: 'pointer', color: '#475569' }}>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Filtros de empresa/ajudante */}
        <div className="grid grid-cols-2 gap-2">
          <select value={filterCompany} onChange={e => setFilterCompany(e.target.value)} className="input-field text-xs">
            <option value="">Todas as empresas</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="input-field text-xs">
            <option value="">Todos os ajudantes</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input className="input-field pl-8 text-xs" placeholder="Buscar por empresa ou serviço..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Resultados */}
      <p className="text-xs font-semibold px-1" style={TM}>{filtered.length} demanda{filtered.length !== 1 ? 's' : ''}</p>

      {filtered.length === 0 ? (
        <div className="card py-12 text-center">
          <ClipboardList size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={TM}>Nenhuma demanda encontrada</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtered.map((d, idx) => {
            const co = companies.find(c => c.id === d.companyId);
            const confirmed = d.employees.filter(e => e.status === 'confirmado').length;
            const falta     = d.employees.filter(e => e.status === 'falta').length;
            const total     = d.employees.length;
            return (
              <div key={d.id} className="px-5 py-3 grid gap-3"
                style={{ gridTemplateColumns: '1fr auto auto auto', alignItems: 'center', borderBottom: idx < filtered.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={T}>{co?.name ?? d.companyId}</p>
                  <p className="text-xs" style={TM}>{fmtDate(d.date)} · {d.time} · {d.service}</p>
                </div>
                <span className="text-xs font-semibold whitespace-nowrap" style={{ color: '#2563EB' }}>{total} ajudante{total !== 1 ? 's' : ''}</span>
                <span className="text-xs font-semibold whitespace-nowrap" style={{ color: '#059669' }}>{confirmed} confirm.</span>
                {falta > 0 && <span className="text-xs font-semibold whitespace-nowrap" style={{ color: '#E11D48' }}>{falta} falta{falta !== 1 ? 's' : ''}</span>}
                {falta === 0 && <span />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── RELATÓRIOS ─────────────────────────────────────────────────────────────
function Relatorios() {
  const { companies } = useAuth();
  const [companyId, setCompanyId] = useState('');
  const [period,    setPeriod]    = useState('quinzena');
  const [offset,    setOffset]    = useState(0);
  const [records,   setRecords]   = useState([]);
  const [loading,   setLoading]   = useState(false);

  const { start, end, label, sday, eday, sm, tYear } = getPeriodBounds(period, offset);

  useEffect(() => {
    if (!companyId) { setRecords([]); return; }
    setLoading(true);
    fetchWorkRecordsByPeriod(companyId, start, end)
      .then(setRecords)
      .finally(() => setLoading(false));
  }, [companyId, start, end]);

  const company = companies.find(c => c.id === companyId);
  const dailyRate = Number(company?.dailyRate ?? 150);
  const he50Rate  = dailyRate / 8 * 1.5;

  const allDays = [];
  for (let day = sday; day <= eday; day++) {
    const iso  = `${tYear}-${String(sm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dow  = new Date(`${iso}T12:00:00`).getDay();
    const recs = records.filter(r => r.date === iso);
    const presentes    = recs.filter(r => r.status !== 'absent');
    const diarias      = presentes.length;
    const heCount      = presentes.filter(r => r.overtime).length;
    const valorDiarias = diarias * dailyRate;
    const valorHE      = heCount * he50Rate;
    allDays.push({
      date: iso, dow, dayNum: day,
      label: `${DOW_SHORT[dow]}, ${String(day).padStart(2,'0')}/${String(sm).padStart(2,'0')}`,
      isWeekend: dow === 0 || dow === 6,
      recs, diarias, heCount, valorDiarias, valorHE,
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
    if (!companyId) return;
    const dark   = [15, 23, 42];
    const mid    = [71, 85, 105];
    const light  = [148, 163, 184];
    const headBg = [30, 41, 59];
    const rowAlt = [248, 250, 252];

    let logoDataUrl = null;
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = 'https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png';
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      logoDataUrl = canvas.toDataURL('image/png');
    } catch (_) {}

    const doc = new jsPDF();
    const headerH = 26;

    doc.setFillColor(...headBg);
    doc.rect(0, 0, 210, headerH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text(`Relatório ${period === 'quinzena' ? 'Quinzenal' : 'Mensal'}`, 10, headerH / 2 + 3);

    if (logoDataUrl) {
      const lH = 30, lW = lH * (img?.width / img?.height || 4);
      doc.addImage(logoDataUrl, 'PNG', 210 - 10 - 40, (headerH - lH) / 2, 40, 10);
    }

    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mid);
    doc.text(`Empresa: ${company?.name}`, 10, headerH + 9);
    doc.text(`Período: ${label}  ${pdfRange}`, 10, headerH + 15);
    doc.text(`Diária: R$ ${dailyRate}  |  HE 50%: R$ ${he50Rate.toFixed(2)}/h`, 10, headerH + 21);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 150, headerH + 9);

    doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('Resumo do Período', 10, 57);

    autoTable(doc, {
      startY: 60,
      head: [['Diárias', 'Valor Diárias', 'H. Extras', 'Valor HE', 'Total Geral']],
      body: [[
        String(totalDiarias),
        fmtCurrency(totalValorDiarias),
        fmtHoursCount(totalHE),
        fmtCurrency(totalValorHE),
        fmtCurrency(totalGeral),
      ]],
      headStyles: { fillColor: headBg, textColor: 255, fontSize: 9.5, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 10, fontStyle: 'bold', halign: 'center', textColor: dark },
      margin: { left: 10, right: 10 },
    });

    const y2 = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('Extrato por Dia', 10, y2);

    autoTable(doc, {
      startY: y2 + 4,
      head: [['Data', 'Diárias', 'Val. Diária', 'H. Extra', 'Val. HE', 'Total Dia']],
      body: allDays.filter(d => !d.isWeekend).map(d => [
        d.label,
        d.diarias      > 0 ? String(d.diarias)           : '—',
        d.valorDiarias > 0 ? fmtCurrency(d.valorDiarias) : '—',
        fmtHoursCount(d.heCount),
        d.valorHE      > 0 ? fmtCurrency(d.valorHE)      : '—',
        d.total        > 0 ? fmtCurrency(d.total)        : '—',
      ]),
      headStyles: { fillColor: [241, 245, 249], textColor: mid, fontSize: 9.5, fontStyle: 'bold', halign: 'center' },
      bodyStyles: { fontSize: 9.5, textColor: dark, halign: 'center' },
      alternateRowStyles: { fillColor: rowAlt },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold', textColor: dark }, 5: { fontStyle: 'bold', textColor: dark } },
      margin: { left: 10, right: 10 },
    });

    const y3 = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(...rowAlt);
    doc.setDrawColor(200, 210, 220);
    doc.roundedRect(14, y3, 182, 16, 2, 2, 'FD');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(`Total da Cobrança: ${fmtCurrency(totalGeral)}`, 16, y3 + 10);

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(...light);
      doc.text(`FariLog © ${new Date().getFullYear()}   |   Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }
    doc.save(`relatorio-${company?.name?.replace(/\s+/g,'-')}-${label.replace(/[\/\s—]+/g,'-')}.pdf`);
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
          <p className="text-xs mt-0.5" style={TM}>Extrato por empresa e período</p>
        </div>
        <button
          onClick={exportPDF}
          disabled={!companyId}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{
            background: companyId ? '#FF4D0C' : '#E2E8F0',
            color: companyId ? 'white' : '#94A3B8',
            border: 'none', cursor: companyId ? 'pointer' : 'not-allowed',
            boxShadow: companyId ? '0 2px 8px rgba(255,77,12,0.3)' : 'none',
          }}
        >
          <FileDown size={13} /> Exportar PDF
        </button>
      </div>

      {/* Seletores */}
      <div className="card p-4 space-y-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Empresa</label>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} className="input-field">
            <option value="">Selecionar empresa...</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Período</label>
          <div className="flex gap-1 p-0.5 rounded-xl w-fit" style={{ background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.06)' }}>
            {[['quinzena','Quinzenal'],['mes','Mensal']].map(([val, lbl]) => (
              <button key={val} onClick={() => { setPeriod(val); setOffset(0); }}
                className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: period === val ? '#FF4D0C' : 'transparent', color: period === val ? 'white' : '#64748B', border: 'none', cursor: 'pointer' }}>
                {lbl}
              </button>
            ))}
          </div>
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

      {/* Diária info */}
      {company && (
        <div className="flex gap-3">
          <div className="card flex-1 p-3 text-center">
            <p className="text-xs" style={TM}>Diária</p>
            <p className="text-base font-black" style={{ color: '#FF4D0C' }}>R$ {dailyRate}</p>
          </div>
          <div className="card flex-1 p-3 text-center">
            <p className="text-xs" style={TM}>HE 50%</p>
            <p className="text-base font-black" style={{ color: '#7C3AED' }}>R$ {he50Rate.toFixed(2)}/h</p>
          </div>
          <div className="card flex-1 p-3 text-center">
            <p className="text-xs" style={TM}>HE 100%</p>
            <p className="text-base font-black" style={{ color: '#0891B2' }}>R$ {(dailyRate / 8 * 2).toFixed(2)}/h</p>
          </div>
        </div>
      )}

      {/* Resumo */}
      {companyId && (
        <div className="card overflow-hidden">
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

          {loading ? (
            <div className="py-10 text-center text-xs" style={TM}>Carregando...</div>
          ) : (
            <div>
              <div className="px-5 py-2 grid text-xs font-semibold" style={{ gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '8px' }}>
                <span>Data</span><span className="text-center">Diárias</span><span className="text-center">Val. Diária</span><span className="text-center">H. Extra</span><span className="text-center">Val. HE</span><span className="text-center">Total</span>
              </div>
              {allDays.filter(d => !d.isWeekend).map(d => (
                <div key={d.date} className="px-5 py-2.5 grid text-xs" style={{ gridTemplateColumns: '130px 1fr 1fr 1fr 1fr 1fr', borderBottom: '1px solid rgba(0,0,0,0.03)', gap: '8px', background: d.date === TODAY ? '#FFFBF5' : 'transparent' }}>
                  <span className="font-semibold" style={T}>{d.label}</span>
                  <span className="text-center" style={TM}>{d.diarias > 0 ? d.diarias : '—'}</span>
                  <span className="text-center" style={TM}>{d.valorDiarias > 0 ? fmtCurrency(d.valorDiarias) : '—'}</span>
                  <span className="text-center" style={TM}>{fmtHoursCount(d.heCount)}</span>
                  <span className="text-center" style={TM}>{d.valorHE > 0 ? fmtCurrency(d.valorHE) : '—'}</span>
                  <span className="text-center font-bold" style={{ color: d.total > 0 ? '#0F172A' : '#CBD5E1' }}>{d.total > 0 ? fmtCurrency(d.total) : '—'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!companyId && (
        <div className="card py-14 text-center">
          <BarChart2 size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={TM}>Selecione uma empresa para ver o relatório</p>
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
