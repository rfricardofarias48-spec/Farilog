import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchEscalasByLider, fetchAjudantesDisponiveis,
  upsertRelatorioDiario, fetchOcorrencias, createOcorrencia,
  createEscalaByLider, addRegistroToEscala,
  createTarefaRH, fetchEmpresasDoLider, fetchRelatoriosDiarios,
} from '../../lib/db';
import {
  Users, Calendar, CheckCircle2, AlertCircle, AlertTriangle,
  Plus, ChevronRight, X, Building2, FileText, RefreshCw,
  Search, Send, Clock, MessageSquare, ClipboardCheck,
} from 'lucide-react';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const DOW   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${DOW[new Date(`${iso}T12:00:00`).getDay()]}, ${d}/${m}/${y}`;
}

// ── Status badge ──────────────────────────────────────────────────────────
const STATUS_CFG = {
  aguardando: { label: 'Aguardando', color: '#D97706', bg: '#FEF3C7' },
  confirmado: { label: 'Confirmado', color: '#059669', bg: '#DCFCE7' },
  atrasado:   { label: 'Atrasado',   color: '#EA580C', bg: '#FFEDD5' },
  falta:      { label: 'Falta',      color: '#E11D48', bg: '#FFE4E6' },
  finalizado: { label: 'Finalizado', color: '#64748B', bg: '#F1F5F9' },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CFG[status] || STATUS_CFG.aguardando;
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

// ── Modal Substituto ──────────────────────────────────────────────────────
function ModalSubstituto({ escala, onClose, onRefresh }) {
  const [disponiveis, setDisponiveis] = useState([]);
  const [search, setSearch]           = useState('');
  const [adding, setAdding]           = useState(null);

  useEffect(() => { fetchAjudantesDisponiveis(TODAY).then(setDisponiveis); }, []);

  const handleAdd = async (emp) => {
    setAdding(emp.id);
    await addRegistroToEscala(escala.id, emp.id, escala.companyId, TODAY, escala.service);
    await onRefresh();
    onClose();
  };

  const filtered = disponiveis.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '440px' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Acionar substituto</p>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              {disponiveis.length} ajudante{disponiveis.length !== 1 ? 's' : ''} disponíve{disponiveis.length !== 1 ? 'is' : 'l'} hoje
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
        </div>
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="input-field" style={{ paddingLeft: '32px' }} placeholder="Buscar ajudante..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '24px 0' }}>
              Nenhum ajudante disponível hoje
            </p>
          ) : filtered.map(emp => (
            <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {emp.initials}
              </div>
              <p style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{emp.name}</p>
              <button onClick={() => handleAdd(emp)} disabled={!!adding}
                style={{ padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: adding ? 'wait' : 'pointer', fontSize: '12px', fontWeight: 700, background: '#FF4D0C', color: 'white', opacity: adding ? 0.6 : 1 }}>
                {adding === emp.id ? '...' : 'Escalar'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab: Hoje — monitoramento (read-only) ─────────────────────────────────
function TabHoje({ user, escalas, employees, onRefresh }) {
  const todayEscala = escalas.find(e => e.date === TODAY);
  const ajudantes   = todayEscala?.employees || [];

  const [modalSubst, setModalSubst]         = useState(false);
  const [ocorrencias, setOcorrencias]       = useState([]);
  const [solicitandoRH, setSolicitandoRH]   = useState(false);
  const [rhOk, setRhOk]                     = useState(false);

  const confirmados = ajudantes.filter(a => ['confirmado','finalizado'].includes(a.status)).length;
  const ausentes    = ajudantes.filter(a => a.status === 'falta').length;
  const total       = ajudantes.length;
  const sla         = total > 0 ? Math.round((confirmados / total) * 100) : null;

  useEffect(() => {
    if (todayEscala?.id) {
      fetchOcorrencias({ escalaId: todayEscala.id, data: TODAY }).then(setOcorrencias);
    }
  }, [todayEscala?.id]);

  const handleSolicitarRH = async () => {
    setSolicitandoRH(true);
    await createTarefaRH({
      tipo: `Solicitação urgente de ajudante — ${user.companyName || 'operação'}`,
      descricao: `Líder ${user.name} reportou banco insuficiente em ${fmtDate(TODAY)}. ${ausentes} falta(s) na escala.`,
      prioridade: 'alta',
    });
    setSolicitandoRH(false);
    setRhOk(true);
    setTimeout(() => setRhOk(false), 4000);
  };

  return (
    <div className="space-y-5">

      {/* Info: ponto vem do app dos ajudantes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '12px', background: '#EFF6FF', border: '1px solid #BFDBFE' }}>
        <Clock size={14} style={{ color: '#3B82F6', flexShrink: 0 }} />
        <p style={{ fontSize: '12px', color: '#1D4ED8', fontWeight: 500 }}>
          A confirmação de presença é registrada automaticamente pelo <strong>app de ponto dos ajudantes</strong>. Esta tela é somente leitura.
        </p>
      </div>

      {/* Banner falta → acionar substituto */}
      {ausentes > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '14px', background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={18} style={{ color: '#E11D48', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#E11D48' }}>
              {ausentes} falta{ausentes !== 1 ? 's' : ''} detectada{ausentes !== 1 ? 's' : ''}
            </p>
            <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>Acione substituto ou avise o RH</p>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => setModalSubst(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: '#0F172A', color: 'white', border: 'none', cursor: 'pointer' }}>
              <RefreshCw size={11} /> Substituto
            </button>
            <button onClick={handleSolicitarRH} disabled={solicitandoRH || rhOk}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: rhOk ? '#059669' : '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer', opacity: solicitandoRH ? 0.6 : 1 }}>
              <Send size={11} /> {rhOk ? 'Enviado!' : 'Avisar RH'}
            </button>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {[
          { label: 'Escalados',   value: total,       color: '#0F172A' },
          { label: 'Presentes',   value: confirmados, color: '#059669' },
          { label: 'Ausentes',    value: ausentes,    color: ausentes > 0 ? '#E11D48' : '#CBD5E1' },
          { label: 'SLA',         value: sla !== null ? `${sla}%` : '—', color: sla === null ? '#CBD5E1' : sla >= 80 ? '#059669' : sla >= 60 ? '#D97706' : '#E11D48' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '16px 12px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</p>
            <p style={{ fontSize: '26px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Lista da equipe — read-only */}
      <div className="card overflow-hidden">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Equipe — {fmtDate(TODAY)}</p>
            {todayEscala?.time && (
              <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={10} /> Início: {todayEscala.time}
              </p>
            )}
          </div>
          {todayEscala && (
            <button onClick={() => setModalSubst(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer' }}>
              <RefreshCw size={11} /> Substituto
            </button>
          )}
        </div>

        {ajudantes.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <Users size={28} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>Nenhuma escala para hoje</p>
          </div>
        ) : ajudantes.map(({ employeeId, status, entrada, saida, saidaAlmoco, retornoAlmoco }) => {
          const emp = employees.find(e => e.id === employeeId);
          const batidas = [
            { label: 'Entrada',   value: entrada        },
            { label: 'Saída alm.', value: saidaAlmoco  },
            { label: 'Retorno',   value: retornoAlmoco  },
            { label: 'Saída',     value: saida          },
          ];
          return (
            <div key={employeeId} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              {/* Linha principal: avatar + nome + status badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px 8px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {emp?.initials}
                </div>
                <p style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{emp?.name || '—'}</p>
                <StatusBadge status={status} />
              </div>
              {/* Linha de batidas de ponto */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0', paddingBottom: '10px', paddingLeft: '62px', paddingRight: '16px' }}>
                {batidas.map(({ label, value }) => (
                  <div key={label} style={{ textAlign: 'center', padding: '6px 4px', background: value ? '#F0FDF4' : '#F8FAFC', borderRadius: '8px', margin: '0 3px' }}>
                    <p style={{ fontSize: '9px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{label}</p>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: value ? '#059669' : '#CBD5E1', lineHeight: 1 }}>
                      {value || '—'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reportes dos ajudantes */}
      <div className="card overflow-hidden">
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={14} style={{ color: '#94A3B8' }} />
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Reportes da equipe hoje</p>
          {ocorrencias.length > 0 && (
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706' }}>
              {ocorrencias.length}
            </span>
          )}
        </div>
        {ocorrencias.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <CheckCircle2 size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>Nenhum reporte hoje</p>
          </div>
        ) : ocorrencias.map(oc => {
          const ajNome = oc.funcionarios?.nome || '—';
          const ajIni  = oc.funcionarios?.iniciais || '?';
          const ajCor  = oc.funcionarios?.cor || '#94A3B8';
          return (
            <div key={oc.id} style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {oc.ajudante_id ? (
                  <div style={{ width: '24px', height: '24px', borderRadius: '7px', background: ajCor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {ajIni}
                  </div>
                ) : (
                  <AlertCircle size={16} style={{ color: '#D97706', flexShrink: 0 }} />
                )}
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                  {oc.ajudante_id ? ajNome : 'Líder'} · {oc.criado_em ? new Date(oc.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                </p>
                <span style={{ marginLeft: 'auto', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '6px', background: oc.status === 'resolvido' ? '#DCFCE7' : '#FEF3C7', color: oc.status === 'resolvido' ? '#059669' : '#D97706' }}>
                  {oc.status === 'resolvido' ? 'Resolvido' : 'Aberto'}
                </span>
              </div>
              <p style={{ fontSize: '13px', color: '#0F172A', lineHeight: 1.5, paddingLeft: '32px' }}>{oc.descricao}</p>
            </div>
          );
        })}
      </div>

      {modalSubst && todayEscala && (
        <ModalSubstituto escala={todayEscala} onClose={() => setModalSubst(false)} onRefresh={onRefresh} />
      )}
    </div>
  );
}

// ── Tab: Histórico ────────────────────────────────────────────────────────
function TabHistorico({ user, escalas, employees }) {
  const [openId, setOpenId]       = useState(null);
  const [relatorios, setRelatorios] = useState([]);

  useEffect(() => {
    fetchRelatoriosDiarios(user.id).then(setRelatorios);
  }, [user.id]);

  const passadas = escalas
    .filter(e => e.date < TODAY)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (passadas.length === 0) {
    return (
      <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
        <Clock size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
        <p style={{ fontSize: '14px', color: '#94A3B8' }}>Nenhuma operação anterior registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
        {passadas.length} operaç{passadas.length !== 1 ? 'ões' : 'ão'} anterior{passadas.length !== 1 ? 'es' : ''}
      </p>

      {passadas.map(escala => {
        const isOpen      = openId === escala.id;
        const presentes   = escala.employees.filter(e => ['confirmado','finalizado'].includes(e.status)).length;
        const ausentes    = escala.employees.filter(e => e.status === 'falta').length;
        const total       = escala.employees.length;
        const sla         = total > 0 ? Math.round((presentes / total) * 100) : null;
        const relatorio   = relatorios.find(r => r.data === escala.date);
        const [y, m, d]   = escala.date.split('-');
        const dow         = DOW[new Date(`${escala.date}T12:00:00`).getDay()];

        return (
          <div key={escala.id} className="card overflow-hidden">
            {/* Header */}
            <button onClick={() => setOpenId(isOpen ? null : escala.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ textAlign: 'center', width: '40px', flexShrink: 0 }}>
                <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>{dow}</p>
                <p style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', lineHeight: 1.1 }}>{d}/{m}</p>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{escala.companyName || '—'}</p>
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                  {escala.time || '—'} · {escala.service || '—'} · {total} ajudante{total !== 1 ? 's' : ''}
                </p>
              </div>
              {/* SLA badge */}
              {sla !== null && (
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <p style={{ fontSize: '17px', fontWeight: 800, color: sla === 100 ? '#059669' : sla >= 75 ? '#D97706' : '#E11D48', lineHeight: 1 }}>{sla}%</p>
                  <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 600 }}>presença</p>
                </div>
              )}
              {/* Relatório badge */}
              {relatorio && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', background: '#DCFCE7', flexShrink: 0 }}>
                  <ClipboardCheck size={11} style={{ color: '#059669' }} />
                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#059669' }}>Relatório</span>
                </div>
              )}
              <ChevronRight size={14} style={{ color: '#CBD5E1', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
            </button>

            {/* Detalhe expandido */}
            {isOpen && (
              <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: '#FAFBFC' }}>
                {/* Equipe */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Equipe</p>
                  {escala.employees.map(({ employeeId, status, entrada, saida }) => {
                    const emp = employees.find(e => e.id === employeeId);
                    return (
                      <div key={employeeId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                          {emp?.initials}
                        </div>
                        <p style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{emp?.name || '—'}</p>
                        {entrada && <p style={{ fontSize: '11px', color: '#64748B' }}>{entrada}{saida ? ` → ${saida}` : ''}</p>}
                        <StatusBadge status={status} />
                      </div>
                    );
                  })}
                </div>

                {/* Relatório do líder */}
                {relatorio ? (
                  <div style={{ padding: '12px 16px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Relatório do dia</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '10px' }}>
                      {[
                        { label: 'Presentes',   value: relatorio.presentes,       color: '#059669' },
                        { label: 'Ausentes',    value: relatorio.ausentes,        color: relatorio.ausentes > 0 ? '#E11D48' : '#CBD5E1' },
                        { label: 'Ocorrências', value: relatorio.ocorrencias_count, color: relatorio.ocorrencias_count > 0 ? '#D97706' : '#CBD5E1' },
                      ].map((k, i) => (
                        <div key={i} style={{ padding: '8px', borderRadius: '8px', background: 'white', textAlign: 'center', border: '1px solid rgba(0,0,0,0.07)' }}>
                          <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 600, marginBottom: '4px' }}>{k.label}</p>
                          <p style={{ fontSize: '18px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
                        </div>
                      ))}
                    </div>
                    {relatorio.observacoes && (
                      <p style={{ fontSize: '12px', color: '#334155', lineHeight: 1.6, background: 'white', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.07)' }}>
                        {relatorio.observacoes}
                      </p>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <p style={{ fontSize: '12px', color: '#94A3B8' }}>Relatório não finalizado</p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Tab: Escala ───────────────────────────────────────────────────────────
function NovaEscalaForm({ user, onSaved, onCancel }) {
  const [form, setForm]             = useState({ date: TODAY, time: '07:00', service: '', companyId: '' });
  const [empresas, setEmpresas]     = useState([]);
  const [disponiveis, setDisp]      = useState([]);
  const [selected, setSelected]     = useState([]);
  const [loadingDisp, setLD]        = useState(false);
  const [saving, setSaving]         = useState(false);

  // Carrega empresas do líder ao montar
  useEffect(() => {
    fetchEmpresasDoLider(user.id).then(list => {
      setEmpresas(list);
      if (list.length === 1) setForm(f => ({ ...f, companyId: list[0].id }));
    });
  }, [user.id]);

  const loadDisp = async (date) => {
    setLD(true);
    setDisp(await fetchAjudantesDisponiveis(date));
    setLD(false);
  };

  useEffect(() => { loadDisp(form.date); }, [form.date]);

  const toggle = (id) =>
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.companyId) return alert('Selecione a empresa para esta escala.');
    if (selected.length === 0) return alert('Selecione ao menos um ajudante.');
    setSaving(true);
    await createEscalaByLider({ liderId: user.id, companyId: form.companyId, date: form.date, time: form.time, service: form.service, employeeIds: selected });
    setSaving(false);
    onSaved();
  };

  const empresaSel = empresas.find(e => e.id === form.companyId);

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Nova Escala</p>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
      </div>

      {/* Seletor de empresa */}
      <div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>
          Para qual empresa? *
        </label>
        {empresas.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhuma empresa vinculada ao seu perfil. Fale com o administrador.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {empresas.map(emp => {
              const sel = form.companyId === emp.id;
              return (
                <button key={emp.id} type="button" onClick={() => setForm(f => ({ ...f, companyId: emp.id }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '10px', border: `2px solid ${sel ? '#FF4D0C' : 'rgba(0,0,0,0.1)'}`, background: sel ? '#FFF5F2' : 'white', cursor: 'pointer' }}>
                  <Building2 size={13} style={{ color: sel ? '#FF4D0C' : '#94A3B8' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: sel ? '#FF4D0C' : '#0F172A' }}>{emp.name}</span>
                </button>
              );
            })}
          </div>
        )}
        {empresaSel?.responsavel && (
          <p style={{ fontSize: '11px', color: '#64748B', marginTop: '6px' }}>
            Responsável: {empresaSel.responsavel}{empresaSel.telefone ? ` · ${empresaSel.telefone}` : ''}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Data *</label>
          <input type="date" className="input-field" required value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Início</label>
          <input type="time" className="input-field" value={form.time}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Serviço</label>
          <input className="input-field" placeholder="Ex: Separação, Entrega, Carga..." value={form.service}
            onChange={e => setForm(f => ({ ...f, service: e.target.value }))} />
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
            Ajudantes disponíveis em {new Date(`${form.date}T12:00:00`).toLocaleDateString('pt-BR')}
          </p>
          {selected.length > 0 && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#FF4D0C' }}>
              {selected.length} selecionado{selected.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        {loadingDisp ? (
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>Carregando...</p>
        ) : disponiveis.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhum ajudante disponível nessa data</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
            {disponiveis.map(emp => {
              const sel = selected.includes(emp.id);
              return (
                <button key={emp.id} type="button" onClick={() => toggle(emp.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', border: `2px solid ${sel ? '#FF4D0C' : 'rgba(0,0,0,0.08)'}`, background: sel ? '#FFF5F2' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {emp.initials}
                  </div>
                  <p style={{ fontSize: '12px', fontWeight: 600, color: sel ? '#FF4D0C' : '#0F172A', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</p>
                  {sel && <CheckCircle2 size={13} style={{ color: '#FF4D0C', flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" onClick={onCancel}
          style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          style={{ flex: 2, padding: '11px', borderRadius: '10px', background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700 }}>
          {saving ? 'Criando...' : `Criar escala (${selected.length} ajudante${selected.length !== 1 ? 's' : ''})`}
        </button>
      </div>
    </form>
  );
}

function TabEscala({ user, escalas, employees, onRefresh }) {
  const [openId, setOpenId]     = useState(null);
  const [showForm, setShowForm] = useState(false);

  const today    = escalas.find(e => e.date === TODAY);
  const upcoming = escalas.filter(e => e.date > TODAY).sort((a, b) => a.date.localeCompare(b.date));
  const past     = escalas.filter(e => e.date < TODAY).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  function EscalaCard({ escala, highlight }) {
    const confirmados = escala.employees.filter(e => ['confirmado','finalizado'].includes(e.status)).length;
    const total       = escala.employees.length;
    const pct         = total > 0 ? Math.round((confirmados / total) * 100) : null;
    const isOpen      = openId === escala.id;
    return (
      <div className="card overflow-hidden" style={{ border: highlight ? '2px solid #FF4D0C' : undefined }}>
        <button onClick={() => setOpenId(isOpen ? null : escala.id)}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
          <div style={{ textAlign: 'center', width: '38px', flexShrink: 0 }}>
            <p style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{escala.date.split('-')[2]}</p>
            <p style={{ fontSize: '9px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>
              {MONTHS_SHORT[Number(escala.date.split('-')[1]) - 1]}
            </p>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{escala.companyName || '—'}</p>
            <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
              {escala.time || '—'} · {total} ajudante{total !== 1 ? 's' : ''}
              {escala.service ? ` · ${escala.service}` : ''}
            </p>
          </div>
          {pct !== null && (
            <div style={{ textAlign: 'center', flexShrink: 0 }}>
              <p style={{ fontSize: '16px', fontWeight: 800, color: pct === 100 ? '#059669' : pct >= 60 ? '#D97706' : '#E11D48', lineHeight: 1 }}>
                {pct}%
              </p>
              <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 600 }}>confirmado</p>
            </div>
          )}
          <ChevronRight size={14} style={{ color: '#CBD5E1', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
        </button>
        {isOpen && (
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: '#FAFBFC' }}>
            {escala.employees.map(({ employeeId, status, entrada, saida }) => {
              const emp = employees.find(e => e.id === employeeId);
              return (
                <div key={employeeId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {emp?.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{emp?.name || '—'}</p>
                    {entrada && <p style={{ fontSize: '10px', color: '#94A3B8' }}>{entrada}{saida ? ` → ${saida}` : ''}</p>}
                  </div>
                  <StatusBadge status={status} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
          {upcoming.length} próxima{upcoming.length !== 1 ? 's' : ''} · {past.length} recente{past.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => setShowForm(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> Nova escala
        </button>
      </div>

      {showForm && (
        <NovaEscalaForm user={user} onSaved={() => { setShowForm(false); onRefresh(); }} onCancel={() => setShowForm(false)} />
      )}

      {today && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#FF4D0C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Hoje</p>
          <EscalaCard escala={today} highlight />
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Próximas</p>
          <div className="space-y-3">
            {upcoming.map(e => <EscalaCard key={e.id} escala={e} />)}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Recentes</p>
          <div className="space-y-3">
            {past.map(e => <EscalaCard key={e.id} escala={e} />)}
          </div>
        </div>
      )}

      {!today && upcoming.length === 0 && !showForm && (
        <div className="card" style={{ padding: '48px 16px', textAlign: 'center' }}>
          <Calendar size={28} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>Nenhuma escala agendada</p>
        </div>
      )}
    </div>
  );
}

// ── Tab: Ocorrências ──────────────────────────────────────────────────────
function TabOcorrencias({ user, escalas, employees }) {
  const [ocorrencias, setOcorrencias] = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ descricao: '', data: TODAY, ajudanteId: '', fotoUrl: '' });
  const [loading, setLoading]         = useState(true);

  const load = () =>
    fetchOcorrencias({ empresaId: user.empresa_id })
      .then(o => { setOcorrencias(o); setLoading(false); });

  useEffect(() => { load(); }, [user.empresa_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.descricao.trim()) return;
    await createOcorrencia({
      liderId:    user.id,
      empresaId:  user.empresa_id,
      ajudanteId: form.ajudanteId || null,
      data:       form.data,
      descricao:  form.descricao,
      fotoUrl:    form.fotoUrl || null,
    });
    setForm({ descricao: '', data: TODAY, ajudanteId: '', fotoUrl: '' });
    setShowForm(false);
    load();
  };

  const deAjudantes = ocorrencias.filter(o => o.ajudante_id && !o.lider_id);
  const doLider     = ocorrencias.filter(o => o.lider_id === user.id);

  const OcCard = ({ oc }) => {
    const ajNome = oc.funcionarios?.nome || '—';
    const ajIni  = oc.funcionarios?.iniciais || '?';
    const ajCor  = oc.funcionarios?.cor || '#94A3B8';
    return (
      <div className="card p-4">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
            {oc.ajudante_id ? (
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: ajCor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {ajIni}
              </div>
            ) : (
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: '#FF4D0C', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertCircle size={16} style={{ color: 'white' }} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>
                {oc.ajudante_id ? ajNome : 'Registrado pelo líder'} · {fmtDate(oc.data)}
              </p>
              <p style={{ fontSize: '13px', color: '#0F172A', lineHeight: 1.5, marginTop: '4px' }}>{oc.descricao}</p>
              {oc.foto_url && (
                <a href={oc.foto_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: '11px', color: '#2563EB', fontWeight: 600, marginTop: '4px', display: 'inline-block' }}>
                  Ver foto →
                </a>
              )}
            </div>
          </div>
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: oc.status === 'resolvido' ? '#DCFCE7' : '#FEF3C7', color: oc.status === 'resolvido' ? '#059669' : '#D97706', flexShrink: 0 }}>
            {oc.status === 'resolvido' ? 'Resolvido' : 'Aberto'}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
          {ocorrencias.length} ocorrência{ocorrencias.length !== 1 ? 's' : ''} registrada{ocorrencias.length !== 1 ? 's' : ''}
        </p>
        <button onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> Registrar
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4 animate-fade-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Nova Ocorrência</p>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Data</label>
              <input type="date" className="input-field" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Ajudante envolvido</label>
              <select className="input-field" value={form.ajudanteId}
                onChange={e => setForm(f => ({ ...f, ajudanteId: e.target.value }))}>
                <option value="">Sem ajudante específico</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Descrição *</label>
            <textarea className="input-field" rows={4} required placeholder="Descreva o incidente com detalhes..."
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} style={{ resize: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Link da foto (opcional)</label>
            <input type="url" className="input-field" placeholder="https://..."
              value={form.fotoUrl} onChange={e => setForm(f => ({ ...f, fotoUrl: e.target.value }))} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Cancelar
            </button>
            <button type="submit"
              style={{ flex: 2, padding: '11px', borderRadius: '10px', background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
              Registrar ocorrência
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="card p-10 text-center text-sm" style={{ color: '#94A3B8' }}>Carregando...</div>
      ) : ocorrencias.length === 0 ? (
        <div className="card" style={{ padding: '48px 16px', textAlign: 'center' }}>
          <CheckCircle2 size={28} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>Nenhuma ocorrência registrada</p>
        </div>
      ) : (
        <>
          {deAjudantes.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#D97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Reportados pelos ajudantes ({deAjudantes.length})
              </p>
              <div className="space-y-3">
                {deAjudantes.map(o => <OcCard key={o.id} oc={o} />)}
              </div>
            </div>
          )}
          {doLider.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
                Registrados por você ({doLider.length})
              </p>
              <div className="space-y-3">
                {doLider.map(o => <OcCard key={o.id} oc={o} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Tab: Relatório ────────────────────────────────────────────────────────
function TabRelatorio({ user, escalas, employees }) {
  const todayEscala = escalas.find(e => e.date === TODAY);
  const ajudantes   = todayEscala?.employees || [];

  const [obs, setObs]           = useState('');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [ocorrencias, setOcorrencias] = useState([]);

  useEffect(() => {
    if (todayEscala?.id) {
      fetchOcorrencias({ escalaId: todayEscala.id, data: TODAY }).then(setOcorrencias);
    }
  }, [todayEscala?.id]);

  const presentes  = ajudantes.filter(a => ['confirmado','finalizado'].includes(a.status)).length;
  const ausentes   = ajudantes.filter(a => a.status === 'falta').length;
  const atrasados  = ajudantes.filter(a => a.status === 'atrasado').length;
  const total      = ajudantes.length;
  const sla        = total > 0 ? Math.round((presentes / total) * 100) : null;
  const ocCount    = ocorrencias.length;

  const handleFinalizar = async () => {
    setSaving(true);
    await upsertRelatorioDiario({
      liderId:          user.id,
      empresaId:        user.empresa_id,
      data:             TODAY,
      presentes,
      ausentes,
      ocorrenciasCount: ocCount,
      observacoes:      obs,
      finalizado:       true,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 5000);
  };

  return (
    <div className="space-y-5" style={{ maxWidth: '720px' }}>
      {/* Resumo do dia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        {[
          { label: 'Presentes',   value: presentes, color: presentes > 0 ? '#059669' : '#CBD5E1' },
          { label: 'Ausentes',    value: ausentes,  color: ausentes > 0 ? '#E11D48' : '#CBD5E1' },
          { label: 'Atrasados',   value: atrasados, color: atrasados > 0 ? '#D97706' : '#CBD5E1' },
          { label: 'Ocorrências', value: ocCount,   color: ocCount > 0 ? '#D97706' : '#CBD5E1' },
        ].map((k, i) => (
          <div key={i} className="card" style={{ padding: '16px 12px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>{k.label}</p>
            <p style={{ fontSize: '26px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Lista de presença para validar */}
      {ajudantes.length > 0 && (
        <div className="card overflow-hidden">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              Presença da equipe — {fmtDate(TODAY)}
              {sla !== null && (
                <span style={{ marginLeft: '10px', fontSize: '12px', fontWeight: 700, color: sla >= 80 ? '#059669' : sla >= 60 ? '#D97706' : '#E11D48' }}>
                  SLA {sla}%
                </span>
              )}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {ajudantes.map(({ employeeId, status, entrada, saida }) => {
              const emp = employees.find(e => e.id === employeeId);
              const cfg = STATUS_CFG[status] || STATUS_CFG.aguardando;
              return (
                <div key={employeeId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid rgba(0,0,0,0.04)', borderRight: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {emp?.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp?.name || '—'}</p>
                    {entrada && <p style={{ fontSize: '10px', color: '#94A3B8' }}>{entrada}{saida ? ` → ${saida}` : ''}</p>}
                  </div>
                  <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '5px', background: cfg.bg, color: cfg.color, flexShrink: 0 }}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Ocorrências do dia */}
      {ocCount > 0 && (
        <div className="card overflow-hidden">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={14} style={{ color: '#D97706' }} />
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              Ocorrências do dia ({ocCount})
            </p>
          </div>
          {ocorrencias.map(oc => (
            <div key={oc.id} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>
                {oc.funcionarios?.nome || 'Líder'} — {oc.status === 'resolvido' ? '✓ Resolvido' : 'Aberto'}
              </p>
              <p style={{ fontSize: '13px', color: '#0F172A' }}>{oc.descricao}</p>
            </div>
          ))}
        </div>
      )}

      {/* Observações + finalizar */}
      <div className="card p-5 space-y-4">
        <div>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            Observações do dia
          </label>
          <textarea className="input-field" rows={5}
            placeholder="Como foi a operação? Destaques, problemas, comunicações com o cliente, situações fora do normal..."
            value={obs} onChange={e => setObs(e.target.value)} style={{ resize: 'none' }} />
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>
            Após finalizar, o relatório ficará disponível no portal do cliente automaticamente.
          </p>
        </div>

        <button onClick={handleFinalizar} disabled={saving || saved} style={{
          width: '100%', padding: '14px', borderRadius: '12px', border: 'none',
          fontSize: '14px', fontWeight: 700, cursor: saving || saved ? 'not-allowed' : 'pointer',
          background: saved ? '#059669' : saving ? '#E2E8F0' : '#FF4D0C',
          color: saving ? '#94A3B8' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          transition: 'background 0.3s',
        }}>
          {saved ? (
            <><CheckCircle2 size={16} /> Relatório finalizado — visível para o cliente</>
          ) : saving ? (
            'Salvando...'
          ) : (
            <><FileText size={16} /> Finalizar dia e enviar ao cliente</>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Principal ─────────────────────────────────────────────────────────────
export default function LiderDashboard() {
  const { user, employees } = useAuth();
  const { tab } = useOutletContext();
  const [escalas, setEscalas] = useState([]);

  const load = useCallback(() => {
    if (user?.id) fetchEscalasByLider(user.id).then(setEscalas);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const TITLES = {
    hoje:        { sub: 'Operação do dia', title: `Olá, ${user?.name?.split(' ')[0] || ''}` },
    escala:      { sub: 'Escala',          title: 'Gestão de Escalas' },
    historico:   { sub: 'Histórico',       title: 'Operações Anteriores' },
    ocorrencias: { sub: 'Ocorrências',     title: 'Incidentes e Reportes' },
    relatorio:   { sub: 'Encerramento',    title: 'Relatório Diário' },
  };
  const { sub, title } = TITLES[tab] || TITLES.hoje;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-up">
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{sub}</p>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{title}</h1>
        {user?.companyName && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
            <Building2 size={12} style={{ color: '#94A3B8' }} />
            <p style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>{user.companyName}</p>
          </div>
        )}
      </div>

      {tab === 'hoje'        && <TabHoje        user={user} escalas={escalas} employees={employees} onRefresh={load} />}
      {tab === 'escala'      && <TabEscala      user={user} escalas={escalas} employees={employees} onRefresh={load} />}
      {tab === 'historico'   && <TabHistorico   user={user} escalas={escalas} employees={employees} />}
      {tab === 'ocorrencias' && <TabOcorrencias user={user} escalas={escalas} employees={employees} />}
      {tab === 'relatorio'   && <TabRelatorio   user={user} escalas={escalas} employees={employees} />}
    </div>
  );
}
