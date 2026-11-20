import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Sparkles, MapPin, CheckCircle2, Loader2, Users } from 'lucide-react';
import { fetchCandidatosEscala } from '../../lib/db';
import { fmtDataCurta, fmtNota, notaCor } from '../../lib/notas';
import { NotaBadge, StarsDisplay } from './StarRating';
import WhatsAppButton from './WhatsAppButton';

const PROX_STYLE = {
  0: { bg: '#0B0B0B', color: '#FFFFFF', border: '1px solid #0B0B0B', label: 'Mesma cidade' },
  1: { bg: '#F4F4F5', color: '#4A4A4A', border: '1px solid #F4F4F5', label: 'Mesma UF' },
  2: { bg: '#FFFFFF', color: '#6B6B6B', border: '1px solid #E6E6E6', label: 'Outra cidade' },
  3: { bg: '#FAF4F1', color: '#9E3D22', border: '1px solid #E4C9BF', label: 'Cidade não informada' },
};

export default function SugestaoAjudantesModal({
  companyId,
  date,
  selectedIds = [],
  onAdd,
  onClose,
}) {
  const [loading, setLoading]   = useState(true);
  const [data, setData]         = useState({ company: null, candidates: [], escaladosNoDia: 0 });
  const [selected, setSelected] = useState([]);
  const [search, setSearch]     = useState('');

  useEffect(() => {
    let alive = true;
    if (!companyId || !date) { setLoading(false); return undefined; }
    setLoading(true);
    fetchCandidatosEscala({ companyId, date }).then(res => {
      if (!alive) return;
      setData(res);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [companyId, date]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const candidatos = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.candidates;
    return data.candidates.filter(c =>
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.cidade || '').toLowerCase().includes(q) ||
      String(c.cargo || '').toLowerCase().includes(q)
    );
  }, [data.candidates, search]);

  const toggle = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selecionarVisiveis = () => {
    setSelected(prev => Array.from(new Set([...prev, ...candidatos.map(c => c.id)])));
  };

  const empresa = data.company;
  const jaNaEquipe = useMemo(() => new Set(selectedIds), [selectedIds]);
  const msgPadrao = (c) => {
    const primeiro = String(c.name || '').split(' ')[0];
    return `Olá ${primeiro}, tudo bem? Aqui é da FariLog. Temos uma diária em ${empresa?.name || 'nossa empresa'} no dia ${fmtDataCurta(date)}. Podemos contar com você?`;
  };

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1250,
        background: 'rgba(11, 11, 11,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '22px', width: '100%', maxWidth: '780px',
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 32px 90px rgba(0,0,0,0.32)', border: '1px solid rgba(0,0,0,0.06)',
      }}>
        {/* Cabeçalho */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: '#0B0B0B', color: '#FFFFFF', padding: '3px 8px',
                  borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  <Sparkles size={11} /> Sugestão automática
                </span>
                <span style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 600 }}>{fmtDataCurta(date)}</span>
              </div>
              <p style={{ fontSize: '17px', fontWeight: 800, color: '#0B0B0B', marginTop: '5px' }}>
                Ajudantes sugeridos para {empresa?.name || 'a empresa'}
              </p>
              <p style={{ fontSize: '11px', color: '#6B6B6B', marginTop: '2px', lineHeight: 1.5 }}>
                Ordem: <b>proximidade da empresa</b> → <b>nota média</b>. Quem já está escalado neste dia não aparece.
                {empresa?.city ? ` Cidade da empresa: ${empresa.city}.` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                background: '#F5F5F5', color: '#6B6B6B', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Busca + selecionar todos */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9A9A9A' }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome, cidade ou cargo..."
                className="input-field"
                style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
              />
            </div>
            <button
              type="button"
              onClick={selecionarVisiveis}
              disabled={candidatos.length === 0}
              style={{
                padding: '7px 11px', borderRadius: '8px', border: '1px solid #E4E4E4',
                background: '#fff', color: '#4A4A4A', fontSize: '11px', fontWeight: 700,
                cursor: candidatos.length === 0 ? 'not-allowed' : 'pointer', flexShrink: 0,
                opacity: candidatos.length === 0 ? 0.5 : 1,
              }}
            >
              Selecionar visíveis ({candidatos.length})
            </button>
          </div>
        </div>

        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!companyId || !date ? (
            <div style={{ padding: '52px 20px', textAlign: 'center' }}>
              <Users size={30} style={{ color: '#C8C8C8', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#6B6B6B' }}>Selecione a empresa e a data primeiro</p>
              <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '3px' }}>
                A sugestão usa a cidade da empresa e o dia do serviço para filtrar os candidatos.
              </p>
            </div>
          ) : loading ? (
            <div style={{ padding: '52px 20px', textAlign: 'center', color: '#9A9A9A', fontSize: '13px' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              Buscando ajudantes próximos e calculando o ranking...
            </div>
          ) : candidatos.length === 0 ? (
            <div style={{ padding: '52px 20px', textAlign: 'center' }}>
              <Users size={30} style={{ color: '#C8C8C8', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#6B6B6B' }}>Nenhum candidato disponível</p>
              <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '3px' }}>
                Todos os ajudantes ativos já estão escalados neste dia ou nenhum atende à busca.
              </p>
            </div>
          ) : candidatos.map((c, idx) => {
            const isSel = selected.includes(c.id);
            const prox = PROX_STYLE[c.proximidadeLevel] || PROX_STYLE[3];
            return (
              <div
                key={c.id}
                onClick={() => toggle(c.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '11px 22px', cursor: 'pointer',
                  background: isSel ? '#FAF4F1' : '#fff',
                  borderBottom: '1px solid rgba(0,0,0,0.05)',
                  borderLeft: isSel ? '3px solid #BC4A2A' : '3px solid transparent',
                  transition: 'background .12s',
                }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = '#F7F7F7'; }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = '#fff'; }}
              >
                {/* posição */}
                <span style={{
                  fontSize: '10px', fontWeight: 800, color: '#9A9A9A',
                  width: '18px', textAlign: 'center', flexShrink: 0,
                }}>
                  {idx + 1}º
                </span>

                {/* checkbox */}
                <div style={{
                  width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                  border: isSel ? 'none' : '1.5px solid #C8C8C8',
                  background: isSel ? '#0B0B0B' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSel && <CheckCircle2 size={14} color="#fff" />}
                </div>

                {/* avatar */}
                <div style={{
                  width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                  background: c.color || '#9A9A9A', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 800,
                }}>
                  {c.initials || '?'}
                </div>

                {/* nome / cidade */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '13px', fontWeight: 800, color: '#0B0B0B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </p>
                    <span style={{
                      fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                      background: prox.bg, color: prox.color, border: prox.border,
                    }}>
                      {c.proximidadeLabel || prox.label}
                    </span>
                    {jaNaEquipe.has(c.id) && (
                      <span style={{
                        fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                        background: '#F4F4F5', color: '#4A4A4A',
                      }}>
                        já na equipe
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#6B6B6B' }}>
                      <MapPin size={10} /> {c.cidade || 'cidade não informada'}
                    </span>
                    <span style={{ fontSize: '10px', color: '#9A9A9A' }}>· {c.cargo || 'Ajudante'}</span>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#4A4A4A' }}>R$ {c.dailyRate || 0}/dia</span>
                  </div>
                </div>

                {/* nota */}
                <div style={{ textAlign: 'center', flexShrink: 0, minWidth: '92px' }}>
                  {c.media == null ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: '6px', background: '#F4F4F5', color: '#9A9A9A', fontSize: '10px', fontWeight: 700 }}>
                      Sem nota
                    </span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                      <NotaBadge media={c.media} total={c.totalAvaliacoes} size={10} />
                      <span style={{ fontSize: '9px', color: notaCor(c.media), fontWeight: 600 }}>
                        {c.totalAvaliacoes} avaliaç{c.totalAvaliacoes === 1 ? 'ão' : 'ões'}
                      </span>
                    </div>
                  )}
                </div>

                {/* contato */}
                <div style={{ flexShrink: 0 }}>
                  <WhatsAppButton
                    phone={c.phone}
                    message={msgPadrao(c)}
                    label="Contato"
                    compact
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <div style={{
          padding: '13px 22px', borderTop: '1px solid rgba(0,0,0,0.06)',
          background: '#FAFAFA', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: '12px', flexShrink: 0,
        }}>
          <div>
            <p style={{ fontSize: '12px', fontWeight: 800, color: '#0B0B0B' }}>
              {selected.length} selecionado{selected.length === 1 ? '' : 's'}
            </p>
            <p style={{ fontSize: '10px', color: '#9A9A9A' }}>
              {data.escaladosNoDia} ajudante{data.escaladosNoDia === 1 ? '' : 's'} já escalado{data.escaladosNoDia === 1 ? '' : 's'} neste dia
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px', borderRadius: '10px', border: '1px solid #C8C8C8',
                background: '#fff', color: '#6B6B6B', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => { onAdd?.(selected); onClose?.(); }}
              disabled={selected.length === 0}
              style={{
                padding: '9px 20px', borderRadius: '10px', border: 'none',
                background: selected.length === 0 ? '#C8C8C8' : '#BC4A2A',
                color: '#fff', fontSize: '12px', fontWeight: 800,
                cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
                boxShadow: selected.length === 0 ? 'none' : '0 3px 12px rgba(188,74,42,0.3)',
              }}
            >
              Adicionar {selected.length > 0 ? selected.length : ''} à equipe
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}