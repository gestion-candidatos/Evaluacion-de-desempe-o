import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function PanelApp() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { cargarPerfil(); }, []);

  async function cargarPerfil() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    const { data: perfil } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(perfil);
    setLoading(false);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) return <div style={s.centrado}><p>Cargando panel...</p></div>;
  if (!profile) return <div style={s.centrado}><h2>Error al cargar perfil</h2><button onClick={cerrarSesion} style={s.btnSalir}>Volver</button></div>;

  const nombreRol = profile.role === 'admin_rrhh' ? 'Admin RRHH' : profile.role === 'lider' ? 'Líder' : 'Colaborador';
  const emojiRol = profile.role === 'admin_rrhh' ? '🔧' : profile.role === 'lider' ? '👥' : '👤';

  return (
    <div>
      <header style={s.header}>
        <div style={s.headerIzq}><h1 style={s.logo}>EvalRH</h1><span style={s.badge}>{emojiRol} {nombreRol}</span></div>
        <div style={s.headerDer}><span style={s.email}>{profile.email}</span><button onClick={cerrarSesion} style={s.btnSalir}>Cerrar Sesión</button></div>
      </header>
      <main style={s.main}>
        <div style={s.tarjetaBienvenida}><h2>👋 Bienvenido/a{profile.full_name ? `, ${profile.full_name}` : ''}</h2><p>Rol: <strong>{nombreRol}</strong> | Área: {profile.area || 'No asignada'} | Seniority: {profile.seniority || 'No definido'}</p></div>
        {profile.role === 'admin_rrhh' && <PanelAdmin />}
        {profile.role === 'lider' && <PanelLider />}
        {profile.role === 'colaborador' && <PanelColaborador userId={profile.id} seniority={profile.seniority} />}
      </main>
    </div>
  );
}

