import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Building2, Calendar, Clock, ChevronDown, CheckCircle2,
  Send, ClipboardList, Search, AlertCircle, Briefcase,
  ChevronRight, Trash2, Edit2, ArrowLeft, Plus, Users,
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

// ── Detalhe de uma demanda ────────────────────────────────────────────────
function DemandDetail({ demand, employees, onChangeStatus, onEdit, onDelete, onBack }) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="space-y-4 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          fontSize: '13px', fontWeight: 600, color: '#64748B',
          background: 'none', border: 'none', cursor: 'pointer',
        }}>
          <ArrowLeft size={14} /> Voltar
        </button>
        <div className="flex gap-2">
          <button onClick={onEdit} style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
            background: '#F1F5F9', color: '#374151', border: 'none', cursor: 'pointer',
          }}>
            <Edit2 size={12} /> Editar
          </button>
          {confirmDelete ? (
            <div className="flex gap-1">
              <button onClick={() => onDelete(demand.id)} style={{
                padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                background: '#E11D48', color: 'white', border: 'none', cursor: 'pointer',
              }}>Confirmar exclusão</button>
              <button onClick={() => setConfirmDelete(false)} style={{
                padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                background: '#F1F5F9', color: '#374151', border: 'none', cursor: 'pointer',
              }}>Cancelar</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              background: '#FFF1F2', color: '#E11D48', border: 'none', cursor: 'pointer',
            }}>
              <Trash2 size={12} /> Deletar
            </button>
          )}
        </div>
      </div>

      {/* Info da demanda */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFF2EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Building2 size={18} style={{ color: '#FF4D0C' }} />
          </div>
          <div>
            <p className="text-sm font-bold" style={T}>{demand.companyName}</p>
            <p className="text-xs mt-0.5" style={TM}>{demand.service || 'Serviço geral'}</p>
          </div>
        </div>
        <div className="flex gap-5">
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#475569' }}>
            <Calendar size={12} /> {formatDate(demand.date)}
          </span>
          <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#475569' }}>
            <Clock size={12} /> {demand.time || '—'}
          </span>
        </div>
      </div>

      {/* Ajudantes */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <p className="text-xs font-bold" style={T}>
            Ajudantes escalados ({demand.employees.length})
          </p>
        </div>

        {demand.employees.length === 0 && (
          <p className="text-xs text-center py-8" style={TM}>Nenhum ajudante escalado</p>
        )}

        {demand.employees.map(({ employeeId, status, entrada, saida, saidaAlmoco, retornoAlmoco }) => {
          const emp = employees.find(e => e.id === employeeId);
          const hasTime = entrada || saida || saidaAlmoco || retornoAlmoco;
          return (
            <div key={employeeId} style={{
              display: 'flex', alignItems: 'flex-start', gap: '12px',
              padding: '13px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)',
            }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px', flexShrink: 0,
                background: emp?.color || '#94A3B8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700, color: 'white',
              }}>
                {emp?.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{emp?.name || '—'}</p>
                {hasTime && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
                    {entrada      && <span className="text-xs" style={{ color: '#64748B' }}>Entrada: <b style={{ color: '#0F172A' }}>{entrada}</b></span>}
                    {saidaAlmoco  && <span className="text-xs" style={{ color: '#64748B' }}>Saída almoço: <b style={{ color: '#0F172A' }}>{saidaAlmoco}</b></span>}
                    {retornoAlmoco && <span className="text-xs" style={{ color: '#64748B' }}>Retorno: <b style={{ color: '#0F172A' }}>{retornoAlmoco}</b></span>}
                    {saida        && <span className="text-xs" style={{ color: '#64748B' }}>Saída: <b style={{ color: '#0F172A' }}>{saida}</b></span>}
                  </div>
                )}
                {!hasTime && (
                  <p className="text-xs mt-0.5" style={{ color: '#CBD5E1' }}>Nenhum horário registrado</p>
                )}
              </div>
              <StatusBadge
                status={status}
                onChangeStatus={(s) => onChangeStatus(demand.id, employeeId, s)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Acompanhar Demandas ───────────────────────────────────────────────────
function AcompanharDemandas({ demands, employees, companies, onChangeStatus, onDelete, onEdit }) {
  const [selectedId, setSelectedId] = useState(null);
  const [editingId,  setEditingId]  = useState(null);

  const selectedDemand = demands.find(d => d.id === selectedId);
  const editingDemand  = demands.find(d => d.id === editingId);

  if (editingDemand) {
    return (
      <div className="max-w-lg animate-fade-up">
        <div className="flex items-center gap-2 mb-4">
          <button onClick={() => setEditingId(null)} style={{
            background: 'none', border: 'none', cursor: 'pointer', color: '#64748B',
            display: 'flex', alignItems: 'center', gap: '5px',
            fontSize: '13px', fontWeight: 600,
          }}>
            <ArrowLeft size={14} /> Voltar
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
    );
  }

  if (selectedDemand) {
    return (
      <DemandDetail
        demand={selectedDemand}
        employees={employees}
        onChangeStatus={onChangeStatus}
        onEdit={() => { setEditingId(selectedDemand.id); setSelectedId(null); }}
        onDelete={async (id) => { await onDelete(id); setSelectedId(null); }}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-2">
      {demands.length === 0 && (
        <div className="card p-12 text-center">
          <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <ClipboardList size={22} style={{ color: '#CBD5E1' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: '#94A3B8' }}>Nenhuma demanda lançada</p>
          <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Use "Nova Demanda" para escalar ajudantes</p>
        </div>
      )}

      {demands.map(d => {
        const counts = ADMIN_STATUS_OPTIONS.reduce((acc, s) => {
          acc[s] = d.employees.filter(e => e.status === s).length;
          return acc;
        }, {});

        return (
          <button
            key={d.id}
            onClick={() => setSelectedId(d.id)}
            className="card w-full"
            style={{
              padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px',
              cursor: 'pointer', border: 'none', textAlign: 'left', transition: 'box-shadow 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: '#FFF2EE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Building2 size={16} style={{ color: '#FF4D0C' }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{d.companyName}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '3px', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94A3B8' }}>
                  <Calendar size={10} /> {formatDate(d.date)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94A3B8' }}>
                  <Clock size={10} /> {d.time || '—'}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94A3B8' }}>
                  <Users size={10} /> {d.employees.length} ajudante{d.employees.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', justifyContent: 'flex-end' }}>
              {Object.entries(counts).filter(([, n]) => n > 0).map(([s, n]) => {
                const c = STATUS_CONFIG[s];
                return (
                  <span key={s} style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: c.bg, color: c.color, whiteSpace: 'nowrap' }}>
                    {n} {c.label}
                  </span>
                );
              })}
            </div>

            <ChevronRight size={14} style={{ color: '#CBD5E1', flexShrink: 0 }} />
          </button>
        );
      })}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────
export default function AdminDemanda() {
  const { employees, companies, demands, addDemand, updateDemandStatus, removeDemand, changeDemand } = useAuth();
  const [subTab, setSubTab] = useState('nova');

  const handleNewDemand = async (form) => {
    const saved = await addDemand({
      companyId:   form.companyId,
      date:        form.date,
      time:        form.time,
      service:     form.service || 'Serviço geral',
      employeeIds: form.selectedEmployees,
    });
    return saved;
  };

  const SUB_TABS = [
    { key: 'nova',        label: 'Nova Demanda',       icon: Plus },
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
            {key === 'acompanhar' && demands.length > 0 && (
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                background: subTab === key ? '#FFF2EE' : '#E2E8F0',
                color:      subTab === key ? '#FF4D0C' : '#64748B',
              }}>
                {demands.length}
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
            demands={demands}
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
