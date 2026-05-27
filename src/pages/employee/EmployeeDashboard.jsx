import { useAuth } from '../../context/AuthContext';
import { WORK_RECORDS, COMPANIES, fmtCurrency, fmtDate, WEEKDAYS, MONTHS } from '../../data/mockData';
import { STATUS_CONFIG } from '../admin/AdminDemanda';
import { Clock, DollarSign, Calendar, CheckCircle2, AlertCircle, X, Briefcase } from 'lucide-react';

const TODAY = '2026-05-26';
const TODAY_DATE = new Date(2026, 4, 26);

function getCompany(id) { return COMPANIES.find(c => c.id === id); }

function daysUntil(targetDay) {
  const now = TODAY_DATE;
  const day = now.getDate();
  const nextDate = day < targetDay
    ? new Date(now.getFullYear(), now.getMonth(), targetDay)
    : new Date(now.getFullYear(), now.getMonth() + 1, targetDay);
  const diff = Math.ceil((nextDate - now) / 86400000);
  return { days: diff, date: `${String(nextDate.getDate()).padStart(2,'0')}/${String(nextDate.getMonth()+1).padStart(2,'0')}` };
}

function calcHours(checkIn, checkOut) {
  if (!checkOut) return null;
  const [ih, im] = checkIn.split(':').map(Number);
  const [oh, om] = checkOut.split(':').map(Number);
  const mins = (oh * 60 + om) - (ih * 60 + im);
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2,'0')}`;
}

const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const dow = DOW[new Date(`${iso}T12:00:00`).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
}

export default function EmployeeDashboard() {
  const { user, demands, updateDemandStatus } = useAuth();

  const T  = { color: '#0F172A' };
  const T2 = { color: '#475569' };
  const TM = { color: '#94A3B8' };

  const myRecords = WORK_RECORDS.filter(r => r.employeeId === user.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  const todayRecord    = myRecords.find(r => r.date === TODAY);
  const recentRecords  = myRecords.filter(r => r.date !== TODAY).slice(0, 6);
  const periodRecords  = myRecords.filter(r => r.date >= '2026-05-16' && r.status === 'completed');
  const periodEarnings = periodRecords.length * user.dailyRate;
  const estimatedTotal = periodEarnings + (todayRecord ? user.dailyRate : 0);

  const next = daysUntil(5);

  const weekday = WEEKDAYS[TODAY_DATE.getDay()];
  const month   = MONTHS[TODAY_DATE.getMonth()];

  // ── Demandas deste ajudante ─────────────────────────────────────────────
  const myDemands = demands
    .map(d => ({
      ...d,
      myEntry: d.employees.find(e => e.employeeId === user.id),
    }))
    .filter(d => d.myEntry)
    .sort((a, b) => a.date.localeCompare(b.date));

  const pendingDemands  = myDemands.filter(d => d.myEntry.status === 'aguardando');
  const upcomingDemands = myDemands.filter(d => d.myEntry.status === 'confirmado');

  return (
    <div className="space-y-4">
      {/* Greeting */}
      <div className="animate-fade-up">
        <p className="text-xs capitalize" style={TM}>{weekday}, {TODAY_DATE.getDate()} de {month} de 2026</p>
        <h1 className="text-xl font-bold mt-0.5" style={T}>Olá, {user.name.split(' ')[0]}! 👋</h1>
      </div>

      {/* ── Demandas aguardando confirmação ──────────────────────────────── */}
      {pendingDemands.length > 0 && (
        <div className="space-y-2 animate-fade-up delay-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full animate-pulse-slow" style={{ background: '#D97706' }} />
            <p className="text-xs font-bold uppercase" style={{ color: '#D97706', letterSpacing: '0.08em' }}>
              {pendingDemands.length} demanda{pendingDemands.length !== 1 ? 's' : ''} aguardando confirmação
            </p>
          </div>
          {pendingDemands.map(d => {
            const company = COMPANIES.find(c => c.id === d.companyId);
            return (
              <div key={d.id} className="card p-4"
                style={{ border: '1.5px solid rgba(217,119,6,0.3)', borderLeft: '4px solid #D97706' }}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold" style={T}>{company?.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs" style={TM}>
                        <Calendar size={10} /> {formatDate(d.date)}
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={TM}>
                        <Clock size={10} /> {d.time}
                      </span>
                    </div>
                    <span className="flex items-center gap-1 text-xs mt-1" style={TM}>
                      <Briefcase size={10} /> {d.service}
                    </span>
                  </div>
                  <span style={{ fontSize:'10px', fontWeight:700, padding:'3px 8px', borderRadius:'6px', background:'#FEF3C7', color:'#D97706' }}>
                    Aguardando
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateDemandStatus(d.id, user.id, 'confirmado')}
                    style={{
                      flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                      padding:'8px', borderRadius:'10px', border:'none', cursor:'pointer',
                      background:'#059669', color:'white', fontSize:'12px', fontWeight:700,
                    }}>
                    <CheckCircle2 size={13} /> Confirmar
                  </button>
                  <button
                    onClick={() => updateDemandStatus(d.id, user.id, 'falta')}
                    style={{
                      flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:'6px',
                      padding:'8px', borderRadius:'10px', border:'1.5px solid #E11D48', cursor:'pointer',
                      background:'transparent', color:'#E11D48', fontSize:'12px', fontWeight:700,
                    }}>
                    <X size={13} /> Recusar
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Demandas confirmadas (próximas) ──────────────────────────────── */}
      {upcomingDemands.length > 0 && (
        <div className="animate-fade-up delay-1">
          <p className="text-xs font-bold uppercase mb-2" style={{ color: '#059669', letterSpacing: '0.08em' }}>
            {upcomingDemands.length} demanda{upcomingDemands.length !== 1 ? 's' : ''} confirmada{upcomingDemands.length !== 1 ? 's' : ''}
          </p>
          <div className="card overflow-hidden">
            {upcomingDemands.map((d, idx) => {
              const company = COMPANIES.find(c => c.id === d.companyId);
              return (
                <div key={d.id} style={{
                  display:'flex', alignItems:'center', gap:'12px', padding:'11px 16px',
                  borderBottom: idx < upcomingDemands.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                }}>
                  <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:'#059669', flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:'12px', fontWeight:600, color:'#0F172A' }}>{company?.name}</p>
                    <p style={{ fontSize:'11px', color:'#94A3B8' }}>{formatDate(d.date)} · {d.time} · {d.service}</p>
                  </div>
                  <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'5px', background:'#DCFCE7', color:'#059669' }}>
                    Confirmado
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Today status */}
      <div className="animate-fade-up delay-1">
        {todayRecord ? (
          <div className="card p-5" style={{ borderLeft: '4px solid #FF4D0C' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full animate-pulse-slow" style={{ background: '#059669' }} />
                  <span className="text-xs font-semibold" style={{ color: '#059669' }}>TRABALHANDO AGORA</span>
                </div>
                <h2 className="font-bold text-base" style={T}>{getCompany(todayRecord.companyId)?.name}</h2>
                <p className="text-xs mt-0.5" style={T2}>{todayRecord.service}</p>
              </div>
              <span className="badge badge-active">Ativo</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="card-inner px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <Clock size={12} style={{ color: '#FF4D0C' }} />
                  <span className="text-xs" style={TM}>Entrada</span>
                </div>
                <p className="font-bold text-lg" style={T}>{todayRecord.checkIn}</p>
              </div>
              <div className="card-inner px-3 py-2.5">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign size={12} style={{ color: '#059669' }} />
                  <span className="text-xs" style={TM}>Diária</span>
                </div>
                <p className="font-bold text-base" style={{ color: '#059669' }}>{fmtCurrency(user.dailyRate)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="card p-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#F1F5F9' }}>
              <AlertCircle size={20} style={{ color: '#94A3B8' }} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={T}>Sem alocação hoje</p>
              <p className="text-xs mt-0.5" style={TM}>Nenhum serviço registrado para hoje</p>
            </div>
          </div>
        )}
      </div>

      {/* Next payment */}
      <div className="animate-fade-up delay-2">
        <div className="card p-5" style={{ borderLeft: '4px solid #D97706' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Calendar size={15} style={{ color: '#D97706' }} />
              <span className="text-sm font-semibold" style={{ color: '#D97706' }}>Próximo Pagamento</span>
            </div>
            <span className="badge badge-pending">{next.days} dias</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <p className="font-bold text-2xl" style={T}>{fmtCurrency(estimatedTotal)}</p>
              <p className="text-xs mt-1" style={TM}>Estimativa — período 16/05 a 31/05</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-xl" style={{ color: '#D97706' }}>05/06</p>
              <p className="text-xs" style={TM}>Data prevista</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 animate-fade-up delay-3">
        {[
          { label: 'Este período', value: periodRecords.length, unit: 'diárias', color: '#FF4D0C' },
          { label: 'Faturado',     value: fmtCurrency(periodEarnings), color: '#059669', small: true },
          { label: 'Total 2026',   value: myRecords.filter(r => r.status === 'completed').length, unit: 'dias', color: '#7C3AED' },
        ].map((s, i) => (
          <div key={i} className="stat-card text-center">
            <p className={`font-bold ${s.small ? 'text-sm' : 'text-2xl'} leading-tight`} style={{ color: s.color }}>{s.value}</p>
            {s.unit && <p className="text-xs" style={{ color: s.color + '99' }}>{s.unit}</p>}
            <p className="text-xs mt-1" style={TM}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent history */}
      <div className="animate-fade-up delay-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={T}>Serviços Recentes</h2>
          <span className="text-xs" style={TM}>{recentRecords.length} registros</span>
        </div>
        <div className="card overflow-hidden">
          {recentRecords.length === 0 ? (
            <div className="p-6 text-center text-sm" style={TM}>Nenhum serviço anterior</div>
          ) : (
            recentRecords.map(rec => {
              const company = getCompany(rec.companyId);
              const hours   = calcHours(rec.checkIn, rec.checkOut);
              return (
                <div key={rec.id} className="table-row" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                  <div className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ background: '#FFF2EE', color: '#FF4D0C', fontSize: '10px', whiteSpace: 'nowrap' }}>
                    {fmtDate(rec.date).slice(0, 5)}
                  </div>
                  <div className="px-3">
                    <p className="text-xs font-semibold" style={T}>{company?.name}</p>
                    <p className="text-xs" style={TM}>{rec.service}{hours && ` · ${hours}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold" style={{ color: '#059669' }}>{fmtCurrency(rec.value)}</p>
                    <span className="badge badge-paid" style={{ fontSize: '10px' }}><CheckCircle2 size={9} /> pago</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
