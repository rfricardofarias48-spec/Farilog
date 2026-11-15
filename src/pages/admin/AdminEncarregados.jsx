import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fmtCurrency, fmtDate } from '../../data/mockData';
import { avatarTone, whatsappLink } from '../../lib/notas';
import {
  fetchLideres, createEncarregado, updateLider,
  fetchLiderDesempenho, fetchLiderVinculos, fetchResponsaveisAtivos, fetchLiderAtividade,
} from '../../lib/db';
import {
  UserPlus, ArrowLeft, MessageCircle, Lock, X, Users, Check,
  Briefcase, UserX, AlertTriangle, CheckCircle2, DollarSign, Plus, Loader2,
} from 'lucide-react';

const T  = { color: '#0B0B0B' };
const T2 = { color: '#4A4A4A' };
const TM = { color: '#9A9A9A' };
const ACCENT = '#FF4D0C';
const COLORS = ['#0B0B0B', '#1C1C1C', '#2A2A2A', '#333333', '#3D3D3D', '#4A4A4A', '#5A5A5A'];

const iniciaisDe = nome => (nome || '?').split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();

// ── Modal: criar conta (senha definida direto, sem e-mail) ──────────────────
function ModalNovaConta({ companies, onSave, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [empresaIds, setEmpresaIds] = useState([]);
  const [saving, setSaving] = useState(false);

  const toggle = id => setEmpresaIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="modal-overlay">
      <div className="modal-box animate-fade-up" style={{ maxWidth: '620px' }}>
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <span style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', ...T }}>
              <UserPlus size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold" style={T}>Criar conta de encarregado</h2>
              <p className="text-xs mt-0.5" style={TM}>Defina e-mail e senha diretamente — sem envio de confirmação por e-mail.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#9A9A9A', background: '#F5F5F5' }}><X size={15} /></button>
        </div>

        <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave({ ...form, empresaIds }); setSaving(false); }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Nome completo</label>
            <input className="input-field" required autoComplete="off" value={form.name} placeholder="Ex.: Paulo Andrade"
              onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>E-mail de acesso</label>
              <input className="input-field" type="email" required autoComplete="off" value={form.email} placeholder="paulo@farilog.com"
                onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Telefone / WhatsApp</label>
              <input className="input-field" autoComplete="off" value={form.phone} placeholder="(51) 90000-0000"
                onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Senha de acesso</label>
            <input className="input-field" required autoComplete="off" value={form.password} placeholder="senha de acesso"
              style={{ fontFamily: 'monospace' }} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>

          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '14px' }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold" style={T}>Empresas responsáveis</span>
              <span className="text-xs" style={TM}>{empresaIds.length} selecionada{empresaIds.length === 1 ? '' : 's'}</span>
            </div>
            <p className="text-xs mb-3" style={TM}>O período de responsabilidade começa hoje e fica registrado na conta dele.</p>
            <div className="grid grid-cols-2 gap-2" style={{ maxHeight: '210px', overflowY: 'auto' }}>
              {companies.map(c => {
                const on = empresaIds.includes(c.id);
                return (
                  <button type="button" key={c.id} onClick={() => toggle(c.id)}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all"
                    style={{ background: on ? '#FFFFFF' : '#F7F7F7', border: `1.5px solid ${on ? '#0B0B0B' : 'rgba(0,0,0,0.07)'}` }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '6px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: on ? '#0B0B0B' : '#FFFFFF', border: on ? 'none' : '1.5px solid rgba(0,0,0,0.14)', color: '#fff' }}>
                      {on && <Check size={11} strokeWidth={3} />}
                    </span>
                    <span className="text-xs font-semibold truncate" style={on ? T : T2}>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Criar conta
            </button>
            <button type="button" onClick={onClose} className="btn-ghost px-5">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Modal: resetar senha (troca imediata, sem e-mail) ──────────────────────
function ModalResetSenha({ lider, onSave, onClose }) {
  const [senha, setSenha] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="modal-overlay">
      <div className="modal-box animate-fade-up" style={{ maxWidth: '440px' }}>
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <span style={{ width: '38px', height: '38px', borderRadius: '12px', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', ...T }}>
              <Lock size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold" style={T}>Resetar senha</h2>
              <p className="text-xs mt-0.5" style={TM}>{lider.nome || lider.name}{lider.email ? ` · ${lider.email}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: '#9A9A9A', background: '#F5F5F5' }}><X size={15} /></button>
        </div>

        <form onSubmit={async e => { e.preventDefault(); setSaving(true); await onSave(senha); setSaving(false); }} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#6B6B6B' }}>Nova senha (escrita direta)</label>
            <input className="input-field" required autoComplete="off" value={senha} placeholder="nova senha"
              style={{ fontFamily: 'monospace' }} onChange={e => setSenha(e.target.value)} />
          </div>
          <div className="flex items-start gap-2 rounded-xl px-3 py-2.5" style={{ background: '#F7F7F7' }}>
            <CheckCircle2 size={14} style={{ color: '#4A4A4A', flexShrink: 0, marginTop: '1px' }} />
            <span className="text-xs" style={T2}>A troca é imediata: na próxima tentativa de login ele usa a nova senha. Nenhum e-mail é enviado.</span>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvar nova senha
            </button>
            <button type="button" onClick={onClose} className="btn-ghost px-5">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Indicador ──────────────────────────────────────────────────────────────
function Indicador({ icon: Icon, valor, legenda, nota, notaCor }) {
  return (
    <div className="stat-card animate-fade-up">
      <div className="flex items-start justify-between">
        <span style={{ width: '34px', height: '34px', borderRadius: '11px', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', ...T2 }}>
          <Icon size={17} />
        </span>
      </div>
      <p className="text-2xl font-bold mt-3" style={T}>{valor}</p>
      <p className="text-xs font-semibold" style={T2}>{legenda}</p>
      <p className="text-xs mt-0.5" style={notaCor ? { color: notaCor } : TM}>{nota}</p>
    </div>
  );
}

// ── Conta do encarregado ───────────────────────────────────────────────────
function ContaEncarregado({ lider, onVoltar, onResetSenha }) {
  const [desempenho, setDesempenho] = useState(null);
  const [vinculos,   setVinculos]   = useState([]);
  const [substitutos, setSubstitutos] = useState({});
  const [atividade,  setAtividade]  = useState([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    (async () => {
      const [des, vin, ativ] = await Promise.all([
        fetchLiderDesempenho(lider.id),
        fetchLiderVinculos(lider.id),
        fetchLiderAtividade(lider.id),
      ]);
      const encerrados = vin.filter(v => !v.atual).map(v => v.empresaId);
      const subs = await fetchResponsaveisAtivos(encerrados);
      if (!ativo) return;
      setDesempenho(des);
      setVinculos(vin);
      setSubstitutos(subs);
      setAtividade(ativ);
      setCarregando(false);
    })();
    return () => { ativo = false; };
  }, [lider.id]);

  const wa = whatsappLink(lider.telefone || lider.phone);
  const total = desempenho?.total || { diarias: 0, faltas: 0, pend: 0, faturado: 0 };
  const empresas = desempenho?.empresas || [];
  const ativos = vinculos.filter(v => v.atual).length;
  const desde = lider.criado_em ? fmtDate(String(lider.criado_em).slice(0, 10)) : null;

  return (
    <div className="space-y-5">
      <button onClick={onVoltar} className="flex items-center gap-1.5 text-xs font-semibold" style={TM}>
        <ArrowLeft size={13} /> Voltar para Encarregados
      </button>

      {/* Cabeçalho da conta */}
      <div className="card animate-fade-up" style={{ padding: '20px' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3.5">
            <div className="avatar flex-shrink-0" style={{ background: lider.cor || avatarTone(lider.id || lider.nome || lider.name), width: '52px', height: '52px', borderRadius: '15px', fontSize: '15px' }}>
              {lider.iniciais || iniciaisDe(lider.nome || lider.name)}
            </div>
            <div>
              <p className="text-base font-bold" style={T}>{lider.nome || lider.name}</p>
              <p className="text-xs" style={TM}>{[lider.email, lider.telefone || lider.phone].filter(Boolean).join(' · ') || '—'}</p>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className={`badge ${lider.status === 'inativo' ? 'badge-inactive' : 'badge-active'}`}>
                  {lider.status === 'inativo' ? 'Inativo' : 'Ativo'}
                </span>
                {desde && <span className="badge badge-pending">Conta desde {desde}</span>}
                <span className="badge badge-pending">{empresas.length || ativos} empresa{(empresas.length || ativos) === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-ghost flex items-center gap-1.5">
                <MessageCircle size={13} /> WhatsApp
              </a>
            )}
            <button onClick={onResetSenha} className="btn-primary flex items-center gap-1.5">
              <Lock size={13} /> Resetar senha
            </button>
          </div>
        </div>
      </div>

      {/* Indicadores dos últimos 30 dias */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Indicador icon={Briefcase}   valor={total.diarias}  legenda="Diárias (30 dias)" nota={`${ativos} empresa${ativos === 1 ? '' : 's'} ativa${ativos === 1 ? '' : 's'}`} />
        <Indicador icon={UserX}       valor={total.faltas}   legenda="Faltas"            nota="registradas pela equipe" notaCor={total.faltas ? ACCENT : undefined} />
        <Indicador icon={AlertTriangle} valor={total.pend}   legenda="Pendências"        nota="horários a lançar"       notaCor={total.pend ? ACCENT : undefined} />
        <Indicador icon={CheckCircle2} valor={`${desempenho?.presenca ?? 0}%`} legenda="Presença" nota="média das empresas" />
        <Indicador icon={DollarSign}  valor={fmtCurrency(total.faturado)} legenda="Faturado (30 dias)" nota="diárias + HE das empresas dele" />
      </div>

      {/* Desempenho por empresa */}
      <div className="card overflow-hidden animate-fade-up delay-1">
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#FAFAFA' }}>
          <span className="text-xs font-bold" style={T}>Desempenho por empresa</span>
          <span className="badge badge-pending">Últimos 30 dias</span>
        </div>
        <div className="px-5 py-2.5 grid text-xs font-semibold" style={{ gridTemplateColumns: '1.4fr 80px 70px 90px 120px 110px', gap: '14px', color: '#9A9A9A', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <span>Empresa</span><span style={{ textAlign: 'center' }}>Diárias</span><span style={{ textAlign: 'center' }}>Faltas</span>
          <span style={{ textAlign: 'center' }}>Pendências</span><span style={{ textAlign: 'center' }}>Presença</span><span style={{ textAlign: 'right' }}>Faturado</span>
        </div>

        {carregando ? (
          <div className="py-12 text-center"><Loader2 size={22} className="animate-spin mx-auto" style={TM} /></div>
        ) : empresas.length === 0 ? (
          <div className="py-12 text-center">
            <Briefcase size={30} className="mx-auto mb-3" style={{ color: '#C8C8C8' }} />
            <p className="text-sm" style={TM}>Sem lançamentos do encarregado nos últimos 30 dias</p>
          </div>
        ) : (
          <>
            {empresas.map(e => (
              <div key={e.empresaId} className="table-row" style={{ gridTemplateColumns: '1.4fr 80px 70px 90px 120px 110px', gap: '14px' }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <span style={{ width: '28px', height: '28px', borderRadius: '9px', background: '#F5F5F5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0, ...T }}>
                    {iniciaisDe(e.nome)}
                  </span>
                  <span className="text-xs font-semibold truncate" style={T}>{e.nome}</span>
                </div>
                <span className="text-xs font-bold" style={{ textAlign: 'center', ...T }}>{e.diarias}</span>
                <span className="text-xs font-bold" style={{ textAlign: 'center', color: e.faltas ? ACCENT : '#6B6B6B' }}>{e.faltas}</span>
                <span className="text-xs font-bold" style={{ textAlign: 'center', color: e.pend ? ACCENT : '#6B6B6B' }}>{e.pend}</span>
                <div className="flex items-center gap-2 justify-center">
                  <span style={{ width: '52px', height: '6px', borderRadius: '99px', background: '#EEEEEE', overflow: 'hidden', display: 'block' }}>
                    <span style={{ display: 'block', height: '100%', width: `${e.presenca}%`, background: '#0B0B0B', borderRadius: '99px' }} />
                  </span>
                  <span className="text-xs font-bold" style={T}>{e.presenca}%</span>
                </div>
                <span className="text-xs font-bold" style={{ textAlign: 'right', ...T }}>{fmtCurrency(e.faturado)}</span>
              </div>
            ))}
            <div className="flex justify-end items-center gap-6 px-5 py-3" style={{ background: '#F7F7F7' }}>
              <span className="text-xs" style={TM}>Total do período:</span>
              <span className="text-xs font-bold" style={T}>{fmtCurrency(total.faturado)}</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* Empresas e períodos */}
        <div className="card animate-fade-up delay-2" style={{ padding: '20px' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold" style={T}>Empresas e períodos</span>
            <span className="badge badge-pending">Histórico de vínculos</span>
          </div>
          <p className="text-xs mb-3" style={TM}>Trocas de encarregado ficam registradas: o desempenho de cada empresa considera apenas o período em que ele foi o responsável.</p>

          {vinculos.length === 0 ? (
            <p className="text-xs py-4" style={TM}>Nenhum vínculo registrado.</p>
          ) : (
            <div className="space-y-2">
              {vinculos.map((v, i) => {
                const sub = substitutos[v.empresaId];
                return (
                  <div key={`${v.empresaId}-${i}`} className="flex items-center gap-3 rounded-xl px-3.5 py-3" style={{ background: '#F7F7F7' }}>
                    <span style={{ width: '32px', height: '32px', borderRadius: '10px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0, ...T }}>
                      {iniciaisDe(v.nome)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate" style={T}>{v.nome}</p>
                      <p className="text-xs" style={TM}>
                        {v.de ? `De ${fmtDate(v.de)}` : 'Vínculo sem data'} {v.atual ? 'até Atual' : v.ate ? `até ${fmtDate(v.ate)}` : ''}
                        {!v.atual && sub?.nome ? ` · Substituído por ${sub.nome}` : ''}
                      </p>
                    </div>
                    <span className={`badge ${v.atual ? 'badge-active' : 'badge-inactive'}`} style={{ flexShrink: 0 }}>
                      {v.atual ? 'Responsável atual' : 'Encerrado'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 mt-3" style={{ background: '#F7F7F7' }}>
            <AlertTriangle size={13} style={{ color: '#4A4A4A', flexShrink: 0, marginTop: '1px' }} />
            <span className="text-xs" style={T2}>Ao trocar o responsável de uma empresa, o período do antigo é encerrado na data da troca e o novo começa a contar do mesmo dia.</span>
          </div>
        </div>

        {/* Atividade recente */}
        <div className="card animate-fade-up delay-3" style={{ padding: '20px' }}>
          <span className="text-xs font-bold" style={T}>Atividade recente</span>
          {atividade.length === 0 ? (
            <p className="text-xs py-4 mt-2" style={TM}>Nenhuma atividade registrada.</p>
          ) : (
            <div className="space-y-2.5 mt-3">
              {atividade.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', marginTop: '5px', flexShrink: 0, background: a.ok ? '#0B0B0B' : ACCENT }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold" style={T}>{a.txt}</p>
                    <p className="text-xs" style={TM}>{a.data ? fmtDate(String(a.data).slice(0, 10)) : '—'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página: lista de encarregados ──────────────────────────────────────────
export default function AdminEncarregados() {
  const { companies } = useAuth();
  const [lideres,  setLideres]  = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionado, setSelecionado] = useState(null);
  const [modal, setModal] = useState(null);   // 'new' | 'reset'
  const [busca, setBusca] = useState('');

  const carregar = async () => {
    setCarregando(true);
    const lista = await fetchLideres();
    setLideres(lista);
    setCarregando(false);
    return lista;
  };

  useEffect(() => { carregar(); }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return lideres;
    return lideres.filter(l => (l.nome || l.name || '').toLowerCase().includes(q) || (l.email || '').toLowerCase().includes(q));
  }, [lideres, busca]);

  const criarConta = async ({ name, email, phone, password, empresaIds }) => {
    const novo = await createEncarregado({
      name, email, phone, password, empresaIds,
      initials: iniciaisDe(name),
      color: COLORS[lideres.length % COLORS.length],
    });
    if (!novo) { alert('Não foi possível criar a conta. Verifique se o e-mail já está em uso.'); return; }
    await carregar();
    setModal(null);
  };

  const salvarSenha = async (senha) => {
    const ok = await updateLider(modal.lider.id, { password: senha });
    if (!ok) { alert('Não foi possível alterar a senha.'); return; }
    setModal(null);
  };

  if (selecionado) {
    const lider = lideres.find(l => l.id === selecionado) || { id: selecionado };
    return (
      <>
        <ContaEncarregado
          lider={lider}
          onVoltar={() => setSelecionado(null)}
          onResetSenha={() => setModal({ type: 'reset', lider })}
        />
        {modal?.type === 'reset' && (
          <ModalResetSenha lider={modal.lider} onSave={salvarSenha} onClose={() => setModal(null)} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-xl font-bold" style={T}>Encarregados</h1>
          <p className="text-xs mt-0.5" style={TM}>
            {`${lideres.filter(l => l.status !== 'inativo').length} ativos de ${lideres.length} cadastrados`}
          </p>
        </div>
        <button onClick={() => setModal({ type: 'new' })} className="btn-primary flex items-center gap-2">
          <Plus size={14} /> Criar conta
        </button>
      </div>

      <div className="animate-fade-up delay-1">
        <input className="input-field" placeholder="Buscar por nome ou e-mail..." value={busca} onChange={e => setBusca(e.target.value)} />
      </div>

      <div className="card overflow-hidden animate-fade-up delay-2">
        <div className="px-5 py-3 grid text-xs font-semibold"
          style={{ gridTemplateColumns: '1.6fr 1.4fr auto auto', gap: '16px', color: '#9A9A9A', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
          <span>Encarregado</span><span>Empresas</span><span>Status</span><span style={{ textAlign: 'right' }}>Ações</span>
        </div>

        {carregando ? (
          <div className="py-14 text-center"><Loader2 size={24} className="animate-spin mx-auto" style={TM} /></div>
        ) : filtrados.length === 0 ? (
          <div className="py-14 text-center">
            <Users size={32} className="mx-auto mb-3" style={{ color: '#C8C8C8' }} />
            <p className="text-sm" style={TM}>Nenhum encarregado cadastrado</p>
          </div>
        ) : (
          filtrados.map(l => (
            <div key={l.id} className="table-row" style={{ gridTemplateColumns: '1.6fr 1.4fr auto auto', gap: '16px' }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="avatar flex-shrink-0" style={{ background: l.cor || l.color || avatarTone(l.id || l.nome) }}>
                  {l.iniciais || iniciaisDe(l.nome || l.name)}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate" style={T}>{l.nome || l.name}</p>
                  <p className="text-xs truncate" style={TM}>{l.email || '—'}</p>
                </div>
              </div>
              <p className="text-xs truncate self-center" style={T2}>{l.companyName && l.companyName !== '—' ? l.companyName : '—'}</p>
              <span className={`badge ${l.status === 'inativo' ? 'badge-inactive' : 'badge-active'} self-center`}>
                {l.status === 'inativo' ? 'Inativo' : 'Ativo'}
              </span>
              <div className="flex items-center gap-1 justify-end">
                <button onClick={() => setSelecionado(l.id)} title="Abrir conta" className="p-1.5 rounded-lg" style={{ color: T.color, background: '#F4F4F5' }}>
                  <Briefcase size={13} />
                </button>
                <button onClick={() => setModal({ type: 'reset', lider: l })} title="Resetar senha" className="p-1.5 rounded-lg" style={{ color: '#9A9A9A', background: '#F5F5F5' }}>
                  <Lock size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {modal?.type === 'new' && (
        <ModalNovaConta companies={companies} onSave={criarConta} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'reset' && (
        <ModalResetSenha lider={modal.lider} onSave={salvarSenha} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
