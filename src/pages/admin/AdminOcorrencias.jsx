import { useState, useEffect } from 'react';
import { fetchOcorrenciasAdmin, updateOcorrenciaStatusAdmin } from '../../lib/db';
import { AlertTriangle, CheckCircle2, Search, ExternalLink } from 'lucide-react';

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const DOW = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

function fmtDate(iso) {
  if (!iso) return '—';
  const [y,m,d] = iso.split('-');
  return `${DOW[new Date(`${iso}T12:00:00`).getDay()]}, ${d}/${m}/${y}`;
}

const STATUS = {
  aberto:    { label: 'Aberto',    color: '#D97706', bg: '#FEF3C7' },
  resolvido: { label: 'Resolvido', color: '#059669', bg: '#DCFCE7' },
};

export default function AdminOcorrencias() {
  const [ocorrencias, setOcorrencias] = useState([]);
  const [search, setSearch]           = useState('');
  const [filtro, setFiltro]           = useState('todos');
  const [loading, setLoading]         = useState(true);

  const load = () =>
    fetchOcorrenciasAdmin().then(o => { setOcorrencias(o); setLoading(false); });

  useEffect(() => { load(); }, []);

  const handleStatus = async (id, status) => {
    await updateOcorrenciaStatusAdmin(id, status);
    load();
  };

  const filtered = ocorrencias
    .filter(o => filtro === 'todos' || o.status === filtro)
    .filter(o =>
      o.ajudanteNome?.toLowerCase().includes(search.toLowerCase()) ||
      o.liderNome?.toLowerCase().includes(search.toLowerCase()) ||
      o.empresaNome?.toLowerCase().includes(search.toLowerCase()) ||
      o.descricao?.toLowerCase().includes(search.toLowerCase())
    );

  const abertos    = ocorrencias.filter(o => o.status === 'aberto').length;
  const resolvidos = ocorrencias.filter(o => o.status === 'resolvido').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#0F172A' }}>Ocorrências</h1>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            {abertos} aberta{abertos !== 1 ? 's' : ''} · {resolvidos} resolvida{resolvidos !== 1 ? 's' : ''}
          </p>
        </div>
        {abertos > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '10px', background: '#FEF3C7', border: '1px solid #FDE68A' }}>
            <AlertTriangle size={14} style={{ color: '#D97706' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#D97706' }}>{abertos} pendente{abertos !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Filtros + busca */}
      <div className="flex gap-3">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input className="input-field" style={{ paddingLeft: '32px' }} placeholder="Buscar por ajudante, líder, empresa..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          {[['todos','Todos'],['aberto','Abertos'],['resolvido','Resolvidos']].map(([v,l]) => (
            <button key={v} onClick={() => setFiltro(v)}
              style={{ padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', background: filtro === v ? '#0F172A' : '#F1F5F9', color: filtro === v ? 'white' : '#64748B' }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm" style={{ color: '#94A3B8' }}>Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-14 text-center">
          <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>Nenhuma ocorrência encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const st = STATUS[o.status] || STATUS.aberto;
            return (
              <div key={o.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: o.ajudanteCor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {o.ajudanteIni}
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{o.ajudanteNome}</p>
                      <p style={{ fontSize: '11px', color: '#64748B' }}>
                        {fmtDate(o.data)} · Líder: {o.liderNome} · {o.empresaNome}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px', background: st.bg, color: st.color, flexShrink: 0 }}>
                    {st.label}
                  </span>
                </div>

                <p style={{ fontSize: '13px', color: '#334155', lineHeight: 1.6, paddingLeft: '44px' }}>
                  {o.descricao}
                </p>

                {o.foto_url && (
                  <a href={o.foto_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600, color: '#2563EB', paddingLeft: '44px' }}>
                    <ExternalLink size={12} /> Ver foto
                  </a>
                )}

                {o.status === 'aberto' && (
                  <div style={{ paddingLeft: '44px' }}>
                    <button onClick={() => handleStatus(o.id, 'resolvido')}
                      style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, background: '#DCFCE7', color: '#059669', border: 'none', cursor: 'pointer' }}>
                      Marcar como resolvido
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
