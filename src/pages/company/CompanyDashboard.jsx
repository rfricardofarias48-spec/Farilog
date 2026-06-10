import { useOutletContext } from 'react-router-dom';
import { useState, useRef, useEffect, createContext, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { STATUS_CONFIG } from '../admin/AdminDemanda';
import { fetchCompanyRecords, subscribeToCompanyRecords, fetchEscalaHojeByEmpresa, fetchRelatoriosByEmpresa, fetchEscalasComLiderByEmpresa, fetchCarretasByEscala, fetchCarretasByEscalas } from '../../lib/db';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PAYMENTS, fmtCurrency, fmtDate, WEEKDAYS, MONTHS } from '../../data/mockData';

// ── Contexto interno de dados da empresa ──────────────────────────────────
const CompanyDataCtx = createContext({ records: [], employees: [], escalas: [], relatorios: [] });
const useCompanyData = () => useContext(CompanyDataCtx);

// ── Helper WhatsApp ────────────────────────────────────────────────────────
function whatsappLink(telefone) {
  if (!telefone) return null;
  const digits = telefone.replace(/\D/g, '');
  const full   = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${full}`;
}

// ── WhatsApp SVG icon ─────────────────────────────────────────────────────
const WaSVG = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.057 23.884a.5.5 0 0 0 .606.634l6.193-1.623A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.127-1.415l-.368-.218-3.812 1 1.02-3.718-.24-.382A9.944 9.944 0 0 1 2 12C2 6.478 6.478 2 12 2s10 4.478 10 10-4.478 10-10 10z"/>
  </svg>
);

// ── Faixa do Líder — colada à escala, sem card separado ───────────────────
function LiderBadge({ lider }) {
  const waLink = lider ? whatsappLink(lider.telefone) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)', marginBottom: '12px' }}>
      {lider ? (
        <>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: lider.cor || '#FF4D0C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
            {lider.iniciais}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Líder de Equipe</p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lider.nome}</p>
          </div>
          {waLink ? (
            <a href={waLink} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '9px', background: '#DCFCE7', color: '#15803D', textDecoration: 'none', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
              <WaSVG size={13} /> WhatsApp
            </a>
          ) : (
            <span style={{ fontSize: '10px', color: '#CBD5E1', flexShrink: 0 }}>sem telefone</span>
          )}
        </>
      ) : (
        <>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: '18px', color: '#94A3B8' }}>👤</span>
          </div>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Líder de Equipe</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>Não atribuído</p>
          </div>
        </>
      )}
    </div>
  );
}
import {
  Clock, DollarSign, Users, CheckCircle2, Calendar,
  Phone, Mail, MapPin, Save, AlertTriangle, TrendingUp,
  CalendarCheck, UserCheck, UserX, X, ChevronRight, ChevronLeft, FileDown
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine
} from 'recharts';

// Data atual no fuso horário do Brasil (America/Sao_Paulo)
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const TODAY_DATE = new Date(TODAY + 'T12:00:00Z');

const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

function findEmp(employees, id) { return employees.find(e => e.id === id); }

// Normaliza para HH:MM (descarta segundos se presentes)
const fmtTime = (t) => {
  if (!t) return null;
  const parts = String(t).split(':');
  return `${String(parts[0]).padStart(2,'0')}:${String(parts[1] ?? '00').padStart(2,'0')}`;
};

// ── Observações persistidas no localStorage ───────────────────────────────
function useNotes() {
  const [notes, setNotesState] = useState(() => {
    try { return JSON.parse(localStorage.getItem('farilog_notes') || '{}'); }
    catch { return {}; }
  });
  const setNotes = (updater) => {
    setNotesState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      localStorage.setItem('farilog_notes', JSON.stringify(next));
      return next;
    });
  };
  return [notes, setNotes];
}

// ── Carretas descarregadas — persistidas no localStorage por escala ────────
function useTrucks(escalaKey) {
  const key = `farilog_trucks_${escalaKey}`;
  const [trucks, setTrucksState] = useState(() => {
    if (!escalaKey) return [];
    try { return JSON.parse(localStorage.getItem(key) || '[]'); }
    catch { return []; }
  });
  const setTrucks = (updater) => {
    setTrucksState(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (escalaKey) localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  return [trucks, setTrucks];
}

// ── Painel de carretas (reutilizável) ─────────────────────────────────────
function TrucksPanel({ escalaKey, escalaId, readOnly = false }) {
  const [trucks, setTrucks] = useTrucks(escalaKey);

  // Se for modo banco (escalaId fornecido), carrega do banco
  const [dbTrucks, setDbTrucks] = useState(null);
  useEffect(() => {
    if (!escalaId) return;
    fetchCarretasByEscala(escalaId).then(setDbTrucks);
  }, [escalaId]);

  const displayTrucks = escalaId ? (dbTrucks ?? []) : trucks;
  const add    = () => setTrucks(t => [...t, { id: Date.now().toString(), value: '' }]);
  const remove = (id) => setTrucks(t => t.filter(x => x.id !== id));
  const update = (id, value) => setTrucks(t => t.map(x => x.id === id ? { ...x, value } : x));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Descargas do Dia
        </p>
        {!readOnly && (
          <button onClick={add}
            style={{ fontSize: '11px', fontWeight: 700, color: '#FF4D0C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            + Nova
          </button>
        )}
      </div>

      {displayTrucks.length === 0 ? (
        readOnly ? (
          <p style={{ fontSize: '11px', color: '#CBD5E1', padding: '6px 0' }}>Nenhuma descarga registrada</p>
        ) : (
          <button onClick={add} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '6px 8px', borderRadius: '8px',
            border: '1.5px dashed #E2E8F0', background: 'transparent',
            cursor: 'pointer', color: '#94A3B8', fontSize: '11px', width: '100%',
          }}>
            + Adicionar carreta
          </button>
        )
      ) : (
        displayTrucks.map((truck, idx) => (
          <div key={truck.id} style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '6px 10px', borderRadius: '8px', background: '#EEF2F7',
          }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, color: '#94A3B8',
              flexShrink: 0, minWidth: '14px', textAlign: 'right',
            }}>{idx + 1}</span>
            <input
              value={truck.value}
              onChange={e => !readOnly && update(truck.id, e.target.value)}
              readOnly={readOnly}
              placeholder="Placa ou motorista..."
              style={{
                flex: 1, border: 'none', background: 'transparent',
                fontSize: '12px', fontWeight: 600, color: '#0F172A',
                outline: 'none', padding: 0, fontFamily: 'inherit', minWidth: 0,
                cursor: readOnly ? 'default' : 'text',
              }}
            />
            {!readOnly && (
              <button onClick={() => remove(truck.id)}
                style={{ color: '#CBD5E1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = '#E11D48'}
                onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}>
                <X size={12} />
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// Converte contagem de horas extras para formato HH:MM (ex: 3 → "03:00")
const fmtHoursCount = (n) => {
  if (!n) return '—';
  return `${String(n).padStart(2,'0')}:00`;
};

// ── Agrupamento por função ─────────────────────────────────────────────────
const GROUP_PALETTE = ['#3B82F6','#8B5CF6','#059669','#D97706','#0891B2','#EC4899'];
function groupByService(records) {
  const sorted = [...records].sort((a, b) => (a.service || '').localeCompare(b.service || ''));
  return sorted.reduce((acc, rec) => {
    const k = rec.service || 'Geral';
    if (!acc[k]) acc[k] = [];
    acc[k].push(rec);
    return acc;
  }, {});
}

// ── Helpers: quinzena detection & chart data ───────────────────────────────
const MONTH_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MONTH_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getQuinzenaInfo() {
  const day   = TODAY_DATE.getUTCDate();
  const month = TODAY_DATE.getUTCMonth();   // 0-indexed
  const year  = TODAY_DATE.getUTCFullYear();
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

function buildPeriodChartData(records, companyId, startIso, endIso) {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [,  ,  ed]   = endIso.split('-').map(Number);
  const days = [];
  for (let d = sd; d <= ed; d++) {
    const date = `${sy}-${String(sm).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow  = new Date(`${date}T12:00:00Z`).getUTCDay();
    const recs = records.filter(r => r.date === date && r.status !== 'absent');
    const isWeekend = dow === 0 || dow === 6;
    days.push({
      date,
      label: `${String(d).padStart(2,'0')}/${String(sm).padStart(2,'0')}`,
      shortDay: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dow],
      count: recs.length,
      value: recs.reduce((s, r) => s + (r.value || 150), 0),
      isWeekend,
    });
  }
  return days;
}

function getQuinzenaInfoByOffset(offset) {
  const base = getQuinzenaInfo();
  let { num, month, year } = base;
  const steps = Math.abs(offset);
  const dir   = offset < 0 ? -1 : 1;
  for (let i = 0; i < steps; i++) {
    if (dir < 0) {
      if (num === 1) { num = 2; month -= 1; if (month < 0) { month = 11; year -= 1; } }
      else           { num = 1; }
    } else {
      if (num === 2) { num = 1; month += 1; if (month > 11) { month = 0; year += 1; } }
      else           { num = 2; }
    }
  }
  const mm      = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startDay = num === 1 ? 1 : 16;
  const endDay   = num === 1 ? 15 : lastDay;
  return {
    num, startDay, endDay, month, year,
    badgeLabel: `${MONTH_FULL[month]}/${year} - Quinzena ${num}`,
    rangeLabel: num === 1
      ? `01/${mm} a 15/${mm}`
      : `16/${mm} a ${String(endDay).padStart(2,'0')}/${mm}`,
  };
}

