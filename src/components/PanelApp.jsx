import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';

export default function PanelApp() {
  var [profile, setProfile] = useState(null);
  var [loading, setLoading] = useState(true);
  var [menuActivo, setMenuActivo] = useState('desempeno');
  var [cicloActivo, setCicloActivo] = useState(null);

  useEffect(function() { cargarPerfil(); }, []);

  async function cargarPerfil() {
    var { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    var { data: perfil } = await supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo, leader_id').eq('id', session.user.id).single();
    if (perfil && perfil.activo === false) { await supabase.auth.signOut(); alert('Cuenta desactivada.'); window.location.href = '/'; return; }
    setProfile(perfil); setLoading(false);
  }

  async function cerrarSesion() { await supabase.auth.signOut(); window.location.href = '/'; }

  if (loading) return <div style={s.centrado}><p>Cargando...</p></div>;
  if (!profile) return <div style={s.centrado}><h2>Error</h2><button onClick={cerrarSesion} style={s.btnSalir}>Volver</button></div>;

  var nombreRol = profile.role === 'admin_rrhh' ? 'Admin RRHH' : profile.role === 'lider' ? 'Lider' : 'Colaborador';
  var emojiRol = profile.role === 'admin_rrhh' ? '🔧' : profile.role === 'lider' ? '👥' : '👤';
  var esSuperAdmin = profile.email === 'florencia.salvaneschi@grupo-fabric.com' || profile.email === 'adrian.galvan@grupo-fabric.com';
  var esGerente = profile.seniority === 'Gerente';
  var tieneEquipo = profile.role === 'admin_rrhh' || profile.role === 'lider' || esGerente;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle.aside}>
        <div style={sidebarStyle.logoContainer}><img src="/logo.jpg" alt="Fabric Group" style={{ height: '40px' }} /></div>
        <nav style={sidebarStyle.nav}>
          <button onClick={function() { setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' }}>📊 DESEMPENO</button>
          <button onClick={function() { setMenuActivo(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj' ? '' : 'objetivos'); }} style={{ ...sidebarStyle.menuItem, background: (menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '#D4D2C6' : 'transparent', color: (menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '#231F20' : '#D4D2C6' }}>🎯 OBJETIVOS {(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '▼' : '▶'}</button>
          {(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') && (
            <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={function() { setMenuActivo('misobjetivos'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'misobjetivos' ? '#D4D2C6' : 'transparent', color: menuActivo === 'misobjetivos' ? '#231F20' : '#D4D2C6' }}>🎯 Mis Objetivos</button>
              {tieneEquipo && <button onClick={function() { setMenuActivo('miequipo_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'miequipo_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'miequipo_obj' ? '#231F20' : '#D4D2C6' }}>👥 Mi Equipo</button>}
              {(profile.role === 'admin_rrhh' || esGerente) && <button onClick={function() { setMenuActivo('compania_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'compania_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'compania_obj' ? '#231F20' : '#D4D2C6' }}>🏢 Compañia</button>}
              {esSuperAdmin && <button onClick={function() { setMenuActivo('admin_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'admin_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'admin_obj' ? '#231F20' : '#D4D2C6', fontWeight: 600 }}>🔧 Panel Admin</button>}
            </div>
          )}
        </nav>
        <div style={sidebarStyle.footer}><span style={{ fontSize: 12, color: '#D4D2C6' }}>{profile.email}</span><button onClick={cerrarSesion} style={{ ...s.btnSalir, marginTop: 8, width: '100%' }}>Cerrar Sesion</button></div>
      </aside>
      <div style={{ flex: 1, background: '#f8fafc', minHeight: '100vh' }}>
        <header style={s.header}><h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1><span style={s.badge}>{emojiRol} {nombreRol}</span></header>
        <main style={{ padding: 24 }}>
          {menuActivo === 'desempeno' && <DesempenoView profile={profile} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
          {menuActivo === 'misobjetivos' && <ObjetivosColaborador profile={profile} />}
          {menuActivo === 'miequipo_obj' && <ObjetivosGerente profile={profile} />}
          {menuActivo === 'compania_obj' && <PlaceholderView titulo="🏢 Objetivos de la Compañia" descripcion="Modulo en desarrollo." />}
          {menuActivo === 'admin_obj' && <PanelAdminObjetivos profile={profile} />}
        </main>
      </div>
    </div>
  );
}

function PlaceholderView({ titulo, descripcion }) { return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}><h2>{titulo}</h2><p>{descripcion}</p></div>; }

function DesempenoView({ profile, cicloActivo, setCicloActivo }) {
  var esAdmin = profile.role === 'admin_rrhh';
  var esGerente = profile.seniority === 'Gerente';
  if (!cicloActivo) return <CiclosLista esAdmin={esAdmin} onSelectCiclo={setCicloActivo} profile={profile} />;
  var soloLectura = cicloActivo.estado === 'cerrado' && !esAdmin;
  return (
    <div>
      <button onClick={function() { setCicloActivo(null); }} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver a Ciclos</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <h2 style={{ color: '#231F20', margin: 0 }}>📊 {cicloActivo.nombre}</h2>
        <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: cicloActivo.estado === 'activo' ? '#dcfce7' : '#fee2e2', color: cicloActivo.estado === 'activo' ? '#166534' : '#dc2626' }}>{cicloActivo.estado === 'activo' ? '✅ Abierto' : '🔒 Cerrado'}</span>
      </div>
      <p style={{ color: '#64748b', marginBottom: 8 }}>{new Date(cicloActivo.fecha_inicio).toLocaleDateString('es-AR')}{cicloActivo.fecha_fin ? ' - ' + new Date(cicloActivo.fecha_fin).toLocaleDateString('es-AR') : ''}</p>
      {soloLectura && <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, marginBottom: 16, color: '#92400e', fontSize: 14, textAlign: 'center' }}>🔒 Este ciclo esta cerrado. Solo puedes ver la informacion en modo lectura.</div>}
      {esAdmin && <PanelAdminConEquipo profile={profile} cicloId={cicloActivo.id} tieneAutoevaluacion={!esGerente} cicloEstado={cicloActivo.estado} />}
      {!esAdmin && esGerente && <EquipoLider cicloId={cicloActivo.id} profile={profile} soloLectura={soloLectura} />}
      {!esAdmin && !esGerente && profile.role === 'lider' && <PanelLiderConAutoevaluacion cicloId={cicloActivo.id} profile={profile} soloLectura={soloLectura} />}
      {!esAdmin && !esGerente && profile.role !== 'lider' && <PanelColaboradorConEquipo userId={profile.id} seniority={profile.seniority} cicloId={cicloActivo.id} profile={profile} soloLectura={soloLectura} />}
    </div>
  );
}

function CiclosLista({ esAdmin, onSelectCiclo, profile }) {
  var [ciclos, setCiclos] = useState([]); var [carg, setCarg] = useState(true); var [showC, setShowC] = useState(false);
  var [nom, setNom] = useState(''); var [fIni, setFIni] = useState(''); var [fFin, setFFin] = useState('');
  var [cGestion, setCGestion] = useState(null); var [todos, setTodos] = useState([]); var [parts, setParts] = useState([]);
  var esSuperAdmin = profile && (profile.email === 'florencia.salvaneschi@grupo-fabric.com' || profile.email === 'adrian.galvan@grupo-fabric.com');

  useEffect(function() { cargarCiclos(); if (esAdmin) cargarColabs(); }, []);
  async function cargarCiclos() { var { data } = await supabase.from('ciclos').select('*').order('fecha_inicio', { ascending: false }); setCiclos(data || []); setCarg(false); }
  async function cargarColabs() { var { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority').neq('role', 'admin_rrhh').eq('activo', true); setTodos(data || []); }
  async function crearCiclo() { if (!nom || !fIni) return alert('Nombre y fecha obligatorios'); await supabase.from('ciclos').insert({ nombre: nom, fecha_inicio: fIni, fecha_fin: fFin || null, estado: 'activo' }); setNom(''); setFIni(''); setFFin(''); setShowC(false); cargarCiclos(); }
  async function toggleCiclo(ciclo) { var nuevo = ciclo.estado === 'activo' ? 'cerrado' : 'activo'; await supabase.from('ciclos').update({ estado: nuevo }).eq('id', ciclo.id); cargarCiclos(); }
  async function abrirGestion(ciclo) { setCGestion(ciclo.id); var { data } = await supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', ciclo.id); setParts((data || []).map(function(p) { return p.colaborador_id; })); }
  async function togglePart(cid) { if (parts.includes(cid)) { await supabase.from('ciclo_colaboradores').delete().eq('ciclo_id', cGestion).eq('colaborador_id', cid); setParts(function(p) { return p.filter(function(id) { return id !== cid; }); }); } else { await supabase.from('ciclo_colaboradores').insert({ ciclo_id: cGestion, colaborador_id: cid }); setParts(function(p) { return [...p, cid]; }); } }
  if (carg) return <p>Cargando ciclos...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2 style={{ color: '#231F20', margin: 0 }}>📊 Ciclos de Evaluacion</h2>{esAdmin && <button onClick={function() { setShowC(!showC); }} style={s.btnPrimario}>+ Nuevo Ciclo</button>}</div>
      {showC && <div style={{ ...s.tarjetaStat, marginBottom: 20 }}><h4>Crear Nuevo Ciclo</h4><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}><div><label>Nombre</label><input value={nom} onChange={function(e) { setNom(e.target.value); }} placeholder="Ej: 1er Semestre 2025" style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', width: 200 }} /></div><div><label>Fecha Inicio</label><input type="date" value={fIni} onChange={function(e) { setFIni(e.target.value); }} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div><div><label>Fecha Fin</label><input type="date" value={fFin} onChange={function(e) { setFFin(e.target.value); }} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div><button onClick={crearCiclo} style={{ ...s.btnPrimario, background: '#22c55e', alignSelf: 'flex-end' }}>Crear</button></div></div>}
      {cGestion && <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><h4>👥 Seleccionar Participantes</h4><button onClick={function() { setCGestion(null); }} style={s.btnInfo}>✕</button></div><p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{parts.length} colaboradores seleccionados</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>{todos.map(function(c) { return (<div key={c.id} onClick={function() { togglePart(c.id); }} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: parts.includes(c.id) ? '#231F20' : 'white', color: parts.includes(c.id) ? '#D4D2C6' : '#231F20', border: '1px solid #D4D2C6' }}><div><strong style={{ fontSize: 13 }}>{c.full_name || c.email}</strong><p style={{ fontSize: 11, margin: 0, opacity: 0.7 }}>{c.area} · {c.seniority}</p></div><span>{parts.includes(c.id) ? '✅' : '○'}</span></div>); })}</div></div>}
      {ciclos.length === 0 ? <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p style={{ color: '#94a3b8' }}>No hay ciclos creados.</p></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {ciclos.map(function(ciclo) { return (
            <div key={ciclo.id} style={{ ...s.tarjetaStat, border: '2px solid #D4D2C6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h3 style={{ color: '#231F20', margin: 0, fontSize: 18 }}>{ciclo.nombre}</h3>
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ciclo.estado === 'activo' ? '#dcfce7' : '#fee2e2', color: ciclo.estado === 'activo' ? '#166534' : '#dc2626' }}>{ciclo.estado === 'activo' ? '✅ Abierto' : '🔒 Cerrado'}</span>
              </div>
              <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>📅 Inicio: {new Date(ciclo.fecha_inicio).toLocaleDateString('es-AR')}</p>
              {ciclo.fecha_fin && <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>📅 Fin: {new Date(ciclo.fecha_fin).toLocaleDateString('es-AR')}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button onClick={function() { onSelectCiclo(ciclo); }} style={{ ...s.btnPrimario, flex: 1 }}>{ciclo.estado === 'cerrado' && !esAdmin ? '👁️ Ver' : 'Entrar'}</button>
                {esAdmin && <button onClick={function() { abrirGestion(ciclo); }} style={s.btnSecundario}>👥</button>}
                {esSuperAdmin && <button onClick={function() { toggleCiclo(ciclo); }} style={{ ...s.btnSecundario, background: ciclo.estado === 'activo' ? '#fee2e2' : '#dcfce7', color: ciclo.estado === 'activo' ? '#dc2626' : '#166534', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{ciclo.estado === 'activo' ? '🔒 Cerrar' : '🔓 Abrir'}</button>}
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}

function PanelLiderConAutoevaluacion({ cicloId, profile, soloLectura }) { var [v, setV] = useState('equipo'); return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={function() { setV('equipo'); }} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button><button onClick={function() { setV('mievaluacion'); }} style={v === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluacion</button></div>{v === 'equipo' ? <EquipoLider cicloId={cicloId} profile={profile} soloLectura={soloLectura} /> : <PanelColaborador userId={profile.id} seniority={profile.seniority} cicloId={cicloId} soloLectura={soloLectura} />}</div>; }

function PanelAdminConEquipo({ profile, cicloId, tieneAutoevaluacion, cicloEstado }) {
  var [vista, setVista] = useState('dashboard'); var [stats, setStats] = useState({ total: 0, enviadas: 0, pendientes: 0 }); var [colabs, setColabs] = useState([]); var [hist, setHist] = useState(null);
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() { var [{ count: t }, { count: e }, { data: p }, { data: f }] = await Promise.all([supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId), supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('estado', 'enviado'), supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', cicloId), supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo').neq('role', 'admin_rrhh')]); var ids = (p || []).map(function(x) { return x.colaborador_id; }); setColabs((f || []).filter(function(c) { return ids.includes(c.id); })); setStats({ total: t || 0, enviadas: e || 0, pendientes: (t || 0) - (e || 0) }); }
  if (hist) return <HistorialAdmin colaborador={hist} onVolver={function() { setHist(null); }} />;
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={function() { setVista('dashboard'); }} style={vista === 'dashboard' ? s.btnPrimario : s.btnInfo}>📊 Dashboard</button>
        <button onClick={function() { setVista('evaluaciones'); }} style={vista === 'evaluaciones' ? s.btnPrimario : s.btnInfo}>📋 Evaluaciones</button>
        <button onClick={function() { setVista('calibracion'); }} style={vista === 'calibracion' ? s.btnPrimario : s.btnInfo}>🎯 Calibracion</button>
        <button onClick={function() { setVista('feedback'); }} style={vista === 'feedback' ? s.btnPrimario : s.btnInfo}>💬 Feedback</button>
        <button onClick={function() { setVista('equipo'); }} style={vista === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>
        {tieneAutoevaluacion && <button onClick={function() { setVista('mievaluacion'); }} style={vista === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluacion</button>}
        <button onClick={function() { setVista('colaboradores'); }} style={vista === 'colaboradores' ? s.btnPrimario : s.btnInfo}>👥 Participantes</button>
      </div>
      {vista === 'dashboard' && <DashboardView stats={stats} colabs={colabs} />}
      {vista === 'evaluaciones' && <EvaluacionesAdmin cicloId={cicloId} />}
      {vista === 'calibracion' && <PanelCalibracion cicloId={cicloId} colabs={colabs} onHist={setHist} soloLectura={cicloEstado === 'cerrado'} />}
      {vista === 'feedback' && <FeedbackAdmin cicloId={cicloId} />}
      {vista === 'equipo' && <EquipoLider cicloId={cicloId} profile={profile} soloLectura={false} />}
      {vista === 'mievaluacion' && tieneAutoevaluacion && <PanelColaborador userId={profile.id} seniority={profile.seniority} cicloId={cicloId} soloLectura={false} />}
      {vista === 'colaboradores' && <ParticipantesView colabs={colabs} />}
    </div>
  );
}

function PanelColaboradorConEquipo({ userId, seniority, cicloId, profile, soloLectura }) {
  var [v, setV] = useState('autoevaluacion'); var [tieneEq, setTieneEq] = useState(false); var [part, setPart] = useState(false); var [verif, setVerif] = useState(true);
  useEffect(function() { (async function() { var { data: { session } } = await supabase.auth.getSession(); if (session) { var [{ count: e }, { count: p }] = await Promise.all([supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', session.user.id), supabase.from('ciclo_colaboradores').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('colaborador_id', session.user.id)]); setTieneEq((e || 0) > 0); setPart((p || 0) > 0); } setVerif(false); })(); }, [cicloId]);
  if (verif) return <p>Verificando...</p>; if (!part) return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p>No estas participando en este ciclo.</p></div>;
  return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={function() { setV('autoevaluacion'); }} style={v === 'autoevaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluacion</button>{tieneEq && <button onClick={function() { setV('equipo'); }} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>}</div>{v === 'autoevaluacion' ? <PanelColaborador userId={userId} seniority={seniority} cicloId={cicloId} soloLectura={soloLectura} /> : <EquipoLider cicloId={cicloId} profile={profile} soloLectura={soloLectura} />}</div>;
}
export default function PanelApp() {
  var [profile, setProfile] = useState(null);
  var [loading, setLoading] = useState(true);
  var [menuActivo, setMenuActivo] = useState('desempeno');
  var [cicloActivo, setCicloActivo] = useState(null);

  useEffect(function() { cargarPerfil(); }, []);

  async function cargarPerfil() {
    var { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    var { data: perfil } = await supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo, leader_id').eq('id', session.user.id).single();
    if (perfil && perfil.activo === false) { await supabase.auth.signOut(); alert('Cuenta desactivada.'); window.location.href = '/'; return; }
    setProfile(perfil); setLoading(false);
  }

  async function cerrarSesion() { await supabase.auth.signOut(); window.location.href = '/'; }

  if (loading) return <div style={s.centrado}><p>Cargando...</p></div>;
  if (!profile) return <div style={s.centrado}><h2>Error</h2><button onClick={cerrarSesion} style={s.btnSalir}>Volver</button></div>;

  var nombreRol = profile.role === 'admin_rrhh' ? 'Admin RRHH' : profile.role === 'lider' ? 'Lider' : 'Colaborador';
  var emojiRol = profile.role === 'admin_rrhh' ? '🔧' : profile.role === 'lider' ? '👥' : '👤';
  var esSuperAdmin = profile.email === 'florencia.salvaneschi@grupo-fabric.com' || profile.email === 'adrian.galvan@grupo-fabric.com';
  var esGerente = profile.seniority === 'Gerente';
  var tieneEquipo = profile.role === 'admin_rrhh' || profile.role === 'lider' || esGerente;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle.aside}>
        <div style={sidebarStyle.logoContainer}><img src="/logo.jpg" alt="Fabric Group" style={{ height: '40px' }} /></div>
        <nav style={sidebarStyle.nav}>
          <button onClick={function() { setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' }}>📊 DESEMPENO</button>
          <button onClick={function() { setMenuActivo(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj' ? '' : 'objetivos'); }} style={{ ...sidebarStyle.menuItem, background: (menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '#D4D2C6' : 'transparent', color: (menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '#231F20' : '#D4D2C6' }}>🎯 OBJETIVOS {(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '▼' : '▶'}</button>
          {(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') && (
            <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={function() { setMenuActivo('misobjetivos'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'misobjetivos' ? '#D4D2C6' : 'transparent', color: menuActivo === 'misobjetivos' ? '#231F20' : '#D4D2C6' }}>🎯 Mis Objetivos</button>
              {tieneEquipo && <button onClick={function() { setMenuActivo('miequipo_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'miequipo_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'miequipo_obj' ? '#231F20' : '#D4D2C6' }}>👥 Mi Equipo</button>}
              {(profile.role === 'admin_rrhh' || esGerente) && <button onClick={function() { setMenuActivo('compania_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'compania_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'compania_obj' ? '#231F20' : '#D4D2C6' }}>🏢 Compañia</button>}
              {esSuperAdmin && <button onClick={function() { setMenuActivo('admin_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'admin_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'admin_obj' ? '#231F20' : '#D4D2C6', fontWeight: 600 }}>🔧 Panel Admin</button>}
            </div>
          )}
        </nav>
        <div style={sidebarStyle.footer}><span style={{ fontSize: 12, color: '#D4D2C6' }}>{profile.email}</span><button onClick={cerrarSesion} style={{ ...s.btnSalir, marginTop: 8, width: '100%' }}>Cerrar Sesion</button></div>
      </aside>
      <div style={{ flex: 1, background: '#f8fafc', minHeight: '100vh' }}>
        <header style={s.header}><h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1><span style={s.badge}>{emojiRol} {nombreRol}</span></header>
        <main style={{ padding: 24 }}>
          {menuActivo === 'desempeno' && <DesempenoView profile={profile} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
          {menuActivo === 'misobjetivos' && <ObjetivosColaborador profile={profile} />}
          {menuActivo === 'miequipo_obj' && <ObjetivosGerente profile={profile} />}
          {menuActivo === 'compania_obj' && <PlaceholderView titulo="🏢 Objetivos de la Compañia" descripcion="Modulo en desarrollo." />}
          {menuActivo === 'admin_obj' && <PanelAdminObjetivos profile={profile} />}
        </main>
      </div>
    </div>
  );
}

function PlaceholderView({ titulo, descripcion }) { return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}><h2>{titulo}</h2><p>{descripcion}</p></div>; }

function DesempenoView({ profile, cicloActivo, setCicloActivo }) {
  var esAdmin = profile.role === 'admin_rrhh';
  var esGerente = profile.seniority === 'Gerente';
  if (!cicloActivo) return <CiclosLista esAdmin={esAdmin} onSelectCiclo={setCicloActivo} profile={profile} />;
  var soloLectura = cicloActivo.estado === 'cerrado' && !esAdmin;
  return (
    <div>
      <button onClick={function() { setCicloActivo(null); }} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver a Ciclos</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
        <h2 style={{ color: '#231F20', margin: 0 }}>📊 {cicloActivo.nombre}</h2>
        <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: cicloActivo.estado === 'activo' ? '#dcfce7' : '#fee2e2', color: cicloActivo.estado === 'activo' ? '#166534' : '#dc2626' }}>{cicloActivo.estado === 'activo' ? '✅ Abierto' : '🔒 Cerrado'}</span>
      </div>
      <p style={{ color: '#64748b', marginBottom: 8 }}>{new Date(cicloActivo.fecha_inicio).toLocaleDateString('es-AR')}{cicloActivo.fecha_fin ? ' - ' + new Date(cicloActivo.fecha_fin).toLocaleDateString('es-AR') : ''}</p>
      {soloLectura && <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, marginBottom: 16, color: '#92400e', fontSize: 14, textAlign: 'center' }}>🔒 Este ciclo esta cerrado. Solo puedes ver la informacion en modo lectura.</div>}
      {esAdmin && <PanelAdminConEquipo profile={profile} cicloId={cicloActivo.id} tieneAutoevaluacion={!esGerente} cicloEstado={cicloActivo.estado} />}
      {!esAdmin && esGerente && <EquipoLider cicloId={cicloActivo.id} profile={profile} soloLectura={soloLectura} />}
      {!esAdmin && !esGerente && profile.role === 'lider' && <PanelLiderConAutoevaluacion cicloId={cicloActivo.id} profile={profile} soloLectura={soloLectura} />}
      {!esAdmin && !esGerente && profile.role !== 'lider' && <PanelColaboradorConEquipo userId={profile.id} seniority={profile.seniority} cicloId={cicloActivo.id} profile={profile} soloLectura={soloLectura} />}
    </div>
  );
}

function CiclosLista({ esAdmin, onSelectCiclo, profile }) {
  var [ciclos, setCiclos] = useState([]); var [carg, setCarg] = useState(true); var [showC, setShowC] = useState(false);
  var [nom, setNom] = useState(''); var [fIni, setFIni] = useState(''); var [fFin, setFFin] = useState('');
  var [cGestion, setCGestion] = useState(null); var [todos, setTodos] = useState([]); var [parts, setParts] = useState([]);
  var esSuperAdmin = profile && (profile.email === 'florencia.salvaneschi@grupo-fabric.com' || profile.email === 'adrian.galvan@grupo-fabric.com');

  useEffect(function() { cargarCiclos(); if (esAdmin) cargarColabs(); }, []);
  async function cargarCiclos() { var { data } = await supabase.from('ciclos').select('*').order('fecha_inicio', { ascending: false }); setCiclos(data || []); setCarg(false); }
  async function cargarColabs() { var { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority').neq('role', 'admin_rrhh').eq('activo', true); setTodos(data || []); }
  async function crearCiclo() { if (!nom || !fIni) return alert('Nombre y fecha obligatorios'); await supabase.from('ciclos').insert({ nombre: nom, fecha_inicio: fIni, fecha_fin: fFin || null, estado: 'activo' }); setNom(''); setFIni(''); setFFin(''); setShowC(false); cargarCiclos(); }
  async function toggleCiclo(ciclo) { var nuevo = ciclo.estado === 'activo' ? 'cerrado' : 'activo'; await supabase.from('ciclos').update({ estado: nuevo }).eq('id', ciclo.id); cargarCiclos(); }
  async function abrirGestion(ciclo) { setCGestion(ciclo.id); var { data } = await supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', ciclo.id); setParts((data || []).map(function(p) { return p.colaborador_id; })); }
  async function togglePart(cid) { if (parts.includes(cid)) { await supabase.from('ciclo_colaboradores').delete().eq('ciclo_id', cGestion).eq('colaborador_id', cid); setParts(function(p) { return p.filter(function(id) { return id !== cid; }); }); } else { await supabase.from('ciclo_colaboradores').insert({ ciclo_id: cGestion, colaborador_id: cid }); setParts(function(p) { return [...p, cid]; }); } }
  if (carg) return <p>Cargando ciclos...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2 style={{ color: '#231F20', margin: 0 }}>📊 Ciclos de Evaluacion</h2>{esAdmin && <button onClick={function() { setShowC(!showC); }} style={s.btnPrimario}>+ Nuevo Ciclo</button>}</div>
      {showC && <div style={{ ...s.tarjetaStat, marginBottom: 20 }}><h4>Crear Nuevo Ciclo</h4><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}><div><label>Nombre</label><input value={nom} onChange={function(e) { setNom(e.target.value); }} placeholder="Ej: 1er Semestre 2025" style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', width: 200 }} /></div><div><label>Fecha Inicio</label><input type="date" value={fIni} onChange={function(e) { setFIni(e.target.value); }} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div><div><label>Fecha Fin</label><input type="date" value={fFin} onChange={function(e) { setFFin(e.target.value); }} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div><button onClick={crearCiclo} style={{ ...s.btnPrimario, background: '#22c55e', alignSelf: 'flex-end' }}>Crear</button></div></div>}
      {cGestion && <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><h4>👥 Seleccionar Participantes</h4><button onClick={function() { setCGestion(null); }} style={s.btnInfo}>✕</button></div><p style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>{parts.length} colaboradores seleccionados</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>{todos.map(function(c) { return (<div key={c.id} onClick={function() { togglePart(c.id); }} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: parts.includes(c.id) ? '#231F20' : 'white', color: parts.includes(c.id) ? '#D4D2C6' : '#231F20', border: '1px solid #D4D2C6' }}><div><strong style={{ fontSize: 13 }}>{c.full_name || c.email}</strong><p style={{ fontSize: 11, margin: 0, opacity: 0.7 }}>{c.area} · {c.seniority}</p></div><span>{parts.includes(c.id) ? '✅' : '○'}</span></div>); })}</div></div>}
      {ciclos.length === 0 ? <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p style={{ color: '#94a3b8' }}>No hay ciclos creados.</p></div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
          {ciclos.map(function(ciclo) { return (
            <div key={ciclo.id} style={{ ...s.tarjetaStat, border: '2px solid #D4D2C6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h3 style={{ color: '#231F20', margin: 0, fontSize: 18 }}>{ciclo.nombre}</h3>
                <span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ciclo.estado === 'activo' ? '#dcfce7' : '#fee2e2', color: ciclo.estado === 'activo' ? '#166534' : '#dc2626' }}>{ciclo.estado === 'activo' ? '✅ Abierto' : '🔒 Cerrado'}</span>
              </div>
              <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>📅 Inicio: {new Date(ciclo.fecha_inicio).toLocaleDateString('es-AR')}</p>
              {ciclo.fecha_fin && <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>📅 Fin: {new Date(ciclo.fecha_fin).toLocaleDateString('es-AR')}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <button onClick={function() { onSelectCiclo(ciclo); }} style={{ ...s.btnPrimario, flex: 1 }}>{ciclo.estado === 'cerrado' && !esAdmin ? '👁️ Ver' : 'Entrar'}</button>
                {esAdmin && <button onClick={function() { abrirGestion(ciclo); }} style={s.btnSecundario}>👥</button>}
                {esSuperAdmin && <button onClick={function() { toggleCiclo(ciclo); }} style={{ ...s.btnSecundario, background: ciclo.estado === 'activo' ? '#fee2e2' : '#dcfce7', color: ciclo.estado === 'activo' ? '#dc2626' : '#166534', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap' }}>{ciclo.estado === 'activo' ? '🔒 Cerrar' : '🔓 Abrir'}</button>}
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}

function PanelLiderConAutoevaluacion({ cicloId, profile, soloLectura }) { var [v, setV] = useState('equipo'); return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={function() { setV('equipo'); }} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button><button onClick={function() { setV('mievaluacion'); }} style={v === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluacion</button></div>{v === 'equipo' ? <EquipoLider cicloId={cicloId} profile={profile} soloLectura={soloLectura} /> : <PanelColaborador userId={profile.id} seniority={profile.seniority} cicloId={cicloId} soloLectura={soloLectura} />}</div>; }

function PanelAdminConEquipo({ profile, cicloId, tieneAutoevaluacion, cicloEstado }) {
  var [vista, setVista] = useState('dashboard'); var [stats, setStats] = useState({ total: 0, enviadas: 0, pendientes: 0 }); var [colabs, setColabs] = useState([]); var [hist, setHist] = useState(null);
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() { var [{ count: t }, { count: e }, { data: p }, { data: f }] = await Promise.all([supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId), supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('estado', 'enviado'), supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', cicloId), supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo').neq('role', 'admin_rrhh')]); var ids = (p || []).map(function(x) { return x.colaborador_id; }); setColabs((f || []).filter(function(c) { return ids.includes(c.id); })); setStats({ total: t || 0, enviadas: e || 0, pendientes: (t || 0) - (e || 0) }); }
  if (hist) return <HistorialAdmin colaborador={hist} onVolver={function() { setHist(null); }} />;
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={function() { setVista('dashboard'); }} style={vista === 'dashboard' ? s.btnPrimario : s.btnInfo}>📊 Dashboard</button>
        <button onClick={function() { setVista('evaluaciones'); }} style={vista === 'evaluaciones' ? s.btnPrimario : s.btnInfo}>📋 Evaluaciones</button>
        <button onClick={function() { setVista('calibracion'); }} style={vista === 'calibracion' ? s.btnPrimario : s.btnInfo}>🎯 Calibracion</button>
        <button onClick={function() { setVista('feedback'); }} style={vista === 'feedback' ? s.btnPrimario : s.btnInfo}>💬 Feedback</button>
        <button onClick={function() { setVista('equipo'); }} style={vista === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>
        {tieneAutoevaluacion && <button onClick={function() { setVista('mievaluacion'); }} style={vista === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluacion</button>}
        <button onClick={function() { setVista('colaboradores'); }} style={vista === 'colaboradores' ? s.btnPrimario : s.btnInfo}>👥 Participantes</button>
      </div>
      {vista === 'dashboard' && <DashboardView stats={stats} colabs={colabs} />}
      {vista === 'evaluaciones' && <EvaluacionesAdmin cicloId={cicloId} />}
      {vista === 'calibracion' && <PanelCalibracion cicloId={cicloId} colabs={colabs} onHist={setHist} soloLectura={cicloEstado === 'cerrado'} />}
      {vista === 'feedback' && <FeedbackAdmin cicloId={cicloId} />}
      {vista === 'equipo' && <EquipoLider cicloId={cicloId} profile={profile} soloLectura={false} />}
      {vista === 'mievaluacion' && tieneAutoevaluacion && <PanelColaborador userId={profile.id} seniority={profile.seniority} cicloId={cicloId} soloLectura={false} />}
      {vista === 'colaboradores' && <ParticipantesView colabs={colabs} />}
    </div>
  );
}

function PanelColaboradorConEquipo({ userId, seniority, cicloId, profile, soloLectura }) {
  var [v, setV] = useState('autoevaluacion'); var [tieneEq, setTieneEq] = useState(false); var [part, setPart] = useState(false); var [verif, setVerif] = useState(true);
  useEffect(function() { (async function() { var { data: { session } } = await supabase.auth.getSession(); if (session) { var [{ count: e }, { count: p }] = await Promise.all([supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', session.user.id), supabase.from('ciclo_colaboradores').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('colaborador_id', session.user.id)]); setTieneEq((e || 0) > 0); setPart((p || 0) > 0); } setVerif(false); })(); }, [cicloId]);
  if (verif) return <p>Verificando...</p>; if (!part) return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p>No estas participando en este ciclo.</p></div>;
  return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={function() { setV('autoevaluacion'); }} style={v === 'autoevaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluacion</button>{tieneEq && <button onClick={function() { setV('equipo'); }} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>}</div>{v === 'autoevaluacion' ? <PanelColaborador userId={userId} seniority={seniority} cicloId={cicloId} soloLectura={soloLectura} /> : <EquipoLider cicloId={cicloId} profile={profile} soloLectura={soloLectura} />}</div>;
}
function DashboardView({ stats, colabs }) {
  return (
    <div>
      <div style={s.grid}>
        <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>👥 Participantes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{colabs.length}</p></div>
        <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>📋 Evaluaciones</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.total}</p></div>
        <div style={{ ...s.tarjetaStat, borderTop: '4px solid #231F20' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.enviadas}</p></div>
        <div style={{ ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.pendientes}</p></div>
      </div>
    </div>
  );
}

function ParticipantesView({ colabs }) {
  return (
    <div style={s.tarjetaStat}>
      <h4>👥 Participantes ({colabs.length})</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Area</th><th style={th}>Seniority</th></tr></thead>
        <tbody>{colabs.map(function(c) { return (<tr key={c.id}><td style={td}>{c.full_name || '-'}</td><td style={td}>{c.email}</td><td style={td}>{c.area || '-'}</td><td style={td}>{c.seniority || '-'}</td></tr>); })}</tbody>
      </table>
    </div>
  );
}

function EvaluacionesAdmin({ cicloId }) {
  var [evs, setEvs] = useState([]); var [carg, setCarg] = useState(true);
  useEffect(function() { (async function() { var { data } = await supabase.from('evaluaciones').select('id,colaborador_id,tipo_evaluacion,estado,rating_promedio,rating_calibrado,created_at,colaborador:colaborador_id(email,full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setEvs(data || []); setCarg(false); })(); }, [cicloId]);
  if (carg) return <p>Cargando...</p>;
  return (
    <div style={s.tarjetaStat}>
      <h4>📋 Evaluaciones ({evs.length})</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Colaborador</th><th style={th}>Tipo</th><th style={th}>Estado</th><th style={th}>Rating</th><th style={th}>Calibrado</th><th style={th}>Fecha</th></tr></thead>
        <tbody>{evs.map(function(ev) { return (<tr key={ev.id}><td style={td}>{ev.colaborador?.full_name || '-'}</td><td style={td}>{ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Lider'}</td><td style={td}>{ev.estado}</td><td style={{ ...td, fontWeight: 700 }}>{ev.rating_promedio || '-'}</td><td style={td}>{ev.rating_calibrado || '-'}</td><td style={td}>{new Date(ev.created_at).toLocaleDateString('es-AR')}</td></tr>); })}</tbody>
      </table>
    </div>
  );
}

function PanelCalibracion({ cicloId, colabs, onHist, soloLectura }) {
  var [datos, setDatos] = useState([]); var [carg, setCarg] = useState(true); var [filtro, setFiltro] = useState('Todas');
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() {
    setCarg(true);
    var { data: evs } = await supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, evaluador_id, rating_promedio, rating_calibrado, comentario_calibracion, puntuaciones(rating, competencia_id, comentario, competencias(nombre)), colaborador:colaborador_id(id, email, full_name, area, seniority)').eq('ciclo_id', cicloId).in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']);
    var mapa = {};
    (evs || []).forEach(function(ev) {
      if (!ev.colaborador) return;
      if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, autoevaluacion: null, evaluacionLider: null, ratingFinal: null, comentarioCalibracion: null, promAuto: null, promLider: null };
      if (ev.tipo_evaluacion === 'autoevaluacion') { mapa[ev.colaborador_id].autoevaluacion = ev; mapa[ev.colaborador_id].promAuto = ev.rating_promedio; }
      if (ev.tipo_evaluacion === 'evaluacion_lider') { mapa[ev.colaborador_id].evaluacionLider = ev; mapa[ev.colaborador_id].promLider = ev.rating_promedio; mapa[ev.colaborador_id].ratingFinal = ev.rating_calibrado; mapa[ev.colaborador_id].comentarioCalibracion = ev.comentario_calibracion || null; }
    });
    setDatos(Object.values(mapa)); setCarg(false);
  }
  async function guardarCal(evaluacionId, rating, comentario) { await supabase.from('evaluaciones').update({ rating_calibrado: rating, comentario_calibracion: comentario }).eq('id', evaluacionId); setDatos(function(p) { return p.map(function(d) { return d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating, comentarioCalibracion: comentario } : d; }); }); }

  function generarPDFCompleto(d) {
    var pdf = new jsPDF(); var NEGRO = '#231F20'; var BEIGE = '#D4D2C6'; var pageWidth = 210; var marginX = 15; var y = 28;
    function agregarCabecera() { try { pdf.addImage('/logo.jpg', 'JPEG', marginX, 8, 30, 15); } catch(e) {} pdf.setDrawColor(BEIGE); pdf.setLineWidth(0.5); pdf.line(marginX, 26, pageWidth - marginX, 26); }
    function agregarPie() { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor('#94a3b8'); pdf.text('Fabric Group - ' + new Date().toLocaleDateString('es-AR'), marginX, 292); }
    agregarCabecera();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(NEGRO); pdf.text('EVALUACION DE DESEMPENO', marginX, y); y += 8;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text('Colaborador: ' + (d.colaborador.full_name || d.colaborador.email), marginX, y); y += 5;
    pdf.text('Email: ' + d.colaborador.email, marginX, y); y += 5;
    pdf.text('Area: ' + (d.colaborador.area || '-') + '   |   Seniority: ' + (d.colaborador.seniority || '-') + '   |   Fecha: ' + new Date().toLocaleDateString('es-AR'), marginX, y); y += 8;
    var autoPunts = {}; var autoComs = {}; (d.autoevaluacion?.puntuaciones || []).forEach(function(p) { autoPunts[p.competencia_id] = p.rating; autoComs[p.competencia_id] = p.comentario || ''; });
    var liderPunts = {}; var liderComs = {}; (d.evaluacionLider?.puntuaciones || []).forEach(function(p) { liderPunts[p.competencia_id] = p.rating; liderComs[p.competencia_id] = p.comentario || ''; });
    var todasComps = Object.keys(autoPunts).concat(Object.keys(liderPunts)).filter(function(v, i, a) { return a.indexOf(v) === i; });
    var compsInfo = {}; (d.autoevaluacion?.puntuaciones || []).concat(d.evaluacionLider?.puntuaciones || []).forEach(function(p) { if (!compsInfo[p.competencia_id] && p.competencias) compsInfo[p.competencia_id] = p.competencias.nombre || 'Competencia'; });
    if (todasComps.length > 0) {
      var colComp = marginX; var colAutoR = 57; var colAutoC = 68; var colLiderR = 118; var colLiderC = 129;
      pdf.setFillColor(NEGRO); pdf.rect(marginX, y, pageWidth - (marginX * 2), 7, 'F'); pdf.setTextColor('#FFFFFF'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6);
      pdf.text('Competencia', colComp + 1, y + 5); pdf.text('A', colAutoR, y + 5); pdf.text('Comentario Autoevaluacion', colAutoC, y + 5); pdf.text('L', colLiderR, y + 5); pdf.text('Comentario Lider', colLiderC, y + 5);
      y += 9; pdf.setTextColor(NEGRO);
      todasComps.forEach(function(compId, index) {
        var nombre = (compsInfo[compId] || 'Competencia').substring(0, 18); var autoR = String(autoPunts[compId] || '-'); var liderR = String(liderPunts[compId] || '-');
        var autoC = autoComs[compId] || '-'; var liderC = liderComs[compId] || '-';
        var lineasAuto = pdf.splitTextToSize(autoC, 44); var lineasLider = pdf.splitTextToSize(liderC, 58); var altura = Math.max(7, Math.max(lineasAuto.length, lineasLider.length) * 3.5);
        if (y + altura > 275) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; }
        if (index % 2 === 0) { pdf.setFillColor(248, 248, 248); pdf.rect(marginX, y - 2, pageWidth - (marginX * 2), altura + 1, 'F'); }
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.text(nombre, colComp + 1, y); pdf.setFont('helvetica', 'normal');
        pdf.setFillColor(BEIGE); pdf.circle(colAutoR + 4, y - 1.5, 3.5, 'F'); pdf.setTextColor(NEGRO); pdf.setFontSize(6.5); pdf.text(autoR, colAutoR + 2.5, y + 0.5);
        lineasAuto.forEach(function(l, i) { pdf.text(l, colAutoC, y + (i * 3.2)); });
        pdf.setFillColor(NEGRO); pdf.circle(colLiderR + 4, y - 1.5, 3.5, 'F'); pdf.setTextColor('#FFFFFF'); pdf.setFontSize(6.5); pdf.text(liderR, colLiderR + 2.5, y + 0.5); pdf.setTextColor(NEGRO);
        lineasLider.forEach(function(l, i) { pdf.text(l, colLiderC, y + (i * 3.2)); });
        y += altura + 1; pdf.setDrawColor(230, 230, 230); pdf.setLineWidth(0.1); pdf.line(marginX, y, pageWidth - marginX, y); pdf.setLineWidth(0.5);
      });
      y += 5;
    }
    y += 8; if (y > 250) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; }
    var rf = d.ratingFinal || '-';
    pdf.setFillColor(NEGRO); pdf.rect(marginX, y, pageWidth - (marginX * 2), 22, 'F'); pdf.setTextColor('#FFFFFF'); pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11); pdf.text('RESULTADO FINAL CALIBRADO', marginX + 4, y + 8); pdf.setFontSize(16); pdf.text(rf, marginX + 4, y + 18);
    if (d.comentarioCalibracion) { y += 28; pdf.setTextColor(NEGRO); pdf.setFontSize(8); pdf.text('Justificacion: ' + d.comentarioCalibracion, marginX, y); }
    agregarPie(); return pdf;
  }

  function verPDF(d) { generarPDFCompleto(d).save('Evaluacion_' + (d.colaborador.full_name || d.colaborador.email).split(' ').join('_') + '.pdf'); }

  var areas = useMemo(function() { return ['Todas'].concat([...new Set(datos.map(function(d) { return d.colaborador.area; }).filter(Boolean))]); }, [datos]);
  var df = filtro === 'Todas' ? datos : datos.filter(function(d) { return d.colaborador.area === filtro; });

  if (carg) return <p style={{ padding: 20 }}>⏳ Cargando datos de calibracion...</p>;

  return (
    <div style={{ ...s.tarjetaStat }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#231F20' }}>🎯 Calibracion - Auto vs Lider</h3>
        <select value={filtro} onChange={function(e) { setFiltro(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14, background: 'white' }}>{areas.map(function(a) { return <option key={a} value={a}>{a}</option>; })}</select>
      </div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Comparacion de autoevaluacion y evaluacion del lider. Define el rating final calibrado.</p>
      {df.length === 0 ? <p style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No hay datos para mostrar.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
            <thead><tr style={{ borderBottom: '2px solid #D4D2C6' }}><th style={th}>Colaborador</th><th style={th}>Area</th><th style={th}>Seniority</th><th style={th}>Auto</th><th style={th}>Lider</th><th style={th}>GAP</th><th style={th}>Calibrado</th><th style={th}>Justificacion</th><th style={th}>Historial</th><th style={th}>PDF</th></tr></thead>
            <tbody>{df.map(function(d) {
              var gap = d.promAuto && d.promLider ? (parseFloat(d.promLider) - parseFloat(d.promAuto)).toFixed(1) : null;
              return (
                <tr key={d.colaborador.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td>
                  <td style={td}>{d.colaborador.area || '-'}</td>
                  <td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>{d.colaborador.seniority || '-'}</span></td>
                  <td style={{ ...td, textAlign: 'center', fontSize: 16, fontWeight: 700 }}>{d.promAuto || '-'}</td>
                  <td style={{ ...td, textAlign: 'center', fontSize: 16, fontWeight: 700 }}>{d.promLider || '-'}</td>
                  <td style={{ ...td, textAlign: 'center', fontSize: 14, fontWeight: 700, color: gap ? (Math.abs(gap) <= 0.5 ? '#231F20' : Math.abs(gap) <= 1 ? '#f59e0b' : '#dc2626') : '#94a3b8' }}>{gap ? (gap > 0 ? '+' : '') + gap : '-'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {d.evaluacionLider && !soloLectura ? (
                      <select value={d.ratingFinal || ''} onChange={function(e) { guardarCal(d.evaluacionLider.id, parseFloat(e.target.value), d.comentarioCalibracion || ''); }} style={{ padding: '6px 10px', borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14, fontWeight: 600, background: 'white' }}>
                        <option value="">Seleccionar</option>
                        <option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option>
                      </select>
                    ) : <span style={{ fontWeight: 700 }}>{d.ratingFinal || '-'}</span>}
                  </td>
                  <td style={{ ...td, minWidth: 150 }}>
                    {d.evaluacionLider && !soloLectura ? (
                      <input type="text" value={d.comentarioCalibracion || ''} onChange={function(e) { guardarCal(d.evaluacionLider.id, d.ratingFinal || null, e.target.value); }} placeholder="Justificar calibracion..." style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #D4D2C6', fontSize: 12 }} />
                    ) : <span>{d.comentarioCalibracion || '-'}</span>}
                  </td>
                  <td style={td}><button onClick={function() { onHist && onHist(d.colaborador); }} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>📋</button></td>
                  <td style={td}><button onClick={function() { verPDF(d); }} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>👁️ PDF</button></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FeedbackAdmin({ cicloId }) { var [fbs, setFbs] = useState([]); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data } = await supabase.from('feedback').select('*,lider:lider_id(email,full_name),colaborador:colaborador_id(email,full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setFbs(data || []); setCarg(false); })(); }, [cicloId]); if (carg) return <p>Cargando...</p>; return <div style={s.tarjetaStat}><h4>💬 Feedback ({fbs.length})</h4>{fbs.length === 0 ? <p style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Sin registros.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Lider</th><th style={th}>Colaborador</th><th style={th}>Comentario</th><th style={th}>Fecha</th><th style={th}>OK</th></tr></thead><tbody>{fbs.map(function(f) { return (<tr key={f.id}><td style={td}>{f.lider?.full_name || '-'}</td><td style={td}>{f.colaborador?.full_name || '-'}</td><td style={td}>{f.comentario_lider || '-'}</td><td style={td}>{f.fecha_feedback_lider ? new Date(f.fecha_feedback_lider).toLocaleDateString('es-AR') : '-'}</td><td style={td}>{f.confirmacion_colaborador ? '✅' : '⏳'}</td></tr>); })}</tbody></table>}</div>; }
function HistorialAdmin({ colaborador, onVolver }) { var [hist, setHist] = useState([]); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data } = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false }); setHist(data || []); setCarg(false); })(); }, []); if (carg) return <p>Cargando...</p>; return <div><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📋 Historial: {colaborador.full_name || colaborador.email}</h3>{hist.length === 0 ? <p style={{ padding: 40, color: '#94a3b8' }}>Sin historial.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th></tr></thead><tbody>{hist.map(function(h) { return (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={td}>{h.rating_final || '-'}</td></tr>); })}</tbody></table>}</div>; }

function EquipoLider({ cicloId, profile, soloLectura }) {
  var [equipo, setEquipo] = useState([]); var [colSel, setColSel] = useState(null); var [fbVis, setFbVis] = useState(null);
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() { var { data: { session } } = await supabase.auth.getSession(); if (!session) return; var { data: d } = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', session.user.id); if (!d) return; setEquipo(d); }
  if (colSel) return <EvaluacionLider colaborador={colSel} cicloId={cicloId} onVolver={function() { setColSel(null); cargar(); }} soloLectura={soloLectura} />;
  if (fbVis) return <FeedbackForm feedback={fbVis} cicloId={cicloId} onVolver={function() { setFbVis(null); cargar(); }} />;
  return <div><h3>👥 Mi Equipo ({equipo.length})</h3>{equipo.length === 0 ? <p>No tienes colaboradores.</p> : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{equipo.map(function(c) { return (<div key={c.id} style={{ ...s.tarjetaStat }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}><div style={{ flex: 1 }}><h4>{c.full_name || c.email}</h4><p style={{ color: '#64748b', fontSize: 13 }}>{c.area} · {c.seniority}</p></div><div style={{ display: 'flex', gap: 8 }}><button onClick={function() { setFbVis(c); }} style={{ ...s.btnInfo, background: '#fef3c7', color: '#92400e' }}>💬 FB</button><button onClick={function() { setColSel(c); }} style={s.btnPrimario}>{soloLectura ? '👁️ Ver' : '📝 Evaluar'}</button></div></div></div>); })}</div>}</div>;
}

function FeedbackForm({ feedback: col, cicloId, onVolver }) { var [com, setCom] = useState(''); var [fb, setFb] = useState(null); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data: { session } } = await supabase.auth.getSession(); var { data } = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', col.id).maybeSingle(); if (data) { setFb(data); setCom(data.comentario_lider || ''); } else { await supabase.from('feedback').insert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id }); } setCarg(false); })(); }, []); async function guardar() { var { data: { session } } = await supabase.auth.getSession(); await supabase.from('feedback').upsert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id, comentario_lider: com, fecha_feedback_lider: new Date() }, { onConflict: 'ciclo_id, colaborador_id' }); alert('✅ Guardado'); onVolver(); } if (carg) return <p>Cargando...</p>; return <div style={{ maxWidth: 600 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>💬 Feedback: {col.full_name || col.email}</h3><textarea value={com} onChange={function(e) { setCom(e.target.value); }} placeholder="Deja tu feedback..." style={{ ...s.textarea, minHeight: 120, marginBottom: 12 }} />{fb?.confirmacion_colaborador && <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8, marginBottom: 16 }}>✅ Confirmado</div>}<button onClick={guardar} style={s.btnPrimario}>💾 Guardar</button></div>; }

function EvaluacionLider({ colaborador, cicloId, onVolver, soloLectura }) {
  var [competencias, setComp] = useState([]); var [ratings, setRatings] = useState({}); var [comentarios, setComent] = useState({}); var [comFin, setComFin] = useState(''); var [msg, setMsg] = useState(''); var [carg, setCarg] = useState(true); var [autoEval, setAutoEval] = useState(null); var [evalData, setEvalData] = useState(null); var [showInfo, setShowInfo] = useState({});
  useEffect(function() { (async function() { var [{ data: comps }, { data: { session } }] = await Promise.all([supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', colaborador.seniority || 'Analista'), supabase.auth.getSession()]); setComp(comps || []); var { data: ae } = await supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle(); if (ae) { var { data: p } = await supabase.from('puntuaciones').select('id, rating, comentario, competencia_id, competencias!inner(nombre)').eq('evaluacion_id', ae.id); setAutoEval({ ...ae, puntuaciones: p || [] }); } var { data: liderEval } = await supabase.from('evaluaciones').select('id, estado, comentarios_finales, rating_promedio').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(); if (liderEval) { setEvalData(liderEval); setComFin(liderEval.comentarios_finales || ''); var { data: punts } = await supabase.from('puntuaciones').select('rating, competencia_id, comentario').eq('evaluacion_id', liderEval.id); var rm = {}; var cm = {}; (punts || []).forEach(function(p) { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComent(cm); } else if (!soloLectura) { await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador', ciclo_id: cicloId }); } setCarg(false); })(); }, []);
  async function guardar() { if (soloLectura) return; var { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (!ev) return; var vals = Object.values(ratings).filter(function(r) { return r > 0; }); var prom = vals.length > 0 ? parseFloat((vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1)) : null; await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', ev.id); for (var [cid, r] of Object.entries(ratings)) { await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMsg('✅ Guardado'); setTimeout(function() { setMsg(''); }, 2500); }
  async function enviar() { if (soloLectura) return; await guardar(); var { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id); setMsg('🎉 Enviada'); }
  if (carg) return <p>Cargando...</p>;
  return <div style={{ maxWidth: 900 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📝 Evaluando a: {colaborador.full_name || colaborador.email}</h3><p>{colaborador.area} · {colaborador.seniority}</p>{autoEval?.estado === 'enviado' && <DetalleAutoEvaluacion autoevaluacion={autoEval} />}{competencias.map(function(comp) { return (<div key={comp.id} style={s.competenciaCard}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h5>{comp.nombre}</h5><p style={{ fontSize: 13, color: '#64748b' }}>{comp.descripcion}</p></div><button onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }} style={s.btnInfo}>{showInfo[comp.id] ? '🔼' : '🔽'}</button></div>{showInfo[comp.id] && <div style={{ ...s.ratingInfoBox, marginTop: 8 }}>{[1, 2, 3, 4, 5].map(function(r) { return <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>; })}</div>}<div style={s.ratingRow}>{[1, 2, 3, 4, 5].map(function(r) { return <button key={r} onClick={function() { if (!soloLectura) setRatings({ ...ratings, [comp.id]: r }); }} style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', cursor: soloLectura ? 'default' : 'pointer' }}>{r}</button>; })}</div><textarea value={comentarios[comp.id] || ''} onChange={function(e) { if (!soloLectura) setComent({ ...comentarios, [comp.id]: e.target.value }); }} placeholder="Comentario" style={s.textareaSmall} readOnly={soloLectura} /></div>); })}<SeccionText titulo="📝 Comentarios Finales" valor={comFin} onChange={soloLectura ? function() {} : setComFin} disabled={soloLectura} />{!soloLectura && <div style={{ display: 'flex', gap: 12, marginTop: 20 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>}</div>;
}

function PanelColaborador({ userId, seniority, cicloId, soloLectura }) {
  var [competencias, setComp] = useState([]); var [ratings, setRatings] = useState({}); var [comentarios, setComent] = useState({}); var [comFin, setComFin] = useState(''); var [msg, setMsg] = useState(''); var [carg, setCarg] = useState(true); var [evalLider, setEvalLider] = useState(null); var [feedback, setFeedback] = useState(null); var [evalData, setEvalData] = useState(null); var [showInfo, setShowInfo] = useState({});
  useEffect(function() { (async function() { var [{ data: comps }, { data: ev }, { data: le }, { data: fb }] = await Promise.all([supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', seniority || 'Analista'), supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(), supabase.from('evaluaciones').select('id, rating_calibrado, comentario_calibracion').eq('colaborador_id', userId).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(), supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', userId).maybeSingle()]); setComp(comps || []); setEvalLider(le); setFeedback(fb); if (ev) { setEvalData(ev); setComFin(ev.comentarios_finales || ''); var { data: punts } = await supabase.from('puntuaciones').select('rating, competencia_id, comentario').eq('evaluacion_id', ev.id); var rm = {}; var cm = {}; (punts || []).forEach(function(p) { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComent(cm); } else if (!soloLectura) { await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador', ciclo_id: cicloId }); } setCarg(false); })(); }, []);
  async function guardar() { if (soloLectura) return; var { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (!ev) return; var vals = Object.values(ratings).filter(function(r) { return r > 0; }); var prom = vals.length > 0 ? parseFloat((vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1)) : null; await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', ev.id); for (var [cid, r] of Object.entries(ratings)) { await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMsg('✅ Guardado'); setTimeout(function() { setMsg(''); }, 2500); }
  async function enviar() { if (soloLectura) return; await guardar(); var { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id); setMsg('🎉 Enviada'); }
  if (carg) return <p>Cargando...</p>;
  return <div style={{ maxWidth: 900 }}><h3>📝 Mi Autoevaluacion</h3><p>Seniority: <strong>{seniority || 'No definido'}</strong></p>{feedback && <div style={{ padding: 16, background: feedback.confirmacion_colaborador ? '#dcfce7' : '#fef3c7', borderRadius: 10, marginBottom: 20 }}><h4>💬 Feedback</h4><p>{feedback.comentario_lider || 'Sin comentarios.'}</p></div>}{evalLider?.rating_calibrado && <div style={{ padding: 16, background: '#D4D2C6', borderRadius: 10, marginBottom: 20, textAlign: 'center' }}><p>🎯 Resultado Final Calibrado</p><p style={{ fontSize: 36, fontWeight: 700 }}>{evalLider.rating_calibrado}</p></div>}{competencias.map(function(comp) { return (<div key={comp.id} style={s.competenciaCard}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h5>{comp.nombre}</h5><p style={{ fontSize: 13, color: '#64748b' }}>{comp.descripcion}</p></div><button onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }} style={s.btnInfo}>{showInfo[comp.id] ? '🔼' : '🔽'}</button></div>{showInfo[comp.id] && <div style={{ ...s.ratingInfoBox, marginTop: 8 }}>{[1, 2, 3, 4, 5].map(function(r) { return <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>; })}</div>}<div style={s.ratingRow}>{[1, 2, 3, 4, 5].map(function(r) { return <button key={r} onClick={function() { if (!soloLectura) setRatings({ ...ratings, [comp.id]: r }); }} style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', cursor: soloLectura ? 'default' : 'pointer' }}>{r}</button>; })}</div><textarea value={comentarios[comp.id] || ''} onChange={function(e) { if (!soloLectura) setComent({ ...comentarios, [comp.id]: e.target.value }); }} placeholder="Comentario" style={s.textareaSmall} readOnly={soloLectura} /></div>); })}<SeccionText titulo="📝 Comentarios Finales" valor={comFin} onChange={soloLectura ? function() {} : setComFin} disabled={soloLectura} />{!soloLectura && <div style={{ display: 'flex', gap: 12, marginTop: 20 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>}</div>;
}

function DetalleAutoEvaluacion({ autoevaluacion }) {
  if (!autoevaluacion) return <p style={{ padding: 16, color: '#94a3b8' }}>Sin autoevaluacion.</p>;
  var puntuaciones = autoevaluacion.puntuaciones || [];
  return (
    <div style={{ marginTop: 16, background: 'white', borderRadius: 12, border: '2px solid #D4D2C6', overflow: 'hidden' }}>
      <div style={{ background: '#231F20', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}><h4 style={{ margin: 0, color: '#D4D2C6', fontSize: 16 }}>📝 Autoevaluacion Completa</h4><div style={{ display: 'flex', gap: 16, alignItems: 'center' }}><span style={{ color: '#D4D2C6', fontSize: 13 }}>{autoevaluacion.estado === 'enviado' ? '✅ Enviada' : '📝 Borrador'}</span><span style={{ background: '#D4D2C6', color: '#231F20', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 20 }}>{autoevaluacion.rating_promedio || '-'}</span></div></div>
      <div style={{ padding: 20 }}>
        {autoevaluacion.comentarios_finales && <div style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8 }}><strong>💬 Comentarios Finales:</strong><p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>{autoevaluacion.comentarios_finales}</p></div>}
        <h5>📊 Calificacion por Competencia</h5>
        {puntuaciones.length === 0 ? <p style={{ color: '#94a3b8' }}>Sin competencias calificadas.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}><thead><tr style={{ background: '#231F20' }}><th style={{ padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'left' }}>Competencia</th><th style={{ padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'center', width: 80 }}>Rating</th><th style={{ padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'left' }}>Comentario</th></tr></thead><tbody>{puntuaciones.map(function(p, i) { return (<tr key={p.id || i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '12px 16px', fontSize: 14, color: '#231F20', fontWeight: 500 }}>{p.competencias?.nombre || 'ID: ' + p.competencia_id}</td><td style={{ padding: '12px 16px', textAlign: 'center' }}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: '#231F20', color: '#D4D2C6', fontSize: 16, fontWeight: 700 }}>{p.rating}</span></td><td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{p.comentario || 'Sin comentario'}</td></tr>); })}</tbody></table>
        )}
      </div>
    </div>
  );
}
