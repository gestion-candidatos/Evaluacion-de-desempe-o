import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';

function abrirGmail(colaboradorEmail, liderEmail) {
  var to = colaboradorEmail + (liderEmail ? ',' + liderEmail : '');
  var subject = 'Evaluacion de Desempeno - Fabric Group';
  var body = 'Adjunto encontraras el resumen de la evaluacion de desempeno.%0D%0A%0D%0AFabric Group.';
  window.open('https://mail.google.com/mail/?view=cm&fs=1&to=' + to + '&su=' + encodeURIComponent(subject) + '&body=' + body, '_blank');
}

export default function PanelApp() {
  var [profile, setProfile] = useState(null);
  var [loading, setLoading] = useState(true);
  var [menuActivo, setMenuActivo] = useState('desempeno');
  var [cicloActivo, setCicloActivo] = useState(null);

  useEffect(function() { cargarPerfil(); }, []);

  async function cargarPerfil() {
    var resp = await supabase.auth.getSession();
    if (!resp.data.session) { window.location.href = '/'; return; }
    var resp2 = await supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo, leader_id').eq('id', resp.data.session.user.id).single();
    if (resp2.data && resp2.data.activo === false) { await supabase.auth.signOut(); alert('Cuenta desactivada.'); window.location.href = '/'; return; }
    setProfile(resp2.data);
    setLoading(false);
  }

  async function cerrarSesion() { await supabase.auth.signOut(); window.location.href = '/'; }

  if (loading) return <div style={s.centrado}><p>Cargando...</p></div>;
  if (!profile) return <div style={s.centrado}><h2>Error</h2><button onClick={cerrarSesion} style={s.btnSalir}>Volver</button></div>;

  var nombreRol = profile.role === 'admin_rrhh' ? 'Admin RRHH' : profile.role === 'lider' ? 'Lider' : 'Colaborador';
  var emojiRol = profile.role === 'admin_rrhh' ? '🔧' : profile.role === 'lider' ? '👥' : '👤';
  var esGerente = profile.seniority === 'Gerente';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebar.aside}>
        <div style={sidebar.logoContainer}><img src="/logo.jpg" alt="Fabric Group" style={{ height: '40px' }} /></div>
        <nav style={sidebar.nav}>
          <button onClick={function() { setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ ...sidebar.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' }}>📊 Evaluacion de Desempeno</button>
          <button onClick={function() { setMenuActivo('objetivos'); }} style={{ ...sidebar.menuItem, background: menuActivo === 'objetivos' ? '#D4D2C6' : 'transparent', color: menuActivo === 'objetivos' ? '#231F20' : '#D4D2C6' }}>🎯 Mis Objetivos</button>
          <button onClick={function() { setMenuActivo('objetivos_empresa'); }} style={{ ...sidebar.menuItem, background: menuActivo === 'objetivos_empresa' ? '#D4D2C6' : 'transparent', color: menuActivo === 'objetivos_empresa' ? '#231F20' : '#D4D2C6' }}>🏢 Objetivos Corporativos</button>
        </nav>
        <div style={sidebar.footer}><span style={{ fontSize: 12, color: '#D4D2C6' }}>{profile.email}</span><button onClick={cerrarSesion} style={{ ...s.btnSalir, marginTop: 8, width: '100%' }}>Cerrar Sesion</button></div>
      </aside>
      <div style={{ flex: 1, background: '#f8fafc', minHeight: '100vh' }}>
        <header style={s.header}><h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1><span style={s.badge}>{emojiRol} {nombreRol}</span></header>
        <main style={{ padding: 24 }}>
          {menuActivo === 'desempeno' && <DesempenoView profile={profile} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
          {menuActivo === 'objetivos' && <ObjetivosView profile={profile} />}
          {menuActivo === 'objetivos_empresa' && <ObjetivosCorporativosView profile={profile} />}
        </main>
      </div>
    </div>
  );
}

// =============================================
// MÓDULO DE OBJETIVOS (CORREGIDO)
// =============================================
function ObjetivosView({ profile }) {
  var [vista, setVista] = useState('misobjetivos');
  var [tieneEquipo, setTieneEquipo] = useState(false);
  var [verificando, setVerificando] = useState(true);

  useEffect(function() {
    async function verificar() {
      var resp = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('leader_id', profile.id);
      setTieneEquipo((resp.count || 0) > 0);
      if ((resp.count || 0) > 0) {
        setVista('gerente');
      }
      setVerificando(false);
    }
    verificar();
  }, []);

  if (verificando) return <p>Cargando...</p>;

  return (
    <div>
      {tieneEquipo && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <button onClick={function() { setVista('gerente'); }} style={vista === 'gerente' ? s.btnPrimario : s.btnInfo}>
            👥 Objetivos de Mi Equipo
          </button>
          <button onClick={function() { setVista('misobjetivos'); }} style={vista === 'misobjetivos' ? s.btnPrimario : s.btnInfo}>
            🎯 Mis Objetivos
          </button>
        </div>
      )}

      {vista === 'gerente' && tieneEquipo && <ObjetivosGerente profile={profile} />}
      {(vista === 'misobjetivos' || !tieneEquipo) && <ObjetivosColaborador profile={profile} />}
    </div>
  );
}

