import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Building2, Calendar, Clock, ChevronDown, CheckCircle2,
  Send, ClipboardList, Search, AlertCircle, Briefcase,
  ChevronRight, Trash2, Edit2, ArrowLeft, Plus, Users, X,
} from 'lucide-react';

const T  = { color: '#0F172A' };
const TM = { color: '#94A3B8' };

const SERVICES = [
  'Carga e descarga', 'Separação de mercadoria', 'Organização de estoque',
  'Inventário', 'Movimentação de carga', 'Conferência de notas',
];

const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const dow = DOW[new Date(`${iso}T12:00:00`).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
}

export const STATUS_CONFIG = {
  aguardando: { label: 'Aguardando', color: '#D97706', bg: '#FEF3C7' },
  confirmado: { label: 'Confirmado', color: '#059669', bg: '#DCFCE7' },
  atrasado:   { label: 'Atrasado',   color: '#EA580C', bg: '#FFEDD5' },
  falta:      { label: 'Falta',      color: '#E11D48', bg: '#FFE4E6' },
  finalizado: { label: 'Finalizado', color: '#64748B', bg: '#F1F5F9' },
};

const ADMIN_STATUS_OPTIONS = ['aguardando','confirmado','atrasado','falta','finalizado'];

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
                onMouseEnter={e => { if (s !== status) e.currentTarget.style.background = '#F8FAFC'; }}
                onMouseLeave={e => { if (s !== status) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: s === status ? c.color : '#374151' }}>{c.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Formulário de demanda (nova e edição) ─────────────────────────────────
function DemandForm({ initialData, employees, companies, onSubmit, onCancel, submitLabel = 'Lançar Demanda' }) {
  const activeEmployees = employees.filter(e => e.status === 'active');
  const [form, setForm] = useState(initialData || {
    companyId: '', date: new Date().toISOString().slice(0, 10), time: '07:30', service: '', selectedEmployees: [],
  });
  const [search,  setSearch]  = useState('');
  const [error,   setError]   = useState('');
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);

  const filtered = activeEmployees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleEmployee = (id) => {
    setForm(f => ({
      ...f,
      selectedEmployees: f.selectedEmployees.includes(id)
        ? f.selectedEmployees.filter(x => x !== id)
        : [...f.selectedEmployees, id],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.companyId)                  { setError('Selecione uma empresa.'); return; }
    if (form.selectedEmployees.length === 0) { setError('Selecione ao menos um ajudante.'); return; }
    setError('');
    setSaving(true);
    const ok = await onSubmit(form);
    setSaving(false);
    if (ok && !initialData) {
      setForm({ companyId: '', date: new Date().toISOString().slice(0, 10), time: '07:30', service: '', selectedEmployees: [] });
      setSearch('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const canSubmit = form.companyId && form.selectedEmployees.length > 0 && !saving;

  return (
    <form onSubmit={handleSubmit} className="card p-5 space-y-5">
      <h2 className="text-sm font-bold flex items-center gap-2" style={T}>
        <Send size={14} style={{ color: '#FF4D0C' }} />
        {submitLabel === 'Lançar Demanda' ? 'Nova Demanda' : 'Editar Demanda'}
      </h2>

      {/* Empresa */}
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Empresa</label>
        <div className="relative">
          <Building2 size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
          <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
            className="input-field" style={{ paddingLeft: '32px', appearance: 'none' }}>
            <option value="">Selecionar empresa...</option>
            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
        </div>
      </div>

      {/* Data + Horário */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Data</label>
          <input type="date" className="input-field" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Horário</label>
          <input type="time" className="input-field" value={form.time}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))} required />
        </div>
      </div>

      {/* Serviço */}
      <div>
        <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Tipo de Serviço</label>
        <div className="relative">
          <Briefcase size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
          <input list="services-list" className="input-field" style={{ paddingLeft: '32px' }}
            placeholder="Ex: Carga e descarga" value={form.service}
            onChange={e => setForm(f => ({ ...f, service: e.target.value }))} />
          <datalist id="services-list">
            {SERVICES.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
      </div>

      {/* Ajudantes */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold" style={{ color: '#64748B' }}>Ajudantes</label>
          {form.selectedEmployees.length > 0 && (
            <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '5px', background: '#FFF2EE', color: '#FF4D0C' }}>
              {form.selectedEmployees.length} selecionado{form.selectedEmployees.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="relative mb-2">
          <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
          <input className="input-field" style={{ paddingLeft: '30px', paddingTop: '7px', paddingBottom: '7px', fontSize: '12px' }}
            placeholder="Buscar ajudante..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ maxHeight: '210px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filtered.length === 0
            ? <p className="text-xs text-center py-4" style={TM}>Nenhum ajudante encontrado</p>
            : filtered.map(emp => {
              const selected = form.selectedEmployees.includes(emp.id);
              return (
                <button type="button" key={emp.id} onClick={() => toggleEmployee(emp.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                    background: selected ? '#FFF2EE' : '#F8FAFC',
                    outline: selected ? '1.5px solid rgba(255,77,12,0.25)' : '1.5px solid transparent',
                    transition: 'all 0.15s', textAlign: 'left',
                  }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '9px', flexShrink: 0,
                    background: emp.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', fontWeight: 700, color: 'white',
                  }}>{emp.initials}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: selected ? '#FF4D0C' : '#0F172A' }}>{emp.name}</p>
                    <p style={{ fontSize: '10px', color: '#94A3B8' }}>Ajudante</p>
                  </div>
                  <div style={{
                    width: '16px', height: '16px', borderRadius: '50%', flexShrink: 0,
                    border: selected ? 'none' : '1.5px solid #CBD5E1',
                    background: selected ? '#FF4D0C' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s',
                  }}>
                    {selected && <CheckCircle2 size={12} style={{ color: 'white' }} />}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs" style={{ color: '#E11D48' }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} style={{
            flex: 1, padding: '11px', borderRadius: '12px', border: 'none',
            fontSize: '13px', fontWeight: 700, cursor: 'pointer',
            background: '#F1F5F9', color: '#64748B',
          }}>
            Cancelar
          </button>
        )}
        <button type="submit" disabled={!canSubmit} style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '8px', padding: '11px', borderRadius: '12px', border: 'none',
          fontSize: '13px', fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
          background: canSubmit ? '#FF4D0C' : '#E2E8F0',
          color: canSubmit ? 'white' : '#94A3B8',
          boxShadow: canSubmit ? '0 2px 10px rgba(255,77,12,0.3)' : 'none',
          transition: 'all 0.2s',
        }}>
          <Send size={14} /> {saving ? 'Salvando...' : submitLabel}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 text-xs font-semibold justify-center" style={{ color: '#059669' }}>
          <CheckCircle2 size={14} /> Demanda lançada! Aguardando confirmações.
        </div>
      )}
    </form>
  );
}

