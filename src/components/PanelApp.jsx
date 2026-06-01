import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import emailjs from '@emailjs/browser';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export default function PanelApp() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { cargarPerfil(); }, []);

  async function cargarPerfil() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    const { data: perfil } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    setProfile(perfil);
    setLoading(false);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  if (loading) return <div style={s.centrado}><p>Cargando panel...</p></div>;
  if (!profile) return <div style={s.centrado}><h2>Error al cargar perfil</h2><button onClick={cerrarSesion} style={s.btnSalir}>Volver</button></div>;

  const nombreRol = profile.role === 'admin_rrhh' ? 'Admin RRHH' : profile.role === 'lider' ? 'Líder' : 'Colaborador';
  const emojiRol = profile.role === 'admin_rrhh' ? '🔧' : profile.role === 'lider' ? '👥' : '👤';

  return (
    <div>
      <header style={s.header}>
        <div style={s.headerIzq}>
          <img src="/logo.jpg" alt="Grupo Fabric" style={{ height: '32px' }} />
          <span style={s.badge}>{emojiRol} {nombreRol}</span>
        </div>
        <div style={s.headerDer}><span style={s.email}>{profile.email}</span><button onClick={cerrarSesion} style={s.btnSalir}>Cerrar Sesión</button></div>
      </header>
      <main style={s.main}>
        <div style={s.tarjetaBienvenida}><h2>👋 Bienvenido/a{profile.full_name ? `, ${profile.full_name}` : ''}</h2><p>Rol: <strong>{nombreRol}</strong> | Área: {profile.area || 'No asignada'} | Seniority: {profile.seniority || 'No definido'}</p></div>
        {profile.role === 'admin_rrhh' && <PanelAdmin profile={profile} />}
        {profile.role === 'lider' && <PanelLider />}
        {profile.role === 'colaborador' && <PanelColaboradorConEquipo userId={profile.id} seniority={profile.seniority} email={profile.email} nombre={profile.full_name} />}
      </main>
    </div>
  );
}

