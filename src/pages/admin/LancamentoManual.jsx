import { useMemo, useState } from 'react';
import { CalendarPlus, Loader2, Search, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { fetchDemands, lancarDiariaManual } from '../../lib/db';
import { normalizeText } from '../../lib/notas';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const TIPOS = [
  { val: 'entrega',        label: 'Diária',           icon: '🚚' },
  { val: 'carga_descarga', label: 'Carga e Descarga', icon: '📦' },
];

const fmtBR = (iso) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR') : '');

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

  const empresa = companies.find(c => c.id === form.companyId) || null;
  const ativos = useMemo(() => (employees || []).filter(e => e.status === 'active'), [employees]);
  const filtrados = useMemo(() => {
    const q = normalizeText(busca);
    const base = q ? ativos.filter(e => normalizeText(`${e.name} ${e.cidade || ''}`).includes(q)) : ativos;
    return [...base].sort((a, b) => String(a.name).localeCompare(String(b.name), 'pt-BR'));
  }, [ativos, busca]);

  const toggle = (id) => setSelecionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const lancar = async () => {
    setErro('');
    setResultado(null);
    if (!form.companyId) { setErro('Selecione a empresa.'); return; }
    if (!form.date) { setErro('Informe a data em que o ajudante trabalhou.'); return; }
    if (!selecionados.length) { setErro('Selecione ao menos um ajudante que trabalhou nesse dia.'); return; }

    setSaving(true);
    const res = await lancarDiariaManual({
      companyId: form.companyId, date: form.date, time: form.time,
      tipoServico: form.tipoServico, employeeIds: selecionados, adminId: user?.id ?? null,
    });
    setSaving(false);

    if (!res) { setErro('Não foi possível lançar a diária. Tente novamente.'); return; }

    setResultado({ ...res, date: form.date, empresa: empresa?.name || 'Empresa' });
    setSelecionados([]);
    try {
      const fresh = await fetchDemands();
      if (fresh?.length) setDemands(fresh);
    } catch { /* o lançamento já foi gravado; a lista se atualiza ao recarregar */ }
  };

  const nDiarias = selecionados.length;

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
        <CalendarPlus size={13} style={{ color: '#94A3B8' }} />
        <span style={{ fontSize: '11px', color: '#94A3B8', marginRight: 'auto' }}>
          A diária entra como finalizada e passa a contar na folha do período.
        </span>
        <button type="button" onClick={lancar} disabled={saving || nDiarias === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 22px', borderRadius: '10px', border: 'none',
            cursor: saving || nDiarias === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 800,
            background: saving || nDiarias === 0 ? '#E2E8F0' : '#BC4A2A',
            color: saving || nDiarias === 0 ? '#94A3B8' : 'white',
          }}>
          {saving ? <><Loader2 size={14} className="animate-spin" /> Lançando...</> : <><CalendarPlus size={14} /> Lançar {nDiarias > 0 ? nDiarias : ''} diária{nDiarias !== 1 ? 's' : ''}</>}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)' }}>
        <Info size={13} style={{ color: '#64748B', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.5 }}>
          Use esta sub-aba só para dias esquecidos. Para escalar ajudantes em um dia novo, use a sub-aba
          <b> Convocação</b>. Quem já estiver lançado nesse dia é ignorado, para não duplicar a diária.
        </p>
      </div>
    </div>
  );
}
