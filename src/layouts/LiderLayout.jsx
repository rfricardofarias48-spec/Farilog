import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

export default function LiderLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: '#EEF1F5' }}>
      <header
        className="sticky top-0 z-40 px-4"
        style={{ background: '#111827', height: '60px', display: 'flex', alignItems: 'center' }}
      >
        <div className="max-w-lg mx-auto flex items-center justify-between w-full">
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
            alt="FariLog"
            style={{ height: '90px', objectFit: 'contain' }}
          />
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: user?.color || '#FF4D0C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: 'white' }}>
                {user?.initials}
              </div>
              <span className="text-xs font-semibold" style={{ color: '#F1F5F9' }}>{user?.name?.split(' ')[0]}</span>
              <span style={{ fontSize: '9px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', background: 'rgba(255,77,12,0.2)', color: '#FF4D0C' }}>Líder</span>
            </div>
            <button onClick={() => { logout(); navigate('/'); }}
              className="p-2 rounded-lg"
              style={{ color: '#94A3B8', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