function PanelAdmin({ profile }) {
  const [stats, setStats] = useState({ total: 0, enviadas: 0, pendientes: 0 });
  const [colaboradores, setColaboradores] = useState([]);
  const [vistaActiva, setVistaActiva] = useState('dashboard');
  const [seniorityCounts, setSeniorityCounts] = useState({});
  const [senioritySeleccionado, setSenioritySeleccionado] = useState(null);
  const esFlorencia = profile.email === 'florencia.salvaneschi@grupo-fabric.com';

  useEffect(() => { cargarStats(); cargarColabs(); }, []);

  async function cargarStats() {
    const { count: t } = await supabase.from('evaluaciones').select('*', { count: 'exact', head: true });
    const { count: e } = await supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('estado', 'enviado');
    setStats({ total: t || 0, enviadas: e || 0, pendientes: (t || 0) - (e || 0) });
  }

  async function cargarColabs() {
    const { data } = await supabase.from('profiles').select('*');
    setColaboradores(data || []);
    const counts = {};
    (data || []).forEach(c => { const s = c.seniority || 'Sin definir'; counts[s] = (counts[s] || 0) + 1; });
    setSeniorityCounts(counts);
  }

  const pct = stats.total > 0 ? Math.round((stats.enviadas / stats.total) * 100) : 0;

  async function toggleActivo(colaborador) {
    await supabase.from('profiles').update({ activo: !colaborador.activo }).eq('id', colaborador.id);
    cargarColabs();
  }

  async function probarEnvioPDF() {
    const pdf = new jsPDF();
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor('#231F20');
    pdf.text('PRUEBA - Autoevaluación de Desempeño', 20, 20);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.text('Nombre: Florencia Salvaneschi', 20, 35);
    pdf.text('Email: florencia.salvaneschi@grupo-fabric.com', 20, 42);
    pdf.text('Seniority: Jefe/Experto', 20, 49);
    pdf.text('Fecha: ' + new Date().toLocaleDateString('es-AR'), 20, 56);
    pdf.setFillColor('#231F20');
    pdf.rect(20, 62, 170, 15, 'F');
    pdf.setTextColor('#FFFFFF');
    pdf.text('Resultado: 4.0 - Excede las expectativas', 25, 72);
    pdf.setTextColor('#231F20');
    pdf.text('Comentarios Finales: Prueba de envío de PDF.', 20, 85);
    
    try {
      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      await emailjs.send('service_httvcn8', 'template_ytka22b', {
        to_email: 'florencia.salvaneschi@grupo-fabric.com',
        to_name: 'Florencia Salvaneschi',
        promedio: '4.0',
        clasificacion: 'Excede las expectativas',
        message: 'PRUEBA - PDF desde plataforma de Evaluación.',
        attachment: pdfBase64,
        filename: 'prueba.pdf'
      }, 'Mc-YPiWB1XNBKfhOJ');
      alert('✅ PDF de prueba enviado a florencia.salvaneschi@grupo-fabric.com');
    } catch (err) {
      alert('❌ Error al enviar: ' + (err?.message || JSON.stringify(err)));
    }
  }

  async function descargarExcelCompleto() {
    const { data: todasEvals } = await supabase.from('evaluaciones').select('*, puntuaciones(*, competencias(nombre)), colaborador:colaborador_id(*)').order('created_at', { ascending: false });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colaboradores.map(c => ({ 'Nombre': c.full_name || '', 'Email': c.email, 'Área': c.area || '', 'Seniority': c.seniority || '', 'Rol': c.role, 'Activo': c.activo ? 'Sí' : 'No' }))), 'Resumen');
    const porColaborador = {};
    (todasEvals || []).forEach(ev => { if (!ev.colaborador) return; if (!porColaborador[ev.colaborador_id]) porColaborador[ev.colaborador_id] = []; porColaborador[ev.colaborador_id].push(ev); });
    for (const [colId, evals] of Object.entries(porColaborador)) {
      const col = evals[0].colaborador; const rows = [];
      evals.forEach(ev => { if (ev.puntuaciones?.length > 0) ev.puntuaciones.forEach(p => rows.push({ 'Tipo': ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Líder', 'Competencia': p.competencias?.nombre || '', 'Rating': p.rating, 'Comentario': p.comentario || '', 'Estado': ev.estado, 'Calibrado': ev.rating_calibrado || '', 'Finales': ev.comentarios_finales || '', 'Fecha': new Date(ev.created_at).toLocaleDateString('es-AR') })); else rows.push({ 'Tipo': ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Líder', 'Competencia': '', 'Rating': '', 'Comentario': '', 'Estado': ev.estado, 'Calibrado': ev.rating_calibrado || '', 'Finales': ev.comentarios_finales || '', 'Fecha': new Date(ev.created_at).toLocaleDateString('es-AR') }); });
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Sin datos': 'No hay evaluaciones' }]), (col.full_name || col.email).substring(0, 31).replace(/[\\\/\*\?\[\]:]/g, ''));
    }
    XLSX.writeFile(wb, 'Evaluaciones_Completas.xlsx');
  }

  const colaboradoresFiltrados = senioritySeleccionado ? colaboradores.filter(c => (c.seniority || 'Sin definir') === senioritySeleccionado) : [];

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => { setVistaActiva('dashboard'); setSenioritySeleccionado(null); }} style={vistaActiva === 'dashboard' ? s.btnPrimario : s.btnInfo}>📊 Dashboard</button>
        {esFlorencia && <button onClick={() => setVistaActiva('mievaluacion')} style={vistaActiva === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluación</button>}
        <button onClick={() => setVistaActiva('evaluaciones')} style={vistaActiva === 'evaluaciones' ? s.btnPrimario : s.btnInfo}>📋 Evaluaciones</button>
        <button onClick={() => setVistaActiva('calibracion')} style={vistaActiva === 'calibracion' ? s.btnPrimario : s.btnInfo}>🎯 Calibración</button>
        <button onClick={() => setVistaActiva('equipo')} style={vistaActiva === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>
        <button onClick={() => setVistaActiva('colaboradores')} style={vistaActiva === 'colaboradores' ? s.btnPrimario : s.btnInfo}>👥 Gestionar</button>
        <button onClick={descargarExcelCompleto} style={{ ...s.btnSecundario, background: '#22c55e', color: 'white' }}>📥 Exportar Todo</button>
        <button onClick={probarEnvioPDF} style={{ ...s.btnPrimario, background: '#f59e0b' }}>🧪 Probar PDF</button>
      </div>

      {vistaActiva === 'dashboard' && (
        <div>
          <h3 style={{ marginBottom: 20, color: '#231F20' }}>📊 Dashboard de Recursos Humanos</h3>
          <div style={s.grid}>
            <div style={s.tarjetaStat}><p>👥 Total</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{colaboradores.length}</p></div>
            <div style={s.tarjetaStat}><p>📋 Evaluaciones</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.total}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '4px solid #231F20' }}><p>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.enviadas}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' }}><p>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.pendientes}</p></div>
          </div>
          <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#231F20' }}>📊 Por Seniority</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {Object.entries(seniorityCounts).map(([seniority, count]) => (
                <div key={seniority} onClick={() => setSenioritySeleccionado(seniority === senioritySeleccionado ? null : seniority)} style={{ padding: 12, background: seniority === senioritySeleccionado ? '#231F20' : '#D4D2C6', borderRadius: 8, textAlign: 'center', cursor: 'pointer' }}>
                  <p style={{ fontSize: 12, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#231F20', margin: 0 }}>{seniority}</p>
                  <p style={{ fontSize: 24, fontWeight: 700, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#231F20', margin: '4px 0' }}>{count}</p>
                </div>
              ))}
            </div>
          </div>
          {senioritySeleccionado && (
            <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#231F20' }}>👥 {senioritySeleccionado} ({colaboradoresFiltrados.length})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colaboradoresFiltrados.map(c => (
                  <div key={c.id} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div><strong>{c.full_name || c.email}</strong><p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{c.area || 'Sin área'} · {c.role === 'admin_rrhh' ? 'Admin' : c.role === 'lider' ? 'Líder' : 'Colaborador'}</p></div>
                    <span style={{ fontSize: 11, color: c.activo ? '#22c55e' : '#dc2626' }}>{c.activo ? 'Activo' : 'Inactivo'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 8px 0' }}>📈 Progreso: {pct}%</p>
            <div style={{ background: '#D4D2C6', borderRadius: 10, height: 24, overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: '#231F20', borderRadius: 10 }} /></div>
          </div>
        </div>
      )}

      {vistaActiva === 'mievaluacion' && esFlorencia && <PanelColaborador userId={profile.id} seniority={profile.seniority} email={profile.email} nombre={profile.full_name} />}
      {vistaActiva === 'evaluaciones' && <EvaluacionesAdmin />}
      {vistaActiva === 'calibracion' && <PanelCalibracion colaboradores={colaboradores} />}
      {vistaActiva === 'equipo' && <EquipoLider />}
      
      {vistaActiva === 'colaboradores' && (
        <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
          <h4 style={{ margin: '0 0 16px 0' }}>👥 Gestionar ({colaboradores.length})</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '2px solid #D4D2C6' }}><th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Área</th><th style={th}>Seniority</th><th style={th}>Rol</th><th style={th}>Estado</th><th style={th}>Excel</th></tr></thead>
            <tbody>{colaboradores.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: c.activo ? 1 : 0.5 }}>
                <td style={td}>{c.full_name || '-'}</td><td style={td}>{c.email}</td><td style={td}>{c.area || '-'}</td>
                <td style={td}><span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>{c.seniority || '-'}</span></td>
                <td style={td}><span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.role === 'lider' ? '#231F20' : c.role === 'admin_rrhh' ? '#D4D2C6' : '#f1f5f9', color: c.role === 'lider' ? 'white' : c.role === 'admin_rrhh' ? '#231F20' : '#231F20' }}>{c.role === 'admin_rrhh' ? '🔧 Admin' : c.role === 'lider' ? '👥 Líder' : '👤 Colaborador'}</span></td>
                <td style={td}><button onClick={() => toggleActivo(c)} style={{ padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: c.activo ? '#dcfce7' : '#fee2e2', color: c.activo ? '#166534' : '#dc2626' }}>{c.activo ? '✅ Activo' : '❌ Inactivo'}</button></td>
                <td style={td}><button onClick={async () => {
                  const { data: evals } = await supabase.from('evaluaciones').select('*, puntuaciones(*, competencias(nombre))').eq('colaborador_id', c.id).order('created_at', { ascending: false });
                  const rows = []; (evals || []).forEach(ev => { if (ev.puntuaciones?.length > 0) ev.puntuaciones.forEach(p => rows.push({ 'Tipo': ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Líder', 'Competencia': p.competencias?.nombre || '', 'Rating': p.rating, 'Comentario': p.comentario || '', 'Estado': ev.estado, 'Calibrado': ev.rating_calibrado || '', 'Finales': ev.comentarios_finales || '', 'Fecha': new Date(ev.created_at).toLocaleDateString('es-AR') })); else rows.push({ 'Tipo': ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Líder', 'Competencia': '', 'Rating': '', 'Comentario': '', 'Estado': ev.estado, 'Calibrado': ev.rating_calibrado || '', 'Finales': ev.comentarios_finales || '', 'Fecha': new Date(ev.created_at).toLocaleDateString('es-AR') }); });
                  const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'Sin datos': 'No hay evaluaciones' }]); const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Evaluaciones'); XLSX.writeFile(wb, `Historial_${(c.full_name || c.email).replace(/\s/g, '_')}.xlsx`);
                }} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>📥</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PanelCalibracion({ colaboradores }) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [detalleVisible, setDetalleVisible] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [filtroArea, setFiltroArea] = useState('Todas');
  const [areas, setAreas] = useState([]);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setCargando(true);
    const { data: todasEvals } = await supabase.from('evaluaciones').select('*, puntuaciones(*, competencias(nombre)), colaborador:colaborador_id(*)').in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']).order('created_at', { ascending: false });
    const mapa = {};
    (todasEvals || []).forEach(ev => { if (!ev.colaborador || ev.colaborador.seniority === 'Gerente') return; if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, autoevaluacion: null, evaluacionLider: null }; if (ev.tipo_evaluacion === 'autoevaluacion') mapa[ev.colaborador_id].autoevaluacion = ev; if (ev.tipo_evaluacion === 'evaluacion_lider') mapa[ev.colaborador_id].evaluacionLider = ev; });
    colaboradores.forEach(col => { if (col.seniority !== 'Gerente' && !mapa[col.id]) mapa[col.id] = { colaborador: col, autoevaluacion: null, evaluacionLider: null }; });
    const resultado = Object.values(mapa).map(d => { const calc = (p) => { if (!p || p.length === 0) return null; const v = p.map(x => x.rating).filter(r => r > 0); return v.length === 0 ? null : (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1); }; return { ...d, promAuto: calc(d.autoevaluacion?.puntuaciones), promLider: calc(d.evaluacionLider?.puntuaciones), gap: calc(d.autoevaluacion?.puntuaciones) && calc(d.evaluacionLider?.puntuaciones) ? (parseFloat(calc(d.evaluacionLider?.puntuaciones)) - parseFloat(calc(d.autoevaluacion?.puntuaciones))).toFixed(1) : null, ratingFinal: d.evaluacionLider?.rating_calibrado || null }; });
    setAreas(['Todas', ...new Set(resultado.map(d => d.colaborador.area).filter(Boolean))]);
    setDatos(resultado); setCargando(false);
  }

  async function guardarCalibracion(evaluacionId, rating) { setGuardando(true); await supabase.from('evaluaciones').update({ rating_calibrado: rating }).eq('id', evaluacionId); setDatos(prev => prev.map(d => d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating } : d)); setGuardando(false); }
  function construirComentarios(evaluacion) { if (!evaluacion) return 'Sin comentarios'; let t = ''; if (evaluacion.puntuaciones) evaluacion.puntuaciones.forEach(p => { if (p.comentario) t += `• ${p.competencias?.nombre || 'Competencia'}: ${p.comentario}\n`; }); if (evaluacion.comentarios_finales) t += `\n📝 Final: ${evaluacion.comentarios_finales}`; return t || 'Sin comentarios'; }
  async function enviarResumenCalibracion(d) { if (!d.ratingFinal) return; const clasif = clasificar(d.ratingFinal); const ca = construirComentarios(d.autoevaluacion); const cl = construirComentarios(d.evaluacionLider); emailjs.send('service_httvcn8', 'template_ytka22b', { to_email: d.colaborador.email, to_name: d.colaborador.full_name || d.colaborador.email, promedio: d.ratingFinal, clasificacion: clasif.texto, message: `Calibración final.\n\n📊 Auto: ${d.promAuto || 'N/A'}\n👥 Líder: ${d.promLider || 'N/A'}\n✅ Calibrado: ${d.ratingFinal}\n\n📝 Auto:\n${ca}\n\n📝 Líder:\n${cl}` }, 'Mc-YPiWB1XNBKfhOJ').catch(err => console.log(err)); if (d.evaluacionLider?.evaluador_id) { const { data: lider } = await supabase.from('profiles').select('email, full_name').eq('id', d.evaluacionLider.evaluador_id).single(); if (lider?.email) emailjs.send('service_httvcn8', 'template_ytka22b', { to_email: lider.email, to_name: lider.full_name || 'Líder', promedio: d.ratingFinal, clasificacion: clasif.texto, message: `Calibración de ${d.colaborador.full_name}.\n\n📊 Auto: ${d.promAuto || 'N/A'}\n👥 Líder: ${d.promLider || 'N/A'}\n✅ Calibrado: ${d.ratingFinal}\n\n📝 Auto:\n${ca}\n\n📝 Líder:\n${cl}` }, 'Mc-YPiWB1XNBKfhOJ').catch(err => console.log(err)); } emailjs.send('service_httvcn8', 'template_ytka22b', { to_email: 'florencia.salvaneschi@grupo-fabric.com', to_name: 'Florencia', promedio: d.ratingFinal, clasificacion: clasif.texto, message: `Historial - ${d.colaborador.full_name}.\n\n📊 Auto: ${d.promAuto || 'N/A'}\n👥 Líder: ${d.promLider || 'N/A'}\n✅ Calibrado: ${d.ratingFinal}\n\n📝 Auto:\n${ca}\n\n📝 Líder:\n${cl}` }, 'Mc-YPiWB1XNBKfhOJ').catch(err => console.log(err)); alert('✅ Resumen enviado'); }
  const clasificar = (prom) => { if (!prom) return { texto: '-', color: '#94a3b8' }; const p = parseFloat(prom); if (p <= 1.4) return { texto: '🔴 No adecuado', color: '#dc2626' }; if (p <= 2.4) return { texto: '🟠 Por debajo', color: '#f59e0b' }; if (p <= 3.4) return { texto: '🔵 Cumple', color: '#3b82f6' }; if (p <= 4.4) return { texto: '🟢 Excede', color: '#22c55e' }; return { texto: '🟣 Distinguido', color: '#8b5cf6' }; };
  const datosFiltrados = filtroArea === 'Todas' ? datos : datos.filter(d => d.colaborador.area === filtroArea);

  if (cargando) return <p style={{ padding: 20 }}>⏳ Cargando...</p>;

  return (
    <div style={{ ...s.tarjetaStat }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#231F20' }}>🎯 Calibración</h3>
        <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14, background: 'white' }}>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select>
      </div>
      {datosFiltrados.length === 0 ? <p style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No hay datos.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1050px' }}>
            <thead><tr style={{ borderBottom: '2px solid #D4D2C6' }}><th style={th}>Colaborador</th><th style={th}>Área</th><th style={th}>Seniority</th><th style={th}>Auto</th><th style={th}>Líder</th><th style={th}>GAP</th><th style={th}>Calibrado</th><th style={th}>Detalle</th><th style={th}>Enviar</th></tr></thead>
            <tbody>{datosFiltrados.map(d => { const clasFinal = clasificar(d.ratingFinal); return (
              <tr key={d.colaborador.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td><td style={td}>{d.colaborador.area || '-'}</td>
                <td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>{d.colaborador.seniority || '-'}</span></td>
                <td style={{ ...td, textAlign: 'center', fontSize: 18, fontWeight: 700, color: clasificar(d.promAuto).color }}>{d.promAuto || '-'}</td>
                <td style={{ ...td, textAlign: 'center', fontSize: 18, fontWeight: 700, color: clasificar(d.promLider).color }}>{d.promLider || '-'}</td>
                <td style={{ ...td, textAlign: 'center', fontSize: 16, fontWeight: 700, color: d.gap ? (Math.abs(d.gap) <= 0.5 ? '#231F20' : Math.abs(d.gap) <= 1 ? '#f59e0b' : '#dc2626') : '#94a3b8' }}>{d.gap ? (d.gap > 0 ? '+' : '') + d.gap : '-'}</td>
                <td style={{ ...td, textAlign: 'center' }}>{d.promLider ? <div><select value={d.ratingFinal || ''} onChange={(e) => guardarCalibracion(d.evaluacionLider.id, parseFloat(e.target.value))} style={{ padding: '6px 10px', borderRadius: 6, border: `2px solid ${clasFinal.color}`, fontSize: 14, fontWeight: 600, color: clasFinal.color, background: 'white' }} disabled={guardando}><option value="">Seleccionar</option><option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option></select>{d.ratingFinal && <div style={{ fontSize: 10, color: clasFinal.color, marginTop: 2 }}>{clasFinal.texto}</div>}</div> : <span style={{ color: '#94a3b8' }}>Sin eval</span>}</td>
                <td style={td}><button onClick={() => setDetalleVisible(d.colaborador.id)} style={{ background: '#231F20', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}>👁️</button></td>
                <td style={td}>{d.ratingFinal ? <button onClick={() => enviarResumenCalibracion(d)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📧</button> : <span style={{ color: '#94a3b8' }}>-</span>}</td>
              </tr>
            )})}</tbody>
          </table>

          {detalleVisible && datos.find(d => d.colaborador.id === detalleVisible) && (
            <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }} onClick={() => setDetalleVisible(null)}>
              <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 900, width: '95%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation
