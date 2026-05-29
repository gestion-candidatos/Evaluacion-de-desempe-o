import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    
    if (loginError) {
      setError('Email o contraseña incorrectos');
    } else {
      window.location.href = '/panel';
    }
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
      background: 'linear-gradient(135deg, #231F20 0%, #3a3537 50%, #231F20 100%)',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '440px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img src="/logo.jpg" alt="Grupo Fabric" style={{ width: '180px', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#231F20', margin: '0 0 6px 0' }}>Evaluación de Desempeño</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0' }}>Grupo Fabric</p>
        </div>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#231F20', marginBottom: '6px', textTransform: 'uppercase' }}>Email Corporativo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu.email@grupo-fabric.com" required
              style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '2px solid #D4D2C6', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#231F20', marginBottom: '6px', textTransform: 'uppercase' }}>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
              style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '2px solid #D4D2C6', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: '13px', textAlign: 'center', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', margin: '0' }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#D4D2C6' : '#231F20', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '8px', boxShadow: '0 4px 12px rgba(35, 31, 32, 0.3)' }}>
            {loading ? 'Verificando...' : 'Ingresar a la Plataforma'}
          </button>
        </form>
      </div>
    </div>
  );
}
