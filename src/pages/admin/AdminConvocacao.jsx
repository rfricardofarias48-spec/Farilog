import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2, CheckCircle2, XCircle, Clock, MapPin, Star, Shield, RefreshCw, Info, Send, Trash2,
  CalendarDays, Filter, ChevronDown, Check, MessageCircle, Edit2, ClipboardList, X,
} from 'lucide-react';
import {
  fetchConvocacoesPeriodo, subscribeConvocacoes,
  aceitarConvocacao, recusarConvocacao, marcarSemResposta, deleteConvocacao,
  fetchDemands, editDemand,
} from '../../lib/db';
import { calculateWorkAndOvertime, minutesToFormattedTime } from '../../lib/timeUtils';
import { useAuth } from '../../context/AuthContext';
import DemandForm from '../../components/admin/DemandForm';
import { ConvocacaoBadge } from '../../components/shared/ConvocacaoStatus';
import { fmtDistancia } from '../../lib/geo';
import { fmtNota } from '../../lib/notas';
import WhatsAppButton from '../../components/shared/WhatsAppButton';

const FILTROS = [
  { id: 'aguardando',  label: 'Aguardando resposta', statuses: ['pendente', 'enviada'] },
  { id: 'confirmado',  label: 'Confirmados',         statuses: ['confirmado', 'finalizado', 'falta'] },
  { id: 'reserva',     label: 'Reservas',            statuses: ['reserva'] },
  { id: 'todas',       label: 'Todas',               statuses: null },
];

// Respostas possíveis do ajudante (mutuamente exclusivas) — ficam em um menu
// por linha em vez de vários botões soltos, para não poluir a lista.
const RESPOSTAS = [
  { id: 'aceitar',  label: 'Aceitou',  desc: 'Confirmar a diária',       icon: CheckCircle2, color: '#047857', bg: '#F0FDF4' },
  { id: 'recusar',  label: 'Recusou',  desc: 'Recusar a convocação',     icon: XCircle,      color: '#B91C1C', bg: '#FEF2F2' },
  { id: 'silencio', label: 'Silêncio', desc: 'Não respondeu ao convite', icon: Clock,        color: '#64748B', bg: '#F8FAFC' },
];

const fmtDia = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const dow = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][new Date(`${iso}T12:00:00`).getDay()];
  return `${dow}, ${d}/${m}/${y}`;
};

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const MES_ATUAL = TODAY.slice(0, 7);
const QUINZENA_ATUAL = Number(TODAY.slice(8, 10)) <= 15 ? 1 : 2;
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// "07:00:00" (formato do banco) → "07:00" (valor aceito por <input type="time">).
const hhmm = (v) => (v ? String(v).slice(0, 5) : '');

function limitesDoMes(mes) {
  const [ano, m] = String(mes || MES_ATUAL).split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return {
    ano,
    mesNum: m,
    primeiro: `${ano}-${mm}-01`,
    ultimoDia: `${ano}-${mm}-${String(ultimo).padStart(2, '0')}`,
  };
}

// Texto do convite enviado pelo botão de WhatsApp (abre a conversa direto).
function textoConvite(c) {
  const primeiro = String(c.name || '').split(' ')[0];
  return [
    `Olá ${primeiro}, aqui é da FariLog.`,
    `Temos uma diária em ${c.empresaNome || 'nossa empresa'} no dia ${fmtDia(c.data)}.`,
    c.endereco ? `📍 Local: ${c.endereco}` : null,
    c.horario ? `🕐 Horário: ${c.horario}` : null,
    c.valorDiaria ? `💰 Valor: R$ ${c.valorDiaria}` : null,
    c.pagamentoEm ? `📅 Pagamento: ${fmtDia(c.pagamentoEm)}` : null,
    '',
    'Você aceita a convocação?',
  ].filter(Boolean).join('\n');
}

