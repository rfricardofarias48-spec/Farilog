import { useState } from 'react';
import { Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Calendar, DollarSign, Settings, ChevronLeft, ChevronRight, FileText, Users } from 'lucide-react';

const TABS = [
  { id: 'panel',     label: 'Painel Inicial',  icon: LayoutDashboard },
  { id: 'escalas',   label: 'Escalas',         icon: Calendar },
  { id: 'equipe',    label: 'Equipe',          icon: Users },
  { id: 'financial', label: 'Financeiro',      icon: DollarSign },
  { id: 'relatorio', label: 'Relatório',       icon: FileText },
  { id: 'settings',  label: 'Configurações',   icon: Settings },
];

export default function CompanyLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState('panel');

  return (
    <div className="min-h-screen flex" style={{ background: '#EEF1F5' }}>
      {/* Sidebar — dark */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-full z-50 transition-all duration-300 ${open ? 'w-56' : 'w-16'}`}
        style={{ background: '#111827' }}
      >
        {/* Logo + toggle */}
        <div className="flex items-center justify-center overflow-hidden" style={{ position: 'relative', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
            alt="FariLog"
            style={{ height: open ? '90px' : '40px', objectFit: 'contain', transition: 'height 0.3s, transform 0.3s', maxWidth: '100%', transform: open ? 'scale(1.85)' : 'scale(1)', transformOrigin: 'center' }}
          />
          <button
            onClick={() => setOpen(!open)}
            style={{
              position: 'absolute', top: '10px', right: '-10px', zIndex: 60,
              width: '20px', height: '20px', borderRadius: '50%',
              background: '#1E293B', border: '1.5px solid #374151',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#9CA3AF',
            }}
          >
            {open ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
          </button>
        </div>

        {/* Menu label */}
        {open && (
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: '#374151', textTransform: 'uppercase', padding: '20px 16px 8px' }}>
            Menu
          </p>
        )}

        {/* Tabs as nav */}
        <nav className="flex-1 px-2 space-y-1" style={{ paddingTop: open ? 0 : '16px' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`tab-btn ${tab === id ? 'active' : ''} ${!open ? 'justify-center px-0' : ''}`}
            >
              <Icon size={17} className="flex-shrink-0" />
              {open && <span>{label}</span>}
            </button>
          ))}
        </nav>

        {/* User + logout */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {open && (
            <div className="px-3 py-2 mb-1">
              <p className="text-xs font-semibold truncate" style={{ color: '#F1F5F9' }}>{user?.name}</p>
              <p className="text-xs" style={{ color: '#374151' }}>Empresa</p>
            </div>
          )}
          <button
            onClick={() => { logout(); navigate('/'); }}
            className={`tab-btn hover:text-red-400 ${!open ? 'justify-center px-0' : ''}`}
            style={{ color: '#4B5563', background: 'none' }}
          >
            <LogOut size={17} className="flex-shrink-0" />
            {open && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${open ? 'md:ml-56' : 'md:ml-16'}`}>
        <main className="flex-1 p-6">
          <Outlet context={{ tab, setTab }} />
        </main>
      </div>
    </div>
  );
}
