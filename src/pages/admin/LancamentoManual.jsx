import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus, Loader2, Search, CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchDemands, lancarDiariaManual } from '../../lib/db';
import { normalizeText } from '../../lib/notas';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const TIPOS = [
  { val: 'entrega',        label: 'Diária',           icon: '🚚' },
  { val: 'carga_descarga', label: 'Carga e Descarga', icon: '📦' },
];

const fmtBR = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '');

const HORARIOS_VAZIOS = { entrada: '', saida: '', saidaAlmoco: '', retornoAlmoco: '' };

// Lança diárias de dias que já passaram e não foram registrados: escolhe a
// empresa, o dia e quem trabalhou — sem busca de ajudantes nem convocação.
export default function LancamentoManual() {
  const { user, employees, companies, setDemands } = useAuth();
  const [form, setForm] = useState({ companyId: '', date: TODAY, time: '07:00', tipoServico: 'entrega' });
  const [selecionados, setSelecionados] = useState([]);
  const [busca, setBusca] = useState('');
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);

  // Modal de horários: só lança depois que todos têm entrada e saída.
  const [modalHorarios, setModalHorarios] = useState(false);
  const [horarios, setHorarios] = useState({});
  const [erroModal, setErroModal] = useState('');

  const empresa = companies.find(c => c.id === form.companyId) || null;
  const ativos = useMemo(() => (employees || []).filter(e => e.status === 'active'), [employees]);
  const filtrados = useMemo(() => {
    const q = normalizeText(busca);
    const base = q ? ativos.filter(e => normalizeText(`${e.name} ${e.cidade || ''}`).includes(q)) : ativos;
    return [...base].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
  }, [ativos, busca]);

  const selecionadosObj = selecionados
    .map(id => (employees || []).find(e => e.id === id))
    .filter(Boolean);

  const toggle = (id) => setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const abrirHorarios = () => {
    setErro('');
    setResultado(null);
    if (!form.companyId) { setErro('Selecione a empresa.'); return; }
    if (!form.date) { setErro('Informe a data em que o ajudante trabalhou.'); return; }
    if (!selecionados.length) { setErro('Selecione ao menos um ajudante que trabalhou nesse dia.'); return; }

    const inicial = {};
    selecionados.forEach(id => { inicial[id] = { ...HORARIOS_VAZIOS, entrada: form.time || '' }; });
    setHorarios(inicial);
    setErroModal('');
    setModalHorarios(true);
  };

  const fecharHorarios = () => {
    if (saving) return;
    setModalHorarios(false);
  };

  const setHorario = (id, campo, valor) => {
    setHorarios(prev => ({ ...prev, [id]: { ...prev[id], [campo]: valor } }));
  };

  const semHorario = selecionados.filter(id => {
    const h = horarios[id] || {};
    return !h.entrada || !h.saida;
  });
  const almocoIncompleto = selecionados.filter(id => {
    const h = horarios[id] || {};
    return !!h.saidaAlmoco !== !!h.retornoAlmoco;
  });
  const podeConfirmar = selecionados.length > 0 && semHorario.length === 0 && almocoIncompleto.length === 0;

  const confirmarLancamento = async () => {
    if (!podeConfirmar || saving) return;
    setErroModal('');
    setSaving(true);
    const res = await lancarDiariaManual({
      companyId: form.companyId, date: form.date, time: form.time,
      tipoServico: form.tipoServico, employeeIds: selecionados,
      employeeTimes: horarios, adminId: user?.id ?? null,
    });
    setSaving(false);

    if (!res) {
      setErroModal('Não foi possível lançar a diária. Confira os horários e tente novamente.');
      return;
    }

    setResultado({ ...res, date: form.date, empresa: empresa?.name || 'Empresa' });
    setModalHorarios(false);
    setHorarios({});
    setSelecionados([]);
    try {
      const fresh = await fetchDemands();
      if (fresh?.length) setDemands(fresh);
    } catch { /* o lançamento já foi gravado; a lista se atualiza ao recarregar */ }
  };

  const nDiarias = selecionados.length;
  const tipoLabel = TIPOS.find(t => t.val === form.tipoServico)?.label || 'Diária';

  return (
    <div className="card p-5 animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '1120px' }}>
      <div>
        <p style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>Lançamento manual</p>
        <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
          Para diárias de dias que já passaram e não foram lançadas. Escolha a empresa, o dia e quem
          trabalhou — não passa pela busca de ajudantes nem gera convocação.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Empresa *</label>
          <select className="input-field" value={form.companyId}
            onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}>
            <option value="">Selecione a empresa</option>
            {(companies || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Data em que trabalhou *</label>
          <input type="date" className="input-field" value={form.date}
            onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Início</label>
          <input type="time" className="input-field" value={form.time}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {TIPOS.map(opt => {
          const sel = form.tipoServico === opt.val;
          return (
            <button key={opt.val} type="button" onClick={() => setForm(f => ({ ...f, tipoServico: opt.val }))}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px',
                border: `1.5px solid ${sel ? '#BC4A2A' : 'rgba(0,0,0,0.1)'}`,
                background: sel ? '#FAF4F1' : '#F8FAFC', cursor: 'pointer',
              }}>
              <span style={{ fontSize: '14px' }}>{opt.icon}</span>
              <span style={{ fontSize: '12px', fontWeight: 700, color: sel ? '#BC4A2A' : '#0F172A' }}>{opt.label}</span>
            </button>
          );
        })}
        {empresa && (
          <span className="tipo-pag">
            💰 Valor da diária: <b style={{ color: '#0F172A' }}>R$ {Number(empresa.dailyRate || 0).toFixed(2)}</b>
          </span>
        )}
      </div>

      <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: '14px' }}>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Quem trabalhou nesse dia?</p>
        <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', marginBottom: '10px' }}>
          {nDiarias > 0 && empresa
            ? `${nDiarias} diária${nDiarias !== 1 ? 's' : ''} em ${empresa.name} no dia ${fmtBR(form.date)}.`
            : 'Marque um ou mais ajudantes que trabalharam nesse dia.'}
        </p>

        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <Search size={12} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="input-field" style={{ paddingLeft: '30px' }} placeholder="Buscar por nome ou cidade..."
            value={busca} onChange={e => setBusca(e.target.value)} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '360px', overflowY: 'auto' }}>
          {filtrados.length === 0 ? (
            <p style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', padding: '20px 0' }}>
              Nenhum ajudante ativo encontrado.
            </p>
          ) : filtrados.map(c => {
            const sel = selecionados.includes(c.id);
            return (
              <button key={c.id} type="button" onClick={() => toggle(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '10px',
                  border: `1.5px solid ${sel ? '#BC4A2A' : 'rgba(0,0,0,0.06)'}`,
                  background: sel ? '#FAF4F1' : '#fff', cursor: 'pointer', textAlign: 'left',
                }}>
                <div style={{ width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0, border: sel ? 'none' : '1.5px solid #C8C8C8', background: sel ? '#BC4A2A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {sel && <CheckCircle2 size={13} color="#fff" />}
                </div>
                <div style={{ width: '30px', height: '30px', borderRadius: '9px', background: c.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>{c.initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{c.name}</p>
                  <p style={{ fontSize: '10px', color: '#94A3B8' }}>{c.cidade || 'cidade não informada'}{c.cargo ? ` · ${c.cargo}` : ''}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {erro && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '10px 12px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={13} style={{ color: '#B91C1C', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '11px', color: '#B91C1C', lineHeight: 1.5 }}>{erro}</p>
        </div>
      )}

      {resultado && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '10px 12px', borderRadius: '10px', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <CheckCircle2 size={13} style={{ color: '#047857', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '11px', color: '#047857', lineHeight: 1.5 }}>
            {resultado.criados > 0
              ? `${resultado.criados} diária${resultado.criados !== 1 ? 's' : ''} lançada${resultado.criados !== 1 ? 's' : ''} em ${resultado.empresa} no dia ${fmtBR(resultado.date)}.`
              : `Nenhuma diária nova lançada em ${resultado.empresa} no dia ${fmtBR(resultado.date)}.`}
            {' '}{resultado.criada ? 'Escala do dia criada.' : 'A escala do dia já existia — os ajudantes foram acrescentados nela.'}
            {resultado.repetidos > 0 && ` ${resultado.repetidos} já estava${resultado.repetidos !== 1 ? 'm' : ''} lançado${resultado.repetidos !== 1 ? 's' : ''} nesse dia.`}
          </p>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '11px', color: '#94A3B8', marginRight: 'auto' }}>
          Ao continuar, você informa os horários de cada ajudante. A diária entra finalizada e conta na folha.
        </span>
        <button type="button" onClick={abrirHorarios} disabled={nDiarias === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 22px', borderRadius: '10px', border: 'none',
            cursor: nDiarias === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 800,
            background: nDiarias === 0 ? '#E2E8F0' : '#BC4A2A',
            color: nDiarias === 0 ? '#94A3B8' : 'white',
          }}>
          <CalendarPlus size={14} /> Lançar {nDiarias > 0 ? nDiarias : ''} diária{nDiarias !== 1 ? 's' : ''}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)' }}>
        <Info size={13} style={{ color: '#64748B', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.5 }}>
          Use esta sub-aba só para dias esquecidos. Para escalar ajudantes em um dia novo, use a sub-aba
          <b> Convocação</b>. Quem já estiver lançado nesse dia é ignorado, para não duplicar a diária.
        </p>
      </div>

      {modalHorarios && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1300 }}
          onClick={e => { if (e.target === e.currentTarget) fecharHorarios(); }}>
          <div className="modal-box animate-fade-up" style={{ maxWidth: '720px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
              <div>
                <p style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>Horários da diária</p>
                <p style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                  {empresa?.name || 'Empresa'} · {fmtBR(form.date)} · {tipoLabel}
                </p>
              </div>
              <button type="button" onClick={fecharHorarios} disabled={saving}
                style={{ background: 'none', border: 'none', cursor: saving ? 'wait' : 'pointer', color: '#94A3B8' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '10px 12px', borderRadius: '10px', background: '#FAF4F1', border: '1px solid #E4C9BF', marginBottom: '12px' }}>
              <Info size={13} style={{ color: '#8A3520', flexShrink: 0, marginTop: '1px' }} />
              <p style={{ fontSize: '11px', color: '#8A3520', lineHeight: 1.5 }}>
                Preencha <b>entrada</b> e <b>saída</b> de cada ajudante. Sem os dois a diária não é lançada.
                O almoço é opcional — se preencher, informe ida e volta.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selecionadosObj.map(emp => {
                const h = horarios[emp.id] || HORARIOS_VAZIOS;
                const falta = !h.entrada || !h.saida;
                return (
                  <div key={emp.id} style={{
                    padding: '10px 12px', borderRadius: '12px',
                    border: `1px solid ${falta ? '#FDE68A' : 'rgba(0,0,0,0.07)'}`,
                    background: falta ? '#FFFBEB' : '#FAFAFA',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>{emp.initials}</div>
                      <p style={{ flex: 1, minWidth: 0, fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{emp.name}</p>
                      {falta && <span style={{ fontSize: '9px', fontWeight: 700, color: '#B45309', background: '#FEF3C7', padding: '2px 6px', borderRadius: '5px' }}>falta horário</span>}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                      {[
                        { campo: 'entrada',       label: 'Entrada *' },
                        { campo: 'saida',         label: 'Saída *' },
                        { campo: 'saidaAlmoco',   label: 'Almoço — saída' },
                        { campo: 'retornoAlmoco', label: 'Almoço — retorno' },
                      ].map(({ campo, label }) => (
                        <div key={campo}>
                          <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, color: '#64748B', marginBottom: '3px' }}>{label}</label>
                          <input type="time" className="input-field" value={h[campo] || ''}
                            onChange={e => setHorario(emp.id, campo, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {erroModal && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '10px 12px', borderRadius: '10px', background: '#FEF2F2', border: '1px solid #FECACA', marginTop: '12px' }}>
                <AlertTriangle size={13} style={{ color: '#B91C1C', flexShrink: 0, marginTop: '1px' }} />
                <p style={{ fontSize: '11px', color: '#B91C1C', lineHeight: 1.5 }}>{erroModal}</p>
              </div>
            )}

            {!podeConfirmar && (
              <p style={{ fontSize: '11px', color: '#B45309', fontWeight: 600, marginTop: '10px', textAlign: 'right' }}>
                {semHorario.length > 0
                  ? `${semHorario.length} ajudante${semHorario.length !== 1 ? 's' : ''} sem entrada/saída.`
                  : 'Complete os horários de almoço (ida e volta).'}
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
              <button type="button" onClick={fecharHorarios} disabled={saving}
                style={{ flex: 1, padding: '12px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: saving ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 600 }}>
                Cancelar
              </button>
              <button type="button" onClick={confirmarLancamento} disabled={!podeConfirmar || saving}
                style={{
                  flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  padding: '12px', borderRadius: '10px', border: 'none', fontSize: '13px', fontWeight: 800,
                  cursor: podeConfirmar && !saving ? 'pointer' : 'not-allowed',
                  background: podeConfirmar && !saving ? '#BC4A2A' : '#E2E8F0',
                  color: podeConfirmar && !saving ? 'white' : '#94A3B8',
                }}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Lançando...</> : <>Confirmar lançamento ({selecionados.length})</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}