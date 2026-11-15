import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { calculateWorkAndOvertime } from '../../lib/timeUtils';
import DemandForm from '../../components/admin/DemandForm';
import AvaliacaoDiariaModal from '../../components/shared/AvaliacaoDiariaModal';
import { StarsDisplay } from '../../components/shared/StarRating';
import { fetchNotasByEscala, fetchNotasResumo } from '../../lib/db';
import { fmtNota } from '../../lib/notas';
import {
  Building2, Calendar, Clock, ChevronDown, CheckCircle2,
  Send, ClipboardList, Search, AlertCircle,
  ChevronRight, Trash2, Edit2, ArrowLeft, Plus, Users, X, Flame, Sparkles, Star,
} from 'lucide-react';

const T  = { color: '#0B0B0B' };
const TM = { color: '#9A9A9A' };

const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const dow = DOW[new Date(`${iso}T12:00:00`).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
}

export const STATUS_CONFIG = {
  aguardando: { label: 'Aguardando', color: '#6B6B6B', bg: '#F7F7F7' },
  confirmado: { label: 'Confirmado', color: '#0B0B0B', bg: '#F5F5F5' },
  atrasado:   { label: 'Atrasado',   color: '#E03A00', bg: '#FFF7F4' },
  falta:      { label: 'Falta',      color: '#4A4A4A', bg: '#F5F5F5' },
  finalizado: { label: 'Finalizado', color: '#6B6B6B', bg: '#F5F5F5' },
};

const ADMIN_STATUS_OPTIONS = ['aguardando','confirmado','atrasado','falta','finalizado'];

// ── Badge de Cálculo em Tempo Real de Horas e Horas Extras ──────────────
function OvertimeBadge({ entrada, saida, saidaAlmoco, retornoAlmoco, isCargaDescarga }) {
  if (!entrada) {
    return (
      <span style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 600 }}>
        Sem entrada
      </span>
    );
  }

  if (!saida) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '3px',
        fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px',
        background: '#F5F5F5', color: '#4A4A4A', border: '1px solid #F5F5F5',
      }}>
        <Clock size={10} /> Em andamento
      </span>
    );
  }

  const calc = calculateWorkAndOvertime(
    entrada,
    saida,
    isCargaDescarga ? null : saidaAlmoco,
    isCargaDescarga ? null : retornoAlmoco
  );

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
      <span style={{
        fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px',
        background: '#F5F5F5', color: '#333333', border: '1px solid #E4E4E4',
      }} title={`Tempo de trabalho líquido: ${calc.workedFormatted}`}>
        Jornada: {calc.workedFormatted}
      </span>

      {calc.hasOvertime ? (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '3px',
          fontSize: '10px', fontWeight: 800, padding: '2px 7px', borderRadius: '6px',
          background: '#FFF7F4', color: '#FF4D0C', border: '1px solid rgba(255,77,12,0.25)',
        }} title={calc.hasLunch ? 'Calculado com base de 8h + 1h intervalo' : 'Calculado com base de 8h (sem intervalo)'}>
          <Flame size={11} /> +{calc.overtimeFormatted} HE
        </span>
      ) : (
        <span style={{
          fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '6px',
          background: '#F5F5F5', color: '#0B0B0B', border: '1px solid #E6E6E6',
        }}>
          0h HE
        </span>
      )}
    </div>
  );
}

