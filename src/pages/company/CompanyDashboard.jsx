import { useOutletContext } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { STATUS_CONFIG } from '../admin/AdminDemanda';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WORK_RECORDS, EMPLOYEES, PAYMENTS, fmtCurrency, fmtDate, WEEKDAYS, MONTHS } from '../../data/mockData';
import {
  Clock, DollarSign, Users, CheckCircle2, Calendar,
  Phone, Mail, MapPin, Save, AlertTriangle, TrendingUp,
  CalendarCheck, UserCheck, UserX, X, ChevronRight, ChevronLeft, FileDown
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';

const TODAY = '2026-05-26';
const TODAY_DATE = new Date(2026, 4, 26);

const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

function getEmployee(id) { return EMPLOYEES.find(e => e.id === id); }

// Garante formato HH:MM com zeros à esquerda
const fmtTime = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':');
  return `${String(h).padStart(2,'0')}:${String(m ?? '00').padStart(2,'0')}`;
};

// Converte contagem de horas extras para formato HH:MM (ex: 3 → "03:00")
const fmtHoursCount = (n) => {
  if (!n) return '—';
  return `${String(n).padStart(2,'0')}:00`;
};

// ── Helpers: quinzena detection & chart data ───────────────────────────────
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getQuinzenaInfo() {
  const day   = TODAY_DATE.getDate();
  const month = TODAY_DATE.getMonth();   // 0-indexed
  const year  = TODAY_DATE.getFullYear();
  const mm    = String(month + 1).padStart(2, '0');
  const fullMonth = MONTH_FULL[month];   // e.g. "Maio"

  if (day <= 15) {
    return {
      num: 1,
      startDay: 1,
      endDay: 15,
      month,
      year,
      badgeLabel: `${fullMonth}/${year} - Quinzena 1`,  // e.g. "Maio/2026 - Quinzena 1"
      rangeLabel: `01/${mm} a 15/${mm}`,                 // e.g. "01/05 a 15/05"
    };
  } else {
    const lastDay = new Date(year, month + 1, 0).getDate();
    return {
      num: 2,
      startDay: 16,
      endDay: lastDay,
      month,
      year,
      badgeLabel: `${fullMonth}/${year} - Quinzena 2`,                    // e.g. "Maio/2026 - Quinzena 2"
      rangeLabel: `16/${mm} a ${String(lastDay).padStart(2,'0')}/${mm}`,  // e.g. "16/05 a 31/05"
    };
  }
}

function buildQuinzenaData(companyId) {
  const { startDay, endDay, month, year } = getQuinzenaInfo();
  const days = [];
  for (let d = startDay; d <= endDay; d++) {
    const mm   = String(month + 1).padStart(2, '0');
    const dd   = String(d).padStart(2, '0');
    const date = `${year}-${mm}-${dd}`;
    const dow  = new Date(year, month, d).getDay();
    const recs = WORK_RECORDS.filter(r => r.companyId === companyId && r.date === date);
    const isToday   = date === TODAY;
    const isWeekend = dow === 0 || dow === 6;
    days.push({
      date,
      label: `${d}/${month + 1}`,
      shortDay: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dow],
      count: recs.length,
      value: recs.length * 150,
      isToday,
      isWeekend,
    });
  }
  return days;
}

const QuinzenaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{
      background: '#1E293B',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: '10px',
      padding: '10px 14px',
      minWidth: '130px',
    }}>
      <p style={{ color: '#94A3B8', fontSize: '10px', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {d?.shortDay}, {d?.label}
      </p>
      <p style={{ color: '#F1F5F9', fontSize: '15px', fontWeight: 700, marginBottom: '2px' }}>
        {d?.count} <span style={{ fontSize: '11px', fontWeight: 500, color: '#64748B' }}>ajudante{d?.count !== 1 ? 's' : ''}</span>
      </p>
      <p style={{ color: '#FF4D0C', fontSize: '12px', fontWeight: 600 }}>
        {fmtCurrency(d?.value || 0)}
      </p>
    </div>
  );
};

// ── Modal: todos os ajudantes ──────────────────────────────────────────────
function AjudantesModal({ records, escala, faltas, atrasos, onClose }) {
  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '780px' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold" style={{ color: '#0F172A' }}>Ajudantes em Serviço</h2>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '6px', background: '#FFF2EE', color: '#CC3D00' }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FF4D0C', flexShrink: 0, display: 'inline-block' }} />
                {records.length} escalado{records.length !== 1 ? 's' : ''}
              </span>
              {faltas > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '6px', background: '#FFE4E6', color: '#BE123C' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F43F5E', flexShrink: 0, display: 'inline-block' }} />
                  {faltas} falta{faltas !== 1 ? 's' : ''}
                </span>
              )}
              {atrasos > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '6px', background: '#FEF3C7', color: '#B45309' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0, display: 'inline-block' }} />
                  {atrasos} atraso{atrasos !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#94A3B8', background: '#F1F5F9' }}>
            <X size={15} />
          </button>
        </div>

        {/* Lista */}
        <div className="card overflow-hidden">
          {records.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: '#94A3B8' }}>Nenhum ajudante alocado hoje</div>
          ) : (
            records.map(rec => {
              const emp = getEmployee(rec.employeeId);
              return (
                <div key={rec.id} className="table-row" style={{ gridTemplateColumns: 'auto 160px 1fr 1fr 1fr 1fr 1fr auto' }}>
                  <div className="avatar" style={{ background: emp?.color || '#94A3B8' }}>{emp?.initials}</div>
                  <div className="px-3">
                    <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{emp?.name}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{rec.service}</p>
                  </div>
                  {[
                    { label: 'Entrada',      value: rec.checkIn },
                    { label: 'S. Almoço',    value: rec.lunchOut },
                    { label: 'Retorno',      value: rec.lunchReturn },
                    { label: 'Saída',        value: rec.checkOut },
                    { label: 'H. Extra',     value: rec.overtime },
                  ].map(t => (
                    <div key={t.label} className="px-3 text-center">
                      <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 500, marginBottom: '2px' }}>{t.label}</p>
                      <div className="flex items-center justify-center gap-1" style={{ color: t.value ? '#0F172A' : '#CBD5E1' }}>
                        <Clock size={10} />
                        <span className="text-xs font-semibold">{fmtTime(t.value) ?? '—'}</span>
                      </div>
                    </div>
                  ))}
                  <span className={`badge ${rec.status === 'active' ? 'badge-active' : rec.status === 'absent' ? 'badge-inactive' : 'badge-paid'}`}>
                    {rec.status === 'active' ? 'Ativo' : rec.status === 'absent' ? 'Falta' : 'Concluído'}
                  </span>
                </div>
              );
            })
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}

