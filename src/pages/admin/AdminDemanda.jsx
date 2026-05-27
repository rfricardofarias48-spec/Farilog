import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { EMPLOYEES } from '../../data/mockData';
import {
  Building2, Calendar, Clock, ChevronDown, CheckCircle2,
  Send, ClipboardList, Search, AlertCircle, Briefcase, ChevronRight,
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

// ── Configuração de status ─────────────────────────────────────────────────
export const STATUS_CONFIG = {
  aguardando: { label: 'Aguardando', color: '#D97706', bg: '#FEF3C7' },
  confirmado: { label: 'Confirmado', color: '#059669', bg: '#DCFCE7' },
  atrasado:   { label: 'Atrasado',   color: '#EA580C', bg: '#FFEDD5' },
  falta:      { label: 'Falta',      color: '#E11D48', bg: '#FFE4E6' },
  finalizado: { label: 'Finalizado', color: '#64748B', bg: '#F1F5F9' },
};

// Status que o admin pode definir manualmente
const ADMIN_STATUS_OPTIONS = ['aguardando','confirmado','atrasado','falta','finalizado'];

// ── Badge de status com dropdown (apenas admin) ────────────────────────────
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
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '6px',
          background: cfg.bg, color: cfg.color,
          border: 'none', cursor: 'pointer',
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
                onClick={() => { onChangeStatus(s); setOpen(false); }}
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

// ── Card de demanda ────────────────────────────────────────────────────────
function DemandCard({ demand, onChangeStatus }) {
  const counts = ADMIN_STATUS_OPTIONS.reduce((acc, s) => {
    acc[s] = demand.employees.filter(e => e.status === s).length;
    return acc;
  }, {});

  return (
    <div className="card p-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FFF2EE' }}>
              <Building2 size={13} style={{ color: '#FF4D0C' }} />
            </div>
            <p className="text-sm font-bold" style={T}>{demand.companyName}</p>
          </div>
          <div className="flex items-center gap-3 ml-9">
            <span className="flex items-center gap-1 text-xs" style={TM}>
              <Calendar size={10} /> {formatDate(demand.date)}
            </span>
            <span className="flex items-center gap-1 text-xs" style={TM}>
              <Clock size={10} /> {demand.time}
            </span>
          </div>
        </div>
        <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 9px', borderRadius: '6px', background: '#F1F5F9', color: '#475569', flexShrink: 0 }}>
          {demand.service}
        </span>
      </div>

      {/* Resumo de status */}
      <div className="flex items-center gap-2 mb-3 px-1">
        {Object.entries(counts).filter(([, n]) => n > 0).map(([s, n]) => {
          const c = STATUS_CONFIG[s];
          return (
            <span key={s} style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '5px', background: c.bg, color: c.color }}>
              {n} {c.label}
            </span>
          );
        })}
        {demand.employees.length === 0 && <span className="text-xs" style={TM}>Sem ajudantes</span>}
      </div>

      {/* Lista de ajudantes */}
      <div className="card overflow-hidden">
        {demand.employees.map(({ employeeId, status }) => {
          const emp = EMPLOYEES.find(e => e.id === employeeId);
          return (
            <div key={employeeId} style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px', borderBottom: '1px solid rgba(0,0,0,0.04)',
            }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '8px', flexShrink: 0,
                background: emp?.color || '#94A3B8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '10px', fontWeight: 700, color: 'white',
              }}>
                {emp?.initials}
              </div>
              <p style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#0F172A' }}>{emp?.name}</p>
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

// ── Página principal ───────────────────────────────────────────────────────
export default function AdminDemanda() {
  const { companies, demands, addDemand, updateDemandStatus } = useAuth();
  const activeEmployees = EMPLOYEES.filter(e => e.status === 'active');

  const [form, setForm] = useState({
    companyId: '', date: '2026-05-26', time: '07:30', service: '', selectedEmployees: [],
  });
  const [search,  setSearch]  = useState('');
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState('');

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.companyId) { setError('Selecione uma empresa.'); return; }
    if (form.selectedEmployees.length === 0) { setError('Selecione ao menos um ajudante.'); return; }
    setError('');

    const company = companies.find(c => c.id === form.companyId);
    addDemand({
      id: `demand-${Date.now()}`,
      companyId:   form.companyId,
      companyName: company?.name,
      date:        form.date,
      time:        form.time,
      service:     form.service || 'Serviço geral',
      employees:   form.selectedEmployees.map(id => ({ employeeId: id, status: 'aguardando' })),
      createdAt:   new Date().toISOString(),
    });

    setForm({ companyId: '', date: '2026-05-26', time: '07:30', service: '', selectedEmployees: [] });
    setSearch('');
    setSuccess(true);
    setTimeout(() => setSuccess(false), 3000);
  };

  const canSubmit = form.companyId && form.selectedEmployees.length > 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="animate-fade-up">
        <h1 className="text-xl font-bold" style={T}>Lançar Demanda</h1>
        <p className="text-xs mt-0.5" style={TM}>Escale ajudantes para empresas e gerencie os status em tempo real</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Formulário ── */}
        <div className="lg:col-span-2 animate-fade-up delay-1">
          <form onSubmit={handleSubmit} className="card p-5 space-y-5">
            <h2 className="text-sm font-bold flex items-center gap-2" style={T}>
              <Send size={14} style={{ color: '#FF4D0C' }} /> Nova Demanda
            </h2>

            {/* Empresa */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Empresa</label>
              <div className="relative">
                <Building2 size={13} style={{ position:'absolute', left:'11px', top:'50%', transform:'translateY(-50%)', color:'#94A3B8', pointerEvents:'none' }} />
                <select value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                  className="input-field" style={{ paddingLeft:'32px', appearance:'none' }}>
                  <option value="">Selecionar empresa...</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <ChevronDown size={13} style={{ position:'absolute', right:'11px', top:'50%', transform:'translateY(-50%)', color:'#94A3B8', pointerEvents:'none' }} />
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
                <Briefcase size={13} style={{ position:'absolute', left:'11px', top:'50%', transform:'translateY(-50%)', color:'#94A3B8', pointerEvents:'none' }} />
                <input list="services-list" className="input-field" style={{ paddingLeft:'32px' }}
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
                  <span style={{ fontSize:'10px', fontWeight:700, padding:'2px 8px', borderRadius:'5px', background:'#FFF2EE', color:'#FF4D0C' }}>
                    {form.selectedEmployees.length} selecionado{form.selectedEmployees.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="relative mb-2">
                <Search size={12} style={{ position:'absolute', left:'10px', top:'50%', transform:'translateY(-50%)', color:'#94A3B8', pointerEvents:'none' }} />
                <input className="input-field" style={{ paddingLeft:'30px', paddingTop:'7px', paddingBottom:'7px', fontSize:'12px' }}
                  placeholder="Buscar ajudante..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div style={{ maxHeight:'210px', overflowY:'auto', display:'flex', flexDirection:'column', gap:'4px' }}>
                {filtered.length === 0
                  ? <p className="text-xs text-center py-4" style={TM}>Nenhum ajudante encontrado</p>
                  : filtered.map(emp => {
                    const selected = form.selectedEmployees.includes(emp.id);
                    return (
                      <button type="button" key={emp.id} onClick={() => toggleEmployee(emp.id)}
                        style={{
                          display:'flex', alignItems:'center', gap:'10px',
                          padding:'8px 10px', borderRadius:'10px', border:'none', cursor:'pointer',
                          background: selected ? '#FFF2EE' : '#F8FAFC',
                          outline: selected ? '1.5px solid rgba(255,77,12,0.25)' : '1.5px solid transparent',
                          transition:'all 0.15s', textAlign:'left',
                        }}>
                        <div style={{
                          width:'30px', height:'30px', borderRadius:'9px', flexShrink:0,
                          background: emp.color, display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:'10px', fontWeight:700, color:'white',
                        }}>{emp.initials}</div>
                        <div style={{ flex:1 }}>
                          <p style={{ fontSize:'12px', fontWeight:600, color: selected ? '#FF4D0C' : '#0F172A' }}>{emp.name}</p>
                          <p style={{ fontSize:'10px', color:'#94A3B8' }}>Ajudante</p>
                        </div>
                        <div style={{
                          width:'16px', height:'16px', borderRadius:'50%', flexShrink:0,
                          border: selected ? 'none' : '1.5px solid #CBD5E1',
                          background: selected ? '#FF4D0C' : 'transparent',
                          display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s',
                        }}>
                          {selected && <CheckCircle2 size={12} style={{ color:'white' }} />}
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-xs" style={{ color:'#E11D48' }}>
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <button type="submit" style={{
              width:'100%', display:'flex', alignItems:'center', justifyContent:'center',
              gap:'8px', padding:'11px', borderRadius:'12px', border:'none',
              fontSize:'13px', fontWeight:700, cursor: canSubmit ? 'pointer' : 'not-allowed',
              background: canSubmit ? '#FF4D0C' : '#E2E8F0',
              color: canSubmit ? 'white' : '#94A3B8',
              boxShadow: canSubmit ? '0 2px 10px rgba(255,77,12,0.3)' : 'none',
              transition:'all 0.2s',
            }}>
              <Send size={14} /> Lançar Demanda
            </button>

            {success && (
              <div className="flex items-center gap-2 text-xs font-semibold justify-center" style={{ color:'#059669' }}>
                <CheckCircle2 size={14} /> Demanda lançada! Aguardando confirmações.
              </div>
            )}
          </form>
        </div>

        {/* ── Lista de demandas ── */}
        <div className="lg:col-span-3 space-y-4 animate-fade-up delay-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold flex items-center gap-2" style={T}>
              <ClipboardList size={14} style={{ color:'#FF4D0C' }} /> Demandas Lançadas
            </h2>
            {demands.length > 0 && (
              <span style={{ fontSize:'11px', fontWeight:600, padding:'2px 9px', borderRadius:'6px', background:'#F1F5F9', color:'#64748B' }}>
                {demands.length} demanda{demands.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {demands.length === 0 ? (
            <div className="card p-12 text-center">
              <div style={{ width:'48px', height:'48px', borderRadius:'16px', background:'#F1F5F9', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
                <ClipboardList size={22} style={{ color:'#CBD5E1' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color:'#94A3B8' }}>Nenhuma demanda lançada</p>
              <p className="text-xs mt-1" style={{ color:'#CBD5E1' }}>Preencha o formulário ao lado para escalar ajudantes</p>
            </div>
          ) : demands.map(d => (
            <DemandCard
              key={d.id}
              demand={d}
              onChangeStatus={updateDemandStatus}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
