import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
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
  const [menuActivo, setMenuActivo] = useState('desempeno');
  const [cicloActivo, setCicloActivo] = useState(null);

  useEffect(() => { cargarPerfil(); }, []);

  async function cargarPerfil() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = '/'; return; }
    const { data: perfil } = await supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo, leader_id').eq('id', session.user.id).single();
    if (perfil && perfil.activo === false) { await supabase.auth.signOut(); alert('Cuenta desactivada.'); window.location.href = '/'; return; }
    setProfile(perfil); setLoading(false);
  }

  async function cerrarSesion() { await supabase.auth.signOut(); window.location.href = '/'; }

  if (loading) return <div style={s.centrado}><p>Cargando...</p></div>;
  if (!profile) return <div style={s.centrado}><h2>Error</h2><button onClick={cerrarSesion} style={s.btnSalir}>Volver</button></div>;

  const nombreRol = profile.role === 'admin_rrhh' ? 'Admin RRHH' : profile.role === 'lider' ? 'Líder' : 'Colaborador';
  const emojiRol = profile.role === 'admin_rrhh' ? '🔧' : profile.role === 'lider' ? '👥' : '👤';
  const esGerente = profile.seniority === 'Gerente';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={sidebar.aside}>
        <div style={sidebar.logoContainer}><img src="/logo.jpg" alt="Fabric Group" style={{ height: '40px' }} /></div>
        <nav style={sidebar.nav}>
          <button onClick={() => { setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ ...sidebar.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' }}>📊 Evaluación de Desempeño</button>
          <button onClick={() => setMenuActivo('objetivos')} style={{ ...sidebar.menuItem, background: menuActivo === 'objetivos' ? '#D4D2C6' : 'transparent', color: menuActivo === 'objetivos' ? '#231F20' : '#D4D2C6' }}>🎯 Mis Objetivos</button>
          <button onClick={() => setMenuActivo('objetivos_empresa')} style={{ ...sidebar.menuItem, background: menuActivo === 'objetivos_empresa' ? '#D4D2C6' : 'transparent', color: menuActivo === 'objetivos_empresa' ? '#231F20' : '#D4D2C6' }}>🏢 Objetivos de la Compañía</button>
        </nav>
        <div style={sidebar.footer}><span style={{ fontSize: 12, color: '#D4D2C6' }}>{profile.email}</span><button onClick={cerrarSesion} style={{ ...s.btnSalir, marginTop: 8, width: '100%' }}>Cerrar Sesión</button></div>
      </aside>
      <div style={{ flex: 1, background: '#f8fafc', minHeight: '100vh' }}>
        <header style={s.header}><h1 style={{ fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 }}>Fabric Group</h1><span style={s.badge}>{emojiRol} {nombreRol}</span></header>
        <main style={{ padding: 24 }}>
          {menuActivo === 'desempeno' && <DesempenoView profile={profile} cicloActivo={cicloActivo} setCicloActivo={setCicloActivo} />}
          {menuActivo === 'objetivos' && <PlaceholderView titulo="🎯 Mis Objetivos" descripcion="Módulo en desarrollo." />}
          {menuActivo === 'objetivos_empresa' && <PlaceholderView titulo="🏢 Objetivos de la Compañía" descripcion="Módulo en desarrollo." />}
        </main>
      </div>
    </div>
  );
}

function PlaceholderView({ titulo, descripcion }) { return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 60 }}><h2>{titulo}</h2><p>{descripcion}</p></div>; }

function DesempenoView({ profile, cicloActivo, setCicloActivo }) {
  const esAdmin = profile.role === 'admin_rrhh';
  const esGerente = profile.seniority === 'Gerente';
  if (!cicloActivo) return <CiclosLista esAdmin={esAdmin} onSelectCiclo={setCicloActivo} profile={profile} />;
  return (
    <div><button onClick={() => setCicloActivo(null)} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver a Ciclos</button><h2>📊 {cicloActivo.nombre}</h2><p style={{ color: '#64748b', marginBottom: 20 }}>{new Date(cicloActivo.fecha_inicio).toLocaleDateString('es-AR')} · {cicloActivo.estado}</p>
      {esAdmin && <PanelAdminConEquipo profile={profile} cicloId={cicloActivo.id} tieneAutoevaluacion={!esGerente} />}
      {!esAdmin && esGerente && <EquipoLider cicloId={cicloActivo.id} profile={profile} />}
      {!esAdmin && !esGerente && profile.role === 'lider' && <PanelLiderConAutoevaluacion cicloId={cicloActivo.id} profile={profile} />}
      {!esAdmin && !esGerente && profile.role !== 'lider' && <PanelColaboradorConEquipo userId={profile.id} seniority={profile.seniority} cicloId={cicloActivo.id} profile={profile} />}
    </div>
  );
}

