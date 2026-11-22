import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fmtDate } from '../../data/mockData';
import { createEmployee, updateEmployee, deleteEmployee, uploadDocumentoFuncionario, documentoAceito, fetchMediasNotas } from '../../lib/db';
import { fmtNota, notaCor, normalizeText, normalizarCidade } from '../../lib/notas';
import { CIDADES_CONHECIDAS, parseCidade } from '../../lib/cidades';
import { coordenadasDoLink } from '../../lib/geocoding';
import { StarsDisplay } from '../../components/shared/StarRating';
import AjudantePerfilModal from '../../components/shared/AjudantePerfilModal';
import SeletorLocalizacao from '../../components/shared/SeletorLocalizacao';
import { Plus, Edit2, Trash2, X, Users, Search, ToggleLeft, ToggleRight, FileText, Upload, Loader2, Eye, MapPin } from 'lucide-react';

const EMPTY = {
  name: '', phone: '', dailyRate: 150, overtimeRate: 50, vtDiario: 0, vrDiario: 0,
  status: 'active', cidade: '', endereco: '', bairro: '', cep: '', localizacao: '',
  latitude: null, longitude: null,
};
const T  = { color: '#0B0B0B' };
const T2 = { color: '#4A4A4A' };
const TM = { color: '#9A9A9A' };

