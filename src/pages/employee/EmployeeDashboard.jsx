import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { WORK_RECORDS, COMPANIES, fmtCurrency, fmtDate, WEEKDAYS, MONTHS } from '../../data/mockData';
import { fetchTodayRecord, subscribeToRecord, createOcorrencia } from '../../lib/db';
import { STATUS_CONFIG } from '../admin/AdminDemanda';
import {
  Clock, DollarSign, Calendar, CheckCircle2, AlertCircle,
  X, Briefcase, ChevronDown, ChevronUp, TrendingUp, Banknote
} from 'lucide-react';

const TODAY      = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const TODAY_DATE = new Date(TODAY + 'T12:00:00-03:00');
const VALOR_DIARIA = 150;
const VALOR_HE     = 50;

const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MONTH_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function fmtISO(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${DOW[new Date(`${iso}T12:00:00`).getDay()]}, ${d}/${m}/${y}`;
}

function getCompany(id) { return COMPANIES.find(c => c.id === id); }

function getQuinzenaLabel(date) {
  const [y, m, d] = date.split('-').map(Number);
  const num = d <= 15 ? 1 : 2;
  return `${MONTH_FULL[m - 1]}/${y} — Quinzena ${num}`;
}

function getQuinzenaBounds(date) {
  const [y, m, d] = date.split('-').map(Number);
  const mm = String(m).padStart(2, '0');
  if (d <= 15) return { start: `${y}-${mm}-01`, end: `${y}-${mm}-15` };
  const last = new Date(y, m, 0).getDate();
  return { start: `${y}-${mm}-16`, end: `${y}-${mm}-${last}` };
}

// ── Visão Geral ──────────────────────────────────────────────────────────────

function VisaoGeral({ user, myRecords, demands, updateDemandStatus, todayOverride, companies = [] }) {
  const findCompany = (id) => companies.find(c => c.id === id);
  // todayOverride vem do Supabase (tempo real); fallback para mock
  const todayRecord  = todayOverride !== undefined ? todayOverride : myRecords.find(r => r.date === TODAY);
  const nextRecord   = myRecords
    .filter(r => r.date > TODAY && r.status === 'scheduled')
    .sort((a, b) => a.date.localeCompare(b.date))[0];

  const findDemand = (date) =>
    demands.find(d => d.date === date && d.employees?.find(e => e.employeeId === user.id));

  // Deriva o estado real da caixa a partir das batidas, não do campo status
  // scheduled → sem checkIn | active → tem checkIn, sem checkOut | completed → tem checkOut
  const derivedState = todayRecord
    ? todayRecord.checkOut ? 'completed'
    : todayRecord.checkIn  ? 'active'
    : 'scheduled'
    : null;

  // Próximo pagamento (quinzena atual: 16/05–31/05)
  const qBounds    = getQuinzenaBounds(TODAY);
  const qRecords   = myRecords.filter(r => r.date >= qBounds.start && r.date <= qBounds.end && r.status !== 'absent');
  const diarias    = qRecords.length + (todayRecord && todayRecord.status === 'active' ? 1 : 0);
  const heCount    = qRecords.filter(r => r.overtime).length + (todayRecord?.overtime ? 1 : 0);
  const totalDiarias = diarias * VALOR_DIARIA;
  const totalHE      = heCount * VALOR_HE;
  const totalReceber = totalDiarias + totalHE;

  // Data do próximo pagamento (dia 5 ou 20)
  const today = TODAY_DATE.getDate();
  const nextPayDay = today <= 5 ? 5 : today <= 20 ? 20 : 5;
  const nextPayMonth = today > 20
    ? new Date(TODAY_DATE.getFullYear(), TODAY_DATE.getMonth() + 1, 1)
    : TODAY_DATE;
  const nextPayDate = `05/${String(nextPayMonth.getMonth() + (today > 20 ? 1 : 1)).padStart(2,'0')}`;

  const myDemands = demands
    .map(d => ({ ...d, myEntry: d.employees.find(e => e.employeeId === user.id) }))
    .filter(d => d.myEntry)
    .sort((a, b) => a.date.localeCompare(b.date));

  // Só mostra pendentes de hoje em diante (não exibe avisos de dias passados)
  const pendingDemands = myDemands.filter(d => d.myEntry.status === 'aguardando' && d.date >= TODAY);

  // Serviço de HOJE (somente o dia atual)
  const todayDemands   = myDemands.filter(d => d.myEntry.status === 'confirmado' && d.date === TODAY);

  // PRÓXIMO serviço — apenas o 1º dia futuro, 1 serviço só
  const nextFutureDate = myDemands
    .filter(d => d.myEntry.status === 'confirmado' && d.date > TODAY)
    .map(d => d.date)
    .sort()[0] || null;
  const nextDemand = nextFutureDate
    ? myDemands.find(d => d.myEntry.status === 'confirmado' && d.date === nextFutureDate)
    : null;

  return (
    <div className="space-y-4">

      {/* Demandas aguardando */}
      {pendingDemands.map(d => {
        const company = findCompany(d.companyId);
        return (
          <div key={d.id} className="card p-4" style={{ borderLeft: '4px solid #D97706' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#D97706', letterSpacing: '0.06em' }}>CONFIRMAÇÃO PENDENTE</span>

            {/* Detalhes da empresa */}
            <div className="mt-2 mb-3 space-y-1.5">
              <p className="text-sm font-bold" style={T}>{company?.name ?? d.companyName}</p>

              <div className="flex items-center gap-1.5" style={{ color: '#475569' }}>
                <Clock size={11} />
                <span style={{ fontSize: '12px' }}>{fmtISO(d.date)} · {d.time} · {d.service}</span>
              </div>

              {(d.liderNome || company?.contact) && (
                <div className="flex items-center gap-1.5" style={{ color: '#475569' }}>
                  <Briefcase size={11} />
                  <span style={{ fontSize: '12px' }}>Líder: <span style={{ fontWeight: 600, color: '#0F172A' }}>{d.liderNome || company?.contact}</span></span>
                </div>
              )}

              {company?.address && (
                <div className="flex items-start gap-1.5" style={{ color: '#475569' }}>
                  <AlertCircle size={11} style={{ marginTop: '2px', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px' }}>{company.address}</span>
                </div>
              )}

              {company?.location && (
                <a
                  href={company.location}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#FF4D0C', textDecoration: 'none', marginTop: '2px' }}
                >
                  📍 Ver localização
                </a>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => updateDemandStatus(d.id, user.id, 'confirmado')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#059669', color: 'white', fontSize: '12px', fontWeight: 700 }}>
                <CheckCircle2 size={13} /> Confirmar
              </button>
              <button onClick={() => updateDemandStatus(d.id, user.id, 'falta')}
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '9px', borderRadius: '10px', border: '1.5px solid #E11D48', cursor: 'pointer', background: 'transparent', color: '#E11D48', fontSize: '12px', fontWeight: 700 }}>
                <X size={13} /> Recusar
              </button>
            </div>
          </div>
        );
      })}

      {/* ── Serviço de HOJE ── */}
      {todayDemands.map(d => {
        const company   = findCompany(d.companyId);
        const rec       = todayRecord;
        const hasPunch  = rec?.checkIn;
        const isDone    = rec?.checkOut;
        const accent    = isDone ? '#475569' : '#059669';
        const serviceBg = isDone ? '#F8FAFC' : '#F0FDF4';
        const serviceColor = isDone ? '#475569' : '#059669';
        const statusLabel = isDone ? 'SERVIÇO CONCLUÍDO' : hasPunch ? 'TRABALHANDO AGORA' : 'SERVIÇO DE HOJE';

        return (
          <div key={d.id} className="card p-4" style={{ borderLeft: `4px solid ${accent}` }}>

            {/* Status pill */}
            <div className="flex items-center gap-2 mb-3">
              {isDone
                ? <CheckCircle2 size={13} style={{ color: accent }} />
                : <span className="w-2 h-2 rounded-full" style={{ background: accent, boxShadow: `0 0 0 3px ${accent}33` }} />
              }
              <span style={{ fontSize: '10px', fontWeight: 700, color: accent, letterSpacing: '0.06em' }}>{statusLabel}</span>
            </div>

            {/* Serviço em destaque */}
            <div style={{ background: serviceBg || '#F0FDF4', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', color: serviceColor || '#059669', fontWeight: 600, marginBottom: '2px' }}>Serviço</p>
              <p style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>{d.service}</p>
            </div>

            {/* Detalhes */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Briefcase size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{company?.name ?? d.companyName}</p>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                <p style={{ fontSize: '12px', color: '#475569' }}>
                  {fmtISO(d.date)} · <span style={{ fontWeight: 700, color: '#0F172A' }}>{d.time}</span>
                </p>
              </div>
              {(d.liderNome || company?.contact) && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                  <p style={{ fontSize: '12px', color: '#475569' }}>Líder: <span style={{ fontWeight: 600, color: '#0F172A' }}>{d.liderNome || company?.contact || '—'}</span></p>
                </div>
              )}
              {company?.address && (
                <div className="flex items-start gap-2">
                  <AlertCircle size={12} style={{ color: '#94A3B8', flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.4 }}>{company.address}</p>
                </div>
              )}
              {company?.location && (
                <a href={company.location} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: '#FF4D0C', textDecoration: 'none' }}>
                  📍 Ver localização no mapa
                </a>
              )}
            </div>

            {/* Horários batidos — aparece apenas quando há ponto registrado */}
            {hasPunch && (
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Horários registrados
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Entrada',   value: rec.checkIn },
                    { label: 'S. Almoço', value: rec.lunchOut },
                    { label: 'Retorno',   value: rec.lunchReturn },
                    { label: 'Saída',     value: rec.checkOut },
                  ].map(t => (
                    <div key={t.label} className="card-inner text-center" style={{ padding: '6px 8px' }}>
                      <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 500, marginBottom: '2px' }}>{t.label}</p>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: t.value ? '#0F172A' : '#CBD5E1' }}>{t.value ?? '—'}</p>
                    </div>
                  ))}
                </div>
                {rec.overtime && (
                  <div style={{ marginTop: '8px', padding: '7px 12px', borderRadius: '8px', background: '#F0FDF4', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={12} style={{ color: '#059669' }} />
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>Hora extra · {rec.overtime}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* ── Próximo serviço (1 só, cor laranja) ── */}
      {nextDemand && (() => {
        const company = findCompany(nextDemand.companyId);
        return (
          <div className="card p-4" style={{ borderLeft: '4px solid #FF4D0C' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full" style={{ background: '#FF4D0C', boxShadow: '0 0 0 3px rgba(255,77,12,0.15)' }} />
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#FF4D0C', letterSpacing: '0.06em' }}>PRÓXIMO SERVIÇO</span>
            </div>
            <div style={{ background: '#FFF5F2', borderRadius: '10px', padding: '10px 14px', marginBottom: '12px' }}>
              <p style={{ fontSize: '11px', color: '#FF4D0C', fontWeight: 600, marginBottom: '2px' }}>Serviço</p>
              <p style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>{nextDemand.service}</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Briefcase size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{company?.name ?? nextDemand.companyName}</p>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                <p style={{ fontSize: '12px', color: '#475569' }}>
                  {fmtISO(nextDemand.date)} · <span style={{ fontWeight: 700, color: '#0F172A' }}>{nextDemand.time}</span>
                </p>
              </div>
              {(nextDemand.liderNome || company?.contact) && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />
                  <p style={{ fontSize: '12px', color: '#475569' }}>Líder: <span style={{ fontWeight: 600, color: '#0F172A' }}>{nextDemand.liderNome || company?.contact || '—'}</span></p>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Sem demandas confirmadas mas com ponto hoje (fallback) */}
      {todayDemands.length === 0 && derivedState && derivedState !== 'scheduled' && todayRecord && (
        <div className="card p-5" style={{ borderLeft: `4px solid ${derivedState === 'completed' ? '#475569' : '#059669'}` }}>
          <div className="flex items-center gap-2 mb-3">
            {derivedState === 'completed'
              ? <CheckCircle2 size={13} style={{ color: '#475569' }} />
              : <span className="w-2 h-2 rounded-full" style={{ background: '#059669', boxShadow: '0 0 0 3px rgba(5,150,105,0.2)' }} />
            }
            <span style={{ fontSize: '10px', fontWeight: 700, color: derivedState === 'completed' ? '#475569' : '#059669', letterSpacing: '0.06em' }}>
              {derivedState === 'completed' ? 'SERVIÇO CONCLUÍDO' : 'TRABALHANDO AGORA'}
            </span>
          </div>
          <p className="text-base font-bold mb-3" style={T}>{getCompany(todayRecord.companyId)?.name}</p>
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'Entrada',   value: todayRecord.checkIn },
              { label: 'S. Almoço', value: todayRecord.lunchOut },
              { label: 'Retorno',   value: todayRecord.lunchReturn },
              { label: 'Saída',     value: todayRecord.checkOut },
            ].map(t => (
              <div key={t.label} className="card-inner text-center" style={{ padding: '6px 8px' }}>
                <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 500, marginBottom: '2px' }}>{t.label}</p>
                <p style={{ fontSize: '13px', fontWeight: 700, color: t.value ? '#0F172A' : '#CBD5E1' }}>{t.value ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sem nenhuma alocação */}
      {todayDemands.length === 0 && !nextDemand && pendingDemands.length === 0 && !derivedState && (
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#F1F5F9' }}>
            <AlertCircle size={18} style={{ color: '#94A3B8' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={T}>Sem alocação</p>
            <p className="text-xs" style={TM}>Nenhum serviço agendado</p>
          </div>
        </div>
      )}

      {/* Próximo pagamento */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-bold" style={T}>Próximo Pagamento</span>
          <span className="text-xs font-medium" style={TM}>{getQuinzenaLabel(TODAY).split('—')[1].trim()}</span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={T2}>Diárias: <span className="font-semibold" style={T}>{String(diarias).padStart(2,'0')}</span></span>
            <span className="text-sm font-semibold" style={T}>{fmtCurrency(totalDiarias)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={T2}>Horas extras: <span className="font-semibold" style={T}>{String(heCount).padStart(2,'0')}:00</span></span>
            <span className="text-sm font-semibold" style={T}>{fmtCurrency(totalHE)}</span>
          </div>

          <div style={{ height: '1px', background: 'rgba(0,0,0,0.07)', margin: '4px 0' }} />

          <div className="flex items-end justify-between">
            <div>
              <p className="text-xs mb-1" style={TM}>Total a receber</p>
              <p className="text-2xl font-black" style={{ color: '#059669' }}>{fmtCurrency(totalReceber)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs mb-1" style={TM}>Previsão de pagamento</p>
              <p className="text-xl font-bold" style={T}>05/06</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

// ── Pagamentos ───────────────────────────────────────────────────────────────

function Pagamentos({ user, myRecords }) {
  const [openQ, setOpenQ] = useState(null);

  // Agrupar por quinzena
  const groups = {};
  myRecords.filter(r => r.status === 'completed' || r.status === 'active').forEach(r => {
    const key = getQuinzenaLabel(r.date);
    const bounds = getQuinzenaBounds(r.date);
    if (!groups[key]) groups[key] = { label: key, bounds, records: [] };
    groups[key].records.push(r);
  });

  const quinzenas = Object.values(groups).sort((a, b) => b.bounds.start.localeCompare(a.bounds.start));

  if (quinzenas.length === 0) {
    return (
      <div className="py-14 text-center">
        <DollarSign size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
        <p className="text-sm" style={TM}>Nenhum pagamento encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quinzenas.map(q => {
        const diarias  = q.records.filter(r => r.status !== 'absent').length;
        const heCount  = q.records.filter(r => r.overtime).length;
        const total    = diarias * VALOR_DIARIA + heCount * VALOR_HE;
        const isOpen   = openQ === q.label;
        const isCurrent = q.bounds.start <= TODAY && TODAY <= q.bounds.end;

        return (
          <div key={q.label} className="card overflow-hidden">
            {/* Header */}
            <button
              onClick={() => setOpenQ(isOpen ? null : q.label)}
              className="w-full text-left"
              style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', gap: '12px' }}
            >
              <div style={{ flex: 1 }}>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold" style={T}>{q.label}</p>
                  {isCurrent && (
                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#FFF2EE', color: '#FF4D0C', letterSpacing: '0.04em' }}>ATUAL</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={TM}>{diarias} diária{diarias !== 1 ? 's' : ''}</span>
                  {heCount > 0 && <span className="text-xs" style={{ color: '#7C3AED' }}>{heCount} H.E.</span>}
                  <span className="text-xs font-bold" style={{ color: '#059669' }}>{fmtCurrency(total)}</span>
                </div>
              </div>
              {isOpen ? <ChevronUp size={16} style={{ color: '#94A3B8', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />}
            </button>

            {/* Detalhe */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                {/* Resumo */}
                <div className="grid grid-cols-3 gap-3 p-4" style={{ background: '#F8FAFC' }}>
                  {[
                    { label: 'Diárias',      value: diarias,            color: '#FF4D0C' },
                    { label: 'H. Extras',    value: heCount,            color: '#7C3AED' },
                    { label: 'Total',        value: fmtCurrency(total), color: '#059669', small: true },
                  ].map(s => (
                    <div key={s.label} className="text-center">
                      <p className={`font-bold ${s.small ? 'text-sm' : 'text-xl'} leading-tight`} style={{ color: s.color }}>{s.value}</p>
                      <p className="text-xs mt-0.5" style={TM}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Lista de diárias */}
                {q.records.sort((a, b) => b.date.localeCompare(a.date)).map((rec, idx) => {
                  const company = getCompany(rec.companyId);
                  const valor   = rec.status === 'absent' ? 0 : VALOR_DIARIA + (rec.overtime ? VALOR_HE : 0);
                  const [, m, d] = rec.date.split('-');
                  const dow = DOW[new Date(`${rec.date}T12:00:00`).getDay()];

                  return (
                    <div key={rec.id} style={{
                      display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                      borderTop: '1px solid rgba(0,0,0,0.04)',
                    }}>
                      <div style={{ textAlign: 'center', minWidth: '36px' }}>
                        <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>{dow}</p>
                        <p style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>{d}/{m}</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{company?.name}</p>
                        <p style={{ fontSize: '11px', color: '#94A3B8' }}>{rec.service}{rec.overtime ? ' · H.E. ' + rec.overtime : ''}</p>
                      </div>
                      <div className="text-right">
                        <p style={{ fontSize: '13px', fontWeight: 700, color: rec.status === 'absent' ? '#E11D48' : '#059669' }}>
                          {rec.status === 'absent' ? 'Falta' : fmtCurrency(valor)}
                        </p>
                        {rec.checkIn && <p style={{ fontSize: '10px', color: '#94A3B8' }}>{rec.checkIn} → {rec.checkOut ?? '—'}</p>}
                      </div>
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

// ── Histórico ────────────────────────────────────────────────────────────────

function Historico({ myRecords, demands, userId }) {
  const [openQ, setOpenQ] = useState(null);

  // Usa demands reais do banco (inclui todas as escalas passadas)
  const pastDemands = demands
    .map(d => ({ ...d, myEntry: d.employees?.find(e => e.employeeId === userId) }))
    .filter(d => d.myEntry && d.date < TODAY)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Agrupa por quinzena
  const groups = {};
  pastDemands.forEach(d => {
    const key    = getQuinzenaLabel(d.date);
    const bounds = getQuinzenaBounds(d.date);
    if (!groups[key]) groups[key] = { label: key, bounds, items: [] };
    groups[key].items.push(d);
  });

  const quinzenas = Object.values(groups).sort((a, b) => b.bounds.start.localeCompare(a.bounds.start));

  const STATUS_LABEL = {
    finalizado: { label: 'Trabalhado',   color: '#059669' },
    falta:      { label: 'Falta',        color: '#E11D48' },
    confirmado: { label: 'Realizado',    color: '#059669' },
    atrasado:   { label: 'Atrasado',     color: '#D97706' },
    aguardando: { label: 'Aguardando',   color: '#94A3B8' },
  };

  if (quinzenas.length === 0) {
    return (
      <div className="py-14 text-center">
        <Calendar size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
        <p className="text-sm" style={TM}>Nenhum histórico disponível</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {quinzenas.map(q => {
        const trabalhados = q.items.filter(d => ['finalizado','confirmado','atrasado'].includes(d.myEntry.status)).length;
        const isOpen = openQ === q.label;
        const total  = trabalhados * VALOR_DIARIA;

        return (
          <div key={q.label} className="card overflow-hidden">
            <button onClick={() => setOpenQ(isOpen ? null : q.label)} className="w-full text-left"
              style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <p className="text-sm font-bold mb-1" style={T}>{q.label}</p>
                <div className="flex items-center gap-3">
                  <span className="text-xs" style={TM}>{trabalhados} dia{trabalhados !== 1 ? 's' : ''} trabalhado{trabalhados !== 1 ? 's' : ''}</span>
                  <span className="text-xs font-bold" style={{ color: '#059669' }}>{fmtCurrency(total)}</span>
                </div>
              </div>
              {isOpen ? <ChevronUp size={16} style={{ color: '#94A3B8', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: '#94A3B8', flexShrink: 0 }} />}
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                {q.items.map(d => {
                  const [, m, dy] = d.date.split('-');
                  const dow = DOW[new Date(`${d.date}T12:00:00`).getDay()];
                  const st = STATUS_LABEL[d.myEntry.status] || STATUS_LABEL.confirmado;
                  const entrada = d.myEntry.entrada;
                  const saida   = d.myEntry.saida;
                  const falta   = d.myEntry.status === 'falta';

                  return (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.04)', opacity: falta ? 0.6 : 1 }}>
                      <div style={{ textAlign: 'center', minWidth: '36px' }}>
                        <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>{dow}</p>
                        <p style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>{dy}/{m}</p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{d.companyName}</p>
                        <p style={{ fontSize: '11px', color: '#94A3B8' }}>{d.service || '—'}</p>
                      </div>
                      <div className="text-right">
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: falta ? '#FFE4E6' : '#DCFCE7', color: st.color }}>
                          {st.label}
                        </span>
                        {entrada && <p style={{ fontSize: '10px', color: '#94A3B8', marginTop: '3px' }}>{entrada}{saida ? ` → ${saida}` : ''}</p>}
                      </div>
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

// ── Main ─────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'visao',       label: 'Visão Geral' },
  { key: 'pagamentos',  label: 'Pagamentos' },
  { key: 'historico',   label: 'Histórico' },
  { key: 'ocorrencia',  label: 'Ocorrência' },
];

// ── Tab: Ocorrência ────────────────────────────────────────────────────────
function TabOcorrencia({ user, todayRecord }) {
  const [form, setForm]       = useState({ descricao: '', fotoUrl: '', data: TODAY });
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.descricao.trim()) return;
    setSaving(true);
    await createOcorrencia({
      ajudanteId: user.id,
      empresaId:  todayRecord?.companyId  || null,
      escalaId:   todayRecord?.escalaId   || null,
      liderId:    null,
      data:       form.data,
      descricao:  form.descricao,
      fotoUrl:    form.fotoUrl || null,
    });
    setSaving(false);
    setSuccess(true);
    setForm({ descricao: '', fotoUrl: '', data: TODAY });
    setTimeout(() => setSuccess(false), 4000);
  };

  return (
    <div className="space-y-4">
      <p style={{ fontSize: '13px', color: '#64748B' }}>
        Registre qualquer ocorrência para o seu líder de equipe.
      </p>

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '12px', background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
          <CheckCircle2 size={16} style={{ color: '#059669' }} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>Ocorrência registrada com sucesso!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-4 space-y-3">
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Data</label>
          <input type="date" className="input-field" value={form.data}
            onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Descrição *</label>
          <textarea className="input-field" rows={4} required
            placeholder="Descreva o que aconteceu — produto danificado, atraso, acidente, problema com motorista..."
            value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            style={{ resize: 'none' }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Link da foto (opcional)</label>
          <input type="url" className="input-field" placeholder="https://..."
            value={form.fotoUrl} onChange={e => setForm(f => ({ ...f, fotoUrl: e.target.value }))} />
        </div>
        <button type="submit" disabled={saving} style={{
          width: '100%', padding: '12px', borderRadius: '12px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
          fontSize: '13px', fontWeight: 700, background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}>
          {saving ? 'Enviando...' : 'Registrar ocorrência'}
        </button>
      </form>
    </div>
  );
}

export default function EmployeeDashboard() {
  const { user, demands, updateDemandStatus, companies } = useAuth();
  const [tab, setTab] = useState('visao');

  // Registro de hoje vindo do Supabase (atualizado em tempo real)
  const [liveRecord, setLiveRecord] = useState(null);
  const [syncReady,  setSyncReady]  = useState(false);

  const loadToday = useCallback(async () => {
    const rec = await fetchTodayRecord(user.id, TODAY);
    if (rec !== null) setLiveRecord(rec);
    setSyncReady(true);
  }, [user.id]);

  useEffect(() => {
    // Carga inicial
    loadToday();

    // Realtime: atualiza instantaneamente quando o ponto é batido
    const unsubscribe = subscribeToRecord(user.id, TODAY, (rec) => {
      setLiveRecord(rec);
    });

    // Polling a cada 30s como fallback (caso o realtime falhe)
    const poll = setInterval(loadToday, 30_000);

    return () => { unsubscribe(); clearInterval(poll); };
  }, [loadToday]);

  // Usa o registro do Supabase se disponível, senão usa o mock
  const mockRecords = WORK_RECORDS.filter(r => r.employeeId === user.id)
    .sort((a, b) => b.date.localeCompare(a.date));

  // Para o registro de hoje: Supabase tem prioridade sobre mock
  const effectiveTodayRecord = syncReady ? liveRecord : mockRecords.find(r => r.date === TODAY);

  const myRecords = mockRecords.map(r =>
    r.date === TODAY && liveRecord ? liveRecord : r
  );

  const weekday = WEEKDAYS[TODAY_DATE.getDay()];
  const month   = MONTHS[TODAY_DATE.getMonth()];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-lg" style={T}>
          <span className="font-bold">Olá,</span>{' '}
          <span style={{ fontWeight: 400, fontSize: '16px' }}>{user.name.split(' ')[0]}</span>
        </h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.05)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
            style={tab === t.key
              ? { background: '#fff', color: '#FF4D0C', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
              : { color: '#64748B' }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'visao'      && <VisaoGeral    user={user} myRecords={myRecords} demands={demands} updateDemandStatus={updateDemandStatus} todayOverride={effectiveTodayRecord} companies={companies} />}
      {tab === 'pagamentos' && <Pagamentos    user={user} myRecords={myRecords} />}
      {tab === 'historico'  && <Historico     myRecords={myRecords} demands={demands} userId={user.id} />}
      {tab === 'ocorrencia' && <TabOcorrencia user={user} todayRecord={effectiveTodayRecord} />}
    </div>
  );
}
