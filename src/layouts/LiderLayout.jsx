import { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, Calendar, FileText, Users, ChevronLeft, ChevronRight, Star,
} from 'lucide-react';

const TABS = [
  { id: 'hoje',      label: 'Hoje',       icon: Calendar },
  { id: 'escala',    label: 'Escala',     icon: FileText },
  { id: 'notas',     label: 'Notas',      icon: Star     },
  { id: 'ajudantes', label: 'Ajudantes',  icon: Users    },
];

export default function LiderLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(true);
  const [tab, setTab]   = useState('hoje');

  return (
    <div className="min-h-screen flex" style={{ background: '#F5F5F5' }}>
      {/* Sidebar desktop */}
      <aside
        className={`hidden md:flex flex-col fixed left-0 top-0 h-full z-50 transition-all duration-300 ${open ? 'w-56' : 'w-16'}`}
        style={{ background: '#0B0B0B', borderRight: '1px solid rgba(255,255,255,0.06)' }}
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
              background: '#1C1C1C', border: '1.5px solid #333333',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#9A9A9A',
            }}
          >
            {open ? <ChevronLeft size={11} /> : <ChevronRight size={11} />}
          </button>
        </div>

        {open && (
          <p style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', color: '#6B6B6B', textTransform: 'uppercase', padding: '20px 16px 8px' }}>
            Encarregado
          </p>
        )}

        <nav className="flex-1 px-2 space-y-1" style={{ paddingTop: open ? 0 : '16px' }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`sidebar-link w-full ${tab === id ? 'active' : ''} ${!open ? 'justify-center px-0' : ''}`}
              style={{ border: 'none', background: 'none' }}
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
              <p className="text-xs font-semibold truncate" style={{ color: '#F5F5F5' }}>{user?.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: user?.color || '#1C1C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '7px', fontWeight: 700, color: 'white' }}>
                  {user?.initials}
                </div>
                <p className="text-xs truncate" style={{ color: '#6B6B6B' }}>{user?.companyName || 'Encarregado'}</p>
              </div>
            </div>
          )}
          <button
            onClick={() => { logout(); navigate('/'); }}
            className={`sidebar-link w-full hover:text-white ${!open ? 'justify-center px-0' : ''}`}
            style={{ color: '#4A4A4A', border: 'none', background: 'none' }}
          >
            <LogOut size={17} className="flex-shrink-0" />
            {open && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Header mobile */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4"
        style={{ background: 'linear-gradient(160deg, #0F0F0F 0%, #000000 100%)', height: '64px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <img src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
          alt="FariLog" style={{ height: '34px', objectFit: 'contain', maxWidth: '130px' }} />
        <div className="flex items-center gap-2">
          <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: user?.color || '#1C1C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: 'white' }}>
            {user?.initials}
          </div>
          <button onClick={() => { logout(); navigate('/'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9A9A9A', padding: '4px' }}>
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Navegação mobile (abas no topo do conteúdo) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex" style={{ background: '#0B0B0B', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '6px 8px calc(6px + env(safe-area-inset-bottom))' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-xl"
            style={{ background: tab === id ? 'rgba(255,255,255,0.08)' : 'transparent', color: tab === id ? '#FFFFFF' : '#6B6B6B', border: 'none', cursor: 'pointer' }}>
            <Icon size={17} />
            <span style={{ fontSize: '9.5px', fontWeight: 600 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${open ? 'md:ml-56' : 'md:ml-16'}`}>
        <main className="flex-1 p-4 md:p-6 pt-20 md:pt-6 pb-24 md:pb-6">
          <Outlet context={{ tab, setTab }} />
        </main>
      </div>

    </div>
  );
}
