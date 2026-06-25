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

    // Logo centrado cuadrado con líneas
    pdf.setDrawColor(140, 130, 115);
    pdf.setLineWidth(0.6);
    pdf.line(W/2 - 65, 30, W/2 - 22, 30);
    pdf.line(W/2 + 22, 30, W/2 + 65, 30);
    try { pdf.addImage('/logo.jpg', 'JPEG', W/2 - 18, 15, 36, 36); } catch(e) {}

    // CERTIFICADO
    pdf.setFont('times', 'bold');
    pdf.setFontSize(50);
    pdf.setTextColor(25, 22, 20);
    pdf.text('CERTIFICADO', W/2, 64, { align: 'center' });

    // Línea bajo título
    pdf.setDrawColor(130, 120, 105);
    pdf.setLineWidth(0.5);
    pdf.line(W/2 - 95, 68, W/2 + 95, 68);

    // Nombre colaborador
    var nombreColab = '';
    if (part && part.profiles) nombreColab = part.profiles.full_name || '';
    else if (typeof profile !== 'undefined' && profile) nombreColab = profile.full_name || profile.email || '';
    pdf.setFont('times', 'bolditalic');
    pdf.setFontSize(28);
    pdf.setTextColor(35, 31, 32);
    pdf.text(nombreColab, W/2, 86, { align: 'center' });
    pdf.setDrawColor(35, 31, 32);
    pdf.setLineWidth(0.7);
    var nw = Math.min(pdf.getTextWidth(nombreColab) + 16, W - 80);
    pdf.line(W/2 - nw/2, 90, W/2 + nw/2, 90);

    // Texto descriptivo
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(70, 65, 55);
    pdf.text('Se extiende el siguiente certificado por haber completado', W/2, 102, { align: 'center' });
    pdf.text('exitosamente la capacitacion:', W/2, 110, { align: 'center' });

    // Nombre capacitación
    var nombreCap = (capData && capData.nombre) ? capData.nombre : '';
    pdf.setFont('times', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(25, 22, 20);
    var linesCap = pdf.splitTextToSize(nombreCap, W - 100);
    pdf.text(linesCap, W/2, 121, { align: 'center' });

    // Detalles
    var yDet = 121 + linesCap.length * 7 + 3;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 95, 85);
    var detalles = [];
    if (capData && capData.fecha) detalles.push(new Date(capData.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }));
    if (capData && capData.duracion_horas) detalles.push(capData.duracion_horas + ' horas');
    if (capData && capData.instructor) detalles.push('Instructor: ' + capData.instructor);
    if (detalles.length > 0) pdf.text(detalles.join('  ·  '), W/2, yDet, { align: 'center' });

    // Firmas
    var yFirmaImg = H - 52;
    var yLinea = H - 34;
    var yNombre = H - 27;
    var yCargo = H - 21;

    // Firma Adrián
    try { pdf.addImage('data:image/png;base64,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', 'PNG', W/4 - 24, yFirmaImg, 48, 16); } catch(e) {}
    pdf.setDrawColor(140, 130, 115); pdf.setLineWidth(0.5);
    pdf.line(W/4 - 38, yLinea, W/4 + 38, yLinea);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(35, 31, 32);
    pdf.text('Adrian Galvan', W/4, yNombre, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(100, 95, 85);
    pdf.text('Gerente de Recursos Humanos', W/4, yCargo, { align: 'center' });

    // Firma Florencia (PNG con transparencia)
    try { pdf.addImage('data:image/png;base64,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', 'PNG', W*3/4 - 30, yFirmaImg, 60, 16); } catch(e) {}
    pdf.setDrawColor(140, 130, 115); pdf.setLineWidth(0.5);
    pdf.line(W*3/4 - 38, yLinea, W*3/4 + 38, yLinea);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(35, 31, 32);
    pdf.text('Florencia Salvaneschi', W*3/4, yNombre, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(100, 95, 85);
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
