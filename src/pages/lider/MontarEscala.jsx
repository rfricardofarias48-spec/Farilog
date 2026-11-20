import { useEffect, useMemo, useState } from 'react';
import {
  Building2, X, Search, CheckCircle2, Users, ArrowRight, ArrowLeft, Shield, Loader2, Info,
} from 'lucide-react';
import {
  fetchEmpresasDoLider, fetchUltimosEscaladosDaEmpresa, fetchCandidatosComDistancia,
  createEscalaComConvocacoes, computePagamentoEm,
} from '../../lib/db';
import { rotuloDistancia } from '../../lib/geo';
import { fmtNota, normalizeText } from '../../lib/notas';
import BuscaAjudantes from '../../components/shared/BuscaAjudantes';
import ModalConfirmarConvocacao from '../../components/shared/ModalConfirmarConvocacao';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const RESERVAS_PADRAO = 2;

// Assistente de montagem da escala:
//   1) dados + últimos escalados → 2) busca estilo Uber → 3) lista ranqueada → 4) confirmação.
export default function MontarEscala({ user, onSaved, onCancel }) {
  const [step, setStep]       = useState('montar');   // montar | buscando | lista
  const [form, setForm]       = useState({ companyId: '', date: TODAY, time: '07:00', service: '', tipoServico: 'entrega' });
  const [resp, setResp]       = useState('');
  const [contato, setContato] = useState('');
  const [vagas, setVagas]     = useState(10);

  const [empresas, setEmpresas]   = useState([]);
  const [ultimos, setUltimos]     = useState({ company: null, list: [], lastDate: null });
  const [loadingUlt, setLoadingUlt] = useState(false);
  const [mantidos, setMantidos]   = useState([]);

  const [busca, setBusca]         = useState({ company: null, candidates: [] });
  const [loadingBusca, setLB]     = useState(false);
  const [selecionados, setSelecionados] = useState([]);
  const [search, setSearch]       = useState('');

  const [confirmar, setConfirmar] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [erro, setErro]           = useState('');

  // Empresas do encarregado
  useEffect(() => {
    fetchEmpresasDoLider(user.id).then(list => {
      setEmpresas(list);
      if (list.length === 1) {
        setForm(f => ({ ...f, companyId: list[0].id }));
        setResp(list[0].responsavel || '');
        setContato(list[0].telefone || '');
      }
    });
  }, [user.id]);

  // Últimos escalados nesta empresa
  useEffect(() => {
    if (!form.companyId) { setUltimos({ company: null, list: [], lastDate: null }); return; }
    setLoadingUlt(true);
    fetchUltimosEscaladosDaEmpresa(form.companyId, form.date).then(res => {
      setUltimos(res);
      setMantidos([]);
      setLoadingUlt(false);
    });
  }, [form.companyId, form.date]);

  const empresa = busca.company || ultimos.company || empresas.find(e => e.id === form.companyId) || null;
  const pagamentoEm = useMemo(
    () => computePagamentoEm(form.date, empresa?.prazoPagamento ?? 5),
    [form.date, empresa?.prazoPagamento]
  );

  const toggleMantido = (id) => setMantidos(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const selecionarEmpresa = (emp) => {
    setForm(f => ({ ...f, companyId: emp.id }));
    setResp(emp.responsavel || '');
    setContato(emp.telefone || '');
  };

  // Passo 1 → 2: busca candidatos e já deixa marcados os que o encarregado manteve.
  const iniciarBusca = async () => {
    if (!form.companyId) { setErro('Selecione a empresa desta escala.'); return; }
    setErro('');
    setStep('buscando');
    setLB(true);
    const res = await fetchCandidatosComDistancia({ companyId: form.companyId, date: form.date });
    setBusca(res);
    const ids = new Set((res.candidates || []).map(c => c.id));
    setSelecionados(mantidos.filter(id => ids.has(id)));
    setLB(false);
  };

  const toggleSel = (id) => setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const candidatos = busca.candidates || [];
  const filtrados  = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return candidatos;
    return candidatos.filter(c => normalizeText(`${c.name} ${c.cidade} ${c.cargo || ''}`).includes(q));
  }, [candidatos, search]);

  const titulares = candidatos.filter(c => selecionados.includes(c.id));
  const reservas  = candidatos.filter(c => !selecionados.includes(c.id)).slice(0, RESERVAS_PADRAO);
  const vagasRestantes = Math.max(0, Number(vagas || 0) - titulares.length);

  const confirmarConvocacao = async () => {
    setSaving(true);
    const saved = await createEscalaComConvocacoes({
      liderId: user.id, companyId: form.companyId, date: form.date,
      time: form.time, service: form.service, tipoServico: form.tipoServico,
      vagas: Number(vagas) || titulares.length,
      totalReservas: reservas.length || RESERVAS_PADRAO,
      employees: titulares.map(t => ({ id: t.id, distanciaKm: t.distanciaKm, media: t.media })),
      reservas: reservas.map(r => ({ id: r.id, distanciaKm: r.distanciaKm, media: r.media })),
      responsavelDia: resp, contatoDia: contato,
    });
    setSaving(false);
    if (saved) { setConfirmar(false); onSaved(saved); }
    else { setErro('Não foi possível criar a escala. Tente novamente.'); setConfirmar(false); }
  };

  return (
    <div className="card p-5 animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>Montar escala</p>
          <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
            {step === 'montar' ? 'Dados da escala e últimos escalados'
              : step === 'buscando' ? 'Buscando ajudantes próximos…'
              : 'Escolha quem convocar'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Passos */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['montar', 'buscando', 'lista'].map((s, i) => (
              <span key={s} style={{ width: i === 0 ? '18px' : '8px', height: '4px', borderRadius: '99px', background: ['montar', 'buscando', 'lista'].indexOf(step) >= i ? '#BC4A2A' : '#E2E8F0', transition: 'all .2s' }} />
            ))}
          </div>
          <button type="button" onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
        </div>
      </div>

      {erro && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 12px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <Info size={13} style={{ color: '#B91C1C' }} />
          <span style={{ fontSize: '12px', color: '#B91C1C', fontWeight: 600 }}>{erro}</span>
        </div>
      )}

      {/* ─────────── PASSO 1: dados + últimos escalados ─────────── */}
      {step === 'montar' && (
        <>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Para qual empresa? *</label>
            {empresas.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhuma empresa vinculada. Fale com o administrador.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {empresas.map(emp => {
                  const sel = form.companyId === emp.id;
                  return (
                    <button key={emp.id} type="button" onClick={() => selecionarEmpresa(emp)}
                      style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '10px', border: `2px solid ${sel ? '#BC4A2A' : 'rgba(0,0,0,0.1)'}`, background: sel ? '#FAF4F1' : 'white', cursor: 'pointer' }}>
                      <Building2 size={13} style={{ color: sel ? '#BC4A2A' : '#94A3B8' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: sel ? '#BC4A2A' : '#0F172A' }}>{emp.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid-form-4">
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Data *</label>
              <input type="date" className="input-field" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Início</label>
              <input type="time" className="input-field" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Vagas *</label>
              <input type="number" min="1" className="input-field" value={vagas} onChange={e => setVagas(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Serviço</label>
              <input className="input-field" placeholder="Separação, entrega…" value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { val: 'entrega', label: 'Entrega', icon: '🚚' },
              { val: 'carga_descarga', label: 'Carga e Descarga', icon: '📦' },
            ].map(opt => {
              const sel = form.tipoServico === opt.val;
              return (
                <button key={opt.val} type="button" onClick={() => setForm(f => ({ ...f, tipoServico: opt.val }))}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: `1.5px solid ${sel ? '#BC4A2A' : 'rgba(0,0,0,0.1)'}`, background: sel ? '#FAF4F1' : '#F8FAFC', cursor: 'pointer' }}>
                  <span style={{ fontSize: '14px' }}>{opt.icon}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: sel ? '#BC4A2A' : '#0F172A' }}>{opt.label}</span>
                </button>
              );
            })}
            {pagamentoEm && <span className="tipo-pag">
              💰 Pagamento previsto: <b style={{ color: '#0F172A' }}>{new Date(`${pagamentoEm}T12:00:00`).toLocaleDateString('pt-BR')}</b>
            </span>}
          </div>

          {/* Últimos escalados */}
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '14px' }}>
            {!form.companyId ? (
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>Selecione a empresa para ver quem esteve na última escala.</p>
            ) : loadingUlt ? (
              <p style={{ fontSize: '12px', color: '#94A3B8' }}><Loader2 size={12} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />Carregando últimos escalados…</p>
            ) : ultimos.list.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>Nenhuma escala anterior nesta empresa. Siga para buscar ajudantes próximos.</p>
            ) : (
              <>
                <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                  Esses são os seus últimos escalados nesta empresa. Você quer manter algum deles na escala?
                </p>
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', marginBottom: '10px' }}>
                  Última escala: {new Date(`${ultimos.lastDate}T12:00:00`).toLocaleDateString('pt-BR')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {ultimos.list.map(c => {
                    const sel = mantidos.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleMantido(c.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '10px', border: `1.5px solid ${sel ? '#BC4A2A' : 'rgba(0,0,0,0.07)'}`, background: sel ? '#FAF4F1' : '#F8FAFC', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, border: sel ? 'none' : '1.5px solid #C8C8C8', background: sel ? '#BC4A2A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {sel && <CheckCircle2 size={13} color="#fff" />}
                        </div>
                        <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: c.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>{c.initials}</div>
                        <div className="person-main">
                          <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{c.name}</p>
                          <p style={{ fontSize: '10px', color: '#94A3B8' }}>{c.cidade || 'cidade não informada'}</p>
                        </div>
                        <div className="person-side">
                          <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600, whiteSpace: 'nowrap' }}>{rotuloDistancia(c.distanciaKm, c.distanciaExata, c.proximidadeLabel)}</span>
                          <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>{c.media == null ? 'sem nota' : `★ ${fmtNota(c.media)}`}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onCancel}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Cancelar
            </button>
            <button type="button" onClick={iniciarBusca} disabled={!form.companyId}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '10px', border: 'none', cursor: form.companyId ? 'pointer' : 'not-allowed', fontSize: '13px', fontWeight: 700, background: form.companyId ? '#BC4A2A' : '#E2E8F0', color: form.companyId ? 'white' : '#94A3B8' }}>
              {mantidos.length > 0 ? `Manter ${mantidos.length} e buscar próximos` : 'Buscar ajudantes próximos'} <ArrowRight size={14} />
            </button>
          </div>
        </>
      )}

      {/* ─────────── PASSO 2: busca estilo Uber ─────────── */}
      {step === 'buscando' && (
        loadingBusca ? (
          <div style={{ padding: '60px 0', textAlign: 'center' }}>
            <Loader2 size={26} className="animate-spin" style={{ color: '#BC4A2A', margin: '0 auto 12px' }} />
            <p style={{ fontSize: '13px', color: '#94A3B8' }}>Preparando a busca…</p>
          </div>
        ) : (
          <BuscaAjudantes empresa={empresa} candidatos={candidatos} onConcluir={() => setStep('lista')} />
        )
      )}

      {/* ─────────── PASSO 3: lista ranqueada ─────────── */}
      {step === 'lista' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                {titulares.length} selecionado{titulares.length !== 1 ? 's' : ''} de {candidatos.length}
              </p>
              <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>Ordem: <b>distância</b> → <b>nota média</b></p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '10px', background: vagasRestantes > 0 ? '#FAF4F1' : '#F1F5F9', border: `1px solid ${vagasRestantes > 0 ? '#E4C9BF' : 'rgba(0,0,0,0.08)'}` }}>
              {vagasRestantes === 0 && <CheckCircle2 size={12} style={{ color: '#0F172A' }} />}
              <span style={{ fontSize: '11px', fontWeight: 700, color: vagasRestantes > 0 ? '#8A3520' : '#0F172A' }}>
                {vagasRestantes > 0 ? `${vagasRestantes} vaga${vagasRestantes !== 1 ? 's' : ''} em aberto` : 'Vagas preenchidas'}
              </span>
              <span style={{ fontSize: '11px', color: '#94A3B8' }}>· {titulares.length}/{vagas}</span>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
            <input className="input-field" style={{ paddingLeft: '30px' }} placeholder="Buscar por nome ou cidade…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '480px', overflowY: 'auto' }}>
            {filtrados.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>Nenhum ajudante encontrado.</p>
            ) : filtrados.map(c => {
              const sel = selecionados.includes(c.id);
              const isReserva = !sel && reservas.some(r => r.id === c.id);
              return (
                <button key={c.id} type="button" onClick={() => toggleSel(c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '10px', border: `1.5px solid ${sel ? '#BC4A2A' : 'rgba(0,0,0,0.06)'}`, background: sel ? '#FAF4F1' : '#fff', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, border: sel ? 'none' : '1.5px solid #C8C8C8', background: sel ? '#BC4A2A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {sel && <CheckCircle2 size={13} color="#fff" />}
                  </div>
                  <span className="conv-ordem">{c.ordem}º</span>
                  <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: c.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>{c.initials}</div>
                  <div className="person-main">
                    <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{c.name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '1px' }}>
                      <p style={{ fontSize: '10px', color: '#94A3B8' }}>{c.cidade || 'cidade não informada'} · {c.cargo || 'Ajudante'}</p>
                      {isReserva && <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '9px', fontWeight: 700, color: '#6B7280', background: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}><Shield size={8} /> reserva</span>}
                    </div>
                  </div>
                  <div className="person-side">
                    <span style={{ fontSize: '11px', color: '#0F172A', fontWeight: 700, whiteSpace: 'nowrap' }}>{rotuloDistancia(c.distanciaKm, c.distanciaExata, c.proximidadeLabel)}</span>
                    <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 700 }}>{c.media == null ? 'sem nota' : `★ ${fmtNota(c.media)}`}</span>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)' }}>
            <Info size={13} style={{ color: '#64748B', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.5 }}>
              O agente buscará <b>{RESERVAS_PADRAO} reservas</b> automaticamente (fora desta lista) e cada escala fica com
              {' '}{reservas.length || RESERVAS_PADRAO} reserva{(reservas.length || RESERVAS_PADRAO) !== 1 ? 's' : ''} sugerida{(reservas.length || RESERVAS_PADRAO) !== 1 ? 's' : ''}.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={() => setStep('buscando')}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '11px 16px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              <ArrowLeft size={14} /> Voltar
            </button>
            <button type="button" onClick={() => setConfirmar(true)} disabled={titulares.length === 0}
              style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '11px', borderRadius: '10px', border: 'none', cursor: titulares.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 800, background: titulares.length === 0 ? '#E2E8F0' : '#BC4A2A', color: titulares.length === 0 ? '#94A3B8' : 'white' }}>
              <Users size={15} /> Confirmar {titulares.length} convocado{titulares.length !== 1 ? 's' : ''}
            </button>
          </div>
        </>
      )}

      {confirmar && (
        <ModalConfirmarConvocacao
          empresa={empresa} date={form.date} time={form.time} vagas={Number(vagas) || titulares.length}
          titulares={titulares} reservas={reservas} pagamentoEm={pagamentoEm}
          saving={saving} onCancel={() => setConfirmar(false)} onConfirm={confirmarConvocacao}
        />
      )}
    </div>
  );
}
