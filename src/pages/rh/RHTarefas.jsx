import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { fetchAjudantesSemPontoHoje } from '../../lib/db';
import { CheckCircle2, Circle, Plus, X, AlertTriangle, Clock } from 'lucide-react';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const PRIORIDADE = {
  alta:   { label: 'Alta',   color: '#E11D48', bg: '#FFE4E6' },
  normal: { label: 'Normal', color: '#D97706', bg: '#FEF3C7' },
  baixa:  { label: 'Baixa',  color: '#64748B', bg: '#F1F5F9' },
};

export default function RHTarefas() {
  const { user, fetchTarefasRH, createTarefaRH, concluirTarefaRH } = useAuth();
  const [tarefas, setTarefas]         = useState([]);
  const [semPonto, setSemPonto]       = useState([]);
  const [showForm, setShowForm]       = useState(false);
  const [form, setForm]               = useState({ tipo: '', descricao: '', prioridade: 'normal' });
  const [loading, setLoading]         = useState(true);

  const load = () =>
    Promise.all([
      fetchTarefasRH().then(t => setTarefas(t || [])),
      fetchAjudantesSemPontoHoje(TODAY).then(s => setSemPonto(s || [])),
    ]).then(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.tipo.trim()) return;
    await createTarefaRH({ tipo: form.tipo, descricao: form.descricao, prioridade: form.prioridade });
    setForm({ tipo: '', descricao: '', prioridade: 'normal' });
    setShowForm(false);
    load();
  };

  const handleConcluir = async (id) => {
    await concluirTarefaRH(id);
    load();
  };

  const pendentes  = tarefas.filter(t => t.status !== 'concluido');
  const concluidas = tarefas.filter(t => t.status === 'concluido');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Tarefas</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
            {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
          <Plus size={15} /> Nova tarefa
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Nova Tarefa</p>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
              <X size={16} />
            </button>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>Título *</label>
            <input className="input-field" placeholder="Nome da tarefa" value={form.tipo}
              onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>Descrição</label>
            <textarea className="input-field" rows={3} placeholder="Detalhes opcionais..."
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              style={{ resize: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', display: 'block', marginBottom: '4px' }}>Prioridade</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {Object.entries(PRIORIDADE).map(([key, cfg]) => (
                <button key={key} type="button"
                  onClick={() => setForm(f => ({ ...f, prioridade: key }))}
                  style={{ flex: 1, padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', border: form.prioridade === key ? `2px solid ${cfg.color}` : '2px solid transparent', background: form.prioridade === key ? cfg.bg : '#F8FAFC', color: form.prioridade === key ? cfg.color : '#94A3B8' }}>
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, background: '#F1F5F9', color: '#64748B', border: 'none', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button type="submit"
              style={{ flex: 2, padding: '10px', borderRadius: '10px', fontSize: '13px', fontWeight: 700, background: '#FF4D0C', color: 'white', border: 'none', cursor: 'pointer' }}>
              Criar tarefa
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: '#94A3B8', fontSize: '13px' }}>Carregando...</p>
        </div>
      ) : (
        <>
          {/* Alertas automáticos — ajudantes sem ponto */}
          {semPonto.length > 0 && (
            <div style={{ borderRadius: '14px', border: '1px solid #FDE68A', background: '#FFFBEB', overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid #FDE68A' }}>
                <AlertTriangle size={14} style={{ color: '#D97706' }} />
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#D97706' }}>
                  {semPonto.length} ajudante{semPonto.length !== 1 ? 's' : ''} sem ponto hoje
                </p>
              </div>
              {semPonto.map((r, i) => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: i < semPonto.length - 1 ? '1px solid #FDE68A' : 'none' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: r.funcionarioCor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                    {r.funcionarioIni}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>{r.funcionarioNome}</p>
                    <p style={{ fontSize: '11px', color: '#92400E', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={10} /> Sem registro de entrada
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pendentes.length === 0 && concluidas.length === 0 && semPonto.length === 0 && (
            <div className="card" style={{ padding: '64px 24px', textAlign: 'center' }}>
              <Circle size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
              <p style={{ fontSize: '14px', color: '#94A3B8' }}>Nenhuma tarefa registrada</p>
            </div>
          )}

          {pendentes.length > 0 && (
            <div className="card overflow-hidden">
              {pendentes.map((t, i) => {
                const pri = PRIORIDADE[t.prioridade] || PRIORIDADE.normal;
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', borderBottom: i < pendentes.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                    <button onClick={() => handleConcluir(t.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#CBD5E1', paddingTop: '1px', flexShrink: 0 }}>
                      <Circle size={18} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A' }}>{t.tipo}</p>
                      {t.descricao && <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{t.descricao}</p>}
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: pri.bg, color: pri.color, flexShrink: 0 }}>
                      {pri.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {concluidas.length > 0 && (
            <div>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#94A3B8', marginBottom: '8px' }}>
                Concluídas ({concluidas.length})
              </p>
              <div className="card overflow-hidden">
                {concluidas.map((t, i) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: i < concluidas.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none', opacity: 0.5 }}>
                    <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
                    <p style={{ fontSize: '13px', fontWeight: 500, color: '#64748B', textDecoration: 'line-through' }}>{t.tipo}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