// ── Modal de detalhe de uma demanda ──────────────────────────────────────
function DemandModal({ demand, employees, onChangeStatus, onEdit, onDelete, onClose }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Fecha com Esc
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '560px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.22)',
        display: 'flex', flexDirection: 'column', maxHeight: '88vh',
        overflow: 'hidden',
      }}>

        {/* ── Topo escuro com empresa + horário ── */}
        <div style={{
          background: 'linear-gradient(135deg,#111827 0%,#1E293B 100%)',
          padding: '24px 24px 20px',
          position: 'relative',
        }}>
          {/* Fechar */}
          <button onClick={onClose} style={{
            position: 'absolute', top: '16px', right: '16px',
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.08)', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8',
          }}>
            <X size={15} />
          </button>

          {/* Empresa */}
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
            Empresa
          </p>
          <p style={{ fontSize: '22px', fontWeight: 800, color: '#fff', lineHeight: 1.15, marginBottom: '18px' }}>
            {demand.companyName}
          </p>

          {/* Três métricas em linha */}
          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Horário entrada */}
            <div style={{ flex: 1, background: 'rgba(255,77,12,0.15)', borderRadius: '12px', padding: '10px 14px' }}>
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#FF7043', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Entrada</p>
              <p style={{ fontSize: '20px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{demand.time || '—'}</p>
            </div>
            {/* Ajudantes */}
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px 14px' }}>
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Ajudantes</p>
              <p style={{ fontSize: '20px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{demand.employees.length}</p>
            </div>
            {/* Data */}
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '12px', padding: '10px 14px' }}>
              <p style={{ fontSize: '10px', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Data</p>
              <p style={{ fontSize: '15px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{formatDate(demand.date).split(',')[0]}<br/><span style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8' }}>{formatDate(demand.date).split(', ')[1]}</span></p>
            </div>
          </div>
        </div>

        {/* ── Lista de ajudantes ── */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '12px 24px 8px' }}>
            Escala
          </p>

          {demand.employees.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '32px 0', fontSize: '13px', color: '#94A3B8' }}>
              Nenhum ajudante escalado
            </p>
          ) : demand.employees.map(({ employeeId, status, entrada, saida, saidaAlmoco, retornoAlmoco }, idx) => {
            const emp = employees.find(e => e.id === employeeId);
            const isLast = idx === demand.employees.length - 1;
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.aguardando;
            return (
              <div key={employeeId} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 24px',
                borderBottom: isLast ? 'none' : '1px solid rgba(0,0,0,0.05)',
              }}>
                {/* Avatar */}
                <div style={{
                  width: '40px', height: '40px', borderRadius: '12px', flexShrink: 0,
                  background: emp?.color || '#94A3B8',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '12px', fontWeight: 700, color: 'white',
                }}>
                  {emp?.initials}
                </div>

                {/* Nome + horários */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{emp?.name || '—'}</p>
                  {(entrada || saida) ? (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '3px' }}>
                      {entrada && <span style={{ fontSize: '11px', color: '#64748B' }}>Entrada <b style={{ color: '#0F172A' }}>{entrada}</b></span>}
                      {saidaAlmoco && <span style={{ fontSize: '11px', color: '#64748B' }}>Almoço <b style={{ color: '#0F172A' }}>{saidaAlmoco}</b></span>}
                      {retornoAlmoco && <span style={{ fontSize: '11px', color: '#64748B' }}>Retorno <b style={{ color: '#0F172A' }}>{retornoAlmoco}</b></span>}
                      {saida && <span style={{ fontSize: '11px', color: '#64748B' }}>Saída <b style={{ color: '#0F172A' }}>{saida}</b></span>}
                    </div>
                  ) : (
                    <p style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '2px' }}>Aguardando início</p>
                  )}
                </div>

                {/* Status badge */}
                <StatusBadge
                  status={status}
                  onChangeStatus={(s) => onChangeStatus(demand.id, employeeId, s)}
                />
              </div>
            );
          })}
        </div>

        {/* ── Rodapé ── */}
        <div style={{ display: 'flex', gap: '8px', padding: '16px 24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
          <button onClick={onEdit} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
            background: '#F1F5F9', color: '#374151', border: 'none', cursor: 'pointer',
          }}>
            <Edit2 size={13} /> Editar
          </button>
          {confirmDelete ? (
            <>
              <button onClick={() => onDelete(demand.id)} style={{
                flex: 2, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700,
                background: '#E11D48', color: 'white', border: 'none', cursor: 'pointer',
              }}>Confirmar exclusão</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                background: '#F1F5F9', color: '#374151', border: 'none', cursor: 'pointer',
              }}>Cancelar</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
              background: '#FFF1F2', color: '#E11D48', border: 'none', cursor: 'pointer',
            }}>
              <Trash2 size={13} /> Deletar
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Acompanhar Demandas ───────────────────────────────────────────────────
function AcompanharDemandas({ demands, employees, companies, onChangeStatus, onDelete, onEdit }) {
  const [selectedId, setSelectedId] = useState(null);
  const [editingId,  setEditingId]  = useState(null);

  const selectedDemand = demands.find(d => d.id === selectedId);
  const editingDemand  = demands.find(d => d.id === editingId);

  return (
    <>
      {/* Modal de edição */}
      {editingDemand && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
        }}
          onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null); }}
        >
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '480px', padding: '24px', boxShadow: '0 24px 64px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex items-center justify-between mb-4">
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Editar Demanda</p>
              <button onClick={() => setEditingId(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '30px', height: '30px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B' }}>
                <X size={15} />
              </button>
            </div>
            <DemandForm
              initialData={{
                companyId:         editingDemand.companyId,
                date:              editingDemand.date,
                time:              editingDemand.time || '07:30',
                service:           editingDemand.service || '',
                selectedEmployees: editingDemand.employees.map(e => e.employeeId),
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
          onEdit={() => { setEditingId(selectedDemand.id); setSelectedId(null); }}
          onDelete={async (id) => { await onDelete(id); setSelectedId(null); }}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Lista */}
      <div style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {demands.length === 0 ? (
          <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#94A3B8' }}>Nenhuma demanda ativa</p>
            <p style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '4px' }}>Use "Nova Demanda" para escalar ajudantes</p>
          </div>
        ) : demands.map((d) => {
          const total      = d.employees.length;
          const [y, m, day] = d.date.split('-');
          const mes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][Number(m) - 1];

          return (
            <button
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className="card"
              style={{
                width: '100%', display: 'flex', alignItems: 'center',
                padding: '14px 18px', border: 'none', background: 'white',
                cursor: 'pointer', textAlign: 'left', gap: '16px',
                transition: 'box-shadow 0.15s, background 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#FAFBFC'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.boxShadow = ''; }}
            >
              {/* Empresa */}
              <p style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {d.companyName}
              </p>

              {/* Ajudantes */}
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: '#64748B', flexShrink: 0 }}>
                <Users size={13} style={{ color: '#94A3B8' }} />
                {total}
              </span>

              {/* Data */}
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8', flexShrink: 0 }}>
                {day}/{m}/{y.slice(2)}
              </span>

              <ChevronRight size={14} style={{ color: '#CBD5E1', flexShrink: 0 }} />
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── helpers de data ───────────────────────────────────────────────────────
const TODAY_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