function Modal({ employee, onSave, onClose }) {
  const [form, setForm]           = useState(employee ? { ...employee } : { ...EMPTY, id: crypto.randomUUID() });
  const [uploading, setUploading] = useState(false);
  const [linkMsg, setLinkMsg]     = useState('');

  const isNew = !employee;
  const cidadeNoEndereco = parseCidade(form.endereco);
  const cidadeAtual = normalizarCidade(form.cidade);
  const cidadeDiverge = !!cidadeNoEndereco.city && !!cidadeAtual &&
    normalizeText(cidadeNoEndereco.city) !== normalizeText(cidadeAtual);
  // Com localização (link do Maps ou pino no mapa), rua/número deixam de ser exigidos.
  const temLocalizacao = form.latitude != null && form.longitude != null;

  const extrairDoLink = () => {
    const coords = coordenadasDoLink(form.localizacao);
    if (coords) {
      setForm(f => ({ ...f, latitude: coords.lat, longitude: coords.lng }));
      setLinkMsg('Coordenadas extraídas do link. Confira o pino no mapa.');
    } else {
      setLinkMsg('Não encontrei coordenadas. Abra o link no navegador e copie a URL completa (com "@lat,lng"), ou use o mapa.');
    }
  };

  const handleDocumentoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!documentoAceito(file)) { alert('Selecione um arquivo em PDF ou JPG.'); return; }
    setUploading(true);
    const url = await uploadDocumentoFuncionario(file, form.id);
    setUploading(false);
    if (url) setForm(f => ({ ...f, documentoUrl: url }));
    else alert('Falha ao enviar o documento. Tente novamente.');
  };

  const fieldAjudante = [
    { key: 'name',        label: 'Nome completo',           required: true, col: 2 },
    { key: 'phone',       label: 'Telefone',                required: true, placeholder: '(00) 00000-0000' },
    { key: 'cidade',      label: 'Cidade/UF',               required: isNew, placeholder: 'Ex: Cachoeirinha/RS' },
    { key: 'dailyRate',   label: 'Valor da diária (R$)',     type: 'number', required: true },
    { key: 'overtimeRate',label: 'Hora extra (R$)',          type: 'number', required: true },
    { key: 'vtDiario',    label: 'Vale Transporte/dia (R$)', type: 'number', placeholder: '0,00' },
    { key: 'vrDiario',    label: 'Vale Refeição/dia (R$)',   type: 'number', placeholder: '0,00' },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-box animate-fade-up" style={{ maxWidth: '680px' }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold" style={T}>{isNew ? 'Novo Cadastro' : 'Editar Cadastro'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#9A9A9A', background: '#F5F5F5' }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={e => { e.preventDefault(); onSave({ ...form }); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fieldAjudante.map(({ key, label, required, placeholder, type, col }) => (
              <div key={key} className={col === 2 ? 'col-span-2' : ''}>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>{label}</label>
                <input type={type || 'text'} placeholder={placeholder} required={required}
                  autoComplete="off" list={key === 'cidade' ? 'cidades-farilog' : undefined}
                  value={form[key] ?? ''}
                  onChange={e => setForm({ ...form, [key]: e.target.value })} className="input-field" />
              </div>
            ))}
          </div>
          <p className="text-xs" style={{ color: '#9A9A9A', marginTop: '-2px' }}>
            A cidade/UF é usada para calcular a proximidade nas buscas e nas escalas.
          </p>

          {/* Endereço residencial + localização exata */}
          <div className="rounded-xl" style={{ border: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA', padding: '12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 800, color: '#0B0B0B' }}>Endereço residencial (dados do contrato)</p>
            <p style={{ fontSize: '10px', color: '#6B6B6B', marginTop: '2px', marginBottom: '10px', lineHeight: 1.45 }}>
              Usado para calcular a distância real até a empresa. Quanto mais exato o pino, melhor o ranking das buscas.
              Cidade é obrigatória em novos cadastros; rua/número só é exigida quando não há localização (link do Maps ou pino no mapa). A busca por coordenadas usa OpenStreetMap (Photon); confirme sempre o pino.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>
                  Rua e número{temLocalizacao ? ' (opcional)' : ''}
                </label>
                <input className="input-field" autoComplete="off"
                  placeholder="Ex: Rua Aparício Soares da Cunha, 142"
                  required={isNew && !temLocalizacao}
                  value={form.endereco ?? ''}
                  onChange={e => setForm({ ...form, endereco: e.target.value })}
                  onBlur={() => {
                    if (!String(form.cidade ?? '').trim() && cidadeNoEndereco.city) {
                      setForm(f => ({ ...f, cidade: cidadeNoEndereco.city }));
                    }
                  }} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Bairro</label>
                <input className="input-field" autoComplete="off" placeholder="Ex: Jardim Vitória"
                  value={form.bairro ?? ''}
                  onChange={e => setForm({ ...form, bairro: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>CEP</label>
                <input className="input-field" autoComplete="off" inputMode="numeric" placeholder="00000-000"
                  value={form.cep ?? ''}
                  onChange={e => setForm({ ...form, cep: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Link completo do Google Maps (opcional)</label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input className="input-field" style={{ flex: 1 }} autoComplete="off"
                    placeholder="https://www.google.com/maps/place/... (não use maps.app.goo.gl)"
                    value={form.localizacao ?? ''}
                    onChange={e => { setForm({ ...form, localizacao: e.target.value }); setLinkMsg(''); }} />
                  <button type="button" onClick={extrairDoLink}
                    style={{ flexShrink: 0, padding: '0 12px', borderRadius: '10px', border: '1px solid #E4E4E4', background: '#fff', color: '#0B0B0B', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                    Extrair
                  </button>
                </div>
                {linkMsg && (
                  <p style={{ fontSize: '10.5px', color: '#9E3D22', fontWeight: 600, marginTop: '5px', lineHeight: 1.45 }}>{linkMsg}</p>
                )}
              </div>
            </div>

            {cidadeNoEndereco.city && (
              <p style={{ fontSize: '10.5px', lineHeight: 1.45, marginTop: '8px', fontWeight: 600, color: cidadeDiverge ? '#9E3D22' : '#0B0B0B' }}>
                {cidadeDiverge
                  ? `Atenção: o endereço parece ser de ${cidadeNoEndereco.city}${cidadeNoEndereco.uf ? `/${cidadeNoEndereco.uf}` : ''}, mas a cidade do cadastro é ${cidadeAtual}.`
                  : `Cidade lida do endereço: ${cidadeNoEndereco.city}${cidadeNoEndereco.uf ? `/${cidadeNoEndereco.uf}` : ''}.`}
              </p>
            )}

            <SeletorLocalizacao
              latitude={form.latitude}
              longitude={form.longitude}
              cidade={form.cidade}
              endereco={form.endereco}
              bairro={form.bairro}
              cep={form.cep}
              onChange={(lat, lng) => setForm(f => ({ ...f, latitude: lat, longitude: lng }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Documento (PDF ou JPG)</label>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
              <label
                className="w-full flex items-center gap-2 px-4 py-3 text-xs font-semibold transition-colors"
                style={{ background: '#F7F7F7', color: '#4A4A4A', cursor: 'pointer' }}>
                {uploading
                  ? <><Loader2 size={13} className="animate-spin" /> Enviando...</>
                  : <><Upload size={13} /> {form.documentoUrl ? 'Substituir documento' : 'Selecionar PDF ou JPG'}</>
                }
                <input type="file" accept="application/pdf,image/jpeg,.pdf,.jpg,.jpeg" onChange={handleDocumentoChange} disabled={uploading} style={{ display: 'none' }} />
              </label>
              {form.documentoUrl && (
                <a href={form.documentoUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold"
                  style={{ background: '#FAF4F1', color: '#BC4A2A', borderTop: '1px solid rgba(188,74,42,0.12)' }}>
                  <FileText size={13} /> Ver documento atual
                </a>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Status</label>
            <div className="flex gap-2">
              {['active','inactive'].map(s => (
                <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all"
                  style={{
                    background: form.status === s ? (s === 'active' ? '#F5F5F5' : '#F5F5F5') : '#F7F7F7',
                    borderColor: form.status === s ? (s === 'active' ? '#0B0B0B' : '#4A4A4A') : 'rgba(0,0,0,0.08)',
                    color: form.status === s ? (s === 'active' ? '#0B0B0B' : '#4A4A4A') : '#9A9A9A',
                  }}>
                  {s === 'active' ? 'Ativo' : 'Inativo'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button type="submit" className="btn-primary flex-1">{isNew ? 'Cadastrar Ajudante' : 'Salvar'}</button>
            <button type="button" onClick={onClose} className="btn-ghost px-5">Cancelar</button>
          </div>
        </form>
        <datalist id="cidades-farilog">
          {CIDADES_CONHECIDAS.map(city => <option key={city} value={city} />)}
        </datalist>
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
  const [filterEndereco, setFilterEndereco] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [medias, setMedias]         = useState({});
  const [profileEmp, setProfileEmp] = useState(null);

  useEffect(() => {
    fetchMediasNotas().then(setMedias);
  }, []);

  const cities = useMemo(() =>
    [...new Set(employees.map(e => e.cidade).filter(Boolean))].sort(),
    [employees]
  );

  const filtered = employees.filter(e => {
    const q = normalizeText(search);
    const matchSearch = normalizeText(e.name).includes(q) ||
      (e.phone || '').includes(search) ||
      normalizeText(e.cidade).includes(q);
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    const matchCity   = !filterCity || normalizarCidade(e.cidade) === filterCity;
    const temPino     = e.latitude != null && e.longitude != null;
    const matchEndereco =
      filterEndereco === 'all' ? true :
      filterEndereco === 'sem' ? !e.address :
      temPino;
    return matchSearch && matchStatus && matchCity && matchEndereco;
  });

  const handleSave = async (form) => {
    const colors = ['#0B0B0B','#1C1C1C','#2A2A2A','#333333','#3D3D3D','#4A4A4A','#5A5A5A'];
    const avisoEndereco = (saved) => {
      if (saved && String(form.endereco ?? '').trim() && !saved.address) {
        alert('O endereço não foi salvo porque as colunas de endereço ainda não existem no Supabase. Rode o arquivo supabase/funcionario-endereco.sql no SQL Editor.');
      }
    };

    if (modal === 'new') {
      // ── Criar Ajudante ──
      const initials = form.name.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase();
      const saved = await createEmployee({
        ...form,
        id:           form.id || crypto.randomUUID(),
        initials,
        color:        colors[employees.length % colors.length],
        dailyRate:    Number(form.dailyRate),
        overtimeRate: Number(form.overtimeRate),
        cargo:        'Ajudante de Logística',
        status:       'active',
      });
      if (saved) setEmployees(prev => [...prev, saved]);
      avisoEndereco(saved);
    } else {
      // ── Editar Ajudante ──
      const patch = { ...form, dailyRate: Number(form.dailyRate), overtimeRate: Number(form.overtimeRate), vtDiario: Number(form.vtDiario ?? 0), vrDiario: Number(form.vrDiario ?? 0) };
      const saved = await updateEmployee(modal.id, patch);
      if (saved) setEmployees(prev => prev.map(e => e.id === modal.id ? saved : e));
      avisoEndereco(saved);
    }
    setModal(null);
  };

  const getLastWork = (_id) => null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <p className="text-xs mt-0.5" style={TM}>
            {`${employees.filter(e => e.status === 'active').length} ativos de ${employees.length} cadastrados · ${employees.filter(e => e.latitude != null && e.longitude != null).length} com localização exata`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setModal('new')} className="btn-primary flex items-center gap-2">
            <Plus size={14} /> Novo Cadastro
          </button>
        </div>
      </div>

      <div className="flex gap-3 animate-fade-up delay-1">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9A9A9A' }} />
          <input className="input-field pl-9" placeholder="Buscar por nome, cidade ou telefone..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#F5F5F5', border: '1px solid rgba(0,0,0,0.06)' }}>
          {[['all','Todos'],['active','Ativos'],['inactive','Inativos']].map(([val, lbl]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: filterStatus === val ? '#0B0B0B' : 'transparent',
                color: filterStatus === val ? 'white' : '#6B6B6B',
              }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Cobertura de endereço */}
      <div className="flex items-center gap-2 flex-wrap animate-fade-up delay-1">
        <span style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A' }}>Endereço:</span>
        {[
          ['all',  `Todos (${employees.length})`],
          ['sem',  `Sem endereço (${employees.filter(e => !e.address).length})`],
          ['pino', `Com pino (${employees.filter(e => e.latitude != null && e.longitude != null).length})`],
        ].map(([val, lbl]) => (
          <button key={val} type="button" onClick={() => setFilterEndereco(val)}
            style={{
              padding: '4px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              fontSize: '11px', fontWeight: 600, transition: 'all 0.12s',
              background: filterEndereco === val ? '#0B0B0B' : '#F5F5F5',
              color: filterEndereco === val ? 'white' : '#6B6B6B',
            }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Filtro por cidade */}
      {cities.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap animate-fade-up delay-1">
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A' }}>Cidade:</span>
          {cities.map(city => (
            <button key={city}
              onClick={() => setFilterCity(c => c === city ? '' : city)}
              style={{
                padding: '4px 12px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: 600, transition: 'all 0.12s',
                background: filterCity === city ? '#0B0B0B' : '#F5F5F5',
                color:      filterCity === city ? 'white'   : '#6B6B6B',
              }}>
              {city}
            </button>
          ))}
          {filterCity && (
            <button onClick={() => setFilterCity('')}
              style={{ padding: '4px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: '#F5F5F5', color: '#4A4A4A' }}>
              ✕ limpar
            </button>
          )}
        </div>
      )}

      {/* ── Tabela de Ajudantes ── */}
      <div className="card overflow-hidden animate-fade-up delay-2">
        <div className="px-5 py-3 grid text-xs font-semibold"
          style={{ gridTemplateColumns: '1fr auto auto auto auto auto', color: '#9A9A9A', borderBottom: '1px solid rgba(0,0,0,0.05)', gap: '16px' }}>
          <span>Funcionário</span><span>Nota</span><span>Diária</span><span>Último serviço</span><span>Status</span><span>Ações</span>
        </div>
        {filtered.length === 0 ? (
          <div className="py-14 text-center">
            <Users size={32} className="mx-auto mb-3" style={{ color: '#C8C8C8' }} />
            <p className="text-sm" style={TM}>Nenhum funcionário encontrado</p>
          </div>
        ) : (
          filtered.map(emp => {
            const lw = getLastWork(emp.id);
            const m  = medias[emp.id];
            return (
              <div key={emp.id} className="table-row" style={{ gridTemplateColumns: '1fr auto auto auto auto auto', gap: '16px' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="avatar flex-shrink-0" style={{ background: emp.color }}>{emp.initials}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={T}>
                      {emp.name}
                      {emp.cidade && (
                        <span style={{ color: '#9A9A9A', fontWeight: 400 }}> ({emp.cidade})</span>
                      )}
                      {emp.latitude != null && emp.longitude != null && (
                        <span title="Localização exata cadastrada" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: '3px', color: '#BC4A2A', verticalAlign: 'middle' }}>
                          <MapPin size={9} />
                        </span>
                      )}
                    </p>
                    <p className="text-xs truncate" style={TM}>{emp.phone}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'center', minWidth: '86px' }}>
                  {m?.media != null ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <StarsDisplay value={m.media} size={10} />
                      <span style={{ fontSize: '11px', fontWeight: 800, color: notaCor(m.media) }}>
                        {fmtNota(m.media)} <span style={{ color: '#9A9A9A', fontWeight: 500 }}>({m.total})</span>
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '10px', color: '#C8C8C8' }}>—</span>
                  )}
                </div>
                <span className="text-xs font-semibold" style={{ color: '#BC4A2A' }}>R$ {emp.dailyRate}</span>
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
                    ? <><ToggleRight size={20} style={{ color: '#0B0B0B' }} /><span style={{ color: '#0B0B0B' }}>Ativo</span></>
                    : <><ToggleLeft  size={20} style={{ color: '#9A9A9A' }} /><span style={TM}>Inativo</span></>
                  }
                </button>
                <div className="flex items-center gap-1">
                  <button onClick={() => setProfileEmp(emp)} className="p-1.5 rounded-lg"
                    title="Ver perfil, notas e observações"
                    style={{ color: '#0B0B0B', background: '#F4F4F5' }}><Eye size={13}/></button>
                  <button onClick={() => setModal(emp)} className="p-1.5 rounded-lg"
                    style={{ color: '#9A9A9A', background: '#F5F5F5' }}><Edit2 size={13}/></button>
                  <button onClick={() => setDeleteConfirm(emp.id)} className="p-1.5 rounded-lg"
                    style={{ color: '#9A9A9A', background: '#F5F5F5' }}><Trash2 size={13}/></button>
                </div>
              </div>
            );
          })
        )}
      </div>

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

      {profileEmp && (
        <AjudantePerfilModal employee={profileEmp} onClose={() => setProfileEmp(null)} />
      )}
    </div>
  );
}