// ── Badge de status com dropdown ──────────────────────────────────────────
function StatusBadge({ status, onChangeStatus }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.aguardando;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '6px',
          background: cfg.bg, color: cfg.color, border: 'none', cursor: 'pointer',
        }}
      >
        {cfg.label}
        <ChevronDown size={10} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: 'calc(100% + 4px)', zIndex: 100,
          background: '#fff', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          border: '1px solid rgba(0,0,0,0.07)', minWidth: '140px', overflow: 'hidden',
        }}>
          {ADMIN_STATUS_OPTIONS.map(s => {
            const c = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); onChangeStatus(s); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 12px', border: 'none', background: s === status ? c.bg : 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { if (s !== status) e.currentTarget.style.background = '#F7F7F7'; }}
                onMouseLeave={e => { if (s !== status) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: s === status ? c.color : '#333333' }}>{c.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Modal de detalhe de uma demanda ──────────────────────────────────────
const TIME_FIELDS_ENTREGA = [
  { key: 'entrada',       label: 'Entrada' },
  { key: 'saidaAlmoco',   label: 'Almoço' },
  { key: 'retornoAlmoco', label: 'Retorno' },
  { key: 'saida',         label: 'Saída' },
];
const TIME_FIELDS_CD = [
  { key: 'entrada', label: 'Início' },
  { key: 'saida',   label: 'Final' },
];

function DemandModal({ demand, employees, onChangeStatus, onUpdateTimes, onUpdateAllTimes, onEdit, onDelete, onClose, onRatingsSaved }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [batchSaida, setBatchSaida] = useState('17:00');
  const [batchEntrada, setBatchEntrada] = useState(demand.time || '07:30');
  const [batchSuccess, setBatchSuccess] = useState('');
  const [showRatings, setShowRatings] = useState(false);
  const [notas, setNotas] = useState({});
  const timeFields = demand.tipoServico === 'carga_descarga' ? TIME_FIELDS_CD : TIME_FIELDS_ENTREGA;

  const reloadNotas = useCallback(async () => {
    const list = await fetchNotasByEscala(demand.id);
    const map = {};
    list.forEach(n => { map[n.funcionarioId] = n; });
    setNotas(map);
  }, [demand.id]);

  useEffect(() => { reloadNotas(); }, [reloadNotas]);

  const ratedCount    = demand.employees.filter(e => notas[e.employeeId]).length;
  const todasAvaliadas = demand.employees.length > 0 && ratedCount >= demand.employees.length;

  const getNowTime = () => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  };

  // Fecha com Esc
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleApplyBatchSaida = async (timeVal) => {
    const val = timeVal || batchSaida;
    if (!val) return;
    if (onUpdateAllTimes) {
      await onUpdateAllTimes(demand.id, { saida: val });
    } else {
      for (const emp of demand.employees) {
        await onUpdateTimes(demand.id, emp.employeeId, { saida: val });
      }
    }
    setBatchSuccess(`Saída (${val}) aplicada para toda a equipe!`);
    setTimeout(() => setBatchSuccess(''), 3000);
  };

  const handleApplyBatchEntrada = async (timeVal) => {
    const val = timeVal || batchEntrada;
    if (!val) return;
    if (onUpdateAllTimes) {
      await onUpdateAllTimes(demand.id, { entrada: val });
    } else {
      for (const emp of demand.employees) {
        await onUpdateTimes(demand.id, emp.employeeId, { entrada: val });
      }
    }
    setBatchSuccess(`Entrada (${val}) aplicada para toda a equipe!`);
    setTimeout(() => setBatchSuccess(''), 3000);
  };

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(11, 11, 11,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '620px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column', maxHeight: '90vh',
        overflow: 'hidden',
      }}>

        {/* ── Topo com empresa + dados ── */}
        <div style={{
          padding: '22px 24px 18px',
          position: 'relative',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}>
          {/* Fechar */}
          <button onClick={onClose} style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#F5F5F5', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9A9A9A',
          }}>
            <X size={15} />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
              background: demand.tipoServico === 'carga_descarga' ? '#F5F5F5' : '#F5F5F5',
              color: demand.tipoServico === 'carga_descarga' ? '#0B0B0B' : '#4A4A4A',
            }}>
              {demand.tipoServico === 'carga_descarga' ? 'Carga e Descarga' : 'Entrega'}
            </span>
            <span style={{ fontSize: '11px', color: '#9A9A9A', fontWeight: 600 }}>Gestão Manual de Horários</span>
          </div>

          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0B0B0B', lineHeight: 1.2, marginBottom: '14px' }}>
            {demand.companyName}
          </p>

          {/* Três métricas em linha */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Horário entrada */}
            <div style={{ flex: 1, background: '#FFF7F4', borderRadius: '12px', padding: '9px 12px', border: '1px solid rgba(255,77,12,0.12)' }}>
              <p style={{ fontSize: '9px', fontWeight: 600, color: '#FF4D0C', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Entrada Padrão</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: '#0B0B0B', lineHeight: 1 }}>{demand.time || '—'}</p>
            </div>
            {/* Ajudantes */}
            <div style={{ flex: 1, background: '#F7F7F7', borderRadius: '12px', padding: '9px 12px', border: '1px solid rgba(11, 11, 11,0.06)' }}>
              <p style={{ fontSize: '9px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Ajudantes</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: '#0B0B0B', lineHeight: 1 }}>{demand.employees.length}</p>
            </div>
            {/* Data */}
            <div style={{ flex: 1, background: '#F7F7F7', borderRadius: '12px', padding: '9px 12px', border: '1px solid rgba(11, 11, 11,0.06)' }}>
              <p style={{ fontSize: '9px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Data da Escala</p>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#0B0B0B', lineHeight: 1 }}>{formatDate(demand.date).split(',')[0]}<br/><span style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A' }}>{formatDate(demand.date).split(', ')[1]}</span></p>
            </div>
          </div>

          {/* Avaliações da diária */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
            marginTop: '12px', padding: '9px 11px', borderRadius: '10px',
            background: todasAvaliadas ? '#FAFAFA' : '#FFF7F4',
            border: todasAvaliadas ? '1px solid #E6E6E6' : '1px solid #FFD9CC',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
              <Star size={14} style={{ color: todasAvaliadas ? '#0B0B0B' : '#FF4D0C', flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '11px', fontWeight: 800, color: '#0B0B0B' }}>Notas dos ajudantes</p>
                <p style={{ fontSize: '10px', color: '#6B6B6B' }}>
                  {ratedCount} de {demand.employees.length} avaliados · notas de 0 a 5
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRatings(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 11px',
                borderRadius: '8px', border: 'none', background: '#0B0B0B', color: '#fff',
                fontSize: '11px', fontWeight: 800, cursor: 'pointer', flexShrink: 0,
              }}
            >
              <Star size={11} /> Lançar notas
            </button>
          </div>
        </div>

        {/* ── Barra de Ações Rápidas em Massa ── */}
        <div style={{ background: '#F7F7F7', padding: '12px 24px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#4A4A4A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            ⚡ Ações Rápidas para Toda a Equipe
          </p>

          <div className="flex flex-wrap items-center gap-3">
            {/* Definir Saída em Massa */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B' }}>Saída:</span>
              <input
                type="time"
                value={batchSaida}
                onChange={e => setBatchSaida(e.target.value)}
                style={{ fontSize: '11px', padding: '4px 6px', borderRadius: '7px', border: '1px solid #C8C8C8', width: '85px', background: 'white' }}
              />
              <button
                type="button"
                onClick={() => handleApplyBatchSaida(batchSaida)}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '5px 9px', borderRadius: '7px',
                  background: '#0B0B0B', color: 'white', border: 'none', cursor: 'pointer',
                }}
              >
                Aplicar Saída p/ Todos
              </button>
              <button
                type="button"
                onClick={() => handleApplyBatchSaida(getNowTime())}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '5px 8px', borderRadius: '7px',
                  background: '#F5F5F5', color: '#0B0B0B', border: '1px solid #E6E6E6', cursor: 'pointer',
                }}
              >
                Finalizar Agora ({getNowTime()})
              </button>
            </div>

            {/* Definir Entrada em Massa */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B6B6B' }}>Entrada:</span>
              <input
                type="time"
                value={batchEntrada}
                onChange={e => setBatchEntrada(e.target.value)}
                style={{ fontSize: '11px', padding: '4px 6px', borderRadius: '7px', border: '1px solid #C8C8C8', width: '85px', background: 'white' }}
              />
              <button
                type="button"
                onClick={() => handleApplyBatchEntrada(batchEntrada)}
                style={{
                  fontSize: '11px', fontWeight: 700, padding: '5px 9px', borderRadius: '7px',
                  background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer',
                }}
              >
                Aplicar Entrada
              </button>
            </div>
          </div>

          {batchSuccess && (
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#0B0B0B', marginTop: '6px' }}>
              ✓ {batchSuccess}
            </p>
          )}
        </div>

        {/* ── Lista de ajudantes ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'between', padding: '10px 24px 6px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Horários Individuais dos Ajudantes ({demand.employees.length})
            </p>
          </div>

          {demand.employees.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px 0', fontSize: '13px', color: '#9A9A9A' }}>
              Nenhum ajudante escalado
            </p>
          ) : demand.employees.map(({ employeeId, status, entrada, saida, saidaAlmoco, retornoAlmoco }, idx) => {
            const emp = employees.find(e => e.id === employeeId);
            const isLast = idx === demand.employees.length - 1;
            const hasSaida = Boolean(saida);
            const hasEntrada = Boolean(entrada);

            return (
              <div key={employeeId} style={{
                display: 'flex', flexDirection: 'column', gap: '8px',
                padding: '12px 24px',
                borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.06)',
                background: hasSaida ? '#FAFAFA' : status === 'falta' ? '#F5F5F5' : 'white',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Avatar */}
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                    background: emp?.color || '#9A9A9A',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: 'white',
                  }}>
                    {emp?.initials}
                  </div>

                  {/* Nome & Status */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center gap-2">
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#0B0B0B' }}>{emp?.name || '—'}</p>
                      {hasSaida ? (
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#F5F5F5', color: '#0B0B0B' }}>
                          Concluído
                        </span>
                      ) : hasEntrada ? (
                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#F5F5F5', color: '#4A4A4A' }}>
                          Trabalhando
                        </span>
                      ) : (
                        <span style={{ fontSize: '9px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#F5F5F5', color: '#6B6B6B' }}>
                          Aguardando
                        </span>
                      )}
                      {notas[employeeId] && (
                        <span
                          title={notas[employeeId].observacao || 'Nota lançada pelo encarregado'}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                            fontSize: '9px', fontWeight: 800, color: '#0B0B0B',
                            background: '#F4F4F5', padding: '1px 6px', borderRadius: '4px',
                          }}
                        >
                          <StarsDisplay value={notas[employeeId].nota} size={8} />
                          {fmtNota(notas[employeeId].nota)}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '10px', color: '#9A9A9A' }}>Diária: R$ {emp?.dailyRate || 150}</p>
                  </div>

                  {/* Status badge & Overtime */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <OvertimeBadge
                      entrada={entrada}
                      saida={saida}
                      saidaAlmoco={saidaAlmoco}
                      retornoAlmoco={retornoAlmoco}
                      isCargaDescarga={demand.tipoServico === 'carga_descarga'}
                    />
                    <StatusBadge
                      status={status}
                      onChangeStatus={(s) => onChangeStatus(demand.id, employeeId, s)}
                    />
                  </div>
                </div>

                {/* Linha de inputs de horários com atalhos rápidos */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end', marginLeft: '50px' }}>
                  {timeFields.map(({ key, label }) => {
                    const value = { entrada, saidaAlmoco, retornoAlmoco, saida }[key] || '';
                    const isSaidaField = key === 'saida';
                    const isEntradaField = key === 'entrada';

                    return (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontSize: '9px', fontWeight: 600, color: '#6B6B6B', textTransform: 'uppercase' }}>{label}</span>
                          {(isSaidaField || isEntradaField) && (
                            <button
                              type="button"
                              onClick={() => onUpdateTimes(demand.id, employeeId, { [key]: getNowTime() })}
                              style={{
                                fontSize: '8px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px',
                                background: '#F5F5F5', color: '#4A4A4A', border: 'none', cursor: 'pointer',
                              }}
                              title="Preencher horário atual"
                            >
                              Agora
                            </button>
                          )}
                        </div>
                        <input
                          type="time"
                          value={value}
                          onChange={e => onUpdateTimes(demand.id, employeeId, { [key]: e.target.value })}
                          style={{
                            fontSize: '12px', padding: '4px 6px', borderRadius: '7px',
                            border: value ? (isSaidaField ? '1.5px solid #0B0B0B' : '1px solid rgba(0,0,0,0.15)') : '1px dashed #C8C8C8',
                            color: '#0B0B0B', width: '92px',
                            background: value ? 'white' : '#F7F7F7',
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Rodapé ── */}
        <div style={{ display: 'flex', gap: '8px', padding: '14px 24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onEdit} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            background: '#F5F5F5', color: '#333333', border: 'none', cursor: 'pointer',
          }}>
            <Edit2 size={13} /> Editar Demanda
          </button>
          {confirmDelete ? (
            <>
              <button onClick={() => onDelete(demand.id)} style={{
                flex: 2, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                background: '#4A4A4A', color: 'white', border: 'none', cursor: 'pointer',
              }}>Confirmar exclusão</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                background: '#F5F5F5', color: '#333333', border: 'none', cursor: 'pointer',
              }}>Cancelar</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              background: '#F5F5F5', color: '#4A4A4A', border: 'none', cursor: 'pointer',
            }}>
              <Trash2 size={13} /> Deletar
            </button>
          )}
        </div>
      </div>

      {showRatings && (
        <AvaliacaoDiariaModal
          escala={demand}
          employees={employees}
          liderId={demand.liderId || null}
          onClose={() => setShowRatings(false)}
          onSaved={async () => { await reloadNotas(); onRatingsSaved?.(); }}
        />
      )}
    </div>,
    document.body
  );
}

