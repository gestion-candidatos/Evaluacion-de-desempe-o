import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
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

  async function cerrarSesion() { await supabase.auth.signOut(); window.location.href = '/'; }

  if (loading) return <div style={s.centrado}><p>Cargando...</p></div>;
  if (!profile) return <div style={s.centrado}><h2>Error</h2><button onClick={cerrarSesion} style={s.btnSalir}>Volver</button></div>;

  const nombreRol = profile.role === 'admin_rrhh' ? 'Admin RRHH' : profile.role === 'lider' ? 'Líder' : 'Colaborador';
  const emojiRol = profile.role === 'admin_rrhh' ? '🔧' : profile.role === 'lider' ? '👥' : '👤';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebar.aside}>
        <div style={sidebar.logoContainer}><img src="/logo.jpg" alt="Fabric Group" style={{ height: '40px' }} /></div>
        <nav style={sidebar.nav}>
          <button onClick={() => { setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ ...sidebar.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' }}>📊 Evaluación de Desempeño</button>
          <button onClick={() => setMenuActivo('objetivos')} style={{ ...sidebar.menuItem, background: menuActivo === 'objetivos' ? '#D4D2C6' : 'transparent', color: menuActivo === 'objetivos' ? '#231F20' : '#D4D2C6' }}>🎯 Mis Objetivos</button>
          <button onClick={() => setMenuActivo('objetivos_empresa')} style={{ ...sidebar.menuItem, background: menuActivo === 'objetivos_empresa' ? '#D4D2C6' : 'transparent', color: menuActivo === 'objetivos_empresa' ? '#231F20' : '#D4D2C6' }}>🏢 Objetivos de la Compañía</button>
        </nav>
        <div style={sidebar.footer}><span style={{ fontSize: 12, color: '#D4D2C6' }}>{profile.email}</span><button onClick={cerrarSesion} style={{ ...s.btnSalir, marginTop: 8, width: '100%' }}>Cerrar Sesión</button></div>
      </aside>
      <div style={{ flex: 1, background: '#f8fafc', minHeight: '100vh' }}>
        <header style={s.header}><h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1><span style={s.badge}>{emojiRol} {nombreRol}</span></header>
        <main style={{ padding: 24 }}>
          {menuActivo === 'desempeno' && <DesempenoView profile={profile} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
          {menuActivo === 'objetivos' && <PlaceholderView titulo="🎯 Mis Objetivos" descripcion="Módulo en desarrollo." />}
          {menuActivo === 'objetivos_empresa' && <PlaceholderView titulo="🏢 Objetivos de la Compañía" descripcion="Módulo en desarrollo." />}
        </main>
      </div>
    </div>
  );
}

function PlaceholderView({ titulo, descripcion }) {
  return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}><h2 style={{ color: '#231F20' }}>{titulo}</h2><p style={{ color: '#64748b', marginTop: 12 }}>{descripcion}</p></div>;
}

function DesempenoView({ profile, cicloActivo, setCicloActivo }) {
  const esAdmin = profile.role === 'admin_rrhh';
  if (!cicloActivo) return <CiclosLista esAdmin={esAdmin} onSelectCiclo={setCicloActivo} profile={profile} />;
  return (
    <div>
      <button onClick={() => setCicloActivo(null)} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver a Ciclos</button>
      <h2 style={{ color: '#231F20', marginBottom: 4 }}>📊 {cicloActivo.nombre}</h2>
      <p style={{ color: '#64748b', marginBottom: 20 }}>{new Date(cicloActivo.fecha_inicio).toLocaleDateString('es-AR')} · {cicloActivo.estado}</p>
      {esAdmin ? <PanelAdmin profile={profile} cicloId={cicloActivo.id} /> 
        : profile.role === 'lider' ? <PanelLider cicloId={cicloActivo.id} /> 
        : <PanelColaboradorConEquipo userId={profile.id} seniority={profile.seniority} email={profile.email} nombre={profile.full_name} cicloId={cicloActivo.id} />}
    </div>
  );
}

