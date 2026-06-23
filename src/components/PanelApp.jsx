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
  if (rating >= 4.6) return { label: "Desempeño Distinguido", color: "#166534", bg: "#dcfce7" };
  if (rating >= 3.6) return { label: "Excede las Expectativas", color: "#1e40af", bg: "#dbeafe" };
  if (rating >= 2.6) return { label: "Cumple las Expectativas", color: "#92400e", bg: "#fef3c7" };
  if (rating >= 1.6) return { label: "Por Debajo de lo Esperado", color: "#c2410c", bg: "#ffedd5" };
  return { label: "No Adecuado", color: "#dc2626", bg: "#fee2e2" };
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
  var [vistaComoColaborador, setVistaComoColaborador] = useState(false);
  var [modulosActivos, setModulosActivos] = useState([]);

  useEffect(function() { cargarPerfil(); }, []);

  async function cargarPerfil() {
    var { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    var { data: perfil } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, role, activo, leader_id').eq('id', session.user.id).single();
    if (perfil && perfil.activo === false) { await supabase.auth.signOut(); alert('Cuenta desactivada.'); window.location.href = '/'; return; }
    // Admin ve todo siempre
    if (perfil.role === 'admin_rrhh') {
      setModulosActivos(['desempeno', 'obj_individual', 'obj_compania']);
    } else {
      var { data: mods } = await supabase.from('modulos_usuario').select('modulo').eq('user_id', perfil.id).eq('activo', true);
      setModulosActivos((mods || []).map(function(m) { return m.modulo; }));
    }
    setProfile(perfil); setLoading(false);
  }

  async function cerrarSesion() { await supabase.auth.signOut(); window.location.href = '/'; }

  if (loading) return <div style={s.centrado}><p>Cargando...</p></div>;
  if (!profile) return <div style={s.centrado}><h2>Error</h2><button onClick={cerrarSesion} style={s.btnSalir}>Volver</button></div>;

  var esAdmin = profile.role === 'admin_rrhh';
  var esSuperAdmin = profile.email === 'florencia.salvaneschi@grupo-fabric.com' || profile.email === 'adrian.galvan@grupo-fabric.com';
  var esGerente = profile.seniority === 'Gerente';
  var tieneEquipo = profile.role === 'admin_rrhh' || profile.role === 'lider' || esGerente;

  var rolEfectivo = (esAdmin && vistaComoColaborador) ? 'colaborador' : profile.role;
  var nombreRol = rolEfectivo === 'admin_rrhh' ? 'Admin RRHH' : rolEfectivo === 'lider' ? 'Lider' : 'Colaborador';
  var emojiRol = rolEfectivo === 'admin_rrhh' ? '🔧' : rolEfectivo === 'lider' ? '👥' : '👤';
  var profileEfectivo = { ...profile, role: rolEfectivo };

  // Módulos visibles — admin ve todo, resto según tabla
  var modulosVer = esAdmin && !vistaComoColaborador
    ? ['desempeno', 'obj_individual', 'obj_compania']
    : modulosActivos;

  var verDesempeno = modulosVer.includes('desempeno');
  var verObjIndividual = modulosVer.includes('obj_individual');
  var verObjCompania = modulosVer.includes('obj_compania');
  var verAlgunObj = verObjIndividual || verObjCompania;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle.aside}>
        <div style={sidebarStyle.logoContainer}><img src="/logo.jpg" alt="Fabric Group" style={{ height: '40px' }} /></div>
        <nav style={sidebarStyle.nav}>
          {/* DESEMPEÑO */}
          {verDesempeno && (
            <button onClick={function() { setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' }}>DESEMPEÑO</button>
          )}
          {/* OBJETIVOS */}
          {verAlgunObj && (
            <button onClick={function() { setMenuActivo(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj' ? '' : 'objetivos'); }} style={{ ...sidebarStyle.menuItem, background: (menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '#D4D2C6' : 'transparent', color: (menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '#231F20' : '#D4D2C6' }}>OBJETIVOS {(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '▼' : '▶'}</button>
          )}
          {verAlgunObj && (menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') && (
            <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {verObjIndividual && <button onClick={function() { setMenuActivo('misobjetivos'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'misobjetivos' ? '#D4D2C6' : 'transparent', color: menuActivo === 'misobjetivos' ? '#231F20' : '#D4D2C6' }}>Mis Objetivos</button>}
              {verObjIndividual && tieneEquipo && <button onClick={function() { setMenuActivo('miequipo_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'miequipo_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'miequipo_obj' ? '#231F20' : '#D4D2C6' }}>Mi Equipo</button>}
              {verObjCompania && <button onClick={function() { setMenuActivo('compania_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'compania_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'compania_obj' ? '#231F20' : '#D4D2C6' }}>Compañia</button>}
              {esSuperAdmin && !vistaComoColaborador && <button onClick={function() { setMenuActivo('admin_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'admin_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'admin_obj' ? '#231F20' : '#D4D2C6', fontWeight: 600 }}>Panel Admin</button>}
            </div>
          )}
          {esSuperAdmin && !vistaComoColaborador && <button onClick={function() { setMenuActivo("gestion_usuarios"); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === "gestion_usuarios" ? "#D4D2C6" : "transparent", color: menuActivo === "gestion_usuarios" ? "#231F20" : "#D4D2C6", borderTop: "1px solid rgba(212,210,198,0.2)", fontWeight: 600 }}>USUARIOS</button>}
          {esSuperAdmin && !vistaComoColaborador && <button onClick={function() { setMenuActivo("gestion_visibilidad"); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === "gestion_visibilidad" ? "#D4D2C6" : "transparent", color: menuActivo === "gestion_visibilidad" ? "#231F20" : "#D4D2C6", fontWeight: 600 }}>VISIBILIDAD</button>}
          {esSuperAdmin && !vistaComoColaborador && <button onClick={function() { setMenuActivo("gestion_modulos"); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === "gestion_modulos" ? "#D4D2C6" : "transparent", color: menuActivo === "gestion_modulos" ? "#231F20" : "#D4D2C6", marginTop: 8, borderTop: "1px solid rgba(212,210,198,0.2)", fontWeight: 600 }}>MODULOS</button>}
        </nav>
        <div style={sidebarStyle.footer}><span style={{ fontSize: 12, color: '#D4D2C6' }}>{profile.email}</span><button onClick={cerrarSesion} style={{ ...s.btnSalir, marginTop: 8, width: '100%' }}>Cerrar Sesion</button></div>
      </aside>

      <div style={{ flex: 1, background: '#f8fafc', minHeight: '100vh' }}>
        <header style={s.header}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {esAdmin && !vistaComoColaborador && (
              <button onClick={function() { setVistaComoColaborador(true); setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ padding: '6px 14px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                👤 Ver como Colaborador
              </button>
            )}
            {esAdmin && vistaComoColaborador && (
              <button onClick={function() { setVistaComoColaborador(false); setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ padding: '6px 14px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                🔧 Volver a Admin
              </button>
            )}
            <span style={s.badge}>{emojiRol} {profile.puesto || nombreRol}</span>
          </div>
        </header>

        {vistaComoColaborador && (
          <div style={{ padding: '10px 24px', background: '#fef3c7', borderBottom: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>👁️ Estas viendo la plataforma como colaborador.</span>
            <button onClick={function() { setVistaComoColaborador(false); setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ padding: '4px 12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Salir</button>
          </div>
        )}

        <main style={{ padding: 24 }}>
          {menuActivo === 'desempeno' && verDesempeno && <DesempenoView profile={profileEfectivo} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
          {menuActivo === 'misobjetivos' && verObjIndividual && <ObjetivosColaborador profile={profile} />}
          {menuActivo === 'miequipo_obj' && verObjIndividual && <ObjetivosGerente profile={profile} />}
          {menuActivo === 'compania_obj' && verObjCompania && <ObjetivosCompania esAdmin={esAdmin && !vistaComoColaborador} />}
          {menuActivo === 'admin_obj' && !vistaComoColaborador && esSuperAdmin && <PanelAdminObjetivos profile={profile} />}
          {menuActivo === 'gestion_modulos' && !vistaComoColaborador && esSuperAdmin && <GestionModulos />}
          {menuActivo === 'gestion_visibilidad' && !vistaComoColaborador && esSuperAdmin && <GestionVisibilidad />}
          {menuActivo === 'gestion_usuarios' && !vistaComoColaborador && esSuperAdmin && <GestionUsuarios />}
          {!verDesempeno && !verAlgunObj && (
            <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}>
              <p style={{ fontSize: 40, marginBottom: 16 }}>🔒</p>
              <h3 style={{ color: '#231F20' }}>Sin modulos habilitados</h3>
              <p style={{ color: '#64748b' }}>Tu administrador aun no habilitó ningún módulo para tu perfil.</p>
            </div>
          )}
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
      <button onClick={function() { setCicloActivo(null); }} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver a Ciclos</button>
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

function PanelLiderConAutoevaluacion({ cicloId, profile, soloLectura }) { var [v, setV] = useState('equipo'); return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={function() { setV('equipo'); }} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>Mi Equipo</button><button onClick={function() { setV('mievaluacion'); }} style={v === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>Mi Evaluacion</button></div>{v === 'equipo' ? <EquipoLider cicloId={cicloId} profile={profile} soloLectura={soloLectura} /> : <PanelColaborador userId={profile.id} seniority={profile.seniority} puesto={profile.puesto} cicloId={cicloId} soloLectura={soloLectura} />}</div>; }
function CiclosLista({ esAdmin, onSelectCiclo, profile }) {
  var [ciclos, setCiclos] = useState([]); var [carg, setCarg] = useState(true); var [showC, setShowC] = useState(false);
  var [nom, setNom] = useState(''); var [fIni, setFIni] = useState(''); var [fFin, setFFin] = useState('');
  var [cGestion, setCGestion] = useState(null); var [todos, setTodos] = useState([]); var [parts, setParts] = useState([]);
  var esSuperAdmin = profile && (profile.email === 'florencia.salvaneschi@grupo-fabric.com' || profile.email === 'adrian.galvan@grupo-fabric.com');
  useEffect(function() { cargarCiclos(); if (esAdmin) cargarColabs(); }, []);
  async function cargarCiclos() { var { data } = await supabase.from('ciclos').select('*').order('fecha_inicio', { ascending: false }); setCiclos(data || []); setCarg(false); }
  async function cargarColabs() { var { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, role').eq('activo', true).or("role.neq.admin_rrhh,email.eq.florencia.salvaneschi@grupo-fabric.com,email.eq.adrian.galvan@grupo-fabric.com"); setTodos(data || []); }
  async function crearCiclo() { if (!nom || !fIni) return alert('Nombre y fecha obligatorios'); await supabase.from('ciclos').insert({ nombre: nom, fecha_inicio: fIni, fecha_fin: fFin || null, estado: 'activo' }); setNom(''); setFIni(''); setFFin(''); setShowC(false); cargarCiclos(); }
  async function toggleCiclo(ciclo) { await supabase.from('ciclos').update({ estado: ciclo.estado === 'activo' ? 'cerrado' : 'activo' }).eq('id', ciclo.id); cargarCiclos(); }
  async function abrirGestion(ciclo) { setCGestion(ciclo.id); var { data } = await supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', ciclo.id); setParts((data || []).map(function(p) { return p.colaborador_id; })); }
  async function togglePart(cid) { if (parts.includes(cid)) { await supabase.from('ciclo_colaboradores').delete().eq('ciclo_id', cGestion).eq('colaborador_id', cid); setParts(function(p) { return p.filter(function(id) { return id !== cid; }); }); } else { await supabase.from('ciclo_colaboradores').insert({ ciclo_id: cGestion, colaborador_id: cid }); setParts(function(p) { return [...p, cid]; }); } }
  if (carg) return <p style={{ color: '#64748b', padding: 40 }}>Cargando ciclos...</p>;
  var inp = { padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', boxSizing: 'border-box' };
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div><h2 style={{ color: '#231F20', margin: '0 0 4px 0', fontSize: 22, fontWeight: 700 }}>Ciclos de Evaluación de Desempeño</h2><p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>{ciclos.length} ciclo{ciclos.length !== 1 ? 's' : ''} registrado{ciclos.length !== 1 ? 's' : ''}</p></div>
        {esAdmin && <button onClick={function() { setShowC(!showC); }} style={s.btnPrimario}>Nuevo ciclo</button>}
      </div>
      {showC && (<div style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 20, marginBottom: 20 }}><h4 style={{ margin: '0 0 16px 0', color: '#231F20' }}>Crear nuevo ciclo</h4><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}><div style={{ flex: 2, minWidth: 180 }}><label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Nombre *</label><input value={nom} onChange={function(e) { setNom(e.target.value); }} placeholder="Ej: 1er Semestre 2026" style={{ ...inp, width: '100%' }} /></div><div><label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Inicio *</label><input type="date" value={fIni} onChange={function(e) { setFIni(e.target.value); }} style={inp} /></div><div><label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Fin</label><input type="date" value={fFin} onChange={function(e) { setFFin(e.target.value); }} style={inp} /></div><button onClick={crearCiclo} style={{ ...s.btnPrimario, background: '#166534' }}>Crear</button><button onClick={function() { setShowC(false); }} style={s.btnSecundario}>Cancelar</button></div></div>)}
      {cGestion && (<div style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 20, marginBottom: 20 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><div><h4 style={{ margin: 0, color: '#231F20' }}>Seleccionar Participantes</h4><p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>{parts.length} seleccionado{parts.length !== 1 ? 's' : ''}</p></div><button onClick={function() { setCGestion(null); }} style={s.btnInfo}>Cerrar</button></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, maxHeight: 320, overflowY: 'auto' }}>{todos.map(function(c) { var sel = parts.includes(c.id); return (<div key={c.id} onClick={function() { togglePart(c.id); }} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: sel ? '#231F20' : '#F0EDE8', color: sel ? '#D4D2C6' : '#231F20', border: '1px solid ' + (sel ? '#231F20' : '#e8e6e0') }}><div><strong style={{ fontSize: 13, display: 'block' }}>{c.full_name || c.email}</strong><span style={{ fontSize: 11, opacity: 0.7 }}>{c.puesto || c.area}</span></div><span style={{ fontSize: 14, fontWeight: 700 }}>{sel ? '✓' : '○'}</span></div>); })}</div></div>)}
      {ciclos.length === 0 ? (<div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: 'white', borderRadius: 12, border: '1px solid #e8e6e0' }}>No hay ciclos creados.</div>) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
          {ciclos.map(function(ciclo) { var abierto = ciclo.estado === 'activo'; return (
            <div key={ciclo.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderTop: '3px solid ' + (abierto ? '#231F20' : '#D4D2C6'), padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}><h3 style={{ color: '#231F20', margin: 0, fontSize: 17, fontWeight: 700 }}>{ciclo.nombre}</h3><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: abierto ? '#dcfce7' : '#f1f5f9', color: abierto ? '#166534' : '#64748b', flexShrink: 0, marginLeft: 8 }}>{abierto ? 'Abierto' : 'Cerrado'}</span></div>
              <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 4px 0' }}>Inicio: {new Date(ciclo.fecha_inicio).toLocaleDateString('es-AR')}</p>
              {ciclo.fecha_fin && <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 12px 0' }}>Fin: {new Date(ciclo.fecha_fin).toLocaleDateString('es-AR')}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <button onClick={function() { onSelectCiclo(ciclo); }} style={{ ...s.btnPrimario, flex: 1, textAlign: 'center' }}>{ciclo.estado === 'cerrado' && !esAdmin ? 'Ver' : 'Entrar'}</button>
                {esAdmin && <button onClick={function() { abrirGestion(ciclo); }} style={s.btnSecundario}>Participantes</button>}
                {esSuperAdmin && <button onClick={function() { toggleCiclo(ciclo); }} style={{ padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, background: abierto ? '#fee2e2' : '#dcfce7', color: abierto ? '#dc2626' : '#166534' }}>{abierto ? 'Cerrar' : 'Abrir'}</button>}
              </div>
            </div>
          ); })}
        </div>
      )}
    </div>
  );
}


function PanelAdminConEquipo({ profile, cicloId, tieneAutoevaluacion, cicloEstado }) {
  var [vista, setVista] = useState('dashboard'); var [stats, setStats] = useState({ total: 0, enviadas: 0, pendientes: 0 }); var [colabs, setColabs] = useState([]); var [hist, setHist] = useState(null);
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() {
    var [{ count: t }, { count: e }, { data: p }, { data: f }, { data: evs }, { data: punts }] = await Promise.all([
      supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId),
      supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('estado', 'enviado'),
      supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', cicloId),
      supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, role, activo').or('role.neq.admin_rrhh,email.eq.florencia.salvaneschi@grupo-fabric.com,email.eq.adrian.galvan@grupo-fabric.com').eq('activo', true),
      supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, rating_promedio, rating_calibrado, estado').eq('ciclo_id', cicloId),
      supabase.from('puntuaciones').select('evaluacion_id, competencia_id, rating, competencias(nombre)'),
    ]);
    var ids = (p || []).map(function(x) { return x.colaborador_id; });
    var colabsFiltrados = (f || []).filter(function(c) { return ids.includes(c.id); });
    setColabs(colabsFiltrados);
    setStats({ total: t || 0, enviadas: e || 0, pendientes: (t || 0) - (e || 0), evaluaciones: evs || [], puntuaciones: punts || [], perfiles: colabsFiltrados });
  }
  if (hist) return <HistorialAdmin colaborador={hist} onVolver={function() { setHist(null); }} />;
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={function() { setVista('dashboard'); }} style={vista === 'dashboard' ? s.btnPrimario : s.btnInfo}>Dashboard</button>
        <button onClick={function() { setVista('evaluaciones'); }} style={vista === 'evaluaciones' ? s.btnPrimario : s.btnInfo}>Ver Evaluaciones</button>
        <button onClick={function() { setVista('calibracion'); }} style={vista === 'calibracion' ? s.btnPrimario : s.btnInfo}>🎯 Calibracion</button>
        <button onClick={function() { setVista('feedback'); }} style={vista === 'feedback' ? s.btnPrimario : s.btnInfo}>💬 Feedback</button>
        <button onClick={function() { setVista('equipo'); }} style={vista === 'equipo' ? s.btnPrimario : s.btnInfo}>Mi Equipo</button>
        {tieneAutoevaluacion && <button onClick={function() { setVista('mievaluacion'); }} style={vista === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>Mi Evaluacion</button>}
        <button onClick={function() { setVista('colaboradores'); }} style={vista === 'colaboradores' ? s.btnPrimario : s.btnInfo}>Participantes</button>
        <button onClick={function() { setVista('modulos'); }} style={vista === 'modulos' ? s.btnPrimario : s.btnInfo}>Modulos</button>
      </div>
      {vista === 'dashboard' && <DashboardView stats={stats} colabs={colabs} />}
      {vista === 'evaluaciones' && <EvaluacionesAdmin cicloId={cicloId} />}
      {vista === 'calibracion' && <PanelCalibracion cicloId={cicloId} colabs={colabs} onHist={setHist} soloLectura={cicloEstado === 'cerrado'} />}
      {vista === 'feedback' && <FeedbackAdmin cicloId={cicloId} />}
      {vista === 'equipo' && <EquipoLider cicloId={cicloId} profile={profile} soloLectura={false} />}
      {vista === 'mievaluacion' && tieneAutoevaluacion && <PanelColaborador userId={profile.id} seniority={profile.seniority} puesto={profile.puesto} cicloId={cicloId} soloLectura={false} />}
      {vista === 'colaboradores' && <ParticipantesView colabs={colabs} />}
      {vista === 'modulos' && <GestionModulos />}
    </div>
  );
}

function PanelColaboradorConEquipo({ userId, seniority, cicloId, profile, soloLectura }) {
  var [v, setV] = useState('autoevaluacion'); var [tieneEq, setTieneEq] = useState(false); var [part, setPart] = useState(false); var [verif, setVerif] = useState(true);
  useEffect(function() { (async function() { var { data: { session } } = await supabase.auth.getSession(); if (session) { var [{ count: e }, { count: p }] = await Promise.all([supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', session.user.id).eq('activo', true), supabase.from('ciclo_colaboradores').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('colaborador_id', session.user.id)]); setTieneEq((e || 0) > 0); setPart((p || 0) > 0); } setVerif(false); })(); }, [cicloId]);
  if (verif) return <p>Verificando...</p>; if (!part) return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p>No estas participando en este ciclo.</p></div>;
  return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={function() { setV('autoevaluacion'); }} style={v === 'autoevaluacion' ? s.btnPrimario : s.btnInfo}>Mi Evaluacion</button>{tieneEq && <button onClick={function() { setV('equipo'); }} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>Mi Equipo</button>}</div>{v === 'autoevaluacion' ? <PanelColaborador userId={userId} seniority={seniority} puesto={profile?.puesto} cicloId={cicloId} soloLectura={soloLectura} /> : <EquipoLider cicloId={cicloId} profile={profile} soloLectura={soloLectura} />}</div>;
}

// =============================================
// DASHBOARD Y TABLAS ADMIN
// =============================================
function DashboardView({ stats, colabs }) {
  var [filtroArea, setFiltroArea] = useState('Todas');
  var [filtroSeniority, setFiltroSeniority] = useState('Todos');

  var evaluaciones = stats.evaluaciones || [];
  var puntuaciones = stats.puntuaciones || [];
  var perfiles = stats.perfiles || colabs;

  // Opciones de filtro
  var areas = ['Todas'].concat([...new Set(perfiles.map(function(p) { return p.area; }).filter(Boolean))].sort());
  var seniorities = ['Todos'].concat([...new Set(perfiles.map(function(p) { return p.seniority; }).filter(Boolean))].sort());

  // Perfiles filtrados
  var perfilesFiltrados = perfiles.filter(function(p) {
    if (filtroArea !== 'Todas' && p.area !== filtroArea) return false;
    if (filtroSeniority !== 'Todos' && p.seniority !== filtroSeniority) return false;
    return true;
  });
  var idsFiltrados = perfilesFiltrados.map(function(p) { return p.id; });

  // Evaluaciones filtradas
  var evalFiltradas = evaluaciones.filter(function(e) { return idsFiltrados.includes(e.colaborador_id); });

  // Gráfico 1: Distribución Bajo/Medio/Alto
  var evalLider = evalFiltradas.filter(function(e) { return e.tipo_evaluacion === 'evaluacion_lider' && (e.rating_calibrado || e.rating_promedio); });
  var bajo = 0; var medio = 0; var alto = 0;
  evalLider.forEach(function(e) {
    var r = parseFloat(e.rating_calibrado || e.rating_promedio);
    if (r < 3) bajo++; else if (r <= 3.5) medio++; else alto++;
  });
  var totalG1 = bajo + medio + alto;
  var grupos = [
    { label: 'Alto', valor: alto, color: '#166534', rango: '3.6 – 5.0' },
    { label: 'Medio', valor: medio, color: '#92400e', rango: '3.0 – 3.5' },
    { label: 'Bajo', valor: bajo, color: '#dc2626', rango: '1.0 – 2.9' },
  ];

  // Gráfico 2: promedio por competencia (filtrado)
  var evalIdsFiltrados = evalFiltradas.map(function(e) { return e.id; });
  var compMap = {};
  puntuaciones.forEach(function(p) {
    if (!evalIdsFiltrados.includes(p.evaluacion_id)) return;
    var nombre = p.competencias && p.competencias.nombre;
    if (!nombre || !p.rating) return;
    if (!compMap[nombre]) compMap[nombre] = { sum: 0, count: 0 };
    compMap[nombre].sum += parseFloat(p.rating);
    compMap[nombre].count++;
  });
  var compData = Object.entries(compMap).map(function(e) {
    return { nombre: e[0], prom: e[1].sum / e[1].count };
  }).sort(function(a, b) { return b.prom - a.prom; });

  var selectStyle = { padding: '8px 12px', borderRadius: 8, border: '2px solid #D4D2C6', fontSize: 13, background: 'white', color: '#231F20', cursor: 'pointer', fontWeight: 500 };

  return (
    <div>
      {/* KPI Cards */}
      <div style={s.grid}>
        <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Participantes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{perfilesFiltrados.length}</p></div>
        <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>Ver Evaluaciones</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{evalFiltradas.length}</p></div>
        <div style={{ ...s.tarjetaStat, borderTop: '4px solid #231F20' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{evalFiltradas.filter(function(e) { return e.estado === 'enviado'; }).length}</p></div>
        <div style={{ ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{evalFiltradas.filter(function(e) { return e.estado !== 'enviado'; }).length}</p></div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 12, margin: '16px 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#64748b' }}>Filtrar por:</span>
        <select value={filtroArea} onChange={function(e) { setFiltroArea(e.target.value); }} style={selectStyle}>
          {areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las áreas' : a}</option>; })}
        </select>
        <select value={filtroSeniority} onChange={function(e) { setFiltroSeniority(e.target.value); }} style={selectStyle}>
          {seniorities.map(function(s) { return <option key={s} value={s}>{s === 'Todos' ? 'Todos los seniority' : s}</option>; })}
        </select>
        {(filtroArea !== 'Todas' || filtroSeniority !== 'Todos') && (
          <button onClick={function() { setFiltroArea('Todas'); setFiltroSeniority('Todos'); }}
            style={{ fontSize: 12, padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
            ✕ Limpiar filtros
          </button>
        )}
        {(filtroArea !== 'Todas' || filtroSeniority !== 'Todos') && (
          <span style={{ fontSize: 12, color: '#64748b' }}>
            Mostrando {perfilesFiltrados.length} de {perfiles.length} colaboradores
          </span>
        )}
      </div>

      {/* Gráficos */}
      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>

        {/* Gráfico 1 — Distribución */}
        <div style={{ ...s.tarjetaStat, flex: 1, minWidth: 280 }}>
          <h4 style={{ margin: '0 0 6px 0', color: '#231F20', fontSize: 14 }}>Distribución de Desempeño</h4>
          <p style={{ margin: '0 0 16px 0', fontSize: 11, color: '#94a3b8' }}>Bajo: 1–2.9 | Medio: 3–3.5 | Alto: 3.6–5</p>
          {totalG1 === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>Sin evaluaciones calibradas aún</p>
          ) : grupos.map(function(g) {
            var pct = Math.round(g.valor / totalG1 * 100);
            return (
              <div key={g.label} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: g.color }}>{g.label} <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>({g.rango})</span></span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#231F20' }}>{g.valor} <span style={{ color: '#94a3b8', fontWeight: 400 }}>({pct}%)</span></span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 6, height: 24, overflow: 'hidden' }}>
                  <div style={{ background: g.color, height: '100%', width: pct + '%', borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 8, boxSizing: 'border-box' }}>
                    {pct > 15 && <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{pct}%</span>}
                  </div>
                </div>
              </div>
            );
          })}
          {totalG1 > 0 && <p style={{ margin: '12px 0 0 0', fontSize: 12, color: '#64748b', textAlign: 'center' }}>Total: {totalG1} colaboradores</p>}
        </div>

        {/* Gráfico 2 — Promedio por competencia */}
        <div style={{ ...s.tarjetaStat, flex: 2, minWidth: 320 }}>
          <h4 style={{ margin: '0 0 16px 0', color: '#231F20', fontSize: 14 }}>Promedio por Competencia</h4>
          {compData.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>Sin puntuaciones cargadas aún</p>
          ) : compData.map(function(c) {
            var cls = clasificarRating(c.prom);
            var pct = (c.prom / 5) * 100;
            return (
              <div key={c.nombre} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                  <span style={{ fontSize: 13, color: '#231F20', fontWeight: 500 }}>{c.nombre}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {cls && <span style={{ fontSize: 10, fontWeight: 600, color: cls.color }}>{cls.label}</span>}
                    <span style={{ fontSize: 15, fontWeight: 800, color: '#231F20', minWidth: 28, textAlign: 'right' }}>{c.prom.toFixed(1)}</span>
                  </div>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 8, height: 28, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 8, width: pct + '%', background: cls ? cls.color : '#231F20', display: 'flex', alignItems: 'center', paddingLeft: 10, boxSizing: 'border-box', transition: 'width 0.4s ease' }}>
                    {pct > 20 && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>{c.prom.toFixed(1)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ParticipantesView({ colabs }) {
  return (
    <div style={s.tarjetaStat}>
      <h4>Participantes ({colabs.length})</h4>
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
      <h4>Ver Evaluaciones ({evs.length})</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>Colaborador</th><th style={th}>Tipo</th><th style={th}>Estado</th><th style={th}>Rating</th><th style={th}>Calibrado</th><th style={th}>Fecha</th></tr></thead>
        <tbody>{evs.map(function(ev) { return (<tr key={ev.id}><td style={td}>{ev.colaborador?.full_name || '-'}</td><td style={td}>{ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Lider'}</td><td style={td}>{ev.estado}</td><td style={{ ...td, fontWeight: 700 }}>{ev.rating_promedio || '-'}</td><td style={td}>{ev.rating_calibrado || '-'}</td><td style={td}>{new Date(ev.created_at).toLocaleDateString('es-AR')}</td></tr>); })}</tbody>
      </table>
    </div>
  );
}

function PanelCalibracion({ cicloId, colabs, onHist, soloLectura }) {
  var [datos, setDatos] = useState([]); var [carg, setCarg] = useState(true); var [filtro, setFiltro] = useState('Todas'); var [editandoCal, setEditandoCal] = useState(null); var [calTemp, setCalTemp] = useState({ rating: '', comentario: '' });
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() {
    setCarg(true);
    var { data: evs } = await supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, evaluador_id, rating_promedio, rating_calibrado, comentario_calibracion, puntuaciones(rating, competencia_id, comentario, competencias(nombre)), colaborador:colaborador_id(id, email, full_name, area, seniority, puesto)').eq('ciclo_id', cicloId).in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']);
    var mapa = {};
    (evs || []).forEach(function(ev) {
      if (!ev.colaborador) return;
      if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, autoevaluacion: null, evaluacionLider: null, ratingFinal: null, comentarioCalibracion: null, promAuto: null, promLider: null };
      if (ev.tipo_evaluacion === 'autoevaluacion') { mapa[ev.colaborador_id].autoevaluacion = ev; mapa[ev.colaborador_id].promAuto = ev.rating_promedio; }
      if (ev.tipo_evaluacion === 'evaluacion_lider') {
        mapa[ev.colaborador_id].evaluacionLider = ev;
        mapa[ev.colaborador_id].promLider = ev.rating_promedio;
        mapa[ev.colaborador_id].comentarioCalibracion = ev.comentario_calibracion || null;
        // Default: calibrado = rating del lider si no fue editado aun
        var cal = ev.rating_calibrado;
        if (!cal && ev.rating_promedio) {
          cal = ev.rating_promedio;
          // Guardar el default en la base de datos
          supabase.from('evaluaciones').update({ rating_calibrado: cal }).eq('id', ev.id);
        }
        mapa[ev.colaborador_id].ratingFinal = cal;
      }
    });
    setDatos(Object.values(mapa)); setCarg(false);
  }

  async function guardarCal(evaluacionId, rating, comentario, ratingLider) {
    // Si el rating calibrado es igual al del lider, no requiere comentario
    if (parseFloat(rating) !== parseFloat(ratingLider) && !comentario.trim()) {
      alert('Debes justificar por que el rating calibrado difiere del rating del lider.');
      return;
    }
    await supabase.from('evaluaciones').update({ rating_calibrado: rating, comentario_calibracion: comentario }).eq('id', evaluacionId);
    setDatos(function(p) { return p.map(function(d) { return d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating, comentarioCalibracion: comentario } : d; }); });
  }


  async function generarPDFCompleto(d) {
    console.log('=== PDF DEBUG ===');
    console.log('d.autoevaluacion:', d.autoevaluacion);
    console.log('d.evaluacionLider:', d.evaluacionLider);
    console.log('punts auto embebidas:', d.autoevaluacion?.puntuaciones);
    console.log('punts lider embebidas:', d.evaluacionLider?.puntuaciones);

    var autoPunts = {}, autoComs = {}, liderPunts = {}, liderComs = {}, compsOrden = [];
    var autoComentFin = '', liderComentFin = '';
    var promAuto = d.promAuto || null;
    var promLider = d.promLider || null;

    // Siempre hacer queries frescos — no confiar en datos embebidos
    if (d.autoevaluacion?.id) {
      var { data: aev, error: aevErr } = await supabase
        .from('evaluaciones')
        .select('comentarios_finales, rating_promedio')
        .eq('id', d.autoevaluacion.id)
        .single();
      console.log('aev:', aev, 'error:', aevErr);
      autoComentFin = aev?.comentarios_finales || '';
      if (!promAuto) promAuto = aev?.rating_promedio || null;

      var { data: ap, error: apErr } = await supabase
        .from('puntuaciones')
        .select('rating, competencia_id, comentario')
        .eq('evaluacion_id', d.autoevaluacion.id);
      console.log('punts auto fresh:', ap, 'error:', apErr);
      (ap || []).forEach(function(p) {
        autoPunts[p.competencia_id] = p.rating;
        autoComs[p.competencia_id] = p.comentario || '';
      });
    }

    if (d.evaluacionLider?.id) {
      var { data: lev, error: levErr } = await supabase
        .from('evaluaciones')
        .select('comentarios_finales, rating_promedio')
        .eq('id', d.evaluacionLider.id)
        .single();
      console.log('lev:', lev, 'error:', levErr);
      liderComentFin = lev?.comentarios_finales || '';
      if (!promLider) promLider = lev?.rating_promedio || null;

      var { data: lp, error: lpErr } = await supabase
        .from('puntuaciones')
        .select('rating, competencia_id, comentario')
        .eq('evaluacion_id', d.evaluacionLider.id);
      console.log('punts lider fresh:', lp, 'error:', lpErr);
      (lp || []).forEach(function(p) {
        liderPunts[p.competencia_id] = p.rating;
        liderComs[p.competencia_id] = p.comentario || '';
      });
    }

    // Cargar competencias con sus nombres
    var todasIds = [...new Set([...Object.keys(autoPunts), ...Object.keys(liderPunts)])];
    console.log('competencia IDs encontrados:', todasIds);

    if (todasIds.length > 0) {
      var { data: compsData, error: compsErr } = await supabase
        .from('competencias')
        .select('id, nombre')
        .in('id', todasIds);
      console.log('compsData:', compsData, 'error:', compsErr);
      (compsData || []).forEach(function(c) {
        compsOrden.push({ id: c.id, nombre: c.nombre });
      });
    }

    // Fallback si no hay puntuaciones todavía
    if (compsOrden.length === 0) {
      var sen = d.colaborador?.seniority || 'Analista';
      var { data: cFB } = await supabase.from('competencias').select('id, nombre').eq('aplica_a', sen);
      if (!cFB || cFB.length === 0) {
        var { data: cAll } = await supabase.from('competencias').select('id, nombre');
        cFB = cAll || [];
      }
      compsOrden = (cFB || []).map(function(c) { return { id: c.id, nombre: c.nombre }; });
    }

    console.log('=== FINAL compsOrden:', compsOrden);
    console.log('autoPunts:', autoPunts);
    console.log('liderPunts:', liderPunts);
    console.log('autoComs:', autoComs);
    console.log('liderComs:', liderComs);

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
    pdf.text('EVALUACIÓN DE DESEMPEÑO', MX, y); y += 7;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(71, 85, 105);
    pdf.text(t('Colaborador: ' + (d.colaborador.full_name || d.colaborador.email)), MX, y); y += 5;
    pdf.text(t('Puesto: ' + (d.colaborador.puesto || d.colaborador.area || '-') + '   |   Area: ' + (d.colaborador.area || '-') + '   |   Fecha: ' + new Date().toLocaleDateString('es-AR')), MX, y); y += 8;

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
    var LINE_H = 4.5;
    var FONT_COM = 7;
    var COM_W = COL_W - 6;

    compsOrden.forEach(function(comp, idx) {
      var autoP = autoPunts[comp.id];
      var liderP = liderPunts[comp.id];
      var autoC = autoComs[comp.id] || '';
      var liderC = liderComs[comp.id] || '';

      // Calcular lineas antes de dibujar nada
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(FONT_COM);
      var textoAuto = autoC ? t(autoC) : 'Sin comentario';
      var textoLider = liderC ? t(liderC) : 'Sin comentario';
      var linAuto = pdf.splitTextToSize(textoAuto, COM_W);
      var linLider = pdf.splitTextToSize(textoLider, COM_W);
      var maxLineas = Math.max(linAuto.length, linLider.length);

      var cabH = 8;
      var cuerpoH = Math.max(20, 13 + maxLineas * LINE_H + 4);
      var totalH = cabH + cuerpoH;

      chk(totalH + 4);

      var yStart = y;
      var yCuerpo = yStart + cabH;

      // 1. Fondos primero
      pdf.setFillColor(212, 210, 198);
      pdf.rect(MX, yStart, PW - MX * 2, cabH, 'F');

      if (idx % 2 === 0) { pdf.setFillColor(248, 248, 245); } else { pdf.setFillColor(255, 255, 255); }
      pdf.rect(MX, yCuerpo, PW - MX * 2, cuerpoH, 'F');

      // 2. Nombre competencia
      pdf.setTextColor(35, 31, 32); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
      pdf.text(t(comp.nombre.toUpperCase()), MX + 2, yStart + 5.5);

      // 3. Linea divisoria vertical
      pdf.setDrawColor(200, 198, 190); pdf.setLineWidth(0.3);
      pdf.line(MID, yCuerpo, MID, yCuerpo + cuerpoH);

      // 4. Etiquetas columna
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(5.5); pdf.setTextColor(100, 116, 139);
      pdf.text('AUTOEVALUACION', COL_L + 2, yCuerpo + 4);
      pdf.text('EVALUACION LIDER', COL_R + 2, yCuerpo + 4);

      // 5. Puntajes
      var yPunt = yCuerpo + 9;
      if (autoP) {
        puntCirculo(COL_L + 5, yPunt, autoP, 35, 31, 32, 212, 210, 198);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(35, 31, 32);
        pdf.text('' + autoP + ' / 5', COL_L + 12, yPunt + 1.5);
      } else {
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184);
        pdf.text('Sin puntaje', COL_L + 2, yPunt + 1.5);
      }
      if (liderP) {
        puntCirculo(COL_R + 5, yPunt, liderP, 212, 210, 198, 35, 31, 32);
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(35, 31, 32);
        pdf.text('' + liderP + ' / 5', COL_R + 12, yPunt + 1.5);
      } else {
        pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184);
        pdf.text('Sin puntaje', COL_R + 2, yPunt + 1.5);
      }

      // 6. Comentarios — siempre despues de los fondos
      var yComent = yPunt + 8;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(FONT_COM);
      pdf.setTextColor(50, 50, 50);
      linAuto.forEach(function(l, i) { pdf.text(l, COL_L + 2, yComent + i * LINE_H); });
      linLider.forEach(function(l, i) { pdf.text(l, COL_R + 2, yComent + i * LINE_H); });

      y = yStart + totalH + 2;
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
<thead><tr style={{ borderBottom: '2px solid #e8e6e0', background: '#F0EDE8' }}><th style={th}>Colaborador</th><th style={th}>Area</th><th style={th}>Seniority</th><th style={th}>Auto</th><th style={th}>Lider</th><th style={th}>Evaluación Final</th><th style={th}>Justificación</th><th style={th}>Historial</th><th style={th}>PDF</th></tr></thead>
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
                  <td style={{ ...td, textAlign: 'center', minWidth: 140 }}>
                    {d.evaluacionLider ? (
                      <div>
                        {/* Valor */}
                        <div style={{ fontSize: 20, fontWeight: 800, color: '#231F20', lineHeight: 1 }}>
                          {d.ratingFinal || d.promLider || '-'}
                        </div>
                        {clasificarRating(parseFloat(d.ratingFinal || d.promLider)) && (
                          <div style={{ fontSize: 9, color: clasificarRating(parseFloat(d.ratingFinal || d.promLider)).color, fontWeight: 700, marginBottom: 8, marginTop: 2 }}>
                            {clasificarRating(parseFloat(d.ratingFinal || d.promLider)).label}
                          </div>
                        )}
                        {/* Botones acción — solo si no soloLectura */}
                        {!soloLectura && (
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                            {/* Tilde verde — confirmar rating del lider como final */}
                            {editandoCal !== d.colaborador.id && (
                              <button
                                onClick={function() { var _evId = d.evaluacionLider.id; var _pl = d.promLider; guardarCal(_evId, parseFloat(_pl), '', _pl); }}
                                title="Confirmar rating del lider como evaluacion final"
                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #86efac', background: '#dcfce7', color: '#166534', cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                ✓
                              </button>
                            )}
                            {/* Lapiz — abrir edicion */}
                            {editandoCal !== d.colaborador.id && (
                              <button
                                onClick={function() { var _id = d.colaborador.id; setEditandoCal(_id); setCalTemp({ rating: d.ratingFinal || d.promLider || '', comentario: d.comentarioCalibracion || '' }); }}
                                title="Editar evaluacion final"
                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e8e6e0', background: 'white', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                ✏
                              </button>
                            )}
                            {/* Cancelar edicion */}
                            {editandoCal === d.colaborador.id && (
                              <button
                                onClick={function() { setEditandoCal(null); }}
                                title="Cancelar"
                                style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e8e6e0', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                ✕
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>Sin evaluación</span>
                    )}
                  </td>
                  <td style={{ ...td, minWidth: 260 }}>
                    {editandoCal === d.colaborador.id ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <select value={calTemp.rating} onChange={function(e) { setCalTemp({ ...calTemp, rating: e.target.value }); }}
                          style={{ padding: '7px 10px', borderRadius: 8, border: '2px solid #231F20', fontSize: 14, fontWeight: 700, background: 'white' }}>
                          <option value="">Seleccionar</option>
                          {['1.0','1.1','1.2','1.3','1.4','1.5','1.6','1.7','1.8','1.9','2.0','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8','2.9','3.0','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8','3.9','4.0','4.1','4.2','4.3','4.4','4.5','4.6','4.7','4.8','4.9','5.0'].map(function(v) { return <option key={v} value={v}>{v}</option>; })}
                        </select>
                        {parseFloat(calTemp.rating) !== parseFloat(d.promLider) && (
                          <textarea value={calTemp.comentario} onChange={function(e) { setCalTemp({ ...calTemp, comentario: e.target.value }); }}
                            placeholder="Justificación obligatoria si difiere del líder..."
                            style={{ padding: 8, borderRadius: 8, border: '2px solid #f59e0b', fontSize: 12, fontFamily: 'inherit', minHeight: 60, resize: 'vertical', boxSizing: 'border-box', width: '100%' }} />
                        )}
                        {parseFloat(calTemp.rating) === parseFloat(d.promLider) && (
                          <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>Sin cambios — igual al líder, no requiere justificación</p>
                        )}
                        <button
                          onClick={function() {
                            if (!calTemp.rating) return alert('Seleccioná un rating');
                            if (parseFloat(calTemp.rating) !== parseFloat(d.promLider) && !calTemp.comentario.trim()) return alert('La justificación es obligatoria cuando el rating difiere del líder');
                            var _evId = d.evaluacionLider.id; var _r = parseFloat(calTemp.rating); var _c = calTemp.comentario; var _pl = d.promLider;
                            guardarCal(_evId, _r, _c, _pl);
                            setEditandoCal(null);
                          }}
                          style={{ ...s.btnPrimario, background: '#166534', padding: '8px 16px', fontSize: 12 }}>
                          Confirmar
                        </button>
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: d.comentarioCalibracion ? '#475569' : '#94a3b8', fontStyle: d.comentarioCalibracion ? 'normal' : 'italic', wordBreak: 'break-word' }}>
                        {d.comentarioCalibracion || (parseFloat(d.ratingFinal) === parseFloat(d.promLider) ? 'Sin cambios — igual al líder' : '—')}
                      </span>
                    )}
                  </td>
                  <td style={td}><button onClick={function() { onHist && onHist(d.colaborador); }} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>Ver</button></td>
                  <td style={td}><button onClick={function() { verPDF(d); }} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Ver PDF</button></td>
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

function HistorialAdmin({ colaborador, onVolver }) { var [hist, setHist] = useState([]); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data } = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false }); setHist(data || []); setCarg(false); })(); }, []); if (carg) return <p>Cargando...</p>; return <div><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver</button><h3>Ver Historial: {colaborador.full_name || colaborador.email}</h3>{hist.length === 0 ? <p style={{ padding: 40, color: '#94a3b8' }}>Sin historial.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th></tr></thead><tbody>{hist.map(function(h) { return (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={td}>{h.rating_final || '-'}</td></tr>); })}</tbody></table>}</div>; }

// =============================================
// EQUIPO LIDER
// =============================================
function EquipoLider({ cicloId, profile, soloLectura }) {
  var [equipo, setEquipo] = useState([]);
  var [colSel, setColSel] = useState(null);
  var [fbVis, setFbVis] = useState(null);
  var [busqueda, setBusqueda] = useState('');
  var [filtroArea, setFiltroArea] = useState('Todas');
  var [cargando, setCargando] = useState(true);

  useEffect(function() { cargar(); }, [cicloId]);

  async function cargar() {
    var { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    var uid = session.user.id;

    // Ver configuración de visibilidad ampliada
    var { data: visibilidad } = await supabase.from('equipo_visibilidad').select('tipo, valor').eq('lider_id', uid);

    var todosLosColabs = [];

    if (visibilidad && visibilidad.length > 0) {
      var esTodos = visibilidad.some(function(v) { return v.tipo === 'todos'; });
      if (esTodos) {
        // Ve toda la compañía
        var { data: todos } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('activo', true).neq('id', uid).order('full_name');
        todosLosColabs = todos || [];
      } else {
        // Ve áreas específicas
        var areas = visibilidad.filter(function(v) { return v.tipo === 'area'; }).map(function(v) { return v.valor; });
        var usuarios = visibilidad.filter(function(v) { return v.tipo === 'usuario'; }).map(function(v) { return v.valor; });

        var queries = [];
        if (areas.length > 0) {
          var { data: porArea } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('activo', true).in('area', areas).order('full_name');
          queries = queries.concat(porArea || []);
        }
        if (usuarios.length > 0) {
          var { data: porUsuario } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('activo', true).in('id', usuarios);
          queries = queries.concat(porUsuario || []);
        }
        // Deduplicar
        var vistos = {};
        todosLosColabs = queries.filter(function(c) { if (vistos[c.id]) return false; vistos[c.id] = true; return true; });
      }
    }

    // Siempre agregar reportes directos
    var { data: directos } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('leader_id', uid).eq('activo', true);
    (directos || []).forEach(function(c) {
      if (!todosLosColabs.find(function(x) { return x.id === c.id; })) todosLosColabs.push(c);
    });

    todosLosColabs.sort(function(a, b) { return (a.full_name || '').localeCompare(b.full_name || ''); });
    setEquipo(todosLosColabs);
    setCargando(false);
  }

  if (colSel) return <EvaluacionLider colaborador={colSel} cicloId={cicloId} onVolver={function() { setColSel(null); cargar(); }} soloLectura={soloLectura} />;
  if (fbVis) return <FeedbackForm feedback={fbVis} cicloId={cicloId} onVolver={function() { setFbVis(null); cargar(); }} />;

  // Filtros
  var areas = ['Todas'].concat([...new Set(equipo.map(function(c) { return c.area; }).filter(Boolean))].sort());
  var equipoFiltrado = equipo.filter(function(c) {
    if (filtroArea !== 'Todas' && c.area !== filtroArea) return false;
    if (busqueda && !(c.full_name || '').toLowerCase().includes(busqueda.toLowerCase()) && !(c.puesto || '').toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  if (cargando) return <p style={{ color: '#64748b', padding: 20 }}>Cargando equipo...</p>;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#231F20', fontSize: 20, fontWeight: 700 }}>Mi Equipo</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{equipoFiltrado.length} de {equipo.length} colaboradores</p>
        </div>
      </div>

      {/* Buscador y filtros */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          value={busqueda} onChange={function(e) { setBusqueda(e.target.value); }}
          placeholder="Buscar por nombre o puesto..."
          style={{ flex: 2, minWidth: 200, padding: '9px 14px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', boxSizing: 'border-box' }} />
        <select value={filtroArea} onChange={function(e) { setFiltroArea(e.target.value); }}
          style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', minWidth: 160 }}>
          {areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las áreas' : a}</option>; })}
        </select>
        {(busqueda || filtroArea !== 'Todas') && (
          <button onClick={function() { setBusqueda(''); setFiltroArea('Todas'); }} style={{ ...s.btnInfo, color: '#dc2626', borderColor: '#fca5a5' }}>Limpiar</button>
        )}
      </div>

      {/* Lista */}
      {equipoFiltrado.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: 'white', borderRadius: 12, border: '1px solid #e8e6e0' }}>
          {equipo.length === 0 ? 'No tenés colaboradores asignados.' : 'Sin resultados para los filtros seleccionados.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {equipoFiltrado.map(function(c) {
            var iniciales = (c.full_name || c.email || 'U').split(' ').slice(0,2).map(function(p) { return p[0]; }).join('').toUpperCase();
            var esDirecto = c.leader_id === profile.id;
            return (
              <div key={c.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '3px solid ' + (esDirecto ? '#231F20' : '#D4D2C6'), padding: '16px 18px' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#231F20', flexShrink: 0 }}>
                    {iniciales}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong style={{ fontSize: 14, color: '#231F20' }}>{c.full_name || c.email}</strong>
                      {!esDirecto && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: '#F0EDE8', color: '#64748b', fontWeight: 600 }}>Indirecto</span>}
                    </div>
                    <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>{c.puesto || c.area}</p>
                    <p style={{ margin: '1px 0 0 0', fontSize: 11, color: '#94a3b8' }}>{c.area}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={function() { setColSel(c); }} style={{ ...s.btnPrimario, flex: 1, fontSize: 12, padding: '8px 12px', textAlign: 'center' }}>
                    {soloLectura ? 'Ver evaluación' : 'Evaluar'}
                  </button>
                  {esDirecto && (
                    <button onClick={function() { setFbVis(c); }} style={{ ...s.btnSecundario, fontSize: 12, padding: '8px 12px' }}>
                      Feedback
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function FeedbackForm({ feedback: col, cicloId, onVolver }) { var [com, setCom] = useState(''); var [fb, setFb] = useState(null); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data: { session } } = await supabase.auth.getSession(); var { data } = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', col.id).maybeSingle(); if (data) { setFb(data); setCom(data.comentario_lider || ''); } else { await supabase.from('feedback').insert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id }); } setCarg(false); })(); }, []); async function guardar() { var { data: { session } } = await supabase.auth.getSession(); await supabase.from('feedback').upsert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id, comentario_lider: com, fecha_feedback_lider: new Date() }, { onConflict: 'ciclo_id, colaborador_id' }); alert('✅ Guardado'); onVolver(); } if (carg) return <p>Cargando...</p>; return <div style={{ maxWidth: 600 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver</button><h3>💬 Feedback: {col.full_name || col.email}</h3><textarea value={com} onChange={function(e) { setCom(e.target.value); }} placeholder="Deja tu feedback..." style={{ ...s.textarea, minHeight: 120, marginBottom: 12 }} />{fb?.confirmacion_colaborador && <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8, marginBottom: 16 }}>✅ Confirmado</div>}<button onClick={guardar} style={s.btnPrimario}>Guardar</button></div>; }

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
  var [enviada, setEnviada] = useState(false);
  var [showInfo, setShowInfo] = useState({});

  useEffect(function() {
    (async function() {
      // Cargar competencias del seniority del colaborador
      // Si no trae nada (seniority no coincide exactamente), traer todas y deduplicar
      var { data: comps } = await supabase
        .from('competencias')
        .select('id, nombre, descripcion')
        .eq('aplica_a', colaborador.seniority)
        .order('nombre', { ascending: true });
      if (!comps || comps.length === 0) {
        // Fallback: traer todas y deduplicar por nombre
        var { data: todasComps } = await supabase
          .from('competencias').select('id, nombre, descripcion').order('nombre', { ascending: true });
        var vistos = {};
        comps = (todasComps || []).filter(function(c) {
          if (vistos[c.nombre]) return false;
          vistos[c.nombre] = true;
          return true;
        });
        console.log('Fallback — competencias deduplicadas:', comps.length);
      }
      setComp(comps || []);


      var { data: { session } } = await supabase.auth.getSession();


      // Siempre cargar autoevaluacion sin importar el estado
      var { data: ae, error: aeErr } = await supabase.from('evaluaciones')
        .select('id, estado, rating_promedio, comentarios_finales')
        .eq('colaborador_id', colaborador.id)
        .eq('tipo_evaluacion', 'autoevaluacion')
        .eq('ciclo_id', cicloId)
        .maybeSingle();
      if (ae) {
        // Query sin join para máxima compatibilidad
        var { data: ap, error: apErr } = await supabase.from('puntuaciones')
          .select('id, rating, comentario, competencia_id')
          .eq('evaluacion_id', ae.id);
        setAutoEval({ ...ae, puntuaciones: ap || [] });
        var mapa = {};
        (ap || []).forEach(function(p) {
          mapa[p.competencia_id] = { rating: p.rating, comentario: p.comentario || '' };
        });
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
        console.log('Creando evaluacion_lider — colaborador:', colaborador.id, 'evaluador:', session.user.id);
        var { data: nuevo, error: insertErr } = await supabase.from('evaluaciones')
          .insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador', ciclo_id: cicloId })
          .select('id').single();
        if (nuevo) {
          setEvalData(nuevo);
        } else {
          console.error('FALLO insert — probablemente RLS:', insertErr?.message);
          // Intentar buscar si ya existe (race condition)
          var { data: existing } = await supabase.from('evaluaciones')
            .select('id, estado').eq('colaborador_id', colaborador.id)
            .eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle();
          if (existing) { console.log('Encontrada existente:', existing); setEvalData(existing); }
        }
      }
    })();
  }, []);

  var yaEnviada = enviada || evalData?.estado === "enviado";
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

  async function guardarPuntuacionesLider(evId) {
    for (var cid of Object.keys(ratings)) {
      var r = ratings[cid];
      if (!r) continue;
      var { data: ex } = await supabase.from('puntuaciones')
        .select('id').eq('evaluacion_id', evId).eq('competencia_id', cid).maybeSingle();
      if (ex?.id) {
        await supabase.from('puntuaciones')
          .update({ rating: r, comentario: comentarios[cid] || '' }).eq('id', ex.id);
      } else {
        await supabase.from('puntuaciones')
          .insert({ evaluacion_id: evId, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' });
      }
    }
  }

  async function guardar() {
    if (bloqueado) return;
    var evId = await obtenerOCrearEvalId();
    if (!evId) { setMsg('Error al guardar'); return; }
    setMsg('Guardando...');
    var prom = calcularRating(ratings);
    await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', evId);
    await guardarPuntuacionesLider(evId);
    setMsg('Guardado'); setTimeout(function() { setMsg(''); }, 2500);
  }

  async function enviar() {
    if (bloqueado) return;
    var evId = await obtenerOCrearEvalId();
    if (!evId) { setMsg('Error al enviar'); return; }
    setMsg('Enviando...');
    var prom = calcularRating(ratings);
    await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', evId);
    await guardarPuntuacionesLider(evId);
    var { error: envErr } = await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', evId);
    if (envErr) { setMsg('Error al enviar: ' + envErr.message); return; }
    setEvalData(function(prev) { return { ...prev, estado: 'enviado' }; });
    setEnviada(true);
    setMsg('Evaluacion enviada correctamente');
  }



  return (
    <div style={{ maxWidth: 960, width: "100%", overflow: "hidden" }}>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver</button>
      <h3 style={{ color: '#231F20', margin: '0 0 4px 0' }}>Evaluando a: {colaborador.full_name || colaborador.email}</h3>
      <p style={{ color: "#64748b", marginBottom: 20 }}>{[colaborador.puesto, colaborador.area, colaborador.seniority].filter(Boolean).join(" · ")}</p>

      {yaEnviada && (
        <div style={{ padding: 14, background: '#dcfce7', border: '2px solid #166534', borderRadius: 10, marginBottom: 20, textAlign: 'center' }}>
          <strong style={{ color: '#166534', fontSize: 15 }}>Evaluacion enviada. No se puede modificar.</strong>
        </div>
      )}

      {/* Resumen autoevaluacion — solo rating y estado, SIN comentarios finales */}
      {autoEval && (
        <div style={{ background: '#F0EDE8', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 18px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: '#231F20', fontSize: 14 }}>Autoevaluacion del colaborador</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: autoEval.estado === 'enviado' ? '#166534' : '#92400e', fontWeight: 600 }}>
              {autoEval.estado === 'enviado' ? 'Enviada' : 'Borrador'}
            </span>
            {autoEval.rating_promedio && (
              <span style={{ background: '#231F20', color: '#D4D2C6', padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 18 }}>
                {autoEval.rating_promedio}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Competencias */}
      {competencias.map(function(comp) {
        var autoData = autoPuntsMap[comp.id] || null;
        return (
          <div key={comp.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>

            {/* Cabecera con nombre y descripcion */}
            <div style={{ background: '#D4D2C6', padding: '12px 16px' }}>
              <h5 style={{ margin: '0 0 4px 0', color: '#231F20', fontSize: 15 }}>{comp.nombre}</h5>
              {comp.descripcion && <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>{comp.descripcion}</p>}
            </div>

            {/* Niveles desplegables */}
            <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <button
                onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                {showInfo[comp.id] ? '▲ Ocultar niveles' : '▼ Ver niveles de desempeño'}
              </button>
              {showInfo[comp.id] && (
                <div style={{ padding: '0 16px 12px' }}>
                  {[1,2,3,4,5].map(function(r) {
                    return (
                      <div key={r} style={{ padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', background: 'white', border: '1px solid #e2e8f0' }}>
                        <strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>


            {/* Layout: auto arriba (readonly), lider abajo (editable) */}
            <div style={{ padding: 16, overflow: 'hidden' }}>

              {/* Autoevaluacion del colaborador — solo lectura */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 14, overflow: 'hidden', wordBreak: 'break-word' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Autoevaluacion del colaborador
                </p>
                {autoData ? (
                  <div>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {[1,2,3,4,5].map(function(r) {
                        return (
                          <div key={r} style={{
                            width: 38, height: 38, borderRadius: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16, fontWeight: 700,
                            background: autoData.rating === r ? '#231F20' : '#e2e8f0',
                            color: autoData.rating === r ? '#D4D2C6' : '#94a3b8'
                          }}>{r}</div>
                        );
                      })}
                    </div>
                    <div style={{ fontSize: 13, color: "#475569", fontStyle: autoData.comentario ? "normal" : "italic", wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap" }}>
                      {autoData.comentario || 'Sin comentario'}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: '#92400e', fontStyle: 'italic', margin: 0 }}>
                    El colaborador aun no completo esta competencia
                  </p>
                )}
              </div>

              {/* Evaluacion del lider — editable */}
              <div style={{ background: '#fff', border: '2px solid #D4D2C6', borderRadius: 10, padding: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#231F20', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Tu evaluacion
                </p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {[1,2,3,4,5].map(function(r) {
                    return (
                      <button key={r}
                        onClick={function() { if (!bloqueado) setRatings({ ...ratings, [comp.id]: r }); }}
                        style={{
                          width: 42, height: 42, borderRadius: 8, border: '2px solid',
                          borderColor: ratings[comp.id] === r ? '#231F20' : '#e2e8f0',
                          fontSize: 18, fontWeight: 700, cursor: bloqueado ? "default" : "pointer",
                          background: ratings[comp.id] === r ? '#231F20' : '#f8fafc',
                          color: ratings[comp.id] === r ? 'white' : '#475569'
                        }}>
                        {r}
                      </button>
                    );
                  })}
                </div>
                <textarea
                  value={comentarios[comp.id] || ''}
                  onChange={function(e) { if (!bloqueado) setComent({ ...comentarios, [comp.id]: e.target.value }); }}
                  placeholder="Escribe tu comentario sobre esta competencia..."
                  style={{ ...s.textareaSmall, minHeight: 70, background: bloqueado ? "#f8fafc" : "#fff", width: "100%", boxSizing: "border-box" }}
                  readOnly={bloqueado}
                />
              </div>

            </div>
          </div>
        );
      })}


      {/* Rating en tiempo real */}
      <RatingFinalBadge ratings={ratings} />

      {/* Comentarios finales — AL FINAL */}
      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <h4 style={s.seccionTitulo}>Comentarios Finales del Lider</h4>
        <textarea
          value={comFin}
          onChange={function(e) { if (!bloqueado) setComFin(e.target.value); }}
          placeholder="Resumen general de la evaluacion, fortalezas y areas de mejora..."
          style={{ ...s.textarea, minHeight: 120 }}
          disabled={bloqueado}
          readOnly={bloqueado}
        />
      </div>

      {/* Comentarios finales de la autoevaluacion — AL FINAL tambien */}
      {autoEval?.comentarios_finales && (
        <div style={{ marginBottom: 20, padding: 16, background: "#F0EDE8", border: "1px solid #e8e6e0", borderRadius: 10, overflow: "hidden" }}>
          <h4 style={{ margin: '0 0 8px 0', color: '#231F20', fontSize: 14 }}>Comentarios finales del colaborador</h4>
          <p style={{ margin: 0, fontSize: 13, color: "#475569", wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{autoEval.comentarios_finales}</p>
        </div>
      )}

      {msg && <div style={s.mensajeToast}>{msg}</div>}

      {!bloqueado && (
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button onClick={enviar} style={s.btnPrimario}>Enviar evaluacion</button>
        </div>
      )}
    </div>
  );
}

// =============================================
// PANEL COLABORADOR — con bloqueo post-envío
// =============================================
function PanelColaborador({ userId, seniority, puesto, cicloId, soloLectura }) {
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

  async function guardarPuntuaciones(evId) {
    for (var cid of Object.keys(ratings)) {
      var r = ratings[cid];
      if (!r) continue;
      var { data: ex } = await supabase.from('puntuaciones')
        .select('id').eq('evaluacion_id', evId).eq('competencia_id', cid).maybeSingle();
      if (ex?.id) {
        await supabase.from('puntuaciones')
          .update({ rating: r, comentario: comentarios[cid] || '' }).eq('id', ex.id);
      } else {
        await supabase.from('puntuaciones')
          .insert({ evaluacion_id: evId, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' });
      }
    }
  }

  async function guardar() {
    if (bloqueado) return;
    var evId = evalData?.id;
    if (!evId) { setMsg('Error: no se encontro la evaluacion'); return; }
    if (Object.keys(ratings).length === 0) { setMsg('Selecciona al menos un puntaje'); setTimeout(function() { setMsg(''); }, 2500); return; }
    setMsg('Guardando...');
    var prom = calcularRating(ratings);
    await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', evId);
    await guardarPuntuaciones(evId);
    setMsg('Guardado correctamente'); setTimeout(function() { setMsg(''); }, 2500);
  }

  async function enviar() {
    if (bloqueado) return;
    var evId = evalData?.id;
    if (!evId) { setMsg('Error: no se encontro la evaluacion'); return; }
    if (Object.keys(ratings).length === 0) { setMsg('Completa al menos una competencia antes de enviar'); return; }
    setMsg('Enviando...');
    var prom = calcularRating(ratings);
    await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', evId);
    await guardarPuntuaciones(evId);
    var { error: envErr } = await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', evId);
    if (envErr) { setMsg('Error al enviar: ' + envErr.message); return; }
    setEvalData(function(prev) { return { ...prev, estado: 'enviado' }; });
    setMsg('Autoevaluacion enviada correctamente');
  }


  if (carg) return <p>Cargando...</p>;

  var clasifCal = clasificarRating(parseFloat(evalLider?.rating_calibrado));

  return (
    <div style={{ maxWidth: 900, width: "100%", overflow: "hidden" }}>
      <h3>Mi Autoevaluacion</h3>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>{[puesto, seniority].filter(Boolean).join(" · ") || "Sin cargo definido"}</p>
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
              style={{ ...s.textareaSmall, width: "100%", boxSizing: "border-box", maxWidth: "100%" }}
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
  async function cargarEquipo() { var { data: { session } } = await supabase.auth.getSession(); if (!session) return; var { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto').eq('leader_id', session.user.id).eq('activo', true); setEquipo(data || []); setCargando(false); }
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
  var [objetivos, setObjetivos] = useState([]);
  var [cargando, setCargando] = useState(true);
  var [modalValidarObj, setModalValidarObj] = useState(null); // obj completo
  var [modalValidarAlcance, setModalValidarAlcance] = useState(null); // obj completo
  var [accion, setAccion] = useState('');
  var [comentario, setComentario] = useState('');
  var [alcanceLider, setAlcanceLider] = useState('');
  var [comentValidacion, setComentValidacion] = useState('');
  var [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);
  var [formObj, setFormObj] = useState(null);

  var FORM_VACIO = { objetivo: '', corporativo: '', ponderacion: '', alcance_tipo: 'fecha',
    
    alcance_80_descripcion: '', alcance_80_fecha: '', alcance_80_meta: '',
    alcance_100_descripcion: '', alcance_100_fecha: '', alcance_100_meta: '',
    alcance_120_descripcion: '', alcance_120_fecha: '', alcance_120_meta: '' };

  useEffect(function() { cargarObjetivos(); }, []);

  async function cargarObjetivos() {
    var { data } = await supabase.from('objetivos').select('*').eq('colaborador_id', colaborador.id).order('created_at', { ascending: false });
    setObjetivos(data || []); setCargando(false);
  }

  // Validar objetivo (aprobar definicion o rechazar)
  async function ejecutarValidacionObj() {
    if (!accion) return alert('Selecciona una accion');
    if (!comentario.trim()) return alert('El comentario es obligatorio');
    var nuevoStatus = accion === 'aprobar' ? 'pendiente' : 'rechazado';
    await supabase.from('objetivos').update({
      status: nuevoStatus,
      validado_por_gerente: accion === 'aprobar',
      comentario_lider: comentario,
      comentario_rechazo_lider: accion === 'rechazar' ? comentario : null,
      fecha_validacion: new Date()
    }).eq('id', modalValidarObj.id);
    setModalValidarObj(null); setAccion(''); setComentario('');
    cargarObjetivos();
  }

  // Validar alcance reportado por el colaborador
  async function ejecutarValidacionAlcance() {
    if (!alcanceLider) return alert('Selecciona el alcance validado');
    if (!comentValidacion.trim()) return alert('El comentario es obligatorio');
    var pond = parseFloat(modalValidarAlcance.ponderacion) || 0;
    await supabase.from('objetivos').update({
      status: 'validado',
      validado_por_gerente: true,
      alcance_validado: alcanceLider,
      comentario_validacion_lider: comentValidacion,
      fecha_validacion_lider: new Date(),
      ponderacion_final: pond * parseFloat(alcanceLider) / 100
    }).eq('id', modalValidarAlcance.id);
    setModalValidarAlcance(null); setAlcanceLider(''); setComentValidacion('');
    cargarObjetivos();
  }

  async function guardarNuevoObjetivo(datosForm) {
    var { data: { session } } = await supabase.auth.getSession();
    var datos = {
      objetivo: datosForm.objetivo, corporativo: datosForm.corporativo,
      ponderacion: parseFloat(datosForm.ponderacion), alcance_tipo: datosForm.alcance_tipo,
      
      alcance_80_descripcion: datosForm.alcance_80_descripcion, alcance_80_fecha: datosForm.alcance_80_fecha || null, alcance_80_meta: datosForm.alcance_80_meta,
      alcance_100_descripcion: datosForm.alcance_100_descripcion, alcance_100_fecha: datosForm.alcance_100_fecha || null, alcance_100_meta: datosForm.alcance_100_meta,
      alcance_120_descripcion: datosForm.alcance_120_descripcion, alcance_120_fecha: datosForm.alcance_120_fecha || null, alcance_120_meta: datosForm.alcance_120_meta,
      colaborador_id: colaborador.id, gerente_id: session.user.id, status: "pendiente", leader_id: colaborador.leader_id || null,
    };
    await supabase.from('objetivos').insert(datos);
    setMostrarFormNuevo(false); setFormObj(null); cargarObjetivos();
  }

  // Calcular alcance total ponderado
  var objValidados = objetivos.filter(function(o) { return o.status === 'validado' && o.alcance_validado; });
  var alcanceTotal = null;
  if (objValidados.length > 0) {
    var sumaPond = objValidados.reduce(function(s, o) { return s + parseFloat(o.ponderacion); }, 0);
    var sumaAlc = objValidados.reduce(function(s, o) { return s + parseFloat(o.alcance_validado) * parseFloat(o.ponderacion); }, 0);
    alcanceTotal = sumaPond > 0 ? (sumaAlc / sumaPond).toFixed(1) : null;
  }
  var totalPond = objetivos.filter(function(o) { return o.status !== 'rechazado'; })
    .reduce(function(s, o) { return s + (parseFloat(o.ponderacion) || 0); }, 0);

  if (cargando) return <p>Cargando...</p>;

  var ALCANCES_VALIDAR = [
    { valor: '80', label: '80%', color: '#92400e', bg: '#fef3c7' },
    { valor: '100', label: '100%', color: '#166534', bg: '#dcfce7' },
    { valor: '120', label: '120%', color: '#1e40af', bg: '#dbeafe' },
  ];

  return (
    <div>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver al equipo</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ color: '#231F20', margin: '0 0 4px 0' }}>Objetivos — {colaborador.full_name || colaborador.email}</h2>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: totalPond === 100 ? '#166534' : '#64748b', fontWeight: 600 }}>
              Ponderacion total: {totalPond.toFixed(0)}% {totalPond === 100 ? '✅' : ''}
            </span>
            {alcanceTotal && (
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '4px 12px', borderRadius: 8 }}>
                Alcance anual: {alcanceTotal}%
              </span>
            )}
          </div>
        </div>
        <button onClick={function() { setFormObj({ ...FORM_VACIO, ponderacion: Math.max(0, 100 - totalPond) }); setMostrarFormNuevo(true); }} style={{ ...s.btnPrimario, background: '#22c55e', fontSize: 13 }}>
          + Agregar objetivo
        </button>
      </div>

      {mostrarFormNuevo && formObj && (
        <FormObjetivo valor={formObj} onChange={setFormObj} objetivos={objetivos} editandoId={null}
          titulo={'Nuevo objetivo para ' + (colaborador.full_name || colaborador.email)}
          onGuardar={guardarNuevoObjetivo}
          onCancelar={function() { setMostrarFormNuevo(false); setFormObj(null); }} />
      )}

      {/* Modal validar definicion de objetivo */}
      {modalValidarObj && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setModalValidarObj(null); }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 500, width: '90%' }} onClick={function(e) { e.stopPropagation(); }}>
            <h3 style={{ marginTop: 0 }}>Validar definicion de objetivo</h3>
            <p style={{ color: '#64748b', fontSize: 14 }}><strong>{modalValidarObj.objetivo}</strong></p>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Accion *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={function() { setAccion('aprobar'); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: '2px solid', borderColor: accion === 'aprobar' ? '#166534' : '#e2e8f0', background: accion === 'aprobar' ? '#dcfce7' : 'white', cursor: 'pointer', fontWeight: 600, color: '#166534' }}>Aprobar</button>
                <button onClick={function() { setAccion('rechazar'); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: '2px solid', borderColor: accion === 'rechazar' ? '#dc2626' : '#e2e8f0', background: accion === 'rechazar' ? '#fee2e2' : 'white', cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}>Rechazar</button>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Comentario *</label>
              <textarea value={comentario} onChange={function(e) { setComentario(e.target.value); }} placeholder="Explicá tu decisión..." style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 8, border: '2px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={ejecutarValidacionObj} style={{ ...s.btnPrimario, background: accion === 'aprobar' ? '#22c55e' : '#dc2626', flex: 1 }}>Confirmar</button>
              <button onClick={function() { setModalValidarObj(null); setAccion(''); setComentario(''); }} style={s.btnSecundario}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal validar alcance reportado */}
      {modalValidarAlcance && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setModalValidarAlcance(null); }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 520, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={function(e) { e.stopPropagation(); }}>
            <h3 style={{ marginTop: 0 }}>Validar alcance reportado</h3>
            <p style={{ fontSize: 14, color: '#231F20' }}><strong>{modalValidarAlcance.objetivo}</strong></p>
            <div style={{ background: '#f8fafc', border: '1px solid #D4D2C6', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 13 }}><strong>Colaborador reportó:</strong> {modalValidarAlcance.alcance_completado}%</p>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#475569' }}>{modalValidarAlcance.justificacion_completado}</p>
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>¿Qué alcance validás?</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
              {ALCANCES_VALIDAR.map(function(a) {
                var sel = alcanceLider === a.valor;
                return (
                  <button key={a.valor} onClick={function() { setAlcanceLider(a.valor); }}
                    style={{ padding: '14px 8px', borderRadius: 10, cursor: 'pointer', border: '2px solid', borderColor: sel ? a.color : '#e2e8f0', background: sel ? a.bg : 'white', fontWeight: 700, fontSize: 18, color: a.color }}>
                    {a.label}
                  </button>
                );
              })}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Comentario de validación *</label>
              <textarea value={comentValidacion} onChange={function(e) { setComentValidacion(e.target.value); }} placeholder="Justificá el alcance validado..." style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 8, border: '2px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={ejecutarValidacionAlcance} style={{ ...s.btnPrimario, background: '#22c55e', flex: 1 }}>Confirmar validacion</button>
              <button onClick={function() { setModalValidarAlcance(null); setAlcanceLider(''); setComentValidacion(''); }} style={s.btnSecundario}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {objetivos.length === 0 ? (
        <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Sin objetivos cargados.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {objetivos.map(function(obj) {
            var statusColor = { validado: '#166534', completado: '#1e40af', aceptado: '#92400e', rechazado: '#dc2626', pendiente: '#64748b' };
            var statusBg = { validado: '#dcfce7', completado: '#dbeafe', aceptado: '#fef3c7', rechazado: '#fee2e2', pendiente: '#f1f5f9' };
            return (
              <div key={obj.id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                      <strong style={{ fontSize: 15 }}>{obj.objetivo}</strong>
                      <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: statusBg[obj.status] || '#f1f5f9', color: statusColor[obj.status] || '#64748b' }}>{obj.status}</span>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{obj.ponderacion}%</span>
                    </div>
                    {obj.corporativo && <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>Corporativo: {obj.corporativo}</p>}
                    {obj.comentario_lider && <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#475569', fontStyle: 'italic' }}>Tu comentario: {obj.comentario_lider}</p>}
                    {obj.alcance_completado && (
                      <div style={{ marginTop: 8, padding: '8px 12px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: '#0369a1' }}>Colaborador reportó: {obj.alcance_completado}%</p>
                        <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#475569' }}>{obj.justificacion_completado}</p>
                      </div>
                    )}
                    {obj.alcance_validado && <p style={{ margin: '4px 0 0 0', fontSize: 12, fontWeight: 700, color: '#166534' }}>✅ Alcance validado: {obj.alcance_validado}%</p>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {obj.status === 'pendiente' && !obj.validado_por_gerente && (
                      <button onClick={function() { setModalValidarObj(obj); setAccion(''); setComentario(''); }} style={{ ...s.btnPrimario, background: '#f59e0b', fontSize: 12, padding: '8px 14px' }}>
                        Revisar objetivo
                      </button>
                    )}
                    {obj.status === 'completado' && (
                      <button onClick={function() { setModalValidarAlcance(obj); setAlcanceLider(''); setComentValidacion(''); }} style={{ ...s.btnPrimario, background: '#22c55e', fontSize: 12, padding: '8px 14px' }}>
                        Validar alcance
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Helper: componente reutilizable de formulario de objetivo
function FormObjetivo({ valor, onChange, objetivos, editandoId, onGuardar, onCancelar, titulo }) {
  var [obj, setObj] = useState(valor || {});

  // Sync si valor cambia desde afuera (al abrir edicion)
  var prevValorRef = useState(null);
  if (prevValorRef[0] !== valor) {
    prevValorRef[1](valor);
    setObj(valor || {});
  }

  function actualizar(nuevo) {
    setObj(nuevo);
    if (onChange) onChange(nuevo);
  }

  var tipoAlcance = obj.alcance_tipo || 'fecha';

  var usada = (objetivos || [])
    .filter(function(o) { return String(o.id) !== String(editandoId) && o.status !== 'rechazado'; })
    .reduce(function(sum, o) { return sum + (parseFloat(o.ponderacion) || 0); }, 0);
  var disponible = 100 - usada;
  var ponderacionOk = parseFloat(obj.ponderacion) <= disponible && parseFloat(obj.ponderacion) > 0;

  var ALCANCES = [
    { key: '80', label: '80% — Parcialmente alcanzado', bg: '#fef3c7', border: '#fcd34d', color: '#92400e' },
    { key: '100', label: '100% — Alcanzado', bg: '#dcfce7', border: '#86efac', color: '#166534' },
    { key: '120', label: '120% — Superado', bg: '#dbeafe', border: '#93c5fd', color: '#1e40af' },
  ];

  return (
    <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
      <h4 style={{ marginTop: 0 }}>{titulo || 'Agregar objetivo'}</h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Objetivo *</label>
          <input value={obj.objetivo || ''} onChange={function(e) { actualizar({...obj, objetivo: e.target.value}); }}
            placeholder="Describir el objetivo principal..."
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Corporativo</label>
          <input value={obj.corporativo || ''} onChange={function(e) { actualizar({...obj, corporativo: e.target.value}); }}
            placeholder="Ej: Ventas, Operaciones..."
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Ponderacion (%)</label>
          <input
            type="number" min="1" max={Math.min(100, disponible + (parseFloat(obj.ponderacion) || 0))}
            value={obj.ponderacion || ''}
            onChange={function(e) { actualizar({...obj, ponderacion: parseFloat(e.target.value) || 0}); }}
            style={{ width: '100%', padding: 8, borderRadius: 6, border: '2px solid ' + (ponderacionOk ? '#D4D2C6' : '#dc2626'), boxSizing: 'border-box' }} />
          <p style={{ fontSize: 11, margin: '4px 0 0 0', color: ponderacionOk ? '#64748b' : '#dc2626' }}>
            {ponderacionOk
              ? 'Disponible: ' + disponible.toFixed(0) + '% — Total: ' + (usada + parseFloat(obj.ponderacion || 0)).toFixed(0) + '%'
              : 'Disponible: ' + disponible.toFixed(0) + '%'}
          </p>
        </div>
      </div>

      {/* Toggle tipo de alcance */}
      <div style={{ margin: '16px 0 12px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#231F20' }}>Tipo de medicion:</span>
        <div style={{ display: 'flex', gap: 0, borderRadius: 8, overflow: 'hidden', border: '2px solid #D4D2C6' }}>
          <button onClick={function() { actualizar({...obj, alcance_tipo: 'fecha'}); }}
            style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tipoAlcance === 'fecha' ? '#231F20' : 'white',
              color: tipoAlcance === 'fecha' ? '#D4D2C6' : '#64748b' }}>
            Fecha
          </button>
          <button onClick={function() { actualizar({...obj, alcance_tipo: 'cantidad'}); }}
            style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              background: tipoAlcance === 'cantidad' ? '#231F20' : 'white',
              color: tipoAlcance === 'cantidad' ? '#D4D2C6' : '#64748b' }}>
            Cantidad / Descripcion
          </button>
        </div>
      </div>

      {/* Alcances */}
      <h5 style={{ margin: '12px 0 8px 0', color: '#231F20' }}>Definicion de alcances</h5>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {ALCANCES.map(function(alc) {
          var descKey = 'alcance_' + alc.key + '_descripcion';
          var metaKey = 'alcance_' + alc.key + '_meta';
          var fechaKey = 'alcance_' + alc.key + '_fecha';
          return (
            <div key={alc.key} style={{ background: alc.bg, padding: 12, borderRadius: 8 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: alc.color }}>{alc.label}</label>
              <input value={obj[descKey] || ''} onChange={function(e) { var u = {}; u[descKey] = e.target.value; actualizar({...obj, ...u}); }}
                placeholder="Descripcion de este nivel"
                style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid ' + alc.border, fontSize: 12, marginTop: 6, boxSizing: 'border-box' }} />
              {tipoAlcance === 'fecha' ? (
                <input type="date" value={obj[fechaKey] || ''} onChange={function(e) { var u = {}; u[fechaKey] = e.target.value; actualizar({...obj, ...u}); }}
                  style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid ' + alc.border, fontSize: 12, marginTop: 4, boxSizing: 'border-box' }} />
              ) : (
                <input value={obj[metaKey] || ''} onChange={function(e) { var u = {}; u[metaKey] = e.target.value; actualizar({...obj, ...u}); }}
                  placeholder="Ej: 15 unidades, 3 aperturas..."
                  style={{ width: '100%', padding: 6, borderRadius: 4, border: '1px solid ' + alc.border, fontSize: 12, marginTop: 4, boxSizing: 'border-box' }} />
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
        <button
          onClick={function() {
            if (!obj.objetivo) return alert('El objetivo es obligatorio');
            var pond = parseFloat(obj.ponderacion) || 0;
            if (pond <= 0) return alert('La ponderacion debe ser mayor a 0');
            var total = usada + pond;
            if (total > 100) return alert('La ponderacion supera el 100%. Disponible: ' + disponible.toFixed(0) + '%');
            onGuardar(obj);
          }}
          style={{ ...s.btnPrimario, background: '#22c55e' }}>
          Guardar Objetivo
        </button>
        <button onClick={onCancelar} style={s.btnSecundario}>Cancelar</button>
      </div>
    </div>
  );
}



function ObjetivosColaborador({ profile }) {
  var [objetivos, setObjetivos] = useState([]);
  var [cargando, setCargando] = useState(true);
  var [mostrarForm, setMostrarForm] = useState(false);
  var [editandoId, setEditandoId] = useState(null);
  var [formObj, setFormObj] = useState(null);
  var [modalCompletar, setModalCompletar] = useState(null);

  var FORM_VACIO = { objetivo: '', corporativo: '', ponderacion: '', alcance_tipo: 'fecha',
    alcance_80_descripcion: '', alcance_80_fecha: '', alcance_80_meta: '',
    alcance_100_descripcion: '', alcance_100_fecha: '', alcance_100_meta: '',
    alcance_120_descripcion: '', alcance_120_fecha: '', alcance_120_meta: '' };

  // Colores por corporativo
  var CORP_COLORES = ['#2d6a4f','#c2410c','#1d4ed8','#7c3aed','#0e7490','#92400e','#064e3b'];
  function colorCorp(nombre) {
    if (!nombre) return '#64748b';
    var idx = Math.abs(nombre.split('').reduce(function(a,c) { return a + c.charCodeAt(0); }, 0)) % CORP_COLORES.length;
    return CORP_COLORES[idx];
  }

  useEffect(function() { cargarObjetivos(); }, []);

  async function cargarObjetivos() {
    var { data } = await supabase.from('objetivos').select('*').eq('colaborador_id', profile.id).order('created_at', { ascending: false });
    setObjetivos(data || []); setCargando(false);
  }

  function abrirNuevo() {
    var usada = (objetivos || []).filter(function(o) { return o.status !== 'rechazado'; }).reduce(function(sum, o) { return sum + (parseFloat(o.ponderacion) || 0); }, 0);
    setFormObj({ ...FORM_VACIO, ponderacion: Math.min(100 - usada, 25) });
    setEditandoId(null); setMostrarForm(true);
  }

  function abrirEditar(obj) {
    setFormObj({ objetivo: obj.objetivo || '', corporativo: obj.corporativo || '', ponderacion: obj.ponderacion || 0, alcance_tipo: obj.alcance_tipo || 'fecha',
      alcance_80_descripcion: obj.alcance_80_descripcion || '', alcance_80_fecha: obj.alcance_80_fecha || '', alcance_80_meta: obj.alcance_80_meta || '',
      alcance_100_descripcion: obj.alcance_100_descripcion || '', alcance_100_fecha: obj.alcance_100_fecha || '', alcance_100_meta: obj.alcance_100_meta || '',
      alcance_120_descripcion: obj.alcance_120_descripcion || '', alcance_120_fecha: obj.alcance_120_fecha || '', alcance_120_meta: obj.alcance_120_meta || '' });
    setEditandoId(obj.id); setMostrarForm(true);
  }

  async function guardarObjetivo(datosForm) {
    var datos = { objetivo: datosForm.objetivo, corporativo: datosForm.corporativo, ponderacion: parseFloat(datosForm.ponderacion), alcance_tipo: datosForm.alcance_tipo,
      alcance_80_descripcion: datosForm.alcance_80_descripcion, alcance_80_fecha: datosForm.alcance_80_fecha || null, alcance_80_meta: datosForm.alcance_80_meta,
      alcance_100_descripcion: datosForm.alcance_100_descripcion, alcance_100_fecha: datosForm.alcance_100_fecha || null, alcance_100_meta: datosForm.alcance_100_meta,
      alcance_120_descripcion: datosForm.alcance_120_descripcion, alcance_120_fecha: datosForm.alcance_120_fecha || null, alcance_120_meta: datosForm.alcance_120_meta };
    if (editandoId) {
      await supabase.from('objetivos').update({ ...datos, editado_por_colaborador: true, fecha_edicion: new Date() }).eq('id', editandoId);
    } else {
      var { error: insErr } = await supabase.from('objetivos').insert({ ...datos, colaborador_id: profile.id, status: 'pendiente' });
      if (insErr) { alert('Error al guardar: ' + insErr.message); return; }
    }
    setMostrarForm(false); setFormObj(null); setEditandoId(null); cargarObjetivos();
  }

  async function aceptarObjetivo(objId) {
    await supabase.from('objetivos').update({ status: 'aceptado', confirmado_colaborador: true, fecha_confirmacion: new Date() }).eq('id', objId);
    cargarObjetivos();
  }

  // Stats
  var objActivos = objetivos.filter(function(o) { return o.status !== 'rechazado'; });
  var totalPond = objActivos.reduce(function(s, o) { return s + (parseFloat(o.ponderacion) || 0); }, 0);
  var proxVenc = objetivos.filter(function(o) { return o.alcance_100_fecha || o.alcance_80_fecha; }).map(function(o) { return o.alcance_100_fecha || o.alcance_80_fecha; }).sort()[0];
  var objValidados = objetivos.filter(function(o) { return o.status === 'validado' && o.alcance_validado; });
  var alcanceTotal = null;
  if (objValidados.length > 0) {
    var sp = objValidados.reduce(function(s,o) { return s + parseFloat(o.ponderacion); }, 0);
    var sa = objValidados.reduce(function(s,o) { return s + parseFloat(o.alcance_validado) * parseFloat(o.ponderacion); }, 0);
    alcanceTotal = sp > 0 ? (sa / sp).toFixed(1) : null;
  }

  // Barra de ponderación
  var corpGroups = {};
  objActivos.forEach(function(o) {
    var k = o.corporativo || 'Sin categoría';
    if (!corpGroups[k]) corpGroups[k] = 0;
    corpGroups[k] += parseFloat(o.ponderacion) || 0;
  });

  // Iniciales del colaborador
  var iniciales = (profile.full_name || profile.email || 'U').split(' ').slice(0,2).map(function(p) { return p[0]; }).join('').toUpperCase();

  if (cargando) return <p>Cargando...</p>;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>

      {/* Header oscuro */}
      <div style={{ background: '#231F20', borderRadius: 14, padding: '24px 28px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 10, background: '#D4D2C6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: '#231F20', flexShrink: 0 }}>
            {iniciales}
          </div>
          <div>
            <h2 style={{ margin: 0, color: '#F0EDE8', fontSize: 22, fontWeight: 700 }}>Objetivos — {profile.full_name || profile.email}</h2>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>{profile.area || ''}{profile.area && ' · '}ciclo 2026</p>
          </div>
        </div>
        <button onClick={abrirNuevo} disabled={totalPond >= 100}
          style={{ padding: '10px 20px', borderRadius: 8, border: '2px solid #D4D2C6', background: 'transparent', color: '#D4D2C6', cursor: totalPond >= 100 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: totalPond >= 100 ? 0.5 : 1 }}>
          {totalPond >= 100 ? '100% completado' : '+ Agregar objetivo'}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#F0EDE8', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e0db' }}>
          <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>Ponderación total</p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: totalPond === 100 ? '#231F20' : '#c2410c' }}>{totalPond.toFixed(0)}%</p>
        </div>
        <div style={{ background: '#F0EDE8', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e0db' }}>
          <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>Objetivos activos</p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#231F20' }}>{objActivos.length}</p>
        </div>
        <div style={{ background: '#F0EDE8', borderRadius: 12, padding: '16px 20px', border: '1px solid #e2e0db' }}>
          <p style={{ margin: '0 0 6px 0', fontSize: 12, color: '#64748b', fontWeight: 500 }}>
            {alcanceTotal ? 'Alcance total' : 'Próximo vencimiento'}
          </p>
          <p style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#231F20' }}>
            {alcanceTotal ? alcanceTotal + '%' : proxVenc ? new Date(proxVenc).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '—'}
          </p>
        </div>
      </div>

      {/* Barra de ponderación por categoría */}
      {objActivos.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ height: 8, borderRadius: 6, overflow: 'hidden', display: 'flex', background: '#e2e8f0' }}>
            {Object.entries(corpGroups).map(function(entry, i) {
              return <div key={i} style={{ width: (entry[1] / 100 * 100) + '%', background: colorCorp(entry[0]), transition: 'width 0.4s' }} />;
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
            {Object.entries(corpGroups).map(function(entry, i) {
              return <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#475569' }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: colorCorp(entry[0]) }} />
                {entry[0]} · {entry[1]}%
              </div>;
            })}
          </div>
        </div>
      )}

      {/* Formulario */}
      {mostrarForm && formObj && (
        <FormObjetivo valor={formObj} onChange={setFormObj} objetivos={objetivos} editandoId={editandoId}
          titulo={editandoId ? 'Editar objetivo' : 'Agregar objetivo'}
          onGuardar={guardarObjetivo}
          onCancelar={function() { setMostrarForm(false); setFormObj(null); setEditandoId(null); }} />
      )}

      {modalCompletar && (
        <ModalCompletar objetivo={objetivos.find(function(o) { return o.id === modalCompletar; })}
          onConfirmar={completarObjetivo} onCancelar={function() { setModalCompletar(null); }} />
      )}

      {/* Lista de objetivos */}
      {objetivos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#F0EDE8', borderRadius: 12 }}>
          No tenés objetivos cargados aún.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {objetivos.map(function(obj) {
            var color = colorCorp(obj.corporativo);
            var fechaRef = obj.alcance_100_fecha || obj.alcance_80_fecha;
            var statusBg = { validado: '#dcfce7', completado: '#dbeafe', aceptado: '#f1f5f9', rechazado: '#fee2e2', pendiente: '#fef3c7' };
            var statusColor = { validado: '#166534', completado: '#1e40af', aceptado: '#475569', rechazado: '#dc2626', pendiente: '#92400e' };
            return (
              <div key={obj.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '4px solid ' + color, padding: '16px 20px', position: 'relative' }}>
                {/* Header tarjeta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: color }}>{obj.corporativo || 'Sin categoría'}</span>
                  </div>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: statusBg[obj.status] || '#f1f5f9', color: statusColor[obj.status] || '#475569' }}>
                    {obj.status ? obj.status.charAt(0).toUpperCase() + obj.status.slice(1) : '-'}
                  </span>
                </div>

                {/* Texto objetivo */}
                <p style={{ margin: '0 0 12px 0', fontSize: 14, color: '#231F20', lineHeight: 1.55, wordBreak: 'break-word' }}>{obj.objetivo}</p>

                {/* Footer */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    {fechaRef && <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(fechaRef).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                    {obj.alcance_validado && <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>Alcance validado: {obj.alcance_validado}%</span>}
                    {obj.comentario_lider && <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>{obj.comentario_lider}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: '#231F20' }}>{obj.ponderacion}%</span>
                    {obj.status === 'pendiente' && (
                      <>
                        <button onClick={function() { abrirEditar(obj); }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', color: '#231F20', cursor: 'pointer', fontSize: 12 }}>Editar</button>
                        <button onClick={function() { aceptarObjetivo(obj.id); }} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#231F20', color: '#D4D2C6', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Aceptar</button>
                      </>
                    )}
                    {obj.status === 'aceptado' && (
                      <>
                        <button onClick={function() { abrirEditar(obj); }} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', color: '#231F20', cursor: 'pointer', fontSize: 12 }}>Editar</button>
                        <button onClick={function() { setModalCompletar(obj.id); }} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#231F20', color: '#D4D2C6', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Registrar alcance</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Alcance completado */}
                {obj.alcance_completado && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 12, color: '#0369a1' }}>
                    Alcance reportado: {obj.alcance_completado}% — {obj.justificacion_completado}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  async function completarObjetivo(objId, alcance, justificacion) {
    await supabase.from('objetivos').update({ status: 'completado', completado_por_colaborador: true, fecha_completado: new Date(), alcance_completado: alcance, justificacion_completado: justificacion }).eq('id', objId);
    setModalCompletar(null); cargarObjetivos();
  }
}

function ModalCompletar({ objetivo, onConfirmar, onCancelar }) {
  var [alcance, setAlcance] = useState('');
  var [justificacion, setJustificacion] = useState('');
  if (!objetivo) return null;

  var ALCANCES = [
    { valor: '80', label: '80%', sublabel: 'Parcialmente alcanzado', color: '#92400e', bg: '#fef3c7', border: '#fcd34d' },
    { valor: '100', label: '100%', sublabel: 'Alcanzado', color: '#166534', bg: '#dcfce7', border: '#86efac' },
    { valor: '120', label: '120%', sublabel: 'Superado', color: '#1e40af', bg: '#dbeafe', border: '#93c5fd' },
  ];

  // Mostrar definicion del nivel seleccionado
  var defAlcance = alcance ? (objetivo['alcance_' + alcance + '_descripcion'] || objetivo['alcance_' + alcance + '_meta'] || '') : '';

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={onCancelar}>
      <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 520, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={function(e) { e.stopPropagation(); }}>
        <h3 style={{ marginTop: 0, color: '#231F20' }}>Registrar alcance</h3>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}><strong>{objetivo.objetivo}</strong></p>

        <p style={{ fontSize: 13, fontWeight: 600, color: '#231F20', marginBottom: 10 }}>¿Qué nivel alcanzaste?</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
          {ALCANCES.map(function(a) {
            var sel = alcance === a.valor;
            return (
              <button key={a.valor} onClick={function() { setAlcance(a.valor); }}
                style={{
                  padding: '14px 8px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  border: '2px solid ' + (sel ? a.color : a.border),
                  background: sel ? a.bg : 'white',
                  transition: 'all 0.15s',
                }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: a.color }}>{a.label}</div>
                <div style={{ fontSize: 11, color: a.color, fontWeight: 600 }}>{a.sublabel}</div>
              </button>
            );
          })}
        </div>

        {alcance && defAlcance && (
          <div style={{ background: '#f8fafc', border: '1px solid #D4D2C6', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#475569' }}>
            <strong>Definicion del nivel:</strong> {defAlcance}
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: 13 }}>Justificación *</label>
          <textarea value={justificacion} onChange={function(e) { setJustificacion(e.target.value); }}
            placeholder="Explicá el resultado alcanzado, qué hiciste, qué resultados obtuviste..."
            style={{ width: '100%', minHeight: 90, padding: 10, borderRadius: 8, border: '2px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={function() {
              if (!alcance) return alert('Seleccioná un nivel de alcance');
              if (!justificacion.trim()) return alert('La justificación es obligatoria');
              onConfirmar(objetivo.id, alcance, justificacion);
            }}
            style={{ ...s.btnPrimario, background: '#22c55e', flex: 1 }}>
            Confirmar alcance
          </button>
          <button onClick={onCancelar} style={s.btnSecundario}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function PanelAdminObjetivos({ profile }) {
  var [objetivos, setObjetivos] = useState([]); var [colaboradores, setColaboradores] = useState([]); var [cargando, setCargando] = useState(true);
  var [nuevoObjetivo, setNuevoObjetivo] = useState(null);
  var [filtroArea, setFiltroArea] = useState('Todas'); var [filtroSeniority, setFiltroSeniority] = useState('Todos');
  var [mostrarForm, setMostrarForm] = useState(false); var [mostrarHistorico, setMostrarHistorico] = useState(false);
  var [colaboradorSeleccionado, setColaboradorSeleccionado] = useState('');
  var [objetivoHistorico, setObjetivoHistorico] = useState({ objetivo: '', corporativo: '', ponderacion: 25, fecha_historica: '', alcance: '', status: 'validado' });
  useEffect(function() { cargarDatos(); }, []);
  async function cargarDatos() { var [{ data: objs }, { data: cols }] = await Promise.all([supabase.from('objetivos').select('*, colaborador:colaborador_id(email, full_name, area, seniority, leader_id, lider:leader_id(full_name, email)), gerente:gerente_id(email, full_name)').order('created_at', { ascending: false }), supabase.from('profiles').select('id, email, full_name, area, seniority').neq('role', 'admin_rrhh').eq('activo', true)]); setObjetivos(objs || []); setColaboradores(cols || []); setCargando(false); }

  function abrirNuevoAdmin() {
    setNuevoObjetivo({ objetivo: '', corporativo: '', ponderacion: '', alcance_tipo: 'fecha',
      alcance_80_descripcion: '', alcance_80_fecha: '', alcance_80_meta: '',
      alcance_100_descripcion: '', alcance_100_fecha: '', alcance_100_meta: '',
      alcance_120_descripcion: '', alcance_120_fecha: '', alcance_120_meta: '' });
    setMostrarForm(true); setMostrarHistorico(false);
  }

  async function agregarObjetivoAdmin(datosForm) {
    if (!colaboradorSeleccionado) return alert('Selecciona un colaborador');
    if (!datosForm || !datosForm.objetivo) return alert('El objetivo es obligatorio');
    if (!datosForm.ponderacion || parseFloat(datosForm.ponderacion) <= 0) return alert('La ponderacion es obligatoria');
    var objsColab = objetivos.filter(function(o) { return o.colaborador_id === colaboradorSeleccionado && o.status !== 'rechazado'; });
    var usada = objsColab.reduce(function(s, o) { return s + (parseFloat(o.ponderacion) || 0); }, 0);
    if (usada + parseFloat(datosForm.ponderacion) > 100) return alert('La ponderacion supera el 100%. Disponible: ' + (100 - usada) + '%');
    var { data: { session } } = await supabase.auth.getSession();
    var { error: insertErr } = await supabase.from('objetivos').insert({
      gerente_id: session.user.id, colaborador_id: colaboradorSeleccionado, status: 'pendiente',
      leader_id: (colaboradores.find(function(c) { return c.id === colaboradorSeleccionado; }) || {}).leader_id || null,
      objetivo: datosForm.objetivo, corporativo: datosForm.corporativo,
      ponderacion: parseFloat(datosForm.ponderacion), alcance_tipo: datosForm.alcance_tipo,
      alcance_80_descripcion: datosForm.alcance_80_descripcion, alcance_80_fecha: datosForm.alcance_80_fecha || null, alcance_80_meta: datosForm.alcance_80_meta,
      alcance_100_descripcion: datosForm.alcance_100_descripcion, alcance_100_fecha: datosForm.alcance_100_fecha || null, alcance_100_meta: datosForm.alcance_100_meta,
      alcance_120_descripcion: datosForm.alcance_120_descripcion, alcance_120_fecha: datosForm.alcance_120_fecha || null, alcance_120_meta: datosForm.alcance_120_meta,
    });
    if (insertErr) { alert('Error al guardar objetivo: ' + insertErr.message); return; }
    setNuevoObjetivo(null); setColaboradorSeleccionado(''); setMostrarForm(false); cargarDatos();
  }
  async function agregarHistorico() { if (!colaboradorSeleccionado || !objetivoHistorico.objetivo || !objetivoHistorico.fecha_historica) return alert('Completa todos los campos'); await supabase.from('objetivos').insert({ colaborador_id: colaboradorSeleccionado, objetivo: objetivoHistorico.objetivo, corporativo: objetivoHistorico.corporativo, ponderacion: objetivoHistorico.ponderacion, status: objetivoHistorico.status, es_historico: true, fecha_historica: objetivoHistorico.fecha_historica, alcance_completado: objetivoHistorico.alcance || null, validado_por_gerente: true }); setObjetivoHistorico({ objetivo: '', corporativo: '', ponderacion: 25, fecha_historica: '', alcance: '', status: 'validado' }); setColaboradorSeleccionado(''); setMostrarHistorico(false); cargarDatos(); }

  async function exportarExcel(tipo) {
    var XLSX = await import('xlsx');
    var wb = XLSX.utils.book_new();

    if (tipo === 'objetivos' || tipo === 'ambos') {
      // Agrupar objetivos por colaborador
      var colabsMap = {};
      objetivosFiltrados.forEach(function(obj) {
        var nombre = obj.colaborador?.full_name || obj.colaborador?.email || 'Sin nombre';
        if (!colabsMap[nombre]) colabsMap[nombre] = [];
        colabsMap[nombre].push(obj);
      });
      Object.entries(colabsMap).forEach(function(entry) {
        var nombre = entry[0]; var objs = entry[1];
        var filas = objs.map(function(obj) { return {
          'Objetivo': obj.objetivo || '',
          'Corporativo': obj.corporativo || '',
          'Ponderacion': (obj.ponderacion || 0) + '%',
          'Estado': obj.status || '',
          'Tipo Alcance': obj.alcance_tipo || '',
          'Alcance 80 - Descripcion': obj.alcance_80_descripcion || '',
          'Alcance 80 - Meta/Fecha': obj.alcance_80_fecha || obj.alcance_80_meta || '',
          'Alcance 100 - Descripcion': obj.alcance_100_descripcion || '',
          'Alcance 100 - Meta/Fecha': obj.alcance_100_fecha || obj.alcance_100_meta || '',
          'Alcance 120 - Descripcion': obj.alcance_120_descripcion || '',
          'Alcance 120 - Meta/Fecha': obj.alcance_120_fecha || obj.alcance_120_meta || '',
          'Alcance Reportado': obj.alcance_completado ? obj.alcance_completado + '%' : '',
          'Justificacion Colaborador': obj.justificacion_completado || '',
          'Alcance Validado': obj.alcance_validado ? obj.alcance_validado + '%' : '',
          'Comentario Lider': obj.comentario_lider || '',
          'Comentario Validacion': obj.comentario_validacion_lider || '',
        }; });
        var ws = XLSX.utils.json_to_sheet(filas);
        // Ancho de columnas
        ws['!cols'] = [40,20,12,12,12,30,20,30,20,30,20,16,30,16,20,30].map(function(w) { return { wch: w }; });
        var hojaNombre = nombre.substring(0, 31).replace(/[\\\/\?\*\[\]:]/g, '');
        XLSX.utils.book_append_sheet(wb, ws, hojaNombre);
      });
    }

    if (tipo === 'evaluaciones' || tipo === 'ambos') {
      // Traer evaluaciones frescas con puntuaciones
      var { data: evs } = await supabase.from('evaluaciones')
        .select('*, colaborador:colaborador_id(full_name, email, area, seniority), puntuaciones(rating, comentario, competencias(nombre))')
        .in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']);

      var colabsEvMap = {};
      (evs || []).forEach(function(ev) {
        var nombre = ev.colaborador?.full_name || ev.colaborador?.email || 'Sin nombre';
        if (!colabsEvMap[nombre]) colabsEvMap[nombre] = [];
        colabsEvMap[nombre].push(ev);
      });

      Object.entries(colabsEvMap).forEach(function(entry) {
        var nombre = entry[0]; var evList = entry[1];
        var filas = [];
        evList.forEach(function(ev) {
          (ev.puntuaciones || []).forEach(function(p) {
            filas.push({
              'Tipo': ev.tipo_evaluacion === 'autoevaluacion' ? 'Autoevaluacion' : 'Evaluacion Lider',
              'Estado': ev.estado || '',
              'Competencia': p.competencias?.nombre || '',
              'Rating': p.rating || '',
              'Comentario': p.comentario || '',
              'Rating Promedio': ev.rating_promedio || '',
              'Rating Calibrado': ev.rating_calibrado || '',
              'Comentarios Finales': ev.comentarios_finales || '',
            });
          });
        });
        if (filas.length === 0) filas.push({ 'Tipo': 'Sin evaluaciones', 'Estado': '', 'Competencia': '', 'Rating': '', 'Comentario': '', 'Rating Promedio': '', 'Rating Calibrado': '', 'Comentarios Finales': '' });
        var ws = XLSX.utils.json_to_sheet(filas);
        ws['!cols'] = [18,12,25,8,35,14,14,35].map(function(w) { return { wch: w }; });
        var hojaNombre = ('EV_' + nombre).substring(0, 31).replace(/[\\\/\?\*\[\]:]/g, '');
        XLSX.utils.book_append_sheet(wb, ws, hojaNombre);
      });
    }

    if (wb.SheetNames.length === 0) return alert('No hay datos para exportar');
    var fecha = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, 'Fabric_' + tipo + '_' + fecha + '.xlsx');
  }


  var areas = ['Todas'].concat([...new Set(colaboradores.map(function(c) { return c.area; }).filter(Boolean))]);
  var seniorities = ['Todos'].concat([...new Set(colaboradores.map(function(c) { return c.seniority; }).filter(Boolean))]);
  var objetivosFiltrados = objetivos.filter(function(obj) { if (filtroArea !== 'Todas' && obj.colaborador?.area !== filtroArea) return false; if (filtroSeniority !== 'Todos' && obj.colaborador?.seniority !== filtroSeniority) return false; return true; });
  if (cargando) return <p>Cargando panel admin...</p>;

  // Objetivos del colaborador seleccionado (para calcular ponderacion disponible en FormObjetivo)
  var objsDelColab = colaboradorSeleccionado ? objetivos.filter(function(o) { return o.colaborador_id === colaboradorSeleccionado && o.status !== 'rechazado'; }) : [];

  return (
    <div>
      <h2 style={{ color: '#231F20', marginBottom: 20 }}>Panel Admin - Objetivos</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filtroArea} onChange={function(e) { setFiltroArea(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las Areas' : a}</option>; })}</select>
        <select value={filtroSeniority} onChange={function(e) { setFiltroSeniority(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{seniorities.map(function(s) { return <option key={s} value={s}>{s === 'Todos' ? 'Todos los Seniority' : s}</option>; })}</select>
        <button onClick={function() { abrirNuevoAdmin(); }} style={{ ...s.btnPrimario, background: '#22c55e' }}>Agregar objetivo</button>
        <button onClick={function() { setMostrarHistorico(!mostrarHistorico); setMostrarForm(false); setNuevoObjetivo(null); }} style={{ ...s.btnPrimario, background: '#8b5cf6' }}>Subir Historico</button>
        <div style={{ position: 'relative', display: 'inline-block' }}><button onClick={function() { var m = document.getElementById('export-menu'); m.style.display = m.style.display === 'block' ? 'none' : 'block'; }} style={{ ...s.btnSecundario, background: '#22c55e', color: 'white', fontWeight: 600 }}>Exportar Excel</button><div id="export-menu" style={{ display: 'none', position: 'absolute', top: '100%', left: 0, background: 'white', border: '1px solid #D4D2C6', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, minWidth: 200 }}><button onClick={function() { exportarExcel('objetivos'); }} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>Ver Objetivos (por colaborador)</button><button onClick={function() { exportarExcel('evaluaciones'); }} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>Evaluaciones por colaborador</button><button onClick={function() { exportarExcel('ambos'); }} style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>Todo junto</button></div></div>
      </div>

      {/* Formulario nuevo objetivo con FormObjetivo */}
      {mostrarForm && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <h4 style={{ marginTop: 0 }}>Asignar Objetivo a Colaborador</h4>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>Colaborador *</label>
            <select value={colaboradorSeleccionado} onChange={function(e) { setColaboradorSeleccionado(e.target.value); }}
              style={{ width: '100%', padding: 10, borderRadius: 6, border: '1px solid #D4D2C6', marginTop: 4 }}>
              <option value="">Seleccionar colaborador...</option>
              {colaboradores.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} — {c.area}</option>; })}
            </select>
          </div>
          {colaboradorSeleccionado && nuevoObjetivo && (
            <FormObjetivo
              valor={nuevoObjetivo} onChange={setNuevoObjetivo}
              objetivos={objsDelColab} editandoId={null}
              titulo=""
              onGuardar={agregarObjetivoAdmin}
              onCancelar={function() { setMostrarForm(false); setNuevoObjetivo(null); setColaboradorSeleccionado(''); }}
            />
          )}
          {!colaboradorSeleccionado && (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Seleccioná un colaborador para continuar.</p>
          )}
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
            <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Colaborador</th><th style={{ ...th, color: '#D4D2C6' }}>Area</th><th style={{ ...th, color: '#D4D2C6' }}>Seniority</th><th style={{ ...th, color: "#D4D2C6" }}>Lider</th><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Alcance</th><th style={{ ...th, color: '#D4D2C6' }}>Historico</th></tr></thead>
            <tbody>{objetivosFiltrados.map(function(obj) { return (
              <tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}><strong>{obj.colaborador?.full_name || '-'}</strong></td>
                <td style={td}>{obj.colaborador?.area || '-'}</td>
                <td style={td}>{obj.colaborador?.seniority || '-'}</td>
                <td style={td}>{obj.colaborador?.lider?.full_name || obj.colaborador?.lider?.email || '-'}</td>
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



// =============================================
// OBJETIVOS COMPAÑIA — lee de Supabase, editable por admin
// =============================================
function ObjetivosCompania({ esAdmin }) {
  var [objetivos, setObjetivos] = useState([]);
  var [carg, setCarg] = useState(true);
  var [seleccionado, setSeleccionado] = useState(null);
  var [editando, setEditando] = useState(null); // id del obj en edición, o 'nuevo'
  var [form, setForm] = useState({});
  var [confirmBorrar, setConfirmBorrar] = useState(null);

  useEffect(function() { cargar(); }, []);

  async function cargar() {
    var { data } = await supabase.from('objetivos_compania').select('*').eq('activo', true).order('orden', { ascending: true });
    setObjetivos(data || []); setCarg(false);
  }

  function abrirForm(obj) {
    setForm(obj ? { ...obj } : { nombre: '', icono: '🎯', resumen: '', descripcion: '', meta: '', medicion: '', orden: (objetivos.length + 1) });
    setEditando(obj ? obj.id : 'nuevo');
    setSeleccionado(null);
  }

  async function guardar() {
    if (!form.nombre) return alert('El nombre es obligatorio');
    if (editando === 'nuevo') {
      await supabase.from('objetivos_compania').insert({ nombre: form.nombre, icono: form.icono || '🎯', resumen: form.resumen, descripcion: form.descripcion, meta: form.meta, medicion: form.medicion, orden: form.orden || 0, activo: true });
    } else {
      await supabase.from('objetivos_compania').update({ nombre: form.nombre, icono: form.icono, resumen: form.resumen, descripcion: form.descripcion, meta: form.meta, medicion: form.medicion, orden: form.orden }).eq('id', editando);
    }
    setEditando(null); setForm({});
    cargar();
  }

  async function borrar(id) {
    await supabase.from('objetivos_compania').update({ activo: false }).eq('id', id);
    setConfirmBorrar(null); setSeleccionado(null);
    cargar();
  }

  if (carg) return <p>Cargando...</p>;

  var ICONOS = ['📈', '🚀', '🎯', '💡', '🏆', '📊', '🌎', '💰', '🤝', '⭐'];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28 }}>
        <div>
          <h2 style={{ color: '#231F20', margin: '0 0 6px 0', fontSize: 22, fontWeight: 700 }}>Objetivos de la Compañía 2026</h2>
          <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Objetivos estratégicos de Fabric Group. Hacé clic en una tarjeta para ver el detalle.</p>
        </div>
        {esAdmin && (
          <button onClick={function() { abrirForm(null); }} style={{ ...s.btnPrimario, background: '#22c55e', fontSize: 13, padding: '10px 20px' }}>
            Agregar objetivo
          </button>
        )}
      </div>

      {/* Modal formulario */}
      {editando && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setEditando(null); }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 600, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={function(e) { e.stopPropagation(); }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#231F20' }}>{editando === 'nuevo' ? 'Agregar objetivo' : 'Editar Objetivo'}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Nombre *</label>
                  <input value={form.nombre || ''} onChange={function(e) { setForm({...form, nombre: e.target.value}); }} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 14, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Ícono</label>
                  <select value={form.icono || '🎯'} onChange={function(e) { setForm({...form, icono: e.target.value}); }} style={{ padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 20 }}>
                    {ICONOS.map(function(ic) { return <option key={ic} value={ic}>{ic}</option>; })}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Resumen (se ve en la tarjeta)</label>
                <textarea value={form.resumen || ''} onChange={function(e) { setForm({...form, resumen: e.target.value}); }} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Descripción completa (se ve en el detalle)</label>
                <textarea value={form.descripcion || ''} onChange={function(e) { setForm({...form, descripcion: e.target.value}); }} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, minHeight: 120, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Meta</label>
                  <input value={form.meta || ''} onChange={function(e) { setForm({...form, meta: e.target.value}); }} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Medición</label>
                  <input value={form.medicion || ''} onChange={function(e) { setForm({...form, medicion: e.target.value}); }} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Orden</label>
                <input type="number" value={form.orden || 0} onChange={function(e) { setForm({...form, orden: parseInt(e.target.value)}); }} style={{ width: 80, padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13 }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={guardar} style={{ ...s.btnPrimario, flex: 1 }}>Guardar</button>
              <button onClick={function() { setEditando(null); }} style={s.btnSecundario}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar borrar */}
      {confirmBorrar && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 12px 0' }}>¿Eliminar objetivo?</h3>
            <p style={{ color: '#64748b', marginBottom: 24 }}>Esta acción no se puede deshacer.</p>
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={function() { borrar(confirmBorrar); }} style={{ ...s.btnPrimario, background: '#dc2626', flex: 1 }}>Eliminar</button>
              <button onClick={function() { setConfirmBorrar(null); }} style={s.btnSecundario}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 32 }}>
        {objetivos.map(function(obj) {
          var activo = seleccionado === obj.id;
          return (
            <div key={obj.id} style={{ position: 'relative' }}>
              {/* Botones admin */}
              {esAdmin && (
                <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 6, zIndex: 10 }}>
                  <button onClick={function(e) { e.stopPropagation(); abrirForm(obj); }} style={{ background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>✏️</button>
                  <button onClick={function(e) { e.stopPropagation(); setConfirmBorrar(obj.id); }} style={{ background: 'rgba(220,38,38,0.85)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: 'white', fontWeight: 600 }}>Eliminar</button>
                </div>
              )}
              <div
                onClick={function() { setSeleccionado(activo ? null : obj.id); }}
                style={{
                  background: activo ? '#231F20' : '#D4D2C6',
                  borderRadius: 14, padding: '24px 22px', cursor: 'pointer',
                  border: '2px solid ' + (activo ? '#231F20' : '#C8C6BA'),
                  boxShadow: activo ? '0 4px 20px rgba(35,31,32,0.18)' : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.18s ease', position: 'relative', overflow: 'hidden',
                }}>
                <div style={{ position: 'absolute', top: 16, right: 18, fontSize: 42, fontWeight: 900, opacity: 0.08, color: activo ? '#fff' : '#231F20', lineHeight: 1, fontFamily: 'Georgia, serif' }}>0{objetivos.indexOf(obj) + 1}</div>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{obj.icono || '🎯'}</div>
                <h3 style={{ margin: '0 0 10px 0', fontSize: 18, fontWeight: 700, color: activo ? '#D4D2C6' : '#231F20' }}>{obj.nombre}</h3>
                <p style={{ margin: '0 0 16px 0', fontSize: 13, color: activo ? '#C8C6BA' : '#475569', lineHeight: 1.55 }}>{obj.resumen}</p>
                <div style={{ fontSize: 12, fontWeight: 600, color: activo ? '#D4D2C6' : '#231F20', borderTop: '1px solid ' + (activo ? 'rgba(212,210,198,0.3)' : 'rgba(35,31,32,0.12)'), paddingTop: 12 }}>
                  {activo ? '▲ Ocultar detalle' : '▼ Ver detalle'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Panel detalle */}
      {seleccionado && (function() {
        var obj = objetivos.find(function(o) { return o.id === seleccionado; });
        if (!obj) return null;
        return (
          <div style={{ background: 'white', border: '2px solid #231F20', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 24px rgba(35,31,32,0.10)' }}>
            <div style={{ background: '#231F20', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: 28 }}>{obj.icono || '🎯'}</span>
                <div>
                  <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Objetivo estratégico 2026</p>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: 20, fontWeight: 700, color: '#D4D2C6' }}>{obj.nombre}</h3>
                </div>
              </div>
              <button onClick={function() { setSeleccionado(null); }} style={{ background: 'rgba(212,210,198,0.15)', border: '1px solid rgba(212,210,198,0.3)', borderRadius: 8, color: '#D4D2C6', cursor: 'pointer', fontSize: 18, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
                {obj.meta && <div style={{ background: '#f8f7f4', border: '1px solid #D4D2C6', borderRadius: 8, padding: '8px 14px' }}><p style={{ margin: 0, fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Meta</p><p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: '#231F20' }}>{obj.meta}</p></div>}
                {obj.medicion && <div style={{ background: '#f8f7f4', border: '1px solid #D4D2C6', borderRadius: 8, padding: '8px 14px' }}><p style={{ margin: 0, fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 600 }}>Medición</p><p style={{ margin: '2px 0 0 0', fontSize: 14, fontWeight: 700, color: '#231F20' }}>{obj.medicion}</p></div>}
              </div>
              {obj.descripcion && (
                <div style={{ background: '#fafaf8', border: '1px solid #e8e6e0', borderRadius: 10, padding: '18px 20px' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8 }}>Descripción completa</p>
                  <p style={{ margin: 0, fontSize: 14, color: '#231F20', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{obj.descripcion}</p>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// =============================================
// GESTIÓN DE MÓDULOS POR USUARIO (solo superadmin)
// =============================================
// =============================================
// GESTIÓN DE USUARIOS (superadmin)
// =============================================
function GestionVisibilidad() {
  var [usuarios, setUsuarios] = useState([]);
  var [visibilidades, setVisibilidades] = useState({});
  var [carg, setCarg] = useState(true);
  var [editando, setEditando] = useState(null);
  var [form, setForm] = useState({ tipo: 'area', valor: '' });
  var [msg, setMsg] = useState('');
  var [busqueda, setBusqueda] = useState('');

  var AREAS = ['RRHH','Operaciones','Marketing','Administración&Finanzas','Compras','Expansión','Comercial','Desarrollo Comercial','Gerencia General'];

  useEffect(function() { cargar(); }, []);

  async function cargar() {
    var [{ data: users }, { data: vis }] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, area, puesto, role').eq('activo', true).order('full_name'),
      supabase.from('equipo_visibilidad').select('*'),
    ]);
    var mapa = {};
    (users || []).forEach(function(u) { mapa[u.id] = []; });
    (vis || []).forEach(function(v) { if (mapa[v.lider_id]) mapa[v.lider_id].push(v); });
    setUsuarios(users || []);
    setVisibilidades(mapa);
    setCarg(false);
  }

  async function agregarVisibilidad(liderId) {
    if (!form.tipo) return;
    var valor = form.tipo === 'todos' ? null : form.valor;
    if (form.tipo !== 'todos' && !valor) return alert('Ingresá un valor');
    var { error } = await supabase.from('equipo_visibilidad').insert({ lider_id: liderId, tipo: form.tipo, valor: valor });
    if (error) { setMsg('Error: ' + error.message); return; }
    setMsg('Guardado');
    setTimeout(function() { setMsg(''); }, 2000);
    cargar();
  }

  async function eliminarVisibilidad(id) {
    await supabase.from('equipo_visibilidad').delete().eq('id', id);
    cargar();
  }

  var TAG_COLORS = { todos: { bg: '#231F20', color: '#D4D2C6' }, area: { bg: '#dbeafe', color: '#1e40af' }, usuario: { bg: '#dcfce7', color: '#166534' } };

  var usuariosFiltrados = busqueda
    ? usuarios.filter(function(u) { return (u.full_name || '').toLowerCase().includes(busqueda.toLowerCase()) || (u.area || '').toLowerCase().includes(busqueda.toLowerCase()); })
    : usuarios;

  if (carg) return <p>Cargando...</p>;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#231F20', margin: '0 0 4px 0', fontSize: 20, fontWeight: 700 }}>Visibilidad de Equipo</h2>
        <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>Configurá qué usuarios o áreas puede ver cada líder en Evaluaciones y Objetivos.</p>
      </div>

      {msg && <div style={{ padding: 12, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, marginBottom: 16, color: '#166534', fontWeight: 600 }}>{msg}</div>}

      <input value={busqueda} onChange={function(e) { setBusqueda(e.target.value); }}
        placeholder="Buscar colaborador o área..."
        style={{ width: '100%', maxWidth: 360, padding: '9px 14px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, marginBottom: 20, boxSizing: 'border-box' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {usuariosFiltrados.map(function(u) {
          var vis = visibilidades[u.id] || [];
          var abierto = editando === u.id;
          return (
            <div key={u.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <strong style={{ color: '#231F20', fontSize: 14 }}>{u.full_name || u.email}</strong>
                  <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>{u.puesto || u.area} · {u.area}</p>
                </div>
                <button onClick={function() { setEditando(abierto ? null : u.id); setForm({ tipo: 'area', valor: '' }); }}
                  style={{ ...s.btnInfo, fontSize: 12 }}>
                  {abierto ? 'Cerrar' : '+ Agregar visibilidad'}
                </button>
              </div>

              {/* Tags de visibilidad actual */}
              {vis.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {vis.map(function(v) {
                    var tc = TAG_COLORS[v.tipo] || TAG_COLORS.area;
                    return (
                      <span key={v.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: tc.bg, color: tc.color }}>
                        {v.tipo === 'todos' ? 'Toda la compañía' : v.tipo === 'area' ? 'Área: ' + v.valor : 'Usuario'}
                        <button onClick={function() { eliminarVisibilidad(v.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1, padding: 0, opacity: 0.7 }}>×</button>
                      </span>
                    );
                  })}
                </div>
              )}
              {vis.length === 0 && <p style={{ margin: '8px 0 0 0', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>Solo ve sus reportes directos</p>}

              {/* Formulario agregar */}
              {abierto && (
                <div style={{ marginTop: 14, padding: 14, background: '#F0EDE8', borderRadius: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Tipo</label>
                    <select value={form.tipo} onChange={function(e) { setForm({ tipo: e.target.value, valor: '' }); }}
                      style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white' }}>
                      <option value="todos">Toda la compañía</option>
                      <option value="area">Por área</option>
                      <option value="usuario">Por usuario específico</option>
                    </select>
                  </div>
                  {form.tipo === 'area' && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Área</label>
                      <select value={form.valor} onChange={function(e) { setForm({ ...form, valor: e.target.value }); }}
                        style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white' }}>
                        <option value="">Seleccionar...</option>
                        {AREAS.map(function(a) { return <option key={a} value={a}>{a}</option>; })}
                      </select>
                    </div>
                  )}
                  {form.tipo === 'usuario' && (
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Usuario</label>
                      <select value={form.valor} onChange={function(e) { setForm({ ...form, valor: e.target.value }); }}
                        style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', minWidth: 200 }}>
                        <option value="">Seleccionar...</option>
                        {usuarios.filter(function(x) { return x.id !== u.id; }).map(function(x) { return <option key={x.id} value={x.id}>{x.full_name || x.email}</option>; })}
                      </select>
                    </div>
                  )}
                  <button onClick={function() { agregarVisibilidad(u.id); }} style={{ ...s.btnPrimario, fontSize: 12, padding: '8px 16px' }}>Agregar</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GestionUsuarios() {
  var [usuarios, setUsuarios] = useState([]);
  var [carg, setCarg] = useState(true);
  var [editandoPuesto, setEditandoPuesto] = useState(null);
  var [puestoTemp, setPuestoTemp] = useState("");
  var [busqueda, setBusqueda] = useState('');
  var [modalNuevo, setModalNuevo] = useState(false);
  var [modalPass, setModalPass] = useState(null); // user object
  var [formNuevo, setFormNuevo] = useState({ email: '', full_name: '', area: '', seniority: 'Analista', role: 'colaborador', password: '' });
  var [nuevaPass, setNuevaPass] = useState('');
  var [msg, setMsg] = useState('');
  var [guardando, setGuardando] = useState(false);

  var SENIORITIES = ['Analista', 'Especialista/Supervisor', 'Jefe/Experto', 'Gerente'];
  var ROLES = ['colaborador', 'lider', 'admin_rrhh'];

  useEffect(function() { cargar(); }, []);

  async function cargar() {
    var { data } = await supabase.from("profiles").select("id, email, full_name, area, seniority, puesto, role, activo, leader_id, fecha_ingreso").order("full_name");
    setUsuarios(data || []); setCarg(false);
  }

  async function toggleActivo(user) {
    await supabase.from('profiles').update({ activo: !user.activo }).eq('id', user.id);
    setUsuarios(function(prev) { return prev.map(function(u) { return u.id === user.id ? { ...u, activo: !u.activo } : u; }); });

  async function guardarPuesto(userId) {
    await supabase.from("profiles").update({ puesto: puestoTemp }).eq("id", userId);
    setUsuarios(function(prev) { return prev.map(function(u) { return u.id === userId ? { ...u, puesto: puestoTemp } : u; }); });
    setEditandoPuesto(null);
  }

  async function guardarFechaIngreso(userId, fecha) {
    await supabase.from("profiles").update({ fecha_ingreso: fecha || null }).eq("id", userId);
    setUsuarios(function(prev) { return prev.map(function(u) { return u.id === userId ? { ...u, fecha_ingreso: fecha } : u; }); });
  }
  }

  async function asignarLider(userId, liderId) {
    await supabase.from("profiles").update({ leader_id: liderId || null }).eq("id", userId);
    setUsuarios(function(prev) { return prev.map(function(u) { return u.id === userId ? { ...u, leader_id: liderId || null } : u; }); });
  }

  async function crearUsuario() {
    if (!formNuevo.email || !formNuevo.password || !formNuevo.full_name) return alert('Email, nombre y contraseña son obligatorios');
    setGuardando(true);
    // Crear en Supabase Auth via admin API — usamos signUp desde el cliente
    var { data: authData, error: authErr } = await supabase.auth.signUp({
      email: formNuevo.email,
      password: formNuevo.password,
      options: { data: { full_name: formNuevo.full_name } }
    });
    if (authErr) { setMsg('Error: ' + authErr.message); setGuardando(false); return; }
    // Crear perfil
    if (authData?.user?.id) {
      await supabase.from('profiles').upsert({
        id: authData.user.id, email: formNuevo.email, full_name: formNuevo.full_name,
        area: formNuevo.area, seniority: formNuevo.seniority, role: formNuevo.role, activo: true
      });
    }
    setMsg('Usuario creado. Debe confirmar su email para poder ingresar.');
    setModalNuevo(false);
    setFormNuevo({ email: '', full_name: '', area: '', seniority: 'Analista', role: 'colaborador', password: '' });
    setGuardando(false); cargar();
    setTimeout(function() { setMsg(''); }, 4000);
  }

  async function cambiarPassword() {
    if (!nuevaPass || nuevaPass.length < 6) return alert('La contraseña debe tener al menos 6 caracteres');
    setGuardando(true);
    // Usar Supabase Admin API via edge function o update directo
    var { error } = await supabase.auth.admin.updateUserById(modalPass.id, { password: nuevaPass });
    if (error) {
      // Fallback: si no tiene admin SDK, usar update normal solo si es el usuario logueado
      var { error: err2 } = await supabase.auth.updateUser({ password: nuevaPass });
      if (err2) { setMsg('Error: necesitás permisos de admin para cambiar contraseñas de otros usuarios'); setGuardando(false); return; }
    }
    setMsg('Contraseña actualizada para ' + modalPass.email);
    setModalPass(null); setNuevaPass(''); setGuardando(false);
    setTimeout(function() { setMsg(''); }, 4000);
  }

  var usuariosFiltrados = busqueda
    ? usuarios.filter(function(u) { return (u.full_name || '').toLowerCase().includes(busqueda.toLowerCase()) || (u.email || '').toLowerCase().includes(busqueda.toLowerCase()); })
    : usuarios;

  if (carg) return <p>Cargando usuarios...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: '0 0 4px 0', color: '#231F20' }}>Gestión de Usuarios</h2>
          <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>{usuarios.length} usuarios — {usuarios.filter(function(u) { return u.activo; }).length} activos</p>
        </div>
        <button onClick={function() { setModalNuevo(true); }} style={{ ...s.btnPrimario, background: '#22c55e' }}>Nuevo Usuario</button>
      </div>

      {msg && <div style={{ padding: 12, background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, marginBottom: 16, color: '#166534', fontWeight: 600 }}>{msg}</div>}

      <input value={busqueda} onChange={function(e) { setBusqueda(e.target.value); }}
        placeholder="Buscar por nombre o email..."
        style={{ width: '100%', maxWidth: 360, padding: '10px 14px', borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }} />

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ background: '#231F20' }}>
              {['Nombre', 'Email', 'Area', 'Seniority', 'Puesto', 'Ingreso', 'Rol', 'Lider', 'Estado'].map(function(h) {
                return <th key={h} style={{ ...th, color: '#D4D2C6', padding: '12px 14px' }}>{h}</th>;
              })}
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map(function(u, idx) {
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafaf8' }}>
                  <td style={{ ...td, padding: '12px 14px' }}><strong style={{ color: '#231F20' }}>{u.full_name || '-'}</strong></td>
                  <td style={{ ...td, padding: '12px 14px', fontSize: 12, color: '#64748b' }}>{u.email}</td>
                  <td style={{ ...td, padding: '12px 14px' }}>{u.area || '-'}</td>
                  <td style={{ ...td, padding: '12px 14px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>{u.seniority || '-'}</span>
                  </td>
                  {/* Puesto — editable inline */}
                  <td style={{ ...td, padding: '8px 14px', minWidth: 160 }}>
                    {editandoPuesto === u.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <input
                          value={puestoTemp}
                          onChange={function(e) { setPuestoTemp(e.target.value); }}
                          onKeyDown={function(e) { if (e.key === 'Enter') guardarPuesto(u.id); if (e.key === 'Escape') setEditandoPuesto(null); }}
                          autoFocus
                          style={{ width: '100%', padding: '4px 8px', borderRadius: 6, border: '2px solid #231F20', fontSize: 12, boxSizing: 'border-box' }} />
                        <button onClick={function() { guardarPuesto(u.id); }} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: '#231F20', color: 'white', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' }}>OK</button>
                      </div>
                    ) : (
                      <span
                        onClick={function() { setEditandoPuesto(u.id); setPuestoTemp(u.puesto || ''); }}
                        style={{ cursor: 'pointer', fontSize: 12, color: u.puesto ? '#231F20' : '#94a3b8', fontStyle: u.puesto ? 'normal' : 'italic', borderBottom: '1px dashed #D4D2C6' }}
                        title="Clic para editar">
                        {u.puesto || 'Sin puesto'}
                      </span>
                    )}
                  </td>
                  {/* Fecha ingreso */}
                  <td style={{ ...td, padding: '8px 14px' }}>
                    <input
                      type="date"
                      value={u.fecha_ingreso || ''}
                      onChange={function(e) { var _uid = u.id; guardarFechaIngreso(_uid, e.target.value); }}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #D4D2C6', fontSize: 12, color: '#231F20' }} />
                  </td>
                  <td style={{ ...td, padding: '12px 14px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                      background: u.role === 'admin_rrhh' ? '#231F20' : u.role === 'lider' ? '#dbeafe' : '#f1f5f9',
                      color: u.role === 'admin_rrhh' ? '#D4D2C6' : u.role === 'lider' ? '#1e40af' : '#64748b' }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ ...td, padding: "8px 14px", minWidth: 160 }}>
                    {(u.role !== "admin_rrhh" || u.email === "florencia.salvaneschi@grupo-fabric.com" || u.email === "adrian.galvan@grupo-fabric.com") ? (
                      <select
                        value={u.leader_id || ""}
                        onChange={function(e) { var _uid = u.id; asignarLider(_uid, e.target.value); }}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #D4D2C6", fontSize: 12, background: "white" }}>
                        <option value="">Sin lider</option>
                        {usuarios.filter(function(l) { return l.id !== u.id && l.activo; }).sort(function(a,b) { return (a.full_name||"").localeCompare(b.full_name||""); }).map(function(l) {
                          return <option key={l.id} value={l.id}>{l.full_name || l.email}</option>;
                        })}
                      </select>
                    ) : (
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>Admin</span>
                    )}
                  </td>
                  <td style={{ ...td, padding: '12px 14px', textAlign: 'center' }}>
                    <button onClick={function() { toggleActivo(u); }} style={{
                      padding: '4px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      background: u.activo ? '#dcfce7' : '#fee2e2',
                      color: u.activo ? '#166534' : '#dc2626'
                    }}>{u.activo ? 'Activo' : 'Inactivo'}</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal nuevo usuario */}
      {modalNuevo && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setModalNuevo(false); }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 500, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={function(e) { e.stopPropagation(); }}>
            <h3 style={{ marginTop: 0 }}>Nuevo Usuario</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Nombre completo *', key: 'full_name', type: 'text', placeholder: 'Juan Perez' },
                { label: 'Email corporativo *', key: 'email', type: 'email', placeholder: 'juan@grupo-fabric.com' },
                { label: 'Contraseña inicial *', key: 'password', type: 'password', placeholder: 'Min. 6 caracteres' },
                { label: 'Area', key: 'area', type: 'text', placeholder: 'Ej: Operaciones' },
              ].map(function(f) {
                return (
                  <div key={f.key}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input type={f.type} value={formNuevo[f.key] || ''} placeholder={f.placeholder}
                      onChange={function(e) { var u = {}; u[f.key] = e.target.value; setFormNuevo({...formNuevo, ...u}); }}
                      style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 14, boxSizing: 'border-box' }} />
                  </div>
                );
              })}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Seniority</label>
                <select value={formNuevo.seniority} onChange={function(e) { setFormNuevo({...formNuevo, seniority: e.target.value}); }}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 14 }}>
                  {SENIORITIES.map(function(s) { return <option key={s} value={s}>{s}</option>; })}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Rol</label>
                <select value={formNuevo.role} onChange={function(e) { setFormNuevo({...formNuevo, role: e.target.value}); }}
                  style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 14 }}>
                  {ROLES.map(function(r) { return <option key={r} value={r}>{r}</option>; })}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={crearUsuario} disabled={guardando} style={{ ...s.btnPrimario, background: '#22c55e', flex: 1 }}>
                {guardando ? 'Creando...' : 'Crear Usuario'}
              </button>
              <button onClick={function() { setModalNuevo(false); }} style={s.btnSecundario}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function GestionModulos() {
  var [usuarios, setUsuarios] = useState([]);
  var [modulos, setModulos] = useState({});
  var [carg, setCarg] = useState(true);
  var [guardando, setGuardando] = useState(null);
  var [busqueda, setBusqueda] = useState('');

  var MODULOS_DISPONIBLES = [
    { id: 'desempeno', label: '📊 Desempeño', desc: 'Evaluaciones y ciclos' },
    { id: 'obj_individual', label: '🎯 Objetivos Individuales', desc: 'Mis objetivos y equipo' },
    { id: 'obj_compania', label: '🏢 Objetivos Compañía', desc: 'Objetivos estratégicos' },
  ];

  useEffect(function() { cargar(); }, []);

  async function cargar() {
    var [{ data: users }, { data: mods }] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, role').or('role.neq.admin_rrhh,email.eq.florencia.salvaneschi@grupo-fabric.com,email.eq.adrian.galvan@grupo-fabric.com').eq('activo', true).order('full_name'),
      supabase.from('modulos_usuario').select('user_id, modulo, activo'),
    ]);
    // Armar mapa: { user_id: { modulo: true/false } }
    var mapaModulos = {};
    (users || []).forEach(function(u) { mapaModulos[u.id] = {}; });
    (mods || []).forEach(function(m) {
      if (mapaModulos[m.user_id]) mapaModulos[m.user_id][m.modulo] = m.activo;
    });
    setUsuarios(users || []);
    setModulos(mapaModulos);
    setCarg(false);
  }

  async function toggleModulo(userId, moduloId, valorActual) {
    setGuardando(userId + moduloId);
    var nuevoValor = !valorActual;
    await supabase.from('modulos_usuario').upsert({ user_id: userId, modulo: moduloId, activo: nuevoValor, updated_at: new Date() }, { onConflict: 'user_id, modulo' });
    setModulos(function(prev) {
      var nuevo = { ...prev };
      nuevo[userId] = { ...nuevo[userId], [moduloId]: nuevoValor };
      return nuevo;
    });
    setGuardando(null);
  }

  async function habilitarTodo(userId) {
    for (var mod of MODULOS_DISPONIBLES) {
      await supabase.from('modulos_usuario').upsert({ user_id: userId, modulo: mod.id, activo: true, updated_at: new Date() }, { onConflict: 'user_id, modulo' });
    }
    setModulos(function(prev) {
      var nuevo = { ...prev };
      nuevo[userId] = { desempeño: true, obj_individual: true, obj_compania: true };
      return nuevo;
    });
  }

  async function deshabilitarTodo(userId) {
    for (var mod of MODULOS_DISPONIBLES) {
      await supabase.from('modulos_usuario').upsert({ user_id: userId, modulo: mod.id, activo: false, updated_at: new Date() }, { onConflict: 'user_id, modulo' });
    }
    setModulos(function(prev) {
      var nuevo = { ...prev };
      nuevo[userId] = { desempeño: false, obj_individual: false, obj_compania: false };
      return nuevo;
    });
  }

  if (carg) return <p>Cargando usuarios...</p>;

  var usuariosFiltrados = busqueda
    ? usuarios.filter(function(u) { return (u.full_name || u.email).toLowerCase().includes(busqueda.toLowerCase()) || (u.area || '').toLowerCase().includes(busqueda.toLowerCase()); })
    : usuarios;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ color: '#231F20', margin: '0 0 6px 0' }}>Gestión de Módulos por Usuario</h2>
        <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Habilitá o deshabilitá qué módulos puede ver cada colaborador en el menú.</p>
      </div>

      {/* Leyenda de módulos */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {MODULOS_DISPONIBLES.map(function(m) {
          return (
            <div key={m.id} style={{ background: '#f8f7f4', border: '1px solid #D4D2C6', borderRadius: 8, padding: '8px 14px', fontSize: 13 }}>
              <strong>{m.label}</strong><span style={{ color: '#64748b', marginLeft: 6 }}>{m.desc}</span>
            </div>
          );
        })}
      </div>

      {/* Buscador */}
      <input
        value={busqueda} onChange={function(e) { setBusqueda(e.target.value); }}
        placeholder="Buscar por nombre o área..."
        style={{ width: '100%', maxWidth: 360, padding: '10px 14px', borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }}
      />

      {/* Tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ background: '#231F20' }}>
              <th style={{ ...th, color: '#D4D2C6', padding: '12px 14px' }}>Colaborador</th>
              <th style={{ ...th, color: '#D4D2C6', padding: '12px 14px' }}>Área</th>
              <th style={{ ...th, color: '#D4D2C6', padding: '12px 14px' }}>Seniority</th>
              {MODULOS_DISPONIBLES.map(function(m) {
                return <th key={m.id} style={{ ...th, color: '#D4D2C6', padding: '12px 14px', textAlign: 'center', fontSize: 11 }}>{m.label}</th>;
              })}
              <th style={{ ...th, color: '#D4D2C6', padding: '12px 14px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuariosFiltrados.map(function(u, idx) {
              var modsUser = modulos[u.id] || {};
              return (
                <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafaf8' }}>
                  <td style={{ ...td, padding: '12px 14px' }}>
                    <strong style={{ color: '#231F20' }}>{u.full_name || '-'}</strong>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>{u.email}</div>
                  </td>
                  <td style={{ ...td, padding: '12px 14px' }}>{u.area || '-'}</td>
                  <td style={{ ...td, padding: '12px 14px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>{u.seniority || '-'}</span>
                  </td>
                  {MODULOS_DISPONIBLES.map(function(m) {
                    var activo = modsUser[m.id] === true;
                    var cargandoEste = guardando === u.id + m.id;
                    var _uid = u.id; var _mid = m.id;
                    return (
                      <td key={m.id} style={{ ...td, padding: '12px 14px', textAlign: 'center' }}>
                        <button
                          onClick={function() {
                            var val = (modulos[_uid] || {})[_mid] === true;
                            toggleModulo(_uid, _mid, val);
                          }}
                          disabled={cargandoEste}
                          style={{
                            width: 44, height: 44, borderRadius: 8, border: '2px solid',
                            borderColor: activo ? '#231F20' : '#e2e8f0',
                            cursor: 'pointer', fontSize: 18, fontWeight: 700,
                            background: activo ? '#231F20' : 'white',
                            color: activo ? '#D4D2C6' : '#94a3b8',
                            opacity: cargandoEste ? 0.5 : 1,
                            transition: 'all 0.15s',
                          }}>
                          {cargandoEste ? '⏳' : activo ? '✓' : '○'}
                        </button>
                      </td>
                    );
                  })}
                  <td style={{ ...td, padding: '12px 14px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <button onClick={function() { habilitarTodo(u.id); }} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: 'none', background: '#dcfce7', color: '#166534', cursor: 'pointer', fontWeight: 600 }}>Habilitar todo</button>
                      <button onClick={function() { deshabilitarTodo(u.id); }} style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, border: 'none', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>Deshabilitar todo</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

var th = { textAlign: 'left', padding: '10px 14px', color: '#64748b', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid #e8e6e0', background: '#F0EDE8' };
var td = { padding: '12px 14px', fontSize: '13px', color: '#231F20', borderBottom: '1px solid #f1f0ec', verticalAlign: 'middle' };
var sidebarStyle = {
  aside: { width: '240px', background: '#231F20', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 0', flexShrink: 0 },
  logoContainer: { padding: '0 20px 20px', borderBottom: '1px solid rgba(212,210,198,0.2)', marginBottom: 16, textAlign: 'center' },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, padding: '0 10px', flex: 1 },
  menuItem: { padding: '12px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 12, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', transition: 'all 0.15s', width: '100%' },
  subMenuItem: { padding: '9px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 400, transition: 'all 0.15s', width: '100%' },
  footer: { padding: '16px 20px', borderTop: '1px solid rgba(212,210,198,0.2)' }
};
var s = {
  centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20, background: '#F0EDE8' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 28px', background: '#231F20', borderBottom: '1px solid rgba(212,210,198,0.15)' },
  badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: 'rgba(212,210,198,0.15)', color: '#D4D2C6', border: '1px solid rgba(212,210,198,0.3)' },
  btnSalir: { padding: '7px 16px', background: 'transparent', color: '#D4D2C6', border: '1px solid rgba(212,210,198,0.4)', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 12 },
  tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, marginBottom: 12, border: '1px solid #e8e6e0' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
  seccionTitulo: { fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e8e6e0', textTransform: 'uppercase', letterSpacing: '0.5px' },
  competenciaCard: { background: 'white', padding: 18, borderRadius: 10, marginBottom: 12, border: '1px solid #e8e6e0', overflow: 'hidden' },
  btnInfo: { fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 },
  ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' },
  ratingBtn: { width: 40, height: 40, borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' },
  ratingInfoBox: { background: '#F0EDE8', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #e8e6e0' },
  ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 },
  textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'white' },
  textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'white' },
  btnPrimario: { padding: '10px 22px', background: '#231F20', color: '#F0EDE8', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  btnSecundario: { padding: '10px 22px', background: 'white', color: '#231F20', border: '1px solid #D4D2C6', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
  mensajeToast: { padding: '12px 20px', background: '#231F20', borderRadius: 8, marginBottom: 16, color: '#F0EDE8', fontWeight: 500, fontSize: 14, textAlign: 'center' },
  bannerEnviado: { padding: 16, background: '#dcfce7', borderRadius: 10, color: '#166534', fontWeight: 600, textAlign: 'center', marginTop: 16, border: '1px solid #86efac' }
};
