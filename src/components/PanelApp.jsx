import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';

export default function PanelApp() {
  var [profile, setProfile] = useState(null);
  var [loading, setLoading] = useState(true);
  var [menuActivo, setMenuActivo] = useState('desempeno');
  var [cicloActivo, setCicloActivo] = useState(null);
  var [modoVista, setModoVista] = useState(null);

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
        <header style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1>
            {modoVista ? (
              <span style={{ ...s.badge, background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                👁️ Viendo como: {modoVista.full_name || modoVista.email}
                <button onClick={function() { setModoVista(null); }} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>✕ Salir</button>
              </span>
            ) : (
              <span style={s.badge}>{emojiRol} {nombreRol}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {(profile.role === 'admin_rrhh') && !modoVista && (
              <VistaComoSelector profile={profile} onSelect={function(col) { setModoVista(col); }} />
            )}
          </div>
        </header>
        <main style={{ padding: 24 }}>
          {menuActivo === 'desempeno' && <DesempenoView profile={modoVista || profile} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
          {menuActivo === 'misobjetivos' && <ObjetivosColaborador profile={modoVista || profile} />}
          {menuActivo === 'miequipo_obj' && <ObjetivosGerente profile={modoVista || profile} />}
          {menuActivo === 'compania_obj' && <PlaceholderView titulo="🏢 Objetivos de la Compañia" descripcion="Modulo en desarrollo." />}
          {menuActivo === 'admin_obj' && !modoVista && <PanelAdminObjetivos profile={profile} />}
          {menuActivo === 'admin_obj' && modoVista && <PlaceholderView titulo="🔧 Panel Admin" descripcion="No disponible en modo vista." />}
        </main>
      </div>
    </div>
  );
}

function VistaComoSelector({ profile, onSelect }) {
  var [colaboradores, setColaboradores] = useState([]);
  var [mostrarDropdown, setMostrarDropdown] = useState(false);
  var [busqueda, setBusqueda] = useState('');

  useEffect(function() { cargarColaboradores(); }, []);

  async function cargarColaboradores() {
    var { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority, role').neq('role', 'admin_rrhh').eq('activo', true).order('full_name');
    setColaboradores(data || []);
  }

  var filtrados = colaboradores.filter(function(c) {
    if (!busqueda) return true;
    var nombre = (c.full_name || '').toLowerCase();
    var email = (c.email || '').toLowerCase();
    var termino = busqueda.toLowerCase();
    return nombre.indexOf(termino) !== -1 || email.indexOf(termino) !== -1;
  });

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={function() { setMostrarDropdown(!mostrarDropdown); }} style={{ ...s.btnInfo, background: '#D4D2C6', color: '#231F20', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>👁️ Ver como...</button>
      {mostrarDropdown && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', width: '320px', maxHeight: '400px', overflow: 'hidden', zIndex: 1000, border: '1px solid #e2e8f0' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <input type="text" value={busqueda} onChange={function(e) { setBusqueda(e.target.value); }} placeholder="🔍 Buscar colaborador..." style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} autoFocus />
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {filtrados.length === 0 ? <p style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No se encontraron colaboradores</p> : filtrados.map(function(col) { return (
              <div key={col.id} onClick={function() { onSelect(col); setMostrarDropdown(false); setBusqueda(''); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onMouseEnter={function(e) { e.currentTarget.style.background = '#f8fafc'; }} onMouseLeave={function(e) { e.currentTarget.style.background = 'white'; }}>
                <div><strong style={{ fontSize: 13, color: '#231F20' }}>{col.full_name || col.email}</strong><p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#64748b' }}>{col.area || 'Sin área'} · {col.seniority || 'Sin seniority'}</p></div>
                <span style={{ fontSize: 18 }}>👁️</span>
              </div>
            ); })}
          </div>
        </div>
      )}
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
  var [profile, setProfile] = useState(null);
  var [loading, setLoading] = useState(true);
  var [menuActivo, setMenuActivo] = useState('desempeno');
  var [cicloActivo, setCicloActivo] = useState(null);
  var [modoVista, setModoVista] = useState(null);

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
        <header style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1>
            {modoVista ? (
              <span style={{ ...s.badge, background: '#fef3c7', color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                👁️ Viendo como: {modoVista.full_name || modoVista.email}
                <button onClick={function() { setModoVista(null); }} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>✕ Salir</button>
              </span>
            ) : (
              <span style={s.badge}>{emojiRol} {nombreRol}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {(profile.role === 'admin_rrhh') && !modoVista && (
              <VistaComoSelector profile={profile} onSelect={function(col) { setModoVista(col); }} />
            )}
          </div>
        </header>
        <main style={{ padding: 24 }}>
          {menuActivo === 'desempeno' && <DesempenoView profile={modoVista || profile} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
          {menuActivo === 'misobjetivos' && <ObjetivosColaborador profile={modoVista || profile} />}
          {menuActivo === 'miequipo_obj' && <ObjetivosGerente profile={modoVista || profile} />}
          {menuActivo === 'compania_obj' && <PlaceholderView titulo="🏢 Objetivos de la Compañia" descripcion="Modulo en desarrollo." />}
          {menuActivo === 'admin_obj' && !modoVista && <PanelAdminObjetivos profile={profile} />}
          {menuActivo === 'admin_obj' && modoVista && <PlaceholderView titulo="🔧 Panel Admin" descripcion="No disponible en modo vista." />}
        </main>
      </div>
    </div>
  );
}

function VistaComoSelector({ profile, onSelect }) {
  var [colaboradores, setColaboradores] = useState([]);
  var [mostrarDropdown, setMostrarDropdown] = useState(false);
  var [busqueda, setBusqueda] = useState('');

  useEffect(function() { cargarColaboradores(); }, []);

  async function cargarColaboradores() {
    var { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority, role').neq('role', 'admin_rrhh').eq('activo', true).order('full_name');
    setColaboradores(data || []);
  }

  var filtrados = colaboradores.filter(function(c) {
    if (!busqueda) return true;
    var nombre = (c.full_name || '').toLowerCase();
    var email = (c.email || '').toLowerCase();
    var termino = busqueda.toLowerCase();
    return nombre.indexOf(termino) !== -1 || email.indexOf(termino) !== -1;
  });

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={function() { setMostrarDropdown(!mostrarDropdown); }} style={{ ...s.btnInfo, background: '#D4D2C6', color: '#231F20', fontWeight: 600, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>👁️ Ver como...</button>
      {mostrarDropdown && (
        <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'white', borderRadius: 10, boxShadow: '0 10px 40px rgba(0,0,0,0.15)', width: '320px', maxHeight: '400px', overflow: 'hidden', zIndex: 1000, border: '1px solid #e2e8f0' }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <input type="text" value={busqueda} onChange={function(e) { setBusqueda(e.target.value); }} placeholder="🔍 Buscar colaborador..." style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, boxSizing: 'border-box' }} autoFocus />
          </div>
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {filtrados.length === 0 ? <p style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>No se encontraron colaboradores</p> : filtrados.map(function(col) { return (
              <div key={col.id} onClick={function() { onSelect(col); setMostrarDropdown(false); setBusqueda(''); }} style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} onMouseEnter={function(e) { e.currentTarget.style.background = '#f8fafc'; }} onMouseLeave={function(e) { e.currentTarget.style.background = 'white'; }}>
                <div><strong style={{ fontSize: 13, color: '#231F20' }}>{col.full_name || col.email}</strong><p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#64748b' }}>{col.area || 'Sin área'} · {col.seniority || 'Sin seniority'}</p></div>
                <span style={{ fontSize: 18 }}>👁️</span>
              </div>
            ); })}
          </div>
        </div>
      )}
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
// =============================================
// OBJETIVOS
// =============================================
function ObjetivosGerente({ profile }) {
  var [equipo, setEquipo] = useState([]); var [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null); var [cargando, setCargando] = useState(true);
  useEffect(function() { cargarEquipo(); }, []);
  async function cargarEquipo() { var { data: { session } } = await supabase.auth.getSession(); if (!session) return; var { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', session.user.id); setEquipo(data || []); setCargando(false); }
  if (cargando) return <p>Cargando equipo...</p>;
  if (colaboradorSeleccionado) return <GestionObjetivosLider colaborador={colaboradorSeleccionado} profile={profile} onVolver={function() { setColaboradorSeleccionado(null); }} />;
  return (
    <div>
      <h2 style={{ color: '#231F20', marginBottom: 20 }}>🎯 Objetivos de Mi Equipo</h2>
      <p style={{ color: '#64748b', marginBottom: 20 }}>Selecciona un colaborador para ver y validar sus objetivos.</p>
      {equipo.length === 0 ? <p style={{ color: '#94a3b8' }}>No tienes colaboradores asignados.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {equipo.map(function(col) { return (
            <div key={col.id} onClick={function() { setColaboradorSeleccionado(col); }} style={{ ...s.tarjetaStat, cursor: 'pointer', border: '2px solid #D4D2C6' }}>
              <h4 style={{ margin: 0, color: '#231F20' }}>{col.full_name || col.email}</h4>
              <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>{col.area} · {col.seniority}</p>
              <button style={{ ...s.btnPrimario, marginTop: 12, width: '100%' }}>Ver Objetivos</button>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}

function GestionObjetivosLider({ colaborador, profile, onVolver }) {
  var [objetivos, setObjetivos] = useState([]); var [cargando, setCargando] = useState(true);
  var [modalValidar, setModalValidar] = useState(null); var [accionValidar, setAccionValidar] = useState(''); var [comentarioLider, setComentarioLider] = useState('');
  useEffect(function() { cargarObjetivos(); }, []);
  async function cargarObjetivos() { var { data } = await supabase.from('objetivos').select('*').eq('colaborador_id', colaborador.id).order('created_at', { ascending: false }); setObjetivos(data || []); setCargando(false); }
  async function ejecutarValidacion() { if (!accionValidar) return alert('Selecciona una accion'); if (!comentarioLider.trim()) return alert('El comentario es obligatorio'); var nuevoStatus = accionValidar === 'aprobar' ? 'validado' : 'pendiente'; await supabase.from('objetivos').update({ status: nuevoStatus, validado_por_gerente: accionValidar === 'aprobar', comentario_lider: comentarioLider, fecha_validacion: new Date() }).eq('id', modalValidar); setModalValidar(null); setAccionValidar(''); setComentarioLider(''); cargarObjetivos(); }
  if (cargando) return <p>Cargando objetivos...</p>;
  return (
    <div>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver al equipo</button>
      <div style={{ marginBottom: 20 }}><h2 style={{ color: '#231F20', margin: 0 }}>🎯 Objetivos de {colaborador.full_name || colaborador.email}</h2><p style={{ color: '#64748b', margin: '4px 0' }}>{colaborador.area} · {colaborador.seniority}</p></div>
      {modalValidar && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setModalValidar(null); }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 500, width: '90%' }} onClick={function(e) { e.stopPropagation(); }}>
            <h3 style={{ marginTop: 0 }}>📋 Validar Objetivo</h3>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Accion *</label><select value={accionValidar} onChange={function(e) { setAccionValidar(e.target.value); }} style={{ width: '100%', padding: 10, borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14 }}><option value="">Seleccionar...</option><option value="aprobar">✅ Aprobar</option><option value="rechazar">❌ Rechazar (devuelve a pendiente)</option></select></div>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Comentario *</label><textarea value={comentarioLider} onChange={function(e) { setComentarioLider(e.target.value); }} placeholder="Explica tu decision..." style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} /></div>
            <div style={{ display: 'flex', gap: 12 }}><button onClick={ejecutarValidacion} style={{ ...s.btnPrimario, background: accionValidar === 'aprobar' ? '#22c55e' : '#dc2626', flex: 1 }}>Confirmar</button><button onClick={function() { setModalValidar(null); }} style={{ ...s.btnSecundario }}>Cancelar</button></div>
          </div>
        </div>
      )}
      {objetivos.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Sin objetivos cargados.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Corp.</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Alcance</th><th style={{ ...th, color: '#D4D2C6' }}>Justif.</th><th style={{ ...th, color: '#D4D2C6' }}>Mi Coment.</th><th style={{ ...th, color: '#D4D2C6' }}>Accion</th></tr></thead>
            <tbody>{objetivos.map(function(obj) { return (
              <tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}>{obj.objetivo}</td><td style={td}>{obj.corporativo || '-'}</td><td style={{ ...td, fontWeight: 700, textAlign: 'center' }}>{obj.ponderacion}%</td>
                <td style={td}><span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : obj.status === 'aceptado' ? '#fef3c7' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : obj.status === 'aceptado' ? '#92400e' : '#64748b' }}>{obj.status}</span></td>
                <td style={td}>{obj.alcance_completado || '-'}</td>
                <td style={td}>{obj.justificacion_completado ? obj.justificacion_completado.substring(0, 30) + '...' : '-'}</td>
                <td style={td}>{obj.comentario_lider ? obj.comentario_lider.substring(0, 30) + '...' : '-'}</td>
                <td style={td}>{obj.status === 'completado' && <button onClick={function() { setModalValidar(obj.id); }} style={{ ...s.btnPrimario, background: '#f59e0b', fontSize: 12, padding: '6px 12px' }}>📋 Validar</button>}</td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ObjetivosColaborador({ profile }) {
  var [objetivos, setObjetivos] = useState([]); var [cargando, setCargando] = useState(true);
  var [mostrarForm, setMostrarForm] = useState(false); var [editandoId, setEditandoId] = useState(null);
  var [modalCompletar, setModalCompletar] = useState(null); var [alcanceCompletar, setAlcanceCompletar] = useState(''); var [justificacionCompletar, setJustificacionCompletar] = useState('');
  var [nuevoObjetivo, setNuevoObjetivo] = useState({ objetivo: '', corporativo: '', ponderacion: 25, alcance_0_descripcion: '', alcance_0_fecha: '', alcance_80_descripcion: '', alcance_80_fecha: '', alcance_100_descripcion: '', alcance_100_fecha: '', alcance_120_descripcion: '', alcance_120_fecha: '' });
  useEffect(function() { cargarObjetivos(); }, []);
  async function cargarObjetivos() { var { data } = await supabase.from('objetivos').select('*').eq('colaborador_id', profile.id).order('created_at', { ascending: false }); setObjetivos(data || []); setCargando(false); }
  async function guardarObjetivo() { if (!nuevoObjetivo.objetivo) return alert('El objetivo es obligatorio'); if (editandoId) { await supabase.from('objetivos').update({ objetivo: nuevoObjetivo.objetivo, corporativo: nuevoObjetivo.corporativo, ponderacion: nuevoObjetivo.ponderacion, alcance_0_descripcion: nuevoObjetivo.alcance_0_descripcion, alcance_0_fecha: nuevoObjetivo.alcance_0_fecha || null, alcance_80_descripcion: nuevoObjetivo.alcance_80_descripcion, alcance_80_fecha: nuevoObjetivo.alcance_80_fecha || null, alcance_100_descripcion: nuevoObjetivo.alcance_100_descripcion, alcance_100_fecha: nuevoObjetivo.alcance_100_fecha || null, alcance_120_descripcion: nuevoObjetivo.alcance_120_descripcion, alcance_120_fecha: nuevoObjetivo.alcance_120_fecha || null, editado_por_colaborador: true, fecha_edicion: new Date() }).eq('id', editandoId); } else { var { data: { session } } = await supabase.auth.getSession(); await supabase.from('objetivos').insert({ gerente_id: null, colaborador_id: profile.id, objetivo: nuevoObjetivo.objetivo, corporativo: nuevoObjetivo.corporativo, ponderacion: nuevoObjetivo.ponderacion, status: 'pendiente', alcance_0_descripcion: nuevoObjetivo.alcance_0_descripcion, alcance_0_fecha: nuevoObjetivo.alcance_0_fecha || null, alcance_80_descripcion: nuevoObjetivo.alcance_80_descripcion, alcance_80_fecha: nuevoObjetivo.alcance_80_fecha || null, alcance_100_descripcion: nuevoObjetivo.alcance_100_descripcion, alcance_100_fecha: nuevoObjetivo.alcance_100_fecha || null, alcance_120_descripcion: nuevoObjetivo.alcance_120_descripcion, alcance_120_fecha: nuevoObjetivo.alcance_120_fecha || null }); } setNuevoObjetivo({ objetivo: '', corporativo: '', ponderacion: 25, alcance_0_descripcion: '', alcance_0_fecha: '', alcance_80_descripcion: '', alcance_80_fecha: '', alcance_100_descripcion: '', alcance_100_fecha: '', alcance_120_descripcion: '', alcance_120_fecha: '' }); setMostrarForm(false); setEditandoId(null); cargarObjetivos(); }
  function editarObjetivo(obj) { setNuevoObjetivo({ objetivo: obj.objetivo, corporativo: obj.corporativo || '', ponderacion: obj.ponderacion, alcance_0_descripcion: obj.alcance_0_descripcion || '', alcance_0_fecha: obj.alcance_0_fecha || '', alcance_80_descripcion: obj.alcance_80_descripcion || '', alcance_80_fecha: obj.alcance_80_fecha || '', alcance_100_descripcion: obj.alcance_100_descripcion || '', alcance_100_fecha: obj.alcance_100_fecha || '', alcance_120_descripcion: obj.alcance_120_descripcion || '', alcance_120_fecha: obj.alcance_120_fecha || '' }); setEditandoId(obj.id); setMostrarForm(true); }
  async function aceptarObjetivo(objId) { await supabase.from('objetivos').update({ status: 'aceptado', confirmado_colaborador: true, fecha_confirmacion: new Date() }).eq('id', objId); cargarObjetivos(); }
  async function completarObjetivo() { if (!alcanceCompletar) return alert('Selecciona un alcance'); if (!justificacionCompletar.trim()) return alert('La justificacion es obligatoria'); await supabase.from('objetivos').update({ status: 'completado', completado_por_colaborador: true, fecha_completado: new Date(), alcance_completado: alcanceCompletar, justificacion_completado: justificacionCompletar }).eq('id', modalCompletar); setModalCompletar(null); setAlcanceCompletar(''); setJustificacionCompletar(''); cargarObjetivos(); }
  if (cargando) return <p>Cargando objetivos...</p>;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><h2 style={{ color: '#231F20', margin: 0 }}>🎯 Mis Objetivos</h2><button onClick={function() { setMostrarForm(!mostrarForm); setEditandoId(null); setNuevoObjetivo({ objetivo: '', corporativo: '', ponderacion: 25, alcance_0_descripcion: '', alcance_0_fecha: '', alcance_80_descripcion: '', alcance_80_fecha: '', alcance_100_descripcion: '', alcance_100_fecha: '', alcance_120_descripcion: '', alcance_120_fecha: '' }); }} style={s.btnPrimario}>{mostrarForm ? 'Cancelar' : '+ Nuevo Objetivo'}</button></div>
      {mostrarForm && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <h4>{editandoId ? 'Editar Objetivo' : 'Nuevo Objetivo'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Objetivo *</label><input value={nuevoObjetivo.objetivo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, objetivo: e.target.value}); }} placeholder="Describir el objetivo principal..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Corporativo</label><input value={nuevoObjetivo.corporativo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, corporativo: e.target.value}); }} placeholder="Ej: Ventas, Operaciones..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Ponderacion (%)</label><select value={nuevoObjetivo.ponderacion} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, ponderacion: parseFloat(e.target.value)}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option><option value="50">50%</option></select></div>
          </div>
          <h5 style={{ margin: '16px 0 8px 0', color: '#231F20' }}>📊 Alcances del Objetivo</h5>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>Define que significa cada nivel de alcance y opcionalmente una fecha limite.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#fee2e2', padding: 12, borderRadius: 8 }}><label style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>0% - No alcanzado</label><input value={nuevoObjetivo.alcance_0_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_0_descripcion: e.target.value}); }} placeholder="Ej: No se realizaron aperturas" style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #fca5a5', fontSize: 12, marginTop: 4 }} /><input type="date" value={nuevoObjetivo.alcance_0_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_0_fecha: e.target.value}); }} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #fca5a5', fontSize: 12, marginTop: 4 }} /></div>
            <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8 }}><label style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>80% - Parcialmente alcanzado</label><input value={nuevoObjetivo.alcance_80_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_80_descripcion: e.target.value}); }} placeholder="Ej: Se realizaron 40 aperturas" style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #fcd34d', fontSize: 12, marginTop: 4 }} /><input type="date" value={nuevoObjetivo.alcance_80_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_80_fecha: e.target.value}); }} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #fcd34d', fontSize: 12, marginTop: 4 }} /></div>
            <div style={{ background: '#dcfce7', padding: 12, borderRadius: 8 }}><label style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>100% - Alcanzado</label><input value={nuevoObjetivo.alcance_100_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_100_descripcion: e.target.value}); }} placeholder="Ej: Se realizaron 50 aperturas" style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #86efac', fontSize: 12, marginTop: 4 }} /><input type="date" value={nuevoObjetivo.alcance_100_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_100_fecha: e.target.value}); }} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #86efac', fontSize: 12, marginTop: 4 }} /></div>
            <div style={{ background: '#dbeafe', padding: 12, borderRadius: 8 }}><label style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>120% - Superado</label><input value={nuevoObjetivo.alcance_120_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_120_descripcion: e.target.value}); }} placeholder="Ej: Se realizaron 60+ aperturas" style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #93c5fd', fontSize: 12, marginTop: 4 }} /><input type="date" value={nuevoObjetivo.alcance_120_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_120_fecha: e.target.value}); }} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #93c5fd', fontSize: 12, marginTop: 4 }} /></div>
          </div>
          <button onClick={guardarObjetivo} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 16 }}>💾 {editandoId ? 'Actualizar' : 'Guardar'} Objetivo</button>
        </div>
      )}
      {modalCompletar && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setModalCompletar(null); }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 500, width: '90%' }} onClick={function(e) { e.stopPropagation(); }}>
            <h3 style={{ marginTop: 0 }}>✔️ Completar Objetivo</h3>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Alcance Alcanzado *</label><select value={alcanceCompletar} onChange={function(e) { setAlcanceCompletar(e.target.value); }} style={{ width: '100%', padding: 10, borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14 }}><option value="">Seleccionar alcance</option><option value="0%">0% - No alcanzado</option><option value="80%">80% - Parcialmente alcanzado</option><option value="100%">100% - Alcanzado</option><option value="120%">120% - Superado</option></select></div>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Justificacion *</label><textarea value={justificacionCompletar} onChange={function(e) { setJustificacionCompletar(e.target.value); }} placeholder="Explica el resultado alcanzado..." style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} /></div>
            <div style={{ display: 'flex', gap: 12 }}><button onClick={completarObjetivo} style={{ ...s.btnPrimario, background: '#22c55e', flex: 1 }}>✔️ Confirmar Completado</button><button onClick={function() { setModalCompletar(null); }} style={{ ...s.btnSecundario }}>Cancelar</button></div>
          </div>
        </div>
      )}
      {objetivos.length === 0 ? <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}><p style={{ color: '#94a3b8', fontSize: 16 }}>No tienes objetivos cargados aun.</p></div> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Corp.</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Mi Alcance</th><th style={{ ...th, color: '#D4D2C6' }}>Coment. Lider</th><th style={{ ...th, color: '#D4D2C6' }}>Accion</th></tr></thead>
            <tbody>{objetivos.map(function(obj) { return (
              <tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}>{obj.objetivo} {obj.editado_por_colaborador && <span style={{ fontSize: 10, color: '#f59e0b' }}>(editado)</span>}</td>
                <td style={td}>{obj.corporativo || '-'}</td><td style={{ ...td, fontWeight: 700, textAlign: 'center' }}>{obj.ponderacion}%</td>
                <td style={td}><span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : obj.status === 'aceptado' ? '#fef3c7' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : obj.status === 'aceptado' ? '#92400e' : '#64748b' }}>{obj.status}</span></td>
                <td style={td}>{obj.alcance_completado || '-'}</td>
                <td style={td}>{obj.comentario_lider ? obj.comentario_lider.substring(0, 30) + '...' : '-'}</td>
                <td style={td}>
                  {(obj.status === 'pendiente' || obj.status === 'aceptado') && <button onClick={function() { editarObjetivo(obj); }} style={{ ...s.btnInfo, background: '#fef3c7', color: '#92400e', fontSize: 11, padding: '4px 8px', marginRight: 4 }}>✏️</button>}
                  {obj.status === 'pendiente' && <button onClick={function() { aceptarObjetivo(obj.id); }} style={{ ...s.btnPrimario, background: '#3b82f6', fontSize: 12, padding: '6px 12px' }}>✅ Aceptar</button>}
                  {obj.status === 'aceptado' && <button onClick={function() { setModalCompletar(obj.id); }} style={{ ...s.btnPrimario, background: '#f59e0b', fontSize: 12, padding: '6px 12px' }}>✔️ Completar</button>}
                </td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PanelAdminObjetivos({ profile }) {
  var [objetivos, setObjetivos] = useState([]); var [colaboradores, setColaboradores] = useState([]); var [cargando, setCargando] = useState(true);
  var [filtroArea, setFiltroArea] = useState('Todas'); var [filtroSeniority, setFiltroSeniority] = useState('Todos');
  var [mostrarForm, setMostrarForm] = useState(false); var [mostrarHistorico, setMostrarHistorico] = useState(false);
  var [colaboradorSeleccionado, setColaboradorSeleccionado] = useState('');
  var [nuevoObjetivo, setNuevoObjetivo] = useState({ objetivo: '', corporativo: '', ponderacion: 25, alcance_0_descripcion: '', alcance_0_fecha: '', alcance_80_descripcion: '', alcance_80_fecha: '', alcance_100_descripcion: '', alcance_100_fecha: '', alcance_120_descripcion: '', alcance_120_fecha: '' });
  var [objetivoHistorico, setObjetivoHistorico] = useState({ objetivo: '', corporativo: '', ponderacion: 25, fecha_historica: '', alcance: '', status: 'validado' });

  useEffect(function() { cargarDatos(); }, []);
  async function cargarDatos() { var [{ data: objs }, { data: cols }] = await Promise.all([supabase.from('objetivos').select('*, colaborador:colaborador_id(email, full_name, area, seniority), gerente:gerente_id(email, full_name)').order('created_at', { ascending: false }), supabase.from('profiles').select('id, email, full_name, area, seniority').neq('role', 'admin_rrhh').eq('activo', true)]); setObjetivos(objs || []); setColaboradores(cols || []); setCargando(false); }
  async function agregarObjetivoAdmin() { if (!colaboradorSeleccionado || !nuevoObjetivo.objetivo) return alert('Selecciona colaborador y escribe el objetivo'); var { data: { session } } = await supabase.auth.getSession(); await supabase.from('objetivos').insert({ gerente_id: session.user.id, colaborador_id: colaboradorSeleccionado, objetivo: nuevoObjetivo.objetivo, corporativo: nuevoObjetivo.corporativo, ponderacion: nuevoObjetivo.ponderacion, status: 'pendiente', alcance_0_descripcion: nuevoObjetivo.alcance_0_descripcion, alcance_0_fecha: nuevoObjetivo.alcance_0_fecha || null, alcance_80_descripcion: nuevoObjetivo.alcance_80_descripcion, alcance_80_fecha: nuevoObjetivo.alcance_80_fecha || null, alcance_100_descripcion: nuevoObjetivo.alcance_100_descripcion, alcance_100_fecha: nuevoObjetivo.alcance_100_fecha || null, alcance_120_descripcion: nuevoObjetivo.alcance_120_descripcion, alcance_120_fecha: nuevoObjetivo.alcance_120_fecha || null }); setNuevoObjetivo({ objetivo: '', corporativo: '', ponderacion: 25, alcance_0_descripcion: '', alcance_0_fecha: '', alcance_80_descripcion: '', alcance_80_fecha: '', alcance_100_descripcion: '', alcance_100_fecha: '', alcance_120_descripcion: '', alcance_120_fecha: '' }); setColaboradorSeleccionado(''); setMostrarForm(false); cargarDatos(); }
  async function agregarHistorico() { if (!colaboradorSeleccionado || !objetivoHistorico.objetivo || !objetivoHistorico.fecha_historica) return alert('Completa todos los campos'); await supabase.from('objetivos').insert({ colaborador_id: colaboradorSeleccionado, objetivo: objetivoHistorico.objetivo, corporativo: objetivoHistorico.corporativo, ponderacion: objetivoHistorico.ponderacion, status: objetivoHistorico.status, es_historico: true, fecha_historica: objetivoHistorico.fecha_historica, alcance_completado: objetivoHistorico.alcance || null, validado_por_gerente: true }); setObjetivoHistorico({ objetivo: '', corporativo: '', ponderacion: 25, fecha_historica: '', alcance: '', status: 'validado' }); setColaboradorSeleccionado(''); setMostrarHistorico(false); cargarDatos(); }
  function exportarExcel() {
    var datos = objetivosFiltrados.map(function(obj, i) { return { 'N°': i+1, 'Colaborador': obj.colaborador?.full_name || '', 'Email': obj.colaborador?.email || '', 'Area': obj.colaborador?.area || '', 'Seniority': obj.colaborador?.seniority || '', 'Objetivo': obj.objetivo, 'Corporativo': obj.corporativo || '', 'Ponderacion': obj.ponderacion + '%', 'Status': obj.status, 'Alcance': obj.alcance_completado || obj.alcance_validado || '', 'Comentario Lider': obj.comentario_lider || '', 'Historico': obj.es_historico ? 'Si' : 'No', 'Fecha': obj.fecha_historica || '' }; });
    if (datos.length === 0) return alert('No hay datos para exportar');
    var csv = Object.keys(datos[0]).join(',') + '\n' + datos.map(function(d) { return Object.values(d).map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'Objetivos_' + new Date().toISOString().slice(0,10) + '.csv'; link.click();
  }

  var areas = ['Todas'].concat([...new Set(colaboradores.map(function(c) { return c.area; }).filter(Boolean))]);
  var seniorities = ['Todos'].concat([...new Set(colaboradores.map(function(c) { return c.seniority; }).filter(Boolean))]);
  var objetivosFiltrados = objetivos.filter(function(obj) { if (filtroArea !== 'Todas' && obj.colaborador?.area !== filtroArea) return false; if (filtroSeniority !== 'Todos' && obj.colaborador?.seniority !== filtroSeniority) return false; return true; });

  if (cargando) return <p>Cargando panel admin...</p>;

  return (
    <div>
      <h2 style={{ color: '#231F20', marginBottom: 20 }}>🔧 Panel Admin - Todos los Objetivos</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filtroArea} onChange={function(e) { setFiltroArea(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las Areas' : a}</option>; })}</select>
        <select value={filtroSeniority} onChange={function(e) { setFiltroSeniority(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{seniorities.map(function(s) { return <option key={s} value={s}>{s === 'Todos' ? 'Todos los Seniority' : s}</option>; })}</select>
        <button onClick={function() { setMostrarForm(!mostrarForm); setMostrarHistorico(false); }} style={{ ...s.btnPrimario, background: '#22c55e' }}>+ Nuevo Objetivo</button>
        <button onClick={function() { setMostrarHistorico(!mostrarHistorico); setMostrarForm(false); }} style={{ ...s.btnPrimario, background: '#8b5cf6' }}>📁 Subir Historico</button>
        <button onClick={exportarExcel} style={{ ...s.btnSecundario, background: '#22c55e', color: 'white', fontWeight: 600 }}>📥 Exportar Excel</button>
      </div>

      {mostrarForm && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}><h4>Asignar Objetivo a Cualquier Colaborador</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={{ fontSize: 12 }}>Colaborador *</label><select value={colaboradorSeleccionado} onChange={function(e) { setColaboradorSeleccionado(e.target.value); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="">Seleccionar...</option>{colaboradores.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} - {c.area}</option>; })}</select></div>
            <div><label style={{ fontSize: 12 }}>Objetivo *</label><input value={nuevoObjetivo.objetivo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, objetivo: e.target.value}); }} placeholder="Describir..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Corporativo</label><input value={nuevoObjetivo.corporativo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, corporativo: e.target.value}); }} placeholder="Ej: Ventas" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Ponderacion (%)</label><select value={nuevoObjetivo.ponderacion} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, ponderacion: parseFloat(e.target.value)}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option><option value="50">50%</option></select></div>
          </div>
          <h5 style={{ margin: '12px 0 8px 0' }}>📊 Alcances</h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: '#fee2e2', padding: 8, borderRadius: 6 }}><label style={{ fontSize: 11, fontWeight: 700, color: '#dc2626' }}>0%</label><input value={nuevoObjetivo.alcance_0_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_0_descripcion: e.target.value}); }} placeholder="Descripcion" style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #fca5a5', fontSize: 11, marginTop: 2 }} /><input type="date" value={nuevoObjetivo.alcance_0_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_0_fecha: e.target.value}); }} style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #fca5a5', fontSize: 11, marginTop: 2 }} /></div>
            <div style={{ background: '#fef3c7', padding: 8, borderRadius: 6 }}><label style={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>80%</label><input value={nuevoObjetivo.alcance_80_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_80_descripcion: e.target.value}); }} placeholder="Descripcion" style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #fcd34d', fontSize: 11, marginTop: 2 }} /><input type="date" value={nuevoObjetivo.alcance_80_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_80_fecha: e.target.value}); }} style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #fcd34d', fontSize: 11, marginTop: 2 }} /></div>
            <div style={{ background: '#dcfce7', padding: 8, borderRadius: 6 }}><label style={{ fontSize: 11, fontWeight: 700, color: '#166534' }}>100%</label><input value={nuevoObjetivo.alcance_100_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_100_descripcion: e.target.value}); }} placeholder="Descripcion" style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #86efac', fontSize: 11, marginTop: 2 }} /><input type="date" value={nuevoObjetivo.alcance_100_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_100_fecha: e.target.value}); }} style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #86efac', fontSize: 11, marginTop: 2 }} /></div>
            <div style={{ background: '#dbeafe', padding: 8, borderRadius: 6 }}><label style={{ fontSize: 11, fontWeight: 700, color: '#1e40af' }}>120%</label><input value={nuevoObjetivo.alcance_120_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_120_descripcion: e.target.value}); }} placeholder="Descripcion" style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #93c5fd', fontSize: 11, marginTop: 2 }} /><input type="date" value={nuevoObjetivo.alcance_120_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_120_fecha: e.target.value}); }} style={{ width: '100%', padding: 4, borderRadius: 4, border: '1px solid #93c5fd', fontSize: 11, marginTop: 2 }} /></div>
          </div>
          <button onClick={agregarObjetivoAdmin} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 12 }}>💾 Guardar</button>
        </div>
      )}

      {mostrarHistorico && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}><h4>Subir Objetivo Historico</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={{ fontSize: 12 }}>Colaborador *</label><select value={colaboradorSeleccionado} onChange={function(e) { setColaboradorSeleccionado(e.target.value); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="">Seleccionar...</option>{colaboradores.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} - {c.area}</option>; })}</select></div>
            <div><label style={{ fontSize: 12 }}>Objetivo *</label><input value={objetivoHistorico.objetivo} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, objetivo: e.target.value}); }} placeholder="Describir..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Fecha Historica *</label><input type="date" value={objetivoHistorico.fecha_historica} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, fecha_historica: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Alcance</label><select value={objetivoHistorico.alcance} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, alcance: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="">-</option><option value="0%">0%</option><option value="80%">80%</option><option value="100%">100%</option><option value="120%">120%</option></select></div>
            <div><label style={{ fontSize: 12 }}>Ponderacion (%)</label><select value={objetivoHistorico.ponderacion} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, ponderacion: parseFloat(e.target.value)}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option><option value="50">50%</option></select></div>
          </div>
          <button onClick={agregarHistorico} style={{ ...s.btnPrimario, background: '#8b5cf6', marginTop: 12 }}>💾 Guardar Historico</button>
        </div>
      )}

      {objetivosFiltrados.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No hay objetivos registrados.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Colaborador</th><th style={{ ...th, color: '#D4D2C6' }}>Area</th><th style={{ ...th, color: '#D4D2C6' }}>Seniority</th><th style={{ ...th, color: '#D4D2C6' }}>Gerente</th><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Alcance</th><th style={{ ...th, color: '#D4D2C6' }}>Historico</th></tr></thead>
            <tbody>{objetivosFiltrados.map(function(obj) { return (
              <tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}><strong>{obj.colaborador?.full_name || '-'}</strong></td><td style={td}>{obj.colaborador?.area || '-'}</td><td style={td}>{obj.colaborador?.seniority || '-'}</td>
                <td style={td}>{obj.gerente?.full_name || '-'}</td><td style={td}>{obj.objetivo}</td><td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{obj.ponderacion}%</td>
                <td style={td}><span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : '#64748b' }}>{obj.status}</span></td>
                <td style={td}>{obj.alcance_completado || obj.alcance_validado || '-'}</td>
                <td style={td}>{obj.es_historico ? '📁 Si' : '-'}</td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RatingDesc({ competenciaId, rating }) { var [desc, setDesc] = useState('...'); useEffect(function() { (async function() { var { data } = await supabase.from('rating_descriptions').select('titulo, descripcion').eq('competencia_id', competenciaId).eq('rating', rating).single(); if (data) setDesc(data.titulo + ': ' + data.descripcion); })(); }, [competenciaId, rating]); return <span>{desc}</span>; }
function SeccionText({ titulo, valor, onChange, disabled }) { return <div style={{ marginBottom: 24 }}><h4 style={s.seccionTitulo}>{titulo}</h4><textarea value={valor} onChange={onChange} style={{ ...s.textarea }} disabled={disabled} readOnly={disabled} /></div>; }

var th = { textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: '11px' };
var td = { padding: '6px 8px', fontSize: '13px' };
var sidebarStyle = { aside: { width: '260px', background: '#231F20', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 0' }, logoContainer: { padding: '0 20px 20px', borderBottom: '1px solid #D4D2C6', marginBottom: 16, textAlign: 'center' }, nav: { display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', flex: 1 }, menuItem: { padding: '14px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, transition: 'all 0.15s', width: '100%' }, subMenuItem: { padding: '10px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 400, transition: 'all 0.15s', width: '100%' }, footer: { padding: '16px 20px', borderTop: '1px solid #D4D2C6' } };
var s = { centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20 }, header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#231F20' }, badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }, btnSalir: { padding: '8px 16px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }, tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }, grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }, seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#231F20', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #D4D2C6' }, competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14, border: '1px solid #e2e8f0' }, btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 }, ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }, ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }, ratingInfoBox: { background: 'white', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #e2e8f0' }, ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 }, textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, btnPrimario: { padding: '12px 24px', background: '#231F20', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, btnSecundario: { padding: '12px 24px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, mensajeToast: { padding: '12px 20px', background: '#D4D2C6', borderRadius: 8, marginBottom: 16, color: '#231F20', fontWeight: 500, fontSize: 14, textAlign: 'center' }, bannerEnviado: { padding: 20, background: '#D4D2C6', borderRadius: 10, color: '#231F20', fontWeight: 600, textAlign: 'center', marginTop: 20 } };