function PanelLiderConAutoevaluacion({ cicloId, profile }) {
  const [v, setV] = useState('equipo');
  return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={() => setV('equipo')} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button><button onClick={() => setV('mievaluacion')} style={v === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluación</button></div>{v === 'equipo' ? <EquipoLider cicloId={cicloId} profile={profile} /> : <PanelColaborador userId={profile.id} seniority={profile.seniority} cicloId={cicloId} />}</div>;
}

function PanelAdminConEquipo({ profile, cicloId, tieneAutoevaluacion }) {
  const [vista, setVista] = useState('dashboard'); const [stats, setStats] = useState({ total: 0, enviadas: 0, pendientes: 0 }); const [colabs, setColabs] = useState([]); const [hist, setHist] = useState(null); const [sSel, setSSel] = useState(null);
  useEffect(() => { cargar(); }, [cicloId]);
  async function cargar() { const [{ count: t }, { count: e }, { data: p }, { data: f }] = await Promise.all([supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId), supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('estado', 'enviado'), supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', cicloId), supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo').neq('role', 'admin_rrhh')]); const ids = (p || []).map(x => x.colaborador_id); setColabs((f || []).filter(c => ids.includes(c.id))); setStats({ total: t || 0, enviadas: e || 0, pendientes: (t || 0) - (e || 0) }); }
  const sCounts = useMemo(() => { const c = {}; colabs.forEach(x => { const s = x.seniority || 'Sin definir'; c[s] = (c[s] || 0) + 1; }); return c; }, [colabs]);
  if (hist) return <HistorialAdmin colaborador={hist} onVolver={() => setHist(null)} />;
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => setVista('dashboard')} style={vista === 'dashboard' ? s.btnPrimario : s.btnInfo}>📊 Dashboard</button>
        <button onClick={() => setVista('evaluaciones')} style={vista === 'evaluaciones' ? s.btnPrimario : s.btnInfo}>📋 Evaluaciones</button>
        <button onClick={() => setVista('calibracion')} style={vista === 'calibracion' ? s.btnPrimario : s.btnInfo}>🎯 Calibración</button>
        <button onClick={() => setVista('feedback')} style={vista === 'feedback' ? s.btnPrimario : s.btnInfo}>💬 Feedback</button>
        <button onClick={() => setVista('equipo')} style={vista === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>
        {tieneAutoevaluacion && <button onClick={() => setVista('mievaluacion')} style={vista === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluación</button>}
        <button onClick={() => setVista('colaboradores')} style={vista === 'colaboradores' ? s.btnPrimario : s.btnInfo}>👥 Participantes</button>
      </div>
      {vista === 'dashboard' && <DashboardView stats={stats} colabs={colabs} sCounts={sCounts} sSel={sSel} setSSel={setSSel} />}
      {vista === 'evaluaciones' && <EvaluacionesAdmin cicloId={cicloId} />}
      {vista === 'calibracion' && <PanelCalibracion cicloId={cicloId} colabs={colabs} onHist={setHist} />}
      {vista === 'feedback' && <FeedbackAdmin cicloId={cicloId} />}
      {vista === 'equipo' && <EquipoLider cicloId={cicloId} profile={profile} />}
      {vista === 'mievaluacion' && tieneAutoevaluacion && <PanelColaborador userId={profile.id} seniority={profile.seniority} cicloId={cicloId} />}
      {vista === 'colaboradores' && <ParticipantesView colabs={colabs} />}
    </div>
  );
}

