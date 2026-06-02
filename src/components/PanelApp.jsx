import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import emailjs from '@emailjs/browser';
import * as XLSX from 'xlsx';
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

  useEffect(() => { cargarPerfil(); }, []);

  async function cargarPerfil() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    const { data: perfil } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
    if (perfil && perfil.activo === false) {
      await supabase.auth.signOut();
      alert('Tu cuenta ha sido desactivada. Contacta a RRHH.');
      window.location.href = '/';
      return;
    }
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
  const [colaboradorHistorial, setColaboradorHistorial] = useState(null);
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

  async function descargarExcelCompleto() {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([
      { 'Indicador': 'Total Colaboradores', 'Valor': colaboradores.length },
      { 'Indicador': 'Total Evaluaciones', 'Valor': stats.total },
      { 'Indicador': 'Completadas', 'Valor': stats.enviadas },
      { 'Indicador': 'Pendientes', 'Valor': stats.pendientes },
      { 'Indicador': 'Progreso', 'Valor': pct + '%' },
    ]), 'Dashboard');
    XLSX.writeFile(wb, 'Dashboard_RRHH.xlsx');
  }

  if (colaboradorHistorial) {
    return <HistorialAdmin colaborador={colaboradorHistorial} onVolver={() => { setColaboradorHistorial(null); cargarColabs(); }} />;
  }

  const colaboradoresFiltrados = senioritySeleccionado 
    ? colaboradores.filter(c => (c.seniority || 'Sin definir') === senioritySeleccionado) 
    : [];

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
      </div>

      {vistaActiva === 'dashboard' && (
        <div>
          <h3 style={{ marginBottom: 20, color: '#231F20' }}>📊 Dashboard de Recursos Humanos</h3>
          <div style={s.grid}>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>👥 Total Colaboradores</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{colaboradores.length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>📋 Total Evaluaciones</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.total}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '4px solid #231F20' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.enviadas}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' }}><p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{stats.pendientes}</p></div>
          </div>
          <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
            <p style={{ color: '#64748b', fontSize: 14, margin: '0 0 8px 0' }}>📈 Progreso General: {pct}%</p>
            <div style={{ background: '#D4D2C6', borderRadius: 10, height: 24, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#231F20', borderRadius: 10, transition: 'width 0.5s', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 12, fontWeight: 600 }}>
                {pct > 10 ? `${pct}%` : ''}
              </div>
            </div>
          </div>
          <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
            <h4 style={{ margin: '0 0 16px 0', color: '#231F20' }}>📊 Distribución por Seniority</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {Object.entries(seniorityCounts).map(([seniority, count]) => (
                <div key={seniority} onClick={() => setSenioritySeleccionado(seniority === senioritySeleccionado ? null : seniority)} 
                  style={{ padding: 16, background: seniority === senioritySeleccionado ? '#231F20' : '#D4D2C6', borderRadius: 10, textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', transform: seniority === senioritySeleccionado ? 'scale(1.03)' : 'scale(1)', boxShadow: seniority === senioritySeleccionado ? '0 4px 12px rgba(0,0,0,0.2)' : 'none' }}>
                  <p style={{ fontSize: 11, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#231F20', margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>{seniority}</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#231F20', margin: '6px 0' }}>{count}</p>
                  <p style={{ fontSize: 10, color: seniority === senioritySeleccionado ? '#D4D2C6' : '#64748b', margin: 0 }}>colaboradores</p>
                </div>
              ))}
            </div>
          </div>
          {senioritySeleccionado && (
            <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h4 style={{ margin: 0, color: '#231F20' }}>👥 {senioritySeleccionado} ({colaboradoresFiltrados.length} colaboradores)</h4>
                <button onClick={() => setSenioritySeleccionado(null)} style={{ ...s.btnInfo, fontSize: 12 }}>✕ Cerrar</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {colaboradoresFiltrados.map(c => (
                  <div key={c.id} style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid #e2e8f0' }}>
                    <div><strong style={{ color: '#231F20' }}>{c.full_name || c.email}</strong><p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>{c.area || 'Sin área'} · {c.role === 'admin_rrhh' ? 'Admin' : c.role === 'lider' ? 'Líder' : 'Colaborador'}</p></div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 12, background: c.activo ? '#dcfce7' : '#fee2e2', color: c.activo ? '#166534' : '#dc2626' }}>{c.activo ? '✅ Activo' : '❌ Inactivo'}</span>
                  </div>
                ))}
                {colaboradoresFiltrados.length === 0 && <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No hay colaboradores en esta categoría.</p>}
              </div>
            </div>
          )}
        </div>
      )}

      {vistaActiva === 'mievaluacion' && esFlorencia && <PanelColaborador userId={profile.id} seniority={profile.seniority} email={profile.email} nombre={profile.full_name} />}
      {vistaActiva === 'evaluaciones' && <EvaluacionesAdmin onVerHistorial={setColaboradorHistorial} />}
      {vistaActiva === 'calibracion' && <PanelCalibracion colaboradores={colaboradores} onVerHistorial={setColaboradorHistorial} />}
      {vistaActiva === 'equipo' && <EquipoLider />}
      
      {vistaActiva === 'colaboradores' && (
        <div style={{ ...s.tarjetaStat, marginTop: 20 }}>
          <h4>👥 Gestionar ({colaboradores.length})</h4>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '2px solid #D4D2C6' }}><th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Área</th><th style={th}>Seniority</th><th style={th}>Rol</th><th style={th}>Estado</th><th style={th}>Historial</th></tr></thead>
            <tbody>{colaboradores.map(c => (
              <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9', opacity: c.activo ? 1 : 0.5 }}>
                <td style={td}>{c.full_name || '-'}</td><td style={td}>{c.email}</td><td style={td}>{c.area || '-'}</td>
                <td style={td}><span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>{c.seniority || '-'}</span></td>
                <td style={td}><span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: c.role === 'lider' ? '#231F20' : c.role === 'admin_rrhh' ? '#D4D2C6' : '#f1f5f9', color: c.role === 'lider' ? 'white' : '#231F20' }}>{c.role === 'admin_rrhh' ? '🔧 Admin' : c.role === 'lider' ? '👥 Líder' : '👤 Colaborador'}</span></td>
                <td style={td}><button onClick={() => toggleActivo(c)} style={{ padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 600, border: 'none', cursor: 'pointer', background: c.activo ? '#dcfce7' : '#fee2e2', color: c.activo ? '#166534' : '#dc2626' }}>{c.activo ? '✅ Activo' : '❌ Inactivo'}</button></td>
                <td style={td}><button onClick={() => setColaboradorHistorial(c)} style={{ background: '#231F20', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>📋</button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// =============================================
// HISTORIAL ADMIN
// =============================================
function HistorialAdmin({ colaborador, onVolver }) {
  const [historicas, setHistoricas] = useState([]);
  const [competencias, setCompetencias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [modo, setModo] = useState('completa');
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [ratingsHist, setRatingsHist] = useState({});
  const [comentariosHist, setComentariosHist] = useState({});
  const [comentariosFinalesHist, setComentariosFinalesHist] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [nuevoRating, setNuevoRating] = useState('');
  const [nuevoComentario, setNuevoComentario] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [showInfo, setShowInfo] = useState({});

  useEffect(() => { cargarTodo(); }, [colaborador.id]);

  async function cargarTodo() {
    setCargando(true);
    const { data: comps } = await supabase.from('competencias').select('*').eq('aplica_a', colaborador.seniority || 'Analista');
    setCompetencias(comps || []);
    const { data: hist } = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false });
    setHistoricas(hist || []);
    setCargando(false);
  }

  async function guardarEvaluacionCompleta() {
    if (!nuevaFecha) return alert('La fecha es obligatoria');
    const valores = Object.values(ratingsHist).filter(r => r > 0);
    if (valores.length === 0) return alert('Debe calificar al menos una competencia');
    const promedio = (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from('evaluaciones_historicas').insert({
      colaborador_id: colaborador.id, fecha_evaluacion: nuevaFecha,
      rating_final: parseFloat(promedio), comentarios: comentariosFinalesHist || 'Evaluación histórica',
      creado_por: session?.user?.id
    });
    if (error) { alert('Error: ' + error.message); return; }
    alert('✅ Guardada');
    setNuevaFecha(''); setRatingsHist({}); setComentariosHist({}); setComentariosFinalesHist('');
    setMostrarForm(false); cargarTodo();
  }

  async function subirPDF() {
    if (!archivo || !nuevaFecha) return alert('Fecha y archivo son obligatorios');
    setSubiendo(true);
    const nombreLimpio = archivo.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const fileName = `${colaborador.id}_${Date.now()}_${nombreLimpio}`;
    const { error: uploadError } = await supabase.storage.from('historicos').upload(fileName, archivo);
    if (uploadError) { alert('Error al subir: ' + uploadError.message); setSubiendo(false); return; }
    const { data: urlData } = supabase.storage.from('historicos').getPublicUrl(fileName);
    const { data: { session } } = await supabase.auth.getSession();
    const { error: insertError } = await supabase.from('evaluaciones_historicas').insert({
      colaborador_id: colaborador.id, fecha_evaluacion: nuevaFecha,
      rating_final: nuevoRating ? parseFloat(nuevoRating) : null,
      comentarios: nuevoComentario || 'Evaluación histórica (PDF)',
      archivo_url: urlData.publicUrl, creado_por: session?.user?.id
    });
    if (insertError) { alert('Error: ' + insertError.message); } else { alert('✅ PDF guardado'); }
    setNuevaFecha(''); setNuevoRating(''); setNuevoComentario(''); setArchivo(null);
    setMostrarForm(false); setSubiendo(false); cargarTodo();
  }

  const clasificar = (p) => {
    if (p === null || p === undefined) return { texto: 'PDF', color: '#94a3b8' };
    if (p <= 1.4) return { texto: 'No adecuado', color: '#dc2626' };
    if (p <= 2.4) return { texto: 'Por debajo', color: '#f59e0b' };
    if (p <= 3.4) return { texto: 'Cumple', color: '#3b82f6' };
    if (p <= 4.4) return { texto: 'Excede', color: '#22c55e' };
    return { texto: 'Distinguido', color: '#8b5cf6' };
  };

  if (cargando) return <p style={{ padding: 20 }}>Cargando historial...</p>;

  return (
    <div>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h3 style={{ color: '#231F20', margin: 0 }}>📋 Historial: {colaborador.full_name || colaborador.email}</h3>
        <button onClick={() => setMostrarForm(!mostrarForm)} style={s.btnPrimario}>{mostrarForm ? 'Cancelar' : '+ Agregar al Historial'}</button>
      </div>
      <p style={{ color: '#64748b', margin: '4px 0 20px 0' }}>{colaborador.area} · {colaborador.seniority} · {colaborador.email}</p>
      {mostrarForm && (
        <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <button onClick={() => setModo('completa')} style={modo === 'completa' ? s.btnPrimario : s.btnInfo}>✏️ Evaluación Completa</button>
            <button onClick={() => setModo('pdf')} style={modo === 'pdf' ? s.btnPrimario : s.btnInfo}>📄 Subir PDF</button>
          </div>
          <div style={{ marginBottom: 12 }}><label style={{ fontSize: 12 }}>Fecha *</label><input type="date" value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
          {modo === 'completa' && (
            <div>
              <h4>Competencias - {colaborador.seniority || 'Analista'}</h4>
              {competencias.map(comp => (
                <div key={comp.id} style={{ ...s.competenciaCard, background: 'white' }}>
                  <div style={s.competenciaHeader}><div><h5>{comp.nombre}</h5><p style={{ fontSize: 12, color: '#64748b' }}>{comp.descripcion}</p></div><button onClick={() => setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] })} style={s.btnInfo}>{showInfo[comp.id] ? '🔼' : '🔽'}</button></div>
                  <div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => setRatingsHist({ ...ratingsHist, [comp.id]: r })} style={{ ...s.ratingBtn, backgroundColor: ratingsHist[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratingsHist[comp.id] === r ? 'white' : '#475569' }}>{r}</button>)}</div>
                  {showInfo[comp.id] && (<div style={s.ratingInfoBox}>{[1,2,3,4,5].map(r => <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>)}</div>)}
                  <textarea value={comentariosHist[comp.id] || ''} onChange={e => setComentariosHist({ ...comentariosHist, [comp.id]: e.target.value })} placeholder="Comentario" style={s.textareaSmall} />
                </div>
              ))}
              <div style={{ marginTop: 12 }}><label>Comentarios Finales</label><textarea value={comentariosFinalesHist} onChange={e => setComentariosFinalesHist(e.target.value)} style={{ ...s.textarea, minHeight: 60 }} /></div>
              <button onClick={guardarEvaluacionCompleta} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 12 }}>💾 Guardar</button>
            </div>
          )}
          {modo === 'pdf' && (
            <div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div><label>Rating</label><select value={nuevoRating} onChange={e => setNuevoRating(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }}><option value="">-</option><option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option></select></div>
                <div style={{ flex: 1 }}><label>Comentario</label><input type="text" value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><div style={{ flex: 1 }}><label>Archivo PDF *</label><input type="file" accept=".pdf" onChange={e => setArchivo(e.target.files[0])} /></div><button onClick={subirPDF} disabled={subiendo} style={{ ...s.btnPrimario, background: '#f59e0b' }}>{subiendo ? '⏳' : '📄 Subir PDF'}</button></div>
            </div>
          )}
        </div>
      )}
      {historicas.length === 0 ? <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p style={{ color: '#94a3b8' }}>No hay evaluaciones históricas.</p></div> : (
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th><th style={th}>Clasificación</th><th style={th}>Comentarios</th><th style={th}>Archivo</th></tr></thead>
          <tbody>{historicas.map(h => { const c = clasificar(h.rating_final); return (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={{ ...td, fontWeight: 700, color: c.color, fontSize: 16 }}>{h.rating_final || '-'}</td><td style={{ ...td, color: c.color }}>{c.texto}</td><td style={td}>{h.comentarios || '-'}</td><td style={td}>{h.archivo_url ? <a href={h.archivo_url} target="_blank" style={{ background: '#f59e0b', color: 'white', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontSize: 12 }}>📄 Ver PDF</a> : '-'}</td></tr>)})}</tbody></table></div>
      )}
    </div>
  );
}