function buildQuinzenaData(records, offset = 0) {
  const { startDay, endDay, month, year } = offset === 0 ? getQuinzenaInfo() : getQuinzenaInfoByOffset(offset);
  const days = [];
  for (let d = startDay; d <= endDay; d++) {
    const mm   = String(month + 1).padStart(2, '0');
    const dd   = String(d).padStart(2, '0');
    const date = `${year}-${mm}-${dd}`;
    const dow  = new Date(year, month, d).getDay();
    const recs = records.filter(r => r.date === date && r.status !== 'absent');
    const isToday   = date === TODAY;
    const isWeekend = dow === 0 || dow === 6;
    days.push({
      date,
      label: `${String(d).padStart(2,'0')}/${String(month + 1).padStart(2,'0')}`,
      shortDay: ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][dow],
      count: recs.length,
      value: recs.reduce((s, r) => s + (r.value || 150), 0),
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
function AjudantesModal({ records, escala, faltas, atrasos, date, tipoServico: tipoServicoProp, onClose }) {
  const { employees } = useCompanyData();
  const tipoServico = tipoServicoProp || records[0]?.tipoServico || 'entrega';
  const isCargaDescarga = tipoServico === 'carga_descarga';
  const dateLabel = date ? (() => {
    const [, m, d] = date.split('-');
    const dow = DOW_FULL[new Date(`${date}T12:00:00Z`).getUTCDay()];
    return `${dow}, ${d}/${m}`;
  })() : null;

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '780px' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: '#94A3B8', letterSpacing: '0.08em', marginBottom: '4px' }}>Escala do Dia</p>
            <h2 className="text-base font-bold" style={{ color: '#0F172A' }}>
              {dateLabel ? `${dateLabel}` : 'Ajudantes Escalados'}
            </h2>
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
              const emp = findEmp(employees, rec.employeeId);
              const timeCols = isCargaDescarga
                ? [{ label: 'Início', value: rec.checkIn }, { label: 'Final', value: rec.checkOut }]
                : [{ label: 'Entrada', value: rec.checkIn }, { label: 'S. Almoço', value: rec.lunchOut }, { label: 'Retorno', value: rec.lunchReturn }, { label: 'Saída', value: rec.checkOut }, { label: 'H. Extra', value: rec.overtime }];
              const gridCols = isCargaDescarga ? 'auto 160px 1fr 1fr auto' : 'auto 160px 1fr 1fr 1fr 1fr 1fr auto';
              return (
                <div key={rec.id} className="table-row" style={{ gridTemplateColumns: gridCols }}>
                  <div className="avatar" style={{ background: '#64748B' }}>{emp?.initials}</div>
                  <div className="px-3">
                    <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{emp?.name}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{rec.service}</p>
                  </div>
                  {timeCols.map(t => (
                    <div key={t.label} className="px-3 text-center">
                      <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 500, marginBottom: '2px' }}>{t.label}</p>
                      <div className="flex items-center justify-center gap-1" style={{ color: t.value ? '#0F172A' : '#CBD5E1' }}>
                        <Clock size={10} />
                        <span className="text-xs font-semibold">{fmtTime(t.value) ?? '—'}</span>
                      </div>
                    </div>
                  ))}
                  <span className={`badge ${rec.status === 'active' ? 'badge-active' : rec.status === 'absent' ? 'badge-inactive' : rec.status === 'scheduled' ? 'badge-pending' : 'badge-paid'}`}>
                    {rec.status === 'active' ? 'Ativo' : rec.status === 'absent' ? 'Falta' : rec.status === 'scheduled' ? 'Agendado' : 'Concluído'}
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
  const dow = DOW_FULL[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return `${dow}, ${d}/${m}/${y}`;
}

function fmtDateShort(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  const dow = DOW_FULL[new Date(`${iso}T12:00:00Z`).getUTCDay()];
  return `${dow}, ${d}/${m}`;
}

const OPER_STATUS_CFG = {
  agendado:     { label: 'Agendado',     sublabel: 'Aguardando início', color: '#94A3B8', bg: '#1E293B', border: 'rgba(148,163,184,0.15)', dot: '#64748B' },
  em_andamento: { label: 'Em andamento', sublabel: 'Operação ativa',    color: '#FCD34D', bg: '#78350F', border: 'rgba(245,158,11,0.3)',   dot: '#F59E0B' },
  finalizado:   { label: 'Finalizado',   sublabel: 'Concluído',         color: '#86EFAC', bg: '#14532D', border: 'rgba(16,185,129,0.3)',   dot: '#10B981' },
};

function EscalaCard({ title, date, accentColor, badgeLabel, badgeBg, records, isToday, lider, onVerMais, tipoServico, escalaId }) {
  const { employees } = useCompanyData();
  const [showModal, setShowModal] = useState(false);
  const [popupEmp, setPopupEmp] = useState(null);
  const [notes, setNotes] = useNotes();
  const isCargaDescarga = tipoServico === 'carga_descarga';
  const escala    = records.length;
  const faltas    = isToday ? records.filter(r => r.status === 'absent').length : 0;
  const atrasos   = isToday ? records.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length : 0;
  const presentes = escala - faltas;
  const pct       = escala > 0 ? Math.round((presentes / escala) * 100) : 0;

  // Horário da equipe (para carga_descarga)
  const presentRecs = records.filter(r => r.status !== 'absent');
  const teamStart   = presentRecs.filter(r => r.checkIn).map(r => r.checkIn).sort()[0] ?? null;
  const teamEnd     = presentRecs.filter(r => r.checkOut).map(r => r.checkOut).sort().reverse()[0] ?? null;
  const operStatus  = !teamStart ? 'agendado' : !teamEnd ? 'em_andamento' : 'finalizado';
  const operCfg     = OPER_STATUS_CFG[operStatus];

  return (
    <div className="card p-5" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

      {/* Header */}
      <div>
        <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#94A3B8', textTransform: 'uppercase' }}>{title}</span>
        <p className="text-sm font-bold mt-0.5" style={T}>{date ? fmtDateShort(date) : 'Sem agendamento'}</p>
      </div>

      {/* Líder — bloco destacado */}
      {lider ? (() => {
        const waLink = whatsappLink(lider.telefone);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: lider.cor || '#FF4D0C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
              {lider.iniciais}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Líder de Equipe</p>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lider.nome}</p>
            </div>
            {waLink ? (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '9px', background: '#DCFCE7', color: '#15803D', textDecoration: 'none', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                <WaSVG size={13} /> WhatsApp
              </a>
            ) : (
              <span style={{ fontSize: '10px', color: '#CBD5E1', flexShrink: 0 }}>sem telefone</span>
            )}
          </div>
        );
      })() : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Users size={18} style={{ color: '#94A3B8' }} />
          </div>
          <div>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Líder de Equipe</p>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>Não atribuído</p>
          </div>
        </div>
      )}

      {/* ── Stats ── */}
      {isCargaDescarga ? (
        /* Carga/Descarga: Escala | Início | Final | Status (dark) — compacto */
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.1fr', gap: '8px', alignItems: 'stretch' }}>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Escala</p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala}</p>
          </div>
          <div style={{ padding: '10px 6px', borderRadius: '10px', background: '#F8FAFC', textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Início</p>
            <p style={{ fontSize: '16px', fontWeight: 800, color: teamStart ? '#0F172A' : '#CBD5E1', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{teamStart ?? '—'}</p>
          </div>
          <div style={{ padding: '10px 6px', borderRadius: '10px', background: '#F8FAFC', textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Final</p>
            <p style={{ fontSize: '16px', fontWeight: 800, color: teamEnd ? '#059669' : '#CBD5E1', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{teamEnd ?? '—'}</p>
          </div>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: operCfg.bg, border: `1px solid ${operCfg.border}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: operCfg.dot, boxShadow: `0 0 0 3px ${operCfg.dot}33`, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: 800, color: operCfg.color, lineHeight: 1.2 }}>{operCfg.label}</span>
            <span style={{ fontSize: '9px', fontWeight: 500, color: operCfg.color, opacity: 0.7, lineHeight: 1 }}>{operCfg.sublabel}</span>
          </div>
        </div>
      ) : isToday ? (
        /* Entrega: Escala + Faltas/Atrasos + Presença */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', marginBottom: '4px' }}>Escala</p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala}</p>
          </div>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8' }}>Faltas</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: faltas > 0 ? '#E11D48' : '#CBD5E1' }}>{faltas}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8' }}>Atrasos</span>
                <span style={{ fontSize: '14px', fontWeight: 800, color: atrasos > 0 ? '#D97706' : '#CBD5E1' }}>{atrasos}</span>
              </div>
            </div>
          </div>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', textAlign: 'center', border: '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', marginBottom: '4px' }}>Presença</p>
            <p style={{ fontSize: '20px', fontWeight: 800, color: escala > 0 ? '#0F172A' : '#CBD5E1', lineHeight: 1 }}>{escala > 0 ? `${pct}%` : '—'}</p>
            <p style={{ fontSize: '10px', fontWeight: 500, color: '#94A3B8', marginTop: '2px' }}>{escala > 0 ? `${presentes}/${escala}` : '0/0'}</p>
          </div>
        </div>
      ) : (
        /* Próxima escala (entrega): só contagem */
        <div style={{ padding: '10px 16px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala}</span>
          <span style={{ fontSize: '11px', fontWeight: 500, color: '#94A3B8' }}>ajudante{escala !== 1 ? 's' : ''} agendado{escala !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Barra de presença (entrega apenas) */}
      {isToday && !isCargaDescarga && escala > 0 && (
        <div style={{ height: '3px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)' }}>
          <div style={{ height: '100%', borderRadius: '4px', background: '#0F172A', width: `${pct}%`, transition: 'width 0.4s ease' }} />
        </div>
      )}

      {/* ── Conteúdo principal ── */}
      {isCargaDescarga ? (
        /* ── CARGA E DESCARGA: equipe (esq) + carretas (dir) ── */
        records.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#CBD5E1', textAlign: 'center', padding: '20px 0' }}>
            {isToday ? 'Nenhum ajudante hoje' : 'Nenhuma escala agendada'}
          </p>
        ) : (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>

            {/* Esquerda: equipe com observações */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <button
                onClick={() => onVerMais ? onVerMais() : setShowModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '8px', background: '#0F172A', color: 'white', border: 'none', cursor: 'pointer', alignSelf: 'flex-start', marginBottom: '10px' }}>
                <Users size={11} /> Equipe
              </button>
              {records.map(rec => {
                const emp = findEmp(employees, rec.employeeId);
                const isAbsent = rec.status === 'absent';
                return (
                  <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '8px', background: isAbsent ? 'rgba(244,63,94,0.05)' : '#EEF2F7' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: isAbsent ? '#D1D9E0' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: isAbsent ? '#64748B' : 'white', flexShrink: 0 }}>
                      {emp?.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '11px', fontWeight: 700, color: isAbsent ? '#94A3B8' : '#0F172A', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {emp?.name}
                      </p>
                    </div>
                    {isAbsent && (
                      <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#FFE4E6', color: '#E11D48', flexShrink: 0 }}>Falta</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Separador */}
            <div style={{ width: '1px', background: 'rgba(0,0,0,0.06)', alignSelf: 'stretch', flexShrink: 0 }} />

            {/* Direita: carretas descarregadas */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <TrucksPanel escalaKey={escalaId || date} escalaId={escalaId} readOnly={true} />
            </div>

          </div>
        )
      ) : (
        /* ── ENTREGA: lista agrupada por serviço com horários individuais ── */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '4px' }}>
            {records.length > 0 && (
              <button onClick={() => onVerMais ? onVerMais() : setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: 600, color: '#64748B', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                Ver mais <ChevronRight size={12} />
              </button>
            )}
          </div>
          {records.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#CBD5E1', textAlign: 'center', padding: '20px 0' }}>
              {isToday ? 'Nenhum ajudante hoje' : 'Nenhuma escala agendada'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {Object.entries(groupByService(records)).map(([service, recs], gIdx) => (
                <div key={service}>
                  {recs.map(rec => {
                    const emp = findEmp(employees, rec.employeeId);
                    const isAbsent = rec.status === 'absent';
                    return (
                      <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 8px', borderRadius: '8px', background: isAbsent ? 'rgba(244,63,94,0.05)' : '#EEF2F7' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: isAbsent ? '#D1D9E0' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: isAbsent ? '#64748B' : 'white', flexShrink: 0 }}>
                          {emp?.initials}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p onClick={() => setPopupEmp(emp)} style={{ fontSize: '11px', fontWeight: 700, color: isAbsent ? '#94A3B8' : '#0F172A', cursor: 'pointer', lineHeight: 1.2 }}>
                            {emp?.name}
                          </p>
                        </div>
                        {isAbsent ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                            <Clock size={9} style={{ color: '#E11D48' }} />
                            <span style={{ fontSize: '10px', fontWeight: 700, color: '#E11D48' }}>Falta</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                            <Clock size={9} style={{ color: '#64748B' }} />
                            <span style={{ fontSize: '10px', fontWeight: 700, color: rec.checkIn ? '#0F172A' : '#94A3B8' }}>
                              {fmtTime(rec.checkIn) ?? '—'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <AjudantesModal
          records={records}
          escala={escala}
          faltas={faltas}
          atrasos={atrasos}
          date={date}
          tipoServico={tipoServico}
          onClose={() => setShowModal(false)}
        />
      )}

      {popupEmp && (
        <AjudantePopup emp={popupEmp} onClose={() => setPopupEmp(null)} />
      )}
    </div>
  );
}

function Panel({ companyId, setTab, companyName }) {
  const { records, escalas } = useCompanyData();

  const todayRecords = records.filter(r => r.date === TODAY);

  const futureRecords = records.filter(r => r.date > TODAY && r.status === 'scheduled');
  const nextDate = futureRecords.length > 0
    ? futureRecords.reduce((min, r) => r.date < min ? r.date : min, futureRecords[0].date)
    : null;
  const nextRecords = nextDate ? futureRecords.filter(r => r.date === nextDate) : [];

  const todayEscala = escalas.find(e => e.date === TODAY);
  const todayLider  = todayEscala?.lider || null;
  const todayTipo   = todayEscala?.tipoServico || 'entrega';
  const nextEscala  = nextDate ? escalas.find(e => e.date === nextDate) : null;
  const nextLider   = nextEscala?.lider || null;
  const nextTipo    = nextEscala?.tipoServico || 'entrega';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold" style={T}>Olá, <span style={{ fontWeight: 400, fontSize: '16px' }}>{companyName}</span></h2>
      </div>

      {/* Duas caixas lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '16px', alignItems: 'start' }}>
        <EscalaCard
          title="Escala do Dia"
          date={TODAY}
          accentColor="#64748B"
          badgeLabel="Hoje"
          badgeBg="#F1F5F9"
          records={todayRecords}
          isToday={true}
          lider={todayLider}
          tipoServico={todayTipo}
          escalaId={todayEscala?.id}
          onVerMais={() => setTab('escalas')}
        />
        <EscalaCard
          title="Próxima Escala"
          date={nextDate}
          accentColor="#64748B"
          badgeLabel={nextDate ? fmtDateShort(nextDate) : 'Sem agend.'}
          badgeBg="#F1F5F9"
          records={nextRecords}
          isToday={false}
          lider={nextLider}
          tipoServico={nextTipo}
          escalaId={nextEscala?.id}
        />
      </div>
    </div>
  );
}

// ── Modal: detalhe de um dia ───────────────────────────────────────────────
function DiaModal({ date, records, onClose }) {
  const { employees } = useCompanyData();
  const isCargaDescarga = (records[0]?.tipoServico || 'entrega') === 'carga_descarga';
  const escala    = records.length;
  const faltas    = records.filter(r => r.status === 'absent').length;
  const atrasos   = records.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length;
  const presentes = escala - faltas;
  const pct       = escala > 0 ? Math.round((presentes / escala) * 100) : 0;
  const pctColor  = pct >= 80 ? '#059669' : pct >= 50 ? '#D97706' : '#E11D48';

  const [y, m, d] = date.split('-');
  const dow = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][new Date(`${date}T12:00:00Z`).getUTCDay()];
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
            const emp = findEmp(employees, rec.employeeId);
            const timeCols = isCargaDescarga
              ? [{ label: 'Início', value: rec.checkIn }, { label: 'Final', value: rec.checkOut }]
              : [{ label: 'Entrada', value: rec.checkIn }, { label: 'S. Almoço', value: rec.lunchOut }, { label: 'Retorno', value: rec.lunchReturn }, { label: 'Saída', value: rec.checkOut }, { label: 'H. Extra', value: rec.overtime }];
            const gridCols = isCargaDescarga ? 'auto 160px 1fr 1fr auto' : 'auto 160px 1fr 1fr 1fr 1fr 1fr auto';
            return (
              <div key={rec.id} className="table-row" style={{ gridTemplateColumns: gridCols }}>
                <div className="avatar" style={{ background: '#64748B' }}>{emp?.initials}</div>
                <div className="px-3">
                  <p className="text-xs font-semibold" style={T}>{emp?.name}</p>
                  <p className="text-xs" style={TM}>{rec.service}</p>
                </div>
                {timeCols.map(t => (
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

  const handlePeriod = (p) => { setPeriod(p); setOffset(0); setShowCal(false); };

  const { records, employees, escalas } = useCompanyData();
  const allRecords = records;
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
      const dow = DOW_SHORT[new Date(`${date}T12:00:00Z`).getUTCDay()];
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
          const emp = findEmp(employees, rec.employeeId);
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
          const escala      = recs.length;
          const isToday     = date === TODAY;
          const [, m, d]    = date.split('-');
          const dow         = DOW_SHORT[new Date(`${date}T12:00:00Z`).getUTCDay()];
          const dateEscala  = escalas.find(e => e.date === date);
          const isCargaDescarga = (dateEscala?.tipoServico || recs[0]?.tipoServico || 'entrega') === 'carga_descarga';

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
                <div style={{ textAlign:'center' }}>
                  <p className="text-xs uppercase font-semibold" style={{ color:'#94A3B8', letterSpacing:'0.05em' }}>{dow}</p>
                  <p className="text-lg font-black leading-tight" style={{ color: isToday ? '#FF4D0C' : '#0F172A' }}>{d}/{m}</p>
                </div>
                <div style={{ width:'1px', height:'28px', background:'rgba(0,0,0,0.08)', justifySelf:'center' }} />
                <p style={{ fontSize:'13px', fontWeight:600, color:'#475569' }}>
                  {isCargaDescarga ? 'Carga e Descarga' : 'Entrega'}
                  <span style={{ fontWeight:400, color:'#94A3B8' }}> ({escala} ajudante{escala !== 1 ? 's' : ''})</span>
                </p>
              </div>
              <ChevronRight size={14} style={{ color:'#CBD5E1', flexShrink:0, marginLeft:'8px' }} />
            </button>
          );
        })}
      </div>

      {/* Modal de detalhe do dia — mesmo design das escalas */}
      {selectedDay && (() => {
        const date       = selectedDay;
        const dateRecs   = records.filter(r => r.date === date);
        const dateEscala = escalas.find(e => e.date === date);
        const dateLider  = dateEscala?.lider || null;
        const isCargaDescarga = (dateEscala?.tipoServico || dateRecs[0]?.tipoServico || 'entrega') === 'carga_descarga';
        const escala  = dateRecs.length;
        const faltas  = dateRecs.filter(r => r.status === 'absent').length;
        const atrasos = dateRecs.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length;
        const presentes = dateRecs.filter(r => r.status !== 'absent');
        const pct = escala > 0 ? Math.round((presentes.length / escala) * 100) : 0;
        const teamStart = presentes.filter(r => r.checkIn).map(r => r.checkIn).sort()[0] ?? null;
        const teamEnd   = presentes.filter(r => r.checkOut).map(r => r.checkOut).sort().reverse()[0] ?? null;
        const operStatus = !teamStart ? 'agendado' : !teamEnd ? 'em_andamento' : 'finalizado';
        const operCfg    = OPER_STATUS_CFG[operStatus];
        const [y, m, d]  = date.split('-').map(Number);
        const dow = DOW_FULL[new Date(y, m - 1, d).getDay()];

        return createPortal(
          <div onClick={e => e.target === e.currentTarget && setSelectedDay(null)}
            style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(15,23,42,0.45)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
            <div style={{ background:'#fff', borderRadius:'18px', boxShadow:'0 20px 60px rgba(0,0,0,0.18)', width:'100%', maxWidth:'820px', height:'90vh', overflowY:'auto', display:'flex', flexDirection:'column' }}>

              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'20px 24px 16px', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
                <div>
                  <p style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'4px' }}>Histórico</p>
                  <h2 style={{ fontSize:'18px', fontWeight:800, color:'#0F172A' }}>{dow}, {String(d).padStart(2,'0')}/{String(m).padStart(2,'0')}/{y}</h2>
                </div>
                <button onClick={() => setSelectedDay(null)} style={{ background:'#F1F5F9', border:'none', borderRadius:'8px', padding:'6px', cursor:'pointer', display:'flex', color:'#64748B' }}>
                  <X size={15} />
                </button>
              </div>

              <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>

                {/* Líder */}
                {dateLider ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 12px', borderRadius:'12px', background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.07)' }}>
                    <div style={{ width:'40px', height:'40px', borderRadius:'12px', background: dateLider.cor || '#64748B', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:800, color:'white', flexShrink:0 }}>
                      {dateLider.iniciais}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'1px' }}>Líder de Equipe</p>
                      <p style={{ fontSize:'14px', fontWeight:700, color:'#0F172A' }}>{dateLider.nome}</p>
                    </div>
                    {whatsappLink(dateLider.telefone) && (
                      <a href={whatsappLink(dateLider.telefone)} target="_blank" rel="noopener noreferrer"
                        style={{ display:'flex', alignItems:'center', gap:'5px', padding:'7px 12px', borderRadius:'9px', background:'#DCFCE7', color:'#15803D', textDecoration:'none', fontSize:'12px', fontWeight:700, flexShrink:0 }}>
                        <WaSVG size={13} /> WhatsApp
                      </a>
                    )}
                  </div>
                ) : (
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'12px', background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.07)' }}>
                    <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#E2E8F0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <Users size={18} style={{ color:'#94A3B8' }} />
                    </div>
                    <div>
                      <p style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'1px' }}>Líder de Equipe</p>
                      <p style={{ fontSize:'13px', fontWeight:600, color:'#94A3B8' }}>Não atribuído</p>
                    </div>
                  </div>
                )}

                {/* KPI cards */}
                {isCargaDescarga ? (
                  <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr 1.1fr', gap:'8px' }}>
                    <div style={{ padding:'10px 8px', borderRadius:'10px', background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.06)', textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px' }}>
                      <p style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Escala</p>
                      <p style={{ fontSize:'24px', fontWeight:800, color:'#0F172A', lineHeight:1 }}>{escala}</p>
                    </div>
                    <div style={{ padding:'10px 6px', borderRadius:'10px', background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.06)', textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px' }}>
                      <p style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Início</p>
                      <p style={{ fontSize:'16px', fontWeight:800, color: teamStart ? '#0F172A' : '#CBD5E1', lineHeight:1 }}>{teamStart ?? '—'}</p>
                    </div>
                    <div style={{ padding:'10px 6px', borderRadius:'10px', background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.06)', textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px' }}>
                      <p style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Final</p>
                      <p style={{ fontSize:'16px', fontWeight:800, color: teamEnd ? '#059669' : '#CBD5E1', lineHeight:1 }}>{teamEnd ?? '—'}</p>
                    </div>
                    <div style={{ padding:'10px 8px', borderRadius:'10px', background: operCfg.bg, border:`1px solid ${operCfg.border}`, textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                      <span style={{ width:'8px', height:'8px', borderRadius:'50%', background: operCfg.dot, boxShadow:`0 0 0 3px ${operCfg.dot}33` }} />
                      <span style={{ fontSize:'11px', fontWeight:800, color: operCfg.color, lineHeight:1.2 }}>{operCfg.label}</span>
                      <span style={{ fontSize:'9px', fontWeight:500, color: operCfg.color, opacity:0.7 }}>{operCfg.sublabel}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
                    <div style={{ padding:'10px 8px', borderRadius:'10px', background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.06)', textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px' }}>
                      <p style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Escala</p>
                      <p style={{ fontSize:'24px', fontWeight:800, color:'#0F172A', lineHeight:1 }}>{escala}</p>
                    </div>
                    <div style={{ padding:'10px 8px', borderRadius:'10px', background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.06)', display:'flex', flexDirection:'column', justifyContent:'center', gap:'6px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8' }}>Faltas</span>
                        <span style={{ fontSize:'16px', fontWeight:800, color: faltas > 0 ? '#E11D48' : '#CBD5E1' }}>{faltas}</span>
                      </div>
                      <div style={{ height:'1px', background:'rgba(0,0,0,0.07)' }} />
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <span style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8' }}>Atrasos</span>
                        <span style={{ fontSize:'16px', fontWeight:800, color: atrasos > 0 ? '#D97706' : '#CBD5E1' }}>{atrasos}</span>
                      </div>
                    </div>
                    <div style={{ padding:'10px 8px', borderRadius:'10px', background:'#F8FAFC', border:'1px solid rgba(0,0,0,0.06)', textAlign:'center', display:'flex', flexDirection:'column', justifyContent:'center', gap:'4px' }}>
                      <p style={{ fontSize:'10px', fontWeight:600, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Presença</p>
                      <p style={{ fontSize:'20px', fontWeight:800, color: escala > 0 ? '#0F172A' : '#CBD5E1', lineHeight:1 }}>{escala > 0 ? `${pct}%` : '—'}</p>
                    </div>
                  </div>
                )}

                {/* Equipe + Descargas */}
                <div>
                  <p style={{ fontSize:'10px', fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>Equipe</p>
                  {dateRecs.length === 0 ? (
                    <p style={{ fontSize:'12px', color:'#94A3B8' }}>Nenhum registro neste dia</p>
                  ) : isCargaDescarga ? (
                    <div style={{ display:'flex', gap:'16px', alignItems:'flex-start' }}>
                      <div style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:'4px' }}>
                        {Object.entries(groupByService(presentes)).map(([service, recs], gIdx) => (
                          <div key={service}>
                            {recs.map(rec => {
                              const emp = findEmp(employees, rec.employeeId);
                              return (
                                <div key={rec.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', borderRadius:'10px', background:'#EEF2F7', marginBottom:'3px' }}>
                                  <div className="avatar" style={{ background:'#64748B' }}>{emp?.initials}</div>
                                  <p style={{ fontSize:'12px', fontWeight:700, color:'#0F172A', flex:1 }}>{emp?.name}</p>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                      <div style={{ width:'1px', background:'rgba(0,0,0,0.06)', alignSelf:'stretch', flexShrink:0 }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <TrucksPanel escalaKey={dateEscala?.id || date} escalaId={dateEscala?.id} readOnly={true} />
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                      {Object.entries(groupByService(dateRecs)).map(([service, recs], gIdx) => (
                        <div key={service}>
                          {recs.map(rec => {
                            const emp = findEmp(employees, rec.employeeId);
                            const isAbsent = rec.status === 'absent';
                            return (
                              <div key={rec.id} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 12px', borderRadius:'10px', background: isAbsent ? 'rgba(244,63,94,0.05)' : '#EEF2F7', marginBottom:'3px' }}>
                                <div className="avatar" style={{ background: isAbsent ? '#D1D9E0' : '#64748B', color: isAbsent ? '#64748B' : 'white' }}>{emp?.initials}</div>
                                <p style={{ fontSize:'12px', fontWeight:700, color: isAbsent ? '#94A3B8' : '#0F172A', flex:1 }}>{emp?.name}</p>
                                {isAbsent && <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'6px', background:'#FFE4E6', color:'#E11D48', flexShrink:0 }}>Falta</span>}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>,
          document.body
        );
      })()}
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
      <p style={{ color:'#94A3B8', fontSize:'10px', fontWeight:600, marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.06em' }}>{d?.shortDay}, {d?.label}</p>
      <p style={{ color:'#059669', fontSize:'15px', fontWeight:700 }}>{fmtCurrency(d?.value || 0)}</p>
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
// total = soma(rec.value) + (horas extras × VALOR_HORA_EXTRA)
function calcPaymentTotal(payment, records) {
  const pStart = parsePeriodStart(payment.period);
  const pEnd   = parsePeriodEnd(payment.period);
  if (!pStart || !pEnd) return { total: 0, diarias: 0, heCount: 0, valorDiarias: 0, valorHE: 0 };
  const recs     = records.filter(r => r.date >= pStart && r.date <= pEnd);
  const presentes = recs.filter(r => r.status !== 'absent');
  const diarias  = presentes.length;
  const heCount  = presentes.filter(r => r.overtime).length;
  const valorDiarias = presentes.reduce((s, r) => s + (r.value || VALOR_DIARIA), 0);
  const valorHE      = heCount * VALOR_HORA_EXTRA;
  return { total: valorDiarias + valorHE, diarias, heCount, valorDiarias, valorHE };
}

// ── Modal de detalhe de um período de pagamento ────────────────────────────
function FinPeriodModal({ payment, companyId, onClose }) {
  const { records } = useCompanyData();
  const [selectedDay, setSelectedDay] = useState(null);

  const pStart = parsePeriodStart(payment.period);
  const pEnd   = parsePeriodEnd(payment.period);
  const label  = formatPeriod(payment.period);

  // Todos os registros da empresa no período
  const allRecs = records.filter(r => r.date >= pStart && r.date <= pEnd);

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
              const dow = DOW_SHORT[new Date(`${date}T12:00:00Z`).getUTCDay()];
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
          records={records.filter(r => r.date === selectedDay)}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </>,
    document.body
  );
}

// ── Financial ──────────────────────────────────────────────────────────────
function Financial({ companyId }) {
  const [qOffset,         setQOffset]         = useState(0);
  const [selectedPayment, setSelectedPayment] = useState(null);

  const { records } = useCompanyData();
  const myPayments  = PAYMENTS.filter(p => p.companyId === companyId).sort((a,b) => b.dueDate.localeCompare(a.dueDate));
  const nextPayment = myPayments.find(p => p.status === 'pending');
  const daysLeft    = nextPayment ? Math.ceil((new Date(nextPayment.dueDate) - TODAY_DATE) / 86400000) : null;

  const quinzenaInfo  = qOffset === 0 ? getQuinzenaInfo() : getQuinzenaInfoByOffset(qOffset);
  const quinzenaData  = buildQuinzenaData(records, qOffset);
  const quinzenaTotal = quinzenaData.reduce((s, d) => s + d.count, 0);
  const quinzenaValue = quinzenaData.reduce((s, d) => s + d.value, 0);
  const maxValue      = Math.max(...quinzenaData.map(d => d.value), 1);

  return (
    <div className="space-y-5">

      {/* Header + navegação de quinzena */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={T}>Financeiro</h2>
          <p className="text-sm mt-0.5" style={TM}>Pagamentos quinzenais nos dias 5 e 20</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <button onClick={() => setQOffset(o => o - 1)}
            style={{ width: '32px', height: '32px', borderRadius: '9px', background: '#F1F5F9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', minWidth: '160px', textAlign: 'center' }}>
            {quinzenaInfo.badgeLabel}
          </span>
          <button onClick={() => setQOffset(o => Math.min(o + 1, 0))} disabled={qOffset >= 0}
            style={{ width: '32px', height: '32px', borderRadius: '9px', background: qOffset < 0 ? '#F1F5F9' : 'transparent', border: 'none', cursor: qOffset < 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: qOffset < 0 ? '#64748B' : '#CBD5E1' }}>
            <ChevronRight size={16} />
          </button>
          {qOffset < 0 && (
            <button onClick={() => setQOffset(0)}
              style={{ padding: '6px 14px', borderRadius: '9px', background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Período Atual
            </button>
          )}
        </div>
      </div>

      {/* ══ Quinzena ════════════════════════════════════════════════════════ */}
      <>
        {/* Próximo pagamento — só na quinzena atual */}
        {qOffset === 0 && nextPayment && (
          <div className="card p-5" style={{ borderLeft: '4px solid #D97706' }}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={14} style={{ color: '#D97706' }} />
              <span className="text-sm font-semibold" style={{ color: '#D97706' }}>Próximo Pagamento</span>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="font-bold text-2xl" style={T}>{fmtCurrency(calcPaymentTotal(nextPayment, records).total)}</p>
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
                  {quinzenaInfo.badgeLabel} <span style={{ color: '#0F172A', fontWeight: 500 }}>({quinzenaInfo.rangeLabel})</span>
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs" style={TM}>Faturado na quinzena</p>
                <p className="font-bold text-lg" style={{ color:'#059669' }}>{fmtCurrency(quinzenaValue)}</p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={quinzenaData} margin={{ top: 8, right: 8, bottom: 4, left: 8 }} barSize={28} barCategoryGap="25%">
                <defs>
                  <linearGradient id="finBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#059669" stopOpacity={1} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.65} />
                  </linearGradient>
                  <linearGradient id="finToday" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#FF4D0C" stopOpacity={1} />
                    <stop offset="100%" stopColor="#FF4D0C" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="finEmpty" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#E2E8F0" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#F1F5F9" stopOpacity={0.9} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'Inter' }}
                  axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  width={55}
                  tick={{ fill: '#475569', fontSize: 10, fontFamily: 'Inter' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                  domain={[0, maxValue + 200]}
                  tickFormatter={v => v === 0 ? '' : `R$${v}`}
                />
                <Tooltip content={<FinTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)', radius: 4 }} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                  {quinzenaData.map((d, i) => (
                    <Cell key={i} fill={d.isWeekend || d.count === 0 ? 'url(#finEmpty)' : 'url(#finBar)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="flex items-center gap-5 mt-3 pt-3" style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
              {[
                { solid: '#059669', label: 'Dias faturados' },
                { solid: '#E2E8F0', label: 'Sem faturamento' },
              ].map((l, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.solid }} />
                  <span className="text-xs" style={TM}>{l.label}</span>
                </div>
              ))}
            </div>

          </div>

        {/* Valor a pagar + Data de pagamento — fora da caixa do gráfico */}
        {(() => {
          const { num, month, year } = quinzenaInfo;
          let payDay, payMonth, payYear;
          if (num === 1) { payDay = 20; payMonth = month; payYear = year; }
          else { payDay = 5; payMonth = month + 1; payYear = year; if (payMonth > 11) { payMonth = 0; payYear += 1; } }
          const payStr = `${String(payDay).padStart(2,'0')}/${String(payMonth + 1).padStart(2,'0')}/${payYear}`;
          return (
            <div style={{ padding: '20px 28px', borderRadius: '16px', background: '#F0FDF4', border: '1px solid rgba(16,185,129,0.2)', display: 'inline-flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Valor a pagar</p>
                <p style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{fmtCurrency(quinzenaValue)}</p>
              </div>
              <div style={{ height: '1px', background: 'rgba(16,185,129,0.2)' }} />
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Data de pagamento</p>
                <p style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{payStr}</p>
              </div>
            </div>
          );
        })()}

        {/* Alertas de atraso — só na quinzena atual */}
        {qOffset === 0 && myPayments.filter(p => p.status === 'overdue').map(p => (
          <div key={p.id} className="card p-4 flex items-center gap-3"
            style={{ border: '1px solid rgba(220,38,38,0.2)', borderLeft: '4px solid #DC2626' }}>
            <AlertTriangle size={18} style={{ color: '#DC2626' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#DC2626' }}>Pagamento em atraso</p>
              <p className="text-xs" style={TM}>{fmtCurrency(calcPaymentTotal(p, records).total)} · venceu em {fmtDate(p.dueDate)}</p>
            </div>
          </div>
        ))}
      </>


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
  const { records, employees, escalas } = useCompanyData();
  const [showModal, setShowModal] = useState(false);
  const [notes, setNotes] = useNotes();
  const todayRecords   = records.filter(r => r.date === TODAY);
  const todayEscala    = escalas.find(e => e.date === TODAY);
  const todayLider     = todayEscala?.lider || null;
  const isCargaDescarga = (todayEscala?.tipoServico || todayRecords[0]?.tipoServico || 'entrega') === 'carga_descarga';
  const escala         = todayRecords.length;
  const faltas         = todayRecords.filter(r => r.status === 'absent').length;
  const atrasos        = todayRecords.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length;
  const presenteCount  = todayRecords.filter(r => r.status !== 'absent').length;
  const pct            = escala > 0 ? Math.round((presenteCount / escala) * 100) : 0;

  // Para carga e descarga: horário da equipe (mínimo de entrada, máximo de saída)
  const presentes = todayRecords.filter(r => r.status !== 'absent');
  const teamStart = presentes.length > 0
    ? presentes.filter(r => r.checkIn).map(r => r.checkIn).sort()[0] ?? null
    : null;
  const teamEnd = presentes.length > 0
    ? presentes.filter(r => r.checkOut).map(r => r.checkOut).sort().reverse()[0] ?? null
    : null;
  const operStatus = !teamStart ? 'agendado' : !teamEnd ? 'em_andamento' : 'finalizado';
  const operCfg    = OPER_STATUS_CFG[operStatus];

  return (
    <div className="space-y-4">
      {todayLider && <LiderBadge lider={todayLider} />}

      {/* KPI cards */}
      {isCargaDescarga ? (
        /* Carga/Descarga: Escala | Início | Final | Status */
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.1fr', gap: '8px', alignItems: 'stretch' }}>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Escala</p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala}</p>
          </div>
          <div style={{ padding: '10px 6px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Início</p>
            <p style={{ fontSize: '16px', fontWeight: 800, color: teamStart ? '#0F172A' : '#CBD5E1', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{teamStart ?? '—'}</p>
          </div>
          <div style={{ padding: '10px 6px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Final</p>
            <p style={{ fontSize: '16px', fontWeight: 800, color: teamEnd ? '#059669' : '#CBD5E1', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{teamEnd ?? '—'}</p>
          </div>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: operCfg.bg, border: `1px solid ${operCfg.border}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: operCfg.dot, boxShadow: `0 0 0 3px ${operCfg.dot}33`, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', fontWeight: 800, color: operCfg.color, lineHeight: 1.2 }}>{operCfg.label}</span>
            <span style={{ fontSize: '9px', fontWeight: 500, color: operCfg.color, opacity: 0.7, lineHeight: 1 }}>{operCfg.sublabel}</span>
          </div>
        </div>
      ) : (
        /* Entrega: Escala | Faltas/Atrasos | Presença */
        <div className="grid grid-cols-3 gap-4">
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.18)', textAlign: 'center', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8' }}>Escala</p>
            <p style={{ fontSize: '32px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala}</p>
          </div>
          <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', minHeight: '80px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8' }}>Faltas</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: faltas > 0 ? '#E11D48' : '#CBD5E1' }}>{faltas}</span>
            </div>
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8' }}>Atrasos</span>
              <span style={{ fontSize: '16px', fontWeight: 800, color: atrasos > 0 ? '#D97706' : '#CBD5E1' }}>{atrasos}</span>
            </div>
          </div>
          <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.18)', textAlign: 'center', minHeight: '80px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8' }}>Presença</p>
            <p style={{ fontSize: '24px', fontWeight: 800, color: escala > 0 ? '#0F172A' : '#CBD5E1', lineHeight: 1 }}>{escala > 0 ? `${pct}%` : '—'}</p>
            <p style={{ fontSize: '10px', fontWeight: 500, color: '#94A3B8' }}>{escala > 0 ? `${presenteCount}/${escala}` : '0/0'}</p>
            {escala > 0 && (
              <div style={{ height: '3px', borderRadius: '4px', background: 'rgba(0,0,0,0.06)', marginTop: '2px' }}>
                <div style={{ height: '100%', borderRadius: '4px', background: '#0F172A', width: `${pct}%`, transition: 'width 0.4s ease' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CARGA E DESCARGA: horário da equipe + lista de nomes ── */}
      {isCargaDescarga ? (
        <div>
          <div className="flex items-center mb-3">
            <h3 className="text-sm font-semibold" style={T}>Equipe em Serviço Agora</h3>
          </div>
          <div className="card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {todayRecords.length === 0 ? (
              <div className="p-8 text-center text-sm" style={TM}>Nenhum ajudante alocado hoje</div>
            ) : (
              <>
                {/* Split: equipe (esq) + carretas (dir) */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

                  {/* Esquerda: lista com obs */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.entries(groupByService(todayRecords)).map(([service, recs], gIdx) => (
                    <div key={service}>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', margin: gIdx > 0 ? '8px 0 4px' : '0 0 4px' }}>
                      </p>
                      {recs.map(rec => {
                        const emp = findEmp(employees, rec.employeeId);
                        const isAbsent = rec.status === 'absent';
                        return (
                          <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: isAbsent ? 'rgba(244,63,94,0.05)' : '#EEF2F7', marginBottom: '3px' }}>
                            <div className="avatar" style={{ background: isAbsent ? '#D1D9E0' : '#64748B', color: isAbsent ? '#64748B' : 'white' }}>{emp?.initials}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '12px', fontWeight: 700, color: isAbsent ? '#94A3B8' : '#0F172A' }}>{emp?.name}</p>
                            </div>
                            {isAbsent && (
                              <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#FFE4E6', color: '#E11D48', flexShrink: 0 }}>Falta</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                  </div>

                  {/* Separador */}
                  <div style={{ width: '1px', background: 'rgba(0,0,0,0.06)', alignSelf: 'stretch', flexShrink: 0 }} />

                  {/* Direita: carretas descarregadas */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TrucksPanel escalaKey={todayEscala?.id || TODAY} escalaId={todayEscala?.id} readOnly={true} />
                  </div>

                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── ENTREGA: horários individuais por ajudante ── */
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={T}>Ajudantes em Serviço Agora</h3>
            {todayRecords.length > 0 && (
              <button onClick={() => setShowModal(true)}
                className="flex items-center gap-1 text-xs font-semibold"
                style={{ color: '#64748B', background: 'none', border: 'none', cursor: 'pointer' }}>
                Ver mais <ChevronRight size={13} />
              </button>
            )}
          </div>
          <div className="card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {todayRecords.length === 0 ? (
              <div className="p-8 text-center text-sm" style={TM}>Nenhum ajudante alocado hoje</div>
            ) : Object.entries(groupByService(todayRecords)).map(([service, recs], gIdx) => {
              const TIMES = [
                { label: 'Entrada',   key: 'checkIn' },
                { label: 'S. Almoço', key: 'lunchOut' },
                { label: 'Retorno',   key: 'lunchReturn' },
                { label: 'Saída',     key: 'checkOut' },
                { label: 'H. Extra',  key: 'overtime' },
              ];
              return (
                <div key={service}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#0F172A', letterSpacing: '0.06em', textTransform: 'uppercase', margin: gIdx > 0 ? '10px 0 5px' : '0 0 5px' }}>
                  </p>
                  {recs.map(rec => {
                    const emp = findEmp(employees, rec.employeeId);
                    const isAbsent = rec.status === 'absent';
                    return (
                      <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: isAbsent ? 'rgba(244,63,94,0.05)' : '#EEF2F7', marginBottom: '3px' }}>
                        <div className="avatar" style={{ background: isAbsent ? '#D1D9E0' : '#64748B', color: isAbsent ? '#64748B' : 'white' }}>{emp?.initials}</div>
                        <div style={{ minWidth: '100px', flexShrink: 0 }}>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: isAbsent ? '#94A3B8' : '#0F172A', lineHeight: 1.2 }}>{emp?.name}</p>
                        </div>
                        <div style={{ flex: 1 }} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexShrink: 0 }}>
                          {TIMES.map(t => (
                            <div key={t.label} style={{ textAlign: 'center', minWidth: '42px' }}>
                              <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 500, marginBottom: '3px' }}>{t.label}</p>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: !rec[t.key] ? '#CBD5E1' : t.key === 'overtime' ? '#059669' : '#0F172A' }}>
                                {fmtTime(rec[t.key]) ?? '—'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Relatório do Líder */}
      <LiderReportBlock date={TODAY} />

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
  const { records, employees, escalas } = useCompanyData();
  const [notes, setNotes] = useNotes();
  const [selectedDate, setSelectedDate] = useState(null);

  const futureDates = [...new Set(
    records
      .filter(r => r.date > TODAY && r.status === 'scheduled')
      .map(r => r.date)
  )].sort();

  if (futureDates.length === 0) {
    return (
      <div className="py-14 text-center">
        <CalendarCheck size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
        <p className="text-sm" style={TM}>Nenhuma escala futura lançada</p>
      </div>
    );
  }

  // ── Modal de detalhe da escala futura ─────────────────────────────
  const ModalDetalhe = ({ date, onClose }) => {
    const dateRecs = records.filter(r => r.date === date);
    const dateEscala = escalas.find(e => e.date === date);
    const dateLider  = dateEscala?.lider || null;
    const isCargaDescarga = (dateEscala?.tipoServico || dateRecs[0]?.tipoServico || 'entrega') === 'carga_descarga';
    const escala = dateRecs.length;
    const presentes = dateRecs.filter(r => r.status !== 'absent');
    const teamStart = presentes.filter(r => r.checkIn).map(r => r.checkIn).sort()[0] ?? null;
    const teamEnd   = presentes.filter(r => r.checkOut).map(r => r.checkOut).sort().reverse()[0] ?? null;
    const operStatus = !teamStart ? 'agendado' : !teamEnd ? 'em_andamento' : 'finalizado';
    const operCfg    = OPER_STATUS_CFG[operStatus];
    const [y, m, d] = date.split('-').map(Number);
    const dow = DOW_FULL[new Date(y, m - 1, d).getDay()];
    const [showAjudantes, setShowAjudantes] = useState(false);

    return createPortal(
      <div onClick={e => e.target === e.currentTarget && onClose()}
        style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', width: '100%', maxWidth: '820px', height: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Próxima Escala</p>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{dow}, {String(d).padStart(2,'0')}/{String(m).padStart(2,'0')}/{y}</h2>
            </div>
            <button onClick={onClose} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', color: '#64748B' }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Líder */}
            {dateLider ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: dateLider.cor || '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                  {dateLider.iniciais}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Líder de Equipe</p>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{dateLider.nome}</p>
                </div>
                {whatsappLink(dateLider.telefone) && (
                  <a href={whatsappLink(dateLider.telefone)} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '9px', background: '#DCFCE7', color: '#15803D', textDecoration: 'none', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                    <WaSVG size={13} /> WhatsApp
                  </a>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={18} style={{ color: '#94A3B8' }} />
                </div>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Líder de Equipe</p>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>Não atribuído</p>
                </div>
              </div>
            )}

            {/* KPI cards */}
            {isCargaDescarga ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.1fr', gap: '8px' }}>
                <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Escala</p>
                  <p style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala}</p>
                </div>
                <div style={{ padding: '10px 6px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Início</p>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: teamStart ? '#0F172A' : '#CBD5E1', lineHeight: 1 }}>{teamStart ?? '—'}</p>
                </div>
                <div style={{ padding: '10px 6px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Final</p>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: teamEnd ? '#059669' : '#CBD5E1', lineHeight: 1 }}>{teamEnd ?? '—'}</p>
                </div>
                <div style={{ padding: '10px 8px', borderRadius: '10px', background: operCfg.bg, border: `1px solid ${operCfg.border}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: operCfg.dot, boxShadow: `0 0 0 3px ${operCfg.dot}33` }} />
                  <span style={{ fontSize: '11px', fontWeight: 800, color: operCfg.color, lineHeight: 1.2 }}>{operCfg.label}</span>
                  <span style={{ fontSize: '9px', fontWeight: 500, color: operCfg.color, opacity: 0.7 }}>{operCfg.sublabel}</span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Escala</p>
                  <p style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala}</p>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</p>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#64748B' }}>Agendado</span>
                </div>
              </div>
            )}

            {/* Equipe + Descargas */}
            <div>
              <div style={{ marginBottom: '10px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Equipe escalada</p>
              </div>

              {dateRecs.length === 0 ? (
                <p style={{ fontSize: '12px', color: '#94A3B8', padding: '8px 0' }}>Nenhum ajudante escalado</p>
              ) : isCargaDescarga ? (
                /* Carga e Descarga: split equipe | carretas */
                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                  {/* Esquerda: ajudantes */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {Object.entries(groupByService(dateRecs)).map(([service, recs], gIdx) => (
                      <div key={service}>
                        {recs.map(rec => {
                          const emp = findEmp(employees, rec.employeeId);
                          return (
                            <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: '#EEF2F7', marginBottom: '3px' }}>
                              <div className="avatar" style={{ background: '#64748B' }}>{emp?.initials}</div>
                              <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', flex: 1 }}>{emp?.name}</p>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  {/* Separador */}
                  <div style={{ width: '1px', background: 'rgba(0,0,0,0.06)', alignSelf: 'stretch', flexShrink: 0 }} />
                  {/* Direita: carretas */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <TrucksPanel escalaKey={dateEscala?.id || date} escalaId={dateEscala?.id} readOnly={true} />
                  </div>
                </div>
              ) : (
                /* Entrega: lista simples */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {Object.entries(groupByService(dateRecs)).map(([service, recs], gIdx) => (
                    <div key={service}>
                      {recs.map(rec => {
                        const emp = findEmp(employees, rec.employeeId);
                        return (
                          <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: '#EEF2F7', marginBottom: '3px' }}>
                            <div className="avatar" style={{ background: '#64748B' }}>{emp?.initials}</div>
                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', flex: 1 }}>{emp?.name}</p>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
        {showAjudantes && (
          <AjudantesModal
            records={dateRecs}
            escala={escala}
            faltas={0}
            atrasos={0}
            date={date}
            tipoServico={dateEscala?.tipoServico}
            onClose={() => setShowAjudantes(false)}
          />
        )}
      </div>,
      document.body
    );
  };

  // ── Lista de datas ─────────────────────────────────────────────────
  return (
    <>
      <div className="card overflow-hidden">
        {futureDates.map((date, idx) => {
          const dateRecs = records.filter(r => r.date === date && r.status === 'scheduled');
          const [y, m, d] = date.split('-').map(Number);
          const dow = DOW_FULL[new Date(y, m - 1, d).getDay()];
          const dateLider = escalas.find(e => e.date === date)?.lider || null;
          const isCargaDescarga = (escalas.find(e => e.date === date)?.tipoServico || 'entrega') === 'carga_descarga';

          return (
            <button key={date}
              onClick={() => setSelectedDate(date)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', background: 'transparent', border: 'none', cursor: 'pointer',
                borderBottom: idx < futureDates.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                textAlign: 'left', transition: 'background 0.12s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#F8FAFC'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ textAlign: 'center', minWidth: '44px' }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{dow}</p>
                  <p style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>{String(d).padStart(2,'0')}/{String(m).padStart(2,'0')}</p>
                </div>
                <div style={{ width: '1px', height: '28px', background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                  {isCargaDescarga ? 'Carga e Descarga' : 'Entrega'}
                  <span style={{ fontWeight: 400, color: '#94A3B8' }}> ({dateRecs.length} ajudante{dateRecs.length !== 1 ? 's' : ''})</span>
                </p>
              </div>
              <ChevronRight size={15} style={{ color: '#CBD5E1', flexShrink: 0 }} />
            </button>
          );
        })}
      </div>

      {selectedDate && <ModalDetalhe date={selectedDate} onClose={() => setSelectedDate(null)} />}
    </>
  );

}

function EscalasTab({ companyId }) {
  const [sub, setSub] = useState('hoje');
  // REGRA: empresas só podem ver o relatório do líder.
  // Reportes individuais dos ajudantes (ocorrências) são visíveis apenas para Líder e Admin.
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
  const { employees } = useCompanyData();
  const ativos   = records.filter(r => r.status !== 'absent');
  const ausentes = records.filter(r => r.status === 'absent');
  const heCount  = ativos.filter(r => r.overtime).length;
  const [, m, d] = date.split('-');
  const dow = DOW_SHORT[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const [notes, setNotes] = useNotes();

  const isCargaDescarga = (ativos[0]?.tipoServico || 'entrega') === 'carga_descarga';
  const TIMES = isCargaDescarga
    ? [{ label: 'Início', key: 'checkIn' }, { label: 'Final', key: 'checkOut' }]
    : [{ label: 'Entrada', key: 'checkIn' }, { label: 'S. Almoço', key: 'lunchOut' }, { label: 'Retorno', key: 'lunchReturn' }, { label: 'Saída', key: 'checkOut' }, { label: 'H. Extra', key: 'overtime' }];

  return createPortal(
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '720px' }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <p className="text-xs font-semibold uppercase" style={{ color: '#94A3B8', letterSpacing: '0.08em', marginBottom: '6px' }}>Ajudantes em serviço</p>
            <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>{dow}, {d}/{m}</h2>
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                Diárias: <span style={{ color: '#0369A1' }}>{ativos.length}</span>
              </p>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#111827' }}>
                Horas Extras: <span style={{ color: '#0369A1' }}>{fmtHoursCount(heCount)}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#94A3B8', background: '#F1F5F9' }}>
            <X size={15} />
          </button>
        </div>

        {/* Lista */}
        <div className="card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {ativos.length === 0 ? (
            <div className="py-10 text-center text-sm" style={{ color: '#94A3B8' }}>Nenhum ajudante ativo neste dia</div>
          ) : Object.entries(groupByService(ativos)).map(([service, recs], gIdx) => {
            const color = GROUP_PALETTE[gIdx % GROUP_PALETTE.length];
            return (
              <div key={service}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#0F172A', letterSpacing: '0.06em', textTransform: 'uppercase', margin: gIdx > 0 ? '10px 0 5px' : '0 0 5px' }}>
                </p>
                {recs.map(rec => {
                  const emp = findEmp(employees, rec.employeeId);
                  return (
                    <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: '#EEF2F7', marginBottom: '3px' }}>
                      <div className="avatar" style={{ background: '#64748B' }}>{emp?.initials}</div>
                      <div style={{ minWidth: '110px', flexShrink: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', lineHeight: 1.2 }}>{emp?.name}</p>
                      </div>
                      <div style={{ flex: 1 }} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                        {TIMES.map(t => {
                          const val = fmtTime(rec[t.key]);
                          const isHE = t.key === 'overtime';
                          return (
                            <div key={t.label} style={{ textAlign: 'center', minWidth: '40px' }}>
                              <p style={{ fontSize: '9px', fontWeight: 600, color: '#94A3B8', marginBottom: '2px' }}>{t.label}</p>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: val ? (isHE ? '#059669' : '#0F172A') : '#CBD5E1' }}>
                                <Clock size={9} />
                                <span style={{ fontSize: '11px', fontWeight: 700 }}>{val ?? '—'}</span>
                              </div>
                            </div>
                          );
                        })}
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

const TIPO_LABEL = { entrega: 'Entrega', carga_descarga: 'Carga e Descarga' };

// ── Bloco reutilizável: Relatório do Líder ────────────────────────────────
function LiderReportBlock({ date }) {
  const { relatorios } = useCompanyData();
  const relatorio = relatorios.find(r => r.data === date);
  return (
    <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '14px' }}>
      <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Relatório do Líder</p>
      {relatorio ? (
        <div style={{ padding: '12px 14px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: relatorio.observacoes ? '10px' : 0 }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: relatorio.liderCor || '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
              {relatorio.liderIni}
            </div>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', flex: 1 }}>{relatorio.liderNome}</p>
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: relatorio.finalizado ? '#DCFCE7' : '#EEF2F7', color: relatorio.finalizado ? '#059669' : '#64748B', flexShrink: 0 }}>
              {relatorio.finalizado ? '✓ Finalizado' : 'Em aberto'}
            </span>
          </div>
          {relatorio.observacoes && (
            <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, paddingLeft: '36px' }}>{relatorio.observacoes}</p>
          )}
        </div>
      ) : (
        <p style={{ fontSize: '12px', color: '#94A3B8' }}>Relatório do líder não disponível para este dia.</p>
      )}
    </div>
  );
}

// ── Relatório ──────────────────────────────────────────────────────────────
function RelatorioTab({ companyId, valorDescarga = 0 }) {
  const { records, employees, escalas } = useCompanyData();
  const [offset, setOffset] = useState(0);
  const [openDay, setOpenDay] = useState(null);
  const [tipoFilter, setTipoFilter] = useState(null);
  const [relatorios, setRelatorios] = useState([]);
  const [carretasMap, setCarretasMap] = useState({}); // escalaId → carreta[]

  useEffect(() => {
    fetchRelatoriosByEmpresa(companyId).then(setRelatorios);
  }, [companyId]);

  // Reset filtro ao mudar de quinzena
  useEffect(() => { setTipoFilter(null); setOpenDay(null); }, [offset]);

  const { start, end, label } = getPeriodBounds('quinzena', offset);
  const [sy, sm, sday] = start.split('-').map(Number);
  const [, ,   eday]   = end.split('-').map(Number);

  // Busca carretas de todas as escalas do período
  useEffect(() => {
    const escalaIds = escalas
      .filter(e => e.date >= start && e.date <= end && e.tipoServico === 'carga_descarga')
      .map(e => e.id);
    if (!escalaIds.length) { setCarretasMap({}); return; }
    fetchCarretasByEscalas(escalaIds).then(all => {
      const map = {};
      all.forEach(c => {
        if (!map[c.escalaId]) map[c.escalaId] = [];
        map[c.escalaId].push(c);
      });
      setCarretasMap(map);
    });
  }, [escalas, start, end]);

  // Tipos de serviço presentes no período
  const periodRecords = records.filter(r => r.date >= start && r.date <= end);
  const tiposDisponiveis = [...new Set(periodRecords.map(r => r.tipoServico || 'entrega'))];
  const temAmbos = tiposDisponiveis.length > 1;
  const tipoAtivo = tipoFilter || (temAmbos ? null : (tiposDisponiveis[0] || 'entrega'));

  // Todos os dias da quinzena filtrados pelo tipo selecionado
  const allDays = [];
  for (let day = sday; day <= eday; day++) {
    const iso  = `${sy}-${String(sm).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dow  = new Date(`${iso}T12:00:00Z`).getUTCDay();
    const recs = records.filter(r => r.date === iso && (!tipoAtivo || (r.tipoServico || 'entrega') === tipoAtivo));
    const dayTipo = recs[0]?.tipoServico || 'entrega';
    const isCD = dayTipo === 'carga_descarga';

    // Escalas do dia para este tipo
    const dayEscalas = escalas.filter(e => e.date === iso && (!tipoAtivo || e.tipoServico === tipoAtivo));

    let diarias, heCount, valorDiarias, valorHE;
    if (isCD) {
      // Carga e descarga: conta carretas × valor por descarga
      const carretas = dayEscalas.flatMap(e => carretasMap[e.id] || []);
      diarias      = carretas.length;
      heCount      = 0;
      valorDiarias = diarias * valorDescarga;
      valorHE      = 0;
    } else {
      const presentes = recs.filter(r => r.status !== 'absent');
      diarias      = presentes.length;
      heCount      = presentes.filter(r => r.overtime).length;
      valorDiarias = presentes.reduce((s, r) => s + (r.value || VALOR_DIARIA), 0);
      valorHE      = heCount * VALOR_HORA_EXTRA;
    }

    allDays.push({
      date: iso, dow, dayNum: day,
      label: `${DOW_SHORT[dow]}, ${String(day).padStart(2,'0')}/${String(sm).padStart(2,'0')}`,
      isWeekend: dow === 0 || dow === 6,
      isToday: iso === TODAY,
      recs, diarias, heCount, valorDiarias, valorHE,
      total: valorDiarias + valorHE,
      isCD,
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
  }) || null;

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
    doc.save(`Relatorio ${label}.pdf`);
  };

  const navBtn = (icon, fn) => (
    <button onClick={fn} className="p-1.5 rounded-lg"
      style={{ background: '#EEF2F7', border: 'none', cursor: 'pointer', color: '#475569', display: 'flex' }}>
      {icon}
    </button>
  );

  const COL = '130px 1.1fr 1.3fr 0.85fr 1.05fr 1.05fr 24px';

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

      {/* Seletor de tipo de serviço — só aparece quando há ambos */}
      {temAmbos && (
        <div style={{ display: 'flex', gap: '8px' }}>
          {[null, ...tiposDisponiveis].map(tipo => {
            const ativo = tipoFilter === tipo;
            return (
              <button key={tipo ?? 'todos'} onClick={() => setTipoFilter(tipo)}
                style={{
                  padding: '8px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 700, transition: 'all 0.15s',
                  background: ativo ? '#0F172A' : '#FFFFFF',
                  color: ativo ? '#FFFFFF' : '#64748B',
                  boxShadow: ativo ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                }}>
                {tipo === null ? 'Todos' : TIPO_LABEL[tipo] ?? tipo}
              </button>
            );
          })}
        </div>
      )}

      {/* Caixa principal: stats + tabela + total */}
      <div className="card overflow-hidden">

        {/* Stats */}
        {(() => {
          const isCD = tipoAtivo === 'carga_descarga';
          const statItems = [
            { label: isCD ? 'Descargas'       : 'Diárias',       value: totalDiarias,               fmt: v => v,       highlight: false },
            { label: isCD ? 'Total Descargas' : 'Valor Diárias', value: totalValorDiarias,           fmt: fmtCurrency,  highlight: false },
            { label: 'H. Extras',                                 value: fmtHoursCount(totalHE),     fmt: v => v,       highlight: false },
            { label: 'Valor HE',                                  value: totalValorHE,               fmt: fmtCurrency,  highlight: false },
            { label: 'Total',                                     value: totalGeral,                 fmt: fmtCurrency,  highlight: true  },
          ];
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1.3fr', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              {statItems.map(({ label, value, fmt, highlight }, i) => (
                <div key={label} style={{
                  padding: '16px 20px',
                  background: highlight ? '#0F172A' : '#FFFFFF',
                  borderLeft: i > 0 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  display: 'flex', flexDirection: 'column', gap: '4px',
                }}>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: highlight ? '#64748B' : '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</p>
                  <p style={{ fontSize: highlight ? '20px' : '16px', fontWeight: 800, color: highlight ? '#FFFFFF' : '#0F172A', lineHeight: 1 }}>{fmt(value)}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Tabela por dia */}
        <div>
        {/* Cabeçalho */}
        {(() => {
          const isCD = tipoAtivo === 'carga_descarga';
          const cols = ['Data', isCD ? 'Descargas' : 'Diárias', isCD ? 'Total Descargas' : 'Val. Diária', 'H. Extra', 'Val. H. Extra', 'Total Dia', ''];
          return (
            <div style={{
              display: 'grid', gridTemplateColumns: COL,
              padding: '8px 16px', background: '#E2E8F0',
              borderBottom: '1px solid rgba(0,0,0,0.08)',
            }}>
              {cols.map((h, i) => (
                <p key={i} style={{
                  fontSize: '10px', fontWeight: 700, color: '#475569',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  textAlign: 'center', whiteSpace: 'nowrap',
                  overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{h}</p>
              ))}
            </div>
          );
        })()}

        {allDays.map((day, idx) => {
          const hasData = day.diarias > 0 || day.heCount > 0;
          const isLast  = idx === allDays.length - 1;

          return (
            <div key={day.date} style={{ borderBottom: !isLast ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
              <button
                onClick={() => hasData && setOpenDay(day.date)}
                disabled={!hasData}
                style={{
                  width: '100%', display: 'grid', gridTemplateColumns: COL,
                  alignItems: 'center', padding: '10px 16px', border: 'none',
                  background: day.isWeekend ? '#FAFBFC' : 'transparent',
                  cursor: hasData ? 'pointer' : 'default',
                  transition: 'background 0.12s',
                }}
                onMouseEnter={e => { if (hasData) e.currentTarget.style.background = '#F0F9FF'; }}
                onMouseLeave={e => { e.currentTarget.style.background = day.isWeekend ? '#FAFBFC' : 'transparent'; }}
              >
                <p style={{ fontSize: '12px', fontWeight: hasData ? 600 : 400, color: day.isWeekend ? '#CBD5E1' : hasData ? '#0F172A' : '#94A3B8', textAlign: 'center' }}>{day.label}</p>
                {(() => {
                  const dayTipo = day.recs[0]?.tipoServico || 'entrega';
                  const tipoLabel = !tipoAtivo && day.diarias > 0
                    ? `(${dayTipo === 'carga_descarga' ? 'descargas' : 'diárias'})`
                    : '';
                  return (
                    <p style={{ fontSize: '12px', fontWeight: 600, color: day.diarias > 0 ? '#0F172A' : '#E2E8F0', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {day.diarias > 0 ? (
                        <>
                          {day.diarias}{tipoLabel && <span style={{ fontSize: '10px', fontWeight: 500, color: '#94A3B8', marginLeft: '4px' }}>{tipoLabel}</span>}
                        </>
                      ) : '—'}
                    </p>
                  );
                })()}
                <p style={{ fontSize: '12px', fontWeight: 600, color: day.valorDiarias > 0 ? '#059669' : '#E2E8F0', textAlign: 'center' }}>{day.valorDiarias > 0 ? fmtCurrency(day.valorDiarias) : '—'}</p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: day.heCount > 0 ? '#0F172A' : '#E2E8F0', textAlign: 'center' }}>{fmtHoursCount(day.heCount)}</p>
                <p style={{ fontSize: '12px', fontWeight: 600, color: day.valorHE > 0 ? '#059669' : '#E2E8F0', textAlign: 'center' }}>{day.valorHE > 0 ? fmtCurrency(day.valorHE) : '—'}</p>
                <p style={{ fontSize: '12px', fontWeight: 700, color: day.total > 0 ? '#0F172A' : '#E2E8F0', textAlign: 'center' }}>{day.total > 0 ? fmtCurrency(day.total) : '—'}</p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {hasData && <ChevronRight size={13} style={{ color: '#94A3B8' }} />}
                </div>
              </button>
            </div>
          );
        })}

        {/* Modal de detalhe do dia — mesmo design de EscalasHoje */}
        {openDay && (() => {
          const dayRecs     = records.filter(r => r.date === openDay && (!tipoAtivo || (r.tipoServico || 'entrega') === tipoAtivo));
          const ativos      = dayRecs.filter(r => r.status !== 'absent');
          const relatorio   = relatorios.find(r => r.data === openDay);
          const dateEscala  = escalas.find(e => e.date === openDay);
          const dateLider   = dateEscala?.lider || null;
          const isCargaDescarga = (dateEscala?.tipoServico || dayRecs[0]?.tipoServico || 'entrega') === 'carga_descarga';
          const escala      = dayRecs.length;
          const faltas      = dayRecs.filter(r => r.status === 'absent').length;
          const atrasos     = dayRecs.filter(r => r.status !== 'absent' && r.checkIn > START_TIME).length;
          const presentes   = dayRecs.filter(r => r.status !== 'absent');
          const pct         = escala > 0 ? Math.round((presentes.length / escala) * 100) : 0;
          const teamStart   = ativos.filter(r => r.checkIn).map(r => r.checkIn).sort()[0] ?? null;
          const teamEnd     = ativos.filter(r => r.checkOut).map(r => r.checkOut).sort().reverse()[0] ?? null;
          const operStatus  = !teamStart ? 'agendado' : !teamEnd ? 'em_andamento' : 'finalizado';
          const operCfg     = OPER_STATUS_CFG[operStatus];
          const [y, mm, dd] = openDay.split('-').map(Number);
          const dow = DOW_FULL[new Date(y, mm - 1, dd).getDay()];

          return createPortal(
            <div onClick={e => e.target === e.currentTarget && setOpenDay(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(15,23,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
              <div style={{ background: '#fff', borderRadius: '18px', boxShadow: '0 20px 60px rgba(0,0,0,0.18)', width: '100%', maxWidth: '820px', height: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Detalhe do dia</p>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>{dow}, {String(dd).padStart(2,'0')}/{String(mm).padStart(2,'0')}/{y}</h2>
                  </div>
                  <button onClick={() => setOpenDay(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', padding: '6px', cursor: 'pointer', display: 'flex', color: '#64748B' }}>
                    <X size={15} />
                  </button>
                </div>

                <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Líder */}
                  {dateLider ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: dateLider.cor || '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                        {dateLider.iniciais}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Líder de Equipe</p>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{dateLider.nome}</p>
                      </div>
                      {whatsappLink(dateLider.telefone) && (
                        <a href={whatsappLink(dateLider.telefone)} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 12px', borderRadius: '9px', background: '#DCFCE7', color: '#15803D', textDecoration: 'none', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                          <WaSVG size={13} /> WhatsApp
                        </a>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Users size={18} style={{ color: '#94A3B8' }} />
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '1px' }}>Líder de Equipe</p>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>Não atribuído</p>
                      </div>
                    </div>
                  )}

                  {/* KPI cards */}
                  {isCargaDescarga ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.1fr', gap: '8px' }}>
                      <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Escala</p>
                        <p style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala}</p>
                      </div>
                      <div style={{ padding: '10px 6px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Início</p>
                        <p style={{ fontSize: '16px', fontWeight: 800, color: teamStart ? '#0F172A' : '#CBD5E1', lineHeight: 1 }}>{teamStart ?? '—'}</p>
                      </div>
                      <div style={{ padding: '10px 6px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Final</p>
                        <p style={{ fontSize: '16px', fontWeight: 800, color: teamEnd ? '#059669' : '#CBD5E1', lineHeight: 1 }}>{teamEnd ?? '—'}</p>
                      </div>
                      <div style={{ padding: '10px 8px', borderRadius: '10px', background: operCfg.bg, border: `1px solid ${operCfg.border}`, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: operCfg.dot, boxShadow: `0 0 0 3px ${operCfg.dot}33` }} />
                        <span style={{ fontSize: '11px', fontWeight: 800, color: operCfg.color, lineHeight: 1.2 }}>{operCfg.label}</span>
                        <span style={{ fontSize: '9px', fontWeight: 500, color: operCfg.color, opacity: 0.7 }}>{operCfg.sublabel}</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Escala</p>
                        <p style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala}</p>
                      </div>
                      <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8' }}>Faltas</span>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: faltas > 0 ? '#E11D48' : '#CBD5E1' }}>{faltas}</span>
                        </div>
                        <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8' }}>Atrasos</span>
                          <span style={{ fontSize: '16px', fontWeight: 800, color: atrasos > 0 ? '#D97706' : '#CBD5E1' }}>{atrasos}</span>
                        </div>
                      </div>
                      <div style={{ padding: '10px 8px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px' }}>
                        <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Presença</p>
                        <p style={{ fontSize: '20px', fontWeight: 800, color: escala > 0 ? '#0F172A' : '#CBD5E1', lineHeight: 1 }}>{escala > 0 ? `${pct}%` : '—'}</p>
                      </div>
                    </div>
                  )}

                  {/* Equipe + Descargas */}
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Equipe</p>
                    {dayRecs.length === 0 ? (
                      <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhum registro neste dia</p>
                    ) : isCargaDescarga ? (
                      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {ativos.map(rec => {
                            const emp = findEmp(employees, rec.employeeId);
                            return (
                              <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: '#EEF2F7', marginBottom: '3px' }}>
                                <div className="avatar" style={{ background: '#64748B' }}>{emp?.initials}</div>
                                <p style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', flex: 1 }}>{emp?.name}</p>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ width: '1px', background: 'rgba(0,0,0,0.06)', alignSelf: 'stretch', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <TrucksPanel escalaKey={dateEscala?.id || openDay} escalaId={dateEscala?.id} readOnly={true} />
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {dayRecs.map(rec => {
                          const emp = findEmp(employees, rec.employeeId);
                          const isAbsent = rec.status === 'absent';
                          return (
                            <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: isAbsent ? 'rgba(244,63,94,0.05)' : '#EEF2F7', marginBottom: '3px' }}>
                              <div className="avatar" style={{ background: isAbsent ? '#D1D9E0' : '#64748B', color: isAbsent ? '#64748B' : 'white' }}>{emp?.initials}</div>
                              <p style={{ fontSize: '12px', fontWeight: 700, color: isAbsent ? '#94A3B8' : '#0F172A', flex: 1 }}>{emp?.name}</p>
                              {isAbsent && <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#FFE4E6', color: '#E11D48', flexShrink: 0 }}>Falta</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <LiderReportBlock date={openDay || date || selectedDay} />

                </div>
              </div>
            </div>,
            document.body
          );
        })()}
        </div>

        {/* Total cobrança + vencimento */}
        <div style={{ padding: '16px 20px', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total da cobrança</span>
              <span style={{ fontSize: '22px', fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>{fmtCurrency(totalGeral)}</span>
            </div>
            {payment ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  {payment.status === 'paid' ? 'Pago em' : 'Vencimento'}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: payment.status === 'paid' ? '#4ADE80' : payment.status === 'overdue' ? '#F87171' : '#94A3B8' }}>
                  {payment.status === 'paid' && payment.paidDate ? fmtDate(payment.paidDate) : fmtDate(payment.dueDate)}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: '11px', color: '#475569' }}>Vencimento a definir</span>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}

// ── Aba: Equipe (Líder + Relatórios do Líder) ─────────────────────────────
function EquipeTab({ companyId }) {
  const [escalaHoje, setEscalaHoje]     = useState(null);
  const [relatorios, setRelatorios]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [openId, setOpenId]             = useState(null);

  const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
  const fmtD = (iso) => {
    if (!iso) return '—';
    const [y,m,d] = iso.split('-');
    return `${DOW[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${d}/${m}/${y}`;
  };

  useEffect(() => {
    Promise.all([
      fetchEscalaHojeByEmpresa(companyId, TODAY),
      fetchRelatoriosByEmpresa(companyId),
    ]).then(([esc, rels]) => {
      setEscalaHoje(esc);
      setRelatorios(rels);
      setLoading(false);
    });
  }, [companyId]);

  if (loading) return <div className="card p-10 text-center text-sm" style={{ color: '#94A3B8' }}>Carregando...</div>;

  return (
    <div className="space-y-5">
      {/* Líder de hoje */}
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>Líder de equipe — hoje</h2>
        {escalaHoje?.lider ? (
          <div className="card p-4">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: escalaHoje.lider.cor || '#FF4D0C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {escalaHoje.lider.iniciais}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>{escalaHoje.lider.nome}</p>
                <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>Líder de Equipe · Farilog</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
              {escalaHoje.lider.telefone && (
                <a href={`tel:${escalaHoje.lider.telefone}`}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', background: '#F1F5F9', textDecoration: 'none', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                  <Phone size={14} /> {escalaHoje.lider.telefone}
                </a>
              )}
              {escalaHoje.lider.email && (
                <a href={`mailto:${escalaHoje.lider.email}`}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '10px', background: '#F1F5F9', textDecoration: 'none', fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                  <Mail size={14} /> E-mail
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="card p-6 text-center">
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>Nenhuma escala com líder designado para hoje</p>
          </div>
        )}
      </div>

      {/* Relatórios do líder */}
      <div>
        <h2 style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', marginBottom: '12px' }}>
          Relatórios diários — {relatorios.length > 0 ? `${relatorios.length} registros` : 'nenhum'}
        </h2>
        {relatorios.length === 0 ? (
          <div className="card p-6 text-center">
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>Nenhum relatório disponível</p>
          </div>
        ) : relatorios.map(r => (
          <div key={r.id} className="card overflow-hidden" style={{ marginBottom: '8px' }}>
            <button onClick={() => setOpenId(openId === r.id ? null : r.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: r.liderCor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {r.liderIni}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{fmtD(r.data)}</p>
                <p style={{ fontSize: '11px', color: '#64748B', marginTop: '1px' }}>
                  Líder: {r.liderNome}
                </p>
              </div>
              <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: r.finalizado ? '#DCFCE7' : '#FEF3C7', color: r.finalizado ? '#059669' : '#D97706', flexShrink: 0 }}>
                {r.finalizado ? 'Finalizado' : 'Em aberto'}
              </span>
            </button>
            {openId === r.id && r.observacoes && (
              <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.06)', background: '#FAFBFC' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>Observações do líder</p>
                <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6 }}>{r.observacoes}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function CompanyDashboard() {
  const { user, employees } = useAuth();
  const { tab, setTab } = useOutletContext();
  const [records, setRecords]     = useState([]);
  const [escalas, setEscalas]     = useState([]);
  const [relatorios, setRelatorios] = useState([]);

  const companyId = user?.id;

  useEffect(() => {
    if (!companyId) return;
    fetchCompanyRecords(companyId).then(setRecords);
    fetchEscalasComLiderByEmpresa(companyId).then(setEscalas);
    fetchRelatoriosByEmpresa(companyId).then(setRelatorios);
    const unsub = subscribeToCompanyRecords(companyId, r => {
      setRecords(r);
      fetchEscalasComLiderByEmpresa(companyId).then(setEscalas);
    });
    return unsub;
  }, [companyId]);

  return (
    <CompanyDataCtx.Provider value={{ records, employees, escalas, relatorios }}>
      <div className="animate-fade-up">
        {tab === 'panel'     && <Panel       companyId={companyId} setTab={setTab} companyName={user.name} />}
        {tab === 'escalas'   && <EscalasTab  companyId={companyId} />}
        {tab === 'financial' && <Financial   companyId={companyId} />}
        {tab === 'relatorio' && <RelatorioTab companyId={companyId} valorDescarga={Number(user?.valorDescarga ?? 0)} />}
        {tab === 'settings'  && <SettingsTab company={user} />}
      </div>
    </CompanyDataCtx.Provider>
  );
}
