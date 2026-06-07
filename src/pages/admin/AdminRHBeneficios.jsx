import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  fetchWorkRecordsByPeriod, fetchRecargas,
  createRecargasLote, updateEmployee,
} from '../../lib/db';
import {
  Bus, UtensilsCrossed, CheckSquare, Square, RefreshCw,
  History, Plus, Check, Edit2, X, ChevronDown, ChevronRight,
} from 'lucide-react';

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = v => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const TODAY_ISO = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const MONTH_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function getQuinzenaInfo(iso = TODAY_ISO) {
  const [y, m, d] = iso.split('-').map(Number);
  const q = d <= 15 ? 1 : 2;
  const label = `${MONTH_FULL[m - 1]} ${y} — Q${q}`;
  const key   = `${y}-${String(m).padStart(2,'0')}-Q${q}`;
  const start = q === 1 ? `${y}-${String(m).padStart(2,'0')}-01` : `${y}-${String(m).padStart(2,'0')}-16`;
  const lastDay = new Date(y, m, 0).getDate();
  const end   = q === 1 ? `${y}-${String(m).padStart(2,'0')}-15` : `${y}-${String(m).padStart(2,'0')}-${lastDay}`;
  return { key, label, start, end };
}

// ── EditableValue ──────────────────────────────────────────────────────────
function EditableValue({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val,     setVal]     = useState(value);
  if (editing) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <input type="number" value={val} onChange={e => setVal(e.target.value)} autoFocus
        style={{ width: '70px', padding: '3px 6px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '12px' }} />
      <button onClick={() => { onSave(Number(val)); setEditing(false); }}
        style={{ background: '#DCFCE7', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '5px', color: '#059669' }}>
        <Check size={11} />
      </button>
      <button onClick={() => { setVal(value); setEditing(false); }}
        style={{ background: '#FEE2E2', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: '5px', color: '#E11D48' }}>
        <X size={11} />
      </button>
    </div>
  );
  return (
    <button onClick={() => setEditing(true)}
      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      <span style={{ fontSize: '13px', fontWeight: 700, color: '#2563EB' }}>{fmt(value)}</span>
      <Edit2 size={10} style={{ color: '#CBD5E1' }} />
    </button>
  );
}

// ── Nova Recarga ───────────────────────────────────────────────────────────
function NovaRecarga({ tipo, employees, quinzena }) {
  const field = tipo === 'VT' ? 'vtDiario' : 'vrDiario';

  const [selected,   setSelected]   = useState({});   // { empId: boolean }
  const [dias,       setDias]       = useState({});   // { empId: number }
  const [workedDays, setWorkedDays] = useState({});   // { empId: number } from varredura
  const [scanning,   setScanning]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [empValues,  setEmpValues]  = useState({});   // overrides for vt/vr daily value

  // Inicializa seleção e dias com todos ativos selecionados
  useEffect(() => {
    const sel = {}, d = {};
    employees.forEach(e => {
      sel[e.id] = true;
      d[e.id]   = 0;
    });
    setSelected(sel);
    setDias(d);
  }, [employees]);

  // Varredura: conta dias trabalhados no período da quinzena
  const handleScan = async () => {
    setScanning(true);
    const recs = await fetchWorkRecordsByPeriod(null, null, quinzena.start, quinzena.end);
    const map = {};
    recs.filter(r => r.checkIn).forEach(r => {
      if (!map[r.employeeId]) map[r.employeeId] = new Set();
      map[r.employeeId].add(r.date);
    });
    const worked = {};
    employees.forEach(e => { worked[e.id] = map[e.id] ? map[e.id].size : 0; });
    setWorkedDays(worked);
    setDias({ ...worked });
    setScanning(false);
  };

  // Salvar em lote
  const handleSave = async () => {
    const items = employees
      .filter(e => selected[e.id] && (dias[e.id] ?? 0) > 0)
      .map(e => {
        const valorDia = empValues[e.id] ?? e[field];
        return {
          funcionarioId: e.id,
          tipo,
          dias:       Number(dias[e.id]),
          valorDia,
          total:      Number(dias[e.id]) * valorDia,
          quinzena:   quinzena.key,
          dataRecarga: TODAY_ISO,
        };
      });
    if (items.length === 0) return;
    setSaving(true);
    const ok = await createRecargasLote(items);
    setSaving(false);
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  };

  const allSelected = employees.every(e => selected[e.id]);
  const toggleAll   = () => {
    const val = !allSelected;
    const sel = {};
    employees.forEach(e => { sel[e.id] = val; });
    setSelected(sel);
  };

  const totalGeral = employees.reduce((s, e) => {
    if (!selected[e.id]) return s;
    const valorDia = empValues[e.id] ?? e[field];
    return s + (Number(dias[e.id] ?? 0) * valorDia);
  }, 0);

  const color = tipo === 'VT' ? '#2563EB' : '#059669';
  const bg    = tipo === 'VT' ? '#EFF6FF' : '#F0FDF4';

  return (
    <div className="space-y-5">
      {/* Header da quinzena + botão varredura */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8' }}>Quinzena atual</p>
          <p style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>{quinzena.label}</p>
        </div>
        <button onClick={handleScan} disabled={scanning}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px', border: 'none', cursor: 'pointer', background: '#F1F5F9', color: '#0F172A', fontSize: '12px', fontWeight: 600 }}>
          <RefreshCw size={13} style={{ animation: scanning ? 'spin 1s linear infinite' : 'none' }} />
          {scanning ? 'Varrendo...' : 'Varredura de dias trabalhados'}
        </button>
      </div>

      {/* Tabela de seleção */}
      <div className="card overflow-hidden">
        {/* Cabeçalho */}
        <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 130px 90px 110px', padding: '9px 16px', background: '#F8FAFC', borderBottom: '1px solid rgba(0,0,0,0.06)', fontSize: '10px', fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', gap: '8px', alignItems: 'center' }}>
          <button onClick={toggleAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: allSelected ? '#FF4D0C' : '#CBD5E1', display: 'flex' }}>
            {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
          </button>
          <span>Ajudante</span>
          <span style={{ textAlign: 'center' }}>Valor/dia ({tipo})</span>
          <span style={{ textAlign: 'center' }}>Dias</span>
          <span style={{ textAlign: 'right' }}>Total</span>
        </div>

        {employees.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center' }}>
            <p style={{ fontSize: '13px', color: '#CBD5E1' }}>Nenhum ajudante ativo</p>
          </div>
        ) : employees.map((emp, idx) => {
          const isSelected = !!selected[emp.id];
          const valorDia   = empValues[emp.id] ?? emp[field];
          const d          = Number(dias[emp.id] ?? 0);
          const total      = d * valorDia;
          const worked     = workedDays[emp.id];

          return (
            <div key={emp.id} style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 130px 90px 110px',
              padding: '12px 16px', borderBottom: idx < employees.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none',
              alignItems: 'center', gap: '8px',
              background: isSelected ? 'rgba(37,99,235,0.02)' : 'transparent',
              opacity: isSelected ? 1 : 0.45,
              transition: 'all 0.12s',
            }}>
              {/* Checkbox */}
              <button onClick={() => setSelected(s => ({ ...s, [emp.id]: !s[emp.id] }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSelected ? color : '#CBD5E1', display: 'flex' }}>
                {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>

              {/* Nome */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: emp.color || '#94A3B8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                  {emp.initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.name}{emp.cidade ? <span style={{ color: '#94A3B8', fontWeight: 400 }}> ({emp.cidade})</span> : ''}
                  </p>
                  {worked !== undefined && (
                    <p style={{ fontSize: '10px', color: worked > 0 ? '#059669' : '#E11D48', marginTop: '1px' }}>
                      {worked} dia{worked !== 1 ? 's' : ''} trabalhado{worked !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>

              {/* Valor/dia — editável */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <EditableValue
                  value={valorDia}
                  onSave={async v => {
                    setEmpValues(prev => ({ ...prev, [emp.id]: v }));
                    await updateEmployee(emp.id, { [field]: v });
                  }}
                />
              </div>

              {/* Dias */}
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <input
                  type="number" min="0" max="31"
                  value={d || ''}
                  onChange={e => setDias(prev => ({ ...prev, [emp.id]: Number(e.target.value) || 0 }))}
                  style={{ width: '56px', padding: '5px 8px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '13px', fontWeight: 600, textAlign: 'center', color: '#0F172A' }}
                />
              </div>

              {/* Total */}
              <p style={{ textAlign: 'right', fontSize: '13px', fontWeight: 700, color: total > 0 ? color : '#CBD5E1' }}>
                {total > 0 ? fmt(total) : '—'}
              </p>
            </div>
          );
        })}

        {/* Rodapé totais */}
        {employees.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: '#F8FAFC', borderTop: '2px solid rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: '12px', color: '#64748B', fontWeight: 600 }}>
              {Object.values(selected).filter(Boolean).length} ajudante{Object.values(selected).filter(Boolean).length !== 1 ? 's' : ''} selecionado{Object.values(selected).filter(Boolean).length !== 1 ? 's' : ''}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: '10px', color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase' }}>Total {tipo}</p>
                <p style={{ fontSize: '18px', fontWeight: 900, color }}>  {fmt(totalGeral)}</p>
              </div>
              <button onClick={handleSave} disabled={saving || totalGeral === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '10px 18px', borderRadius: '10px', border: 'none', cursor: totalGeral > 0 ? 'pointer' : 'not-allowed',
                  background: totalGeral > 0 ? color : '#E2E8F0',
                  color: totalGeral > 0 ? 'white' : '#94A3B8',
                  fontSize: '13px', fontWeight: 700,
                  boxShadow: totalGeral > 0 ? `0 2px 10px ${color}40` : 'none',
                }}>
                {saved ? <><Check size={13} /> Recarga salva!</> : saving ? 'Salvando...' : <><Plus size={13} /> Realizar Recarga</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Histórico ──────────────────────────────────────────────────────────────
function Historico({ tipo }) {
  const [recargas,  setRecargas]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState({});

  useEffect(() => {
    fetchRecargas(tipo).then(r => { setRecargas(r); setLoading(false); });
  }, [tipo]);

  // Agrupa por quinzena
  const grouped = useMemo(() => {
    const map = {};
    recargas.forEach(r => {
      if (!map[r.quinzena]) map[r.quinzena] = { quinzena: r.quinzena, items: [], total: 0 };
      map[r.quinzena].items.push(r);
      map[r.quinzena].total += r.total;
    });
    return Object.values(map).sort((a, b) => b.quinzena.localeCompare(a.quinzena));
  }, [recargas]);

  const color = tipo === 'VT' ? '#2563EB' : '#059669';

  if (loading) return <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>Carregando...</div>;

  if (grouped.length === 0) return (
    <div className="card" style={{ padding: '56px', textAlign: 'center' }}>
      <History size={32} style={{ color: '#CBD5E1', margin: '0 auto 12px' }} />
      <p style={{ fontSize: '13px', color: '#94A3B8', fontWeight: 600 }}>Nenhuma recarga de {tipo} registrada</p>
      <p style={{ fontSize: '12px', color: '#CBD5E1', marginTop: '4px' }}>As recargas realizadas aparecerão aqui organizadas por quinzena</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {grouped.map(g => {
        const isOpen = expanded[g.quinzena];
        return (
          <div key={g.quinzena} className="card overflow-hidden">
            {/* Cabeçalho da quinzena */}
            <button
              onClick={() => setExpanded(prev => ({ ...prev, [g.quinzena]: !prev[g.quinzena] }))}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isOpen ? <ChevronDown size={15} style={{ color: '#94A3B8' }} /> : <ChevronRight size={15} style={{ color: '#94A3B8' }} />}
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>{g.quinzena.replace(/-Q/, ' · Q')}</p>
                  <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>{g.items.length} ajudante{g.items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <p style={{ fontSize: '16px', fontWeight: 900, color }}>{fmt(g.total)}</p>
            </button>

            {/* Detalhe */}
            {isOpen && (
              <>
                <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)' }} />
                {g.items.map((item, idx) => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 20px', borderBottom: idx < g.items.length - 1 ? '1px solid rgba(0,0,0,0.04)' : 'none' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '9px', background: item.cor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {item.iniciais}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A' }}>
                        {item.nome}{item.cidade ? <span style={{ color: '#94A3B8', fontWeight: 400 }}> ({item.cidade})</span> : ''}
                      </p>
                      <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: '1px' }}>
                        {item.dias} dia{item.dias !== 1 ? 's' : ''} × {fmt(item.valorDia)} · {item.dataRecarga}
                      </p>
                    </div>
                    <p style={{ fontSize: '14px', fontWeight: 800, color }}>{fmt(item.total)}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Aba de benefício (VT ou VR) ────────────────────────────────────────────
function BeneficioAba({ tipo, employees }) {
  const [subTab, setSubTab] = useState('nova');
  const quinzena = getQuinzenaInfo();

  const Icon = tipo === 'VT' ? Bus : UtensilsCrossed;
  const color = tipo === 'VT' ? '#2563EB' : '#059669';
  const label = tipo === 'VT' ? 'Vale Transporte' : 'Vale Refeição';

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid rgba(0,0,0,0.07)', paddingBottom: '12px' }}>
        {[['nova', 'Nova Recarga', Plus], ['historico', 'Histórico', History]].map(([key, lbl, Ic]) => (
          <button key={key} onClick={() => setSubTab(key)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, transition: 'all 0.12s',
              background: subTab === key ? color : '#F1F5F9',
              color:      subTab === key ? 'white' : '#64748B',
            }}>
            <Ic size={12} /> {lbl}
          </button>
        ))}
      </div>

      {subTab === 'nova' && (
        <NovaRecarga tipo={tipo} employees={employees} quinzena={quinzena} />
      )}
      {subTab === 'historico' && (
        <Historico tipo={tipo} />
      )}
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
      {/* Cabeçalho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Benefícios</h1>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
            {ativos.length} ajudante{ativos.length !== 1 ? 's' : ''} ativo{ativos.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Tabs VT | VR */}
      <div style={{ display: 'flex', gap: '6px' }}>
        {[['VT', Bus, '#2563EB', '#EFF6FF'], ['VR', UtensilsCrossed, '#059669', '#F0FDF4']].map(([tipo, Icon, c, bg]) => (
          <button key={tipo} onClick={() => setBenefTab(tipo)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 20px', borderRadius: '12px', border: '2px solid',
              borderColor: benefTab === tipo ? c : 'rgba(0,0,0,0.08)',
              cursor: 'pointer', fontSize: '13px', fontWeight: 700, transition: 'all 0.15s',
              background: benefTab === tipo ? bg : '#F8FAFC',
              color:      benefTab === tipo ? c  : '#64748B',
            }}>
            <Icon size={15} />
            {tipo === 'VT' ? 'Vale Transporte (VT)' : 'Vale Refeição (VR)'}
          </button>
        ))}
      </div>

      <BeneficioAba tipo={benefTab} employees={ativos} />
    </div>
  );
}
