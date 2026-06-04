import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchLideres, createLider, updateLider, deleteLider } from '../../lib/db';
import { Plus, Edit2, Trash2, X, Search, UserCog } from 'lucide-react';

const COLORS = ['#FF4D0C','#7C3AED','#059669','#0891B2','#D97706','#E11D48','#0F172A'];

function initials(name) {
  return name.trim().split(' ').filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('');
}

const EMPTY = { name: '', email: '', phone: '', password: '', companyId: '', color: '#FF4D0C', status: 'active' };

function Modal({ lider, companies, onSave, onClose }) {
  const [form, setForm] = useState(lider ? {
    name: lider.nome || lider.name || '',
    email: lider.email || '',
    phone: lider.telefone || lider.phone || '',
    password: '',
    companyId: lider.empresa_id || lider.companyId || '',
    color: lider.cor || lider.color || '#FF4D0C',
    status: lider.status || 'active',
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
      <div className="modal-box animate-fade-up">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ color: '#0F172A' }}>
            {lider ? 'Editar Líder' : 'Novo Líder'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#94A3B8', background: '#F1F5F9' }}>
            <X size={15} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
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
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Telefone</label>
              <input className="input-field" placeholder="(00) 00000-0000" value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{lider ? 'Nova senha' : 'Senha *'}</label>
              <input type="password" className="input-field" required={!lider} autoComplete="new-password"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Empresa</label>
              <select className="input-field" value={form.companyId}
                onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}>
                <option value="">Sem empresa</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Cor</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: '26px', height: '26px', borderRadius: '8px', background: c, border: form.color === c ? '3px solid #0F172A' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Status</label>
            <div className="flex gap-2">
              {[['active','Ativo'],['inactive','Inativo']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setForm(f => ({ ...f, status: v }))}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background: form.status === v ? (v === 'active' ? '#ECFDF5' : '#FEF2F2') : '#F8FAFC',
                    borderColor: form.status === v ? (v === 'active' ? '#059669' : '#DC2626') : 'rgba(0,0,0,0.08)',
                    color: form.status === v ? (v === 'active' ? '#059669' : '#DC2626') : '#94A3B8',
                  }}>{l}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
            <button type="submit" disabled={saving}
              className="flex-2 py-2.5 rounded-xl text-sm font-bold"
              style={{ flex: 2, background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', borderRadius: '12px', padding: '10px' }}>
              {saving ? 'Salvando...' : lider ? 'Salvar' : 'Criar líder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminLideres() {
  const { companies } = useAuth();
  const [lideres, setLideres]   = useState([]);
  const [search, setSearch]     = useState('');
  const [modal, setModal]       = useState(null);
  const [loading, setLoading]   = useState(true);

  const load = () => fetchLideres().then(l => { setLideres(l); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleSave = async (form) => {
    if (modal === 'new') {
      await createLider(form);
    } else {
      const patch = { ...form };
      if (!patch.password) delete patch.password;
      await updateLider(modal.id, patch);
    }
    setModal(null);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Remover este líder?')) return;
    await deleteLider(id);
    load();
  };

  const filtered = lideres.filter(l =>
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.email?.toLowerCase().includes(search.toLowerCase()) ||
    l.companyName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#0F172A' }}>Líderes de Equipe</h1>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{lideres.length} líder{lideres.length !== 1 ? 'es' : ''} cadastrado{lideres.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold"
          style={{ background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={14} /> Novo líder
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input className="input-field pl-8" placeholder="Buscar por nome, e-mail ou empresa..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm" style={{ color: '#94A3B8' }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center">
          <UserCog size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>Nenhum líder encontrado</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                {['Líder','Empresa','Contato','Status',''].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div className="flex items-center gap-3">
                      <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: l.color || '#FF4D0C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                        {l.initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{l.name}</p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{l.email}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{l.companyName || '—'}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>{l.telefone || l.phone || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: l.status === 'active' ? '#DCFCE7' : '#F1F5F9', color: l.status === 'active' ? '#059669' : '#64748B' }}>
                      {l.status === 'active' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModal(l)} className="p-1.5 rounded-lg" style={{ color: '#64748B', background: '#F1F5F9', border: 'none', cursor: 'pointer' }}><Edit2 size={13} /></button>
                      <button onClick={() => handleDelete(l.id)} className="p-1.5 rounded-lg" style={{ color: '#E11D48', background: '#FFF1F3', border: 'none', cursor: 'pointer' }}><Trash2 size={13} /></button>
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
          lider={modal === 'new' ? null : modal}
          companies={companies}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
