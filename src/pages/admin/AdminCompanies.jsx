import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fmtCurrency } from '../../data/mockData';
import { createCompany, updateCompany, deleteCompany } from '../../lib/db';
import { Plus, Edit2, Trash2, X, Building2, Search, Phone, Mail } from 'lucide-react';
const EMPTY = { name: '', cnpj: '', email: '', password: '', phone: '', contact: '', address: '', sector: '' };
const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

function Modal({ company, onSave, onClose }) {
  const [form, setForm] = useState(company ? { ...company } : { ...EMPTY });

  const fields = [
    { key: 'name',     label: 'Razão Social',                required: true, col: 2 },
    { key: 'cnpj',     label: 'CNPJ',                        required: true, placeholder: '00.000.000/0001-00' },
    { key: 'contact',  label: 'Responsável',                  required: true },
    { key: 'sector',   label: 'Setor' },
    { key: 'phone',    label: 'Telefone',                     placeholder: '(00) 00000-0000' },
    { key: 'email',    label: 'E-mail de acesso',             required: true, type: 'email', col: 2 },
    { key: 'password', label: company ? 'Nova senha (opcional)' : 'Senha de acesso', type: 'password' },
    { key: 'address',  label: 'Endereço completo',            col: 2 },
  ];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold" style={T}>{company ? 'Editar Empresa' : 'Nova Empresa'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#94A3B8', background: '#F1F5F9' }}>
            <X size={15} />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.map(({ key, label, required, placeholder, type, col }) => (
              <div key={key} className={col === 2 ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
                <input type={type || 'text'} placeholder={placeholder} required={required}
                  value={form[key] || ''} onChange={e => setForm({ ...form, [key]: e.target.value })} className="input-field" />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button type="submit" className="btn-primary flex-1">{company ? 'Salvar' : 'Cadastrar empresa'}</button>
            <button type="button" onClick={onClose} className="btn-ghost px-5">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminCompanies() {
  const { companies, setCompanies } = useAuth();
  const [modal, setModal]           = useState(null);
  const [search, setSearch]         = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const filtered = companies.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.cnpj.includes(search) ||
    c.contact.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async (form) => {
    if (modal === 'new') {
      const saved = await createCompany({ ...form, id: crypto.randomUUID() });
      if (saved) setCompanies(prev => [...prev, saved]);
    } else {
      const patch = { ...form };
      if (!patch.password) delete patch.password;
      const saved = await updateCompany(modal.id, patch);
      if (saved) setCompanies(prev => prev.map(c => c.id === modal.id ? saved : c));
    }
    setModal(null);
  };

  const getStats = (_id) => ({ paid: 0, active: 0 });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-xl font-bold" style={T}>Empresas</h1>
          <p className="text-xs mt-0.5" style={TM}>{companies.length} empresas cadastradas</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Nova Empresa
        </button>
      </div>

      <div className="relative animate-fade-up delay-1">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input className="input-field pl-9" placeholder="Buscar por nome, CNPJ ou responsável..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden animate-fade-up delay-2">
        <div className="px-5 py-3 grid text-xs font-semibold"
          style={{ gridTemplateColumns: '1fr auto auto auto auto', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '16px' }}>
          <span>Empresa</span><span>Setor</span><span>Hoje</span><span>Faturado</span><span>Ações</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Building2 size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={TM}>Nenhuma empresa encontrada</p>
          </div>
        ) : (
          filtered.map(c => {
            const stats = getStats(c.id);
            return (
              <div key={c.id} className="table-row" style={{ gridTemplateColumns: '1fr auto auto auto auto', gap: '16px' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="avatar flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#FF4D0C,#E03A00)', width: '36px', height: '36px', borderRadius: '10px', fontSize: '11px' }}>
                    {c.name.slice(0,2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={T}>{c.name}</p>
                    <div className="flex gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs" style={TM}><Phone size={9}/>{c.phone}</span>
                      <span className="flex items-center gap-1 text-xs" style={TM}><Mail size={9}/>{c.email}</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ background: '#F1F5F9', color: '#475569' }}>{c.sector}</span>
                <span className="text-xs font-semibold" style={{ color: stats.active > 0 ? '#059669' : '#94A3B8' }}>
                  {stats.active} ativo{stats.active !== 1 ? 's' : ''}
                </span>
                <span className="text-xs font-semibold" style={{ color: '#FF4D0C' }}>{fmtCurrency(stats.paid)}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setModal(c)} className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#94A3B8', background: '#F1F5F9' }}><Edit2 size={13}/></button>
                  <button onClick={() => setDeleteConfirm(c.id)} className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#94A3B8', background: '#F1F5F9' }}><Trash2 size={13}/></button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(modal === 'new' || (modal && modal !== 'new')) && (
        <Modal company={modal === 'new' ? null : modal} onSave={handleSave} onClose={() => setModal(null)} />
      )}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-box max-w-sm animate-fade-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2" style={T}>Remover empresa?</h3>
            <p className="text-sm mb-5" style={T2}>Esta ação não pode ser desfeita.</p>
            <div className="flex gap-2">
              <button onClick={async () => { await deleteCompany(deleteConfirm); setCompanies(prev => prev.filter(c => c.id !== deleteConfirm)); setDeleteConfirm(null); }}
                className="btn-danger flex-1 py-2.5">Remover</button>
              <button onClick={() => setDeleteConfirm(null)} className="btn-ghost flex-1">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
