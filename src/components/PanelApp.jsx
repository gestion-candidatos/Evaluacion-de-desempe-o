import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';

// =============================================
// HELPERS — RATING Y CLASIFICACIÓN (Punto 7)
// =============================================
function calcularRating(ratings) {
  var vals = Object.values(ratings).filter(function(r) { return r > 0; });
  if (vals.length === 0) return null;
  return parseFloat((vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1));
}

function clasificarRating(rating) {
  if (!rating) return null;
  if (rating >= 4.6) return { label: 'Desempeño sobresaliente', color: '#166534', bg: '#dcfce7' };
  if (rating >= 4.0) return { label: 'Supera las expectativas', color: '#1e40af', bg: '#dbeafe' };
  if (rating >= 3.0) return { label: 'Cumple las expectativas', color: '#92400e', bg: '#fef3c7' };
  if (rating >= 2.0) return { label: 'En desarrollo', color: '#c2410c', bg: '#ffedd5' };
  return { label: 'Por debajo de lo esperado', color: '#dc2626', bg: '#fee2e2' };
}

function RatingFinalBadge({ ratings }) {
  var rating = calcularRating(ratings);
  var clas = clasificarRating(rating);
  if (!rating) return null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', background: clas.bg, borderRadius: 12, border: '2px solid ' + clas.color, marginTop: 20, marginBottom: 8 }}>
      <div style={{ textAlign: 'center', minWidth: 60 }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: clas.color }}>{rating}</div>
        <div style={{ fontSize: 10, color: clas.color, fontWeight: 600 }}>RATING</div>
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: clas.color }}>{clas.label}</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Promedio de {Object.values(ratings).filter(function(r) { return r > 0; }).length} competencias evaluadas</div>
      </div>
    </div>
  );
}

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
export default function PanelApp() {
  var [profile, setProfile] = useState(null);
  var [loading, setLoading] = useState(true);
  var [menuActivo, setMenuActivo] = useState('desempeno');
  var [cicloActivo, setCicloActivo] = useState(null);
  var [vistaComoColaborador, setVistaComoColaborador] = useState(false); // Punto 1

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

  var esAdmin = profile.role === 'admin_rrhh';
  var esSuperAdmin = profile.email === 'florencia.salvaneschi@grupo-fabric.com' || profile.email === 'adrian.galvan@grupo-fabric.com';
  var esGerente = profile.seniority === 'Gerente';
  var tieneEquipo = profile.role === 'admin_rrhh' || profile.role === 'lider' || esGerente;

  // Punto 1 — si el admin activó "ver como colaborador", tratarlo como colaborador
  var rolEfectivo = (esAdmin && vistaComoColaborador) ? 'colaborador' : profile.role;
  var nombreRol = rolEfectivo === 'admin_rrhh' ? 'Admin RRHH' : rolEfectivo === 'lider' ? 'Lider' : 'Colaborador';
  var emojiRol = rolEfectivo === 'admin_rrhh' ? '🔧' : rolEfectivo === 'lider' ? '👥' : '👤';
  var profileEfectivo = { ...profile, role: rolEfectivo };

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
              {(profileEfectivo.role === 'admin_rrhh' || esGerente) && <button onClick={function() { setMenuActivo('compania_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'compania_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'compania_obj' ? '#231F20' : '#D4D2C6' }}>🏢 Compañia</button>}
              {esSuperAdmin && !vistaComoColaborador && <button onClick={function() { setMenuActivo('admin_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'admin_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'admin_obj' ? '#231F20' : '#D4D2C6', fontWeight: 600 }}>🔧 Panel Admin</button>}
            </div>
          )}
        </nav>
        <div style={sidebarStyle.footer}><span style={{ fontSize: 12, color: '#D4D2C6' }}>{profile.email}</span><button onClick={cerrarSesion} style={{ ...s.btnSalir, marginTop: 8, width: '100%' }}>Cerrar Sesion</button></div>
      </aside>

      <div style={{ flex: 1, background: '#f8fafc', minHeight: '100vh' }}>
        <header style={s.header}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Punto 1 — botón alternar vista admin/colaborador */}
            {esAdmin && !vistaComoColaborador && (
              <button
                onClick={function() { setVistaComoColaborador(true); setMenuActivo('desempeno'); setCicloActivo(null); }}
                style={{ padding: '6px 14px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
              >
                👤 Ver como Colaborador
              </button>
            )}
            {esAdmin && vistaComoColaborador && (
              <button
                onClick={function() { setVistaComoColaborador(false); setMenuActivo('desempeno'); setCicloActivo(null); }}
                style={{ padding: '6px 14px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}
              >
                🔧 Volver a Admin
              </button>
            )}
            <span style={s.badge}>{emojiRol} {nombreRol}</span>
          </div>
        </header>

        {/* Punto 1 — banner cuando está en modo colaborador */}
        {vistaComoColaborador && (
          <div style={{ padding: '10px 24px', background: '#fef3c7', borderBottom: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>👁️ Estás viendo la plataforma como colaborador. Tus datos reales, sin permisos de admin.</span>
            <button onClick={function() { setVistaComoColaborador(false); setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ padding: '4px 12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Salir</button>
          </div>
        )}

        <main style={{ padding: 24 }}>
          {menuActivo === 'desempeno' && <DesempenoView profile={profileEfectivo} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
          {menuActivo === 'misobjetivos' && <ObjetivosColaborador profile={profile} />}
          {menuActivo === 'miequipo_obj' && <ObjetivosGerente profile={profile} />}
          {menuActivo === 'compania_obj' && <PlaceholderView titulo="🏢 Objetivos de la Compañia" descripcion="Modulo en desarrollo." />}
          {menuActivo === 'admin_obj' && !vistaComoColaborador && <PanelAdminObjetivos profile={profile} />}
        </main>
      </div>
    </div>
  );
}

// =============================================
// VISTAS AUXILIARES
// =============================================
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
// DASHBOARD Y TABLAS ADMIN
// =============================================
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

  async function generarPDFCompleto(d) {
    // ---- Queries frescos ----
    var autoPunts = {}, autoComs = {}, liderPunts = {}, liderComs = {}, compsOrden = [];
    var autoComentFin = '', liderComentFin = '', promAuto = null, promLider = null;

    if (d.autoevaluacion?.id) {
      var { data: ap } = await supabase.from('puntuaciones').select('rating, competencia_id, comentario, competencias(nombre)').eq('evaluacion_id', d.autoevaluacion.id);
      var { data: aev } = await supabase.from('evaluaciones').select('comentarios_finales, rating_promedio').eq('id', d.autoevaluacion.id).single();
      autoComentFin = aev?.comentarios_finales || '';
      promAuto = aev?.rating_promedio || null;
      (ap || []).forEach(function(p) {
        autoPunts[p.competencia_id] = p.rating;
        autoComs[p.competencia_id] = p.comentario || '';
        if (!compsOrden.find(function(c) { return c.id === p.competencia_id; }))
          compsOrden.push({ id: p.competencia_id, nombre: p.competencias?.nombre || 'Competencia' });
      });
    }
    if (d.evaluacionLider?.id) {
      var { data: lp } = await supabase.from('puntuaciones').select('rating, competencia_id, comentario, competencias(nombre)').eq('evaluacion_id', d.evaluacionLider.id);
      var { data: lev } = await supabase.from('evaluaciones').select('comentarios_finales, rating_promedio').eq('id', d.evaluacionLider.id).single();
      liderComentFin = lev?.comentarios_finales || '';
      promLider = lev?.rating_promedio || null;
      (lp || []).forEach(function(p) {
        liderPunts[p.competencia_id] = p.rating;
        liderComs[p.competencia_id] = p.comentario || '';
        if (!compsOrden.find(function(c) { return c.id === p.competencia_id; }))
          compsOrden.push({ id: p.competencia_id, nombre: p.competencias?.nombre || 'Competencia' });
      });
    }

    // ---- Setup PDF ----
    var pdf = new jsPDF();
    var PW = 210; var MX = 12; var y = 28;
    // columnas: izq = auto, der = lider
    var MID = PW / 2;         // 105 — línea divisoria
    var COL_L = MX;           // inicio columna izquierda (auto)
    var COL_R = MID + 3;      // inicio columna derecha (lider)
    var COL_W = MID - MX - 3; // ancho de cada columna ~90mm

    function cab() {
      try { pdf.addImage('/logo.jpg', 'JPEG', MX, 8, 28, 14); } catch(e) {}
      pdf.setDrawColor(212, 210, 198); pdf.setLineWidth(0.4);
      pdf.line(MX, 25, PW - MX, 25);
    }
    function pie() {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor(148, 163, 184);
      pdf.text('Fabric Group  |  ' + new Date().toLocaleDateString('es-AR'), MX, 291);
    }
    function nuevaPag() { pie(); pdf.addPage(); cab(); y = 30; }
    function chk(h) { if (y + h > 278) nuevaPag(); }

    // Normalizar texto para jsPDF helvetica (no soporta tildes)
    function t(str) {
      return (str || '')
        .replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
        .replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u')
        .replace(/[ÁÀÄÂ]/g,'A').replace(/[ÉÈËÊ]/g,'E').replace(/[ÍÌÏÎ]/g,'I')
        .replace(/[ÓÒÖÔ]/g,'O').replace(/[ÚÙÜÛ]/g,'U')
        .replace(/[ñ]/g,'n').replace(/[Ñ]/g,'N')
        .replace(/[^\x00-\x7E]/g,'?');
    }
    function puntCirculo(x, yPos, valor, bgR, bgG, bgB, textR, textG, textB) {
      pdf.setFillColor(bgR, bgG, bgB);
      pdf.circle(x, yPos, 4.5, 'F');
      pdf.setTextColor(textR, textG, textB);
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8);
      var txt = String(valor);
      pdf.text(txt, x - (txt.length > 1 ? 2.5 : 1.5), yPos + 1.2);
    }

    cab();

    // ---- ENCABEZADO ----
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(35, 31, 32);
    pdf.text('EVALUACION DE DESEMPENO', MX, y); y += 7;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(71, 85, 105);
    pdf.text(t('Colaborador: ' + (d.colaborador.full_name || d.colaborador.email)), MX, y); y += 5;
    pdf.text(t('Area: ' + (d.colaborador.area || '-') + '   |   Seniority: ' + (d.colaborador.seniority || '-') + '   |   Fecha: ' + new Date().toLocaleDateString('es-AR')), MX, y); y += 8;

    // ---- CABECERA DE COLUMNAS ----
    chk(12);
    pdf.setFillColor(35, 31, 32);
    pdf.rect(MX, y, COL_W, 8, 'F');
    pdf.rect(MID + 2, y, COL_W, 8, 'F');
    pdf.setTextColor(212, 210, 198); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
    pdf.text('AUTOEVALUACION  (Colaborador)', COL_L + 2, y + 5.5);
    pdf.text('EVALUACION DEL LIDER', COL_R + 2, y + 5.5);
    y += 10;

    // ---- COMPETENCIAS — una por una ----
    var LINE_H = 4.2;
    var FONT_COM = 7;
    var COM_W = COL_W - 4;

    compsOrden.forEach(function(comp, idx) {
      var autoP = autoPunts[comp.id];
      var liderP = liderPunts[comp.id];
      var autoC = autoComs[comp.id] || '';
      var liderC = liderComs[comp.id] || '';

      pdf.setFontSize(FONT_COM);
      var linAuto = pdf.splitTextToSize(t(autoC || 'Sin comentario'), COM_W);
      var linLider = pdf.splitTextToSize(t(liderC || 'Sin comentario'), COM_W);
      var maxLineas = Math.max(linAuto.length, linLider.length);
      // altura cuerpo: fila puntaje 10mm + líneas + padding
      var bloqueH = Math.max(22, 10 + maxLineas * LINE_H + 4);

      chk(bloqueH + 12);

      // nombre competencia ancho total
      pdf.setFillColor(212, 210, 198);
      pdf.rect(MX, y, PW - MX * 2, 7, 'F');
      pdf.setTextColor(35, 31, 32); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
      pdf.text(t(comp.nombre.toUpperCase()), MX + 2, y + 5);

      // fondo cuerpo alternado
      pdf.setFillColor(idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 249 : 255, idx % 2 === 0 ? 247 : 255);
      pdf.rect(MX, y, PW - MX * 2, bloqueH, 'F');

      // línea divisoria vertical
      pdf.setDrawColor(212, 210, 198); pdf.setLineWidth(0.3);
      pdf.line(MID, y, MID, y + bloqueH);

      var yB = y + 2;

      // columna AUTO (izquierda)
      if (autoP) {
        puntCirculo(COL_L + 4.5, yB + 3.5, autoP, 35, 31, 32, 212, 210, 198);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(35, 31, 32);
        pdf.text('Puntaje: ' + autoP, COL_L + 11, yB + 4.5);
      } else {
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184);
        pdf.text('Sin puntaje', COL_L + 2, yB + 4.5);
      }
      pdf.setFont(autoC ? 'helvetica' : 'helvetica', autoC ? 'normal' : 'italic');
      pdf.setFontSize(FONT_COM);
      pdf.setTextColor(autoC ? 71 : 148, autoC ? 85 : 163, autoC ? 105 : 184);
      linAuto.forEach(function(l, i) { pdf.text(t(l), COL_L + 2, yB + 10 + i * LINE_H); });

      // columna LIDER (derecha)
      if (liderP) {
        puntCirculo(COL_R + 4.5, yB + 3.5, liderP, 212, 210, 198, 35, 31, 32);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6.5); pdf.setTextColor(35, 31, 32);
        pdf.text('Puntaje: ' + liderP, COL_R + 11, yB + 4.5);
      } else {
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184);
        pdf.text('Sin puntaje', COL_R + 2, yB + 4.5);
      }
      pdf.setFont(liderC ? 'helvetica' : 'helvetica', liderC ? 'normal' : 'italic');
      pdf.setFontSize(FONT_COM);
      pdf.setTextColor(liderC ? 71 : 148, liderC ? 85 : 163, liderC ? 105 : 184);
      linLider.forEach(function(l, i) { pdf.text(t(l), COL_R + 2, yB + 10 + i * LINE_H); });

      y += bloqueH + 2;
      pdf.setDrawColor(212, 210, 198); pdf.setLineWidth(0.2);
      pdf.line(MX, y, PW - MX, y);
      y += 2;
    });


    y += 4;

    // ---- COMENTARIOS FINALES ----
    if (autoComentFin || liderComentFin) {
      chk(20);
      pdf.setFillColor(35, 31, 32); pdf.rect(MX, y, PW - MX * 2, 7, 'F');
      pdf.setTextColor(212, 210, 198); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
      pdf.text('COMENTARIOS FINALES', MX + 2, y + 5); y += 9;

      if (autoComentFin) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(35, 31, 32);
        pdf.text('Colaborador:', MX, y); y += 4;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(71, 85, 105);
        var lA = pdf.splitTextToSize(t(autoComentFin), PW - MX * 2);
        chk(lA.length * 4 + 3);
        lA.forEach(function(l) { pdf.text(t(l), MX, y); y += 4; });
        y += 3;
      }
      if (liderComentFin) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(35, 31, 32);
        pdf.text('Lider:', MX, y); y += 4;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(71, 85, 105);
        var lL = pdf.splitTextToSize(t(liderComentFin), PW - MX * 2);
        chk(lL.length * 4 + 3);
        lL.forEach(function(l) { pdf.text(t(l), MX, y); y += 4; });
        y += 3;
      }
    }

    // ---- RATINGS RESUMEN + CALIBRADO ----
    chk(52);
    y += 4;
    pdf.setFillColor(35, 31, 32); pdf.rect(MX, y, PW - MX * 2, 7, 'F');
    pdf.setTextColor(212, 210, 198); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
    pdf.text('RESULTADO FINAL', MX + 2, y + 5); y += 10;

    // ratings auto y lider lado a lado
    var clA = clasificarRating(parseFloat(promAuto));
    var clL = clasificarRating(parseFloat(promLider));
    var boxW = (PW - MX * 2 - 4) / 2;
    if (promAuto) {
      pdf.setFillColor(245, 245, 245); pdf.rect(MX, y, boxW, 14, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(35, 31, 32);
      pdf.text('Autoevaluacion', MX + 2, y + 5);
      pdf.setFontSize(14); pdf.text(String(promAuto), MX + 2, y + 12);
      if (clA) { pdf.setFontSize(6); pdf.setTextColor(clA.color.startsWith('#') ? parseInt(clA.color.slice(1,3),16) : 35, clA.color.startsWith('#') ? parseInt(clA.color.slice(3,5),16) : 31, clA.color.startsWith('#') ? parseInt(clA.color.slice(5,7),16) : 32); pdf.text(clA.label, MX + 14, y + 12); }
    }
    if (promLider) {
      pdf.setFillColor(240, 240, 240); pdf.rect(MX + boxW + 4, y, boxW, 14, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(35, 31, 32);
      pdf.text('Evaluacion del Lider', MX + boxW + 6, y + 5);
      pdf.setFontSize(14); pdf.text(String(promLider), MX + boxW + 6, y + 12);
      if (clL) { pdf.setFontSize(6); pdf.setTextColor(clL.color.startsWith('#') ? parseInt(clL.color.slice(1,3),16) : 35, clL.color.startsWith('#') ? parseInt(clL.color.slice(3,5),16) : 31, clL.color.startsWith('#') ? parseInt(clL.color.slice(5,7),16) : 32); pdf.text(clL.label, MX + boxW + 20, y + 12); }
    }
    y += 18;

    // calibrado — grande y centrado
    var rf = d.ratingFinal;
    if (rf) {
      var clCal = clasificarRating(parseFloat(rf));
      pdf.setFillColor(35, 31, 32); pdf.rect(MX, y, PW - MX * 2, 28, 'F');
      pdf.setTextColor(212, 210, 198); pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7); pdf.text('RATING CALIBRADO FINAL', MX + 4, y + 6);
      pdf.setFontSize(28); pdf.text(String(rf), MX + 4, y + 22);
      if (clCal) {
        pdf.setFontSize(10); pdf.setTextColor(255, 255, 255);
        pdf.text(clCal.label, MX + 22, y + 22);
      }
      y += 32;
    } else {
      pdf.setFillColor(245, 245, 245); pdf.rect(MX, y, PW - MX * 2, 12, 'F');
      pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(148, 163, 184);
      pdf.text('Rating calibrado pendiente', MX + 4, y + 8); y += 14;
    }

    if (d.comentarioCalibracion) {
      chk(12);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(71, 85, 105);
      var lJ = pdf.splitTextToSize(t('Justificacion: ' + d.comentarioCalibracion), PW - MX * 2);
      lJ.forEach(function(l) { pdf.text(t(l), MX, y); y += 4; });
    }

    pie();
    return pdf;
  }
  async function verPDF(d) { var pdf = await generarPDFCompleto(d); pdf.save('Evaluacion_' + (d.colaborador.full_name || d.colaborador.email).split(' ').join('_') + '.pdf'); }

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
              var clasifAuto = clasificarRating(parseFloat(d.promAuto));
              var clasifLider = clasificarRating(parseFloat(d.promLider));
              return (
                <tr key={d.colaborador.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td>
                  <td style={td}>{d.colaborador.area || '-'}</td>
                  <td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>{d.colaborador.seniority || '-'}</span></td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{d.promAuto || '-'}</div>
                    {clasifAuto && <div style={{ fontSize: 9, color: clasifAuto.color, fontWeight: 600 }}>{clasifAuto.label}</div>}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>{d.promLider || '-'}</div>
                    {clasifLider && <div style={{ fontSize: 9, color: clasifLider.color, fontWeight: 600 }}>{clasifLider.label}</div>}
                  </td>
                  <td style={{ ...td, textAlign: 'center', fontSize: 14, fontWeight: 700, color: gap ? (Math.abs(gap) <= 0.5 ? '#231F20' : Math.abs(gap) <= 1 ? '#f59e0b' : '#dc2626') : '#94a3b8' }}>{gap ? (gap > 0 ? '+' : '') + gap : '-'}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {d.evaluacionLider && !soloLectura ? (
                      <select value={d.ratingFinal || ''} onChange={function(e) { guardarCal(d.evaluacionLider.id, parseFloat(e.target.value), d.comentarioCalibracion || ''); }} style={{ padding: '6px 10px', borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14, fontWeight: 600, background: 'white' }}>
                        <option value="">Seleccionar</option><option value="1.0">1.0</option><option value="1.1">1.1</option><option value="1.2">1.2</option><option value="1.3">1.3</option><option value="1.4">1.4</option><option value="1.5">1.5</option><option value="1.6">1.6</option><option value="1.7">1.7</option><option value="1.8">1.8</option><option value="1.9">1.9</option><option value="2.0">2.0</option><option value="2.1">2.1</option><option value="2.2">2.2</option><option value="2.3">2.3</option><option value="2.4">2.4</option><option value="2.5">2.5</option><option value="2.6">2.6</option><option value="2.7">2.7</option><option value="2.8">2.8</option><option value="2.9">2.9</option><option value="3.0">3.0</option><option value="3.1">3.1</option><option value="3.2">3.2</option><option value="3.3">3.3</option><option value="3.4">3.4</option><option value="3.5">3.5</option><option value="3.6">3.6</option><option value="3.7">3.7</option><option value="3.8">3.8</option><option value="3.9">3.9</option><option value="4.0">4.0</option><option value="4.1">4.1</option><option value="4.2">4.2</option><option value="4.3">4.3</option><option value="4.4">4.4</option><option value="4.5">4.5</option><option value="4.6">4.6</option><option value="4.7">4.7</option><option value="4.8">4.8</option><option value="4.9">4.9</option><option value="5.0">5.0</option>
                      </select>
                    ) : (
                      <div>
                        <span style={{ fontWeight: 700 }}>{d.ratingFinal || '-'}</span>
                        {clasificarRating(parseFloat(d.ratingFinal)) && <div style={{ fontSize: 9, color: clasificarRating(parseFloat(d.ratingFinal)).color, fontWeight: 600 }}>{clasificarRating(parseFloat(d.ratingFinal)).label}</div>}
                      </div>
                    )}
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

// =============================================
// EQUIPO LIDER
// =============================================
function EquipoLider({ cicloId, profile, soloLectura }) {
  var [equipo, setEquipo] = useState([]); var [colSel, setColSel] = useState(null); var [fbVis, setFbVis] = useState(null);
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() { var { data: { session } } = await supabase.auth.getSession(); if (!session) return; var { data: d } = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', session.user.id); if (!d) return; setEquipo(d); }
  if (colSel) return <EvaluacionLider colaborador={colSel} cicloId={cicloId} onVolver={function() { setColSel(null); cargar(); }} soloLectura={soloLectura} />;
  if (fbVis) return <FeedbackForm feedback={fbVis} cicloId={cicloId} onVolver={function() { setFbVis(null); cargar(); }} />;
  return <div><h3>👥 Mi Equipo ({equipo.length})</h3>{equipo.length === 0 ? <p>No tienes colaboradores.</p> : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{equipo.map(function(c) { return (<div key={c.id} style={{ ...s.tarjetaStat }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}><div style={{ flex: 1 }}><h4>{c.full_name || c.email}</h4><p style={{ color: '#64748b', fontSize: 13 }}>{c.area} · {c.seniority}</p></div><div style={{ display: 'flex', gap: 8 }}><button onClick={function() { setFbVis(c); }} style={{ ...s.btnInfo, background: '#fef3c7', color: '#92400e' }}>💬 FB</button><button onClick={function() { setColSel(c); }} style={s.btnPrimario}>{soloLectura ? '👁️ Ver' : '📝 Evaluar'}</button></div></div></div>); })}</div>}</div>;
}

function FeedbackForm({ feedback: col, cicloId, onVolver }) { var [com, setCom] = useState(''); var [fb, setFb] = useState(null); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data: { session } } = await supabase.auth.getSession(); var { data } = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', col.id).maybeSingle(); if (data) { setFb(data); setCom(data.comentario_lider || ''); } else { await supabase.from('feedback').insert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id }); } setCarg(false); })(); }, []); async function guardar() { var { data: { session } } = await supabase.auth.getSession(); await supabase.from('feedback').upsert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id, comentario_lider: com, fecha_feedback_lider: new Date() }, { onConflict: 'ciclo_id, colaborador_id' }); alert('✅ Guardado'); onVolver(); } if (carg) return <p>Cargando...</p>; return <div style={{ maxWidth: 600 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>💬 Feedback: {col.full_name || col.email}</h3><textarea value={com} onChange={function(e) { setCom(e.target.value); }} placeholder="Deja tu feedback..." style={{ ...s.textarea, minHeight: 120, marginBottom: 12 }} />{fb?.confirmacion_colaborador && <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8, marginBottom: 16 }}>✅ Confirmado</div>}<button onClick={guardar} style={s.btnPrimario}>💾 Guardar</button></div>; }

// =============================================
// EVALUACIÓN LÍDER — con bloqueo post-envío
// =============================================
function EvaluacionLider({ colaborador, cicloId, onVolver, soloLectura }) {
  var [competencias, setComp] = useState([]);
  var [ratings, setRatings] = useState({});
  var [comentarios, setComent] = useState({});
  var [comFin, setComFin] = useState('');
  var [msg, setMsg] = useState('');
  var [carg, setCarg] = useState(true);
  var [autoEval, setAutoEval] = useState(null);
  var [autoPuntsMap, setAutoPuntsMap] = useState({});
  var [evalData, setEvalData] = useState(null);
  var [showInfo, setShowInfo] = useState({});

  useEffect(function() {
    (async function() {
      var [{ data: comps }, { data: { session } }] = await Promise.all([
        supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', colaborador.seniority || 'Analista'),
        supabase.auth.getSession()
      ]);
      setComp(comps || []);

      // Siempre cargar autoevaluacion sin importar el estado
      var { data: ae } = await supabase.from('evaluaciones')
        .select('id, estado, rating_promedio, comentarios_finales')
        .eq('colaborador_id', colaborador.id)
        .eq('tipo_evaluacion', 'autoevaluacion')
        .eq('ciclo_id', cicloId)
        .maybeSingle();
      if (ae) {
        var { data: ap } = await supabase.from('puntuaciones')
          .select('id, rating, comentario, competencia_id, competencias!inner(nombre)')
          .eq('evaluacion_id', ae.id);
        setAutoEval({ ...ae, puntuaciones: ap || [] });
        // mapa rápido: competencia_id -> { rating, comentario }
        var mapa = {};
        (ap || []).forEach(function(p) { mapa[p.competencia_id] = { rating: p.rating, comentario: p.comentario || '' }; });
        setAutoPuntsMap(mapa);
      }

      var { data: liderEval } = await supabase.from('evaluaciones')
        .select('id, estado, comentarios_finales, rating_promedio')
        .eq('colaborador_id', colaborador.id)
        .eq('tipo_evaluacion', 'evaluacion_lider')
        .eq('ciclo_id', cicloId)
        .maybeSingle();
      if (liderEval) {
        setEvalData(liderEval);
        setComFin(liderEval.comentarios_finales || '');
        var { data: punts } = await supabase.from('puntuaciones')
          .select('rating, competencia_id, comentario')
          .eq('evaluacion_id', liderEval.id);
        var rm = {}; var cm = {};
        (punts || []).forEach(function(p) { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; });
        setRatings(rm); setComent(cm);
      } else if (!soloLectura) {
        var { data: nuevo } = await supabase.from('evaluaciones')
          .insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador', ciclo_id: cicloId })
          .select('id').single();
        if (nuevo) setEvalData(nuevo);
      }
      setCarg(false);
    })();
  }, []);

  var yaEnviada = evalData?.estado === 'enviado';
  var bloqueado = soloLectura || yaEnviada;

  async function obtenerOCrearEvalId() {
    if (evalData?.id) return evalData.id;
    var { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle();
    if (ev?.id) { setEvalData(ev); return ev.id; }
    var { data: { session } } = await supabase.auth.getSession();
    var { data: nuevo } = await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador', ciclo_id: cicloId }).select('id').single();
    if (nuevo?.id) { setEvalData(nuevo); return nuevo.id; }
    return null;
  }

  async function guardar() {
    if (bloqueado) return;
    var evId = await obtenerOCrearEvalId();
    if (!evId) { setMsg('Error al guardar'); return; }
    var prom = calcularRating(ratings);
    await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', evId);
    for (var [cid, r] of Object.entries(ratings)) {
      await supabase.from('puntuaciones').upsert({ evaluacion_id: evId, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' });
    }
    setMsg('Guardado'); setTimeout(function() { setMsg(''); }, 2500);
  }

  async function enviar() {
    if (bloqueado) return;
    var evId = await obtenerOCrearEvalId();
    if (!evId) { setMsg('Error al enviar'); return; }
    var prom = calcularRating(ratings);
    await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', evId);
    for (var [cid, r] of Object.entries(ratings)) {
      await supabase.from('puntuaciones').upsert({ evaluacion_id: evId, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' });
    }
    await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', evId);
    setEvalData(function(prev) { return { ...prev, estado: 'enviado' }; });
    setMsg('Evaluacion enviada correctamente');
  }

  if (carg) return <p>Cargando...</p>;

  return (
    <div style={{ maxWidth: 960 }}>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver</button>
      <h3>Evaluando a: {colaborador.full_name || colaborador.email}</h3>
      <p style={{ color: '#64748b' }}>{colaborador.area} - {colaborador.seniority}</p>

      {yaEnviada && (
        <div style={{ padding: 14, background: '#dcfce7', border: '2px solid #166534', borderRadius: 10, marginBottom: 20, textAlign: 'center' }}>
          <strong style={{ color: '#166534', fontSize: 15 }}>Evaluacion enviada. No se puede modificar.</strong>
        </div>
      )}

      {/* Resumen autoevaluacion si existe */}
      {autoEval && (
        <div style={{ background: '#f8fafc', border: '2px solid #D4D2C6', borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0, color: '#231F20' }}>Autoevaluacion del colaborador</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: autoEval.estado === 'enviado' ? '#166534' : '#92400e', fontWeight: 600 }}>
                {autoEval.estado === 'enviado' ? 'Enviada' : 'Borrador'}
              </span>
              {autoEval.rating_promedio && (
                <span style={{ background: '#231F20', color: '#D4D2C6', padding: '4px 12px', borderRadius: 8, fontWeight: 700, fontSize: 16 }}>
                  {autoEval.rating_promedio}
                </span>
              )}
            </div>
          </div>
          {autoEval.comentarios_finales && (
            <p style={{ fontSize: 13, color: '#475569', margin: '0 0 8px 0' }}>
              <strong>Comentarios finales:</strong> {autoEval.comentarios_finales}
            </p>
          )}
        </div>
      )}

      {/* Competencias con autoevaluacion visible al lado */}
      {competencias.map(function(comp) {
        var autoData = autoPuntsMap[comp.id];
        return (
          <div key={comp.id} style={{ ...s.competenciaCard, padding: 0, overflow: 'hidden' }}>
            {/* Cabecera competencia */}
            <div style={{ background: '#D4D2C6', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h5 style={{ margin: 0, color: '#231F20', fontSize: 14 }}>{comp.nombre}</h5>
              <button onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }} style={s.btnInfo}>{showInfo[comp.id] ? 'Ocultar niveles' : 'Ver niveles'}</button>
            </div>
            {showInfo[comp.id] && (
              <div style={{ ...s.ratingInfoBox, margin: 12, marginBottom: 0 }}>
                {[1,2,3,4,5].map(function(r) { return <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>; })}
              </div>
            )}
            {/* Dos columnas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              {/* Columna izquierda: autoevaluacion (solo lectura) */}
              <div style={{ padding: 14, borderRight: '2px solid #e2e8f0', background: '#fafaf8' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Autoevaluacion</p>
                {autoData ? (
                  <>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      {[1,2,3,4,5].map(function(r) {
                        return (
                          <div key={r} style={{ width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, background: autoData.rating === r ? '#231F20' : '#e2e8f0', color: autoData.rating === r ? '#D4D2C6' : '#94a3b8' }}>{r}</div>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 13, color: '#475569', margin: 0, fontStyle: autoData.comentario ? 'normal' : 'italic' }}>
                      {autoData.comentario || 'Sin comentario'}
                    </p>
                  </>
                ) : (
                  <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>Sin autoevaluacion</p>
                )}
              </div>
              {/* Columna derecha: evaluacion lider (editable) */}
              <div style={{ padding: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#231F20', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Mi evaluacion</p>
                <div style={s.ratingRow}>
                  {[1,2,3,4,5].map(function(r) {
                    return (
                      <button key={r} onClick={function() { if (!bloqueado) setRatings({ ...ratings, [comp.id]: r }); }}
                        style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', cursor: bloqueado ? 'default' : 'pointer' }}>
                        {r}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={comentarios[comp.id] || ''}
                  onChange={function(e) { if (!bloqueado) setComent({ ...comentarios, [comp.id]: e.target.value }); }}
                  placeholder="Comentario del lider..."
                  style={{ ...s.textareaSmall, marginTop: 4 }}
                  readOnly={bloqueado}
                />
              </div>
            </div>
          </div>
        );
      })}

      <RatingFinalBadge ratings={ratings} />
      <SeccionText titulo="Comentarios Finales del Lider" valor={comFin} onChange={bloqueado ? function() {} : setComFin} disabled={bloqueado} />
      {msg && <div style={s.mensajeToast}>{msg}</div>}
      {!bloqueado && (
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={guardar} style={s.btnSecundario}>Guardar</button>
          <button onClick={enviar} style={s.btnPrimario}>Enviar evaluacion</button>
        </div>
      )}
    </div>
  );
}

// =============================================
// PANEL COLABORADOR — con bloqueo post-envío
// =============================================
function PanelColaborador({ userId, seniority, cicloId, soloLectura }) {
  var [competencias, setComp] = useState([]);
  var [ratings, setRatings] = useState({});
  var [comentarios, setComent] = useState({});
  var [comFin, setComFin] = useState('');
  var [msg, setMsg] = useState('');
  var [carg, setCarg] = useState(true);
  var [evalLider, setEvalLider] = useState(null);
  var [feedback, setFeedback] = useState(null);
  var [evalData, setEvalData] = useState(null);
  var [showInfo, setShowInfo] = useState({});

  useEffect(function() {
    (async function() {
      var [{ data: comps }, { data: ev }, { data: le }, { data: fb }] = await Promise.all([
        supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', seniority || 'Analista'),
        supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle(),
        supabase.from('evaluaciones').select('id, rating_calibrado, comentario_calibracion').eq('colaborador_id', userId).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(),
        supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', userId).maybeSingle()
      ]);
      setComp(comps || []);
      setEvalLider(le);
      setFeedback(fb);
      if (ev) {
        setEvalData(ev);
        setComFin(ev.comentarios_finales || '');
        var { data: punts } = await supabase.from('puntuaciones').select('rating, competencia_id, comentario').eq('evaluacion_id', ev.id);
        var rm = {}; var cm = {};
        (punts || []).forEach(function(p) { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; });
        setRatings(rm); setComent(cm);
      } else if (!soloLectura) {
        var { data: nuevo } = await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador', ciclo_id: cicloId }).select('id').single();
        if (nuevo) setEvalData(nuevo);
      }
      setCarg(false);
    })();
  }, []);

  var yaEnviada = evalData?.estado === 'enviado';
  var bloqueado = soloLectura || yaEnviada;

  async function guardar() {
    if (bloqueado) return;
    var evId = evalData?.id;
    if (!evId) return;
    var prom = calcularRating(ratings);
    await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', evId);
    for (var [cid, r] of Object.entries(ratings)) {
      await supabase.from('puntuaciones').upsert({ evaluacion_id: evId, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' });
    }
    setMsg('Guardado'); setTimeout(function() { setMsg(''); }, 2500);
  }

  async function enviar() {
    if (bloqueado) return;
    var evId = evalData?.id;
    if (!evId) return;
    var prom = calcularRating(ratings);
    await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', evId);
    for (var [cid, r] of Object.entries(ratings)) {
      await supabase.from('puntuaciones').upsert({ evaluacion_id: evId, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' });
    }
    await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', evId);
    setEvalData(function(prev) { return { ...prev, estado: 'enviado' }; });
    setMsg('Autoevaluacion enviada correctamente');
  }

  if (carg) return <p>Cargando...</p>;

  var clasifCal = clasificarRating(parseFloat(evalLider?.rating_calibrado));

  return (
    <div style={{ maxWidth: 900 }}>
      <h3>Mi Autoevaluacion</h3>
      <p>Seniority: <strong>{seniority || 'No definido'}</strong></p>
      {yaEnviada && (
        <div style={{ padding: 14, background: '#dcfce7', border: '2px solid #166534', borderRadius: 10, marginBottom: 20, textAlign: 'center' }}>
          <strong style={{ color: '#166534', fontSize: 15 }}>Autoevaluacion enviada. No se puede modificar.</strong>
        </div>
      )}
      {feedback && (
        <div style={{ padding: 16, background: feedback.confirmacion_colaborador ? '#dcfce7' : '#fef3c7', borderRadius: 10, marginBottom: 20 }}>
          <h4>Feedback</h4>
          <p>{feedback.comentario_lider || 'Sin comentarios.'}</p>
        </div>
      )}
      {evalLider?.rating_calibrado && (
        <div style={{ padding: 16, background: clasifCal?.bg || '#D4D2C6', borderRadius: 10, marginBottom: 20, textAlign: 'center', border: '2px solid ' + (clasifCal?.color || '#231F20') }}>
          <p style={{ margin: 0, color: clasifCal?.color || '#231F20', fontWeight: 600 }}>Resultado Final Calibrado</p>
          <p style={{ fontSize: 40, fontWeight: 700, margin: '8px 0', color: clasifCal?.color || '#231F20' }}>{evalLider.rating_calibrado}</p>
          {clasifCal && <p style={{ margin: 0, fontSize: 14, color: clasifCal.color, fontWeight: 600 }}>{clasifCal.label}</p>}
        </div>
      )}
      {competencias.map(function(comp) {
        return (
          <div key={comp.id} style={s.competenciaCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div><h5>{comp.nombre}</h5><p style={{ fontSize: 13, color: '#64748b' }}>{comp.descripcion}</p></div>
              <button onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }} style={s.btnInfo}>{showInfo[comp.id] ? 'v' : '>'}</button>
            </div>
            {showInfo[comp.id] && (
              <div style={{ ...s.ratingInfoBox, marginTop: 8 }}>
                {[1,2,3,4,5].map(function(r) { return <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>; })}
              </div>
            )}
            <div style={s.ratingRow}>
              {[1,2,3,4,5].map(function(r) {
                return (
                  <button key={r} onClick={function() { if (!bloqueado) setRatings({ ...ratings, [comp.id]: r }); }}
                    style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', cursor: bloqueado ? 'default' : 'pointer' }}>
                    {r}
                  </button>
                );
              })}
            </div>
            <textarea
              value={comentarios[comp.id] || ''}
              onChange={function(e) { if (!bloqueado) setComent({ ...comentarios, [comp.id]: e.target.value }); }}
              placeholder="Comentario"
              style={s.textareaSmall}
              readOnly={bloqueado}
            />
          </div>
        );
      })}
      <RatingFinalBadge ratings={ratings} />
      <SeccionText titulo="Comentarios Finales" valor={comFin} onChange={bloqueado ? function() {} : setComFin} disabled={bloqueado} />
      {msg && <div style={s.mensajeToast}>{msg}</div>}
      {!bloqueado && (
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={guardar} style={s.btnSecundario}>Guardar</button>
          <button onClick={enviar} style={s.btnPrimario}>Enviar autoevaluacion</button>
        </div>
      )}
    </div>
  );
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
                <td style={td}>{obj.status === 'completado' && <button onClick={function() { setModalValidar(obj.id); }} style={{ ...s.btnPrimario, background: '#f59e0b', fontSize: 12, padding: '6px 12px' }}>Validar</button>}</td>
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
  async function guardarObjetivo() {
    if (!nuevoObjetivo.objetivo) return alert('El objetivo es obligatorio');
    if (editandoId) {
      await supabase.from('objetivos').update({ objetivo: nuevoObjetivo.objetivo, corporativo: nuevoObjetivo.corporativo, ponderacion: nuevoObjetivo.ponderacion, alcance_0_descripcion: nuevoObjetivo.alcance_0_descripcion, alcance_0_fecha: nuevoObjetivo.alcance_0_fecha || null, alcance_80_descripcion: nuevoObjetivo.alcance_80_descripcion, alcance_80_fecha: nuevoObjetivo.alcance_80_fecha || null, alcance_100_descripcion: nuevoObjetivo.alcance_100_descripcion, alcance_100_fecha: nuevoObjetivo.alcance_100_fecha || null, alcance_120_descripcion: nuevoObjetivo.alcance_120_descripcion, alcance_120_fecha: nuevoObjetivo.alcance_120_fecha || null, editado_por_colaborador: true, fecha_edicion: new Date() }).eq('id', editandoId);
    } else {
      await supabase.from('objetivos').insert({ gerente_id: null, colaborador_id: profile.id, objetivo: nuevoObjetivo.objetivo, corporativo: nuevoObjetivo.corporativo, ponderacion: nuevoObjetivo.ponderacion, status: 'pendiente', alcance_0_descripcion: nuevoObjetivo.alcance_0_descripcion, alcance_0_fecha: nuevoObjetivo.alcance_0_fecha || null, alcance_80_descripcion: nuevoObjetivo.alcance_80_descripcion, alcance_80_fecha: nuevoObjetivo.alcance_80_fecha || null, alcance_100_descripcion: nuevoObjetivo.alcance_100_descripcion, alcance_100_fecha: nuevoObjetivo.alcance_100_fecha || null, alcance_120_descripcion: nuevoObjetivo.alcance_120_descripcion, alcance_120_fecha: nuevoObjetivo.alcance_120_fecha || null });
    }
    setNuevoObjetivo({ objetivo: '', corporativo: '', ponderacion: 25, alcance_0_descripcion: '', alcance_0_fecha: '', alcance_80_descripcion: '', alcance_80_fecha: '', alcance_100_descripcion: '', alcance_100_fecha: '', alcance_120_descripcion: '', alcance_120_fecha: '' });
    setMostrarForm(false); setEditandoId(null); cargarObjetivos();
  }
  function editarObjetivo(obj) { setNuevoObjetivo({ objetivo: obj.objetivo, corporativo: obj.corporativo || '', ponderacion: obj.ponderacion, alcance_0_descripcion: obj.alcance_0_descripcion || '', alcance_0_fecha: obj.alcance_0_fecha || '', alcance_80_descripcion: obj.alcance_80_descripcion || '', alcance_80_fecha: obj.alcance_80_fecha || '', alcance_100_descripcion: obj.alcance_100_descripcion || '', alcance_100_fecha: obj.alcance_100_fecha || '', alcance_120_descripcion: obj.alcance_120_descripcion || '', alcance_120_fecha: obj.alcance_120_fecha || '' }); setEditandoId(obj.id); setMostrarForm(true); }
  async function aceptarObjetivo(objId) { await supabase.from('objetivos').update({ status: 'aceptado', confirmado_colaborador: true, fecha_confirmacion: new Date() }).eq('id', objId); cargarObjetivos(); }
  async function completarObjetivo() { if (!alcanceCompletar) return alert('Selecciona un alcance'); if (!justificacionCompletar.trim()) return alert('La justificacion es obligatoria'); await supabase.from('objetivos').update({ status: 'completado', completado_por_colaborador: true, fecha_completado: new Date(), alcance_completado: alcanceCompletar, justificacion_completado: justificacionCompletar }).eq('id', modalCompletar); setModalCompletar(null); setAlcanceCompletar(''); setJustificacionCompletar(''); cargarObjetivos(); }
  if (cargando) return <p>Cargando objetivos...</p>;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: '#231F20', margin: 0 }}>Mis Objetivos</h2>
        <button onClick={function() { setMostrarForm(!mostrarForm); setEditandoId(null); setNuevoObjetivo({ objetivo: '', corporativo: '', ponderacion: 25, alcance_0_descripcion: '', alcance_0_fecha: '', alcance_80_descripcion: '', alcance_80_fecha: '', alcance_100_descripcion: '', alcance_100_fecha: '', alcance_120_descripcion: '', alcance_120_fecha: '' }); }} style={s.btnPrimario}>{mostrarForm ? 'Cancelar' : '+ Nuevo Objetivo'}</button>
      </div>
      {mostrarForm && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <h4>{editandoId ? 'Editar Objetivo' : 'Nuevo Objetivo'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Objetivo *</label><input value={nuevoObjetivo.objetivo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, objetivo: e.target.value}); }} placeholder="Describir el objetivo principal..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Corporativo</label><input value={nuevoObjetivo.corporativo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, corporativo: e.target.value}); }} placeholder="Ej: Ventas, Operaciones..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12, fontWeight: 600 }}>Ponderacion (%)</label><select value={nuevoObjetivo.ponderacion} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, ponderacion: parseFloat(e.target.value)}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option><option value="50">50%</option></select></div>
          </div>
          <h5 style={{ margin: '16px 0 8px 0', color: '#231F20' }}>Alcances del Objetivo</h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: '#fee2e2', padding: 12, borderRadius: 8 }}><label style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>0% - No alcanzado</label><input value={nuevoObjetivo.alcance_0_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_0_descripcion: e.target.value}); }} placeholder="Descripcion" style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #fca5a5', fontSize: 12, marginTop: 4 }} /><input type="date" value={nuevoObjetivo.alcance_0_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_0_fecha: e.target.value}); }} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #fca5a5', fontSize: 12, marginTop: 4 }} /></div>
            <div style={{ background: '#fef3c7', padding: 12, borderRadius: 8 }}><label style={{ fontSize: 12, fontWeight: 700, color: '#92400e' }}>80% - Parcialmente alcanzado</label><input value={nuevoObjetivo.alcance_80_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_80_descripcion: e.target.value}); }} placeholder="Descripcion" style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #fcd34d', fontSize: 12, marginTop: 4 }} /><input type="date" value={nuevoObjetivo.alcance_80_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_80_fecha: e.target.value}); }} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #fcd34d', fontSize: 12, marginTop: 4 }} /></div>
            <div style={{ background: '#dcfce7', padding: 12, borderRadius: 8 }}><label style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>100% - Alcanzado</label><input value={nuevoObjetivo.alcance_100_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_100_descripcion: e.target.value}); }} placeholder="Descripcion" style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #86efac', fontSize: 12, marginTop: 4 }} /><input type="date" value={nuevoObjetivo.alcance_100_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_100_fecha: e.target.value}); }} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #86efac', fontSize: 12, marginTop: 4 }} /></div>
            <div style={{ background: '#dbeafe', padding: 12, borderRadius: 8 }}><label style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>120% - Superado</label><input value={nuevoObjetivo.alcance_120_descripcion || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_120_descripcion: e.target.value}); }} placeholder="Descripcion" style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #93c5fd', fontSize: 12, marginTop: 4 }} /><input type="date" value={nuevoObjetivo.alcance_120_fecha || ''} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_120_fecha: e.target.value}); }} style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid #93c5fd', fontSize: 12, marginTop: 4 }} /></div>
          </div>
          <button onClick={guardarObjetivo} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 16 }}>Guardar Objetivo</button>
        </div>
      )}
      {modalCompletar && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setModalCompletar(null); }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 500, width: '90%' }} onClick={function(e) { e.stopPropagation(); }}>
            <h3 style={{ marginTop: 0 }}>Completar Objetivo</h3>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Alcance Alcanzado *</label><select value={alcanceCompletar} onChange={function(e) { setAlcanceCompletar(e.target.value); }} style={{ width: '100%', padding: 10, borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14 }}><option value="">Seleccionar alcance</option><option value="0%">0% - No alcanzado</option><option value="80%">80% - Parcialmente alcanzado</option><option value="100%">100% - Alcanzado</option><option value="120%">120% - Superado</option></select></div>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Justificacion *</label><textarea value={justificacionCompletar} onChange={function(e) { setJustificacionCompletar(e.target.value); }} placeholder="Explica el resultado alcanzado..." style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} /></div>
            <div style={{ display: 'flex', gap: 12 }}><button onClick={completarObjetivo} style={{ ...s.btnPrimario, background: '#22c55e', flex: 1 }}>Confirmar Completado</button><button onClick={function() { setModalCompletar(null); }} style={{ ...s.btnSecundario }}>Cancelar</button></div>
          </div>
        </div>
      )}
      {objetivos.length === 0 ? (
        <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}><p style={{ color: '#94a3b8', fontSize: 16 }}>No tienes objetivos cargados aun.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Corp.</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Mi Alcance</th><th style={{ ...th, color: '#D4D2C6' }}>Coment. Lider</th><th style={{ ...th, color: '#D4D2C6' }}>Accion</th></tr></thead>
            <tbody>{objetivos.map(function(obj) { return (
              <tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}>{obj.objetivo} {obj.editado_por_colaborador && <span style={{ fontSize: 10, color: '#f59e0b' }}>(editado)</span>}</td>
                <td style={td}>{obj.corporativo || '-'}</td>
                <td style={{ ...td, fontWeight: 700, textAlign: 'center' }}>{obj.ponderacion}%</td>
                <td style={td}><span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : obj.status === 'aceptado' ? '#fef3c7' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : obj.status === 'aceptado' ? '#92400e' : '#64748b' }}>{obj.status}</span></td>
                <td style={td}>{obj.alcance_completado || '-'}</td>
                <td style={td}>{obj.comentario_lider ? obj.comentario_lider.substring(0, 30) + '...' : '-'}</td>
                <td style={td}>
                  {(obj.status === 'pendiente' || obj.status === 'aceptado') && <button onClick={function() { editarObjetivo(obj); }} style={{ ...s.btnInfo, background: '#fef3c7', color: '#92400e', fontSize: 11, padding: '4px 8px', marginRight: 4 }}>Editar</button>}
                  {obj.status === 'pendiente' && <button onClick={function() { aceptarObjetivo(obj.id); }} style={{ ...s.btnPrimario, background: '#3b82f6', fontSize: 12, padding: '6px 12px' }}>Aceptar</button>}
                  {obj.status === 'aceptado' && <button onClick={function() { setModalCompletar(obj.id); }} style={{ ...s.btnPrimario, background: '#f59e0b', fontSize: 12, padding: '6px 12px' }}>Completar</button>}
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
    var datos = objetivosFiltrados.map(function(obj, i) { return { 'N': i+1, 'Colaborador': obj.colaborador?.full_name || '', 'Email': obj.colaborador?.email || '', 'Area': obj.colaborador?.area || '', 'Seniority': obj.colaborador?.seniority || '', 'Objetivo': obj.objetivo, 'Corporativo': obj.corporativo || '', 'Ponderacion': obj.ponderacion + '%', 'Status': obj.status, 'Alcance': obj.alcance_completado || obj.alcance_validado || '', 'Comentario Lider': obj.comentario_lider || '', 'Historico': obj.es_historico ? 'Si' : 'No', 'Fecha': obj.fecha_historica || '' }; });
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
      <h2 style={{ color: '#231F20', marginBottom: 20 }}>Panel Admin - Todos los Objetivos</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filtroArea} onChange={function(e) { setFiltroArea(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las Areas' : a}</option>; })}</select>
        <select value={filtroSeniority} onChange={function(e) { setFiltroSeniority(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{seniorities.map(function(s) { return <option key={s} value={s}>{s === 'Todos' ? 'Todos los Seniority' : s}</option>; })}</select>
        <button onClick={function() { setMostrarForm(!mostrarForm); setMostrarHistorico(false); }} style={{ ...s.btnPrimario, background: '#22c55e' }}>+ Nuevo Objetivo</button>
        <button onClick={function() { setMostrarHistorico(!mostrarHistorico); setMostrarForm(false); }} style={{ ...s.btnPrimario, background: '#8b5cf6' }}>Subir Historico</button>
        <button onClick={exportarExcel} style={{ ...s.btnSecundario, background: '#22c55e', color: 'white', fontWeight: 600 }}>Exportar CSV</button>
      </div>
      {mostrarForm && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <h4>Asignar Objetivo a Colaborador</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={{ fontSize: 12 }}>Colaborador *</label><select value={colaboradorSeleccionado} onChange={function(e) { setColaboradorSeleccionado(e.target.value); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="">Seleccionar...</option>{colaboradores.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} - {c.area}</option>; })}</select></div>
            <div><label style={{ fontSize: 12 }}>Objetivo *</label><input value={nuevoObjetivo.objetivo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, objetivo: e.target.value}); }} placeholder="Describir..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Corporativo</label><input value={nuevoObjetivo.corporativo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, corporativo: e.target.value}); }} placeholder="Ej: Ventas" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Ponderacion (%)</label><select value={nuevoObjetivo.ponderacion} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, ponderacion: parseFloat(e.target.value)}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option><option value="50">50%</option></select></div>
          </div>
          <button onClick={agregarObjetivoAdmin} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 12 }}>Guardar</button>
        </div>
      )}
      {mostrarHistorico && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <h4>Subir Objetivo Historico</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={{ fontSize: 12 }}>Colaborador *</label><select value={colaboradorSeleccionado} onChange={function(e) { setColaboradorSeleccionado(e.target.value); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="">Seleccionar...</option>{colaboradores.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} - {c.area}</option>; })}</select></div>
            <div><label style={{ fontSize: 12 }}>Objetivo *</label><input value={objetivoHistorico.objetivo} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, objetivo: e.target.value}); }} placeholder="Describir..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Fecha Historica *</label><input type="date" value={objetivoHistorico.fecha_historica} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, fecha_historica: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Alcance</label><select value={objetivoHistorico.alcance} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, alcance: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="">-</option><option value="0%">0%</option><option value="80%">80%</option><option value="100%">100%</option><option value="120%">120%</option></select></div>
            <div><label style={{ fontSize: 12 }}>Ponderacion (%)</label><select value={objetivoHistorico.ponderacion} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, ponderacion: parseFloat(e.target.value)}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option><option value="50">50%</option></select></div>
          </div>
          <button onClick={agregarHistorico} style={{ ...s.btnPrimario, background: '#8b5cf6', marginTop: 12 }}>Guardar Historico</button>
        </div>
      )}
      {objetivosFiltrados.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No hay objetivos registrados.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Colaborador</th><th style={{ ...th, color: '#D4D2C6' }}>Area</th><th style={{ ...th, color: '#D4D2C6' }}>Seniority</th><th style={{ ...th, color: '#D4D2C6' }}>Gerente</th><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Alcance</th><th style={{ ...th, color: '#D4D2C6' }}>Historico</th></tr></thead>
            <tbody>{objetivosFiltrados.map(function(obj) { return (
              <tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}><strong>{obj.colaborador?.full_name || '-'}</strong></td>
                <td style={td}>{obj.colaborador?.area || '-'}</td>
                <td style={td}>{obj.colaborador?.seniority || '-'}</td>
                <td style={td}>{obj.gerente?.full_name || '-'}</td>
                <td style={td}>{obj.objetivo}</td>
                <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{obj.ponderacion}%</td>
                <td style={td}><span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : '#64748b' }}>{obj.status}</span></td>
                <td style={td}>{obj.alcance_completado || obj.alcance_validado || '-'}</td>
                <td style={td}>{obj.es_historico ? 'Si' : '-'}</td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DetalleAutoEvaluacion({ autoevaluacion }) {
  if (!autoevaluacion) return <p style={{ padding: 16, color: '#94a3b8' }}>Sin autoevaluacion.</p>;
  var puntuaciones = autoevaluacion.puntuaciones || [];
  var clasif = clasificarRating(parseFloat(autoevaluacion.rating_promedio));
  return (
    <div style={{ marginTop: 16, background: 'white', borderRadius: 12, border: '2px solid #D4D2C6', overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ background: '#231F20', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h4 style={{ margin: 0, color: '#D4D2C6', fontSize: 16 }}>Autoevaluacion del Colaborador</h4>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ color: '#D4D2C6', fontSize: 13 }}>{autoevaluacion.estado === 'enviado' ? 'Enviada' : 'Borrador'}</span>
          <div style={{ textAlign: 'center' }}>
            <span style={{ background: clasif?.bg || '#D4D2C6', color: clasif?.color || '#231F20', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 20 }}>{autoevaluacion.rating_promedio || '-'}</span>
            {clasif && <div style={{ fontSize: 10, color: '#D4D2C6', marginTop: 2 }}>{clasif.label}</div>}
          </div>
        </div>
      </div>
      <div style={{ padding: 20 }}>
        {autoevaluacion.comentarios_finales && <div style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8 }}><strong>Comentarios Finales:</strong><p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>{autoevaluacion.comentarios_finales}</p></div>}
        <h5>Calificacion por Competencia</h5>
        {puntuaciones.length === 0 ? <p style={{ color: '#94a3b8' }}>Sin competencias calificadas.</p> : (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' }}>
            <thead><tr style={{ background: '#231F20' }}><th style={{ padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'left' }}>Competencia</th><th style={{ padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'center', width: 80 }}>Rating</th><th style={{ padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'left' }}>Comentario</th></tr></thead>
            <tbody>{puntuaciones.map(function(p, i) { return (<tr key={p.id || i} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}><td style={{ padding: '12px 16px', fontSize: 14, color: '#231F20', fontWeight: 500 }}>{p.competencias?.nombre || 'ID: ' + p.competencia_id}</td><td style={{ padding: '12px 16px', textAlign: 'center' }}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: '#231F20', color: '#D4D2C6', fontSize: 16, fontWeight: 700 }}>{p.rating}</span></td><td style={{ padding: '12px 16px', fontSize: 13, color: '#475569' }}>{p.comentario || 'Sin comentario'}</td></tr>); })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RatingDesc({ competenciaId, rating }) {
  var [desc, setDesc] = useState('...');
  useEffect(function() { (async function() { var { data } = await supabase.from('rating_descriptions').select('titulo, descripcion').eq('competencia_id', competenciaId).eq('rating', rating).single(); if (data) setDesc(data.titulo + ': ' + data.descripcion); })(); }, [competenciaId, rating]);
  return <span>{desc}</span>;
}

function SeccionText({ titulo, valor, onChange, disabled }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h4 style={s.seccionTitulo}>{titulo}</h4>
      <textarea value={valor} onChange={function(e) { onChange(e.target.value); }} style={{ ...s.textarea }} disabled={disabled} readOnly={disabled} />
    </div>
  );
}

var th = { textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: '11px' };
var td = { padding: '6px 8px', fontSize: '13px' };
var sidebarStyle = { aside: { width: '260px', background: '#231F20', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 0' }, logoContainer: { padding: '0 20px 20px', borderBottom: '1px solid #D4D2C6', marginBottom: 16, textAlign: 'center' }, nav: { display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', flex: 1 }, menuItem: { padding: '14px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, transition: 'all 0.15s', width: '100%' }, subMenuItem: { padding: '10px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 400, transition: 'all 0.15s', width: '100%' }, footer: { padding: '16px 20px', borderTop: '1px solid #D4D2C6' } };
var s = { centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20 }, header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#231F20' }, badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }, btnSalir: { padding: '8px 16px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }, tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }, grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }, seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#231F20', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #D4D2C6' }, competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14, border: '1px solid #e2e8f0' }, btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 }, ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }, ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }, ratingInfoBox: { background: 'white', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #e2e8f0' }, ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 }, textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, btnPrimario: { padding: '12px 24px', background: '#231F20', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, btnSecundario: { padding: '12px 24px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, mensajeToast: { padding: '12px 20px', background: '#D4D2C6', borderRadius: 8, marginBottom: 16, color: '#231F20', fontWeight: 500, fontSize: 14, textAlign: 'center' }, bannerEnviado: { padding: 20, background: '#D4D2C6', borderRadius: 10, color: '#231F20', fontWeight: 600, textAlign: 'center', marginTop: 20 } };
