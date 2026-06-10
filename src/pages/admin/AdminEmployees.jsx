import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fmtDate } from '../../data/mockData';
import { createEmployee, updateEmployee, deleteEmployee, fetchLideres, updateLider, deleteLider } from '../../lib/db';
import { Plus, Edit2, Trash2, X, Users, Search, ToggleLeft, ToggleRight, KeyRound, Shield } from 'lucide-react';

const EMPTY = { name: '', phone: '', email: '', dailyRate: 150, overtimeRate: 50, vtDiario: 0, vrDiario: 0, password: '', status: 'active', cidade: '' };
const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

function Modal({ employee, onSave, onClose }) {
  const [form, setForm]               = useState(employee ? { ...employee } : { ...EMPTY });
  const [showReset, setShowReset]     = useState(false);

  const fields = [
    { key: 'name',        label: 'Nome completo',        required: true, col: 2 },
    { key: 'phone',       label: 'Telefone',              required: true, placeholder: '(00) 00000-0000' },
    { key: 'email',       label: 'E-mail de acesso',      required: true, type: 'email' },
    { key: 'cidade',      label: 'Cidade/UF',             placeholder: 'Ex: Gravataí/RS' },
    { key: 'dailyRate',   label: 'Valor da diária (R$)',     type: 'number', required: true },
    { key: 'overtimeRate',label: 'Hora extra (R$)',           type: 'number', required: true },
    { key: 'vtDiario',    label: 'Vale Transporte/dia (R$)',  type: 'number', placeholder: '0,00' },
    { key: 'vrDiario',    label: 'Vale Refeição/dia (R$)',    type: 'number', placeholder: '0,00' },
    ...(!employee ? [{ key: 'password', label: 'Senha', type: 'password', col: 2, required: true }] : []),
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold" style={T}>{employee ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#94A3B8', background: '#F1F5F9' }}>
            <X size={15} />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.map(({ key, label, required, placeholder, type, col }) => (
              <div key={key} className={col === 2 ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
                <input type={type || 'text'} placeholder={placeholder} required={required}
                  autoComplete="off" value={form[key] ?? ''}
                  onChange={e => setForm({ ...form, [key]: e.target.value })} className="input-field" />
              </div>
            ))}
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Status</label>
            <div className="flex gap-2">
              {['active','inactive'].map(s => (
                <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background: form.status === s ? (s === 'active' ? '#ECFDF5' : '#FEF2F2') : '#F8FAFC',
                    borderColor: form.status === s ? (s === 'active' ? '#059669' : '#DC2626') : 'rgba(0,0,0,0.08)',
                    color: form.status === s ? (s === 'active' ? '#059669' : '#DC2626') : '#94A3B8',
                  }}>
                  {s === 'active' ? 'Ativo' : 'Inativo'}
                </button>
              ))}
            </div>
          </div>
          {/* Redefinir senha — só no modo edição */}
          {employee && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
              <button
                type="button"
                onClick={() => { setShowReset(v => !v); setForm(f => ({ ...f, password: '' })); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-colors"
                style={{
                  background: showReset ? '#FFF2EE' : '#F8FAFC',
                  color: showReset ? '#FF4D0C' : '#475569',
                  borderBottom: showReset ? '1px solid rgba(255,77,12,0.12)' : 'none',
                }}
              >
                <KeyRound size={13} />
                Redefinir senha
              </button>
              {showReset && (
                <div className="px-4 py-3" style={{ background: '#FFFAF9' }}>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Nova senha</label>
                  <input
                    type="password"
                    autoComplete="new-password"
                    required
                    placeholder="Digite a nova senha"
                    value={form.password ?? ''}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="input-field"
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button type="submit" className="btn-primary flex-1">{employee ? 'Salvar' : 'Cadastrar funcionário'}</button>
            <button type="button" onClick={onClose} className="btn-ghost px-5">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminEmployees() {
  const { employees, setEmployees } = useAuth();
  const [modal, setModal]           = useState(null);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCity,   setFilterCity]   = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // ── Filtro Ajudantes / Líderes ─────────────────────────────────────
  const [filterRole, setFilterRole]           = useState('ajudantes');
  const [lideres, setLideres]                 = useState([]);
  const [loadingLideres, setLoadingLideres]   = useState(false);
  const [deleteConfirmLider, setDeleteConfirmLider] = useState(null);

  useEffect(() => {
    if (filterRole === 'lideres') {
      setLoadingLideres(true);
      fetchLideres().then(l => { setLideres(l || []); setLoadingLideres(false); });
    }
  }, [filterRole]);

  const filteredLideres = useMemo(() => {
    const q = search.toLowerCase();
    return lideres.filter(l =>
      (l.name || '').toLowerCase().includes(q) ||
      (l.companyName || '').toLowerCase().includes(q) ||
      (l.telefone || '').includes(search)
    );
  }, [lideres, search]);
  // ──────────────────────────────────────────────────────────────────

  const cities = useMemo(() =>
    [...new Set(employees.map(e => e.cidade).filter(Boolean))].sort(),
    [employees]
  );

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = e.name.toLowerCase().includes(q) ||
      (e.phone || '').includes(search) ||
      (e.cidade || '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchCity   = !filterCity || e.cidade === filterCity;
    return matchSearch && matchStatus && matchCity;
  });

  const handleSave = async (form) => {
    if (modal === 'new') {
      const initials = form.name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase();
      const colors   = ['#FF4D0C','#7C3AED','#059669','#D97706','#DC2626','#0891B2','#BE185D'];
      const saved = await createEmployee({
        ...form,
        id:           crypto.randomUUID(),
        initials,
        color:        colors[employees.length % colors.length],
        dailyRate:    Number(form.dailyRate),
        overtimeRate: Number(form.overtimeRate),
        cargo:        'Ajudante de Logística',
        status:       'active',
      });
      if (saved) setEmployees(prev => [...prev, saved]);
    } else {
      const patch = { ...form, dailyRate: Number(form.dailyRate), overtimeRate: Number(form.overtimeRate), vtDiario: Number(form.vtDiario ?? 0), vrDiario: Number(form.vrDiario ?? 0) };
      if (!patch.password) delete patch.password;
      const saved = await updateEmployee(modal.id, patch);
      if (saved) setEmployees(prev => prev.map(e => e.id === modal.id ? saved : e));
    }
    setModal(null);
  };

  const getLastWork = (_id) => null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-xl font-bold" style={T}>Funcionários</h1>
          <p className="text-xs mt-0.5" style={TM}>
            {filterRole === 'ajudantes'
              ? `${employees.filter(e => e.status === 'active').length} ativos de ${employees.length} cadastrados`
              : `${lideres.length} líder${lideres.length !== 1 ? 'es' : ''} cadastrado${lideres.length !== 1 ? 's' : ''}`
            }
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filtro Ajudantes / Líderes */}
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.06)' }}>
            {[['ajudantes', Users, 'Ajudantes'], ['lideres', Shield, 'Líderes']].map(([val, Icon, lbl]) => (
              <button key={val} onClick={() => { setFilterRole(val); setSearch(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: filterRole === val ? '#0F172A' : 'transparent',
                  color:      filterRole === val ? 'white'   : '#64748B',
                  border: 'none', cursor: 'pointer',
                }}>
                <Icon size={12} /> {lbl}
              </button>
            ))}
          </div>
          {filterRole === 'ajudantes' && (
            <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
              <Plus size={14} /> Novo Funcionário
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-3 animate-fade-up delay-1">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input className="input-field pl-9" placeholder="Buscar por nome, cidade ou telefone..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F1F5F9', border: '1px solid rgba(0,0,0,0.06)' }}>
          {[['all','Todos'],['active','Ativos'],['inactive','Inativos']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filterStatus === val ? '#FF4D0C' : 'transparent',
                color: filterStatus === val ? 'white' : '#64748B',
              }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Filtro por cidade */}
      {cities.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap animate-fade-up delay-1">
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8' }}>Cidade:</span>
          {cities.map(city => (
            <button key={city}
              onClick={() => setFilterCity(c => c === city ? '' : city)}
              style={{
                padding: '4px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: 600, transition: 'all 0.12s',
                background: filterCity === city ? '#0F172A' : '#F1F5F9',
                color:      filterCity === city ? 'white'   : '#64748B',
              }}>
              {city}
            </button>
          ))}
          {filterCity && (
            <button onClick={() => setFilterCity('')}
              style={{ padding: '4px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: '#FFF1F2', color: '#E11D48' }}>
              ✕ limpar
            </button>
          )}
        </div>
      )}

      {/* ── Tabela de Líderes ── */}
      {filterRole === 'lideres' && (
        <div className="card overflow-hidden animate-fade-up delay-2">
          <div className="px-5 py-3 grid text-xs font-semibold"
            style={{ gridTemplateColumns: '1fr auto auto auto auto', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '16px' }}>
            <span>Líder</span><span>Empresa</span><span>Telefone</span><span>Status</span><span>Ações</span>
          </div>
          {loadingLideres ? (
            <div className="py-10 text-center text-sm" style={{ color: '#94A3B8' }}>Carregando...</div>
          ) : filteredLideres.length === 0 ? (
            <div className="py-14 text-center">
              <Shield size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
              <p className="text-sm" style={TM}>Nenhum líder encontrado</p>
            </div>
          ) : filteredLideres.map(lider => (
            <div key={lider.id} className="table-row" style={{ gridTemplateColumns: '1fr auto auto auto auto', gap: '16px' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="avatar flex-shrink-0" style={{ background: lider.color || '#FF4D0C' }}>{lider.initials}</div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={T}>{lider.name}</p>
                  <p className="text-xs truncate" style={TM}>{lider.email || '—'}</p>
                </div>
              </div>
              <span className="text-xs font-medium" style={T2}>{lider.companyName || '—'}</span>
              <span className="text-xs" style={T2}>{lider.telefone || '—'}</span>
              <button onClick={async () => {
                const newStatus = lider.status === 'active' ? 'inactive' : 'active';
                const ok = await updateLider(lider.id, { status: newStatus });
                if (ok) setLideres(prev => prev.map(l => l.id === lider.id ? { ...l, status: newStatus } : l));
              }} className="flex items-center gap-1.5 text-xs font-medium">
                {lider.status === 'active'
                  ? <><ToggleRight size={20} style={{ color: '#059669' }} /><span style={{ color: '#059669' }}>Ativo</span></>
                  : <><ToggleLeft  size={20} style={{ color: '#94A3B8' }} /><span style={TM}>Inativo</span></>
                }
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => setDeleteConfirmLider(lider.id)} className="p-1.5 rounded-lg"
                  style={{ color: '#94A3B8', background: '#F1F5F9' }}><Trash2 size={13}/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabela de Ajudantes ── */}
      {filterRole === 'ajudantes' && (
      <div className="card overflow-hidden animate-fade-up delay-2">
        <div className="px-5 py-3 grid text-xs font-semibold"
          style={{ gridTemplateColumns: '1fr auto auto auto auto', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '16px' }}>
          <span>Funcionário</span><span>Diária</span><span>Último serviço</span><span>Status</span><span>Ações</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Users size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={TM}>Nenhum funcionário encontrado</p>
          </div>
        ) : (
          filtered.map(emp => {
            const lw = getLastWork(emp.id);
            return (
              <div key={emp.id} className="table-row" style={{ gridTemplateColumns: '1fr auto auto auto auto', gap: '16px' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="avatar flex-shrink-0" style={{ background: emp.color }}>{emp.initials}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={T}>
                      {emp.name}
                      {emp.cidade && (
                        <span style={{ color: '#94A3B8', fontWeight: 400 }}> ({emp.cidade})</span>
                      )}
                    </p>
                    <p className="text-xs truncate" style={TM}>{emp.phone}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#FF4D0C' }}>R$ {emp.dailyRate}</span>
                <div className="text-xs" style={T2}>
                  {lw ? (
                    <><p>{fmtDate(lw.date)}</p><p style={{ ...TM, fontSize: '10px' }}>{lw.company?.split(' ')[0]}</p></>
                  ) : <span style={TM}>—</span>}
                </div>
                <button onClick={async () => {
                  const newStatus = emp.status === 'active' ? 'inactive' : 'active';
                  const saved = await updateEmployee(emp.id, { status: newStatus });
                  if (saved) setEmployees(prev => prev.map(e => e.id === emp.id ? saved : e));
                }}
                  className="flex items-center gap-1.5 text-xs font-medium">
                  {emp.status === 'active'
                    ? <><ToggleRight size={20} style={{ color: '#059669' }} /><span style={{ color: '#059669' }}>Ativo</span></>
                    : <><ToggleLeft  size={20} style={{ color: '#94A3B8' }} /><span style={TM}>Inativo</span></>
                  }
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => setModal(emp)} className="p-1.5 rounded-lg"
                    style={{ color: '#94A3B8', background: '#F1F5F9' }}><Edit2 size={13}/></button>
                  <button onClick={() => setDeleteConfirm(emp.id)} className="p-1.5 rounded-lg"
                    style={{ color: '#94A3B8', background: '#F1F5F9' }}><Trash2 size={13}/></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      )}

      {(modal === 'new' || (modal && modal !== 'new')) && (
        <Modal employee={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box max-w-sm animate-fade-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2" style={T}>Remover funcionário?</h3>
            <p className="text-sm mb-5" style={T2}>Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={async () => { await deleteEmployee(deleteConfirm); setEmployees(prev => prev.filter(e => e.id !== deleteConfirm)); setDeleteConfirm(null); }}
                className="btn-danger flex-1 py-2.5">Remover</button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-ghost flex-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}
      {deleteConfirmLider && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmLider(null)}>
          <div className="modal-box max-w-sm animate-fade-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2" style={T}>Remover líder?</h3>
            <p className="text-sm mb-5" style={T2}>Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={async () => { await deleteLider(deleteConfirmLider); setLideres(prev => prev.filter(l => l.id !== deleteConfirmLider)); setDeleteConfirmLider(null); }}
                className="btn-danger flex-1 py-2.5">Remover</button>
              <button onClick={() => setDeleteConfirmLider(null)} className="btn-ghost flex-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
