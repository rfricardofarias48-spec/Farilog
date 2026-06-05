import { useState, useEffect } from 'react';
import { fetchSolicitacoesAjudantes, updateStatusSolicitacao } from '../../lib/db';
import { Users, MapPin, Briefcase, Hash, Clock, CheckCircle2, RefreshCw } from 'lucide-react';

const STATUS_CFG = {
  pendente:      { label: 'Pendente',      color: '#D97706', bg: '#FEF3C7' },
  em_andamento:  { label: 'Em andamento',  color: '#2563EB', bg: '#DBEAFE' },
  concluido:     { label: 'Concluído',     color: '#059669', bg: '#DCFCE7' },
};

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RHSolicitacoes() {
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filtro, setFiltro]             = useState('todos');

  const load = () => {
    setLoading(true);
    fetchSolicitacoesAjudantes().then(data => { setSolicitacoes(data); setLoading(false); });
  };

  useEffect(() => { load(); }, []);

  const handleStatus = async (id, status) => {
    await updateStatusSolicitacao(id, status);
    load();
  };

  const filtradas = filtro === 'todos'
    ? solicitacoes
    : solicitacoes.filter(s => s.status === filtro);

  const counts = {
    pendente:     solicitacoes.filter(s => s.status === 'pendente').length,
    em_andamento: solicitacoes.filter(s => s.status === 'em_andamento').length,
    concluido:    solicitacoes.filter(s => s.status === 'concluido').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Solicitações de Ajudantes</h1>
        <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Pedidos enviados pelos líderes de equipe para recrutamento</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
        {[
          { key: 'pendente',     label: 'Pendentes',      color: '#D97706' },
          { key: 'em_andamento', label: 'Em andamento',   color: '#2563EB' },
          { key: 'concluido',    label: 'Concluídos',     color: '#059669' },
        ].map(k => (
          <div key={k.key} className="card" style={{ padding: '16px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '6px' }}>{k.label}</p>
            <p style={{ fontSize: '28px', fontWeight: 800, color: k.color, lineHeight: 1 }}>{counts[k.key]}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '12px', background: '#F1F5F9', width: 'fit-content' }}>
        {[['todos','Todos'], ['pendente','Pendentes'], ['em_andamento','Em andamento'], ['concluido','Concluídos']].map(([val, lbl]) => (
          <button key={val} onClick={() => setFiltro(val)}
            style={{ padding: '6px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, background: filtro === val ? 'white' : 'transparent', color: filtro === val ? '#0F172A' : '#94A3B8', boxShadow: filtro === val ? '0 1px 4px rgba(0,0,0,0.10)' : 'none', transition: 'all 0.15s' }}>
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
          <Users size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
          <p style={{ color: '#94A3B8', fontSize: '14px' }}>Nenhuma solicitação {filtro !== 'todos' ? 'neste status' : 'ainda'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(sol => {
            const cfg = STATUS_CFG[sol.status] || STATUS_CFG.pendente;
            return (
              <div key={sol.id} className="card p-5">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', marginBottom: '14px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '8px', background: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                      <span style={{ fontSize: '12px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} /> {fmtDateTime(sol.criadoEm)}
                      </span>
                    </div>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748B' }}>
                      Líder: <span style={{ color: '#0F172A' }}>{sol.liderNome}</span>
                    </p>
                  </div>
                </div>

                {/* Detalhes */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: sol.observacoes ? '12px' : 0 }}>
                  <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={10} /> Cidade
                    </p>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{sol.cidade}</p>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Briefcase size={10} /> Função
                    </p>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{sol.funcao}</p>
                  </div>
                  <div style={{ padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.07)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Hash size={10} /> Quantidade
                    </p>
                    <p style={{ fontSize: '24px', fontWeight: 800, color: '#FF4D0C', lineHeight: 1 }}>{sol.quantidade}</p>
                  </div>
                </div>

                {sol.observacoes && (
                  <p style={{ fontSize: '13px', color: '#475569', fontStyle: 'italic', marginBottom: '14px', padding: '10px 12px', borderRadius: '10px', background: '#FFFBEB', border: '1px solid #FDE68A' }}>
                    "{sol.observacoes}"
                  </p>
                )}

                {/* Ações de status */}
                {sol.status !== 'concluido' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {sol.status === 'pendente' && (
                      <button onClick={() => handleStatus(sol.id, 'em_andamento')}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '9px', background: '#DBEAFE', color: '#2563EB', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                        <RefreshCw size={13} /> Iniciar recrutamento
                      </button>
                    )}
                    {sol.status === 'em_andamento' && (
                      <button onClick={() => handleStatus(sol.id, 'concluido')}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '9px', background: '#DCFCE7', color: '#059669', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700 }}>
                        <CheckCircle2 size={13} /> Marcar como concluído
                      </button>
                    )}
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
