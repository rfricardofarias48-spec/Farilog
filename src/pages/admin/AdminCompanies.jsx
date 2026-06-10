import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fmtCurrency } from '../../data/mockData';
import { createCompany, updateCompany, deleteCompany } from '../../lib/db';
import { Plus, Edit2, Trash2, X, Building2, Search, Phone, Mail } from 'lucide-react';
const EMPTY = { name: '', cnpj: '', email: '', password: '', phone: '', contact: '', address: '', location: '', dailyRate: 150, valorDescarga: 0 };
const T  = { color: '#0F172A' };
const T2 = { color: '#475569' };
const TM = { color: '#94A3B8' };

function Modal({ company, onSave, onClose }) {
  const [form, setForm] = useState(company ? { ...company } : { ...EMPTY });

  const rate    = Number(form.dailyRate) || 0;
  const he50    = (rate / 8 * 1.5).toFixed(2);
  const he100   = (rate / 8 * 2).toFixed(2);

  const field = (key, label, opts = {}) => (
    <div key={key} className={opts.col === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>{label}</label>
      <input
        type={opts.type || 'text'}
        placeholder={opts.placeholder}
        required={opts.required}
        autoComplete="off"
        value={form[key] ?? ''}
        onChange={e => setForm({ ...form, [key]: e.target.value })}
        className="input-field"
      />
    </div>
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold" style={T}>{company ? 'Editar Empresa' : 'Nova Empresa'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#94A3B8', background: '#F1F5F9' }}>
            <X size={15} />
          </button>
        </div>
        <form onSubmit={e => { e.preventDefault(); onSave({ ...form, dailyRate: Number(form.dailyRate), valorDescarga: Number(form.valorDescarga ?? 0) }); }} className="space-y-3" autoComplete="off">
          <div className="grid grid-cols-2 gap-3">
            {/* Linha 1: nome (full) */}
            {field('name',     'Razão Social',     { required: true, col: 2 })}
            {/* Linha 2: CNPJ | Responsável */}
            {field('cnpj',    'CNPJ',             { required: true, placeholder: '00.000.000/0001-00' })}
            {field('contact', 'Responsável',       { required: true })}
            {/* Linha 3: Telefone | E-mail */}
            {field('phone',   'Telefone',          { placeholder: '(00) 00000-0000' })}
            {field('email',   'E-mail de acesso',  { required: true, type: 'email' })}
            {/* Linha 4: Senha | Diária */}
            {field('password', company ? 'Nova senha (opcional)' : 'Senha de acesso', { type: 'password' })}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Diária (R$)</label>
              <input type="number" required value={form.dailyRate ?? 150}
                onChange={e => setForm({ ...form, dailyRate: e.target.value })} className="input-field" />
            </div>
            {/* Linha 5: Valor Descarga (full) */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Valor por Descarga (R$)</label>
              <input type="number" min="0" step="0.01" value={form.valorDescarga ?? 0}
                onChange={e => setForm({ ...form, valorDescarga: e.target.value })} className="input-field"
                placeholder="0.00" />
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Valor cobrado por carreta descarregada. Usado no cálculo de serviços de carga e descarga.</p>
            </div>
            {/* Linha 5: Endereço (full) */}
            {field('address',  'Endereço completo', { col: 2 })}
            {field('location', 'Link de localização (Google Maps)', { col: 2, placeholder: 'https://maps.google.com/...' })}
            {/* Linha 6: HE calculadas (full) */}
            <div className="col-span-2 flex gap-3">
              <div className="flex-1 rounded-xl px-4 py-2.5" style={{ background: '#FFF2EE', border: '1px solid rgba(255,77,12,0.15)' }}>
                <p className="text-xs font-semibold" style={{ color: '#94A3B8', marginBottom: '2px' }}>Hora extra 50%</p>
                <p className="text-sm font-bold" style={{ color: '#FF4D0C' }}>R$ {he50}/h</p>
              </div>
              <div className="flex-1 rounded-xl px-4 py-2.5" style={{ background: '#F5F3FF', border: '1px solid rgba(124,58,237,0.15)' }}>
                <p className="text-xs font-semibold" style={{ color: '#94A3B8', marginBottom: '2px' }}>Hora extra 100%</p>
                <p className="text-sm font-bold" style={{ color: '#7C3AED' }}>R$ {he100}/h</p>
              </div>
            </div>
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
    (c.cnpj || '').includes(search) ||
    (c.contact || '').toLowerCase().includes(search.toLowerCase())
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
          style={{ gridTemplateColumns: '1fr auto auto auto', color: '#94A3B8', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '16px' }}>
          <span>Empresa</span><span>Diária</span><span>Val. Descarga</span><span>HE 50%</span><span>Ações</span>
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
                <span className="text-xs font-semibold" style={{ color: '#FF4D0C' }}>R$ {c.dailyRate ?? 150}</span>
                <span className="text-xs font-semibold" style={{ color: '#059669' }}>R$ {Number(c.valorDescarga ?? 0).toFixed(2)}</span>
                <span className="text-xs font-semibold" style={{ color: '#7C3AED' }}>
                  R$ {((Number(c.dailyRate ?? 150) / 8) * 1.5).toFixed(2)}/h
                </span>
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