function ObjetivosGerente({ profile }) {
  var [equipo, setEquipo] = useState([]);
  var [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null);
  var [cargando, setCargando] = useState(true);

  useEffect(function() { cargarEquipo(); }, []);

  async function cargarEquipo() {
    var resp = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', profile.id);
    setEquipo(resp.data || []);
    setCargando(false);
  }

  if (cargando) return <p>Cargando equipo...</p>;
  if (colaboradorSeleccionado) return <GestionObjetivos colaborador={colaboradorSeleccionado} profile={profile} onVolver={function() { setColaboradorSeleccionado(null); }} />;

  return (
    <div>
      <h2 style={{ color: '#231F20', marginBottom: 20 }}>🎯 Objetivos de Mi Equipo</h2>
      <p style={{ color: '#64748b', marginBottom: 20 }}>Selecciona un colaborador para gestionar sus objetivos.</p>
      {equipo.length === 0 ? <p style={{ color: '#94a3b8' }}>No tienes colaboradores asignados.</p> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {equipo.map(function(col) {
            return (
              <div key={col.id} onClick={function() { setColaboradorSeleccionado(col); }} style={{ ...s.tarjetaStat, cursor: 'pointer', border: '2px solid #D4D2C6' }}>
                <h4 style={{ margin: 0, color: '#231F20' }}>{col.full_name || col.email}</h4>
                <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>{col.area} · {col.seniority}</p>
                <button style={{ ...s.btnPrimario, marginTop: 12, width: '100%' }}>Gestionar Objetivos</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GestionObjetivos({ colaborador, profile, onVolver }) {
  var [objetivos, setObjetivos] = useState([]);
  var [cargando, setCargando] = useState(true);
  var [mostrarForm, setMostrarForm] = useState(false);
  var [nuevoObjetivo, setNuevoObjetivo] = useState({
    objetivo: '', corporativo: '', ponderacion: 25,
    alcance_0_fecha: '', alcance_80_fecha: '', alcance_100_fecha: '', alcance_120_fecha: ''
  });

  useEffect(function() { cargarObjetivos(); }, []);

  async function cargarObjetivos() {
    var resp = await supabase.from('objetivos').select('*').eq('colaborador_id', colaborador.id).order('created_at', { ascending: false });
    setObjetivos(resp.data || []);
    setCargando(false);
  }

  async function agregarObjetivo() {
    if (!nuevoObjetivo.objetivo) return alert('El objetivo es obligatorio');
    await supabase.from('objetivos').insert({
      gerente_id: profile.id,
      colaborador_id: colaborador.id,
      objetivo: nuevoObjetivo.objetivo,
      corporativo: nuevoObjetivo.corporativo,
      ponderacion: nuevoObjetivo.ponderacion,
      alcance_0_fecha: nuevoObjetivo.alcance_0_fecha || null,
      alcance_80_fecha: nuevoObjetivo.alcance_80_fecha || null,
      alcance_100_fecha: nuevoObjetivo.alcance_100_fecha || null,
      alcance_120_fecha: nuevoObjetivo.alcance_120_fecha || null,
      status: 'pendiente'
    });
    setNuevoObjetivo({ objetivo: '', corporativo: '', ponderacion: 25, alcance_0_fecha: '', alcance_80_fecha: '', alcance_100_fecha: '', alcance_120_fecha: '' });
    setMostrarForm(false);
    cargarObjetivos();
  }

  async function validarObjetivo(objId) {
    await supabase.from('objetivos').update({ status: 'validado', validado_por_gerente: true, fecha_validacion: new Date() }).eq('id', objId);
    cargarObjetivos();
  }

  if (cargando) return <p>Cargando objetivos...</p>;

  return (
    <div>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver al equipo</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ color: '#231F20', margin: 0 }}>🎯 Objetivos de {colaborador.full_name || colaborador.email}</h2>
          <p style={{ color: '#64748b', margin: '4px 0' }}>{colaborador.area} · {colaborador.seniority}</p>
        </div>
        <button onClick={function() { setMostrarForm(!mostrarForm); }} style={s.btnPrimario}>+ Agregar Objetivo</button>
      </div>

      {mostrarForm && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <h4>Nuevo Objetivo</h4>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
            <div><label style={{ fontSize: 12 }}>Objetivo *</label><input value={nuevoObjetivo.objetivo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, objetivo: e.target.value}); }} placeholder="Describir el objetivo..." style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Corporativo</label><input value={nuevoObjetivo.corporativo} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, corporativo: e.target.value}); }} placeholder="Ej: Ventas" style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Ponderacion (%)</label><select value={nuevoObjetivo.ponderacion} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, ponderacion: parseFloat(e.target.value)}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="10">10%</option><option value="15">15%</option><option value="20">20%</option><option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option><option value="50">50%</option></select></div>
            <div><label style={{ fontSize: 12 }}>Fecha 0%</label><input type="date" value={nuevoObjetivo.alcance_0_fecha} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_0_fecha: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Fecha 80%</label><input type="date" value={nuevoObjetivo.alcance_80_fecha} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_80_fecha: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Fecha 100%</label><input type="date" value={nuevoObjetivo.alcance_100_fecha} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_100_fecha: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
            <div><label style={{ fontSize: 12 }}>Fecha 120%</label><input type="date" value={nuevoObjetivo.alcance_120_fecha} onChange={function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_120_fecha: e.target.value}); }} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
          </div>
          <button onClick={agregarObjetivo} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 12 }}>💾 Guardar Objetivo</button>
        </div>
      )}

      {objetivos.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>Sin objetivos asignados.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1400 }}>
            <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Corporativo</th><th style={{ ...th, color: '#D4D2C6' }}>Area</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th><th style={{ ...th, color: '#D4D2C6' }}>0%</th><th style={{ ...th, color: '#D4D2C6' }}>80%</th><th style={{ ...th, color: '#D4D2C6' }}>100%</th><th style={{ ...th, color: '#D4D2C6' }}>120%</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Accion</th></tr></thead>
            <tbody>{objetivos.map(function(obj) { return (
              <tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}>{obj.objetivo}</td><td style={td}>{obj.corporativo || '-'}</td><td style={td}>{colaborador.area || '-'}</td><td style={{ ...td, fontWeight: 700, textAlign: 'center' }}>{obj.ponderacion}%</td>
                <td style={td}>{obj.alcance_0_fecha ? new Date(obj.alcance_0_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</td>
                <td style={td}>{obj.alcance_80_fecha ? new Date(obj.alcance_80_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</td>
                <td style={td}>{obj.alcance_100_fecha ? new Date(obj.alcance_100_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</td>
                <td style={td}>{obj.alcance_120_fecha ? new Date(obj.alcance_120_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</td>
                <td style={td}><span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : obj.status === 'aceptado' ? '#fef3c7' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : obj.status === 'aceptado' ? '#92400e' : '#64748b' }}>{obj.status === 'validado' ? '✅ Validado' : obj.status === 'completado' ? '📝 Completado' : obj.status === 'aceptado' ? '👤 Aceptado' : '⏳ Pendiente'}</span></td>
                <td style={td}>{obj.status === 'completado' && <button onClick={function() { validarObjetivo(obj.id); }} style={{ ...s.btnPrimario, background: '#22c55e', fontSize: 12, padding: '6px 12px' }}>✅ Validar</button>}</td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ObjetivosColaborador({ profile }) {
  var [objetivos, setObjetivos] = useState([]);
  var [cargando, setCargando] = useState(true);

  useEffect(function() { cargarObjetivos(); }, []);

  async function cargarObjetivos() {
    var resp = await supabase.from('objetivos').select('*').eq('colaborador_id', profile.id).order('created_at', { ascending: false });
    setObjetivos(resp.data || []);
    setCargando(false);
  }

  async function aceptarObjetivo(objId) {
    await supabase.from('objetivos').update({ status: 'aceptado', confirmado_colaborador: true, fecha_confirmacion: new Date() }).eq('id', objId);
    cargarObjetivos();
  }

  async function completarObjetivo(objId) {
    await supabase.from('objetivos').update({ status: 'completado', completado_por_colaborador: true, fecha_completado: new Date() }).eq('id', objId);
    cargarObjetivos();
  }

  if (cargando) return <p>Cargando objetivos...</p>;

  return (
    <div>
      <h2 style={{ color: '#231F20', marginBottom: 20 }}>🎯 Mis Objetivos</h2>
      <p style={{ color: '#64748b', marginBottom: 20 }}>Objetivos asignados por tu gerente.</p>
      {objetivos.length === 0 ? (
        <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}><p style={{ color: '#94a3b8', fontSize: 16 }}>No tienes objetivos asignados aun.</p></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
            <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Corporativo</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th><th style={{ ...th, color: '#D4D2C6' }}>0%</th><th style={{ ...th, color: '#D4D2C6' }}>80%</th><th style={{ ...th, color: '#D4D2C6' }}>100%</th><th style={{ ...th, color: '#D4D2C6' }}>120%</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Accion</th></tr></thead>
            <tbody>{objetivos.map(function(obj) { return (
              <tr key={obj.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={td}>{obj.objetivo}</td><td style={td}>{obj.corporativo || '-'}</td><td style={{ ...td, fontWeight: 700, textAlign: 'center' }}>{obj.ponderacion}%</td>
                <td style={td}>{obj.alcance_0_fecha ? new Date(obj.alcance_0_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</td>
                <td style={td}>{obj.alcance_80_fecha ? new Date(obj.alcance_80_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</td>
                <td style={td}>{obj.alcance_100_fecha ? new Date(obj.alcance_100_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</td>
                <td style={td}>{obj.alcance_120_fecha ? new Date(obj.alcance_120_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'}</td>
                <td style={td}><span style={{ padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : obj.status === 'aceptado' ? '#fef3c7' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : obj.status === 'aceptado' ? '#92400e' : '#64748b' }}>{obj.status === 'validado' ? '✅ Validado' : obj.status === 'completado' ? '📝 Completado' : obj.status === 'aceptado' ? '👤 Aceptado' : '⏳ Pendiente'}</span></td>
                <td style={td}>{obj.status === 'pendiente' && <button onClick={function() { aceptarObjetivo(obj.id); }} style={{ ...s.btnPrimario, background: '#3b82f6', fontSize: 12, padding: '6px 12px' }}>✅ Aceptar</button>}{obj.status === 'aceptado' && <button onClick={function() { completarObjetivo(obj.id); }} style={{ ...s.btnPrimario, background: '#22c55e', fontSize: 12, padding: '6px 12px' }}>✔️ Completar</button>}</td>
              </tr>
            ); })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ObjetivosCorporativosView({ profile }) {
  return <div><h2 style={{ color: '#231F20', marginBottom: 20 }}>🏢 Objetivos Corporativos</h2><div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}><p style={{ color: '#94a3b8', fontSize: 16 }}>Modulo en desarrollo.</p></div></div>;
}

// =============================================
// RESTO DEL CÓDIGO (DESEMPENO, CALIBRACION, ETC.)
// =============================================
function DesempenoView({ profile, cicloActivo, setCicloActivo }) {
  var esAdmin = profile.role === 'admin_rrhh';
  var esGerente = profile.seniority === 'Gerente';
  if (!cicloActivo) return <CiclosLista esAdmin={esAdmin} onSelectCiclo={setCicloActivo} />;
  return (
    <div><button onClick={function() { setCicloActivo(null); }} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver a Ciclos</button><h2>📊 {cicloActivo.nombre}</h2><p style={{ color: '#64748b', marginBottom: 20 }}>{new Date(cicloActivo.fecha_inicio).toLocaleDateString('es-AR')} · {cicloActivo.estado}</p>
      {esAdmin && <PanelAdminConEquipo profile={profile} cicloId={cicloActivo.id} tieneAutoevaluacion={!esGerente} />}
      {!esAdmin && esGerente && <EquipoLider cicloId={cicloActivo.id} profile={profile} />}
      {!esAdmin && !esGerente && profile.role === 'lider' && <PanelLiderConAutoevaluacion cicloId={cicloActivo.id} profile={profile} />}
      {!esAdmin && !esGerente && profile.role !== 'lider' && <PanelColaboradorConEquipo userId={profile.id} seniority={profile.seniority} cicloId={cicloActivo.id} profile={profile} />}
    </div>
  );
}

function PanelLiderConAutoevaluacion({ cicloId, profile }) { var [v, setV] = useState('equipo'); return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={function() { setV('equipo'); }} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button><button onClick={function() { setV('mievaluacion'); }} style={v === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluacion</button></div>{v === 'equipo' ? <EquipoLider cicloId={cicloId} profile={profile} /> : <PanelColaborador userId={profile.id} seniority={profile.seniority} cicloId={cicloId} />}</div>; }

function PanelAdminConEquipo({ profile, cicloId, tieneAutoevaluacion }) {
  var [vista, setVista] = useState('dashboard'); var [stats, setStats] = useState({ total: 0, enviadas: 0, pendientes: 0 }); var [colabs, setColabs] = useState([]); var [hist, setHist] = useState(null);
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() { var resps = await Promise.all([supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId), supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('estado', 'enviado'), supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', cicloId), supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo').neq('role', 'admin_rrhh')]); var ids = (resps[2].data || []).map(function(x) { return x.colaborador_id; }); setColabs((resps[3].data || []).filter(function(c) { return ids.includes(c.id); })); setStats({ total: resps[0].count || 0, enviadas: resps[1].count || 0, pendientes: (resps[0].count || 0) - (resps[1].count || 0) }); }
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
      {vista === 'calibracion' && <PanelCalibracion cicloId={cicloId} colabs={colabs} onHist={setHist} />}
      {vista === 'feedback' && <FeedbackAdmin cicloId={cicloId} />}
      {vista === 'equipo' && <EquipoLider cicloId={cicloId} profile={profile} />}
      {vista === 'mievaluacion' && tieneAutoevaluacion && <PanelColaborador userId={profile.id} seniority={profile.seniority} cicloId={cicloId} />}
      {vista === 'colaboradores' && <ParticipantesView colabs={colabs} />}
    </div>
  );
}

function PanelColaboradorConEquipo({ userId, seniority, cicloId, profile }) { var [v, setV] = useState('autoevaluacion'); var [tieneEq, setTieneEq] = useState(false); var [part, setPart] = useState(false); var [verif, setVerif] = useState(true); useEffect(function() { (async function() { var resp = await supabase.auth.getSession(); if (resp.data.session) { var resps = await Promise.all([supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', resp.data.session.user.id), supabase.from('ciclo_colaboradores').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('colaborador_id', resp.data.session.user.id)]); setTieneEq((resps[0].count || 0) > 0); setPart((resps[1].count || 0) > 0); } setVerif(false); })(); }, [cicloId]); if (verif) return <p>Verificando...</p>; if (!part) return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p>No estas participando.</p></div>; return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={function() { setV('autoevaluacion'); }} style={v === 'autoevaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluacion</button>{tieneEq && <button onClick={function() { setV('equipo'); }} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>}</div>{v === 'autoevaluacion' ? <PanelColaborador userId={userId} seniority={seniority} cicloId={cicloId} /> : <EquipoLider cicloId={cicloId} profile={profile} />}</div>; }

function CiclosLista({ esAdmin, onSelectCiclo }) {
  var [ciclos, setCiclos] = useState([]); var [carg, setCarg] = useState(true); var [showC, setShowC] = useState(false); var [nom, setNom] = useState(''); var [fIni, setFIni] = useState(''); var [fFin, setFFin] = useState(''); var [cSel, setCSel] = useState(null); var [todos, setTodos] = useState([]); var [parts, setParts] = useState([]);
  useEffect(function() { cargar(); if (esAdmin) cargarColabs(); }, []);
  async function cargar() { var resp = await supabase.from('ciclos').select('*').order('fecha_inicio', { ascending: false }); setCiclos(resp.data || []); setCarg(false); }
  async function cargarColabs() { var resp = await supabase.from('profiles').select('id, email, full_name, area, seniority').neq('role', 'admin_rrhh').eq('activo', true); setTodos(resp.data || []); }
  async function crear() { if (!nom || !fIni) return alert('Nombre y fecha obligatorios'); await supabase.from('ciclos').insert({ nombre: nom, fecha_inicio: fIni, fecha_fin: fFin || null, estado: 'activo' }); setNom(''); setFIni(''); setFFin(''); setShowC(false); cargar(); }
  async function abrir(ciclo) { setCSel(ciclo.id); var resp = await supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', ciclo.id); setParts((resp.data || []).map(function(p) { return p.colaborador_id; })); }
  async function toggle(cid) { if (parts.includes(cid)) { await supabase.from('ciclo_colaboradores').delete().eq('ciclo_id', cSel).eq('colaborador_id', cid); setParts(function(p) { return p.filter(function(id) { return id !== cid; }); }); } else { await supabase.from('ciclo_colaboradores').insert({ ciclo_id: cSel, colaborador_id: cid }); setParts(function(p) { return [...p, cid]; }); } }
  if (carg) return <p>Cargando ciclos...</p>;
  return <div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>📊 Ciclos de Evaluacion</h2>{esAdmin && <button onClick={function() { setShowC(!showC); }} style={s.btnPrimario}>+ Nuevo Ciclo</button>}</div>{showC && <div style={{ ...s.tarjetaStat, marginBottom: 20 }}><h4>Crear Ciclo</h4><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}><div><label>Nombre</label><input value={nom} onChange={function(e) { setNom(e.target.value); }} placeholder="Ej: 1er Semestre 2025" style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', width: 200 }} /></div><div><label>Inicio</label><input type="date" value={fIni} onChange={function(e) { setFIni(e.target.value); }} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div><div><label>Fin</label><input type="date" value={fFin} onChange={function(e) { setFFin(e.target.value); }} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div><button onClick={crear} style={{ ...s.btnPrimario, background: '#22c55e', alignSelf: 'flex-end' }}>Crear</button></div></div>}{cSel && <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><h4>👥 Participantes</h4><button onClick={function() { setCSel(null); }} style={s.btnInfo}>✕</button></div><p>{parts.length} seleccionados</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>{todos.map(function(c) { return (<div key={c.id} onClick={function() { toggle(c.id); }} style={{ padding: 10, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: parts.includes(c.id) ? '#231F20' : 'white', color: parts.includes(c.id) ? '#D4D2C6' : '#231F20', border: '1px solid #D4D2C6' }}><div><strong>{c.full_name || c.email}</strong><p style={{ fontSize: 11, margin: 0, opacity: 0.7 }}>{c.area}·{c.seniority}</p></div><span>{parts.includes(c.id) ? '✅' : '○'}</span></div>); })}</div></div>}{ciclos.length === 0 ? <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p>No hay ciclos.</p></div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>{ciclos.map(function(c) { return (<div key={c.id} style={{ ...s.tarjetaStat, border: '2px solid #D4D2C6' }}><h3>{c.nombre}</h3><p>📅 Inicio: {new Date(c.fecha_inicio).toLocaleDateString('es-AR')}</p>{c.fecha_fin && <p>📅 Fin: {new Date(c.fecha_fin).toLocaleDateString('es-AR')}</p>}<span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.estado === 'activo' ? '#dcfce7' : '#f1f5f9', color: c.estado === 'activo' ? '#166534' : '#64748b', display: 'inline-block', marginTop: 8 }}>{c.estado === 'activo' ? '✅ Activo' : '📁 ' + c.estado}</span><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button onClick={function() { onSelectCiclo(c); }} style={{ ...s.btnPrimario, flex: 1 }}>Entrar</button>{esAdmin && <button onClick={function() { abrir(c); }} style={s.btnSecundario}>👥</button>}</div></div>); })}</div>}</div>;
}

function DashboardView({ stats, colabs }) { return <div><div style={s.grid}><div style={s.tarjetaStat}><p>👥 Participantes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{colabs.length}</p></div><div style={s.tarjetaStat}><p>📋 Evaluaciones</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.total}</p></div><div style={{ ...s.tarjetaStat, borderTop: '4px solid #231F20' }}><p>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.enviadas}</p></div><div style={{ ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' }}><p>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.pendientes}</p></div></div></div>; }
function ParticipantesView({ colabs }) { return <div style={s.tarjetaStat}><h4>👥 Participantes ({colabs.length})</h4><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Area</th><th style={th}>Seniority</th></tr></thead><tbody>{colabs.map(function(c) { return (<tr key={c.id}><td style={td}>{c.full_name || '-'}</td><td style={td}>{c.email}</td><td style={td}>{c.area || '-'}</td><td style={td}>{c.seniority || '-'}</td></tr>); })}</tbody></table></div>; }
function EvaluacionesAdmin({ cicloId }) { var [evs, setEvs] = useState([]); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var resp = await supabase.from('evaluaciones').select('id,colaborador_id,tipo_evaluacion,estado,rating_promedio,rating_calibrado,created_at,colaborador:colaborador_id(email,full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setEvs(resp.data || []); setCarg(false); })(); }, [cicloId]); if (carg) return <p>Cargando...</p>; return <div style={s.tarjetaStat}><h4>📋 Evaluaciones ({evs.length})</h4><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Colaborador</th><th style={th}>Tipo</th><th style={th}>Estado</th><th style={th}>Rating</th><th style={th}>Calibrado</th><th style={th}>Fecha</th></tr></thead><tbody>{evs.map(function(ev) { return (<tr key={ev.id}><td style={td}>{ev.colaborador?.full_name || '-'}</td><td style={td}>{ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Lider'}</td><td style={td}>{ev.estado}</td><td style={{ ...td, fontWeight: 700 }}>{ev.rating_promedio || '-'}</td><td style={td}>{ev.rating_calibrado || '-'}</td><td style={td}>{new Date(ev.created_at).toLocaleDateString('es-AR')}</td></tr>); })}</tbody></table></div></div>; }

function PanelCalibracion({ cicloId, colabs, onHist }) {
  var [datos, setDatos] = useState([]); var [carg, setCarg] = useState(true); var [filtro, setFiltro] = useState('Todas');
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() { setCarg(true); var resp = await supabase.from('evaluaciones').select('id,colaborador_id,tipo_evaluacion,rating_promedio,rating_calibrado,comentario_calibracion,colaborador:colaborador_id(id,email,full_name,area,seniority)').eq('ciclo_id', cicloId).in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']); var mapa = {}; (resp.data || []).forEach(function(ev) { if (!ev.colaborador) return; if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, promAuto: null, promLider: null, ratingFinal: null, comentarioCalibracion: null, evaluacionLider: null }; if (ev.tipo_evaluacion === 'autoevaluacion') mapa[ev.colaborador_id].promAuto = ev.rating_promedio; if (ev.tipo_evaluacion === 'evaluacion_lider') { mapa[ev.colaborador_id].promLider = ev.rating_promedio; mapa[ev.colaborador_id].ratingFinal = ev.rating_calibrado; mapa[ev.colaborador_id].comentarioCalibracion = ev.comentario_calibracion; mapa[ev.colaborador_id].evaluacionLider = ev; } }); colabs.forEach(function(c) { if (!mapa[c.id]) mapa[c.id] = { colaborador: c, promAuto: null, promLider: null, ratingFinal: null, comentarioCalibracion: null, evaluacionLider: null }; }); setDatos(Object.values(mapa)); setCarg(false); }
  async function guardarCal(evaluacionId, rating, comentario) { await supabase.from('evaluaciones').update({ rating_calibrado: rating, comentario_calibracion: comentario }).eq('id', evaluacionId); setDatos(function(p) { return p.map(function(d) { return d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating, comentarioCalibracion: comentario } : d; }); }); }
  function clasificar(prom) { if (!prom) return { texto: '-', color: '#94a3b8' }; var p = parseFloat(prom); if (p <= 1.4) return { texto: 'No adecuado', color: '#dc2626' }; if (p <= 2.4) return { texto: 'Por debajo', color: '#f59e0b' }; if (p <= 3.4) return { texto: 'Cumple', color: '#3b82f6' }; if (p <= 4.4) return { texto: 'Excede', color: '#22c55e' }; return { texto: 'Distinguido', color: '#8b5cf6' }; }
  function generarPDF(d) { var pdf = new jsPDF(); var y = 28; try { pdf.addImage('logo.jpg', 'JPEG', 15, 8, 30, 15); } catch (e) { } pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text('EVALUACION DE DESEMPENO', 15, y); y += 7; pdf.setFontSize(9); pdf.text('Colaborador: ' + (d.colaborador.full_name || d.colaborador.email), 15, y); y += 5; pdf.text('Area: ' + (d.colaborador.area || '-') + '   Seniority: ' + (d.colaborador.seniority || '-'), 15, y); y += 10; pdf.setFontSize(12); pdf.text('Auto: ' + (d.promAuto || '-') + '   Lider: ' + (d.promLider || '-') + '   Calibrado: ' + (d.ratingFinal || '-'), 15, y + 10); if (d.comentarioCalibracion) { pdf.setFontSize(8); pdf.text('Justificacion: ' + d.comentarioCalibracion, 15, y + 18); } return pdf; }
  function verPDF(d) { var n = (d.colaborador.full_name || d.colaborador.email).replaceAll(' ', '_'); generarPDF(d).save('Evaluacion_' + n + '.pdf'); }
  function enviarPDF(d) { verPDF(d); var le = ''; if (d.evaluacionLider?.evaluador_id) { supabase.from('profiles').select('email').eq('id', d.evaluacionLider.evaluador_id).single().then(function(res) { abrirGmail(d.colaborador.email, res.data?.email || ''); }); } else { abrirGmail(d.colaborador.email, ''); } }
  var areas = useMemo(function() { return ['Todas', ...new Set(datos.map(function(d) { return d.colaborador.area; }).filter(Boolean))]; }, [datos]); var df = filtro === 'Todas' ? datos : datos.filter(function(d) { return d.colaborador.area === filtro; });
  if (carg) return <p>Cargando...</p>;
  return <div style={{ ...s.tarjetaStat }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><h3>Calibracion</h3><select value={filtro} onChange={function(e) { setFiltro(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{areas.map(function(a) { return <option key={a} value={a}>{a}</option>; })}</select></div><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}><thead><tr><th style={th}>Colaborador</th><th style={th}>Auto</th><th style={th}>Lider</th><th style={th}>GAP</th><th style={th}>Calibrado</th><th style={th}>Justificacion</th><th style={th}>Hist</th><th style={th}>PDF</th><th style={th}>Enviar</th></tr></thead><tbody>{df.map(function(d) { var gap = d.promAuto && d.promLider ? (parseFloat(d.promLider) - parseFloat(d.promAuto)).toFixed(1) : null; var clasF = clasificar(d.ratingFinal); return (<tr key={d.colaborador.id}><td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td><td style={{ ...td, textAlign: 'center', fontWeight: 700, color: clasificar(d.promAuto).color }}>{d.promAuto || '-'}</td><td style={{ ...td, textAlign: 'center', fontWeight: 700, color: clasificar(d.promLider).color }}>{d.promLider || '-'}</td><td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{gap || '-'}</td><td style={td}>{d.evaluacionLider ? <select value={d.ratingFinal || ''} onChange={function(e) { guardarCal(d.evaluacionLider.id, parseFloat(e.target.value), d.comentarioCalibracion || ''); }} style={{ padding: 4, borderRadius: 6, border: '2px solid ' + clasF.color, fontWeight: 600, color: clasF.color }}><option value="">-</option><option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option></select> : '-'}</td><td style={td}>{d.evaluacionLider ? <input value={d.comentarioCalibracion || ''} onChange={function(e) { guardarCal(d.evaluacionLider.id, d.ratingFinal || null, e.target.value); }} placeholder="Justificar..." style={{ width: '100%', padding: 4, borderRadius: 6, border: '1px solid #D4D2C6', fontSize: 11 }} /> : '-'}</td><td style={td}><button onClick={function() { onHist(d.colaborador); }} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>📋</button></td><td style={td}><button onClick={function() { verPDF(d); }} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>PDF</button></td><td style={td}>{d.ratingFinal ? <button onClick={function() { enviarPDF(d); }} style={{ background: '#231F20', color: '#D4D2C6', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600 }}>Enviar</button> : '-'}</td></tr>); })}</tbody></table></div></div>;
}

function FeedbackAdmin({ cicloId }) { var [fbs, setFbs] = useState([]); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var resp = await supabase.from('feedback').select('*,lider:lider_id(email,full_name),colaborador:colaborador_id(email,full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setFbs(resp.data || []); setCarg(false); })(); }, [cicloId]); if (carg) return <p>Cargando...</p>; return <div style={s.tarjetaStat}><h4>💬 Feedback ({fbs.length})</h4>{fbs.length === 0 ? <p style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Sin registros.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Lider</th><th style={th}>Colaborador</th><th style={th}>Comentario</th><th style={th}>Fecha</th><th style={th}>OK</th></tr></thead><tbody>{fbs.map(function(f) { return (<tr key={f.id}><td style={td}>{f.lider?.full_name || '-'}</td><td style={td}>{f.colaborador?.full_name || '-'}</td><td style={td}>{f.comentario_lider || '-'}</td><td style={td}>{f.fecha_feedback_lider ? new Date(f.fecha_feedback_lider).toLocaleDateString('es-AR') : '-'}</td><td style={td}>{f.confirmacion_colaborador ? '✅' : '⏳'}</td></tr>); })}</tbody></table>}</div>; }
function HistorialAdmin({ colaborador, onVolver }) { var [hist, setHist] = useState([]); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var resp = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false }); setHist(resp.data || []); setCarg(false); })(); }, []); if (carg) return <p>Cargando...</p>; return <div><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📋 Historial: {colaborador.full_name || colaborador.email}</h3>{hist.length === 0 ? <p style={{ padding: 40, color: '#94a3b8' }}>Sin historial.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th></tr></thead><tbody>{hist.map(function(h) { return (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={td}>{h.rating_final || '-'}</td></tr>); })}</tbody></table>}</div>; }

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

function EquipoLider({ cicloId, profile }) {
  var [equipo, setEquipo] = useState([]); var [colSel, setColSel] = useState(null); var [fbVis, setFbVis] = useState(null); var [detalleVisible, setDetalleVisible] = useState(null);
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() { var resp = await supabase.auth.getSession(); if (!resp.data.session) return; var resp2 = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', resp.data.session.user.id); if (!resp2.data) return; var eq = await Promise.all(resp2.data.map(async function(c) { var resp3 = await supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', c.id).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle(); var punts = []; if (resp3.data) { var resp4 = await supabase.from('puntuaciones').select('id, rating, comentario, competencia_id, competencias!inner(nombre)').eq('evaluacion_id', resp3.data.id); punts = resp4.data || []; } var resp5 = await supabase.from('evaluaciones').select('id, estado, rating_promedio').eq('colaborador_id', c.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(); var resp6 = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', c.id).maybeSingle(); return { ...c, autoevaluacion: resp3.data ? { ...resp3.data, puntuaciones: punts } : null, evaluacionLider: resp5.data, feedback: resp6.data }; })); setEquipo(eq); }
  if (colSel) return <EvaluacionLider colaborador={colSel} cicloId={cicloId} onVolver={function() { setColSel(null); cargar(); }} />;
  if (fbVis) return <FeedbackForm feedback={fbVis} cicloId={cicloId} onVolver={function() { setFbVis(null); cargar(); }} />;
  return <div><h3>👥 Mi Equipo ({equipo.length})</h3>{equipo.length === 0 ? <p>No tienes colaboradores.</p> : <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{equipo.map(function(c) { return (<div key={c.id} style={{ ...s.tarjetaStat }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}><div style={{ flex: 1 }}><h4>{c.full_name || c.email}</h4><p style={{ color: '#64748b', fontSize: 13 }}>{c.area} · {c.seniority}</p><div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}><span>📝 Auto: <strong style={{ color: c.autoevaluacion?.estado === 'enviado' ? '#22c55e' : '#f59e0b' }}>{c.autoevaluacion?.estado === 'enviado' ? '✅ Enviada' : '⏳ Pendiente'}</strong></span><span>👥 Mi eval: <strong style={{ color: c.evaluacionLider?.estado === 'enviado' ? '#22c55e' : c.evaluacionLider ? '#f59e0b' : '#94a3b8' }}>{c.evaluacionLider?.estado === 'enviado' ? '✅ Completada' : c.evaluacionLider ? '📝 Borrador' : '❌ Sin evaluar'}</strong></span><span>💬 FB: <strong style={{ color: c.feedback?.confirmacion_colaborador ? '#22c55e' : c.feedback ? '#f59e0b' : '#94a3b8' }}>{c.feedback?.confirmacion_colaborador ? '✅' : c.feedback ? '⏳' : '-'}</strong></span></div></div><div style={{ display: 'flex', gap: 8 }}>{c.autoevaluacion?.estado === 'enviado' && <button onClick={function() { setDetalleVisible(detalleVisible === c.id ? null : c.id); }} style={{ ...s.btnInfo, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>{detalleVisible === c.id ? '🔼 Ocultar' : '👁️ Ver Autoevaluacion'}</button>}<button onClick={function() { setFbVis(c); }} style={{ ...s.btnInfo, background: '#fef3c7', color: '#92400e' }}>💬 FB</button><button onClick={function() { setColSel(c); }} style={s.btnPrimario}>{c.evaluacionLider ? '✏️ Editar' : '📝 Evaluar'}</button></div></div>{detalleVisible === c.id && <DetalleAutoEvaluacion autoevaluacion={c.autoevaluacion} />}</div>); })}</div>}</div>;
}

function FeedbackForm({ feedback: col, cicloId, onVolver }) { var [com, setCom] = useState(''); var [fb, setFb] = useState(null); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var resp = await supabase.auth.getSession(); var resp2 = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', col.id).maybeSingle(); if (resp2.data) { setFb(resp2.data); setCom(resp2.data.comentario_lider || ''); } else { await supabase.from('feedback').insert({ ciclo_id: cicloId, lider_id: resp.data.session.user.id, colaborador_id: col.id }); } setCarg(false); })(); }, []); async function guardar() { var resp = await supabase.auth.getSession(); await supabase.from('feedback').upsert({ ciclo_id: cicloId, lider_id: resp.data.session.user.id, colaborador_id: col.id, comentario_lider: com, fecha_feedback_lider: new Date() }, { onConflict: 'ciclo_id, colaborador_id' }); alert('✅ Guardado'); onVolver(); } if (carg) return <p>Cargando...</p>; return <div style={{ maxWidth: 600 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>💬 Feedback: {col.full_name || col.email}</h3><textarea value={com} onChange={function(e) { setCom(e.target.value); }} placeholder="Deja tu feedback..." style={{ ...s.textarea, minHeight: 120, marginBottom: 12 }} />{fb?.confirmacion_colaborador && <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8, marginBottom: 16 }}>✅ Confirmado</div>}<button onClick={guardar} style={s.btnPrimario}>💾 Guardar</button></div>; }
function EvaluacionLider({ colaborador, cicloId, onVolver }) { var [competencias, setComp] = useState([]); var [ratings, setRatings] = useState({}); var [comentarios, setComent] = useState({}); var [comFin, setComFin] = useState(''); var [msg, setMsg] = useState(''); var [carg, setCarg] = useState(true); var [autoEval, setAutoEval] = useState(null); var [evalData, setEvalData] = useState(null); var [showInfo, setShowInfo] = useState({}); useEffect(function() { (async function() { var resps = await Promise.all([supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', colaborador.seniority || 'Analista'), supabase.auth.getSession()]); setComp(resps[0].data || []); var resp3 = await supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle(); if (resp3.data) { var resp4 = await supabase.from('puntuaciones').select('id, rating, comentario, competencia_id, competencias!inner(nombre)').eq('evaluacion_id', resp3.data.id); setAutoEval({ ...resp3.data, puntuaciones: resp4.data || [] }); } var resp5 = await supabase.from('evaluaciones').select('id, estado, comentarios_finales, rating_promedio').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(); if (resp5.data) { setEvalData(resp5.data); setComFin(resp5.data.comentarios_finales || ''); var resp6 = await supabase.from('puntuaciones').select('rating, competencia_id, comentario').eq('evaluacion_id', resp5.data.id); var rm = {}; var cm = {}; (resp6.data || []).forEach(function(p) { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComent(cm); } else { await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: resps[1].data.session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador', ciclo_id: cicloId }); } setCarg(false); })(); }, []); async function guardar() { var falt = competencias.filter(function(c) { return !comentarios[c.id]?.trim(); }); if (falt.length > 0) { setMsg('❌ Completa: ' + falt.map(function(c) { return c.nombre; }).join(', ')); setTimeout(function() { setMsg(''); }, 4000); return; } if (!comFin?.trim()) { setMsg('❌ Comentarios finales obligatorios'); setTimeout(function() { setMsg(''); }, 4000); return; } var resp = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (!resp.data) return; var vals = Object.values(ratings).filter(function(r) { return r > 0; }); var prom = vals.length > 0 ? parseFloat((vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1)) : null; await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', resp.data.id); for (var cid in ratings) { await supabase.from('puntuaciones').upsert({ evaluacion_id: resp.data.id, competencia_id: cid, rating: ratings[cid], comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMsg('✅ Guardado'); setTimeout(function() { setMsg(''); }, 2500); } async function enviar() { await guardar(); var resp = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (resp.data) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', resp.data.id); setMsg('🎉 Enviada'); } var calcProm = function() { var v = Object.values(ratings).filter(function(r) { return r > 0; }); return v.length > 0 ? (v.reduce(function(a, b) { return a + b; }, 0) / v.length).toFixed(1) : null; }; if (carg) return <p>Cargando...</p>; var enviada = evalData?.estado === 'enviado'; var prom = calcProm(); return <div style={{ maxWidth: 900 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📝 Evaluando a: {colaborador.full_name || colaborador.email}</h3><p>{colaborador.area} · {colaborador.seniority}</p>{autoEval?.estado === 'enviado' && <DetalleAutoEvaluacion autoevaluacion={autoEval} />}{competencias.map(function(comp) { return (<div key={comp.id} style={s.competenciaCard}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h5>{comp.nombre}</h5><p style={{ fontSize: 13, color: '#64748b' }}>{comp.descripcion}</p></div><button onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }} style={s.btnInfo}>{showInfo[comp.id] ? '🔼' : '🔽'}</button></div>{showInfo[comp.id] && <div style={{ ...s.ratingInfoBox, marginTop: 8 }}>{[1, 2, 3, 4, 5].map(function(r) { return <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>; })}</div>}<div style={s.ratingRow}>{[1, 2, 3, 4, 5].map(function(r) { return <button key={r} onClick={function() { if (enviada) return; setRatings({...ratings, [comp.id]: r}); }} style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', cursor: enviada ? 'not-allowed' : 'pointer' }} disabled={enviada}>{r}</button>; })}</div><textarea value={comentarios[comp.id] || ''} onChange={function(e) { setComent({...comentarios, [comp.id]: e.target.value}); }} placeholder="Comentario obligatorio" style={{ ...s.textareaSmall, borderColor: enviada ? '#D4D2C6' : (comentarios[comp.id]?.trim() ? '#D4D2C6' : '#dc2626') }} disabled={enviada} /></div>); })}<SeccionText titulo="📝 Comentarios Finales (obligatorio)" valor={comFin} onChange={setComFin} disabled={enviada} />{prom && <div style={{ marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: '2px solid #231F20', textAlign: 'center' }}><p>Resultado Final</p><p style={{ fontSize: 48, fontWeight: 700, color: '#231F20' }}>{prom}</p></div>}{msg && <div style={s.mensajeToast}>{msg}</div>}{!enviada && <div style={{ display: 'flex', gap: 12, marginTop: 20 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>}</div>; }
function PanelColaborador({ userId, seniority, cicloId }) { var [competencias, setComp] = useState([]); var [ratings, setRatings] = useState({}); var [comentarios, setComent] = useState({}); var [comFin, setComFin] = useState(''); var [msg, setMsg] = useState(''); var [carg, setCarg] = useState(true); var [evalLider, setEvalLider] = useState(null); var [feedback, setFeedback] = useState(null); var [evalData, setEvalData] = useState(null); var [showInfo, setShowInfo] = useState({}); useEffect(function() { (async function() { var resps = await Promise.all([supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', seniority || 'Analista'), supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(), supabase.from('evaluaciones').select('id, rating_calibrado, comentario_calibracion').eq('colaborador_id', userId).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(), supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', userId).maybeSingle()]); setComp(resps[0].data || []); setEvalLider(resps[2].data); setFeedback(resps[3].data); if (resps[1].data) { setEvalData(resps[1].data); setComFin(resps[1].data.comentarios_finales || ''); var resp5 = await supabase.from('puntuaciones').select('rating, competencia_id, comentario').eq('evaluacion_id', resps[1].data.id); var rm = {}; var cm = {}; (resp5.data || []).forEach(function(p) { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComent(cm); } else { await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador', ciclo_id: cicloId }); } setCarg(false); })(); }, []); async function guardar() { var falt = competencias.filter(function(c) { return !comentarios[c.id]?.trim(); }); if (falt.length > 0) { setMsg('❌ Completa: ' + falt.map(function(c) { return c.nombre; }).join(', ')); setTimeout(function() { setMsg(''); }, 4000); return; } if (!comFin?.trim()) { setMsg('❌ Comentarios finales obligatorios'); setTimeout(function() { setMsg(''); }, 4000); return; } var resp = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (!resp.data) return; var vals = Object.values(ratings).filter(function(r) { return r > 0; }); var prom = vals.length > 0 ? parseFloat((vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1)) : null; await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', resp.data.id); for (var cid in ratings) { await supabase.from('puntuaciones').upsert({ evaluacion_id: resp.data.id, competencia_id: cid, rating: ratings[cid], comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMsg('✅ Guardado'); setTimeout(function() { setMsg(''); }, 2500); } async function enviar() { await guardar(); var resp = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (resp.data) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', resp.data.id); setMsg('🎉 Enviada'); } async function confirmarFB() { await supabase.from('feedback').update({ confirmacion_colaborador: true, fecha_confirmacion: new Date() }).eq('id', feedback.id); setFeedback({ ...feedback, confirmacion_colaborador: true }); alert('✅ Confirmado'); } var calcProm = function() { var v = Object.values(ratings).filter(function(r) { return r > 0; }); return v.length > 0 ? (v.reduce(function(a, b) { return a + b; }, 0) / v.length).toFixed(1) : null; }; if (carg) return <p>Cargando...</p>; var enviada = evalData?.estado === 'enviado'; var prom = calcProm(); return <div style={{ maxWidth: 900 }}><h3>📝 Mi Autoevaluacion</h3><p>Seniority: <strong>{seniority || 'No definido'}</strong></p><p>Estado: <strong style={{ color: enviada ? '#231F20' : '#f59e0b' }}>{enviada ? '✅ Enviada' : '📝 En progreso'}</strong></p>{feedback && <div style={{ padding: 16, background: feedback.confirmacion_colaborador ? '#dcfce7' : '#fef3c7', borderRadius: 10, marginBottom: 20 }}><h4>💬 Feedback</h4><p>{feedback.comentario_lider || 'Sin comentarios.'}</p>{!feedback.confirmacion_colaborador ? <button onClick={confirmarFB} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 8, fontSize: 13 }}>✅ Confirmar</button> : <p style={{ color: '#166534', marginTop: 8 }}>✅ Confirmado</p>}</div>}{evalLider?.rating_calibrado && <div style={{ padding: 16, background: '#D4D2C6', borderRadius: 10, marginBottom: 20, textAlign: 'center' }}><p>🎯 Resultado Final Calibrado</p><p style={{ fontSize: 36, fontWeight: 700 }}>{evalLider.rating_calibrado}</p></div>}{competencias.map(function(comp) { return (<div key={comp.id} style={s.competenciaCard}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h5>{comp.nombre}</h5><p style={{ fontSize: 13, color: '#64748b' }}>{comp.descripcion}</p></div><button onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }} style={s.btnInfo}>{showInfo[comp.id] ? '🔼' : '🔽'}</button></div>{showInfo[comp.id] && <div style={{ ...s.ratingInfoBox, marginTop: 8 }}>{[1, 2, 3, 4, 5].map(function(r) { return <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>; })}</div>}<div style={s.ratingRow}>{[1, 2, 3, 4, 5].map(function(r) { return <button key={r} onClick={function() { if (enviada) return; setRatings({...ratings, [comp.id]: r}); }} style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', cursor: enviada ? 'not-allowed' : 'pointer' }} disabled={enviada}>{r}</button>; })}</div><textarea value={comentarios[comp.id] || ''} onChange={function(e) { setComent({...comentarios, [comp.id]: e.target.value}); }} placeholder="Comentario obligatorio" style={{ ...s.textareaSmall, borderColor: enviada ? '#D4D2C6' : (comentarios[comp.id]?.trim() ? '#D4D2C6' : '#dc2626') }} disabled={enviada} /></div>); })}<SeccionText titulo="📝 Comentarios Finales (obligatorio)" valor={comFin} onChange={setComFin} disabled={enviada} />{prom && <div style={{ marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: '2px solid #231F20', textAlign: 'center' }}><p>Resultado Final</p><p style={{ fontSize: 48, fontWeight: 700, color: '#231F20' }}>{prom}</p></div>}{msg && <div style={s.mensajeToast}>{msg}</div>}{!enviada && <div style={{ display: 'flex', gap: 12, marginTop: 20 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>}</div>; }

function RatingDesc({ competenciaId, rating }) { var [desc, setDesc] = useState('...'); useEffect(function() { (async function() { var resp = await supabase.from('rating_descriptions').select('titulo, descripcion').eq('competencia_id', competenciaId).eq('rating', rating).single(); if (resp.data) setDesc(resp.data.titulo + ': ' + resp.data.descripcion); })(); }, [competenciaId, rating]); return <span>{desc}</span>; }
function SeccionText({ titulo, valor, onChange, disabled }) { return <div style={{ marginBottom: 24 }}><h4 style={s.seccionTitulo}>{titulo}</h4><textarea value={valor} onChange={function(e) { onChange(e.target.value); }} style={{ ...s.textarea, borderColor: disabled ? '#D4D2C6' : (valor?.trim() ? '#D4D2C6' : '#dc2626') }} disabled={disabled} /></div>; }

var th = { textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: '11px' };
var td = { padding: '6px 8px', fontSize: '13px' };
var sidebar = { aside: { width: '260px', background: '#231F20', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 0' }, logoContainer: { padding: '0 20px 20px', borderBottom: '1px solid #D4D2C6', marginBottom: 16, textAlign: 'center' }, nav: { display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', flex: 1 }, menuItem: { padding: '14px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, transition: 'all 0.15s', width: '100%' }, footer: { padding: '16px 20px', borderTop: '1px solid #D4D2C6' } };
var s = { centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20 }, header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#231F20' }, badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }, btnSalir: { padding: '8px 16px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }, tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }, grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }, seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#231F20', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #D4D2C6' }, competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14, border: '1px solid #e2e8f0' }, btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 }, ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }, ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }, ratingInfoBox: { background: 'white', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #e2e8f0' }, ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 }, textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, btnPrimario: { padding: '12px 24px', background: '#231F20', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, btnSecundario: { padding: '12px 24px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, mensajeToast: { padding: '12px 20px', background: '#D4D2C6', borderRadius: 8, marginBottom: 16, color: '#231F20', fontWeight: 500, fontSize: 14, textAlign: 'center' }, bannerEnviado: { padding: 20, background: '#D4D2C6', borderRadius: 10, color: '#231F20', fontWeight: 600, textAlign: 'center', marginTop: 20 } };
