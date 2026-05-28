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
      background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      <div style={{
        background: 'white', borderRadius: '20px', padding: '40px', width: '100%', maxWidth: '440px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '60px', height: '60px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', color: 'white', fontSize: '28px', fontWeight: 'bold'
          }}>GF</div>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#1e293b', margin: '0 0 6px 0' }}>Evaluación de Desempeño</h1>
          <p style={{ fontSize: '14px', color: '#64748b', margin: '0' }}>Grupo Fabric</p>
        </div>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Email Corporativo</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu.email@grupo-fabric.com" required
              style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
              style={{ width: '100%', padding: '14px 16px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '15px', boxSizing: 'border-box', outline: 'none' }} />
          </div>
          {error && <p style={{ color: '#dc2626', fontSize: '13px', textAlign: 'center', padding: '12px', backgroundColor: '#fef2f2', borderRadius: '8px', margin: '0' }}>{error}</p>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', padding: '15px', backgroundColor: loading ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', marginTop: '8px', boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)' }}>
            {loading ? 'Verificando...' : 'Ingresar a la Plataforma'}
          </button>
        </form>
      </div>
    </div>
  );
}
