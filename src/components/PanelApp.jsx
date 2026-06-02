import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

function abrirGmail(colaboradorEmail, liderEmail) {
  const to = colaboradorEmail + (liderEmail ? `,${liderEmail}` : '');
  const subject = 'Evaluación de Desempeño - Fabric Group';
  const body = 'Adjunto encontrarás el resumen de la evaluación de desempeño.%0D%0A%0D%0AFabric Group.';
  window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${encodeURIComponent(subject)}&body=${body}`, '_blank');
}

export default function PanelApp() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuActivo, setMenuActivo] = useState('desempeno');
  const [cicloActivo, setCicloActivo] = useState(null);

  useEffect(() => { cargarPerfil(); }, []);

  async function cargarPerfil() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    const { data: perfil } = await supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo, leader_id').eq('id', session.user.id).single();
    if (perfil && perfil.activo === false) {
      await supabase.auth.signOut();
      alert('Tu cuenta ha sido desactivada. Contacta a RRHH.');
      window.location.href = '/';
      return;
    }
    setProfile(perfil);
    setLoading(false);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) return <div style={s.centrado}><p>Cargando...</p></div>;
  if (!profile) return <div style={s.centrado}><h2>Error al cargar perfil</h2><button onClick={cerrarSesion} style={s.btnSalir}>Volver</button></div>;

  const nombreRol = profile.role === 'admin_rrhh' ? 'Admin RRHH' : profile.role === 'lider' ? 'Líder' : 'Colaborador';
  const emojiRol = profile.role === 'admin_rrhh' ? '🔧' : profile.role === 'lider' ? '👥' : '👤';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Menú Lateral */}
      <aside style={sidebarStyle.aside}>
        <div style={sidebarStyle.logoContainer}>
          <img src="/logo.jpg" alt="Fabric Group" style={{ height: '40px' }} />
        </div>
        <nav style={sidebarStyle.nav}>
          <button onClick={() => { setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' }}>
            📊 Evaluación de Desempeño
          </button>
          <button onClick={() => setMenuActivo('objetivos')} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'objetivos' ? '#D4D2C6' : 'transparent', color: menuActivo === 'objetivos' ? '#231F20' : '#D4D2C6' }}>
            🎯 Mis Objetivos
          </button>
          <button onClick={() => setMenuActivo('objetivos_empresa')} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'objetivos_empresa' ? '#D4D2C6' : 'transparent', color: menuActivo === 'objetivos_empresa' ? '#231F20' : '#D4D2C6' }}>
            🏢 Objetivos de la Compañía
          </button>
        </nav>
        <div style={sidebarStyle.footer}>
          <span style={{ fontSize: 12, color: '#D4D2C6' }}>{profile.email}</span>
          <button onClick={cerrarSesion} style={{ ...s.btnSalir, marginTop: 8, width: '100%' }}>Cerrar Sesión</button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <div style={{ flex: 1, background: '#f8fafc', minHeight: '100vh' }}>
        <header style={s.header}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1>
          <span style={s.badge}>{emojiRol} {nombreRol}</span>
        </header>
        <main style={{ padding: 24 }}>
          {menuActivo === 'desempeno' && (
            <DesempenoView profile={profile} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />
          )}
          {menuActivo === 'objetivos' && <PlaceholderView titulo="🎯 Mis Objetivos" descripcion="Módulo en desarrollo." />}
          {menuActivo === 'objetivos_empresa' && <PlaceholderView titulo="🏢 Objetivos de la Compañía" descripcion="Módulo en desarrollo." />}
        </main>
      </div>
    </div>
  );
}

function PlaceholderView({ titulo, descripcion }) {
  return (
    <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}>
      <h2 style={{ color: '#231F20' }}>{titulo}</h2>
      <p style={{ color: '#64748b', marginTop: 12 }}>{descripcion}</p>
    </div>
  );
}

function DesempenoView({ profile, cicloActivo, setCicloActivo }) {
  const esAdmin = profile.role === 'admin_rrhh';

  // Si no hay ciclo seleccionado, mostrar lista de ciclos
  if (!cicloActivo) {
    return <CiclosLista esAdmin={esAdmin} onSelectCiclo={setCicloActivo} />;
  }

  // Si hay ciclo seleccionado, mostrar el panel de ese ciclo
  return (
    <div>
      <button onClick={() => setCicloActivo(null)} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver a Ciclos</button>
      <h2 style={{ color: '#231F20', marginBottom: 4 }}>📊 {cicloActivo.nombre}</h2>
      <p style={{ color: '#64748b', marginBottom: 20 }}>
        {new Date(cicloActivo.fecha_inicio).toLocaleDateString('es-AR')} · Estado: {cicloActivo.estado}
      </p>
      {esAdmin ? (
        <PanelAdmin profile={profile} cicloId={cicloActivo.id} />
      ) : profile.role === 'lider' ? (
        <PanelLider />
      ) : (
        <PanelColaboradorConEquipo userId={profile.id} seniority={profile.seniority} email={profile.email} nombre={profile.full_name} />
      )}
    </div>
  );
}

function CiclosLista({ esAdmin, onSelectCiclo }) {
  const [ciclos, setCiclos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [nombreCiclo, setNombreCiclo] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  useEffect(() => { cargarCiclos(); }, []);

  async function cargarCiclos() {
    const { data } = await supabase.from('ciclos').select('*').order('fecha_inicio', { ascending: false });
    setCiclos(data || []);
    setCargando(false);
  }

  async function crearCiclo() {
    if (!nombreCiclo || !fechaInicio) return alert('Nombre y fecha de inicio son obligatorios');
    await supabase.from('ciclos').insert({
      nombre: nombreCiclo,
      fecha_inicio: fechaInicio,
      fecha_fin: fechaFin || null,
      estado: 'activo'
    });
    setNombreCiclo(''); setFechaInicio(''); setFechaFin('');
    setMostrarCrear(false);
    cargarCiclos();
  }

  if (cargando) return <p>Cargando ciclos...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: '#231F20', margin: 0 }}>📊 Ciclos de Evaluación</h2>
        {esAdmin && (
          <button onClick={() => setMostrarCrear(!mostrarCrear)} style={s.btnPrimario}>
            + Nuevo Ciclo
          </button>
        )}
      </div>

      {mostrarCrear && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20 }}>
          <h4>Crear Nuevo Ciclo</h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <div><label>Nombre</label><input type="text" value={nombreCiclo} onChange={e => setNombreCiclo(e.target.value)} placeholder="Ej: 1er Semestre 2025" style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', width: 200 }} /></div>
            <div><label>Fecha Inicio</label><input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label>Fecha Fin (opcional)</label><input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <button onClick={crearCiclo} style={{ ...s.btnPrimario, background: '#22c55e', alignSelf: 'flex-end' }}>Crear</button>
          </div>
        </div>
      )}

      {ciclos.length === 0 ? (
        <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#94a3b8' }}>No hay ciclos creados.</p>
          {esAdmin && <p style={{ color: '#94a3b8', fontSize: 13 }}>Crea el primer ciclo para comenzar.</p>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {ciclos.map(ciclo => (
            <div key={ciclo.id} onClick={() => onSelectCiclo(ciclo)} style={{ ...s.tarjetaStat, cursor: 'pointer', border: '2px solid #D4D2C6', transition: 'all 0.2s' }}>
              <h3 style={{ color: '#231F20', margin: '0 0 8px 0' }}>{ciclo.nombre}</h3>
              <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>📅 Inicio: {new Date(ciclo.fecha_inicio).toLocaleDateString('es-AR')}</p>
              {ciclo.fecha_fin && <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>📅 Fin: {new Date(ciclo.fecha_fin).toLocaleDateString('es-AR')}</p>}
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ciclo.estado === 'activo' ? '#dcfce7' : '#f1f5f9', color: ciclo.estado === 'activo' ? '#166534' : '#64748b', display: 'inline-block', marginTop: 8 }}>
                {ciclo.estado === 'activo' ? '✅ Activo' : '📁 ' + ciclo.estado}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PanelAdmin({ profile, cicloId }) {
  const [stats, setStats] = useState({ total: 0, enviadas: 0, pendientes: 0 });
  const [colaboradores, setColaboradores] = useState([]);
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [senioritySeleccionado, setSenioritySeleccionado] = useState(null);
  const [colaboradorHistorial, setColaboradorHistorial] = useState(null);

  useEffect(() => { cargarDatos(); }, [cicloId]);

  async function cargarDatos() {
    const [{ count: t }, { count: e }, { data }] = await Promise.all([
      supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId),
      supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('estado', 'enviado'),
      supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo')
    ]);
    setStats({ total: t || 0, enviadas: e || 0, pendientes: (t || 0) - (e || 0) });
    setColaboradores(data || []);
  }

  const seniorityCounts = useMemo(() => {
    const counts = {};
    colaboradores.forEach(c => { const s = c.seniority || 'Sin definir'; counts[s] = (counts[s] || 0) + 1; });
    return counts;
  }, [colaboradores]);

  const pct = stats.total > 0 ? Math.round((stats.enviadas / stats.total) * 100) : 0;
  const colaboradoresFiltrados = senioritySeleccionado ? colaboradores.filter(c => (c.seniority || 'Sin definir') === senioritySeleccionado) : [];

  if (colaboradorHistorial) {
    return <HistorialAdmin colaborador={colaboradorHistorial} onVolver={() => setColaboradorHistorial(null)} />;
  }

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
          <div style={s.grid}>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>👥 Total Colaboradores</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{colaboradores.length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>📋 Total Evaluaciones</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.total}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '4px solid #231F20' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.enviadas}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.pendientes}</p></div>
          </div>
          <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 8px 0' }}>📈 Progreso: {pct}%</p>
            <div style={{ background: '#D4D2C6', borderRadius: 10, height: 24, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#231F20', borderRadius: 10, transition: 'width 0.3s' }} />
            </div>
          </div>
          <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#231F20' }}>📊 Por Seniority</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {Object.entries(seniorityCounts).map(([seniority, count]) => (
                <div key={seniority} onClick={() => setSenioritySeleccionado(seniority === senioritySeleccionado ? null : seniority)} 
                  style={{ padding: 16, background: seniority === senioritySeleccionado ? '#231F20' : '#D4D2C6', borderRadius: 10, textAlign: 'center', cursor: 'pointer' }}>
                  <p style={{ fontSize: 11, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#231F20', margin: 0, fontWeight: 600 }}>{seniority}</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#231F20', margin: '6px 0' }}>{count}</p>
                </div>
              ))}
            </div>
          </div>
          {senioritySeleccionado && (
            <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
              <h4 style={{ margin: '0 0 12px 0' }}>👥 {senioritySeleccionado} ({colaboradoresFiltrados.length})</h4>
              {colaboradoresFiltrados.map(c => (
                <div key={c.id} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div><strong>{c.full_name || c.email}</strong><p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{c.area || 'Sin área'}</p></div>
                  <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 12, background: c.activo ? '#dcfce7' : '#fee2e2', color: c.activo ? '#166534' : '#dc2626' }}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {vistaActiva === 'evaluaciones' && <EvaluacionesAdmin cicloId={cicloId} onVerHistorial={setColaboradorHistorial} />}
      {vistaActiva === 'calibracion' && <PanelCalibracion colaboradores={colaboradores} cicloId={cicloId} onVerHistorial={setColaboradorHistorial} />}
      {vistaActiva === 'colaboradores' && (
        <div style={{ ...s.tarjetaStat }}>
          <h4>👥 Colaboradores ({colaboradores.length})</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Área</th><th style={th}>Seniority</th><th style={th}>Rol</th><th style={th}>Historial</th></tr></thead>
            <tbody>{colaboradores.map(c => (
              <tr key={c.id}><td style={td}>{c.full_name || '-'}</td><td style={td}>{c.email}</td><td style={td}>{c.area || '-'}</td>
                <td style={td}>{c.seniority || '-'}</td><td style={td}>{c.role}</td>
                <td style={td}><button onClick={() => setColaboradorHistorial(c)} style={{ background: '#231F20', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>📋</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EvaluacionesAdmin({ cicloId, onVerHistorial }) {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { 
    (async () => { 
      const { data } = await supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, evaluador_id, estado, rating_calibrado, created_at, colaborador:colaborador_id(email, full_name, area, id), evaluador:evaluador_id(email, full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false });
      setEvaluaciones(data || []); setCargando(false); 
    })(); 
  }, [cicloId]);
  if (cargando) return <p>Cargando...</p>;
  return (
    <div style={s.tarjetaStat}><h4>📋 Evaluaciones ({evaluaciones.length})</h4>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Colaborador</th><th style={th}>Área</th><th style={th}>Tipo</th><th style={th}>Evaluador</th><th style={th}>Estado</th><th style={th}>Calibrado</th><th style={th}>Fecha</th><th style={th}>Hist</th></tr></thead>
        <tbody>{evaluaciones.map(ev => (
          <tr key={ev.id}><td style={td}>{ev.colaborador?.full_name || '-'}</td><td style={td}>{ev.colaborador?.area || '-'}</td>
            <td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ev.tipo_evaluacion === 'autoevaluacion' ? '#D4D2C6' : '#231F20', color: ev.tipo_evaluacion === 'autoevaluacion' ? '#231F20' : '#D4D2C6' }}>{ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Líder'}</span></td>
            <td style={td}>{ev.evaluador?.full_name || '-'}</td>
            <td style={td}><span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, background: ev.estado === 'enviado' ? '#231F20' : '#D4D2C6', color: 'white' }}>{ev.estado === 'enviado' ? 'Enviada' : 'Borrador'}</span></td>
            <td style={td}>{ev.rating_calibrado || '-'}</td>
            <td style={td}>{new Date(ev.created_at).toLocaleDateString('es-AR')}</td>
            <td style={td}><button onClick={() => onVerHistorial && ev.colaborador && onVerHistorial(ev.colaborador)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>📋</button></td>
          </tr>
        ))}</tbody></table></div>
    </div>
  );
}

function PanelCalibracion({ colaboradores, cicloId, onVerHistorial }) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroArea, setFiltroArea] = useState('Todas');

  useEffect(() => { cargarDatos(); }, [cicloId]);

  async function cargarDatos() {
    setCargando(true);
    const { data: todasEvals } = await supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, evaluador_id, rating_calibrado, puntuaciones(rating, competencia_id, comentario, competencias(nombre)), colaborador:colaborador_id(id, email, full_name, area, seniority)').eq('ciclo_id', cicloId).in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']);
    const mapa = {};
    (todasEvals || []).forEach(ev => {
      if (!ev.colaborador) return;
      if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, autoevaluacion: null, evaluacionLider: null };
      if (ev.tipo_evaluacion === 'autoevaluacion') mapa[ev.colaborador_id].autoevaluacion = ev;
      if (ev.tipo_evaluacion === 'evaluacion_lider') mapa[ev.colaborador_id].evaluacionLider = ev;
    });
    const calc = (p) => { if (!p || p.length === 0) return null; const v = p.map(x => x.rating).filter(r => r > 0); return v.length === 0 ? null : (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1); };
    const resultado = Object.values(mapa).map(d => ({ ...d, promAuto: calc(d.autoevaluacion?.puntuaciones), promLider: calc(d.evaluacionLider?.puntuaciones), ratingFinal: d.evaluacionLider?.rating_calibrado || null }));
    setDatos(resultado); setCargando(false);
  }

  async function guardarCalibracion(evaluacionId, rating) { 
    await supabase.from('evaluaciones').update({ rating_calibrado: rating }).eq('id', evaluacionId); 
    setDatos(prev => prev.map(d => d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating } : d)); 
  }

  function generarPDF(d) {
    const pdf = new jsPDF(); const NEGRO = '#231F20'; const pageWidth = 210; const marginX = 15; let y = 28;
    try { pdf.addImage('/logo.jpg', 'JPEG', marginX, 8, 30, 15); } catch(e) {}
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(NEGRO); pdf.text('EVALUACIÓN DE DESEMPEÑO', marginX, y); y += 7;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(`Colaborador: ${d.colaborador.full_name || d.colaborador.email}`, marginX, y); y += 5;
    pdf.text(`Área: ${d.colaborador.area || '-'}   |   Seniority: ${d.colaborador.seniority || '-'}`, marginX, y); y += 10;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.text(`Resultado Final: ${d.ratingFinal || '-'}`, marginX, y + 10);
    return pdf;
  }

  function verPDF(d) { generarPDF(d).save(`Evaluacion_${(d.colaborador.full_name || d.colaborador.email).replace(/\s/g, '_')}.pdf`); }
  function enviarPDF(d) { verPDF(d); let liderEmail = ''; if (d.evaluacionLider?.evaluador_id) { supabase.from('profiles').select('email').eq('id', d.evaluacionLider.evaluador_id).single().then(({ data: l }) => { abrirGmail(d.colaborador.email, l?.email || ''); }); } else { abrirGmail(d.colaborador.email, ''); } }

  const areas = useMemo(() => ['Todas', ...new Set(datos.map(d => d.colaborador.area).filter(Boolean))], [datos]);
  const datosFiltrados = filtroArea === 'Todas' ? datos : datos.filter(d => d.colaborador.area === filtroArea);

  if (cargando) return <p>⏳ Cargando...</p>;

  return (
    <div style={{ ...s.tarjetaStat }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#231F20' }}>🎯 Calibración</h3>
        <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1000px' }}>
          <thead><tr><th style={th}>Colaborador</th><th style={th}>Área</th><th style={th}>Auto</th><th style={th}>Líder</th><th style={th}>Calibrado</th><th style={th}>Historial</th><th style={th}>PDF</th><th style={th}>Enviar</th></tr></thead>
          <tbody>{datosFiltrados.map(d => (
            <tr key={d.colaborador.id}><td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td><td style={td}>{d.colaborador.area || '-'}</td>
              <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{d.promAuto || '-'}</td>
              <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{d.promLider || '-'}</td>
              <td style={td}>{d.promLider ? <select value={d.ratingFinal || ''} onChange={(e) => guardarCalibracion(d.evaluacionLider.id, parseFloat(e.target.value))} style={{ padding: 4, borderRadius: 6 }}><option value="">-</option><option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option></select> : '-'}</td>
              <td style={td}><button onClick={() => onVerHistorial && onVerHistorial(d.colaborador)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>📋</button></td>
              <td style={td}><button onClick={() => verPDF(d)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>PDF</button></td>
              <td style={td}>{d.ratingFinal ? <button onClick={() => enviarPDF(d)} style={{ background: '#231F20', color: '#D4D2C6', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Enviar</button> : '-'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function HistorialAdmin({ colaborador, onVolver }) {
  const [historicas, setHistoricas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [modo, setModo] = useState('completa');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [ratingsHist, setRatingsHist] = useState({});
  const [comentariosFinalesHist, setComentariosFinalesHist] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [nuevoRating, setNuevoRating] = useState('');
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [competencias, setCompetencias] = useState([]);

  useEffect(() => { cargarTodo(); }, [colaborador.id]);

  async function cargarTodo() {
    setCargando(true);
    const [{ data: comps }, { data: hist }] = await Promise.all([
      supabase.from('competencias').select('id, nombre').eq('aplica_a', colaborador.seniority || 'Analista'),
      supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false })
    ]);
    setCompetencias(comps || []);
    setHistoricas(hist || []);
    setCargando(false);
  }

  async function guardarEvaluacionCompleta() {
    if (!nuevaFecha) return alert('Fecha obligatoria');
    const valores = Object.values(ratingsHist).filter(r => r > 0);
    if (valores.length === 0) return alert('Califique al menos una competencia');
    const promedio = (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1);
    await supabase.from('evaluaciones_historicas').insert({
      colaborador_id: colaborador.id, fecha_evaluacion: nuevaFecha,
      rating_final: parseFloat(promedio), comentarios: comentariosFinalesHist || 'Evaluación histórica'
    });
    alert('✅ Guardada');
    setNuevaFecha(''); setRatingsHist({}); setComentariosFinalesHist('');
    setMostrarForm(false); cargarTodo();
  }

  async function subirPDF() {
    if (!archivo || !nuevaFecha) return alert('Fecha y archivo obligatorios');
    const fileName = `${colaborador.id}_${Date.now()}_${archivo.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
    await supabase.storage.from('historicos').upload(fileName, archivo);
    const { data: urlData } = supabase.storage.from('historicos').getPublicUrl(fileName);
    await supabase.from('evaluaciones_historicas').insert({
      colaborador_id: colaborador.id, fecha_evaluacion: nuevaFecha,
      rating_final: nuevoRating ? parseFloat(nuevoRating) : null,
      comentarios: nuevoComentario || 'Evaluación histórica (PDF)',
      archivo_url: urlData.publicUrl
    });
    alert('✅ PDF guardado');
    setNuevaFecha(''); setNuevoRating(''); setNuevoComentario(''); setArchivo(null);
    setMostrarForm(false); cargarTodo();
  }

  if (cargando) return <p>Cargando...</p>;

  return (
    <div>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3>📋 Historial: {colaborador.full_name || colaborador.email}</h3>
        <button onClick={() => setMostrarForm(!mostrarForm)} style={s.btnPrimario}>{mostrarForm ? 'Cancelar' : '+ Agregar'}</button>
      </div>
      <p style={{ color: '#64748b', marginBottom: 20 }}>{colaborador.area} · {colaborador.seniority}</p>
      
      {mostrarForm && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button onClick={() => setModo('completa')} style={modo === 'completa' ? s.btnPrimario : s.btnInfo}>✏️ Evaluación</button>
            <button onClick={() => setModo('pdf')} style={modo === 'pdf' ? s.btnPrimario : s.btnInfo}>📄 Subir PDF</button>
          </div>
          <div style={{ marginBottom: 12 }}><label>Fecha *</label><input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
          {modo === 'completa' && (
            <div>
              {competencias.map(comp => (
                <div key={comp.id} style={{ ...s.competenciaCard, background: 'white' }}>
                  <h5>{comp.nombre}</h5>
                  <div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => setRatingsHist({ ...ratingsHist, [comp.id]: r })} style={{ ...s.ratingBtn, backgroundColor: ratingsHist[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratingsHist[comp.id] === r ? 'white' : '#475569' }}>{r}</button>)}</div>
                </div>
              ))}
              <div style={{ marginTop: 12 }}><label>Comentarios Finales</label><textarea value={comentariosFinalesHist} onChange={e => setComentariosFinalesHist(e.target.value)} style={{ ...s.textarea, minHeight: 60 }} /></div>
              <button onClick={guardarEvaluacionCompleta} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 12 }}>💾 Guardar</button>
            </div>
          )}
          {modo === 'pdf' && (
            <div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div><label>Rating</label><select value={nuevoRating} onChange={e => setNuevoRating(e.target.value)} style={{ padding: 8, borderRadius: 6 }}><option value="">-</option><option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option></select></div>
                <div style={{ flex: 1 }}><label>Comentario</label><input type="text" value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6 }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><div style={{ flex: 1 }}><label>Archivo PDF *</label><input type="file" accept=".pdf" onChange={e => setArchivo(e.target.files[0])} /></div><button onClick={subirPDF} style={{ ...s.btnPrimario, background: '#f59e0b' }}>📄 Subir</button></div>
            </div>
          )}
        </div>
      )}

      {historicas.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No hay evaluaciones históricas.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th><th style={th}>Comentarios</th><th style={th}>Archivo</th></tr></thead>
          <tbody>{historicas.map(h => (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={{ ...td, fontWeight: 700, fontSize: 16 }}>{h.rating_final || '-'}</td><td style={td}>{h.comentarios || '-'}</td><td style={td}>{h.archivo_url ? <a href={h.archivo_url} target="_blank" style={{ background: '#f59e0b', color: 'white', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontSize: 12 }}>📄 Ver PDF</a> : '-'}</td></tr>))}</tbody></table>
      )}
    </div>
  );
}

