import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState('');
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [modo, setModo] = useState('google');

  async function handleGoogleLogin() {
    setLoading(true);
    setError('');
    var { error: loginError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://performance-fabricgroup.vercel.app/panel',
        queryParams: { hd: 'grupo-fabric.com' }
      }
    });
    if (loginError) {
      setError('Error al iniciar sesión con Google: ' + loginError.message);
      setLoading(false);
    }
  }

  async function handleEmailLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    var { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      setError('Email o contraseña incorrectos');
      setLoading(false);
    } else {
      window.location.href = '/panel';
    }
  }

  return (
    <div style={styles.container}>
      {/* Lado Izquierdo — imagen de fondo con overlay suave */}
      <div style={styles.leftSide}>
        <div style={styles.overlay} />
        <div style={styles.leftContent}>
          <img src="/logo.jpg" alt="Fabric Group" style={styles.logo} />
          <h1 style={styles.brandName}>Fabric Group</h1>
          <div style={styles.divider} />
          <p style={styles.description}>
            Plataforma integral para la gestión del talento,
            evaluación por competencias y seguimiento de objetivos.
          </p>
        </div>
      </div>

      {/* Lado Derecho — formulario */}
      <div style={styles.rightSide}>
        <div style={styles.loginCard}>
          <div style={styles.logoContainer}>
            <img src="/logo.jpg" alt="Fabric Group" style={styles.logoRight} />
          </div>

          <h2 style={styles.welcomeTitle}>Bienvenido</h2>
          <p style={styles.welcomeSubtitle}>Ingresá a tu cuenta para continuar</p>

          {error && <div style={styles.errorBox}>⚠️ {error}</div>}

          {/* Toggle */}
          <div style={styles.toggleContainer}>
            <button
              onClick={function() { setModo('google'); setError(''); }}
              style={{ ...styles.toggleBtn, ...(modo === 'google' ? styles.toggleActivo : {}) }}>
              Google
            </button>
            <button
              onClick={function() { setModo('email'); setError(''); }}
              style={{ ...styles.toggleBtn, ...(modo === 'email' ? styles.toggleActivo : {}) }}>
              Email
            </button>
          </div>

          {/* Google */}
          {modo === 'google' && (
            <div style={{ width: '100%' }}>
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                style={loading ? { ...styles.googleButton, opacity: 0.6, cursor: 'not-allowed' } : styles.googleButton}>
                {loading ? 'Redirigiendo...' : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: 12, flexShrink: 0 }}>
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Ingresar con Google
                  </>
                )}
              </button>
              <p style={styles.footerText}>Solo cuentas <strong>@grupo-fabric.com</strong></p>
            </div>
          )}

          {/* Email */}
          {modo === 'email' && (
            <form onSubmit={handleEmailLogin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Email</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}>📧</span>
                  <input type="email" value={email}
                    onChange={function(e) { setEmail(e.target.value); }}
                    placeholder="tu.email@grupo-fabric.com"
                    required style={styles.input} />
                </div>
              </div>
              <div style={styles.inputGroup}>
                <label style={styles.label}>Contraseña</label>
                <div style={styles.inputWrapper}>
                  <span style={styles.inputIcon}>🔒</span>
                  <input type="password" value={password}
                    onChange={function(e) { setPassword(e.target.value); }}
                    placeholder="••••••••"
                    required style={styles.input} />
                </div>
              </div>
              <button type="submit" disabled={loading}
                style={loading ? { ...styles.emailButton, opacity: 0.6, cursor: 'not-allowed' } : styles.emailButton}>
                {loading ? 'Verificando...' : 'Ingresar'}
              </button>
              <p style={styles.footerText}>¿Problemas para ingresar? Contactá a RRHH</p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

var styles = {
  container: {
    display: 'flex', minHeight: '100vh',
    fontFamily: '"Poppins", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
  },
  leftSide: {
    flex: '1.2',
    backgroundImage: 'url("/login-bg.jpg")',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    
    
    
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    minHeight: '100vh',
  },
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    background: 'linear-gradient(to top, rgba(35,31,32,0.88) 0%, rgba(35,31,32,0.35) 55%, rgba(35,31,32,0.05) 100%)',
  },
  leftContent: {
    position: 'relative', zIndex: 1,
    padding: '48px',
    maxWidth: '520px',
  },
  logo: {
    height: 56, borderRadius: 8, marginBottom: 20,
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  brandName: {
    fontSize: '38px', fontWeight: '700',
    color: '#F0EDE8',
    margin: '0 0 16px 0',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    textShadow: '0 2px 8px rgba(0,0,0,0.4)',
  },
  divider: {
    width: '48px', height: '3px',
    background: '#D4D2C6',
    margin: '0 0 20px 0',
    borderRadius: 2,
  },
  description: {
    fontSize: '15px', color: 'rgba(240,237,232,0.85)',
    lineHeight: '1.7', margin: 0,
    textShadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
  rightSide: {
    flex: '1',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#F0EDE8',
    padding: '40px',
    minWidth: 400,
  },
  loginCard: {
    width: '100%', maxWidth: '400px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  logoContainer: { textAlign: 'center', marginBottom: '24px' },
  logoRight: {
    height: 64, borderRadius: 10,
    boxShadow: '0 4px 16px rgba(35,31,32,0.15)',
  },
  welcomeTitle: {
    fontSize: '26px', fontWeight: '700',
    color: '#231F20', textAlign: 'center',
    margin: '0 0 6px 0',
  },
  welcomeSubtitle: {
    fontSize: '14px', color: '#64748b',
    textAlign: 'center', margin: '0 0 24px 0',
  },
  errorBox: {
    padding: '12px 16px', background: '#fef2f2',
    borderRadius: '8px', color: '#dc2626',
    fontSize: '13px', textAlign: 'center',
    border: '1px solid #fecaca', fontWeight: '500',
    marginBottom: 16, width: '100%', boxSizing: 'border-box',
  },
  toggleContainer: {
    display: 'flex', width: '100%',
    background: '#e8e5e0', borderRadius: 10,
    padding: 4, marginBottom: 24, boxSizing: 'border-box',
  },
  toggleBtn: {
    flex: 1, padding: '10px', border: 'none',
    borderRadius: 8, cursor: 'pointer',
    fontSize: 14, fontWeight: 600,
    background: 'transparent', color: '#64748b',
    transition: 'all 0.15s',
  },
  toggleActivo: {
    background: '#231F20', color: '#D4D2C6',
    boxShadow: '0 2px 8px rgba(35,31,32,0.2)',
  },
  googleButton: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', padding: '14px 24px',
    background: 'white', color: '#231F20',
    border: '2px solid #D4D2C6', borderRadius: '12px',
    fontSize: '15px', fontWeight: '600', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    marginBottom: 12, transition: 'all 0.2s',
  },
  emailButton: {
    padding: '14px', background: '#231F20',
    color: '#D4D2C6', border: 'none',
    borderRadius: '10px', fontSize: '15px',
    fontWeight: '600', cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(35,31,32,0.25)',
    letterSpacing: '0.3px',
  },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: {
    fontSize: '12px', fontWeight: '600',
    color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: '14px', fontSize: '16px', zIndex: 1 },
  input: {
    width: '100%', padding: '13px 16px 13px 44px',
    borderRadius: '10px', border: '2px solid #D4D2C6',
    fontSize: '14px', boxSizing: 'border-box',
    outline: 'none', background: 'white',
    transition: 'border-color 0.2s',
  },
  footerText: {
    textAlign: 'center', fontSize: '12px',
    color: '#94a3b8', marginTop: '8px',
  },
};
