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

  async function descargarExcelCompleto() {
    const wb = XLSX.utils.book_new();
    const dashboardRows = [
      { 'Indicador': 'Total Colaboradores', 'Valor': colaboradores.length },
      { 'Indicador': 'Total Evaluaciones', 'Valor': stats.total },
      { 'Indicador': 'Completadas', 'Valor': stats.enviadas },
      { 'Indicador': 'Pendientes', 'Valor': stats.pendientes },
      { 'Indicador': 'Progreso', 'Valor': pct + '%' },
      {},
      { 'Indicador': 'DISTRIBUCIÓN POR SENIORITY', 'Valor': '' },
      ...Object.entries(seniorityCounts).map(([s, c]) => ({ 'Indicador': s, 'Valor': c }))
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dashboardRows), 'Dashboard');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(colaboradores.map(c => ({
      'Nombre': c.full_name || '', 'Email': c.email, 'Área': c.area || '',
      'Seniority': c.seniority || '', 'Rol': c.role === 'admin_rrhh' ? 'Admin' : c.role === 'lider' ? 'Líder' : 'Colaborador',
      'Estado': c.activo ? 'Activo' : 'Inactivo'
    }))), 'Colaboradores');
    XLSX.writeFile(wb, 'Dashboard_RRHH.xlsx');
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

  function clasificarFull(prom) {
    if (!prom) return { texto: '-', desc: '' };
    const p = parseFloat(prom);
    if (p <= 1.4) return { texto: 'No adecuado', desc: 'Desempeño muy por debajo de lo esperado para el rol. Punto crítico.' };
    if (p <= 2.4) return { texto: 'Por debajo de lo esperado', desc: 'Desempeño no acorde a lo esperado en el rol.' };
    if (p <= 3.4) return { texto: 'Cumple con las expectativas', desc: 'Cumple con lo esperado para su rol.' };
    if (p <= 4.4) return { texto: 'Excede las expectativas', desc: 'Su desempeño es superior a lo esperado, genera valor agregado.' };
    return { texto: 'Desempeño distinguido', desc: 'Su desempeño es muy superior a lo esperado, genera valor agregado de manera significativa y constante.' };
  }

  function generarPDF(d) {
    const pdf = new jsPDF();
    const NEGRO = '#231F20'; const BEIGE = '#D4D2C6'; const pageWidth = 210; const marginX = 15; let y = 28;
    function agregarCabecera() { pdf.addImage('/logo.jpg', 'JPEG', marginX, 8, 30, 15); pdf.setDrawColor(BEIGE); pdf.setLineWidth(0.5); pdf.line(marginX, 26, pageWidth - marginX, 26); }
    function agregarPie() { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor('#94a3b8'); pdf.text('Fabric Group - ' + new Date().toLocaleDateString('es-AR'), marginX, 292); }
    agregarCabecera();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(NEGRO); pdf.text('EVALUACIÓN DE DESEMPEÑO', marginX, y); y += 7;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(`Colaborador: ${d.colaborador.full_name || d.colaborador.email}`, marginX, y); y += 5;
    pdf.text(`Email: ${d.colaborador.email}`, marginX, y); y += 5;
    pdf.text(`Área: ${d.colaborador.area || '-'}   |   Seniority: ${d.colaborador.seniority || '-'}   |   Fecha: ${new Date().toLocaleDateString('es-AR')}`, marginX, y); y += 8;
    const autoPunts = {}, autoComs = {};
    (d.autoevaluacion?.puntuaciones || []).forEach(p => { autoPunts[p.competencia_id] = p.rating; autoComs[p.competencia_id] = p.comentario || ''; });
    const liderPunts = {}, liderComs = {};
    (d.evaluacionLider?.puntuaciones || []).forEach(p => { liderPunts[p.competencia_id] = p.rating; liderComs[p.competencia_id] = p.comentario || ''; });
    const todasComps = [...new Set([...Object.keys(autoPunts), ...Object.keys(liderPunts)])];
    const compsInfo = {};
    (d.autoevaluacion?.puntuaciones || []).concat(d.evaluacionLider?.puntuaciones || []).forEach(p => { if (!compsInfo[p.competencia_id]) compsInfo[p.competencia_id] = p.competencias?.nombre || 'Competencia'; });
    if (todasComps.length > 0) {
      const colComp = marginX, colAutoR = 57, colAutoC = 68, colLiderR = 118, colLiderC = 129;
      pdf.setFillColor(NEGRO); pdf.rect(marginX, y, pageWidth - (marginX * 2), 7, 'F');
      pdf.setTextColor('#FFFFFF'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6);
      pdf.text('Competencia', colComp + 1, y + 5); pdf.text('A', colAutoR, y + 5); pdf.text('Comentario Autoevaluación', colAutoC, y + 5); pdf.text('L', colLiderR, y + 5); pdf.text('Comentario Líder', colLiderC, y + 5);
      y += 9; pdf.setTextColor(NEGRO);
      todasComps.forEach((compId, index) => {
        const nombre = (compsInfo[compId] || 'Competencia').substring(0, 18);
        const autoR = String(autoPunts[compId] || '-'), liderR = String(liderPunts[compId] || '-');
        const autoC = autoComs[compId] || '-', liderC = liderComs[compId] || '-';
        const lineasAuto = pdf.splitTextToSize(autoC, 44), lineasLider = pdf.splitTextToSize(liderC, 58);
        const altura = Math.max(7, Math.max(lineasAuto.length, lineasLider.length) * 3.5);
        if (y + altura > 275) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; }
        if (index % 2 === 0) { pdf.setFillColor(248, 248, 248); pdf.rect(marginX, y - 2, pageWidth - (marginX * 2), altura + 1, 'F'); }
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(6); pdf.text(nombre, colComp + 1, y); pdf.setFont('helvetica', 'normal');
        pdf.setFillColor(BEIGE); pdf.circle(colAutoR + 4, y - 1.5, 3.5, 'F'); pdf.setTextColor(NEGRO); pdf.setFontSize(6.5); pdf.text(autoR, colAutoR + 2.5, y + 0.5);
        lineasAuto.forEach((l, i) => pdf.text(l, colAutoC, y + (i * 3.2)));
        pdf.setFillColor(NEGRO); pdf.circle(colLiderR + 4, y - 1.5, 3.5, 'F'); pdf.setTextColor('#FFFFFF'); pdf.setFontSize(6.5); pdf.text(liderR, colLiderR + 2.5, y + 0.5); pdf.setTextColor(NEGRO);
        lineasLider.forEach((l, i) => pdf.text(l, colLiderC, y + (i * 3.2)));
        y += altura + 1; pdf.setDrawColor(230, 230, 230); pdf.setLineWidth(0.1); pdf.line(marginX, y, pageWidth - marginX, y); pdf.setLineWidth(0.5);
      });
      y += 5; if (y > 235) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; }
      const tieneComentarios = d.autoevaluacion?.comentarios_finales || d.evaluacionLider?.comentarios_finales;
      if (tieneComentarios) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('COMENTARIOS FINALES', marginX, y); y += 5;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5);
        if (d.autoevaluacion?.comentarios_finales) { if (y > 270) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; } pdf.text('Autoevaluación:', marginX, y); y += 4; pdf.splitTextToSize(d.autoevaluacion.comentarios_finales, pageWidth - (marginX * 2)).forEach(linea => { if (y > 282) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; } pdf.text(linea, marginX + 2, y); y += 3.5; }); y += 2; }
        if (d.evaluacionLider?.comentarios_finales) { if (y > 265) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; } pdf.text('Líder:', marginX, y); y += 4; pdf.splitTextToSize(d.evaluacionLider.comentarios_finales, pageWidth - (marginX * 2)).forEach(linea => { if (y > 282) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; } pdf.text(linea, marginX + 2, y); y += 3.5; }); }
      }
    }
    y += 8; if (y > 250) { agregarPie(); pdf.addPage(); agregarCabecera(); y = 30; }
    const rf = d.ratingFinal || '-'; const clasif = clasificarFull(rf);
    pdf.setFillColor(NEGRO); pdf.rect(marginX, y, pageWidth - (marginX * 2), 20, 'F');
    pdf.setTextColor('#FFFFFF'); pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11); pdf.text('RESULTADO FINAL', marginX + 4, y + 8); pdf.setFontSize(15); pdf.text(`${rf}`, marginX + 4, y + 17);
    pdf.setFontSize(9); pdf.text(`${clasif.texto}`, marginX + 18, y + 15);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6.5); pdf.text(clasif.desc, marginX + 18, y + 19);
    agregarPie(); return pdf;
  }

  function verPDF(d) { generarPDF(d).save(`Evaluacion_${d.colaborador.full_name || d.colaborador.email}.pdf`); }
  function enviarPDF(d) { generarPDF(d).save(`Evaluacion_${d.colaborador.full_name || d.colaborador.email}.pdf`); let liderEmail = ''; if (d.evaluacionLider?.evaluador_id) { supabase.from('profiles').select('email').eq('id', d.evaluacionLider.evaluador_id).single().then(({ data: l }) => { abrirGmail(d.colaborador.email, l?.email || ''); }); } else { abrirGmail(d.colaborador.email, ''); } }

  const clasificar = (prom) => { if (!prom) return { texto: '-', color: '#94a3b8' }; const p = parseFloat(prom); if (p <= 1.4) return { texto: 'No adecuado', color: '#dc2626' }; if (p <= 2.4) return { texto: 'Por debajo', color: '#f59e0b' }; if (p <= 3.4) return { texto: 'Cumple', color: '#3b82f6' }; if (p <= 4.4) return { texto: 'Excede', color: '#22c55e' }; return { texto: 'Distinguido', color: '#8b5cf6' }; };
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
            <thead><tr style={{ borderBottom: '2px solid #D4D2C6' }}><th style={th}>Colaborador</th><th style={th}>Área</th><th style={th}>Seniority</th><th style={th}>Auto</th><th style={th}>Líder</th><th style={th}>GAP</th><th style={th}>Calibrado</th><th style={th}>PDF</th><th style={th}>Enviar</th></tr></thead>
            <tbody>{datosFiltrados.map(d => { const clasFinal = clasificar(d.ratingFinal); return (
              <tr key={d.colaborador.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td><td style={td}>{d.colaborador.area || '-'}</td>
                <td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>{d.colaborador.seniority || '-'}</span></td>
                <td style={{ ...td, textAlign: 'center', fontSize: 16, fontWeight: 700, color: clasificar(d.promAuto).color }}>{d.promAuto || '-'}</td>
                <td style={{ ...td, textAlign: 'center', fontSize: 16, fontWeight: 700, color: clasificar(d.promLider).color }}>{d.promLider || '-'}</td>
                <td style={{ ...td, textAlign: 'center', fontSize: 14, fontWeight: 700, color: d.gap ? (Math.abs(d.gap) <= 0.5 ? '#231F20' : Math.abs(d.gap) <= 1 ? '#f59e0b' : '#dc2626') : '#94a3b8' }}>{d.gap ? (d.gap > 0 ? '+' : '') + d.gap : '-'}</td>
                <td style={{ ...td, textAlign: 'center' }}>{d.promLider ? <div><select value={d.ratingFinal || ''} onChange={(e) => guardarCalibracion(d.evaluacionLider.id, parseFloat(e.target.value))} style={{ padding: '4px 8px', borderRadius: 6, border: `2px solid ${clasFinal.color}`, fontSize: 13, fontWeight: 600, color: clasFinal.color, background: 'white' }} disabled={guardando}><option value="">Sel.</option><option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option></select>{d.ratingFinal && <div style={{ fontSize: 10, color: clasFinal.color, marginTop: 2 }}>{clasFinal.texto}</div>}</div> : <span style={{ color: '#94a3b8' }}>Sin eval</span>}</td>
                <td style={td}><button onClick={() => verPDF(d)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>👁️ PDF</button></td>
                <td style={td}>{d.ratingFinal ? <button onClick={() => enviarPDF(d)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📧 Enviar</button> : <span style={{ color: '#94a3b8' }}>-</span>}</td>
              </tr>
            )})}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EvaluacionesAdmin() {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [detalleVisible, setDetalleVisible] = useState(null);
  useEffect(() => { cargarEvaluaciones(); }, []);
  async function cargarEvaluaciones() { const { data } = await supabase.from('evaluaciones').select('*, colaborador:colaborador_id(email, full_name, area), evaluador:evaluador_id(email, full_name), puntuaciones(*, competencias(nombre))').order('created_at', { ascending: false }); setEvaluaciones(data || []); setCargando(false); }
  if (cargando) return <p style={{ padding: 20 }}>Cargando...</p>;
  return (
    <div style={{ ...s.tarjetaStat }}>
      <h4 style={{ margin: '0 0 16px 0', color: '#231F20' }}>📋 Evaluaciones ({evaluaciones.length})</h4>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 750 }}>
          <thead><tr style={{ borderBottom: '2px solid #D4D2C6' }}><th style={th}>Colaborador</th><th style={th}>Área</th><th style={th}>Tipo</th><th style={th}>Evaluador</th><th style={th}>Estado</th><th style={th}>Calibrado</th><th style={th}>Fecha</th><th style={th}>Ver</th></tr></thead>
          <tbody>{evaluaciones.map(ev => (
            <tr key={ev.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={td}>{ev.colaborador?.full_name || ev.colaborador?.email || '-'}</td><td style={td}>{ev.colaborador?.area || '-'}</td>
              <td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ev.tipo_evaluacion === 'autoevaluacion' ? '#D4D2C6' : '#231F20', color: ev.tipo_evaluacion === 'autoevaluacion' ? '#231F20' : '#D4D2C6' }}>{ev.tipo_evaluacion === 'autoevaluacion' ? '👤 Auto' : '👥 Líder'}</span></td>
              <td style={td}>{ev.evaluador?.full_name || ev.evaluador?.email || '-'}</td>
              <td style={td}><span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: ev.estado === 'enviado' ? '#231F20' : '#D4D2C6', color: 'white' }}>{ev.estado === 'enviado' ? '✅ Enviada' : '📝 Borrador'}</span></td>
              <td style={td}>{ev.rating_calibrado ? <span style={{ fontWeight: 700, color: '#231F20' }}>🎯 {ev.rating_calibrado}</span> : '-'}</td>
              <td style={{ ...td, fontSize: 12, color: '#64748b' }}>{new Date(ev.created_at).toLocaleDateString('es-AR')}</td>
              <td style={td}><button onClick={() => setDetalleVisible(ev.id)} style={{ background: '#231F20', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 14 }}>👁️</button></td>
            </tr>
          ))}</tbody>
        </table>
        {detalleVisible && evaluaciones.find(e => e.id === detalleVisible) && (() => { const ev = evaluaciones.find(e => e.id === detalleVisible); return (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 20 }} onClick={() => setDetalleVisible(null)}>
            <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 900, width: '95%', maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><h3 style={{ margin: 0, color: '#231F20' }}>📋 Detalle</h3><button onClick={() => setDetalleVisible(null)} style={{ background: '#D4D2C6', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 16 }}>✕</button></div>
              <p><strong>👤 Colaborador:</strong> {ev.colaborador?.full_name || '-'}</p><p><strong>📍 Área:</strong> {ev.colaborador?.area || '-'}</p><p><strong>📝 Tipo:</strong> {ev.tipo_evaluacion === 'autoevaluacion' ? 'Autoevaluación' : 'Evaluación de Líder'}</p><p><strong>👤 Evaluador:</strong> {ev.evaluador?.full_name || ev.evaluador?.email || '-'}</p><p><strong>📊 Estado:</strong> {ev.estado === 'enviado' ? '✅ Enviada' : '📝 Borrador'}</p>{ev.rating_calibrado && <p><strong>🎯 Rating Calibrado:</strong> {ev.rating_calibrado}</p>}<p><strong>📅 Fecha:</strong> {new Date(ev.created_at).toLocaleDateString('es-AR')}</p>
              <hr style={{ border: '1px solid #D4D2C6' }} />
              <h4 style={{ color: '#231F20' }}>📝 Comentarios por Competencia</h4>
              {ev.puntuaciones?.filter(p => p.comentario).map(p => <p key={p.id} style={{ color: '#475569', fontSize: 14, lineHeight: '1.6', wordBreak: 'break-word', whiteSpace: 'pre-wrap', margin: '4px 0' }}>• <strong>{p.competencias?.nombre}:</strong> {p.comentario}</p>)}
              {(!ev.puntuaciones || ev.puntuaciones.filter(p => p.comentario).length === 0) && <p style={{ color: '#94a3b8' }}>Sin comentarios por competencia</p>}
              <h4 style={{ marginTop: 16, color: '#231F20' }}>📝 Comentarios Finales</h4>
              <p style={{ color: '#475569', fontSize: 14, lineHeight: '1.6', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>{ev.comentarios_finales || 'Sin comentarios'}</p>
            </div>
          </div>
        )})()}
      </div>
    </div>
  );
}