function CiclosLista({ esAdmin, onSelectCiclo, profile }) {
  const [ciclos, setCiclos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [nombreCiclo, setNombreCiclo] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [cicloSeleccionado, setCicloSeleccionado] = useState(null);
  const [todosColaboradores, setTodosColaboradores] = useState([]);
  const [participantes, setParticipantes] = useState([]);

  useEffect(() => { cargarCiclos(); if (esAdmin) cargarColaboradores(); }, []);

  async function cargarCiclos() {
    const { data } = await supabase.from('ciclos').select('*').order('fecha_inicio', { ascending: false });
    setCiclos(data || []);
    setCargando(false);
  }

  async function cargarColaboradores() {
    const { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority').neq('role', 'admin_rrhh').eq('activo', true);
    setTodosColaboradores(data || []);
  }

  async function crearCiclo() {
    if (!nombreCiclo || !fechaInicio) return alert('Nombre y fecha de inicio son obligatorios');
    await supabase.from('ciclos').insert({ nombre: nombreCiclo, fecha_inicio: fechaInicio, fecha_fin: fechaFin || null, estado: 'activo' });
    setNombreCiclo(''); setFechaInicio(''); setFechaFin(''); setMostrarCrear(false);
    cargarCiclos();
  }

  async function abrirGestionParticipantes(ciclo) {
    setCicloSeleccionado(ciclo.id);
    const { data } = await supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', ciclo.id);
    setParticipantes((data || []).map(p => p.colaborador_id));
  }

  async function toggleParticipante(colaboradorId) {
    if (participantes.includes(colaboradorId)) {
      await supabase.from('ciclo_colaboradores').delete().eq('ciclo_id', cicloSeleccionado).eq('colaborador_id', colaboradorId);
      setParticipantes(prev => prev.filter(id => id !== colaboradorId));
    } else {
      await supabase.from('ciclo_colaboradores').insert({ ciclo_id: cicloSeleccionado, colaborador_id: colaboradorId });
      setParticipantes(prev => [...prev, colaboradorId]);
    }
  }

  // Verificar si el colaborador está en el ciclo
  async function verificarParticipacion(cicloId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { count } = await supabase.from('ciclo_colaboradores').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('colaborador_id', session.user.id);
    return count > 0;
  }

  if (cargando) return <p>Cargando ciclos...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: '#231F20', margin: 0 }}>📊 Ciclos de Evaluación</h2>
        {esAdmin && <button onClick={() => setMostrarCrear(!mostrarCrear)} style={s.btnPrimario}>+ Nuevo Ciclo</button>}
      </div>

      {mostrarCrear && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20 }}>
          <h4>Crear Nuevo Ciclo</h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
            <div><label>Nombre</label><input type="text" value={nombreCiclo} onChange={e => setNombreCiclo(e.target.value)} placeholder="Ej: 1er Semestre 2025" style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', width: 200 }} /></div>
            <div><label>Fecha Inicio</label><input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label>Fecha Fin</label><input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <button onClick={crearCiclo} style={{ ...s.btnPrimario, background: '#22c55e', alignSelf: 'flex-end' }}>Crear</button>
          </div>
        </div>
      )}

      {/* Gestión de Participantes */}
      {cicloSeleccionado && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4>👥 Seleccionar Participantes del Ciclo</h4>
            <button onClick={() => setCicloSeleccionado(null)} style={s.btnInfo}>✕ Cerrar</button>
          </div>
          <p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{participantes.length} colaboradores seleccionados</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
            {todosColaboradores.map(col => (
              <div key={col.id} onClick={() => toggleParticipante(col.id)} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: participantes.includes(col.id) ? '#231F20' : 'white', color: participantes.includes(col.id) ? '#D4D2C6' : '#231F20', border: '1px solid #D4D2C6' }}>
                <div><strong style={{ fontSize: 13 }}>{col.full_name || col.email}</strong><p style={{ fontSize: 11, margin: 0, opacity: 0.7 }}>{col.area} · {col.seniority}</p></div>
                <span>{participantes.includes(col.id) ? '✅' : '○'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {ciclos.length === 0 ? (
        <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p style={{ color: '#94a3b8' }}>No hay ciclos creados.</p></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {ciclos.map(ciclo => (
            <div key={ciclo.id} style={{ ...s.tarjetaStat, border: '2px solid #D4D2C6' }}>
              <h3 style={{ color: '#231F20', margin: '0 0 8px 0' }}>{ciclo.nombre}</h3>
              <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>📅 Inicio: {new Date(ciclo.fecha_inicio).toLocaleDateString('es-AR')}</p>
              {ciclo.fecha_fin && <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>📅 Fin: {new Date(ciclo.fecha_fin).toLocaleDateString('es-AR')}</p>}
              <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ciclo.estado === 'activo' ? '#dcfce7' : '#f1f5f9', color: ciclo.estado === 'activo' ? '#166534' : '#64748b', display: 'inline-block', marginTop: 8 }}>{ciclo.estado === 'activo' ? '✅ Activo' : '📁 ' + ciclo.estado}</span>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => onSelectCiclo(ciclo)} style={{ ...s.btnPrimario, flex: 1 }}>Entrar</button>
                {esAdmin && <button onClick={() => abrirGestionParticipantes(ciclo)} style={{ ...s.btnSecundario }}>👥</button>}
              </div>
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
    const [{ count: t }, { count: e }, { data: participantes }, { data: perfiles }] = await Promise.all([
      supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId),
      supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('estado', 'enviado'),
      supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', cicloId),
      supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo').neq('role', 'admin_rrhh')
    ]);
    const participantesIds = (participantes || []).map(p => p.colaborador_id);
    setColaboradores((perfiles || []).filter(c => participantesIds.includes(c.id)));
    setStats({ total: t || 0, enviadas: e || 0, pendientes: (t || 0) - (e || 0) });
  }

  const seniorityCounts = useMemo(() => {
    const counts = {};
    colaboradores.forEach(c => { const s = c.seniority || 'Sin definir'; counts[s] = (counts[s] || 0) + 1; });
    return counts;
  }, [colaboradores]);

  const pct = stats.total > 0 ? Math.round((stats.enviadas / stats.total) * 100) : 0;
  const colaboradoresFiltrados = senioritySeleccionado ? colaboradores.filter(c => (c.seniority || 'Sin definir') === senioritySeleccionado) : [];

  if (colaboradorHistorial) return <HistorialAdmin colaborador={colaboradorHistorial} onVolver={() => setColaboradorHistorial(null)} />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setVistaActiva('dashboard')} style={vistaActiva === 'dashboard' ? s.btnPrimario : s.btnInfo}>📊 Dashboard</button>
        <button onClick={() => setVistaActiva('evaluaciones')} style={vistaActiva === 'evaluaciones' ? s.btnPrimario : s.btnInfo}>📋 Evaluaciones</button>
        <button onClick={() => setVistaActiva('calibracion')} style={vistaActiva === 'calibracion' ? s.btnPrimario : s.btnInfo}>🎯 Calibración</button>
        <button onClick={() => setVistaActiva('colaboradores')} style={vistaActiva === 'colaboradores' ? s.btnPrimario : s.btnInfo}>👥 Participantes</button>
      </div>

      {vistaActiva === 'dashboard' && (
        <div>
          <div style={s.grid}>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>👥 Participantes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{colaboradores.length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>📋 Evaluaciones</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.total}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '4px solid #231F20' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.enviadas}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.pendientes}</p></div>
          </div>
          <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 8px 0' }}>📈 Progreso: {pct}%</p>
            <div style={{ background: '#D4D2C6', borderRadius: 10, height: 24, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#231F20', borderRadius: 10 }} /></div>
          </div>
          <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#231F20' }}>📊 Por Seniority</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {Object.entries(seniorityCounts).map(([seniority, count]) => (
                <div key={seniority} onClick={() => setSenioritySeleccionado(seniority === senioritySeleccionado ? null : seniority)} style={{ padding: 16, background: seniority === senioritySeleccionado ? '#231F20' : '#D4D2C6', borderRadius: 10, textAlign: 'center', cursor: 'pointer' }}>
                  <p style={{ fontSize: 11, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#231F20', margin: 0, fontWeight: 600 }}>{seniority}</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#231F20', margin: '6px 0' }}>{count}</p>
                </div>
              ))}
            </div>
          </div>
          {senioritySeleccionado && (
            <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
              <h4>👥 {senioritySeleccionado} ({colaboradoresFiltrados.length})</h4>
              {colaboradoresFiltrados.map(c => (
                <div key={c.id} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div><strong>{c.full_name || c.email}</strong><p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>{c.area || 'Sin área'}</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {vistaActiva === 'evaluaciones' && <EvaluacionesAdmin cicloId={cicloId} onVerHistorial={setColaboradorHistorial} />}
      {vistaActiva === 'calibracion' && <PanelCalibracion cicloId={cicloId} colaboradores={colaboradores} onVerHistorial={setColaboradorHistorial} />}
      {vistaActiva === 'colaboradores' && (
        <div style={{ ...s.tarjetaStat }}><h4>👥 Participantes ({colaboradores.length})</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Área</th><th style={th}>Seniority</th></tr></thead>
            <tbody>{colaboradores.map(c => (<tr key={c.id}><td style={td}>{c.full_name || '-'}</td><td style={td}>{c.email}</td><td style={td}>{c.area || '-'}</td><td style={td}>{c.seniority || '-'}</td></tr>))}</tbody></table>
        </div>
      )}
    </div>
  );
}

function EvaluacionesAdmin({ cicloId, onVerHistorial }) {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { (async () => { const { data } = await supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, evaluador_id, estado, rating_calibrado, created_at, colaborador:colaborador_id(email, full_name, area, id), evaluador:evaluador_id(email, full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setEvaluaciones(data || []); setCargando(false); })(); }, [cicloId]);
  if (cargando) return <p>Cargando...</p>;
  return (
    <div style={s.tarjetaStat}><h4>📋 Evaluaciones ({evaluaciones.length})</h4>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Colaborador</th><th style={th}>Tipo</th><th style={th}>Estado</th><th style={th}>Calibrado</th><th style={th}>Fecha</th><th style={th}>Hist</th></tr></thead>
        <tbody>{evaluaciones.map(ev => (
          <tr key={ev.id}><td style={td}>{ev.colaborador?.full_name || '-'}</td><td style={td}>{ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Líder'}</td><td style={td}>{ev.estado}</td><td style={td}>{ev.rating_calibrado || '-'}</td><td style={td}>{new Date(ev.created_at).toLocaleDateString('es-AR')}</td><td style={td}><button onClick={() => onVerHistorial(ev.colaborador)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>📋</button></td></tr>
        ))}</tbody></table></div>
    </div>
  );
}

function PanelCalibracion({ cicloId, colaboradores, onVerHistorial }) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { cargarDatos(); }, [cicloId]);

  async function cargarDatos() {
    const { data: todasEvals } = await supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, evaluador_id, rating_calibrado, puntuaciones(rating, competencia_id, comentario), colaborador:colaborador_id(id, email, full_name, area, seniority)').eq('ciclo_id', cicloId).in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']);
    const mapa = {};
    (todasEvals || []).forEach(ev => {
      if (!ev.colaborador) return;
      if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, autoevaluacion: null, evaluacionLider: null };
      if (ev.tipo_evaluacion === 'autoevaluacion') mapa[ev.colaborador_id].autoevaluacion = ev;
      if (ev.tipo_evaluacion === 'evaluacion_lider') mapa[ev.colaborador_id].evaluacionLider = ev;
    });
    const calc = (p) => { if (!p || p.length === 0) return null; const v = p.map(x => x.rating).filter(r => r > 0); return v.length === 0 ? null : (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1); };
    setDatos(Object.values(mapa).map(d => ({ ...d, promAuto: calc(d.autoevaluacion?.puntuaciones), promLider: calc(d.evaluacionLider?.puntuaciones), ratingFinal: d.evaluacionLider?.rating_calibrado || null })));
    setCargando(false);
  }

  async function guardarCalibracion(evaluacionId, rating) { await supabase.from('evaluaciones').update({ rating_calibrado: rating }).eq('id', evaluacionId); setDatos(prev => prev.map(d => d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating } : d)); }

  function generarPDF(d) {
    const pdf = new jsPDF(); let y = 28;
    try { pdf.addImage('/logo.jpg', 'JPEG', 15, 8, 30, 15); } catch(e) {}
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text('EVALUACIÓN DE DESEMPEÑO', 15, y); y += 7;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(`Colaborador: ${d.colaborador.full_name || d.colaborador.email}`, 15, y); y += 5;
    pdf.text(`Área: ${d.colaborador.area || '-'}   |   Seniority: ${d.colaborador.seniority || '-'}`, 15, y); y += 10;
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.text(`Resultado Final: ${d.ratingFinal || '-'}`, 15, y + 10);
    return pdf;
  }

  function verPDF(d) { generarPDF(d).save(`Evaluacion_${(d.colaborador.full_name || d.colaborador.email).replace(/\s/g, '_')}.pdf`); }
  function enviarPDF(d) { verPDF(d); let liderEmail = ''; if (d.evaluacionLider?.evaluador_id) { supabase.from('profiles').select('email').eq('id', d.evaluacionLider.evaluador_id).single().then(({ data: l }) => { abrirGmail(d.colaborador.email, l?.email || ''); }); } else { abrirGmail(d.colaborador.email, ''); } }

  if (cargando) return <p>Cargando...</p>;

  return (
    <div style={{ ...s.tarjetaStat }}><h3>🎯 Calibración</h3>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}><thead><tr><th style={th}>Colaborador</th><th style={th}>Auto</th><th style={th}>Líder</th><th style={th}>Calibrado</th><th style={th}>Hist</th><th style={th}>PDF</th><th style={th}>Enviar</th></tr></thead>
        <tbody>{datos.map(d => (
          <tr key={d.colaborador.id}><td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td><td style={td}>{d.promAuto || '-'}</td><td style={td}>{d.promLider || '-'}</td>
            <td style={td}>{d.promLider ? <select value={d.ratingFinal || ''} onChange={(e) => guardarCalibracion(d.evaluacionLider.id, parseFloat(e.target.value))}><option value="">-</option><option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option></select> : '-'}</td>
            <td style={td}><button onClick={() => onVerHistorial(d.colaborador)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>📋</button></td>
            <td style={td}><button onClick={() => verPDF(d)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>PDF</button></td>
            <td style={td}>{d.ratingFinal ? <button onClick={() => enviarPDF(d)} style={{ background: '#231F20', color: '#D4D2C6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Enviar</button> : '-'}</td></tr>
        ))}</tbody></table></div>
    </div>
  );
}

function HistorialAdmin({ colaborador, onVolver }) {
  const [historicas, setHistoricas] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { (async () => { const { data } = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false }); setHistoricas(data || []); setCargando(false); })(); }, [colaborador.id]);
  if (cargando) return <p>Cargando...</p>;
  return (
    <div><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📋 Historial: {colaborador.full_name || colaborador.email}</h3>
      {historicas.length === 0 ? <p style={{ color: '#94a3b8', padding: 40 }}>Sin historial.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th><th style={th}>Comentarios</th></tr></thead>
          <tbody>{historicas.map(h => (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={td}>{h.rating_final || '-'}</td><td style={td}>{h.comentarios || '-'}</td></tr>))}</tbody></table>
      )}
    </div>
  );
}

function PanelLider({ cicloId }) { return <EquipoLider cicloId={cicloId} />; }

function PanelColaboradorConEquipo({ userId, seniority, email, nombre, cicloId }) {
  const [vista, setVista] = useState('autoevaluacion');
  const [tieneEquipo, setTieneEquipo] = useState(false);
  const [participa, setParticipa] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const [{ count: equipoCount }, { count: participaCount }] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', session.user.id),
          supabase.from('ciclo_colaboradores').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('colaborador_id', session.user.id)
        ]);
        setTieneEquipo((equipoCount || 0) > 0);
        setParticipa((participaCount || 0) > 0);
      }
      setVerificando(false);
    })();
  }, [cicloId]);

  if (verificando) return <p>Verificando participación...</p>;
  if (!participa) return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p style={{ color: '#94a3b8' }}>No estás participando en este ciclo de evaluación.</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button onClick={() => setVista('autoevaluacion')} style={vista === 'autoevaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluación</button>
        {tieneEquipo && <button onClick={() => setVista('equipo')} style={vista === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>}
      </div>
      {vista === 'autoevaluacion' && <PanelColaborador userId={userId} seniority={seniority} cicloId={cicloId} />}
      {vista === 'equipo' && tieneEquipo && <EquipoLider cicloId={cicloId} />}
    </div>
  );
}

