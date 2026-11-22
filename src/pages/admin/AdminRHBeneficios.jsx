import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import {
  fetchWorkRecordsByPeriod, fetchRecargas, createRecarga, updateEmployee,
} from '../../lib/db';
import {
  Bus, UtensilsCrossed, CheckSquare, Square, RefreshCw, History, Plus, Check,
  Edit2, X, ChevronRight, CalendarDays, AlertTriangle, Search, Wallet,
} from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const pad2 = n => String(n).padStart(2, '0');
const TODAY_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const MONTH_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const WEEKDAY = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const corDoTipo = tipo => (tipo === 'VT' ? '#4A4A4A' : '#0B0B0B');
const nomeDoTipo = tipo => (tipo === 'VT' ? 'Vale Transporte' : 'Vale Refeição');

function ymd(y, m, d) { return `${y}-${pad2(m)}-${pad2(d)}`; }

function getQuinzenaInfo(iso = TODAY_ISO) {
  const [y, m, d] = iso.split('-').map(Number);
  const q = d <= 15 ? 1 : 2;
  const label = `${MONTH_FULL[m - 1]} ${y} — Q${q}`;
  const key   = `${y}-${pad2(m)}-Q${q}`;
  const start = q === 1 ? ymd(y, m, 1) : ymd(y, m, 16);
  const lastDay = new Date(y, m, 0).getDate();
  const end   = q === 1 ? ymd(y, m, 15) : ymd(y, m, lastDay);
  return { key, label, start, end };
}

function quinzenaFromKey(key) {
  const m = /^(\d{4})-(\d{2})-Q([12])$/.exec(key || '');
  if (!m) return null;
  const y = Number(m[1]); const mo = Number(m[2]); const q = Number(m[3]);
  const lastDay = new Date(y, mo, 0).getDate();
  return {
    start: ymd(y, mo, q === 1 ? 1 : 16),
    end:   ymd(y, mo, q === 1 ? 15 : lastDay),
  };
}

