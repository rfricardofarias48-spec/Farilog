import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, MapPin, ArrowRight, Users } from 'lucide-react';
import MapaAjudantes from './MapaAjudantes';
import { fmtDistancia, rotuloDistancia } from '../../lib/geo';
import { fmtNota } from '../../lib/notas';

// Tela "estilo Uber": mapa da região + animação de busca (~10s) montando a
// lista de candidatos em tempo real, do mais próximo para o mais distante.
export default function BuscaAjudantes({ empresa, candidatos = [], durante = 10000, onConcluir }) {
  // Ordem de revelação = distância crescente (mesma 1ª prioridade do ranking).
  const ordenados = useMemo(
    () => [...candidatos].sort((a, b) => (a.distanciaKm ?? Infinity) - (b.distanciaKm ?? Infinity)),
    [candidatos]
  );

  const total    = ordenados.length;
  const intervalo = total ? Math.max(200, Math.round(durante / total)) : 0;

  const [revelados, setRevelados] = useState(0);
  const [feito, setFeito]         = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    setRevelados(0);
    setFeito(total === 0);
    if (!total) return undefined;
    timer.current = setInterval(() => {
      setRevelados(prev => {
        if (prev + 1 >= total) { clearInterval(timer.current); setFeito(true); return total; }
        return prev + 1;
      });
    }, intervalo);
    return () => clearInterval(timer.current);
  }, [total, intervalo]);

  const visiveis  = ordenados.slice(0, revelados);
  const pontos    = visiveis.map(c => ({ ...c, coords: c.coords }));
  const maisPerto = visiveis.length ? Math.min(...visiveis.map(v => v.distanciaKm ?? Infinity)) : null;
  const progresso = total ? Math.round((revelados / total) * 100) : 100;

  return (
    <div className="animate-fade-up" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Cabeçalho da busca */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
        <span className="animate-pulse-slow" style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF4D0C', boxShadow: '0 0 0 4px rgba(255,77,12,0.15)', flexShrink: 0 }} />
        <p style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
          {feito ? 'Busca concluída' : 'Buscando ajudantes próximos e ativos…'}
        </p>
      </div>

      <MapaAjudantes
        empresa={empresa}
        pontos={pontos}
        raioKm={empresa?.raioKm || null}
        altura={280}
        interativo={false}
        assinatura={revelados}
      />

      {/* Localização + progresso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
          <MapPin size={12} /> {empresa?.city || 'Região da empresa'}
          {empresa?.raioKm ? ` · raio ${empresa.raioKm} km` : ''}
        </span>
        <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600, marginLeft: 'auto' }}>
          {revelados} de {total} encontrados
        </span>
      </div>

      <div style={{ height: '7px', borderRadius: '99px', background: '#E2E8F0', overflow: 'hidden' }}>
        <div style={{ width: `${progresso}%`, height: '100%', background: '#FF4D0C', borderRadius: '99px', transition: 'width .25s linear' }} />
      </div>

      {/* Feed da busca */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '42px' }}>
        {total === 0 ? (
          <p style={{ fontSize: '12px', color: '#94A3B8', textAlign: 'center', padding: '8px 0' }}>
            Nenhum ajudante ativo disponível nesta data.
          </p>
        ) : feito ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 12px', borderRadius: '10px', background: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <CheckCircle2 size={14} style={{ color: '#047857' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#047857' }}>
              {total} ajudante{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''} · mais próximo a {fmtDistancia(maisPerto)}
            </span>
          </div>
        ) : (
          visiveis.slice(-3).reverse().map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', borderRadius: '9px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: c.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {c.initials}
              </div>
              <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              <span style={{ fontSize: '10px', color: '#64748B', fontWeight: 600 }}>{rotuloDistancia(c.distanciaKm, c.distanciaExata, c.proximidadeLabel)}</span>
              <span style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600 }}>{c.media == null ? '—' : `★ ${fmtNota(c.media)}`}</span>
            </div>
          ))
        )}
      </div>

      <button type="button" onClick={() => onConcluir?.()} disabled={!feito}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '12px', borderRadius: '11px', border: 'none', fontSize: '13px', fontWeight: 800, cursor: feito ? 'pointer' : 'not-allowed', background: feito ? '#FF4D0C' : '#E2E8F0', color: feito ? 'white' : '#94A3B8', marginTop: '2px' }}>
        <Users size={15} /> {feito ? 'Ver lista de possíveis convocados' : 'Analisando…'} {feito && <ArrowRight size={14} />}
      </button>
    </div>
  );
}
