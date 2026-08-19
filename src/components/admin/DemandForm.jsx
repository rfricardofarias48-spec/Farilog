import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { calculateWorkAndOvertime } from '../../lib/timeUtils';
import {
  Building2, Calendar, Clock, ChevronDown, CheckCircle2,
  Send, Search, AlertCircle, Trash2, Plus, Users, X, Flame, Sparkles,
} from 'lucide-react';

const T  = { color: '#0F172A' };
const TM = { color: '#94A3B8' };

const TODAY_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

// ── Modal de Seleção de Ajudantes ───────────────────────────────────────
function EmployeeSelectModal({
  isOpen,
  onClose,
  allEmployees,
  selectedIds,
  onConfirmSelection,
}) {
  const [tempSelected, setTempSelected] = useState(selectedIds);
  const [modalSearch, setModalSearch] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTempSelected(selectedIds);
      setModalSearch('');
    }
  }, [isOpen, selectedIds]);

  if (!isOpen) return null;

  const filtered = allEmployees.filter(emp => {
    const q = modalSearch.toLowerCase();
    return (
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.cargo && emp.cargo.toLowerCase().includes(q))
    );
  });

  const toggleOne = (id) => {
    setTempSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    const allFilteredIds = filtered.map(e => e.id);
    setTempSelected(prev => Array.from(new Set([...prev, ...allFilteredIds])));
  };

  const deselectAll = () => {
    setTempSelected([]);
  };

  const handleConfirm = () => {
    onConfirmSelection(tempSelected);
    onClose();
  };

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(15,23,42,0.5)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div style={{
        background: '#ffffff', borderRadius: '20px', width: '100%', maxWidth: '660px',
        boxShadow: '0 25px 60px -15px rgba(0,0,0,0.35)',
        display: 'flex', flexDirection: 'column', maxHeight: '85vh',
        overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)',
      }}>
        {/* Topo do modal */}
        <div style={{
          padding: '18px 22px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#FAFAFA'
        }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} style={{ color: '#FF4D0C' }} />
              Selecionar Ajudantes para a Demanda
            </h3>
            <p style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
              Marque os colaboradores que você deseja escalar. Após confirmar, a lista de horários será montada.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '8px', border: 'none',
              background: '#F1F5F9', color: '#64748B', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Barra de pesquisa e ações rápidas */}
        <div style={{ padding: '12px 22px', borderBottom: '1px solid #F1F5F9', background: '#FFFFFF' }}>
          <div className="relative mb-2">
            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
            <input
              type="text"
              className="input-field"
              style={{ paddingLeft: '34px', fontSize: '12px', height: '36px' }}
              placeholder="Buscar ajudante por nome ou cargo..."
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              autoFocus
            />
            {modalSearch && (
              <button
                onClick={() => setModalSearch('')}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#475569' }}>
              {tempSelected.length} de {allEmployees.length} selecionado(s)
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={selectAll}
                style={{ fontSize: '11px', fontWeight: 600, color: '#0284C7', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Marcar filtrados ({filtered.length})
              </button>
              <button
                type="button"
                onClick={deselectAll}
                style={{ fontSize: '11px', fontWeight: 600, color: '#E11D48', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Desmarcar todos
              </button>
            </div>
          </div>
        </div>

        {/* Lista de colaboradores em formato vertical (um abaixo do outro) */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '14px 22px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#94A3B8' }}>
              <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
              <p style={{ fontSize: '13px', fontWeight: 600 }}>Nenhum colaborador encontrado</p>
              <p style={{ fontSize: '11px' }}>Tente buscar por outro termo</p>
            </div>
          ) : (
            filtered.map(emp => {
              const isChecked = tempSelected.includes(emp.id);
              return (
                <div
                  key={emp.id}
                  onClick={() => toggleOne(emp.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 14px', borderRadius: '12px', cursor: 'pointer',
                    background: isChecked ? '#FFF5F2' : '#FFFFFF',
                    border: isChecked ? '1.5px solid #FF4D0C' : '1px solid #E2E8F0',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={e => { if (!isChecked) e.currentTarget.style.background = '#F8FAFC'; }}
                  onMouseLeave={e => { if (!isChecked) e.currentTarget.style.background = '#FFFFFF'; }}
                >
                  {/* Checkbox */}
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                    border: isChecked ? 'none' : '1.5px solid #CBD5E1',
                    background: isChecked ? '#FF4D0C' : '#FFFFFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.1s',
                  }}>
                    {isChecked && <CheckCircle2 size={14} color="white" />}
                  </div>

                  {/* Avatar */}
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                    background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 800, color: 'white',
                  }}>
                    {emp.initials}
                  </div>

                  {/* Info: Nome e Cargo */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: isChecked ? '#FF4D0C' : '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {emp.name}
                    </p>
                    <p style={{ fontSize: '11px', color: '#64748B' }}>
                      {emp.cargo || 'Ajudante Geral'}
                    </p>
                  </div>

                  {/* Diária */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155', background: '#F1F5F9', padding: '4px 9px', borderRadius: '6px' }}>
                      R$ {emp.dailyRate || 150} / dia
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Rodapé fixo do modal */}
        <div style={{
          padding: '14px 22px', borderTop: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#FAFAFA'
        }}>
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A' }}>
            {tempSelected.length} ajudante(s) marcado(s)
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 16px', borderRadius: '10px', border: '1px solid #CBD5E1',
                background: '#FFFFFF', color: '#64748B', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                padding: '9px 22px', borderRadius: '10px', border: 'none',
                background: '#FF4D0C', color: '#FFFFFF', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(255,77,12,0.3)',
              }}
            >
              Confirmar Seleção ({tempSelected.length})
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Formulário Principal de Demanda ───────────────────────────────────────
export default function DemandForm({
  initialData,
  employees,
  companies,
  onSubmit,
  onCancel,
  submitLabel = 'Lançar Demanda'
}) {
  const activeEmployees = employees.filter(e => e.status === 'active');
  const [form, setForm] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        entrada:       initialData.entrada       || initialData.time || '07:30',
        saida:         initialData.saida         || '',
        saidaAlmoco:   initialData.saidaAlmoco   || '',
        retornoAlmoco: initialData.retornoAlmoco || '',
        employeeTimes: initialData.employeeTimes || {},
      };
    }
    return {
      companyId:         '',
      date:              TODAY_ISO,
      time:              '07:30',
      entrada:           '07:30',
      saida:             '',
      saidaAlmoco:       '',
      retornoAlmoco:     '',
      service:           '',
      selectedEmployees: [],
      tipoServico:       'entrega',
      employeeTimes:     {},
    };
  });

  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [error,             setError]             = useState('');
  const [saving,            setSaving]            = useState(false);
  const [success,           setSuccess]           = useState(false);

  // Estados da barra de preenchimento rápido / em lote
  const [batchEntrada,   setBatchEntrada]   = useState('07:30');
  const [batchSaida,     setBatchSaida]     = useState('');
  const [batchAlmocoS,   setBatchAlmocoS]   = useState('');
  const [batchAlmocoR,   setBatchAlmocoR]   = useState('');
  const [batchFeedback,  setBatchFeedback]  = useState('');

  const getNowTime = () => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
  };

  const handleConfirmModalSelection = (newSelectedIds) => {
    setForm(f => {
      const nextTimes = { ...f.employeeTimes };
      // Para cada novo adicionado, inicializa horários
      newSelectedIds.forEach(id => {
        if (!nextTimes[id]) {
          nextTimes[id] = {
            entrada:       f.entrada || '07:30',
            saida:         f.saida || '',
            saidaAlmoco:   f.saidaAlmoco || '',
            retornoAlmoco: f.retornoAlmoco || '',
          };
        }
      });
      // Remove tempos de quem foi desmarcado
      Object.keys(nextTimes).forEach(id => {
        if (!newSelectedIds.includes(id)) {
          delete nextTimes[id];
        }
      });

      return {
        ...f,
        selectedEmployees: newSelectedIds,
        employeeTimes: nextTimes,
      };
    });
  };

  const removeSingleEmployee = (empId) => {
    setForm(f => {
      const nextSelected = f.selectedEmployees.filter(id => id !== empId);
      const nextTimes = { ...f.employeeTimes };
      delete nextTimes[empId];
      return {
        ...f,
        selectedEmployees: nextSelected,
        employeeTimes: nextTimes,
      };
    });
  };

  const handleEmpTimeChange = (empId, field, val) => {
    setForm(f => ({
      ...f,
      employeeTimes: {
        ...f.employeeTimes,
        [empId]: {
          ...(f.employeeTimes[empId] || {
            entrada: f.entrada || '07:30',
            saida: f.saida || '',
            saidaAlmoco: f.saidaAlmoco || '',
            retornoAlmoco: f.retornoAlmoco || '',
          }),
          [field]: val,
        },
      },
    }));
  };

  // Replicar horário padrão em todos os ajudantes selecionados
  const applyBatchToAll = () => {
    if (form.selectedEmployees.length === 0) return;
    setForm(f => {
      const nextTimes = { ...f.employeeTimes };
      f.selectedEmployees.forEach(empId => {
        nextTimes[empId] = {
          entrada:       batchEntrada || f.entrada || '07:30',
          saida:         batchSaida,
          saidaAlmoco:   batchAlmocoS,
          retornoAlmoco: batchAlmocoR,
        };
      });
      return {
        ...f,
        entrada: batchEntrada || f.entrada,
        saida: batchSaida,
        saidaAlmoco: batchAlmocoS,
        retornoAlmoco: batchAlmocoR,
        employeeTimes: nextTimes,
      };
    });
    setBatchFeedback('✓ Horários aplicados a todos os ajudantes da tabela!');
    setTimeout(() => setBatchFeedback(''), 3000);
  };

  // Calcular estatísticas totais em tempo real de horas extras da demanda
  const isCargaDescarga = form.tipoServico === 'carga_descarga';
  let totalOvertimeMinutes = 0;
  let totalDiariasValue = 0;

  form.selectedEmployees.forEach(empId => {
    const emp = employees.find(e => e.id === empId);
    totalDiariasValue += (emp?.dailyRate || 150);

    const t = form.employeeTimes[empId] || {
      entrada: form.entrada || '07:30',
      saida: form.saida || '',
      saidaAlmoco: form.saidaAlmoco || '',
      retornoAlmoco: form.retornoAlmoco || '',
    };
    if (t.entrada && t.saida) {
      const calc = calculateWorkAndOvertime(
        t.entrada,
        t.saida,
        isCargaDescarga ? null : t.saidaAlmoco,
        isCargaDescarga ? null : t.retornoAlmoco
      );
      totalOvertimeMinutes += calc.overtimeMinutes;
    }
  });

  const totalOvertimeHours = Math.floor(totalOvertimeMinutes / 60);
  const totalOvertimeRemainingMins = totalOvertimeMinutes % 60;
  const totalOvertimeFormatted = totalOvertimeMinutes > 0
    ? `${totalOvertimeHours}h ${String(totalOvertimeRemainingMins).padStart(2, '0')}m`
    : '0h';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.companyId)                     { setError('Selecione uma empresa.'); return; }
    if (form.selectedEmployees.length === 0) { setError('Selecione ao menos um ajudante.'); return; }
    setError('');
    setSaving(true);
    const ok = await onSubmit(form);
    setSaving(false);
    if (ok && !initialData) {
      setForm({
        companyId:         '',
        date:              TODAY_ISO,
        time:              '07:30',
        entrada:           '07:30',
        saida:             '',
        saidaAlmoco:       '',
        retornoAlmoco:     '',
        service:           '',
        selectedEmployees: [],
        tipoServico:       'entrega',
        employeeTimes:     {},
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3500);
    }
  };

  const canSubmit = form.companyId && form.selectedEmployees.length > 0 && !saving;

  return (
    <>
      {/* Modal de seleção de ajudantes */}
      <EmployeeSelectModal
        isOpen={showEmployeeModal}
        onClose={() => setShowEmployeeModal(false)}
        allEmployees={activeEmployees}
        selectedIds={form.selectedEmployees}
        onConfirmSelection={handleConfirmModalSelection}
      />

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        {/* Cabeçalho do formulário */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-extrabold flex items-center gap-2" style={T}>
              <Send size={16} style={{ color: '#FF4D0C' }} />
              {submitLabel === 'Lançar Demanda' ? 'Lançamento de Demanda' : 'Editar Demanda'}
            </h2>
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
              Defina os dados da escala, selecione os colaboradores e acompanhe os horários e horas extras em formato lista.
            </p>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#FF4D0C', background: '#FFF2EE', padding: '4px 10px', borderRadius: '8px' }}>
            Escala & Horas Extras
          </span>
        </div>

        {/* Linha superior: Empresa, Data e Tipo de Serviço */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Empresa */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Empresa Cliente *</label>
            <div className="relative">
              <Building2 size={14} style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
              <select
                value={form.companyId}
                onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))}
                className="input-field"
                style={{ paddingLeft: '34px', appearance: 'none', fontSize: '12px' }}
                required
              >
                <option value="">Selecionar empresa...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Data */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Data do Serviço *</label>
            <input
              type="date"
              className="input-field"
              style={{ fontSize: '12px' }}
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              required
            />
          </div>

          {/* Tipo de Serviço */}
          <div>
            <label className="block text-xs font-semibold mb-1.5" style={{ color: '#475569' }}>Modalidade</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {[
                { value: 'entrega', label: 'Entrega (9h base)' },
                { value: 'carga_descarga', label: 'Carga/Descarga (8h)' },
              ].map(opt => {
                const sel = form.tipoServico === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, tipoServico: opt.value }))}
                    style={{
                      padding: '8px 6px', borderRadius: '10px', border: '1.5px solid',
                      borderColor: sel ? '#FF4D0C' : '#E2E8F0',
                      background: sel ? '#FFF2EE' : '#FFFFFF',
                      fontSize: '11px', fontWeight: 700,
                      color: sel ? '#FF4D0C' : '#475569',
                      cursor: 'pointer', textAlign: 'center', transition: 'all 0.12s',
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── CAIXA ÚNICA: Lista de Funcionários & Tabela de Horários ── */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1.5px solid rgba(0,0,0,0.08)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.03)',
          overflow: 'hidden',
        }}>
          {/* Topo da Caixa Única */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #F1F5F9',
            background: '#F8FAFC',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div>
              <div className="flex items-center gap-2">
                <Users size={16} style={{ color: '#FF4D0C' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0F172A' }}>
                  Equipe Escalada ({form.selectedEmployees.length})
                </h3>
                {form.selectedEmployees.length > 0 && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '6px' }}>
                    Total Diárias: R$ {totalDiariasValue.toLocaleString('pt-BR')}
                  </span>
                )}
              </div>
              <p style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                {isCargaDescarga
                  ? 'Regra Carga/Descarga: 8h base de trabalho direto.'
                  : 'Regra Entrega: 8h trabalho + 1h almoço (total 9h). Acima de 9h é hora extra.'}
              </p>
            </div>

            {/* Ações e Resumo de HE */}
            <div className="flex items-center gap-3">
              {form.selectedEmployees.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: totalOvertimeMinutes > 0 ? '#FFF2EE' : '#FFFFFF',
                  padding: '5px 12px', borderRadius: '8px',
                  border: totalOvertimeMinutes > 0 ? '1.5px solid rgba(255,77,12,0.3)' : '1px solid #E2E8F0',
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>Total Horas Extras:</span>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: totalOvertimeMinutes > 0 ? '#FF4D0C' : '#059669', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    {totalOvertimeMinutes > 0 && <Flame size={12} />}
                    {totalOvertimeFormatted}
                  </span>
                </div>
              )}

              {/* Botão de abrir modal para selecionar ajudantes */}
              <button
                type="button"
                onClick={() => setShowEmployeeModal(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '10px', border: 'none',
                  background: form.selectedEmployees.length > 0 ? '#0F172A' : '#FF4D0C',
                  color: '#FFFFFF', fontSize: '12px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: form.selectedEmployees.length > 0 ? '0 2px 8px rgba(15,23,42,0.2)' : '0 3px 12px rgba(255,77,12,0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Plus size={14} />
                {form.selectedEmployees.length === 0 ? 'Selecionar Ajudantes' : 'Alterar Seleção da Equipe'}
              </button>
            </div>
          </div>

          {/* Conteúdo da Caixa: Se vazio, mostra aviso limpo. Se selecionados, mostra a tabela */}
          {form.selectedEmployees.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '14px',
                background: '#FFF2EE', color: '#FF4D0C',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <Users size={24} />
              </div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                Nenhum ajudante selecionado ainda
              </p>
              <p style={{ fontSize: '12px', color: '#64748B', maxWidth: '380px', margin: '4px auto 16px' }}>
                Clique no botão abaixo para abrir a lista de colaboradores e marcar quem fará parte desta demanda.
              </p>
              <button
                type="button"
                onClick={() => setShowEmployeeModal(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '10px 22px', borderRadius: '10px', border: 'none',
                  background: '#FF4D0C', color: '#FFFFFF', fontSize: '13px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(255,77,12,0.3)',
                }}
              >
                <Plus size={15} /> Selecionar Ajudantes
              </button>
            </div>
          ) : (
            <div className="space-y-3 p-4">
              {/* Barra Opcional de Preenchimento Rápido em Lote */}
              <div style={{
                background: '#F8FAFC', padding: '10px 14px', borderRadius: '10px',
                border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
              }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    ⚡ Preenchimento Rápido:
                  </span>

                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Entrada:</span>
                    <input
                      type="time"
                      value={batchEntrada}
                      onChange={e => setBatchEntrada(e.target.value)}
                      style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', width: '80px', background: 'white' }}
                    />
                  </div>

                  {!isCargaDescarga && (
                    <div className="flex items-center gap-1">
                      <span style={{ fontSize: '11px', color: '#64748B' }}>Intervalo:</span>
                      <input
                        type="time"
                        value={batchAlmocoS}
                        onChange={e => setBatchAlmocoS(e.target.value)}
                        placeholder="12:00"
                        style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', width: '75px', background: 'white' }}
                      />
                      <span style={{ fontSize: '10px', color: '#94A3B8' }}>às</span>
                      <input
                        type="time"
                        value={batchAlmocoR}
                        onChange={e => setBatchAlmocoR(e.target.value)}
                        placeholder="13:00"
                        style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', width: '75px', background: 'white' }}
                      />
                      <button
                        type="button"
                        onClick={() => { setBatchAlmocoS('12:00'); setBatchAlmocoR('13:00'); }}
                        style={{ fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '4px', background: '#F1F5F9', color: '#475569', border: 'none', cursor: 'pointer' }}
                      >
                        12h-13h
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <span style={{ fontSize: '11px', color: '#64748B' }}>Saída:</span>
                    <input
                      type="time"
                      value={batchSaida}
                      onChange={e => setBatchSaida(e.target.value)}
                      placeholder="Em aberto"
                      style={{ fontSize: '11px', padding: '3px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', width: '80px', background: 'white' }}
                    />
                    {['16:00', '17:00', '17:30', '18:00'].map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBatchSaida(t)}
                        style={{ fontSize: '9px', fontWeight: 600, padding: '2px 4px', borderRadius: '4px', background: batchSaida === t ? '#059669' : '#FFFFFF', color: batchSaida === t ? 'white' : '#64748B', border: '1px solid rgba(0,0,0,0.1)', cursor: 'pointer' }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={applyBatchToAll}
                    style={{
                      fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '7px',
                      background: '#0F172A', color: 'white', border: 'none', cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: '4px',
                    }}
                  >
                    <Sparkles size={11} /> Aplicar a Todos
                  </button>
                </div>
              </div>

              {batchFeedback && (
                <p style={{ fontSize: '11px', fontWeight: 600, color: '#059669', paddingLeft: '4px' }}>
                  {batchFeedback}
                </p>
              )}

              {/* Tabela de Funcionários (um abaixo do outro em formato lista/tabela) */}
              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '1.5px solid #E2E8F0', color: '#475569', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '10px 14px', minWidth: '160px' }}>Nome</th>
                      <th style={{ padding: '10px 12px', minWidth: '100px' }}>Cargo</th>
                      <th style={{ padding: '10px 12px', minWidth: '90px' }}>Diária</th>
                      <th style={{ padding: '10px 10px', minWidth: '105px' }}>Horário Entrada</th>
                      <th style={{ padding: '10px 10px', minWidth: '105px' }}>Intervalo</th>
                      <th style={{ padding: '10px 10px', minWidth: '105px' }}>Volta Intervalo</th>
                      <th style={{ padding: '10px 10px', minWidth: '105px' }}>Saída</th>
                      <th style={{ padding: '10px 14px', minWidth: '140px' }}>Total Horas Extras</th>
                      <th style={{ padding: '10px 10px', width: '40px', textAlign: 'center' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.selectedEmployees.map((empId, idx) => {
                      const emp = employees.find(e => e.id === empId);
                      const empTime = form.employeeTimes[empId] || {
                        entrada: form.entrada || '07:30',
                        saida: form.saida || '',
                        saidaAlmoco: form.saidaAlmoco || '',
                        retornoAlmoco: form.retornoAlmoco || '',
                      };

                      const calc = (empTime.entrada && empTime.saida)
                        ? calculateWorkAndOvertime(
                            empTime.entrada,
                            empTime.saida,
                            isCargaDescarga ? null : empTime.saidaAlmoco,
                            isCargaDescarga ? null : empTime.retornoAlmoco
                          )
                        : null;

                      return (
                        <tr
                          key={empId}
                          style={{
                            borderBottom: idx === form.selectedEmployees.length - 1 ? 'none' : '1px solid #F1F5F9',
                            background: idx % 2 === 0 ? '#FFFFFF' : '#FAFBFC',
                          }}
                        >
                          {/* Coluna 1: Nome */}
                          <td style={{ padding: '10px 14px' }}>
                            <div className="flex items-center gap-2.5">
                              <div style={{
                                width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                                background: emp?.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '10px', fontWeight: 800, color: 'white',
                              }}>
                                {emp?.initials || '?'}
                              </div>
                              <span style={{ fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap' }}>
                                {emp?.name || 'Ajudante'}
                              </span>
                            </div>
                          </td>

                          {/* Coluna 2: Cargo */}
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: '11px', color: '#475569', fontWeight: 600 }}>
                              {emp?.cargo || 'Ajudante Geral'}
                            </span>
                          </td>

                          {/* Coluna 3: Diária */}
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#0F172A', background: '#F1F5F9', padding: '3px 7px', borderRadius: '5px' }}>
                              R$ {emp?.dailyRate || 150}
                            </span>
                          </td>

                          {/* Coluna 4: Horário Entrada */}
                          <td style={{ padding: '8px 10px' }}>
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={empTime.entrada || ''}
                                onChange={e => handleEmpTimeChange(empId, 'entrada', e.target.value)}
                                style={{
                                  fontSize: '11px', padding: '4px 6px', borderRadius: '6px',
                                  border: '1px solid #CBD5E1', width: '80px', background: 'white',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleEmpTimeChange(empId, 'entrada', getNowTime())}
                                title="Definir para agora"
                                style={{ fontSize: '8px', fontWeight: 700, padding: '2px 4px', borderRadius: '3px', background: '#EFF6FF', color: '#1D4ED8', border: 'none', cursor: 'pointer' }}
                              >
                                Agora
                              </button>
                            </div>
                          </td>

                          {/* Coluna 5: Intervalo (Saída Almoço) */}
                          <td style={{ padding: '8px 10px' }}>
                            {isCargaDescarga ? (
                              <span style={{ fontSize: '10px', color: '#94A3B8', fontStyle: 'italic' }}>Direto</span>
                            ) : (
                              <input
                                type="time"
                                value={empTime.saidaAlmoco || ''}
                                onChange={e => handleEmpTimeChange(empId, 'saidaAlmoco', e.target.value)}
                                placeholder="12:00"
                                style={{
                                  fontSize: '11px', padding: '4px 6px', borderRadius: '6px',
                                  border: '1px solid #CBD5E1', width: '80px', background: 'white',
                                }}
                              />
                            )}
                          </td>

                          {/* Coluna 6: Volta Intervalo (Retorno Almoço) */}
                          <td style={{ padding: '8px 10px' }}>
                            {isCargaDescarga ? (
                              <span style={{ fontSize: '10px', color: '#94A3B8', fontStyle: 'italic' }}>Direto</span>
                            ) : (
                              <input
                                type="time"
                                value={empTime.retornoAlmoco || ''}
                                onChange={e => handleEmpTimeChange(empId, 'retornoAlmoco', e.target.value)}
                                placeholder="13:00"
                                style={{
                                  fontSize: '11px', padding: '4px 6px', borderRadius: '6px',
                                  border: '1px solid #CBD5E1', width: '80px', background: 'white',
                                }}
                              />
                            )}
                          </td>

                          {/* Coluna 7: Saída */}
                          <td style={{ padding: '8px 10px' }}>
                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={empTime.saida || ''}
                                onChange={e => handleEmpTimeChange(empId, 'saida', e.target.value)}
                                placeholder="Em aberto"
                                style={{
                                  fontSize: '11px', padding: '4px 6px', borderRadius: '6px',
                                  border: empTime.saida ? '1.5px solid #059669' : '1px dashed #CBD5E1',
                                  background: empTime.saida ? '#F0FDF4' : 'white',
                                  width: '80px',
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => handleEmpTimeChange(empId, 'saida', getNowTime())}
                                title="Finalizar agora"
                                style={{ fontSize: '8px', fontWeight: 700, padding: '2px 4px', borderRadius: '3px', background: '#ECFDF5', color: '#059669', border: 'none', cursor: 'pointer' }}
                              >
                                Agora
                              </button>
                            </div>
                          </td>

                          {/* Coluna 8: Total Horas Extras */}
                          <td style={{ padding: '10px 14px' }}>
                            {calc ? (
                              <div className="flex flex-col gap-0.5">
                                {calc.hasOvertime ? (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                    fontSize: '11px', fontWeight: 800, color: '#FF4D0C',
                                    background: '#FFF2EE', padding: '2px 7px', borderRadius: '5px',
                                    width: 'fit-content', border: '1px solid rgba(255,77,12,0.25)',
                                  }}>
                                    <Flame size={11} /> +{calc.overtimeFormatted} HE
                                  </span>
                                ) : (
                                  <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '3px',
                                    fontSize: '11px', fontWeight: 700, color: '#059669',
                                    background: '#ECFDF5', padding: '2px 7px', borderRadius: '5px',
                                    width: 'fit-content',
                                  }}>
                                    0h HE
                                  </span>
                                )}
                                <span style={{ fontSize: '10px', color: '#64748B' }}>
                                  Jornada: {calc.workedFormatted}
                                </span>
                              </div>
                            ) : empTime.entrada ? (
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: '3px',
                                fontSize: '10px', fontWeight: 700, color: '#1D4ED8',
                                background: '#EFF6FF', padding: '2px 6px', borderRadius: '5px',
                              }}>
                                <Clock size={10} /> Em andamento
                              </span>
                            ) : (
                              <span style={{ fontSize: '11px', color: '#94A3B8' }}>
                                Sem entrada
                              </span>
                            )}
                          </td>

                          {/* Coluna 9: Ação Remover */}
                          <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => removeSingleEmployee(empId)}
                              title="Remover da escala"
                              style={{
                                background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer',
                                padding: '4px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = '#E11D48'}
                              onMouseLeave={e => e.currentTarget.style.color = '#94A3B8'}
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé e Botão de Salvar */}
        <div className="space-y-3 pt-2">
          {error && (
            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: '#E11D48' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="flex gap-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px', border: 'none',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  background: '#F1F5F9', color: '#64748B',
                }}
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '8px', padding: '13px', borderRadius: '12px', border: 'none',
                fontSize: '14px', fontWeight: 800, cursor: canSubmit ? 'pointer' : 'not-allowed',
                background: canSubmit ? '#FF4D0C' : '#E2E8F0',
                color: canSubmit ? 'white' : '#94A3B8',
                boxShadow: canSubmit ? '0 4px 14px rgba(255,77,12,0.3)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              <Send size={15} /> {saving ? 'Salvando demanda...' : submitLabel}
            </button>
          </div>

          {success && (
            <div className="flex items-center gap-2 text-xs font-semibold justify-center" style={{ color: '#059669' }}>
              <CheckCircle2 size={15} /> Demanda cadastrada e equipe escalada com sucesso!
            </div>
          )}
        </div>
      </form>
    </>
  );
}