function PanelAdmin() {
  const [stats, setStats] = useState({ total: 0, enviadas: 0, pendientes: 0 });
  const [colaboradores, setColaboradores] = useState([]);
  const [vistaActiva, setVistaActiva] = useState('dashboard');

  useEffect(() => { cargarStats(); cargarColabs(); }, []);

  async function cargarStats() {
    const { count: t } = await supabase.from('evaluaciones').select('*', { count: 'exact', head: true });
    const { count: e } = await supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('estado', 'enviado');
    setStats({ total: t || 0, enviadas: e || 0, pendientes: (t || 0) - (e || 0) });
  }

  async function cargarColabs() {
    const { data } = await supabase.from('profiles').select('*');
    setColaboradores(data || []);
  }

  const pct = stats.total > 0 ? Math.round((stats.enviadas / stats.total) * 100) : 0;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setVistaActiva('dashboard')} style={vistaActiva === 'dashboard' ? s.btnPrimario : s.btnInfo}>📊 Dashboard</button>
        <button onClick={() => setVistaActiva('evaluaciones')} style={vistaActiva === 'evaluaciones' ? s.btnPrimario : s.btnInfo}>📋 Evaluaciones</button>
        <button onClick={() => setVistaActiva('calibracion')} style={vistaActiva === 'calibracion' ? s.btnPrimario : s.btnInfo}>🎯 Calibración</button>
        <button onClick={() => setVistaActiva('colaboradores')} style={vistaActiva === 'colaboradores' ? s.btnPrimario : s.btnInfo}>👥 Colaboradores</button>
      </div>

      {vistaActiva === 'dashboard' && (
        <div>
          <h3 style={{ marginBottom: 20, color: '#1e293b' }}>📊 Dashboard de Recursos Humanos</h3>
          <div style={s.grid}>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>📋 Total</p><p style={{ fontSize: 36, fontWeight: 700, color: '#2563eb', margin: '8px 0' }}>{stats.total}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '4px solid #22c55e' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#22c55e', margin: '8px 0' }}>{stats.enviadas}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '4px solid #f59e0b' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#f59e0b', margin: '8px 0' }}>{stats.pendientes}</p></div>
          </div>
          <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 8px 0' }}>📈 Progreso: {pct}%</p>
            <div style={{ background: '#e2e8f0', borderRadius: 10, height: 24, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #2563eb, #22c55e)', borderRadius: 10, transition: 'width 0.5s' }} /></div>
          </div>
        </div>
      )}

      {vistaActiva === 'evaluaciones' && <EvaluacionesAdmin />}
      {vistaActiva === 'calibracion' && <PanelCalibracion colaboradores={colaboradores} />}
      
      {vistaActiva === 'colaboradores' && (
        <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
          <h4 style={{ margin: '0 0 16px 0' }}>👥 Todos ({colaboradores.length})</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}><th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Área</th><th style={th}>Seniority</th><th style={th}>Rol</th></tr></thead>
            <tbody>{colaboradores.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}>{c.full_name || '-'}</td><td style={{ ...td, color: '#2563eb' }}>{c.email}</td><td style={td}>{c.area || '-'}</td>
                <td style={td}><span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#e0e7ff', color: '#4338ca' }}>{c.seniority || '-'}</span></td>
                <td style={td}><span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.role === 'lider' ? '#fef3c7' : c.role === 'admin_rrhh' ? '#dcfce7' : '#dbeafe', color: c.role === 'lider' ? '#92400e' : c.role === 'admin_rrhh' ? '#166534' : '#1e40af' }}>{c.role === 'admin_rrhh' ? '🔧 Admin' : c.role === 'lider' ? '👥 Líder' : '👤 Colaborador'}</span></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PanelCalibracion({ colaboradores }) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [detalleVisible, setDetalleVisible] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const resultado = [];
    const colsFiltrados = colaboradores.filter(c => c.role !== 'admin_rrhh');
    
    for (const col of colsFiltrados) {
      const { data: autoeval } = await supabase
        .from('evaluaciones')
        .select('*, puntuaciones(*)')
        .eq('colaborador_id', col.id)
        .eq('tipo_evaluacion', 'autoevaluacion')
        .maybeSingle();

      const { data: evalLider } = await supabase
        .from('evaluaciones')
        .select('*, puntuaciones(*)')
        .eq('colaborador_id', col.id)
        .eq('tipo_evaluacion', 'evaluacion_lider')
        .maybeSingle();

      const calcPromedio = (puntuaciones) => {
        if (!puntuaciones || puntuaciones.length === 0) return null;
        const valores = puntuaciones.map(p => p.rating).filter(r => r > 0);
        if (valores.length === 0) return null;
        return (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1);
      };

      const promAuto = calcPromedio(autoeval?.puntuaciones);
      const promLider = calcPromedio(evalLider?.puntuaciones);

      resultado.push({
        colaborador: col,
        autoevaluacion: autoeval,
        evaluacionLider: evalLider,
        promAuto,
        promLider,
        gap: promAuto && promLider ? (parseFloat(promLider) - parseFloat(promAuto)).toFixed(1) : null,
        ratingFinal: evalLider?.rating_calibrado || null
      });
    }

    setDatos(resultado);
    setCargando(false);
  }

  async function guardarCalibracion(evaluacionId, rating) {
    setGuardando(true);
    await supabase
      .from('evaluaciones')
      .update({ rating_calibrado: rating })
      .eq('id', evaluacionId);
    
    setDatos(prev => prev.map(d => 
      d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating } : d
    ));
    setGuardando(false);
  }

  const clasificar = (prom) => {
    if (!prom) return { texto: '-', color: '#94a3b8' };
    const p = parseFloat(prom);
    if (p <= 1.4) return { texto: '🔴 No adecuado', color: '#dc2626' };
    if (p <= 2.4) return { texto: '🟠 Por debajo', color: '#f59e0b' };
    if (p <= 3.4) return { texto: '🔵 Cumple', color: '#3b82f6' };
    if (p <= 4.4) return { texto: '🟢 Excede', color: '#22c55e' };
    return { texto: '🟣 Distinguido', color: '#8b5cf6' };
  };

  if (cargando) return <p style={{ padding: 20, color: '#64748b' }}>⏳ Cargando datos de calibración...</p>;

  return (
    <div style={{ ...s.tarjetaStat }}>
      <h3 style={{ margin: '0 0 8px 0', color: '#1e293b' }}>🎯 Calibración - Auto vs Líder</h3>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>
        Comparación y calibración final de evaluaciones.
      </p>

      {datos.length === 0 ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No hay datos para mostrar.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={th}>Colaborador</th><th style={th}>Área</th><th style={th}>Seniority</th><th style={th}>Auto</th><th style={th}>Líder</th><th style={th}>GAP</th><th style={th}>Calibrado</th><th style={th}>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {datos.map(d => {
                const clasFinal = clasificar(d.ratingFinal);
                return (
                  <tr key={d.colaborador.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td>
                    <td style={td}>{d.colaborador.area || '-'}</td>
                    <td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#e0e7ff', color: '#4338ca' }}>{d.colaborador.seniority || '-'}</span></td>
                    <td style={{ ...td, textAlign: 'center', fontSize: 18, fontWeight: 700, color: clasificar(d.promAuto).color }}>{d.promAuto || '-'}</td>
                    <td style={{ ...td, textAlign: 'center', fontSize: 18, fontWeight: 700, color: clasificar(d.promLider).color }}>{d.promLider || '-'}</td>
                    <td style={{ ...td, textAlign: 'center', fontSize: 16, fontWeight: 700, color: d.gap ? (Math.abs(d.gap) <= 0.5 ? '#22c55e' : Math.abs(d.gap) <= 1 ? '#f59e0b' : '#dc2626') : '#94a3b8' }}>{d.gap ? (d.gap > 0 ? '+' : '') + d.gap : '-'}</td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      {d.promLider ? (
                        <div>
                          <select value={d.ratingFinal || ''} onChange={(e) => guardarCalibracion(d.evaluacionLider.id, parseFloat(e.target.value))}
                            style={{ padding: '6px 10px', borderRadius: 6, border: `2px solid ${clasFinal.color}`, fontSize: 14, fontWeight: 600, color: clasFinal.color, background: 'white' }} disabled={guardando}>
                            <option value="">Seleccionar</option>
                            <option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option>
                          </select>
                          {d.ratingFinal && <div style={{ fontSize: 10, color: clasFinal.color, marginTop: 2 }}>{clasFinal.texto}</div>}
                        </div>
                      ) : <span style={{ color: '#94a3b8' }}>Sin eval</span>}
                    </td>
                    <td style={td}>
                      <button onClick={() => setDetalleVisible(d.colaborador.id)} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>👁️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {detalleVisible && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }} onClick={() => setDetalleVisible(null)}>
              <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 800, width: '100%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
                {(() => {
                  const d = datos.find(x => x.colaborador.id === detalleVisible);
                  if (!d) return null;
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <h3 style={{ margin: 0 }}>🎯 {d.colaborador.full_name}</h3>
                        <button onClick={() => setDetalleVisible(null)} style={{ background: '#e2e8f0', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 16 }}>✕</button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 20 }}>
                        <div style={{ padding: 14, background: '#dbeafe', borderRadius: 10, textAlign: 'center' }}><p style={{ margin: 0, fontSize: 12 }}>📝 Auto</p><p style={{ fontSize: 28, fontWeight: 700, color: '#1e40af', margin: '4px 0' }}>{d.promAuto || '-'}</p></div>
                        <div style={{ padding: 14, background: '#fef3c7', borderRadius: 10, textAlign: 'center' }}><p style={{ margin: 0, fontSize: 12 }}>👥 Líder</p><p style={{ fontSize: 28, fontWeight: 700, color: '#92400e', margin: '4px 0' }}>{d.promLider || '-'}</p></div>
                        <div style={{ padding: 14, background: '#dcfce7', borderRadius: 10, textAlign: 'center' }}><p style={{ margin: 0, fontSize: 12 }}>✅ Calibrado</p><p style={{ fontSize: 28, fontWeight: 700, color: '#166534', margin: '4px 0' }}>{d.ratingFinal || '-'}</p></div>
                      </div>
                      <div style={{ display: 'flex', gap: 16 }}>
                        <div style={{ flex: 1 }}><h4>💪 Fortalezas</h4><p style={{ color: '#475569', fontSize: 13 }}>{d.autoevaluacion?.fortalezas || '-'}</p><h4>📈 Oportunidades</h4><p style={{ color: '#475569', fontSize: 13 }}>{d.autoevaluacion?.oportunidades || '-'}</p></div>
                        <div style={{ flex: 1 }}><h4>🎯 Plan de Acción</h4><p style={{ color: '#475569', fontSize: 13 }}>{d.autoevaluacion?.plan_accion || '-'}</p><h4>📚 Desarrollo</h4><p style={{ color: '#475569', fontSize: 13 }}>{d.autoevaluacion?.desarrollo_individual || '-'}</p></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EvaluacionesAdmin() {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [detalleVisible, setDetalleVisible] = useState(null);

  useEffect(() => { cargarEvaluaciones(); }, []);

  async function cargarEvaluaciones() {
    const { data } = await supabase
      .from('evaluaciones')
      .select('*, colaborador:colaborador_id(email, full_name, area), evaluador:evaluador_id(email, full_name)')
      .order('created_at', { ascending: false });
    setEvaluaciones(data || []);
    setCargando(false);
  }

  if (cargando) return <p style={{ padding: 20, color: '#64748b' }}>Cargando evaluaciones...</p>;

  return (
    <div style={{ ...s.tarjetaStat }}>
      <h4 style={{ margin: '0 0 16px 0' }}>📋 Evaluaciones ({evaluaciones.length})</h4>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
          <thead><tr style={{ borderBottom: '2px solid #e2e8f0' }}><th style={th}>Colaborador</th><th style={th}>Área</th><th style={th}>Tipo</th><th style={th}>Evaluador</th><th style={th}>Estado</th><th style={th}>Fecha</th><th style={th}>Ver</th></tr></thead>
          <tbody>{evaluaciones.map(ev => (
            <tr key={ev.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={td}>{ev.colaborador?.full_name || ev.colaborador?.email || '-'}</td>
              <td style={td}>{ev.colaborador?.area || '-'}</td>
              <td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ev.tipo_evaluacion === 'autoevaluacion' ? '#dbeafe' : '#fef3c7', color: ev.tipo_evaluacion === 'autoevaluacion' ? '#1e40af' : '#92400e' }}>{ev.tipo_evaluacion === 'autoevaluacion' ? '👤 Auto' : '👥 Líder'}</span></td>
              <td style={td}>{ev.evaluador?.full_name || ev.evaluador?.email || '-'}</td>
              <td style={td}><span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ev.estado === 'enviado' ? '#dcfce7' : '#fef3c7', color: ev.estado === 'enviado' ? '#166534' : '#92400e' }}>{ev.estado === 'enviado' ? '✅ Enviada' : '📝 Borrador'}</span></td>
              <td style={{ ...td, fontSize: 12, color: '#64748b' }}>{new Date(ev.created_at).toLocaleDateString('es-AR')}</td>
              <td style={td}><button onClick={() => setDetalleVisible(ev.id)} style={{ background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 14 }}>👁️</button></td>
            </tr>
          ))}</tbody>
        </table>
        {detalleVisible && (() => { const ev = evaluaciones.find(e => e.id === detalleVisible); if (!ev) return null; return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }} onClick={() => setDetalleVisible(null)}>
            <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 600, width: '100%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><h3 style={{ margin: 0 }}>📋 Detalle</h3><button onClick={() => setDetalleVisible(null)} style={{ background: '#e2e8f0', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 16 }}>✕</button></div>
              <p><strong>👤 Colaborador:</strong> {ev.colaborador?.full_name || '-'}</p>
              <p><strong>📍 Área:</strong> {ev.colaborador?.area || '-'}</p>
              <p><strong>📝 Tipo:</strong> {ev.tipo_evaluacion === 'autoevaluacion' ? 'Autoevaluación' : 'Evaluación de Líder'}</p>
              <p><strong>👤 Evaluador:</strong> {ev.evaluador?.full_name || ev.evaluador?.email || '-'}</p>
              <p><strong>📊 Estado:</strong> {ev.estado === 'enviado' ? '✅ Enviada' : '📝 Borrador'}</p>
              <p><strong>📅 Fecha:</strong> {new Date(ev.created_at).toLocaleDateString('es-AR')}</p>
              <hr style={{ border: '1px solid #e2e8f0' }} />
              <p><strong>💪 Fortalezas:</strong> {ev.fortalezas || '-'}</p>
              <p><strong>📈 Oportunidades:</strong> {ev.oportunidades || '-'}</p>
              <p><strong>🎯 Plan de Acción:</strong> {ev.plan_accion || '-'}</p>
              <p><strong>📚 Desarrollo:</strong> {ev.desarrollo_individual || '-'}</p>
            </div>
          </div>
        )})()}
      </div>
    </div>
  );
}

function PanelLider() {
  const [equipo, setEquipo] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState({});
  const [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null);

  useEffect(() => { cargarEquipo(); }, []);

  async function cargarEquipo() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data } = await supabase.from('profiles').select('*').eq('leader_id', session.user.id);
    setEquipo(data || []);
    if (data) {
      const evalsPorColaborador = {};
      for (const col of data) {
        const { data: autoeval } = await supabase.from('evaluaciones').select('*').eq('colaborador_id', col.id).eq('tipo_evaluacion', 'autoevaluacion').maybeSingle();
        const { data: evalLider } = await supabase.from('evaluaciones').select('*').eq('colaborador_id', col.id).eq('tipo_evaluacion', 'evaluacion_lider').maybeSingle();
        evalsPorColaborador[col.id] = { autoevaluacion: autoeval, evaluacionLider: evalLider };
      }
      setEvaluaciones(evalsPorColaborador);
    }
  }

  if (colaboradorSeleccionado) return <EvaluacionLider colaborador={colaboradorSeleccionado} onVolver={() => { setColaboradorSeleccionado(null); cargarEquipo(); }} />;

  return (
    <div>
      <h3 style={{ marginBottom: 20 }}>👥 Mi Equipo ({equipo.length})</h3>
      {equipo.length === 0 ? <div style={s.tarjetaPlaceholder}><p>No tienes colaboradores asignados.</p></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {equipo.map(col => {
            const auto = evaluaciones[col.id]?.autoevaluacion;
            const lider = evaluaciones[col.id]?.evaluacionLider;
            return (
              <div key={col.id} style={{ ...s.tarjetaStat, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0 }}>{col.full_name || col.email}</h4>
                  <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>{col.area} · {col.seniority}</p>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                    <span>📝 Auto: <strong style={{ color: auto?.estado === 'enviado' ? '#22c55e' : '#f59e0b' }}>{auto?.estado === 'enviado' ? 'Enviada' : 'Pendiente'}</strong></span>
                    <span>👥 Mi eval: <strong style={{ color: lider?.estado === 'enviado' ? '#22c55e' : lider ? '#f59e0b' : '#94a3b8' }}>{lider?.estado === 'enviado' ? 'Completada' : lider ? 'Borrador' : 'Sin evaluar'}</strong></span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setColaboradorSeleccionado(col)} style={s.btnPrimario}>{lider ? '✏️ Editar' : '📝 Evaluar'}</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EvaluacionLider({ colaborador, onVolver }) {
  const [competencias, setCompetencias] = useState([]);
  const [puntuacionesAuto, setPuntuacionesAuto] = useState({});
  const [evaluacionLider, setEvaluacionLider] = useState(null);
  const [ratings, setRatings] = useState({});
  const [comentarios, setComentarios] = useState({});
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [showInfo, setShowInfo] = useState({});

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const { data: comps } = await supabase.from('competencias').select('*').eq('aplica_a', colaborador.seniority || 'Analista');
    setCompetencias(comps || []);
    const { data: auto } = await supabase.from('evaluaciones').select('*, puntuaciones(*)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'autoevaluacion').maybeSingle();
    if (auto) { const pa = {}; (auto.puntuaciones || []).forEach(p => { pa[p.competencia_id] = p.rating; }); setPuntuacionesAuto(pa); }
    const { data: { session } } = await supabase.auth.getSession();
    const { data: liderEval } = await supabase.from('evaluaciones').select('*, puntuaciones(*)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').maybeSingle();
    if (liderEval) {
      setEvaluacionLider(liderEval);
      const rm = {}; const cm = {};
      (liderEval.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; });
      setRatings(rm); setComentarios(cm);
    } else {
      const { data: nueva } = await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador' }).select().single();
      setEvaluacionLider(nueva);
    }
    setCargando(false);
  }

  async function guardar() {
    await supabase.from('evaluaciones').update({ updated_at: new Date() }).eq('id', evaluacionLider.id);
    for (const [compId, rating] of Object.entries(ratings)) {
      const com = comentarios[compId] || '';
      const { data: ex } = await supabase.from('puntuaciones').select('id').eq('evaluacion_id', evaluacionLider.id).eq('competencia_id', compId).maybeSingle();
      if (ex) { await supabase.from('puntuaciones').update({ rating, comentario: com }).eq('id', ex.id); }
      else { await supabase.from('puntuaciones').insert({ evaluacion_id: evaluacionLider.id, competencia_id: compId, rating, comentario: com }); }
    }
    setMensaje('✅ Borrador guardado'); setTimeout(() => setMensaje(''), 2500);
  }

  async function enviar() {
    await guardar();
    await supabase.from('evaluaciones').update({ estado: 'enviado', updated_at: new Date() }).eq('id', evaluacionLider.id);
    setMensaje('🎉 Evaluación enviada'); setEvaluacionLider({ ...evaluacionLider, estado: 'enviado' });
    setTimeout(() => setMensaje(''), 3000);
  }

  if (cargando) return <p style={{ padding: 20 }}>Cargando...</p>;
  const enviada = evaluacionLider?.estado === 'enviado';

  return (
    <div style={{ maxWidth: 900 }}>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button>
      <h3>📝 Evaluando a: {colaborador.full_name || colaborador.email}</h3>
      <p style={{ color: '#64748b', marginBottom: 24 }}>{colaborador.area} · {colaborador.seniority}</p>
      {competencias.map(comp => (
        <div key={comp.id} style={s.competenciaCard}>
          <div style={s.competenciaHeader}><div><h5 style={{ margin: 0 }}>{comp.nombre}</h5><p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>{comp.descripcion}</p></div><button onClick={() => setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] })} style={s.btnInfo}>{showInfo[comp.id] ? '🔼 Ocultar' : '🔽 Ver info'}</button></div>
          {puntuacionesAuto[comp.id] && (<div style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>📝 Auto: <strong>{puntuacionesAuto[comp.id]}</strong>{ratings[comp.id] && <span style={{ marginLeft: 12, color: ratings[comp.id] > puntuacionesAuto[comp.id] ? '#22c55e' : ratings[comp.id] < puntuacionesAuto[comp.id] ? '#dc2626' : '#64748b' }}>| Tú: <strong>{ratings[comp.id]}</strong> ({ratings[comp.id] - puntuacionesAuto[comp.id] > 0 ? '+' : ''}{ratings[comp.id] - puntuacionesAuto[comp.id]})</span>}</div>)}
          <div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => enviada ? null : setRatings({ ...ratings, [comp.id]: r })} style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#2563eb' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', border: ratings[comp.id] === r ? '2px solid #1d4ed8' : '2px solid #e2e8f0', cursor: enviada ? 'not-allowed' : 'pointer' }} disabled={enviada}>{r}</button>)}</div>
          {showInfo[comp.id] && (<div style={s.ratingInfoBox}>{[1,2,3,4,5].map(r => <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>)}</div>)}
          <textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({ ...comentarios, [comp.id]: e.target.value })} placeholder="Comentario..." style={s.textareaSmall} disabled={enviada} />
        </div>
      ))}
      <CalcularPromedio ratings={ratings} competencias={competencias} />
      {mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      {!enviada && <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar Borrador</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>}
      {enviada && <div style={s.bannerEnviado}>✅ Evaluación enviada.</div>}
    </div>
  );
}