function HistorialLider({ colaborador, onVolver }) {
  const [historicas, setHistoricas] = useState([]); const [cargando, setCargando] = useState(true);
  useEffect(() => { (async () => { setCargando(true); const { data } = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false }); setHistoricas(data || []); setCargando(false); })(); }, [colaborador.id]);
  const clasificar = (p) => { if (p === null || p === undefined) return { texto: 'PDF', color: '#94a3b8' }; if (p <= 1.4) return { texto: 'No adecuado', color: '#dc2626' }; if (p <= 2.4) return { texto: 'Por debajo', color: '#f59e0b' }; if (p <= 3.4) return { texto: 'Cumple', color: '#3b82f6' }; if (p <= 4.4) return { texto: 'Excede', color: '#22c55e' }; return { texto: 'Distinguido', color: '#8b5cf6' }; };
  if (cargando) return <p>Cargando...</p>;
  return (
    <div><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📋 Historial: {colaborador.full_name || colaborador.email}</h3>
      {historicas.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40 }}>No hay evaluaciones históricas.</p> : (
        <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th><th style={th}>Clasificación</th><th style={th}>Comentarios</th><th style={th}>Archivo</th></tr></thead>
          <tbody>{historicas.map(h => { const c = clasificar(h.rating_final); return (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={{ ...td, fontWeight: 700, color: c.color, fontSize: 16 }}>{h.rating_final || '-'}</td><td style={{ ...td, color: c.color }}>{c.texto}</td><td style={td}>{h.comentarios || '-'}</td><td style={td}>{h.archivo_url ? <a href={h.archivo_url} target="_blank" style={{ background: '#f59e0b', color: 'white', padding: '6px 12px', borderRadius: 6, textDecoration: 'none', fontSize: 12 }}>📄 Ver PDF</a> : '-'}</td></tr>)})}</tbody></table></div>
      )}
    </div>
  );
}

