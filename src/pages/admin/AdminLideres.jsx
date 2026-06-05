import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchLideres, createLider, updateLider, deleteLider,
  fetchLiderEmpresasIds, upsertLiderEmpresas,
} from '../../lib/db';
import {
  Plus, Edit2, Trash2, X, Search, UserCog,
  Building2, CheckCircle2, Eye, EyeOff, KeyRound,
} from 'lucide-react';

const COLORS = ['#FF4D0C','#7C3AED','#059669','#0891B2','#D97706','#E11D48','#0F172A'];

function initials(name) {
  return name.trim().split(' ').filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('');
}

function Modal({ lider, companies, onSave, onClose }) {
  const isEdit = !!lider;

  const [form, setForm] = useState({
    name:     lider?.nome     || lider?.name  || '',
    email:    lider?.email    || '',
    phone:    lider?.telefone || lider?.phone || '',
    color:    lider?.cor      || lider?.color || '#FF4D0C',
    status:   lider?.status   || 'active',
  });

  // Senha — tratada separadamente para evitar sobrescrever por acidente
  const [newPassword, setNewPassword]     = useState('');
  const [confirmPass, setConfirmPass]     = useState('');
  const [showPass, setShowPass]           = useState(false);
  const [passError, setPassError]         = useState('');

  // Empresas vinculadas
  const [selectedCompanies, setSelectedCompanies] = useState(lider?.companyIds || []);
  const [loadingCo, setLoadingCo]                 = useState(isEdit);
  const [saving, setSaving]                       = useState(false);

  // Carrega empresas atuais do líder ao editar
  useEffect(() => {
    if (isEdit && lider?.id) {
      fetchLiderEmpresasIds(lider.id).then(ids => {
        setSelectedCompanies(ids);
        setLoadingCo(false);
      });
    }
  }, []);

  const toggleCompany = (id) =>
    setSelectedCompanies(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Valida empresas
    if (selectedCompanies.length === 0) {
      alert('Selecione ao menos uma empresa para este líder.');
      return;
    }

    // Valida senha (se fornecida)
    if (newPassword || confirmPass) {
      if (newPassword !== confirmPass) {
        setPassError('As senhas não coincidem.');
        return;
      }
      if (newPassword.length < 4) {
        setPassError('A senha deve ter ao menos 4 caracteres.');
        return;
      }
    }
    if (!isEdit && !newPassword) {
      setPassError('A senha é obrigatória para novos líderes.');
      return;
    }

    setPassError('');
    setSaving(true);
    await onSave(
      { ...form, initials: initials(form.name), password: newPassword || undefined },
      selectedCompanies
    );
    setSaving(false);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box animate-fade-up" style={{ maxWidth: '520px' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={{ color: '#0F172A' }}>
            {isEdit ? 'Editar Líder' : 'Novo Líder'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#94A3B8', background: '#F1F5F9', border: 'none', cursor: 'pointer' }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dados básicos */}
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
          </div>

          {/* Senha */}
          <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '14px', border: '1px solid rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <KeyRound size={13} style={{ color: '#64748B' }} />
              <p className="text-xs font-semibold" style={{ color: '#64748B' }}>
                {isEdit ? 'Alterar senha (deixe em branco para manter)' : 'Definir senha *'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>
                  {isEdit ? 'Nova senha' : 'Senha *'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input-field"
                    placeholder={isEdit ? '••••••' : 'mínimo 4 caracteres'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setPassError(''); }}
                    style={{ paddingRight: '36px' }}
                  />
                  <button type="button" onClick={() => setShowPass(s => !s)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Confirmar senha</label>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field"
                  placeholder="repita a senha"
                  autoComplete="new-password"
                  value={confirmPass}
                  onChange={e => { setConfirmPass(e.target.value); setPassError(''); }}
                />
              </div>
            </div>
            {passError && (
              <p style={{ fontSize: '11px', color: '#E11D48', fontWeight: 600, marginTop: '8px' }}>{passError}</p>
            )}
            {!passError && newPassword && confirmPass && newPassword === confirmPass && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '8px' }}>
                <CheckCircle2 size={12} style={{ color: '#059669' }} />
                <p style={{ fontSize: '11px', color: '#059669', fontWeight: 600 }}>Senhas coincidem</p>
              </div>
            )}
          </div>

          {/* Empresas (multi-select) */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label className="text-xs font-semibold" style={{ color: '#64748B' }}>
                Empresas clientes *
              </label>
              {selectedCompanies.length > 0 && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#FF4D0C' }}>
                  {selectedCompanies.length} selecionada{selectedCompanies.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            {loadingCo ? (
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>Carregando empresas...</p>
            ) : companies.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhuma empresa cadastrada</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '200px', overflowY: 'auto', padding: '2px' }}>
                {companies.map(c => {
                  const sel = selectedCompanies.includes(c.id);
                  return (
                    <button key={c.id} type="button" onClick={() => toggleCompany(c.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 12px', borderRadius: '10px',
                        border: `2px solid ${sel ? '#FF4D0C' : 'rgba(0,0,0,0.08)'}`,
                        background: sel ? '#FFF5F2' : 'white', cursor: 'pointer', textAlign: 'left',
                      }}>
                      <Building2 size={14} style={{ color: sel ? '#FF4D0C' : '#94A3B8', flexShrink: 0 }} />
                      <p style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: sel ? '#FF4D0C' : '#0F172A' }}>{c.name}</p>
                      {sel && <CheckCircle2 size={14} style={{ color: '#FF4D0C', flexShrink: 0 }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cor */}
          <div>
            <label className="block text-xs font-semibold mb-2" style={{ color: '#64748B' }}>Cor do avatar</label>
            <div className="flex gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  style={{ width: '28px', height: '28px', borderRadius: '8px', background: c, border: form.color === c ? '3px solid #0F172A' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
              {/* Preview do avatar */}
              <div style={{ marginLeft: '8px', width: '28px', height: '28px', borderRadius: '8px', background: form.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white' }}>
                {initials(form.name) || '?'}
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#64748B' }}>Status</label>
            <div className="flex gap-2">
              {[['active','Ativo'],['inactive','Inativo']].map(([v, l]) => (
                <button key={v} type="button" onClick={() => setForm(f => ({ ...f, status: v }))}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background:   form.status === v ? (v === 'active' ? '#ECFDF5' : '#FEF2F2') : '#F8FAFC',
                    borderColor:  form.status === v ? (v === 'active' ? '#059669' : '#DC2626') : 'rgba(0,0,0,0.08)',
                    color:        form.status === v ? (v === 'active' ? '#059669' : '#DC2626') : '#94A3B8',
                  }}>{l}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '11px', borderRadius: '12px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving || loadingCo}
              style={{ flex: 2, background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white', border: 'none', cursor: saving || loadingCo ? 'not-allowed' : 'pointer', borderRadius: '12px', padding: '11px', fontSize: '13px', fontWeight: 700 }}>
              {saving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar líder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminLideres() {
  const { companies } = useAuth();
  const [lideres, setLideres] = useState([]);
  const [search, setSearch]   = useState('');
  const [modal, setModal]     = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => fetchLideres().then(l => { setLideres(l); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleSave = async (form, companyIds) => {
    let liderId;

    if (modal === 'new') {
      const created = await createLider({
        name:      form.name,
        email:     form.email,
        phone:     form.phone,
        password:  form.password,
        initials:  form.initials,
        color:     form.color,
        status:    form.status,
        companyId: companyIds[0] || null,
      });

      if (!created) {
        alert('Erro ao criar líder. Verifique se o e-mail já está cadastrado e tente novamente.');
        return; // Mantém o modal aberto
      }

      liderId = created.id;
    } else {
      const patch = {
        name:     form.name,
        email:    form.email,
        phone:    form.phone,
        initials: form.initials,
        color:    form.color,
        status:   form.status,
      };
      if (form.password) patch.password = form.password;

      const ok = await updateLider(modal.id, patch);
      if (!ok) {
        alert('Erro ao salvar alterações. Verifique os dados e tente novamente.');
        return;
      }
      liderId = modal.id;
    }

    if (liderId && companyIds.length > 0) {
      await upsertLiderEmpresas(liderId, companyIds);
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
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            {lideres.length} líder{lideres.length !== 1 ? 'es' : ''} cadastrado{lideres.length !== 1 ? 's' : ''}
          </p>
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
                {['Líder','Empresas','Contato','Status',''].map(h => (
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
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {l.companyIds?.length > 0
                        ? l.companyIds.map(cid => {
                            const co = companies.find(c => c.id === cid);
                            return co ? (
                              <span key={cid} style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: '#F1F5F9', color: '#475569' }}>
                                {co.name}
                              </span>
                            ) : null;
                          })
                        : <span style={{ fontSize: '13px', color: '#94A3B8' }}>—</span>
                      }
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#475569' }}>
                    {l.telefone || l.phone || '—'}
                  </td>
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
