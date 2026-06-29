// ============================================================
// PanelApp.jsx — Fabric Group
// Version con 7 cambios aplicados
// ============================================================
import { useState, useEffect, useMemo } from 'react';
import emailjs from "@emailjs/browser";
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';

// =============================================
// HELPERS
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

async function crearNotificacion(liderId, tipo, mensaje, origenId, origenNombre) {
 if (!liderId) return;
 await supabase.from("notificaciones").insert({ user_id: liderId, tipo: tipo, mensaje: mensaje, origen_id: origenId || null, origen_nombre: origenNombre || null });
}

async function enviarEmailNotificacion(toEmail, toName, subject, message) {
 try {
 await emailjs.send("service_xfgapna", "template_xs3nenc", { to_email: toEmail, to_name: toName, subject: subject, message: message }, "Mc-YPiWB1XNBKfhOJ");
 } catch (err) { console.warn("Error enviando email:", err); }
}


// =============================================
// CAMBIO 6: DashboardGlobal — trae siempre todos los ciclos
// =============================================

function DashboardGlobal() {
  var [tabActivo, setTabActivo] = useState('desempeno');
  var [statsDesempeno, setStatsDesempeno] = useState({ evaluaciones: [], puntuaciones: [], perfiles: [] });
  var [colabs, setColabs] = useState([]);
  var [ciclos, setCiclos] = useState([]);
  var [objetivosData, setObjetivosData] = useState([]);
  var [anioFiltro, setAnioFiltro] = useState(new Date().getFullYear());
  var [filtroAreaObj, setFiltroAreaObj] = useState('Todas');
  var [filtroColabObj, setFiltroColabObj] = useState('Todos');
  var [cargando, setCargando] = useState(true);
  var [filtroAreaDesemp, setFiltroAreaDesemp] = useState("Todas");
  var [filtroSeniorityDesemp, setFiltroSeniorityDesemp] = useState("Todos");
  var [filtroColabDesemp, setFiltroColabDesemp] = useState("Todos");
  // CAMBIO 6: valor inicial "Todos" para que siempre muestre todos los ciclos al entrar
  var [filtroCicloDesemp, setFiltroCicloDesemp] = useState("Todos");

  useEffect(function() { cargarTodo(); }, []);

  async function cargarTodo() {
    setCargando(true);
    // CAMBIO 6: se traen TODAS las evaluaciones sin filtrar por ciclo en la query.
    // El filtro por ciclo se aplica en la UI, y el default es "Todos",
    // por eso el 2do ciclo (y cualquier otro) siempre aparece desde el inicio.
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
  // CAMBIO 6: la primera opción es "Todos los ciclos" y es el valor por defecto
  var ciclosOpts = [{ id: 'Todos', nombre: 'Todos los ciclos' }].concat(ciclos);

  // Perfiles filtrados para desempeño
  var colabsFiltradosDesemp = colabs.filter(function(c) {
    if (filtroAreaDesemp !== 'Todas' && c.area !== filtroAreaDesemp) return false;
    if (filtroSeniorityDesemp !== 'Todos' && c.seniority !== filtroSeniorityDesemp) return false;
    if (filtroColabDesemp !== 'Todos' && c.id !== filtroColabDesemp) return false;
    return true;
  });
  var idsDesemp = colabsFiltradosDesemp.map(function(c) { return c.id; });

  // CAMBIO 6: cuando filtroCicloDesemp es "Todos" no filtra por ciclo,
  // mostrando evaluaciones de todos los ciclos juntos
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

  // Objetivos
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

  function SpiderMini({ datos }) {
    if (!datos || datos.length === 0) return <p style={{ color: '#94a3b8', textAlign: 'center', padding: 20, fontSize: 12 }}>Sin datos</p>;
    var N = datos.length; var CX = 350; var CY = 350; var R = 160;
    function pt(idx, val) { var a = (Math.PI * 2 * idx / N) - Math.PI / 2; var r = (val / 5) * R; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; }
    function pte(idx, r) { var a = (Math.PI * 2 * idx / N) - Math.PI / 2; return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) }; }
    var poly = datos.map(function(d, i) { var p = pt(i, d.prom); return p.x + ',' + p.y; }).join(' ');
    return (
      <svg viewBox="0 0 700 700" style={{ width: "100%", maxWidth: 560 }}>
        {[1,2,3,4,5].map(function(n) { return <polygon key={n} points={datos.map(function(_,i) { var p = pte(i,(n/5)*R); return p.x+','+p.y; }).join(' ')} fill="none" stroke={n===5?'#D4D2C6':'#e8e6e0'} strokeWidth={n===5?1.5:1} />; })}
        {datos.map(function(_,i) { var p = pte(i,R); return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="#e8e6e0" strokeWidth="1" />; })}
        <polygon points={poly} fill="rgba(35,31,32,0.12)" stroke="#231F20" strokeWidth="2" />
        {datos.map(function(d,i) { var p = pt(i,d.prom); return <circle key={i} cx={p.x} cy={p.y} r="4" fill="#231F20" />; })}
        {datos.map(function(d,i) {
          var p = pte(i,R+90); var anchor = p.x < CX-10 ? 'end' : p.x > CX+10 ? 'start' : 'middle';
          var words = d.nombre.split(' '); var lines = [];
          for (var w=0;w<words.length;w+=1) lines.push(words[w]);
          return <g key={i}>{lines.map(function(l,li) { return <text key={li} x={p.x} y={p.y-lines.length*9+li*17} fontSize="13" fill="#231F20" fontWeight="600" textAnchor={anchor}>{l}</text>; })}<text x={p.x} y={p.y+lines.length*9+8} fontSize="14" fill="#64748b" fontWeight="700" textAnchor={anchor}>{d.prom.toFixed(1)}</text></g>;
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

          {/* Filtros */}
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
            {/* CAMBIO 6: selector de ciclo — default "Todos los ciclos" */}
            <select value={filtroCicloDesemp} onChange={function(e) { setFiltroCicloDesemp(e.target.value); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #e8e6e0", fontSize: 13, background: "white" }}>
              {ciclosOpts.map(function(c) { return <option key={c.id} value={c.id}>{c.nombre}</option>; })}
            </select>
            {(filtroAreaDesemp !== "Todas" || filtroSeniorityDesemp !== "Todos" || filtroColabDesemp !== "Todos" || filtroCicloDesemp !== "Todos") && (
              <button
                onClick={function() { setFiltroAreaDesemp("Todas"); setFiltroSeniorityDesemp("Todos"); setFiltroColabDesemp("Todos"); setFiltroCicloDesemp("Todos"); }}
                style={{ fontSize: 12, padding: "7px 12px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fee2e2", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}
              >
                Limpiar
              </button>
            )}
          </div>

          {/* KPIs */}
          <div style={s.grid}>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Evaluaciones lider</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{evalLider.length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Calibradas</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{totalG1}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '3px solid #166534' }}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Alto desempeño</p><p style={{ fontSize: 32, fontWeight: 800, color: '#166534', margin: '6px 0' }}>{alto}</p></div>
            <div style={{ ...s.tarjetaStat, borderTop: '3px solid #dc2626' }}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Bajo desempeño</p><p style={{ fontSize: 32, fontWeight: 800, color: '#dc2626', margin: '6px 0' }}>{bajo}</p></div>
          </div>

          {/* Gráficos */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 20 }}>
            <div style={{ ...s.tarjetaStat, flex: 1, minWidth: 260 }}>
              <h4 style={{ margin: '0 0 6px 0', color: '#231F20', fontSize: 14, fontWeight: 700 }}>Distribución de Desempeño</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 11, color: '#94a3b8' }}>Solo evaluaciones calibradas</p>
              {totalG1 === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>Sin datos calibrados</p> : (
                [{ label: 'Alto', valor: alto, color: '#166534', rango: '3.6–5' }, { label: 'Medio', valor: medio, color: '#92400e', rango: '3–3.5' }, { label: 'Bajo', valor: bajo, color: '#dc2626', rango: '1–2.9' }].map(function(g) {
                  var pct = Math.round(g.valor / totalG1 * 100);
                  return (
                    <div key={g.label} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: g.color }}>{g.label} <span style={{ fontSize: 11, color: '#94a3b8' }}>({g.rango})</span></span>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{g.valor} ({pct}%)</span>
                      </div>
                      <div style={{ background: '#f1f5f9', borderRadius: 6, height: 22, overflow: 'hidden' }}>
                        <div style={{ background: g.color, height: '100%', width: pct + '%', borderRadius: 6 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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

          <div style={{ ...s.grid, marginBottom: 24 }}>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Objetivos {anioFiltro}</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{objsFiltrados.length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Validados</p><p style={{ fontSize: 32, fontWeight: 800, color: '#166534', margin: '6px 0' }}>{objsFiltrados.filter(function(o) { return o.status === 'validado'; }).length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Con alcance</p><p style={{ fontSize: 32, fontWeight: 800, color: '#1d4ed8', margin: '6px 0' }}>{objsFiltrados.filter(function(o) { return o.alcance_completado || o.alcance_validado; }).length}</p></div>
            <div style={s.tarjetaStat}><p style={{ color: '#64748b', fontSize: 13, margin: 0 }}>Alcance promedio</p><p style={{ fontSize: 32, fontWeight: 800, color: '#231F20', margin: '6px 0' }}>{rankingData.length > 0 ? (rankingData.reduce(function(s,r) { return s + parseFloat(r.prom); }, 0) / rankingData.length).toFixed(1) + '%' : '—'}</p></div>
          </div>

          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ ...s.tarjetaStat, flex: 1, minWidth: 280 }}>
              <h4 style={{ margin: '0 0 16px 0', color: '#231F20', fontSize: 14, fontWeight: 700 }}>Alcance promedio por área</h4>
              {alcanceAreaData.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>Sin alcances registrados</p> : (
                alcanceAreaData.map(function(d) {
                  var color = areaColor(d.area);
                  var pct = Math.min(parseFloat(d.prom), 120);
                  return (
                    <div key={d.area} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#231F20' }}>{d.area}</span>
                        <span style={{ fontSize: 14, fontWeight: 800, color: color }}>{d.prom}%</span>
                      </div>
                      <div style={{ background: '#f1f5f9', borderRadius: 6, height: 22, overflow: 'hidden' }}>
                        <div style={{ background: color, height: '100%', width: (pct / 120 * 100) + '%', borderRadius: 6 }} />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div style={{ ...s.tarjetaStat, flex: 2, minWidth: 320 }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#231F20', fontSize: 14, fontWeight: 700 }}>Ranking — Alcance anual por colaborador</h4>
              <p style={{ margin: '0 0 16px 0', fontSize: 11, color: '#94a3b8' }}>Promedio de alcances reportados/validados</p>
              {rankingData.length === 0 ? <p style={{ color: '#94a3b8', textAlign: 'center', padding: 40, fontSize: 13 }}>Sin alcances registrados para {anioFiltro}</p> : (
                <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                  {rankingData.map(function(d, idx) {
                    var color = areaColor(d.area);
                    var pct = Math.min(parseFloat(d.prom), 120);
                    var medal = idx === 0 ? '1' : idx === 1 ? '2' : idx === 2 ? '3' : String(idx + 1);
                    return (
                      <div key={d.nombre} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
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
                      </div>
                    );
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


// =============================================
// CAMBIO 2: EquipoLider — Evaluar (directos) vs Visualizar (indirectos)
// =============================================

function EquipoLider({ cicloId, profile, soloLectura }) {
 var [equipo, setEquipo] = useState([]);
 var [colSel, setColSel] = useState(null);
 var [soloLecturaColSel, setSoloLecturaColSel] = useState(false); // CAMBIO 2: controla si el colaborador seleccionado es solo lectura
 var [fbVis, setFbVis] = useState(null);
 var [busqueda, setBusqueda] = useState('');
 var [filtroArea, setFiltroArea] = useState('Todas');
 var [cargando, setCargando] = useState(true);

 useEffect(function() { cargar(); }, [cicloId]);

 async function cargar() {
   var { data: { session } } = await supabase.auth.getSession();
   if (!session) return;
   var uid = session.user.id;

   var { data: visibilidad } = await supabase.from('equipo_visibilidad').select('tipo, valor').eq('lider_id', uid);
   var todosLosColabs = [];

   if (visibilidad && visibilidad.length > 0) {
     var esTodos = visibilidad.some(function(v) { return v.tipo === 'todos'; });
     if (esTodos) {
       var { data: todos } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('activo', true).neq('id', uid).order('full_name');
       todosLosColabs = todos || [];
     } else {
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

 // CAMBIO 2: al seleccionar un colaborador se guarda si es solo lectura o no
 if (colSel) return (
   <EvaluacionLider
     colaborador={colSel}
     cicloId={cicloId}
     onVolver={function() { setColSel(null); setSoloLecturaColSel(false); cargar(); }}
     soloLectura={soloLecturaColSel}
   />
 );

 if (fbVis) return <FeedbackForm feedback={fbVis} cicloId={cicloId} onVolver={function() { setFbVis(null); cargar(); }} />;

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
         value={busqueda}
         onChange={function(e) { setBusqueda(e.target.value); }}
         placeholder="Buscar por nombre o puesto..."
         style={{ flex: 2, minWidth: 200, padding: '9px 14px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', boxSizing: 'border-box' }}
       />
       <select
         value={filtroArea}
         onChange={function(e) { setFiltroArea(e.target.value); }}
         style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', minWidth: 160 }}
       >
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
           var iniciales = (c.full_name || c.email || 'U').split(' ').slice(0, 2).map(function(p) { return p[0]; }).join('').toUpperCase();

           // ── CAMBIO 2 ────────────────────────────────────────────────────────
           // esDirecto determina qué botón mostrar y si puede editar o no
           var esDirecto = c.leader_id === profile.id;
           // ── FIN CAMBIO 2 ────────────────────────────────────────────────────

           return (
             <div key={c.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '3px solid ' + (esDirecto ? '#231F20' : '#D4D2C6'), padding: '16px 18px' }}>
               <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
                 <div style={{ width: 40, height: 40, borderRadius: 8, background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#231F20', flexShrink: 0 }}>
                   {iniciales}
                 </div>
                 <div style={{ flex: 1, minWidth: 0 }}>
                   <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                     <strong style={{ fontSize: 14, color: '#231F20' }}>{c.full_name || c.email}</strong>
                     {/* CAMBIO 2: badge "Indirecto" para los que no son reportes directos */}
                     {!esDirecto && (
                       <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: '#F0EDE8', color: '#64748b', fontWeight: 600 }}>
                         Indirecto
                       </span>
                     )}
                   </div>
                   <p style={{ margin: '2px 0 0 0', fontSize: 12, color: '#64748b' }}>{c.puesto || c.area}</p>
                   <p style={{ margin: '1px 0 0 0', fontSize: 11, color: '#94a3b8' }}>{c.area}</p>
                 </div>
               </div>

               <div style={{ display: 'flex', gap: 8 }}>
                 {/* ── CAMBIO 2 ────────────────────────────────────────────────
                     Directo   → botón "Evaluar" (editable) o "Ver evaluación" si ciclo cerrado
                     Indirecto → botón "Visualizar" (siempre solo lectura, no evalúa)
                 ── FIN CAMBIO 2 ──────────────────────────────────────────── */}
                 {esDirecto ? (
                   <button
                     onClick={function() {
                       setSoloLecturaColSel(soloLectura); // hereda el soloLectura del ciclo
                       setColSel(c);
                     }}
                     style={{ ...s.btnPrimario, flex: 1, fontSize: 12, padding: '8px 12px', textAlign: 'center' }}
                   >
                     {soloLectura ? 'Ver evaluación' : 'Evaluar'}
                   </button>
                 ) : (
                   <button
                     onClick={function() {
                       setSoloLecturaColSel(true); // indirecto siempre es solo lectura
                       setColSel(c);
                     }}
                     style={{ ...s.btnInfo, flex: 1, fontSize: 12, padding: '8px 12px', textAlign: 'center', background: '#F0EDE8' }}
                   >
                     Visualizar
                   </button>
                 )}

                 {/* CAMBIO 2: Feedback solo para reportes directos */}
                 {esDirecto && (
                   <button
                     onClick={function() { setFbVis(c); }}
                     style={{ ...s.btnSecundario, fontSize: 12, padding: '8px 12px' }}
                   >
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


// =============================================
// CAMBIO 3 + 5: PanelCalibracion — Confirmar funciona + PDF sin historial
// =============================================

function PanelCalibracion({ cicloId, colabs, onHist, soloLectura }) {
  var [datos, setDatos] = useState([]);
  var [carg, setCarg] = useState(true);
  var [filtro, setFiltro] = useState("Todas");
  var [editandoCal, setEditandoCal] = useState(null);
  var [calTemp, setCalTemp] = useState({ rating: "", comentario: "" });
  var [historial, setHistorial] = useState([]);
  var [showHistorial, setShowHistorial] = useState(false);
  var [nuevoComentario, setNuevoComentario] = useState("");
  var [colaboradorHist, setColaboradorHist] = useState(null);

  useEffect(function() { cargar(); }, [cicloId]);

  async function cargar() {
    setCarg(true);
    var [{ data: evs }, { data: historialData }] = await Promise.all([
      supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, evaluador_id, estado, rating_promedio, rating_calibrado, comentario_calibracion, puntuaciones(rating, competencia_id, comentario, competencias(nombre)), colaborador:colaborador_id(id, email, full_name, area, seniority, puesto)').eq('ciclo_id', cicloId).in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']),
      supabase.from('calibracion_historial').select('colaborador_id, tipo').eq('ciclo_id', cicloId).in('tipo', ['reabrir_lider', 'comentario', 'calibracion'])
    ]);
    var reabiertos = new Set((historialData || []).map(function(h) { return h.colaborador_id; }));
    var mapa = {};
    (evs || []).forEach(function(ev) {
      if (!ev.colaborador) return;
      if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, autoevaluacion: null, evaluacionLider: null, ratingFinal: null, comentarioCalibracion: null, promAuto: null, promLider: null, liderReabierto: false };
      if (ev.tipo_evaluacion === 'autoevaluacion') {
        mapa[ev.colaborador_id].autoevaluacion = ev;
        mapa[ev.colaborador_id].promAuto = ev.rating_promedio;
      }
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
    setDatos(Object.values(mapa));
    setCarg(false);
  }

  // ── CAMBIO 3 ────────────────────────────────────────────────────────────────
  // guardarCal ahora actualiza el estado local correctamente para que
  // el valor nuevo se vea sin necesidad de recargar
  async function guardarCal(evaluacionId, rating, comentario, ratingLider) {
    var rCal = parseFloat(rating) || 0;
    var rLid = parseFloat(ratingLider) || 0;
    if (rCal !== rLid && !comentario.trim()) {
      alert('Debes justificar por qué el rating calibrado difiere del rating del líder.');
      return false; // indica que no se guardó
    }
    await supabase.from('evaluaciones').update({ rating_calibrado: rating, comentario_calibracion: comentario }).eq('id', evaluacionId);
    // Actualizar estado local para reflejar el cambio sin recargar
    setDatos(function(prev) {
      return prev.map(function(d) {
        if (d.evaluacionLider?.id === evaluacionId) {
          return { ...d, ratingFinal: rating, comentarioCalibracion: comentario };
        }
        return d;
      });
    });
    return true; // indica que se guardó correctamente
  }
  // ── FIN CAMBIO 3 (guardarCal) ────────────────────────────────────────────────

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
    var autoPunts = {}, autoComs = {}, liderPunts = {}, liderComs = {}, compsOrden = [];
    var autoComentFin = '', liderComentFin = '';
    var promAuto = d.promAuto || null;
    var promLider = d.promLider || null;

    if (d.autoevaluacion?.id) {
      var { data: aev } = await supabase.from('evaluaciones').select('comentarios_finales, rating_promedio').eq('id', d.autoevaluacion.id).single();
      autoComentFin = aev?.comentarios_finales || '';
      if (!promAuto) promAuto = aev?.rating_promedio || null;
      var { data: ap } = await supabase.from('puntuaciones').select('rating, competencia_id, comentario').eq('evaluacion_id', d.autoevaluacion.id);
      (ap || []).forEach(function(p) { autoPunts[p.competencia_id] = p.rating; autoComs[p.competencia_id] = p.comentario || ''; });
    }

    if (d.evaluacionLider?.id) {
      var { data: lev } = await supabase.from('evaluaciones').select('comentarios_finales, rating_promedio').eq('id', d.evaluacionLider.id).single();
      liderComentFin = lev?.comentarios_finales || '';
      if (!promLider) promLider = lev?.rating_promedio || null;
      var { data: lp } = await supabase.from('puntuaciones').select('rating, competencia_id, comentario').eq('evaluacion_id', d.evaluacionLider.id);
      (lp || []).forEach(function(p) { liderPunts[p.competencia_id] = p.rating; liderComs[p.competencia_id] = p.comentario || ''; });
    }

    var todasIds = [...new Set([...Object.keys(autoPunts), ...Object.keys(liderPunts)])];
    if (todasIds.length > 0) {
      var { data: compsData } = await supabase.from('competencias').select('id, nombre').in('id', todasIds);
      (compsData || []).forEach(function(c) { compsOrden.push({ id: c.id, nombre: c.nombre }); });
    }

    if (compsOrden.length === 0) {
      var sen = d.colaborador?.seniority || 'Analista';
      var { data: cFB } = await supabase.from('competencias').select('id, nombre').eq('aplica_a', sen);
      if (!cFB || cFB.length === 0) { var { data: cAll } = await supabase.from('competencias').select('id, nombre'); cFB = cAll || []; }
      compsOrden = (cFB || []).map(function(c) { return { id: c.id, nombre: c.nombre }; });
    }

    var pdf = new jsPDF();
    var PW = 210; var MX = 12; var y = 32;
    var MID = PW / 2;
    var COL_L = MX;
    var COL_R = MID + 3;
    var COL_W = MID - MX - 3;

    function cab() { try { pdf.addImage('/logo.jpg', 'JPEG', MX, 6, 20, 20); } catch(e) {} }
    function pie() { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(6); pdf.setTextColor(148, 163, 184); pdf.text('Fabric Group | ' + new Date().toLocaleDateString('es-AR'), MX, 291); }
    function nuevaPag() { pie(); pdf.addPage(); cab(); y = 30; }
    function chk(h) { if (y + h > 278) nuevaPag(); }
    function t(str) {
      return (str || '').replace(/[áàäâ]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i').replace(/[óòöô]/g,'o').replace(/[úùüû]/g,'u')
        .replace(/[ÁÀÄÂ]/g,'A').replace(/[ÉÈËÊ]/g,'E').replace(/[ÍÌÏÎ]/g,'I').replace(/[ÓÒÖÔ]/g,'O').replace(/[ÚÙÜÛ]/g,'U')
        .replace(/[ñ]/g,'n').replace(/[Ñ]/g,'N').replace(/[^\x00-\x7E]/g,'?');
    }

    cab();

    pdf.setFont('times', 'bold'); pdf.setFontSize(12); pdf.setTextColor(35, 31, 32);
    pdf.text('EVALUACIÓN DE DESEMPEÑO', MX, y); y += 7;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(71, 85, 105);
    pdf.text(t('Colaborador: ' + (d.colaborador.full_name || d.colaborador.email)), MX, y); y += 5;
    pdf.text(t('Puesto: ' + (d.colaborador.puesto || d.colaborador.area || '-') + ' | Area: ' + (d.colaborador.area || '-') + ' | Fecha: ' + new Date().toLocaleDateString('es-AR')), MX, y); y += 8;

    chk(12);
    pdf.setFillColor(35, 31, 32);
    pdf.rect(MX, y, COL_W, 8, 'F');
    pdf.rect(MID + 2, y, COL_W, 8, 'F');
    pdf.setTextColor(212, 210, 198); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
    pdf.text('AUTOEVALUACION (Colaborador)', COL_L + 2, y + 5.5);
    pdf.text('EVALUACION DEL LIDER', COL_R + 2, y + 5.5);
    y += 10;

    var LINE_H = 4.5;
    var FONT_COM = 7;
    var COM_W = COL_W - 6;

    compsOrden.forEach(function(comp, idx) {
      var autoP = autoPunts[comp.id];
      var liderP = liderPunts[comp.id];
      var autoC = autoComs[comp.id] || '';
      var liderC = liderComs[comp.id] || '';

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

      pdf.setFillColor(212, 210, 198);
      pdf.rect(MX, yStart, PW - MX * 2, cabH, 'F');
      if (idx % 2 === 0) { pdf.setFillColor(248, 248, 245); } else { pdf.setFillColor(255, 255, 255); }
      pdf.rect(MX, yCuerpo, PW - MX * 2, cuerpoH, 'F');

      pdf.setTextColor(35, 31, 32); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
      pdf.text(t(comp.nombre.toUpperCase()), MX + 2, yStart + 5.5);

      pdf.setDrawColor(200, 198, 190); pdf.setLineWidth(0.3);
      pdf.line(MID, yCuerpo, MID, yCuerpo + cuerpoH);

      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(5.5); pdf.setTextColor(100, 116, 139);
      pdf.text('AUTOEVALUACION', COL_L + 2, yCuerpo + 4);
      pdf.text('EVALUACION LIDER', COL_R + 2, yCuerpo + 4);

      var yPunt = yCuerpo + 9;
      if (autoP) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(35, 31, 32); pdf.text('' + autoP + ' / 5', COL_L + 2, yPunt + 1.5); }
      else { pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184); pdf.text('Sin puntaje', COL_L + 2, yPunt + 1.5); }
      if (liderP) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(35, 31, 32); pdf.text('' + liderP + ' / 5', COL_R + 2, yPunt + 1.5); }
      else { pdf.setFont('helvetica', 'italic'); pdf.setFontSize(6.5); pdf.setTextColor(148, 163, 184); pdf.text('Sin puntaje', COL_R + 2, yPunt + 1.5); }

      var yComent = yPunt + 8;
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(FONT_COM); pdf.setTextColor(50, 50, 50);
      linAuto.forEach(function(l, i) { pdf.text(l, COL_L + 2, yComent + i * LINE_H); });
      linLider.forEach(function(l, i) { pdf.text(l, COL_R + 2, yComent + i * LINE_H); });

      y = yStart + totalH + 2;
      pdf.setDrawColor(212, 210, 198); pdf.setLineWidth(0.2);
      pdf.line(MX, y, PW - MX, y);
      y += 2;
    });

    y += 4;

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
        chk(lA.length * 4 + 3); lA.forEach(function(l) { pdf.text(t(l), MX, y); y += 4; }); y += 3;
      }
      if (liderComentFin) {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7); pdf.setTextColor(35, 31, 32);
        pdf.text('Lider:', MX, y); y += 4;
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(71, 85, 105);
        var lL = pdf.splitTextToSize(t(liderComentFin), PW - MX * 2);
        chk(lL.length * 4 + 3); lL.forEach(function(l) { pdf.text(t(l), MX, y); y += 4; }); y += 3;
      }
    }

    chk(52); y += 4;
    pdf.setFillColor(35, 31, 32); pdf.rect(MX, y, PW - MX * 2, 7, 'F');
    pdf.setTextColor(212, 210, 198); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5);
    pdf.text('RESULTADO FINAL', MX + 2, y + 5); y += 10;

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

    var rf = d.ratingFinal;
    if (rf) {
      var clCal = clasificarRating(parseFloat(rf));
      pdf.setFillColor(35, 31, 32); pdf.rect(MX, y, PW - MX * 2, 28, 'F');
      pdf.setTextColor(212, 210, 198); pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7); pdf.text('RATING CALIBRADO FINAL', MX + 4, y + 6);
      pdf.setFontSize(28); pdf.text(String(rf), MX + 4, y + 22);
      if (clCal) { pdf.setFontSize(10); pdf.setTextColor(255, 255, 255); pdf.text(clCal.label, MX + 22, y + 22); }
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

    // CAMBIO 5: historial de calibración EXCLUIDO del PDF (eliminado intencionalmente)
    pie();
    return pdf;
  }

  async function verPDF(d) {
    var pdf = await generarPDFCompleto(d);
    pdf.save('Evaluacion_' + (d.colaborador.full_name || d.colaborador.email).split(' ').join('_') + '.pdf');
  }

  var areas = useMemo(function() { return ['Todas'].concat([...new Set(datos.map(function(d) { return d.colaborador.area; }).filter(Boolean))]); }, [datos]);
  var df = filtro === 'Todas' ? datos : datos.filter(function(d) { return d.colaborador.area === filtro; });

  if (carg) return <p style={{ padding: 20 }}>Cargando datos de calibracion...</p>;

  return (
    <div style={{ ...s.tarjetaStat }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#231F20' }}>Calibracion - Auto vs Lider</h3>
        <select value={filtro} onChange={function(e) { setFiltro(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 14, background: 'white' }}>
          {areas.map(function(a) { return <option key={a} value={a}>{a}</option>; })}
        </select>
      </div>
      <p style={{ color: '#64748b', fontSize: 14, marginBottom: 20 }}>Comparacion de autoevaluacion y evaluacion del lider. Define el rating final calibrado.</p>

      {/* Panel de historial */}
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
          {historial.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: 20 }}>Sin registros aún.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historial.map(function(h) {
                var colores = {
                  reabrir_auto:  { bg: '#fef3c7', border: '#fcd34d', color: '#92400e', label: 'Reapertura Auto' },
                  reabrir_lider: { bg: '#dbeafe', border: '#93c5fd', color: '#1e40af', label: 'Reapertura Líder' },
                  calibracion:   { bg: '#dcfce7', border: '#86efac', color: '#166534', label: 'Calibración' },
                  comentario:    { bg: '#F0EDE8', border: '#D4D2C6', color: '#231F20', label: 'Comentario' },
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

      {df.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>No hay datos para mostrar.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1100px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e8e6e0', background: '#F0EDE8' }}>
                <th style={th}>Colaborador</th>
                <th style={th}>Area</th>
                <th style={th}>Seniority</th>
                <th style={th}>Auto</th>
                <th style={th}>Lider</th>
                <th style={th}>Evaluación Final</th>
                <th style={th}>Justificación</th>
                <th style={th}>Historial</th>
                <th style={th}>PDF</th>
                <th style={th}>Reabrir</th>
              </tr>
            </thead>
            <tbody>
              {df.map(function(d) {
                var clasifAuto  = clasificarRating(parseFloat(d.promAuto));
                var clasifLider = clasificarRating(parseFloat(d.promLider));
                return (
                  <tr key={d.colaborador.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={td}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td>
                    <td style={td}>{d.colaborador.area || '-'}</td>
                    <td style={td}>
                      <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }}>
                        {d.colaborador.seniority || '-'}
                      </span>
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{d.promAuto || '-'}</div>
                      {clasifAuto && <div style={{ fontSize: 9, color: clasifAuto.color, fontWeight: 600 }}>{clasifAuto.label}</div>}
                    </td>
                    <td style={{ ...td, textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 700 }}>{d.promLider || '-'}</div>
                      {clasifLider && <div style={{ fontSize: 9, color: clasifLider.color, fontWeight: 600 }}>{clasifLider.label}</div>}
                    </td>

                    {/* COLUMNA: Evaluación Final */}
                    <td style={{ ...td, textAlign: 'center', minWidth: 140 }}>
                      {d.evaluacionLider ? (
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 800, color: '#231F20', lineHeight: 1 }}>
                            {d.ratingFinal || d.promLider || '-'}
                          </div>
                          {clasificarRating(parseFloat(d.ratingFinal || d.promLider)) && (
                            <div style={{ fontSize: 9, color: clasificarRating(parseFloat(d.ratingFinal || d.promLider)).color, fontWeight: 700, marginBottom: 8, marginTop: 2 }}>
                              {clasificarRating(parseFloat(d.ratingFinal || d.promLider)).label}
                            </div>
                          )}
                          {!soloLectura && (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                              {/* ── CAMBIO 3: botón ✓ confirma, guarda en historial y cierra ── */}
                              {editandoCal !== d.colaborador.id && !d.ratingFinal && (
                                <button
                                  title="Confirmar como evaluacion final"
                                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #86efac', background: '#dcfce7', color: '#166534', cursor: 'pointer', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={async function() {
                                    var _evId     = d.evaluacionLider.id;
                                    var _pl       = parseFloat(d.promLider) || 0;
                                    var _colabId  = d.colaborador.id;
                                    if (!_pl) { alert('El líder aún no tiene rating promedio'); return; }
                                    var ok = await guardarCal(_evId, _pl, 'Confirmado sin cambios — rating igual al del líder', _pl);
                                    if (!ok) return;
                                    // Guardar en historial
                                    var { data: { session } } = await supabase.auth.getSession();
                                    await supabase.from('calibracion_historial').insert({
                                      ciclo_id: cicloId, colaborador_id: _colabId, evaluacion_id: _evId,
                                      tipo: 'calibracion',
                                      comentario: 'Rating calibrado confirmado: ' + _pl + ' (igual al rating del líder, sin cambios)',
                                      usuario_id: session.user.id, usuario_nombre: session.user.email
                                    });
                                    // CAMBIO 3: cierra el modo edición
                                    setEditandoCal(null);
                                  }}
                                >
                                  ✓
                                </button>
                              )}
                              {/* Botón lápiz — abre modo edición */}
                              {editandoCal !== d.colaborador.id && (
                                <button
                                  title="Editar evaluacion final"
                                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e8e6e0', background: 'white', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={function() {
                                    var _id = d.colaborador.id;
                                    setEditandoCal(_id);
                                    setCalTemp({ rating: d.ratingFinal || d.promLider || '', comentario: d.comentarioCalibracion || '' });
                                  }}
                                >
                                  ✏
                                </button>
                              )}
                              {/* Botón X — cancela sin guardar */}
                              {editandoCal === d.colaborador.id && (
                                <button
                                  title="Cancelar"
                                  style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #e8e6e0', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={function() { setEditandoCal(null); }}
                                >
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

                    {/* COLUMNA: Justificación / modo edición */}
                    <td style={{ ...td, minWidth: 260 }}>
                      {editandoCal === d.colaborador.id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <select
                            value={calTemp.rating}
                            onChange={function(e) { setCalTemp({ ...calTemp, rating: e.target.value }); }}
                            style={{ padding: '7px 10px', borderRadius: 8, border: '2px solid #231F20', fontSize: 14, fontWeight: 700, background: 'white' }}
                          >
                            <option value="">Seleccionar</option>
                            {['1.0','1.1','1.2','1.3','1.4','1.5','1.6','1.7','1.8','1.9','2.0','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8','2.9','3.0','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8','3.9','4.0','4.1','4.2','4.3','4.4','4.5','4.6','4.7','4.8','4.9','5.0'].map(function(v) { return <option key={v} value={v}>{v}</option>; })}
                          </select>
                          {parseFloat(calTemp.rating) !== parseFloat(d.promLider) && (
                            <textarea
                              value={calTemp.comentario}
                              onChange={function(e) { setCalTemp({ ...calTemp, comentario: e.target.value }); }}
                              placeholder="Justificación obligatoria si difiere del líder..."
                              style={{ padding: 8, borderRadius: 8, border: '2px solid #f59e0b', fontSize: 12, fontFamily: 'inherit', minHeight: 60, resize: 'vertical', boxSizing: 'border-box', width: '100%' }}
                            />
                          )}
                          {parseFloat(calTemp.rating) === parseFloat(d.promLider) && (
                            <p style={{ margin: 0, fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>Sin cambios — igual al líder, no requiere justificación</p>
                          )}
                          {/* ── CAMBIO 3: botón Confirmar guarda en historial y cierra edición ── */}
                          <button
                            style={{ ...s.btnPrimario, background: '#166534', padding: '8px 16px', fontSize: 12 }}
                            onClick={async function() {
                              if (!calTemp.rating) return alert('Seleccioná un rating');
                              if (parseFloat(calTemp.rating) !== parseFloat(d.promLider) && !calTemp.comentario.trim()) {
                                return alert('La justificación es obligatoria cuando el rating difiere del líder');
                              }
                              var _evId    = d.evaluacionLider.id;
                              var _r       = parseFloat(calTemp.rating);
                              var _c       = calTemp.comentario;
                              var _pl      = d.promLider;
                              var _colabId = d.colaborador.id;
                              var ok = await guardarCal(_evId, _r, _c, _pl);
                              if (!ok) return;
                              // Guardar en historial
                              var { data: { session } } = await supabase.auth.getSession();
                              await supabase.from('calibracion_historial').insert({
                                ciclo_id: cicloId, colaborador_id: _colabId, evaluacion_id: _evId,
                                tipo: 'calibracion',
                                comentario: 'Rating calibrado: ' + _r + (_c ? '. Justificacion: ' + _c : ''),
                                usuario_id: session.user.id, usuario_nombre: session.user.email
                              });
                              // CAMBIO 3: cierra el modo edición
                              setEditandoCal(null);
                            }}
                          >
                            Confirmar
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: d.comentarioCalibracion ? '#475569' : '#94a3b8', fontStyle: d.comentarioCalibracion ? 'normal' : 'italic', wordBreak: 'break-word' }}>
                          {d.liderReabierto
                            ? 'Cambio la evaluacion del lider — ver historial'
                            : d.ratingFinal
                              ? (d.comentarioCalibracion || 'Confirmado sin cambios')
                              : '—'}
                        </span>
                      )}
                    </td>

                    <td style={td}>
                      <button onClick={function() { cargarHistorial(d.colaborador.id); }} style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 14 }}>Ver</button>
                    </td>
                    <td style={td}>
                      <button onClick={function() { verPDF(d); }} style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Ver PDF</button>
                    </td>
                    <td style={{ ...td, minWidth: 160 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {d.autoevaluacion && d.autoevaluacion.estado === 'enviado' && (
                          <button
                            onClick={function() { reabrirEvaluacion(d.autoevaluacion.id, 'autoevaluación', d.colaborador.id, d.colaborador.full_name); }}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #fcd34d', background: '#fef3c7', color: '#92400e', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                          >
                            Reabrir Auto
                          </button>
                        )}
                        {d.evaluacionLider && d.evaluacionLider.estado === 'enviado' && (
                          <button
                            onClick={function() { reabrirEvaluacion(d.evaluacionLider.id, 'evaluación del líder', d.colaborador.id, d.colaborador.full_name); }}
                            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #93c5fd', background: '#dbeafe', color: '#1e40af', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                          >
                            Reabrir Líder
                          </button>
                        )}
                        {(!d.autoevaluacion || d.autoevaluacion.estado !== 'enviado') && (!d.evaluacionLider || d.evaluacionLider.estado !== 'enviado') && (
                          <span style={{ fontSize: 11, color: '#94a3b8' }}>Sin envíos</span>
                        )}
                        <button
                          onClick={function() { cargarHistorial(d.colaborador.id); }}
                          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', color: '#231F20', cursor: 'pointer', fontSize: 11, fontWeight: 600, marginTop: 4 }}
                        >
                          Ver historial
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


// =============================================
// CAMBIO 4: PanelColaborador — botón ver eval del líder calibrada
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
 // CAMBIO 4: estados para ver la evaluación del líder
 var [verEvalLider, setVerEvalLider] = useState(false);
 var [evalLiderDetalle, setEvalLiderDetalle] = useState(null);
 var [evalLiderPunts, setEvalLiderPunts] = useState({});

 useEffect(function() {
   (async function() {
     var [{ data: comps }, { data: ev }, { data: le }, { data: fb }] = await Promise.all([
       supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', seniority || 'Analista'),
       supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle(),
       // CAMBIO 4: traer también comentarios_finales y comentario_calibracion del líder
       supabase.from('evaluaciones').select('id, rating_calibrado, comentario_calibracion, estado, rating_promedio, comentarios_finales').eq('colaborador_id', userId).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(),
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

 // CAMBIO 4: carga el detalle de la evaluación del líder (puntuaciones + comentarios)
 async function cargarEvalLiderDetalle() {
   if (!evalLider?.id) return;
   var { data: punts } = await supabase
     .from('puntuaciones')
     .select('rating, competencia_id, comentario, competencias(nombre)')
     .eq('evaluacion_id', evalLider.id);
   var map = {};
   (punts || []).forEach(function(p) {
     map[p.competencia_id] = {
       rating: p.rating,
       comentario: p.comentario || '',
       nombre: p.competencias?.nombre || ''
     };
   });
   setEvalLiderDetalle(evalLider);
   setEvalLiderPunts(map);
   setVerEvalLider(true);
 }

 var yaEnviada = evalData?.estado === 'enviado';
 var bloqueado = soloLectura || yaEnviada;

 async function guardarPuntuaciones(evId) {
   for (var cid of Object.keys(ratings)) {
     var r = ratings[cid];
     if (!r) continue;
     var { data: ex } = await supabase.from('puntuaciones').select('id').eq('evaluacion_id', evId).eq('competencia_id', cid).maybeSingle();
     if (ex?.id) { await supabase.from('puntuaciones').update({ rating: r, comentario: comentarios[cid] || '' }).eq('id', ex.id); }
     else { await supabase.from('puntuaciones').insert({ evaluacion_id: evId, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }); }
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
   var { data: perfColabN } = await supabase.from("profiles").select("full_name, leader_id, email").eq("id", userId).single();
   if (perfColabN && perfColabN.leader_id) {
     if (localStorage.getItem("notifsActivas") !== "false") await crearNotificacion(perfColabN.leader_id, "autoevaluacion_enviada", (perfColabN.full_name || "Un colaborador") + " envió su autoevaluación", userId, perfColabN.full_name);
     var { data: liderN } = await supabase.from("profiles").select("email, full_name").eq("id", perfColabN.leader_id).single();
     if (localStorage.getItem("notifsActivas") !== "false" && liderN && liderN.email) {
       await enviarEmailNotificacion(liderN.email, liderN.full_name || "Líder", perfColabN.full_name + " envió su autoevaluación", (perfColabN.full_name || "Un colaborador") + " acaba de enviar su autoevaluación de desempeño. Ingresá a la plataforma para revisarla y completar tu evaluación.");
     }
   }
   setMsg('Autoevaluacion enviada correctamente');
 }

 if (carg) return <p>Cargando...</p>;

 var clasifCal = clasificarRating(parseFloat(evalLider?.rating_calibrado));

 // ── CAMBIO 4: vista de la evaluación del líder ────────────────────────────────
 if (verEvalLider && evalLiderDetalle) {
   var clasifLider = clasificarRating(parseFloat(evalLiderDetalle.rating_calibrado || evalLiderDetalle.rating_promedio));
   return (
     <div style={{ maxWidth: 900, width: "100%", overflow: "hidden" }}>
       <button
         onClick={function() { setVerEvalLider(false); }}
         style={{ ...s.btnInfo, marginBottom: 16 }}
       >
         ← Volver a mi evaluación
       </button>

       <h3 style={{ color: '#231F20', margin: '0 0 20px 0' }}>Evaluación de mi líder</h3>

       {/* Rating calibrado final */}
       {evalLiderDetalle.rating_calibrado && (
         <div style={{ padding: '24px', background: clasifLider?.bg || '#F0EDE8', borderRadius: 12, border: '2px solid ' + (clasifLider?.color || '#231F20'), marginBottom: 24, textAlign: 'center' }}>
           <p style={{ margin: '0 0 6px 0', fontSize: 12, fontWeight: 600, color: clasifLider?.color || '#231F20', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
             Rating calibrado final
           </p>
           <p style={{ margin: '0 0 6px 0', fontSize: 52, fontWeight: 800, color: clasifLider?.color || '#231F20', lineHeight: 1 }}>
             {evalLiderDetalle.rating_calibrado}
           </p>
           {clasifLider && (
             <p style={{ margin: '0 0 10px 0', fontSize: 15, fontWeight: 600, color: clasifLider.color }}>
               {clasifLider.label}
             </p>
           )}
           {evalLiderDetalle.comentario_calibracion && (
             <p style={{ margin: '10px 0 0 0', fontSize: 13, color: '#475569', fontStyle: 'italic', background: 'rgba(255,255,255,0.6)', padding: '8px 14px', borderRadius: 8 }}>
               {evalLiderDetalle.comentario_calibracion}
             </p>
           )}
         </div>
       )}

       {/* Detalle por competencia */}
       <div style={{ ...s.tarjetaStat, marginBottom: 20 }}>
         <h4 style={{ margin: '0 0 16px 0', color: '#231F20' }}>Detalle por competencia</h4>
         {Object.keys(evalLiderPunts).length === 0 ? (
           <p style={{ color: '#94a3b8', fontSize: 13 }}>El líder aún no completó las competencias.</p>
         ) : (
           <table style={{ width: '100%', borderCollapse: 'collapse' }}>
             <thead>
               <tr style={{ background: '#231F20' }}>
                 <th style={{ ...th, color: '#D4D2C6' }}>Competencia</th>
                 <th style={{ ...th, color: '#D4D2C6', textAlign: 'center', width: 80 }}>Puntaje</th>
                 <th style={{ ...th, color: '#D4D2C6' }}>Comentario del líder</th>
               </tr>
             </thead>
             <tbody>
               {Object.entries(evalLiderPunts).map(function(entry, idx) {
                 var compId = entry[0];
                 var data = entry[1];
                 return (
                   <tr key={compId} style={{ background: idx % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                     <td style={{ ...td, fontWeight: 500 }}>{data.nombre || compId}</td>
                     <td style={{ ...td, textAlign: 'center' }}>
                       <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: '#231F20', color: '#D4D2C6', fontSize: 16, fontWeight: 700 }}>
                         {data.rating}
                       </span>
                     </td>
                     <td style={{ ...td, fontSize: 13, color: '#475569', fontStyle: data.comentario ? 'normal' : 'italic' }}>
                       {data.comentario || 'Sin comentario'}
                     </td>
                   </tr>
                 );
               })}
             </tbody>
           </table>
         )}
       </div>

       {/* Comentarios finales del líder */}
       {evalLiderDetalle.comentarios_finales && (
         <div style={{ padding: 16, background: '#F0EDE8', border: '1px solid #D4D2C6', borderRadius: 12 }}>
           <h4 style={{ margin: '0 0 10px 0', color: '#231F20', fontSize: 14 }}>Comentarios finales del líder</h4>
           <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
             {evalLiderDetalle.comentarios_finales}
           </p>
         </div>
       )}
     </div>
   );
 }
 // ── FIN CAMBIO 4 ─────────────────────────────────────────────────────────────

 return (
   <div style={{ maxWidth: 900, width: "100%", overflow: "hidden" }}>
     <h3>Mi Autoevaluacion</h3>
     <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>
       {[puesto, seniority].filter(Boolean).join(" · ") || "Sin cargo definido"}
     </p>

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

     {/* CAMBIO 4: bloque del resultado calibrado con botón para ver la eval del líder */}
     {evalLider?.rating_calibrado && (
       <div style={{ padding: 20, background: clasifCal?.bg || '#D4D2C6', borderRadius: 10, marginBottom: 20, textAlign: 'center', border: '2px solid ' + (clasifCal?.color || '#231F20') }}>
         <p style={{ margin: '0 0 4px 0', color: clasifCal?.color || '#231F20', fontWeight: 600, fontSize: 13 }}>
           Resultado Final Calibrado
         </p>
         <p style={{ fontSize: 44, fontWeight: 700, margin: '6px 0', color: clasifCal?.color || '#231F20', lineHeight: 1 }}>
           {evalLider.rating_calibrado}
         </p>
         {clasifCal && (
           <p style={{ margin: '0 0 14px 0', fontSize: 14, color: clasifCal.color, fontWeight: 600 }}>
             {clasifCal.label}
           </p>
         )}
         {/* ── CAMBIO 4: botón para ver la evaluación del líder ── */}
         <button
           onClick={cargarEvalLiderDetalle}
           style={{
             padding: '9px 22px',
             borderRadius: 8,
             border: '2px solid ' + (clasifCal?.color || '#231F20'),
             background: 'transparent',
             color: clasifCal?.color || '#231F20',
             cursor: 'pointer',
             fontSize: 13,
             fontWeight: 600
           }}
         >
           Ver evaluación de mi líder
         </button>
       </div>
     )}

     {/* Competencias */}
     {competencias.map(function(comp) {
       return (
         <div key={comp.id} style={s.competenciaCard}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
             <div>
               <h5>{comp.nombre}</h5>
               <p style={{ fontSize: 13, color: '#64748b' }}>{comp.descripcion}</p>
             </div>
             <button onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }} style={s.btnInfo}>
               {showInfo[comp.id] ? 'v' : '>'}
             </button>
           </div>
           {showInfo[comp.id] && (
             <div style={{ ...s.ratingInfoBox, marginTop: 8 }}>
               {[1,2,3,4,5].map(function(r) {
                 return <div key={r} style={s.ratingInfoItem}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>;
               })}
             </div>
           )}
           <div style={s.ratingRow}>
             {[1,2,3,4,5].map(function(r) {
               return (
                 <button key={r}
                   onClick={function() { if (!bloqueado) setRatings({ ...ratings, [comp.id]: r }); }}
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
// CAMBIO 1: ObjetivosGerente — solo colaboradores con objetivos cargados
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
       if (areas.length > 0) {
         var { data: pa } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('activo', true).in('area', areas).order('full_name');
         todos = todos.concat(pa || []);
       }
       if (usuarios.length > 0) {
         var { data: pu } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('activo', true).in('id', usuarios);
         todos = todos.concat(pu || []);
       }
       var vistos = {};
       todos = todos.filter(function(c) { if (vistos[c.id]) return false; vistos[c.id] = true; return true; });
     }
   }

   // Siempre agregar reportes directos
   var { data: directos } = await supabase.from('profiles').select('id, email, full_name, area, seniority, puesto, leader_id').eq('leader_id', uid).eq('activo', true);
   (directos || []).forEach(function(c) {
     if (!todos.find(function(x) { return x.id === c.id; })) todos.push(c);
   });

   todos.sort(function(a, b) { return (a.full_name || '').localeCompare(b.full_name || ''); });

   // ── CAMBIO 1 ──────────────────────────────────────────────────────────────
   // Filtrar para mostrar SOLO los colaboradores que tienen al menos
   // un objetivo cargado (que no esté rechazado)
   if (todos.length > 0) {
     var idsEquipo = todos.map(function(c) { return c.id; });
     var { data: objsExistentes } = await supabase
       .from('objetivos')
       .select('colaborador_id')
       .in('colaborador_id', idsEquipo)
       .neq('status', 'rechazado');

     var idsConObjetivos = new Set(
       (objsExistentes || []).map(function(o) { return o.colaborador_id; })
     );

     todos = todos.filter(function(c) { return idsConObjetivos.has(c.id); });
   }
   // ── FIN CAMBIO 1 ──────────────────────────────────────────────────────────

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
       <p style={{ color: '#64748b', margin: 0, fontSize: 13 }}>
         {equipoFiltrado.length} colaborador{equipoFiltrado.length !== 1 ? 'es' : ''} con objetivos cargados
       </p>
     </div>

     <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
       <input
         value={busqueda}
         onChange={function(e) { setBusqueda(e.target.value); }}
         placeholder="Buscar por nombre o puesto..."
         style={{ flex: 2, minWidth: 200, padding: '9px 14px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', boxSizing: 'border-box' }}
       />
       <select
         value={filtroArea}
         onChange={function(e) { setFiltroArea(e.target.value); }}
         style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, background: 'white', minWidth: 160 }}
       >
         {areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las áreas' : a}</option>; })}
       </select>
       {(busqueda || filtroArea !== 'Todas') && (
         <button
           onClick={function() { setBusqueda(''); setFiltroArea('Todas'); }}
           style={{ ...s.btnInfo, color: '#dc2626', borderColor: '#fca5a5' }}
         >
           Limpiar
         </button>
       )}
     </div>

     {equipoFiltrado.length === 0 ? (
       <div style={{ textAlign: 'center', padding: 60, color: '#94a3b8', background: 'white', borderRadius: 12, border: '1px solid #e8e6e0' }}>
         <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
         <h3 style={{ color: '#231F20', marginBottom: 8 }}>
           {equipo.length === 0
             ? 'Ningún colaborador tiene objetivos cargados aún'
             : 'Sin resultados para los filtros seleccionados'}
         </h3>
         <p style={{ fontSize: 14 }}>
           {equipo.length === 0
             ? 'Cuando tus colaboradores carguen sus objetivos, los vas a ver acá.'
             : 'Probá con otros filtros.'}
         </p>
       </div>
     ) : (
       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
         {equipoFiltrado.map(function(col) {
           var iniciales = (col.full_name || col.email || 'U').split(' ').slice(0, 2).map(function(p) { return p[0]; }).join('').toUpperCase();
           var esDirecto = col.leader_id === profile.id;
           return (
             <div
               key={col.id}
               style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '3px solid ' + (esDirecto ? '#231F20' : '#D4D2C6'), padding: '16px 18px', cursor: 'pointer' }}
               onClick={function() { setColaboradorSeleccionado(col); }}
             >
               <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                 <div style={{ width: 36, height: 36, borderRadius: 8, background: '#F0EDE8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#231F20', flexShrink: 0 }}>
                   {iniciales}
                 </div>
                 <div>
                   <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                     <strong style={{ fontSize: 13, color: '#231F20' }}>{col.full_name || col.email}</strong>
                     {!esDirecto && (
                       <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: '#F0EDE8', color: '#64748b', fontWeight: 600 }}>Indirecto</span>
                     )}
                   </div>
                   <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#64748b' }}>{col.puesto || col.area}</p>
                 </div>
               </div>
               <button style={{ ...s.btnPrimario, width: '100%', fontSize: 12, padding: '8px', textAlign: 'center' }}>
                 Ver Objetivos
               </button>
             </div>
           );
         })}
       </div>
     )}
   </div>
 );
}


// =============================================
// CAMBIO 7: ModuloCapacitaciones — botón descargar material
// =============================================

function ModuloCapacitaciones({ profile, esAdmin }) {
  var [vista, setVista] = useState('lista');
  var [capSeleccionada, setCapSeleccionada] = useState(null);
  var [capacitaciones, setCapacitaciones] = useState([]);
  var [misParticipaciones, setMisParticipaciones] = useState([]);
  var [cargando, setCargando] = useState(true);
  var [form, setForm] = useState({ nombre: '', descripcion: '', fecha: '', duracion_horas: '', instructor: '', url_material: '' }); // CAMBIO 7: nuevo campo url_material
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
      var { data: parts } = await supabase.from('capacitacion_participantes').select('*, capacitacion:capacitacion_id(id, nombre, descripcion, fecha, duracion_horas, instructor, url_material)').eq('colaborador_id', profile.id); // CAMBIO 7: traer url_material
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
      nombre: form.nombre,
      descripcion: form.descripcion,
      fecha: form.fecha,
      duracion_horas: form.duracion_horas ? parseFloat(form.duracion_horas) : null,
      instructor: form.instructor,
      url_material: form.url_material || null, // CAMBIO 7: guardar url_material
      created_by: session.user.id
    }).select().single();
    if (nueva && seleccionados.length > 0) {
      await supabase.from('capacitacion_participantes').insert(
        seleccionados.map(function(cid) { return { capacitacion_id: nueva.id, colaborador_id: cid, fecha_completado: form.fecha }; })
      );
    }
    setForm({ nombre: '', descripcion: '', fecha: '', duracion_horas: '', instructor: '', url_material: '' });
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

    pdf.setFillColor(220, 217, 210);
    pdf.rect(0, 0, W, H, 'F');
    pdf.setDrawColor(160, 150, 135);
    pdf.setLineWidth(3);
    pdf.roundedRect(6, 6, W - 12, H - 12, 8, 8, 'S');
    pdf.setLineWidth(0.6);
    pdf.roundedRect(10, 10, W - 20, H - 20, 6, 6, 'S');
    pdf.setDrawColor(140, 130, 115);
    pdf.setLineWidth(0.6);
    pdf.line(W/2 - 65, 30, W/2 - 22, 30);
    pdf.line(W/2 + 22, 30, W/2 + 65, 30);
    try { pdf.addImage('/logo.jpg', 'JPEG', W/2 - 18, 15, 36, 36); } catch(e) {}

    pdf.setFont('times', 'bold');
    pdf.setFontSize(50);
    pdf.setTextColor(25, 22, 20);
    pdf.text('CERTIFICADO', W/2, 64, { align: 'center' });

    pdf.setDrawColor(130, 120, 105);
    pdf.setLineWidth(0.5);
    pdf.line(W/2 - 95, 68, W/2 + 95, 68);

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

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.setTextColor(70, 65, 55);
    pdf.text('Se extiende el siguiente certificado por haber completado', W/2, 102, { align: 'center' });
    pdf.text('exitosamente la capacitacion:', W/2, 110, { align: 'center' });

    var nombreCap = (capData && capData.nombre) ? capData.nombre : '';
    pdf.setFont('times', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(25, 22, 20);
    var linesCap = pdf.splitTextToSize(nombreCap, W - 100);
    pdf.text(linesCap, W/2, 121, { align: 'center' });

    var yDet = 121 + linesCap.length * 7 + 3;
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(100, 95, 85);
    var detalles = [];
    if (capData && capData.fecha) detalles.push(new Date(capData.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }));
    if (capData && capData.duracion_horas) detalles.push(capData.duracion_horas + ' horas');
    if (capData && capData.instructor) detalles.push('Instructor: ' + capData.instructor);
    if (detalles.length > 0) pdf.text(detalles.join('  ·  '), W/2, yDet, { align: 'center' });

    var yLinea = H - 34;
    var yNombre = H - 27;
    var yCargo = H - 21;

    pdf.setDrawColor(140, 130, 115); pdf.setLineWidth(0.5);
    pdf.line(W/4 - 38, yLinea, W/4 + 38, yLinea);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(35, 31, 32);
    pdf.text('Adrian Galvan', W/4, yNombre, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(100, 95, 85);
    pdf.text('Gerente de Recursos Humanos', W/4, yCargo, { align: 'center' });

    pdf.setDrawColor(140, 130, 115); pdf.setLineWidth(0.5);
    pdf.line(W*3/4 - 38, yLinea, W*3/4 + 38, yLinea);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(35, 31, 32);
    pdf.text('Florencia Salvaneschi', W*3/4, yNombre, { align: 'center' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(100, 95, 85);
    pdf.text('HRBP Operaciones', W*3/4, yCargo, { align: 'center' });

    pdf.save('Certificado_' + (nombreColab || 'colaborador').replace(/\s+/g, '_') + '.pdf');
  }

  var inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };
  var labelStyle = { fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 };

  if (cargando) return <p style={{ padding: 40, color: '#64748b' }}>Cargando...</p>;

  // ── VISTA COLABORADOR ──────────────────────────────────────────────────────
  if (!esAdmin) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ background: '#231F20', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: '#F0EDE8', fontSize: 22, fontWeight: 700 }}>Mis Capacitaciones</h2>
          <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#94a3b8' }}>
            {misParticipaciones.length} capacitación{misParticipaciones.length !== 1 ? 'es' : ''} completada{misParticipaciones.length !== 1 ? 's' : ''}
          </p>
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
                <div key={part.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '4px solid #231F20', padding: '16px 20px' }}>
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ margin: '0 0 6px 0', fontSize: 15, fontWeight: 700, color: '#231F20' }}>{cap?.nombre}</p>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {cap?.fecha && <span style={{ fontSize: 12, color: '#64748b' }}>{new Date(cap.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
                      {cap?.duracion_horas && <span style={{ fontSize: 12, color: '#64748b' }}>{cap.duracion_horas} hs</span>}
                      {cap?.instructor && <span style={{ fontSize: 12, color: '#64748b' }}>Instructor: {cap.instructor}</span>}
                    </div>
                    {cap?.descripcion && <p style={{ margin: '6px 0 0 0', fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{cap.descripcion}</p>}
                  </div>

                  {/* CAMBIO 7: botones en fila — Descargar certificado + Descargar material */}
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button
                      onClick={function() { generarCertificadoPDF(part, null); }}
                      style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#231F20', color: '#F0EDE8', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
                    >
                      Descargar Certificado
                    </button>

                    {/* CAMBIO 7: botón Descargar material — solo aparece si la capacitación tiene url_material */}
                    {cap?.url_material && (
                      <a
                        href={cap.url_material}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ padding: '8px 16px', borderRadius: 8, border: '2px solid #231F20', background: 'white', color: '#231F20', cursor: 'pointer', fontSize: 13, fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        ↓ Descargar Material
                      </a>
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

  // ── VISTA ADMIN — NUEVA CAPACITACIÓN ──────────────────────────────────────
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
            <div>
              <label style={labelStyle}>Nombre *</label>
              <input value={form.nombre} onChange={function(e) { setForm({...form, nombre: e.target.value}); }} style={inputStyle} placeholder="Ej: Escuela de Sushi" />
            </div>
            <div>
              <label style={labelStyle}>Descripción</label>
              <textarea value={form.descripcion} onChange={function(e) { setForm({...form, descripcion: e.target.value}); }} style={{ ...inputStyle, minHeight: 80, resize: 'vertical' }} placeholder="Descripción de la capacitación..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Fecha *</label>
                <input type="date" value={form.fecha} onChange={function(e) { setForm({...form, fecha: e.target.value}); }} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Duración (horas)</label>
                <input type="number" value={form.duracion_horas} onChange={function(e) { setForm({...form, duracion_horas: e.target.value}); }} style={inputStyle} placeholder="Ej: 8" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Instructor</label>
              <input value={form.instructor} onChange={function(e) { setForm({...form, instructor: e.target.value}); }} style={inputStyle} placeholder="Nombre del instructor" />
            </div>
            {/* CAMBIO 7: campo URL del material */}
            <div>
              <label style={labelStyle}>URL del material (opcional)</label>
              <input
                value={form.url_material}
                onChange={function(e) { setForm({...form, url_material: e.target.value}); }}
                style={inputStyle}
                placeholder="https://drive.google.com/... o cualquier enlace"
              />
              <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#94a3b8' }}>
                Si cargás un link, los colaboradores verán el botón "Descargar Material" en sus capacitaciones.
              </p>
            </div>
          </div>

          {/* Selector de participantes */}
          <div style={{ flex: 1, minWidth: 280, background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 24 }}>
            <h3 style={{ margin: '0 0 12px 0', color: '#231F20', fontSize: 15 }}>Participantes ({seleccionados.length})</h3>
            <input value={busquedaColab} onChange={function(e) { setBusquedaColab(e.target.value); }} placeholder="Buscar colaborador o área..." style={{ ...inputStyle, marginBottom: 12 }} />
            <div style={{ maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {colabsFiltrados.map(function(c) {
                var sel = seleccionados.includes(c.id);
                return (
                  <div key={c.id}
                    onClick={function() { setSeleccionados(function(p) { return sel ? p.filter(function(id) { return id !== c.id; }) : [...p, c.id]; }); }}
                    style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: sel ? '#231F20' : '#F0EDE8', border: '1px solid ' + (sel ? '#231F20' : '#e8e6e0') }}
                  >
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
          <button onClick={guardarCapacitacion} disabled={guardando} style={{ ...s.btnPrimario, opacity: guardando ? 0.6 : 1 }}>
            {guardando ? 'Guardando...' : 'Guardar capacitación'}
          </button>
          <button onClick={function() { setVista('lista'); setSeleccionados([]); }} style={s.btnSecundario}>Cancelar</button>
        </div>
      </div>
    );
  }

  // ── VISTA ADMIN — DETALLE ─────────────────────────────────────────────────
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

        <div style={{ background: '#231F20', borderRadius: 12, padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          {capSeleccionada.fecha && <span style={{ fontSize: 13, color: '#D4D2C6' }}>{new Date(capSeleccionada.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</span>}
          {capSeleccionada.duracion_horas && <span style={{ fontSize: 13, color: '#D4D2C6' }}>{capSeleccionada.duracion_horas} horas</span>}
          {capSeleccionada.instructor && <span style={{ fontSize: 13, color: '#D4D2C6' }}>Instructor: {capSeleccionada.instructor}</span>}
          <span style={{ fontSize: 13, color: '#86efac', fontWeight: 700 }}>{seleccionados.length} participantes</span>
          {/* CAMBIO 7: mostrar si tiene material cargado */}
          {capSeleccionada.url_material && (
            <a href={capSeleccionada.url_material} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: '#fcd34d', fontWeight: 600, textDecoration: 'none' }}>
              ↓ Ver material
            </a>
          )}
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
                        <button
                          onClick={function() { var _c = c; var _cap = capSeleccionada; generarCertificadoPDF({ profiles: _c }, _cap); }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: '#F0EDE8', color: '#231F20', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                        >
                          PDF
                        </button>
                        <button
                          onClick={function() { agregarQuitarParticipante(c.id); }}
                          style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #fca5a5', background: '#fee2e2', color: '#dc2626', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                        >
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
                  <div key={c.id}
                    onClick={function() { agregarQuitarParticipante(c.id); }}
                    style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: '#F0EDE8', border: '1px solid #e8e6e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
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

  // ── VISTA ADMIN — LISTA ───────────────────────────────────────────────────
  function exportarExcelCapacitaciones() {
    var rows = [['Capacitación', 'Descripción', 'Fecha', 'Duración (hs)', 'Instructor', 'URL Material', 'Cantidad Participantes', 'Participantes']];
    capacitaciones.forEach(function(cap) {
      var parts = (cap.capacitacion_participantes || []);
      var nombres = parts.map(function(p) { return p.profiles ? p.profiles.full_name : ''; }).filter(Boolean).join(', ');
      var fecha = cap.fecha ? new Date(cap.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '';
      rows.push([cap.nombre || '', cap.descripcion || '', fecha, cap.duracion_horas || '', cap.instructor || '', cap.url_material || '', parts.length, nombres]);
    });
    var bom = '\uFEFF';
    var csv = bom + rows.map(function(row) {
      return row.map(function(cell) { var val = String(cell).replace(/"/g, '""'); return '"' + val + '"'; }).join(';');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'Capacitaciones_Fabric_' + new Date().toLocaleDateString('es-AR').replace(/\//g,'-') + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, color: '#231F20', fontSize: 22, fontWeight: 700 }}>Capacitaciones</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>{capacitaciones.length} capacitación{capacitaciones.length !== 1 ? 'es' : ''} registrada{capacitaciones.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={exportarExcelCapacitaciones} style={s.btnInfo}>Exportar Excel</button>
          <button
            onClick={function() { setVista('nueva'); setSeleccionados([]); setBusquedaColab(''); setForm({ nombre: '', descripcion: '', fecha: '', duracion_horas: '', instructor: '', url_material: '' }); }}
            style={s.btnPrimario}
          >
            + Nueva capacitación
          </button>
        </div>
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
                    {/* CAMBIO 7: badge que indica si tiene material cargado */}
                    {cap.url_material && (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: '#dcfce7', color: '#166534' }}>Con material</span>
                    )}
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

// =============================================
// COMPONENTE PRINCIPAL PanelApp
// =============================================
export default function PanelApp() {
 var [profile, setProfile] = useState(null);
 var [loading, setLoading] = useState(true);
 var [menuActivo, setMenuActivo] = useState('desempeno');
 var [cicloActivo, setCicloActivo] = useState(null);
 var [vistaComoColaborador, setVistaComoColaborador] = useState(false);
 var [modulosVistaColab, setModulosVistaColab] = useState([]);
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
 var { data: mods } = await supabase.from('modulos_usuario').select('modulo').eq('user_id', perfil.id).eq('activo', true);
 var modulosCargados = (mods || []).map(function(m) { return m.modulo; });
 if (perfil.role === 'admin_rrhh' && modulosCargados.length === 0) {
   modulosCargados = ['desempeno', 'obj_individual', 'obj_compania', 'capacitaciones'];
 }
 setModulosActivos(modulosCargados);
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

 var modulosVer = esAdmin && !vistaComoColaborador
 ? ['desempeno', 'obj_individual', 'obj_compania', 'capacitaciones', 'dashboard_global']
 : modulosActivos;

 var verDesempeno = modulosVer.includes('desempeno');
 var verObjIndividual = modulosVer.includes('obj_individual');
 var verObjCompania = modulosVer.includes('obj_compania');
 var verAlgunObj = verObjIndividual || verObjCompania;
 var verCapacitaciones = !esAdmin ? modulosActivos.includes("capacitaciones") : (vistaComoColaborador ? modulosVistaColab.includes("capacitaciones") : true);

 return (
 <div style={{ display: 'flex', minHeight: '100vh' }}>
 <aside style={sidebarStyle.aside}>
 <div style={sidebarStyle.logoContainer}><img src="/logo.jpg" alt="Fabric Group" style={{ height: '40px' }} /></div>
 <nav style={sidebarStyle.nav}>
 {esSuperAdmin && !vistaComoColaborador && <button onClick={function() { setMenuActivo('dashboard_global'); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'dashboard_global' ? '#D4D2C6' : 'transparent', color: menuActivo === 'dashboard_global' ? '#231F20' : '#D4D2C6' }}>DASHBOARD</button>}
 {verDesempeno && <button onClick={function() { setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' }}>DESEMPEÑO</button>}
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
 {verCapacitaciones && <button onClick={function() { setMenuActivo("capacitaciones"); }} style={{ ...sidebarStyle.menuItem, background: menuActivo === "capacitaciones" ? "#D4D2C6" : "transparent", color: menuActivo === "capacitaciones" ? "#231F20" : "#D4D2C6" }}>CAPACITACIONES</button>}
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
 <button onClick={async function() { var { data: mods } = await supabase.from('modulos_usuario').select('modulo').eq('user_id', profile.id).eq('activo', true); setModulosVistaColab((mods || []).map(function(m) { return m.modulo; })); setVistaComoColaborador(true); setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ padding: '6px 14px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Ver como Colaborador</button>
 )}
 {esAdmin && vistaComoColaborador && (
 <button onClick={function() { setVistaComoColaborador(false); setMenuActivo('desempeno'); setCicloActivo(null); }} style={{ padding: '6px 14px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>Volver a Admin</button>
 )}
 <div style={{ position: "relative" }}>
 <button onClick={function() { setShowNotifs(!showNotifs); }} style={{ position: "relative", background: "transparent", border: "1px solid rgba(212,210,198,0.4)", borderRadius: 8, padding: "7px 12px", cursor: "pointer", color: "#D4D2C6", fontSize: 18 }}>🔔
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
 {notifs.map(function(n) { return (
 <div key={n.id} style={{ padding: "12px 16px", borderBottom: "1px solid #f1f0ec", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
 <div style={{ flex: 1 }}><p style={{ margin: "0 0 4px 0", fontSize: 13, color: "#231F20", lineHeight: 1.4 }}>{n.mensaje}</p><span style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(n.created_at).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></div>
 <button onClick={function() { marcarLeida(n.id); }} style={{ background: "none", border: "1px solid #e8e6e0", borderRadius: 6, cursor: "pointer", padding: "4px 8px", fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>Leída</button>
 </div>
 ); })}
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
// VISTAS SIN CAMBIOS
// =============================================

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

function PanelLiderConAutoevaluacion({ cicloId, profile, soloLectura }) {
 var [v, setV] = useState('equipo');
 return <div><div style={{ display: 'flex', gap: 12, marginBottom: 20 }}><button onClick={function() { setV('equipo'); }} style={v === 'equipo' ? s.btnPrimario : s.btnInfo}>Mi Equipo</button><button onClick={function() { setV('mievaluacion'); }} style={v === 'mievaluacion' ? s.btnPrimario : s.btnInfo}>Mi Evaluacion</button></div>{v === 'equipo' ? <EquipoLider cicloId={cicloId} profile={profile} soloLectura={soloLectura} /> : <PanelColaborador userId={profile.id} seniority={profile.seniority} puesto={profile.puesto} cicloId={cicloId} soloLectura={soloLectura} />}</div>;
}

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
 if (typeof window !== 'undefined' && !window.confirm('Eliminar el ciclo ' + ciclo.nombre + '. Se eliminarán también todos sus participantes.')) return;
 var cicloId = ciclo.id;
 var { data: evs } = await supabase.from('evaluaciones').select('id').eq('ciclo_id', cicloId);
 var evIds = (evs || []).map(function(e) { return e.id; });
 if (evIds.length > 0) await supabase.from('puntuaciones').delete().in('evaluacion_id', evIds);
 await supabase.from('evaluaciones').delete().eq('ciclo_id', cicloId);
 await supabase.from('feedback').delete().eq('ciclo_id', cicloId);
 await supabase.from('ciclo_colaboradores').delete().eq('ciclo_id', cicloId);
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

function FeedbackAdmin({ cicloId }) { var [fbs, setFbs] = useState([]); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data } = await supabase.from('feedback').select('*,lider:lider_id(email,full_name),colaborador:colaborador_id(email,full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setFbs(data || []); setCarg(false); })(); }, [cicloId]); if (carg) return <p>Cargando...</p>; return <div style={s.tarjetaStat}><h4>Feedback ({fbs.length})</h4>{fbs.length === 0 ? <p style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Sin registros.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Lider</th><th style={th}>Colaborador</th><th style={th}>Comentario</th><th style={th}>Fecha</th><th style={th}>OK</th></tr></thead><tbody>{fbs.map(function(f) { return (<tr key={f.id}><td style={td}>{f.lider?.full_name || '-'}</td><td style={td}>{f.colaborador?.full_name || '-'}</td><td style={td}>{f.comentario_lider || '-'}</td><td style={td}>{f.fecha_feedback_lider ? new Date(f.fecha_feedback_lider).toLocaleDateString('es-AR') : '-'}</td><td style={td}>{f.confirmacion_colaborador ? '' : ''}</td></tr>); })}</tbody></table>}</div>; }

function HistorialAdmin({ colaborador, onVolver }) { var [hist, setHist] = useState([]); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data } = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false }); setHist(data || []); setCarg(false); })(); }, []); if (carg) return <p>Cargando...</p>; return <div><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver</button><h3>Ver Historial: {colaborador.full_name || colaborador.email}</h3>{hist.length === 0 ? <p style={{ padding: 40, color: '#94a3b8' }}>Sin historial.</p> : <table style={{ width: '100%', borderCollapse: 'collapse' }}><thead><tr><th style={th}>Fecha</th><th style={th}>Rating</th></tr></thead><tbody>{hist.map(function(h) { return (<tr key={h.id}><td style={td}>{new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')}</td><td style={td}>{h.rating_final || '-'}</td></tr>); })}</tbody></table>}</div>; }

function FeedbackForm({ feedback: col, cicloId, onVolver }) { var [com, setCom] = useState(''); var [fb, setFb] = useState(null); var [carg, setCarg] = useState(true); useEffect(function() { (async function() { var { data: { session } } = await supabase.auth.getSession(); var { data } = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', col.id).maybeSingle(); if (data) { setFb(data); setCom(data.comentario_lider || ''); } else { await supabase.from('feedback').insert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id }); } setCarg(false); })(); }, []); async function guardar() { var { data: { session } } = await supabase.auth.getSession(); await supabase.from('feedback').upsert({ ciclo_id: cicloId, lider_id: session.user.id, colaborador_id: col.id, comentario_lider: com, fecha_feedback_lider: new Date() }, { onConflict: 'ciclo_id, colaborador_id' }); alert('Guardado'); onVolver(); } if (carg) return <p>Cargando...</p>; return <div style={{ maxWidth: 600 }}><button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver</button><h3>Feedback: {col.full_name || col.email}</h3><textarea value={com} onChange={function(e) { setCom(e.target.value); }} placeholder="Deja tu feedback..." style={{ ...s.textarea, minHeight: 120, marginBottom: 12 }} />{fb?.confirmacion_colaborador && <div style={{ padding: 12, background: '#dcfce7', borderRadius: 8, marginBottom: 16 }}>Confirmado</div>}<button onClick={guardar} style={s.btnPrimario}>Guardar</button></div>; }

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
 var { data: comps } = await supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', colaborador.seniority).order('nombre', { ascending: true });
 if (!comps || comps.length === 0) {
 var { data: todasComps } = await supabase.from('competencias').select('id, nombre, descripcion').order('nombre', { ascending: true });
 var vistos = {};
 comps = (todasComps || []).filter(function(c) { if (vistos[c.nombre]) return false; vistos[c.nombre] = true; return true; });
 }
 setComp(comps || []);
 var { data: { session } } = await supabase.auth.getSession();
 var { data: ae } = await supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle();
 if (ae) {
 var { data: ap } = await supabase.from('puntuaciones').select('id, rating, comentario, competencia_id').eq('evaluacion_id', ae.id);
 setAutoEval({ ...ae, puntuaciones: ap || [] });
 var mapa = {};
 (ap || []).forEach(function(p) { mapa[p.competencia_id] = { rating: p.rating, comentario: p.comentario || '' }; });
 setAutoPuntsMap(mapa);
 }
 var { data: liderEval } = await supabase.from('evaluaciones').select('id, estado, comentarios_finales, rating_promedio').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle();
 if (liderEval) {
 setEvalData(liderEval); setComFin(liderEval.comentarios_finales || '');
 var { data: punts } = await supabase.from('puntuaciones').select('rating, competencia_id, comentario').eq('evaluacion_id', liderEval.id);
 var rm = {}; var cm = {};
 (punts || []).forEach(function(p) { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; });
 setRatings(rm); setComent(cm);
 } else if (!soloLectura) {
 var { data: nuevo, error: insertErr } = await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador', ciclo_id: cicloId }).select('id').single();
 if (nuevo) { setEvalData(nuevo); } else {
 var { data: existing } = await supabase.from('evaluaciones').select('id, estado').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle();
 if (existing) { setEvalData(existing); }
 }
 }
 setCarg(false);
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
 var r = ratings[cid]; if (!r) continue;
 var { data: ex } = await supabase.from('puntuaciones').select('id').eq('evaluacion_id', evId).eq('competencia_id', cid).maybeSingle();
 if (ex?.id) { await supabase.from('puntuaciones').update({ rating: r, comentario: comentarios[cid] || '' }).eq('id', ex.id); }
 else { await supabase.from('puntuaciones').insert({ evaluacion_id: evId, competencia_id: cid, rating: r, comentario: comentarios[cid] || '' }); }
 }
 }

 async function guardar() {
 if (bloqueado) return;
 var evId = await obtenerOCrearEvalId(); if (!evId) { setMsg('Error al guardar'); return; }
 setMsg('Guardando...');
 var prom = calcularRating(ratings);
 await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', evId);
 await guardarPuntuacionesLider(evId);
 setMsg('Guardado'); setTimeout(function() { setMsg(''); }, 2500);
 }

 async function enviar() {
 if (bloqueado) return;
 var evId = await obtenerOCrearEvalId(); if (!evId) { setMsg('Error al enviar'); return; }
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

 if (carg) return <p>Cargando...</p>;

 return (
 <div style={{ maxWidth: 960, width: "100%", overflow: "hidden" }}>
 <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver</button>
 {soloLectura && !yaEnviada && (
   <div style={{ padding: 12, background: '#F0EDE8', border: '2px solid #D4D2C6', borderRadius: 10, marginBottom: 16, textAlign: 'center' }}>
     <strong style={{ color: '#64748b', fontSize: 14 }}>Modo visualización — reporte indirecto. No podés editar esta evaluación.</strong>
   </div>
 )}
 <h3 style={{ color: '#231F20', margin: '0 0 4px 0' }}>Evaluando a: {colaborador.full_name || colaborador.email}</h3>
 <p style={{ color: "#64748b", marginBottom: 20 }}>{[colaborador.puesto, colaborador.area, colaborador.seniority].filter(Boolean).join(" · ")}</p>
 {yaEnviada && (<div style={{ padding: 14, background: '#dcfce7', border: '2px solid #166534', borderRadius: 10, marginBottom: 20, textAlign: 'center' }}><strong style={{ color: '#166534', fontSize: 15 }}>Evaluacion enviada. No se puede modificar.</strong></div>)}
 {autoEval && (
 <div style={{ background: '#F0EDE8', border: '1px solid #e8e6e0', borderRadius: 12, padding: '14px 18px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <span style={{ fontWeight: 600, color: '#231F20', fontSize: 14 }}>Autoevaluacion del colaborador</span>
 <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
 <span style={{ fontSize: 12, color: autoEval.estado === 'enviado' ? '#166534' : '#92400e', fontWeight: 600 }}>{autoEval.estado === 'enviado' ? 'Enviada' : 'Borrador'}</span>
 {autoEval.rating_promedio && (<span style={{ background: '#231F20', color: '#D4D2C6', padding: '6px 14px', borderRadius: 8, fontWeight: 700, fontSize: 18 }}>{autoEval.rating_promedio}</span>)}
 </div>
 </div>
 )}
 {competencias.map(function(comp) {
 var autoData = autoPuntsMap[comp.id] || null;
 return (
 <div key={comp.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, marginBottom: 16, overflow: 'hidden' }}>
 <div style={{ background: '#D4D2C6', padding: '12px 16px' }}>
 <h5 style={{ margin: '0 0 4px 0', color: '#231F20', fontSize: 15 }}>{comp.nombre}</h5>
 {comp.descripcion && <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>{comp.descripcion}</p>}
 </div>
 <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
 <button onClick={function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 16px', fontSize: 12, color: '#64748b', fontWeight: 600 }}>{showInfo[comp.id] ? '▲ Ocultar niveles' : '▼ Ver niveles de desempeño'}</button>
 {showInfo[comp.id] && (<div style={{ padding: '0 16px 12px' }}>{[1,2,3,4,5].map(function(r) { return (<div key={r} style={{ padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', background: 'white', border: '1px solid #e2e8f0' }}><strong>Nivel {r}:</strong> <RatingDesc competenciaId={comp.id} rating={r} /></div>); })}</div>)}
 </div>
 <div style={{ padding: 16, overflow: 'hidden' }}>
 <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 14, overflow: 'hidden', wordBreak: 'break-word' }}>
 <p style={{ fontSize: 11, fontWeight: 700, color: '#64748b', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Autoevaluacion del colaborador</p>
 {autoData ? (
 <div>
 <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>{[1,2,3,4,5].map(function(r) { return (<div key={r} style={{ width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, background: autoData.rating === r ? '#231F20' : '#e2e8f0', color: autoData.rating === r ? '#D4D2C6' : '#94a3b8' }}>{r}</div>); })}</div>
 <div style={{ fontSize: 13, color: "#475569", fontStyle: autoData.comentario ? "normal" : "italic", wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap" }}>{autoData.comentario || 'Sin comentario'}</div>
 </div>
 ) : (<p style={{ fontSize: 13, color: '#92400e', fontStyle: 'italic', margin: 0 }}>El colaborador aun no completo esta competencia</p>)}
 </div>
 <div style={{ background: '#fff', border: '2px solid #D4D2C6', borderRadius: 10, padding: 14 }}>
 <p style={{ fontSize: 11, fontWeight: 700, color: '#231F20', margin: '0 0 10px 0', textTransform: 'uppercase', letterSpacing: 0.5 }}>Tu evaluacion</p>
 <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
 {[1,2,3,4,5].map(function(r) { return (<button key={r} onClick={function() { if (!bloqueado) setRatings({ ...ratings, [comp.id]: r }); }} style={{ width: 42, height: 42, borderRadius: 8, border: '2px solid', borderColor: ratings[comp.id] === r ? '#231F20' : '#e2e8f0', fontSize: 18, fontWeight: 700, cursor: bloqueado ? "default" : "pointer", background: ratings[comp.id] === r ? '#231F20' : '#f8fafc', color: ratings[comp.id] === r ? 'white' : '#475569' }}>{r}</button>); })}
 </div>
 <textarea value={comentarios[comp.id] || ''} onChange={function(e) { if (!bloqueado) setComent({ ...comentarios, [comp.id]: e.target.value }); }} placeholder="Escribe tu comentario sobre esta competencia..." style={{ ...s.textareaSmall, minHeight: 70, background: bloqueado ? "#f8fafc" : "#fff", width: "100%", boxSizing: "border-box" }} readOnly={bloqueado} />
 </div>
 </div>
 </div>
 );
 })}
 <RatingFinalBadge ratings={ratings} />
 <div style={{ marginTop: 8, marginBottom: 20 }}>
 <h4 style={s.seccionTitulo}>Comentarios Finales del Lider</h4>
 <textarea value={comFin} onChange={function(e) { if (!bloqueado) setComFin(e.target.value); }} placeholder="Resumen general de la evaluacion, fortalezas y areas de mejora..." style={{ ...s.textarea, minHeight: 120 }} disabled={bloqueado} readOnly={bloqueado} />
 </div>
 {autoEval?.comentarios_finales && (
 <div style={{ marginBottom: 20, padding: 16, background: "#F0EDE8", border: "1px solid #e8e6e0", borderRadius: 10, overflow: "hidden" }}>
 <h4 style={{ margin: '0 0 8px 0', color: '#231F20', fontSize: 14 }}>Comentarios finales del colaborador</h4>
 <p style={{ margin: 0, fontSize: 13, color: "#475569", wordBreak: "break-word", overflowWrap: "break-word", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{autoEval.comentarios_finales}</p>
 </div>
 )}
 {msg && <div style={s.mensajeToast}>{msg}</div>}
 {!bloqueado && (<div style={{ display: 'flex', gap: 12, marginTop: 8 }}><button onClick={enviar} style={s.btnPrimario}>Enviar evaluacion</button></div>)}
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
// GESTIÓN OBJETIVOS LIDER (del código original)
// =============================================
function GestionObjetivosLider({ colaborador, profile, onVolver }) {
 var [objetivos, setObjetivos] = useState([]);
 var [cargando, setCargando] = useState(true);
 var [modalValidarObj, setModalValidarObj] = useState(null);
 var [modalValidarAlcance, setModalValidarAlcance] = useState(null);
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

 var FORM_VACIO = { objetivo: '', corporativo: '', ponderacion: '', alcance_tipo: 'fecha', alcance_80_descripcion: '', alcance_80_fecha: '', alcance_80_meta: '', alcance_100_descripcion: '', alcance_100_fecha: '', alcance_100_meta: '', alcance_120_descripcion: '', alcance_120_fecha: '', alcance_120_meta: '' };

 useEffect(function() { cargarObjetivos(); cargarAlcanceAnualColab(); }, []);

 async function cargarObjetivos() { var { data } = await supabase.from('objetivos').select('*').eq('colaborador_id', colaborador.id).order('created_at', { ascending: false }); setObjetivos(data || []); setCargando(false); }

 async function cargarAlcanceAnualColab() { var { data } = await supabase.from("alcance_anual").select("*").eq("colaborador_id", colaborador.id).is("ciclo_id", null).maybeSingle(); setAlcanceAnualColab(data || null); }

 async function guardarAlcanceAnual() {
   if (!alcanceAnualTemp) return alert("Ingresu00e1 el alcance final");
   if (!justAlcanceAnual.trim()) return alert("La justificaciu00f3n es obligatoria");
   var { data: { session } } = await supabase.auth.getSession();
   await supabase.from("alcance_anual").upsert({ colaborador_id: colaborador.id, ciclo_id: null, alcance_final: parseFloat(alcanceAnualTemp), justificacion_lider: justAlcanceAnual, validado_por_lider: true, lider_id: session.user.id, fecha_validacion: new Date() }, { onConflict: "colaborador_id,ciclo_id" });
   await supabase.from("calibracion_historial").insert({ colaborador_id: colaborador.id, tipo: "comentario", comentario: "Alcance anual validado por lider: " + alcanceAnualTemp + "%. Justificacion: " + justAlcanceAnual, usuario_id: session.user.id, usuario_nombre: session.user.email });
   setEditandoAlcanceAnual(false); setAlcanceAnualTemp(""); setJustAlcanceAnual(""); cargarAlcanceAnualColab();
 }

 async function ejecutarValidacionObj() {
   if (!accion) return alert('Selecciona una accion');
   if (!comentario.trim()) return alert('El comentario es obligatorio');
   var nuevoStatus = accion === 'aprobar' ? 'pendiente' : 'rechazado';
   await supabase.from('objetivos').update({ status: nuevoStatus, validado_por_gerente: accion === 'aprobar', comentario_lider: comentario, comentario_rechazo_lider: accion === 'rechazar' ? comentario : null, fecha_validacion: new Date() }).eq('id', modalValidarObj.id);
   setModalValidarObj(null); setAccion(''); setComentario(''); cargarObjetivos();
 }

 async function ejecutarValidacionAlcance() {
   if (!alcanceLider) return alert('Selecciona el alcance validado');
   if (!comentValidacion.trim()) return alert('El comentario es obligatorio');
   var pond = parseFloat(modalValidarAlcance.ponderacion) || 0;
   await supabase.from('objetivos').update({ status: 'validado', validado_por_gerente: true, alcance_validado: alcanceLider, comentario_validacion_lider: comentValidacion, fecha_validacion_lider: new Date(), ponderacion_final: pond * parseFloat(alcanceLider) / 100 }).eq('id', modalValidarAlcance.id);
   setModalValidarAlcance(null); setAlcanceLider(''); setComentValidacion(''); cargarObjetivos();
 }

 async function guardarNuevoObjetivo(datosForm) {
   var { data: { session } } = await supabase.auth.getSession();
   var datos = { objetivo: datosForm.objetivo, corporativo: datosForm.corporativo, ponderacion: parseFloat(datosForm.ponderacion), alcance_tipo: datosForm.alcance_tipo, alcance_80_descripcion: datosForm.alcance_80_descripcion, alcance_80_fecha: datosForm.alcance_80_fecha || null, alcance_80_meta: datosForm.alcance_80_meta, alcance_100_descripcion: datosForm.alcance_100_descripcion, alcance_100_fecha: datosForm.alcance_100_fecha || null, alcance_100_meta: datosForm.alcance_100_meta, alcance_120_descripcion: datosForm.alcance_120_descripcion, alcance_120_fecha: datosForm.alcance_120_fecha || null, alcance_120_meta: datosForm.alcance_120_meta, colaborador_id: colaborador.id, gerente_id: session.user.id, status: "pendiente", leader_id: colaborador.leader_id || null };
   await supabase.from('objetivos').insert(datos);
   setMostrarFormNuevo(false); setFormObj(null); cargarObjetivos();
 }

 var objValidados = objetivos.filter(function(o) { return o.status === 'validado' && o.alcance_validado; });
 var alcanceTotal = null;
 if (objValidados.length > 0) { var sumaPond = objValidados.reduce(function(s, o) { return s + parseFloat(o.ponderacion); }, 0); var sumaAlc = objValidados.reduce(function(s, o) { return s + parseFloat(o.alcance_validado) * parseFloat(o.ponderacion); }, 0); alcanceTotal = sumaPond > 0 ? (sumaAlc / sumaPond).toFixed(1) : null; }
 var totalPond = objetivos.filter(function(o) { return o.status !== 'rechazado'; }).reduce(function(s, o) { return s + (parseFloat(o.ponderacion) || 0); }, 0);

 if (cargando) return <p>Cargando...</p>;

 return (
 <div>
 <button onClick={onVolver} style={{ ...s.btnInfo, marginBottom: 16 }}>Volver al equipo</button>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
 <div>
 <h2 style={{ color: '#231F20', margin: '0 0 4px 0' }}>Objetivos u2014 {colaborador.full_name || colaborador.email}</h2>
 <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
 <span style={{ fontSize: 13, color: totalPond === 100 ? '#166534' : '#64748b', fontWeight: 600 }}>Ponderacion total: {totalPond.toFixed(0)}% {totalPond === 100 ? '' : ''}</span>
 {alcanceTotal && (<span style={{ fontSize: 14, fontWeight: 700, color: '#1e40af', background: '#dbeafe', padding: '4px 12px', borderRadius: 8 }}>Alcance anual: {alcanceTotal}%</span>)}
 </div>
 </div>
 <button onClick={function() { setFormObj({ ...FORM_VACIO, ponderacion: Math.max(0, 100 - totalPond) }); setMostrarFormNuevo(true); }} style={{ ...s.btnPrimario, background: '#22c55e', fontSize: 13 }}>+ Agregar objetivo</button>
 </div>

 {mostrarFormNuevo && formObj && (
 <FormObjetivo valor={formObj} onChange={setFormObj} objetivos={objetivos} editandoId={null} titulo={'Nuevo objetivo para ' + (colaborador.full_name || colaborador.email)} onGuardar={guardarNuevoObjetivo} onCancelar={function() { setMostrarFormNuevo(false); setFormObj(null); }} />
 )}

 {modalValidarObj && (
 <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setModalValidarObj(null); }}>
 <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 500, width: '90%' }} onClick={function(e) { e.stopPropagation(); }}>
 <h3 style={{ marginTop: 0 }}>Validar definicion de objetivo</h3>
 <p style={{ color: '#64748b', fontSize: 14 }}><strong>{modalValidarObj.objetivo}</strong></p>
 <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Accion *</label><div style={{ display: 'flex', gap: 10 }}><button onClick={function() { setAccion('aprobar'); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: '2px solid', borderColor: accion === 'aprobar' ? '#166534' : '#e2e8f0', background: accion === 'aprobar' ? '#dcfce7' : 'white', cursor: 'pointer', fontWeight: 600, color: '#166534' }}>Aprobar</button><button onClick={function() { setAccion('rechazar'); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: '2px solid', borderColor: accion === 'rechazar' ? '#dc2626' : '#e2e8f0', background: accion === 'rechazar' ? '#fee2e2' : 'white', cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}>Rechazar</button></div></div>
 <div style={{ marginBottom: 16 }}><label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Comentario *</label><textarea value={comentario} onChange={function(e) { setComentario(e.target.value); }} placeholder="Explicu00e1 tu decisiu00f3n..." style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 8, border: '2px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} /></div>
 <div style={{ display: 'flex', gap: 12 }}><button onClick={ejecutarValidacionObj} style={{ ...s.btnPrimario, background: accion === 'aprobar' ? '#22c55e' : '#dc2626', flex: 1 }}>Confirmar</button><button onClick={function() { setModalValidarObj(null); setAccion(''); setComentario(''); }} style={s.btnSecundario}>Cancelar</button></div>
 </div>
 </div>
 )}

 {modalValidarAlcance && (
   <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }} onClick={function() { setModalValidarAlcance(null); }}>
     <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 560, width: '90%', maxHeight: '90vh', overflowY: 'auto' }} onClick={function(e) { e.stopPropagation(); }}>
       <h3 style={{ marginTop: 0, color: '#231F20' }}>Validar alcance</h3>
       <p style={{ fontSize: 14, color: '#231F20', marginBottom: 12 }}><strong>{modalValidarAlcance.objetivo}</strong></p>
       <div style={{ background: '#F0EDE8', border: '1px solid #D4D2C6', borderRadius: 8, padding: 12, marginBottom: 20 }}>
         <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>Colaborador reportu00f3: {modalValidarAlcance.alcance_completado}%</p>
         {modalValidarAlcance.justificacion_completado && <p style={{ margin: '4px 0 0 0', fontSize: 12, color: '#475569' }}>{modalValidarAlcance.justificacion_completado}</p>}
       </div>
       <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#231F20' }}>Alcance validado</p>
       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
         {[{v:'80',c:'#92400e',bg:'#fef3c7'},{v:'100',c:'#166534',bg:'#dcfce7'},{v:'120',c:'#1e40af',bg:'#dbeafe'}].map(function(a) {
           var sel = alcanceLider === a.v;
           return <button key={a.v} onClick={function() { setAlcanceLider(a.v); }} style={{ padding: '12px 8px', borderRadius: 10, cursor: 'pointer', border: '2px solid', borderColor: sel ? a.c : '#e2e8f0', background: sel ? a.bg : 'white', fontWeight: 700, fontSize: 16, color: a.c }}>{a.v}%</button>;
         })}
       </div>
       <div style={{ marginBottom: 16 }}>
         <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>O escribu00ed un valor personalizado</label>
         <input type="number" min="0" max="200" value={alcanceLider} onChange={function(e) { setAlcanceLider(e.target.value); }} placeholder="Ej: 90, 110..." style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '2px solid #D4D2C6', fontSize: 15, fontWeight: 700, boxSizing: 'border-box' }} />
       </div>
       <div style={{ marginBottom: 16 }}>
         <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Comentario de validaciu00f3n</label>
         <textarea value={comentValidacion} onChange={function(e) { setComentValidacion(e.target.value); }} placeholder="Opcional u2014 justificu00e1 el alcance validado..." style={{ width: '100%', minHeight: 70, padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
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
               <span style={{ fontSize: 12, fontWeight: 600, color: color }}>{obj.corporativo || 'Sin categoru00eda'}</span>
             </div>
             <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: statusBg[obj.status] || '#f1f5f9', color: statusColor[obj.status] || '#475569' }}>{obj.status ? obj.status.charAt(0).toUpperCase() + obj.status.slice(1) : '-'}</span>
           </div>
           <p style={{ margin: '0 0 12px 0', fontSize: 14, color: '#231F20', lineHeight: 1.55, wordBreak: 'break-word' }}>{obj.objetivo}</p>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
             <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
               {fechaRef && <span style={{ fontSize: 12, color: '#94a3b8' }}>{new Date(fechaRef).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
               {obj.alcance_completado && <span style={{ fontSize: 12, color: '#0369a1', fontWeight: 600 }}>Colaborador reportu00f3: {obj.alcance_completado}%</span>}
               {obj.alcance_validado && <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>Alcance validado: {obj.alcance_validado}%</span>}
               {obj.comentario_lider && <span style={{ fontSize: 12, color: '#64748b', fontStyle: 'italic' }}>{obj.comentario_lider}</span>}
             </div>
             <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
               <span style={{ fontSize: 24, fontWeight: 800, color: '#231F20' }}>{obj.ponderacion}%</span>
               {obj.status === 'pendiente' && !obj.validado_por_gerente && (
                 <button onClick={function() { setModalValidarObj(obj); setAccion(''); setComentario(''); }} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#f59e0b', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Revisar</button>
               )}
               {obj.status === 'completado' && (
                 <button onClick={function() { setModalValidarAlcance(obj); setAlcanceLider(''); setComentValidacion(''); }} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Validar alcance</button>
               )}
             </div>
           </div>
           {obj.justificacion_completado && (
             <div style={{ marginTop: 10, padding: '8px 12px', background: '#f0f9ff', borderRadius: 8, fontSize: 12, color: '#0369a1' }}>Justificaciu00f3n: {obj.justificacion_completado}</div>
           )}
         </div>
       );
     })}
   </div>
 )}

 {objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length > 0 && (
   <div style={{ marginTop: 24, background: '#231F20', borderRadius: 14, padding: '20px 24px', color: '#F0EDE8' }}>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
       <div>
         <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alcance Anual u2014 {colaborador.full_name}</p>
         <p style={{ margin: '4px 0 0 0', fontSize: 11, color: '#64748b' }}>Promedio de {objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length} objetivos con alcance reportado</p>
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
             <p style={{ margin: 0, fontSize: 36, fontWeight: 800, color: '#D4D2C6' }}>{(objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).reduce(function(s,o) { return s + parseFloat(o.alcance_completado); }, 0) / objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length).toFixed(1)}%</p>
             <p style={{ margin: '2px 0 0 0', fontSize: 11, color: '#64748b' }}>Calculado u2014 pendiente de validacion</p>
           </div>
         )}
       </div>
     </div>
     {!editandoAlcanceAnual ? (
       <button onClick={function() { setEditandoAlcanceAnual(true); setAlcanceAnualTemp(alcanceAnualColab?.alcance_final || (objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).reduce(function(s,o) { return s + parseFloat(o.alcance_completado); }, 0) / objetivos.filter(function(o) { return o.alcance_completado && o.status !== 'rechazado'; }).length).toFixed(1)); setJustAlcanceAnual(alcanceAnualColab?.justificacion_lider || ''); }} style={{ marginTop: 16, padding: '8px 16px', borderRadius: 8, border: '1px solid rgba(212,210,198,0.4)', background: 'transparent', color: '#D4D2C6', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
         {alcanceAnualColab?.validado_por_lider ? 'Editar validacion' : 'Validar alcance anual'}
       </button>
     ) : (
       <div style={{ marginTop: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 16 }}>
         <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
           <label style={{ fontSize: 12, color: '#D4D2C6', fontWeight: 600, whiteSpace: 'nowrap' }}>Alcance final (%)</label>
           <input type="number" min="0" max="200" value={alcanceAnualTemp} onChange={function(e) { setAlcanceAnualTemp(e.target.value); }} style={{ width: 80, padding: '8px 10px', borderRadius: 6, border: '2px solid #D4D2C6', fontSize: 16, fontWeight: 700, textAlign: 'center', background: 'white', color: '#231F20' }} />
         </div>
         <textarea value={justAlcanceAnual} onChange={function(e) { setJustAlcanceAnual(e.target.value); }} placeholder="Justificacion del alcance final (obligatoria)..." style={{ width: '100%', minHeight: 70, padding: 10, borderRadius: 8, border: '1px solid rgba(212,210,198,0.4)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: 'rgba(255,255,255,0.08)', color: '#F0EDE8' }} />
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

// =============================================
// FORM OBJETIVO
// =============================================
function FormObjetivo({ valor, onChange, objetivos, editandoId, onGuardar, onCancelar, titulo }) {
 var [obj, setObj] = useState(valor || {});
 function actualizar(nuevo) { setObj(nuevo); if (onChange) onChange(nuevo); }
 var tipoAlcance = obj.alcance_tipo || 'fecha';
 var usada = (objetivos || []).filter(function(o) { return String(o.id) !== String(editandoId) && o.status !== 'rechazado'; }).reduce(function(sum, o) { return sum + (parseFloat(o.ponderacion) || 0); }, 0);
 var disponible = 100 - usada;
 var ALCANCES = [
   { key: '80', label: '80% — Parcialmente alcanzado', bg: '#fef3c7', border: '#fcd34d', color: '#92400e' },
   { key: '100', label: '100% — Alcanzado', bg: '#dcfce7', border: '#86efac', color: '#166534' },
   { key: '120', label: '120% — Superado', bg: '#dbeafe', border: '#93c5fd', color: '#1e40af' }
 ];
 var inpStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };
 return (
   <div style={{ background: 'white', borderRadius: 12, border: '2px solid #231F20', padding: 24, marginBottom: 20 }}>
     <h4 style={{ marginTop: 0, color: '#231F20' }}>{titulo || 'Agregar objetivo'}</h4>
     <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
       <div>
         <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Objetivo *</label>
         <textarea value={obj.objetivo || ''} onChange={function(e) { actualizar({...obj, objetivo: e.target.value}); }} placeholder="Describir el objetivo..." style={{ ...inpStyle, minHeight: 80, resize: 'vertical' }} />
       </div>
       <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
         <div>
           <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Objetivo corporativo</label>
           <input value={obj.corporativo || ''} onChange={function(e) { actualizar({...obj, corporativo: e.target.value}); }} placeholder="Ej: Crecimiento, Eficiencia..." style={inpStyle} />
         </div>
         <div>
           <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Ponderación % (disponible: {disponible.toFixed(0)}%)</label>
           <input type="number" min="1" max={disponible} value={obj.ponderacion || ''} onChange={function(e) { actualizar({...obj, ponderacion: e.target.value}); }} style={{ ...inpStyle, borderColor: parseFloat(obj.ponderacion) > disponible ? '#dc2626' : '#D4D2C6' }} />
           {parseFloat(obj.ponderacion) > disponible && <p style={{ color: '#dc2626', fontSize: 11, margin: '4px 0 0 0' }}>Supera el disponible ({disponible.toFixed(0)}%)</p>}
         </div>
       </div>
       <div>
         <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 8 }}>Tipo de alcance</label>
         <div style={{ display: 'flex', gap: 10 }}>
           {['fecha', 'meta'].map(function(t) {
             return <button key={t} onClick={function() { actualizar({...obj, alcance_tipo: t}); }} style={{ padding: '8px 20px', borderRadius: 8, border: '2px solid', borderColor: tipoAlcance === t ? '#231F20' : '#D4D2C6', background: tipoAlcance === t ? '#231F20' : 'white', color: tipoAlcance === t ? 'white' : '#231F20', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{t === 'fecha' ? 'Por fecha' : 'Por meta'}</button>;
           })}
         </div>
       </div>
       {ALCANCES.map(function(a) {
         return (
           <div key={a.key} style={{ padding: 16, borderRadius: 10, background: a.bg, border: '1px solid ' + a.border }}>
             <p style={{ margin: '0 0 10px 0', fontSize: 13, fontWeight: 700, color: a.color }}>{a.label}</p>
             <div style={{ display: 'grid', gridTemplateColumns: tipoAlcance === 'fecha' ? '1fr 1fr' : '1fr 1fr', gap: 10 }}>
               <div>
                 <label style={{ fontSize: 11, fontWeight: 600, color: a.color, display: 'block', marginBottom: 4 }}>Descripción</label>
                 <input value={obj['alcance_' + a.key + '_descripcion'] || ''} onChange={function(e) { var k = 'alcance_' + a.key + '_descripcion'; actualizar({...obj, [k]: e.target.value}); }} placeholder="¿Qué implica este nivel?" style={{ ...inpStyle, background: 'white' }} />
               </div>
               <div>
                 <label style={{ fontSize: 11, fontWeight: 600, color: a.color, display: 'block', marginBottom: 4 }}>{tipoAlcance === 'fecha' ? 'Fecha límite' : 'Meta cuantitativa'}</label>
                 {tipoAlcance === 'fecha'
                   ? <input type="date" value={obj['alcance_' + a.key + '_fecha'] || ''} onChange={function(e) { var k = 'alcance_' + a.key + '_fecha'; actualizar({...obj, [k]: e.target.value}); }} style={{ ...inpStyle, background: 'white' }} />
                   : <input value={obj['alcance_' + a.key + '_meta'] || ''} onChange={function(e) { var k = 'alcance_' + a.key + '_meta'; actualizar({...obj, [k]: e.target.value}); }} placeholder="Ej: 95 unidades" style={{ ...inpStyle, background: 'white' }} />
                 }
               </div>
             </div>
           </div>
         );
       })}
       <div style={{ display: 'flex', gap: 12 }}>
         <button onClick={function() { if (!obj.objetivo?.trim()) { alert('El objetivo es obligatorio'); return; } if (!obj.ponderacion || parseFloat(obj.ponderacion) <= 0) { alert('La ponderación debe ser mayor a 0'); return; } if (parseFloat(obj.ponderacion) > disponible) { alert('La ponderación supera el disponible (' + disponible.toFixed(0) + '%)'); return; } onGuardar(obj); }} style={{ ...s.btnPrimario, background: '#22c55e' }}>Guardar objetivo</button>
         <button onClick={onCancelar} style={s.btnSecundario}>Cancelar</button>
       </div>
     </div>
   </div>
 );
}

// =============================================
// OBJETIVOS COLABORADOR
// =============================================
function ObjetivosColaborador({ profile }) {
 var [objetivos, setObjetivos] = useState([]);
 var [cargando, setCargando] = useState(true);
 var [mostrarForm, setMostrarForm] = useState(false);
 var [formObj, setFormObj] = useState(null);
 var [editandoId, setEditandoId] = useState(null);
 var [modalCompletar, setModalCompletar] = useState(null);
 var FORM_VACIO = { objetivo: '', corporativo: '', ponderacion: '', alcance_tipo: 'fecha', alcance_80_descripcion: '', alcance_80_fecha: '', alcance_80_meta: '', alcance_100_descripcion: '', alcance_100_fecha: '', alcance_100_meta: '', alcance_120_descripcion: '', alcance_120_fecha: '', alcance_120_meta: '' };
 useEffect(function() { cargar(); }, []);
 async function cargar() { var { data } = await supabase.from('objetivos').select('*').eq('colaborador_id', profile.id).order('created_at', { ascending: false }); setObjetivos(data || []); setCargando(false); }
 async function guardarObjetivo(datos) {
   var row = { objetivo: datos.objetivo, corporativo: datos.corporativo, ponderacion: parseFloat(datos.ponderacion), alcance_tipo: datos.alcance_tipo, alcance_80_descripcion: datos.alcance_80_descripcion, alcance_80_fecha: datos.alcance_80_fecha || null, alcance_80_meta: datos.alcance_80_meta, alcance_100_descripcion: datos.alcance_100_descripcion, alcance_100_fecha: datos.alcance_100_fecha || null, alcance_100_meta: datos.alcance_100_meta, alcance_120_descripcion: datos.alcance_120_descripcion, alcance_120_fecha: datos.alcance_120_fecha || null, alcance_120_meta: datos.alcance_120_meta, anio: new Date().getFullYear() };
   if (editandoId) { await supabase.from('objetivos').update(row).eq('id', editandoId); }
   else { await supabase.from('objetivos').insert({ ...row, colaborador_id: profile.id, status: 'pendiente' }); }
   setMostrarForm(false); setFormObj(null); setEditandoId(null); cargar();
 }
 async function completarObjetivo(obj, alcance, justificacion) {
   await supabase.from('objetivos').update({ status: 'completado', alcance_completado: alcance, justificacion_completado: justificacion }).eq('id', obj.id);
   setModalCompletar(null); cargar();
 }
 var totalPond = objetivos.filter(function(o) { return o.status !== 'rechazado'; }).reduce(function(s, o) { return s + (parseFloat(o.ponderacion) || 0); }, 0);
 if (cargando) return <p style={{ padding: 40, color: '#64748b' }}>Cargando...</p>;
 return (
   <div style={{ maxWidth: 860, margin: '0 auto' }}>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
       <div>
         <h2 style={{ color: '#231F20', margin: '0 0 4px 0', fontSize: 22, fontWeight: 700 }}>Mis Objetivos</h2>
         <span style={{ fontSize: 13, color: totalPond === 100 ? '#166534' : '#64748b', fontWeight: 600 }}>Ponderación total: {totalPond.toFixed(0)}% {totalPond === 100 ? '✓' : ''}</span>
       </div>
       {totalPond < 100 && !mostrarForm && <button onClick={function() { setFormObj({...FORM_VACIO, ponderacion: Math.max(0, 100 - totalPond)}); setMostrarForm(true); setEditandoId(null); }} style={s.btnPrimario}>+ Nuevo objetivo</button>}
     </div>
     {mostrarForm && formObj && <FormObjetivo valor={formObj} onChange={setFormObj} objetivos={objetivos} editandoId={editandoId} titulo={editandoId ? 'Editar objetivo' : 'Nuevo objetivo'} onGuardar={guardarObjetivo} onCancelar={function() { setMostrarForm(false); setFormObj(null); setEditandoId(null); }} />}
     {modalCompletar && <ModalCompletar obj={modalCompletar} onConfirmar={completarObjetivo} onCancelar={function() { setModalCompletar(null); }} />}
     {objetivos.length === 0 ? (
       <div style={{ textAlign: 'center', padding: 60, background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', color: '#94a3b8' }}>
         <p style={{ fontSize: 32, marginBottom: 12 }}>🎯</p>
         <h3 style={{ color: '#231F20' }}>Sin objetivos cargados</h3>
         <p>Hacé clic en "Nuevo objetivo" para comenzar.</p>
       </div>
     ) : (
       <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
         {objetivos.map(function(obj) {
           var statusBg = { validado: '#dcfce7', completado: '#dbeafe', pendiente: '#fef3c7', rechazado: '#fee2e2' };
           var statusColor = { validado: '#166534', completado: '#1e40af', pendiente: '#92400e', rechazado: '#dc2626' };
           var editable = obj.status === 'pendiente' && !obj.validado_por_gerente;
           return (
             <div key={obj.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '4px solid #231F20', padding: '16px 20px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                 <p style={{ margin: 0, fontSize: 14, color: '#231F20', fontWeight: 600, flex: 1 }}>{obj.objetivo}</p>
                 <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: statusBg[obj.status] || '#f1f5f9', color: statusColor[obj.status] || '#64748b', marginLeft: 12, flexShrink: 0 }}>{obj.status}</span>
               </div>
               <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                 {obj.corporativo && <span style={{ fontSize: 12, color: '#64748b' }}>{obj.corporativo}</span>}
                 <span style={{ fontSize: 18, fontWeight: 800, color: '#231F20' }}>{obj.ponderacion}%</span>
                 {obj.alcance_completado && <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>Alcance: {obj.alcance_completado}%</span>}
                 {obj.alcance_validado && <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Validado: {obj.alcance_validado}%</span>}
               </div>
               {obj.comentario_lider && <p style={{ margin: '0 0 10px 0', fontSize: 12, color: '#64748b', fontStyle: 'italic', padding: '6px 10px', background: '#F0EDE8', borderRadius: 6 }}>Líder: {obj.comentario_lider}</p>}
               <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                 {editable && <button onClick={function() { setFormObj(obj); setEditandoId(obj.id); setMostrarForm(true); }} style={s.btnInfo}>Editar</button>}
                 {obj.status === 'pendiente' && obj.validado_por_gerente && !obj.alcance_completado && (
                   <button onClick={function() { setModalCompletar(obj); }} style={{ ...s.btnPrimario, background: '#22c55e' }}>Reportar alcance</button>
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

// =============================================
// MODAL COMPLETAR OBJETIVO
// =============================================
function ModalCompletar({ obj, onConfirmar, onCancelar }) {
 var [alcance, setAlcance] = useState('');
 var [just, setJust] = useState('');
 return (
   <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
     <div style={{ background: 'white', borderRadius: 16, padding: 32, maxWidth: 480, width: '90%' }}>
       <h3 style={{ marginTop: 0, color: '#231F20' }}>Reportar alcance</h3>
       <p style={{ fontSize: 14, color: '#64748b', marginBottom: 20 }}>{obj.objetivo}</p>
       <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
         {['80', '100', '120'].map(function(v) {
           var colors = { '80': '#92400e', '100': '#166534', '120': '#1e40af' };
           var bgs = { '80': '#fef3c7', '100': '#dcfce7', '120': '#dbeafe' };
           return <button key={v} onClick={function() { setAlcance(v); }} style={{ flex: 1, padding: 12, borderRadius: 8, border: '2px solid', borderColor: alcance === v ? colors[v] : '#e2e8f0', background: alcance === v ? bgs[v] : 'white', color: colors[v], fontWeight: 700, cursor: 'pointer' }}>{v}%</button>;
         })}
       </div>
       <div style={{ marginBottom: 16 }}>
         <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>O ingresá un valor</label>
         <input type="number" value={alcance} onChange={function(e) { setAlcance(e.target.value); }} placeholder="Ej: 90" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '2px solid #D4D2C6', fontSize: 16, boxSizing: 'border-box' }} />
       </div>
       <div style={{ marginBottom: 20 }}>
         <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Justificación</label>
         <textarea value={just} onChange={function(e) { setJust(e.target.value); }} placeholder="Describí cómo llegaste a este alcance..." style={{ width: '100%', minHeight: 80, padding: 10, borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }} />
       </div>
       <div style={{ display: 'flex', gap: 12 }}>
         <button onClick={function() { if (!alcance) { alert('Ingresá un alcance'); return; } onConfirmar(obj, alcance, just); }} style={{ ...s.btnPrimario, background: '#22c55e', flex: 1 }}>Confirmar</button>
         <button onClick={onCancelar} style={s.btnSecundario}>Cancelar</button>
       </div>
     </div>
   </div>
 );
}

// =============================================
// PANEL ADMIN OBJETIVOS
// =============================================
function PanelAdminObjetivos({ profile }) {
 var [colabs, setColabs] = useState([]);
 var [objetivos, setObjetivos] = useState([]);
 var [cargando, setCargando] = useState(true);
 var [filtroArea, setFiltroArea] = useState('Todas');
 var [filtroStatus, setFiltroStatus] = useState('Todos');
 var [anio, setAnio] = useState(new Date().getFullYear());
 useEffect(function() { cargar(); }, []);
 async function cargar() {
   var [{ data: p }, { data: o }] = await Promise.all([
     supabase.from('profiles').select('id, email, full_name, area, seniority').eq('activo', true),
     supabase.from('objetivos').select('*').order('created_at', { ascending: false })
   ]);
   setColabs(p || []); setObjetivos(o || []); setCargando(false);
 }
 if (cargando) return <p style={{ padding: 40 }}>Cargando...</p>;
 var areas = ['Todas'].concat([...new Set(colabs.map(function(c) { return c.area; }).filter(Boolean))].sort());
 var objFiltrados = objetivos.filter(function(o) {
   if (String(o.anio) !== String(anio)) return false;
   if (filtroStatus !== 'Todos' && o.status !== filtroStatus) return false;
   if (filtroArea !== 'Todas') { var c = colabs.find(function(c) { return c.id === o.colaborador_id; }); if (!c || c.area !== filtroArea) return false; }
   return true;
 });
 function exportar() {
   var rows = [['Colaborador', 'Área', 'Objetivo', 'Corporativo', 'Ponderación', 'Status', 'Alcance colabolador', 'Alcance validado', 'Año']];
   objFiltrados.forEach(function(o) {
     var c = colabs.find(function(c) { return c.id === o.colaborador_id; });
     rows.push([c?.full_name || '', c?.area || '', o.objetivo || '', o.corporativo || '', o.ponderacion || '', o.status || '', o.alcance_completado || '', o.alcance_validado || '', o.anio || '']);
   });
   var bom = '\uFEFF';
   var csv = bom + rows.map(function(r) { return r.map(function(v) { return '"' + String(v).replace(/"/g,'""') + '"'; }).join(';'); }).join('\r\n');
   var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
   var url = URL.createObjectURL(blob);
   var a = document.createElement('a'); a.href = url; a.download = 'Objetivos_' + anio + '.csv'; a.click();
   URL.revokeObjectURL(url);
 }
 return (
   <div>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
       <h2 style={{ color: '#231F20', margin: 0, fontSize: 20, fontWeight: 700 }}>Panel Admin — Objetivos</h2>
       <button onClick={exportar} style={s.btnInfo}>Exportar CSV</button>
     </div>
     <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', background: 'white', padding: '12px 16px', borderRadius: 10, border: '1px solid #e8e6e0' }}>
       <select value={anio} onChange={function(e) { setAnio(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }}>
         {[2023,2024,2025,2026].map(function(a) { return <option key={a} value={a}>{a}</option>; })}
       </select>
       <select value={filtroArea} onChange={function(e) { setFiltroArea(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }}>
         {areas.map(function(a) { return <option key={a} value={a}>{a === 'Todas' ? 'Todas las áreas' : a}</option>; })}
       </select>
       <select value={filtroStatus} onChange={function(e) { setFiltroStatus(e.target.value); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13 }}>
         {['Todos','pendiente','completado','validado','rechazado'].map(function(s) { return <option key={s} value={s}>{s}</option>; })}
       </select>
     </div>
     <div style={{ overflowX: 'auto' }}>
       <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 10, overflow: 'hidden', border: '1px solid #e8e6e0' }}>
         <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Colaborador</th><th style={{ ...th, color: '#D4D2C6' }}>Área</th><th style={{ ...th, color: '#D4D2C6' }}>Objetivo</th><th style={{ ...th, color: '#D4D2C6' }}>Pond.</th><th style={{ ...th, color: '#D4D2C6' }}>Status</th><th style={{ ...th, color: '#D4D2C6' }}>Alcance Col.</th><th style={{ ...th, color: '#D4D2C6' }}>Validado</th></tr></thead>
         <tbody>
           {objFiltrados.map(function(o, i) {
             var c = colabs.find(function(c) { return c.id === o.colaborador_id; });
             return <tr key={o.id} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e8e6e0' }}>
               <td style={td}>{c?.full_name || '-'}</td>
               <td style={td}>{c?.area || '-'}</td>
               <td style={{ ...td, maxWidth: 260, wordBreak: 'break-word' }}>{o.objetivo}</td>
               <td style={{ ...td, textAlign: 'center', fontWeight: 700 }}>{o.ponderacion}%</td>
               <td style={td}><span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: o.status === 'validado' ? '#dcfce7' : o.status === 'rechazado' ? '#fee2e2' : '#fef3c7', color: o.status === 'validado' ? '#166534' : o.status === 'rechazado' ? '#dc2626' : '#92400e' }}>{o.status}</span></td>
               <td style={{ ...td, textAlign: 'center' }}>{o.alcance_completado ? o.alcance_completado + '%' : '-'}</td>
               <td style={{ ...td, textAlign: 'center', fontWeight: 700, color: '#166534' }}>{o.alcance_validado ? o.alcance_validado + '%' : '-'}</td>
             </tr>;
           })}
         </tbody>
       </table>
     </div>
   </div>
 );
}

// =============================================
// OBJETIVOS COMPAÑIA
// =============================================
function ObjetivosCompania({ esAdmin }) {
 var [objetivos, setObjetivos] = useState([]);
 var [cargando, setCargando] = useState(true);
 var [mostrarForm, setMostrarForm] = useState(false);
 var [form, setForm] = useState({ titulo: '', descripcion: '', anio: new Date().getFullYear(), area: '' });
 useEffect(function() { cargar(); }, []);
 async function cargar() { var { data } = await supabase.from('obj_compania').select('*').order('created_at', { ascending: false }); setObjetivos(data || []); setCargando(false); }
 async function guardar() {
   if (!form.titulo.trim()) { alert('El título es obligatorio'); return; }
   await supabase.from('obj_compania').insert({ titulo: form.titulo, descripcion: form.descripcion, anio: form.anio, area: form.area || null });
   setMostrarForm(false); setForm({ titulo: '', descripcion: '', anio: new Date().getFullYear(), area: '' }); cargar();
 }
 async function eliminar(id) { if (!window.confirm('¿Eliminar este objetivo?')) return; await supabase.from('obj_compania').delete().eq('id', id); cargar(); }
 if (cargando) return <p style={{ padding: 40 }}>Cargando...</p>;
 var inp = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };
 return (
   <div style={{ maxWidth: 860 }}>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
       <h2 style={{ color: '#231F20', margin: 0, fontSize: 22, fontWeight: 700 }}>Objetivos de Compañía</h2>
       {esAdmin && <button onClick={function() { setMostrarForm(!mostrarForm); }} style={s.btnPrimario}>+ Nuevo</button>}
     </div>
     {esAdmin && mostrarForm && (
       <div style={{ background: 'white', borderRadius: 12, border: '2px solid #231F20', padding: 24, marginBottom: 20 }}>
         <h4 style={{ marginTop: 0 }}>Nuevo objetivo de compañía</h4>
         <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
           <div><label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Título *</label><input value={form.titulo} onChange={function(e) { setForm({...form, titulo: e.target.value}); }} style={inp} /></div>
           <div><label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Descripción</label><textarea value={form.descripcion} onChange={function(e) { setForm({...form, descripcion: e.target.value}); }} style={{ ...inp, minHeight: 80, resize: 'vertical' }} /></div>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
             <div><label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Año</label><input type="number" value={form.anio} onChange={function(e) { setForm({...form, anio: e.target.value}); }} style={inp} /></div>
             <div><label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Área (opcional)</label><input value={form.area} onChange={function(e) { setForm({...form, area: e.target.value}); }} placeholder="Todas las áreas" style={inp} /></div>
           </div>
           <div style={{ display: 'flex', gap: 10 }}><button onClick={guardar} style={s.btnPrimario}>Guardar</button><button onClick={function() { setMostrarForm(false); }} style={s.btnSecundario}>Cancelar</button></div>
         </div>
       </div>
     )}
     {objetivos.length === 0 ? (
       <div style={{ textAlign: 'center', padding: 60, background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', color: '#94a3b8' }}>No hay objetivos de compañía cargados.</div>
     ) : (
       <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
         {objetivos.map(function(o) {
           return <div key={o.id} style={{ background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', borderLeft: '4px solid #231F20', padding: '16px 20px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
               <div style={{ flex: 1 }}>
                 <h4 style={{ margin: '0 0 6px 0', color: '#231F20' }}>{o.titulo}</h4>
                 {o.descripcion && <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#64748b' }}>{o.descripcion}</p>}
                 <div style={{ display: 'flex', gap: 12 }}>
                   <span style={{ fontSize: 12, color: '#94a3b8' }}>Año {o.anio}</span>
                   {o.area && <span style={{ fontSize: 12, color: '#94a3b8' }}>Área: {o.area}</span>}
                 </div>
               </div>
               {esAdmin && <button onClick={function() { eliminar(o.id); }} style={{ ...s.btnInfo, color: '#dc2626', borderColor: '#fca5a5', marginLeft: 12, flexShrink: 0 }}>Eliminar</button>}
             </div>
           </div>;
         })}
       </div>
     )}
   </div>
 );
}

// =============================================
// GESTIÓN VISIBILIDAD
// =============================================
function GestionVisibilidad() {
 var [lideres, setLideres] = useState([]);
 var [todos, setTodos] = useState([]);
 var [liderSel, setLiderSel] = useState(null);
 var [visibilidad, setVisibilidad] = useState([]);
 var [cargando, setCargando] = useState(true);
 useEffect(function() { cargar(); }, []);
 async function cargar() {
   var [{ data: l }, { data: t }] = await Promise.all([
     supabase.from('profiles').select('id, email, full_name, area, role').eq('activo', true).in('role', ['lider', 'admin_rrhh']),
     supabase.from('profiles').select('id, email, full_name, area, seniority').eq('activo', true)
   ]);
   setLideres(l || []); setTodos(t || []); setCargando(false);
 }
 async function seleccionarLider(lid) {
   setLiderSel(lid);
   var { data } = await supabase.from('equipo_visibilidad').select('*').eq('lider_id', lid.id);
   setVisibilidad(data || []);
 }
 async function toggleUsuario(colabId) {
   if (!liderSel) return;
   var ya = visibilidad.find(function(v) { return v.tipo === 'usuario' && v.valor === colabId; });
   if (ya) { await supabase.from('equipo_visibilidad').delete().eq('id', ya.id); setVisibilidad(function(p) { return p.filter(function(v) { return v.id !== ya.id; }); }); }
   else { var { data: nuevo } = await supabase.from('equipo_visibilidad').insert({ lider_id: liderSel.id, tipo: 'usuario', valor: colabId }).select().single(); setVisibilidad(function(p) { return [...p, nuevo]; }); }
 }
 async function toggleTodos() {
   if (!liderSel) return;
   var ya = visibilidad.find(function(v) { return v.tipo === 'todos'; });
   if (ya) { await supabase.from('equipo_visibilidad').delete().eq('id', ya.id); setVisibilidad(function(p) { return p.filter(function(v) { return v.id !== ya.id; }); }); }
   else { var { data: nuevo } = await supabase.from('equipo_visibilidad').insert({ lider_id: liderSel.id, tipo: 'todos', valor: 'todos' }).select().single(); setVisibilidad(function(p) { return [...p, nuevo]; }); }
 }
 if (cargando) return <p style={{ padding: 40 }}>Cargando...</p>;
 var tieneTodos = visibilidad.some(function(v) { return v.tipo === 'todos'; });
 return (
   <div>
     <h2 style={{ color: '#231F20', margin: '0 0 20px 0', fontSize: 20, fontWeight: 700 }}>Gestión de Visibilidad</h2>
     <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
       <div style={{ flex: 1, minWidth: 240, background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 20 }}>
         <h4 style={{ margin: '0 0 12px 0', color: '#231F20' }}>Líderes</h4>
         {lideres.map(function(l) {
           return <div key={l.id} onClick={function() { seleccionarLider(l); }} style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', marginBottom: 6, background: liderSel?.id === l.id ? '#231F20' : '#F0EDE8', color: liderSel?.id === l.id ? '#D4D2C6' : '#231F20', fontWeight: liderSel?.id === l.id ? 700 : 400, fontSize: 13 }}>
             {l.full_name || l.email}
           </div>;
         })}
       </div>
       {liderSel && (
         <div style={{ flex: 2, minWidth: 320, background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: 20 }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
             <h4 style={{ margin: 0, color: '#231F20' }}>Visibilidad de {liderSel.full_name}</h4>
             <button onClick={toggleTodos} style={{ ...s.btnInfo, background: tieneTodos ? '#231F20' : 'white', color: tieneTodos ? '#D4D2C6' : '#231F20' }}>{tieneTodos ? 'Ver todos ✓' : 'Activar: ver todos'}</button>
           </div>
           {!tieneTodos && (
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
               {todos.map(function(c) {
                 var sel = visibilidad.some(function(v) { return v.tipo === 'usuario' && v.valor === c.id; });
                 return <div key={c.id} onClick={function() { toggleUsuario(c.id); }} style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', background: sel ? '#231F20' : '#F0EDE8', color: sel ? '#D4D2C6' : '#231F20', fontSize: 13 }}>
                   <strong style={{ display: 'block', fontSize: 12 }}>{c.full_name || c.email}</strong>
                   <span style={{ fontSize: 11, opacity: 0.7 }}>{c.area}</span>
                 </div>;
               })}
             </div>
           )}
         </div>
       )}
     </div>
   </div>
 );
}

// =============================================
// GESTIÓN USUARIOS
// =============================================
function GestionUsuarios() {
 var [usuarios, setUsuarios] = useState([]);
 var [cargando, setCargando] = useState(true);
 var [editando, setEditando] = useState(null);
 var [form, setForm] = useState({});
 useEffect(function() { cargar(); }, []);
 async function cargar() { var { data } = await supabase.from('profiles').select('*').order('full_name'); setUsuarios(data || []); setCargando(false); }
 async function guardar() {
   await supabase.from('profiles').update({ full_name: form.full_name, area: form.area, puesto: form.puesto, seniority: form.seniority, role: form.role, activo: form.activo, leader_id: form.leader_id || null }).eq('id', editando);
   setEditando(null); cargar();
 }
 if (cargando) return <p style={{ padding: 40 }}>Cargando...</p>;
 return (
   <div>
     <h2 style={{ color: '#231F20', margin: '0 0 20px 0', fontSize: 20, fontWeight: 700 }}>Gestión de Usuarios ({usuarios.length})</h2>
     {editando && (
       <div style={{ background: 'white', borderRadius: 12, border: '2px solid #231F20', padding: 24, marginBottom: 20 }}>
         <h4 style={{ marginTop: 0 }}>Editar usuario</h4>
         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
           {[['full_name','Nombre completo'],['area','Área'],['puesto','Puesto'],['seniority','Seniority']].map(function(f) {
             return <div key={f[0]}><label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>{f[1]}</label><input value={form[f[0]] || ''} onChange={function(e) { setForm({...form, [f[0]]: e.target.value}); }} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, boxSizing: 'border-box' }} /></div>;
           })}
           <div><label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Rol</label><select value={form.role || ''} onChange={function(e) { setForm({...form, role: e.target.value}); }} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13 }}><option value="colaborador">Colaborador</option><option value="lider">Líder</option><option value="admin_rrhh">Admin RRHH</option></select></div>
           <div><label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Estado</label><select value={String(form.activo)} onChange={function(e) { setForm({...form, activo: e.target.value === 'true'}); }} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13 }}><option value="true">Activo</option><option value="false">Inactivo</option></select></div>
           <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Líder directo (ID)</label><input value={form.leader_id || ''} onChange={function(e) { setForm({...form, leader_id: e.target.value || null}); }} placeholder="UUID del líder" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, boxSizing: 'border-box' }} /></div>
         </div>
         <div style={{ display: 'flex', gap: 12, marginTop: 16 }}><button onClick={guardar} style={s.btnPrimario}>Guardar</button><button onClick={function() { setEditando(null); }} style={s.btnSecundario}>Cancelar</button></div>
       </div>
     )}
     <div style={{ overflowX: 'auto' }}>
       <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #e8e6e0', borderRadius: 10, overflow: 'hidden' }}>
         <thead><tr style={{ background: '#231F20' }}><th style={{ ...th, color: '#D4D2C6' }}>Nombre</th><th style={{ ...th, color: '#D4D2C6' }}>Email</th><th style={{ ...th, color: '#D4D2C6' }}>Área</th><th style={{ ...th, color: '#D4D2C6' }}>Puesto</th><th style={{ ...th, color: '#D4D2C6' }}>Rol</th><th style={{ ...th, color: '#D4D2C6' }}>Estado</th><th style={{ ...th, color: '#D4D2C6' }}>Acciones</th></tr></thead>
         <tbody>
           {usuarios.map(function(u, i) {
             return <tr key={u.id} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e8e6e0' }}>
               <td style={td}>{u.full_name || '-'}</td>
               <td style={{ ...td, fontSize: 12 }}>{u.email}</td>
               <td style={td}>{u.area || '-'}</td>
               <td style={td}>{u.puesto || '-'}</td>
               <td style={td}><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: u.role === 'admin_rrhh' ? '#231F20' : u.role === 'lider' ? '#dbeafe' : '#F0EDE8', color: u.role === 'admin_rrhh' ? '#D4D2C6' : '#231F20', fontWeight: 600 }}>{u.role}</span></td>
               <td style={td}><span style={{ fontSize: 11, fontWeight: 600, color: u.activo ? '#166534' : '#dc2626' }}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
               <td style={td}><button onClick={function() { setEditando(u.id); setForm(u); }} style={s.btnInfo}>Editar</button></td>
             </tr>;
           })}
         </tbody>
       </table>
     </div>
   </div>
 );
}

// =============================================
// GESTIÓN MÓDULOS
// =============================================
function GestionModulos() {
 var [usuarios, setUsuarios] = useState([]);
 var [modulos, setModulos] = useState([]);
 var [cargando, setCargando] = useState(true);
 var [busqueda, setBusqueda] = useState('');
 var MODULOS_DISPONIBLES = ['desempeno', 'obj_individual', 'obj_compania', 'capacitaciones', 'dashboard_global'];
 useEffect(function() { cargar(); }, []);
 async function cargar() {
   var [{ data: u }, { data: m }] = await Promise.all([
     supabase.from('profiles').select('id, email, full_name, area, role').eq('activo', true).order('full_name'),
     supabase.from('modulos_usuario').select('*')
   ]);
   setUsuarios(u || []); setModulos(m || []); setCargando(false);
 }
 async function toggleModulo(userId, modulo) {
   var ya = modulos.find(function(m) { return m.user_id === userId && m.modulo === modulo; });
   if (ya) { await supabase.from('modulos_usuario').update({ activo: !ya.activo }).eq('id', ya.id); }
   else { await supabase.from('modulos_usuario').insert({ user_id: userId, modulo: modulo, activo: true }); }
   cargar();
 }
 function tieneModulo(userId, modulo) {
   var m = modulos.find(function(m) { return m.user_id === userId && m.modulo === modulo; });
   return m && m.activo;
 }
 if (cargando) return <p style={{ padding: 40 }}>Cargando...</p>;
 var filtrados = usuarios.filter(function(u) {
   if (!busqueda) return true;
   return (u.full_name || '').toLowerCase().includes(busqueda.toLowerCase()) || (u.area || '').toLowerCase().includes(busqueda.toLowerCase());
 });
 return (
   <div>
     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
       <h2 style={{ color: '#231F20', margin: 0, fontSize: 20, fontWeight: 700 }}>Gestión de Módulos</h2>
     </div>
     <input value={busqueda} onChange={function(e) { setBusqueda(e.target.value); }} placeholder="Buscar usuario..." style={{ width: '100%', maxWidth: 320, padding: '9px 14px', borderRadius: 8, border: '1px solid #e8e6e0', fontSize: 13, marginBottom: 16, boxSizing: 'border-box' }} />
     <div style={{ overflowX: 'auto' }}>
       <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', border: '1px solid #e8e6e0', borderRadius: 10, overflow: 'hidden' }}>
         <thead>
           <tr style={{ background: '#231F20' }}>
             <th style={{ ...th, color: '#D4D2C6' }}>Usuario</th>
             {MODULOS_DISPONIBLES.map(function(m) { return <th key={m} style={{ ...th, color: '#D4D2C6', fontSize: 10, textTransform: 'uppercase' }}>{m.replace(/_/g,' ')}</th>; })}
           </tr>
         </thead>
         <tbody>
           {filtrados.map(function(u, i) {
             return <tr key={u.id} style={{ background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e8e6e0' }}>
               <td style={td}>
                 <strong style={{ fontSize: 13, display: 'block' }}>{u.full_name || u.email}</strong>
                 <span style={{ fontSize: 11, color: '#94a3b8' }}>{u.area}</span>
               </td>
               {MODULOS_DISPONIBLES.map(function(m) {
                 var activo = tieneModulo(u.id, m);
                 return <td key={m} style={{ ...td, textAlign: 'center' }}>
                   <button onClick={function() { toggleModulo(u.id, m); }} style={{ width: 36, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: activo ? '#166534' : '#D4D2C6', position: 'relative', transition: 'background 0.2s' }}>
                     <span style={{ position: 'absolute', top: 2, left: activo ? 16 : 2, width: 18, height: 18, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                   </button>
                 </td>;
               })}
             </tr>;
           })}
         </tbody>
       </table>
     </div>
   </div>
 );
}

// =============================================
// ESTILOS GLOBALES
// =============================================
var th = { padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: '#231F20', whiteSpace: 'nowrap', background: 'transparent' };
var td = { padding: '10px 14px', fontSize: 13, color: '#231F20', verticalAlign: 'middle' };

var sidebarStyle = {
 aside: { width: 220, background: '#231F20', display: 'flex', flexDirection: 'column', minHeight: '100vh', flexShrink: 0 },
 logoContainer: { padding: '20px 16px 16px', borderBottom: '1px solid rgba(212,210,198,0.2)' },
 nav: { display: 'flex', flexDirection: 'column', padding: '12px 8px', gap: 2, flex: 1 },
 menuItem: { padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, textAlign: 'left', letterSpacing: '0.5px', transition: 'background 0.15s' },
 subMenuItem: { padding: '8px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'left', transition: 'background 0.15s' },
 footer: { padding: '16px', borderTop: '1px solid rgba(212,210,198,0.2)', display: 'flex', flexDirection: 'column', gap: 8 }
};

var s = {
 header: { background: '#231F20', padding: '14px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' },
 badge: { padding: '6px 14px', background: 'rgba(212,210,198,0.15)', borderRadius: 20, color: '#D4D2C6', fontSize: 13, fontWeight: 600 },
 tarjetaStat: { background: 'white', borderRadius: 12, border: '1px solid #e8e6e0', padding: '20px 24px' },
 grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14 },
 btnPrimario: { padding: '10px 22px', background: '#231F20', color: '#D4D2C6', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700 },
 btnSecundario: { padding: '10px 18px', background: 'white', color: '#231F20', border: '2px solid #231F20', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 },
 btnInfo: { padding: '8px 16px', background: 'white', color: '#64748b', border: '1px solid #e8e6e0', borderRadius: 8, cursor: 'pointer', fontSize: 13 },
 btnSalir: { padding: '8px 16px', background: 'transparent', color: '#D4D2C6', border: '1px solid rgba(212,210,198,0.3)', borderRadius: 8, cursor: 'pointer', fontSize: 12 },
 textarea: { width: '100%', padding: '12px', borderRadius: 8, border: '1px solid #D4D2C6', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', minHeight: 100, boxSizing: 'border-box' },
 textareaSmall: { padding: '8px 10px', borderRadius: 6, border: '1px solid #e8e6e0', fontSize: 12, fontFamily: 'inherit', resize: 'vertical', width: '100%' },
 mensajeToast: { padding: '10px 16px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, color: '#166534', fontSize: 13, fontWeight: 600, marginTop: 12 },
 centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 },
 competenciaCard: { border: '1px solid #e8e6e0', borderRadius: 12, padding: '16px 18px', marginBottom: 14, background: 'white' },
 ratingRow: { display: 'flex', gap: 8, margin: '12px 0' },
 ratingBtn: { width: 40, height: 40, borderRadius: 8, border: '2px solid #e8e6e0', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
 ratingInfoBox: { background: '#f8fafc', borderRadius: 8, padding: 12, border: '1px solid #e8e6e0' },
 ratingInfoItem: { fontSize: 12, color: '#475569', marginBottom: 4, lineHeight: 1.5 },
 seccionTitulo: { color: '#231F20', fontSize: 15, fontWeight: 700, marginBottom: 8, marginTop: 20 },
};