function PanelLider() { return <EquipoLider />; }

function PanelColaboradorConEquipo({ userId, seniority, email, nombre }) {
  const [vista, setVista] = useState('autoevaluacion');
  const [tieneEquipo, setTieneEquipo] = useState(false);
  useEffect(() => { (async () => { const { data: { session } } = await supabase.auth.getSession(); if (session) { const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', session.user.id); setTieneEquipo((count || 0) > 0); } })(); }, []);
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setVista('autoevaluacion')} style={vista === 'autoevaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluación</button>
        {tieneEquipo && <button onClick={() => setVista('equipo')} style={vista === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>}
      </div>
      {vista === 'autoevaluacion' && <PanelColaborador userId={userId} seniority={seniority} email={email} nombre={nombre} />}
      {vista === 'equipo' && tieneEquipo && <EquipoLider />}
    </div>
  );
}

function EquipoLider() {
  const [equipo, setEquipo] = useState([]);
  const [evaluaciones, setEvaluaciones] = useState({});
  const [colaboradorSeleccionado, setColaboradorSeleccionado] = useState(null);
  useEffect(() => { cargarEquipo(); }, []);
  async function cargarEquipo() { const { data: { session } } = await supabase.auth.getSession(); if (!session) return; const { data } = await supabase.from('profiles').select('*').eq('leader_id', session.user.id); setEquipo(data || []); if (data) { const evals = {}; for (const col of data) { const { data: a } = await supabase.from('evaluaciones').select('*').eq('colaborador_id', col.id).eq('tipo_evaluacion', 'autoevaluacion').maybeSingle(); const { data: l } = await supabase.from('evaluaciones').select('*').eq('colaborador_id', col.id).eq('tipo_evaluacion', 'evaluacion_lider').maybeSingle(); evals[col.id] = { autoevaluacion: a, evaluacionLider: l }; } setEvaluaciones(evals); } }
  if (colaboradorSeleccionado) return <EvaluacionLider colaborador={colaboradorSeleccionado} onVolver={() => { setColaboradorSeleccionado(null); cargarEquipo(); }} />;
  return (
    <div>
      <h3 style={{ marginBottom: 20, color: '#231F20' }}>👥 Mi Equipo ({equipo.length})</h3>
      {equipo.length === 0 ? <div style={s.tarjetaPlaceholder}><p>No tienes colaboradores asignados.</p></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {equipo.map(col => { const auto = evaluaciones[col.id]?.autoevaluacion; const lider = evaluaciones[col.id]?.evaluacionLider; return (
            <div key={col.id} style={{ ...s.tarjetaStat, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ flex: 1 }}><h4 style={{ margin: 0, color: '#231F20' }}>{col.full_name || col.email}</h4><p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>{col.area} · {col.seniority}</p><div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}><span>📝 Auto: <strong style={{ color: auto?.estado === 'enviado' ? '#231F20' : '#f59e0b' }}>{auto?.estado === 'enviado' ? 'Enviada' : 'Pendiente'}</strong></span><span>👥 Mi eval: <strong style={{ color: lider?.estado === 'enviado' ? '#231F20' : lider ? '#f59e0b' : '#94a3b8' }}>{lider?.estado === 'enviado' ? 'Completada' : lider ? 'Borrador' : 'Sin evaluar'}</strong></span>{lider?.rating_calibrado && <span>🎯 Calibrado: <strong style={{ color: '#231F20' }}>{lider.rating_calibrado}</strong></span>}</div></div>
              <button onClick={() => setColaboradorSeleccionado(col)} style={s.btnPrimario}>{lider ? '✏️ Editar' : '📝 Evaluar'}</button>
            </div>
          )})}
        </div>
      )}
    </div>
  );
}

function EvaluacionLider({ colaborador, onVolver }) {
  const [competencias, setCompetencias] = useState([]);
  const [puntuacionesAuto, setPuntuacionesAuto] = useState({});
  const [autoevaluacion, setAutoevaluacion] = useState(null);
  const [evaluacionLider, setEvaluacionLider] = useState(null);
  const [ratings, setRatings] = useState({});
  const [comentarios, setComentarios] = useState({});
  const [comentariosFinales, setComentariosFinales] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [showInfo, setShowInfo] = useState({});
  useEffect(() => { cargarDatos(); }, []);
  async function cargarDatos() { const { data: comps } = await supabase.from('competencias').select('*').eq('aplica_a', colaborador.seniority || 'Analista'); setCompetencias(comps || []); const { data: auto } = await supabase.from('evaluaciones').select('*, puntuaciones(*)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'autoevaluacion').maybeSingle(); if (auto) { setAutoevaluacion(auto); const pa = {}; (auto.puntuaciones || []).forEach(p => { pa[p.competencia_id] = p.rating; }); setPuntuacionesAuto(pa); } const { data: { session } } = await supabase.auth.getSession(); const { data: liderEval } = await supabase.from('evaluaciones').select('*, puntuaciones(*)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').maybeSingle(); if (liderEval) { setEvaluacionLider(liderEval); setComentariosFinales(liderEval.comentarios_finales || ''); const rm = {}; const cm = {}; (liderEval.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComentarios(cm); } else { const { data: nueva } = await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador' }).select().single(); setEvaluacionLider(nueva); } setCargando(false); }
  async function guardar() { await supabase.from('evaluaciones').update({ comentarios_finales: comentariosFinales, updated_at: new Date() }).eq('id', evaluacionLider.id); for (const [compId, rating] of Object.entries(ratings)) { const com = comentarios[compId] || ''; const { data: ex } = await supabase.from('puntuaciones').select('id').eq('evaluacion_id', evaluacionLider.id).eq('competencia_id', compId).maybeSingle(); if (ex) { await supabase.from('puntuaciones').update({ rating, comentario: com }).eq('id', ex.id); } else { await supabase.from('puntuaciones').insert({ evaluacion_id: evaluacionLider.id, competencia_id: compId, rating, comentario: com }); } } setMensaje('✅ Borrador guardado'); setTimeout(() => setMensaje(''), 2500); }
  async function enviar() { const faltantes = competencias.filter(c => !comentarios[c.id] || !comentarios[c.id].trim()); if (faltantes.length > 0) { setMensaje(`❌ Debes completar el comentario de: ${faltantes.map(c => c.nombre).join(', ')}`); setTimeout(() => setMensaje(''), 4000); return; } if (!comentariosFinales || !comentariosFinales.trim()) { setMensaje('❌ Debes completar los Comentarios Finales'); setTimeout(() => setMensaje(''), 4000); return; } await guardar(); await supabase.from('evaluaciones').update({ estado: 'enviado', updated_at: new Date() }).eq('id', evaluacionLider.id); setMensaje('🎉 Evaluación enviada'); setEvaluacionLider({ ...evaluacionLider, estado: 'enviado' }); setTimeout(() => setMensaje(''), 3000); }
  if (cargando) return <p style={{ padding: 20 }}>Cargando...</p>;
  const enviada = evaluacionLider?.estado === 'enviado';
  return (
    <div style={{ maxWidth: 900 }}>
      <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button>
      <h3 style={{ color: '#231F20' }}>📝 Evaluando a: {colaborador.full_name || colaborador.email}</h3>
      <p style={{ color: '#64748b', marginBottom: 4 }}>{colaborador.area} · {colaborador.seniority}</p>
      {evaluacionLider?.rating_calibrado && <div style={{ padding: 12, background: '#D4D2C6', borderRadius: 8, marginBottom: 16, textAlign: 'center', color: '#231F20' }}>🎯 <strong>Rating Final Calibrado: {evaluacionLider.rating_calibrado}</strong></div>}
      {competencias.map(comp => (
        <div key={comp.id} style={s.competenciaCard}>
          <div style={s.competenciaHeader}><div><h5 style={{ margin: 0, color: '#231F20' }}>{comp.nombre}</h5><p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>{comp.descripcion}</p></div><button onClick={() => setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] })} style={s.btnInfo}>{showInfo[comp.id] ? '🔼 Ocultar' : '🔽 Ver info'}</button></div>
          {puntuacionesAuto[comp.id] && (
            <div style={{ padding: '10px 12px', background: '#D4D2C6', borderRadius: 6, marginBottom: 8, fontSize: 13, color: '#231F20' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span>📝 Auto: <strong>{puntuacionesAuto[comp.id]}</strong></span>
                {ratings[comp.id] && (
                  <span style={{ color: ratings[comp.id] > puntuacionesAuto[comp.id] ? '#22c55e' : ratings[comp.id] < puntuacionesAuto[comp.id] ? '#dc2626' : '#64748b' }}>
                    Tu eval: <strong>{ratings[comp.id]}</strong> ({ratings[comp.id] - puntuacionesAuto[comp.id] > 0 ? '+' : ''}{ratings[comp.id] - puntuacionesAuto[comp.id]})
                  </span>
                )}
              </div>
              <div style={{ marginTop: 6, padding: '6px 8px', background: 'white', borderRadius: 4, fontSize: 12, color: '#475569', fontStyle: 'italic' }}>
                "{autoevaluacion?.puntuaciones?.find(p => p.competencia_id == comp.id)?.comentario || 'Sin comentario'}"
              </div>
            </div>
          )}
          <div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => enviada ? null : setRatings({ ...ratings, [comp.id]: r })} style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', border: ratings[comp.id] === r ? '2px solid #231F20' : '2px solid #e2e8f0', cursor: enviada ? 'not-allowed' : 'pointer' }} disabled={enviada}>{r}</button>)}</div>
          {showInfo[comp.id] && (<div style={s.ratingInfoBox}>{[1,2,3,4,5].map(r => <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>)}</div>)}
          <textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({ ...comentarios, [comp.id]: e.target.value })} placeholder="Comentario sobre esta competencia (obligatorio)" style={{ ...s.textareaSmall, borderColor: enviada ? '#D4D2C6' : (comentarios[comp.id]?.trim() ? '#D4D2C6' : '#dc2626') }} disabled={enviada} />
        </div>
      ))}
      <CalcularPromedio ratings={ratings} competencias={competencias} />
      <SeccionText titulo="📝 Comentarios Finales (obligatorio)" valor={comentariosFinales} onChange={setComentariosFinales} disabled={enviada} required />
      {mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      {!enviada && <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar Borrador</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar</button></div>}
      {enviada && <div style={s.bannerEnviado}>✅ Evaluación enviada.</div>}
    </div>
  );
}

function PanelColaborador({ userId, seniority, email, nombre }) {
  const [evalData, setEvalData] = useState(null);
  const [competencias, setCompetencias] = useState([]);
  const [ratings, setRatings] = useState({});
  const [comentarios, setComentarios] = useState({});
  const [comentariosFinales, setComentariosFinales] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [showInfo, setShowInfo] = useState({});
  useEffect(() => { cargarDatos(); }, []);
  async function cargarDatos() { const { data: comps } = await supabase.from('competencias').select('*').eq('aplica_a', seniority || 'Analista'); setCompetencias(comps || []); const { data: ev } = await supabase.from('evaluaciones').select('*').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').single(); if (ev) { setEvalData(ev); setComentariosFinales(ev.comentarios_finales || ''); const { data: punts } = await supabase.from('puntuaciones').select('*').eq('evaluacion_id', ev.id); const rm = {}; const cm = {}; (punts || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComentarios(cm); } else { const { data: nueva } = await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador' }).select().single(); setEvalData(nueva); } setCargando(false); }
  async function guardar() { await supabase.from('evaluaciones').update({ comentarios_finales: comentariosFinales, updated_at: new Date() }).eq('id', evalData.id); for (const [compId, rating] of Object.entries(ratings)) { const com = comentarios[compId] || ''; const { data: ex } = await supabase.from('puntuaciones').select('id').eq('evaluacion_id', evalData.id).eq('competencia_id', compId).single(); if (ex) { await supabase.from('puntuaciones').update({ rating, comentario: com }).eq('id', ex.id); } else { await supabase.from('puntuaciones').insert({ evaluacion_id: evalData.id, competencia_id: compId, rating, comentario: com }); } } setMensaje('✅ Borrador guardado'); setTimeout(() => setMensaje(''), 2500); }
  async function enviar() { const faltantes = competencias.filter(c => !comentarios[c.id] || !comentarios[c.id].trim()); if (faltantes.length > 0) { setMensaje(`❌ Debes completar el comentario de: ${faltantes.map(c => c.nombre).join(', ')}`); setTimeout(() => setMensaje(''), 4000); return; } if (!comentariosFinales || !comentariosFinales.trim()) { setMensaje('❌ Debes completar los Comentarios Finales'); setTimeout(() => setMensaje(''), 4000); return; } await guardar(); await supabase.from('evaluaciones').update({ estado: 'enviado', updated_at: new Date() }).eq('id', evalData.id); const valores = Object.values(ratings).filter(r => r > 0); const prom = valores.length > 0 ? (valores.reduce((a, b) => a + b, 0) / valores.length).toFixed(1) : '0'; let clasif = ''; const p = parseFloat(prom); if (p <= 1.4) clasif = 'No adecuado'; else if (p <= 2.4) clasif = 'Por debajo de lo esperado'; else if (p <= 3.4) clasif = 'Cumple con las expectativas'; else if (p <= 4.4) clasif = 'Excede las expectativas'; else clasif = 'Desempeño distinguido'; const { data: perfil } = await supabase.from('profiles').select('leader_id').eq('id', userId).single(); let leaderEmail = null; if (perfil?.leader_id) { const { data: lider } = await supabase.from('profiles').select('email').eq('id', perfil.leader_id).single(); leaderEmail = lider?.email; } let comentariosTxt = ''; for (const [compId, com] of Object.entries(comentarios)) { if (com) { const comp = competencias.find(c => c.id == compId); comentariosTxt += `• ${comp?.nombre || 'Competencia'}: ${com}\n`; } } if (comentariosFinales) comentariosTxt += `\n📝 Final: ${comentariosFinales}`; emailjs.send('service_httvcn8', 'template_ytka22b', { to_email: email, to_name: nombre || 'Colaborador', promedio: prom, clasificacion: clasif, message: `Has completado tu autoevaluación.\n\n📊 Promedio: ${prom} - ${clasif}\n📝 Comentarios:\n${comentariosTxt || 'Sin comentarios'}` }, 'Mc-YPiWB1XNBKfhOJ').catch(err => console.log(err)); if (leaderEmail) { emailjs.send('service_httvcn8', 'template_ytka22b', { to_email: leaderEmail, to_name: 'Líder', promedio: prom, clasificacion: clasif, message: `${nombre || 'Tu colaborador'} ha completado su autoevaluación.\n\n📊 Promedio: ${prom} - ${clasif}\n📝 Comentarios:\n${comentariosTxt || 'Sin comentarios'}` }, 'Mc-YPiWB1XNBKfhOJ').catch(err => console.log(err)); } setMensaje('🎉 Evaluación enviada'); setEvalData({ ...evalData, estado: 'enviado' }); setTimeout(() => setMensaje(''), 3000); }
  if (cargando) return <p style={{ padding: 20 }}>Cargando competencias...</p>;
  const enviada = evalData?.estado === 'enviado';
  return (
    <div style={{ maxWidth: 900 }}>
      <h3 style={{ color: '#231F20' }}>📝 Mi Autoevaluación</h3>
      <p style={{ color: '#64748b', marginBottom: 4 }}>Seniority: <strong>{seniority || 'No definido'}</strong></p>
      <p style={{ color: '#64748b', marginBottom: 4 }}>Estado: <strong style={{ color: enviada ? '#231F20' : '#f59e0b' }}>{enviada ? '✅ Enviada' : '📝 En progreso'}</strong></p>
      {evalData?.rating_calibrado && <div style={{ padding: 12, background: '#D4D2C6', borderRadius: 8, marginBottom: 16, textAlign: 'center', color: '#231F20' }}>🎯 <strong>Rating Final Calibrado: {evalData.rating_calibrado}</strong></div>}
      {competencias.map(comp => (
        <div key={comp.id} style={s.competenciaCard}>
          <div style={s.competenciaHeader}><div><h5 style={{ margin: 0, color: '#231F20' }}>{comp.nombre}</h5><p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>{comp.descripcion}</p><span style={{ ...s.tipoBadge, marginTop: 4, display: 'inline-block', background: '#D4D2C6', color: '#231F20' }}>{comp.tipo === 'generica' ? '🌐 Genérica' : '🎯 Específica'}</span></div><button onClick={() => setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] })} style={s.btnInfo}>{showInfo[comp.id] ? '🔼 Ocultar' : '🔽 Ver info'}</button></div>
          <div style={s.ratingRow}>{[1,2,3,4,5].map(r => <button key={r} onClick={() => enviada ? null : setRatings({ ...ratings, [comp.id]: r })} style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', border: ratings[comp.id] === r ? '2px solid #231F20' : '2px solid #e2e8f0', cursor: enviada ? 'not-allowed' : 'pointer' }} disabled={enviada}>{r}</button>)}</div>
          {showInfo[comp.id] && (<div style={s.ratingInfoBox}>{[1,2,3,4,5].map(r => <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>)}</div>)}
          <textarea value={comentarios[comp.id] || ''} onChange={e => setComentarios({ ...comentarios, [comp.id]: e.target.value })} placeholder="Comentario sobre esta competencia (obligatorio)" style={{ ...s.textareaSmall, borderColor: enviada ? '#D4D2C6' : (comentarios[comp.id]?.trim() ? '#D4D2C6' : '#dc2626') }} disabled={enviada} />
        </div>
      ))}
      <CalcularPromedio ratings={ratings} competencias={competencias} />
      <SeccionText titulo="📝 Comentarios Finales (obligatorio)" valor={comentariosFinales} onChange={setComentariosFinales} disabled={enviada} required />
      {mensaje && <div style={s.mensajeToast}>{mensaje}</div>}
      {!enviada && <div style={{ display: 'flex', gap: 12, marginBottom: 40 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar Borrador</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar Evaluación</button></div>}
      {enviada && <div style={s.bannerEnviado}>✅ Tu evaluación ha sido enviada.</div>}
    </div>
  );
}