function EquipoLider({ cicloId }) {
  const [equipo, setEquipo] = useState([]);
  const [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null);
  useEffect(() => { (async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) return; const { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', session.user.id); setEquipo(data || []); })(); }, []);
  if (colaboradorSeleccionado) return <EvaluacionLider colaborador={colaboradorSeleccionado} cicloId={cicloId} onVolver={() => setColaboradorSeleccionado(null)} />;
  return (
    <div><h3>👥 Mi Equipo ({equipo.length})</h3>
      {equipo.map(col => (<div key={col.id} style={{ ...s.tarjetaStat, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}><div><strong>{col.full_name || col.email}</strong><p style={{ fontSize: 12, color: '#64748b' }}>{col.area} · {col.seniority}</p></div><button onClick={() => setColaboradorSeleccionado(col)} style={s.btnPrimario}>📝 Evaluar</button></div>))}
    </div>
  );
}

function EvaluacionLider({ colaborador, cicloId, onVolver }) {
  const [competencias, setCompetencias] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comentarios, setComentarios] = useState({});
  const [comentariosFinales, setComentariosFinales] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => { (async () => { const { data: comps } = await supabase.from('competencias').select('id, nombre').eq('aplica_a', colaborador.seniority || 'Analista'); setCompetencias(comps || []); const { data: { session } } = await supabase.auth.getSession(); const { data: liderEval } = await supabase.from('evaluaciones').select('id, estado, comentarios_finales, puntuaciones(rating, competencia_id, comentario)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(); if (liderEval) { setComentariosFinales(liderEval.comentarios_finales || ''); const rm = {}; const cm = {}; (liderEval.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComentarios(cm); } else { await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador', ciclo_id: cicloId }); } setCargando(false); })(); }, []);

  async function guardar() { const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (!ev) return; await supabase.from('evaluaciones').update({ comentarios_finales: comentariosFinales }).eq('id', ev.id); for (const [compId, rating] of Object.entries(ratings)) { await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: compId, rating, comentario: comentarios[compId] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMensaje('✅ Guardado'); setTimeout(() => setMensaje(''), 2500); }
  async function enviar() { await guardar(); const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id); setMensaje('🎉 Enviada'); }

  if (cargando) return <p>Cargando...</p>;
  return (
    <div style={{ maxWidth: 900 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📝 Evaluando a: {colaborador.full_name || colaborador.email}</h3><p>{colaborador.area} · {colaborador.seniority}</p>
      {competencias.map(comp => (<div key={comp.id} style={s.competenciaCard}><h5>{comp.nombre}</h5><div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => setRatings({...ratings, [comp.id]: r})} style={{...s.ratingBtn, backgroundColor: ratings[comp.id]===r?'#231F20':'#f1f5f9', color: ratings[comp.id]===r?'white':'#475569'}}>{r}</button>)}</div><textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({...comentarios, [comp.id]: e.target.value})} placeholder="Comentario" style={s.textareaSmall} /></div>))}
      <SeccionText titulo="📝 Comentarios Finales" valor={comentariosFinales} onChange={setComentariosFinales} />{mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      <div style={{ display: 'flex', gap: 12 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>
    </div>
  );
}

function PanelColaborador({ userId, seniority, cicloId }) {
  const [competencias, setCompetencias] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comentarios, setComentarios] = useState({});
  const [comentariosFinales, setComentariosFinales] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => { (async () => { const [{ data: comps }, { data: ev }] = await Promise.all([supabase.from('competencias').select('id, nombre').eq('aplica_a', seniority || 'Analista'), supabase.from('evaluaciones').select('id, estado, comentarios_finales, puntuaciones(rating, competencia_id, comentario)').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single()]); setCompetencias(comps || []); if (ev) { setComentariosFinales(ev.comentarios_finales || ''); const rm = {}; const cm = {}; (ev.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComentarios(cm); } else { await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador', ciclo_id: cicloId }); } setCargando(false); })(); }, []);

  async function guardar() { const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (!ev) return; await supabase.from('evaluaciones').update({ comentarios_finales: comentariosFinales }).eq('id', ev.id); for (const [compId, rating] of Object.entries(ratings)) { await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: compId, rating, comentario: comentarios[compId] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMensaje('✅ Guardado'); setTimeout(() => setMensaje(''), 2500); }
  async function enviar() { await guardar(); const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id); setMensaje('🎉 Enviada'); }

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

const sidebar = {
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
  tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, marginBottom: 12 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
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