// Lista todos os dias do intervalo (inclusive). Limite defensivo de 400 dias.
function listDays(start, end) {
  if (!start || !end || start > end) return [];
  const [y, m, d] = start.split('-').map(Number);
  const [ey, em, ed] = end.split('-').map(Number);
  const cursor = new Date(y, m - 1, d);
  const last = new Date(ey, em - 1, ed);
  const out = [];
  while (cursor <= last && out.length < 400) {
    out.push(ymd(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

function weekdayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

const fmtDate = iso => (iso ? iso.split('-').reverse().join('/') : '—');
const fmtDia  = iso => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—');

function periodoTexto(start, end) {
  if (!start && !end) return '—';
  if (start && end) return start === end ? fmtDate(start) : `${fmtDate(start)} a ${fmtDate(end)}`;
  return fmtDate(start || end);
}

function fmtDiasLista(dias) {
  const lista = [...(dias || [])].sort();
  if (lista.length === 0) return '—';
  if (lista.length <= 8) return lista.map(fmtDia).join(', ');
  return `${lista.slice(0, 8).map(fmtDia).join(', ')} +${lista.length - 8}`;
}

// Dias que uma linha de recarga cobre. Registros antigos (sem dias_uso) caem
// para o período ou para a quinzena.
function diasEfetivos(r) {
  if (r.diasUso && r.diasUso.length) return r.diasUso;
  if (r.dataInicio && r.dataFim) return listDays(r.dataInicio, r.dataFim);
  if (r.quinzena) {
    const q = quinzenaFromKey(r.quinzena);
    if (q) return listDays(q.start, q.end);
  }
  return r.dataRecarga ? [r.dataRecarga] : [];
}

function groupRecargas(rows) {
  const map = new Map();
  rows.forEach(r => {
    const chave = r.loteId ? `lote:${r.loteId}` : `legacy:${r.tipo}:${r.quinzena || r.id}`;
    if (!map.has(chave)) {
      map.set(chave, {
        chave,
        loteId: r.loteId,
        nome: r.nome || null,
        tipo: r.tipo,
        dataPagamento: r.dataPagamento,
        dataRecarga: r.dataRecarga,
        dataInicio: r.dataInicio,
        dataFim: r.dataFim,
        quinzena: r.quinzena,
        criadoEm: r.criadoEm,
        itens: [],
        total: 0,
      });
    }
    const lote = map.get(chave);
    lote.itens.push(r);
    lote.total += Number(r.total || 0);
    if (!lote.dataPagamento && r.dataPagamento) lote.dataPagamento = r.dataPagamento;
    if (!lote.dataRecarga && r.dataRecarga)     lote.dataRecarga = r.dataRecarga;
    if (!lote.dataInicio && r.dataInicio)       lote.dataInicio = r.dataInicio;
    if (!lote.dataFim && r.dataFim)             lote.dataFim = r.dataFim;
    if (!lote.criadoEm && r.criadoEm)           lote.criadoEm = r.criadoEm;
  });

  return [...map.values()].map(lote => {
    if ((!lote.dataInicio || !lote.dataFim) && lote.quinzena) {
      const q = quinzenaFromKey(lote.quinzena);
      if (q) {
        lote.dataInicio = lote.dataInicio || q.start;
        lote.dataFim    = lote.dataFim || q.end;
      }
    }
    // Recargas antigas não tinham nome: usa o período como identificação.
    if (!lote.nome) {
      lote.nome = lote.dataInicio
        ? `Recarga ${periodoTexto(lote.dataInicio, lote.dataFim)}`
        : 'Recarga sem nome';
    }
    lote.itens.sort((a, b) => (a.nomeFuncionario || '').localeCompare(b.nomeFuncionario || ''));
    return lote;
  }).sort((a, b) => {
    const da = a.dataInicio || a.dataRecarga || a.criadoEm || '';
    const db = b.dataInicio || b.dataRecarga || b.criadoEm || '';
    return String(db).localeCompare(String(da));
  });
}

// Índice funcionário → recargas já lançadas (com o nome de cada recarga).
function indexarExistentes(rows) {
  const idx = {};
  rows.forEach(r => {
    const dias = diasEfetivos(r);
    if (!dias.length) return;
    if (!idx[r.funcionarioId]) idx[r.funcionarioId] = [];
    idx[r.funcionarioId].push({
      recargaId: r.loteId || r.id,
      nome: r.nome || 'Recarga anterior',
      dias: new Set(dias),
    });
  });
  return idx;
}

function diasConflitantesDe(idx, funcionarioId, dias) {
  const conflitantes = new Set();
  (idx[funcionarioId] || []).forEach(rec => {
    dias.forEach(d => { if (rec.dias.has(d)) conflitantes.add(d); });
  });
  return conflitantes;
}

function encontrarConflitos(idx, itens) {
  const conflitos = [];
  itens.forEach(it => {
    (idx[it.funcionarioId] || []).forEach(rec => {
      const dias = it.diasUso.filter(d => rec.dias.has(d));
      if (dias.length) {
        conflitos.push({
          funcionarioId: it.funcionarioId,
          nomeFuncionario: it.nomeFuncionario,
          recarga: rec.nome,
          dias,
        });
      }
    });
  });
  return conflitos;
}

function rangeDoFiltro(chave, custom) {
  if (chave === 'todos') return null;
  if (chave === 'personalizado') {
    if (!custom.start && !custom.end) return null;
    return { start: custom.start || '0000-01-01', end: custom.end || '9999-12-31' };
  }
  const [y, m, d] = TODAY_ISO.split('-').map(Number);
  if (chave === 'mes') {
    const ultimo = new Date(y, m, 0).getDate();
    return { start: ymd(y, m, 1), end: ymd(y, m, ultimo) };
  }
  const cursor = new Date(y, m - 1, d);
  cursor.setDate(cursor.getDate() - (chave === '30' ? 29 : 89));
  return { start: ymd(cursor.getFullYear(), cursor.getMonth() + 1, cursor.getDate()), end: TODAY_ISO };
}

// ── UI base ────────────────────────────────────────────────────────────────
function Overlay({ onClose, children, maxWidth = '560px' }) {
  return createPortal(
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(11,11,11,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ background: '#fff', borderRadius: '24px', width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.22)' }}>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function ModalHeader({ eyebrow, titulo, onClose }) {
  return (
    <div style={{ padding: '22px 24px 18px', position: 'relative', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <button onClick={onClose} aria-label="Fechar"
        style={{ position: 'absolute', top: '18px', right: '18px', width: '32px', height: '32px', borderRadius: '8px', background: '#F5F5F5', border: 'none', cursor: 'pointer', color: '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <X size={15} />
      </button>
      <p style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{eyebrow}</p>
      <p style={{ fontSize: '20px', fontWeight: 800, color: '#0B0B0B', lineHeight: 1.25, paddingRight: '36px' }}>{titulo}</p>
    </div>
  );
}

function Campo({ label, hint, children }) {
  return (
    <label style={{ display: 'block', minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#6B6B6B', marginBottom: '6px' }}>{label}</span>
      {children}
      {hint && <span style={{ display: 'block', fontSize: '10px', color: '#9A9A9A', marginTop: '4px' }}>{hint}</span>}
    </label>
  );
}

function EditableValue({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(value);
  if (editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <input type="number" value={val} onChange={e => setVal(e.target.value)} autoFocus
        style={{ width: '70px', padding: '3px 6px', borderRadius: '6px', border: '1px solid #C8C8C8', fontSize: '12px' }} />
      <button onClick={() => { onSave(Number(val)); setEditing(false); }}
        style={{ background: '#F5F5F5', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '5px', color: '#0B0B0B' }}>
        <Check size={11} />
      </button>
      <button onClick={() => { setVal(value); setEditing(false); }}
        style={{ background: '#F5F5F5', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '5px', color: '#4A4A4A' }}>
        <X size={11} />
      </button>
    </div>
  );
  return (
    <button onClick={() => setEditing(true)}
      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#4A4A4A' }}>{fmt(value)}</span>
      <Edit2 size={10} style={{ color: '#C8C8C8' }} />
    </button>
  );
}

// ── Seletor de dias de uso ────────────────────────────────────────────────
function DayPickerModal({ employee, dias, periodo, valorDia, tipo, conflitantes, onChange, onClose }) {
  const diasPeriodo = useMemo(() => listDays(periodo.start, periodo.end), [periodo.start, periodo.end]);
  const selecionados = new Set(dias);
  const cor = corDoTipo(tipo);
  const total = dias.length * valorDia;
  const inicioVazio = diasPeriodo.length ? weekdayOf(diasPeriodo[0]) : 0;

  const toggle = iso => {
    const next = new Set(selecionados);
    if (next.has(iso)) next.delete(iso); else next.add(iso);
    onChange([...next].sort());
  };

  const diasUteis = diasPeriodo.filter(d => { const w = weekdayOf(d); return w >= 1 && w <= 5; });
  const temConflito = diasPeriodo.some(d => conflitantes.has(d));

  return (
    <Overlay onClose={onClose} maxWidth="460px">
      <ModalHeader eyebrow="Dias de uso" titulo={employee.name} onClose={onClose} />

      <div style={{ padding: '20px 24px 24px' }}>
        <p style={{ fontSize: '12px', color: '#6B6B6B', marginBottom: '14px' }}>
          Período: <strong style={{ color: '#0B0B0B' }}>{periodoTexto(periodo.start, periodo.end)}</strong>
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px', marginBottom: '6px' }}>
          {WEEKDAY.map(d => (
            <p key={d} style={{ textAlign: 'center', fontSize: '9px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase' }}>{d}</p>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {Array.from({ length: inicioVazio }).map((_, i) => <div key={`vazio-${i}`} />)}
          {diasPeriodo.map(dia => {
            const sel  = selecionados.has(dia);
            const conf = conflitantes.has(dia);
            return (
              <button key={dia} onClick={() => toggle(dia)}
                title={conf ? 'Este dia já tem crédito em outra recarga' : undefined}
                style={{
                  position: 'relative', padding: '9px 0', borderRadius: '8px', cursor: 'pointer',
                  fontSize: '12px', fontWeight: 700, transition: 'all 0.12s',
                  background: sel ? cor : '#F7F7F7',
                  color: sel ? '#fff' : '#4A4A4A',
                  border: conf ? '1.5px solid #C2410C' : '1px solid transparent',
                }}>
                {Number(dia.slice(8, 10))}
                {conf && (
                  <span style={{
                    position: 'absolute', top: '3px', right: '3px', width: '5px', height: '5px',
                    borderRadius: '50%', background: sel ? '#FDBA74' : '#C2410C',
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {temConflito && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '14px', padding: '10px 12px', borderRadius: '10px', background: '#FFF7ED', border: '1px solid #FED7AA' }}>
            <AlertTriangle size={14} style={{ color: '#C2410C', flexShrink: 0, marginTop: '1px' }} />
            <p style={{ fontSize: '11px', color: '#9A3412', lineHeight: 1.4 }}>
              Os dias com borda laranja já possuem crédito em outra recarga deste ajudante. O sistema não deixa salvar com esses dias repetidos.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button onClick={() => onChange(diasUteis)} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }}>
            Dias úteis
          </button>
          <button onClick={() => onChange(diasPeriodo)} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }}>
            Todos os dias
          </button>
          <button onClick={() => onChange([])} className="btn-ghost" style={{ padding: '6px 12px', fontSize: '11px' }}>
            Limpar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 24px', background: '#F7F7F7', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <div>
          <p style={{ fontSize: '11px', color: '#9A9A9A', fontWeight: 600 }}>
            {dias.length} dia{dias.length !== 1 ? 's' : ''} × {fmt(valorDia)}
          </p>
          <p style={{ fontSize: '15px', fontWeight: 900, color: cor }}>{fmt(total)}</p>
        </div>
        <button onClick={onClose} className="btn-primary" style={{ padding: '9px 18px' }}>Concluir</button>
      </div>
    </Overlay>
  );
}

// ── Aviso de conflito (bloqueia o salvamento) ──────────────────────────────
function ConflictModal({ conflitos, saving, onAdjust, onRemove }) {
  const totalDias = conflitos.reduce((s, c) => s + c.dias.length, 0);
  return (
    <Overlay onClose={onAdjust} maxWidth="520px">
      <ModalHeader eyebrow="Lançamento bloqueado" titulo="Dias já creditados para estes ajudantes" onClose={onAdjust} />

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '12px', background: '#FFF7ED', border: '1px solid #FED7AA', marginBottom: '16px' }}>
          <AlertTriangle size={16} style={{ color: '#C2410C', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '12px', color: '#9A3412', lineHeight: 1.5 }}>
            {totalDias} dia{totalDias !== 1 ? 's' : ''} desta recarga já {totalDias !== 1 ? 'estão' : 'está'} em outra recarga do mesmo ajudante.
            Para evitar crédito duplicado, ajuste a seleção ou remova só os dias em conflito.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
          {conflitos.map((c, i) => (
            <div key={`${c.funcionarioId}-${i}`} style={{ padding: '10px 12px', borderRadius: '10px', background: '#F7F7F7', border: '1px solid rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginBottom: '3px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#0B0B0B' }}>{c.nomeFuncionario}</p>
                <p style={{ fontSize: '11px', color: '#9A9A9A', fontWeight: 600 }}>{c.dias.length} dia{c.dias.length !== 1 ? 's' : ''}</p>
              </div>
              <p style={{ fontSize: '11px', color: '#6B6B6B' }}>
                Conflito com a recarga <strong style={{ color: '#0B0B0B' }}>“{c.recarga}”</strong>
              </p>
              <p style={{ fontSize: '11px', color: '#C2410C', fontWeight: 600, marginTop: '2px' }}>
                {c.dias.map(fmtDia).join(', ')}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', padding: '16px 24px', background: '#F7F7F7', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <button onClick={onAdjust} className="btn-ghost" style={{ padding: '9px 16px' }}>Voltar e ajustar</button>
        <button onClick={onRemove} disabled={saving} className="btn-primary" style={{ padding: '9px 16px', opacity: saving ? 0.6 : 1 }}>
          {saving ? 'Salvando...' : 'Remover dias em conflito e salvar'}
        </button>
      </div>
    </Overlay>
  );
}

// ── Detalhe da recarga (histórico) ─────────────────────────────────────────
function RecargaDetalhe({ lote, onClose }) {
  const Icon = lote.tipo === 'VT' ? Bus : UtensilsCrossed;
  const cor = corDoTipo(lote.tipo);

  return (
    <Overlay onClose={onClose} maxWidth="600px">
      <ModalHeader
        eyebrow={`Recarga de ${lote.tipo === 'VT' ? 'Vale Transporte' : 'Vale Refeição'}`}
        titulo={lote.nome}
        onClose={onClose}
      />

      <div style={{ padding: '20px 24px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '11px', background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={18} color="#fff" />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 800, color: '#0B0B0B' }}>{nomeDoTipo(lote.tipo)} ({lote.tipo})</p>
            <p style={{ fontSize: '11px', color: '#9A9A9A' }}>{lote.itens.length} ajudante{lote.itens.length !== 1 ? 's' : ''} nesta recarga</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '20px' }}>
          {[
            ['Período', periodoTexto(lote.dataInicio, lote.dataFim)],
            ['Data de pagamento', fmtDate(lote.dataPagamento)],
            ['Data da recarga', fmtDate(lote.dataRecarga)],
            ['Valor total', fmt(lote.total)],
          ].map(([label, valor]) => (
            <div key={label} style={{ padding: '10px 12px', borderRadius: '10px', background: '#F7F7F7', border: '1px solid rgba(0,0,0,0.05)' }}>
              <p style={{ fontSize: '9px', fontWeight: 700, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '3px' }}>{label}</p>
              <p style={{ fontSize: '13px', fontWeight: 800, color: '#0B0B0B' }}>{valor}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
          <Wallet size={13} style={{ color: '#9A9A9A' }} />
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#6B6B6B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Funcionários e valores</p>
        </div>

        <div style={{ border: '1px solid rgba(0,0,0,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
          {lote.itens.map((item, idx) => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderBottom: idx < lote.itens.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: item.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                {item.iniciais}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#0B0B0B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.nomeFuncionario}{item.cidade ? <span style={{ color: '#9A9A9A', fontWeight: 400 }}> ({item.cidade})</span> : ''}
                </p>
                <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '1px' }}>
                  {item.dias} dia{item.dias !== 1 ? 's' : ''} × {fmt(item.valorDia)}
                </p>
                <p style={{ fontSize: '10px', color: '#9A9A9A', marginTop: '1px' }}>{fmtDiasLista(item.diasUso)}</p>
              </div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: cor, flexShrink: 0 }}>{fmt(item.total)}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#F7F7F7', borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: '12px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#6B6B6B' }}>Total da recarga</p>
        <p style={{ fontSize: '20px', fontWeight: 900, color: cor }}>{fmt(lote.total)}</p>
      </div>
    </Overlay>
  );
}

// ── Nova Recarga ───────────────────────────────────────────────────────────
function NovaRecarga({ tipo, employees, onCreated, onShowHistory }) {
  const field = tipo === 'VT' ? 'vtDiario' : 'vrDiario';
  const cor = corDoTipo(tipo);
  const quinzenaAtual = getQuinzenaInfo();

  const [form, setForm] = useState(() => ({
    nome: '',
    dataInicio: quinzenaAtual.start,
    dataFim: quinzenaAtual.end,
    dataPagamento: TODAY_ISO,
    dataRecarga: TODAY_ISO,
  }));
  const [selected,   setSelected]   = useState({});
  const [diasUso,    setDiasUso]    = useState({});   // empId -> ['YYYY-MM-DD']
  const [workedDays, setWorkedDays] = useState({});
  const [empValues,  setEmpValues]  = useState({});
  const [existentes, setExistentes] = useState([]);
  const [picker,     setPicker]     = useState(null);  // empId
  const [conflito,   setConflito]   = useState(null);  // { conflitos, itens }
  const [erros,      setErros]      = useState([]);
  const [aviso,      setAviso]      = useState(null);
  const [sucesso,    setSucesso]    = useState(null);
  const [varrendo,   setVarrendo]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [migracaoPendente, setMigracaoPendente] = useState(false);

  const diasDoPeriodo = useMemo(() => listDays(form.dataInicio, form.dataFim), [form.dataInicio, form.dataFim]);
  const periodoValido = diasDoPeriodo.length > 0;

  // Seleciona os ativos por padrão (mantém escolhas anteriores ao re-renderizar).
  useEffect(() => {
    setSelected(prev => {
      const next = {};
      employees.forEach(e => { next[e.id] = prev[e.id] ?? true; });
      return next;
    });
  }, [employees]);

  const recarregarExistentes = () => fetchRecargas(tipo).then(setExistentes);
  useEffect(() => { recarregarExistentes(); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const existentesIdx = useMemo(() => indexarExistentes(existentes), [existentes]);

  // Ao mudar o período, descarta dias que ficaram fora dele.
  useEffect(() => {
    const dentro = new Set(diasDoPeriodo);
    setDiasUso(prev => {
      const next = {};
      Object.entries(prev).forEach(([id, dias]) => { next[id] = dias.filter(d => dentro.has(d)); });
      return next;
    });
    setWorkedDays({});
  }, [form.dataInicio, form.dataFim]); // eslint-disable-line react-hooks/exhaustive-deps

  const valorDiaDe = emp => empValues[emp.id] ?? emp[field];

  const montarItens = (mapaDias, selecao = selected) => employees
    .filter(e => selecao[e.id] && (mapaDias[e.id]?.length || 0) > 0)
    .map(e => {
      const dias = [...mapaDias[e.id]].sort();
      const valorDia = Number(valorDiaDe(e)) || 0;
      return {
        funcionarioId: e.id,
        nomeFuncionario: e.name,
        dias: dias.length,
        diasUso: dias,
        valorDia,
        total: dias.length * valorDia,
        quinzena: getQuinzenaInfo(form.dataInicio).key,
      };
    });

  const validar = itens => {
    const errs = [];
    if (!form.nome.trim())     errs.push('Dê um nome para a recarga.');
    if (!periodoValido)        errs.push('Informe um período de uso válido (data inicial até a final).');
    if (!form.dataPagamento)   errs.push('Informe a data de pagamento.');
    if (!form.dataRecarga)     errs.push('Informe a data da recarga (liberação do crédito).');
    if (itens.length === 0)    errs.push('Selecione ao menos um ajudante com dias de uso.');
    if (itens.some(i => i.valorDia <= 0)) errs.push('Há ajudante com valor/dia zerado. Ajuste o valor antes de salvar.');
    return errs;
  };

  const salvar = async itens => {
    const res = await createRecarga({
      nome: form.nome.trim(),
      tipo,
      dataPagamento: form.dataPagamento,
      dataRecarga: form.dataRecarga,
      dataInicio: form.dataInicio,
      dataFim: form.dataFim,
      itens,
    });
    setSaving(false);

    if (res.ok) {
      setErros([]);
      setAviso(null);
      if (res.colunasAusentes?.length) setMigracaoPendente(true);
      setSucesso(`Recarga “${form.nome.trim()}” salva com ${itens.length} ajudante${itens.length !== 1 ? 's' : ''}.`);
      setForm(f => ({ ...f, nome: '' }));
      setDiasUso({});
      setWorkedDays({});
      setEmpValues({});
      await recarregarExistentes();
      onCreated?.();
      return;
    }
    if (res.error === 'conflito') {
      setErros(['Outra recarga foi salva em paralelo com dias repetidos. Atualizando os dados, revise os dias e tente novamente.']);
      await recarregarExistentes();
      return;
    }
    setErros([`Não foi possível salvar a recarga: ${res.error}`]);
  };

  const handleSalvar = async () => {
    if (saving) return;
    setSucesso(null);
    setAviso(null);
    const itens = montarItens(diasUso);
    const errs = validar(itens);
    if (errs.length) { setErros(errs); return; }
    setErros([]);
    setSaving(true);

    // Relê antes de validar para não depender de dados antigos em tela.
    const atuais = await fetchRecargas(tipo);
    setExistentes(atuais);
    const conflitos = encontrarConflitos(indexarExistentes(atuais), itens);
    if (conflitos.length) {
      setSaving(false);
      setConflito({ conflitos, itens });
      return;
    }
    await salvar(itens);
  };

  const removerConflitosESalvar = async () => {
    if (!conflito || saving) return;
    const porFuncionario = {};
    conflito.conflitos.forEach(c => {
      if (!porFuncionario[c.funcionarioId]) porFuncionario[c.funcionarioId] = new Set();
      c.dias.forEach(d => porFuncionario[c.funcionarioId].add(d));
    });

    const novoMapa = {};
    Object.entries(diasUso).forEach(([id, dias]) => {
      novoMapa[id] = dias.filter(d => !porFuncionario[id]?.has(d));
    });

    const novosItens = montarItens(novoMapa);
    setDiasUso(novoMapa);
    setConflito(null);

    if (novosItens.length === 0) {
      setErros(['Todos os dias estavam em conflito. Escolha outros dias ou outro período.']);
      return;
    }
    setSaving(true);
    await salvar(novosItens);
  };

  const handleVarredura = async () => {
    if (!periodoValido || varrendo) return;
    setVarrendo(true);
    setAviso(null);
    try {
      const recs = await fetchWorkRecordsByPeriod(null, null, form.dataInicio, form.dataFim);
      const dentro = new Set(diasDoPeriodo);
      const mapa = {};
      recs.filter(r => r.checkIn).forEach(r => {
        if (!dentro.has(r.date)) return;
        if (!mapa[r.employeeId]) mapa[r.employeeId] = new Set();
        mapa[r.employeeId].add(r.date);
      });
      const worked = {};
      const novo = {};
      employees.forEach(e => {
        const ds = mapa[e.id] ? [...mapa[e.id]].sort() : [];
        worked[e.id] = ds.length;
        novo[e.id] = ds;
      });
      setWorkedDays(worked);
      setDiasUso(novo);
      const comDias = Object.values(worked).filter(n => n > 0).length;
      setAviso(`Varredura concluída: ${comDias} ajudante${comDias !== 1 ? 's' : ''} com dias trabalhados no período.`);
    } finally {
      setVarrendo(false);
    }
  };

  const aplicarDiasUteisTodos = () => {
    if (!periodoValido) return;
    const uteis = diasDoPeriodo.filter(d => { const w = weekdayOf(d); return w >= 1 && w <= 5; });
    const novo = {};
    employees.forEach(e => { novo[e.id] = uteis; });
    setDiasUso(novo);
    setAviso(`${uteis.length} dia${uteis.length !== 1 ? 's' : ''} útil${uteis.length !== 1 ? 'eis' : ''} em ${periodoTexto(form.dataInicio, form.dataFim)} aplicado${uteis.length !== 1 ? 's' : ''} a todos os ajudantes.`);
  };

  const aplicarPreset = preset => {
    const base = form.dataInicio || TODAY_ISO;
    const [y, m] = base.split('-').map(Number);
    const ultimo = new Date(y, m, 0).getDate();
    if (preset === 'q1')  setForm(f => ({ ...f, dataInicio: ymd(y, m, 1),  dataFim: ymd(y, m, 15) }));
    if (preset === 'q2')  setForm(f => ({ ...f, dataInicio: ymd(y, m, 16), dataFim: ymd(y, m, ultimo) }));
    if (preset === 'mes') setForm(f => ({ ...f, dataInicio: ymd(y, m, 1),  dataFim: ymd(y, m, ultimo) }));
  };

  const todosSelecionados = employees.length > 0 && employees.every(e => selected[e.id]);
  const toggleTodos = () => {
    const val = !todosSelecionados;
    const sel = {};
    employees.forEach(e => { sel[e.id] = val; });
    setSelected(sel);
  };

  const comDias = employees.filter(e => selected[e.id] && (diasUso[e.id]?.length || 0) > 0);
  const totalGeral = comDias.reduce((s, e) => s + (diasUso[e.id].length * (Number(valorDiaDe(e)) || 0)), 0);
  const podeSalvar = !!form.nome.trim() && periodoValido && totalGeral > 0;

  const empDoPicker = picker ? employees.find(e => e.id === picker) : null;

  return (
    <div className="space-y-5">
      {migracaoPendente && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '12px', background: '#FFF7ED', border: '1px solid #FED7AA' }}>
          <AlertTriangle size={15} style={{ color: '#C2410C', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '12px', color: '#9A3412', lineHeight: 1.5 }}>
            O banco ainda não tem as colunas novas desta tela. Rode o script <strong>supabase/beneficios-recargas-v2.sql</strong> no SQL Editor do Supabase para que nome, datas e dias de uso sejam gravados.
          </p>
        </div>
      )}

      {/* Dados da recarga */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Campo label="Nome da recarga" hint="Aparece no histórico e no lançamento do financeiro.">
              <input className="input-field" value={form.nome} placeholder={`Ex.: ${tipo} 1ª quinzena de ${MONTH_FULL[Number(TODAY_ISO.slice(5, 7)) - 1]}`}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </Campo>
          </div>

          <Campo label="Data de pagamento" hint="Boleto/repasse (pode ser diferente da liberação).">
            <input type="date" className="input-field" value={form.dataPagamento}
              onChange={e => setForm(f => ({ ...f, dataPagamento: e.target.value }))} />
          </Campo>

          <Campo label="Data da recarga" hint="Dia em que o crédito é liberado.">
            <input type="date" className="input-field" value={form.dataRecarga}
              onChange={e => setForm(f => ({ ...f, dataRecarga: e.target.value }))} />
          </Campo>

          <Campo label="Início do período de uso">
            <input type="date" className="input-field" value={form.dataInicio}
              onChange={e => setForm(f => ({ ...f, dataInicio: e.target.value }))} />
          </Campo>

          <Campo label="Fim do período de uso">
            <input type="date" className="input-field" value={form.dataFim}
              onChange={e => setForm(f => ({ ...f, dataFim: e.target.value }))} />
          </Campo>

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[['q1', '1ª quinzena'], ['q2', '2ª quinzena'], ['mes', 'Mês inteiro']].map(([k, l]) => (
              <button key={k} onClick={() => aplicarPreset(k)} className="btn-ghost"
                style={{ padding: '5px 11px', fontSize: '11px' }}>{l}</button>
            ))}
            <span style={{ alignSelf: 'center', fontSize: '11px', color: '#9A9A9A', marginLeft: '4px' }}>
              Período atual: <strong style={{ color: '#4A4A4A' }}>{periodoTexto(form.dataInicio, form.dataFim)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Banners */}
      {erros.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '12px', background: '#FDF2F4', border: '1px solid #EBC5CE' }}>
          <AlertTriangle size={15} style={{ color: '#8C3B4A', flexShrink: 0, marginTop: '1px' }} />
          <div>
            {erros.map((e, i) => <p key={i} style={{ fontSize: '12px', color: '#8C3B4A', fontWeight: 600, lineHeight: 1.5 }}>{e}</p>)}
          </div>
          <button onClick={() => setErros([])} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: '#8C3B4A' }}><X size={13} /></button>
        </div>
      )}

      {sucesso && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '12px 14px', borderRadius: '12px', background: '#F0F7F2', border: '1px solid #CFE5D7' }}>
          <Check size={15} style={{ color: '#2F7A4F', flexShrink: 0 }} />
          <p style={{ fontSize: '12px', color: '#1F5A38', fontWeight: 600, flex: 1 }}>{sucesso}</p>
          {onShowHistory && (
            <button onClick={onShowHistory} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2F7A4F', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Ver histórico
            </button>
          )}
          <button onClick={() => setSucesso(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2F7A4F' }}><X size={13} /></button>
        </div>
      )}

      {aviso && (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 14px', borderRadius: '12px', background: '#F7F7F7', border: '1px solid rgba(0,0,0,0.06)' }}>
          <p style={{ fontSize: '12px', color: '#4A4A4A', fontWeight: 600, flex: 1 }}>{aviso}</p>
          <button onClick={() => setAviso(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9A9A' }}><X size={13} /></button>
        </div>
      )}

      {/* Cabeçalho da lista + ações de dias */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#9A9A9A' }}>Ajudantes e dias de uso</p>
          <p style={{ fontSize: '14px', fontWeight: 800, color: '#0B0B0B' }}>{periodoTexto(form.dataInicio, form.dataFim)}</p>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <button onClick={aplicarDiasUteisTodos} disabled={!periodoValido}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: 'none', cursor: periodoValido ? 'pointer' : 'not-allowed', background: '#F5F5F5', color: '#0B0B0B', fontSize: '12px', fontWeight: 600, opacity: periodoValido ? 1 : 0.5 }}>
            <CalendarDays size={13} /> Dias úteis p/ todos
          </button>
          <button onClick={() => setDiasUso({})} disabled={!periodoValido}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)', cursor: periodoValido ? 'pointer' : 'not-allowed', background: '#fff', color: '#6B6B6B', fontSize: '12px', fontWeight: 600, opacity: periodoValido ? 1 : 0.5 }}>
            Limpar dias
          </button>
          <button onClick={handleVarredura} disabled={varrendo || !periodoValido}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: periodoValido ? 'pointer' : 'not-allowed', background: '#F5F5F5', color: '#0B0B0B', fontSize: '12px', fontWeight: 600, opacity: periodoValido ? 1 : 0.5 }}>
            <RefreshCw size={13} style={{ animation: varrendo ? 'spin 1s linear infinite' : 'none' }} />
            {varrendo ? 'Varrendo...' : 'Varredura de dias trabalhados'}
          </button>
        </div>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 120px 160px 110px', padding: '9px 16px', background: '#F7F7F7', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#9A9A9A', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '8px', alignItems: 'center' }}>
          <button onClick={toggleTodos} style={{ background: 'none', border: 'none', cursor: 'pointer', color: todosSelecionados ? '#0B0B0B' : '#C8C8C8', display: 'flex' }}>
            {todosSelecionados ? <CheckSquare size={15} /> : <Square size={15} />}
          </button>
          <span>Ajudante</span>
          <span style={{ textAlign: 'center' }}>Valor/dia</span>
          <span style={{ textAlign: 'center' }}>Dias de uso</span>
          <span style={{ textAlign: 'right' }}>Total</span>
        </div>

        {employees.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#C8C8C8' }}>Nenhum ajudante ativo</p>
          </div>
        ) : employees.map((emp, idx) => {
          const isSelected = !!selected[emp.id];
          const dias = diasUso[emp.id] || [];
          const valorDia = Number(valorDiaDe(emp)) || 0;
          const total = dias.length * valorDia;
          const worked = workedDays[emp.id];
          const conflitantes = isSelected ? diasConflitantesDe(existentesIdx, emp.id, dias) : new Set();

          return (
            <div key={emp.id} style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 120px 160px 110px',
              padding: '12px 16px', borderBottom: idx < employees.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
              alignItems: 'center', gap: '8px',
              background: isSelected ? 'rgba(74,74,74,0.02)' : 'transparent',
              opacity: isSelected ? 1 : 0.45,
              transition: 'all 0.12s',
            }}>
              <button onClick={() => setSelected(s => ({ ...s, [emp.id]: !s[emp.id] }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSelected ? cor : '#C8C8C8', display: 'flex' }}>
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: emp.color || '#9A9A9A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {emp.initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0B0B0B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.name}{emp.cidade ? <span style={{ color: '#9A9A9A', fontWeight: 400 }}> ({emp.cidade})</span> : ''}
                  </p>
                  {worked !== undefined && (
                    <p style={{ fontSize: '10px', color: '#4A4A4A', marginTop: '1px' }}>
                      {worked} dia{worked !== 1 ? 's' : ''} trabalhado{worked !== 1 ? 's' : ''} no período
                    </p>
                  )}
                  {conflitantes.size > 0 && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#C2410C', fontWeight: 600, marginTop: '1px' }}>
                      <AlertTriangle size={10} /> {conflitantes.size} dia{conflitantes.size !== 1 ? 's' : ''} em outra recarga
                    </p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <EditableValue
                  value={valorDia}
                  onSave={async v => {
                    setEmpValues(prev => ({ ...prev, [emp.id]: v }));
                    await updateEmployee(emp.id, { [field]: v });
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => setPicker(emp.id)} disabled={!periodoValido}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '8px',
                    cursor: periodoValido ? 'pointer' : 'not-allowed',
                    border: `1px solid ${conflitantes.size > 0 ? '#FED7AA' : 'rgba(0,0,0,0.10)'}`,
                    background: conflitantes.size > 0 ? '#FFF7ED' : dias.length > 0 ? 'rgba(74,74,74,0.06)' : '#F7F7F7',
                    color: conflitantes.size > 0 ? '#9A3412' : dias.length > 0 ? '#0B0B0B' : '#9A9A9A',
                    fontSize: '12px', fontWeight: 700, whiteSpace: 'nowrap',
                  }}>
                  <CalendarDays size={12} />
                  {dias.length > 0 ? `${dias.length} dia${dias.length !== 1 ? 's' : ''}` : 'Selecionar'}
                </button>
              </div>

              <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: total > 0 ? cor : '#C8C8C8' }}>
                {total > 0 ? fmt(total) : '—'}
              </p>
            </div>
          );
        })}

        {employees.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', padding: '14px 16px', background: '#F7F7F7', borderTop: '2px solid rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: '12px', color: '#6B6B6B', fontWeight: 600 }}>
              {comDias.length} ajudante{comDias.length !== 1 ? 's' : ''} com dias · {diasDoPeriodo.length} dias no período
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 600, textTransform: 'uppercase' }}>Total {tipo}</p>
                <p style={{ fontSize: '18px', fontWeight: 900, color: cor }}>{fmt(totalGeral)}</p>
              </div>
              <button onClick={handleSalvar} disabled={saving || !podeSalvar}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 18px', borderRadius: '10px', border: 'none',
                  cursor: saving || !podeSalvar ? 'not-allowed' : 'pointer',
                  background: podeSalvar ? cor : '#E4E4E4',
                  color: podeSalvar ? 'white' : '#9A9A9A',
                  fontSize: '13px', fontWeight: 700,
                  boxShadow: podeSalvar ? `0 2px 10px ${cor}40` : 'none',
                }}>
                {saving ? 'Salvando...' : <><Plus size={13} /> Realizar recarga</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {empDoPicker && (
        <DayPickerModal
          employee={empDoPicker}
          dias={diasUso[empDoPicker.id] || []}
          periodo={{ start: form.dataInicio, end: form.dataFim }}
          valorDia={Number(valorDiaDe(empDoPicker)) || 0}
          tipo={tipo}
          conflitantes={diasConflitantesDe(existentesIdx, empDoPicker.id, diasUso[empDoPicker.id] || [])}
          onChange={novosDias => setDiasUso(prev => ({ ...prev, [empDoPicker.id]: novosDias }))}
          onClose={() => setPicker(null)}
        />
      )}

      {conflito && (
        <ConflictModal
          conflitos={conflito.conflitos}
          saving={saving}
          onAdjust={() => setConflito(null)}
          onRemove={removerConflitosESalvar}
        />
      )}
    </div>
  );
}

// ── Histórico ──────────────────────────────────────────────────────────────
function Historico({ tipo, refreshKey }) {
  const [recargas, setRecargas] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtroTipo, setFiltroTipo] = useState(tipo);
  const [periodo, setPeriodo] = useState('todos');
  const [custom, setCustom] = useState({ start: '', end: '' });
  const [busca, setBusca] = useState('');
  const [detalhe, setDetalhe] = useState(null);

  useEffect(() => { setFiltroTipo(tipo); }, [tipo]);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    fetchRecargas(null).then(rows => {
      if (!ativo) return;
      setRecargas(rows);
      setLoading(false);
    });
    return () => { ativo = false; };
  }, [refreshKey]);

  const lotes = useMemo(() => groupRecargas(recargas), [recargas]);
  const range = useMemo(() => rangeDoFiltro(periodo, custom), [periodo, custom]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return lotes.filter(l => {
      if (filtroTipo !== 'all' && l.tipo !== filtroTipo) return false;
      if (termo && !String(l.nome).toLowerCase().includes(termo)) return false;
      if (range) {
        const ref = l.dataInicio || l.dataRecarga || (l.criadoEm ? String(l.criadoEm).slice(0, 10) : null);
        if (!ref || ref < range.start || ref > range.end) return false;
      }
      return true;
    });
  }, [lotes, filtroTipo, busca, range]);

  const totalFiltrado = filtrados.reduce((s, l) => s + l.total, 0);

  if (loading) return <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#9A9A9A', fontSize: '13px' }}>Carregando...</div>;

  return (
    <div className="space-y-3">
      {/* Filtros */}
      <div className="card" style={{ padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '4px', background: '#F5F5F5', padding: '3px', borderRadius: '10px' }}>
          {[['all', 'Todos'], ['VT', 'VT'], ['VR', 'VR']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltroTipo(v)}
              style={{
                padding: '6px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontSize: '11px', fontWeight: 700, transition: 'all 0.12s',
                background: filtroTipo === v ? '#fff' : 'transparent',
                color: filtroTipo === v ? '#0B0B0B' : '#9A9A9A',
                boxShadow: filtroTipo === v ? '0 1px 3px rgba(0,0,0,0.10)' : 'none',
              }}>{l}</button>
          ))}
        </div>

        <select className="input-field" value={periodo} onChange={e => setPeriodo(e.target.value)}
          style={{ width: 'auto', padding: '8px 12px', fontSize: '12px' }}>
          <option value="todos">Todos os períodos</option>
          <option value="mes">Mês atual</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
          <option value="personalizado">Período personalizado</option>
        </select>

        {periodo === 'personalizado' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <input type="date" className="input-field" value={custom.start}
              onChange={e => setCustom(c => ({ ...c, start: e.target.value }))}
              style={{ width: 'auto', padding: '8px 10px', fontSize: '12px' }} />
            <span style={{ fontSize: '11px', color: '#9A9A9A' }}>até</span>
            <input type="date" className="input-field" value={custom.end}
              onChange={e => setCustom(c => ({ ...c, end: e.target.value }))}
              style={{ width: 'auto', padding: '8px 10px', fontSize: '12px' }} />
          </div>
        )}

        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <Search size={13} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#9A9A9A' }} />
          <input className="input-field" placeholder="Buscar pelo nome da recarga"
            value={busca} onChange={e => setBusca(e.target.value)}
            style={{ paddingLeft: '32px', padding: '8px 12px 8px 32px', fontSize: '12px' }} />
        </div>

        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <p style={{ fontSize: '10px', color: '#9A9A9A', fontWeight: 600, textTransform: 'uppercase' }}>
            {filtrados.length} recarga{filtrados.length !== 1 ? 's' : ''}
          </p>
          <p style={{ fontSize: '15px', fontWeight: 900, color: '#0B0B0B' }}>{fmt(totalFiltrado)}</p>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <div className="card" style={{ padding: '56px', textAlign: 'center' }}>
          <History size={32} style={{ color: '#C8C8C8', margin: '0 auto 12px' }} />
          <p style={{ fontSize: '13px', color: '#9A9A9A', fontWeight: 600 }}>Nenhuma recarga encontrada</p>
          <p style={{ fontSize: '12px', color: '#C8C8C8', marginTop: '4px' }}>Ajuste os filtros ou crie uma nova recarga</p>
        </div>
      ) : filtrados.map(lote => {
        const Icon = lote.tipo === 'VT' ? Bus : UtensilsCrossed;
        const cor = corDoTipo(lote.tipo);
        return (
          <button key={lote.chave} onClick={() => setDetalhe(lote)} className="card"
            style={{ width: '100%', textAlign: 'left', border: '1px solid rgba(11,11,11,0.06)', cursor: 'pointer', padding: 0, background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '15px 18px', flexWrap: 'wrap' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: cor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={18} color="#fff" />
              </div>

              <div style={{ flex: 1, minWidth: '180px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#0B0B0B' }}>{lote.nome}</p>
                  <span style={{ fontSize: '9px', fontWeight: 800, color: cor, background: 'rgba(74,74,74,0.08)', padding: '2px 7px', borderRadius: '999px', letterSpacing: '0.04em' }}>
                    {lote.tipo}
                  </span>
                </div>
                <p style={{ fontSize: '11px', color: '#9A9A9A', marginTop: '2px' }}>
                  {periodoTexto(lote.dataInicio, lote.dataFim)} · {lote.itens.length} ajudante{lote.itens.length !== 1 ? 's' : ''}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '9px', color: '#9A9A9A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pagamento</p>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#4A4A4A' }}>{fmtDate(lote.dataPagamento)}</p>
                </div>
                <div>
                  <p style={{ fontSize: '9px', color: '#9A9A9A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Recarga</p>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#4A4A4A' }}>{fmtDate(lote.dataRecarga)}</p>
                </div>
                <div style={{ textAlign: 'right', minWidth: '90px' }}>
                  <p style={{ fontSize: '9px', color: '#9A9A9A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</p>
                  <p style={{ fontSize: '16px', fontWeight: 900, color: cor }}>{fmt(lote.total)}</p>
                </div>
                <ChevronRight size={16} style={{ color: '#C8C8C8' }} />
              </div>
            </div>
          </button>
        );
      })}

      {detalhe && <RecargaDetalhe lote={detalhe} onClose={() => setDetalhe(null)} />}
    </div>
  );
}

// ── Aba de benefício (VT ou VR) ────────────────────────────────────────────
function BeneficioAba({ tipo, employees }) {
  const [subTab, setSubTab] = useState('nova');
  const [refreshKey, setRefreshKey] = useState(0);
  const cor = corDoTipo(tipo);

  return (
    <div className="space-y-4">
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(0,0,0,0.07)', paddingBottom: '12px' }}>
        {[['nova', 'Nova Recarga', Plus], ['historico', 'Histórico', History]].map(([key, lbl, Ic]) => (
          <button key={key} onClick={() => setSubTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, transition: 'all 0.12s',
              background: subTab === key ? cor : '#F5F5F5',
              color:      subTab === key ? 'white' : '#6B6B6B',
            }}>
            <Ic size={12} /> {lbl}
          </button>
        ))}
      </div>

      {subTab === 'nova' && (
        <NovaRecarga
          tipo={tipo}
          employees={employees}
          onCreated={() => setRefreshKey(k => k + 1)}
          onShowHistory={() => setSubTab('historico')}
        />
      )}
      {subTab === 'historico' && <Historico tipo={tipo} refreshKey={refreshKey} />}
    </div>
  );
}

// ── Principal ──────────────────────────────────────────────────────────────
export default function AdminRHBeneficios() {
  const { employees } = useAuth();
  const [benefTab, setBenefTab] = useState('VT');

  const ativos = employees.filter(e => e.status === 'active');

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: '13px', color: '#6B6B6B', marginTop: '2px' }}>
            {ativos.length} ajudante{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div style={{
        display: 'inline-flex', gap: '4px', padding: '4px', borderRadius: '14px',
        background: 'linear-gradient(135deg, #0B0B0B 0%, #1C1C1C 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 14px 34px -18px rgba(11,11,11,0.60)',
      }}>
        {[['VT', Bus], ['VR', UtensilsCrossed]].map(([tipo, Icon]) => (
          <button key={tipo} onClick={() => setBenefTab(tipo)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 18px', borderRadius: '10px', border: 'none',
              cursor: 'pointer', fontSize: '13px', fontWeight: 700, transition: 'all 0.15s',
              background: benefTab === tipo ? '#FFFFFF' : 'transparent',
              color:      benefTab === tipo ? '#0B0B0B'  : '#BDBDBD',
            }}>
            <Icon size={15} />
            {tipo === 'VT' ? 'Vale Transporte (VT)' : 'Vale Refeição (VR)'}
          </button>
        ))}
      </div>

      <BeneficioAba key={benefTab} tipo={benefTab} employees={ativos} />
    </div>
  );
}