import { useState, useEffect } from 'react';
import { fetchCandidatos, createCandidato, updateCandidatoStatus } from '../../lib/db';
import { Plus, X, CheckCircle2, XCircle, Clock, User, MapPin, Briefcase } from 'lucide-react';

const STATUS_CFG = {
  aguardando:  { label: 'Aguardando', color: '#D97706', bg: '#FEF3C7' },
  aprovado:    { label: 'Aprovado',   color: '#059669', bg: '#DCFCE7' },
  reprovado:   { label: 'Reprovado',  color: '#E11D48', bg: '#FFE4E6' },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function RHRecrutamento() {
  const [candidatos, setCandidatos] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [filtro, setFiltro]         = useState('aguardando');
  const [obs, setObs]               = useState({});
  const [form, setForm]             = useState({ nome: '', telefone: '', cidade: '', funcao: '', observacoes: '' });
  const [saving, setSaving]         = useState(false);

  const load = () => fetchCandidatos().then(d => { setCandidatos(d); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await createCandidato(form);
    setSaving(false);
    setForm({ nome: '', telefone: '', cidade: '', funcao: '', observacoes: '' });
    setShowForm(false);
    load();
  };

  const handleStatus = async (id, status) => {
    await updateCandidatoStatus(id, status, obs[id]);
    load();
  };

  const filtrados = filtro === 'todos' ? candidatos : candidatos.filter(c => c.status === filtro);
  const counts = {
    aguardando: candidatos.filter(c => c.status === 'aguardando').length,
    aprovado:   candidatos.filter(c => c.status === 'aprovado').length,
    reprovado:  candidatos.filter(c => c.status === 'reprovado').length,
  };

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Recrutamento</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Candidatos aguardando aprovação</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={15} /> Adicionar candidato
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        {[
          { key: 'aguardando', label: 'Aguardando', color: '#D97706' },
          { key: 'aprovado',   label: 'Aprovados',  color: '#059669' },
          { key: 'reprovado',  label: 'Reprovados', color: '#E11D48' },
        ].map(k => (
          <div key={k.key} className="card" style={{ padding: '16px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{counts[k.key]}</p>
          </div>
        ))}
      </div>

      {/* Formulário novo candidato */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4 animate-fade-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Novo Candidato</p>
            <button type="button" onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { key: 'nome',      label: 'Nome completo *', col: 2, required: true },
              { key: 'telefone',  label: 'Telefone (WhatsApp)', placeholder: '(00) 00000-0000' },
              { key: 'cidade',    label: 'Cidade' },
              { key: 'funcao',    label: 'Função pretendida' },
            ].map(({ key, label, col, required, placeholder }) => (
              <div key={key} style={{ gridColumn: col === 2 ? 'span 2' : undefined }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>{label}</label>
                <input className="input-field" required={required} placeholder={placeholder}
                  value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div style={{ gridColumn: 'span 2' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Observações</label>
              <textarea className="input-field" rows={2} style={{ resize: 'none' }}
                value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white' }}>
              {saving ? 'Salvando...' : 'Cadastrar candidato'}
            </button>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: '#F1F5F9', width: 'fit-content' }}>
        {[['aguardando','Aguardando'], ['aprovado','Aprovados'], ['reprovado','Reprovados'], ['todos','Todos']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFiltro(val)}
            style={{ padding: '6px 14px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: filtro === val ? 'white' : 'transparent', color: filtro === val ? '#0F172A' : '#94A3B8', boxShadow: filtro === val ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}><p style={{ color: '#94A3B8' }}>Carregando...</p></div>
      ) : filtrados.length === 0 ? (
        <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
          <User size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Nenhum candidato</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(c => {
            const cfg = STATUS_CFG[c.status] || STATUS_CFG.aguardando;
            return (
              <div key={c.id} className="card p-5">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>{c.nome}</p>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                      {c.cidade && <span style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={11} /> {c.cidade}</span>}
                      {c.funcao && <span style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={11} /> {c.funcao}</span>}
                      {c.telefone && <span style={{ fontSize: '12px', color: '#64748B' }}>{c.telefone}</span>}
                      <span style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={10} /> {fmtDate(c.criado_em)}</span>
                    </div>
                    {c.observacoes && <p style={{ fontSize: '12px', color: '#475569', marginTop: '6px', fontStyle: 'italic' }}>"{c.observacoes}"</p>}
                  </div>
                </div>

                {c.status === 'aguardando' && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input className="input-field" style={{ flex: 1, fontSize: '12px', padding: '7px 10px' }}
                      placeholder="Observação (opcional)..."
                      value={obs[c.id] || ''}
                      onChange={e => setObs(o => ({ ...o, [c.id]: e.target.value }))} />
                    <button onClick={() => handleStatus(c.id, 'aprovado')}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '9px', background: '#DCFCE7', color: '#059669', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                      <CheckCircle2 size={14} /> Aprovar
                    </button>
                    <button onClick={() => handleStatus(c.id, 'reprovado')}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '8px 14px', borderRadius: '9px', background: '#FFE4E6', color: '#E11D48', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                      <XCircle size={14} /> Reprovar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
