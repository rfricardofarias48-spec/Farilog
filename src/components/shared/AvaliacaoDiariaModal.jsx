import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Star, Loader2, CheckCircle2, AlertTriangle, MessageSquare } from 'lucide-react';
import { fetchNotasByEscala, upsertNotaDiaria } from '../../lib/db';
import { fmtDataCurta } from '../../lib/notas';
import { useAuth } from '../../context/AuthContext';
import StarRating from './StarRating';

const STATUS_LABEL = {
  aguardando: 'Aguardando',
  confirmado: 'Confirmado',
  atrasado:   'Atrasado',
  falta:      'Falta',
  finalizado: 'Finalizado',
};

export default function AvaliacaoDiariaModal({
  escala,
  employees = [],
  onClose,
  onSaved,
  liderId = null,
  avaliadorNome = null,
  avaliadorTipo = null,
}) {
  const { user } = useAuth();
  const [ratings, setRatings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const rows = (escala?.employees || []).map(item => ({
    ...item,
    employee: employees.find(e => e.id === item.employeeId) || null,
  }));

  const load = useCallback(async () => {
    if (!escala?.id) { setLoading(false); return; }
    setLoading(true);
    const list = await fetchNotasByEscala(escala.id);
    const map = {};
    list.forEach(n => {
      map[n.funcionarioId] = { nota: n.nota, observacao: n.observacao || '', existente: true };
    });
    setRatings(map);
    setLoading(false);
  }, [escala?.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving) onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const update = (empId, patch) => {
    setRatings(prev => ({
      ...prev,
      [empId]: { ...(prev[empId] || { nota: null, observacao: '' }), ...patch },
    }));
  };

  const preenchidos = rows.filter(r => ratings[r.employeeId]?.nota !== null && ratings[r.employeeId]?.nota !== undefined);
  const total = rows.length;
  const progresso = total > 0 ? Math.round((preenchidos.length / total) * 100) : 0;

  const handleSave = async () => {
    setError('');
    if (preenchidos.length === 0) {
      setError('Informe pelo menos uma nota antes de salvar.');
      return;
    }
    const pendentes = total - preenchidos.length;
    if (pendentes > 0) {
      const ok = window.confirm(
        `Ainda faltam ${pendentes} ajudante(s) sem nota.\n\nSalvar mesmo assim? Você poderá completar depois.`
      );
      if (!ok) return;
    }

    setSaving(true);
    const nome = avaliadorNome || user?.name || user?.nome || 'Encarregado';
    const tipo = avaliadorTipo || (user?.role === 'admin' ? 'admin' : 'encarregado');

    const results = await Promise.all(preenchidos.map(r => {
      const rating = ratings[r.employeeId];
      return upsertNotaDiaria({
        escalaId:        escala.id,
        registroId:      null,
        funcionarioId:   r.employeeId,
        empresaId:       escala.companyId || null,
        liderId:         liderId || escala.liderId || null,
        data:            escala.date,
        nota:            rating.nota,
        observacao:      rating.observacao,
        avaliadoPorTipo: tipo,
        avaliadoPorNome: nome,
      });
    }));

    setSaving(false);

    if (results.some(r => !r)) {
      setError('Não foi possível salvar todas as notas. Verifique se o arquivo supabase/notas-ajudantes.sql já foi executado no SQL Editor do Supabase.');
      return;
    }

    onSaved?.();
    onClose?.();
  };

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !saving) onClose?.(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1300,
        background: 'rgba(11, 11, 11,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
    >
      <div style={{
        background: '#fff', borderRadius: '22px', width: '100%', maxWidth: '720px',
        maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 32px 90px rgba(0,0,0,0.32)', border: '1px solid rgba(0,0,0,0.06)',
      }}>
        {/* Cabeçalho */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  background: '#0B0B0B', color: '#FFFFFF', padding: '3px 8px',
                  borderRadius: '6px', fontSize: '10px', fontWeight: 800,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  <Star size={11} /> Notas da diária
                </span>
                <span style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 600 }}>{fmtDataCurta(escala?.date)}</span>
              </div>
              <p style={{ fontSize: '17px', fontWeight: 800, color: '#0B0B0B', marginTop: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {escala?.companyName || 'Empresa'}
              </p>
              <p style={{ fontSize: '11px', color: '#6B6B6B', marginTop: '2px' }}>
                {escala?.service || 'Serviço operacional'} · {total} ajudante{total === 1 ? '' : 's'} escalado{total === 1 ? '' : 's'}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={saving}
              style={{
                width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                background: '#F5F5F5', color: '#6B6B6B', cursor: saving ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <X size={15} />
            </button>
          </div>

          {/* Progresso */}
          <div style={{ marginTop: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
              <span style={{ fontSize: '10px', fontWeight: 800, color: '#0B0B0B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {preenchidos.length} de {total} avaliados
              </span>
              <span style={{ fontSize: '10px', color: '#9A9A9A' }}>{progresso}%</span>
            </div>
            <div style={{ height: '7px', borderRadius: '99px', background: '#E6E6E6', overflow: 'hidden' }}>
              <div style={{
                width: `${progresso}%`, height: '100%', borderRadius: '99px',
                background: '#BC4A2A',
                transition: 'width .25s',
              }} />
            </div>
          </div>
        </div>

        {/* Lista */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '56px 20px', textAlign: 'center', color: '#9A9A9A', fontSize: '13px' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              Carregando notas já lançadas...
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: '#9A9A9A', fontSize: '13px' }}>
              Nenhum ajudante escalado nesta diária.
            </div>
          ) : rows.map(r => {
            const emp = r.employee;
            const rating = ratings[r.employeeId] || { nota: null, observacao: '' };
            const isFalta = r.status === 'falta';
            return (
              <div key={r.employeeId} style={{
                padding: '14px 22px', borderBottom: '1px solid rgba(0,0,0,0.055)',
                background: isFalta ? '#FAFAFA' : '#fff',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                  <div style={{
                    width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
                    background: emp?.color || '#9A9A9A', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 800,
                  }}>
                    {emp?.initials || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: '#0B0B0B' }}>
                        {emp?.name || r.employeeId}
                      </p>
                      {r.status && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px',
                          background: isFalta ? '#0B0B0B' : r.status === 'finalizado' ? '#F4F4F5' : '#FFFFFF',
                          color: isFalta ? '#FFFFFF' : r.status === 'finalizado' ? '#4A4A4A' : '#6B6B6B',
                          border: isFalta ? '1px solid #0B0B0B' : '1px solid #E6E6E6',
                        }}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      )}
                      {rating.existente && rating.nota !== null && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '9px', fontWeight: 700, color: '#4A4A4A' }}>
                          <CheckCircle2 size={10} style={{ color: '#0B0B0B' }} /> nota lançada
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '10px', color: '#9A9A9A', marginTop: '1px' }}>
                      Diária: R$ {emp?.dailyRate ?? '—'}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    <StarRating
                      value={rating.nota}
                      onChange={(n) => update(r.employeeId, { nota: n })}
                      size={20}
                      showValue
                    />
                  </div>
                </div>

                <div style={{ marginTop: '9px', marginLeft: '49px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px' }}>
                    <MessageSquare size={11} style={{ color: '#9A9A9A' }} />
                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Observação
                    </span>
                  </div>
                  <textarea
                    value={rating.observacao || ''}
                    onChange={e => update(r.employeeId, { observacao: e.target.value })}
                    placeholder="Ex.: pontual, organizado, bom atendimento ao cliente..."
                    rows={2}
                    style={{
                      width: '100%', resize: 'vertical', minHeight: '46px',
                      padding: '8px 10px', borderRadius: '9px',
                      border: '1px solid #E4E4E4', background: '#F7F7F7',
                      fontSize: '11px', color: '#333333', lineHeight: 1.5,
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <div style={{ padding: '13px 22px', borderTop: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA', flexShrink: 0 }}>
          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '7px',
              padding: '8px 10px', borderRadius: '8px', background: '#FAF4F1',
              border: '1px solid #E4C9BF', marginBottom: '9px',
            }}>
              <AlertTriangle size={13} style={{ color: '#9E3D22', flexShrink: 0, marginTop: '1px' }} />
              <p style={{ fontSize: '11px', color: '#9E3D22', lineHeight: 1.4 }}>{error}</p>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
            <p style={{ fontSize: '10px', color: '#9A9A9A', lineHeight: 1.4, maxWidth: '360px' }}>
              Notas de <b>0 a 5</b>. Cada nota atualiza automaticamente a média do ajudante.
            </p>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: '9px 16px', borderRadius: '10px', border: '1px solid #C8C8C8',
                  background: '#fff', color: '#6B6B6B', fontSize: '12px', fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || rows.length === 0}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 20px', borderRadius: '10px', border: 'none',
                  background: saving || rows.length === 0 ? '#C8C8C8' : '#BC4A2A',
                  color: '#fff', fontSize: '12px', fontWeight: 800,
                  cursor: saving || rows.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: saving || rows.length === 0 ? 'none' : '0 3px 12px rgba(188,74,42,0.3)',
                }}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Star size={13} />}
                {saving ? 'Salvando...' : 'Salvar notas'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}