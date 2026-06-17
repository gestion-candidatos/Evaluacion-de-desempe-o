import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';

export default function PanelApp() {
  var [profile, setProfile] = useState(null);
  var [loading, setLoading] = useState(true);
  var [menuActivo, setMenuActivo] = useState('desempeno');
  var [cicloActivo, setCicloActivo] = useState(null);
  var [vistaComoColaborador, setVistaComoColaborador] = useState(false);

  useEffect(function() { cargarPerfil(); }, []);

  async function cargarPerfil() {
    var { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    var { data: perfil } = await supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo, leader_id, modulos_visibles').eq('id', session.user.id).single();
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
  var modulos = profile.modulos_visibles || ['desempeno','objetivos','compania','feedback','calibracion','pdi','reportes'];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebarStyle.aside}>
        <div style={sidebarStyle.logoContainer}><img src="/logo.jpg" alt="Fabric Group" style={{ height: '40px' }} /></div>
        <nav style={sidebarStyle.nav}>
          {modulos.includes('desempeno') && (
            <button onClick={function() { setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' }}>📊 DESEMPEÑO</button>
          )}
          {modulos.includes('objetivos') && (
            <button onClick={function() { setMenuActivo(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj' ? '' : 'objetivos'); }} style={{ ...sidebarStyle.menuItem, background: (menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '#D4D2C6' : 'transparent', color: (menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '#231F20' : '#D4D2C6' }}>🎯 OBJETIVOS {(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') ? '▼' : '▶'}</button>
          )}
          {(menuActivo === 'objetivos' || menuActivo === 'miequipo_obj' || menuActivo === 'misobjetivos' || menuActivo === 'compania_obj' || menuActivo === 'admin_obj') && (
            <div style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <button onClick={function() { setMenuActivo('misobjetivos'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'misobjetivos' ? '#D4D2C6' : 'transparent', color: menuActivo === 'misobjetivos' ? '#231F20' : '#D4D2C6' }}>🎯 Mis Objetivos</button>
              {tieneEquipo && <button onClick={function() { setMenuActivo('miequipo_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'miequipo_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'miequipo_obj' ? '#231F20' : '#D4D2C6' }}>👥 Mi Equipo</button>}
              {(profile.role === 'admin_rrhh' || esGerente) && <button onClick={function() { setMenuActivo('compania_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'compania_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'compania_obj' ? '#231F20' : '#D4D2C6' }}>🏢 Compañía</button>}
              {esSuperAdmin && <button onClick={function() { setMenuActivo('admin_obj'); }} style={{ ...sidebarStyle.subMenuItem, background: menuActivo === 'admin_obj' ? '#D4D2C6' : 'transparent', color: menuActivo === 'admin_obj' ? '#231F20' : '#D4D2C6', fontWeight: 600 }}>🔧 Panel Admin</button>}
            </div>
          )}
        </nav>
        <div style={sidebarStyle.footer}><span style={{ fontSize: 12, color: '#D4D2C6' }}>{profile.email}</span><button onClick={cerrarSesion} style={{ ...s.btnSalir, marginTop: 8, width: '100%' }}>Cerrar Sesion</button></div>
      </aside>
      <div style={{ flex: 1, background: '#f8fafc', minHeight: '100vh' }}>
        <header style={s.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1>
            <span style={s.badge}>{emojiRol} {nombreRol}</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {profile.role === 'admin_rrhh' && (
              <button onClick={function() { setVistaComoColaborador(!vistaComoColaborador); }} style={{ padding: '6px 14px', background: vistaComoColaborador ? '#231F20' : '#3b82f6', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 12 }}>
                {vistaComoColaborador ? '🔧 Volver a Admin' : '👤 Ver como Colaborador'}
              </button>
            )}
          </div>
        </header>
        <main style={{ padding: 24 }}>
          {vistaComoColaborador ? (
            <PanelColaboradorConEquipo userId={profile.id} seniority={profile.seniority} cicloId={cicloActivo?.id} profile={{...profile, role: 'colaborador'}} soloLectura={false} />
          ) : (
            <>
              {menuActivo === 'desempeno' && <DesempenoView profile={profile} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
              {menuActivo === 'misobjetivos' && <ObjetivosColaborador profile={profile} />}
              {menuActivo === 'miequipo_obj' && <ObjetivosGerente profile={profile} />}
              {menuActivo === 'compania_obj' && <PanelObjetivosCompania />}
              {menuActivo === 'admin_obj' && <PanelAdminObjetivos profile={profile} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
function PlaceholderView({ titulo, descripcion }) { return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}><h2>{titulo}</h2><p>{descripcion}</p></div>; }

function PanelObjetivosCompania() {
  var [objetivos, setObjetivos] = useState([]);
  var [cargando, setCargando] = useState(true);
  var [mostrarForm, setMostrarForm] = useState(false);
  var [editando, setEditando] = useState(null);
  var [form, setForm] = useState({ nombre: '', descripcion: '', peso: 25, nivel_80: '', nivel_100: '', nivel_120: '', ciclo_id: null });
  var [ciclos, setCiclos] = useState([]);

  useEffect(function() { cargar(); cargarCiclos(); }, []);

  async function cargar() { var { data } = await supabase.from('objetivos_compania').select('*, ciclo:ciclo_id(nombre)').order('created_at', { ascending: false }); setObjetivos(data || []); setCargando(false); }
  async function cargarCiclos() { var { data } = await supabase.from('ciclos').select('id, nombre').order('fecha_inicio', { ascending: false }); setCiclos(data || []); }

  async function guardar() {
    if (!form.nombre) return alert('El nombre es obligatorio');
    if (editando) { await supabase.from('objetivos_compania').update(form).eq('id', editando); }
    else { await supabase.from('objetivos_compania').insert(form); }
    setForm({ nombre: '', descripcion: '', peso: 25, nivel_80: '', nivel_100: '', nivel_120: '', ciclo_id: null });
    setMostrarForm(false); setEditando(null); cargar();
  }

  function editar(obj) { setForm({ nombre: obj.nombre, descripcion: obj.descripcion || '', peso: obj.peso || 25, nivel_80: obj.nivel_80 || '', nivel_100: obj.nivel_100 || '', nivel_120: obj.nivel_120 || '', ciclo_id: obj.ciclo_id || null }); setEditando(obj.id); setMostrarForm(true); }

  async function eliminar(id) { if (!confirm('¿Eliminar este objetivo?')) return; await supabase.from('objetivos_compania').delete().eq('id', id); cargar(); }

  async function toggleEstado(obj) { var nuevo = obj.estado === 'activo' ? 'cerrado' : 'activo'; await supabase.from('objetivos_compania').update({ estado: nuevo }).eq('id', obj.id); cargar(); }

  if (cargando) return <p>Cargando objetivos de compañía...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ color: '#231F20' }}>🏢 Objetivos de la Compañía</h2>
        <button onClick={function() { setMostrarForm(!mostrarForm); setEditando(null); setForm({ nombre: '', descripcion: '', peso: 25, nivel_80: '', nivel_100: '', nivel_120: '', ciclo_id: null }); }} style={s.btnPrimario}>+ Nuevo</button>
      </div>

      {mostrarForm && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20 }}>
          <h4>{editando ? 'Editar' : 'Nuevo'} Objetivo Compañía</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label>Nombre *</label><input value={form.nombre} onChange={function(e) { setForm({...form, nombre: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label>Peso (%)</label><input type="number" value={form.peso} onChange={function(e) { setForm({...form, peso: parseFloat(e.target.value)}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label>Ciclo</label><select value={form.ciclo_id || ''} onChange={function(e) { setForm({...form, ciclo_id: e.target.value ? parseInt(e.target.value) : null}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="">Sin ciclo</option>{ciclos.map(function(c) { return <option key={c.id} value={c.id}>{c.nombre}</option>; })}</select></div>
            <div><label>Descripción General</label><textarea value={form.descripcion} onChange={function(e) { setForm({...form, descripcion: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', minHeight: 50 }} /></div>
            <div><label>Descripción 80%</label><textarea value={form.nivel_80} onChange={function(e) { setForm({...form, nivel_80: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', minHeight: 50 }} /></div>
            <div><label>Descripción 100%</label><textarea value={form.nivel_100} onChange={function(e) { setForm({...form, nivel_100: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', minHeight: 50 }} /></div>
            <div><label>Descripción 120%</label><textarea value={form.nivel_120} onChange={function(e) { setForm({...form, nivel_120: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', minHeight: 50 }} /></div>
          </div>
          <button onClick={guardar} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 12 }}>💾 Guardar</button>
        </div>
      )}

      {objetivos.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No hay objetivos de compañía.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {objetivos.map(function(obj) { return (
            <div key={obj.id} style={{ ...s.tarjetaStat, border: '2px solid #D4D2C6', opacity: obj.estado === 'cerrado' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h4 style={{ margin: 0 }}>{obj.nombre}</h4>
                <span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.estado === 'activo' ? '#dcfce7' : '#fee2e2', color: obj.estado === 'activo' ? '#166534' : '#dc2626' }}>{obj.estado === 'activo' ? '✅ Activo' : '🔒 Cerrado'}</span>
              </div>
              {obj.descripcion && <p style={{ color: '#64748b', fontSize: 13, marginTop: 8 }}>{obj.descripcion}</p>}
              {obj.ciclo && <p style={{ fontSize: 12, color: '#64748b' }}>📅 {obj.ciclo.nombre}</p>}
              <p style={{ fontSize: 12 }}>Peso: {obj.peso}%</p>
              {obj.nivel_80 && <p style={{ fontSize: 11, color: '#f59e0b' }}>80%: {obj.nivel_80.substring(0, 50)}...</p>}
              {obj.nivel_100 && <p style={{ fontSize: 11, color: '#3b82f6' }}>100%: {obj.nivel_100.substring(0, 50)}...</p>}
              {obj.nivel_120 && <p style={{ fontSize: 11, color: '#22c55e' }}>120%: {obj.nivel_120.substring(0, 50)}...</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button onClick={function() { editar(obj); }} style={{ ...s.btnInfo, fontSize: 11 }}>✏️</button>
                <button onClick={function() { toggleEstado(obj); }} style={{ ...s.btnInfo, fontSize: 11, background: obj.estado === 'activo' ? '#fee2e2' : '#dcfce7', color: obj.estado === 'activo' ? '#dc2626' : '#166534' }}>{obj.estado === 'activo' ? '🔒' : '🔓'}</button>
                <button onClick={function() { eliminar(obj.id); }} style={{ ...s.btnInfo, fontSize: 11, background: '#fee2e2', color: '#dc2626' }}>🗑️</button>
              </div>
            </div>
          ); })}
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
  var [nuevoObjetivo, setNuevoObjetivo] = useState({ objetivo: '', corporativo: '', ponderacion: 25 });
  var [objetivoHistorico, setObjetivoHistorico] = useState({ objetivo: '', corporativo: '', ponderacion: 25, fecha_historica: '', alcance: '', status: 'validado' });
  var [seccionActiva, setSeccionActiva] = useState('objetivos');

  useEffect(function() { cargarDatos(); }, []);

  async function cargarDatos() {
    var [{ data: objs }, { data: cols }] = await Promise.all([
      supabase.from('objetivos').select('*, colaborador:colaborador_id(email, full_name, area, seniority), gerente:gerente_id(email, full_name)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo, modulos_visibles').neq('role', 'admin_rrhh').eq('activo', true)
    ]);
    setObjetivos(objs || []); setColaboradores(cols || []); setCargando(false);
  }

  async function agregarObjetivoAdmin() {
    if (!colaboradorSeleccionado || !nuevoObjetivo.objetivo) return alert('Selecciona colaborador y escribe el objetivo');
    var { data: { session } } = await supabase.auth.getSession();
    await supabase.from('objetivos').insert({ gerente_id: session.user.id, colaborador_id: colaboradorSeleccionado, objetivo: nuevoObjetivo.objetivo, corporativo: nuevoObjetivo.corporativo, ponderacion: nuevoObjetivo.ponderacion, status: 'pendiente' });
    setNuevoObjetivo({ objetivo: '', corporativo: '', ponderacion: 25 }); setColaboradorSeleccionado(''); setMostrarForm(false); cargarDatos();
  }

  async function agregarHistorico() {
    if (!colaboradorSeleccionado || !objetivoHistorico.objetivo || !objetivoHistorico.fecha_historica) return alert('Completa todos los campos');
    await supabase.from('objetivos').insert({ colaborador_id: colaboradorSeleccionado, objetivo: objetivoHistorico.objetivo, corporativo: objetivoHistorico.corporativo, ponderacion: objetivoHistorico.ponderacion, status: objetivoHistorico.status, es_historico: true, fecha_historica: objetivoHistorico.fecha_historica, alcance_completado: objetivoHistorico.alcance || null, validado_por_gerente: true });
    setObjetivoHistorico({ objetivo: '', corporativo: '', ponderacion: 25, fecha_historica: '', alcance: '', status: 'validado' }); setColaboradorSeleccionado(''); setMostrarHistorico(false); cargarDatos();
  }

  async function actualizarModulos(colaboradorId, modulosVisibles) {
    await supabase.from('profiles').update({ modulos_visibles: modulosVisibles }).eq('id', colaboradorId);
    cargarDatos();
  }

  function exportarExcel() {
    var datos = objetivosFiltrados.map(function(obj, i) { return { 'N°': i+1, 'Colaborador': obj.colaborador?.full_name || '', 'Email': obj.colaborador?.email || '', 'Area': obj.colaborador?.area || '', 'Seniority': obj.colaborador?.seniority || '', 'Objetivo': obj.objetivo, 'Corporativo': obj.corporativo || '', 'Ponderacion': obj.ponderacion + '%', 'Status': obj.status, 'Alcance': obj.alcance_completado || obj.alcance_validado || '', 'Comentario Lider': obj.comentario_lider || '', 'Historico': obj.es_historico ? 'Si' : 'No', 'Fecha': obj.fecha_historica || '' }; });
    var csv = Object.keys(datos[0]).join(',') + '\n' + datos.map(function(d) { return Object.values(d).map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'Objetivos_' + new Date().toISOString().slice(0,10) + '.csv'; link.click();
  }

  var areas = ['Todas'].concat([...new Set(colaboradores.map(function(c) { return c.area; }).filter(Boolean))]);
  var seniorities = ['Todos'].concat([...new Set(colaboradores.map(function(c) { return c.seniority; }).filter(Boolean))]);
  var objetivosFiltrados = objetivos.filter(function(obj) { if (filtroArea !== 'Todas' && obj.colaborador?.area !== filtroArea) return false; if (filtroSeniority !== 'Todos' && obj.colaborador?.seniority !== filtroSeniority) return false; return true; });
  var MODULOS_DISPONIBLES = ['desempeno','objetivos','compania','feedback','pdi','calibracion','reportes'];

  if (cargando) return <p>Cargando panel admin...</p>;

  return (
    <div>
      <h2 style={{ color: '#231F20', marginBottom: 20 }}>🔧 Panel Admin</h2>
      
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={function() { setSeccionActiva('objetivos'); }} style={seccionActiva === 'objetivos' ? s.btnPrimario : s.btnInfo}>🎯 Objetivos</button>
        <button onClick={function() { setSeccionActiva('usuarios'); }} style={seccionActiva === 'usuarios' ? s.btnPrimario : s.btnInfo}>👥 Usuarios</button>
      </div>

      {seccionActiva === 'objetivos' && (
        <div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={filtroArea} onChange={function(e) { setFiltroArea(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las Areas' : a}</option>; })}</select>
            <select value={filtroSeniority} onChange={function(e) { setFiltroSeniority(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{seniorities.map(function(s) { return <option key={s} value={s}>{s === 'Todos' ? 'Todos los Seniority' : s}</option>; })}</select>
            <button onClick={function() { setMostrarForm(!mostrarForm); setMostrarHistorico(false); }} style={{ ...s.btnPrimario, background: '#22c55e' }}>+ Nuevo Objetivo</button>
            <button onClick={function() { setMostrarHistorico(!mostrarHistorico); setMostrarForm(false); }} style={{ ...s.btnPrimario, background: '#8b5cf6' }}>📁 Subir Historico</button>
            <button onClick={exportarExcel} style={{ ...s.btnSecundario, background: '#22c55e', color: 'white', fontWeight: 600 }}>📥 Exportar Excel</button>
          </div>

          {mostrarForm && (
            <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
              <h4>Asignar Objetivo</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div><label>Colaborador *</label><select value={colaboradorSeleccionado} onChange={function(e) { setColaboradorSeleccionado(e.target.value); }} style={{ width: '100%', padding: 8, borderRadius: 6 }}><option value="">Seleccionar...</option>{colaboradores.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email} - {c.area}</option>; })}</select></div>
                <div><label>Objetivo *</label><input value={nuevoObjetivo.objetivo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, objetivo: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
                <div><label>Corporativo</label><input value={nuevoObjetivo.corporativo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, corporativo: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
                <div><label>Ponderacion (%)</label><select value={nuevoObjetivo.ponderacion} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, ponderacion: parseFloat(e.target.value)}); }} style={{ width: '100%', padding: 8, borderRadius: 6 }}><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option><option value="50">50%</option></select></div>
              </div>
              <button onClick={agregarObjetivoAdmin} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 12 }}>💾 Guardar</button>
            </div>
          )}

          {mostrarHistorico && (
            <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
              <h4>Subir Objetivo Historico</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
                <div><label>Colaborador *</label><select value={colaboradorSeleccionado} onChange={function(e) { setColaboradorSeleccionado(e.target.value); }} style={{ width: '100%', padding: 8, borderRadius: 6 }}><option value="">Seleccionar...</option>{colaboradores.map(function(c) { return <option key={c.id} value={c.id}>{c.full_name || c.email}</option>; })}</select></div>
                <div><label>Objetivo *</label><input value={objetivoHistorico.objetivo} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, objetivo: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
                <div><label>Fecha *</label><input type="date" value={objetivoHistorico.fecha_historica} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, fecha_historica: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
                <div><label>Alcance</label><input value={objetivoHistorico.alcance || ''} onChange={function(e) { setObjetivoHistorico({...objetivoHistorico, alcance: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
              </div>
              <button onClick={agregarHistorico} style={{ ...s.btnPrimario, background: '#8b5cf6', marginTop: 12 }}>💾 Guardar Historico</button>
            </div>
          )}

          {objetivosFiltrados.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No hay objetivos.</p> : (
            <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Colaborador</th><th style={{ ...th, color: '#D4D2C6' }}>Area</th><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th></tr></thead>
              <tbody>{objetivosFiltrados.map(function(obj) { return (<tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}><td style={td}><strong>{obj.colaborador?.full_name || '-'}</strong></td><td style={td}>{obj.colaborador?.area || '-'}</td><td style={td}>{obj.objetivo}</td><td style={td}><span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : obj.status === 'aceptado' ? '#fef3c7' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : obj.status === 'aceptado' ? '#92400e' : '#64748b' }}>{obj.status}</span></td></tr>); })}</tbody>
            </table></div>
          )}
        </div>
      )}

      {seccionActiva === 'usuarios' && (
        <div>
          <h3>👥 Gestión de Módulos por Usuario</h3>
          <p style={{ color: '#64748b', marginBottom: 16 }}>Selecciona qué módulos ve cada colaborador.</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
              <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Nombre</th><th style={{ ...th, color: '#D4D2C6' }}>Email</th><th style={{ ...th, color: '#D4D2C6' }}>Área</th><th style={{ ...th, color: '#D4D2C6' }}>Módulos</th></tr></thead>
              <tbody>{colaboradores.map(function(col) { return (
                <tr key={col.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={td}>{col.full_name || '-'}</td><td style={td}>{col.email}</td><td style={td}>{col.area || '-'}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {MODULOS_DISPONIBLES.map(function(mod) {
                        var modulosVisibles = col.modulos_visibles || ['desempeno','objetivos','compania','feedback','calibracion','pdi','reportes'];
                        return (
                          <label key={mod} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}>
                            <input type="checkbox" checked={modulosVisibles.includes(mod)} onChange={function(e) {
                              var nuevos = e.target.checked ? [...modulosVisibles, mod] : modulosVisibles.filter(function(m) { return m !== mod; });
                              actualizarModulos(col.id, nuevos);
                            }} />{mod}
                          </label>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ); })}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
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

function DashboardView({ stats, colabs }) { return <div><div style={s.grid}><div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>👥 Participantes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{colabs.length}</p></div><div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>📋 Evaluaciones</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.total}</p></div><div style={{ ...s.tarjetaStat, borderTop: '4px solid #231F20' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.enviadas}</p></div><div style={{ ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.pendientes}</p></div></div></div>; }
function ParticipantesView({ colabs }) { return <div style={s.tarjetaStat}><h4>👥 Participantes ({colabs.length})</h4><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Area</th><th style={th}>Seniority</th></tr></thead><tbody>{colabs.map(function(c) { return (<tr key={c.id}><td style={td}>{c.full_name || '-'}</td><td style={td}>{c.email}</td><td style={td}>{c.area || '-'}</td><td style={td}>{c.seniority || '-'}</td></tr>); })}</tbody></table></div>; }
function EvaluacionesAdmin({ cicloId }) {
  var [evs, setEvs] = useState([]);
  var [carg, setCarg] = useState(true);
  
  useEffect(function() {
    (async function() {
      var { data } = await supabase.from('evaluaciones')
        .select('id,colaborador_id,tipo_evaluacion,estado,rating_promedio,rating_calibrado,created_at,colaborador:colaborador_id(email,full_name)')
        .eq('ciclo_id', cicloId)
        .order('created_at', { ascending: false });
      setEvs(data || []);
      setCarg(false);
    })();
  }, [cicloId]);
  
  if (carg) return <p>Cargando...</p>;
  
  return (
    <div style={s.tarjetaStat}>
      <h4>📋 Evaluaciones ({evs.length})</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Colaborador</th>
            <th style={th}>Tipo</th>
            <th style={th}>Estado</th>
            <th style={th}>Rating</th>
            <th style={th}>Calibrado</th>
            <th style={th}>Fecha</th>
          </tr>
        </thead>
        <tbody>
          {evs.map(function(ev) {
            var tipo = ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Lider';
            var fecha = new Date(ev.created_at).toLocaleDateString('es-AR');
            return (
              <tr key={ev.id}>
                <td style={td}>{ev.colaborador?.full_name || '-'}</td>
                <td style={td}>{tipo}</td>
                <td style={td}>{ev.estado}</td>
                <td style={{ ...td, fontWeight: 700 }}>{ev.rating_promedio || '-'}</td>
                <td style={td}>{ev.rating_calibrado || '-'}</td>
                <td style={td}>{fecha}</td>
              </tr>
            );
          })}
        </tbody>
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
  async function guardarCal(evaluacionId, rating, comentario) {
    await supabase.from('evaluaciones').update({ rating_calibrado: rating, comentario_calibracion: comentario }).eq('id', evaluacionId);
    var { data: { session } } = await supabase.auth.getSession();
    var d = datos.find(function(x) { return x.evaluacionLider?.id === evaluacionId; });
    var { data: existente } = await supabase.from('calibracion').select('id').eq('evaluacion_id', evaluacionId).maybeSingle();
    if (existente) {
      await supabase.from('calibracion').update({ rating_calibrado: rating, comentario_calibracion: comentario, fecha: new Date() }).eq('id', existente.id);
    } else {
      await supabase.from('calibracion').insert({ evaluacion_id: evaluacionId, rating_jefe: d ? (d.promLider ? parseFloat(d.promLider) : null) : null, rating_calibrado: rating, comentario_calibracion: comentario, calibrador_id: session.user.id });
    }
    setDatos(function(p) { return p.map(function(d) { return d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating, comentarioCalibracion: comentario } : d; }); });
  }

 function generarPDFCompleto(d) {
    var pdf = new jsPDF();
    var NEGRO = '#231F20';
    var BEIGE = '#D4D2C6';
    var pageWidth = 210;
    var marginX = 15;
    var y = 28;

    function agregarCabecera() {
      try { pdf.addImage('/logo.jpg', 'JPEG', marginX, 8, 30, 15); } catch(e) {}
      pdf.setDrawColor(BEIGE);
      pdf.setLineWidth(0.5);
      pdf.line(marginX, 26, pageWidth - marginX, 26);
    }

    function agregarPie() {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(6);
      pdf.setTextColor('#94a3b8');
      pdf.text('Fabric Group - ' + new Date().toLocaleDateString('es-AR'), marginX, 292);
    }

    function verificarSalto(alturaNecesaria) {
      if (y + alturaNecesaria > 275) {
        agregarPie();
        pdf.addPage();
        agregarCabecera();
        y = 30;
      }
    }

    agregarCabecera();

    // ENCABEZADO GENERAL
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(NEGRO);
    pdf.text('EVALUACION DE DESEMPENO', marginX, y);
    y += 8;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.text('Colaborador: ' + (d.colaborador.full_name || d.colaborador.email), marginX, y); y += 5;
    pdf.text('Email: ' + d.colaborador.email, marginX, y); y += 5;
    pdf.text('Area: ' + (d.colaborador.area || '-') + '   |   Seniority: ' + (d.colaborador.seniority || '-') + '   |   Fecha: ' + new Date().toLocaleDateString('es-AR'), marginX, y);
    y += 10;

    // =============================================
    // SECCION 1: AUTOEVALUACION
    // =============================================
    verificarSalto(20);
    pdf.setFillColor(BEIGE);
    pdf.rect(marginX, y, pageWidth - (marginX * 2), 7, 'F');
    pdf.setTextColor(NEGRO);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text('SECCION 1: AUTOEVALUACION', marginX + 2, y + 5);
    y += 12;

    var autoPunts = {};
    var autoComs = {};
    (d.autoevaluacion?.puntuaciones || []).forEach(function(p) {
      autoPunts[p.competencia_id] = p.rating;
      autoComs[p.competencia_id] = p.comentario || '';
    });

    if (Object.keys(autoPunts).length > 0) {
      // Tabla de competencias
      pdf.setFillColor(NEGRO);
      pdf.rect(marginX, y, pageWidth - (marginX * 2), 6, 'F');
      pdf.setTextColor('#FFFFFF');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6);
      pdf.text('Competencia', marginX + 2, y + 4);
      pdf.text('Rating', 120, y + 4);
      pdf.text('Comentario', 135, y + 4);
      y += 8;
      pdf.setTextColor(NEGRO);

      Object.keys(autoPunts).forEach(function(compId, i) {
        verificarSalto(10);
        var nombre = (d.autoevaluacion?.puntuaciones?.find(function(p) { return p.competencia_id === compId; })?.competencias?.nombre || 'Competencia').substring(0, 22);
        var rating = String(autoPunts[compId] || '-');
        var comentario = autoComs[compId] || '-';

        if (i % 2 === 0) {
          pdf.setFillColor(248, 248, 248);
          pdf.rect(marginX, y - 2, pageWidth - (marginX * 2), 6, 'F');
        }

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.text(nombre, marginX + 2, y);
        pdf.setFont('helvetica', 'bold');
        pdf.text(rating, 120, y);

        // Comentario (truncado si es muy largo)
        var comLines = pdf.splitTextToSize(comentario, 55);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(6);
        pdf.text(comLines[0] || '', 135, y);
        if (comLines.length > 1) {
          y += 3;
          pdf.text(comLines[1] || '', 135, y);
        }
        y += 5;
      });

      y += 3;

      // Comentarios finales autoevaluacion
      if (d.autoevaluacion?.comentarios_finales) {
        verificarSalto(20);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.text('Comentarios Finales:', marginX, y);
        y += 4;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        var finalLines = pdf.splitTextToSize(d.autoevaluacion.comentarios_finales, pageWidth - (marginX * 2));
        finalLines.forEach(function(line) {
          verificarSalto(5);
          pdf.text(line, marginX + 2, y);
          y += 3.5;
        });
      }

      // Rating autoevaluacion
      if (d.promAuto) {
        verificarSalto(10);
        y += 2;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        var clasifAuto = clasificarRating(parseFloat(d.promAuto));
        pdf.setTextColor(clasifAuto.color);
        pdf.text('Rating Final Autoevaluacion: ' + d.promAuto + ' - ' + clasifAuto.texto, marginX, y);
        pdf.setTextColor(NEGRO);
      }
    }
    y += 8;

    // =============================================
    // SECCION 2: EVALUACION DEL LIDER
    // =============================================
    if (d.evaluacionLider) {
      verificarSalto(20);
      pdf.setFillColor(BEIGE);
      pdf.rect(marginX, y, pageWidth - (marginX * 2), 7, 'F');
      pdf.setTextColor(NEGRO);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.text('SECCION 2: EVALUACION DEL LIDER', marginX + 2, y + 5);
      y += 12;

      var liderPunts = {};
      var liderComs = {};
      (d.evaluacionLider?.puntuaciones || []).forEach(function(p) {
        liderPunts[p.competencia_id] = p.rating;
        liderComs[p.competencia_id] = p.comentario || '';
      });

      if (Object.keys(liderPunts).length > 0) {
        pdf.setFillColor(NEGRO);
        pdf.rect(marginX, y, pageWidth - (marginX * 2), 6, 'F');
        pdf.setTextColor('#FFFFFF');
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(6);
        pdf.text('Competencia', marginX + 2, y + 4);
        pdf.text('Rating', 120, y + 4);
        pdf.text('Comentario', 135, y + 4);
        y += 8;
        pdf.setTextColor(NEGRO);

        Object.keys(liderPunts).forEach(function(compId, i) {
          verificarSalto(10);
          var nombre = (d.evaluacionLider?.puntuaciones?.find(function(p) { return p.competencia_id === compId; })?.competencias?.nombre || 'Competencia').substring(0, 22);
          var rating = String(liderPunts[compId] || '-');
          var comentario = liderComs[compId] || '-';

          if (i % 2 === 0) {
            pdf.setFillColor(248, 248, 248);
            pdf.rect(marginX, y - 2, pageWidth - (marginX * 2), 6, 'F');
          }

          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          pdf.text(nombre, marginX + 2, y);
          pdf.setFont('helvetica', 'bold');
          pdf.text(rating, 120, y);

          var comLines = pdf.splitTextToSize(comentario, 55);
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(6);
          pdf.text(comLines[0] || '', 135, y);
          if (comLines.length > 1) {
            y += 3;
            pdf.text(comLines[1] || '', 135, y);
          }
          y += 5;
        });

        y += 3;

        if (d.evaluacionLider?.comentarios_finales) {
          verificarSalto(20);
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(8);
          pdf.text('Comentarios Finales del Lider:', marginX, y);
          y += 4;
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(7);
          var finalLines = pdf.splitTextToSize(d.evaluacionLider.comentarios_finales, pageWidth - (marginX * 2));
          finalLines.forEach(function(line) {
            verificarSalto(5);
            pdf.text(line, marginX + 2, y);
            y += 3.5;
          });
        }

        if (d.promLider) {
          verificarSalto(10);
          y += 2;
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          var clasifLider = clasificarRating(parseFloat(d.promLider));
          pdf.setTextColor(clasifLider.color);
          pdf.text('Rating Final Lider: ' + d.promLider + ' - ' + clasifLider.texto, marginX, y);
          pdf.setTextColor(NEGRO);
        }
      }
    }
    y += 8;

    // =============================================
    // SECCION 3: CALIBRACION
    // =============================================
    if (d.ratingFinal) {
      verificarSalto(30);
      y += 4;
      pdf.setFillColor(NEGRO);
      pdf.rect(marginX, y, pageWidth - (marginX * 2), 24, 'F');
      pdf.setTextColor('#FFFFFF');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(12);
      pdf.text('RESULTADO FINAL CALIBRADO', marginX + 4, y + 10);
      pdf.setFontSize(18);
      var clasifCal = clasificarRating(parseFloat(d.ratingFinal));
      pdf.setTextColor(clasifCal.color);
      pdf.text(String(d.ratingFinal) + ' - ' + clasifCal.texto, marginX + 4, y + 20);
      pdf.setTextColor('#FFFFFF');

      if (d.comentarioCalibracion) {
        y += 30;
        verificarSalto(10);
        pdf.setTextColor(NEGRO);
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Justificacion de Calibracion:', marginX, y);
        y += 4;
        pdf.setFont('helvetica', 'normal');
        pdf.text(d.comentarioCalibracion, marginX, y);
      }
    }

    agregarPie();
    return pdf;
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
                      <select value={d.ratingFinal || d.promLider || ''} onChange={function(e) { guardarCal(d.evaluacionLider.id, parseFloat(e.target.value), d.comentarioCalibracion || ''); }} style={{ padding: '6px 10px', borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14, fontWeight: 600, background: 'white' }}>
                        <option value="">Seleccionar</option>
                        <option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option>
                      </select>
                    ) : <span style={{ fontWeight: 700 }}>{d.ratingFinal || '-'}</span>}
                  </td>
                  <td style={{ ...td, minWidth: 150 }}>
                    {d.evaluacionLider && !soloLectura ? (
                      <input type="text" value={d.comentarioCalibracion || ''} onChange={function(e) { guardarCal(d.evaluacionLider.id, d.ratingFinal || d.promLider || null, e.target.value); }} placeholder="Justificar calibracion..." style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid #D4D2C6', fontSize: 12 }} />
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
  var [competencias, setComp] = useState([]);
  var [ratings, setRatings] = useState({});
  var [comentarios, setComent] = useState({});
  var [comFin, setComFin] = useState('');
  var [msg, setMsg] = useState('');
  var [carg, setCarg] = useState(true);
  var [autoEval, setAutoEval] = useState(null);
  var [evalData, setEvalData] = useState(null);
  var [showInfo, setShowInfo] = useState({});

useEffect(function() {
    async function cargarDatos() {
      try {
        var { data: comps, error: errorComps } = await supabase
          .from('competencias')
          .select('id, nombre, descripcion')
          .eq('aplica_a', colaborador.seniority || 'Analista');
        
        if (errorComps) { console.error(errorComps); setCarg(false); return; }
        setComp(comps || []);

        var { data: { session } } = await supabase.auth.getSession();
        if (!session) { setCarg(false); return; }

        // Cargar autoevaluacion
        var { data: ae } = await supabase
          .from('evaluaciones')
          .select('id, estado, rating_promedio, comentarios_finales')
          .eq('colaborador_id', colaborador.id)
          .eq('tipo_evaluacion', 'autoevaluacion')
          .eq('ciclo_id', cicloId)
          .maybeSingle();

        if (ae) {
          var { data: p } = await supabase
            .from('puntuaciones')
            .select('id, rating, comentario, competencia_id, competencias(nombre)')
            .eq('evaluacion_id', ae.id);
          setAutoEval({ ...ae, puntuaciones: p || [] });
        }

        // Cargar o crear evaluacion del lider
        var { data: liderEval } = await supabase
          .from('evaluaciones')
          .select('id, estado, comentarios_finales, rating_promedio')
          .eq('colaborador_id', colaborador.id)
          .eq('tipo_evaluacion', 'evaluacion_lider')
          .eq('ciclo_id', cicloId)
          .maybeSingle();

        if (liderEval) {
          setEvalData(liderEval);
          setComFin(liderEval.comentarios_finales || '');
          
          var { data: punts } = await supabase
            .from('puntuaciones')
            .select('rating, competencia_id, comentario')
            .eq('evaluacion_id', liderEval.id);
          
          var rm = {};
          var cm = {};
          (punts || []).forEach(function(p) { 
            rm[p.competencia_id] = p.rating; 
            cm[p.competencia_id] = p.comentario || ''; 
          });
          setRatings(rm);
          setComent(cm);
        } else if (!soloLectura) {
          var { data: nueva } = await supabase
            .from('evaluaciones')
            .insert({
              colaborador_id: colaborador.id,
              evaluador_id: session.user.id,
              tipo_evaluacion: 'evaluacion_lider',
              estado: 'borrador',
              ciclo_id: cicloId
            })
            .select()
            .single();
          if (nueva) setEvalData(nueva);
        }
      } catch(err) {
        console.error('Error cargando datos:', err);
      }
      setCarg(false);
    }
    cargarDatos();
     
  async function guardar() {
    if (soloLectura || enviada) return;
    
    // Validar comentarios obligatorios por competencia
    var falt = competencias.filter(function(c) { return !comentarios[c.id]?.trim(); });
    if (falt.length > 0) {
      setMsg('❌ Completa el comentario de: ' + falt.map(function(c) { return c.nombre; }).join(', '));
      setTimeout(function() { setMsg(''); }, 4000);
      return;
    }
    
    // Validar comentarios finales
    if (!comFin?.trim()) {
      setMsg('❌ Los comentarios finales son obligatorios');
      setTimeout(function() { setMsg(''); }, 4000);
      return;
    }

    var { data: ev } = await supabase.from('evaluaciones')
      .select('id')
      .eq('colaborador_id', colaborador.id)
      .eq('tipo_evaluacion', 'evaluacion_lider')
      .eq('ciclo_id', cicloId)
      .single();
    if (!ev) return;

    var vals = Object.values(ratings).filter(function(r) { return r > 0; });
    var prom = vals.length > 0 ? parseFloat((vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1)) : null;
    var clasif = clasificarRating(prom ? parseFloat(prom) : 0);

    await supabase.from('evaluaciones').update({
      comentarios_finales: comFin,
      rating_promedio: prom,
      rating_final: prom,
      clasificacion: clasif.texto
    }).eq('id', ev.id);

    for (var [cid, r] of Object.entries(ratings)) {
      await supabase.from('puntuaciones').upsert({
        evaluacion_id: ev.id,
        competencia_id: cid,
        rating: r,
        comentario: comentarios[cid] || ''
      }, { onConflict: 'evaluacion_id, competencia_id' });
    }
    setMsg('✅ Guardado');
    setTimeout(function() { setMsg(''); }, 2500);
  }

  async function enviar() {
    if (soloLectura || enviada) return;
    
    // Validar que todas las competencias tengan rating
    var sinRating = competencias.filter(function(c) { return !ratings[c.id] || ratings[c.id] <= 0; });
    if (sinRating.length > 0) {
      setMsg('❌ Debes calificar todas las competencias. Falta: ' + sinRating.map(function(c) { return c.nombre; }).join(', '));
      setTimeout(function() { setMsg(''); }, 4000);
      return;
    }
    
    // Validar comentarios obligatorios por competencia
    var falt = competencias.filter(function(c) { return !comentarios[c.id]?.trim(); });
    if (falt.length > 0) {
      setMsg('❌ Completa el comentario de: ' + falt.map(function(c) { return c.nombre; }).join(', '));
      setTimeout(function() { setMsg(''); }, 4000);
      return;
    }
    
    // Validar comentarios finales
    if (!comFin?.trim()) {
      setMsg('❌ Los comentarios finales son obligatorios');
      setTimeout(function() { setMsg(''); }, 4000);
      return;
    }

    await guardar();
    var { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single();
    if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id);
    setEvalData(function(p) { return { ...p, estado: 'enviado' }; });
    setMsg('🎉 Evaluacion enviada correctamente');
    setTimeout(function() { setMsg(''); }, 3000);
  }
  var calcProm = function() {
    var v = Object.values(ratings).filter(function(r) { return r > 0; });
    return v.length > 0 ? (v.reduce(function(a, b) { return a + b; }, 0) / v.length).toFixed(1) : null;
  };

  if (carg) return <p style={{ padding: 20 }}>Cargando...</p>;

  var enviada = evalData?.estado === 'enviado';
  var prom = calcProm();
  var clasif = clasificarRating(prom ? parseFloat(prom) : 0);

  // Mapa de autoevaluacion para acceso rapido
  var autoRatings = {};
  var autoComentarios = {};
  (autoEval?.puntuaciones || []).forEach(function(p) {
    autoRatings[p.competencia_id] = p.rating;
    autoComentarios[p.competencia_id] = p.comentario || '';
  });

  return (
    <div style={{ maxWidth: 900 }}>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver al equipo</button>
      
      <h3 style={{ color: '#231F20' }}>📝 Evaluando a: {colaborador.full_name || colaborador.email}</h3>
      <p style={{ color: '#64748b', marginBottom: 4 }}>{colaborador.area} · {colaborador.seniority}</p>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Estado: <strong style={{ color: enviada ? '#22c55e' : '#f59e0b' }}>{enviada ? '✅ Enviada (no editable)' : '📝 En progreso'}</strong>
      </p>

      {/* Mostrar autoevaluacion completa si ya fue enviada */}
      {autoEval?.estado === 'enviado' && <DetalleAutoEvaluacion autoevaluacion={autoEval} />}

      {competencias.map(function(comp) {
        var autoRating = autoRatings[comp.id];
        var autoComentario = autoComentarios[comp.id];
        var gap = autoRating && ratings[comp.id] ? ratings[comp.id] - autoRating : null;

        return (
          <div key={comp.id} style={s.competenciaCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h5 style={{ margin: 0, color: '#231F20' }}>{comp.nombre}</h5>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0' }}>{comp.descripcion}</p>
              </div>
              <button onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }} style={s.btnInfo}>
                {showInfo[comp.id] ? '🔼 Ocultar info' : '🔽 Ver info'}
              </button>
            </div>

            {/* Bloque de autoevaluacion del colaborador */}
            {autoEval?.estado === 'enviado' && (
              <div style={{ marginBottom: 12, padding: 12, background: '#D4D2C6', borderRadius: 8, border: '1px solid #cbd5e1' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#231F20' }}>
                    📝 Autoevaluacion: <span style={{ fontSize: 16, fontWeight: 700 }}>{autoRating || '-'}</span>
                  </span>
                  {gap !== null && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: gap > 0 ? '#22c55e' : gap < 0 ? '#dc2626' : '#64748b' }}>
                      {gap > 0 ? '↑' : gap < 0 ? '↓' : '='} Tu eval vs Auto: {gap > 0 ? '+' : ''}{gap}
                    </span>
                  )}
                </div>
                {autoComentario && (
                  <div style={{ marginTop: 6, padding: '6px 8px', background: 'white', borderRadius: 4, fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
                    "{autoComentario}"
                  </div>
                )}
              </div>
            )}

            {/* Selector de rating del líder */}
            <div style={s.ratingRow}>
              <span style={{ fontSize: 12, color: '#64748b', marginRight: 4 }}>Tu eval:</span>
              {[1, 2, 3, 4, 5].map(function(r) {
                return (
                  <button key={r} onClick={function() { if (!enviada && !soloLectura) setRatings({ ...ratings, [comp.id]: r }); }}
                    style={{
                      ...s.ratingBtn,
                      backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9',
                      color: ratings[comp.id] === r ? 'white' : '#475569',
                      border: ratings[comp.id] === r ? '2px solid #231F20' : '2px solid #e2e8f0',
                      cursor: enviada || soloLectura ? 'not-allowed' : 'pointer',
                      opacity: enviada || soloLectura ? 0.7 : 1
                    }}
                    disabled={enviada || soloLectura}
                  >
                    {r}
                  </button>
                );
              })}
              {ratings[comp.id] && (
                <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 600, color: '#231F20' }}>Nivel {ratings[comp.id]}</span>
              )}
            </div>

            {/* Ver info de ratings */}
            {showInfo[comp.id] && (
              <div style={s.ratingInfoBox}>
                {[1, 2, 3, 4, 5].map(function(r) {
                  return (
                    <div key={r} style={{
                      ...s.ratingInfoItem,
                      borderLeft: '4px solid ' + (ratings[comp.id] === r ? '#231F20' : '#e2e8f0'),
                      backgroundColor: ratings[comp.id] === r ? '#f8fafc' : 'white',
                      fontWeight: ratings[comp.id] === r ? '600' : '400'
                    }}>
                      <strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Comentario del líder */}
            <textarea
              value={comentarios[comp.id] || ''}
              onChange={function(e) { if (!enviada && !soloLectura) setComent({ ...comentarios, [comp.id]: e.target.value }); }}
              placeholder="Tu comentario como líder (obligatorio)"
              style={{
                ...s.textareaSmall,
                borderColor: enviada || soloLectura ? '#D4D2C6' : (comentarios[comp.id]?.trim() ? '#D4D2C6' : '#dc2626'),
                backgroundColor: enviada || soloLectura ? '#f8fafc' : 'white',
                cursor: enviada || soloLectura ? 'not-allowed' : 'text'
              }}
              readOnly={enviada || soloLectura}
            />
          </div>
        );
      })}

      <SeccionText 
        titulo="📝 Comentarios Finales (obligatorio)" 
        valor={comFin} 
        onChange={enviada || soloLectura ? function() {} : setComFin} 
        disabled={enviada || soloLectura} 
      />

      {prom && (
        <div style={{ marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: '2px solid ' + clasif.color, textAlign: 'center' }}>
          <p style={{ color: '#64748b', margin: 0, fontSize: 14 }}>Resultado Final</p>
          <p style={{ fontSize: 48, fontWeight: 700, color: clasif.color, margin: '8px 0' }}>{prom}</p>
          <p style={{ fontSize: 18, fontWeight: 600, color: clasif.color, margin: 0 }}>{clasif.texto}</p>
          <p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
            Basado en {Object.values(ratings).filter(function(r) { return r > 0; }).length} de {competencias.length} competencias evaluadas
          </p>
        </div>
      )}

      {msg && <div style={s.mensajeToast}>{msg}</div>}

      {!enviada && !soloLectura && (
        <div style={{ display: 'flex', gap: 12, marginTop: 20, marginBottom: 40 }}>
          <button onClick={guardar} style={s.btnSecundario}>💾 Guardar Borrador</button>
          <button onClick={enviar} style={s.btnPrimario}>📤 Enviar Evaluacion</button>
        </div>
      )}

      {enviada && (
        <div style={{ ...s.bannerEnviado, marginTop: 20 }}>✅ Tu evaluacion como lider ha sido enviada y no puede modificarse.</div>
      )}
    </div>
  );
}

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
        supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(),
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
        var rm = {};
        var cm = {};
        (punts || []).forEach(function(p) { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; });
        setRatings(rm);
        setComent(cm);
      } else if (!soloLectura) {
        await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador', ciclo_id: cicloId });
      }
      setCarg(false);
    })();
  }, []);

  async function guardar() {
    if (soloLectura || enviada) return;
    var falt = competencias.filter(function(c) { return !comentarios[c.id]?.trim(); });
    if (falt.length > 0) {
      setMsg('❌ Completa el comentario de: ' + falt.map(function(c) { return c.nombre; }).join(', '));
      setTimeout(function() { setMsg(''); }, 4000);
      return;
    }
    if (!comFin?.trim()) {
      setMsg('❌ Los comentarios finales son obligatorios');
      setTimeout(function() { setMsg(''); }, 4000);
      return;
    }
    var { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single();
    if (!ev) return;
    var vals = Object.values(ratings).filter(function(r) { return r > 0; });
    var prom = vals.length > 0 ? parseFloat((vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1)) : null;
    var clasif = clasificarRating(prom ? parseFloat(prom) : 0);
    await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom, rating_final: prom, clasificacion: clasif.texto }).eq('id', ev.id);
    for (var [cid, r] of Object.entries(ratings)) {
      await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' });
    }
    setMsg('✅ Guardado');
    setTimeout(function() { setMsg(''); }, 2500);
  }

  async function enviar() {
    if (soloLectura || enviada) return;
    await guardar();
    var { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single();
    if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id);
    setEvalData(function(p) { return { ...p, estado: 'enviado' }; });
    setMsg('🎉 Evaluacion enviada correctamente');
    setTimeout(function() { setMsg(''); }, 3000);
  }

  var calcProm = function() {
    var v = Object.values(ratings).filter(function(r) { return r > 0; });
    return v.length > 0 ? (v.reduce(function(a, b) { return a + b; }, 0) / v.length).toFixed(1) : null;
  };

  if (carg) return <p style={{ padding: 20 }}>Cargando competencias...</p>;

  var enviada = evalData?.estado === 'enviado';
  var prom = calcProm();
  var clasif = clasificarRating(prom ? parseFloat(prom) : 0);

  return (
    <div style={{ maxWidth: 900 }}>
      <h3 style={{ color: '#231F20' }}>📝 Mi Autoevaluacion</h3>
      <p style={{ color: '#64748b', marginBottom: 4 }}>Seniority: <strong>{seniority || 'No definido'}</strong></p>
      <p style={{ color: '#64748b', marginBottom: 24 }}>
        Estado: <strong style={{ color: enviada ? '#22c55e' : '#f59e0b' }}>{enviada ? '✅ Enviada (no editable)' : '📝 En progreso'}</strong>
      </p>

      {feedback && (
        <div style={{ padding: 16, background: feedback.confirmacion_colaborador ? '#dcfce7' : '#fef3c7', borderRadius: 10, marginBottom: 20 }}>
          <h4>💬 Feedback de tu Lider</h4>
          <p style={{ color: '#475569', fontStyle: 'italic' }}>{feedback.comentario_lider || 'Sin comentarios aun.'}</p>
        </div>
      )}

      {evalLider?.rating_calibrado && (
        <div style={{ padding: 16, background: '#D4D2C6', borderRadius: 10, marginBottom: 20, textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: 14 }}>🎯 Resultado Final Calibrado</p>
          <p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{evalLider.rating_calibrado}</p>
          {evalLider.comentario_calibracion && <p style={{ color: '#475569', fontSize: 13, marginTop: 8 }}>"{evalLider.comentario_calibracion}"</p>}
        </div>
      )}

      {competencias.length === 0 && <p style={{ color: '#f59e0b' }}>No hay competencias configuradas para tu seniority.</p>}

      {competencias.map(function(comp) {
        return (
          <div key={comp.id} style={s.competenciaCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h5 style={{ margin: 0, color: '#231F20' }}>{comp.nombre}</h5>
                <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0' }}>{comp.descripcion}</p>
                <span style={{ ...s.tipoBadge, marginTop: 4, display: 'inline-block' }}>{comp.tipo === 'generica' ? '🌐 Generica' : '🎯 Especifica'}</span>
              </div>
              <button onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }} style={s.btnInfo}>
                {showInfo[comp.id] ? '🔼 Ocultar info' : '🔽 Ver info'}
              </button>
            </div>

            <div style={s.ratingRow}>
              {[1, 2, 3, 4, 5].map(function(r) {
                return (
                  <button key={r} onClick={function() { if (!enviada && !soloLectura) setRatings({ ...ratings, [comp.id]: r }); }}
                    style={{
                      ...s.ratingBtn,
                      backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9',
                      color: ratings[comp.id] === r ? 'white' : '#475569',
                      border: ratings[comp.id] === r ? '2px solid #231F20' : '2px solid #e2e8f0',
                      cursor: enviada || soloLectura ? 'not-allowed' : 'pointer',
                      opacity: enviada || soloLectura ? 0.7 : 1
                    }}
                    disabled={enviada || soloLectura}
                  >
                    {r}
                  </button>
                );
              })}
              {ratings[comp.id] && (
                <span style={{ marginLeft: 8, fontSize: 14, fontWeight: 600, color: '#231F20' }}>Nivel {ratings[comp.id]}</span>
              )}
            </div>

            {showInfo[comp.id] && (
              <div style={s.ratingInfoBox}>
                {[1, 2, 3, 4, 5].map(function(r) {
                  return (
                    <div key={r} style={{
                      ...s.ratingInfoItem,
                      borderLeft: '4px solid ' + (ratings[comp.id] === r ? '#231F20' : '#e2e8f0'),
                      backgroundColor: ratings[comp.id] === r ? '#f8fafc' : 'white',
                      fontWeight: ratings[comp.id] === r ? '600' : '400'
                    }}>
                      <strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} />
                    </div>
                  );
                })}
              </div>
            )}

            <textarea
              value={comentarios[comp.id] || ''}
              onChange={function(e) { if (!enviada && !soloLectura) setComent({ ...comentarios, [comp.id]: e.target.value }); }}
              placeholder="Comentario obligatorio"
              style={{
                ...s.textareaSmall,
                borderColor: enviada || soloLectura ? '#D4D2C6' : (comentarios[comp.id]?.trim() ? '#D4D2C6' : '#dc2626'),
                backgroundColor: enviada || soloLectura ? '#f8fafc' : 'white',
                cursor: enviada || soloLectura ? 'not-allowed' : 'text'
              }}
              readOnly={enviada || soloLectura}
            />
          </div>
        );
      })}

<div style={{ marginBottom: 24 }}>
        <h4 style={s.seccionTitulo}>📝 Comentarios Finales (obligatorio)</h4>
        {enviada || soloLectura ? (
          <p style={{ color: '#475569', padding: 12, background: '#f8fafc', borderRadius: 8 }}>{comFin || 'Sin comentarios.'}</p>
        ) : (
          <textarea 
            value={comFin} 
            onInput={function(e) { setComFin(e.target.value); }} 
            style={{ ...s.textarea, borderColor: comFin?.trim() ? '#D4D2C6' : '#dc2626' }} 
            placeholder="Escribe tus comentarios finales..."
          />
        )}
      </div>

      {msg && <div style={s.mensajeToast}>{msg}</div>}

      {!enviada && !soloLectura && (
        <div style={{ display: 'flex', gap: 12, marginTop: 20, marginBottom: 40 }}>
          <button onClick={guardar} style={s.btnSecundario}>💾 Guardar Borrador</button>
          <button onClick={enviar} style={s.btnPrimario}>📤 Enviar Evaluacion</button>
        </div>
      )}

      {enviada && (
        <div style={{ ...s.bannerEnviado, marginTop: 20 }}>✅ Tu evaluacion ha sido enviada y no puede modificarse.</div>
      )}
    </div>
  );
}
function DetalleAutoEvaluacion({ autoevaluacion }) {
  if (!autoevaluacion) return <p style={{ padding: 16, color: '#94a3b8' }}>Sin autoevaluacion.</p>;
  var puntuaciones = autoevaluacion.puntuaciones || [];
  return (
    <div style={{ marginTop: 16, background: 'white', borderRadius: 12, border: '2px solid #D4D2C6', overflow: 'hidden' }}>
      <div style={{ background: '#231F20', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h4 style={{ margin: 0, color: '#D4D2C6', fontSize: 16 }}>📝 Autoevaluacion Completa</h4>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ color: '#D4D2C6', fontSize: 13 }}>{autoevaluacion.estado === 'enviado' ? '✅ Enviada' : '📝 Borrador'}</span>
          <span style={{ background: '#D4D2C6', color: '#231F20', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 20 }}>{autoevaluacion.rating_promedio || '-'}</span>
        </div>
      </div>
      <div style={{ padding: 20 }}>
        {autoevaluacion.comentarios_finales && <div style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8 }}><strong>💬 Comentarios Finales:</strong><p style={{ color: '#475569', fontSize: 14, marginTop: 4 }}>{autoevaluacion.comentarios_finales}</p></div>}
        <h5>📊 Calificacion por Competencia</h5>
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

function ObjetivosView({ profile }) {
  var esGerente = profile.seniority === 'Gerente' || profile.role === 'admin_rrhh' || profile.role === 'lider';
  if (esGerente) return <ObjetivosGerente profile={profile} />;
  return <ObjetivosColaborador profile={profile} />;
}

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
  var [detalleVisible, setDetalleVisible] = useState(null);
  useEffect(function() { cargarObjetivos(); }, []);
  async function cargarObjetivos() { var { data } = await supabase.from('objetivos').select('*').eq('colaborador_id', colaborador.id).order('created_at', { ascending: false }); setObjetivos(data || []); setCargando(false); }
  
  async function ejecutarValidacion() {
    if (!accionValidar) return alert('Selecciona una accion');
    if (!comentarioLider.trim()) return alert('El comentario es obligatorio');
    var nuevoStatus = accionValidar === 'aprobar' ? 'validado' : 'pendiente';
    await supabase.from('objetivos').update({ status: nuevoStatus, validado_por_gerente: accionValidar === 'aprobar', comentario_lider: comentarioLider, fecha_validacion: new Date() }).eq('id', modalValidar);
    setModalValidar(null); setAccionValidar(''); setComentarioLider(''); cargarObjetivos();
  }

  if (cargando) return <p>Cargando objetivos...</p>;
  if (detalleVisible) return <ObjetivoDetalle objetivo={detalleVisible} onVolver={function() { setDetalleVisible(null); }} esLider={true} />;

  return (
    <div>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver al equipo</button>
      <div><h2 style={{ color: '#231F20', margin: 0 }}>🎯 Objetivos de {colaborador.full_name || colaborador.email}</h2><p style={{ color: '#64748b', margin: '4px 0' }}>{colaborador.area} · {colaborador.seniority}</p></div>
      
      {modalValidar && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setModalValidar(null); }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 500, width: '90%' }} onClick={function(e) { e.stopPropagation(); }}>
            <h3 style={{ marginTop: 0 }}>📋 Validar Objetivo</h3>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Accion *</label><select value={accionValidar} onChange={function(e) { setAccionValidar(e.target.value); }} style={{ width: '100%', padding: 10, borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14 }}><option value="">Seleccionar...</option><option value="aprobar">✅ Aprobar</option><option value="rechazar">❌ Rechazar</option></select></div>
            <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Comentario *</label><textarea value={comentarioLider} onChange={function(e) { setComentarioLider(e.target.value); }} placeholder="Explica tu decision..." style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} /></div>
            <div style={{ display: 'flex', gap: 12 }}><button onClick={ejecutarValidacion} style={{ ...s.btnPrimario, background: accionValidar === 'aprobar' ? '#22c55e' : '#dc2626', flex: 1 }}>Confirmar</button><button onClick={function() { setModalValidar(null); }} style={{ ...s.btnSecundario }}>Cancelar</button></div>
          </div>
        </div>
      )}

      {objetivos.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Sin objetivos cargados.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
            <thead><tr style={{ background: '#231F20' }}>
              <th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Corp.</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th>
              <th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Alcance</th><th style={{ ...th, color: '#D4D2C6' }}>Justif. Colab.</th>
              <th style={{ ...th, color: '#D4D2C6' }}>Coment. Lider</th><th style={{ ...th, color: '#D4D2C6' }}>Detalle</th><th style={{ ...th, color: '#D4D2C6' }}>Accion</th>
            </tr></thead>
            <tbody>{objetivos.map(function(obj) { return (
              <tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}>{obj.objetivo}</td><td style={td}>{obj.corporativo || '-'}</td><td style={{ ...td, fontWeight: 700, textAlign: 'center' }}>{obj.ponderacion}%</td>
                <td style={td}><span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : obj.status === 'aceptado' ? '#fef3c7' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : obj.status === 'aceptado' ? '#92400e' : '#64748b' }}>{obj.status}</span></td>
                <td style={td}>{obj.alcance_completado || '-'}</td>
                <td style={td}>{obj.justificacion_completado ? '"' + obj.justificacion_completado.substring(0, 30) + '..."' : '-'}</td>
                <td style={td}>{obj.comentario_lider ? '"' + obj.comentario_lider.substring(0, 30) + '..."' : '-'}</td>
                <td style={td}><button onClick={function() { setDetalleVisible(obj); }} style={{ ...s.btnInfo, background: '#dbeafe', color: '#1e40af', fontSize: 11 }}>📋</button></td>
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
  var [nuevoObjetivo, setNuevoObjetivo] = useState({ objetivo: '', corporativo: '', ponderacion: 25 });
  var [detalleVisible, setDetalleVisible] = useState(null);
  
  useEffect(function() { cargarObjetivos(); }, []);
  async function cargarObjetivos() { var { data } = await supabase.from('objetivos').select('*').eq('colaborador_id', profile.id).order('created_at', { ascending: false }); setObjetivos(data || []); setCargando(false); }
  
  async function guardarObjetivo() {
    if (!nuevoObjetivo.objetivo) return alert('El objetivo es obligatorio');
    if (editandoId) { await supabase.from('objetivos').update({ objetivo: nuevoObjetivo.objetivo, corporativo: nuevoObjetivo.corporativo, ponderacion: nuevoObjetivo.ponderacion, editado_por_colaborador: true, fecha_edicion: new Date() }).eq('id', editandoId); }
    else { var { data: { session } } = await supabase.auth.getSession(); await supabase.from('objetivos').insert({ gerente_id: null, colaborador_id: profile.id, objetivo: nuevoObjetivo.objetivo, corporativo: nuevoObjetivo.corporativo, ponderacion: nuevoObjetivo.ponderacion, status: 'pendiente' }); }
    setNuevoObjetivo({ objetivo: '', corporativo: '', ponderacion: 25 }); setMostrarForm(false); setEditandoId(null); cargarObjetivos();
  }

  function editarObjetivo(obj) { setNuevoObjetivo({ objetivo: obj.objetivo, corporativo: obj.corporativo || '', ponderacion: obj.ponderacion }); setEditandoId(obj.id); setMostrarForm(true); }
  async function aceptarObjetivo(objId) { await supabase.from('objetivos').update({ status: 'aceptado', confirmado_colaborador: true, fecha_confirmacion: new Date() }).eq('id', objId); cargarObjetivos(); }
  async function completarObjetivo() { if (!alcanceCompletar) return alert('Selecciona un alcance'); if (!justificacionCompletar.trim()) return alert('La justificacion es obligatoria'); await supabase.from('objetivos').update({ status: 'completado', completado_por_colaborador: true, fecha_completado: new Date(), alcance_completado: alcanceCompletar, justificacion_completado: justificacionCompletar }).eq('id', modalCompletar); setModalCompletar(null); setAlcanceCompletar(''); setJustificacionCompletar(''); cargarObjetivos(); }

  if (cargando) return <p>Cargando objetivos...</p>;
  if (detalleVisible) return <ObjetivoDetalle objetivo={detalleVisible} onVolver={function() { setDetalleVisible(null); }} esLider={false} />;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ color: '#231F20', margin: 0 }}>🎯 Mis Objetivos</h2>
        <button onClick={function() { setMostrarForm(!mostrarForm); setEditandoId(null); setNuevoObjetivo({ objetivo: '', corporativo: '', ponderacion: 25 }); }} style={s.btnPrimario}>{mostrarForm ? 'Cancelar' : '+ Nuevo Objetivo'}</button>
      </div>

      {mostrarForm && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <h4>{editandoId ? 'Editar Objetivo' : 'Nuevo Objetivo'}</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={{ fontSize: 12 }}>Objetivo *</label><input value={nuevoObjetivo.objetivo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, objetivo: e.target.value}); }} placeholder="Describir el objetivo..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Corporativo</label><input value={nuevoObjetivo.corporativo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, corporativo: e.target.value}); }} placeholder="Ej: Ventas" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Ponderacion (%)</label><select value={nuevoObjetivo.ponderacion} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, ponderacion: parseFloat(e.target.value)}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option><option value="50">50%</option></select></div>
          </div>
          <button onClick={guardarObjetivo} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 12 }}>💾 {editandoId ? 'Actualizar' : 'Guardar'} Objetivo</button>
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
            <thead><tr style={{ background: '#231F20' }}>
              <th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Corp.</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th>
              <th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Mi Alcance</th><th style={{ ...th, color: '#D4D2C6' }}>Coment. Lider</th><th style={{ ...th, color: '#D4D2C6' }}>Detalle</th><th style={{ ...th, color: '#D4D2C6' }}>Accion</th>
            </tr></thead>
            <tbody>{objetivos.map(function(obj) { return (
              <tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}>{obj.objetivo} {obj.editado_por_colaborador && <span style={{ fontSize: 10, color: '#f59e0b' }}>(editado)</span>}</td>
                <td style={td}>{obj.corporativo || '-'}</td><td style={{ ...td, fontWeight: 700, textAlign: 'center' }}>{obj.ponderacion}%</td>
                <td style={td}><span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : obj.status === 'aceptado' ? '#fef3c7' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : obj.status === 'aceptado' ? '#92400e' : '#64748b' }}>{obj.status}</span></td>
                <td style={td}>{obj.alcance_completado || '-'}</td>
                <td style={td}>{obj.comentario_lider ? '"' + obj.comentario_lider.substring(0, 30) + '..."' : '-'}</td>
                <td style={td}><button onClick={function() { setDetalleVisible(obj); }} style={{ ...s.btnInfo, background: '#dbeafe', color: '#1e40af', fontSize: 11 }}>📋</button></td>
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

function ObjetivoDetalle({ objetivo, onVolver, esLider }) {
  var [detalle, setDetalle] = useState(null);
  var [cargando, setCargando] = useState(true);
  var [form, setForm] = useState({ nivel_80: '', comentario_80: '', nivel_100: '', comentario_100: '', nivel_120: '', comentario_120: '', comentario_colaborador: '' });
  var [validacion, setValidacion] = useState({ validacion_lider: '', comentario_lider: '' });

  useEffect(function() { cargarDetalle(); }, []);

  async function cargarDetalle() {
    var { data } = await supabase.from('objetivos_detalle').select('*').eq('objetivo_id', objetivo.id).maybeSingle();
    if (data) {
      setDetalle(data);
      setForm({ nivel_80: data.nivel_80_alcanzado || '', comentario_80: data.comentario_80 || '', nivel_100: data.nivel_100_alcanzado || '', comentario_100: data.comentario_100 || '', nivel_120: data.nivel_120_alcanzado || '', comentario_120: data.comentario_120 || '', comentario_colaborador: data.comentario_colaborador || '' });
      setValidacion({ validacion_lider: data.validacion_lider || '', comentario_lider: data.comentario_lider || '' });
    }
    setCargando(false);
  }

  async function guardarColaborador() {
    if (!form.comentario_colaborador.trim()) return alert('El comentario general es obligatorio');
    if (detalle?.id) { await supabase.from('objetivos_detalle').update({ ...form, fecha_colaborador: new Date() }).eq('id', detalle.id); }
    else { await supabase.from('objetivos_detalle').insert({ objetivo_id: objetivo.id, ...form, fecha_colaborador: new Date() }); }
    alert('✅ Guardado'); cargarDetalle();
  }

  async function guardarLider() {
    if (!validacion.validacion_lider) return alert('Selecciona la validacion');
    if (!validacion.comentario_lider.trim()) return alert('El comentario es obligatorio');
    await supabase.from('objetivos_detalle').update({ ...validacion, fecha_lider: new Date() }).eq('id', detalle.id);
    alert('✅ Validado'); cargarDetalle();
  }

  if (cargando) return <p>Cargando detalle...</p>;

  return (
    <div>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button>
      <h3 style={{ color: '#231F20' }}>📋 {objetivo.objetivo}</h3>
      <p style={{ color: '#64748b' }}>Ponderacion: {objetivo.ponderacion}% | Status: {objetivo.status}</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginTop: 16 }}>
        {['80', '100', '120'].map(function(nivel) {
          var keyNivel = 'nivel_' + nivel;
          var keyCom = 'comentario_' + nivel;
          return (
            <div key={nivel} style={{ ...s.tarjetaStat, background: '#f8fafc' }}>
              <h4 style={{ color: nivel === '80' ? '#f59e0b' : nivel === '100' ? '#3b82f6' : '#22c55e' }}>Alcance {nivel}%</h4>
              {!esLider && !detalle?.fecha_colaborador ? (
                <div>
                  <select value={form[keyNivel]} onChange={function(e) { setForm({...form, [keyNivel]: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, marginBottom: 8, border: '1px solid #D4D2C6' }}>
                    <option value="">Seleccionar...</option><option value="si">✅ Si</option><option value="no">❌ No</option><option value="parcialmente">⚠️ Parcialmente</option>
                  </select>
                  <textarea value={form[keyCom]} onChange={function(e) { setForm({...form, [keyCom]: e.target.value}); }} placeholder="Justificacion..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', minHeight: 60, fontSize: 12, fontFamily: 'inherit', resize: 'vertical' }} />
                </div>
              ) : (
                <div>
                  <p><strong>Alcanzado:</strong> {detalle?.['nivel_' + nivel + '_alcanzado'] || '-'}</p>
                  <p><strong>Justificacion:</strong> {detalle?.['comentario_' + nivel] || '-'}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!esLider && !detalle?.fecha_colaborador && (
        <div style={{ marginTop: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Comentario General *</label>
          <textarea value={form.comentario_colaborador} onChange={function(e) { setForm({...form, comentario_colaborador: e.target.value}); }} placeholder="Comentario general del objetivo..." style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
          <button onClick={guardarColaborador} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 12 }}>💾 Enviar</button>
        </div>
      )}

      {esLider && detalle?.fecha_colaborador && !detalle?.fecha_lider && (
        <div style={{ marginTop: 16, ...s.tarjetaStat, background: '#fef3c7' }}>
          <h4>✅ Validacion del Lider</h4>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Confirmar alcance *</label>
            <select value={validacion.validacion_lider} onChange={function(e) { setValidacion({...validacion, validacion_lider: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}>
              <option value="">Seleccionar...</option><option value="si">✅ Si</option><option value="no">❌ No</option><option value="parcialmente">⚠️ Parcialmente</option>
            </select>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Comentario de validacion *</label>
            <textarea value={validacion.comentario_lider} onChange={function(e) { setValidacion({...validacion, comentario_lider: e.target.value}); }} placeholder="Comentario..." style={{ width: '100%', minHeight: 60, padding: 10, borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
          <button onClick={guardarLider} style={{ ...s.btnPrimario, background: '#f59e0b' }}>✅ Validar Objetivo</button>
        </div>
      )}
    </div>
  );
}

function clasificarRating(prom) {
  if (prom <= 1.59) return { texto: 'No adecuado', color: '#dc2626' };
  if (prom <= 2.59) return { texto: 'Por debajo de lo esperado', color: '#f59e0b' };
  if (prom <= 3.59) return { texto: 'Cumple con las expectativas', color: '#3b82f6' };
  if (prom <= 4.59) return { texto: 'Excede las expectativas', color: '#22c55e' };
  return { texto: 'Desempeno distinguido', color: '#8b5cf6' };
}

function RatingDesc({ competenciaId, rating }) { var [desc, setDesc] = useState('...'); useEffect(function() { (async function() { var { data } = await supabase.from('rating_descriptions').select('titulo, descripcion').eq('competencia_id', competenciaId).eq('rating', rating).single(); if (data) setDesc(data.titulo + ': ' + data.descripcion); })(); }, [competenciaId, rating]); return <span>{desc}</span>; }
function SeccionText({ titulo, valor, onChange, disabled }) {
  return (
<div style={{ marginBottom: 24 }}>
  <h4 style={s.seccionTitulo}>📝 Comentarios Finales (obligatorio)</h4>
  {enviada || soloLectura ? (
    <p style={{ color: '#475569', padding: 12, background: '#f8fafc', borderRadius: 8 }}>{comFin || 'Sin comentarios.'}</p>
  ) : (
    <textarea 
      value={comFin} 
      onInput={function(e) { setComFin(e.target.value); }} 
      style={{ ...s.textarea, borderColor: comFin?.trim() ? '#D4D2C6' : '#dc2626' }} 
      placeholder="Escribe tus comentarios finales..."
    />
  )}
</div>
  );
}
var th = { textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: '11px' };
var td = { padding: '6px 8px', fontSize: '13px' };
var sidebarStyle = { aside: { width: '260px', background: '#231F20', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 0' }, logoContainer: { padding: '0 20px 20px', borderBottom: '1px solid #D4D2C6', marginBottom: 16, textAlign: 'center' }, nav: { display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', flex: 1 }, menuItem: { padding: '14px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, transition: 'all 0.15s', width: '100%' }, subMenuItem: { padding: '10px 16px', borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 13, fontWeight: 400, transition: 'all 0.15s', width: '100%' }, footer: { padding: '16px 20px', borderTop: '1px solid #D4D2C6' } };
var s = { centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20 }, header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#231F20' }, badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }, btnSalir: { padding: '8px 16px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }, tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }, grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }, seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#231F20', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #D4D2C6' }, competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14, border: '1px solid #e2e8f0' }, btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 }, ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }, ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }, ratingInfoBox: { background: 'white', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #e2e8f0' }, ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 }, textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, btnPrimario: { padding: '12px 24px', background: '#231F20', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, btnSecundario: { padding: '12px 24px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, mensajeToast: { padding: '12px 20px', background: '#D4D2C6', borderRadius: 8, marginBottom: 16, color: '#231F20', fontWeight: 500, fontSize: 14, textAlign: 'center' }, bannerEnviado: { padding: 20, background: '#D4D2C6', borderRadius: 10, color: '#231F20', fontWeight: 600, textAlign: 'center', marginTop: 20 } };                                         