// ── Mini-popup: dados do ajudante ─────────────────────────────────────────
function AjudantePopup({ emp, onClose }) {
  if (!emp) return null;
  return createPortal(
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: '14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          padding: '24px 28px',
          minWidth: '240px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'white' }}>
          {emp.initials}
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>{emp.name}</p>
          <p style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>{emp.cargo || '—'}</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────
const START_TIME = '07:30';

const DOW_FULL = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
function formatDemandDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const dow = DOW_FULL[new Date(`${iso}T12:00:00`).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  const dow = DOW_FULL[new Date(`${iso}T12:00:00`).getDay()];
  return `${dow}, ${d}/${m}`;
}

function EscalaCard({ title, date, accentColor, badgeLabel, badgeBg, records, isToday }) {
  const [showModal, setShowModal] = useState(false);
  const [popupEmp, setPopupEmp] = useState(null);
  const escala    = records.length;
  const faltas    = isToday ? records.filter(r => r.status === 'absent').length : 0;
  const atrasos   = isToday ? records.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length : 0;
  const presentes = escala - faltas;
  const pct       = escala > 0 ? Math.round((presentes / escala) * 100) : 0;
  const pctColor  = !isToday ? '#059669' : pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#E11D48';

  return (
    <div className="card p-5" style={{
      display: 'flex', flexDirection: 'column', gap: '14px',
      ...(isToday ? {
        borderTop: '3px solid #FF4D0C',
        boxShadow: '0 4px 24px rgba(255,77,12,0.13)',
      } : {}),
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: accentColor, textTransform: 'uppercase' }}>{title}</span>
          <p className="text-sm font-bold mt-0.5" style={T}>{date ? fmtDateShort(date) : 'Sem agendamento'}</p>
        </div>
        <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '6px', background: badgeBg, color: accentColor, whiteSpace: 'nowrap' }}>
          {badgeLabel}
        </span>
      </div>

      {/* Stats */}
      {isToday ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#EEF2F7', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Escala</p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#FF4D0C', lineHeight: 1 }}>{escala}</p>
          </div>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#EEF2F7' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#475569' }}>Faltas</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: faltas > 0 ? '#E11D48' : '#94A3B8' }}>{faltas}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(0,0,0,0.12)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#475569' }}>Atrasos</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: atrasos > 0 ? '#D97706' : '#94A3B8' }}>{atrasos}</span>
              </div>
            </div>
          </div>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#EEF2F7', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Presença</p>
            <p style={{ fontSize: '20px', fontWeight: 800, color: escala > 0 ? pctColor : '#94A3B8', lineHeight: 1 }}>{escala > 0 ? `${pct}%` : '—'}</p>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', marginTop: '2px' }}>{escala > 0 ? `${presentes}/${escala}` : '0/0'}</p>
          </div>
        </div>
      ) : (
        <div style={{ padding: '10px 16px', borderRadius: '10px', background: '#EEF2F7', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '2px' }}>Escala</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: '#FF4D0C', lineHeight: 1 }}>{escala}</p>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>ajudante{escala !== 1 ? 's' : ''} agendado{escala !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Barra de presença */}
      {isToday && escala > 0 && (
        <div style={{ height: '4px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)' }}>
          <div style={{ height: '100%', borderRadius: '4px', background: pctColor, width: `${pct}%`, transition: 'width 0.4s ease' }} />
        </div>
      )}

      {/* Lista de ajudantes */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#64748B', letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
            Ajudantes
          </p>
          {records.length > 0 && (
            <button onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: accentColor, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              Ver mais <ChevronRight size={12} />
            </button>
          )}
        </div>
        {records.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#CBD5E1', textAlign: 'center', padding: '20px 0' }}>
            {isToday ? 'Nenhum ajudante hoje' : 'Nenhuma escala agendada'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {records.map(rec => {
              const emp = getEmployee(rec.employeeId);
              const isAbsent = rec.status === 'absent';
              return (
                <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', background: '#EEF2F7' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: isAbsent ? '#D1D9E0' : (emp?.color || '#94A3B8'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: isAbsent ? '#64748B' : 'white', flexShrink: 0 }}>
                    {emp?.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      onClick={() => setPopupEmp(emp)}
                      style={{ fontSize: '12px', fontWeight: 700, color: isAbsent ? '#64748B' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'pointer', display: 'inline-block', maxWidth: '100%' }}
                    >{emp?.name}</p>
                    <p style={{ fontSize: '10px', fontWeight: 500, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.service}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                    <Clock size={10} style={{ color: '#64748B' }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: isAbsent ? '#E11D48' : (rec.checkIn ? '#0F172A' : '#64748B') }}>
                      {fmtTime(rec.checkIn) ?? '—'}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '9px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', flexShrink: 0,
                    background: isAbsent ? '#FFE4E6' : rec.status === 'active' ? '#DCFCE7' : rec.status === 'scheduled' ? '#EFF6FF' : '#F1F5F9',
                    color: isAbsent ? '#BE123C' : rec.status === 'active' ? '#059669' : rec.status === 'scheduled' ? '#2563EB' : '#64748B',
                  }}>
                    {isAbsent ? 'Falta' : rec.status === 'active' ? 'Ativo' : rec.status === 'scheduled' ? 'Agend.' : 'OK'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <AjudantesModal
          records={records}
          escala={escala}
          faltas={faltas}
          atrasos={atrasos}
          onClose={() => setShowModal(false)}
        />
      )}

      {popupEmp && (
        <AjudantePopup emp={popupEmp} onClose={() => setPopupEmp(null)} />
      )}
    </div>
  );
}

function Panel({ companyId }) {
  const weekday = WEEKDAYS[TODAY_DATE.getDay()];
  const month   = MONTHS[TODAY_DATE.getMonth()];

  const todayRecords = WORK_RECORDS.filter(r => r.companyId === companyId && r.date === TODAY);

  const futureRecords = WORK_RECORDS.filter(r => r.companyId === companyId && r.date > TODAY && r.status === 'scheduled');
  const nextDate = futureRecords.length > 0
    ? futureRecords.reduce((min, r) => r.date < min ? r.date : min, futureRecords[0].date)
    : null;
  const nextRecords = nextDate ? futureRecords.filter(r => r.date === nextDate) : [];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs capitalize" style={TM}>{weekday}, {TODAY_DATE.getDate()} de {month} de 2026</p>
        <h2 className="text-xl font-bold mt-0.5" style={T}>Resumo do Dia</h2>
      </div>

      {/* Duas caixas lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', alignItems: 'start' }}>
        <EscalaCard
          title="Escala do Dia"
          date={TODAY}
          accentColor="#FF4D0C"
          badgeLabel="Hoje"
          badgeBg="#FFF2EE"
          records={todayRecords}
          isToday={true}
        />
        <EscalaCard
          title="Próxima Escala"
          date={nextDate}
          accentColor="#2563EB"
          badgeLabel={nextDate ? fmtDateShort(nextDate) : 'Sem agend.'}
          badgeBg="#EFF6FF"
          records={nextRecords}
          isToday={false}
        />
      </div>
    </div>
  );
}

// ── Modal: detalhe de um dia ───────────────────────────────────────────────
function DiaModal({ date, records, onClose }) {
  const escala    = records.length;
  const faltas    = records.filter(r => r.status === 'absent').length;
  const atrasos   = records.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length;
  const presentes = escala - faltas;
  const pct       = escala > 0 ? Math.round((presentes / escala) * 100) : 0;
  const pctColor  = pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#E11D48';

  const [y, m, d] = date.split('-');
  const dow = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(`${date}T12:00:00`).getDay()];
  const isToday = date === TODAY;

  const pill = (bg, dot, color, text) => (
    <span style={{ display:'inline-flex', alignItems:'center', gap:'5px', fontSize:'11px', fontWeight:600, padding:'3px 9px', borderRadius:'6px', background:bg, color }}>
      <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:dot, flexShrink:0, display:'inline-block' }} />{text}
    </span>
  );

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '780px' }}>
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color:'#94A3B8', letterSpacing:'0.08em', marginBottom:'4px' }}>Detalhe do dia</p>
            <h2 className="text-base font-bold" style={{ color:'#0F172A' }}>
              {dow}, {d}/{m}/{y} {isToday && <span className="badge badge-active" style={{ fontSize:'10px', verticalAlign:'middle', marginLeft:'6px' }}>Hoje</span>}
            </h2>
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {pill('#FFF2EE','#FF4D0C','#CC3D00', `${escala} escalado${escala !== 1 ? 's' : ''}`)}
              {faltas  > 0 && pill('#FFE4E6','#F43F5E','#BE123C', `${faltas} falta${faltas !== 1 ? 's' : ''}`)}
              {atrasos > 0 && pill('#FEF3C7','#F59E0B','#B45309', `${atrasos} atraso${atrasos !== 1 ? 's' : ''}`)}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color:'#94A3B8', background:'#F1F5F9' }}>
            <X size={15} />
          </button>
        </div>

        {/* Barra de presença */}
        <div className="flex items-center gap-3 mb-4 p-3 rounded-xl" style={{ background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.05)' }}>
          <div style={{ flex:1 }}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold" style={{ color:'#475569' }}>Presença</span>
              <span className="text-sm font-black" style={{ color: pctColor }}>{pct}%</span>
            </div>
            <div style={{ height:'5px', borderRadius:'4px', background:'rgba(0,0,0,0.07)' }}>
              <div style={{ height:'100%', borderRadius:'4px', background: pctColor, width:`${pct}%`, transition:'width 0.4s ease' }} />
            </div>
          </div>
          <span className="text-xs font-medium" style={{ color:'#94A3B8', flexShrink:0 }}>{presentes}/{escala}</span>
        </div>

        {/* Lista */}
        <div className="card overflow-hidden">
          {records.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color:'#94A3B8' }}>Nenhum registro neste dia</div>
          ) : records.map(rec => {
            const emp = getEmployee(rec.employeeId);
            return (
              <div key={rec.id} className="table-row" style={{ gridTemplateColumns:'auto 160px 1fr 1fr 1fr 1fr 1fr auto' }}>
                <div className="avatar" style={{ background: emp?.color || '#94A3B8' }}>{emp?.initials}</div>
                <div className="px-3">
                  <p className="text-xs font-semibold" style={T}>{emp?.name}</p>
                  <p className="text-xs" style={TM}>{rec.service}</p>
                </div>
                {[
                  { label: 'Entrada',   value: rec.checkIn },
                  { label: 'S. Almoço', value: rec.lunchOut },
                  { label: 'Retorno',   value: rec.lunchReturn },
                  { label: 'Saída',     value: rec.checkOut },
                  { label: 'H. Extra',  value: rec.overtime },
                ].map(t => (
                  <div key={t.label} className="px-3 text-center">
                    <p style={{ fontSize:'9px', color:'#94A3B8', fontWeight:500, marginBottom:'2px' }}>{t.label}</p>
                    <div className="flex items-center justify-center gap-1" style={{ color: t.value ? '#0F172A' : '#CBD5E1' }}>
                      <Clock size={10} />
                      <span className="text-xs font-semibold">{fmtTime(t.value) ?? '—'}</span>
                    </div>
                  </div>
                ))}
                <span className={`badge ${rec.status === 'active' ? 'badge-active' : rec.status === 'absent' ? 'badge-inactive' : 'badge-paid'}`}>
                  {rec.status === 'active' ? 'Ativo' : rec.status === 'absent' ? 'Falta' : 'Concluído'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── CalendarPicker ─────────────────────────────────────────────────────────
function CalendarPicker({ period, offset, onSelect, onClose }) {
  const { num, month: curMonth, year: curYear } = getQuinzenaInfo();

  const popStyle = {
    position:'absolute', top:'calc(100% + 8px)', left:'50%', transform:'translateX(-50%)',
    zIndex:200, background:'#FFFFFF', borderRadius:'16px',
    boxShadow:'0 12px 40px rgba(0,0,0,0.15)', border:'1px solid rgba(0,0,0,0.07)',
    minWidth:'240px', overflow:'hidden',
  };

  // ── QUINZENA: lista de quinzenas agrupada por ano ─────────────────────────
  if (period === 'quinzena') {
    const curIdx = (curYear - BASE_YEAR) * 24 + curMonth * 2 + (num - 1);
    const items  = Array.from({ length: 16 }, (_, i) => {
      const idx    = curIdx - i;
      const tYear  = BASE_YEAR + Math.floor(idx / 24);
      const rem    = ((idx % 24) + 24) % 24;
      const tMonth = Math.floor(rem / 2);
      const tNum   = (rem % 2) + 1;
      return { offsetVal: -i, month: MONTH_FULL[tMonth], num: tNum, year: tYear, isCur: i === 0 };
    });

    let lastYear = null;
    return (
      <div style={popStyle}>
        <div style={{ padding:'12px 14px 8px', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.08em' }}>Selecionar quinzena</p>
        </div>
        <div style={{ maxHeight:'300px', overflowY:'auto' }}>
          {items.map(({ offsetVal, month, num: n, year: y, isCur }) => {
            const active    = offsetVal === offset;
            const showYear  = y !== lastYear;
            lastYear = y;
            return (
              <div key={offsetVal}>
                {showYear && (
                  <div style={{ padding:'8px 14px 4px', background:'#F8FAFC', borderTop: lastYear !== y ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                    <p style={{ fontSize:'11px', fontWeight:700, color:'#64748B', letterSpacing:'0.05em' }}>{y}</p>
                  </div>
                )}
                <button onClick={() => { onSelect(offsetVal); onClose(); }}
                  style={{
                    width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'9px 14px 9px 20px', border:'none', background: active ? '#FFF2EE' : 'transparent',
                    cursor:'pointer', textAlign:'left', transition:'background 0.15s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background='#F8FAFC'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent'; }}>
                  <span style={{ fontSize:'13px', fontWeight: active ? 700 : 500, color: active ? '#FF4D0C' : '#374151' }}>
                    {month} - {n}
                  </span>
                  {isCur && <span style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8' }}>atual</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── MÊS: lista de meses ───────────────────────────────────────────────────
  if (period === 'mes') {
    const items = Array.from({ length: 12 }, (_, i) => {
      let m = curMonth - i; let y = curYear;
      while (m < 0) { m += 12; y--; }
      return { offsetVal: -i, label: `${MONTH_FULL[m]} ${y}`, isCur: i === 0 };
    });
    return (
      <div style={popStyle}>
        <div style={{ padding:'12px 14px 8px', borderBottom:'1px solid rgba(0,0,0,0.05)' }}>
          <p style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.08em' }}>Selecionar mês</p>
        </div>
        <div style={{ maxHeight:'260px', overflowY:'auto' }}>
          {items.map(({ offsetVal, label, isCur }) => {
            const active = offsetVal === offset;
            return (
              <button key={offsetVal} onClick={() => { onSelect(offsetVal); onClose(); }}
                style={{
                  width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'10px 14px', border:'none', background: active ? '#FFF2EE' : 'transparent',
                  cursor:'pointer', textAlign:'left', transition:'background 0.15s',
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background='#F8FAFC'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background='transparent'; }}>
                <span style={{ fontSize:'13px', fontWeight: active ? 700 : 500, color: active ? '#FF4D0C' : '#374151' }}>{label}</span>
                {isCur && <span style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8' }}>atual</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── DIA: calendário completo ──────────────────────────────────────────────
  const { start } = getPeriodBounds(period, offset);
  const initYear  = parseInt(start.split('-')[0]);
  const initMonth = parseInt(start.split('-')[1]) - 1;
  const [vYear, setVYear]   = useState(initYear);
  const [vMonth, setVMonth] = useState(initMonth);

  const firstDow  = new Date(vYear, vMonth, 1).getDay();
  const daysInMon = new Date(vYear, vMonth + 1, 0).getDate();
  const isFuture  = (d) => new Date(vYear, vMonth, d) > TODAY_DATE;
  const isToday   = (d) => `${vYear}-${String(vMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` === TODAY;
  const isSelDay  = (d) => `${vYear}-${String(vMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}` === start;

  const prevMonth = () => { if (vMonth === 0) { setVMonth(11); setVYear(y=>y-1); } else setVMonth(m=>m-1); };
  const nextMonth = () => {
    if (vYear === curYear && vMonth >= curMonth) return;
    if (vMonth === 11) { setVMonth(0); setVYear(y=>y+1); } else setVMonth(m=>m+1);
  };

  return (
    <div style={{ ...popStyle, padding:'14px', width:'268px' }}>
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} style={{ background:'#F1F5F9', border:'none', borderRadius:'8px', padding:'5px 8px', cursor:'pointer', color:'#64748B', display:'flex' }}><ChevronLeft size={13}/></button>
        <span style={{ fontSize:'13px', fontWeight:700, color:'#0F172A' }}>{MONTH_FULL[vMonth]} {vYear}</span>
        <button onClick={nextMonth} style={{ background: !(vYear===curYear&&vMonth>=curMonth) ? '#F1F5F9':'transparent', border:'none', borderRadius:'8px', padding:'5px 8px', cursor: !(vYear===curYear&&vMonth>=curMonth)?'pointer':'default', color: !(vYear===curYear&&vMonth>=curMonth)?'#64748B':'#CBD5E1', display:'flex' }}><ChevronRight size={13}/></button>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:'4px' }}>
        {['D','S','T','Q','Q','S','S'].map((d,i)=><div key={i} style={{ textAlign:'center', fontSize:'10px', fontWeight:600, color:'#94A3B8' }}>{d}</div>)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
        {Array.from({ length: firstDow }).map((_,i)=><div key={`e${i}`}/>)}
        {Array.from({ length: daysInMon }).map((_,i)=>{
          const day=i+1, future=isFuture(day), sel=isSelDay(day), today=isToday(day);
          return (
            <button key={day} onClick={()=>{ if(future) return; const diff=Math.round((new Date(vYear,vMonth,day)-TODAY_DATE)/86400000); onSelect(diff); onClose(); }}
              style={{ padding:'6px 2px', border:'none', cursor:future?'not-allowed':'pointer', fontSize:'12px', fontWeight:today?700:500,
                background: sel?'#FF4D0C': today?'#FFF2EE':'transparent',
                color: sel?'white': future?'#CBD5E1': today?'#FF4D0C':'#374151',
                borderRadius:'8px', outline:'none' }}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Helper: compute bounds + label for any period + offset ─────────────────
const BASE_YEAR = 2000;
const DOW_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function getPeriodBounds(period, offset) {
  const { num, month, year } = getQuinzenaInfo();

  if (period === 'dia') {
    const d = new Date(TODAY_DATE);
    d.setDate(d.getDate() + offset);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const dow = DOW_SHORT[d.getDay()];
    const label = `${dow}, ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    return { start: iso, end: iso, label };
  }

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
    const label = `${MONTH_FULL[tMonth]}/${tYear} - Quinzena ${tNum}`;
    return { start, end, label };
  }

  // mes
  let m = month + offset;
  let y = year;
  while (m < 0)  { m += 12; y--; }
  while (m >= 12) { m -= 12; y++; }
  const mm = String(m + 1).padStart(2, '0');
  const lastDay = new Date(y, m + 1, 0).getDate();
  return {
    start: `${y}-${mm}-01`,
    end:   `${y}-${mm}-${String(lastDay).padStart(2,'0')}`,
    label: `${MONTH_FULL[m]} ${y}`,
  };
}

// ── History ────────────────────────────────────────────────────────────────
function HistoryTab({ companyId }) {
  const [period, setPeriod]           = useState('quinzena');
  const [offset, setOffset]           = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const [showCal, setShowCal]         = useState(false);
  const calRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (calRef.current && !calRef.current.contains(e.target)) setShowCal(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Reset offset when switching period
  const handlePeriod = (p) => { setPeriod(p); setOffset(0); setShowCal(false); };

  const allRecords = WORK_RECORDS.filter(r => r.companyId === companyId);
  const { start, end, label } = getPeriodBounds(period, offset);

  const filtered   = allRecords.filter(r => r.date >= start && r.date <= end);
  const byDate     = filtered.reduce((acc, r) => { (acc[r.date] = acc[r.date] || []).push(r); return acc; }, {});
  const days       = Object.entries(byDate).sort(([a],[b]) => b.localeCompare(a));

  const totalEscala   = filtered.length;
  const totalFaltas   = filtered.filter(r => r.status === 'absent').length;
  const totalPresentes = totalEscala - totalFaltas;

  const exportPDF = () => {
    const doc = new jsPDF();
    const orange = [255, 77, 12];
    const grey   = [100, 116, 139];

    // ── Cabeçalho ──
    doc.setFillColor(...orange);
    doc.rect(0, 0, 210, 18, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('FariLog — Relatório de Histórico', 14, 12);

    // Período
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...grey);
    doc.text(`Período: ${label}`, 14, 24);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 30);

    // ── Resumo ──
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Resumo do Período', 14, 40);

    autoTable(doc, {
      startY: 44,
      head: [['Escalados', 'Presentes', 'Faltas']],
      body:  [[totalEscala, totalPresentes, totalFaltas]],
      headStyles:  { fillColor: orange, textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles:  { fontSize: 10, fontStyle: 'bold', halign: 'center' },
      columnStyles: { 0: { textColor: orange }, 1: { textColor: [5,150,105] }, 2: { textColor: totalFaltas > 0 ? [225,29,72] : [148,163,184] } },
      margin: { left: 14, right: 14 },
      tableWidth: 'auto',
    });

    // ── Dias ──
    days.forEach(([date, recs]) => {
      const [y, m, d] = date.split('-');
      const dow = DOW_SHORT[new Date(`${date}T12:00:00`).getDay()];
      const faltas  = recs.filter(r => r.status === 'absent').length;
      const atrasos = recs.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length;

      const yPos = doc.lastAutoTable.finalY + 10;

      // Linha de data
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(`${dow}, ${d}/${m}/${y}`, 14, yPos);

      const info = [`${recs.length} ajudante${recs.length !== 1 ? 's' : ''}`, faltas > 0 ? `${faltas} falta${faltas !== 1?'s':''}` : null, atrasos > 0 ? `${atrasos} atraso${atrasos !== 1?'s':''}` : null].filter(Boolean).join('   ·   ');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...grey);
      doc.text(info, 14, yPos + 5);

      autoTable(doc, {
        startY: yPos + 9,
        head: [['Nome', 'Função', 'Entrada', 'Status']],
        body: recs.map(rec => {
          const emp = getEmployee(rec.employeeId);
          return [
            emp?.name || '—',
            rec.service || '—',
            rec.checkIn || '—',
            rec.status === 'active' ? 'Ativo' : rec.status === 'absent' ? 'Falta' : 'Concluído',
          ];
        }),
        headStyles: { fillColor: [241,245,249], textColor: grey, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8, textColor: [15,23,42] },
        columnStyles: {
          2: { halign: 'center' },
          3: { halign: 'center' },
        },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.column.index === 3) {
            const val = data.cell.raw;
            if (val === 'Ativo')      data.cell.styles.textColor = [5,150,105];
            if (val === 'Falta')      data.cell.styles.textColor = [225,29,72];
            if (val === 'Concluído')  data.cell.styles.textColor = [100,116,139];
          }
        },
        margin: { left: 14, right: 14 },
      });
    });

    // Rodapé
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148,163,184);
      doc.text(`FariLog © ${new Date().getFullYear()}   |   Página ${i} de ${pageCount}`, 105, 290, { align: 'center' });
    }

    doc.save(`historico-${label.replace(/[\/\s—]+/g,'-')}.pdf`);
  };

  const PERIODS = [['dia','Dia'],['quinzena','Quinzena'],['mes','Mês']];
  const navBtn  = (icon, onClick) => (
    <button onClick={onClick} className="p-1.5 rounded-lg transition-colors"
      style={{ background:'#F1F5F9', border:'none', cursor:'pointer', color:'#64748B', display:'flex' }}>
      {icon}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold" style={T}>Histórico</h2>
        <button onClick={exportPDF}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
          style={{ background:'#FF4D0C', color:'white', border:'none', cursor:'pointer', boxShadow:'0 2px 8px rgba(255,77,12,0.3)' }}
          onMouseEnter={e => e.currentTarget.style.background='#E03A00'}
          onMouseLeave={e => e.currentTarget.style.background='#FF4D0C'}>
          <FileDown size={13} />
          Exportar PDF
        </button>
      </div>

      {/* Tipo de período */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background:'#F1F5F9', border:'1px solid rgba(0,0,0,0.06)' }}>
        {PERIODS.map(([val, lbl]) => (
          <button key={val} onClick={() => handlePeriod(val)}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: period === val ? '#FF4D0C' : 'transparent', color: period === val ? 'white' : '#64748B', border:'none', cursor:'pointer' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Navegação de período */}
      <div style={{ position:'relative' }} ref={calRef}>
        <div className="flex items-center justify-between p-3 rounded-xl" style={{ background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.05)' }}>
          {navBtn(<ChevronLeft size={15}/>, () => setOffset(o => o - 1))}
          <button onClick={() => setShowCal(v => !v)}
            className="flex items-center gap-2"
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:700, color:'#0F172A' }}>
            <Calendar size={14} style={{ color:'#FF4D0C' }} />
            {label}
          </button>
          {navBtn(<ChevronRight size={15}/>, () => setOffset(o => Math.min(o + 1, 0)))}
        </div>
        {showCal && (
          <CalendarPicker
            period={period}
            offset={offset}
            onSelect={setOffset}
            onClose={() => setShowCal(false)}
          />
        )}
      </div>

      {/* Resumo do período */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label:'Escalados', value: totalEscala,    color:'#FF4D0C' },
          { label:'Presentes', value: totalPresentes,  color:'#059669' },
          { label:'Faltas',    value: totalFaltas,     color: totalFaltas > 0 ? '#E11D48' : '#94A3B8' },
        ].map((s,i) => (
          <div key={i} className="stat-card text-center" style={{ padding:'14px' }}>
            <p className="text-2xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs mt-1.5" style={TM}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Lista de dias */}
      <div className="card overflow-hidden">
        {days.length === 0 ? (
          <div className="p-10 text-center text-sm" style={TM}>Nenhum registro neste período</div>
        ) : days.map(([date, recs], idx) => {
          const escala   = recs.length;
          const faltas   = recs.filter(r => r.status === 'absent').length;
          const atrasos  = recs.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length;
          const isToday  = date === TODAY;
          const [, m, d] = date.split('-');
          const dow      = DOW_SHORT[new Date(`${date}T12:00:00`).getDay()];

          return (
            <button key={date} onClick={() => setSelectedDay(date)}
              className="w-full text-left transition-colors"
              style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                padding:'12px 20px', border:'none', background:'transparent', cursor:'pointer',
                borderBottom: idx < days.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
              }}
              onMouseEnter={e => e.currentTarget.style.background='#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <div style={{ display:'grid', gridTemplateColumns:'52px 1px 1fr', columnGap:'14px', alignItems:'center', flex:1 }}>
                {/* Data — largura fixa para manter o traço sempre no mesmo ponto */}
                <div style={{ textAlign:'center' }}>
                  <p className="text-xs uppercase font-semibold" style={{ color:'#94A3B8', letterSpacing:'0.05em' }}>{dow}</p>
                  <p className="text-lg font-black leading-tight" style={{ color: isToday ? '#FF4D0C' : '#0F172A' }}>{d}/{m}</p>
                </div>
                {/* Separador */}
                <div style={{ width:'1px', height:'28px', background:'rgba(0,0,0,0.08)', justifySelf:'center' }} />
                {/* Info */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs" style={{ color:'#475569' }}>{escala} ajudante{escala !== 1 ? 's' : ''}</span>
                  {faltas  > 0 && <span style={{ fontSize:'10px', fontWeight:600, padding:'1px 7px', borderRadius:'4px', background:'#FFE4E6', color:'#BE123C' }}>{faltas} falta{faltas !== 1 ? 's' : ''}</span>}
                  {atrasos > 0 && <span style={{ fontSize:'10px', fontWeight:600, padding:'1px 7px', borderRadius:'4px', background:'#FEF3C7', color:'#B45309' }}>{atrasos} atraso{atrasos !== 1 ? 's' : ''}</span>}
                </div>
              </div>
              <ChevronRight size={14} style={{ color:'#CBD5E1', flexShrink:0, marginLeft:'8px' }} />
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <DiaModal
          date={selectedDay}
          records={WORK_RECORDS.filter(r => r.companyId === companyId && r.date === selectedDay)}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

// ── Helper: formata período "16/05 - 31/05/2026" → "Maio/2026 - Quinzena 2"
function formatPeriod(period) {
  if (!period) return period;
  // matches "16/05 - 31/05/2026" or "01/05 - 15/05/2026"
  const m = period.match(/^(\d{2})\/(\d{2}) - \d{2}\/\d{2}\/(\d{4})/);
  if (!m) return period;
  const num = parseInt(m[1]) <= 15 ? 1 : 2;
  return `${MONTH_FULL[parseInt(m[2]) - 1]}/${m[3]} - Quinzena ${num}`;
}

// ── Tooltip para o gráfico financeiro ─────────────────────────────────────
const FinTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div style={{ background:'#1E293B', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'10px 14px', minWidth:'130px' }}>
      <p style={{ color:'#94A3B8', fontSize:'10px', fontWeight:600, marginBottom:'4px', textTransform:'uppercase', letterSpacing:'0.06em' }}>{d?.shortDay}, {d?.label}</p>
      <p style={{ color:'#059669', fontSize:'14px', fontWeight:700 }}>{fmtCurrency(d?.value || 0)}</p>
      <p style={{ color:'#64748B', fontSize:'11px' }}>{d?.count} ajudante{d?.count !== 1 ? 's' : ''}</p>
    </div>
  );
};

// ── helpers: parse "01/05 - 15/05/2026" → ISO dates ──────────────────────
function parsePeriodStart(period) {
  const m = period.match(/^(\d{2})\/(\d{2}) - \d{2}\/\d{2}\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
function parsePeriodEnd(period) {
  const m = period.match(/^(\d{2})\/(\d{2}) - (\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[5]}-${m[4]}-${m[3]}` : null;
}

// ── Valores: diária e hora extra ──────────────────────────────────────────
const VALOR_DIARIA   = 150;
const VALOR_HORA_EXTRA = 50;

// Calcula o valor total da fatura a partir dos registros do período:
// total = (diárias presentes × 150) + (horas extras × 50)
function calcPaymentTotal(payment, companyId) {
  const pStart = parsePeriodStart(payment.period);
  const pEnd   = parsePeriodEnd(payment.period);
  if (!pStart || !pEnd) return { total: 0, diarias: 0, heCount: 0, valorDiarias: 0, valorHE: 0 };
  const recs = WORK_RECORDS.filter(r => r.companyId === companyId && r.date >= pStart && r.date <= pEnd);
  const diarias = recs.filter(r => r.status !== 'absent').length;
  const heCount = recs.filter(r => r.overtime).length;
  const valorDiarias = diarias * VALOR_DIARIA;
  const valorHE      = heCount * VALOR_HORA_EXTRA;
  return { total: valorDiarias + valorHE, diarias, heCount, valorDiarias, valorHE };
}

// ── Modal de detalhe de um período de pagamento ────────────────────────────
function FinPeriodModal({ payment, companyId, onClose }) {
  const [selectedDay, setSelectedDay] = useState(null);

  const pStart = parsePeriodStart(payment.period);
  const pEnd   = parsePeriodEnd(payment.period);
  const label  = formatPeriod(payment.period);

  // Todos os registros da empresa no período
  const allRecs = WORK_RECORDS.filter(r =>
    r.companyId === companyId && r.date >= pStart && r.date <= pEnd
  );

  // Agrupar por data
  const byDate = allRecs.reduce((acc, r) => {
    (acc[r.date] = acc[r.date] || []).push(r);
    return acc;
  }, {});
  const days = Object.entries(byDate).sort(([a], [b]) => b.localeCompare(a));

  const totalEscala    = allRecs.length;
  const totalFaltas    = allRecs.filter(r => r.status === 'absent').length;
  const totalPresentes = totalEscala - totalFaltas;
  const totalHE        = allRecs.filter(r => r.overtime).length;
  const totalValor     = totalPresentes * VALOR_DIARIA + totalHE * VALOR_HORA_EXTRA;

  const statusColor = payment.status === 'paid' ? '#059669' : payment.status === 'overdue' ? '#E11D48' : '#D97706';
  const statusLabel = payment.status === 'paid' ? 'Pago' : payment.status === 'pending' ? 'Pendente' : 'Atrasado';

  return createPortal(
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal-box animate-fade-up" style={{ maxWidth:'560px' }}>

          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs font-semibold uppercase" style={{ color:'#94A3B8', letterSpacing:'0.08em', marginBottom:'4px' }}>Detalhe do período</p>
              <h2 className="text-base font-bold" style={{ color:'#0F172A' }}>{label}</h2>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`badge badge-${payment.status}`}>{statusLabel}</span>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color:'#94A3B8', background:'#F1F5F9' }}>
              <X size={15} />
            </button>
          </div>

          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label:'Diárias',  value: totalEscala,    color:'#FF4D0C' },
              { label:'Presentes', value: totalPresentes, color:'#059669' },
              { label:'Faltas',   value: totalFaltas,    color: totalFaltas > 0 ? '#E11D48' : '#94A3B8' },
            ].map((s, i) => (
              <div key={i} className="card-inner text-center" style={{ padding:'12px 8px' }}>
                <p className="text-xl font-black leading-none" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs mt-1" style={{ color:'#94A3B8' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Lista de dias */}
          <div className="card overflow-hidden">
            {days.length === 0 ? (
              <div className="py-10 text-center text-sm" style={{ color:'#94A3B8' }}>Sem registros neste período</div>
            ) : days.map(([date, recs], idx) => {
              const escala  = recs.length;
              const faltas  = recs.filter(r => r.status === 'absent').length;
              const atrasos = recs.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length;
              const valor   = (escala - faltas) * 150;
              const [, m, d] = date.split('-');
              const dow = DOW_SHORT[new Date(`${date}T12:00:00`).getDay()];
              const isToday = date === TODAY;

              return (
                <button key={date} onClick={() => setSelectedDay(date)}
                  className="w-full text-left transition-colors"
                  style={{
                    display:'flex', alignItems:'center', justifyContent:'space-between',
                    padding:'12px 16px', border:'none', background:'transparent', cursor:'pointer',
                    borderBottom: idx < days.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                  <div style={{ display:'grid', gridTemplateColumns:'52px 1px 1fr', columnGap:'14px', alignItems:'center', flex:1 }}>
                    <div style={{ textAlign:'center' }}>
                      <p className="text-xs uppercase font-semibold" style={{ color:'#94A3B8', letterSpacing:'0.05em' }}>{dow}</p>
                      <p className="text-base font-black leading-tight" style={{ color: isToday ? '#FF4D0C' : '#0F172A' }}>{d}/{m}</p>
                    </div>
                    <div style={{ width:'1px', height:'26px', background:'rgba(0,0,0,0.08)', justifySelf:'center' }} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs" style={{ color:'#475569' }}>{escala} ajudante{escala !== 1 ? 's' : ''}</span>
                      {faltas  > 0 && <span style={{ fontSize:'10px', fontWeight:600, padding:'1px 7px', borderRadius:'4px', background:'#FFE4E6', color:'#BE123C' }}>{faltas} falta{faltas !== 1 ? 's' : ''}</span>}
                      {atrasos > 0 && <span style={{ fontSize:'10px', fontWeight:600, padding:'1px 7px', borderRadius:'4px', background:'#FEF3C7', color:'#B45309' }}>{atrasos} atraso{atrasos !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3" style={{ marginLeft:'8px' }}>
                    <span className="text-xs font-semibold" style={{ color:'#059669' }}>{fmtCurrency(valor)}</span>
                    <ChevronRight size={13} style={{ color:'#CBD5E1' }} />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Footer: Valor Total + Vencimento */}
          <div className="flex items-center justify-between mt-4 px-1 py-3 rounded-xl"
            style={{ background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.05)', padding:'14px 16px' }}>
            <div>
              <p className="text-xs font-semibold" style={{ color:'#64748B' }}>Valor Total</p>
              <p className="text-xl font-black mt-0.5" style={{ color: statusColor }}>{fmtCurrency(totalValor)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color:'#64748B' }}>
                {payment.status === 'paid' ? 'Pago em' : 'Vencimento'}
              </p>
              <p className="text-base font-bold mt-0.5" style={{ color:'#0F172A' }}>
                {payment.status === 'paid' && payment.paidDate ? fmtDate(payment.paidDate) : fmtDate(payment.dueDate)}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* Modal de detalhe do dia (empilhado sobre o modal do período) */}
      {selectedDay && (
        <DiaModal
          date={selectedDay}
          records={WORK_RECORDS.filter(r => r.companyId === companyId && r.date === selectedDay)}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </>,
    document.body
  );
}

// ── Financial ──────────────────────────────────────────────────────────────
function Financial({ companyId }) {
  const [finTab,          setFinTab]          = useState('atual');
  const [period,          setPeriod]          = useState('quinzena');
  const [offset,          setOffset]          = useState(0);
  const [showCal,         setShowCal]         = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const calRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (calRef.current && !calRef.current.contains(e.target)) setShowCal(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handlePeriod = (p) => { setPeriod(p); setOffset(0); setShowCal(false); };

  const myPayments  = PAYMENTS.filter(p => p.companyId === companyId).sort((a,b) => b.dueDate.localeCompare(a.dueDate));
  const nextPayment = myPayments.find(p => p.status === 'pending');
  const daysLeft    = nextPayment ? Math.ceil((new Date(nextPayment.dueDate) - TODAY_DATE) / 86400000) : null;

  // Quinzena atual (sub-aba Período Atual)
  const quinzenaInfo  = getQuinzenaInfo();
  const quinzenaData  = buildQuinzenaData(companyId);
  const quinzenaTotal = quinzenaData.reduce((s, d) => s + d.count, 0);
  const quinzenaValue = quinzenaTotal * 150;
  const maxValue      = Math.max(...quinzenaData.map(d => d.value), 1);

  // Histórico filtrado
  const { start: hStart, end: hEnd, label: hLabel } = getPeriodBounds(period, offset);
  const filteredPayments = myPayments.filter(p => {
    const s = parsePeriodStart(p.period);
    return s && s >= hStart && s <= hEnd;
  });
  const totalFiltered = filteredPayments.reduce((s, p) => s + calcPaymentTotal(p, companyId).total, 0);
  const paidFiltered  = filteredPayments.filter(p => p.status === 'paid').reduce((s, p) => s + calcPaymentTotal(p, companyId).total, 0);

  const FIN_PERIODS = [['quinzena','Quinzena'],['mes','Mês']];
  const navBtn = (icon, fn) => (
    <button onClick={fn} className="p-1.5 rounded-lg"
      style={{ background:'#F1F5F9', border:'none', cursor:'pointer', color:'#64748B', display:'flex' }}>
      {icon}
    </button>
  );

  return (
    <div className="space-y-5">

      {/* Header + sub-abas */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold" style={T}>Financeiro</h2>
          <p className="text-sm mt-0.5" style={TM}>Pagamentos quinzenais nos dias 5 e 20</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background:'#F1F5F9', border:'1px solid rgba(0,0,0,0.06)' }}>
          {[['atual','Período Atual'],['historico','Histórico']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFinTab(val)}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ background: finTab===val ? '#FF4D0C' : 'transparent', color: finTab===val ? 'white' : '#64748B', border:'none', cursor:'pointer', whiteSpace:'nowrap' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ══ SUB-ABA: Período Atual ══════════════════════════════════════════ */}
      {finTab === 'atual' && (
        <>
          {/* Próximo pagamento */}
          {nextPayment && (
            <div className="card p-5" style={{ borderLeft: '4px solid #D97706' }}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar size={14} style={{ color: '#D97706' }} />
                <span className="text-sm font-semibold" style={{ color: '#D97706' }}>Próximo Pagamento</span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="font-bold text-2xl" style={T}>{fmtCurrency(calcPaymentTotal(nextPayment, companyId).total)}</p>
                  <p className="text-xs mt-1" style={TM}>Período: {formatPeriod(nextPayment.period)}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-lg" style={{ color: '#D97706' }}>{fmtDate(nextPayment.dueDate)}</p>
                  {daysLeft !== null && <p className="text-xs" style={TM}>{daysLeft > 0 ? `em ${daysLeft} dias` : 'Hoje'}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Gráfico quinzena atual */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <span style={{ fontSize:'12px', fontWeight:700, padding:'3px 12px', borderRadius:'20px', background:'#FFF7ED', color:'#FB923C' }}>
                  {quinzenaInfo.badgeLabel}
                </span>
                <p className="text-xs mt-1.5" style={TM}>{quinzenaInfo.rangeLabel}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={TM}>Faturado na quinzena</p>
                <p className="font-bold text-lg" style={{ color:'#059669' }}>{fmtCurrency(quinzenaValue)}</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={quinzenaData} margin={{ top:4, right:0, bottom:0, left:-28 }} barSize={16}>
                <defs>
                  <linearGradient id="finBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#059669" stopOpacity={1} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.6} />
                  </linearGradient>
                  <linearGradient id="finToday" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#FF4D0C" stopOpacity={1} />
                    <stop offset="100%" stopColor="#FF4D0C" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="finEmpty" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#E2E8F0" stopOpacity={1} />
                    <stop offset="100%" stopColor="#F1F5F9" stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill:'#94A3B8', fontSize:10, fontFamily:'Inter' }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fill:'#94A3B8', fontSize:10, fontFamily:'Inter' }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, maxValue + 150]} tickFormatter={v => v > 0 ? `R$${v}` : ''} />
                <Tooltip content={<FinTooltip />} cursor={{ fill:'rgba(5,150,105,0.05)', radius:6 }} />
                <Bar dataKey="value" radius={[6,6,0,0]}>
                  {quinzenaData.map((d, i) => (
                    <Cell key={i} fill={d.isToday ? 'url(#finToday)' : d.isWeekend || d.count === 0 ? 'url(#finEmpty)' : 'url(#finBar)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="flex items-center gap-5 mt-3 pt-3" style={{ borderTop:'1px solid rgba(0,0,0,0.05)' }}>
              {[
                { solid:'#059669', label:'Dias faturados' },
                { solid:'#FF4D0C', label:'Hoje' },
                { solid:'#E2E8F0', label:'Sem faturamento' },
              ].map((l,i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background:l.solid }} />
                  <span className="text-xs" style={TM}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alertas de atraso */}
          {myPayments.filter(p => p.status === 'overdue').map(p => (
            <div key={p.id} className="card p-4 flex items-center gap-3"
              style={{ border: '1px solid rgba(220,38,38,0.2)', borderLeft: '4px solid #DC2626' }}>
              <AlertTriangle size={18} style={{ color: '#DC2626' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>Pagamento em atraso</p>
                <p className="text-xs" style={TM}>{fmtCurrency(calcPaymentTotal(p, companyId).total)} · venceu em {fmtDate(p.dueDate)}</p>
              </div>
            </div>
          ))}
        </>
      )}

      {/* ══ SUB-ABA: Histórico ══════════════════════════════════════════════ */}
      {finTab === 'historico' && (
        <>
          {/* Tipo de período */}
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background:'#F1F5F9', border:'1px solid rgba(0,0,0,0.06)' }}>
            {FIN_PERIODS.map(([val, lbl]) => (
              <button key={val} onClick={() => handlePeriod(val)}
                className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: period===val ? '#FF4D0C' : 'transparent', color: period===val ? 'white' : '#64748B', border:'none', cursor:'pointer' }}>
                {lbl}
              </button>
            ))}
          </div>

          {/* Navegação de período */}
          <div style={{ position:'relative' }} ref={calRef}>
            <div className="flex items-center justify-between p-3 rounded-xl"
              style={{ background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.05)' }}>
              {navBtn(<ChevronLeft size={15}/>, () => setOffset(o => o - 1))}
              <button onClick={() => setShowCal(v => !v)}
                className="flex items-center gap-2"
                style={{ background:'none', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:700, color:'#0F172A' }}>
                <Calendar size={14} style={{ color:'#FF4D0C' }} />
                {hLabel}
              </button>
              {navBtn(<ChevronRight size={15}/>, () => setOffset(o => Math.min(o + 1, 0)))}
            </div>
            {showCal && (
              <CalendarPicker
                period={period}
                offset={offset}
                onSelect={setOffset}
                onClose={() => setShowCal(false)}
              />
            )}
          </div>

          {/* Lista de pagamentos filtrados */}
          <div className="card overflow-hidden">
            {filteredPayments.length === 0 ? (
              <div className="p-10 text-center text-sm" style={TM}>Nenhum pagamento neste período</div>
            ) : filteredPayments.map((p, idx) => {
              const { total: totalFatura, diarias, heCount, valorDiarias, valorHE } = calcPaymentTotal(p, companyId);
              const sColor = p.status === 'paid' ? '#059669' : p.status === 'overdue' ? '#E11D48' : '#D97706';
              const sBg    = p.status === 'paid' ? '#DCFCE7' : p.status === 'overdue' ? '#FFE4E6' : '#FEF3C7';
              const sLabel = p.status === 'paid' ? 'Pago' : p.status === 'pending' ? 'Pendente' : 'Atrasado';
              const dataPagto = p.status === 'paid' && p.paidDate ? fmtDate(p.paidDate) : fmtDate(p.dueDate);

              return (
                <div key={p.id} style={{
                  padding: '18px 20px',
                  borderBottom: idx < filteredPayments.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                }}>
                  {/* Cabeçalho */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div style={{ width:'36px', height:'36px', borderRadius:'10px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', background: sBg }}>
                        <DollarSign size={15} style={{ color: sColor }} />
                      </div>
                      <p className="text-sm font-bold" style={T}>{formatPeriod(p.period)}</p>
                    </div>
                    <span className={`badge badge-${p.status}`}>{sLabel}</span>
                  </div>

                  {/* Grid de informações — ordem: Diárias, H.Extra, Vencimento, Valor fatura */}
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    {/* Diárias */}
                    <div className="card-inner" style={{ padding:'12px 14px' }}>
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span style={{ fontSize:'10px', color:'#94A3B8', fontWeight:500 }}>Diárias:</span>
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#0F172A' }}>{diarias}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span style={{ fontSize:'10px', color:'#64748B', fontWeight:500 }}>Valor:</span>
                        <span style={{ fontSize:'12px', fontWeight:700, color:'#059669' }}>{fmtCurrency(valorDiarias)}</span>
                      </div>
                    </div>
                    {/* Horas Extras */}
                    <div className="card-inner" style={{ padding:'12px 14px' }}>
                      <div className="flex items-baseline gap-1.5 mb-1">
                        <span style={{ fontSize:'10px', color:'#94A3B8', fontWeight:500 }}>Horas Extras:</span>
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#0F172A' }}>{heCount}</span>
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span style={{ fontSize:'10px', color:'#64748B', fontWeight:500 }}>Valor:</span>
                        <span style={{ fontSize:'12px', fontWeight:700, color:'#7C3AED' }}>{fmtCurrency(valorHE)}</span>
                      </div>
                    </div>
                    {/* Vencimento */}
                    <div className="card-inner" style={{ padding:'12px 14px' }}>
                      <p style={{ fontSize:'10px', color:'#94A3B8', fontWeight:500, marginBottom:'6px' }}>
                        {p.status === 'paid' ? 'Pago em' : 'Vencimento'}
                      </p>
                      <span style={{ fontSize:'13px', fontWeight:700, color:'#0F172A' }}>{dataPagto}</span>
                    </div>
                    {/* Valor da fatura */}
                    <div className="card-inner" style={{ padding:'12px 14px' }}>
                      <p style={{ fontSize:'10px', color:'#94A3B8', fontWeight:500, marginBottom:'6px' }}>Valor da fatura</p>
                      <span style={{ fontSize:'15px', fontWeight:800, color: sColor, lineHeight:1 }}>{fmtCurrency(totalFatura)}</span>
                    </div>
                  </div>

                  {/* Botão */}
                  <button
                    onClick={() => setSelectedPayment(p)}
                    className="btn-ghost"
                    style={{ width:'100%', textAlign:'center', padding:'9px', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                    Ver mais detalhes <ChevronRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {selectedPayment && (
        <FinPeriodModal
          payment={selectedPayment}
          companyId={companyId}
          onClose={() => setSelectedPayment(null)}
        />
      )}
    </div>
  );
}

// ── Escalas ────────────────────────────────────────────────────────────────

function EscalasHoje({ companyId }) {
  const [showModal, setShowModal] = useState(false);
  const todayRecords  = WORK_RECORDS.filter(r => r.companyId === companyId && r.date === TODAY);
  const escala        = todayRecords.length;
  const faltas        = todayRecords.filter(r => r.status === 'absent').length;
  const atrasos       = todayRecords.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length;
  const presenteCount = todayRecords.filter(r => r.status !== 'absent').length;
  const pct           = escala > 0 ? Math.round((presenteCount / escala) * 100) : 0;
  const pctColor      = pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#E11D48';
  const pctBg         = pct >= 80 ? '#DCFCE7' : pct >= 50 ? '#FEF3C7' : '#FFE4E6';

  return (
    <div className="space-y-4">
      {/* KPI cards — Escala, Frequência, Presença */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card flex flex-col justify-between" style={{ minHeight: '110px' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#FFF2EE' }}>
              <CalendarCheck size={15} style={{ color: '#FF4D0C' }} />
            </div>
            <span className="text-sm font-bold" style={T}>Escala</span>
          </div>
          <p className="text-4xl font-black leading-none" style={{ color: '#FF4D0C' }}>{escala}</p>
        </div>

        <div className="stat-card flex flex-col justify-between" style={{ minHeight: '110px' }}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={T2}>Faltas</span>
              <span className="text-sm font-black" style={{ color: faltas > 0 ? '#E11D48' : '#94A3B8' }}>{faltas}</span>
            </div>
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.05)' }} />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium" style={T2}>Atrasos</span>
              <span className="text-sm font-black" style={{ color: atrasos > 0 ? '#D97706' : '#94A3B8' }}>{atrasos}</span>
            </div>
          </div>
        </div>

        <div className="stat-card flex flex-col justify-between" style={{ minHeight: '110px' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: pctBg }}>
              <Users size={15} style={{ color: pctColor }} />
            </div>
            <span className="text-sm font-bold" style={T}>Presença</span>
          </div>
          <div>
            <div className="flex items-end gap-1.5 mb-2">
              <p className="text-3xl font-black leading-none" style={{ color: pctColor }}>{pct}%</p>
              <p className="text-xs mb-1" style={TM}>{presenteCount}/{escala}</p>
            </div>
            <div style={{ height: '4px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)' }}>
              <div style={{ height: '100%', borderRadius: '4px', background: pctColor, width: `${pct}%`, transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Lista de ajudantes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold" style={T}>Ajudantes em Serviço Agora</h3>
          {todayRecords.length > 0 && (
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: '#FF4D0C', background: 'none', border: 'none', cursor: 'pointer' }}>
              Ver mais <ChevronRight size={13} />
            </button>
          )}
        </div>
        <div className="card overflow-hidden">
          {todayRecords.length === 0 ? (
            <div className="p-8 text-center text-sm" style={TM}>Nenhum ajudante alocado hoje</div>
          ) : (
            todayRecords.map(rec => {
              const emp = getEmployee(rec.employeeId);
              const times = [
                { label: 'Entrada',   value: rec.checkIn },
                { label: 'S. Almoço', value: rec.lunchOut },
                { label: 'Retorno',   value: rec.lunchReturn },
                { label: 'Saída',     value: rec.checkOut },
                { label: 'H. Extra',  value: rec.overtime },
              ];
              return (
                <div key={rec.id} className="table-row" style={{ gridTemplateColumns: 'auto 1fr 1fr auto' }}>
                  <div className="avatar" style={{ background: emp?.color || '#1D6FFF' }}>{emp?.initials}</div>
                  <div className="px-3 flex items-center gap-2">
                    <p className="text-xs font-semibold" style={T}>{emp?.name}</p>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>·</span>
                    <p className="text-xs" style={TM}>{rec.service}</p>
                  </div>
                  <div className="flex items-center justify-center gap-8">
                    {times.map(t => (
                      <div key={t.label} className="text-center">
                        <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500, marginBottom: '4px' }}>{t.label}</p>
                        <span style={{
                          fontSize: '15px', fontWeight: 700,
                          color: !t.value ? '#CBD5E1' : t.label === 'H. Extra' ? '#059669' : '#0F172A'
                        }}>
                          {t.value ?? '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <span className={`badge ${rec.status === 'active' ? 'badge-active' : rec.status === 'absent' ? 'badge-inactive' : 'badge-paid'}`}>
                    {rec.status === 'active' ? 'Ativo' : rec.status === 'absent' ? 'Falta' : 'Concluído'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {showModal && (
        <AjudantesModal
          records={todayRecords}
          escala={escala}
          faltas={faltas}
          atrasos={atrasos}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

function EscalasProximas({ companyId }) {
  const futureDates = [...new Set(
    WORK_RECORDS
      .filter(r => r.companyId === companyId && r.date > TODAY && r.status === 'scheduled')
      .map(r => r.date)
  )].sort();

  const [openDate, setOpenDate] = useState(null);

  if (futureDates.length === 0) {
    return (
      <div className="py-14 text-center">
        <CalendarCheck size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
        <p className="text-sm" style={TM}>Nenhuma escala futura lançada</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      {futureDates.map((date, idx) => {
        const records = WORK_RECORDS.filter(r => r.companyId === companyId && r.date === date && r.status === 'scheduled');
        const [y, m, d] = date.split('-').map(Number);
        const dow = DOW_FULL[new Date(y, m - 1, d).getDay()];
        const isOpen = openDate === date;

        return (
          <div key={date} style={{ borderBottom: idx < futureDates.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
            {/* Header row — clicável */}
            <button
              onClick={() => setOpenDate(isOpen ? null : date)}
              className="w-full text-left transition-colors"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div className="flex items-center gap-3">
                <div style={{ textAlign: 'center', minWidth: '44px' }}>
                  <p className="text-xs uppercase font-semibold" style={{ color: '#94A3B8', letterSpacing: '0.05em' }}>{dow}</p>
                  <p className="text-lg font-black leading-tight" style={{ color: '#0F172A' }}>{String(d).padStart(2,'0')}/{String(m).padStart(2,'0')}</p>
                </div>
                <div style={{ width: '1px', height: '28px', background: 'rgba(0,0,0,0.08)' }} />
                <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: '#FFF2EE', color: '#FF4D0C' }}>
                  {records.length} escalado{records.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ChevronRight size={15} style={{ color: '#94A3B8', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {/* Detalhe expandido */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)', background: '#FAFBFC' }}>
                {records.map((rec, rIdx) => {
                  const emp = getEmployee(rec.employeeId);
                  const times = [
                    { label: 'Entrada',   value: rec.checkIn },
                    { label: 'S. Almoço', value: rec.lunchOut },
                    { label: 'Retorno',   value: rec.lunchReturn },
                    { label: 'Saída',     value: rec.checkOut },
                    { label: 'H. Extra',  value: rec.overtime },
                  ];
                  return (
                    <div key={rec.id} className="table-row" style={{
                      gridTemplateColumns: 'auto 1fr 1fr auto',
                      borderBottom: rIdx < records.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                      background: 'transparent',
                    }}>
                      <div className="avatar" style={{ background: emp?.color || '#94A3B8' }}>{emp?.initials}</div>
                      <div className="px-3 flex items-center gap-2">
                        <p className="text-xs font-semibold" style={T}>{emp?.name}</p>
                        <span className="text-xs" style={{ color: '#94A3B8' }}>·</span>
                        <p className="text-xs" style={TM}>{rec.service}</p>
                      </div>
                      <div className="flex items-center justify-center gap-8">
                        {times.map(t => (
                          <div key={t.label} className="text-center">
                            <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 500, marginBottom: '4px' }}>{t.label}</p>
                            <span style={{
                              fontSize: '15px', fontWeight: 700,
                              color: !t.value ? '#CBD5E1' : t.label === 'H. Extra' ? '#059669' : '#0F172A'
                            }}>
                              {t.value ?? '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ background: '#FEF3C7', color: '#D97706', whiteSpace: 'nowrap' }}>Agendado</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EscalasTab({ companyId }) {
  const [sub, setSub] = useState('hoje');
  const SUBS = [
    { key: 'hoje',      label: 'Hoje' },
    { key: 'proximas',  label: 'Próximas Escalas' },
    { key: 'historico', label: 'Histórico' },
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold" style={T}>Escalas</h2>

      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: 'rgba(0,0,0,0.05)' }}>
        {SUBS.map(s => (
          <button key={s.key} onClick={() => setSub(s.key)}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={sub === s.key
              ? { background: '#fff', color: '#FF4D0C', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
              : { color: '#64748B' }}>
            {s.label}
          </button>
        ))}
      </div>

      {sub === 'hoje'      && <EscalasHoje     companyId={companyId} />}
      {sub === 'proximas'  && <EscalasProximas companyId={companyId} />}
      {sub === 'historico' && <HistoryTab      companyId={companyId} />}
    </div>
  );
}

// ── Settings ───────────────────────────────────────────────────────────────
function SettingsTab({ company }) {
  const [form, setForm]     = useState({ ...company });
  const [saved, setSaved]   = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwMsg, setPwMsg]   = useState(null); // { type: 'ok'|'err', text }

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handlePwSave = (e) => {
    e.preventDefault();
    if (pwForm.current !== company.password) {
      setPwMsg({ type: 'err', text: 'Senha atual incorreta.' });
    } else if (pwForm.next.length < 6) {
      setPwMsg({ type: 'err', text: 'A nova senha deve ter ao menos 6 caracteres.' });
    } else if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'err', text: 'As senhas não coincidem.' });
    } else {
      company.password = pwForm.next;
      setPwForm({ current: '', next: '', confirm: '' });
      setPwMsg({ type: 'ok', text: 'Senha alterada com sucesso!' });
    }
    setTimeout(() => setPwMsg(null), 3500);
  };

  const fields = [
    { key: 'name',    label: 'Razão Social' },
    { key: 'cnpj',   label: 'CNPJ' },
    { key: 'contact',label: 'Contato Principal' },
    { key: 'phone',  label: 'Telefone' },
    { key: 'email',  label: 'E-mail' },
    { key: 'address',label: 'Endereço' },
    { key: 'sector', label: 'Setor' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={T}>Configurações</h2>
        <p className="text-sm mt-0.5" style={TM}>Dados da empresa</p>
      </div>

      <div className="grid grid-cols-2 gap-6 items-start">
        {/* Dados da empresa */}
        <form onSubmit={handleSave} className="space-y-4">
          <div className="card p-5 space-y-4">
            {fields.map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
                <input className="input-field" value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Save size={14} /> Salvar alterações
            </button>
            {saved && (
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: '#059669' }}>
                <CheckCircle2 size={14} /> Salvo com sucesso!
              </div>
            )}
          </div>
        </form>

        {/* Alterar senha */}
        <form onSubmit={handlePwSave} className="space-y-4">
          <div className="card p-5 space-y-4">
            <div>
              <p className="text-sm font-bold mb-0.5" style={T}>Alterar Senha</p>
              <p className="text-xs" style={TM}>Preencha os campos abaixo para definir uma nova senha de acesso.</p>
            </div>
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.05)' }} />
            {[
              { key: 'current', label: 'Senha atual' },
              { key: 'next',    label: 'Nova senha' },
              { key: 'confirm', label: 'Confirmar nova senha' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="••••••••"
                  value={pwForm[key]}
                  onChange={e => setPwForm({ ...pwForm, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn-primary flex items-center gap-2">
              <Save size={14} /> Alterar senha
            </button>
            {pwMsg && (
              <div className="flex items-center gap-2 text-xs font-medium" style={{ color: pwMsg.type === 'ok' ? '#059669' : '#DC2626' }}>
                <CheckCircle2 size={14} /> {pwMsg.text}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: ajudantes do dia no relatório ──────────────────────────────────
function DiaDetalheRelModal({ date, records, onClose }) {
  const ativos  = records.filter(r => r.status !== 'absent');
  const ausentes = records.filter(r => r.status === 'absent');
  const [, m, d] = date.split('-');
  const dow = DOW_SHORT[new Date(`${date}T12:00:00`).getDay()];

  const TIMES = [
    { label: 'Entrada',   key: 'checkIn' },
    { label: 'S. Almoço', key: 'lunchOut' },
    { label: 'Retorno',   key: 'lunchReturn' },
    { label: 'Saída',     key: 'checkOut' },
    { label: 'H. Extra',  key: 'overtime' },
  ];

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '720px' }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: '#94A3B8', letterSpacing: '0.08em', marginBottom: '6px' }}>Ajudantes em serviço</p>
            <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>{dow}, {d}/{m}</h2>
            <div className="flex gap-2 mt-2 flex-wrap">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: '#FFF2EE', color: '#CC3D00' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF4D0C', display: 'inline-block' }} />
                {ativos.length} ativo{ativos.length !== 1 ? 's' : ''}
              </span>
              {ausentes.length > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '20px', background: '#FFE4E6', color: '#BE123C' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F43F5E', display: 'inline-block' }} />
                  {ausentes.length} falta{ausentes.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#94A3B8', background: '#F1F5F9' }}>
            <X size={15} />
          </button>
        </div>

        {/* Lista */}
        <div className="card overflow-hidden">
          {ativos.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: '#94A3B8' }}>Nenhum ajudante ativo neste dia</div>
          ) : ativos.map((rec, idx) => {
            const emp = getEmployee(rec.employeeId);
            return (
              <div key={rec.id} style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr repeat(5, 72px)',
                alignItems: 'center',
                padding: '10px 16px',
                gap: '4px',
                borderBottom: idx < ativos.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
                background: idx % 2 === 1 ? 'rgba(0,0,0,0.012)' : 'transparent',
              }}>
                <div className="avatar" style={{ background: emp?.color || '#94A3B8', marginRight: '4px' }}>{emp?.initials}</div>
                <div className="px-2">
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>{emp?.name}</p>
                  <p style={{ fontSize: '10px', color: '#64748B' }}>{rec.service}</p>
                </div>
                {TIMES.map(t => {
                  const val = fmtTime(rec[t.key]);
                  const isHE = t.key === 'overtime';
                  return (
                    <div key={t.label} style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: '9px', fontWeight: 600, color: '#94A3B8', marginBottom: '3px', letterSpacing: '0.03em' }}>{t.label}</p>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '3px',
                        padding: '2px 6px', borderRadius: '6px',
                        background: val ? (isHE ? '#FEF3C7' : '#EEF2F7') : 'transparent',
                        color: val ? (isHE ? '#B45309' : '#0F172A') : '#CBD5E1',
                      }}>
                        <Clock size={9} />
                        <span style={{ fontSize: '11px', fontWeight: 700 }}>{val ?? '—'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

      </div>
    </div>,
    document.body
  );
}

// ── Relatório ──────────────────────────────────────────────────────────────
function RelatorioTab({ companyId }) {
  const [offset, setOffset]           = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);

  const { start, end, label } = getPeriodBounds('quinzena', offset);
  const [sy, sm, sday] = start.split('-').map(Number);
  const [, ,   eday]   = end.split('-').map(Number);

  // Todos os dias da quinzena
  const allDays = [];
  for (let day = sday; day <= eday; day++) {
    const iso  = `${sy}-${String(sm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dow  = new Date(`${iso}T12:00:00`).getDay();
    const recs = WORK_RECORDS.filter(r => r.companyId === companyId && r.date === iso);
    const presentes   = recs.filter(r => r.status !== 'absent');
    const diarias     = presentes.length;
    const heCount     = presentes.filter(r => r.overtime).length;
    const valorDiarias = diarias  * VALOR_DIARIA;
    const valorHE     = heCount  * VALOR_HORA_EXTRA;
    allDays.push({
      date: iso, dow, dayNum: day,
      label: `${DOW_SHORT[dow]}, ${String(day).padStart(2,'0')}/${String(sm).padStart(2,'0')}`,
      isWeekend: dow === 0 || dow === 6,
      isToday: iso === TODAY,
      recs, diarias, heCount, valorDiarias, valorHE,
      total: valorDiarias + valorHE,
    });
  }

  const totalDiarias      = allDays.reduce((s, d) => s + d.diarias, 0);
  const totalHE           = allDays.reduce((s, d) => s + d.heCount, 0);
  const totalValorDiarias = allDays.reduce((s, d) => s + d.valorDiarias, 0);
  const totalValorHE      = allDays.reduce((s, d) => s + d.valorHE, 0);
  const totalGeral        = totalValorDiarias + totalValorHE;

  const payment = PAYMENTS.find(p => {
    const ps = parsePeriodStart(p.period);
    return p.companyId === companyId && ps === start;
  });

  const rangeStr = `${String(sday).padStart(2,'0')}/${String(sm).padStart(2,'0')} — ${String(eday).padStart(2,'0')}/${String(sm).padStart(2,'0')}/${sy}`;

  // PDF — paleta minimalista (preto/cinza)
  const exportPDF = async () => {
    const dark    = [15, 23, 42];
    const mid     = [71, 85, 105];
    const light   = [148, 163, 184];
    const headBg  = [30, 41, 59];
    const rowAlt  = [248, 250, 252];

    const pdfRange = `(${String(sday).padStart(2,'0')}/${String(sm).padStart(2,'0')} a ${String(eday).padStart(2,'0')}/${String(sm).padStart(2,'0')})`;

    // Carrega o logo antes de gerar o PDF
    let logoDataUrl = null;
    let logoAspect  = 4;
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload  = () => resolve(i);
        i.onerror = reject;
        i.src = 'https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png';
      });
      logoAspect = img.width / img.height;
      const canvas = document.createElement('canvas');
      canvas.width  = img.width;
      canvas.height = img.height;
      canvas.getContext('2d').drawImage(img, 0, 0);
      logoDataUrl = canvas.toDataURL('image/png');
    } catch (_) {}

    const doc = new jsPDF();

    // ── Cabeçalho ────────────────────────────────────────────
    const headerH = 26;
    doc.setFillColor(...headBg);
    doc.rect(0, 0, 210, headerH, 'F');

    // Esquerda: título
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15); doc.setFont('helvetica', 'bold');
    doc.text('Relatório Quinzenal', 10, headerH / 2 + 3);

    // Direita: logo
    if (logoDataUrl) {
      const lH = 30;
      const lW = lH * logoAspect;
      doc.addImage(logoDataUrl, 'PNG', 210 - 10 - lW, (headerH - lH) / 2, lW, lH);
    }

    // ── Período e data de geração ────────────────────────────
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mid);
    doc.text(`Período: ${label}  ${pdfRange}`, 10, headerH + 9);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 10, headerH + 15);

    // ── Resumo do Período ────────────────────────────────────
    doc.setFontSize(10.5); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('Resumo do Período', 10, 53);

    autoTable(doc, {
      startY: 56,
      head: [['Diárias', 'Valor Diárias', 'H. Extras', 'Valor HE', 'Total Geral']],
      body: [[
        String(totalDiarias),
        fmtCurrency(totalValorDiarias),
        fmtHoursCount(totalHE),
        fmtCurrency(totalValorHE),
        fmtCurrency(totalGeral),
      ]],
      headStyles: {
        fillColor: headBg, textColor: 255,
        fontSize: 9.5, fontStyle: 'bold', halign: 'center',
      },
      bodyStyles: {
        fontSize: 10, fontStyle: 'bold', halign: 'center',
        textColor: dark,
      },
      columnStyles: {
        0: { textColor: mid },
        1: { textColor: mid },
        2: { textColor: mid },
        3: { textColor: mid },
        4: { textColor: dark, fontStyle: 'bold' },
      },
      margin: { left: 10, right: 10 },
    });

    // ── Extrato por Dia ──────────────────────────────────────
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
      headStyles: {
        fillColor: [241, 245, 249], textColor: mid,
        fontSize: 9.5, fontStyle: 'bold', halign: 'center',
      },
      bodyStyles: {
        fontSize: 9.5, textColor: dark, halign: 'center',
      },
      alternateRowStyles: { fillColor: rowAlt },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold', textColor: dark },
        5: { fontStyle: 'bold', textColor: dark },
      },
      margin: { left: 10, right: 10 },
    });

    // ── Rodapé: total + vencimento ───────────────────────────
    const y3 = doc.lastAutoTable.finalY + 8;
    doc.setFillColor(...rowAlt);
    doc.setDrawColor(200, 210, 220);
    doc.roundedRect(14, y3, 182, 20, 2, 2, 'FD');

    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(`Total da Cobrança: ${fmtCurrency(totalGeral)}`, 16, y3 + 10);

    if (payment?.dueDate) {
      const lbl = payment.status === 'paid'
        ? `Pago em: ${fmtDate(payment.paidDate)}`
        : `Vencimento: ${fmtDate(payment.dueDate)}`;
      doc.setFontSize(9); doc.setFont('helvetica', 'normal');
      doc.setTextColor(...mid);
      doc.text(lbl, 16, y3 + 18);
    }

    // ── Paginação ────────────────────────────────────────────
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(...light);
      doc.text(
        `FariLog © ${new Date().getFullYear()}   |   Página ${i} de ${pageCount}`,
        105, 290, { align: 'center' }
      );
    }
    doc.save(`relatorio-${label.replace(/[\/\s—]+/g, '-')}.pdf`);
  };

  const navBtn = (icon, fn) => (
    <button onClick={fn} className="p-1.5 rounded-lg"
      style={{ background: '#EEF2F7', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}>
      {icon}
    </button>
  );

  const COL = '1fr 62px 104px 62px 112px 108px 18px';

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold" style={T}>Relatório</h2>
          <p className="text-sm mt-0.5" style={TM}>Extrato detalhado por quinzena</p>
        </div>
        <button
          onClick={exportPDF}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(255,77,12,0.3)' }}
          onMouseEnter={e => e.currentTarget.style.background = '#E03A00'}
          onMouseLeave={e => e.currentTarget.style.background = '#FF4D0C'}
        >
          <FileDown size={13} /> Exportar PDF
        </button>
      </div>

      {/* Navegador quinzena — caixa branca */}
      <div className="card flex items-center justify-between p-3" style={{ background: '#FFFFFF' }}>
        {navBtn(<ChevronLeft size={15} />, () => setOffset(o => o - 1))}
        <div className="text-center">
          <p className="text-sm font-bold" style={{ color: '#0F172A' }}>{label}</p>
          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{rangeStr}</p>
        </div>
        {navBtn(<ChevronRight size={15} />, () => setOffset(o => Math.min(o + 1, 0)))}
      </div>

      {/* Stats — caixa branca com duas colunas */}
      <div className="card p-0 overflow-hidden" style={{ display: 'grid', gridTemplateColumns: '1fr 1px 1fr', background: '#FFFFFF' }}>
        {/* Diárias */}
        <div style={{ padding: '14px 20px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            Diárias: <span style={{ color: '#0369A1' }}>{totalDiarias}</span>
          </p>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            Valor: <span style={{ color: '#0369A1' }}>{fmtCurrency(totalValorDiarias)}</span>
          </p>
        </div>
        {/* Divisor vertical */}
        <div style={{ background: 'rgba(0,0,0,0.06)' }} />
        {/* H. Extra */}
        <div style={{ padding: '14px 20px', background: '#FFFFFF', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            Horas Extras: <span style={{ color: '#0369A1' }}>{fmtHoursCount(totalHE)}</span>
          </p>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            Valor HE: <span style={{ color: '#0369A1' }}>{fmtCurrency(totalValorHE)}</span>
          </p>
          <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)', margin: '2px 0' }} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
            Total: <span style={{ color: '#0369A1' }}>{fmtCurrency(totalGeral)}</span>
          </p>
        </div>
      </div>

      {/* Tabela por dia */}
      <div className="card overflow-hidden">
        {/* Cabeçalho */}
        <div style={{
          display: 'grid', gridTemplateColumns: COL,
          padding: '8px 16px', background: '#EEF2F7',
          borderBottom: '2px solid rgba(0,0,0,0.06)',
        }}>
          {['Data', 'Diárias', 'Val. Diária', 'H. Extra', 'Val. H. Extra', 'Total Dia', ''].map((h, i) => (
            <p key={i} style={{
              fontSize: '10px', fontWeight: 700, color: '#475569',
              textTransform: 'uppercase', letterSpacing: '0.05em',
              textAlign: i === 0 ? 'left' : 'center',
            }}>{h}</p>
          ))}
        </div>

        {allDays.map((day, idx) => {
          const hasData = day.diarias > 0 || day.heCount > 0;
          const isLast  = idx === allDays.length - 1;
          return (
            <button key={day.date}
              onClick={() => hasData && setSelectedDay(day.date)}
              disabled={!hasData}
              style={{
                width: '100%', display: 'grid', gridTemplateColumns: COL,
                alignItems: 'center', padding: '10px 16px', border: 'none',
                background: day.isWeekend ? 'rgba(238,242,247,0.6)' : hasData ? 'transparent' : 'transparent',
                cursor: hasData ? 'pointer' : 'default',
                borderBottom: !isLast ? '1px solid rgba(0,0,0,0.04)' : 'none',
                borderLeft: hasData ? '3px solid #FF4D0C' : '3px solid transparent',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => { if (hasData) e.currentTarget.style.background = '#FFF2EE'; }}
              onMouseLeave={e => { e.currentTarget.style.background = day.isWeekend ? 'rgba(238,242,247,0.6)' : 'transparent'; }}
            >
              {/* Data — sem destaque para hoje */}
              <p style={{
                fontSize: '12px', fontWeight: hasData ? 600 : 400,
                color: day.isWeekend ? '#CBD5E1' : hasData ? '#0F172A' : '#94A3B8',
              }}>{day.label}</p>

              {/* Diárias */}
              <p style={{ fontSize: '12px', fontWeight: 600, color: day.diarias > 0 ? '#0F172A' : '#E2E8F0', textAlign: 'center' }}>
                {day.diarias > 0 ? day.diarias : '—'}
              </p>

              {/* Val. Diária */}
              <p style={{ fontSize: '12px', fontWeight: 600, color: day.valorDiarias > 0 ? '#059669' : '#E2E8F0', textAlign: 'center' }}>
                {day.valorDiarias > 0 ? fmtCurrency(day.valorDiarias) : '—'}
              </p>

              {/* H. Extra — mesmo tamanho e cor das outras colunas */}
              <p style={{ fontSize: '12px', fontWeight: 600, color: day.heCount > 0 ? '#0F172A' : '#E2E8F0', textAlign: 'center' }}>
                {fmtHoursCount(day.heCount)}
              </p>

              {/* Val. H. Extra */}
              <p style={{ fontSize: '12px', fontWeight: 600, color: day.valorHE > 0 ? '#059669' : '#E2E8F0', textAlign: 'center' }}>
                {day.valorHE > 0 ? fmtCurrency(day.valorHE) : '—'}
              </p>

              {/* Total Dia */}
              <p style={{ fontSize: '12px', fontWeight: 700, color: day.total > 0 ? '#0F172A' : '#E2E8F0', textAlign: 'center' }}>
                {day.total > 0 ? fmtCurrency(day.total) : '—'}
              </p>

              {/* Chevron */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                {hasData && <ChevronRight size={13} style={{ color: '#FF4D0C' }} />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Total cobrança + vencimento — compacto */}
      <div className="card" style={{ padding: '12px 16px', borderTop: '2px solid #FF4D0C' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Total da cobrança: </span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: '#FF4D0C' }}>{fmtCurrency(totalGeral)}</span>
          </div>
          {payment ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>
                {payment.status === 'paid' ? 'Pago em:' : 'Vencimento:'}
              </span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: payment.status === 'paid' ? '#059669' : payment.status === 'overdue' ? '#E11D48' : '#D97706' }}>
                {payment.status === 'paid' && payment.paidDate ? fmtDate(payment.paidDate) : fmtDate(payment.dueDate)}
              </span>
              <span className={`badge badge-${payment.status}`}>
                {payment.status === 'paid' ? 'Pago' : payment.status === 'pending' ? 'Pendente' : 'Atrasado'}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: '11px', color: '#94A3B8' }}>Vencimento a definir</span>
          )}
        </div>
      </div>

      {selectedDay && (
        <DiaDetalheRelModal
          date={selectedDay}
          records={WORK_RECORDS.filter(r => r.companyId === companyId && r.date === selectedDay)}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function CompanyDashboard() {
  const { user }  = useAuth();
  const { tab }   = useOutletContext();

  return (
    <div className="animate-fade-up">
      {tab === 'panel'     && <Panel       companyId={user.id} />}
      {tab === 'escalas'   && <EscalasTab  companyId={user.id} />}
      {tab === 'financial' && <Financial   companyId={user.id} />}
      {tab === 'relatorio' && <RelatorioTab companyId={user.id} />}
      {tab === 'settings'  && <SettingsTab company={user} />}
    </div>
  );
}
