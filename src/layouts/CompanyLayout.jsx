import { useState } from 'react';
import { Outlet, useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut, LayoutDashboard, Calendar, DollarSign, Settings, Menu, ChevronLeft } from 'lucide-react';

const TABS = [
  { id: 'panel',     label: 'Painel Inicial',  icon: LayoutDashboard },
  { id: 'escalas',   label: 'Escalas',         icon: Calendar },
  { id: 'financial', label: 'Financeiro',      icon: DollarSign },
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
        {/* Logo */}
        <div className="flex items-center justify-center overflow-hidden" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '14px 16px' }}>
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
            alt="FariLog"
            style={{ height: open ? '90px' : '40px', objectFit: 'contain', transition: 'height 0.3s, transform 0.3s', maxWidth: '100%', transform: open ? 'scale(1.85)' : 'scale(1)', transformOrigin: 'center' }}
          />
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
        {/* Top bar */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between px-6 py-3.5"
          style={{ background: '#EEF1F5', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
        >
          <button onClick={() => setOpen(!open)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: '#94A3B8', background: 'rgba(0,0,0,0.04)' }}>
            {open ? <ChevronLeft size={17} /> : <Menu size={17} />}
          </button>
          <div className="flex items-center gap-2.5">
            <div className="avatar w-8 h-8 rounded-full text-xs"
              style={{ background: 'linear-gradient(135deg,#FF4D0C,#E03A00)', width: '32px', height: '32px', borderRadius: '50%', fontSize: '11px' }}>
              {user?.name?.slice(0,2).toUpperCase()}
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet context={{ tab }} />
        </main>
      </div>
    </div>
  );
}
