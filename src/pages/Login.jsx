import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Eye, EyeOff, ArrowRight, Mail, Lock, Users, Coins, Clock, DollarSign, FileText, ShieldCheck } from 'lucide-react';

const LOGO_URL = 'https://ik.imagekit.io/xsbrdnr0y/Logo%20Farilog%20branco%20(sem%20fundo).png';

const HIGHLIGHTS = [
  { icon: Coins,      label: 'Diárias' },
  { icon: Clock,      label: 'Horas extras' },
  { icon: DollarSign, label: 'Financeiro' },
  { icon: FileText,   label: 'Relatórios' },
  { icon: Users,      label: 'Ajudantes em operação' },
];

export default function Login() {
  const navigate   = useNavigate();
  const { login }  = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPwd,  setShowPwd]  = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [focus,    setFocus]    = useState(null);

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

  const inputStyle = (name) => ({
    width: '100%', padding: '13px 16px 13px 44px',
    background: focus === name ? '#FFFFFF' : '#F8FAFC',
    border: `1.5px solid ${focus === name ? '#FF4D0C' : 'rgba(15,23,42,0.10)'}`,
    boxShadow: focus === name ? '0 0 0 3.5px rgba(255,77,12,0.10)' : 'none',
    borderRadius: '14px', color: '#0F172A', fontSize: '14px',
    fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.18s, box-shadow 0.18s, background 0.18s',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#060F1E', display: 'flex', fontFamily: 'Inter, sans-serif' }}>

      {/* ===== Painel de marca (esquerda) ===== */}
      <div className="hidden lg:flex" style={{
        flex: 1.1,
        position: 'relative',
        background: 'radial-gradient(1200px 800px at -10% -20%, rgba(255,77,12,0.16) 0%, transparent 55%), radial-gradient(900px 700px at 110% 120%, rgba(255,77,12,0.10) 0%, transparent 50%), linear-gradient(160deg, #0C1927 0%, #060F1E 60%, #04101E 100%)',
        flexDirection: 'column', justifyContent: 'space-between',
        padding: '56px 64px',
        overflow: 'hidden',
      }}>
        {/* grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse at 30% 30%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 30% 30%, black 30%, transparent 75%)',
        }} />
        {/* glow orb */}
        <div style={{
          position: 'absolute', top: '-120px', right: '-80px', width: '420px', height: '420px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,77,12,0.22) 0%, transparent 65%)',
          filter: 'blur(10px)',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '18px' }}>
          <img src={LOGO_URL} alt="FariLog" style={{ height: '58px', objectFit: 'contain' }} />
          <div style={{ width: '1px', height: '38px', background: 'rgba(255,255,255,0.14)', flexShrink: 0 }} />
          <div style={{ paddingTop: '2px' }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.24em', textTransform: 'uppercase', margin: 0, whiteSpace: 'nowrap' }}>
              Gestão de Equipe
            </p>
            <p style={{ fontSize: '11px', fontWeight: 500, color: 'rgba(255,255,255,0.38)', margin: '4px 0 0', letterSpacing: '0.03em' }}>
              Operações logísticas
            </p>
          </div>
        </div>

        {/* Mensagem central */}
        <div style={{ position: 'relative', maxWidth: '500px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '7px 14px', borderRadius: '999px',
            background: 'rgba(255,77,12,0.12)', border: '1px solid rgba(255,77,12,0.3)',
            marginBottom: '24px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FF4D0C', boxShadow: '0 0 8px rgba(255,77,12,0.9)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#FF9A70', letterSpacing: '0.02em' }}>
              Painel da empresa
            </span>
          </div>
          <h1 style={{ fontSize: '44px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.1, letterSpacing: '-0.035em', margin: '0 0 18px' }}>
            Sua operação,
            <br />
            <span style={{
              background: 'linear-gradient(90deg, #FF6A2B, #FF9A70)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>sob controle.</span>
          </h1>
          <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, margin: 0, maxWidth: '420px' }}>
            Diárias, horas extras e a equipe em campo — tudo organizado, sem planilha e sem retrabalho.
          </p>

          {/* O que o usuário controla */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '36px' }}>
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <div key={label} style={{
                display: 'inline-flex', alignItems: 'center', gap: '9px',
                padding: '10px 16px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              }}>
                <Icon size={16} style={{ color: '#FF7A38', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#E2E8F0' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé painel */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '10px', color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>
          <ShieldCheck size={14} />
          <span>Acesso seguro · Área da empresa</span>
        </div>
      </div>

      {/* ===== Formulário (direita) ===== */}
      <div style={{
        flex: 1,
        background: '#F4F5F7',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
        overflowY: 'auto',
        position: 'relative',
      }}>

        <div style={{ width: '100%', maxWidth: '400px' }}>
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0F172A', margin: '0 0 6px', letterSpacing: '-0.025em' }}>
              Entrar na sua conta
            </h2>
            <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
              Acesse o painel da sua operação.
            </p>
          </div>

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                E-mail
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={17} style={{
                  position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)',
                  color: focus === 'email' ? '#FF4D0C' : '#94A3B8', transition: 'color 0.18s', pointerEvents: 'none',
                }} />
                <input
                  type="text"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onFocus={() => setFocus('email')}
                  onBlur={() => setFocus(null)}
                  placeholder="seu@email.com"
                  required
                  style={inputStyle('email')}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                  Senha
                </label>
                <button type="button" style={{ fontSize: '12.5px', color: '#FF4D0C', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600 }}>
                  Esqueci minha senha
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={17} style={{
                  position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)',
                  color: focus === 'password' ? '#FF4D0C' : '#94A3B8', transition: 'color 0.18s', pointerEvents: 'none',
                }} />
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocus('password')}
                  onBlur={() => setFocus(null)}
                  placeholder="••••••••"
                  required
                  style={{ ...inputStyle('password'), padding: '13px 44px' }}
                />
                <button type="button" onClick={() => setShowPwd(!showPwd)}
                  style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', display: 'flex', padding: '2px' }}>
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: '11px 14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', borderRadius: '12px', color: '#DC2626', fontSize: '12.5px', marginBottom: '16px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', flexShrink: 0 }} />
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px',
              background: loading ? 'rgba(255,77,12,0.55)' : 'linear-gradient(180deg, #FF5A1F 0%, #FF4D0C 100%)',
              border: 'none', borderRadius: '14px', color: 'white',
              fontSize: '15px', fontWeight: 600, fontFamily: 'Inter, sans-serif',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              letterSpacing: '-0.01em',
              boxShadow: loading ? 'none' : 'inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 24px -6px rgba(255,77,12,0.5)',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            }}>
              {loading ? (
                <>
                  <span style={{
                    width: '16px', height: '16px', borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff',
                    animation: 'spin 0.7s linear infinite', display: 'inline-block',
                  }} />
                  <span>Entrando...</span>
                </>
              ) : (
                <><span>Entrar</span><ArrowRight size={17} /></>
              )}
            </button>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </form>
        </div>
      </div>

      <p style={{ position: 'fixed', bottom: '18px', left: 0, right: 0, textAlign: 'center', fontSize: '11px', color: '#94A3B8', fontFamily: 'Inter, sans-serif', pointerEvents: 'none' }}>
        FariLog © 2026
      </p>
    </div>
  );
}
