import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fmtCurrency } from '../../data/mockData';
import { createCompany, updateCompany, deleteCompany } from '../../lib/db';
import { parseEmpresaLocalizacao } from '../../lib/cidades';
import { MODOS_FECHAMENTO, normalizarDias, rotuloFechamento } from '../../lib/fechamento';
import SeletorLocalizacao from '../../components/shared/SeletorLocalizacao';
import { Plus, Edit2, Trash2, X, Building2, Search, Phone, Mail, MapPin } from 'lucide-react';
const EMPTY = { name: '', cnpj: '', email: '', password: '', phone: '', contact: '', address: '', location: '', latitude: null, longitude: null, dailyRate: 150, valorDescarga: 0, prazoPagamento: 5, prazoFolha: 7, folhaModo: 'quinzena', closingCycle: 'diaria', closingDays: [] };
const T  = { color: '#0B0B0B' };
const T2 = { color: '#4A4A4A' };
const TM = { color: '#9A9A9A' };

function Modal({ company, onSave, onClose }) {
  const [form, setForm] = useState(company ? { ...company } : { ...EMPTY });
  const [diasTexto, setDiasTexto] = useState(() => (company?.closingDays || []).join(', '));

  const rate    = Number(form.dailyRate) || 0;
  const he50    = (rate / 8 * 1.5).toFixed(2);
  const he100   = (rate / 8 * 2).toFixed(2);
  const local   = parseEmpresaLocalizacao({ endereco: form.address, localizacao: form.location });

  const field = (key, label, opts = {}) => (
    <div key={key} className={opts.col === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>{label}</label>
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
      <div className="modal-box animate-fade-up" style={{ maxWidth: '1040px' }}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold" style={T}>{company ? 'Editar Empresa' : 'Nova Empresa'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: '#9A9A9A', background: '#F5F5F5' }}>
            <X size={15} />
          </button>
        </div>
        <form onSubmit={e => {
            e.preventDefault();
            const dias = normalizarDias(diasTexto);
            if (form.closingCycle === 'datas' && dias.length === 0) {
              alert('Informe pelo menos um dia de fechamento.');
              return;
            }
            onSave({
              ...form,
              dailyRate: Number(form.dailyRate),
              valorDescarga: Number(form.valorDescarga ?? 0),
              prazoPagamento: Math.max(0, Number(form.prazoPagamento) || 0),
              prazoFolha: Math.max(0, Number(form.prazoFolha ?? 7) || 0),
              folhaModo: form.folhaModo === 'semanal' ? 'semanal' : 'quinzena',
              closingCycle: form.closingCycle === 'datas' ? 'datas' : 'diaria',
              closingDays: dias,
            });
          }} className="space-y-3" autoComplete="off">
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
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Diária (R$)</label>
              <input type="number" required value={form.dailyRate ?? 150}
                onChange={e => setForm({ ...form, dailyRate: e.target.value })} className="input-field" />
            </div>
{/* Linha 4b: Fechamento | Prazo de Pagamento */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Fechamento</label>
              <select className="input-field" value={form.closingCycle === 'datas' ? 'datas' : 'diaria'}
                onChange={e => setForm({ ...form, closingCycle: e.target.value })}>
                {MODOS_FECHAMENTO.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Prazo de Pagamento (dias após o fechamento)</label>
              <input type="number" min="0" step="1" required value={form.prazoPagamento ?? 5}
                onChange={e => setForm({ ...form, prazoPagamento: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Pagamento dos ajudantes</label>
              <select className="input-field" value={form.folhaModo === 'semanal' ? 'semanal' : 'quinzena'}
                onChange={e => setForm({ ...form, folhaModo: e.target.value })}>
                <option value="quinzena">Quinzenal — dias após o fim da quinzena</option>
                <option value="semanal">Semanal — até sexta, paga na quarta seguinte</option>
              </select>
            </div>
            {form.folhaModo !== 'semanal' ? (
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Dias após o fim da quinzena</label>
                <input type="number" min="0" step="1" required value={form.prazoFolha ?? 7}
                  onChange={e => setForm({ ...form, prazoFolha: e.target.value })} className="input-field" />
                <p className="text-xs mt-1" style={{ color: '#9A9A9A' }}>
                  Usado para lançar automaticamente a Folha/VT/VR em Contas a Pagar.
                </p>
              </div>
            ) : (
              <div className="col-span-2">
                <p className="text-xs" style={{ color: '#9A9A9A' }}>
                  As diárias feitas até sexta-feira são pagas na quarta-feira da semana seguinte.
                  Esse prazo é independente do recebimento do cliente.
                </p>
              </div>
            )}

            {form.closingCycle === 'datas' && (
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Dias de fechamento</label>
                <input className="input-field" placeholder="Ex: 10, 20, 31" value={diasTexto}
                  onChange={e => setDiasTexto(e.target.value)} />
                <p className="text-xs mt-1" style={{ color: '#9A9A9A' }}>
                  Separe por vírgula. O período termina em cada data de fechamento; o dia 31 vale como
                  último dia nos meses menores. Ex.: 10, 20 e 31 → períodos 01–10, 11–20 e 21–fim.
                </p>
              </div>
            )}

            <div className="col-span-2" style={{ marginTop: '-4px' }}>
              <p className="text-xs" style={{ color: '#9A9A9A' }}>
                As diárias do período entram num único lançamento a receber, com vencimento =
                data de fechamento + prazo. No modo diária, cada dia é um fechamento.
              </p>
            </div>
            {/* Linha 5: Valor Descarga (full) */}
            <div className="col-span-2">
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Valor por Descarga (R$)</label>
              <input type="number" min="0" step="0.01" value={form.valorDescarga ?? 0}
                onChange={e => setForm({ ...form, valorDescarga: e.target.value })} className="input-field"
                placeholder="0.00" />
              <p className="text-xs mt-1" style={{ color: '#9A9A9A' }}>Valor cobrado por carreta descarregada. Usado no cálculo de serviços de carga e descarga.</p>
            </div>
            {/* Linha 5: Endereço (full) */}
            {field('address',  'Endereço completo (inclua a cidade)', { col: 2, placeholder: 'Rua, nº - Bairro, Cidade - UF, CEP' })}
            {field('location', 'Link de localização (Google Maps)', { col: 2, placeholder: 'https://maps.google.com/...' })}
            <div className="col-span-2" style={{ marginTop: '-3px' }}>
              {local.city ? (
                <p style={{ fontSize: '11px', lineHeight: 1.5, fontWeight: 600, color: '#0B0B0B' }}>
                  📍 Cidade detectada: <b>{local.city}{local.uf ? `/${local.uf}` : ''}</b>
                  {' '}— usada nas buscas por proximidade e nas escalas.
                </p>
              ) : (
                <p style={{ fontSize: '11px', lineHeight: 1.5, fontWeight: 600, color: '#9E3D22' }}>
                  ⚠️ Não consegui identificar a cidade. Inclua “Cidade - UF” no endereço
                  (ex.: Cachoeirinha - RS). Links curtos do Google Maps não informam a cidade.
                </p>
              )}
            </div>
            <div className="col-span-2">
              <SeletorLocalizacao
                latitude={form.latitude}
                longitude={form.longitude}
                cidade={local.city}
                endereco={form.address}
                bairro=""
                cep=""
                onChange={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
              />
            </div>
            {/* Linha 6: HE calculadas (full) */}
            <div className="col-span-2 flex gap-3">
              <div className="flex-1 rounded-xl px-4 py-2.5" style={{ background: '#FAF4F1', border: '1px solid rgba(188,74,42,0.15)' }}>
                <p className="text-xs font-semibold" style={{ color: '#9A9A9A', marginBottom: '2px' }}>Hora extra 50%</p>
                <p className="text-sm font-bold" style={{ color: '#BC4A2A' }}>R$ {he50}/h</p>
              </div>
              <div className="flex-1 rounded-xl px-4 py-2.5" style={{ background: '#F5F5F5', border: '1px solid rgba(74, 74, 74,0.15)' }}>
                <p className="text-xs font-semibold" style={{ color: '#9A9A9A', marginBottom: '2px' }}>Hora extra 100%</p>
                <p className="text-sm font-bold" style={{ color: '#4A4A4A' }}>R$ {he100}/h</p>
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
    (c.contact || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.city || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.address || '').toLowerCase().includes(search.toLowerCase())
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
          <p className="text-xs mt-0.5" style={TM}>{companies.length} empresas cadastradas</p>
        </div>
        <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Nova Empresa
        </button>
      </div>

      <div className="relative animate-fade-up delay-1">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9A9A9A' }} />
        <input className="input-field pl-9" placeholder="Buscar por nome, CNPJ ou responsável..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden animate-fade-up delay-2">
        <div className="px-5 py-3 grid text-xs font-semibold"
          style={{ gridTemplateColumns: '1fr auto auto auto auto auto', color: '#9A9A9A', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '16px' }}>
          <span>Empresa</span><span>Diária</span><span>Val. Descarga</span><span>HE 50%</span><span>Prazo</span><span>Ações</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Building2 size={32} className="mx-auto mb-3" style={{ color: '#C8C8C8' }} />
            <p className="text-sm" style={TM}>Nenhuma empresa encontrada</p>
          </div>
        ) : (
          filtered.map(c => {
            const stats = getStats(c.id);
            return (
              <div key={c.id} className="table-row" style={{ gridTemplateColumns: '1fr auto auto auto auto auto', gap: '16px' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="avatar flex-shrink-0"
                    style={{ background: '#0B0B0B', width: '36px', height: '36px', borderRadius: '10px', fontSize: '11px' }}>
                    {c.name.slice(0,2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={T}>{c.name}</p>
                    <div className="flex gap-3 mt-0.5 flex-wrap">
                      {c.city && <span className="flex items-center gap-1 text-xs" style={TM}><MapPin size={9}/>{c.city}</span>}
                      <span className="flex items-center gap-1 text-xs" style={TM}><Phone size={9}/>{c.phone}</span>
                      <span className="flex items-center gap-1 text-xs" style={TM}><Mail size={9}/>{c.email}</span>
                      <span className="text-xs" style={{ ...TM, fontWeight: 600 }}>Fechamento: {rotuloFechamento(c.closingCycle, c.closingDays)}</span>
                    </div>
                  </div>
                </div>
                <span className="text-xs font-semibold" style={{ color: '#BC4A2A' }}>R$ {c.dailyRate ?? 150}</span>
                <span className="text-xs font-semibold" style={{ color: '#0B0B0B' }}>R$ {Number(c.valorDescarga ?? 0).toFixed(2)}</span>
                <span className="text-xs font-semibold" style={{ color: '#4A4A4A' }}>
                  R$ {((Number(c.dailyRate ?? 150) / 8) * 1.5).toFixed(2)}/h
                </span>
                <span className="text-xs font-semibold" style={{ color: '#0B0B0B' }}>
                  {Number(c.prazoPagamento ?? 5)} {Number(c.prazoPagamento ?? 5) === 1 ? 'dia' : 'dias'}
                </span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setModal(c)} className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#9A9A9A', background: '#F5F5F5' }}><Edit2 size={13}/></button>
                  <button onClick={() => setDeleteConfirm(c.id)} className="p-1.5 rounded-lg transition-colors"
                    style={{ color: '#9A9A9A', background: '#F5F5F5' }}><Trash2 size={13}/></button>
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