function subtractDays(isoDate, days) {
  const d = new Date(isoDate + 'T12:00:00');
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// Janela de exibição: hoje, ontem e anteontem (3 dias)
const CUTOFF = subtractDays(TODAY_ISO, 2);

// ── Página principal ───────────────────────────────────────────────────────
export default function AdminDemanda() {
  const { employees, companies, demands, addDemand, updateDemandStatus, removeDemand, archiveDemandFromList, changeDemand } = useAuth();
  const [subTab, setSubTab] = useState('nova');
  const cleanedRef = useRef(false);

  // Limpeza automática: demandas fora da janela de 3 dias
  useEffect(() => {
    if (cleanedRef.current || demands.length === 0) return;
    cleanedRef.current = true;

    const old = demands.filter(d => d.date < CUTOFF);
    old.forEach(d => {
      const hasStarted = d.employees.some(e => e.entrada !== null);
      if (hasStarted) {
        // Trabalho iniciado → arquiva (mantém registros no histórico, remove escala)
        archiveDemandFromList(d.id);
      } else {
        // Nenhum trabalho → deleta tudo
        removeDemand(d.id);
      }
    });
  }, [demands]);

  // Demandas dos últimos 3 dias para exibição
  const recentDemands = demands.filter(d => d.date >= CUTOFF);

  const handleNewDemand = async (form) => {
    return await addDemand({
      companyId:   form.companyId,
      date:        form.date,
      time:        form.time,
      service:     form.service || 'Serviço geral',
      employeeIds: form.selectedEmployees,
    });
  };

  const SUB_TABS = [
    { key: 'nova',        label: 'Nova Demanda',        icon: Plus },
    { key: 'acompanhar',  label: 'Acompanhar Demandas', icon: ClipboardList },
  ];

  return (
    <div className="space-y-5">
      {/* Sub-tab bar */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.06)' }}>
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSubTab(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: subTab === key ? 'white' : 'transparent',
              color:      subTab === key ? '#FF4D0C' : '#64748B',
              border:     'none', cursor: 'pointer',
              boxShadow:  subTab === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon size={12} />
            {label}
            {key === 'acompanhar' && recentDemands.length > 0 && (
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                background: subTab === key ? '#FFF2EE' : '#E2E8F0',
                color:      subTab === key ? '#FF4D0C' : '#64748B',
              }}>
                {recentDemands.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {subTab === 'nova' && (
        <div className="max-w-lg animate-fade-up">
          <DemandForm
            employees={employees}
            companies={companies}
            onSubmit={handleNewDemand}
          />
        </div>
      )}

      {subTab === 'acompanhar' && (
        <div className="animate-fade-up">
          <AcompanharDemandas
            demands={recentDemands}
            employees={employees}
            companies={companies}
            onChangeStatus={updateDemandStatus}
            onDelete={removeDemand}
            onEdit={changeDemand}
          />
        </div>
      )}
    </div>
  );
}
