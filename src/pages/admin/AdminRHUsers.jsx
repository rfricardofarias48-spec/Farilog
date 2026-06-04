import { useState, useEffect } from 'react';
import { fetchRHUsers, createRHUser, updateRHUser, deleteRHUser } from '../../lib/db';
import { Plus, Edit2, Trash2, X, Search, Users } from 'lucide-react';

function initials(name) {
  return name.trim().split(' ').filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('');
}

const EMPTY = { name: '', email: '', password: '' };

function Modal({ user, onSave, onClose }) {
  const [form, setForm] = useState(user ? {
    name: user.nome || user.name || '',
    email: user.email || '',
    password: '',
  } : { ...EMPTY });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await onSave({ ...form, initials: initials(form.name) });
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '420px' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ color: '#0F172A' }}>
            {user ? 'Editar Usuário RH' : 'Novo Usuário RH'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#94A3B8', background: '#F1F5F9' }}>
            <X size={15} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Nome completo *</label>
            <input className="input-field" required value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>E-mail *</label>
            <input type="email" className="input-field" required value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{user ? 'Nova senha' : 'Senha *'}</label>
            <input type="password" className="input-field" required={!user} autoComplete="new-password"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', borderRadius: '12px', padding: '10px', fontSize: '13px', fontWeight: 700 }}>
              {saving ? 'Salvando...' : user ? 'Salvar' : 'Criar usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminRHUsers() {
  const [users, setUsers]     = useState([]);
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => fetchRHUsers().then(u => { setUsers(u); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (modal === 'new') {
      await createRHUser(form);
    } else {
      const patch = { ...form };
      if (!patch.password) delete patch.password;
      await updateRHUser(modal.id, patch);
    }
    setModal(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este usuário de RH?')) return;
    await deleteRHUser(id);
    load();
  };

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#0F172A' }}>Usuários de RH</h1>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{users.length} usuário{users.length !== 1 ? 's' : ''} cadastrado{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold"
          style={{ background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> Novo usuário
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input className="input-field pl-8" placeholder="Buscar por nome ou e-mail..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm" style={{ color: '#94A3B8' }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center">
          <Users size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>Nenhum usuário encontrado</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['Usuário','E-mail',''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div className="flex items-center gap-3">
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {u.initials || u.iniciais}
                      </div>
                      <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{u.name}</p>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{u.email}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModal(u)} className="p-1.5 rounded-lg" style={{ color: '#64748B', background: '#F1F5F9', border: 'none', cursor: 'pointer' }}><Edit2 size={13} /></button>
                      <button onClick={() => handleDelete(u.id)} className="p-1.5 rounded-lg" style={{ color: '#E11D48', background: '#FFF1F3', border: 'none', cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <Modal
          user={modal === 'new' ? null : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