function SeccionText({ titulo, valor, onChange, disabled }) { return <div style={{ marginBottom: 24 }}><h4 style={s.seccionTitulo}>{titulo}</h4><textarea value={valor} onChange={e => onChange(e.target.value)} style={s.textarea} disabled={disabled} /></div>; }
function RatingDesc({ competenciaId, rating }) { const [desc, setDesc] = useState('Cargando...'); useEffect(() => { (async () => { const { data, error } = await supabase.from('rating_descriptions').select('titulo, descripcion').eq('competencia_id', competenciaId).eq('rating', rating).single(); if (error) setDesc('Error'); else if (data) setDesc(`${data.titulo}: ${data.descripcion}`); else setDesc('Sin descripción'); })(); }, [competenciaId, rating]); return <span>{desc}</span>; }
function CalcularPromedio({ ratings, competencias }) { if (!ratings || Object.keys(ratings).length === 0) return null; const valores = Object.values(ratings).filter(r => r > 0); if (valores.length === 0) return null; const suma = valores.reduce((a, b) => a + b, 0); const promedio = suma / valores.length; let clasificacion = '', color = '', emoji = ''; if (promedio <= 1.4) { clasificacion = 'No adecuado'; color = '#dc2626'; emoji = '🔴'; } else if (promedio <= 2.4) { clasificacion = 'Por debajo de lo esperado'; color = '#f59e0b'; emoji = '🟠'; } else if (promedio <= 3.4) { clasificacion = 'Cumple con las expectativas'; color = '#3b82f6'; emoji = '🔵'; } else if (promedio <= 4.4) { clasificacion = 'Excede las expectativas'; color = '#22c55e'; emoji = '🟢'; } else { clasificacion = 'Desempeño distinguido'; color = '#8b5cf6'; emoji = '🟣'; } return (<div style={{ marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: '2px solid #231F20', textAlign: 'center' }}><p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>Resultado Final</p><p style={{ fontSize: 48, fontWeight: 700, color: '#231F20', margin: '8px 0' }}>{promedio.toFixed(1)}</p><p style={{ fontSize: 18, fontWeight: 600, color, margin: 0 }}>{emoji} {clasificacion}</p><p style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>Basado en {valores.length} de {competencias?.length || 0} competencias evaluadas</p></div>); }