function PanelColaborador({ userId, seniority }) {
  const [evalData, setEvalData] = useState(null);
  const [competencias, setCompetencias] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comentarios, setComentarios] = useState({});
  const [fortalezas, setFortalezas] = useState('');
  const [oportunidades, setOportunidades] = useState('');
  const [planAccion, setPlanAccion] = useState('');
  const [desarrollo, setDesarrollo] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [showInfo, setShowInfo] = useState({});

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    const { data: comps } = await supabase.from('competencias').select('*').eq('aplica_a', seniority || 'Analista');
    setCompetencias(comps || []);
    const { data: ev } = await supabase.from('evaluaciones').select('*').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').single();
    if (ev) {
      setEvalData(ev); setFortalezas(ev.fortalezas || ''); setOportunidades(ev.oportunidades || ''); setPlanAccion(ev.plan_accion || ''); setDesarrollo(ev.desarrollo_individual || '');
      const { data: punts } = await supabase.from('puntuaciones').select('*').eq('evaluacion_id', ev.id);
      const rm = {}; const cm = {};
      (punts || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; });
      setRatings(rm); setComentarios(cm);
    } else {
      const { data: nueva } = await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador' }).select().single();
      setEvalData(nueva);
    }
    setCargando(false);
  }

  async function guardar() {
    await supabase.from('evaluaciones').update({ fortalezas, oportunidades, plan_accion: planAccion, desarrollo_individual: desarrollo, updated_at: new Date() }).eq('id', evalData.id);
    for (const [compId, rating] of Object.entries(ratings)) {
      const com = comentarios[compId] || '';
      const { data: ex } = await supabase.from('puntuaciones').select('id').eq('evaluacion_id', evalData.id).eq('competencia_id', compId).single();
      if (ex) { await supabase.from('puntuaciones').update({ rating, comentario: com }).eq('id', ex.id); }
      else { await supabase.from('puntuaciones').insert({ evaluacion_id: evalData.id, competencia_id: compId, rating, comentario: com }); }
    }
    setMensaje('✅ Borrador guardado'); setTimeout(() => setMensaje(''), 2500);
  }

  async function enviar() {
    await guardar();
    await supabase.from('evaluaciones').update({ estado: 'enviado', updated_at: new Date() }).eq('id', evalData.id);
    setMensaje('🎉 Evaluación enviada'); setEvalData({ ...evalData, estado: 'enviado' });
    setTimeout(() => setMensaje(''), 3000);
  }

  if (cargando) return <p style={{ padding: 20 }}>Cargando competencias...</p>;
  const enviada = evalData?.estado === 'enviado';

  return (
    <div style={{ maxWidth: 900 }}>
      <h3>📝 Mi Autoevaluación</h3>
      <p style={{ color: '#64748b', marginBottom: 4 }}>Seniority: <strong>{seniority || 'No definido'}</strong></p>
      <p style={{ color: '#64748b', marginBottom: 24 }}>Estado: <strong style={{ color: enviada ? '#22c55e' : '#f59e0b' }}>{enviada ? '✅ Enviada' : '📝 En progreso'}</strong></p>
      {competencias.map(comp => (
        <div key={comp.id} style={s.competenciaCard}>
          <div style={s.competenciaHeader}><div><h5 style={{ margin: 0 }}>{comp.nombre}</h5><p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>{comp.descripcion}</p><span style={{ ...s.tipoBadge, marginTop: 4, display: 'inline-block' }}>{comp.tipo === 'generica' ? '🌐 Genérica' : '🎯 Específica'}</span></div><button onClick={() => setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] })} style={s.btnInfo}>{showInfo[comp.id] ? '🔼 Ocultar' : '🔽 Ver info'}</button></div>
          <div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => enviada ? null : setRatings({ ...ratings, [comp.id]: r })} style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#2563eb' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', border: ratings[comp.id] === r ? '2px solid #1d4ed8' : '2px solid #e2e8f0', cursor: enviada ? 'not-allowed' : 'pointer' }} disabled={enviada}>{r}</button>)}</div>
          {showInfo[comp.id] && (<div style={s.ratingInfoBox}>{[1,2,3,4,5].map(r => <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>)}</div>)}
          <textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({ ...comentarios, [comp.id]: e.target.value })} placeholder="Comentario..." style={s.textareaSmall} disabled={enviada} />
        </div>
      ))}
      <SeccionText titulo="💪 Fortalezas" valor={fortalezas} onChange={setFortalezas} disabled={enviada} />
      <SeccionText titulo="📈 Oportunidades de Mejora" valor={oportunidades} onChange={setOportunidades} disabled={enviada} />
      <SeccionText titulo="🎯 Plan de Acción" valor={planAccion} onChange={setPlanAccion} disabled={enviada} />
      <SeccionText titulo="📚 Desarrollo Individual" valor={desarrollo} onChange={setDesarrollo} disabled={enviada} />
      <CalcularPromedio ratings={ratings} competencias={competencias} />
      {mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      {!enviada && <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar Borrador</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar Evaluación</button></div>}
      {enviada && <div style={s.bannerEnviado}>✅ Tu evaluación ha sido enviada.</div>}
    </div>
  );
}

function SeccionText({ titulo, valor, onChange, disabled }) {
  return <div style={{ marginBottom: 24 }}><h4 style={s.seccionTitulo}>{titulo}</h4><textarea value={valor} onChange={e => onChange(e.target.value)} style={s.textarea} disabled={disabled} /></div>;
}

function RatingDesc({ competenciaId, rating }) {
  const [desc, setDesc] = useState('Cargando...');
  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('rating_descriptions').select('titulo, descripcion').eq('competencia_id', competenciaId).eq('rating', rating).single();
      if (error) setDesc('Error');
      else if (data) setDesc(`${data.titulo}: ${data.descripcion}`);
      else setDesc('Sin descripción');
    }
    load();
  }, [competenciaId, rating]);
  return <span>{desc}</span>;
}

function CalcularPromedio({ ratings, competencias }) {
  if (!ratings || Object.keys(ratings).length === 0) return null;
  const valores = Object.values(ratings).filter(r => r > 0);
  if (valores.length === 0) return null;
  const suma = valores.reduce((acc, val) => acc + val, 0);
  const promedio = suma / valores.length;
  let clasificacion = '', color = '', emoji = '';
  if (promedio <= 1.4) { clasificacion = 'No adecuado'; color = '#dc2626'; emoji = '🔴'; }
  else if (promedio <= 2.4) { clasificacion = 'Por debajo de lo esperado'; color = '#f59e0b'; emoji = '🟠'; }
  else if (promedio <= 3.4) { clasificacion = 'Cumple con las expectativas'; color = '#3b82f6'; emoji = '🔵'; }
  else if (promedio <= 4.4) { clasificacion = 'Excede las expectativas'; color = '#22c55e'; emoji = '🟢'; }
  else { clasificacion = 'Desempeño distinguido'; color = '#8b5cf6'; emoji = '🟣'; }
  return (
    <div style={{ marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: `2px solid ${color}`, textAlign: 'center' }}>
      <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Resultado Final</p>
      <p style={{ fontSize: 48, fontWeight: 700, color, margin: '8px 0' }}>{promedio.toFixed(1)}</p>
      <p style={{ fontSize: 18, fontWeight: 600, color, margin: 0 }}>{emoji} {clasificacion}</p>
      <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Basado en {valores.length} de {competencias?.length || 0} competencias evaluadas</p>
    </div>
  );
}

const th = { textAlign: 'left', padding: '10px', color: '#64748b', fontSize: '12px' };
const td = { padding: '10px', fontSize: '14px' };

const s = {
  centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flexWrap: 'wrap', gap: 12, position: 'sticky', top: 0, zIndex: 100 },
  headerIzq: { display: 'flex', alignItems: 'center', gap: 12 },
  logo: { fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 },
  badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' },
  headerDer: { display: 'flex', alignItems: 'center', gap: 14 },
  email: { fontSize: 14, color: '#64748b' },
  btnSalir: { padding: '8px 16px', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 },
  main: { padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' },
  tarjetaBienvenida: { background: 'white', padding: '20px 24px', borderRadius: 12, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
  tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },
  tarjetaPlaceholder: { background: 'white', padding: 40, borderRadius: 12, textAlign: 'center', color: '#64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#1e293b', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #e2e8f0' },
  competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14, border: '1px solid #e2e8f0' },
  competenciaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tipoBadge: { fontSize: 11, padding: '3px 10px', borderRadius: 12, background: '#f1f5f9', color: '#64748b', display: 'inline-block', fontWeight: 500 },
  btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', color: '#475569', fontWeight: 500 },
  ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' },
  ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ratingInfoBox: { background: 'white', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #e2e8f0' },
  ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 },
  textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'white' },
  textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'white' },
  btnPrimario: { padding: '12px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)' },
  btnSecundario: { padding: '12px 24px', background: '#475569', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  mensajeToast: { padding: '12px 20px', background: '#f0fdf4', borderRadius: 8, marginBottom: 16, color: '#166534', fontWeight: 500, fontSize: 14, textAlign: 'center', border: '1px solid #bbf7d0' },
  bannerEnviado: { padding: 20, background: '#f0fdf4', borderRadius: 10, color: '#166534', fontWeight: 600, textAlign: 'center', border: '2px solid #bbf7d0', marginBottom: 40 }
};
