import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function Login() {
  const navigate   = useNavigate();
  const { login }  = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 480));
    const result = await login(email, password);
    if (result.success) {
      navigate(`/${result.role}`);
    } else {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#E8ECF0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Inter, sans-serif',
      overflowY: 'auto',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '360px',
        background: '#1A1A1F',
        borderRadius: '20px',
        padding: '28px 28px 26px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.28)',
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '6px', overflow: 'hidden' }}>
          <img
            src="https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png"
            alt="FariLog"
            style={{ height: '110px', objectFit: 'contain', width: '100%', transform: 'scale(1.95)', transformOrigin: 'center' }}
          />
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', marginTop: '4px' }} />
        </div>

        {/* Heading */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px', letterSpacing: '-0.02em' }}>
            Entrar na sua conta
          </h1>
          <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Bem-vindo de volta.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin}>
          {/* Email */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: '#6B7280', textTransform: 'uppercase', marginBottom: '8px' }}>
              E-mail ou Telefone
            </label>
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="seu@email.com ou telefone"
              required
              style={{
                width: '100%', padding: '13px 16px',
                background: '#252529', border: '1.5px solid rgba(255,255,255,0.06)',
                borderRadius: '12px', color: '#F0F4FA', fontSize: '14px',
                fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.18s',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(255,77,12,0.7)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em', color: '#6B7280', textTransform: 'uppercase' }}>
                Senha
              </label>
              <button type="button" style={{ fontSize: '12px', color: '#FF4D0C', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 500 }}>
                Esqueci minha senha
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: '100%', padding: '13px 44px 13px 16px',
                  background: '#252529', border: '1.5px solid rgba(255,255,255,0.06)',
                  borderRadius: '12px', color: '#F0F4FA', fontSize: '14px',
                  fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.18s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,77,12,0.7)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.06)'}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#4B5563', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#F87171', fontSize: '12.5px', marginBottom: '16px', fontWeight: 500 }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px',
            background: loading ? 'rgba(255,77,12,0.6)' : '#FF4D0C',
            border: 'none', borderRadius: '12px', color: 'white',
            fontSize: '15px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            letterSpacing: '-0.01em',
            boxShadow: loading ? 'none' : '0 4px 20px rgba(255,77,12,0.35)',
            transition: 'all 0.18s',
          }}>
            {loading ? 'Entrando...' : <><span>Entrar</span><ArrowRight size={17} /></>}
          </button>

        </form>
      </div>

      <p style={{ position: 'fixed', bottom: '18px', left: 0, right: 0, textAlign: 'center', fontSize: '11px', color: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}>
        Gestor © 2026
      </p>
    </div>
  );
}
