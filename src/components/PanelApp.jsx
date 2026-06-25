import { useState, useEffect, useMemo } from 'react';
import emailjs from "@emailjs/browser";
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
async function crearNotificacion(liderId, tipo, mensaje, origenId, origenNombre) {
 if (!liderId) return;
 await supabase.from("notificaciones").insert({ user_id: liderId, tipo: tipo, mensaje: mensaje, origen_id: origenId || null, origen_nombre: origenNombre || null });
}

async function enviarEmailNotificacion(toEmail, toName, subject, message) {
 try {
 await emailjs.send(
 "service_xfgapna",
 "template_xs3nenc",
 { to_email: toEmail, to_name: toName, subject: subject, message: message },
 "Mc-YPiWB1XNBKfhOJ"
 );
 console.log("Email enviado a", toEmail);
 } catch (err) {
 console.warn("Error enviando email:", err);
 }
}
export default function PanelApp() {
 var [profile, setProfile] = useState(null);
 var [loading, setLoading] = useState(true);
 var [menuActivo, setMenuActivo] = useState('desempeno');
 var [cicloActivo, setCicloActivo] = useState(null);
 var [vistaComoColaborador, setVistaComoColaborador] = useState(false);
 var [modulosActivos, setModulosActivos] = useState([]);
 var [notifs, setNotifs] = useState([]);
  var [notifsActivas, setNotifsActivas] = useState(true);
 var [showNotifs, setShowNotifs] = useState(false);

 useEffect(function() { cargarPerfil(); }, []);
  useEffect(function() { try { var val = localStorage.getItem("notifsActivas"); if (val === "false") setNotifsActivas(false); } catch(e) {} }, []);

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
 cargarNotifs(perfil.id);
 }

 async function cerrarSesion() { await supabase.auth.signOut(); window.location.href = '/'; }

 async function cargarNotifs(userId) {
 var { data } = await supabase.from("notificaciones").select("*").eq("user_id", userId).eq("leida", false).order("created_at", { ascending: false }).limit(20);
 setNotifs(data || []);
 }

 async function marcarLeida(id) {
 await supabase.from("notificaciones").update({ leida: true }).eq("id", id);
 setNotifs(function(prev) { return prev.filter(function(n) { return n.id !== id; }); });
 }

 async function marcarTodasLeidas(userId) {
 await supabase.from("notificaciones").update({ leida: true }).eq("user_id", userId).eq("leida", false);
 setNotifs([]);
 }

  function toggleNotifsActivas() {
    var nuevo = !notifsActivas;
    setNotifsActivas(nuevo);
    try { localStorage.setItem("notifsActivas", String(nuevo)); } catch(e) {}
  }


 if (loading) return <div style={s.centrado}><p>Cargando...</p></div>;
 if (!profile) return <div style={s.centrado}><h2>Error</h2><button onClick={cerrarSesion} style={s.btnSalir}>Volver</button></div>;

 var esAdmin = profile.role === 'admin_rrhh';
 var esSuperAdmin = profile.email === 'florencia.salvaneschi@grupo-fabric.com' || profile.email === 'adrian.galvan@grupo-fabric.com';
 var esGerente = profile.seniority === 'Gerente';
 var tieneEquipo = profile.role === 'admin_rrhh' || profile.role === 'lider' || esGerente;

 var rolEfectivo = (esAdmin && vistaComoColaborador) ? 'colaborador' : profile.role;
 var nombreRol = rolEfectivo === 'admin_rrhh' ? 'Admin RRHH' : rolEfectivo === 'lider' ? 'Lider' : 'Colaborador';
 var emojiRol = rolEfectivo === 'admin_rrhh' ? '' : rolEfectivo === 'lider' ? '' : '';
 var profileEfectivo = { ...profile, role: rolEfectivo };

 // Módulos visibles — admin ve todo, resto según tabla
 var modulosVer = esAdmin && !vistaComoColaborador
 ? ['desempeno', 'obj_individual', 'obj_compania', 'capacitaciones']
 : modulosActivos;

 var verDesempeno = modulosVer.includes('desempeno');
 var verObjIndividual = modulosVer.includes('obj_individual');
 var verObjCompania = modulosVer.includes('obj_compania');
 var verAlgunObj = verObjIndividual || verObjCompania;
  var verCapacitaciones = esAdmin || modulosVer.includes('capacitaciones');

 return (
 <div style={{ display: 'flex', minHeight: '100vh' }}>
 <aside style={sidebarStyle.aside}>
 <div style={sidebarStyle.logoContainer}><img src="/logo.jpg" alt="Fabric Group" style={{ height: '40px' }} /></div>
 <nav style={sidebarStyle.nav}>
 {/* DESEMPEÑO */}
 {verDesempeno && (<>
          <button onClick={function() { setMenuActivo('dashboard_global'); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'dashboard_global' ? '#D4D2C6' : 'transparent', color: menuActivo === 'dashboard_global' ? '#231F20' : '#D4D2C6' }}>DASHBOARD</button>
          <button onClick={function() { setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' }}>DESEMPEÑO</button>
 </>)}
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
          {verCapacitaciones && (
            <button onClick={function() { setMenuActivo("capacitaciones"); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === "capacitaciones" ? "#D4D2C6" : "transparent", color: menuActivo === "capacitaciones" ? "#231F20" : "#D4D2C6" }}>CAPACITACIONES</button>
          )}
 </nav>
  <div style={sidebarStyle.footer}>
    {esSuperAdmin && (
      <div style={{ marginBottom: 10, padding: "8px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: notifsActivas ? "#86efac" : "#94a3b8", fontWeight: 600 }}>Notificaciones {notifsActivas ? "ON" : "OFF"}</span>
          <button onClick={toggleNotifsActivas} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: notifsActivas ? "#166534" : "#475569", position: "relative", transition: "background 0.2s" }}>
            <span style={{ position: "absolute", top: 2, left: notifsActivas ? 20 : 2, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
          </button>
        </div>
      </div>
    )}
    <span style={{ fontSize: 12, color: "#D4D2C6" }}>{profile.email}</span>
    <button onClick={cerrarSesion} style={{ ...s.btnSalir, marginTop: 8, width: "100%" }}>Cerrar Sesion</button>
  </div>
 </aside>

 <div style={{ flex: 1, background: '#f8fafc', minHeight: '100vh' }}>
 <header style={s.header}>
 <h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 {esAdmin && !vistaComoColaborador && (
 <button onClick={function() { setVistaComoColaborador(true); setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ padding: '6px 14px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
 Ver como Colaborador
 </button>
 )}
 {esAdmin && vistaComoColaborador && (
 <button onClick={function() { setVistaComoColaborador(false); setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ padding: '6px 14px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
 Volver a Admin
 </button>
 )}
 {/* Campanita de notificaciones */}
 <div style={{ position: "relative" }}>
 <button onClick={function() { setShowNotifs(!showNotifs); }} style={{ position: "relative", background: "transparent", border: "1px solid rgba(212,210,198,0.4)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: "#D4D2C6", fontSize: 18 }}> 🔔

 {notifs.length > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: "#dc2626", color: "white", borderRadius: "50%", width: 18, height: 18, fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{notifs.length > 9 ? "9+" : notifs.length}</span>}
 </button>
 {showNotifs && (
 <div style={{ position: "absolute", right: 0, top: "110%", width: 340, background: "white", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", border: "1px solid #e8e6e0", zIndex: 1000, overflow: "hidden" }} onClick={function(e) { e.stopPropagation(); }}>
 <div style={{ padding: "14px 16px", borderBottom: "1px solid #e8e6e0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
 <strong style={{ color: "#231F20", fontSize: 14 }}>Notificaciones {notifs.length > 0 ? "(" + notifs.length + ")" : ""}</strong>
 {notifs.length > 0 && <button onClick={function() { marcarTodasLeidas(profile.id); }} style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Marcar todas como leídas</button>}
 </div>
 {notifs.length === 0 ? (
 <p style={{ textAlign: "center", padding: "24px 16px", color: "#94a3b8", fontSize: 13, margin: 0 }}>Sin notificaciones nuevas</p>
 ) : (
 <div style={{ maxHeight: 360, overflowY: "auto" }}>
 {notifs.map(function(n) {
 return (
 <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f1f0ec", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
 <div style={{ flex: 1 }}>
 <p style={{ margin: "0 0 4px 0", fontSize: 13, color: "#231F20", lineHeight: 1.4 }}>{n.mensaje}</p>
 <span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(n.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
 </div>
 <button onClick={function() { marcarLeida(n.id); }} style={{ background: "none", border: "1px solid #e8e6e0", borderRadius: 6, cursor: "pointer", padding: "4px 8px", fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>Leída</button>
 </div>
 );
 })}
 </div>
 )}
 </div>
 )}
 </div>
 <span style={s.badge}>{emojiRol} {profile.puesto || nombreRol}</span>
 </div>
 </header>

 {vistaComoColaborador && (
 <div style={{ padding: '10px 24px', background: '#fef3c7', borderBottom: '2px solid #f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
 <span style={{ fontSize: 13, color: '#92400e', fontWeight: 600 }}>️ Estas viendo la plataforma como colaborador.</span>
 <button onClick={function() { setVistaComoColaborador(false); setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ padding: '4px 12px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Salir</button>
 </div>
 )}

 <main style={{ padding: 24 }}>
 {menuActivo === 'desempeno' && verDesempeno && <DesempenoView profile={profileEfectivo} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
          {menuActivo === "dashboard_global" && esSuperAdmin && !vistaComoColaborador && <DashboardGlobal />}
 {menuActivo === 'misobjetivos' && verObjIndividual && <ObjetivosColaborador profile={profile} />}
 {menuActivo === 'miequipo_obj' && verObjIndividual && <ObjetivosGerente profile={profile} />}
 {menuActivo === 'compania_obj' && verObjCompania && <ObjetivosCompania esAdmin={esAdmin && !vistaComoColaborador} />}
          {menuActivo === "capacitaciones" && verCapacitaciones && <ModuloCapacitaciones profile={profileEfectivo} esAdmin={esAdmin && !vistaComoColaborador} />}
 {menuActivo === 'admin_obj' && !vistaComoColaborador && esSuperAdmin && <PanelAdminObjetivos profile={profile} />}
 {menuActivo === 'gestion_modulos' && !vistaComoColaborador && esSuperAdmin && <GestionModulos />}
 {menuActivo === 'gestion_visibilidad' && !vistaComoColaborador && esSuperAdmin && <GestionVisibilidad />}
 {menuActivo === 'gestion_usuarios' && !vistaComoColaborador && esSuperAdmin && <GestionUsuarios />}
 {!verDesempeno && !verAlgunObj && (
 <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}>
 <p style={{ fontSize: 40, marginBottom: 16 }}></p>
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
 <h2 style={{ color: '#231F20', margin: 0 }}> {cicloActivo.nombre}</h2>
 <span style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600, background: cicloActivo.estado === 'activo' ? '#dcfce7' : '#fee2e2', color: cicloActivo.estado === 'activo' ? '#166534' : '#dc2626' }}>{cicloActivo.estado === 'activo' ? ' Abierto' : ' Cerrado'}</span>
 </div>
 <p style={{ color: '#64748b', marginBottom: 8 }}>{new Date(cicloActivo.fecha_inicio).toLocaleDateString('es-AR')}{cicloActivo.fecha_fin ? ' - ' + new Date(cicloActivo.fecha_fin).toLocaleDateString('es-AR') : ''}</p>
 {soloLectura && <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, marginBottom: 16, color: '#92400e', fontSize: 14, textAlign: 'center' }}> Este ciclo esta cerrado. Solo puedes ver la informacion en modo lectura.</div>}
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
 async function abrirGestion(ciclo) { setCGestion(ciclo.id); var { data } = await supabase.from("ciclo_colaboradores").select("colaborador_id").eq("ciclo_id", ciclo.id); setParts((data || []).map(function(p) { return p.colaborador_id; })); }
 async function togglePart(cid) { if (parts.includes(cid)) { await supabase.from("ciclo_colaboradores").delete().eq("ciclo_id", cGestion).eq("colaborador_id", cid); setParts(function(p) { return p.filter(function(id) { return id !== cid; }); }); } else { await supabase.from("ciclo_colaboradores").insert({ ciclo_id: cGestion, colaborador_id: cid }); setParts(function(p) { return [...p, cid]; }); } }
 async function eliminarCiclo(ciclo) {
 if (typeof window !== 'undefined' && !window.confirm('Eliminar el ciclo ' + ciclo.nombre + '. Se eliminarán también todos sus participantes. Esta acción no se puede deshacer.')) return;
 var cicloId = ciclo.id;
 // 1. Puntuaciones (dependen de evaluaciones)
 var { data: evs } = await supabase.from('evaluaciones').select('id').eq('ciclo_id', cicloId);
 var evIds = (evs || []).map(function(e) { return e.id; });
 if (evIds.length > 0) await supabase.from('puntuaciones').delete().in('evaluacion_id', evIds);
 // 2. Tablas que dependen de ciclos
 await supabase.from('evaluaciones').delete().eq('ciclo_id', cicloId);
 await supabase.from('feedback').delete().eq('ciclo_id', cicloId);
 await supabase.from('ciclo_colaboradores').delete().eq('ciclo_id', cicloId);
 // 3. Ciclo
 var { error } = await supabase.from('ciclos').delete().eq('id', cicloId);
 if (error) { alert('Error al eliminar: ' + error.message); return; }
 cargarCiclos();
 }
 if (carg) return <p style={{ color: '#64748b', padding: 40 }}>Cargando ciclos...</p>;
 var inp = { padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', boxSizing: 'border-box' };
 return (
 <div>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
 <div><h2 style={{ color: '#231F20', margin: '0 0 4px 0', fontSize: 22, fontWeight: 700 }}>Ciclos de Evaluación de Desempeño</h2><p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>{ciclos.length} ciclo{ciclos.length !== 1 ? 's' : ''} registrado{ciclos.length !== 1 ? 's' : ''}</p></div>
 {esAdmin && <button onClick={function() { setShowC(!showC); }} style={s.btnPrimario}>Nuevo ciclo</button>}
 </div>
 {showC && (<div style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 20, marginBottom: 20 }}><h4 style={{ margin: '0 0 16px 0', color: '#231F20' }}>Crear nuevo ciclo</h4><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}><div style={{ flex: 2, minWidth: 180 }}><label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Nombre *</label><input value={nom} onChange={function(e) { setNom(e.target.value); }} placeholder="Ej: 1er Semestre 2026" style={{ ...inp, width: '100%' }} /></div><div><label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Inicio *</label><input type="date" value={fIni} onChange={function(e) { setFIni(e.target.value); }} style={inp} /></div><div><label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Fin</label><input type="date" value={fFin} onChange={function(e) { setFFin(e.target.value); }} style={inp} /></div><button onClick={crearCiclo} style={{ ...s.btnPrimario, background: '#166534' }}>Crear</button><button onClick={function() { setShowC(false); }} style={s.btnSecundario}>Cancelar</button></div></div>)}
 {cGestion && (<div style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 20, marginBottom: 20 }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><div><h4 style={{ margin: 0, color: '#231F20' }}>Seleccionar Participantes</h4><p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>{parts.length} seleccionado{parts.length !== 1 ? 's' : ''}</p></div><button onClick={function() { setCGestion(null); }} style={s.btnInfo}>Cerrar</button></div><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8, maxHeight: 320, overflowY: 'auto' }}>{todos.map(function(c) { var sel = parts.includes(c.id); return (<div key={c.id} onClick={function() { togglePart(c.id); }} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: sel ? '#231F20' : '#F0EDE8', color: sel ? '#D4D2C6' : '#231F20', border: '1px solid ' + (sel ? '#231F20' : '#e8e6e0') }}><div><strong style={{ fontSize: 13, display: 'block' }}>{c.full_name || c.email}</strong><span style={{ fontSize: 11, opacity: 0.7 }}>{c.puesto || c.area}</span></div><span style={{ fontSize: 14, fontWeight: 700 }}>{sel ? '' : '○'}</span></div>); })}</div></div>)}
 {ciclos.length === 0 ? (<div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: 'white', borderRadius: 12, border: '1px solid #e8e6e0' }}>No hay ciclos creados.</div>) : (
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
 {ciclos.map(function(ciclo) { var abierto = ciclo.estado === 'activo'; return (
 <div key={ciclo.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderTop: '3px solid ' + (abierto ? '#231F20' : '#D4D2C6'), padding: '20px 22px' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}><h3 style={{ color: '#231F20', margin: 0, fontSize: 17, fontWeight: 700 }}>{ciclo.nombre}</h3><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: abierto ? '#dcfce7' : '#f1f5f9', color: abierto ? '#166534' : '#64748b', flexShrink: 0, marginLeft: 8 }}>{abierto ? 'Abierto' : 'Cerrado'}</span></div>
 <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 4px 0' }}>Inicio: {new Date(ciclo.fecha_inicio).toLocaleDateString('es-AR')}</p>
 {ciclo.fecha_fin && <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 12px 0' }}>Fin: {new Date(ciclo.fecha_fin).toLocaleDateString('es-AR')}</p>}
 <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
 <button onClick={function() { onSelectCiclo(ciclo); }} style={{ ...s.btnPrimario, flex: 1, textAlign: 'center' }}>{ciclo.estado === 'cerrado' && !esAdmin ? 'Ver' : 'Entrar'}</button>
 {esAdmin && <button onClick={function() { abrirGestion(ciclo); }} style={s.btnInfo}>Participantes</button>}
 {esSuperAdmin && <button onClick={function() { toggleCiclo(ciclo); }} style={{ ...s.btnInfo, color: abierto ? "#dc2626" : "#166534", borderColor: abierto ? "#fca5a5" : "#86efac", background: abierto ? "#fee2e2" : "#dcfce7" }}>{abierto ? "Cerrar" : "Abrir"}</button>}
 {esSuperAdmin && <button onClick={function() { eliminarCiclo(ciclo); }} style={{ ...s.btnInfo, color: "#dc2626", borderColor: "#fca5a5", background: "#fee2e2" }}>Eliminar</button>}
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
 supabase.from('evaluaciones').select('id, colaborador_id, ciclo_id, tipo_evaluacion, rating_promedio, rating_calibrado, estado').eq('ciclo_id', cicloId),
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
 <button onClick={function() { setVista('evaluaciones'); }} style={vista === 'evaluaciones' ? s.btnPrimario : s.btnInfo}>Ver Evaluaciones</button>
 <button onClick={function() { setVista('calibracion'); }} style={vista === 'calibracion' ? s.btnPrimario : s.btnInfo}> Calibracion</button>
 <button onClick={function() { setVista('feedback'); }} style={vista === 'feedback' ? s.btnPrimario : s.btnInfo}> Feedback</button>
 <button onClick={function() { setVista('equipo'); }} style={vista === 'equipo' ? s.btnPrimario : s.btnInfo}>Mi Equipo</button>
 {tieneAutoevaluacion && <button onClick={function() { setVista('mievaluacion'); }} style={vista === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>Mi Evaluacion</button>}
 <button onClick={function() { setVista('colaboradores'); }} style={vista === 'colaboradores' ? s.btnPrimario : s.btnInfo}>Participantes</button>
 <button onClick={function() { setVista('modulos'); }} style={vista === 'modulos' ? s.btnPrimario : s.btnInfo}>Modulos</button>
 </div>
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
function DashboardGlobal() {
  var [tabActivo, setTabActivo] = useState('desempeno');
  var [statsDesempeno, setStatsDesempeno] = useState({ evaluaciones: [], puntuaciones: [], perfiles: [] });
  var [colabs, setColabs] = useState([]);
  var [ciclos, setCiclos] = useState([]);
  // Objetivos
  var [objetivosData, setObjetivosData] = useState([]);
  var [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear());
  var [filtroAreaObj, setFiltroAreaObj] = useState('Todas');
  var [filtroColabObj, setFiltroColabObj] = useState('Todos');
  var [cargando, setCargando] = useState(true);
  var [filtroAreaDesemp, setFiltroAreaDesemp] = useState("Todas");
  var [filtroSeniorityDesemp, setFiltroSeniorityDesemp] = useState("Todos");
  var [filtroColabDesemp, setFiltroColabDesemp] = useState("Todos");
  var [filtroCicloDesemp, setFiltroCicloDesemp] = useState("Todos");

  useEffect(function() { cargarTodo(); }, []);

  async function cargarTodo() {
    setCargando(true);
    var [
      { data: perfiles },
      { data: evs },
      { data: punts },
      { data: cics },
      { data: objs },
    ] = await Promise.all([
      supabase.from('profiles').select('id, email, full_name, area, seniority').eq('activo', true),
      supabase.from('evaluaciones').select('id, colaborador_id, ciclo_id, tipo_evaluacion, rating_promedio, rating_calibrado, estado'),
      supabase.from('puntuaciones').select('evaluacion_id, rating, competencias(nombre)'),
      supabase.from('ciclos').select('id, nombre').order('fecha_inicio', { ascending: false }),
      supabase.from('objetivos').select('id, colaborador_id, corporativo, ponderacion, status, alcance_completado, alcance_validado, anio').order('created_at'),
    ]);
    setStatsDesempeno({ evaluaciones: evs || [], puntuaciones: punts || [], perfiles: perfiles || [] });
    setColabs(perfiles || []);
    setCiclos(cics || []);
    setObjetivosData(objs || []);
    setCargando(false);
  }

  if (cargando) return <p style={{ padding: 40, color: '#64748b' }}>Cargando dashboard...</p>;

  // Opciones de filtro para desempeño
  var areasDesemp = ['Todas'].concat([...new Set(colabs.map(function(c) { return c.area; }).filter(Boolean))].sort());
  var senioritiesDesemp = ['Todos'].concat([...new Set(colabs.map(function(c) { return c.seniority; }).filter(Boolean))].sort());
  var ciclosOpts = [{ id: 'Todos', nombre: 'Todos los ciclos' }].concat(ciclos);

  // Perfiles filtrados para desempeño
  var colabsFiltradosDesemp = colabs.filter(function(c) {
    if (filtroAreaDesemp !== 'Todas' && c.area !== filtroAreaDesemp) return false;
    if (filtroSeniorityDesemp !== 'Todos' && c.seniority !== filtroSeniorityDesemp) return false;
    if (filtroColabDesemp !== 'Todos' && c.id !== filtroColabDesemp) return false;
    return true;
  });
  var idsDesemp = colabsFiltradosDesemp.map(function(c) { return c.id; });

  // Evaluaciones filtradas
  var evsFiltradas = (statsDesempeno.evaluaciones || []).filter(function(e) {
    if (!idsDesemp.includes(e.colaborador_id)) return false;
    if (filtroCicloDesemp !== 'Todos' && String(e.ciclo_id) !== String(filtroCicloDesemp)) return false;
    return true;
  });

  // Gráfico araña — solo evaluaciones filtradas del líder
  var compMap = {};
  var evsLiderIds = evsFiltradas.filter(function(e) { return e.tipo_evaluacion === 'evaluacion_lider'; }).map(function(e) { return e.id; });
  (statsDesempeno.puntuaciones || []).forEach(function(p) {
    if (!evsLiderIds.includes(p.evaluacion_id)) return;
    var nombre = p.competencias?.nombre;
    if (!nombre || !p.rating) return;
    if (!compMap[nombre]) compMap[nombre] = { sum: 0, count: 0 };
    compMap[nombre].sum += parseFloat(p.rating);
    compMap[nombre].count++;
  });
  var compData = Object.entries(compMap).map(function(e) { return { nombre: e[0], prom: e[1].sum / e[1].count }; }).sort(function(a,b) { return b.prom - a.prom; });

  // Distribución desempeño — filtrada
  var evalLider = evsFiltradas.filter(function(e) { return e.tipo_evaluacion === 'evaluacion_lider' && e.rating_calibrado; });
  var bajo = 0; var medio = 0; var alto = 0;
  evalLider.forEach(function(e) {
    var r = parseFloat(e.rating_calibrado);
    if (r < 3) bajo++; else if (r <= 3.5) medio++; else alto++;
  });
  var totalG1 = bajo + medio + alto;

  // OBJETIVOS — filtrar por año, área y colaborador
  var areas = ['Todas'].concat([...new Set(colabs.map(function(c) { return c.area; }).filter(Boolean))].sort());
  var anios = [...new Set(objetivosData.map(function(o) { return o.anio; }).filter(Boolean))].sort(function(a,b) { return b - a; });
  if (!anios.includes(anioFiltro)) anios.unshift(anioFiltro);

  var colabsFiltradosObj = colabs.filter(function(c) {
    if (filtroAreaObj !== 'Todas' && c.area !== filtroAreaObj) return false;
    if (filtroColabObj !== 'Todos' && c.id !== filtroColabObj) return false;
    return true;
  });
  var idsColabsObj = colabsFiltradosObj.map(function(c) { return c.id; });

  var objsFiltrados = objetivosData.filter(function(o) {
    if (String(o.anio) !== String(anioFiltro)) return false;
    if (!idsColabsObj.includes(o.colaborador_id)) return false;
    return true;
  });

  // Gráfico 1 objetivos: Alcance promedio por área
  var alcancePorArea = {};
  objsFiltrados.forEach(function(o) {
    var colab = colabs.find(function(c) { return c.id === o.colaborador_id; });
    var area = colab?.area || 'Sin área';
    var alcance = parseFloat(o.alcance_validado || o.alcance_completado || 0);
    if (!alcancePorArea[area]) alcancePorArea[area] = { sum: 0, count: 0 };
    if (alcance > 0) { alcancePorArea[area].sum += alcance; alcancePorArea[area].count++; }
  });
  var alcanceAreaData = Object.entries(alcancePorArea)
    .filter(function(e) { return e[1].count > 0; })
    .map(function(e) { return { area: e[0], prom: (e[1].sum / e[1].count).toFixed(1) }; })
    .sort(function(a,b) { return parseFloat(b.prom) - parseFloat(a.prom); });

  // Gráfico 2 objetivos: Ranking alcance anual por colaborador
  var alcancePorColab = {};
  objsFiltrados.forEach(function(o) {
    var colab = colabs.find(function(c) { return c.id === o.colaborador_id; });
    if (!colab) return;
    var nombre = colab.full_name || colab.email;
    var alcance = parseFloat(o.alcance_validado || o.alcance_completado || 0);
    if (!alcancePorColab[nombre]) alcancePorColab[nombre] = { sum: 0, count: 0, area: colab.area };
    if (alcance > 0) { alcancePorColab[nombre].sum += alcance; alcancePorColab[nombre].count++; }
  });
  var rankingData = Object.entries(alcancePorColab)
    .filter(function(e) { return e[1].count > 0; })
    .map(function(e) { return { nombre: e[0], prom: (e[1].sum / e[1].count).toFixed(1), area: e[1].area }; })
    .sort(function(a,b) { return parseFloat(b.prom) - parseFloat(a.prom); });

  var AREA_COLORS = ['#2d6a4f','#c2410c','#1d4ed8','#7c3aed','#0e7490','#92400e','#064e3b','#be123c'];
  function areaColor(area) {
    var idx = Math.abs((area||'').split('').reduce(function(a,c) { return a + c.charCodeAt(0); }, 0)) % AREA_COLORS.length;
    return AREA_COLORS[idx];
  }

  var selectStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', color: '#231F20', cursor: 'pointer', fontWeight: 500 };

  // Spider chart inline
  function SpiderMini({ datos }) {
    if (!datos || datos.length === 0) return <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20, fontSize: 12 }}>Sin datos</p>;
    var N = datos.length; var CX = 260; var CY = 260; var R = 150;
    function pt(idx, val) { var a = (Math.PI * 2 * idx / N) - Math.PI / 2; var r = (val / 5) * R; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; }
    function pte(idx, r) { var a = (Math.PI * 2 * idx / N) - Math.PI / 2; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; }
    var poly = datos.map(function(d, i) { var p = pt(i, d.prom); return p.x + ',' + p.y; }).join(' ');
    return (
      <svg viewBox="0 0 520 520" style={{ width: "100%", maxWidth: 520 }}>
        {[1,2,3,4,5].map(function(n) { return <polygon key={n} points={datos.map(function(_,i) { var p = pte(i,(n/5)*R); return p.x+','+p.y; }).join(' ')} fill="none" stroke={n===5?'#D4D2C6':'#e8e6e0'} strokeWidth={n===5?1.5:1} />; })}
        {datos.map(function(_,i) { var p = pte(i,R); return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#e8e6e0" strokeWidth="1" />; })}
        <polygon points={poly} fill="rgba(35,31,32,0.12)" stroke="#231F20" strokeWidth="2" />
        {datos.map(function(d,i) { var p = pt(i,d.prom); return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#231F20" />; })}
        {datos.map(function(d,i) {
          var p = pte(i,R+60); var anchor = p.x < CX-10 ? 'end' : p.x > CX+10 ? 'start' : 'middle';
          var words = d.nombre.split(' '); var lines = [];
          for (var w=0;w<words.length;w+=2) lines.push(words.slice(w,w+2).join(' '));
          return <g key={i}>{lines.map(function(l,li) { return <text key={li} x={p.x} y={p.y-lines.length*7+li*14} fontSize="11" fill="#231F20" fontWeight="600" textAnchor={anchor}>{l}</text>; })}<text x={p.x} y={p.y+lines.length*7+6} fontSize="12" fill="#64748b" fontWeight="700" textAnchor={anchor}>{d.prom.toFixed(1)}</text></g>;
        })}
      </svg>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <button onClick={function() { setTabActivo('desempeno'); }} style={tabActivo === 'desempeno' ? s.btnPrimario : s.btnInfo}>Desempeño</button>
        <button onClick={function() { setTabActivo('objetivos'); }} style={tabActivo === 'objetivos' ? s.btnPrimario : s.btnInfo}>Objetivos</button>
      </div>

      {/* ===== SECCIÓN DESEMPEÑO ===== */}
      {tabActivo === 'desempeno' && (
        <div>
          <h2 style={{ color: '#231F20', margin: '0 0 20px 0', fontSize: 20, fontWeight: 700 }}>Desempeño — Vista general</h2>
          {/* Filtros desempeño */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center", background: "white", padding: "12px 16px", borderRadius: 10, border: "1px solid #e8e6e0" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase" }}>Filtrar:</span>
            <select value={filtroAreaDesemp} onChange={function(e) { setFiltroAreaDesemp(e.target.value); setFiltroColabDesemp("Todos"); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #e8e6e0", fontSize: 13, background: "white" }}>
              {areasDesemp.map(function(a) { return <option key={a} value={a}>{a === "Todas" ? "Todas las áreas" : a}</option>; })}
            </select>
            <select value={filtroSeniorityDesemp} onChange={function(e) { setFiltroSeniorityDesemp(e.target.value); setFiltroColabDesemp("Todos"); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #e8e6e0", fontSize: 13, background: "white" }}>
              {senioritiesDesemp.map(function(s) { return <option key={s} value={s}>{s === "Todos" ? "Todos los seniority" : s}</option>; })}
            </select>
            <select value={filtroColabDesemp} onChange={function(e) { setFiltroColabDesemp(e.target.value); setFiltroAreaDesemp("Todas"); setFiltroSeniorityDesemp("Todos"); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #e8e6e0", fontSize: 13, background: "white", minWidth: 180 }}>
              <option value="Todos">Todos los colaboradores</option>
              {colabs.sort(function(a,b) { return (a.full_name||"").localeCompare(b.full_name||""); }).map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email}</option>; })}
            </select>
            <select value={filtroCicloDesemp} onChange={function(e) { setFiltroCicloDesemp(e.target.value); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #e8e6e0", fontSize: 13, background: "white" }}>
              {ciclosOpts.map(function(c) { return <option key={c.id} value={c.id}>{c.nombre}</option>; })}
            </select>
            {(filtroAreaDesemp !== "Todas" || filtroSeniorityDesemp !== "Todos" || filtroColabDesemp !== "Todos" || filtroCicloDesemp !== "Todos") && (
              <button onClick={function() { setFiltroAreaDesemp("Todas"); setFiltroSeniorityDesemp("Todos"); setFiltroColabDesemp("Todos"); setFiltroCicloDesemp("Todos"); }} style={{ fontSize: 12, padding: "7px 12px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fee2e2", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>Limpiar</button>
            )}
          </div>
          <div style={s.grid}>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Evaluaciones lider</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{evalLider.length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Calibradas</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{totalG1}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '3px solid #166534' }}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Alto desempeño</p><p style={{ fontSize: 32, fontWeight: 800, color: '#166534', margin: '6px 0' }}>{alto}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '3px solid #dc2626' }}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Bajo desempeño</p><p style={{ fontSize: 32, fontWeight: 800, color: '#dc2626', margin: '6px 0' }}>{bajo}</p></div>
          </div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 20 }}>
            {/* Distribución */}
            <div style={{ ...s.tarjetaStat, flex: 1, minWidth: 260 }}>
              <h4 style={{ margin: '0 0 6px 0', color: '#231F20', fontSize: 14, fontWeight: 700 }}>Distribución de Desempeño</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 11, color: '#94a3b8' }}>Solo evaluaciones calibradas</p>
              {totalG1 === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>Sin datos calibrados</p> : (
                [{ label: 'Alto', valor: alto, color: '#166534', rango: '3.6–5' }, { label: 'Medio', valor: medio, color: '#92400e', rango: '3–3.5' }, { label: 'Bajo', valor: bajo, color: '#dc2626', rango: '1–2.9' }].map(function(g) {
                  var pct = Math.round(g.valor / totalG1 * 100);
                  return <div key={g.label} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><span style={{ fontSize: 13, fontWeight: 600, color: g.color }}>{g.label} <span style={{ fontSize: 11, color: '#94a3b8' }}>({g.rango})</span></span><span style={{ fontSize: 13, fontWeight: 700 }}>{g.valor} ({pct}%)</span></div>
                    <div style={{ background: '#f1f5f9', borderRadius: 6, height: 22, overflow: 'hidden' }}><div style={{ background: g.color, height: '100%', width: pct + '%', borderRadius: 6 }} /></div>
                  </div>;
                })
              )}
            </div>
            {/* Araña */}
            <div style={{ ...s.tarjetaStat, flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#231F20', fontSize: 14, fontWeight: 700, alignSelf: 'flex-start' }}>Promedio por Competencia</h4>
              <p style={{ margin: '0 0 12px 0', fontSize: 11, color: '#94a3b8', alignSelf: 'flex-start' }}>Evaluaciones del líder calibradas</p>
              <SpiderMini datos={compData} />
            </div>
          </div>
        </div>
      )}

      {/* ===== SECCIÓN OBJETIVOS ===== */}
      {tabActivo === 'objetivos' && (
        <div>
          <h2 style={{ color: '#231F20', margin: '0 0 20px 0', fontSize: 20, fontWeight: 700 }}>Objetivos — Vista general</h2>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center', background: 'white', padding: '14px 16px', borderRadius: 10, border: '1px solid #e8e6e0' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Filtrar:</span>
            <select value={anioFiltro} onChange={function(e) { setAnioFiltro(parseInt(e.target.value)); }} style={selectStyle}>
              {anios.map(function(a) { return <option key={a} value={a}>{a}</option>; })}
            </select>
            <select value={filtroAreaObj} onChange={function(e) { setFiltroAreaObj(e.target.value); setFiltroColabObj('Todos'); }} style={selectStyle}>
              {areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las áreas' : a}</option>; })}
            </select>
            <select value={filtroColabObj} onChange={function(e) { setFiltroColabObj(e.target.value); setFiltroAreaObj('Todas'); }} style={{ ...selectStyle, minWidth: 180 }}>
              <option value="Todos">Todos los colaboradores</option>
              {colabs.sort(function(a,b) { return (a.full_name||'').localeCompare(b.full_name||''); }).map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email}</option>; })}
            </select>
            {(filtroAreaObj !== 'Todas' || filtroColabObj !== 'Todos') && (
              <button onClick={function() { setFiltroAreaObj('Todas'); setFiltroColabObj('Todos'); }} style={{ fontSize: 12, padding: '7px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>Limpiar</button>
            )}
          </div>

          {/* KPI Objetivos */}
          <div style={{ ...s.grid, marginBottom: 24 }}>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Objetivos {anioFiltro}</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{objsFiltrados.length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Validados</p><p style={{ fontSize: 32, fontWeight: 800, color: '#166534', margin: '6px 0' }}>{objsFiltrados.filter(function(o) { return o.status === 'validado'; }).length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Con alcance</p><p style={{ fontSize: 32, fontWeight: 800, color: '#1d4ed8', margin: '6px 0' }}>{objsFiltrados.filter(function(o) { return o.alcance_completado || o.alcance_validado; }).length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Alcance promedio</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{rankingData.length > 0 ? (rankingData.reduce(function(s,r) { return s + parseFloat(r.prom); }, 0) / rankingData.length).toFixed(1) + '%' : '—'}</p></div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            {/* Gráfico 1: Alcance promedio por área */}
            <div style={{ ...s.tarjetaStat, flex: 1, minWidth: 280 }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#231F20', fontSize: 14, fontWeight: 700 }}>Alcance promedio por área</h4>
              {alcanceAreaData.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>Sin alcances registrados</p> : (
                alcanceAreaData.map(function(d) {
                  var color = areaColor(d.area);
                  var pct = Math.min(parseFloat(d.prom), 120);
                  return <div key={d.area} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#231F20' }}>{d.area}</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: color }}>{d.prom}%</span>
                    </div>
                    <div style={{ background: '#f1f5f9', borderRadius: 6, height: 22, overflow: 'hidden' }}>
                      <div style={{ background: color, height: '100%', width: (pct / 120 * 100) + '%', borderRadius: 6 }} />
                    </div>
                  </div>;
                })
              )}
            </div>

            {/* Gráfico 2: Ranking alcance anual por colaborador */}
            <div style={{ ...s.tarjetaStat, flex: 2, minWidth: 320 }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#231F20', fontSize: 14, fontWeight: 700 }}>Ranking — Alcance anual por colaborador</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 11, color: '#94a3b8' }}>Promedio de alcances reportados/validados</p>
              {rankingData.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>Sin alcances registrados para {anioFiltro}</p> : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {rankingData.map(function(d, idx) {
                    var color = areaColor(d.area);
                    var pct = Math.min(parseFloat(d.prom), 120);
                    var medal = idx === 0 ? '1' : idx === 1 ? '2' : idx === 2 ? '3' : String(idx + 1);
                    return <div key={d.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: idx < 3 ? color : '#94a3b8', minWidth: 24, textAlign: 'center' }}>#{medal}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 13, color: '#231F20', fontWeight: 500 }}>{d.nombre}</span>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 10, color: color, fontWeight: 600, padding: '1px 6px', background: color + '20', borderRadius: 4 }}>{d.area}</span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: parseFloat(d.prom) >= 100 ? '#166534' : parseFloat(d.prom) >= 80 ? '#92400e' : '#dc2626' }}>{d.prom}%</span>
                          </div>
                        </div>
                        <div style={{ background: '#f1f5f9', borderRadius: 6, height: 18, overflow: 'hidden' }}>
                          <div style={{ background: parseFloat(d.prom) >= 100 ? '#166534' : parseFloat(d.prom) >= 80 ? '#f59e0b' : '#dc2626', height: '100%', width: (pct / 120 * 100) + '%', borderRadius: 6, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                    </div>;
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// DASHBOARD Y TABLAS ADMIN
// =============================================
function DashboardView({ stats, colabs }) {
 var [filtroArea, setFiltroArea] = useState('Todas');
 var [filtroSeniority, setFiltroSeniority] = useState('Todos');
 var [filtroColaborador, setFiltroColaborador] = useState('Todos');
 var [filtroCiclo, setFiltroCiclo] = useState('Todos');
 var [ciclos, setCiclos] = useState([]);

 var evaluaciones = stats.evaluaciones || [];
 var puntuaciones = stats.puntuaciones || [];
 var perfiles = stats.perfiles || colabs;

 useEffect(function() {
 supabase.from('ciclos').select('id, nombre').order('fecha_inicio', { ascending: false }).then(function(res) { setCiclos(res.data || []); });
 }, []);

 // Opciones de filtro
 var areas = ['Todas'].concat([...new Set(perfiles.map(function(p) { return p.area; }).filter(Boolean))].sort());
 var seniorities = ['Todos'].concat([...new Set(perfiles.map(function(p) { return p.seniority; }).filter(Boolean))].sort());
 var colaboradores = ['Todos'].concat(perfiles.map(function(p) { return { id: p.id, nombre: p.full_name || p.email }; }));

 // Perfiles filtrados
 var perfilesFiltrados = perfiles.filter(function(p) {
 if (filtroArea !== 'Todas' && p.area !== filtroArea) return false;
 if (filtroSeniority !== 'Todos' && p.seniority !== filtroSeniority) return false;
 if (filtroColaborador !== 'Todos' && p.id !== filtroColaborador) return false;
 return true;
 });
 var idsFiltrados = perfilesFiltrados.map(function(p) { return p.id; });

 // Evaluaciones filtradas por ciclo y perfil
 var evalFiltradas = evaluaciones.filter(function(e) {
 if (!idsFiltrados.includes(e.colaborador_id)) return false;
 if (filtroCiclo !== 'Todos' && String(e.ciclo_id) !== String(filtroCiclo)) return false;
 return true;
 });

 // Gráfico 1: Distribución Bajo/Medio/Alto
 var evalLider = evalFiltradas.filter(function(e) { return e.tipo_evaluacion === "evaluacion_lider" && e.rating_calibrado; });
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

 // Gráfico 2: Promedio por competencia (para araña)
  var evalIdsFiltrados = evalFiltradas.filter(function(e) { return e.tipo_evaluacion === "evaluacion_lider"; }).map(function(e) { return e.id; });
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

 // Colores filtro
 var selectStyle = { padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', color: '#231F20', cursor: 'pointer', fontWeight: 500 };

 // Gráfico de araña SVG
 function SpiderChart({ datos }) {
 if (!datos || datos.length === 0) return <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>Sin puntuaciones cargadas aún</p>;

 var N = datos.length;
 var CX = 300; var CY = 280; var R = 150;
 var niveles = [1, 2, 3, 4, 5];

 function punto(idx, valor) {
 var angulo = (Math.PI * 2 * idx / N) - Math.PI / 2;
 var r = (valor / 5) * R;
 return { x: CX + r * Math.cos(angulo), y: CY + r * Math.sin(angulo) };
 }

 function puntoEje(idx, r) {
 var angulo = (Math.PI * 2 * idx / N) - Math.PI / 2;
 return { x: CX + r * Math.cos(angulo), y: CY + r * Math.sin(angulo) };
 }

 var poligono = datos.map(function(d, i) { var p = punto(i, d.prom); return p.x + ',' + p.y; }).join(' ');

 return (
 <svg viewBox="0 0 600 540" style={{ width: "100%", maxWidth: 600 }}>
 {/* Ejes de fondo por nivel */}
 {niveles.map(function(niv) {
 var puntos = datos.map(function(_, i) { var p = puntoEje(i, (niv / 5) * R); return p.x + ',' + p.y; }).join(' ');
 return <polygon key={niv} points={puntos} fill="none" stroke={niv === 5 ? '#D4D2C6' : '#e8e6e0'} strokeWidth={niv === 5 ? 1.5 : 1} />;
 })}
 {/* Líneas desde el centro */}
 {datos.map(function(_, i) {
 var p = puntoEje(i, R);
 return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#e8e6e0" strokeWidth="1" />;
 })}
 {/* Polígono de datos */}
 <polygon points={poligono} fill="rgba(35,31,32,0.12)" stroke="#231F20" strokeWidth="2" />
 {/* Puntos */}
 {datos.map(function(d, i) {
 var p = punto(i, d.prom);
 return (
 <g key={i}>
 <circle cx={p.x} cy={p.y} r="5" fill="#231F20" />
 <title>{d.nombre}: {d.prom.toFixed(1)}</title>
 </g>
 );
 })}
 {/* Labels de competencias */}
 {datos.map(function(d, i) {
 var p = puntoEje(i, R + 70);
 var anchor = p.x < CX - 10 ? 'end' : p.x > CX + 10 ? 'start' : 'middle';
 // Dividir nombre en máx 2 palabras por línea
 var palabras = d.nombre.split(' ');
 var lineas = [];
 for (var w = 0; w < palabras.length; w += 2) {
 lineas.push(palabras.slice(w, w + 2).join(' '));
 }
 var lineH = 16;
 var totalH = lineas.length * lineH;
 return (
 <g key={i}>
 {lineas.map(function(lin, li) {
 return <text key={li} x={p.x} y={p.y - totalH / 2 + li * lineH + lineH / 2} fontSize="13" fill="#231F20" fontWeight="700" textAnchor={anchor}>{lin}</text>;
 })}
 <text x={p.x} y={p.y + totalH / 2 + 14} fontSize="13" fill="#64748b" fontWeight="800" textAnchor={anchor}>{d.prom.toFixed(1)}</text>
 </g>
 );
 })}
 {/* Valores de escala */}
 {niveles.map(function(niv) {
 return <text key={niv} x={CX + 5} y={CY - (niv / 5) * R + 4} fontSize="10" fill="#94a3b8">{niv}</text>;
 })}
 </svg>
 );
 }

 return (
 <div>
 {/* KPI Cards */}
 <div style={s.grid}>
 <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Participantes</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{perfilesFiltrados.length}</p></div>
 <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Evaluaciones</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{evalFiltradas.filter(function(e) { return e.tipo_evaluacion === "evaluacion_lider"; }).length}</p></div>
 <div style={{ ...s.tarjetaStat, borderTop: '3px solid #231F20' }}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Completadas</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{evalFiltradas.filter(function(e) { return e.tipo_evaluacion === "evaluacion_lider" && e.estado === 'enviado' }).length}</p></div>
 <div style={{ ...s.tarjetaStat, borderTop: '3px solid #D4D2C6' }}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Pendientes</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{evalFiltradas.filter(function(e) { return e.tipo_evaluacion === "evaluacion_lider" && e.estado !== 'enviado' }).length}</p></div>
 </div>

 {/* Filtros */}
 <div style={{ display: 'flex', gap: 10, margin: '16px 0', flexWrap: 'wrap', alignItems: 'center', background: 'white', padding: '14px 16px', borderRadius: 10, border: '1px solid #e8e6e0' }}>
 <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Filtrar:</span>
 <select value={filtroArea} onChange={function(e) { setFiltroArea(e.target.value); setFiltroColaborador('Todos'); }} style={selectStyle}>
 {areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las áreas' : a}</option>; })}
 </select>
 <select value={filtroSeniority} onChange={function(e) { setFiltroSeniority(e.target.value); setFiltroColaborador('Todos'); }} style={selectStyle}>
 {seniorities.map(function(s) { return <option key={s} value={s}>{s === 'Todos' ? 'Todos los seniority' : s}</option>; })}
 </select>
 <select value={filtroColaborador} onChange={function(e) { setFiltroColaborador(e.target.value); setFiltroArea('Todas'); setFiltroSeniority('Todos'); }} style={{ ...selectStyle, minWidth: 180 }}>
 <option value="Todos">Todos los colaboradores</option>
 {perfiles.sort(function(a,b) { return (a.full_name||'').localeCompare(b.full_name||''); }).map(function(p) { return <option key={p.id} value={p.id}>{p.full_name || p.email}</option>; })}
 </select>
 <select value={filtroCiclo} onChange={function(e) { setFiltroCiclo(e.target.value); }} style={selectStyle}>
 <option value="Todos">Todos los ciclos</option>
 {ciclos.map(function(c) { return <option key={c.id} value={c.id}>{c.nombre}</option>; })}
 </select>
 {(filtroArea !== 'Todas' || filtroSeniority !== 'Todos' || filtroColaborador !== 'Todos' || filtroCiclo !== 'Todos') && (
 <button onClick={function() { setFiltroArea('Todas'); setFiltroSeniority('Todos'); setFiltroColaborador('Todos'); setFiltroCiclo('Todos'); }}
 style={{ fontSize: 12, padding: '7px 12px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontWeight: 600 }}>
 Limpiar filtros
 </button>
 )}
 </div>

 {/* Gráficos */}
 <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 4 }}>

 {/* Gráfico 1 — Distribución */}
 <div style={{ ...s.tarjetaStat, flex: 1, minWidth: 260 }}>
 <h4 style={{ margin: '0 0 6px 0', color: '#231F20', fontSize: 14, fontWeight: 700 }}>Distribución de Desempeño</h4>
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
 <div style={{ background: '#f1f5f9', borderRadius: 6, height: 22, overflow: 'hidden' }}>
 <div style={{ background: g.color, height: '100%', width: pct + '%', borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 8, boxSizing: 'border-box' }}>
 {pct > 15 && <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>{pct}%</span>}
 </div>
 </div>
 </div>
 );
 })}
 {totalG1 > 0 && <p style={{ margin: '12px 0 0 0', fontSize: 12, color: '#64748b', textAlign: 'center' }}>Total: {totalG1} colaboradores</p>}
 </div>

 {/* Gráfico 2 — Araña de competencias */}
 <div style={{ ...s.tarjetaStat, flex: 1, minWidth: 320, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
 <h4 style={{ margin: '0 0 4px 0', color: '#231F20', fontSize: 14, fontWeight: 700, alignSelf: 'flex-start' }}>
 Promedio por Competencia
 {filtroColaborador !== 'Todos' && (
 <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400, marginLeft: 8 }}>
 — {(perfiles.find(function(p) { return p.id === filtroColaborador; }) || {}).full_name || ''}
 </span>
 )}
 </h4>
 <p style={{ margin: '0 0 16px 0', fontSize: 11, color: '#94a3b8', alignSelf: 'flex-start' }}>
 {filtroColaborador !== 'Todos' ? 'Vista individual del colaborador' : 'Promedio general — solo evaluaciones calibradas'}
 </p>
 <SpiderChart datos={compData} />
 {compData.length > 0 && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', marginTop: 8 }}>
 {compData.map(function(c) {
 var cls = clasificarRating(c.prom);
 return (
 <div key={c.nombre} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f1f0ec' }}>
 <span style={{ fontSize: 12, color: '#475569' }}>{c.nombre}</span>
 <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
 {cls && <span style={{ fontSize: 10, color: cls.color, fontWeight: 600 }}>{cls.label}</span>}
 <span style={{ fontSize: 14, fontWeight: 800, color: '#231F20', minWidth: 28, textAlign: 'right' }}>{c.prom.toFixed(1)}</span>
 </div>
 </div>
 );
 })}
 </div>
 )}
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
  var [datos, setDatos] = useState([]); var [carg, setCarg] = useState(true); var [filtro, setFiltro] = useState("Todas"); var [editandoCal, setEditandoCal] = useState(null); var [calTemp, setCalTemp] = useState({ rating: "", comentario: "" });
  var [historial, setHistorial] = useState([]);
  var [showHistorial, setShowHistorial] = useState(false);
  var [nuevoComentario, setNuevoComentario] = useState("");
  var [colaboradorHist, setColaboradorHist] = useState(null);
 useEffect(function() { cargar(); }, [cicloId]);
 async function cargar() {
 setCarg(true);
 var [{ data: evs }, { data: historial }] = await Promise.all([
   supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, evaluador_id, estado, rating_promedio, rating_calibrado, comentario_calibracion, puntuaciones(rating, competencia_id, comentario, competencias(nombre)), colaborador:colaborador_id(id, email, full_name, area, seniority, puesto)').eq('ciclo_id', cicloId).in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']),
   supabase.from('calibracion_historial').select('colaborador_id, tipo').eq('ciclo_id', cicloId).in('tipo', ['reabrir_lider', 'comentario', 'calibracion'])
 ]);
 // Set de colaboradores con reapertura de lider
 var reabiertos = new Set((historial || []).map(function(h) { return h.colaborador_id; }));
 var mapa = {};
 (evs || []).forEach(function(ev) {
 if (!ev.colaborador) return;
 if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, autoevaluacion: null, evaluacionLider: null, ratingFinal: null, comentarioCalibracion: null, promAuto: null, promLider: null, liderReabierto: false };
 if (ev.tipo_evaluacion === 'autoevaluacion') { mapa[ev.colaborador_id].autoevaluacion = ev; mapa[ev.colaborador_id].promAuto = ev.rating_promedio; }
 if (ev.tipo_evaluacion === 'evaluacion_lider') {
 mapa[ev.colaborador_id].evaluacionLider = ev;
 mapa[ev.colaborador_id].promLider = ev.rating_promedio;
 mapa[ev.colaborador_id].comentarioCalibracion = ev.comentario_calibracion || null;
 mapa[ev.colaborador_id].liderReabierto = reabiertos.has(ev.colaborador_id);
 var cal = ev.rating_calibrado;
 if (!cal && ev.rating_promedio) {
 cal = ev.rating_promedio;
 supabase.from('evaluaciones').update({ rating_calibrado: cal }).eq('id', ev.id);
 }
 mapa[ev.colaborador_id].ratingFinal = cal;
 }
 });
 setDatos(Object.values(mapa)); setCarg(false);
 }


 async function guardarCal(evaluacionId, rating, comentario, ratingLider) {
   var rCal = parseFloat(rating) || 0; var rLid = parseFloat(ratingLider) || 0;
   if (rCal !== rLid && !comentario.trim()) { alert('Debes justificar por que el rating calibrado difiere del rating del lider.'); return; }
   await supabase.from('evaluaciones').update({ rating_calibrado: rating, comentario_calibracion: comentario }).eq('id', evaluacionId);
   setDatos(function(p) { return p.map(function(d) { return d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating, comentarioCalibracion: comentario } : d; }); });
 }

 async function reabrirEvaluacion(evalId, tipo, colaboradorId, colaboradorNombre) {
   if (!window.confirm('¿Reabrir esta ' + tipo + ' para que pueda editarse de nuevo?')) return;
   var motivo = window.prompt('Motivo de reapertura (opcional):') || '';
   await supabase.from('evaluaciones').update({ estado: 'borrador' }).eq('id', evalId);
   var { data: { session } } = await supabase.auth.getSession();
   var tipoHist = tipo.includes('auto') ? 'reabrir_auto' : 'reabrir_lider';
   await supabase.from('calibracion_historial').insert({
     ciclo_id: cicloId, colaborador_id: colaboradorId, evaluacion_id: evalId,
     tipo: tipoHist,
     comentario: 'Reapertura de ' + tipo + (motivo ? ': ' + motivo : ''),
     usuario_id: session.user.id,
     usuario_nombre: session.user.email
   });
   cargar();
   if (showHistorial && colaboradorHist === colaboradorId) cargarHistorial(colaboradorId);
 }

 async function cargarHistorial(colaboradorId) {
   var { data } = await supabase.from('calibracion_historial')
     .select('*').eq('ciclo_id', cicloId).eq('colaborador_id', colaboradorId)
     .order('created_at', { ascending: false });
   setHistorial(data || []);
   setColaboradorHist(colaboradorId);
   setShowHistorial(true);
 }

 async function agregarComentario(colaboradorId) {
   if (!nuevoComentario.trim()) return;
   var { data: { session } } = await supabase.auth.getSession();
   await supabase.from('calibracion_historial').insert({
     ciclo_id: cicloId, colaborador_id: colaboradorId,
     tipo: 'comentario',
     comentario: nuevoComentario,
     usuario_id: session.user.id,
     usuario_nombre: session.user.email
   });
   setNuevoComentario('');
   cargarHistorial(colaboradorId);
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
 var PW = 210; var MX = 12; var y = 32;
 // columnas: izq = auto, der = lider
 var MID = PW / 2; // 105 — línea divisoria
 var COL_L = MX; // inicio columna izquierda (auto)
 var COL_R = MID + 3; // inicio columna derecha (lider)
 var COL_W = MID - MX - 3; // ancho de cada columna ~90mm

 function cab() {
 try { pdf.addImage('/logo.jpg', 'JPEG', MX, 6, 20, 20); } catch(e) {}
 }
 function pie() {
 pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor(148, 163, 184);
 pdf.text('Fabric Group | ' + new Date().toLocaleDateString('es-AR'), MX, 291);
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

 pdf.setFont('times', 'bold'); pdf.setFontSize(12); pdf.setTextColor(35, 31, 32); pdf.text('EVALUACIÓN DE DESEMPEÑO', MX, y); pdf.setFont('helvetica', 'normal'); y += 7;
 pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(71, 85, 105);
 pdf.text(t('Colaborador: ' + (d.colaborador.full_name || d.colaborador.email)), MX, y); y += 5;
 pdf.text(t('Puesto: ' + (d.colaborador.puesto || d.colaborador.area || '-') + ' | Area: ' + (d.colaborador.area || '-') + ' | Fecha: ' + new Date().toLocaleDateString('es-AR')), MX, y); y += 8;

 // ---- CABECERA DE COLUMNAS ----
 chk(12);
 pdf.setFillColor(35, 31, 32);
 pdf.rect(MX, y, COL_W, 8, 'F');
 pdf.rect(MID + 2, y, COL_W, 8, 'F');
 pdf.setTextColor(212, 210, 198); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
 pdf.text('AUTOEVALUACION (Colaborador)', COL_L + 2, y + 5.5);
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
 // 5. Puntajes — sin círculo, solo texto
 var yPunt = yCuerpo + 9;
 if (autoP) {
   pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(35, 31, 32);
   pdf.text('' + autoP + ' / 5', COL_L + 2, yPunt + 1.5);
 } else {
   pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184);
   pdf.text('Sin puntaje', COL_L + 2, yPunt + 1.5);
 }
 if (liderP) {
   pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(35, 31, 32);
   pdf.text('' + liderP + ' / 5', COL_R + 2, yPunt + 1.5);
 } else {
   pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184);
   pdf.text('Sin puntaje', COL_R + 2, yPunt + 1.5);
 }

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

 // Historial de calibración
 try {
   var { data: hist } = await supabase.from('calibracion_historial')
     .select('*').eq('ciclo_id', cicloId).eq('colaborador_id', d.colaborador.id)
     .order('created_at', { ascending: true });
   if (hist && hist.length > 0) {
     chk(20);
     pdf.setFillColor(240, 237, 232);
     pdf.rect(MX, y, PW - MX * 2, 8, 'F');
     pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(35, 31, 32);
     pdf.text(t('HISTORIAL DE CALIBRACION'), MX + 4, y + 5); y += 10;
     hist.forEach(function(h) {
       chk(16);
       var tipoLabel = { calibracion: 'Calibracion', reabrir_auto: 'Reapertura Auto', reabrir_lider: 'Reapertura Lider', comentario: 'Comentario' };
       var fecha = new Date(h.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
       pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(71, 85, 105);
       pdf.text(t((tipoLabel[h.tipo] || h.tipo) + ' — ' + fecha + ' — ' + (h.usuario_nombre || '')), MX, y); y += 4;
       pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(100, 116, 139);
       var lines = pdf.splitTextToSize(t(h.comentario || ''), PW - MX * 2);
       lines.forEach(function(l) { chk(5); pdf.text(t(l), MX + 4, y); y += 4; });
       y += 2;
     });
   }
 } catch(e) {}


 pie();
 return pdf;
 }
 async function verPDF(d) { var pdf = await generarPDFCompleto(d); pdf.save('Evaluacion_' + (d.colaborador.full_name || d.colaborador.email).split(' ').join('_') + '.pdf'); }

 var areas = useMemo(function() { return ['Todas'].concat([...new Set(datos.map(function(d) { return d.colaborador.area; }).filter(Boolean))]); }, [datos]);
 var df = filtro === 'Todas' ? datos : datos.filter(function(d) { return d.colaborador.area === filtro; });

 if (carg) return <p style={{ padding: 20 }}> Cargando datos de calibracion...</p>;

 return (
 <div style={{ ...s.tarjetaStat }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
 <h3 style={{ margin: 0, color: '#231F20' }}> Calibracion - Auto vs Lider</h3>
 <select value={filtro} onChange={function(e) { setFiltro(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14, background: 'white' }}>{areas.map(function(a) { return <option key={a} value={a}>{a}</option>; })}</select>
 </div>
 <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Comparacion de autoevaluacion y evaluacion del lider. Define el rating final calibrado.</p>
      {/* Panel de historial de calibración */}
      {showHistorial && (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h4 style={{ margin: 0, color: '#231F20' }}>Historial de Calibración</h4>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#64748b' }}>
                {datos.find(function(d) { return d.colaborador.id === colaboradorHist; })?.colaborador.full_name || ''}
              </p>
            </div>
            <button onClick={function() { setShowHistorial(false); setHistorial([]); }} style={s.btnInfo}>Cerrar</button>
          </div>

          {/* Agregar comentario */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <input
              value={nuevoComentario}
              onChange={function(e) { setNuevoComentario(e.target.value); }}
              placeholder="Agregar comentario o nota de calibración..."
              style={{ flex: 1, padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }}
              onKeyDown={function(e) { if (e.key === 'Enter') agregarComentario(colaboradorHist); }}
            />
            <button onClick={function() { agregarComentario(colaboradorHist); }} style={s.btnPrimario}>Agregar</button>
          </div>

          {/* Lista de eventos */}
          {historial.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>Sin registros aún.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historial.map(function(h) {
                var colores = {
                  reabrir_auto: { bg: '#fef3c7', border: '#fcd34d', color: '#92400e', label: 'Reapertura Auto' },
                  reabrir_lider: { bg: '#dbeafe', border: '#93c5fd', color: '#1e40af', label: 'Reapertura Líder' },
                  calibracion: { bg: '#dcfce7', border: '#86efac', color: '#166534', label: 'Calibración' },
                  comentario: { bg: '#F0EDE8', border: '#D4D2C6', color: '#231F20', label: 'Comentario' },
                };
                var c = colores[h.tipo] || colores.comentario;
                return (
                  <div key={h.id} style={{ padding: '10px 14px', borderRadius: 8, background: c.bg, border: '1px solid ' + c.border, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: c.color, whiteSpace: 'nowrap', paddingTop: 2 }}>{c.label}</span>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: 13, color: '#231F20', lineHeight: 1.5 }}>{h.comentario}</p>
                      <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#94a3b8' }}>
                        {h.usuario_nombre} · {new Date(h.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

 {df.length === 0 ? <p style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No hay datos para mostrar.</p> : (
 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
<thead><tr style={{ borderBottom: '2px solid #e8e6e0', background: '#F0EDE8' }}><th style={th}>Colaborador</th><th style={th}>Area</th><th style={th}>Seniority</th><th style={th}>Auto</th><th style={th}>Lider</th><th style={th}>Evaluación Final</th><th style={th}>Justificación</th><th style={th}>Historial</th><th style={th}>PDF</th><th style={th}>Reabrir</th></tr></thead>
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
 {editandoCal !== d.colaborador.id && !d.ratingFinal && (
 <button
   onClick={async function() {
     var _evId = d.evaluacionLider.id;
     var _pl = parseFloat(d.promLider) || 0;
     if (!_pl) { alert('El lider aun no tiene rating promedio'); return; }
     await guardarCal(_evId, _pl, 'Confirmado sin cambios — rating igual al del lider', _pl);
     // Registrar en historial
     var { data: { session } } = await supabase.auth.getSession();
     await supabase.from('calibracion_historial').insert({
       ciclo_id: cicloId,
       colaborador_id: d.colaborador.id,
       evaluacion_id: _evId,
       tipo: 'calibracion',
       comentario: 'Rating calibrado confirmado: ' + _pl + ' (igual al rating del lider, sin cambios)',
       usuario_id: session.user.id,
       usuario_nombre: session.user.email
     });
   }}
   title="Confirmar como evaluacion final"
   style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #86efac', background: '#dcfce7', color: '#166534', cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
   ✓
 </button>
 )}
 {editandoCal !== d.colaborador.id && (
 <button
 onClick={function() { var _id = d.colaborador.id; setEditandoCal(_id); setCalTemp({ rating: d.ratingFinal || d.promLider || '', comentario: d.comentarioCalibracion || '' }); }}
 title="Editar evaluacion final"
 style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e8e6e0', background: 'white', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✏
 </button>
 )}
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
 {d.liderReabierto ? 'Cambio la evaluacion del lider — ver historial' : d.ratingFinal ? 'Confirmado sin cambios' : '—'}
 </span>
 )}
 </td>
 <td style={td}><button onClick={function() { cargarHistorial(d.colaborador.id); }} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>Ver</button></td>
 <td style={td}><button onClick={function() { verPDF(d); }} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Ver PDF</button></td>
                  <td style={{ ...td, minWidth: 160 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {d.autoevaluacion && d.autoevaluacion.estado === 'enviado' && (
                        <button onClick={function() { reabrirEvaluacion(d.autoevaluacion.id, 'autoevaluación', d.colaborador.id, d.colaborador.full_name); }}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fcd34d', background: '#fef3c7', color: '#92400e', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          Reabrir Auto
                        </button>
                      )}
                      {d.evaluacionLider && d.evaluacionLider.estado === 'enviado' && (
                        <button onClick={function() { reabrirEvaluacion(d.evaluacionLider.id, 'evaluación del líder', d.colaborador.id, d.colaborador.full_name); }}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #93c5fd', background: '#dbeafe', color: '#1e40af', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          Reabrir Líder
                        </button>
                      )}
                      {(!d.autoevaluacion || d.autoevaluacion.estado !== 'enviado') && (!d.evaluacionLider || d.evaluacionLider.estado !== 'enviado') && (
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>Sin envíos</span>
                      )}
                      <button onClick={function() { cargarHistorial(d.colaborador.id); }}
                        style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #D4D2C6", background: "white", color: "#231F20", cursor: "pointer", fontSize: 11, fontWeight: 600, marginTop: 4 }}>
                        Ver historial
                      </button>
                    </div>
                  </td>
 </tr>
 );
 })}</tbody>
 </table>
 </div>
  )}
 </div>
 );
}

function FeedbackAdmin({ cicloId }) { var [fbs, setFbs] = useState([]); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data } = await supabase.from('feedback').select('*,lider:lider_id(email,full_name),colaborador:colaborador_id(email,full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setFbs(data || []); setCarg(false); })(); }, [cicloId]); if (carg) return <p>Cargando...</p>; return <div style={s.tarjetaStat}><h4> Feedback ({fbs.length})</h4>{fbs.length === 0 ? <p style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Sin registros.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Lider</th><th style={th}>Colaborador</th><th style={th}>Comentario</th><th style={th}>Fecha</th><th style={th}>OK</th></tr></thead><tbody>{fbs.map(function(f) { return (<tr key={f.id}><td style={td}>{f.lider?.full_name || '-'}</td><td style={td}>{f.colaborador?.full_name || '-'}</td><td style={td}>{f.comentario_lider || '-'}</td><td style={td}>{f.fecha_feedback_lider ? new Date(f.fecha_feedback_lider).toLocaleDateString('es-AR') : '-'}</td><td style={td}>{f.confirmacion_colaborador ? '' : ''}</td></tr>); })}</tbody></table>}</div>; }

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


function FeedbackForm({ feedback: col, cicloId, onVolver }) { var [com, setCom] = useState(''); var [fb, setFb] = useState(null); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data: { session } } = await supabase.auth.getSession(); var { data } = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', col.id).maybeSingle(); if (data) { setFb(data); setCom(data.comentario_lider || ''); } else { await supabase.from('feedback').insert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id }); } setCarg(false); })(); }, []); async function guardar() { var { data: { session } } = await supabase.auth.getSession(); await supabase.from('feedback').upsert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id, comentario_lider: com, fecha_feedback_lider: new Date() }, { onConflict: 'ciclo_id, colaborador_id' }); alert(' Guardado'); onVolver(); } if (carg) return <p>Cargando...</p>; return <div style={{ maxWidth: 600 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver</button><h3> Feedback: {col.full_name || col.email}</h3><textarea value={com} onChange={function(e) { setCom(e.target.value); }} placeholder="Deja tu feedback..." style={{ ...s.textarea, minHeight: 120, marginBottom: 12 }} />{fb?.confirmacion_colaborador && <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8, marginBottom: 16 }}> Confirmado</div>}<button onClick={guardar} style={s.btnPrimario}>Guardar</button></div>; }

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
 // Notificar al lider
 var { data: perfColabN } = await supabase.from("profiles").select("full_name, leader_id").eq("id", userId).single();
 var { data: perfColabN } = await supabase.from("profiles").select("full_name, leader_id, email").eq("id", userId).single();
 if (perfColabN && perfColabN.leader_id) {
    if (localStorage.getItem("notifsActivas") !== "false") await crearNotificacion(perfColabN.leader_id, "autoevaluacion_enviada", (perfColabN.full_name || "Un colaborador") + " envió su autoevaluación", userId, perfColabN.full_name);
 // Email al lider
 var { data: liderN } = await supabase.from("profiles").select("email, full_name").eq("id", perfColabN.leader_id).single();
    if (localStorage.getItem("notifsActivas") !== "false" && liderN && liderN.email) {
 await enviarEmailNotificacion(
 liderN.email,
 liderN.full_name || "Líder",
 perfColabN.full_name + " envió su autoevaluación",
 (perfColabN.full_name || "Un colaborador") + " acaba de enviar su autoevaluación de desempeño. Ingresá a la plataforma para revisarla y completar tu evaluación."
 );
 }
 }
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
 var [equipo, setEquipo] = useState([]);
 var [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null);
 var [cargando, setCargando] = useState(true);
 var [busqueda, setBusqueda] = useState('');
 var [filtroArea, setFiltroArea] = useState('Todas');

 useEffect(function() { cargarEquipo(); }, []);

 async function cargarEquipo() {
 var { data: { session } } = await supabase.auth.getSession();
 if (!session) return;
 var uid = session.user.id;

 var { data: visibilidad } = await supabase.from('equipo_visibilidad').select('tipo, valor').eq('lider_id', uid);
 var todos = [];

 if (visibilidad && visibilidad.length > 0) {
 var esTodos = visibilidad.some(function(v) { return v.tipo === 'todos'; });
 if (esTodos) {
 var { data: all } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('activo', true).neq('id', uid).order('full_name');
 todos = all || [];
 } else {
 var areas = visibilidad.filter(function(v) { return v.tipo === 'area'; }).map(function(v) { return v.valor; });
 var usuarios = visibilidad.filter(function(v) { return v.tipo === 'usuario'; }).map(function(v) { return v.valor; });
 if (areas.length > 0) { var { data: pa } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('activo', true).in('area', areas).order('full_name'); todos = todos.concat(pa || []); }
 if (usuarios.length > 0) { var { data: pu } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('activo', true).in('id', usuarios); todos = todos.concat(pu || []); }
 var vistos = {}; todos = todos.filter(function(c) { if (vistos[c.id]) return false; vistos[c.id] = true; return true; });
 }
 }

 var { data: directos } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('leader_id', uid).eq('activo', true);
 (directos || []).forEach(function(c) { if (!todos.find(function(x) { return x.id === c.id; })) todos.push(c); });
 todos.sort(function(a, b) { return (a.full_name || '').localeCompare(b.full_name || ''); });
 setEquipo(todos);
 setCargando(false);
 }

 if (cargando) return <p style={{ color: '#64748b', padding: 20 }}>Cargando equipo...</p>;
 if (colaboradorSeleccionado) return <GestionObjetivosLider colaborador={colaboradorSeleccionado} profile={profile} onVolver={function() { setColaboradorSeleccionado(null); }} />;

 var areas = ['Todas'].concat([...new Set(equipo.map(function(c) { return c.area; }).filter(Boolean))].sort());
 var equipoFiltrado = equipo.filter(function(c) {
 if (filtroArea !== 'Todas' && c.area !== filtroArea) return false;
 if (busqueda && !(c.full_name || '').toLowerCase().includes(busqueda.toLowerCase()) && !(c.puesto || '').toLowerCase().includes(busqueda.toLowerCase())) return false;
 return true;
 });

 return (
 <div>
 <div style={{ marginBottom: 20 }}>
 <h2 style={{ color: '#231F20', margin: '0 0 4px 0', fontSize: 20, fontWeight: 700 }}>Objetivos de Mi Equipo</h2>
 <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>{equipoFiltrado.length} de {equipo.length} colaboradores</p>
 </div>

 <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
 <input value={busqueda} onChange={function(e) { setBusqueda(e.target.value); }} placeholder="Buscar por nombre o puesto..."
 style={{ flex: 2, minWidth: 200, padding: '9px 14px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', boxSizing: 'border-box' }} />
 <select value={filtroArea} onChange={function(e) { setFiltroArea(e.target.value); }}
 style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', minWidth: 160 }}>
 {areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las áreas' : a}</option>; })}
 </select>
 {(busqueda || filtroArea !== 'Todas') && (
 <button onClick={function() { setBusqueda(''); setFiltroArea('Todas'); }} style={{ ...s.btnInfo, color: '#dc2626', borderColor: '#fca5a5' }}>Limpiar</button>
 )}
 </div>

 {equipoFiltrado.length === 0 ? (
 <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: 'white', borderRadius: 12, border: '1px solid #e8e6e0' }}>
 {equipo.length === 0 ? 'No tenés colaboradores asignados.' : 'Sin resultados.'}
 </div>
 ) : (
 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
 {equipoFiltrado.map(function(col) {
 var iniciales = (col.full_name || col.email || 'U').split(' ').slice(0,2).map(function(p) { return p[0]; }).join('').toUpperCase();
 var esDirecto = col.leader_id === profile.id;
 return (
 <div key={col.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '3px solid ' + (esDirecto ? '#231F20' : '#D4D2C6'), padding: '16px 18px', cursor: 'pointer' }}
 onClick={function() { setColaboradorSeleccionado(col); }}>
 <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
 <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#231F20', flexShrink: 0 }}>{iniciales}</div>
 <div>
 <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
 <strong style={{ fontSize: 13, color: '#231F20' }}>{col.full_name || col.email}</strong>
 {!esDirecto && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: '#F0EDE8', color: '#64748b', fontWeight: 600 }}>Indirecto</span>}
 </div>
 <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#64748b' }}>{col.puesto || col.area}</p>
 </div>
 </div>
 <button style={{ ...s.btnPrimario, width: '100%', fontSize: 12, padding: '8px', textAlign: 'center' }}>Ver Objetivos</button>
 </div>
 );
 })}
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
  var [alcanceAnualColab, setAlcanceAnualColab] = useState(null);
  var [editandoAlcanceAnual, setEditandoAlcanceAnual] = useState(false);
  var [alcanceAnualTemp, setAlcanceAnualTemp] = useState("");
  var [justAlcanceAnual, setJustAlcanceAnual] = useState("");

 var FORM_VACIO = { objetivo: '', corporativo: '', ponderacion: '', alcance_tipo: 'fecha',
 
 alcance_80_descripcion: '', alcance_80_fecha: '', alcance_80_meta: '',
 alcance_100_descripcion: '', alcance_100_fecha: '', alcance_100_meta: '',
 alcance_120_descripcion: '', alcance_120_fecha: '', alcance_120_meta: '' };

  useEffect(function() { cargarObjetivos(); cargarAlcanceAnualColab(); }, []);

 async function cargarObjetivos() {
 var { data } = await supabase.from('objetivos').select('*').eq('colaborador_id', colaborador.id).order('created_at', { ascending: false });
 setObjetivos(data || []); setCargando(false);
 }

  async function cargarAlcanceAnualColab() {
    var { data } = await supabase.from("alcance_anual").select("*").eq("colaborador_id", colaborador.id).is("ciclo_id", null).maybeSingle();
    setAlcanceAnualColab(data || null);
  }

  async function guardarAlcanceAnual() {
    if (!alcanceAnualTemp) return alert("Ingresá el alcance final");
    if (!justAlcanceAnual.trim()) return alert("La justificación es obligatoria");
    var { data: { session } } = await supabase.auth.getSession();
    await supabase.from("alcance_anual").upsert({
      colaborador_id: colaborador.id,
      ciclo_id: null,
      alcance_final: parseFloat(alcanceAnualTemp),
      justificacion_lider: justAlcanceAnual,
      validado_por_lider: true,
      lider_id: session.user.id,
      fecha_validacion: new Date(),
    }, { onConflict: "colaborador_id,ciclo_id" });
    // Registrar en calibracion_historial
    await supabase.from("calibracion_historial").insert({
      colaborador_id: colaborador.id,
      tipo: "comentario",
      comentario: "Alcance anual validado por lider: " + alcanceAnualTemp + "%. Justificacion: " + justAlcanceAnual,
      usuario_id: session.user.id,
      usuario_nombre: session.user.email
    });
    setEditandoAlcanceAnual(false);
    setAlcanceAnualTemp(""); setJustAlcanceAnual("");
    cargarAlcanceAnualColab();
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
 Ponderacion total: {totalPond.toFixed(0)}% {totalPond === 100 ? '' : ''}
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
 {/* Modal validar alcance reportado */}
 {modalValidarAlcance && (
   <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setModalValidarAlcance(null); }}>
     <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 560, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={function(e) { e.stopPropagation(); }}>
       <h3 style={{ marginTop: 0, color: '#231F20' }}>Validar alcance</h3>
       <p style={{ fontSize: 14, color: '#231F20', marginBottom: 12 }}><strong>{modalValidarAlcance.objetivo}</strong></p>

       {/* Info del colaborador */}
       <div style={{ background: '#F0EDE8', border: '1px solid #D4D2C6', borderRadius: 8, padding: 12, marginBottom: 20 }}>
         <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Colaborador reportó: {modalValidarAlcance.alcance_completado}%</p>
         {modalValidarAlcance.justificacion_completado && <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#475569' }}>{modalValidarAlcance.justificacion_completado}</p>}
       </div>

       {/* Botones rápidos */}
       <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#231F20' }}>Alcance validado</p>
       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
         {[{v:'80',c:'#92400e',bg:'#fef3c7'},{v:'100',c:'#166534',bg:'#dcfce7'},{v:'120',c:'#1e40af',bg:'#dbeafe'}].map(function(a) {
           var sel = alcanceLider === a.v;
           return <button key={a.v} onClick={function() { setAlcanceLider(a.v); }}
             style={{ padding: '12px 8px', borderRadius: 10, cursor: 'pointer', border: '2px solid', borderColor: sel ? a.c : '#e2e8f0', background: sel ? a.bg : 'white', fontWeight: 700, fontSize: 16, color: a.c }}>
             {a.v}%
           </button>;
         })}
       </div>
       {/* Campo libre */}
       <div style={{ marginBottom: 16 }}>
         <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>O escribí un valor personalizado</label>
         <input type="number" min="0" max="200" value={alcanceLider}
           onChange={function(e) { setAlcanceLider(e.target.value); }}
           placeholder="Ej: 90, 110..."
           style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '2px solid #D4D2C6', fontSize: 15, fontWeight: 700, boxSizing: 'border-box' }} />
       </div>

       {/* Preview total ponderado */}
       {alcanceLider && (function() {
         var objsValidadosSimul = objetivos.filter(function(o) { return o.status === 'validado' && o.alcance_validado && o.id !== modalValidarAlcance.id; });
         objsValidadosSimul = objsValidadosSimul.concat([{ ...modalValidarAlcance, alcance_validado: parseFloat(alcanceLider), status: 'validado' }]);
         var sp = objsValidadosSimul.reduce(function(s,o) { return s + parseFloat(o.ponderacion); }, 0);
         var sa = objsValidadosSimul.reduce(function(s,o) { return s + parseFloat(o.alcance_validado) * parseFloat(o.ponderacion); }, 0);
         var total = sp > 0 ? (sa / sp).toFixed(1) : null;
         return total ? (
           <div style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
             <p style={{ margin: 0, fontSize: 13, color: '#1e40af', fontWeight: 600 }}>
               Total alcanzado ponderado (simulación): {total}%
             </p>
             <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#3b82f6' }}>Considera todos los objetivos validados</p>
           </div>
         ) : null;
       })()}

       <div style={{ marginBottom: 16 }}>
         <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Comentario de validación</label>
         <textarea value={comentValidacion} onChange={function(e) { setComentValidacion(e.target.value); }}
           placeholder="Opcional — justificá el alcance validado..."
           style={{ width: '100%', minHeight: 70, padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
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
       var CORP_COLORES = ['#2d6a4f','#c2410c','#1d4ed8','#7c3aed','#0e7490','#92400e','#064e3b'];
       function colorCorp(n) { if (!n) return '#64748b'; var idx = Math.abs(n.split('').reduce(function(a,c) { return a + c.charCodeAt(0); }, 0)) % CORP_COLORES.length; return CORP_COLORES[idx]; }
       var color = colorCorp(obj.corporativo);
       var fechaRef = obj.alcance_100_fecha || obj.alcance_80_fecha;
       var statusBg = { validado: '#dcfce7', completado: '#dbeafe', aceptado: '#f1f5f9', rechazado: '#fee2e2', pendiente: '#fef3c7' };
       var statusColor = { validado: '#166534', completado: '#1e40af', aceptado: '#475569', rechazado: '#dc2626', pendiente: '#92400e' };
       return (
         <div key={obj.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '4px solid ' + color, padding: '16px 20px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
             <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
               <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
               <span style={{ fontSize: 12, fontWeight: 600, color: color }}>{obj.corporativo || 'Sin categoría'}</span>
             </div>
             <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: statusBg[obj.status] || '#f1f5f9', color: statusColor[obj.status] || '#475569' }}>
               {obj.status ? obj.status.charAt(0).toUpperCase() + obj.status.slice(1) : '-'}
             </span>
           </div>
           <p style={{ margin: '0 0 12px 0', fontSize: 14, color: '#231F20', lineHeight: 1.55, wordBreak: 'break-word' }}>{obj.objetivo}</p>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
             <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
               {fechaRef && <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(fechaRef).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
               {obj.alcance_completado && <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>Colaborador reportó: {obj.alcance_completado}%</span>}
               {obj.alcance_validado && <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>Alcance validado: {obj.alcance_validado}%</span>}
               {obj.comentario_lider && <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>{obj.comentario_lider}</span>}
             </div>
             <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
               <span style={{ fontSize: 24, fontWeight: 800, color: '#231F20' }}>{obj.ponderacion}%</span>
               {obj.status === 'pendiente' && !obj.validado_por_gerente && (
                 <button onClick={function() { setModalValidarObj(obj); setAccion(''); setComentario(''); }}
                   style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#f59e0b', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                   Revisar
                 </button>
               )}
               {obj.status === 'completado' && (
                 <button onClick={function() { setModalValidarAlcance(obj); setAlcanceLider(''); setComentValidacion(''); }}
                   style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                   Validar alcance
                 </button>
               )}
             </div>
           </div>
           {obj.justificacion_completado && (
             <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 12, color: '#0369a1' }}>
               Justificación: {obj.justificacion_completado}
             </div>
           )}
         </div>
       );
     })}
   </div>
 )}

 {/* Alcance Anual del Colaborador */}
 {objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length > 0 && (
   <div style={{ marginTop: 24, background: '#231F20', borderRadius: 14, padding: '20px 24px', color: '#F0EDE8' }}>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
       <div>
         <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alcance Anual — {colaborador.full_name}</p>
         <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#64748b' }}>
           Promedio de {objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length} objetivos con alcance reportado
         </p>
       </div>
       <div style={{ textAlign: 'right' }}>
         {alcanceAnualColab?.validado_por_lider ? (
           <div>
             <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color: '#86efac' }}>{alcanceAnualColab.alcance_final}%</p>
             <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#86efac' }}>Validado</p>
             {alcanceAnualColab.justificacion_lider && <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>{alcanceAnualColab.justificacion_lider}</p>}
           </div>
         ) : (
           <div>
             <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color: '#D4D2C6' }}>
               {(objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).reduce(function(s,o) { return s + parseFloat(o.alcance_completado); }, 0) / objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length).toFixed(1)}%
             </p>
             <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#64748b' }}>Calculado — pendiente de validacion</p>
           </div>
         )}
       </div>
     </div>

     {/* Editor del lider */}
     {!editandoAlcanceAnual ? (
       <button onClick={function() {
         setEditandoAlcanceAnual(true);
         setAlcanceAnualTemp(alcanceAnualColab?.alcance_final || (objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).reduce(function(s,o) { return s + parseFloat(o.alcance_completado); }, 0) / objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length).toFixed(1));
         setJustAlcanceAnual(alcanceAnualColab?.justificacion_lider || '');
       }}
         style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(212,210,198,0.4)', background: 'transparent', color: '#D4D2C6', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
         {alcanceAnualColab?.validado_por_lider ? 'Editar validacion' : 'Validar alcance anual'}
       </button>
     ) : (
       <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
         <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
           <label style={{ fontSize: 12, color: '#D4D2C6', fontWeight: 600, whiteSpace: 'nowrap' }}>Alcance final (%)</label>
           <input type="number" min="0" max="200" value={alcanceAnualTemp}
             onChange={function(e) { setAlcanceAnualTemp(e.target.value); }}
             style={{ width: 80, padding: '8px 10px', borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 16, fontWeight: 700, textAlign: 'center', background: 'white', color: '#231F20' }} />
         </div>
         <textarea value={justAlcanceAnual} onChange={function(e) { setJustAlcanceAnual(e.target.value); }}
           placeholder="Justificacion del alcance final (obligatoria)..."
           style={{ width: '100%', minHeight: 70, padding: 10, borderRadius: 8, border: '1px solid rgba(212,210,198,0.4)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'rgba(255,255,255,0.08)', color: '#F0EDE8' }} />
         <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
           <button onClick={guardarAlcanceAnual} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Confirmar</button>
           <button onClick={function() { setEditandoAlcanceAnual(false); }} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(212,210,198,0.4)', background: 'transparent', color: '#D4D2C6', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
         </div>
       </div>
     )}
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
  var [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear());
  var [alcanceAnual, setAlcanceAnual] = useState(null);
  var [loadingAlcance, setLoadingAlcance] = useState(false);

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

 useEffect(function() { cargarObjetivos(); cargarAlcanceAnual(); }, []);

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
 var { error: insErr } = await supabase.from('objetivos').insert({ ...datos, colaborador_id: profile.id, status: 'pendiente', anio: new Date().getFullYear() });
 if (insErr) { alert('Error al guardar: ' + insErr.message); return; }
 }
 setMostrarForm(false); setFormObj(null); setEditandoId(null); cargarObjetivos();
 }

 async function aceptarObjetivo(objId) {
 await supabase.from('objetivos').update({ status: 'aceptado', confirmado_colaborador: true, fecha_confirmacion: new Date() }).eq('id', objId);
 cargarObjetivos();
 }

 // Stats
  var objetivosFiltradosPorAnio = objetivos.filter(function(o) { return !o.anio || String(o.anio) === String(anioSeleccionado); });
 var objActivos = objetivosFiltradosPorAnio.filter(function(o) { return o.status !== 'rechazado'; });
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
 <p style={{ margin: 0, color: '#94a3b8', fontSize: 13 }}>{profile.area || ''}{profile.area && ' · '}{profile.area && ' · '}ciclo {anioSeleccionado}</p>
 </div>
 </div>
 <button onClick={abrirNuevo} disabled={totalPond >= 100}
 style={{ padding: '10px 20px', borderRadius: 8, border: '2px solid #D4D2C6', background: 'transparent', color: '#D4D2C6', cursor: totalPond >= 100 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 600, opacity: totalPond >= 100 ? 0.5 : 1 }}>
 {totalPond >= 100 ? '100% completado' : '+ Agregar objetivo'}
 </button>
 </div>

      {/* Selector de año */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Año:</span>
        {[2024, 2025, 2026, 2027].map(function(a) {
          return <button key={a} onClick={function() { setAnioSeleccionado(a); }}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid " + (anioSeleccionado === a ? "#231F20" : "#e8e6e0"), background: anioSeleccionado === a ? "#231F20" : "white", color: anioSeleccionado === a ? "#F0EDE8" : "#231F20", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            {a}
          </button>;
        })}
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
 <ModalCompletar todos={objetivos} objetivo={objetivos.find(function(o) { return o.id === modalCompletar; })}
 onConfirmar={completarObjetivo} onCancelar={function() { setModalCompletar(null); }} />
 )}

 {/* Lista de objetivos */}
 {objetivos.length === 0 ? (
 <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: '#F0EDE8', borderRadius: 12 }}>
 No tenés objetivos cargados aún.
 </div>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
 {objetivosFiltradosPorAnio.map(function(obj) {
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

 {/* Alcance Anual */}
 {objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length > 0 && (
   <div style={{ marginTop: 24, background: '#231F20', borderRadius: 14, padding: '20px 24px', color: '#F0EDE8' }}>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
       <div>
         <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alcance Anual</p>
         <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#64748b' }}>
           Promedio de {objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length} objetivos con alcance reportado
         </p>
       </div>
       <div style={{ textAlign: 'right' }}>
         {alcanceAnual?.validado_por_lider ? (
           <div>
             <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color: '#86efac' }}>{alcanceAnual.alcance_final}%</p>
             <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#86efac' }}>Validado por el lider</p>
           </div>
         ) : (
           <div>
             <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color: '#D4D2C6' }}>
               {(objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).reduce(function(s,o) { return s + parseFloat(o.alcance_completado); }, 0) / objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length).toFixed(1)}%
             </p>
             <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#64748b' }}>Pendiente de validacion del lider</p>
           </div>
         )}
         {alcanceAnual?.justificacion_lider && (
           <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>{alcanceAnual.justificacion_lider}</p>
         )}
       </div>
     </div>
   </div>
 )}

 </div>
 );

 async function completarObjetivo(objId, alcance, justificacion) {
 await supabase.from('objetivos').update({ status: 'completado', completado_por_colaborador: true, fecha_completado: new Date(), alcance_completado: alcance, justificacion_completado: justificacion }).eq('id', objId);
 // Notificar al lider
 var { data: perfN } = await supabase.from('profiles').select('full_name, leader_id').eq('id', profile.id).single();
 if (perfN && perfN.leader_id) {
    if (localStorage.getItem("notifsActivas") !== "false") await crearNotificacion(perfN.leader_id, "objetivo_completado", (perfN.full_name || "Un colaborador") + " registró el alcance de un objetivo (" + alcance + "%)", profile.id, perfN.full_name);
 // Email al lider
 var { data: liderObj } = await supabase.from('profiles').select('email, full_name').eq('id', perfN.leader_id).single();
    if (localStorage.getItem("notifsActivas") !== "false" && liderObj && liderObj.email) {
 await enviarEmailNotificacion(
 liderObj.email,
 liderObj.full_name || 'Líder',
 perfN.full_name + ' registró el alcance de un objetivo',
 (perfN.full_name || 'Un colaborador') + ' registró el alcance de su objetivo al ' + alcance + '%. Ingresá a la plataforma para revisar y validar el resultado.'
 );
 }
 }
 setModalCompletar(null); cargarObjetivos();
  setModalCompletar(null); 
  // Calcular alcance anual automático
  var objsActualizados = objetivos.map(function(o) { return o.id === objId ? { ...o, alcance_completado: alcance, status: 'completado' } : o; });
  var objsConAlcance = objsActualizados.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; });
  if (objsConAlcance.length > 0) {
    var sumaAlcances = objsConAlcance.reduce(function(s, o) { return s + parseFloat(o.alcance_completado); }, 0);
    var alcanceCalc = (sumaAlcances / objsConAlcance.length).toFixed(1);
    // Guardar o actualizar alcance anual (sin ciclo_id — usamos año actual)
    var año = new Date().getFullYear();
    await supabase.from('alcance_anual').upsert({
      colaborador_id: profile.id,
      ciclo_id: null,
      alcance_calculado: parseFloat(alcanceCalc),
      alcance_final: parseFloat(alcanceCalc),
      lider_id: perfN?.leader_id || null,
    }, { onConflict: 'colaborador_id,ciclo_id' });
    setAlcanceAnual({ alcance_calculado: alcanceCalc, alcance_final: alcanceCalc });
  }
  cargarObjetivos();
 }

 async function cargarAlcanceAnual() {
   var { data } = await supabase.from('alcance_anual').select('*').eq('colaborador_id', profile.id).is('ciclo_id', null).maybeSingle();
   setAlcanceAnual(data || null);
 }

}

function ModalCompletar({ objetivo, onConfirmar, onCancelar, todos }) {
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
 <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 600, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={function(e) { e.stopPropagation(); }}>
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

 {/* Campo libre para % personalizado */}
 <div style={{ marginBottom: 16 }}>
   <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 6 }}>O ingresá otro porcentaje</label>
   <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
     <input
       type="number" min="0" max="200"
       value={['80','100','120'].includes(alcance) ? '' : alcance}
       onChange={function(e) { setAlcance(e.target.value); }}
       placeholder="Ej: 65, 90, 110..."
       style={{ width: 120, padding: '10px 12px', borderRadius: 8, border: '2px solid #D4D2C6', fontSize: 15, fontWeight: 700, textAlign: 'center' }}
     />
     <span style={{ fontSize: 20, fontWeight: 700, color: '#231F20' }}>%</span>
     {alcance && !['80','100','120'].includes(alcance) && (
       <span style={{ fontSize: 13, color: '#64748b' }}>Valor personalizado seleccionado</span>
     )}
   </div>
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

 {/* Alcance anual simulado */}
 {(function() {
   var todosActivos = (todos || []).filter(function(o) { return o.status !== 'rechazado' && o.id !== objetivo.id; });
   var completados = todosActivos.filter(function(o) { return o.alcance_completado; });
   var alcanceActual = parseFloat(alcance) || 0;
   if (!alcanceActual) return null;

   // Suma de alcances de todos los objetivos (completados + el actual)
   var sumAlcances = completados.reduce(function(s, o) { return s + parseFloat(o.alcance_completado); }, 0) + alcanceActual;
   var cantObjetivos = completados.length + 1 + todosActivos.filter(function(o) { return !o.alcance_completado; }).length;
   var alcanceAnual = (sumAlcances / cantObjetivos).toFixed(1);

   // Versión ponderada
   var spond = completados.reduce(function(s,o) { return s + parseFloat(o.ponderacion||0); }, 0) + parseFloat(objetivo.ponderacion||0);
   var sapond = completados.reduce(function(s,o) { return s + parseFloat(o.alcance_completado) * parseFloat(o.ponderacion||0); }, 0) + alcanceActual * parseFloat(objetivo.ponderacion||0);
   var alcancePond = spond > 0 ? (sapond / spond).toFixed(1) : null;

   return (
     <div style={{ background: '#F0EDE8', border: '1px solid #D4D2C6', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
       <p style={{ margin: '0 0 8px 0', fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alcance anual estimado</p>
       <div style={{ display: 'flex', gap: 24 }}>
         <div>
           <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Promedio simple</p>
           <p style={{ margin: '2px 0 0 0', fontSize: 28, fontWeight: 800, color: '#231F20' }}>{alcanceAnual}%</p>
           <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>Suma de alcances / {cantObjetivos} objetivos</p>
         </div>
         {alcancePond && (
           <div style={{ borderLeft: '1px solid #D4D2C6', paddingLeft: 24 }}>
             <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>Promedio ponderado</p>
             <p style={{ margin: '2px 0 0 0', fontSize: 28, fontWeight: 800, color: '#231F20' }}>{alcancePond}%</p>
             <p style={{ margin: 0, fontSize: 10, color: '#94a3b8' }}>Considera la ponderación de cada objetivo</p>
           </div>
         )}
       </div>
     </div>
   );
 })()}


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
 var [editandoObj, setEditandoObj] = useState(null);
 var [formEditObj, setFormEditObj] = useState(null);
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
 gerente_id: session.user.id, colaborador_id: colaboradorSeleccionado, status: 'pendiente', anio: new Date().getFullYear(),
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

 async function eliminarObjetivo(objId) {
 if (typeof window !== 'undefined' && !window.confirm("¿Eliminar este objetivo? Esta acción no se puede deshacer.")) return;
 await supabase.from("objetivos").delete().eq("id", objId);
 cargarDatos();
 }

 function abrirEdicionObj(obj) {
 setEditandoObj(obj.id);
 setFormEditObj({ objetivo: obj.objetivo || "", corporativo: obj.corporativo || "", ponderacion: obj.ponderacion || 0, status: obj.status || "pendiente", alcance_tipo: obj.alcance_tipo || "fecha", alcance_80_descripcion: obj.alcance_80_descripcion || "", alcance_80_fecha: obj.alcance_80_fecha || "", alcance_80_meta: obj.alcance_80_meta || "", alcance_100_descripcion: obj.alcance_100_descripcion || "", alcance_100_fecha: obj.alcance_100_fecha || "", alcance_100_meta: obj.alcance_100_meta || "", alcance_120_descripcion: obj.alcance_120_descripcion || "", alcance_120_fecha: obj.alcance_120_fecha || "", alcance_120_meta: obj.alcance_120_meta || "" });
 }

 async function guardarEdicionObj() {
 if (!formEditObj.objetivo) return alert("El objetivo es obligatorio");
 await supabase.from("objetivos").update({ objetivo: formEditObj.objetivo, corporativo: formEditObj.corporativo, ponderacion: parseFloat(formEditObj.ponderacion), status: formEditObj.status, alcance_tipo: formEditObj.alcance_tipo, alcance_80_descripcion: formEditObj.alcance_80_descripcion, alcance_80_fecha: formEditObj.alcance_80_fecha || null, alcance_80_meta: formEditObj.alcance_80_meta, alcance_100_descripcion: formEditObj.alcance_100_descripcion, alcance_100_fecha: formEditObj.alcance_100_fecha || null, alcance_100_meta: formEditObj.alcance_100_meta, alcance_120_descripcion: formEditObj.alcance_120_descripcion, alcance_120_fecha: formEditObj.alcance_120_fecha || null, alcance_120_meta: formEditObj.alcance_120_meta }).eq("id", editandoObj);
 setEditandoObj(null); setFormEditObj(null); cargarDatos();
 }

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
 {/* Modal editar objetivo */}
 {editandoObj && formEditObj && (
 <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 }} onClick={function() { setEditandoObj(null); }}>
 <div style={{ background: "white", borderRadius: 16, padding: 28, maxWidth: 560, width: "90%", maxHeight: "85vh", overflowY: "auto" }} onClick={function(e) { e.stopPropagation(); }}>
 <h3 style={{ margin: "0 0 20px 0", color: "#231F20" }}>Editar Objetivo</h3>
 <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
 <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Objetivo *</label><textarea value={formEditObj.objetivo} onChange={function(e) { setFormEditObj({...formEditObj, objetivo: e.target.value}); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #D4D2C6", fontSize: 13, fontFamily: "inherit", minHeight: 80, resize: "vertical", boxSizing: "border-box" }} /></div>
 <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
 <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Corporativo</label><input value={formEditObj.corporativo} onChange={function(e) { setFormEditObj({...formEditObj, corporativo: e.target.value}); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #D4D2C6", fontSize: 13, boxSizing: "border-box" }} /></div>
 <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Ponderación (%)</label><input type="number" value={formEditObj.ponderacion} onChange={function(e) { setFormEditObj({...formEditObj, ponderacion: e.target.value}); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #D4D2C6", fontSize: 13, boxSizing: "border-box" }} /></div>
 </div>
 <div><label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "block", marginBottom: 4 }}>Status</label><select value={formEditObj.status} onChange={function(e) { setFormEditObj({...formEditObj, status: e.target.value}); }} style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #D4D2C6", fontSize: 13 }}><option value="pendiente">Pendiente</option><option value="aceptado">Aceptado</option><option value="completado">Completado</option><option value="validado">Validado</option><option value="rechazado">Rechazado</option></select></div>
 </div>
 <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
 <button onClick={guardarEdicionObj} style={{ ...s.btnPrimario, flex: 1 }}>Guardar cambios</button>
 <button onClick={function() { setEditandoObj(null); }} style={s.btnSecundario}>Cancelar</button>
 </div>
 </div>
 </div>
 )}
 {objetivosFiltrados.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No hay objetivos registrados.</p> : (

 <div style={{ overflowX: 'auto' }}>
 <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
 <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Colaborador</th><th style={{ ...th, color: '#D4D2C6' }}>Area</th><th style={{ ...th, color: '#D4D2C6' }}>Seniority</th><th style={{ ...th, color: "#D4D2C6" }}>Lider</th><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Alcance</th><th style={{ ...th, color: '#D4D2C6' }}>Historico</th><th style={{ ...th, color: '#D4D2C6' }}>Acciones</th></tr></thead>
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
// =============================================
// MÓDULO CAPACITACIONES
// =============================================
function ModuloCapacitaciones({ profile, esAdmin }) {
  var [vista, setVista] = useState('lista'); // lista | detalle | nueva
  var [capSeleccionada, setCapSeleccionada] = useState(null);
  var [capacitaciones, setCapacitaciones] = useState([]);
  var [misParticipaciones, setMisParticipaciones] = useState([]);
  var [cargando, setCargando] = useState(true);
  var [form, setForm] = useState({ nombre: '', descripcion: '', fecha: '', duracion_horas: '', instructor: '' });
  var [colabs, setColabs] = useState([]);
  var [participantes, setParticipantes] = useState([]);
  var [seleccionados, setSeleccionados] = useState([]);
  var [busquedaColab, setBusquedaColab] = useState('');
  var [guardando, setGuardando] = useState(false);

  useEffect(function() { cargar(); }, []);

  async function cargar() {
    setCargando(true);
    if (esAdmin) {
      var [{ data: caps }, { data: perfiles }] = await Promise.all([
        supabase.from('capacitaciones').select('*, capacitacion_participantes(id, colaborador_id, fecha_completado, aprobado, nota, observaciones, profiles:colaborador_id(full_name, area, puesto))').eq('activo', true).order('fecha', { ascending: false }),
        supabase.from('profiles').select('id, full_name, area, puesto, seniority').eq('activo', true).order('full_name'),
      ]);
      setCapacitaciones(caps || []);
      setColabs(perfiles || []);
    } else {
      var { data: parts } = await supabase.from('capacitacion_participantes').select('*, capacitacion:capacitacion_id(id, nombre, descripcion, fecha, duracion_horas, instructor)').eq('colaborador_id', profile.id);
      setMisParticipaciones(parts || []);
    }
    setCargando(false);
  }

  async function abrirDetalle(cap) {
    setCapSeleccionada(cap);
    setParticipantes(cap.capacitacion_participantes || []);
    setSeleccionados((cap.capacitacion_participantes || []).map(function(p) { return p.colaborador_id; }));
    setVista('detalle');
  }

  async function guardarCapacitacion() {
    if (!form.nombre.trim()) return alert('El nombre es obligatorio');
    if (!form.fecha) return alert('La fecha es obligatoria');
    setGuardando(true);
    var { data: { session } } = await supabase.auth.getSession();
    var { data: nueva } = await supabase.from('capacitaciones').insert({
      nombre: form.nombre, descripcion: form.descripcion, fecha: form.fecha,
      duracion_horas: form.duracion_horas ? parseFloat(form.duracion_horas) : null,
      instructor: form.instructor, created_by: session.user.id
    }).select().single();
    if (nueva && seleccionados.length > 0) {
      await supabase.from('capacitacion_participantes').insert(
        seleccionados.map(function(cid) { return { capacitacion_id: nueva.id, colaborador_id: cid, fecha_completado: form.fecha }; })
      );
    }
    setForm({ nombre: '', descripcion: '', fecha: '', duracion_horas: '', instructor: '' });
    setSeleccionados([]);
    setGuardando(false);
    setVista('lista');
    cargar();
  }

  async function agregarQuitarParticipante(colabId) {
    if (!capSeleccionada) return;
    var yaEsta = seleccionados.includes(colabId);
    if (yaEsta) {
      await supabase.from('capacitacion_participantes').delete().eq('capacitacion_id', capSeleccionada.id).eq('colaborador_id', colabId);
      setSeleccionados(function(p) { return p.filter(function(id) { return id !== colabId; }); });
    } else {
      await supabase.from('capacitacion_participantes').insert({ capacitacion_id: capSeleccionada.id, colaborador_id: colabId, fecha_completado: capSeleccionada.fecha });
      setSeleccionados(function(p) { return [...p, colabId]; });
    }
    cargar();
  }

  async function eliminarCapacitacion(capId) {
    if (!window.confirm('¿Eliminar esta capacitación? Se eliminarán todos los participantes.')) return;
    await supabase.from('capacitaciones').update({ activo: false }).eq('id', capId);
    cargar();
  }

  function generarCertificadoPDF(part, cap) {
    var capData = cap || part.capacitacion;
    var pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    var W = 297; var H = 210;

    // Fondo arena
    pdf.setFillColor(220, 217, 210);
    pdf.rect(0, 0, W, H, 'F');

    // Borde exterior redondeado
    pdf.setDrawColor(160, 150, 135);
    pdf.setLineWidth(3);
    pdf.roundedRect(6, 6, W - 12, H - 12, 8, 8, 'S');
    pdf.setLineWidth(0.6);
    pdf.roundedRect(10, 10, W - 20, H - 20, 6, 6, 'S');

    // Año — círculo decorativo arriba izquierda
    var anio = capData && capData.fecha ? new Date(capData.fecha + 'T12:00:00').getFullYear() : new Date().getFullYear();
    pdf.setFillColor(55, 50, 45);
    pdf.circle(26, 42, 14, 'F');
    pdf.setFillColor(75, 70, 65);
    pdf.circle(26, 42, 12, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(255, 255, 255);
    pdf.text(String(anio), 26, 45.5, { align: 'center' });

    // Logo centrado con líneas
    pdf.setDrawColor(160, 150, 135);
    pdf.setLineWidth(0.5);
    pdf.line(W/2 - 60, 30, W/2 - 22, 30);
    pdf.line(W/2 + 22, 30, W/2 + 60, 30);
    try { pdf.addImage('/logo.jpg', 'JPEG', W/2 - 18, 16, 36, 28); } catch(e) {}

    // CERTIFICADO
    pdf.setFont('times', 'bold');
    pdf.setFontSize(48);
    pdf.setTextColor(25, 22, 20);
    pdf.text('CERTIFICADO', W/2, 58, { align: 'center' });

    // Línea bajo título
    pdf.setDrawColor(140, 130, 115);
    pdf.setLineWidth(0.5);
    pdf.line(W/2 - 90, 62, W/2 + 90, 62);

    // Nombre colaborador
    var nombreColab = '';
    if (part && part.profiles) nombreColab = part.profiles.full_name || '';
    else if (typeof profile !== 'undefined' && profile) nombreColab = profile.full_name || profile.email || '';
    pdf.setFont('times', 'bolditalic');
    pdf.setFontSize(26);
    pdf.setTextColor(35, 31, 32);
    pdf.text(nombreColab, W/2, 82, { align: 'center' });
    // Línea bajo nombre
    pdf.setDrawColor(35, 31, 32);
    pdf.setLineWidth(0.7);
    var nw = Math.min(pdf.getTextWidth(nombreColab) + 16, W - 80);
    pdf.line(W/2 - nw/2, 86, W/2 + nw/2, 86);

    // Texto descriptivo
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(70, 65, 55);
    pdf.text('Se extiende el siguiente certificado por haber completado', W/2, 98, { align: 'center' });
    pdf.text('exitosamente la capacitacion:', W/2, 105, { align: 'center' });

    // Nombre capacitación
    var nombreCap = (capData && capData.nombre) ? capData.nombre : '';
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(25, 22, 20);
    var linesCap = pdf.splitTextToSize(nombreCap, W - 100);
    pdf.text(linesCap, W/2, 116, { align: 'center' });

    // Detalles
    var yDet = 116 + linesCap.length * 6 + 4;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 95, 85);
    var detalles = [];
    if (capData && capData.fecha) detalles.push(new Date(capData.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }));
    if (capData && capData.duracion_horas) detalles.push(capData.duracion_horas + ' horas');
    if (capData && capData.instructor) detalles.push('Instructor: ' + capData.instructor);
    if (detalles.length > 0) pdf.text(detalles.join('  ·  '), W/2, yDet, { align: 'center' });

    // Firmas
    var yFirma = H - 42;
    var yLinea = yFirma + 14;
    var yNombre = yLinea + 6;
    var yCargo = yNombre + 6;

    // Firma Adrián
    try {
      pdf.addImage('data:image/png;base64,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', 'PNG', W/4 - 22, yFirma - 8, 44, 18);
    } catch(e) {}
    pdf.setDrawColor(150, 140, 125);
    pdf.setLineWidth(0.5);
    pdf.line(W/4 - 35, yLinea, W/4 + 35, yLinea);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(35, 31, 32);
    pdf.text('Adrian Galvan', W/4, yNombre, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 95, 85);
    pdf.text('Gerente de Recursos Humanos', W/4, yCargo, { align: 'center' });

    // Firma Florencia
    try {
      pdf.addImage('data:image/jpeg;base64,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UAASgQpBUSkKAFBAUEAAAEWpRYASpQgsACwABCg6jOlgqUWCpDSDVxTpeVOrGjSUAAWUAAASglCCcO/AxnWbEKAARSWUAllIsKgoJYLAssKlEsKEASwsCxSENJQQoEollUARKACxSSwoAAAOqXOgJUKACkKlALcjrrjs6ILKJYKABYBCkLFM8O/GucRAolJQgCwAFIABYAALAAAsEIKQoABSAAAAAsAACwKFIKgqVEsAOozoBZQACoLAWCwFDpvj0NpSWUlgssAAKlJYJx68jnLnUIBSKIAACUAECoKQsEWCyiWCghQAAAlAUEEKAQoFgAWVYAAEAABejNzdIqoioNIKlAAoISw1cU7a57FlCUAAAAAzy68TENTKwWABKBBZRKEAAEAWUlgqABYFAlWApCoLBAKlAEsKQoAACVYohUlBKIpaSXclCC3I0yNXA3cE3cVdIKAI105dDVlJQAEKgpCgxy68azmyyJQCWUQLFBAsBChAABCgWAABZQFShLBLCgBAAFgAoAIAFqUJUAQKhaJVlEEsCyiFAFlW3NNXNKiLvns6pQAABYABTHDtyrGdSzKwWAAAAQpChBCoKgoJUKAAAAFsABFJZQRLYUEAqCgRSABQSwKgssAKiaoQUgFQAFJYKDVxV2zoazqOtzRZSKJQEKlFgxx7cq5ksSwAAJQgoIEAAWCoWxUQFgqCpQAAFAiwWCyxKgoAAAAAUABYQsBFoCoAAAAAsACywWF1rFNazY66xsJSwKgAENJTny68rMSyksRYVLAACwCxAAAWVChAAAFgqCkWwSwAUCyxBRApFqEqUABSCwKgWVERdILZYAILAWCkKAAABYXesaOusbhYLAqUsBLCoM8unKsy5ssAgssCwALEAAhVBBCgABQFgABAAAAAAAAUEWUIAAUUiwAAiiiAAAAKgssFgoAANaxpenTl1gUiiAslALAxy6cqzLLBCkLAELKARKAIFoQlAAJRQABCkSkKAAAQoAAAUABKJZQAAAQAtiKlECwKQqCgAAqAC7xpd9uPWLLSAAAAA5c+nKpCyAAIKgWChACAFqUixAAAWoKRLFWLEsoAlCWACyglABFpACoFlACCwCwKAgAAAAUlgpCpQAC6zpddOe42ACwAKlIsOfPpyrIsgAEsAAABUQUsALBLAABQLAABKgqBQhRENM1alIAAAAsFlEsAgKAKAgAAAAAAACoKBrNXe+fQ2WJYKlAABDHLpzswSqQoSBSwAAAAAAESgIWpQAAAsQAFAAAlAAAAAAUllhAAEKgqDSACwKgqUSwVBQAAAtzTe+e16pYAUAAEDny6c7MwoBZSLAgqBYLLCkFgsEAoEsVZQAAAlACUAAlACWCpQAAAlglACAAACpQgoAAAAFgoAAFlNazpempYlACwFgsQ58+nOzMsoQoCUlgAAAWUBEsFgBbLBYFgqBZSWCwAAALAWAAIssFlIBULAWAAQqUAAAAoAAAAAFACUN6xs63OpQAFgAgOfPpzszLKAELAAAAAAAAAAAAEKAQqUAAAAAACCCgWBYAABCpQlBACgBQAAKhKlAACC2CoNbxo6dMblSwoAEogOXPpzszLKqAAACUBCkCwWCyggpCxSLCxQACWUSwpCoKlBCgiogBQlAJZQlEsAFgAAqVZZQAAAEAWUAlABYNbxo66xuVYKgqUSwQOfPpzszLKAllAAJULLACpSAWUQLLBQAAAEFlBCyiWAsAixaggBYKQWBYAAAACCoKFAWCkKQqEoAFlAAALvGjrrOpVgtgpABA5Y3izMsolICoKQqCywAWUgABSUIABYFCAWCwLKIAIAJQAACxCgASwqUELAWCoP//aAAwDAQACAAMAAAAhDDjDDjbDR1NdBxNRxJBNJdNNNNNM4A0l5hzftRF5MYcMRPiPbdc4kQglNx51/bzfDDFNJlJx1xBJlhhhRZh11s88d9NFBEE4x/r7/wAfDMIMCEDPCAcSzx3398886cfZXVYeZWBMdccTAbTUBAYBQYEOMEMEAAadGIFMNDHICLPPBzzyxxz++iTfeTScdDEHXZffTWcQccNceecLITGMPIfeMEENADBDONJGcRz21yzz+scTCIHWbDDEIHRRTUcXfXXeXTfdTRQKBDKPDDFGMNDGABDCFTc/89+90/xfLDcAMbfccaCcecRDbSQQYZQQVeJcWMZTBBHIBBPGAJNMIIAT38zxzwz6SQcdIDTcccbTefdQQUVffffTWSBfXfNAHMMAMIADPNAAPKDAW4051yxx6cfQedJcceOZfUWZZbXTQaXRUUfNMPIFLECCJFHOIBPOPPPADM39z319+x2ffedfedTTLUZXVaQ7z32949bTTHMAJHBJBMMNAFMKDDAEPMF793/zwz/0/wCuDE10EkFnWEGdsc9stcPPs+epRjCAAjwwgQATgTiTSwADwc8MNP8A/wD/AOsM893nnX3XXnXnONt/Oce++88vt7DjDzTzjDATSBwABTAygy+eeftNPMMdPvFEEMmEEkEH28tc9sM89svv+/aJLKKJ5wgxC1CBAgAzjzCtMs9+Oc++td81V+8esv8AzPbLP/XVgMMlvXHPPfvf73PfrDzH7byCabPHDft/zHzfTDnv/wA80/8A/u/uuPNeNtHlyjAnP/8ALPPDDDTzDzzjLzBPnPLj1/7/AD1/4x+734x0ywywx73yx/0888bJLDJDzacYcXfdXVffdffTWWbTUYYDQ889TeS3Yw889+48+4wx4bzacTbfZYVJYTfbURDTTQaTWZTTTjnsogpijB77+QRTYc88xzz/AN8e/vGVmFVk0n03CSHVs4/u6PPfVnXLbqILIIJa5L76/vOM3331v/O/cu8MOdMs0Wl30FDlwyASJZYI47O9+9HKYo4TTBjDjCprIMM+XV3P/sdOOM/N/s+v/sXEE1nBH3z24o6robZI574765xBEjCRDzkAwFvMeNHMON3/AP8A8z0415z39fffcCBTekyikgjsjmvjgouogOAVdfaRSbZdQSwzxww++0e88yxz95y/xDTTAnssImutssnjusmousjjjDMUaffffbfdcTR//wD/APThRBd/v/jHXrzEwkAgCKOKCCSCCCOKWOayKymexNAHZxxz/wAzTTTX/wD+sOkkXHf/APfH/rBBQwQu62e+yKSuqOG+eCCS2Gem8xRzHDbvzPrDTv8A+4w449VR11ww14QcQUDMIkgmnvuutvjvvvtploinvj2/dcwwz58JI/8A+fMs9te9e9+O8PvMEEX3gS444p7oNKI47aLL6sILYIEFlG0kuPd/b7yz08/L+vPM9e8tcMdOcV32AI57raKo7+5774IIJYxKpw033U0UF8sverL7z/8A8O7DDvLf3/vDvpk498eS6CCGyiOC+yu68cMOWUc9dl9F9/8A5qi7wzAlv/8A74Neutf/AHzzX/8AACADCjgjgkissggk1kkAMPgNe4fZaec+wyjps/8AywILrb48/wDrHPvHP/tDc888iCmSGWCXBqDDvJJZAEBptZh1tLPWSCSqS08w8MMGCf8A+/z3w1/eYFNfKAhkg36/vEeHv/8AWWEmwEEFn2233/bzwgiI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6wyeiacjD/QkcYpVsoT/AJv46q3+zx373+5zzw/1yFT85faFNpNEmvrgNKEnhqkikJDhCPKI+znERTY03y69+649w70//wB/uevAePkx2VTDbjj6pqTRCx4qp6YALqrzRDTaZ7i3HsfsO8tM+MO0GOcN8GGHqfsEHlQQRL7JKI74oqrYLbZ4L4ra4LaNZTbAUHtP/wDDD7rjX/3DT73Fh9C7tBJdMwwQi+OaSumeaayOy+hPKm6aSnv/AD4v8998+2/40x/ww7/253b14o5VXIEFOAEAkmuhuhkhtlmun27375958wwmtw19w8WTe1fx5x007yfaYRjyfaUBCKNPHhjrvkymontkqnty2zoyYa4ydLz2257UeQ61417yydcRedXm+eEdbbAeIFOrtjn4ivilhhhrDGxGEHP8/CA/0SQcfXWSa6/1dVfSWafYgwdNGfQogqhthsgojsuhktluioBLFNS89WKQz9IDDNNYQZSRSWfZZacefp1ZfRcEogiglmhhp5wxg+kx42zipu273/WUdQ+pkihtmi2aOfaUQceWbct3YIGOgqtjgrnlilg412//ANsfNOoIfPNvUUmH8qKYraZqLIIRH3X2mWVlC+EiLeL7L4KbbJbK59+dNvN+/wDj3f8A330jju1/0tqktjkvmviiaRVfcSbQjTOMlkosonjhn7158+yw62+hx/3+5/yugk148PgPvgkgoFknvKXbcccEZqcL8khqkilr867z9/42vhhm6681xw/06tu428FGGIFLBbJBHkicYBDBIYCSIqnihtpv+w544/66wkklpu9+7+ww/WGCw3QIIHXUeQcOIHvndSXYPMWENLOrvvtg97zw5126/wDI4JroeZdM8Nv3D189UExXn2X3m3EgjIyGuE1ijixT4po4L/f+cZt+88tOPZLa788OOvuEBAi2MQDFXXH3l3FWQDal1E3/APJx4Xm2+ua3/TCm/wD/AOu88Z9/75ft8asuEAxwykwCkE128cNP/wBkE+tZZZ2dMke+eyGnrjyLH/jGOqi3jL37j37+rrNxw4QQA8x9hBDPXnTxVMe7j6YufA42mWuS3TD+DLjDi2qGHH7zDHjX32yAQoU8AE8tJddFP37zP5giyWKe2DsI4yOO+DDP2K3/AO/jh2t0y47/ANNtMYTwyiABzTD33X33m0ckPOiLLZ75qOwA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', 'JPEG', W*3/4 - 22, yFirma - 8, 44, 18);
    } catch(e) {}
    pdf.setDrawColor(150, 140, 125);
    pdf.setLineWidth(0.5);
    pdf.line(W*3/4 - 35, yLinea, W*3/4 + 35, yLinea);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(35, 31, 32);
    pdf.text('Florencia Salvaneschi', W*3/4, yNombre, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 95, 85);
    pdf.text('HRBP Operaciones', W*3/4, yCargo, { align: 'center' });

    var nombreArchivo = 'Certificado_' + (nombreColab || 'colaborador').replace(/\s+/g, '_') + '.pdf';
    pdf.save(nombreArchivo);
  }


  var inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };
  var labelStyle = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 };

  if (cargando) return <p style={{ padding: 40, color: '#64748b' }}>Cargando...</p>;

  // ── VISTA COLABORADOR ──
  if (!esAdmin) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ background: '#231F20', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: '#F0EDE8', fontSize: 22, fontWeight: 700 }}>Mis Capacitaciones</h2>
          <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#94a3b8' }}>{misParticipaciones.length} capacitación{misParticipaciones.length !== 1 ? 'es' : ''} completada{misParticipaciones.length !== 1 ? 's' : ''}</p>
        </div>
        {misParticipaciones.length === 0 ? (
          <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 40, textAlign: 'center' }}>
            <p style={{ color: '#94a3b8', fontSize: 14 }}>Todavía no tenés capacitaciones registradas.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {misParticipaciones.map(function(part) {
              var cap = part.capacitacion;
              return (
                <div key={part.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '4px solid #231F20', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#231F20' }}>{cap?.nombre}</p>
                    <div style={{ display: 'flex', gap: 16, marginTop: 6, flexWrap: 'wrap' }}>
                      {cap?.fecha && <span style={{ fontSize: 12, color: '#64748b' }}>{new Date(cap.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
                      {cap?.duracion_horas && <span style={{ fontSize: 12, color: '#64748b' }}>{cap.duracion_horas} hs</span>}
                      {cap?.instructor && <span style={{ fontSize: 12, color: '#64748b' }}>Instructor: {cap.instructor}</span>}
                    </div>
                    {cap?.descripcion && <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{cap.descripcion}</p>}
                  </div>
                  <button onClick={function() { generarCertificadoPDF(part, null); }}
                    style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#231F20', color: '#F0EDE8', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                    Descargar Certificado
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── VISTA ADMIN — NUEVA CAPACITACIÓN ──
  if (vista === 'nueva') {
    var colabsFiltrados = colabs.filter(function(c) {
      if (!busquedaColab) return true;
      return (c.full_name || '').toLowerCase().includes(busquedaColab.toLowerCase()) || (c.area || '').toLowerCase().includes(busquedaColab.toLowerCase());
    });
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={function() { setVista('lista'); setSeleccionados([]); }} style={s.btnInfo}>Volver</button>
          <h2 style={{ margin: 0, color: '#231F20', fontSize: 20, fontWeight: 700 }}>Nueva Capacitación</h2>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Formulario */}
          <div style={{ flex: 1, minWidth: 280, background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ margin: 0, color: '#231F20', fontSize: 15 }}>Datos de la capacitación</h3>
            <div><label style={labelStyle}>Nombre *</label><input value={form.nombre} onChange={function(e) { setForm({...form, nombre: e.target.value}); }} style={inputStyle} placeholder="Ej: Escuela de Sushi" /></div>
            <div><label style={labelStyle}>Descripción</label><textarea value={form.descripcion} onChange={function(e) { setForm({...form, descripcion: e.target.value}); }} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Descripción de la capacitación..." /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelStyle}>Fecha *</label><input type="date" value={form.fecha} onChange={function(e) { setForm({...form, fecha: e.target.value}); }} style={inputStyle} /></div>
              <div><label style={labelStyle}>Duración (horas)</label><input type="number" value={form.duracion_horas} onChange={function(e) { setForm({...form, duracion_horas: e.target.value}); }} style={inputStyle} placeholder="Ej: 8" /></div>
            </div>
            <div><label style={labelStyle}>Instructor</label><input value={form.instructor} onChange={function(e) { setForm({...form, instructor: e.target.value}); }} style={inputStyle} placeholder="Nombre del instructor" /></div>
          </div>

          {/* Selector de participantes */}
          <div style={{ flex: 1, minWidth: 280, background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 24 }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#231F20', fontSize: 15 }}>Participantes ({seleccionados.length})</h3>
            <input value={busquedaColab} onChange={function(e) { setBusquedaColab(e.target.value); }} placeholder="Buscar colaborador o área..." style={{ ...inputStyle, marginBottom: 12 }} />
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {colabsFiltrados.map(function(c) {
                var sel = seleccionados.includes(c.id);
                return (
                  <div key={c.id} onClick={function() { setSeleccionados(function(p) { return sel ? p.filter(function(id) { return id !== c.id; }) : [...p, c.id]; }); }}
                    style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: sel ? '#231F20' : '#F0EDE8', border: '1px solid ' + (sel ? '#231F20' : '#e8e6e0') }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: sel ? '#F0EDE8' : '#231F20' }}>{c.full_name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: sel ? '#94a3b8' : '#64748b' }}>{c.area}{c.puesto ? ' · ' + c.puesto : ''}</p>
                    </div>
                    {sel && <span style={{ fontSize: 12, color: '#86efac', fontWeight: 700 }}>✓</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
          <button onClick={guardarCapacitacion} disabled={guardando} style={{ ...s.btnPrimario, opacity: guardando ? 0.6 : 1 }}>{guardando ? 'Guardando...' : 'Guardar capacitación'}</button>
          <button onClick={function() { setVista('lista'); setSeleccionados([]); }} style={s.btnSecundario}>Cancelar</button>
        </div>
      </div>
    );
  }

  // ── VISTA ADMIN — DETALLE ──
  if (vista === 'detalle' && capSeleccionada) {
    var colabsFiltradosD = colabs.filter(function(c) {
      if (!busquedaColab) return true;
      return (c.full_name || '').toLowerCase().includes(busquedaColab.toLowerCase()) || (c.area || '').toLowerCase().includes(busquedaColab.toLowerCase());
    });
    return (
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={function() { setVista('lista'); setBusquedaColab(''); cargar(); }} style={s.btnInfo}>Volver</button>
          <h2 style={{ margin: 0, color: '#231F20', fontSize: 20, fontWeight: 700 }}>{capSeleccionada.nombre}</h2>
        </div>
        {/* Info */}
        <div style={{ background: '#231F20', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {capSeleccionada.fecha && <span style={{ fontSize: 13, color: '#D4D2C6' }}>{new Date(capSeleccionada.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
          {capSeleccionada.duracion_horas && <span style={{ fontSize: 13, color: '#D4D2C6' }}>{capSeleccionada.duracion_horas} horas</span>}
          {capSeleccionada.instructor && <span style={{ fontSize: 13, color: '#D4D2C6' }}>Instructor: {capSeleccionada.instructor}</span>}
          <span style={{ fontSize: 13, color: '#86efac', fontWeight: 700 }}>{seleccionados.length} participantes</span>
        </div>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* Lista participantes actuales */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#231F20' }}>Participantes</h4>
            {seleccionados.length === 0 ? <p style={{ color: '#94a3b8', fontSize: 13 }}>Sin participantes aún.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colabs.filter(function(c) { return seleccionados.includes(c.id); }).map(function(c) {
                  return (
                    <div key={c.id} style={{ background: 'white', borderRadius: 10, border: '1px solid #e8e6e0', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#231F20' }}>{c.full_name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{c.area}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={function() { var _c = c; var _cap = capSeleccionada; generarCertificadoPDF({ profiles: _c }, _cap); }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#F0EDE8', color: '#231F20', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          PDF
                        </button>
                        <button onClick={function() { agregarQuitarParticipante(c.id); }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
                          Quitar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {/* Agregar participantes */}
          <div style={{ flex: 1, minWidth: 280, background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 20 }}>
            <h4 style={{ margin: '0 0 12px 0', color: '#231F20' }}>Agregar participante</h4>
            <input value={busquedaColab} onChange={function(e) { setBusquedaColab(e.target.value); }} placeholder="Buscar..." style={{ ...inputStyle, marginBottom: 10 }} />
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {colabsFiltradosD.filter(function(c) { return !seleccionados.includes(c.id); }).map(function(c) {
                return (
                  <div key={c.id} onClick={function() { agregarQuitarParticipante(c.id); }}
                    style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#F0EDE8', border: '1px solid #e8e6e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#231F20' }}>{c.full_name}</p>
                      <p style={{ margin: 0, fontSize: 11, color: '#64748b' }}>{c.area}</p>
                    </div>
                    <span style={{ fontSize: 18, color: '#231F20' }}>+</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── VISTA ADMIN — LISTA ──
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#231F20', fontSize: 22, fontWeight: 700 }}>Capacitaciones</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>{capacitaciones.length} capacitación{capacitaciones.length !== 1 ? 'es' : ''} registrada{capacitaciones.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={function() { setVista('nueva'); setSeleccionados([]); setBusquedaColab(''); setForm({ nombre: '', descripcion: '', fecha: '', duracion_horas: '', instructor: '' }); }} style={s.btnPrimario}>
          + Nueva capacitación
        </button>
      </div>
      {capacitaciones.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 60, textAlign: 'center' }}>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>No hay capacitaciones cargadas aún.</p>
          <p style={{ color: '#64748b', fontSize: 13, margin: '8px 0 0 0' }}>Hacé clic en "Nueva capacitación" para comenzar.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {capacitaciones.map(function(cap) {
            var nPart = (cap.capacitacion_participantes || []).length;
            return (
              <div key={cap.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '4px solid #231F20', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#231F20' }}>{cap.nombre}</p>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#F0EDE8', color: '#231F20' }}>{nPart} participante{nPart !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    {cap.fecha && <span style={{ fontSize: 12, color: '#64748b' }}>{new Date(cap.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
                    {cap.duracion_horas && <span style={{ fontSize: 12, color: '#64748b' }}>{cap.duracion_horas} hs</span>}
                    {cap.instructor && <span style={{ fontSize: 12, color: '#64748b' }}>Instructor: {cap.instructor}</span>}
                  </div>
                  {cap.descripcion && <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{cap.descripcion}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={function() { abrirDetalle(cap); }} style={s.btnInfo}>Ver / Editar</button>
                  <button onClick={function() { eliminarCapacitacion(cap.id); }} style={{ ...s.btnInfo, color: '#dc2626', borderColor: '#fca5a5', background: '#fee2e2' }}>Eliminar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
 setForm(obj ? { ...obj } : { nombre: '', icono: '', resumen: '', descripcion: '', meta: '', medicion: '', orden: (objetivos.length + 1) });
 setEditando(obj ? obj.id : 'nuevo');
 setSeleccionado(null);
 }

 async function guardar() {
 if (!form.nombre) return alert('El nombre es obligatorio');
 if (editando === 'nuevo') {
 await supabase.from('objetivos_compania').insert({ nombre: form.nombre, icono: form.icono || '', resumen: form.resumen, descripcion: form.descripcion, meta: form.meta, medicion: form.medicion, orden: form.orden || 0, activo: true });
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

 var ICONOS = ['', '', '', '', '', '', '', '', '', '⭐'];

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
 <select value={form.icono || ''} onChange={function(e) { setForm({...form, icono: e.target.value}); }} style={{ padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 20 }}>
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
 <button onClick={function(e) { e.stopPropagation(); abrirForm(obj); }} style={{ background: 'rgba(255,255,255,0.85)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Editar</button>
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
 <div style={{ fontSize: 28, marginBottom: 10 }}>{obj.icono || ''}</div>
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
 <span style={{ fontSize: 28 }}>{obj.icono || ''}</span>
 <div>
 <p style={{ margin: 0, fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, fontWeight: 600 }}>Objetivo estratégico 2026</p>
 <h3 style={{ margin: '2px 0 0 0', fontSize: 20, fontWeight: 700, color: '#D4D2C6' }}>{obj.nombre}</h3>
 </div>
 </div>
 <button onClick={function() { setSeleccionado(null); }} style={{ background: 'rgba(212,210,198,0.15)', border: '1px solid rgba(212,210,198,0.3)', borderRadius: 8, color: '#D4D2C6', cursor: 'pointer', fontSize: 18, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center' }}></button>
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
 { id: 'desempeno', label: ' Desempeño', desc: 'Evaluaciones y ciclos' },
 { id: 'obj_individual', label: ' Objetivos Individuales', desc: 'Mis objetivos y equipo' },
 { id: 'obj_compania', label: ' Objetivos Compañía', desc: 'Objetivos estratégicos' },
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
 {cargandoEste ? '' : activo ? '' : '○'}
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
  btnInfo: { fontSize: 13, padding: "10px 22px", borderRadius: 8, border: "1px solid #231F20", background: "white", cursor: "pointer", color: "#231F20", fontWeight: 600 },
 ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' },
 ratingBtn: { width: 40, height: 40, borderRadius: 8, fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' },
 ratingInfoBox: { background: '#F0EDE8', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #e8e6e0' },
 ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 },
 textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'white' },
 textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'white' },
 btnPrimario: { padding: '10px 22px', background: '#231F20', color: '#F0EDE8', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 13 },
 mensajeToast: { padding: '12px 20px', background: '#231F20', borderRadius: 8, marginBottom: 16, color: '#F0EDE8', fontWeight: 500, fontSize: 14, textAlign: 'center' },
 bannerEnviado: { padding: 16, background: '#dcfce7', borderRadius: 10, color: '#166534', fontWeight: 600, textAlign: 'center', marginTop: 16, border: '1px solid #86efac' }
};