function EvaluacionesAdmin({ onVerHistorial }) {
  const [evaluaciones, setEvaluaciones] = useState([]); const [cargando, setCargando] = useState(true); const [detalleVisible, setDetalleVisible] = useState(null);
  useEffect(() => { (async () => { const { data } = await supabase.from('evaluaciones').select('*, colaborador:colaborador_id(email, full_name, area, id), evaluador:evaluador_id(email, full_name), puntuaciones(*, competencias(nombre))').order('created_at', { ascending: false }); setEvaluaciones(data || []); setCargando(false); })(); }, []);
  if (cargando) return <p>Cargando...</p>;
  return (
    <div style={s.tarjetaStat}><h4>📋 Evaluaciones ({evaluaciones.length})</h4>
      <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}><thead><tr><th style={th}>Colaborador</th><th style={th}>Área</th><th style={th}>Tipo</th><th style={th}>Evaluador</th><th style={th}>Estado</th><th style={th}>Calibrado</th><th style={th}>Fecha</th><th style={th}>Ver</th><th style={th}>Hist</th></tr></thead>
        <tbody>{evaluaciones.map(ev => (
          <tr key={ev.id}><td style={td}>{ev.colaborador?.full_name || ev.colaborador?.email || '-'}</td><td style={td}>{ev.colaborador?.area || '-'}</td>
            <td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ev.tipo_evaluacion === 'autoevaluacion' ? '#D4D2C6' : '#231F20', color: ev.tipo_evaluacion === 'autoevaluacion' ? '#231F20' : '#D4D2C6' }}>{ev.tipo_evaluacion === 'autoevaluacion' ? '👤 Auto' : '👥 Líder'}</span></td>
            <td style={td}>{ev.evaluador?.full_name || ev.evaluador?.email || '-'}</td>
            <td style={td}><span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ev.estado === 'enviado' ? '#231F20' : '#D4D2C6', color: 'white' }}>{ev.estado === 'enviado' ? '✅ Enviada' : '📝 Borrador'}</span></td>
            <td style={td}>{ev.rating_calibrado ? <span>🎯 {ev.rating_calibrado}</span> : '-'}</td>
            <td style={td}>{new Date(ev.created_at).toLocaleDateString('es-AR')}</td>
            <td style={td}><button onClick={() => setDetalleVisible(ev.id)} style={{ background: '#231F20', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}>👁️</button></td>
            <td style={td}><button onClick={() => onVerHistorial && ev.colaborador && onVerHistorial(ev.colaborador)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>📋</button></td>
          </tr>
        ))}</tbody></table></div>
    </div>
  );
}