function PanelLider() { return <EquipoLider />; }
function PanelColaboradorConEquipo({ userId, seniority, email, nombre }) {
  const [vista, setVista] = useState('autoevaluacion');
  const [tieneEquipo, setTieneEquipo] = useState(false);
  useEffect(() => { (async () => { const { data: { session } } = await supabase.auth.getSession(); if (session) { const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', session.user.id); setTieneEquipo((count || 0) > 0); } })(); }, []);
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={() => setVista('autoevaluacion')} style={vista === 'autoevaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluación</button>{tieneEquipo && <button onClick={() => setVista('equipo')} style={vista === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>}</div>
      {vista === 'autoevaluacion' && <PanelColaborador userId={userId} seniority={seniority} />}
      {vista === 'equipo' && tieneEquipo && <EquipoLider />}
    </div>
  );
}

function EquipoLider() {
  const [equipo, setEquipo] = useState([]);
  const [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null);
  const [historialVisible, setHistorialVisible] = useState(null);
  useEffect(() => { (async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) return; const { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', session.user.id); setEquipo(data || []); })(); }, []);
  if (colaboradorSeleccionado) return <EvaluacionLider colaborador={colaboradorSeleccionado} onVolver={() => setColaboradorSeleccionado(null)} />;
  if (historialVisible) return <HistorialLider colaborador={historialVisible} onVolver={() => setHistorialVisible(null)} />;
  return (
    <div><h3>👥 Mi Equipo ({equipo.length})</h3>
      {equipo.map(col => (
        <div key={col.id} style={{ ...s.tarjetaStat, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div><strong>{col.full_name || col.email}</strong><p style={{ fontSize: 12, color: '#64748b' }}>{col.area} · {col.seniority}</p></div>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setHistorialVisible(col)} style={{ ...s.btnInfo, background: '#D4D2C6', color: '#231F20', fontWeight: 600 }}>📋 Historial</button><button onClick={() => setColaboradorSeleccionado(col)} style={s.btnPrimario}>📝 Evaluar</button></div>
        </div>
      ))}
    </div>
  );
}

function HistorialLider({ colaborador, onVolver }) {
  const [historicas, setHistoricas] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { (async () => { const { data } = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false }); setHistoricas(data || []); setCargando(false); })(); }, [colaborador.id]);
  if (cargando) return <p>Cargando...</p>;
  return (
    <div><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📋 Historial: {colaborador.full_name || colaborador.email}</h3>
      {historicas.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No hay evaluaciones históricas.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th><th style={th}>Comentarios</th><th style={th}>Archivo</th></tr></thead>
          <tbody>{historicas.map(h => (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={{ ...td, fontWeight: 700, fontSize: 16 }}>{h.rating_final || '-'}</td><td style={td}>{h.comentarios || '-'}</td><td style={td}>{h.archivo_url ? <a href={h.archivo_url} target="_blank" style={{ background: '#f59e0b', color: 'white', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontSize: 12 }}>📄 Ver PDF</a> : '-'}</td></tr>))}</tbody></table>
      )}
    </div>
  );
}

function EvaluacionLider({ colaborador, onVolver }) {
  const [competencias, setCompetencias] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comentarios, setComentarios] = useState({});
  const [comentariosFinales, setComentariosFinales] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  
  useEffect(() => { 
    (async () => { 
      const { data: comps } = await supabase.from('competencias').select('id, nombre').eq('aplica_a', colaborador.seniority || 'Analista'); 
      setCompetencias(comps || []); 
      const { data: { session } } = await supabase.auth.getSession();
      const { data: liderEval } = await supabase.from('evaluaciones').select('id, estado, comentarios_finales, puntuaciones(rating, competencia_id, comentario)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').maybeSingle(); 
      if (liderEval) { setComentariosFinales(liderEval.comentarios_finales || ''); const rm = {}; const cm = {}; (liderEval.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComentarios(cm); } 
      else { await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador' }); }
      setCargando(false); 
    })(); 
  }, []);
  
  async function guardar() { 
    const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').single();
    if (!ev) return;
    await supabase.from('evaluaciones').update({ comentarios_finales: comentariosFinales }).eq('id', ev.id); 
    for (const [compId, rating] of Object.entries(ratings)) { 
      await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: compId, rating, comentario: comentarios[compId] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); 
    } 
    setMensaje('✅ Guardado'); setTimeout(() => setMensaje(''), 2500); 
  }
  
  async function enviar() { 
    await guardar(); 
    const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').single();
    if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id); 
    setMensaje('🎉 Enviada'); 
  }
  
  if (cargando) return <p>Cargando...</p>;
  
  return (
    <div style={{ maxWidth: 900 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📝 Evaluando a: {colaborador.full_name || colaborador.email}</h3><p>{colaborador.area} · {colaborador.seniority}</p>
      {competencias.map(comp => (<div key={comp.id} style={s.competenciaCard}><h5>{comp.nombre}</h5><div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => setRatings({...ratings, [comp.id]: r})} style={{...s.ratingBtn, backgroundColor: ratings[comp.id]===r?'#231F20':'#f1f5f9', color: ratings[comp.id]===r?'white':'#475569'}}>{r}</button>)}</div><textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({...comentarios, [comp.id]: e.target.value})} placeholder="Comentario" style={s.textareaSmall} /></div>))}
      <SeccionText titulo="📝 Comentarios Finales" valor={comentariosFinales} onChange={setComentariosFinales} />{mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      <div style={{ display: 'flex', gap: 12 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>
    </div>
  );
}

function PanelColaborador({ userId, seniority }) {
  const [competencias, setCompetencias] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comentarios, setComentarios] = useState({});
  const [comentariosFinales, setComentariosFinales] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  
  useEffect(() => { 
    (async () => { 
      const [{ data: comps }, { data: ev }] = await Promise.all([
        supabase.from('competencias').select('id, nombre').eq('aplica_a', seniority || 'Analista'),
        supabase.from('evaluaciones').select('id, estado, comentarios_finales, puntuaciones(rating, competencia_id, comentario)').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').single()
      ]);
      setCompetencias(comps || []); 
      if (ev) { setComentariosFinales(ev.comentarios_finales || ''); const rm = {}; const cm = {}; (ev.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComentarios(cm); } 
      else { await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador' }); } 
      setCargando(false); 
    })(); 
  }, []);
  
  async function guardar() { 
    const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').single(); 
    if (!ev) return;
    await supabase.from('evaluaciones').update({ comentarios_finales: comentariosFinales }).eq('id', ev.id); 
    for (const [compId, rating] of Object.entries(ratings)) { 
      await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: compId, rating, comentario: comentarios[compId] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); 
    } 
    setMensaje('✅ Guardado'); setTimeout(() => setMensaje(''), 2500); 
  }
  
  async function enviar() { 
    await guardar(); 
    const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').single(); 
    if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id); 
    setMensaje('🎉 Enviada'); 
  }
  
  if (cargando) return <p>Cargando...</p>;
  
  return (
    <div style={{ maxWidth: 900 }}><h3>📝 Mi Autoevaluación</h3><p>Seniority: <strong>{seniority || 'No definido'}</strong></p>
      {competencias.map(comp => (<div key={comp.id} style={s.competenciaCard}><h5>{comp.nombre}</h5><div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => setRatings({...ratings, [comp.id]: r})} style={{...s.ratingBtn, backgroundColor: ratings[comp.id]===r?'#231F20':'#f1f5f9', color: ratings[comp.id]===r?'white':'#475569'}}>{r}</button>)}</div><textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({...comentarios, [comp.id]: e.target.value})} placeholder="Comentario" style={s.textareaSmall} /></div>))}
      <SeccionText titulo="📝 Comentarios Finales" valor={comentariosFinales} onChange={setComentariosFinales} />{mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      <div style={{ display: 'flex', gap: 12 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>
    </div>
  );
}

function SeccionText({ titulo, valor, onChange }) { return <div style={{ marginBottom: 24 }}><h4 style={s.seccionTitulo}>{titulo}</h4><textarea value={valor} onChange={e => onChange(e.target.value)} style={s.textarea} /></div>; }

const th = { textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: '11px' };
const td = { padding: '6px 8px', fontSize: '13px' };

const sidebarStyle = {
  aside: { width: '260px', background: '#231F20', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 0' },
  logoContainer: { padding: '0 20px 20px', borderBottom: '1px solid #D4D2C6', marginBottom: 16, textAlign: 'center' },
  nav: { display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', flex: 1 },
  menuItem: { padding: '14px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, transition: 'all 0.15s', width: '100%' },
  footer: { padding: '16px 20px', borderTop: '1px solid #D4D2C6' }
};

const s = {
  centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#231F20' },
  badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#D4D2C6', color: '#231F20' },
  btnSalir: { padding: '8px 16px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 },
  main: { padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' },
  tarjetaBienvenida: { background: 'white', padding: '20px 24px', borderRadius: 12, marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
  tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, marginBottom: 12 },
  seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#231F20', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #D4D2C6' },
  competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14 },
  btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 },
  ratingRow: { display: 'flex', gap: 8, marginBottom: 12 },
  ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' },
  btnPrimario: { padding: '12px 24px', background: '#231F20', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  btnSecundario: { padding: '12px 24px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  mensajeToast: { padding: '12px 20px', background: '#D4D2C6', borderRadius: 8, marginBottom: 16, color: '#231F20', fontWeight: 500, fontSize: 14, textAlign: 'center' },
};
