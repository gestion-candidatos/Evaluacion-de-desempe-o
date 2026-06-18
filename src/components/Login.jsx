import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  var [email, setEmail] = useState('');
  var [password, setPassword] = useState('');
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    var { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      setError('Email o contraseña incorrectos');
    } else {
      window.location.href = '/panel';
    }
    setLoading(false);
  }

  return (
    <div style={styles.container}>
      {/* Lado Izquierdo */}
      <div style={styles.leftSide}>
        <div style={styles.overlay} />
        <div style={styles.leftContent}>
          <img src="/logo.jpg" alt="Fabric Group" style={{ height: 80, marginBottom: 20, borderRadius: 8 }} />
          <h1 style={styles.brandName}>Fabric Group</h1>
          <p style={styles.tagline}>Evaluación de Desempeño</p>
          <div style={styles.divider} />
          <p style={styles.description}>
            Plataforma integral para la gestión del talento,
            evaluación por competencias y seguimiento de objetivos.
          </p>
        </div>
      </div>

      {/* Lado Derecho */}
      <div style={styles.rightSide}>
        <div style={styles.loginCard}>
          <div style={styles.logoContainer}>
            <img src="/logo.jpg" alt="Fabric Group" style={{ height: 72, borderRadius: 12, boxShadow: '0 8px 24px rgba(35,31,32,0.18)' }} />
          </div>

          <h2 style={styles.welcomeTitle}>Bienvenido</h2>
          <p style={styles.welcomeSubtitle}>Ingresa a tu cuenta para continuar</p>

          <form onSubmit={handleLogin} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Corporativo</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>📧</span>
                <input
                  type="email"
                  value={email}
                  onChange={function(e) { setEmail(e.target.value); }}
                  placeholder="tu.email@grupo-fabric.com"
                  required
                  style={styles.input}
                />
              </div>
            </div>

            <div style={styles.inputGroup}>
              <label style={styles.label}>Contraseña</label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>🔒</span>
                <input
                  type="password"
                  value={password}
                  onChange={function(e) { setPassword(e.target.value); }}
                  placeholder="••••••••"
                  required
                  style={styles.input}
                />
              </div>
            </div>

            {error && (
              <div style={styles.errorBox}>
                <span>⚠️</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={loading ? {...styles.button, ...styles.buttonDisabled} : styles.button}
            >
              {loading ? 'Verificando...' : 'Ingresar a la Plataforma'}
            </button>
          </form>

          <p style={styles.footerText}>
            ¿Problemas para ingresar? Contacta a RRHH
          </p>
        </div>
      </div>
    </div>
  );
}

var styles = {
  container: { display: 'flex', minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  leftSide: { flex: '1', backgroundImage: 'url("/login-bg.jpg")', backgroundSize: 'cover', backgroundPosition: 'center', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(35,31,32,0.92) 0%, rgba(35,31,32,0.75) 100%)' },
  leftContent: { position: 'relative', zIndex: 1, textAlign: 'center', padding: '40px', maxWidth: '500px' },
  brandName: { fontSize: '42px', fontWeight: '700', color: '#D4D2C6', margin: '0 0 8px 0', letterSpacing: '2px', textTransform: 'uppercase' },
  tagline: { fontSize: '20px', fontWeight: '300', color: '#D4D2C6', margin: '0 0 24px 0', letterSpacing: '1px' },
  divider: { width: '60px', height: '3px', background: '#D4D2C6', margin: '0 auto 24px auto' },
  description: { fontSize: '15px', color: '#9ca3af', lineHeight: '1.8', margin: 0 },
  rightSide: { flex: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '40px' },
  loginCard: { width: '100%', maxWidth: '420px' },
  logoContainer: { textAlign: 'center', marginBottom: '28px' },
  welcomeTitle: { fontSize: '28px', fontWeight: '700', color: '#231F20', textAlign: 'center', margin: '0 0 8px 0' },
  welcomeSubtitle: { fontSize: '14px', color: '#64748b', textAlign: 'center', margin: '0 0 32px 0' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' },
  inputWrapper: { position: 'relative', display: 'flex', alignItems: 'center' },
  inputIcon: { position: 'absolute', left: '14px', fontSize: '16px', zIndex: 1 },
  input: { width: '100%', padding: '14px 16px 14px 44px', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '15px', boxSizing: 'border-box', outline: 'none', transition: 'border-color 0.2s', background: 'white' },
  errorBox: { padding: '12px 16px', background: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '13px', textAlign: 'center', border: '1px solid #fecaca', fontWeight: '500' },
  button: { padding: '15px', background: 'linear-gradient(135deg, #231F20, #3a3536)', color: '#D4D2C6', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '8px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(35,31,32,0.3)', letterSpacing: '0.5px' },
  buttonDisabled: { background: '#94a3b8', cursor: 'not-allowed', boxShadow: 'none' },
  footerText: { textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '24px' }
};