// =============================================
// CALIBRACIÓN COMPLETA CON PDF Y ENVIAR
// =============================================
function PanelCalibracion({ colaboradores, onVerHistorial }) {
  const [datos, setDatos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [filtroArea, setFiltroArea] = useState('Todas');
  const [areas, setAreas] = useState([]);

  useEffect(() => { cargarDatos(); }, []);

  async function cargarDatos() {
    setCargando(true);
    const { data: todasEvals } = await supabase.from('evaluaciones').select('*, puntuaciones(*, competencias(nombre)), colaborador:colaborador_id(*)').in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']).order('created_at', { ascending: false });
    const mapa = {};
    (todasEvals || []).forEach(ev => {
      if (!ev.colaborador) return;
      if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, autoevaluacion: null, evaluacionLider: null };
      if (ev.tipo_evaluacion === 'autoevaluacion') mapa[ev.colaborador_id].autoevaluacion = ev;
      if (ev.tipo_evaluacion === 'evaluacion_lider') mapa[ev.colaborador_id].evaluacionLider = ev;
    });
    colaboradores.forEach(col => { if (!mapa[col.id]) mapa[col.id] = { colaborador: col, autoevaluacion: null, evaluacionLider: null }; });
    const resultado = Object.values(mapa).map(d => {
      const calc = (p) => { if (!p || p.length === 0) return null; const v = p.map(x => x.rating).filter(r => r > 0); return v.length === 0 ? null : (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1); };
      return { ...d, promAuto: calc(d.autoevaluacion?.puntuaciones), promLider: calc(d.evaluacionLider?.puntuaciones), gap: calc(d.autoevaluacion?.puntuaciones) && calc(d.evaluacionLider?.puntuaciones) ? (parseFloat(calc(d.evaluacionLider?.puntuaciones)) - parseFloat(calc(d.autoevaluacion?.puntuaciones))).toFixed(1) : null, ratingFinal: d.evaluacionLider?.rating_calibrado || null };
    });
    setAreas(['Todas', ...new Set(resultado.map(d => d.colaborador.area).filter(Boolean))]);
    setDatos(resultado); setCargando(false);
  }

  async function guardarCalibracion(evaluacionId, rating) { 
    setGuardando(true); 
    await supabase.from('evaluaciones').update({ rating_calibrado: rating }).eq('id', evaluacionId); 
    setDatos(prev => prev.map(d => d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating } : d)); 
    setGuardando(false); 
  }

  function clasificarFull(prom) {
    if (!prom) return { texto: '-', desc: '' }; const p = parseFloat(prom);
    if (p <= 1.4) return { texto: 'No adecuado', desc: 'Desempeño muy por debajo de lo esperado para el rol. Punto crítico.' };
    if (p <= 2.4) return { texto: 'Por debajo de lo esperado', desc: 'Desempeño no acorde a lo esperado en el rol.' };
    if (p <= 3.4) return { texto: 'Cumple con las expectativas', desc: 'Cumple con lo esperado para su rol.' };
    if (p <= 4.4) return { texto: 'Excede las expectativas', desc: 'Su desempeño es superior a lo esperado, genera valor agregado.' };
    return { texto: 'Desempeño distinguido', desc: 'Su desempeño es muy superior a lo esperado, genera valor agregado de manera significativa y constante.' };
  }

  function generarPDF(d) {
    const pdf = new jsPDF();
    const NEGRO = '#231F20'; const BEIGE = '#D4D2C6'; const pageWidth = 210; const marginX = 15; let y = 28;
    function agregarCabecera() { try { pdf.addImage('/logo.jpg', 'JPEG', marginX, 8, 30, 15); } catch(e) {} pdf.setDrawColor(BEIGE); pdf.setLineWidth(0.5); pdf.line(marginX, 26, pageWidth - marginX, 26); }
    function agregarPie() { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor('#94a3b8'); pdf.text('Fabric Group - ' + new Date().toLocaleDateString('es-AR'), marginX, 292); }
    agregarCabecera();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(NEGRO); pdf.text('EVALUACIÓN DE DESEMPEÑO', marginX, y); y += 7;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(`Colaborador: ${d.colaborador.full_name || d.colaborador.email}`, marginX, y); y += 5;
    pdf.text(`Email: ${d.colaborador.email}`, marginX, y); y += 5;
    pdf.text(`Área: ${d.colaborador.area || '-'}   |   Seniority: ${d.colaborador.seniority || '-'}   |   Fecha: ${new Date().toLocaleDateString('es-AR')}`, marginX, y); y += 8;
    const autoPunts = {}, autoComs = {}; (d.autoevaluacion?.puntuaciones || []).forEach(p => { autoPunts[p.competencia_id] = p.rating; autoComs[p.competencia_id] = p.comentario || ''; });
    const liderPunts = {}, liderComs = {}; (d.evaluacionLider?.puntuaciones || []).forEach(p => { liderPunts[p.competencia_id] = p.rating; liderComs[p.competencia_id] = p.comentario || ''; });
    const todasComps = [...new Set([...Object.keys(autoPunts), ...Object.keys(liderPunts)])];
    const compsInfo = {}; (d.autoevaluacion?.puntuaciones || []).concat(d.evaluacionLider?.puntuaciones || []).forEach(p => { if (!compsInfo[p.competencia_id]) compsInfo[p.competencia_id] = p.competencias?.nombre || 'Competencia'; });
    if (todasComps.length > 0) {
      const colComp = marginX, colAutoR = 57, colAutoC = 68, colLiderR = 118, colLiderC = 129;
      pdf.setFillColor(NEGRO); pdf.rect(marginX, y, pageWidth - (marginX * 2), 7, 'F'); pdf.setTextColor('#FFFFFF'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6);
      pdf.text('Competencia', colComp + 1, y + 5); pdf.text('A', colAutoR, y + 5); pdf.text('Comentario Autoevaluación', colAutoC, y + 5); pdf.text('L', colLiderR, y + 5); pdf.text('Comentario Líder', colLiderC, y + 5);
      y += 9; pdf.setTextColor(NEGRO);
      todasComps.forEach((compId, index) => {
        const nombre = (compsInfo[compId] || 'Competencia').substring(0, 18); const autoR = String(autoPunts[compId] || '-'), liderR = String(liderPunts[compId] || '-');
        const autoC = autoComs[compId] || '-', liderC = liderComs[compId] || '-';
        const lineasAuto = pdf.splitTextToSize(autoC, 44), lineasLider = pdf.splitTextToSize(liderC, 58); const altura = Math.max(7, Math.max(lineasAuto.length, lineasLider.length) * 3.5);
        if (y + altura > 275) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; }
        if (index % 2 === 0) { pdf.setFillColor(248, 248, 248); pdf.rect(marginX, y - 2, pageWidth - (marginX * 2), altura + 1, 'F'); }
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.text(nombre, colComp + 1, y); pdf.setFont('helvetica', 'normal');
        pdf.setFillColor(BEIGE); pdf.circle(colAutoR + 4, y - 1.5, 3.5, 'F'); pdf.setTextColor(NEGRO); pdf.setFontSize(6.5); pdf.text(autoR, colAutoR + 2.5, y + 0.5);
        lineasAuto.forEach((l, i) => pdf.text(l, colAutoC, y + (i * 3.2)));
        pdf.setFillColor(NEGRO); pdf.circle(colLiderR + 4, y - 1.5, 3.5, 'F'); pdf.setTextColor('#FFFFFF'); pdf.setFontSize(6.5); pdf.text(liderR, colLiderR + 2.5, y + 0.5); pdf.setTextColor(NEGRO);
        lineasLider.forEach((l, i) => pdf.text(l, colLiderC, y + (i * 3.2)));
        y += altura + 1;
      });
    }
    y += 8; if (y > 250) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; }
    const rf = d.ratingFinal || '-'; const clasif = clasificarFull(rf);
    pdf.setFillColor(NEGRO); pdf.rect(marginX, y, pageWidth - (marginX * 2), 20, 'F'); pdf.setTextColor('#FFFFFF'); pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11); pdf.text('RESULTADO FINAL', marginX + 4, y + 8); pdf.setFontSize(15); pdf.text(`${rf}`, marginX + 4, y + 17);
    pdf.setFontSize(9); pdf.text(`${clasif.texto}`, marginX + 18, y + 15); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.text(clasif.desc, marginX + 18, y + 19);
    agregarPie(); return pdf;
  }

  function verPDF(d) { generarPDF(d).save(`Evaluacion_${(d.colaborador.full_name || d.colaborador.email).replace(/\s/g, '_')}.pdf`); }
  
  function enviarPDF(d) { 
    generarPDF(d).save(`Evaluacion_${(d.colaborador.full_name || d.colaborador.email).replace(/\s/g, '_')}.pdf`); 
    let liderEmail = ''; 
    if (d.evaluacionLider?.evaluador_id) { 
      supabase.from('profiles').select('email').eq('id', d.evaluacionLider.evaluador_id).single().then(({ data: l }) => { 
        abrirGmail(d.colaborador.email, l?.email || ''); 
      }); 
    } else { 
      abrirGmail(d.colaborador.email, ''); 
    } 
  }

  const clasificar = (prom) => { if (!prom) return { texto: '-', color: '#94a3b8' }; const p = parseFloat(prom); if (p <= 1.4) return { texto: 'No adecuado', color: '#dc2626' }; if (p <= 2.4) return { texto: 'Por debajo', color: '#f59e0b' }; if (p <= 3.4) return { texto: 'Cumple', color: '#3b82f6' }; if (p <= 4.4) return { texto: 'Excede', color: '#22c55e' }; return { texto: 'Distinguido', color: '#8b5cf6' }; };
  const datosFiltrados = filtroArea === 'Todas' ? datos : datos.filter(d => d.colaborador.area === filtroArea);

  if (cargando) return <p style={{ padding: 20 }}>⏳ Cargando datos de calibración...</p>;

  return (
    <div style={{ ...s.tarjetaStat }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#231F20' }}>🎯 Calibración - Auto vs Líder</h3>
        <select value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14, background: 'white' }}>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select>
      </div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Comparación de autoevaluación y evaluación del líder. Define el rating final calibrado.</p>
      {datosFiltrados.length === 0 ? <p style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No hay datos para mostrar.</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1300px' }}>
            <thead><tr style={{ borderBottom: '2px solid #D4D2C6' }}><th style={th}>Colaborador</th><th style={th}>Área</th><th style={th}>Seniority</th><th style={th}>Auto</th><th style={th}>Líder</th><th style={th}>GAP</th><th style={th}>Calibrado</th><th style={th}>Historial</th><th style={th}>PDF</th><th style={th}>Enviar</th></tr></thead>
            <tbody>{datosFiltrados.map(d => { const clasFinal = clasificar(d.ratingFinal); return (
              <tr key={d.colaborador.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td>
                <td style={td}>{d.colaborador.area || '-'}</td>
                <td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>{d.colaborador.seniority || '-'}</span></td>
                <td style={{ ...td, textAlign: 'center', fontSize: 16, fontWeight: 700, color: clasificar(d.promAuto).color }}>{d.promAuto || '-'}</td>
                <td style={{ ...td, textAlign: 'center', fontSize: 16, fontWeight: 700, color: clasificar(d.promLider).color }}>{d.promLider || '-'}</td>
                <td style={{ ...td, textAlign: 'center', fontSize: 14, fontWeight: 700, color: d.gap ? (Math.abs(d.gap) <= 0.5 ? '#231F20' : Math.abs(d.gap) <= 1 ? '#f59e0b' : '#dc2626') : '#94a3b8' }}>{d.gap ? (d.gap > 0 ? '+' : '') + d.gap : '-'}</td>
                <td style={{ ...td, textAlign: 'center' }}>{d.promLider ? <div><select value={d.ratingFinal || ''} onChange={(e) => guardarCalibracion(d.evaluacionLider.id, parseFloat(e.target.value))} style={{ padding: '4px 8px', borderRadius: 6, border: `2px solid ${clasFinal.color}`, fontSize: 13, fontWeight: 600, color: clasFinal.color, background: 'white' }} disabled={guardando}><option value="">Sel.</option><option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option></select>{d.ratingFinal && <div style={{ fontSize: 10, color: clasFinal.color, marginTop: 2 }}>{clasFinal.texto}</div>}</div> : <span style={{ color: '#94a3b8' }}>Sin eval</span>}</td>
                <td style={td}><button onClick={() => onVerHistorial && onVerHistorial(d.colaborador)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>📋</button></td>
                <td style={td}><button onClick={() => verPDF(d)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>👁️ PDF</button></td>
                <td style={td}>{d.ratingFinal ? <button onClick={() => enviarPDF(d)} style={{ background: '#231F20', color: '#D4D2C6', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📧 Enviar</button> : <span style={{ color: '#94a3b8' }}>-</span>}</td>
              </tr>
            )})}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EquipoLider() {
  const [equipo, setEquipo] = useState([]); const [evaluaciones, setEvaluaciones] = useState({}); const [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null); const [historialVisible, setHistorialVisible] = useState(null);
  useEffect(() => { (async () => { const { data: { session } } = await supabase.auth.getSession(); if (!session) return; const { data } = await supabase.from('profiles').select('*').eq('leader_id', session.user.id); setEquipo(data || []); if (data) { const evals = {}; for (const col of data) { const { data: a } = await supabase.from('evaluaciones').select('*').eq('colaborador_id', col.id).eq('tipo_evaluacion', 'autoevaluacion').maybeSingle(); const { data: l } = await supabase.from('evaluaciones').select('*').eq('colaborador_id', col.id).eq('tipo_evaluacion', 'evaluacion_lider').maybeSingle(); evals[col.id] = { autoevaluacion: a, evaluacionLider: l }; } setEvaluaciones(evals); } })(); }, []);
  if (colaboradorSeleccionado) return <EvaluacionLider colaborador={colaboradorSeleccionado} onVolver={() => setColaboradorSeleccionado(null)} />;
  if (historialVisible) return <HistorialLider colaborador={historialVisible} onVolver={() => setHistorialVisible(null)} />;
  return (
    <div><h3>👥 Mi Equipo ({equipo.length})</h3>
      {equipo.map(col => { const lider = evaluaciones[col.id]?.evaluacionLider; return (
        <div key={col.id} style={{ ...s.tarjetaStat, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><strong>{col.full_name || col.email}</strong><p style={{ fontSize: 12, color: '#64748b' }}>{col.area} · {col.seniority}</p></div>
          <div style={{ display: 'flex', gap: 8 }}><button onClick={() => setHistorialVisible(col)} style={{ ...s.btnInfo, background: '#D4D2C6', color: '#231F20', fontWeight: 600 }}>📋 Historial</button><button onClick={() => setColaboradorSeleccionado(col)} style={s.btnPrimario}>{lider ? '✏️ Editar' : '📝 Evaluar'}</button></div>
        </div>
      )})}
    </div>
  );
}

function PanelLider() { return <EquipoLider />; }
function PanelColaboradorConEquipo({ userId, seniority, email, nombre }) {
  const [vista, setVista] = useState('autoevaluacion'); const [tieneEquipo, setTieneEquipo] = useState(false);
  useEffect(() => { (async () => { const { data: { session } } = await supabase.auth.getSession(); if (session) { const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', session.user.id); setTieneEquipo((count || 0) > 0); } })(); }, []);
  return (
    <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={() => setVista('autoevaluacion')} style={vista === 'autoevaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluación</button>{tieneEquipo && <button onClick={() => setVista('equipo')} style={vista === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>}</div>
      {vista === 'autoevaluacion' && <PanelColaborador userId={userId} seniority={seniority} email={email} nombre={nombre} />}
      {vista === 'equipo' && tieneEquipo && <EquipoLider />}
    </div>
  );
}

function EvaluacionLider({ colaborador, onVolver }) {
  const [competencias, setCompetencias] = useState([]); const [puntuacionesAuto, setPuntuacionesAuto] = useState({}); const [autoevaluacion, setAutoevaluacion] = useState(null);
  const [evaluacionLider, setEvaluacionLider] = useState(null); const [ratings, setRatings] = useState({}); const [comentarios, setComentarios] = useState({});
  const [comentariosFinales, setComentariosFinales] = useState(''); const [mensaje, setMensaje] = useState(''); const [cargando, setCargando] = useState(true);
  useEffect(() => { (async () => { const { data: comps } = await supabase.from('competencias').select('*').eq('aplica_a', colaborador.seniority || 'Analista'); setCompetencias(comps || []); const { data: auto } = await supabase.from('evaluaciones').select('*, puntuaciones(*)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'autoevaluacion').maybeSingle(); if (auto) { setAutoevaluacion(auto); const pa = {}; (auto.puntuaciones || []).forEach(p => { pa[p.competencia_id] = p.rating; }); setPuntuacionesAuto(pa); } const { data: { session } } = await supabase.auth.getSession(); const { data: liderEval } = await supabase.from('evaluaciones').select('*, puntuaciones(*)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').maybeSingle(); if (liderEval) { setEvaluacionLider(liderEval); setComentariosFinales(liderEval.comentarios_finales || ''); const rm = {}; const cm = {}; (liderEval.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComentarios(cm); } else { const { data: nueva } = await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador' }).select().single(); setEvaluacionLider(nueva); } setCargando(false); })(); }, []);
  async function guardar() { await supabase.from('evaluaciones').update({ comentarios_finales: comentariosFinales, updated_at: new Date() }).eq('id', evaluacionLider.id); for (const [compId, rating] of Object.entries(ratings)) { const com = comentarios[compId] || ''; const { data: ex } = await supabase.from('puntuaciones').select('id').eq('evaluacion_id', evaluacionLider.id).eq('competencia_id', compId).maybeSingle(); if (ex) { await supabase.from('puntuaciones').update({ rating, comentario: com }).eq('id', ex.id); } else { await supabase.from('puntuaciones').insert({ evaluacion_id: evaluacionLider.id, competencia_id: compId, rating, comentario: com }); } } setMensaje('✅ Guardado'); setTimeout(() => setMensaje(''), 2500); }
  async function enviar() { const faltantes = competencias.filter(c => !comentarios[c.id]?.trim()); if (faltantes.length > 0) { setMensaje(`❌ Completa: ${faltantes.map(c => c.nombre).join(', ')}`); return; } if (!comentariosFinales?.trim()) { setMensaje('❌ Completa Comentarios Finales'); return; } await guardar(); await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', evaluacionLider.id); setMensaje('🎉 Enviada'); setEvaluacionLider({ ...evaluacionLider, estado: 'enviado' }); }
  if (cargando) return <p>Cargando...</p>; const enviada = evaluacionLider?.estado === 'enviado';
  return (
    <div style={{ maxWidth: 900 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📝 Evaluando a: {colaborador.full_name || colaborador.email}</h3><p>{colaborador.area} · {colaborador.seniority}</p>
      {competencias.map(comp => (<div key={comp.id} style={s.competenciaCard}><h5>{comp.nombre}</h5><div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => !enviada && setRatings({...ratings, [comp.id]: r})} style={{...s.ratingBtn, backgroundColor: ratings[comp.id]===r?'#231F20':'#f1f5f9', color: ratings[comp.id]===r?'white':'#475569'}} disabled={enviada}>{r}</button>)}</div><textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({...comentarios, [comp.id]: e.target.value})} placeholder="Comentario obligatorio" style={s.textareaSmall} disabled={enviada} /></div>))}
      <SeccionText titulo="📝 Comentarios Finales" valor={comentariosFinales} onChange={setComentariosFinales} disabled={enviada} />{mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      {!enviada && <div style={{ display: 'flex', gap: 12 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>}
    </div>
  );
}

function PanelColaborador({ userId, seniority, email, nombre }) {
  const [evalData, setEvalData] = useState(null); const [competencias, setCompetencias] = useState([]); const [ratings, setRatings] = useState({}); const [comentarios, setComentarios] = useState({}); const [comentariosFinales, setComentariosFinales] = useState(''); const [mensaje, setMensaje] = useState(''); const [cargando, setCargando] = useState(true);
  useEffect(() => { (async () => { const { data: comps } = await supabase.from('competencias').select('*').eq('aplica_a', seniority || 'Analista'); setCompetencias(comps || []); const { data: ev } = await supabase.from('evaluaciones').select('*').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').single(); if (ev) { setEvalData(ev); setComentariosFinales(ev.comentarios_finales || ''); const { data: punts } = await supabase.from('puntuaciones').select('*').eq('evaluacion_id', ev.id); const rm = {}; const cm = {}; (punts || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComentarios(cm); } else { const { data: nueva } = await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador' }).select().single(); setEvalData(nueva); } setCargando(false); })(); }, []);
  async function guardar() { await supabase.from('evaluaciones').update({ comentarios_finales: comentariosFinales, updated_at: new Date() }).eq('id', evalData.id); for (const [compId, rating] of Object.entries(ratings)) { const com = comentarios[compId] || ''; const { data: ex } = await supabase.from('puntuaciones').select('id').eq('evaluacion_id', evalData.id).eq('competencia_id', compId).single(); if (ex) { await supabase.from('puntuaciones').update({ rating, comentario: com }).eq('id', ex.id); } else { await supabase.from('puntuaciones').insert({ evaluacion_id: evalData.id, competencia_id: compId, rating, comentario: com }); } } setMensaje('✅ Guardado'); setTimeout(() => setMensaje(''), 2500); }
  async function enviar() { const faltantes = competencias.filter(c => !comentarios[c.id]?.trim()); if (faltantes.length > 0) { setMensaje(`❌ Completa: ${faltantes.map(c => c.nombre).join(', ')}`); return; } if (!comentariosFinales?.trim()) { setMensaje('❌ Completa Comentarios Finales'); return; } await guardar(); await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', evalData.id); setMensaje('🎉 Enviada'); setEvalData({ ...evalData, estado: 'enviado' }); }
  if (cargando) return <p>Cargando...</p>; const enviada = evalData?.estado === 'enviado';
  return (
    <div style={{ maxWidth: 900 }}><h3>📝 Mi Autoevaluación</h3><p>Seniority: <strong>{seniority || 'No definido'}</strong></p><p>Estado: <strong style={{ color: enviada ? '#231F20' : '#f59e0b' }}>{enviada ? '✅ Enviada' : '📝 En progreso'}</strong></p>
      {competencias.map(comp => (<div key={comp.id} style={s.competenciaCard}><h5>{comp.nombre}</h5><div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => !enviada && setRatings({...ratings, [comp.id]: r})} style={{...s.ratingBtn, backgroundColor: ratings[comp.id]===r?'#231F20':'#f1f5f9', color: ratings[comp.id]===r?'white':'#475569'}} disabled={enviada}>{r}</button>)}</div><textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({...comentarios, [comp.id]: e.target.value})} placeholder="Comentario obligatorio" style={s.textareaSmall} disabled={enviada} /></div>))}
      <SeccionText titulo="📝 Comentarios Finales" valor={comentariosFinales} onChange={setComentariosFinales} disabled={enviada} />{mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      {!enviada && <div style={{ display: 'flex', gap: 12 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>}
    </div>
  );
}

function SeccionText({ titulo, valor, onChange, disabled }) { return <div style={{ marginBottom: 24 }}><h4 style={s.seccionTitulo}>{titulo}</h4><textarea value={valor} onChange={e => onChange(e.target.value)} style={s.textarea} disabled={disabled} /></div>; }
function RatingDesc({ competenciaId, rating }) { const [desc, setDesc] = useState('...'); useEffect(() => { (async () => { const { data } = await supabase.from('rating_descriptions').select('titulo, descripcion').eq('competencia_id', competenciaId).eq('rating', rating).single(); if (data) setDesc(`${data.titulo}: ${data.descripcion}`); })(); }, [competenciaId, rating]); return <span>{desc}</span>; }
function CalcularPromedio({ ratings, competencias }) { if (!ratings || Object.keys(ratings).length === 0) return null; const valores = Object.values(ratings).filter(r => r > 0); if (valores.length === 0) return null; const prom = valores.reduce((a, b) => a + b, 0) / valores.length; let clasif = '', color = ''; if (prom <= 1.4) { clasif = 'No adecuado'; color = '#dc2626'; } else if (prom <= 2.4) { clasif = 'Por debajo'; color = '#f59e0b'; } else if (prom <= 3.4) { clasif = 'Cumple'; color = '#3b82f6'; } else if (prom <= 4.4) { clasif = 'Excede'; color = '#22c55e'; } else { clasif = 'Distinguido'; color = '#8b5cf6'; } return (<div style={{ marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: '2px solid #231F20', textAlign: 'center' }}><p>Resultado Final</p><p style={{ fontSize: 48, fontWeight: 700, color: '#231F20' }}>{prom.toFixed(1)}</p><p style={{ fontSize: 18, fontWeight: 600, color }}>{clasif}</p></div>); }

const th = { textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: '11px' };
const td = { padding: '6px 8px', fontSize: '13px' };
const s = {
  centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#231F20', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flexWrap: 'wrap', gap: 12, position: 'sticky', top: 0, zIndex: 100 },
  headerIzq: { display: 'flex', alignItems: 'center', gap: 12 }, badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#D4D2C6', color: '#231F20' },
  headerDer: { display: 'flex', alignItems: 'center', gap: 14 }, email: { fontSize: 14, color: '#D4D2C6' },
  btnSalir: { padding: '8px 16px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 },
  main: { padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' },
  tarjetaBienvenida: { background: 'white', padding: '20px 24px', borderRadius: 12, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #D4D2C6' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
  tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #D4D2C6' },
  tarjetaPlaceholder: { background: 'white', padding: 40, borderRadius: 12, textAlign: 'center', color: '#64748b' },
  seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#231F20', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #D4D2C6' },
  competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14, border: '1px solid #D4D2C6' },
  btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 },
  ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' },
  ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ratingInfoBox: { background: 'white', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #D4D2C6' },
  ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 },
  textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'white' },
  textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'white' },
  btnPrimario: { padding: '12px 24px', background: '#231F20', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  btnSecundario: { padding: '12px 24px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  mensajeToast: { padding: '12px 20px', background: '#D4D2C6', borderRadius: 8, marginBottom: 16, color: '#231F20', fontWeight: 500, fontSize: 14, textAlign: 'center' },
  bannerEnviado: { padding: 20, background: '#D4D2C6', borderRadius: 10, color: '#231F20', fontWeight: 600, textAlign: 'center' }
};
