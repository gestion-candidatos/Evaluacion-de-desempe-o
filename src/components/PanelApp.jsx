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
      alert('Tu cuenta ha sido desactivada.');
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
        : profile.role === 'lider' ? <PanelLider cicloId={cicloActivo.id} profile={profile} /> 
        : <PanelColaboradorConEquipo userId={profile.id} seniority={profile.seniority} email={profile.email} nombre={profile.full_name} cicloId={cicloActivo.id} profile={profile} />}
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

  async function cargarCiclos() { const { data } = await supabase.from('ciclos').select('*').order('fecha_inicio', { ascending: false }); setCiclos(data || []); setCargando(false); }
  async function cargarColaboradores() { const { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority').neq('role', 'admin_rrhh').eq('activo', true); setTodosColaboradores(data || []); }

  async function crearCiclo() {
    if (!nombreCiclo || !fechaInicio) return alert('Nombre y fecha de inicio son obligatorios');
    await supabase.from('ciclos').insert({ nombre: nombreCiclo, fecha_inicio: fechaInicio, fecha_fin: fechaFin || null, estado: 'activo' });
    setNombreCiclo(''); setFechaInicio(''); setFechaFin(''); setMostrarCrear(false); cargarCiclos();
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
      {cicloSeleccionado && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><h4>👥 Seleccionar Participantes</h4><button onClick={() => setCicloSeleccionado(null)} style={s.btnInfo}>✕</button></div>
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
      {ciclos.length === 0 ? <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p style={{ color: '#94a3b8' }}>No hay ciclos creados.</p></div> : (
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

  const seniorityCounts = useMemo(() => { const counts = {}; colaboradores.forEach(c => { const s = c.seniority || 'Sin definir'; counts[s] = (counts[s] || 0) + 1; }); return counts; }, [colaboradores]);
  const pct = stats.total > 0 ? Math.round((stats.enviadas / stats.total) * 100) : 0;
  const colaboradoresFiltrados = senioritySeleccionado ? colaboradores.filter(c => (c.seniority || 'Sin definir') === senioritySeleccionado) : [];

  if (colaboradorHistorial) return <HistorialAdmin colaborador={colaboradorHistorial} onVolver={() => setColaboradorHistorial(null)} />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setVistaActiva('dashboard')} style={vistaActiva === 'dashboard' ? s.btnPrimario : s.btnInfo}>📊 Dashboard</button>
        <button onClick={() => setVistaActiva('evaluaciones')} style={vistaActiva === 'evaluaciones' ? s.btnPrimario : s.btnInfo}>📋 Evaluaciones</button>
        <button onClick={() => setVistaActiva('calibracion')} style={vistaActiva === 'calibracion' ? s.btnPrimario : s.btnInfo}>🎯 Calibración</button>
        <button onClick={() => setVistaActiva('feedback')} style={vistaActiva === 'feedback' ? s.btnPrimario : s.btnInfo}>💬 Feedback</button>
        <button onClick={() => setVistaActiva('colaboradores')} style={vistaActiva === 'colaboradores' ? s.btnPrimario : s.btnInfo}>👥 Participantes</button>
      </div>
      {vistaActiva === 'dashboard' && <DashboardView stats={stats} colaboradores={colaboradores} seniorityCounts={seniorityCounts} pct={pct} senioritySeleccionado={senioritySeleccionado} setSenioritySeleccionado={setSenioritySeleccionado} colaboradoresFiltrados={colaboradoresFiltrados} />}
      {vistaActiva === 'evaluaciones' && <EvaluacionesAdmin cicloId={cicloId} onVerHistorial={setColaboradorHistorial} />}
      {vistaActiva === 'calibracion' && <PanelCalibracion cicloId={cicloId} colaboradores={colaboradores} onVerHistorial={setColaboradorHistorial} />}
      {vistaActiva === 'feedback' && <FeedbackAdmin cicloId={cicloId} />}
      {vistaActiva === 'colaboradores' && <ParticipantesView colaboradores={colaboradores} />}
    </div>
  );
}

function DashboardView({ stats, colaboradores, seniorityCounts, pct, senioritySeleccionado, setSenioritySeleccionado, colaboradoresFiltrados }) {
  return (
    <div>
      <div style={s.grid}>
        <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14 }}>👥 Participantes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{colaboradores.length}</p></div>
        <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14 }}>📋 Evaluaciones</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.total}</p></div>
        <div style={{ ...s.tarjetaStat, borderTop: '4px solid #231F20' }}><p style={{ color: '#64748b', fontSize: 14 }}>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.enviadas}</p></div>
        <div style={{ ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' }}><p style={{ color: '#64748b', fontSize: 14 }}>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.pendientes}</p></div>
      </div>
      <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
        <p>📈 Progreso: {pct}%</p>
        <div style={{ background: '#D4D2C6', borderRadius: 10, height: 24 }}><div style={{ width: `${pct}%`, height: '100%', background: '#231F20', borderRadius: 10 }} /></div>
      </div>
      <div style={{ ...s.tarjetaStat, marginTop: 20 }}><h4>📊 Por Seniority</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {Object.entries(seniorityCounts).map(([seniority, count]) => (
            <div key={seniority} onClick={() => setSenioritySeleccionado(seniority === senioritySeleccionado ? null : seniority)} style={{ padding: 16, background: seniority === senioritySeleccionado ? '#231F20' : '#D4D2C6', borderRadius: 10, textAlign: 'center', cursor: 'pointer' }}>
              <p style={{ fontSize: 11, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#231F20', fontWeight: 600 }}>{seniority}</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#231F20' }}>{count}</p>
            </div>
          ))}
        </div>
      </div>
      {senioritySeleccionado && (
        <div style={{ ...s.tarjetaStat, marginTop: 20 }}><h4>👥 {senioritySeleccionado} ({colaboradoresFiltrados.length})</h4>
          {colaboradoresFiltrados.map(c => (<div key={c.id} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><div><strong>{c.full_name || c.email}</strong><p style={{ fontSize: 12, color: '#64748b' }}>{c.area}</p></div></div>))}
        </div>
      )}
    </div>
  );
}

function ParticipantesView({ colaboradores }) {
  return (
    <div style={s.tarjetaStat}><h4>👥 Participantes ({colaboradores.length})</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Área</th><th style={th}>Seniority</th></tr></thead>
        <tbody>{colaboradores.map(c => (<tr key={c.id}><td style={td}>{c.full_name || '-'}</td><td style={td}>{c.email}</td><td style={td}>{c.area || '-'}</td><td style={td}>{c.seniority || '-'}</td></tr>))}</tbody></table>
    </div>
  );
}

function EvaluacionesAdmin({ cicloId, onVerHistorial }) {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { (async () => { const { data } = await supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, evaluador_id, estado, rating_calibrado, created_at, colaborador:colaborador_id(email, full_name), evaluador:evaluador_id(email, full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setEvaluaciones(data || []); setCargando(false); })(); }, [cicloId]);
  if (cargando) return <p>Cargando...</p>;
  return (
    <div style={s.tarjetaStat}><h4>📋 Evaluaciones ({evaluaciones.length})</h4>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Colaborador</th><th style={th}>Tipo</th><th style={th}>Estado</th><th style={th}>Calibrado</th><th style={th}>Fecha</th><th style={th}>Hist</th></tr></thead>
        <tbody>{evaluaciones.map(ev => (<tr key={ev.id}><td style={td}>{ev.colaborador?.full_name || '-'}</td><td style={td}>{ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Líder'}</td><td style={td}>{ev.estado}</td><td style={td}>{ev.rating_calibrado || '-'}</td><td style={td}>{new Date(ev.created_at).toLocaleDateString('es-AR')}</td><td style={td}><button onClick={() => onVerHistorial(ev.colaborador)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>📋</button></td></tr>))}</tbody></table></div>
    </div>
  );
}

function PanelCalibracion({ cicloId, colaboradores, onVerHistorial }) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { (async () => { const { data: evals } = await supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, evaluador_id, rating_calibrado, puntuaciones(rating), colaborador:colaborador_id(id, email, full_name, area, seniority)').eq('ciclo_id', cicloId).in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']); const mapa = {}; (evals || []).forEach(ev => { if (!ev.colaborador) return; if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, autoevaluacion: null, evaluacionLider: null, ratingFinal: null }; if (ev.tipo_evaluacion === 'autoevaluacion') mapa[ev.colaborador_id].autoevaluacion = ev; if (ev.tipo_evaluacion === 'evaluacion_lider') { mapa[ev.colaborador_id].evaluacionLider = ev; mapa[ev.colaborador_id].ratingFinal = ev.rating_calibrado; } }); const calc = (p) => { if (!p || p.length === 0) return null; const v = p.map(x => x.rating).filter(r => r > 0); return v.length === 0 ? null : (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1); }; setDatos(Object.values(mapa).map(d => ({ ...d, promAuto: calc(d.autoevaluacion?.puntuaciones), promLider: calc(d.evaluacionLider?.puntuaciones) }))); setCargando(false); })(); }, [cicloId]);

  async function guardarCalibracion(evaluacionId, rating) { await supabase.from('evaluaciones').update({ rating_calibrado: rating }).eq('id', evaluacionId); setDatos(prev => prev.map(d => d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating } : d)); }

  function generarPDF(d) { const pdf = new jsPDF(); let y = 28; try { pdf.addImage('/logo.jpg', 'JPEG', 15, 8, 30, 15); } catch(e) {} pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text('EVALUACIÓN DE DESEMPEÑO', 15, y); y += 7; pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.text(`Colaborador: ${d.colaborador.full_name || d.colaborador.email}`, 15, y); y += 5; pdf.text(`Área: ${d.colaborador.area || '-'}   |   Seniority: ${d.colaborador.seniority || '-'}`, 15, y); y += 10; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.text(`Resultado Final: ${d.ratingFinal || '-'}`, 15, y + 10); return pdf; }
  function verPDF(d) { generarPDF(d).save(`Evaluacion_${(d.colaborador.full_name || d.colaborador.email).replace(/\s/g, '_')}.pdf`); }
  function enviarPDF(d) { verPDF(d); let liderEmail = ''; if (d.evaluacionLider?.evaluador_id) { supabase.from('profiles').select('email').eq('id', d.evaluacionLider.evaluador_id).single().then(({ data: l }) => { abrirGmail(d.colaborador.email, l?.email || ''); }); } else { abrirGmail(d.colaborador.email, ''); } }

  if (cargando) return <p>Cargando...</p>;
  return (
    <div style={s.tarjetaStat}><h3>🎯 Calibración</h3>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}><thead><tr><th style={th}>Colaborador</th><th style={th}>Auto</th><th style={th}>Líder</th><th style={th}>Calibrado</th><th style={th}>Hist</th><th style={th}>PDF</th><th style={th}>Enviar</th></tr></thead>
        <tbody>{datos.map(d => (<tr key={d.colaborador.id}><td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td><td style={td}>{d.promAuto || '-'}</td><td style={td}>{d.promLider || '-'}</td><td style={td}>{d.promLider ? <select value={d.ratingFinal || ''} onChange={(e) => guardarCalibracion(d.evaluacionLider.id, parseFloat(e.target.value))}><option value="">-</option><option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option></select> : '-'}</td><td style={td}><button onClick={() => onVerHistorial(d.colaborador)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>📋</button></td><td style={td}><button onClick={() => verPDF(d)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12 }}>PDF</button></td><td style={td}>{d.ratingFinal ? <button onClick={() => enviarPDF(d)} style={{ background: '#231F20', color: '#D4D2C6', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Enviar</button> : '-'}</td></tr>))}</tbody></table></div>
    </div>
  );
}

function FeedbackAdmin({ cicloId }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { (async () => { const { data } = await supabase.from('feedback').select('*, lider:lider_id(email, full_name), colaborador:colaborador_id(email, full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setFeedbacks(data || []); setCargando(false); })(); }, [cicloId]);
  if (cargando) return <p>Cargando...</p>;
  return (
    <div style={s.tarjetaStat}><h4>💬 Feedback del Ciclo ({feedbacks.length})</h4>
      {feedbacks.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>Sin registros de feedback.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Líder</th><th style={th}>Colaborador</th><th style={th}>Comentario</th><th style={th}>Fecha</th><th style={th}>Confirmado</th></tr></thead>
          <tbody>{feedbacks.map(f => (<tr key={f.id}><td style={td}>{f.lider?.full_name || '-'}</td><td style={td}>{f.colaborador?.full_name || '-'}</td><td style={td}>{f.comentario_lider || '-'}</td><td style={td}>{f.fecha_feedback_lider ? new Date(f.fecha_feedback_lider).toLocaleDateString('es-AR') : '-'}</td><td style={td}>{f.confirmacion_colaborador ? '✅ Sí' : '⏳ No'}</td></tr>))}</tbody></table>
      )}
    </div>
  );
}

function HistorialAdmin({ colaborador, onVolver }) {
  const [historicas, setHistoricas] = useState([]);
  const [cargando, setCargando] = useState(true);
  useEffect(() => { (async () => { const { data } = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false }); setHistoricas(data || []); setCargando(false); })(); }, []);
  if (cargando) return <p>Cargando...</p>;
  return (
    <div><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📋 Historial: {colaborador.full_name || colaborador.email}</h3>
      {historicas.length === 0 ? <p style={{ color: '#94a3b8', padding: 40 }}>Sin historial.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th><th style={th}>Comentarios</th></tr></thead><tbody>{historicas.map(h => (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={td}>{h.rating_final || '-'}</td><td style={td}>{h.comentarios || '-'}</td></tr>))}</tbody></table>
      )}
    </div>
  );
}

// =============================================
// PANEL LÍDER CON FEEDBACK Y VISUALIZACIÓN CONTROLADA
// =============================================
function PanelLider({ cicloId, profile }) {
  return <EquipoLider cicloId={cicloId} profile={profile} />;
}

function PanelColaboradorConEquipo({ userId, seniority, email, nombre, cicloId, profile }) {
  const [vista, setVista] = useState('autoevaluacion');
  const [tieneEquipo, setTieneEquipo] = useState(false);
  const [participa, setParticipa] = useState(false);
  const [verificando, setVerificando] = useState(true);

  useEffect(() => { (async () => { const { data: { session } } = await supabase.auth.getSession(); if (session) { const [{ count: eq }, { count: part }] = await Promise.all([supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', session.user.id), supabase.from('ciclo_colaboradores').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('colaborador_id', session.user.id)]); setTieneEquipo((eq || 0) > 0); setParticipa((part || 0) > 0); } setVerificando(false); })(); }, [cicloId]);

  if (verificando) return <p>Verificando...</p>;
  if (!participa) return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p style={{ color: '#94a3b8' }}>No estás participando en este ciclo.</p></div>;

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <button onClick={() => setVista('autoevaluacion')} style={vista === 'autoevaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluación</button>
        {tieneEquipo && <button onClick={() => setVista('equipo')} style={vista === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>}
      </div>
      {vista === 'autoevaluacion' && <PanelColaborador userId={userId} seniority={seniority} cicloId={cicloId} />}
      {vista === 'equipo' && tieneEquipo && <EquipoLider cicloId={cicloId} profile={profile} />}
    </div>
  );
}

function EquipoLider({ cicloId, profile }) {
  const [equipo, setEquipo] = useState([]);
  const [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null);
  const [feedbackVisible, setFeedbackVisible] = useState(null);
  const [calibracionVisible, setCalibracionVisible] = useState(null);

  useEffect(() => { cargarEquipo(); }, [cicloId]);

  async function cargarEquipo() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    // Obtener equipo del líder
    const { data: equipoData } = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', session.user.id);
    
    if (equipoData) {
      // Obtener evaluaciones de cada miembro para este ciclo
      const equipoConEvaluaciones = await Promise.all(equipoData.map(async (col) => {
        const { data: autoEval } = await supabase.from('evaluaciones').select('id, estado, rating_calibrado').eq('colaborador_id', col.id).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle();
        const { data: liderEval } = await supabase.from('evaluaciones').select('id, estado, rating_calibrado').eq('colaborador_id', col.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle();
        const { data: fb } = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', col.id).maybeSingle();
        return { ...col, autoevaluacion: autoEval, evaluacionLider: liderEval, feedback: fb };
      }));
      setEquipo(equipoConEvaluaciones);
    }
  }

  if (colaboradorSeleccionado) return <EvaluacionLider colaborador={colaboradorSeleccionado} cicloId={cicloId} onVolver={() => { setColaboradorSeleccionado(null); cargarEquipo(); }} />;
  if (feedbackVisible) return <FeedbackForm feedback={feedbackVisible} cicloId={cicloId} onVolver={() => { setFeedbackVisible(null); cargarEquipo(); }} />;

  return (
    <div>
      <h3 style={{ color: '#231F20', marginBottom: 20 }}>👥 Mi Equipo ({equipo.length})</h3>
      {equipo.length === 0 ? <p style={{ color: '#94a3b8' }}>No tienes colaboradores asignados.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {equipo.map(col => (
            <div key={col.id} style={{ ...s.tarjetaStat, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <h4 style={{ margin: 0, color: '#231F20' }}>{col.full_name || col.email}</h4>
                <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>{col.area} · {col.seniority}</p>
                <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
                  <span>📝 Auto: <strong style={{ color: col.autoevaluacion?.estado === 'enviado' ? '#22c55e' : '#f59e0b' }}>{col.autoevaluacion?.estado === 'enviado' ? 'Enviada' : 'Pendiente'}</strong></span>
                  <span>👥 Mi eval: <strong style={{ color: col.evaluacionLider?.estado === 'enviado' ? '#22c55e' : col.evaluacionLider ? '#f59e0b' : '#94a3b8' }}>{col.evaluacionLider?.estado === 'enviado' ? 'Completada' : col.evaluacionLider ? 'Borrador' : 'Sin evaluar'}</strong></span>
                  <span>💬 Feedback: <strong style={{ color: col.feedback?.confirmacion_colaborador ? '#22c55e' : col.feedback ? '#f59e0b' : '#94a3b8' }}>{col.feedback?.confirmacion_colaborador ? '✅ OK' : col.feedback ? '⏳ Pendiente' : 'Sin registro'}</strong></span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => setFeedbackVisible(col)} style={{ ...s.btnInfo, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>💬 Feedback</button>
                <button onClick={() => setColaboradorSeleccionado(col)} style={s.btnPrimario}>{col.evaluacionLider ? '✏️ Editar' : '📝 Evaluar'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackForm({ feedback: colaborador, cicloId, onVolver }) {
  const [feedback, setFeedback] = useState(null);
  const [comentario, setComentario] = useState('');
  const [cargando, setCargando] = useState(true);

  useEffect(() => { cargarFeedback(); }, []);

  async function cargarFeedback() {
    const { data: { session } } = await supabase.auth.getSession();
    const { data } = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', colaborador.id).maybeSingle();
    if (data) { setFeedback(data); setComentario(data.comentario_lider || ''); } 
    else { await supabase.from('feedback').insert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: colaborador.id, fecha_feedback_lider: new Date() }); }
    setCargando(false);
  }

  async function guardarFeedback() {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('feedback').upsert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: colaborador.id, comentario_lider: comentario, fecha_feedback_lider: new Date() }, { onConflict: 'ciclo_id, colaborador_id' });
    alert('✅ Feedback guardado');
    onVolver();
  }

  if (cargando) return <p>Cargando...</p>;

  return (
    <div style={{ maxWidth: 600 }}>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button>
      <h3>💬 Feedback: {colaborador.full_name || colaborador.email}</h3>
      <p style={{ color: '#64748b', marginBottom: 20 }}>{colaborador.area} · {colaborador.seniority}</p>
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 14, fontWeight: 600, display: 'block', marginBottom: 8 }}>Comentario del Líder</label>
        <textarea value={comentario} onChange={e => setComentario(e.target.value)} placeholder="Deja tu feedback sobre el desempeño del colaborador..." style={{ ...s.textarea, minHeight: 120 }} />
      </div>
      {feedback?.confirmacion_colaborador && (
        <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8, marginBottom: 16, color: '#166534', fontSize: 14 }}>
          ✅ El colaborador ya confirmó este feedback el {new Date(feedback.fecha_confirmacion).toLocaleDateString('es-AR')}
        </div>
      )}
      <button onClick={guardarFeedback} style={s.btnPrimario}>💾 Guardar Feedback</button>
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
  const [autoevaluacion, setAutoevaluacion] = useState(null);

  useEffect(() => { (async () => { const [{ data: comps }, { data: auto }, { data: { session } }] = await Promise.all([supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', colaborador.seniority || 'Analista'), supabase.from('evaluaciones').select('id, estado, puntuaciones(rating, competencia_id, comentario)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle(), supabase.auth.getSession()]); setCompetencias(comps || []); setAutoevaluacion(auto); if (auto) { const pa = {}; (auto.puntuaciones || []).forEach(p => { pa[p.competencia_id] = p.rating; }); } const { data: liderEval } = await supabase.from('evaluaciones').select('id, estado, comentarios_finales, puntuaciones(rating, competencia_id, comentario)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(); if (liderEval) { setComentariosFinales(liderEval.comentarios_finales || ''); const rm = {}; const cm = {}; (liderEval.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComentarios(cm); } else { await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador', ciclo_id: cicloId }); } setCargando(false); })(); }, []);

  async function guardar() { const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (!ev) return; await supabase.from('evaluaciones').update({ comentarios_finales: comentariosFinales }).eq('id', ev.id); for (const [compId, rating] of Object.entries(ratings)) { await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: compId, rating, comentario: comentarios[compId] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMensaje('✅ Guardado'); setTimeout(() => setMensaje(''), 2500); }
  async function enviar() { await guardar(); const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id); setMensaje('🎉 Enviada'); }

  if (cargando) return <p>Cargando...</p>;

  return (
    <div style={{ maxWidth: 900 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver al equipo</button><h3>📝 Evaluando a: {colaborador.full_name || colaborador.email}</h3><p style={{ color: '#64748b', marginBottom: 24 }}>{colaborador.area} · {colaborador.seniority}</p>
      {competencias.map(comp => (
        <div key={comp.id} style={s.competenciaCard}>
          <h5 style={{ margin: 0, color: '#231F20' }}>{comp.nombre}</h5>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 12px 0' }}>{comp.descripcion}</p>
          {autoevaluacion?.puntuaciones?.find(p => p.competencia_id === comp.id) && (
            <div style={{ padding: '8px 12px', background: '#fef3c7', borderRadius: 6, marginBottom: 8, fontSize: 13 }}>
              📝 Autoevaluación: <strong>{autoevaluacion.puntuaciones.find(p => p.competencia_id === comp.id).rating}</strong>
              {ratings[comp.id] && (
                <span style={{ marginLeft: 12, color: ratings[comp.id] > (autoevaluacion.puntuaciones.find(p => p.competencia_id === comp.id).rating) ? '#22c55e' : ratings[comp.id] < (autoevaluacion.puntuaciones.find(p => p.competencia_id === comp.id).rating) ? '#dc2626' : '#64748b' }}>
                  | Tu eval: <strong>{ratings[comp.id]}</strong> ({ratings[comp.id] - (autoevaluacion.puntuaciones.find(p => p.competencia_id === comp.id).rating) > 0 ? '+' : ''}{ratings[comp.id] - (autoevaluacion.puntuaciones.find(p => p.competencia_id === comp.id).rating)})
                </span>
              )}
            </div>
          )}
          <div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => setRatings({...ratings, [comp.id]: r})} style={{...s.ratingBtn, backgroundColor: ratings[comp.id]===r?'#231F20':'#f1f5f9', color: ratings[comp.id]===r?'white':'#475569'}}>{r}</button>)}</div>
          <textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({...comentarios, [comp.id]: e.target.value})} placeholder="Comentario" style={s.textareaSmall} />
        </div>
      ))}
      <SeccionText titulo="📝 Comentarios Finales" valor={comentariosFinales} onChange={setComentariosFinales} />
      {mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>
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
  const [evaluacionLider, setEvaluacionLider] = useState(null);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => { (async () => { const [{ data: comps }, { data: ev }, { data: liderEval }, { data: fb }] = await Promise.all([supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', seniority || 'Analista'), supabase.from('evaluaciones').select('id, estado, comentarios_finales, puntuaciones(rating, competencia_id, comentario)').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(), supabase.from('evaluaciones').select('id, rating_calibrado').eq('colaborador_id', userId).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(), supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', userId).maybeSingle()]); setCompetencias(comps || []); setEvaluacionLider(liderEval); setFeedback(fb); if (ev) { setComentariosFinales(ev.comentarios_finales || ''); const rm = {}; const cm = {}; (ev.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComentarios(cm); } else { await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador', ciclo_id: cicloId }); } setCargando(false); })(); }, []);

  async function guardar() { const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (!ev) return; await supabase.from('evaluaciones').update({ comentarios_finales: comentariosFinales }).eq('id', ev.id); for (const [compId, rating] of Object.entries(ratings)) { await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: compId, rating, comentario: comentarios[compId] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMensaje('✅ Guardado'); setTimeout(() => setMensaje(''), 2500); }
  async function enviar() { await guardar(); const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id); setMensaje('🎉 Enviada'); }

  async function confirmarFeedback() {
    await supabase.from('feedback').update({ confirmacion_colaborador: true, fecha_confirmacion: new Date() }).eq('id', feedback.id);
    setFeedback({ ...feedback, confirmacion_colaborador: true, fecha_confirmacion: new Date() });
    alert('✅ Feedback confirmado');
  }

  if (cargando) return <p>Cargando...</p>;

  return (
    <div style={{ maxWidth: 900 }}>
      <h3>📝 Mi Autoevaluación</h3>
      <p style={{ color: '#64748b', marginBottom: 4 }}>Seniority: <strong>{seniority || 'No definido'}</strong></p>
      
      {/* Feedback */}
      {feedback && (
        <div style={{ padding: 16, background: feedback.confirmacion_colaborador ? '#dcfce7' : '#fef3c7', borderRadius: 10, marginBottom: 20, border: '1px solid #D4D2C6' }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#231F20' }}>💬 Feedback de tu Líder</h4>
          {feedback.comentario_lider ? <p style={{ color: '#475569', fontSize: 14, fontStyle: 'italic' }}>"{feedback.comentario_lider}"</p> : <p style={{ color: '#94a3b8' }}>Sin comentarios aún.</p>}
          {!feedback.confirmacion_colaborador ? (
            <button onClick={confirmarFeedback} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 8, fontSize: 13 }}>✅ Confirmar Feedback Recibido</button>
          ) : (
            <p style={{ color: '#166534', fontSize: 13, marginTop: 8 }}>✅ Confirmado el {new Date(feedback.fecha_confirmacion).toLocaleDateString('es-AR')}</p>
          )}
        </div>
      )}

      {/* Evaluación del líder (solo visible si está calibrada) */}
      {evaluacionLider?.rating_calibrado && (
        <div style={{ padding: 16, background: '#D4D2C6', borderRadius: 10, marginBottom: 20, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#231F20', margin: 0 }}>🎯 Resultado Final Calibrado</p>
          <p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{evaluacionLider.rating_calibrado}</p>
        </div>
      )}

      {competencias.map(comp => (
        <div key={comp.id} style={s.competenciaCard}>
          <h5 style={{ margin: 0, color: '#231F20' }}>{comp.nombre}</h5>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 12px 0' }}>{comp.descripcion}</p>
          <div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => setRatings({...ratings, [comp.id]: r})} style={{...s.ratingBtn, backgroundColor: ratings[comp.id]===r?'#231F20':'#f1f5f9', color: ratings[comp.id]===r?'white':'#475569'}}>{r}</button>)}</div>
          <textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({...comentarios, [comp.id]: e.target.value})} placeholder="Comentario" style={s.textareaSmall} />
        </div>
      ))}
      <SeccionText titulo="📝 Comentarios Finales" valor={comentariosFinales} onChange={setComentariosFinales} />
      {mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>
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
  tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
  seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#231F20', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #D4D2C6' },
  competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14, border: '1px solid #e2e8f0' },
  btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 },
  ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' },
  ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' },
  textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' },
  btnPrimario: { padding: '12px 24px', background: '#231F20', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  btnSecundario: { padding: '12px 24px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  mensajeToast: { padding: '12px 20px', background: '#D4D2C6', borderRadius: 8, marginBottom: 16, color: '#231F20', fontWeight: 500, fontSize: 14, textAlign: 'center', border: '1px solid #231F20' },
};
