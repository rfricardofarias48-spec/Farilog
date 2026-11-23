import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Send, ClipboardList, CalendarPlus } from 'lucide-react';
import MontarEscala from '../lider/MontarEscala';
import AdminConvocacao from './AdminConvocacao';
import LancamentoManual from './LancamentoManual';

const SUB_TABS = [
  { key: 'nova',      label: 'Convocação',               icon: Send },
  { key: 'manual',    label: 'Lançamento manual',        icon: CalendarPlus },
  { key: 'historico', label: 'Histórico de convocações', icon: ClipboardList },
];

function quinzenaDaData(iso) {
  const dia = Number(String(iso || '').slice(8, 10));
  return dia && dia <= 15 ? 1 : 2;
}

// Admin monta convocações para qualquer empresa (mesmo fluxo do encarregado)
// e consulta o histórico por período.
export default function AdminConvocacoes() {
  const { companies } = useAuth();
  const [sub, setSub] = useState('nova');
  const [periodo, setPeriodo] = useState(null);
  const [resetKey, setResetKey] = useState(0);

  const aoSalvar = (saved) => {
    const data = saved?.date || null;
    setPeriodo(data ? { mes: data.slice(0, 7), quinzena: quinzenaDaData(data) } : null);
    setSub('historico');
  };

  return (
    <div className="space-y-5">
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#F5F5F5', border: '1px solid rgba(0,0,0,0.06)', flexWrap: 'wrap' }}>
        {SUB_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setSub(key)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: sub === key ? 'white' : 'transparent',
              color: sub === key ? '#0B0B0B' : '#6B6B6B',
              border: 'none', cursor: 'pointer',
              boxShadow: sub === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {sub === 'nova' && (
        <div className="animate-fade-up" style={{ maxWidth: '1120px' }}>
          <MontarEscala
            key={resetKey}
            admin
            companies={companies}
            onSaved={aoSalvar}
            onCancel={() => setResetKey(k => k + 1)}
          />
        </div>
      )}

      {sub === 'manual' && (
        <div className="animate-fade-up">
          <LancamentoManual />
        </div>
      )}

      {sub === 'historico' && (
        <div className="animate-fade-up">
          <AdminConvocacao
            key={periodo ? `${periodo.mes}-${periodo.quinzena}` : 'periodo-atual'}
            initialMes={periodo?.mes}
            initialQuinzena={periodo?.quinzena}
          />
        </div>
      )}
    </div>
  );
}