// ── Acompanhar Demandas ───────────────────────────────────────────────────
function AcompanharDemandas({ demands, employees, companies, onChangeStatus, onUpdateTimes, onUpdateAllTimes, onDelete, onEdit, notasResumo = {}, onRatingsSaved }) {
  const [selectedId, setSelectedId] = useState(null);
  const [editingId,  setEditingId]  = useState(null);
  const [filterPeriod, setFilterPeriod] = useState('todas'); // 'todas' | 'hoje' | 'proximas' | 'passadas'
  const [searchQuery,  setSearchQuery]  = useState('');
  const [filterDate,   setFilterDate]   = useState('');

  const selectedDemand = demands.find(d => d.id === selectedId);
  const editingDemand  = demands.find(d => d.id === editingId);

  // Filtros
  const filteredDemands = demands.filter(d => {
    // Filtro por período
    if (filterPeriod === 'hoje' && d.date !== TODAY_ISO) return false;
    if (filterPeriod === 'proximas' && d.date <= TODAY_ISO) return false;
    if (filterPeriod === 'passadas' && d.date >= TODAY_ISO) return false;

    // Filtro por data específica
    if (filterDate && d.date !== filterDate) return false;

    // Filtro por busca de texto
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCompany = d.companyName?.toLowerCase().includes(q);
      const matchService = d.service?.toLowerCase().includes(q);
      const matchDate = d.date.includes(q);
      const matchEmp = d.employees?.some(de => {
        const emp = employees.find(e => e.id === de.employeeId);
        return emp?.name?.toLowerCase().includes(q);
      });
      if (!matchCompany && !matchService && !matchDate && !matchEmp) return false;
    }

    return true;
  });

  const countHoje     = demands.filter(d => d.date === TODAY_ISO).length;
  const countProximas = demands.filter(d => d.date > TODAY_ISO).length;
  const countPassadas = demands.filter(d => d.date < TODAY_ISO).length;

  return (
    <>
      {/* Modal de edição */}
      {editingDemand && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(11, 11, 11,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null); }}
        >
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '1040px', padding: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#0B0B0B' }}>Editar Demanda</p>
              <button onClick={() => setEditingId(null)} style={{ background: '#F5F5F5', border: 'none', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6B6B6B' }}>
                <X size={15} />
              </button>
            </div>
            <DemandForm
              initialData={{
                companyId:         editingDemand.companyId,
                date:              editingDemand.date,
                time:              editingDemand.time || editingDemand.entrada || '07:30',
                entrada:           editingDemand.employees?.[0]?.entrada || editingDemand.time || '07:30',
                saida:             editingDemand.employees?.[0]?.saida || '',
                saidaAlmoco:       editingDemand.employees?.[0]?.saidaAlmoco || '',
                retornoAlmoco:     editingDemand.employees?.[0]?.retornoAlmoco || '',
                service:           editingDemand.service || '',
                selectedEmployees: editingDemand.employees.map(e => e.employeeId),
                tipoServico:       editingDemand.tipoServico || 'entrega',
                employeeTimes:     editingDemand.employees.reduce((acc, e) => {
                  acc[e.employeeId] = {
                    entrada:       e.entrada || '',
                    saida:         e.saida || '',
                    saidaAlmoco:   e.saidaAlmoco || '',
                    retornoAlmoco: e.retornoAlmoco || '',
                  };
                  return acc;
                }, {}),
              }}
              employees={employees}
              companies={companies}
              submitLabel="Salvar Alterações"
              onCancel={() => setEditingId(null)}
              onSubmit={async (form) => {
                const ok = await onEdit(editingId, form);
                if (ok) setEditingId(null);
                return ok;
              }}
            />
          </div>
        </div>
      )}

      {/* Modal de detalhe */}
      {selectedDemand && (
        <DemandModal
          demand={selectedDemand}
          employees={employees}
          onChangeStatus={onChangeStatus}
          onUpdateTimes={onUpdateTimes}
          onUpdateAllTimes={onUpdateAllTimes}
          onEdit={() => { setEditingId(selectedDemand.id); setSelectedId(null); }}
          onDelete={async (id) => { await onDelete(id); setSelectedId(null); }}
          onRatingsSaved={onRatingsSaved}
          onClose={() => setSelectedId(null)}
        />
      )}

      <div className="space-y-4" style={{ maxWidth: '820px' }}>
        {/* Barra de Filtros e Busca */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Abas de período */}
            <div className="flex gap-1 p-0.5 rounded-xl" style={{ background: '#F5F5F5', border: '1px solid rgba(0,0,0,0.06)' }}>
              {[
                { key: 'todas',    label: 'Todas',    count: demands.length },
                { key: 'hoje',     label: 'Hoje',     count: countHoje },
                { key: 'proximas', label: 'Próximas', count: countProximas },
                { key: 'passadas', label: 'Passadas / Histórico', count: countPassadas },
              ].map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setFilterPeriod(key)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: filterPeriod === key ? '#0B0B0B' : 'transparent',
                    color:      filterPeriod === key ? 'white' : '#6B6B6B',
                    border:     'none',
                    cursor:     'pointer',
                  }}
                >
                  {label}
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '0 5px',
                    borderRadius: '4px',
                    background: filterPeriod === key ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                    color: filterPeriod === key ? 'white' : '#6B6B6B',
                  }}>
                    {count}
                  </span>
                </button>
              ))}
            </div>

            {/* Seletor de data específica */}
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: '11px', color: '#6B6B6B', fontWeight: 600 }}>Data:</span>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="input-field"
                style={{ fontSize: '12px', padding: '5px 8px', height: '32px', width: '135px' }}
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  title="Limpar filtro de data"
                  style={{ background: '#F5F5F5', border: 'none', borderRadius: '6px', padding: '6px', color: '#6B6B6B', cursor: 'pointer' }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Busca textual */}
          <div className="relative">
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9A9A9A' }} />
            <input
              type="text"
              placeholder="Buscar por empresa, serviço ou ajudante..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field"
              style={{ paddingLeft: '34px', fontSize: '12px', height: '36px' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9A9A9A', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredDemands.length === 0 ? (
            <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
              <ClipboardList size={32} className="mx-auto mb-2" style={{ color: '#C8C8C8' }} />
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#9A9A9A' }}>Nenhuma demanda encontrada</p>
              <p style={{ fontSize: '11px', color: '#C8C8C8', marginTop: '4px' }}>
                {demands.length === 0
                  ? 'Use "Nova Demanda" para cadastrar escalas de qualquer data'
                  : 'Tente alterar os filtros ou a busca acima'}
              </p>
            </div>
          ) : filteredDemands.map((d) => {
            const total = d.employees.length;
            const notasQtd = Math.min(notasResumo[d.id] || 0, total);
            const [y, m, day] = d.date.split('-');
            const isToday = d.date === TODAY_ISO;
            const isPast  = d.date < TODAY_ISO;
            const isFuture = d.date > TODAY_ISO;
            const isCargaDescarga = d.tipoServico === 'carga_descarga';
            const faltas = d.employees.filter(e => e.status === 'falta').length;
            const finalizados = d.employees.filter(e => e.status === 'finalizado' || e.saida).length;
            const emAndamento = d.employees.filter(e => e.entrada && !e.saida && e.status !== 'falta').length;

            return (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className="card"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center',
                  padding: '14px 18px', border: 'none', background: 'white',
                  cursor: 'pointer', textAlign: 'left', gap: '14px',
                  transition: 'box-shadow 0.15s, background 0.12s',
                  borderLeft: isToday ? '4px solid #FF4D0C' : isPast ? '4px solid #9A9A9A' : '4px solid #4A4A4A',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.boxShadow = ''; }}
              >
                {/* Data com Destaque */}
                <div style={{ textAlign: 'center', minWidth: '60px', flexShrink: 0 }}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase' }}>
                    {DOW[new Date(`${d.date}T12:00:00`).getDay()]}
                  </p>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: '#0B0B0B', lineHeight: 1.1 }}>
                    {day}/{m}
                  </p>
                  <p style={{ fontSize: '9px', color: '#9A9A9A' }}>{y}</p>
                </div>

                <div style={{ width: '1px', height: '32px', background: 'rgba(0,0,0,0.07)', flexShrink: 0 }} />

                {/* Empresa & Serviço */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#0B0B0B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {d.companyName}
                    </p>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '4px',
                      background: isCargaDescarga ? '#F5F5F5' : '#F5F5F5',
                      color: isCargaDescarga ? '#0B0B0B' : '#4A4A4A',
                    }}>
                      {isCargaDescarga ? 'Carga e Descarga' : 'Entrega'}
                    </span>
                    {isToday && (
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#FFF7F4', color: '#FF4D0C' }}>
                        Hoje
                      </span>
                    )}
                    {isPast && (
                      <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#F5F5F5', color: '#6B6B6B' }}>
                        Histórico
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', color: '#6B6B6B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.service || 'Serviço operacional'} {d.time ? `· Entrada: ${d.time}` : ''}
                  </p>
                </div>

                {/* Status / Ajudantes */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', fontSize: '12px', fontWeight: 700, color: '#0B0B0B' }}>
                      <Users size={13} style={{ color: '#FF4D0C' }} />
                      {total} ajudante{total !== 1 ? 's' : ''}
                    </div>
                    {faltas > 0 ? (
                      <p style={{ fontSize: '10px', color: '#4A4A4A', fontWeight: 600 }}>{faltas} falta{faltas !== 1 ? 's' : ''}</p>
                    ) : finalizados === total && total > 0 ? (
                      <p style={{ fontSize: '10px', color: '#0B0B0B', fontWeight: 600 }}>Todos finalizados</p>
                    ) : emAndamento > 0 ? (
                      <p style={{ fontSize: '10px', color: '#4A4A4A', fontWeight: 600 }}>{emAndamento} trabalhando</p>
                    ) : (
                      <p style={{ fontSize: '10px', color: '#9A9A9A' }}>{d.time || '07:30'}</p>
                    )}
                    {total > 0 && (
                      <p style={{
                        fontSize: '10px', fontWeight: 700, marginTop: '2px',
                        color: notasQtd >= total ? '#0B0B0B' : '#9A9A9A',
                      }}>
                        {notasQtd}/{total} notas
                      </p>
                    )}
                  </div>

                  <ChevronRight size={16} style={{ color: '#C8C8C8', flexShrink: 0 }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── helpers de data ───────────────────────────────────────────────────────
const TODAY_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

// ── Página principal ───────────────────────────────────────────────────────
export default function AdminDemanda() {
  const {
    employees,
    companies,
    demands,
    addDemand,
    updateDemandStatus,
    updateDemandTimes,
    updateDemandAllEmployeesTimes,
    removeDemand,
    changeDemand,
  } = useAuth();
  const [subTab, setSubTab] = useState('nova');
  const [notasResumo, setNotasResumo] = useState({});

  const reloadNotasResumo = useCallback(() => {
    fetchNotasResumo().then(setNotasResumo);
  }, []);

  useEffect(() => { reloadNotasResumo(); }, [reloadNotasResumo]);

  const handleNewDemand = async (form) => {
    return await addDemand({
      companyId:     form.companyId,
      date:          form.date,
      time:          form.entrada || form.time || '07:30',
      entrada:       form.entrada || form.time || '07:30',
      saida:         form.saida || null,
      saidaAlmoco:   form.saidaAlmoco || null,
      retornoAlmoco: form.retornoAlmoco || null,
      employeeTimes: form.employeeTimes || {},
      service:       form.service || 'Serviço operacional',
      employeeIds:   form.selectedEmployees,
      tipoServico:   form.tipoServico || 'entrega',
    });
  };

  const SUB_TABS = [
    { key: 'nova',        label: 'Nova Demanda',        icon: Plus },
    { key: 'acompanhar',  label: 'Acompanhar Demandas', icon: ClipboardList },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#F5F5F5', border: '1px solid rgba(0,0,0,0.06)' }}>
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: subTab === key ? 'white' : 'transparent',
              color:      subTab === key ? '#0B0B0B' : '#6B6B6B',
              border:     'none', cursor: 'pointer',
              boxShadow:  subTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon size={12} />
            {label}
            {key === 'acompanhar' && demands.length > 0 && (
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                background: subTab === key ? '#FFF7F4' : '#E4E4E4',
                color:      subTab === key ? '#0B0B0B' : '#6B6B6B',
              }}>
                {demands.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {subTab === 'nova' && (
        <div className="animate-fade-up" style={{ maxWidth: '1020px' }}>
          <DemandForm
            employees={employees}
            companies={companies}
            onSubmit={handleNewDemand}
            twoColumn
          />
        </div>
      )}

      {subTab === 'acompanhar' && (
        <div className="animate-fade-up">
          <AcompanharDemandas
            demands={demands}
            employees={employees}
            companies={companies}
            onChangeStatus={updateDemandStatus}
            onUpdateTimes={updateDemandTimes}
            onUpdateAllTimes={updateDemandAllEmployeesTimes}
            onDelete={removeDemand}
            onEdit={changeDemand}
            notasResumo={notasResumo}
            onRatingsSaved={reloadNotasResumo}
          />
        </div>
      )}
    </div>
  );
}