const th = { textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: '11px' };
const td = { padding: '6px 8px', fontSize: '13px' };
const s = {
  centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#231F20', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flexWrap: 'wrap', gap: 12, position: 'sticky', top: 0, zIndex: 100 },
  headerIzq: { display: 'flex', alignItems: 'center', gap: 12 }, logo: { fontSize: 20, fontWeight: 700, color: '#D4D2C6', margin: 0 },
  badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#D4D2C6', color: '#231F20', border: '1px solid #D4D2C6' },
  headerDer: { display: 'flex', alignItems: 'center', gap: 14 }, email: { fontSize: 14, color: '#D4D2C6' },
  btnSalir: { padding: '8px 16px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 },
  main: { padding: 24, maxWidth: 1100, margin: '0 auto', width: '100%' },
  tarjetaBienvenida: { background: 'white', padding: '20px 24px', borderRadius: 12, marginBottom: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #D4D2C6' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 },
  tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #D4D2C6' },
  tarjetaPlaceholder: { background: 'white', padding: 40, borderRadius: 12, textAlign: 'center', color: '#64748b', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#231F20', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #D4D2C6' },
  competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14, border: '1px solid #D4D2C6' },
  competenciaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  tipoBadge: { fontSize: 11, padding: '3px 10px', borderRadius: 12, background: '#D4D2C6', color: '#231F20', display: 'inline-block', fontWeight: 500 },
  btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 },
  ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' },
  ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  ratingInfoBox: { background: 'white', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #D4D2C6' },
  ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 },
  textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'white' },
  textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'white' },
  btnPrimario: { padding: '12px 24px', background: '#231F20', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14, boxShadow: '0 2px 8px rgba(35, 31, 32, 0.3)' },
  btnSecundario: { padding: '12px 24px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 },
  mensajeToast: { padding: '12px 20px', background: '#D4D2C6', borderRadius: 8, marginBottom: 16, color: '#231F20', fontWeight: 500, fontSize: 14, textAlign: 'center', border: '1px solid #231F20' },
  bannerEnviado: { padding: 20, background: '#D4D2C6', borderRadius: 10, color: '#231F20', fontWeight: 600, textAlign: 'center', border: '2px solid #231F20', marginBottom: 40 }
};