export default function AdminConvocacao({ initialMes, initialQuinzena } = {}) {
  const [filtro, setFiltro] = useState('todas');
  const [modo, setModo]     = useState('quinzena');
  const [mes, setMes]       = useState(initialMes || MES_ATUAL);
  const [quinzena, setQuinzena] = useState(initialQuinzena || QUINZENA_ATUAL);
  const [convs, setConvs]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [agindo, setAgindo]   = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [menuAberto, setMenuAberto] = useState(null); // 'periodo' | 'status' | null
  const [menuRow, setMenuRow] = useState(null);       // { id, top, left } — menu "Responder"
  const { employees, companies, setDemands } = useAuth();
  const [editando, setEditando] = useState(null);     // demanda (escala) em edição
  const [mostrarDiarias, setMostrarDiarias] = useState(false);
  const [diarias, setDiarias] = useState([]);
  const [carregandoDiarias, setCarregandoDiarias] = useState(false);
  const [detalheDiaria, setDetalheDiaria] = useState(null);

  const statuses = FILTROS.find(f => f.id === filtro)?.statuses ?? null;

  const mesEfetivo = mes || MES_ATUAL;
  const limite = limitesDoMes(mesEfetivo);
  const de  = modo === 'mes' ? limite.primeiro : (quinzena === 1 ? limite.primeiro : `${mesEfetivo}-16`);
  const ate = modo === 'mes' ? limite.ultimoDia : (quinzena === 1 ? `${mesEfetivo}-15` : limite.ultimoDia);
  const labelMes = `${MESES[limite.mesNum - 1]}/${limite.ano}`;
  const labelMesCurto = `${MESES_CURTOS[limite.mesNum - 1]}/${limite.ano}`;
  const labelPeriodo = modo === 'mes' ? `Mensal · ${labelMesCurto}` : `${quinzena}ª quinzena · ${labelMesCurto}`;
  const labelStatus = FILTROS.find(f => f.id === filtro)?.label || 'Todas';

  const load = useCallback(() => {
    setLoading(true);
    fetchConvocacoesPeriodo({ statuses, from: de, to: ate }).then(list => { setConvs(list); setLoading(false); });
  }, [filtro, de, ate]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  // Status ao vivo (o encarregado marca a resposta e a lista atualiza sozinha)
  useEffect(() => subscribeConvocacoes(null, () => load()), [load]);

  // Diárias (escalas) do período — carregadas sob demanda ao abrir o painel.
  const carregarDiarias = useCallback(async () => {
    setCarregandoDiarias(true);
    const todas = await fetchDemands();
    setDiarias((todas || []).filter(d => d.date && d.date >= de && d.date <= ate));
    setCarregandoDiarias(false);
  }, [de, ate]);

  useEffect(() => {
    if (mostrarDiarias) carregarDiarias();
  }, [mostrarDiarias, carregarDiarias]);

  useEffect(() => {
    if (!menuAberto) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuAberto(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuAberto]);

  useEffect(() => {
    if (!menuRow) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setMenuRow(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuRow]);

  const grupos = useMemo(() => {
    const map = new Map();
    for (const c of convs) {
      const k = c.escalaId || 'sem';
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(c);
    }
    return [...map.entries()]
      .map(([escalaId, list]) => ({
        escalaId,
        list: list.sort((a, b) => (a.papel === b.papel ? (a.ordem ?? 999) - (b.ordem ?? 999) : a.papel === 'titular' ? -1 : 1)),
        empresa: list[0]?.empresaNome,
        data: list[0]?.data,
        horario: list[0]?.horario,
        vagas: list[0]?.vagas ?? list.length,
        endereco: list[0]?.endereco,
        confirmados: list.filter(c => c.status === 'confirmado' || c.status === 'finalizado').length,
      }))
      .sort((a, b) => (
        filtro === 'aguardando'
          ? String(a.data).localeCompare(String(b.data))
          : String(b.data).localeCompare(String(a.data))
      ));
  }, [convs, filtro]);

  const employeesById = useMemo(() => {
    const map = new Map();
    (employees || []).forEach(e => map.set(e.id, e));
    return map;
  }, [employees]);

  const agir = async (tipo, conv) => {
    setAgindo(conv.id);
    if (tipo === 'aceitar')  await aceitarConvocacao(conv);
    if (tipo === 'recusar')  await recusarConvocacao(conv);
    if (tipo === 'silencio') await marcarSemResposta(conv);
    setAgindo(null);
    load();
  };

  // Abre o menu "Responder" ancorado ao botão (fixed evita corte pelo card).
  const abrirMenuResposta = (e, conv) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const largura = 224, altura = 196;
    const acima = rect.bottom + altura + 8 > window.innerHeight;
    setMenuRow({
      id: conv.id,
      top: acima ? Math.max(12, rect.top - altura - 8) : rect.bottom + 8,
      left: Math.max(12, Math.min(rect.right - largura, window.innerWidth - largura - 12)),
    });
  };

  const excluirGrupo = async (g) => {
    if (!g.escalaId) return;
    const ok = window.confirm(
      `Excluir a convocação de ${g.empresa || 'empresa'} em ${fmtDia(g.data)}? As respostas, reservas e registros vinculados também serão removidos.`
    );
    if (!ok) return;
    setExcluindo(g.escalaId);
    const sucesso = await deleteConvocacao(g.escalaId);
    setExcluindo(null);
    if (sucesso) load();
    else alert('Não foi possível excluir a convocação. Tente novamente.');
  };

  // Abre o lançamento no formulário de demanda (mesmo usado no Operacional),
  // para editar data, horário, tipo e os horários de cada ajudante.
  const abrirEdicao = async (g) => {
    if (!g.escalaId) return;
    const todos = await fetchDemands();
    const d = (todos || []).find(x => x.id === g.escalaId);
    if (!d) { alert('Não encontrei este lançamento para editar.'); return; }
    setEditando(d);
  };

  const salvarEdicao = async (form) => {
    if (!editando) return false;
    const ok = await editDemand(editando.id, { ...form, liderId: null });
    if (!ok) { alert('Não foi possível salvar as alterações. Tente novamente.'); return false; }
    setEditando(null);
    load();
    try {
      const fresh = await fetchDemands();
      if (fresh?.length) setDemands(fresh);
    } catch { /* a lista se atualiza ao recarregar */ }
    return true;
  };

  return (
    <div className="space-y-5">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A' }}>Histórico de convocações</p>
          <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
            Convocações do período selecionado. Use os filtros de status e período para acompanhar as respostas.
          </p>
        </div>
        <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', background: '#F1F5F9', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
          <RefreshCw size={13} /> Atualizar
        </button>
      </div>

      {/* Filtros compactos: cada botão abre as opções */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        {menuAberto && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => setMenuAberto(null)} />
        )}

        <div style={{ position: 'relative', zIndex: 30 }}>
          <button type="button" onClick={() => setMenuAberto(m => m === 'periodo' ? null : 'periodo')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)',
              background: '#fff', color: '#0F172A', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            }}>
            <CalendarDays size={13} style={{ color: '#BC4A2A' }} />
            {labelPeriodo}
            <ChevronDown size={13} style={{ color: '#94A3B8', transition: 'transform .15s', transform: menuAberto === 'periodo' ? 'rotate(180deg)' : 'none' }} />
          </button>

          {menuAberto === 'periodo' && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 31, width: '270px',
              background: '#fff', border: '1px solid rgba(0,0,0,0.10)', borderRadius: '12px',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)', padding: '10px',
            }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '7px' }}>
                {labelMes}
              </p>
              <div style={{ display: 'flex', gap: '4px', padding: '4px', borderRadius: '10px', background: '#F1F5F9', marginBottom: '8px' }}>
                {[['quinzena', 'Quinzenal'], ['mes', 'Mensal']].map(([valor, label]) => (
                  <button key={valor} type="button" onClick={() => setModo(valor)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: '7px', border: 'none', cursor: 'pointer',
                      fontSize: '11px', fontWeight: 700,
                      background: modo === valor ? 'white' : 'transparent',
                      color: modo === valor ? '#0F172A' : '#94A3B8',
                      boxShadow: modo === valor ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                    }}>
                    {label}
                  </button>
                ))}
              </div>
              <input type="month" className="input-field" value={mesEfetivo} onChange={e => setMes(e.target.value)}
                style={{ width: '100%', height: '34px', padding: '0 10px', fontSize: '12px', marginBottom: modo === 'quinzena' ? '8px' : 0 }} />
              {modo === 'quinzena' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2].map(q => (
                    <button key={q} type="button" onClick={() => setQuinzena(q)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: '8px', cursor: 'pointer',
                        border: `1px solid ${quinzena === q ? '#BC4A2A' : 'rgba(0,0,0,0.08)'}`,
                        background: quinzena === q ? '#FAF4F1' : '#fff',
                        color: quinzena === q ? '#8A3520' : '#64748B',
                        fontSize: '11px', fontWeight: 700,
                      }}>
                      {q}ª quinzena
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ position: 'relative', zIndex: 30 }}>
          <button type="button" onClick={() => setMenuAberto(m => m === 'status' ? null : 'status')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)',
              background: '#fff', color: '#0F172A', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
            }}>
            <Filter size={13} style={{ color: '#BC4A2A' }} />
            {labelStatus}
            <ChevronDown size={13} style={{ color: '#94A3B8', transition: 'transform .15s', transform: menuAberto === 'status' ? 'rotate(180deg)' : 'none' }} />
          </button>

          {menuAberto === 'status' && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 31, width: '200px',
              background: '#fff', border: '1px solid rgba(0,0,0,0.10)', borderRadius: '12px',
              boxShadow: '0 18px 40px rgba(0,0,0,0.16)', padding: '6px',
            }}>
              {FILTROS.map(f => {
                const ativo = filtro === f.id;
                return (
                  <button key={f.id} type="button" onClick={() => { setFiltro(f.id); setMenuAberto(null); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '7px', width: '100%',
                      padding: '8px 9px', borderRadius: '7px', border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: ativo ? '#FAF4F1' : 'transparent',
                      color: ativo ? '#8A3520' : '#0F172A',
                      fontSize: '12px', fontWeight: ativo ? 800 : 600,
                    }}>
                    <span style={{ flex: 1 }}>{f.label}</span>
                    {ativo && <Check size={12} style={{ color: '#BC4A2A' }} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button type="button" onClick={() => setMostrarDiarias(v => !v)} aria-expanded={mostrarDiarias}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            padding: '8px 12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.08)',
            background: mostrarDiarias ? '#FAF4F1' : '#fff',
            color: mostrarDiarias ? '#8A3520' : '#0F172A',
            fontSize: '12px', fontWeight: 700, cursor: 'pointer',
          }}>
          <ClipboardList size={13} style={{ color: '#BC4A2A' }} />
          Detalhes das diárias
          <ChevronDown size={13} style={{ color: '#94A3B8', transition: 'transform .15s', transform: mostrarDiarias ? 'rotate(180deg)' : 'none' }} />
        </button>
      </div>

      {/* Lista de diárias do período (abre/fecha pelo botão acima) */}
      {mostrarDiarias && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>{modo === 'mes' ? 'Diárias do mês' : 'Diárias da quinzena'}</p>
              <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                {labelPeriodo} · {diarias.length} diária{diarias.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button type="button" onClick={carregarDiarias} disabled={carregandoDiarias}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '8px', background: '#F1F5F9', border: 'none', cursor: carregandoDiarias ? 'wait' : 'pointer', fontSize: '11px', fontWeight: 700, color: '#0F172A' }}>
              <RefreshCw size={11} className={carregandoDiarias ? 'animate-spin' : ''} /> Atualizar
            </button>
          </div>

          {carregandoDiarias ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <Loader2 size={20} className="animate-spin" style={{ color: '#BC4A2A', margin: '0 auto 8px' }} />
              <p style={{ fontSize: '12px', color: '#94A3B8' }}>Carregando diárias...</p>
            </div>
          ) : diarias.length === 0 ? (
            <p style={{ padding: '28px 16px', textAlign: 'center', fontSize: '12px', color: '#94A3B8' }}>
              Nenhuma diária lançada neste período.
            </p>
          ) : (
            diarias.map(d => {
              const total = d.employees?.length || 0;
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                      {d.companyName || 'Empresa'} · {fmtDia(d.date)}{d.time ? ` · ${d.time}` : ''}
                    </p>
                    <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                      {total} ajudante{total !== 1 ? 's' : ''}{d.service ? ` · ${d.service}` : ''}
                      {d.tipoServico === 'carga_descarga' ? ' · Carga e Descarga' : ''}
                    </p>
                  </div>
                  <button type="button" onClick={() => setDetalheDiaria(d)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '8px',
                      border: '1px solid rgba(188,74,42,0.35)', background: '#FAF4F1', color: '#8A3520',
                      fontSize: '10px', fontWeight: 800, cursor: 'pointer',
                    }}>
                    <ClipboardList size={11} /> Ver detalhes
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {loading ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <Loader2 size={24} className="animate-spin" style={{ color: '#BC4A2A', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '13px', color: '#94A3B8' }}>Carregando convocações…</p>
        </div>
      ) : grupos.length === 0 ? (
        <div className="card" style={{ padding: '56px 20px', textAlign: 'center' }}>
          <Send size={28} style={{ color: '#CBD5E1', margin: '0 auto 10px' }} />
          <p style={{ fontSize: '14px', color: '#94A3B8' }}>Nenhuma convocação neste período.</p>
          <p style={{ fontSize: '11px', color: '#CBD5E1', marginTop: '4px' }}>
            Monte uma convocação na sub-aba Convocação para gerar a fila do período.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map(g => (
            <div key={g.escalaId} className="card overflow-hidden">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: '#0F172A' }}>
                    {g.empresa || 'Empresa'} · {fmtDia(g.data)}{g.horario ? ` · ${g.horario}` : ''}
                  </p>
                  <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>{g.endereco || 'endereço não informado'}</p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: g.confirmados >= g.vagas ? '#047857' : '#B45309', background: g.confirmados >= g.vagas ? '#D1FAE5' : '#FEF3C7', padding: '3px 9px', borderRadius: '7px' }}>
                  {g.confirmados}/{g.vagas} confirmados
                </span>
                <button type="button" onClick={() => abrirEdicao(g)}
                  title="Editar lançamento"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '8px',
                    border: '1px solid rgba(0,0,0,0.10)', background: '#F8FAFC', color: '#0F172A',
                    fontSize: '10px', fontWeight: 700, cursor: 'pointer',
                  }}>
                  <Edit2 size={11} /> Editar
                </button>
                <button type="button" onClick={() => excluirGrupo(g)} disabled={excluindo === g.escalaId}
                  title="Excluir convocação"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 9px', borderRadius: '8px',
                    border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C',
                    fontSize: '10px', fontWeight: 700, cursor: excluindo === g.escalaId ? 'wait' : 'pointer',
                    opacity: excluindo === g.escalaId ? 0.6 : 1,
                  }}>
                  <Trash2 size={11} /> {excluindo === g.escalaId ? 'Excluindo...' : 'Excluir'}
                </button>
              </div>

              {g.list.map(c => {
                const acionavel = ['pendente', 'enviada', 'reserva'].includes(c.status);
                return (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 16px', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: c.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {c.initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{c.name}</p>
                        {c.papel === 'reserva' && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', fontSize: '9px', fontWeight: 700, color: '#6B7280', background: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}>
                            <Shield size={8} /> reserva
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#64748B' }}><MapPin size={9} /> {fmtDistancia(c.distanciaKm)}</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#64748B' }}><Star size={9} /> {c.notaSnapshot == null ? 'sem nota' : fmtNota(c.notaSnapshot)}</span>
                        {c.registro?.entrada && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: '#64748B' }}>
                            <Clock size={9} /> {c.registro.entrada}{c.registro.saida ? `–${c.registro.saida}` : ''}
                          </span>
                        )}
                        {c.phone && <span style={{ fontSize: '10px', color: '#94A3B8' }}>{c.phone}</span>}
                      </div>
                    </div>

                    <ConvocacaoBadge status={c.status} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <WhatsAppButton phone={c.phone} message={textoConvite(c)} label="Convite" compact />
                      {acionavel && (
                        <button onClick={(e) => abrirMenuResposta(e, c)} disabled={agindo === c.id}
                          title="Registrar a resposta do ajudante"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px',
                            borderRadius: '8px', border: '1px solid rgba(188,74,42,0.35)', background: '#FAF4F1',
                            color: '#8A3520', fontSize: '10px', fontWeight: 800,
                            cursor: agindo === c.id ? 'wait' : 'pointer', opacity: agindo === c.id ? 0.6 : 1,
                          }}>
                          <MessageCircle size={11} />
                          {agindo === c.id ? 'Salvando...' : 'Responder'}
                          <ChevronDown size={12} style={{ transition: 'transform .15s', transform: menuRow?.id === c.id ? 'rotate(180deg)' : 'none' }} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Menu "Responder" ancorado à linha selecionada. O portal evita que o
          transform de :hover do card (que vira bloco contentor) desloque o
          position: fixed. */}
      {menuRow && createPortal((() => {
        const conv = convs.find(x => x.id === menuRow.id);
        if (!conv) return null;
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenuRow(null)} />
            <div style={{
              position: 'fixed', top: menuRow.top, left: menuRow.left, zIndex: 41, width: '224px',
              background: '#fff', border: '1px solid rgba(0,0,0,0.10)', borderRadius: '12px',
              boxShadow: '0 18px 40px rgba(0,0,0,0.20)', padding: '6px',
            }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 8px 8px' }}>
                Registrar resposta
              </p>
              {RESPOSTAS.map(({ id, label, desc, icon: Icon, color, bg }) => (
                <button key={id} type="button" disabled={agindo === conv.id}
                  onClick={() => { setMenuRow(null); agir(id, conv); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px', width: '100%',
                    padding: '8px 9px', borderRadius: '9px', border: 'none', background: 'transparent',
                    cursor: agindo === conv.id ? 'wait' : 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = bg; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                  <Icon size={15} style={{ color, flexShrink: 0 }} />
                  <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#0F172A' }}>{label}</span>
                    <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        );
      })(), document.body)}

      {/* Edição do lançamento — reaproveita o formulário de demanda do Operacional */}
      {editando && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1300 }}
          onClick={e => { if (e.target === e.currentTarget) setEditando(null); }}>
          <div className="modal-box animate-fade-up" style={{ maxWidth: '1120px', maxHeight: '92vh', overflowY: 'auto', padding: '18px' }}>
            <DemandForm
              initialData={{
                companyId:         editando.companyId,
                date:              editando.date,
                time:              editando.time || '07:30',
                entrada:           hhmm(editando.employees?.[0]?.entrada) || editando.time || '07:30',
                saida:             hhmm(editando.employees?.[0]?.saida),
                saidaAlmoco:       hhmm(editando.employees?.[0]?.saidaAlmoco),
                retornoAlmoco:     hhmm(editando.employees?.[0]?.retornoAlmoco),
                service:           editando.service || '',
                selectedEmployees: (editando.employees || []).map(e => e.employeeId),
                tipoServico:       editando.tipoServico || 'entrega',
                desconto:          editando.desconto  ?? '',
                acrescimo:         editando.acrescimo ?? '',
                employeeTimes:     (editando.employees || []).reduce((acc, e) => {
                  acc[e.employeeId] = {
                    entrada: hhmm(e.entrada),
                    saida: hhmm(e.saida),
                    saidaAlmoco: hhmm(e.saidaAlmoco),
                    retornoAlmoco: hhmm(e.retornoAlmoco),
                  };
                  return acc;
                }, {}),
              }}
              employees={employees}
              companies={companies}
              submitLabel="Salvar alterações"
              onCancel={() => setEditando(null)}
              onSubmit={salvarEdicao}
            />
          </div>
        </div>,
        document.body
      )}

      {/* Detalhes de uma diária: horários e horas extras de cada ajudante */}
      {detalheDiaria && createPortal((() => {
        const d = detalheDiaria;
        const isCD = d.tipoServico === 'carga_descarga';
        const linhas = (d.employees || []).map(e => ({
          ...e,
          emp: employeesById.get(e.employeeId),
          calc: calculateWorkAndOvertime(
            e.entrada,
            e.saida,
            isCD ? null : e.saidaAlmoco,
            isCD ? null : e.retornoAlmoco,
          ),
        }));
        const totalHE = linhas.reduce((s, l) => s + (l.calc?.overtimeMinutes || 0), 0);
        const cell = { padding: '8px 12px', whiteSpace: 'nowrap' };
        const th = { padding: '8px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };

        return (
          <div className="modal-overlay" style={{ zIndex: 1300 }}
            onClick={ev => { if (ev.target === ev.currentTarget) setDetalheDiaria(null); }}>
            <div className="modal-box animate-fade-up" style={{ maxWidth: '820px', maxHeight: '90vh', overflowY: 'auto', padding: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <p style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{d.companyName || 'Empresa'}</p>
                  <p style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>
                    {fmtDia(d.date)}{d.time ? ` · ${d.time}` : ''} · {isCD ? 'Carga e Descarga' : 'Diária'}
                  </p>
                </div>
                <button type="button" onClick={() => setDetalheDiaria(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', background: '#F1F5F9', padding: '4px 10px', borderRadius: '7px' }}>
                  {linhas.length} ajudante{linhas.length !== 1 ? 's' : ''}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: totalHE > 0 ? '#8A3520' : '#047857', background: totalHE > 0 ? '#FAF4F1' : '#F0FDF4', padding: '4px 10px', borderRadius: '7px' }}>
                  {totalHE > 0 ? `+${minutesToFormattedTime(totalHE)} de hora extra` : 'Sem horas extras'}
                </span>
                {d.service && (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', background: '#F8FAFC', padding: '4px 10px', borderRadius: '7px' }}>
                    {d.service}
                  </span>
                )}
              </div>

              <div style={{ border: '1px solid rgba(0,0,0,0.07)', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      <th style={th}>Ajudante</th>
                      {isCD ? (
                        <>
                          <th style={th}>Entrada</th>
                          <th style={th}>Saída</th>
                        </>
                      ) : (
                        <>
                          <th style={th}>Entrada</th>
                          <th style={th}>Almoço saída</th>
                          <th style={th}>Almoço retorno</th>
                          <th style={th}>Saída</th>
                        </>
                      )}
                      <th style={th}>Jornada</th>
                      <th style={th}>HE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.length === 0 ? (
                      <tr>
                        <td colSpan={isCD ? 5 : 7} style={{ ...cell, textAlign: 'center', color: '#94A3B8', padding: '24px 12px' }}>
                          Nenhum ajudante nesta diária.
                        </td>
                      </tr>
                    ) : linhas.map(l => (
                      <tr key={l.employeeId} style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                        <td style={cell}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: l.emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                              {l.emp?.initials || '?'}
                            </div>
                            <span style={{ fontWeight: 700, color: '#0F172A' }}>{l.emp?.name || 'Ajudante'}</span>
                          </div>
                        </td>
                        {isCD ? (
                          <>
                            <td style={cell}>{hhmm(l.entrada) || '—'}</td>
                            <td style={cell}>{hhmm(l.saida) || '—'}</td>
                          </>
                        ) : (
                          <>
                            <td style={cell}>{hhmm(l.entrada) || '—'}</td>
                            <td style={cell}>{hhmm(l.saidaAlmoco) || '—'}</td>
                            <td style={cell}>{hhmm(l.retornoAlmoco) || '—'}</td>
                            <td style={cell}>{hhmm(l.saida) || '—'}</td>
                          </>
                        )}
                        <td style={cell}>{l.calc?.isComplete ? l.calc.workedFormatted : '—'}</td>
                        <td style={{ ...cell, fontWeight: 800, color: l.calc?.hasOvertime ? '#BC4A2A' : '#0F172A' }}>
                          {l.calc?.hasOvertime ? `+${l.calc.overtimeFormatted}` : '0h'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })(), document.body)}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', padding: '10px 12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid rgba(0,0,0,0.06)' }}>
        <Info size={13} style={{ color: '#64748B', flexShrink: 0, marginTop: '1px' }} />
        <p style={{ fontSize: '11px', color: '#64748B', lineHeight: 1.5 }}>
          <b>Convocação manual:</b> use o botão <b>Convite</b> para abrir a conversa no WhatsApp e, depois,
          registre a resposta pelo menu <b>Responder</b> (Aceitou / Recusou / Silêncio). Regra de vagas: ao aceitar
          com a lista cheia, o ajudante vira <b>reserva</b>.
        </p>
      </div>
    </div>
  );
}
