import { useState, useEffect } from 'react';
import { createTarefaAdmin, fetchTodasTarefasAdmin, fetchLideres } from '../../lib/db';
import { Plus, X, CheckCircle2, Circle, Clock, Users, User, Briefcase } from 'lucide-react';

const PRIORIDADE = {
  alta:   { label: 'Alta',   color: '#E11D48', bg: '#FFE4E6' },
  normal: { label: 'Normal', color: '#D97706', bg: '#FEF3C7' },
  baixa:  { label: 'Baixa',  color: '#64748B', bg: '#F1F5F9' },
};

const DEST_TIPOS = [
  { value: 'rh',           label: 'RH',                icon: Briefcase },
  { value: 'todos_lideres',label: 'Todos os Líderes',  icon: Users     },
  { value: 'lider',        label: 'Líder específico',  icon: User      },
];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function AdminTarefas() {
  const [tarefas, setTarefas]   = useState([]);
  const [lideres, setLideres]   = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [filtro, setFiltro]     = useState('todos');

  const [form, setForm] = useState({
    titulo: '', descricao: '', prioridade: 'normal',
    destinatarioTipo: 'rh', destinatarioId: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      fetchTodasTarefasAdmin().then(setTarefas),
      fetchLideres().then(setLideres),
    ]).then(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.titulo.trim()) return;
    if (form.destinatarioTipo === 'lider' && !form.destinatarioId) return alert('Selecione o líder.');
    setSaving(true);
    await createTarefaAdmin({
      titulo:           form.titulo,
      descricao:        form.descricao,
      prioridade:       form.prioridade,
      destinatarioTipo: form.destinatarioTipo,
      destinatarioId:   form.destinatarioTipo === 'lider' ? form.destinatarioId : null,
    });
    setSaving(false);
    setForm({ titulo: '', descricao: '', prioridade: 'normal', destinatarioTipo: 'rh', destinatarioId: '' });
    setShowForm(false);
    load();
  };

  const filtradas = filtro === 'todos' ? tarefas
    : filtro === 'pendente' ? tarefas.filter(t => t.status !== 'concluido')
    : tarefas.filter(t => t.status === 'concluido');

  const pendentes  = tarefas.filter(t => t.status !== 'concluido').length;
  const concluidas = tarefas.filter(t => t.status === 'concluido').length;

  return (
    <div className="space-y-6">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Tarefas</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
            Envie tarefas para líderes ou o RH acompanharem
          </p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={15} /> Nova tarefa
        </button>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        {[
          { label: 'Total',      value: tarefas.length, color: '#0F172A' },
          { label: 'Pendentes',  value: pendentes,      color: '#D97706' },
          { label: 'Concluídas', value: concluidas,     color: '#059669' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: '16px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4 animate-fade-up">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>Nova Tarefa</p>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
              <X size={16} />
            </button>
          </div>

          {/* Destinatário */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Enviar para *</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {DEST_TIPOS.map(({ value, label, icon: Icon }) => {
                const sel = form.destinatarioTipo === value;
                return (
                  <button key={value} type="button"
                    onClick={() => setForm(f => ({ ...f, destinatarioTipo: value, destinatarioId: '' }))}
                    style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '10px', border: `2px solid ${sel ? '#FF4D0C' : 'rgba(0,0,0,0.1)'}`, background: sel ? '#FFF5F2' : 'white', cursor: 'pointer' }}>
                    <Icon size={13} style={{ color: sel ? '#FF4D0C' : '#94A3B8' }} />
                    <span style={{ fontSize: '13px', fontWeight: 700, color: sel ? '#FF4D0C' : '#0F172A' }}>{label}</span>
                  </button>
                );
              })}
            </div>
            {form.destinatarioTipo === 'lider' && (
              <select className="input-field" style={{ marginTop: '8px' }} required
                value={form.destinatarioId} onChange={e => setForm(f => ({ ...f, destinatarioId: e.target.value }))}>
                <option value="">Selecione o líder...</option>
                {lideres.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
              </select>
            )}
          </div>

          {/* Título */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Título *</label>
            <input className="input-field" placeholder="Ex: Verificar presença de sexta..." required
              value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>

          {/* Descrição */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>Descrição (opcional)</label>
            <textarea className="input-field" rows={3} style={{ resize: 'none' }}
              placeholder="Detalhes adicionais sobre a tarefa..."
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>

          {/* Prioridade */}
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '6px' }}>Prioridade</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.entries(PRIORIDADE).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setForm(f => ({ ...f, prioridade: key }))}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: form.prioridade === key ? `2px solid ${cfg.color}` : '2px solid transparent', background: form.prioridade === key ? cfg.bg : '#F8FAFC', color: form.prioridade === key ? cfg.color : '#94A3B8' }}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700, background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white' }}>
              {saving ? 'Enviando...' : 'Enviar tarefa'}
            </button>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: '#F1F5F9', width: 'fit-content' }}>
        {[['todos','Todas'], ['pendente','Pendentes'], ['concluido','Concluídas']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFiltro(val)}
            style={{ padding: '6px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: filtro === val ? 'white' : 'transparent', color: filtro === val ? '#0F172A' : '#94A3B8', boxShadow: filtro === val ? '0 1px 4px rgba(0,0,0,0.10)' : 'none' }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>Carregando...</p>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
          <Circle size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Nenhuma tarefa</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {filtradas.map((t, idx) => {
            const pri  = PRIORIDADE[t.prioridade] || PRIORIDADE.normal;
            const done = t.status === 'concluido';
            return (
              <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', borderBottom: idx < filtradas.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none', opacity: done ? 0.55 : 1 }}>
                {done
                  ? <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0, marginTop: '1px' }} />
                  : <Circle size={18} style={{ color: '#CBD5E1', flexShrink: 0, marginTop: '1px' }} />
                }
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', textDecoration: done ? 'line-through' : 'none' }}>{t.titulo}</p>
                  {t.descricao && <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{t.descricao}</p>}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={10} /> {fmtDate(t.criado_em)}
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#F1F5F9', color: '#64748B' }}>
                      → {t.destinatarioNome}
                    </span>
                  </div>
                </div>
                <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: pri.bg, color: pri.color, flexShrink: 0 }}>
                  {pri.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
