import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState('');

  async function handleGoogleLogin() {
    setLoading(true);
    setError('');
    var { error: loginError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/panel',
        queryParams: {
          hd: 'grupo-fabric.com', // restringe a cuentas del dominio corporativo
        }
      }
    });
    if (loginError) {
      setError('Error al iniciar sesión con Google: ' + loginError.message);
      setLoading(false);
    }
    // si no hay error, Google redirige automaticamente
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
          <p style={styles.welcomeSubtitle}>Ingresá con tu cuenta corporativa de Google</p>

          {error && (
            <div style={styles.errorBox}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            style={loading ? { ...styles.googleButton, ...styles.buttonDisabled } : styles.googleButton}
          >
            {loading ? (
              <span>Redirigiendo...</span>
            ) : (
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

          <p style={styles.footerText}>
            Solo cuentas <strong>@grupo-fabric.com</strong> tienen acceso
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
  loginCard: { width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  logoContainer: { textAlign: 'center', marginBottom: '28px' },
  welcomeTitle: { fontSize: '28px', fontWeight: '700', color: '#231F20', textAlign: 'center', margin: '0 0 8px 0' },
  welcomeSubtitle: { fontSize: '14px', color: '#64748b', textAlign: 'center', margin: '0 0 32px 0' },
  errorBox: { padding: '12px 16px', background: '#fef2f2', borderRadius: '8px', color: '#dc2626', fontSize: '13px', textAlign: 'center', border: '1px solid #fecaca', fontWeight: '500', marginBottom: 20, width: '100%', boxSizing: 'border-box' },
  googleButton: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: '100%', padding: '14px 24px',
    background: 'white', color: '#231F20',
    border: '2px solid #e2e8f0', borderRadius: '12px',
    fontSize: '16px', fontWeight: '600', cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    transition: 'all 0.2s',
    marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  footerText: { textAlign: 'center', fontSize: '12px', color: '#94a3b8', marginTop: '8px' }
};
