import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchEscalasByLider, fetchAjudantesDisponiveis,
  upsertRelatorioDiario, fetchOcorrencias, createOcorrencia,
  createEscalaByLider, addRegistroToEscala, updateEscalaByLider,
  fetchEmpresasDoLider, fetchRelatoriosDiarios,
  uploadFotoRelatorio, fetchTodosAjudantes, createSolicitacaoAjudantes,
  fetchTarefasParaLider, concluirTarefaAdmin,
} from '../../lib/db';
import {
  Users, Calendar, CheckCircle2, AlertCircle, AlertTriangle,
  Plus, ChevronRight, X, Building2, FileText, RefreshCw,
  Search, Send, Clock, MessageSquare, ClipboardCheck,
  Image, Trash2,
} from 'lucide-react';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const DOW   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// Normaliza para HH:MM
const fmtTime = (t) => {
  if (!t) return null;
  const parts = String(t).split(':');
  return `${String(parts[0]).padStart(2,'0')}:${String(parts[1] ?? '00').padStart(2,'0')}`;
};

// Agrupa registros por serviço
function groupByService(records) {
  const sorted = [...records].sort((a, b) => (a.service || '').localeCompare(b.service || ''));
  return sorted.reduce((acc, rec) => {
    const k = rec.service || rec.servico || 'Geral';
    if (!acc[k]) acc[k] = [];
    acc[k].push(rec);
    return acc;
  }, {});
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${DOW[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${d}/${m}/${y}`;
}

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

// ── Carretas descarregadas — localStorage por escala ─────────────────────
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

function TrucksPanel({ escalaKey }) {
  const [trucks, setTrucks] = useTrucks(escalaKey);
  const add    = () => setTrucks(t => [...t, { id: Date.now().toString(), value: '' }]);
  const remove = (id) => setTrucks(t => t.filter(x => x.id !== id));
  const update = (id, value) => setTrucks(t => t.map(x => x.id === id ? { ...x, value } : x));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <p style={{ fontSize: '10px', fontWeight: 700, color: '#0F172A', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
          Descargas do Dia
        </p>
        <button onClick={add} style={{ fontSize: '11px', fontWeight: 700, color: '#FF4D0C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          + Nova
        </button>
      </div>
      {trucks.length === 0 ? (
        <button onClick={add} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px', borderRadius: '8px', border: '1.5px dashed #E2E8F0', background: 'transparent', cursor: 'pointer', color: '#94A3B8', fontSize: '11px', width: '100%' }}>
          + Adicionar descarga
        </button>
      ) : (
        trucks.map((truck, idx) => (
          <div key={truck.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '8px', background: '#EEF2F7' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', flexShrink: 0, minWidth: '14px', textAlign: 'right' }}>{idx + 1}</span>
            <input
              value={truck.value}
              onChange={e => update(truck.id, e.target.value)}
              placeholder="Placa ou motorista..."
              style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '12px', fontWeight: 600, color: '#0F172A', outline: 'none', padding: 0, fontFamily: 'inherit', minWidth: 0 }}
            />
            <button onClick={() => remove(truck.id)}
              style={{ color: '#CBD5E1', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = '#E11D48'}
              onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}>
              <X size={12} />
            </button>
          </div>
        ))
      )}
    </div>
  );
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

// ── Badge de tipo de serviço ──────────────────────────────────────────────
const TIPO_CFG = {
  entrega:        { label: 'Entrega',          color: '#2563EB', bg: '#EFF6FF' },
  carga_descarga: { label: 'Carga e Descarga', color: '#64748B', bg: '#F1F5F9' },
};
function TipoBadge({ tipo }) {
  const cfg = TIPO_CFG[tipo] || TIPO_CFG.entrega;
  return (
    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 9px', borderRadius: '6px', background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      {tipo === 'carga_descarga' ? '📦' : '🚚'} {cfg.label}
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

// ── Modal Finalizar Dia ───────────────────────────────────────────────────
function ModalFinalizarDia({ user, presentes, ausentes, ocCount, onClose, onSaved }) {
  const [obs, setObs]           = useState('');
  const [fotos, setFotos]       = useState([]);   // [{ file, preview }]
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files);
    const novos = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setFotos(prev => [...prev, ...novos]);
  };

  const removerFoto = (idx) => {
    setFotos(prev => { URL.revokeObjectURL(prev[idx].preview); return prev.filter((_, i) => i !== idx); });
  };

  const handleSubmit = async () => {
    setSaving(true);
    const urls = [];
    for (const { file } of fotos) {
      const url = await uploadFotoRelatorio(file, user.id);
      if (url) urls.push(url);
    }
    await upsertRelatorioDiario({
      liderId:          user.id,
      empresaId:        user.empresa_id,
      data:             TODAY,
      presentes,
      ausentes,
      ocorrenciasCount: ocCount,
      observacoes:      obs,
      fotosUrls:        urls,
      finalizado:       true,
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => { onSaved(); onClose(); }, 1500);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <p style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Finalizar dia</p>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>{fmtDate(TODAY)}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
        </div>

        {/* Resumo automático */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '20px' }}>
          {[
            { label: 'Presentes',   value: presentes, color: presentes > 0 ? '#059669' : '#CBD5E1' },
            { label: 'Ausentes',    value: ausentes,  color: ausentes > 0 ? '#E11D48' : '#CBD5E1'  },
            { label: 'Ocorrências', value: ocCount,   color: ocCount > 0 ? '#D97706' : '#CBD5E1'   },
          ].map((k, i) => (
            <div key={i} style={{ padding: '12px', borderRadius: '10px', background: '#F8FAFC', textAlign: 'center', border: '1px solid rgba(0,0,0,0.07)' }}>
              <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px' }}>{k.label}</p>
              <p style={{ fontSize: '22px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Observações */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            Observações do dia
          </label>
          <textarea
            className="input-field"
            rows={5}
            placeholder="Como foi a operação? Destaques, problemas, comunicações com o cliente, situações fora do normal..."
            value={obs}
            onChange={e => setObs(e.target.value)}
            style={{ resize: 'none' }}
          />
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '5px' }}>
            Após finalizar, o relatório fica visível no portal do cliente.
          </p>
        </div>

        {/* Upload de fotos */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#0F172A', marginBottom: '8px' }}>
            Fotos (opcional)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '10px', border: '2px dashed #E2E8F0', cursor: 'pointer', color: '#64748B', fontSize: '13px', fontWeight: 600 }}>
            <Image size={15} style={{ color: '#94A3B8' }} />
            Selecionar fotos
            <input type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
          </label>

          {fotos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '10px' }}>
              {fotos.map(({ preview }, idx) => (
                <div key={idx} style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', aspectRatio: '1', background: '#F1F5F9' }}>
                  <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button onClick={() => removerFoto(idx)}
                    style={{ position: 'absolute', top: '4px', right: '4px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={10} style={{ color: 'white' }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botões */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={saving || saved}
            style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', cursor: saving || saved ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, background: saved ? '#059669' : saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 0.3s' }}>
            {saved ? <><CheckCircle2 size={15} /> Relatório enviado!</> : saving ? 'Enviando...' : <><FileText size={15} /> Finalizar e enviar ao cliente</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Hoje — monitoramento (read-only) ─────────────────────────────────
function TabHoje({ user, escalas, employees, onRefresh, onStatsChange }) {
  const [notes, setNotes] = useNotes();
  const todayEscala     = escalas.find(e => e.date === TODAY);
  const ajudantes       = todayEscala?.employees || [];
  const isCargaDescarga = todayEscala?.tipoServico === 'carga_descarga';

  const [modalSubst, setModalSubst]   = useState(false);
  const [ocorrencias, setOcorrencias] = useState([]);

  const confirmados = ajudantes.filter(a => ['confirmado','finalizado'].includes(a.status)).length;
  const ausentes    = ajudantes.filter(a => a.status === 'falta').length;
  const total       = ajudantes.length;
  const sla         = total > 0 ? Math.round((confirmados / total) * 100) : null;

  // Horário da equipe (carga_descarga)
  const presRecs  = ajudantes.filter(a => a.status !== 'falta');
  const teamStart = presRecs.filter(a => a.entrada).map(a => a.entrada).sort()[0] ?? null;
  const teamEnd   = presRecs.filter(a => a.saida).map(a => a.saida).sort().reverse()[0] ?? null;
  const operStatus = !teamStart ? 'agendado' : !teamEnd ? 'em_andamento' : 'finalizado';
  const OPER_CFG = { agendado: { label: 'Agendado', color: '#64748B', bg: '#F1F5F9', dot: '#94A3B8' }, em_andamento: { label: 'Em andamento', color: '#D97706', bg: '#FEF3C7', dot: '#F59E0B' }, finalizado: { label: 'Finalizado', color: '#059669', bg: '#DCFCE7', dot: '#10B981' } };
  const operCfg = OPER_CFG[operStatus];

  useEffect(() => {
    if (todayEscala?.id) {
      fetchOcorrencias({ escalaId: todayEscala.id, data: TODAY }).then(ocs => {
        setOcorrencias(ocs);
        onStatsChange?.({ presentes: confirmados, ausentes, ocCount: ocs.length });
      });
    } else {
      onStatsChange?.({ presentes: confirmados, ausentes, ocCount: 0 });
    }
  }, [todayEscala?.id, confirmados, ausentes]);

  return (
    <div className="space-y-5">

      {/* Banner falta → acionar substituto */}
      {ausentes > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '14px', background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={18} style={{ color: '#E11D48', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#E11D48' }}>
              {ausentes} falta{ausentes !== 1 ? 's' : ''} detectada{ausentes !== 1 ? 's' : ''}
            </p>
            <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>Acione um substituto</p>
          </div>
          <button onClick={() => setModalSubst(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '7px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: '#0F172A', color: 'white', border: 'none', cursor: 'pointer' }}>
            <RefreshCw size={11} /> Substituto
          </button>
        </div>
      )}

      {/* KPIs — layout diferente por tipo */}
      {isCargaDescarga ? (
        /* Carga/Descarga: Escalados | Início | Final | Status */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.2fr', gap: '10px' }}>
          <div className="card" style={{ padding: '14px 12px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Escalados</p>
            <p style={{ fontSize: '26px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{total}</p>
          </div>
          <div className="card" style={{ padding: '14px 12px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Início</p>
            <p style={{ fontSize: '22px', fontWeight: 800, color: teamStart ? '#0F172A' : '#CBD5E1', lineHeight: 1 }}>{fmtTime(teamStart) ?? '—'}</p>
          </div>
          <div className="card" style={{ padding: '14px 12px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.08)' }}>
            <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Final</p>
            <p style={{ fontSize: '22px', fontWeight: 800, color: teamEnd ? '#059669' : '#CBD5E1', lineHeight: 1 }}>{fmtTime(teamEnd) ?? '—'}</p>
          </div>
          <div style={{ padding: '14px 12px', textAlign: 'center', borderRadius: '12px', background: 'linear-gradient(160deg, #0F172A 0%, #1E293B 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: operCfg.dot }} />
            <span style={{ fontSize: '11px', fontWeight: 700, color: operCfg.color }}>{operCfg.label}</span>
          </div>
        </div>
      ) : (
        /* Entrega: Escalados, Presentes, Ausentes, Presença */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {[
            { label: 'Escalados', value: total,       color: '#0F172A' },
            { label: 'Presentes', value: confirmados, color: '#059669' },
            { label: 'Ausentes',  value: ausentes,    color: ausentes > 0 ? '#E11D48' : '#CBD5E1' },
            { label: 'Presença',  value: sla !== null ? `${sla}%` : '—', color: sla === null ? '#CBD5E1' : sla >= 80 ? '#059669' : sla >= 60 ? '#D97706' : '#E11D48' },
          ].map((k, i) => (
            <div key={i} className="card" style={{ padding: '16px 12px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.08)' }}>
              <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{k.label}</p>
              <p style={{ fontSize: '26px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Equipe — idêntico à tela da empresa ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
              {isCargaDescarga ? 'Equipe em Serviço Agora' : 'Ajudantes em Serviço Agora'}
            </h3>
            {todayEscala && <TipoBadge tipo={todayEscala.tipoServico || 'entrega'} />}
          </div>
          {todayEscala && (
            <button onClick={() => setModalSubst(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer' }}>
              <RefreshCw size={11} /> Substituto
            </button>
          )}
        </div>

        <div className="card p-4" style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {ajudantes.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <Users size={28} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
              <p style={{ fontSize: '13px', color: '#94A3B8' }}>Nenhuma escala para hoje</p>
            </div>

          ) : isCargaDescarga ? (
            /* ── CARGA E DESCARGA: split equipe (esq) + descargas do dia (dir) ── */
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
              {/* Esquerda: equipe com obs */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <button onClick={() => setModalSubst(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '8px', background: '#0F172A', color: 'white', border: 'none', cursor: 'pointer', alignSelf: 'flex-start', marginBottom: '2px' }}>
                  <Users size={11} /> Equipe
                </button>
                {ajudantes.map(({ employeeId, status }) => {
                  const emp = employees.find(e => e.id === employeeId);
                  const isAbsent = status === 'falta';
                  return (
                    <div key={employeeId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: isAbsent ? 'rgba(244,63,94,0.05)' : '#EEF2F7' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: isAbsent ? '#D1D9E0' : (emp?.color || '#94A3B8'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: isAbsent ? '#64748B' : 'white', flexShrink: 0 }}>
                        {emp?.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: isAbsent ? '#94A3B8' : '#0F172A', lineHeight: 1.2 }}>{emp?.name || '—'}</p>
                        <input
                          value={notes[employeeId] || ''}
                          onChange={e => setNotes(p => ({ ...p, [employeeId]: e.target.value }))}
                          placeholder="Observação..."
                          style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '10px', color: '#64748B', outline: 'none', padding: 0, fontFamily: 'inherit', marginTop: '1px' }}
                        />
                      </div>
                      {isAbsent && <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#FFE4E6', color: '#E11D48', flexShrink: 0 }}>Falta</span>}
                    </div>
                  );
                })}
              </div>

              {/* Separador */}
              <div style={{ width: '1px', background: 'rgba(0,0,0,0.06)', alignSelf: 'stretch', flexShrink: 0 }} />

              {/* Direita: descargas do dia */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <TrucksPanel escalaKey={todayEscala?.id || TODAY} />
              </div>
            </div>

          ) : (
            /* ── ENTREGA: agrupado por serviço + obs + horários à direita ── */
            <>
              {Object.entries(groupByService(
                ajudantes.map(a => ({ ...a, service: todayEscala?.service || 'Serviço' }))
              )).map(([service, recs], gIdx) => (
                <div key={service}>
                  <p style={{ fontSize: '10px', fontWeight: 700, color: '#0F172A', letterSpacing: '0.06em', textTransform: 'uppercase', margin: gIdx > 0 ? '8px 0 4px' : '0 0 4px' }}>
                    {service}
                  </p>
                  {recs.map(({ employeeId, status, entrada, saida, saidaAlmoco, retornoAlmoco }) => {
                    const emp = employees.find(e => e.id === employeeId);
                    const isAbsent = status === 'falta';
                    const TIMES = [
                      { label: 'Entrada',   val: entrada       },
                      { label: 'S. Almoço', val: saidaAlmoco  },
                      { label: 'Retorno',   val: retornoAlmoco },
                      { label: 'Saída',     val: saida         },
                    ];
                    return (
                      <div key={employeeId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: isAbsent ? 'rgba(244,63,94,0.05)' : '#EEF2F7', marginBottom: '3px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: isAbsent ? '#D1D9E0' : (emp?.color || '#94A3B8'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: isAbsent ? '#64748B' : 'white', flexShrink: 0 }}>
                          {emp?.initials}
                        </div>
                        <div style={{ minWidth: '110px', flexShrink: 0 }}>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: isAbsent ? '#94A3B8' : '#0F172A', lineHeight: 1.2 }}>{emp?.name || '—'}</p>
                          <input
                            value={notes[employeeId] || ''}
                            onChange={e => setNotes(p => ({ ...p, [employeeId]: e.target.value }))}
                            placeholder="Observação..."
                            style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '10px', color: '#64748B', outline: 'none', padding: 0, fontFamily: 'inherit', marginTop: '1px' }}
                          />
                        </div>
                        <div style={{ flex: 1 }} />
                        {isAbsent ? (
                          <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: '#FFE4E6', color: '#E11D48' }}>Falta</span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                            {TIMES.map(t => (
                              <div key={t.label} style={{ textAlign: 'center', minWidth: '40px' }}>
                                <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 600, marginBottom: '2px' }}>{t.label}</p>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: t.val ? '#0F172A' : '#CBD5E1' }}>
                                  <Clock size={9} />
                                  <span style={{ fontSize: '11px', fontWeight: 700 }}>{fmtTime(t.val) ?? '—'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
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
        const dow         = DOW[new Date(`${escala.date}T12:00:00Z`).getUTCDay()];

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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{escala.companyName || '—'}</p>
                  <TipoBadge tipo={escala.tipoServico || 'entrega'} />
                </div>
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                  {escala.time || '—'} · {total} ajudante{total !== 1 ? 's' : ''}
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

// ── helpers de quinzena para histórico ───────────────────────────────────
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getQuinzenaOffset(offset) {
  const now  = new Date();
  const day  = now.getDate();
  let num    = day <= 15 ? 1 : 2;
  let month  = now.getMonth();
  let year   = now.getFullYear();
  const steps = Math.abs(offset);
  for (let i = 0; i < steps; i++) {
    if (offset < 0) {
      if (num === 1) { num = 2; month -= 1; if (month < 0) { month = 11; year -= 1; } }
      else           { num = 1; }
    } else {
      if (num === 2) { num = 1; month += 1; if (month > 11) { month = 0; year += 1; } }
      else           { num = 2; }
    }
  }
  const mm      = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  const start   = `${year}-${mm}-01`;
  const mid     = `${year}-${mm}-15`;
  const end     = `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
  return {
    num, month, year,
    label:     `${MONTHS_FULL[month]}/${year} — Quinzena ${num}`,
    rangeLabel: num === 1 ? `01/${mm} a 15/${mm}` : `16/${mm} a ${String(lastDay).padStart(2,'0')}/${mm}`,
    startDate: num === 1 ? start : `${year}-${mm}-16`,
    endDate:   num === 1 ? mid : end,
  };
}

// ── Tab: Escala (com sub-abas Hoje / Agendadas / Histórico) ───────────────
function NovaEscalaForm({ user, onSaved, onCancel }) {
  const [form, setForm]             = useState({ date: TODAY, time: '07:00', service: '', companyId: '', tipoServico: 'entrega' });
  const [responsavelDia, setResp]   = useState('');
  const [contatoDia, setContato]    = useState('');
  const [empresas, setEmpresas]     = useState([]);
  const [disponiveis, setDisp]      = useState([]);
  const [selected, setSelected]     = useState([]);
  const [search, setSearch]         = useState('');
  const [loadingDisp, setLD]        = useState(false);
  const [saving, setSaving]         = useState(false);
  const [etapa, setEtapa]           = useState('selecionar');

  useEffect(() => {
    fetchEmpresasDoLider(user.id).then(list => {
      setEmpresas(list);
      if (list.length === 1) {
        setForm(f => ({ ...f, companyId: list[0].id }));
        setResp(list[0].responsavel || '');
        setContato(list[0].telefone || '');
      }
    });
  }, [user.id]);

  useEffect(() => {
    setLD(true);
    fetchAjudantesDisponiveis(form.date).then(list => { setDisp(list); setLD(false); });
  }, [form.date]);

  const toggle = (emp) => {
    setSelected(s =>
      s.find(x => x.id === emp.id)
        ? s.filter(x => x.id !== emp.id)
        : [...s, { id: emp.id, name: emp.name, initials: emp.initials, color: emp.color, observacoes: '' }]
    );
  };

  const setObs = (id, obs) =>
    setSelected(s => s.map(x => x.id === id ? { ...x, observacoes: obs } : x));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.companyId) return alert('Selecione a empresa para esta escala.');
    if (selected.length === 0) return alert('Selecione ao menos um ajudante.');
    setSaving(true);
    await createEscalaByLider({
      liderId: user.id, companyId: form.companyId, date: form.date,
      time: form.time, service: form.service, employees: selected,
      responsavelDia, contatoDia, tipoServico: form.tipoServico,
    });
    setSaving(false);
    onSaved();
  };

  const empresaSel  = empresas.find(e => e.id === form.companyId);
  const filtrados   = disponiveis.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-4 animate-fade-up">
      <div className="flex items-center justify-between">
        <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Nova Escala</p>
        <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
      </div>

      {/* Empresa */}
      <div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Para qual empresa? *</label>
        {empresas.length === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhuma empresa vinculada. Fale com o administrador.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {empresas.map(emp => {
              const sel = form.companyId === emp.id;
              return (
                <button key={emp.id} type="button" onClick={() => {
                  setForm(f => ({ ...f, companyId: emp.id }));
                  setResp(emp.responsavel || '');
                  setContato(emp.telefone || '');
                }}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '10px', border: `2px solid ${sel ? '#FF4D0C' : 'rgba(0,0,0,0.1)'}`, background: sel ? '#FFF5F2' : 'white', cursor: 'pointer' }}>
                  <Building2 size={13} style={{ color: sel ? '#FF4D0C' : '#94A3B8' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: sel ? '#FF4D0C' : '#0F172A' }}>{emp.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Responsável do dia + Contato */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
            Responsável do dia (cliente)
          </label>
          <input className="input-field" placeholder="Nome do responsável..."
            value={responsavelDia} onChange={e => setResp(e.target.value)} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
            Contato
          </label>
          <input className="input-field" placeholder="Telefone ou e-mail..."
            value={contatoDia} onChange={e => setContato(e.target.value)} />
        </div>
      </div>

      {/* Tipo de operação */}
      <div>
        <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Tipo de Operação *</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { val: 'entrega',        label: 'Entrega',          icon: '🚚', desc: 'Horário completo por ajudante' },
            { val: 'carga_descarga', label: 'Carga e Descarga', icon: '📦', desc: 'Horário da equipe (início/final)' },
          ].map(opt => {
            const sel = form.tipoServico === opt.val;
            return (
              <button key={opt.val} type="button" onClick={() => setForm(f => ({ ...f, tipoServico: opt.val }))}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '3px', padding: '10px 14px', borderRadius: '12px', border: `1.5px solid ${sel ? '#FF4D0C' : 'rgba(0,0,0,0.1)'}`, background: sel ? '#FFF5F2' : '#F8FAFC', cursor: 'pointer', textAlign: 'left', transition: 'all 0.12s' }}>
                <span style={{ fontSize: '16px' }}>{opt.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: sel ? '#FF4D0C' : '#0F172A' }}>{opt.label}</span>
                <span style={{ fontSize: '10px', color: sel ? '#FF7043' : '#94A3B8' }}>{opt.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Data / Horário / Serviço */}
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

      {/* ── Etapa 1: Selecionar ajudantes ── */}
      {etapa === 'selecionar' && (
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

          {/* Busca por nome */}
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="input-field" style={{ paddingLeft: '30px' }} placeholder="Buscar ajudante pelo nome..."
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {loadingDisp ? (
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>Carregando...</p>
          ) : filtrados.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhum ajudante encontrado</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
              {filtrados.map(emp => {
                const sel = !!selected.find(x => x.id === emp.id);
                return (
                  <button key={emp.id} type="button" onClick={() => toggle(emp)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', border: `2px solid ${sel ? '#FF4D0C' : 'rgba(0,0,0,0.08)'}`, background: sel ? '#FFF5F2' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {emp.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: sel ? '#FF4D0C' : '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {emp.name}{emp.cidade ? <span style={{ fontWeight: 400, color: sel ? '#FF7A45' : '#94A3B8' }}> ({emp.cidade})</span> : ''}
                      </p>
                    </div>
                    {sel && <CheckCircle2 size={13} style={{ color: '#FF4D0C', flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Etapa 2: Observações por ajudante ── */}
      {etapa === 'observacoes' && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748B', marginBottom: '12px' }}>
            Observações para cada ajudante <span style={{ fontWeight: 400, color: '#94A3B8' }}>(opcional)</span>
          </p>
          <div className="space-y-3">
            {selected.map(emp => (
              <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {emp.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginBottom: '6px' }}>{emp.name}</p>
                  <input className="input-field" style={{ padding: '6px 10px', fontSize: '12px' }}
                    placeholder="Ex: motorista, responsável pelo caminhão..."
                    value={emp.observacoes}
                    onChange={e => setObs(emp.id, e.target.value)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Botões */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button type="button" onClick={etapa === 'selecionar' ? onCancel : () => setEtapa('selecionar')}
          style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
          {etapa === 'selecionar' ? 'Cancelar' : '← Voltar'}
        </button>
        {etapa === 'selecionar' ? (
          <button type="button" disabled={selected.length === 0}
            onClick={() => setEtapa('observacoes')}
            style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', cursor: selected.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, background: selected.length === 0 ? '#E2E8F0' : '#FF4D0C', color: selected.length === 0 ? '#94A3B8' : 'white' }}>
            Próximo — {selected.length} ajudante{selected.length !== 1 ? 's' : ''} selecionado{selected.length !== 1 ? 's' : ''}
          </button>
        ) : (
          <button type="submit" disabled={saving}
            style={{ flex: 2, padding: '11px', borderRadius: '10px', background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700 }}>
            {saving ? 'Criando...' : 'Criar escala e enviar confirmação'}
          </button>
        )}
      </div>
    </form>
  );
}

function EscalaDetalhe({ escala, employees, flat = false }) {
  const isCargaDescarga = escala.tipoServico === 'carga_descarga';
  const batidas = [
    { label: 'Entrada',    key: 'entrada'       },
    { label: 'Saída alm.', key: 'saidaAlmoco'  },
    { label: 'Retorno',    key: 'retornoAlmoco' },
    { label: 'Saída',      key: 'saida'         },
  ];

  // Horário da equipe para carga_descarga
  const presentes   = (escala.employees || []).filter(e => e.status !== 'falta');
  const teamStart   = presentes.filter(e => e.entrada).map(e => e.entrada).sort()[0] ?? null;
  const teamEnd     = presentes.filter(e => e.saida).map(e => e.saida).sort().reverse()[0] ?? null;

  return (
    <div className={flat ? '' : 'card overflow-hidden'}>
      {!flat && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              {escala.companyName || '—'} — {fmtDate(escala.date)}
            </p>
            <TipoBadge tipo={escala.tipoServico || 'entrega'} />
          </div>
          {escala.time && (
            <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Clock size={10} /> {escala.time}{escala.service ? ` · ${escala.service}` : ''}
            </p>
          )}
          {/* Horário da equipe para carga/descarga */}
          {isCargaDescarga && (teamStart || teamEnd) && (
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                Início: <span style={{ color: '#2563EB' }}>{fmtTime(teamStart) || '—'}</span>
              </span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
                Final: <span style={{ color: '#059669' }}>{fmtTime(teamEnd) || '—'}</span>
              </span>
            </div>
          )}
        </div>
      )}
      {(escala.employees || []).map(({ employeeId, status, entrada, saida, saidaAlmoco, retornoAlmoco }) => {
        const emp  = employees.find(e => e.id === employeeId);
        const vals = { entrada, saidaAlmoco, retornoAlmoco, saida };
        return (
          <div key={employeeId} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: isCargaDescarga ? '12px 16px' : '10px 16px 6px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {emp?.initials}
              </div>
              <p style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{emp?.name || '—'}</p>
              <StatusBadge status={status} />
            </div>
            {/* Batidas individuais só para entrega */}
            {!isCargaDescarga && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0', padding: '0 16px 10px 62px' }}>
                {batidas.map(({ label, key }) => (
                  <div key={key} style={{ textAlign: 'center', padding: '5px 3px', background: vals[key] ? '#F0FDF4' : '#F8FAFC', borderRadius: '7px', margin: '0 2px' }}>
                    <p style={{ fontSize: '9px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '2px' }}>{label}</p>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: vals[key] ? '#059669' : '#CBD5E1' }}>{fmtTime(vals[key]) || '—'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Modal Editar Escala ───────────────────────────────────────────────────
function ModalEditarEscala({ escala, employees, onClose, onSaved }) {
  const [time, setTime]               = useState(escala.time || '07:00');
  const [service, setService]         = useState(escala.service || '');
  const [responsavelDia, setResp]     = useState(escala.responsavelDia || '');
  const [contatoDia, setContato]      = useState(escala.contatoDia || '');
  const [disponiveis, setDisp]        = useState([]);
  const [novosSel, setNovosSel]       = useState([]); // [{ id, name, initials, color, observacoes }]
  const [search, setSearch]           = useState('');
  const [saving, setSaving]           = useState(false);

  const existingIds = (escala.employees || []).map(e => e.employeeId);

  useEffect(() => {
    fetchAjudantesDisponiveis(escala.date).then(list =>
      setDisp(list.filter(e => !existingIds.includes(e.id)))
    );
  }, []);

  const toggleNovo = (emp) =>
    setNovosSel(s =>
      s.find(x => x.id === emp.id)
        ? s.filter(x => x.id !== emp.id)
        : [...s, { id: emp.id, name: emp.name, initials: emp.initials, color: emp.color, observacoes: '' }]
    );

  const setObs = (id, obs) =>
    setNovosSel(s => s.map(x => x.id === id ? { ...x, observacoes: obs } : x));

  const handleSave = async () => {
    setSaving(true);
    await updateEscalaByLider({
      escalaId: escala.id,
      companyId: escala.companyId,
      date: escala.date,
      time, service, responsavelDia, contatoDia,
      newEmployees: novosSel,
    });
    setSaving(false);
    onSaved();
    onClose();
  };

  const filtrados = disponiveis.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}
      style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '40px' }}>
      <div style={{ width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', margin: '0 16px' }}>
        <div className="card p-5 space-y-4 animate-fade-up">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Editar Escala</p>
              <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                {escala.companyName} — {fmtDate(escala.date)}
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
              <X size={16} />
            </button>
          </div>

          {/* Responsável + Contato */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Responsável do dia</label>
              <input className="input-field" placeholder="Nome do responsável..."
                value={responsavelDia} onChange={e => setResp(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Contato</label>
              <input className="input-field" placeholder="Telefone ou e-mail..."
                value={contatoDia} onChange={e => setContato(e.target.value)} />
            </div>
          </div>

          {/* Horário + Serviço */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Início</label>
              <input type="time" className="input-field" value={time} onChange={e => setTime(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Serviço</label>
              <input className="input-field" placeholder="Ex: Separação, Entrega, Carga..."
                value={service} onChange={e => setService(e.target.value)} />
            </div>
          </div>

          {/* Ajudantes atuais (read-only) */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>
              Equipe atual ({existingIds.length} ajudante{existingIds.length !== 1 ? 's' : ''})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(escala.employees || []).map(({ employeeId }) => {
                const emp = employees.find(e => e.id === employeeId);
                return (
                  <div key={employeeId} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.07)' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: 'white' }}>
                      {emp?.initials}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{emp?.name || '—'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Adicionar mais ajudantes */}
          {disponiveis.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>
                Adicionar ajudantes disponíveis
                {novosSel.length > 0 && <span style={{ color: '#FF4D0C', marginLeft: '6px' }}>+{novosSel.length}</span>}
              </p>
              <div style={{ position: 'relative', marginBottom: '8px' }}>
                <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input className="input-field" style={{ paddingLeft: '30px' }} placeholder="Buscar pelo nome..."
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px,1fr))', gap: '6px', maxHeight: '180px', overflowY: 'auto' }}>
                {filtrados.map(emp => {
                  const sel = !!novosSel.find(x => x.id === emp.id);
                  return (
                    <button key={emp.id} type="button" onClick={() => toggleNovo(emp)}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '7px 10px', borderRadius: '9px', border: `2px solid ${sel ? '#FF4D0C' : 'rgba(0,0,0,0.08)'}`, background: sel ? '#FFF5F2' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {emp.initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: sel ? '#FF4D0C' : '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {emp.name}{emp.cidade ? <span style={{ fontWeight: 400, color: sel ? '#FF7A45' : '#94A3B8' }}> ({emp.cidade})</span> : ''}
                        </p>
                      </div>
                      {sel && <CheckCircle2 size={12} style={{ color: '#FF4D0C', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>

              {/* Observações dos novos */}
              {novosSel.length > 0 && (
                <div style={{ marginTop: '10px' }} className="space-y-2">
                  {novosSel.map(emp => (
                    <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {emp.initials}
                      </div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', minWidth: '90px' }}>{emp.name}</p>
                      <input className="input-field" style={{ flex: 1, padding: '5px 8px', fontSize: '12px' }}
                        placeholder="Observação (opcional)"
                        value={emp.observacoes}
                        onChange={e => setObs(emp.id, e.target.value)} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Botões */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              {saving ? 'Salvando...' : <><CheckCircle2 size={14} /> Salvar alterações</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TabEscala({ user, escalas, employees, onRefresh }) {
  const [sub, setSub]               = useState('hoje');
  const [showForm, setShowForm]     = useState(false);
  const [openId, setOpenId]         = useState(null);
  const [detalheEscala, setDetalhe] = useState(null);
  const [editandoEscala, setEditar] = useState(null);
  const [qOffset, setQOffset]       = useState(-1);

  const today    = escalas.find(e => e.date === TODAY);
  const upcoming = escalas.filter(e => e.date > TODAY).sort((a, b) => a.date.localeCompare(b.date));
  const past     = escalas.filter(e => e.date < TODAY).sort((a, b) => b.date.localeCompare(a.date));

  // Escalas da quinzena selecionada no histórico
  const qInfo      = getQuinzenaOffset(qOffset);
  const qEscalas   = past.filter(e => e.date >= qInfo.startDate && e.date <= qInfo.endDate);

  const SUB_TABS = [
    { id: 'hoje',      label: 'Hoje'      },
    { id: 'agendadas', label: 'Agendadas' },
    { id: 'historico', label: 'Histórico' },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-abas + botão nova escala */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: '#F1F5F9' }}>
          {SUB_TABS.map(t => (
            <button key={t.id} onClick={() => { setSub(t.id); setShowForm(false); }}
              style={{ padding: '6px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: sub === t.id ? 'white' : 'transparent', color: sub === t.id ? '#0F172A' : '#94A3B8', boxShadow: sub === t.id ? '0 1px 4px rgba(0,0,0,0.10)' : 'none', transition: 'all 0.15s' }}>
              {t.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <Plus size={14} /> Nova escala
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}
          style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '40px' }}>
          <div style={{ width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', margin: '0 16px' }}>
            <NovaEscalaForm user={user} onSaved={() => { setShowForm(false); onRefresh(); }} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}

      {/* ── Sub-aba: Hoje ── */}
      {sub === 'hoje' && (
        today
          ? <EscalaDetalhe escala={today} employees={employees} />
          : <div className="card" style={{ padding: '48px 16px', textAlign: 'center' }}>
              <Calendar size={28} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
              <p style={{ color: '#94A3B8', fontSize: '13px' }}>Sem escala para hoje</p>
            </div>
      )}

      {/* ── Sub-aba: Agendadas ── */}
      {sub === 'agendadas' && !detalheEscala && (
        upcoming.length === 0
          ? <div className="card" style={{ padding: '48px 16px', textAlign: 'center' }}>
              <Calendar size={28} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
              <p style={{ color: '#94A3B8', fontSize: '13px' }}>Nenhuma escala agendada</p>
            </div>
          : <div className="space-y-3">
              {upcoming.map(escala => {
                const total     = escala.employees?.length || 0;
                const confirmados = escala.employees?.filter(e => ['confirmado','aguardando'].includes(e.status) === false).length || 0;
                const [, m, d]  = escala.date.split('-');
                return (
                  <button key={escala.id} onClick={() => setDetalhe(escala)}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', borderRadius: '14px', background: 'white', border: '1px solid rgba(0,0,0,0.08)', cursor: 'pointer', textAlign: 'left', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                    <div style={{ textAlign: 'center', width: '42px', flexShrink: 0 }}>
                      <p style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{d}</p>
                      <p style={{ fontSize: '9px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>{MONTHS_SHORT[Number(m)-1]}</p>
                    </div>
                    <div style={{ width: '1px', height: '32px', background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{escala.companyName || '—'}</p>
                      <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>
                        {escala.time || '—'} · {total} ajudante{total !== 1 ? 's' : ''}{escala.service ? ` · ${escala.service}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={16} style={{ color: '#CBD5E1', flexShrink: 0 }} />
                  </button>
                );
              })}
            </div>
      )}

      {/* ── Detalhe de escala agendada ── */}
      {sub === 'agendadas' && detalheEscala && (
        <div className="space-y-4 animate-fade-up">
          {/* Header do detalhe */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setDetalhe(null)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#64748B', padding: 0 }}>
              <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} /> Voltar às agendadas
            </button>
            <button onClick={() => setEditar(detalheEscala)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '9px', background: '#F1F5F9', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
              <RefreshCw size={13} /> Editar escala
            </button>
          </div>

          {/* Info da escala */}
          <div className="card p-5 space-y-3">
            <div>
              <p style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{detalheEscala.companyName || '—'}</p>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '4px' }}>
                {fmtDate(detalheEscala.date)}{detalheEscala.time ? ` · Início ${detalheEscala.time}` : ''}{detalheEscala.service ? ` · ${detalheEscala.service}` : ''}
              </p>
            </div>
            {(detalheEscala.responsavelDia || detalheEscala.contatoDia) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
                <div>
                  <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Responsável do dia</p>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{detalheEscala.responsavelDia || '—'}</p>
                </div>
                {detalheEscala.contatoDia && (
                  <>
                    <div style={{ width: '1px', height: '28px', background: 'rgba(0,0,0,0.08)' }} />
                    <div>
                      <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>Contato</p>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{detalheEscala.contatoDia}</p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Lista de ajudantes com status + observações */}
          <div className="card overflow-hidden">
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Equipe — {detalheEscala.employees?.length || 0} ajudante{(detalheEscala.employees?.length || 0) !== 1 ? 's' : ''}
              </p>
            </div>
            {(detalheEscala.employees || []).map(({ employeeId, status, observacoes }) => {
              const emp = employees.find(e => e.id === employeeId);
              const CONF_CFG = {
                confirmado: { label: 'Confirmado', color: '#059669', bg: '#DCFCE7' },
                aguardando:  { label: 'Aguardando', color: '#D97706', bg: '#FEF3C7' },
                recusado:    { label: 'Recusado',   color: '#E11D48', bg: '#FFE4E6' },
              };
              const cfg = CONF_CFG[status] || CONF_CFG.aguardando;
              return (
                <div key={employeeId} style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: observacoes ? '8px' : 0 }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {emp?.initials}
                    </div>
                    <p style={{ flex: 1, fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{emp?.name || '—'}</p>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '8px', background: cfg.bg, color: cfg.color, flexShrink: 0 }}>
                      {cfg.label}
                    </span>
                  </div>
                  {observacoes && (
                    <p style={{ fontSize: '12px', color: '#64748B', marginLeft: '50px', fontStyle: 'italic' }}>
                      "{observacoes}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Sub-aba: Histórico por quinzena ── */}
      {sub === 'historico' && (
        <div className="space-y-4">
          {/* Navegação de quinzena */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
            <button onClick={() => setQOffset(o => o - 1)}
              style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#F1F5F9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', flexShrink: 0 }}>
              <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{qInfo.label}</p>
              <p style={{ fontSize: '11px', color: '#94A3B8' }}>{qInfo.rangeLabel}</p>
            </div>
            <button onClick={() => setQOffset(o => Math.min(o + 1, -1))} disabled={qOffset >= -1}
              style={{ width: '30px', height: '30px', borderRadius: '8px', background: qOffset < -1 ? '#F1F5F9' : 'transparent', border: 'none', cursor: qOffset < -1 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', color: qOffset < -1 ? '#64748B' : '#CBD5E1', flexShrink: 0 }}>
              <ChevronRight size={14} />
            </button>
          </div>

          {/* Lista de escalas da quinzena — colapsável */}
          {qEscalas.length === 0 ? (
            <div className="card" style={{ padding: '40px 16px', textAlign: 'center' }}>
              <Clock size={24} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
              <p style={{ color: '#94A3B8', fontSize: '13px' }}>Nenhuma escala nesta quinzena</p>
            </div>
          ) : (
            <div className="space-y-3">
              {qEscalas.map(escala => {
                const isOpen    = openId === escala.id;
                const total     = escala.employees?.length || 0;
                const presentes = escala.employees?.filter(e => ['confirmado','finalizado'].includes(e.status)).length || 0;
                const pct       = total > 0 ? Math.round((presentes / total) * 100) : null;
                const [, m, d]  = escala.date.split('-');
                return (
                  <div key={escala.id} className="card overflow-hidden">
                    <button onClick={() => setOpenId(isOpen ? null : escala.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ textAlign: 'center', width: '38px', flexShrink: 0 }}>
                        <p style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{d}</p>
                        <p style={{ fontSize: '9px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase' }}>{MONTHS_SHORT[Number(m)-1]}</p>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{escala.companyName || '—'}</p>
                        <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                          {escala.time || '—'} · {total} ajudante{total !== 1 ? 's' : ''}{escala.service ? ` · ${escala.service}` : ''}
                        </p>
                      </div>
                      {pct !== null && (
                        <div style={{ textAlign: 'center', flexShrink: 0 }}>
                          <p style={{ fontSize: '16px', fontWeight: 800, color: pct === 100 ? '#059669' : pct >= 60 ? '#D97706' : '#E11D48', lineHeight: 1 }}>{pct}%</p>
                          <p style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 600 }}>presença</p>
                        </div>
                      )}
                      <ChevronRight size={14} style={{ color: '#CBD5E1', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
                    </button>
                    {isOpen && (
                      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                        <EscalaDetalhe escala={escala} employees={employees} flat />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de edição */}
      {editandoEscala && (
        <ModalEditarEscala
          escala={editandoEscala}
          employees={employees}
          onClose={() => setEditar(null)}
          onSaved={() => {
            setEditar(null);
            setDetalhe(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// ── Tab: Ajudantes ────────────────────────────────────────────────────────
function ModalSolicitarAjudantes({ user, onClose }) {
  const [form, setForm] = useState({ cidade: '', funcao: '', quantidade: 1, observacoes: '' });
  const [saving, setSaving] = useState(false);
  const [sent, setSent]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.cidade.trim() || !form.funcao.trim()) return;
    setSaving(true);
    await createSolicitacaoAjudantes({ liderId: user.id, ...form });
    setSaving(false);
    setSent(true);
    setTimeout(onClose, 1800);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '460px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <p style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Solicitar Mais Ajudantes</p>
            <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '2px' }}>O admin receberá sua solicitação</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
        </div>

        {sent ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle2 size={40} style={{ color: '#059669', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#059669' }}>Solicitação enviada!</p>
            <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>O RH já pode ver seu pedido.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Cidade *</label>
                <input className="input-field" placeholder="Ex: Gravataí" required
                  value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Função *</label>
                <input className="input-field" placeholder="Ex: Ajudante, Conferente..." required
                  value={form.funcao} onChange={e => setForm(f => ({ ...f, funcao: e.target.value }))} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Quantidade necessária *</label>
              <input type="number" min={1} max={50} className="input-field" required
                value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Observações (opcional)</label>
              <textarea className="input-field" rows={3} style={{ resize: 'none' }}
                placeholder="Horário preferencial, requisitos especiais, urgência..."
                value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="button" onClick={onClose}
                style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                {saving ? 'Enviando...' : <><Send size={14} /> Enviar ao RH</>}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function TabAjudantes({ user }) {
  const [ajudantes, setAjudantes]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [modalSolic, setModalSolic] = useState(false);

  useEffect(() => {
    fetchTodosAjudantes().then(data => { setAjudantes(data); setLoading(false); });
  }, []);

  function tempoEmpresa(dataContratacao) {
    if (!dataContratacao) return null;
    const inicio = new Date(dataContratacao + 'T12:00:00');
    const hoje   = new Date();
    const meses  = (hoje.getFullYear() - inicio.getFullYear()) * 12 + (hoje.getMonth() - inicio.getMonth());
    if (meses < 1)  return 'menos de 1 mês';
    if (meses < 12) return `${meses} mês${meses !== 1 ? 'es' : ''}`;
    const anos = Math.floor(meses / 12);
    const rest = meses % 12;
    return rest === 0 ? `${anos} ano${anos !== 1 ? 's' : ''}` : `${anos} ano${anos !== 1 ? 's' : ''} e ${rest} mês${rest !== 1 ? 'es' : ''}`;
  }

  const filtrados = ajudantes.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    (a.cidade || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Barra de busca + botão solicitar */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="input-field" style={{ paddingLeft: '34px' }} placeholder="Buscar por nome ou cidade..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <button onClick={() => setModalSolic(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '0 18px', borderRadius: '12px', background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>
          <Plus size={15} /> Pedir + Ajudantes ao RH
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '40px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#94A3B8' }}>Carregando...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="card" style={{ padding: '40px 16px', textAlign: 'center' }}>
          <Users size={28} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '13px', color: '#94A3B8' }}>Nenhum ajudante encontrado</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>
              {filtrados.length} ajudante{filtrados.length !== 1 ? 's' : ''} disponíve{filtrados.length !== 1 ? 'is' : 'l'}
            </p>
          </div>
          {filtrados.map((aj, idx) => (
            <div key={aj.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderBottom: idx < filtrados.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: aj.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: 'white', flexShrink: 0 }}>
                {aj.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                  {aj.name}
                  {aj.cidade && <span style={{ fontSize: '13px', fontWeight: 400, color: '#94A3B8' }}> ({aj.cidade})</span>}
                </p>
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                  {aj.cargo}{tempoEmpresa(aj.dataContratacao) ? ` · ${tempoEmpresa(aj.dataContratacao)}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalSolic && <ModalSolicitarAjudantes user={user} onClose={() => setModalSolic(false)} />}
    </div>
  );
}

// ── Tab: Tarefas ──────────────────────────────────────────────────────────
const PRIO_CFG = {
  alta:   { label: 'Alta',   color: '#E11D48', bg: '#FFE4E6' },
  normal: { label: 'Normal', color: '#D97706', bg: '#FEF3C7' },
  baixa:  { label: 'Baixa',  color: '#64748B', bg: '#F1F5F9' },
};

function TabTarefas({ user }) {
  const [tarefas, setTarefas] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetchTarefasParaLider(user.id).then(data => { setTarefas(data); setLoading(false); });
  };

  useEffect(() => { load(); }, [user.id]);

  const handleConcluir = async (id) => {
    await concluirTarefaAdmin(id);
    load();
  };

  const pendentes  = tarefas.filter(t => t.status !== 'concluido');
  const concluidas = tarefas.filter(t => t.status === 'concluido');

  if (loading) {
    return <div className="card" style={{ padding: '48px', textAlign: 'center' }}><p style={{ color: '#94A3B8', fontSize: '13px' }}>Carregando...</p></div>;
  }

  return (
    <div className="space-y-5">
      {tarefas.length === 0 ? (
        <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
          <CheckCircle2 size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>Nenhuma tarefa atribuída pelo admin</p>
        </div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
                Pendentes ({pendentes.length})
              </p>
              <div className="card overflow-hidden">
                {pendentes.map((t, idx) => {
                  const pri = PRIO_CFG[t.prioridade] || PRIO_CFG.normal;
                  return (
                    <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', borderBottom: idx < pendentes.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                      <button onClick={() => handleConcluir(t.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', paddingTop: '1px', flexShrink: 0 }}>
                        <AlertCircle size={18} style={{ color: '#CBD5E1' }} />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{t.titulo}</p>
                        {t.descricao && <p style={{ fontSize: '12px', color: '#64748B', marginTop: '3px', lineHeight: 1.5 }}>{t.descricao}</p>}
                        <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>
                          {new Date(t.criado_em).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: pri.bg, color: pri.color }}>{pri.label}</span>
                        <button onClick={() => handleConcluir(t.id)}
                          style={{ fontSize: '11px', fontWeight: 700, padding: '4px 10px', borderRadius: '7px', background: '#DCFCE7', color: '#059669', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={11} /> Concluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {concluidas.length > 0 && (
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
                Concluídas ({concluidas.length})
              </p>
              <div className="card overflow-hidden">
                {concluidas.map((t, idx) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: idx < concluidas.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none', opacity: 0.5 }}>
                    <CheckCircle2 size={16} style={{ color: '#059669', flexShrink: 0 }} />
                    <p style={{ fontSize: '13px', color: '#64748B', textDecoration: 'line-through' }}>{t.titulo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
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
  const [escalas, setEscalas]           = useState([]);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [hojeStats, setHojeStats]       = useState({ presentes: 0, ausentes: 0, ocCount: 0 });

  const load = useCallback(() => {
    if (user?.id) fetchEscalasByLider(user.id).then(setEscalas);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  const TITLES = {
    hoje:        { sub: 'Operação do dia', title: `Olá, ${user?.name?.split(' ')[0] || ''}` },
    escala:      { sub: 'Escala',          title: 'Gestão de Escalas' },
    ajudantes:   { sub: 'Equipe',          title: 'Ajudantes Disponíveis' },
    tarefas:     { sub: 'Admin',           title: 'Minhas Tarefas' },
    ocorrencias: { sub: 'Ocorrências',     title: 'Incidentes e Reportes' },
  };
  const { sub, title } = TITLES[tab] || TITLES.hoje;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-fade-up" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{sub}</p>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', marginTop: '2px' }}>{title}</h1>
          {user?.companyName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '4px' }}>
              <Building2 size={12} style={{ color: '#94A3B8' }} />
              <p style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>{user.companyName}</p>
            </div>
          )}
        </div>
        {tab === 'hoje' && (
          <button onClick={() => setModalFinalizar(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '12px', background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 2px 10px rgba(255,77,12,0.30)' }}>
            <FileText size={15} /> Finalizar dia
          </button>
        )}
      </div>

      {tab === 'hoje'        && <TabHoje        user={user} escalas={escalas} employees={employees} onRefresh={load} onStatsChange={setHojeStats} />}
      {tab === 'escala'      && <TabEscala      user={user} escalas={escalas} employees={employees} onRefresh={load} />}
      {tab === 'ajudantes'   && <TabAjudantes user={user} />}
      {tab === 'tarefas'     && <TabTarefas user={user} />}
      {tab === 'ocorrencias' && <TabOcorrencias user={user} escalas={escalas} employees={employees} />}

      {modalFinalizar && (
        <ModalFinalizarDia
          user={user}
          presentes={hojeStats.presentes}
          ausentes={hojeStats.ausentes}
          ocCount={hojeStats.ocCount}
          onClose={() => setModalFinalizar(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