function PanelColaboradorConEquipo({ userId, seniority, cicloId, profile }) {
  const [v, setV] = useState('autoevaluacion'); const [tieneEq, setTieneEq] = useState(false); const [part, setPart] = useState(false); const [verif, setVerif] = useState(true);
  useEffect(() => { (async () => { const { data: { session } } = await supabase.auth.getSession(); if (session) { const [{ count: e }, { count: p }] = await Promise.all([supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', session.user.id), supabase.from('ciclo_colaboradores').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('colaborador_id', session.user.id)]); setTieneEq((e || 0) > 0); setPart((p || 0) > 0); } setVerif(false); })(); }, [cicloId]);
  if (verif) return <p>Verificando...</p>; if (!part) return <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p>No estás participando.</p></div>;
  return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={() => setV('autoevaluacion')} style={v === 'autoevaluacion' ? s.btnPrimario : s.btnInfo}>📝 Mi Evaluación</button>{tieneEq && <button onClick={() => setV('equipo')} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>👥 Mi Equipo</button>}</div>{v === 'autoevaluacion' ? <PanelColaborador userId={userId} seniority={seniority} cicloId={cicloId} /> : <EquipoLider cicloId={cicloId} profile={profile} />}</div>;
}

function CiclosLista({ esAdmin, onSelectCiclo }) {
  const [ciclos, setCiclos] = useState([]); const [carg, setCarg] = useState(true); const [showC, setShowC] = useState(false); const [nom, setNom] = useState(''); const [fIni, setFIni] = useState(''); const [fFin, setFFin] = useState(''); const [cSel, setCSel] = useState(null); const [todos, setTodos] = useState([]); const [parts, setParts] = useState([]);
  useEffect(() => { cargar(); if (esAdmin) cargarColabs(); }, []);
  async function cargar() { const { data } = await supabase.from('ciclos').select('*').order('fecha_inicio', { ascending: false }); setCiclos(data || []); setCarg(false); }
  async function cargarColabs() { const { data } = await supabase.from('profiles').select('id, email, full_name, area, seniority').neq('role', 'admin_rrhh').eq('activo', true); setTodos(data || []); }
  async function crear() { if (!nom || !fIni) return alert('Nombre y fecha obligatorios'); await supabase.from('ciclos').insert({ nombre: nom, fecha_inicio: fIni, fecha_fin: fFin || null, estado: 'activo' }); setNom(''); setFIni(''); setFFin(''); setShowC(false); cargar(); }
  async function abrir(ciclo) { setCSel(ciclo.id); const { data } = await supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', ciclo.id); setParts((data || []).map(p => p.colaborador_id)); }
  async function toggle(cid) { if (parts.includes(cid)) { await supabase.from('ciclo_colaboradores').delete().eq('ciclo_id', cSel).eq('colaborador_id', cid); setParts(p => p.filter(id => id !== cid)); } else { await supabase.from('ciclo_colaboradores').insert({ ciclo_id: cSel, colaborador_id: cid }); setParts(p => [...p, cid]); } }
  if (carg) return <p>Cargando ciclos...</p>;
  return (
    <div><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}><h2>📊 Ciclos de Evaluación</h2>{esAdmin && <button onClick={() => setShowC(!showC)} style={s.btnPrimario}>+ Nuevo Ciclo</button>}</div>
      {showC && <div style={{ ...s.tarjetaStat, marginBottom: 20 }}><h4>Crear Ciclo</h4><div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}><div><label>Nombre</label><input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ej: 1er Semestre 2025" style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', width: 200 }} /></div><div><label>Inicio</label><input type="date" value={fIni} onChange={e => setFIni(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div><div><label>Fin</label><input type="date" value={fFin} onChange={e => setFFin(e.target.value)} style={{ padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }} /></div><button onClick={crear} style={{ ...s.btnPrimario, background: '#22c55e', alignSelf: 'flex-end' }}>Crear</button></div></div>}
      {cSel && <div style={{ ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}><h4>👥 Participantes</h4><button onClick={() => setCSel(null)} style={s.btnInfo}>✕</button></div><p style={{ fontSize: 13, color: '#64748b' }}>{parts.length} seleccionados</p><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>{todos.map(c => (<div key={c.id} onClick={() => toggle(c.id)} style={{ padding: 10, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: parts.includes(c.id) ? '#231F20' : 'white', color: parts.includes(c.id) ? '#D4D2C6' : '#231F20', border: '1px solid #D4D2C6' }}><div><strong>{c.full_name || c.email}</strong><p style={{ fontSize: 11, margin: 0, opacity: 0.7 }}>{c.area}·{c.seniority}</p></div><span>{parts.includes(c.id) ? '✅' : '○'}</span></div>))}</div></div>}
      {ciclos.length === 0 ? <div style={{ ...s.tarjetaStat, textAlign: 'center', padding: 40 }}><p>No hay ciclos.</p></div> : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>{ciclos.map(c => (<div key={c.id} style={{ ...s.tarjetaStat, border: '2px solid #D4D2C6' }}><h3>{c.nombre}</h3><p>📅 Inicio: {new Date(c.fecha_inicio).toLocaleDateString('es-AR')}</p>{c.fecha_fin && <p>📅 Fin: {new Date(c.fecha_fin).toLocaleDateString('es-AR')}</p>}<span style={{ padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.estado === 'activo' ? '#dcfce7' : '#f1f5f9', color: c.estado === 'activo' ? '#166534' : '#64748b', display: 'inline-block', marginTop: 8 }}>{c.estado === 'activo' ? '✅ Activo' : '📁 ' + c.estado}</span><div style={{ display: 'flex', gap: 8, marginTop: 12 }}><button onClick={() => onSelectCiclo(c)} style={{ ...s.btnPrimario, flex: 1 }}>Entrar</button>{esAdmin && <button onClick={() => abrir(c)} style={s.btnSecundario}>👥</button>}</div></div>))}</div>}
    </div>
  );
}

function DashboardView({ stats, colabs, sCounts, sSel, setSSel }) {
  const filt = sSel ? colabs.filter(c => (c.seniority || 'Sin definir') === sSel) : [];
  return <div><div style={s.grid}><div style={s.tarjetaStat}><p>👥 Participantes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{colabs.length}</p></div><div style={s.tarjetaStat}><p>📋 Evaluaciones</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.total}</p></div><div style={{ ...s.tarjetaStat, borderTop: '4px solid #231F20' }}><p>✅ Completadas</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.enviadas}</p></div><div style={{ ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' }}><p>⏳ Pendientes</p><p style={{ fontSize: 36, fontWeight: 700, color: '#231F20' }}>{stats.pendientes}</p></div></div>
    <div style={{ ...s.tarjetaStat, marginTop: 20 }}><h4>📊 Por Seniority</h4><div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>{Object.entries(sCounts).map(([sn, ct]) => (<div key={sn} onClick={() => setSSel(sn === sSel ? null : sn)} style={{ padding: 16, background: sn === sSel ? '#231F20' : '#D4D2C6', borderRadius: 10, textAlign: 'center', cursor: 'pointer' }}><p style={{ fontSize: 11, color: sn === sSel ? '#D4D2C6' : '#231F20', fontWeight: 600 }}>{sn}</p><p style={{ fontSize: 28, fontWeight: 700, color: sn === sSel ? '#D4D2C6' : '#231F20' }}>{ct}</p></div>))}</div></div>
    {sSel && <div style={{ ...s.tarjetaStat, marginTop: 20 }}><h4>👥 {sSel} ({filt.length})</h4>{filt.map(c => (<div key={c.id} style={{ padding: 10, background: '#f8fafc', borderRadius: 8, display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><div><strong>{c.full_name || c.email}</strong><p style={{ fontSize: 12, color: '#64748b' }}>{c.area}</p></div></div>))}</div>}
  </div>;
}

function ParticipantesView({ colabs }) { return <div style={s.tarjetaStat}><h4>👥 Participantes ({colabs.length})</h4><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Nombre</th><th style={th}>Email</th><th style={th}>Área</th><th style={th}>Seniority</th></tr></thead><tbody>{colabs.map(c => (<tr key={c.id}><td style={td}>{c.full_name || '-'}</td><td style={td}>{c.email}</td><td style={td}>{c.area || '-'}</td><td style={td}>{c.seniority || '-'}</td></tr>))}</tbody></table></div>; }

function EvaluacionesAdmin({ cicloId }) {
  const [evs, setEvs] = useState([]); const [carg, setCarg] = useState(true);
  useEffect(() => { (async () => { const { data } = await supabase.from('evaluaciones').select('id,colaborador_id,tipo_evaluacion,estado,rating_promedio,rating_calibrado,created_at,colaborador:colaborador_id(email,full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setEvs(data || []); setCarg(false); })(); }, [cicloId]);
  if (carg) return <p>Cargando...</p>;
  return <div style={s.tarjetaStat}><h4>📋 Evaluaciones ({evs.length})</h4><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Colaborador</th><th style={th}>Tipo</th><th style={th}>Estado</th><th style={th}>Rating</th><th style={th}>Calibrado</th><th style={th}>Fecha</th></tr></thead><tbody>{evs.map(ev => (<tr key={ev.id}><td style={td}>{ev.colaborador?.full_name || '-'}</td><td style={td}>{ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Líder'}</td><td style={td}>{ev.estado}</td><td style={{ ...td, fontWeight: 700 }}>{ev.rating_promedio || '-'}</td><td style={td}>{ev.rating_calibrado || '-'}</td><td style={td}>{new Date(ev.created_at).toLocaleDateString('es-AR')}</td></tr>))}</tbody></table></div></div>;
}

function PanelCalibracion({ cicloId, colabs, onHist }) {
  const [datos, setDatos] = useState([]); const [carg, setCarg] = useState(true); const [guard, setGuard] = useState(false); const [filtro, setFiltro] = useState('Todas');
  useEffect(() => { cargar(); }, [cicloId]);
  async function cargar() { setCarg(true); const { data: evs } = await supabase.from('evaluaciones').select('id,colaborador_id,tipo_evaluacion,evaluador_id,rating_promedio,rating_calibrado,comentario_calibracion,puntuaciones(rating,competencia_id,comentario,competencias(nombre)),colaborador:colaborador_id(id,email,full_name,area,seniority)').eq('ciclo_id', cicloId).in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']); const mapa = {}; (evs || []).forEach(ev => { if (!ev.colaborador) return; if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, autoevaluacion: null, evaluacionLider: null, ratingFinal: null, comentarioCalibracion: null, promAuto: null, promLider: null }; if (ev.tipo_evaluacion === 'autoevaluacion') { mapa[ev.colaborador_id].autoevaluacion = ev; mapa[ev.colaborador_id].promAuto = ev.rating_promedio; } if (ev.tipo_evaluacion === 'evaluacion_lider') { mapa[ev.colaborador_id].evaluacionLider = ev; mapa[ev.colaborador_id].promLider = ev.rating_promedio; mapa[ev.colaborador_id].ratingFinal = ev.rating_calibrado; mapa[ev.colaborador_id].comentarioCalibracion = ev.comentario_calibracion || null; } }); colabs.forEach(c => { if (!mapa[c.id]) mapa[c.id] = { colaborador: c, autoevaluacion: null, evaluacionLider: null, ratingFinal: null, comentarioCalibracion: null, promAuto: null, promLider: null }; }); setDatos(Object.values(mapa)); setCarg(false); }
  async function guardarCal(evaluacionId, rating, comentario) { setGuard(true); await supabase.from('evaluaciones').update({ rating_calibrado: rating, comentario_calibracion: comentario }).eq('id', evaluacionId); setDatos(p => p.map(d => d.evaluacionLider?.id === evaluacionId ? { ...d, ratingFinal: rating, comentarioCalibracion: comentario } : d)); setGuard(false); }
  const clasificar = (prom) => { if (!prom) return { texto: '-', color: '#94a3b8' }; const p = parseFloat(prom); if (p <= 1.4) return { texto: 'No adecuado', color: '#dc2626' }; if (p <= 2.4) return { texto: 'Por debajo', color: '#f59e0b' }; if (p <= 3.4) return { texto: 'Cumple', color: '#3b82f6' }; if (p <= 4.4) return { texto: 'Excede', color: '#22c55e' }; return { texto: 'Distinguido', color: '#8b5cf6' }; };
  function generarPDF(d) { const pdf = new jsPDF(); let y = 28; try { pdf.addImage('/logo.jpg', 'JPEG', 15, 8, 30, 15); } catch (e) { } pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text('EVALUACIÓN DE DESEMPEÑO', 15, y); y += 7; pdf.setFontSize(9); pdf.text(`Colaborador: ${d.colaborador.full_name || d.colaborador.email}`, 15, y); y += 5; pdf.text(`Área: ${d.colaborador.area || '-'}   Seniority: ${d.colaborador.seniority || '-'}`, 15, y); y += 10; pdf.setFontSize(12); pdf.text(`Auto: ${d.promAuto || '-'}   Líder: ${d.promLider || '-'}   Calibrado: ${d.ratingFinal || '-'}`, 15, y + 10); if (d.comentarioCalibracion) { pdf.setFontSize(8); pdf.text(`Justificación: ${d.comentarioCalibracion}`, 15, y + 18); } return pdf; }
  function verPDF(d) { generarPDF(d).save(`Evaluacion_${(d.colaborador.full_name || d.colaborador.email).replace(/\s/g, '_')}.pdf`); }
  function enviarPDF(d) { verPDF(d); let le = ''; if (d.evaluacionLider?.evaluador_id) { supabase.from('profiles').select('email').eq('id', d.evaluacionLider.evaluador_id).single().then(({ data: l }) => { abrirGmail(d.colaborador.email, l?.email || ''); }); } else { abrirGmail(d.colaborador.email, ''); } }
  const areas = useMemo(() => ['Todas', ...new Set(datos.map(d => d.colaborador.area).filter(Boolean))], [datos]); const df = filtro === 'Todas' ? datos : datos.filter(d => d.colaborador.area === filtro);
  if (carg) return <p>⏳ Cargando calibración...</p>;
  return <div style={{ ...s.tarjetaStat }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}><h3>🎯 Calibración - Auto vs Líder</h3><select value={filtro} onChange={e => setFiltro(e.target.value)} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>{areas.map(a => <option key={a} value={a}>{a}</option>)}</select></div><div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}><thead><tr><th style={th}>Colaborador</th><th style={th}>Área</th><th style={th}>Seniority</th><th style={th}>Auto</th><th style={th}>Líder</th><th style={th}>GAP</th><th style={th}>Calibrado</th><th style={th}>Justificación</th><th style={th}>Hist</th><th style={th}>PDF</th><th style={th}>Enviar</th></tr></thead><tbody>{df.map(d => { const clasA = clasificar(d.promAuto); const clasL = clasificar(d.promLider); const clasF = clasificar(d.ratingFinal); const gap = d.promAuto && d.promLider ? (parseFloat(d.promLider) - parseFloat(d.promAuto)).toFixed(1) : null; return (<tr key={d.colaborador.id}><td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td><td style={td}>{d.colaborador.area || '-'}</td><td style={td}><span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>{d.colaborador.seniority || '-'}</span></td><td style={{ ...td, textAlign: 'center' }}>{d.promAuto ? <div><span style={{ fontSize: 18, fontWeight: 700, color: clasA.color }}>{d.promAuto}</span><div style={{ fontSize: 10, color: clasA.color }}>{clasA.texto}</div></div> : '-'}</td><td style={{ ...td, textAlign: 'center' }}>{d.promLider ? <div><span style={{ fontSize: 18, fontWeight: 700, color: clasL.color }}>{d.promLider}</span><div style={{ fontSize: 10, color: clasL.color }}>{clasL.texto}</div></div> : '-'}</td><td style={{ ...td, textAlign: 'center' }}>{gap ? <span style={{ fontSize: 16, fontWeight: 700, color: Math.abs(gap) <= 0.5 ? '#22c55e' : Math.abs(gap) <= 1 ? '#f59e0b' : '#dc2626' }}>{gap > 0 ? '+' : ''}{gap}</span> : '-'}</td><td style={td}>{d.evaluacionLider ? <select value={d.ratingFinal || ''} onChange={e => guardarCal(d.evaluacionLider.id, parseFloat(e.target.value), d.comentarioCalibracion || '')} style={{ padding: 4, borderRadius: 6, border: `2px solid ${clasF.color}`, fontWeight: 600, color: clasF.color }}><option value="">-</option><option value="1">1.0</option><option value="1.5">1.5</option><option value="2">2.0</option><option value="2.5">2.5</option><option value="3">3.0</option><option value="3.5">3.5</option><option value="4">4.0</option><option value="4.5">4.5</option><option value="5">5.0</option></select> : '-'}</td><td style={td}>{d.evaluacionLider ? <input value={d.comentarioCalibracion || ''} onChange={e => guardarCal(d.evaluacionLider.id, d.ratingFinal || null, e.target.value)} placeholder="Justificar..." style={{ width: '100%', padding: 4, borderRadius: 6, border: '1px solid #D4D2C6', fontSize: 11 }} /> : '-'}</td><td style={td}><button onClick={() => onHist(d.colaborador)} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>📋</button></td><td style={td}><button onClick={() => verPDF(d)} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>PDF</button></td><td style={td}>{d.ratingFinal ? <button onClick={() => enviarPDF(d)} style={{ background: '#231F20', color: '#D4D2C6', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600 }}>Enviar</button> : '-'}</td></tr>) })}</tbody></table></div></div>;
}

function FeedbackAdmin({ cicloId }) { const [fbs, setFbs] = useState([]); const [carg, setCarg] = useState(true); useEffect(() => { (async () => { const { data } = await supabase.from('feedback').select('*,lider:lider_id(email,full_name),colaborador:colaborador_id(email,full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setFbs(data || []); setCarg(false); })(); }, [cicloId]); if (carg) return <p>Cargando...</p>; return <div style={s.tarjetaStat}><h4>💬 Feedback ({fbs.length})</h4>{fbs.length === 0 ? <p style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Sin registros.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Líder</th><th style={th}>Colaborador</th><th style={th}>Comentario</th><th style={th}>Fecha</th><th style={th}>OK</th></tr></thead><tbody>{fbs.map(f => (<tr key={f.id}><td style={td}>{f.lider?.full_name || '-'}</td><td style={td}>{f.colaborador?.full_name || '-'}</td><td style={td}>{f.comentario_lider || '-'}</td><td style={td}>{f.fecha_feedback_lider ? new Date(f.fecha_feedback_lider).toLocaleDateString('es-AR') : '-'}</td><td style={td}>{f.confirmacion_colaborador ? '✅' : '⏳'}</td></tr>))}</tbody></table>}</div>; }

function HistorialAdmin({ colaborador, onVolver }) { const [hist, setHist] = useState([]); const [carg, setCarg] = useState(true); useEffect(() => { (async () => { const { data } = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false }); setHist(data || []); setCarg(false); })(); }, []); if (carg) return <p>Cargando...</p>; return <div><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>📋 Historial: {colaborador.full_name || colaborador.email}</h3>{hist.length === 0 ? <p style={{ padding: 40, color: '#94a3b8' }}>Sin historial.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th></tr></thead><tbody>{hist.map(h => (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={td}>{h.rating_final || '-'}</td></tr>))}</tbody></table>}</div>; }

// COMPONENTE CLAVE: Detalle completo de autoevaluación
function DetalleAutoEvaluacion({ autoevaluacion }) {
  if (!autoevaluacion) return <p style={{ padding: 16, color: '#94a3b8', textAlign: 'center' }}>Sin autoevaluación disponible.</p>;
  
  const puntuaciones = autoevaluacion.puntuaciones || [];
  
  return (
    <div style={{ marginTop: 16, background: 'white', borderRadius: 12, border: '2px solid #D4D2C6', overflow: 'hidden' }}>
      {/* Encabezado */}
      <div style={{ background: '#231F20', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h4 style={{ margin: 0, color: '#D4D2C6', fontSize: 16 }}>📝 Autoevaluación Completa</h4>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ color: '#D4D2C6', fontSize: 13 }}>Estado: <strong style={{ color: autoevaluacion.estado === 'enviado' ? '#22c55e' : '#f59e0b' }}>{autoevaluacion.estado === 'enviado' ? '✅ Enviada' : '📝 Borrador'}</strong></span>
          <span style={{ background: '#D4D2C6', color: '#231F20', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 20 }}>
            {autoevaluacion.rating_promedio || '-'}
          </span>
        </div>
      </div>
      
      <div style={{ padding: 20 }}>
        {/* Comentarios finales */}
        {autoevaluacion.comentarios_finales && (
          <div style={{ marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
            <strong style={{ color: '#231F20', display: 'block', marginBottom: 6 }}>💬 Comentarios Finales:</strong>
            <p style={{ color: '#475569', fontSize: 14, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{autoevaluacion.comentarios_finales}</p>
          </div>
        )}

        {/* Tabla de competencias */}
        <h5 style={{ color: '#231F20', marginBottom: 12, fontSize: 15 }}>📊 Calificación por Competencia</h5>
        
        {puntuaciones.length === 0 ? (
          <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20 }}>No hay competencias calificadas.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', borderRadius: 8, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <thead>
                <tr style={{ background: '#231F20' }}>
                  <th style={{ padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'left', fontWeight: 600 }}>Competencia</th>
                  <th style={{ padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'center', fontWeight: 600, width: 80 }}>Rating</th>
                  <th style={{ padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'left', fontWeight: 600 }}>Comentario</th>
                </tr>
              </thead>
              <tbody>
                {puntuaciones.map((p, index) => (
                  <tr key={p.id || index} style={{ background: index % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#231F20', fontWeight: 500 }}>
                      {p.competencias?.nombre || `Competencia ${p.competencia_id}`}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ 
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 40, height: 40, borderRadius: 10,
                        background: '#231F20', color: '#D4D2C6',
                        fontSize: 18, fontWeight: 700
                      }}>
                        {p.rating}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#475569', fontStyle: p.comentario ? 'normal' : 'italic' }}>
                      {p.comentario || 'Sin comentario'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function EquipoLider({ cicloId, profile }) {
  const [equipo, setEquipo] = useState([]);
  const [colSel, setColSel] = useState(null);
  const [fbVis, setFbVis] = useState(null);
  const [detalleVisible, setDetalleVisible] = useState(null);

  useEffect(() => { cargar(); }, [cicloId]);

  async function cargar() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: d } = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', session.user.id);
    if (d) {
      const eq = await Promise.all(d.map(async (c) => {
        const { data: ae } = await supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales, puntuaciones(rating, competencia_id, comentario, competencias(nombre))').eq('colaborador_id', c.id).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle();
        const { data: le } = await supabase.from('evaluaciones').select('id, estado, rating_promedio').eq('colaborador_id', c.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle();
        const { data: fb } = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', c.id).maybeSingle();
        return { ...c, autoevaluacion: ae, evaluacionLider: le, feedback: fb };
      }));
      setEquipo(eq);
    }
  }

  if (colSel) return <EvaluacionLider colaborador={colSel} cicloId={cicloId} onVolver={() => { setColSel(null); cargar(); }} />;
  if (fbVis) return <FeedbackForm feedback={fbVis} cicloId={cicloId} onVolver={() => { setFbVis(null); cargar(); }} />;

  return (
    <div>
      <h3 style={{ color: '#231F20', marginBottom: 20 }}>👥 Mi Equipo ({equipo.length})</h3>
      {equipo.length === 0 ? <p style={{ color: '#94a3b8' }}>No tienes colaboradores asignados.</p> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {equipo.map(c => (
            <div key={c.id} style={{ ...s.tarjetaStat }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <h4 style={{ margin: 0, color: '#231F20' }}>{c.full_name || c.email}</h4>
                  <p style={{ color: '#64748b', fontSize: 13, margin: '4px 0' }}>{c.area} · {c.seniority}</p>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, flexWrap: 'wrap' }}>
                    <span>📝 Auto: <strong style={{ color: c.autoevaluacion?.estado === 'enviado' ? '#22c55e' : '#f59e0b' }}>{c.autoevaluacion?.estado === 'enviado' ? '✅ Enviada' : '⏳ Pendiente'}</strong>{c.autoevaluacion?.rating_promedio && <span style={{ marginLeft: 4 }}>({c.autoevaluacion.rating_promedio})</span>}</span>
                    <span>👥 Mi eval: <strong style={{ color: c.evaluacionLider?.estado === 'enviado' ? '#22c55e' : c.evaluacionLider ? '#f59e0b' : '#94a3b8' }}>{c.evaluacionLider?.estado === 'enviado' ? '✅ Completada' : c.evaluacionLider ? '📝 Borrador' : '❌ Sin evaluar'}</strong></span>
                    <span>💬 Feedback: <strong style={{ color: c.feedback?.confirmacion_colaborador ? '#22c55e' : c.feedback ? '#f59e0b' : '#94a3b8' }}>{c.feedback?.confirmacion_colaborador ? '✅ OK' : c.feedback ? '⏳ Pend' : '-'}</strong></span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {c.autoevaluacion?.estado === 'enviado' && (
                    <button onClick={() => setDetalleVisible(detalleVisible === c.id ? null : c.id)} style={{ ...s.btnInfo, background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>
                      {detalleVisible === c.id ? '🔼 Ocultar' : '👁️ Ver Autoevaluación'}
                    </button>
                  )}
                  <button onClick={() => setFbVis(c)} style={{ ...s.btnInfo, background: '#fef3c7', color: '#92400e', fontWeight: 600 }}>💬 Feedback</button>
                  <button onClick={() => setColSel(c)} style={s.btnPrimario}>{c.evaluacionLider ? '✏️ Editar' : '📝 Evaluar'}</button>
                </div>
              </div>
              {detalleVisible === c.id && <DetalleAutoEvaluacion autoevaluacion={c.autoevaluacion} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackForm({ feedback: col, cicloId, onVolver }) {
  const [com, setCom] = useState(''); const [fb, setFb] = useState(null); const [carg, setCarg] = useState(true);
  useEffect(() => { (async () => { const { data: { session } } = await supabase.auth.getSession(); const { data } = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', col.id).maybeSingle(); if (data) { setFb(data); setCom(data.comentario_lider || ''); } else { await supabase.from('feedback').insert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id }); } setCarg(false); })(); }, []);
  async function guardar() { const { data: { session } } = await supabase.auth.getSession(); await supabase.from('feedback').upsert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id, comentario_lider: com, fecha_feedback_lider: new Date() }, { onConflict: 'ciclo_id, colaborador_id' }); alert('✅ Feedback guardado'); onVolver(); }
  if (carg) return <p>Cargando...</p>;
  return <div style={{ maxWidth: 600 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver</button><h3>💬 Feedback: {col.full_name || col.email}</h3><textarea value={com} onChange={e => setCom(e.target.value)} placeholder="Deja tu feedback sobre el desempeño..." style={{ ...s.textarea, minHeight: 120, marginBottom: 12 }} />{fb?.confirmacion_colaborador && <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8, marginBottom: 16, color: '#166534' }}>✅ El colaborador ya confirmó este feedback</div>}<button onClick={guardar} style={s.btnPrimario}>💾 Guardar Feedback</button></div>;
}

function EvaluacionLider({ colaborador, cicloId, onVolver }) {
  const [competencias, setComp] = useState([]); const [ratings, setRatings] = useState({}); const [comentarios, setComent] = useState({});
  const [comFin, setComFin] = useState(''); const [msg, setMsg] = useState(''); const [carg, setCarg] = useState(true);
  const [autoEval, setAutoEval] = useState(null); const [evalData, setEvalData] = useState(null); const [showInfo, setShowInfo] = useState({});
  useEffect(() => { (async () => { const [{ data: comps }, { data: auto }, { data: { session } }] = await Promise.all([supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', colaborador.seniority || 'Analista'), supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales, puntuaciones(rating, competencia_id, comentario, competencias(nombre))').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle(), supabase.auth.getSession()]); setComp(comps || []); setAutoEval(auto); const { data: liderEval } = await supabase.from('evaluaciones').select('id, estado, comentarios_finales, rating_promedio, puntuaciones(rating, competencia_id, comentario)').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(); if (liderEval) { setEvalData(liderEval); setComFin(liderEval.comentarios_finales || ''); const rm = {}; const cm = {}; (liderEval.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComent(cm); } else { await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador', ciclo_id: cicloId }); } setCarg(false); })(); }, []);
  async function guardar() { const falt = competencias.filter(c => !comentarios[c.id]?.trim()); if (falt.length > 0) { setMsg(`❌ Completa el comentario de: ${falt.map(c => c.nombre).join(', ')}`); setTimeout(() => setMsg(''), 4000); return; } if (!comFin?.trim()) { setMsg('❌ Los comentarios finales son obligatorios'); setTimeout(() => setMsg(''), 4000); return; } const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (!ev) return; const vals = Object.values(ratings).filter(r => r > 0); const prom = vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null; await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom, updated_at: new Date() }).eq('id', ev.id); for (const [cid, r] of Object.entries(ratings)) { await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMsg('✅ Guardado'); setEvalData(p => ({ ...p, rating_promedio: prom })); setTimeout(() => setMsg(''), 2500); }
  async function enviar() { await guardar(); const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id); setMsg('🎉 Evaluación enviada'); setEvalData(p => ({ ...p, estado: 'enviado' })); }
  const calcProm = () => { const v = Object.values(ratings).filter(r => r > 0); return v.length > 0 ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; };
  if (carg) return <p>Cargando...</p>; const enviada = evalData?.estado === 'enviado'; const prom = calcProm();
  return <div style={{ maxWidth: 900 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>← Volver al equipo</button><h3>📝 Evaluando a: {colaborador.full_name || colaborador.email}</h3><p style={{ color: '#64748b', marginBottom: 24 }}>{colaborador.area} · {colaborador.seniority}</p>
    {autoEval?.estado === 'enviado' && <DetalleAutoEvaluacion autoevaluacion={autoEval} />}
    {competencias.map(comp => (<div key={comp.id} style={s.competenciaCard}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h5>{comp.nombre}</h5><p style={{ fontSize: 13, color: '#64748b', margin: '4px 0' }}>{comp.descripcion}</p></div><button onClick={() => setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] })} style={s.btnInfo}>{showInfo[comp.id] ? '🔼' : '🔽 Ver info'}</button></div>{showInfo[comp.id] && <div style={{ ...s.ratingInfoBox, marginTop: 8 }}>{[1, 2, 3, 4, 5].map(r => <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>)}</div>}<div style={s.ratingRow}>{[1, 2, 3, 4, 5].map(r => <button key={r} onClick={() => enviada ? null : setRatings({ ...ratings, [comp.id]: r })} style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', cursor: enviada ? 'not-allowed' : 'pointer' }} disabled={enviada}>{r}</button>)}</div><textarea value={comentarios[comp.id] || ''} onChange={e => setComent({ ...comentarios, [comp.id]: e.target.value })} placeholder="Comentario obligatorio" style={{ ...s.textareaSmall, borderColor: enviada ? '#D4D2C6' : (comentarios[comp.id]?.trim() ? '#D4D2C6' : '#dc2626') }} disabled={enviada} /></div>))}
    <SeccionText titulo="📝 Comentarios Finales (obligatorio)" valor={comFin} onChange={setComFin} disabled={enviada} />
    {prom && <div style={{ marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: '2px solid #231F20', textAlign: 'center' }}><p style={{ color: '#64748b' }}>Resultado Final</p><p style={{ fontSize: 48, fontWeight: 700, color: '#231F20' }}>{prom}</p></div>}
    {msg && <div style={s.mensajeToast}>{msg}</div>}
    {!enviada && <div style={{ display: 'flex', gap: 12, marginTop: 20 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar Borrador</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar Evaluación</button></div>}
    {enviada && <div style={s.bannerEnviado}>✅ Evaluación enviada.</div>}
  </div>;
}

function PanelColaborador({ userId, seniority, cicloId }) {
  const [competencias, setComp] = useState([]); const [ratings, setRatings] = useState({}); const [comentarios, setComent] = useState({});
  const [comFin, setComFin] = useState(''); const [msg, setMsg] = useState(''); const [carg, setCarg] = useState(true);
  const [evalLider, setEvalLider] = useState(null); const [feedback, setFeedback] = useState(null); const [evalData, setEvalData] = useState(null); const [showInfo, setShowInfo] = useState({});
  useEffect(() => { (async () => { const [{ data: comps }, { data: ev }, { data: le }, { data: fb }] = await Promise.all([supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', seniority || 'Analista'), supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales, puntuaciones(rating, competencia_id, comentario)').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(), supabase.from('evaluaciones').select('id, rating_calibrado, comentario_calibracion').eq('colaborador_id', userId).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(), supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', userId).maybeSingle()]); setComp(comps || []); setEvalLider(le); setFeedback(fb); if (ev) { setEvalData(ev); setComFin(ev.comentarios_finales || ''); const rm = {}; const cm = {}; (ev.puntuaciones || []).forEach(p => { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComent(cm); } else { await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador', ciclo_id: cicloId }); } setCarg(false); })(); }, []);
  async function guardar() { const falt = competencias.filter(c => !comentarios[c.id]?.trim()); if (falt.length > 0) { setMsg(`❌ Completa el comentario de: ${falt.map(c => c.nombre).join(', ')}`); setTimeout(() => setMsg(''), 4000); return; } if (!comFin?.trim()) { setMsg('❌ Los comentarios finales son obligatorios'); setTimeout(() => setMsg(''), 4000); return; } const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (!ev) return; const vals = Object.values(ratings).filter(r => r > 0); const prom = vals.length > 0 ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null; await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom, updated_at: new Date() }).eq('id', ev.id); for (const [cid, r] of Object.entries(ratings)) { await supabase.from('puntuaciones').upsert({ evaluacion_id: ev.id, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMsg('✅ Guardado'); setEvalData(p => ({ ...p, rating_promedio: prom })); setTimeout(() => setMsg(''), 2500); }
  async function enviar() { await guardar(); const { data: ev } = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (ev) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', ev.id); setMsg('🎉 Evaluación enviada'); setEvalData(p => ({ ...p, estado: 'enviado' })); }
  async function confirmarFB() { await supabase.from('feedback').update({ confirmacion_colaborador: true, fecha_confirmacion: new Date() }).eq('id', feedback.id); setFeedback({ ...feedback, confirmacion_colaborador: true }); alert('✅ Feedback confirmado'); }
  const calcProm = () => { const v = Object.values(ratings).filter(r => r > 0); return v.length > 0 ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : null; };
  if (carg) return <p>Cargando...</p>; const enviada = evalData?.estado === 'enviado'; const prom = calcProm();
  return <div style={{ maxWidth: 900 }}><h3>📝 Mi Autoevaluación</h3><p>Seniority: <strong>{seniority || 'No definido'}</strong></p><p>Estado: <strong style={{ color: enviada ? '#231F20' : '#f59e0b' }}>{enviada ? '✅ Enviada' : '📝 En progreso'}</strong></p>
    {feedback && <div style={{ padding: 16, background: feedback.confirmacion_colaborador ? '#dcfce7' : '#fef3c7', borderRadius: 10, marginBottom: 20 }}><h4>💬 Feedback de tu Líder</h4><p style={{ color: '#475569', fontStyle: 'italic' }}>{feedback.comentario_lider || 'Sin comentarios aún.'}</p>{!feedback.confirmacion_colaborador ? <button onClick={confirmarFB} style={{ ...s.btnPrimario, background: '#22c55e', marginTop: 8, fontSize: 13 }}>✅ Confirmar Feedback</button> : <p style={{ color: '#166534', marginTop: 8 }}>✅ Confirmado</p>}</div>}
    {evalLider?.rating_calibrado && <div style={{ padding: 16, background: '#D4D2C6', borderRadius: 10, marginBottom: 20, textAlign: 'center' }}><p>🎯 Resultado Final Calibrado</p><p style={{ fontSize: 36, fontWeight: 700 }}>{evalLider.rating_calibrado}</p>{evalLider.comentario_calibracion && <p style={{ marginTop: 8 }}>"{evalLider.comentario_calibracion}"</p>}</div>}
    {competencias.map(comp => (<div key={comp.id} style={s.competenciaCard}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h5>{comp.nombre}</h5><p style={{ fontSize: 13, color: '#64748b', margin: '4px 0' }}>{comp.descripcion}</p></div><button onClick={() => setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] })} style={s.btnInfo}>{showInfo[comp.id] ? '🔼' : '🔽 Ver info'}</button></div>{showInfo[comp.id] && <div style={{ ...s.ratingInfoBox, marginTop: 8 }}>{[1, 2, 3, 4, 5].map(r => <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>)}</div>}<div style={s.ratingRow}>{[1, 2, 3, 4, 5].map(r => <button key={r} onClick={() => enviada ? null : setRatings({ ...ratings, [comp.id]: r })} style={{ ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', cursor: enviada ? 'not-allowed' : 'pointer' }} disabled={enviada}>{r}</button>)}</div><textarea value={comentarios[comp.id] || ''} onChange={e => setComent({ ...comentarios, [comp.id]: e.target.value })} placeholder="Comentario obligatorio" style={{ ...s.textareaSmall, borderColor: enviada ? '#D4D2C6' : (comentarios[comp.id]?.trim() ? '#D4D2C6' : '#dc2626') }} disabled={enviada} /></div>))}
    <SeccionText titulo="📝 Comentarios Finales (obligatorio)" valor={comFin} onChange={setComFin} disabled={enviada} />
    {prom && <div style={{ marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: '2px solid #231F20', textAlign: 'center' }}><p style={{ color: '#64748b' }}>Resultado Final</p><p style={{ fontSize: 48, fontWeight: 700, color: '#231F20' }}>{prom}</p></div>}
    {msg && <div style={s.mensajeToast}>{msg}</div>}
    {!enviada && <div style={{ display: 'flex', gap: 12, marginTop: 20 }}><button onClick={guardar} style={s.btnSecundario}>💾 Guardar Borrador</button><button onClick={enviar} style={s.btnPrimario}>📤 Enviar Evaluación</button></div>}
    {enviada && <div style={s.bannerEnviado}>✅ Evaluación enviada.</div>}
  </div>;
}

function RatingDesc({ competenciaId, rating }) { const [desc, setDesc] = useState('Cargando...'); useEffect(() => { (async () => { const { data } = await supabase.from('rating_descriptions').select('titulo, descripcion').eq('competencia_id', competenciaId).eq('rating', rating).single(); if (data) setDesc(`${data.titulo}: ${data.descripcion}`); else setDesc('Sin descripción'); })(); }, [competenciaId, rating]); return <span>{desc}</span>; }
function SeccionText({ titulo, valor, onChange, disabled }) { return <div style={{ marginBottom: 24 }}><h4 style={s.seccionTitulo}>{titulo}</h4><textarea value={valor} onChange={e => onChange(e.target.value)} style={{ ...s.textarea, borderColor: disabled ? '#D4D2C6' : (valor?.trim() ? '#D4D2C6' : '#dc2626') }} disabled={disabled} /></div>; }

const th = { textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: '11px' };
const td = { padding: '6px 8px', fontSize: '13px' };
const sidebar = { aside: { width: '260px', background: '#231F20', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 0' }, logoContainer: { padding: '0 20px 20px', borderBottom: '1px solid #D4D2C6', marginBottom: 16, textAlign: 'center' }, nav: { display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', flex: 1 }, menuItem: { padding: '14px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, transition: 'all 0.15s', width: '100%' }, footer: { padding: '16px 20px', borderTop: '1px solid #D4D2C6' } };
const s = { centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20 }, header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#231F20' }, badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }, btnSalir: { padding: '8px 16px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }, tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }, grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }, seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#231F20', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #D4D2C6' }, competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14, border: '1px solid #e2e8f0' }, btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 }, ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }, ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }, ratingInfoBox: { background: 'white', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #e2e8f0' }, ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 }, textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, btnPrimario: { padding: '12px 24px', background: '#231F20', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, btnSecundario: { padding: '12px 24px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, mensajeToast: { padding: '12px 20px', background: '#D4D2C6', borderRadius: 8, marginBottom: 16, color: '#231F20', fontWeight: 500, fontSize: 14, textAlign: 'center' }, bannerEnviado: { padding: 20, background: '#D4D2C6', borderRadius: 10, color: '#231F20', fontWeight: 600, textAlign: 'center', marginTop: 20 } };
