import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';

function abrirGmail(colaboradorEmail, liderEmail) {
  var to = colaboradorEmail + (liderEmail ? ',' + liderEmail : '');
  var subject = 'Evaluacion de Desempeno - Fabric Group';
  var body = 'Adjunto encontraras el resumen.%0D%0A%0D%0AFabric Group.';
  window.open('https://mail.google.com/mail/?view=cm&fs=1&to=' + to + '&su=' + encodeURIComponent(subject) + '&body=' + body, '_blank');
}

export default function PanelApp() {
  var profile = null; var setProfile;
  var loading = true; var setLoading;
  var menuActivo = 'desempeno'; var setMenuActivo;
  var cicloActivo = null; var setCicloActivo;
  var s1 = useState(null); profile = s1[0]; setProfile = s1[1];
  var s2 = useState(true); loading = s2[0]; setLoading = s2[1];
  var s3 = useState('desempeno'); menuActivo = s3[0]; setMenuActivo = s3[1];
  var s4 = useState(null); cicloActivo = s4[0]; setCicloActivo = s4[1];

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

  if (loading) return React.createElement('div', { style: s.centrado }, React.createElement('p', null, 'Cargando...'));
  if (!profile) return React.createElement('div', { style: s.centrado }, React.createElement('h2', null, 'Error'), React.createElement('button', { onClick: cerrarSesion, style: s.btnSalir }, 'Volver'));

  var nombreRol = profile.role === 'admin_rrhh' ? 'Admin RRHH' : profile.role === 'lider' ? 'Lider' : 'Colaborador';
  var emojiRol = profile.role === 'admin_rrhh' ? '🔧' : profile.role === 'lider' ? '👥' : '👤';
  var esGerente = profile.seniority === 'Gerente';

  return React.createElement('div', { style: { display: 'flex', minHeight: '100vh' } },
    React.createElement('aside', { style: sidebar.aside },
      React.createElement('div', { style: sidebar.logoContainer }, React.createElement('img', { src: 'logo.jpg', alt: 'Fabric Group', style: { height: '40px' } })),
      React.createElement('nav', { style: sidebar.nav },
        React.createElement('button', { onClick: function() { setMenuActivo('desempeno'); setCicloActivo(null); }, style: { ...sidebar.menuItem, background: menuActivo === 'desempeno' ? '#D4D2C6' : 'transparent', color: menuActivo === 'desempeno' ? '#231F20' : '#D4D2C6' } }, '📊 Evaluacion de Desempeno'),
        React.createElement('button', { onClick: function() { setMenuActivo('objetivos'); }, style: { ...sidebar.menuItem, background: menuActivo === 'objetivos' ? '#D4D2C6' : 'transparent', color: menuActivo === 'objetivos' ? '#231F20' : '#D4D2C6' } }, '🎯 Mis Objetivos'),
        React.createElement('button', { onClick: function() { setMenuActivo('objetivos_empresa'); }, style: { ...sidebar.menuItem, background: menuActivo === 'objetivos_empresa' ? '#D4D2C6' : 'transparent', color: menuActivo === 'objetivos_empresa' ? '#231F20' : '#D4D2C6' } }, '🏢 Objetivos Corporativos')
      ),
      React.createElement('div', { style: sidebar.footer },
        React.createElement('span', { style: { fontSize: 12, color: '#D4D2C6' } }, profile.email),
        React.createElement('button', { onClick: cerrarSesion, style: { ...s.btnSalir, marginTop: 8, width: '100%' } }, 'Cerrar Sesion')
      )
    ),
    React.createElement('div', { style: { flex: 1, background: '#f8fafc', minHeight: '100vh' } },
      React.createElement('header', { style: s.header },
        React.createElement('h1', { style: { fontSize: 18, fontWeight: 600, color: '#D4D2C6', margin: 0 } }, 'Fabric Group'),
        React.createElement('span', { style: s.badge }, emojiRol + ' ' + nombreRol)
      ),
      React.createElement('main', { style: { padding: 24 } },
        menuActivo === 'desempeno' ? React.createElement(DesempenoView, { profile: profile, cicloActivo: cicloActivo, setCicloActivo: setCicloActivo }) : null,
        menuActivo === 'objetivos' ? React.createElement(ObjetivosView, { profile: profile }) : null,
        menuActivo === 'objetivos_empresa' ? React.createElement(ObjetivosCorporativosView, { profile: profile }) : null
      )
    )
  );
}

// =============================================
// MÓDULO DE OBJETIVOS
// =============================================
function ObjetivosView({ profile }) {
  var vista = 'misobjetivos'; var setVista;
  var tieneEquipo = false; var setTieneEquipo;
  var verificando = true; var setVerificando;
  var s1 = useState('misobjetivos'); vista = s1[0]; setVista = s1[1];
  var s2 = useState(false); tieneEquipo = s2[0]; setTieneEquipo = s2[1];
  var s3 = useState(true); verificando = s3[0]; setVerificando = s3[1];

  useEffect(function() {
    async function verificar() {
      var resp = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('leader_id', profile.id);
      setTieneEquipo((resp.count || 0) > 0);
      if ((resp.count || 0) > 0) setVista('gerente');
      setVerificando(false);
    }
    verificar();
  }, []);

  if (verificando) return React.createElement('p', null, 'Cargando...');

  return React.createElement('div', null,
    tieneEquipo ? React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 20 } },
      React.createElement('button', { onClick: function() { setVista('gerente'); }, style: vista === 'gerente' ? s.btnPrimario : s.btnInfo }, '👥 Objetivos de Mi Equipo'),
      React.createElement('button', { onClick: function() { setVista('misobjetivos'); }, style: vista === 'misobjetivos' ? s.btnPrimario : s.btnInfo }, '🎯 Mis Objetivos')
    ) : null,
    vista === 'gerente' && tieneEquipo ? React.createElement(ObjetivosGerente, { profile: profile }) : null,
    (vista === 'misobjetivos' || !tieneEquipo) ? React.createElement(ObjetivosColaborador, { profile: profile }) : null
  );
}

function ObjetivosGerente({ profile }) {
  var equipo = []; var setEquipo;
  var colaboradorSeleccionado = null; var setColaboradorSeleccionado;
  var cargando = true; var setCargando;
  var s1 = useState([]); equipo = s1[0]; setEquipo = s1[1];
  var s2 = useState(null); colaboradorSeleccionado = s2[0]; setColaboradorSeleccionado = s2[1];
  var s3 = useState(true); cargando = s3[0]; setCargando = s3[1];

  useEffect(function() { cargarEquipo(); }, []);

  async function cargarEquipo() {
    var resp = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', profile.id);
    setEquipo(resp.data || []);
    setCargando(false);
  }

  if (cargando) return React.createElement('p', null, 'Cargando equipo...');
  if (colaboradorSeleccionado) return React.createElement(GestionObjetivos, { colaborador: colaboradorSeleccionado, profile: profile, onVolver: function() { setColaboradorSeleccionado(null); } });

  return React.createElement('div', null,
    React.createElement('h2', { style: { color: '#231F20', marginBottom: 20 } }, '🎯 Objetivos de Mi Equipo'),
    React.createElement('p', { style: { color: '#64748b', marginBottom: 20 } }, 'Selecciona un colaborador para gestionar sus objetivos.'),
    equipo.length === 0 ? React.createElement('p', { style: { color: '#94a3b8' } }, 'No tienes colaboradores asignados.') :
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 } },
        equipo.map(function(col) {
          return React.createElement('div', { key: col.id, onClick: function() { setColaboradorSeleccionado(col); }, style: { ...s.tarjetaStat, cursor: 'pointer', border: '2px solid #D4D2C6' } },
            React.createElement('h4', { style: { margin: 0, color: '#231F20' } }, col.full_name || col.email),
            React.createElement('p', { style: { color: '#64748b', fontSize: 13, margin: '4px 0' } }, (col.area || '') + ' · ' + (col.seniority || '')),
            React.createElement('button', { style: { ...s.btnPrimario, marginTop: 12, width: '100%' } }, 'Gestionar Objetivos')
          );
        })
      )
  );
}

function GestionObjetivos({ colaborador, profile, onVolver }) {
  var objetivos = []; var setObjetivos;
  var cargando = true; var setCargando;
  var mostrarForm = false; var setMostrarForm;
  var nuevoObjetivo = { objetivo: '', corporativo: '', ponderacion: 25, alcance_0_fecha: '', alcance_80_fecha: '', alcance_100_fecha: '', alcance_120_fecha: '' }; var setNuevoObjetivo;
  var objValidando = null; var setObjValidando;
  var s1 = useState([]); objetivos = s1[0]; setObjetivos = s1[1];
  var s2 = useState(true); cargando = s2[0]; setCargando = s2[1];
  var s3 = useState(false); mostrarForm = s3[0]; setMostrarForm = s3[1];
  var s4 = useState({ objetivo: '', corporativo: '', ponderacion: 25, alcance_0_fecha: '', alcance_80_fecha: '', alcance_100_fecha: '', alcance_120_fecha: '' }); nuevoObjetivo = s4[0]; setNuevoObjetivo = s4[1];
  var s5 = useState(null); objValidando = s5[0]; setObjValidando = s5[1];

  useEffect(function() { cargarObjetivos(); }, []);

  async function cargarObjetivos() {
    var resp = await supabase.from('objetivos').select('*').eq('colaborador_id', colaborador.id).order('created_at', { ascending: false });
    setObjetivos(resp.data || []);
    setCargando(false);
  }

  async function agregarObjetivo() {
    if (!nuevoObjetivo.objetivo) return alert('El objetivo es obligatorio');
    await supabase.from('objetivos').insert({
      gerente_id: profile.id, colaborador_id: colaborador.id,
      objetivo: nuevoObjetivo.objetivo, corporativo: nuevoObjetivo.corporativo,
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

  async function validarObjetivo() {
    if (!objValidando) return;
    await supabase.from('objetivos').update({
      status: 'validado',
      validado_por_gerente: true,
      fecha_validacion: new Date(),
      justificacion_validacion: objValidando.justificacion_validacion,
      ponderacion_final: objValidando.ponderacion_final || null
    }).eq('id', objValidando.id);
    setObjValidando(null);
    cargarObjetivos();
  }

  if (cargando) return React.createElement('p', null, 'Cargando objetivos...');

  if (objValidando) {
    return React.createElement('div', { style: { maxWidth: 600 } },
      React.createElement('button', { onClick: function() { setObjValidando(null); }, style: { ...s.btnInfo, marginBottom: 16 } }, '← Volver'),
      React.createElement('h3', null, '✅ Validar Objetivo'),
      React.createElement('p', { style: { color: '#64748b', marginBottom: 12 } }, objValidando.objetivo),
      React.createElement('p', { style: { fontSize: 13, color: '#475569' } }, 'Alcance logrado por colaborador: ' + (objValidando.alcance_logrado || '-') + '%'),
      React.createElement('p', { style: { fontSize: 13, color: '#475569' } }, 'Fecha entrega: ' + (objValidando.fecha_entrega_colaborador ? new Date(objValidando.fecha_entrega_colaborador + 'T12:00:00').toLocaleDateString('es-AR') : '-')),
      objValidando.justificacion_colaborador ? React.createElement('p', { style: { fontSize: 13, color: '#475569', fontStyle: 'italic' } }, '"' + objValidando.justificacion_colaborador + '"') : null,
      React.createElement('div', { style: { marginTop: 16, marginBottom: 12 } },
        React.createElement('label', { style: { fontSize: 12, display: 'block', marginBottom: 4 } }, 'Alcance Final Validado'),
        React.createElement('select', {
          value: objValidando.ponderacion_final || objValidando.alcance_logrado || '',
          onChange: function(e) { setObjValidando({...objValidando, ponderacion_final: e.target.value}); },
          style: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }
        },
          React.createElement('option', { value: '' }, 'Seleccionar alcance final'),
          React.createElement('option', { value: '0' }, '0% - No alcanzado'),
          React.createElement('option', { value: '80' }, '80% - Parcial'),
          React.createElement('option', { value: '100' }, '100% - Alcanzado'),
          React.createElement('option', { value: '120' }, '120% - Superado')
        )
      ),
      React.createElement('div', { style: { marginTop: 16, marginBottom: 12 } },
        React.createElement('label', { style: { fontSize: 12, display: 'block', marginBottom: 4 } }, 'Justificacion de Validacion'),
        React.createElement('textarea', {
          value: objValidando.justificacion_validacion || '',
          onChange: function(e) { setObjValidando({...objValidando, justificacion_validacion: e.target.value}); },
          placeholder: 'Comentario del gerente sobre la validacion...',
          style: { ...s.textarea, minHeight: 80 }
        })
      ),
      React.createElement('button', { onClick: validarObjetivo, style: s.btnPrimario }, '✅ Confirmar Validacion')
    );
  }

  return React.createElement('div', null,
    React.createElement('button', { onClick: onVolver, style: { ...s.btnInfo, marginBottom: 16 } }, '← Volver al equipo'),
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 } },
      React.createElement('div', null,
        React.createElement('h2', { style: { color: '#231F20', margin: 0 } }, '🎯 Objetivos de ' + (colaborador.full_name || colaborador.email)),
        React.createElement('p', { style: { color: '#64748b', margin: '4px 0' } }, (colaborador.area || '') + ' · ' + (colaborador.seniority || ''))
      ),
      React.createElement('button', { onClick: function() { setMostrarForm(!mostrarForm); }, style: s.btnPrimario }, '+ Agregar Objetivo')
    ),
    mostrarForm ? React.createElement('div', { style: { ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' } },
      React.createElement('h4', null, 'Nuevo Objetivo'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 } },
        React.createElement('div', null, React.createElement('label', { style: { fontSize: 12 } }, 'Objetivo *'), React.createElement('input', { value: nuevoObjetivo.objetivo, onChange: function(e) { setNuevoObjetivo({...nuevoObjetivo, objetivo: e.target.value}); }, placeholder: 'Describir el objetivo...', style: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' } })),
        React.createElement('div', null, React.createElement('label', { style: { fontSize: 12 } }, 'Corporativo'), React.createElement('input', { value: nuevoObjetivo.corporativo, onChange: function(e) { setNuevoObjetivo({...nuevoObjetivo, corporativo: e.target.value}); }, placeholder: 'Ej: Ventas', style: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' } })),
        React.createElement('div', null, React.createElement('label', { style: { fontSize: 12 } }, 'Ponderacion (%)'), React.createElement('select', { value: nuevoObjetivo.ponderacion, onChange: function(e) { setNuevoObjetivo({...nuevoObjetivo, ponderacion: parseFloat(e.target.value)}); }, style: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' } }, React.createElement('option', { value: '10' }, '10%'), React.createElement('option', { value: '15' }, '15%'), React.createElement('option', { value: '20' }, '20%'), React.createElement('option', { value: '25' }, '25%'), React.createElement('option', { value: '30' }, '30%'), React.createElement('option', { value: '35' }, '35%'), React.createElement('option', { value: '40' }, '40%'), React.createElement('option', { value: '50' }, '50%'))),
        React.createElement('div', null, React.createElement('label', { style: { fontSize: 12 } }, 'Fecha 0%'), React.createElement('input', { type: 'date', value: nuevoObjetivo.alcance_0_fecha, onChange: function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_0_fecha: e.target.value}); }, style: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' } })),
        React.createElement('div', null, React.createElement('label', { style: { fontSize: 12 } }, 'Fecha 80%'), React.createElement('input', { type: 'date', value: nuevoObjetivo.alcance_80_fecha, onChange: function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_80_fecha: e.target.value}); }, style: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' } })),
        React.createElement('div', null, React.createElement('label', { style: { fontSize: 12 } }, 'Fecha 100%'), React.createElement('input', { type: 'date', value: nuevoObjetivo.alcance_100_fecha, onChange: function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_100_fecha: e.target.value}); }, style: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' } })),
        React.createElement('div', null, React.createElement('label', { style: { fontSize: 12 } }, 'Fecha 120%'), React.createElement('input', { type: 'date', value: nuevoObjetivo.alcance_120_fecha, onChange: function(e) { setNuevoObjetivo({...nuevoObjetivo, alcance_120_fecha: e.target.value}); }, style: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' } }))
      ),
      React.createElement('button', { onClick: agregarObjetivo, style: { ...s.btnPrimario, background: '#22c55e', marginTop: 12 } }, '💾 Guardar Objetivo')
    ) : null,
    objetivos.length === 0 ? React.createElement('p', { style: { color: '#94a3b8', textAlign: 'center', padding: 40 } }, 'Sin objetivos asignados.') :
      React.createElement('div', { style: { overflowX: 'auto' } },
        React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', minWidth: 1700 } },
          React.createElement('thead', null,
            React.createElement('tr', { style: { background: '#231F20' } },
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Objetivo'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Corp'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Pond'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, '0%'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, '80%'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, '100%'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, '120%'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Alcance Colab'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Fecha Ent'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Justif Colab'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Alcance Final'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Status'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Accion')
            )
          ),
          React.createElement('tbody', null,
            objetivos.map(function(obj) {
              return React.createElement('tr', { key: obj.id, style: { borderBottom: '1px solid #e2e8f0' } },
                React.createElement('td', { style: td }, obj.objetivo),
                React.createElement('td', { style: td }, obj.corporativo || '-'),
                React.createElement('td', { style: { ...td, fontWeight: 700, textAlign: 'center' } }, obj.ponderacion + '%'),
                React.createElement('td', { style: td }, obj.alcance_0_fecha ? new Date(obj.alcance_0_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'),
                React.createElement('td', { style: td }, obj.alcance_80_fecha ? new Date(obj.alcance_80_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'),
                React.createElement('td', { style: td }, obj.alcance_100_fecha ? new Date(obj.alcance_100_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'),
                React.createElement('td', { style: td }, obj.alcance_120_fecha ? new Date(obj.alcance_120_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'),
                React.createElement('td', { style: td },
                  obj.alcance_logrado ? React.createElement('span', { style: { padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.alcance_logrado === '120' ? '#dcfce7' : obj.alcance_logrado === '100' ? '#dbeafe' : obj.alcance_logrado === '80' ? '#fef3c7' : '#fee2e2', color: obj.alcance_logrado === '120' ? '#166534' : obj.alcance_logrado === '100' ? '#1e40af' : obj.alcance_logrado === '80' ? '#92400e' : '#dc2626' } }, obj.alcance_logrado + '%') : '-'
                ),
                React.createElement('td', { style: td }, obj.fecha_entrega_colaborador ? new Date(obj.fecha_entrega_colaborador + 'T12:00:00').toLocaleDateString('es-AR') : '-'),
                React.createElement('td', { style: td }, obj.justificacion_colaborador || '-'),
                React.createElement('td', { style: { ...td, fontWeight: 700, textAlign: 'center' } }, obj.ponderacion_final ? obj.ponderacion_final + '%' : '-'),
                React.createElement('td', { style: td },
                  React.createElement('span', { style: { padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : obj.status === 'aceptado' ? '#fef3c7' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : obj.status === 'aceptado' ? '#92400e' : '#64748b' } }, obj.status === 'validado' ? '✅ Validado' : obj.status === 'completado' ? '📝 Completado' : obj.status === 'aceptado' ? '👤 Aceptado' : '⏳ Pendiente')
                ),
                React.createElement('td', { style: td },
                  obj.status === 'completado' ? React.createElement('button', { onClick: function() { setObjValidando(obj); }, style: { ...s.btnPrimario, background: '#22c55e', fontSize: 12, padding: '6px 12px' } }, '✅ Validar') : null
                )
              );
            })
          )
        )
      )
  );
}

function ObjetivosColaborador({ profile }) {
  var objetivos = []; var setObjetivos;
  var cargando = true; var setCargando;
  var objSeleccionado = null; var setObjSeleccionado;
  var s1 = useState([]); objetivos = s1[0]; setObjetivos = s1[1];
  var s2 = useState(true); cargando = s2[0]; setCargando = s2[1];
  var s3 = useState(null); objSeleccionado = s3[0]; setObjSeleccionado = s3[1];

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

  async function completarObjetivo() {
    if (!objSeleccionado) return;
    await supabase.from('objetivos').update({
      status: 'completado',
      completado_por_colaborador: true,
      fecha_completado: new Date(),
      alcance_logrado: objSeleccionado.alcance_logrado,
      fecha_entrega_colaborador: objSeleccionado.fecha_entrega,
      justificacion_colaborador: objSeleccionado.justificacion
    }).eq('id', objSeleccionado.id);
    setObjSeleccionado(null);
    cargarObjetivos();
  }

  if (cargando) return React.createElement('p', null, 'Cargando objetivos...');

  if (objSeleccionado) {
    return React.createElement('div', { style: { maxWidth: 600 } },
      React.createElement('button', { onClick: function() { setObjSeleccionado(null); }, style: { ...s.btnInfo, marginBottom: 16 } }, '← Volver'),
      React.createElement('h3', null, '✔️ Completar Objetivo'),
      React.createElement('p', { style: { color: '#64748b', marginBottom: 20 } }, objSeleccionado.objetivo),
      React.createElement('div', { style: { marginBottom: 12 } },
        React.createElement('label', { style: { fontSize: 12, display: 'block', marginBottom: 4 } }, 'Alcance Logrado'),
        React.createElement('select', {
          value: objSeleccionado.alcance_logrado || '',
          onChange: function(e) { setObjSeleccionado({...objSeleccionado, alcance_logrado: e.target.value}); },
          style: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }
        },
          React.createElement('option', { value: '' }, 'Seleccionar alcance'),
          React.createElement('option', { value: '0' }, '0% - No alcanzado'),
          React.createElement('option', { value: '80' }, '80% - Parcial'),
          React.createElement('option', { value: '100' }, '100% - Alcanzado'),
          React.createElement('option', { value: '120' }, '120% - Superado')
        )
      ),
      React.createElement('div', { style: { marginBottom: 12 } },
        React.createElement('label', { style: { fontSize: 12, display: 'block', marginBottom: 4 } }, 'Fecha de Entrega'),
        React.createElement('input', {
          type: 'date',
          value: objSeleccionado.fecha_entrega || '',
          onChange: function(e) { setObjSeleccionado({...objSeleccionado, fecha_entrega: e.target.value}); },
          style: { width: '100%', padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' }
        })
      ),
      React.createElement('div', { style: { marginBottom: 12 } },
        React.createElement('label', { style: { fontSize: 12, display: 'block', marginBottom: 4 } }, 'Justificacion'),
        React.createElement('textarea', {
          value: objSeleccionado.justificacion || '',
          onChange: function(e) { setObjSeleccionado({...objSeleccionado, justificacion: e.target.value}); },
          placeholder: 'Explica brevemente el resultado...',
          style: { ...s.textarea, minHeight: 80 }
        })
      ),
      React.createElement('button', { onClick: completarObjetivo, style: s.btnPrimario }, '✔️ Confirmar Completado')
    );
  }

  return React.createElement('div', null,
    React.createElement('h2', { style: { color: '#231F20', marginBottom: 20 } }, '🎯 Mis Objetivos'),
    React.createElement('p', { style: { color: '#64748b', marginBottom: 20 } }, 'Objetivos asignados por tu gerente.'),
    objetivos.length === 0 ?
      React.createElement('div', { style: { ...s.tarjetaStat, textAlign: 'center', padding: 60 } },
        React.createElement('p', { style: { color: '#94a3b8', fontSize: 16 } }, 'No tienes objetivos asignados aun.')
      ) :
      React.createElement('div', { style: { overflowX: 'auto' } },
        React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', minWidth: 1500 } },
          React.createElement('thead', null,
            React.createElement('tr', { style: { background: '#231F20' } },
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Objetivo'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Pond'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, '0%'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, '80%'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, '100%'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, '120%'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Alcance'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Alcance Final'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Status'),
              React.createElement('th', { style: { ...th, color: '#D4D2C6' } }, 'Accion')
            )
          ),
          React.createElement('tbody', null,
            objetivos.map(function(obj) {
              return React.createElement('tr', { key: obj.id, style: { borderBottom: '1px solid #e2e8f0' } },
                React.createElement('td', { style: td }, obj.objetivo),
                React.createElement('td', { style: { ...td, fontWeight: 700, textAlign: 'center' } }, obj.ponderacion + '%'),
                React.createElement('td', { style: td }, obj.alcance_0_fecha ? new Date(obj.alcance_0_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'),
                React.createElement('td', { style: td }, obj.alcance_80_fecha ? new Date(obj.alcance_80_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'),
                React.createElement('td', { style: td }, obj.alcance_100_fecha ? new Date(obj.alcance_100_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'),
                React.createElement('td', { style: td }, obj.alcance_120_fecha ? new Date(obj.alcance_120_fecha + 'T12:00:00').toLocaleDateString('es-AR') : '-'),
                React.createElement('td', { style: td },
                  obj.alcance_logrado ? React.createElement('span', { style: { padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.alcance_logrado === '120' ? '#dcfce7' : obj.alcance_logrado === '100' ? '#dbeafe' : obj.alcance_logrado === '80' ? '#fef3c7' : '#fee2e2', color: obj.alcance_logrado === '120' ? '#166534' : obj.alcance_logrado === '100' ? '#1e40af' : obj.alcance_logrado === '80' ? '#92400e' : '#dc2626' } }, obj.alcance_logrado + '%') : '-'
                ),
                React.createElement('td', { style: { ...td, fontWeight: 700, textAlign: 'center' } }, obj.ponderacion_final ? obj.ponderacion_final + '%' : '-'),
                React.createElement('td', { style: td },
                  React.createElement('span', { style: { padding: '4px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: obj.status === 'validado' ? '#dcfce7' : obj.status === 'completado' ? '#dbeafe' : obj.status === 'aceptado' ? '#fef3c7' : '#f1f5f9', color: obj.status === 'validado' ? '#166534' : obj.status === 'completado' ? '#1e40af' : obj.status === 'aceptado' ? '#92400e' : '#64748b' } }, obj.status === 'validado' ? '✅ Validado' : obj.status === 'completado' ? '📝 Completado' : obj.status === 'aceptado' ? '👤 Aceptado' : '⏳ Pendiente')
                ),
                React.createElement('td', { style: td },
                  obj.status === 'pendiente' ? React.createElement('button', { onClick: function() { aceptarObjetivo(obj.id); }, style: { ...s.btnPrimario, background: '#3b82f6', fontSize: 12, padding: '6px 12px' } }, '✅ Aceptar') : null,
                  obj.status === 'aceptado' ? React.createElement('button', { onClick: function() { setObjSeleccionado({...obj, alcance_logrado: '', fecha_entrega: '', justificacion: ''}); }, style: { ...s.btnPrimario, background: '#22c55e', fontSize: 12, padding: '6px 12px' } }, '✔️ Completar') : null
                )
              );
            })
          )
        )
      )
  );
}

function ObjetivosCorporativosView({ profile }) {
  return React.createElement('div', null,
    React.createElement('h2', { style: { color: '#231F20', marginBottom: 20 } }, '🏢 Objetivos Corporativos'),
    React.createElement('div', { style: { ...s.tarjetaStat, textAlign: 'center', padding: 60 } },
      React.createElement('p', { style: { color: '#94a3b8', fontSize: 16 } }, 'Modulo en desarrollo.')
    )
  );
}

// =============================================
// DESEMPENO (RESTO DEL CÓDIGO SIN CAMBIOS)
// =============================================
function DesempenoView({ profile, cicloActivo, setCicloActivo }) {
  var esAdmin = profile.role === 'admin_rrhh';
  var esGerente = profile.seniority === 'Gerente';
  if (!cicloActivo) return React.createElement(CiclosLista, { esAdmin: esAdmin, onSelectCiclo: setCicloActivo });
  return React.createElement('div', null,
    React.createElement('button', { onClick: function() { setCicloActivo(null); }, style: { ...s.btnInfo, marginBottom: 16 } }, '← Volver a Ciclos'),
    React.createElement('h2', null, '📊 ' + cicloActivo.nombre),
    React.createElement('p', { style: { color: '#64748b', marginBottom: 20 } }, new Date(cicloActivo.fecha_inicio).toLocaleDateString('es-AR') + ' · ' + cicloActivo.estado),
    esAdmin ? React.createElement(PanelAdminConEquipo, { profile: profile, cicloId: cicloActivo.id, tieneAutoevaluacion: !esGerente }) : null,
    !esAdmin && esGerente ? React.createElement(EquipoLider, { cicloId: cicloActivo.id, profile: profile }) : null,
    !esAdmin && !esGerente && profile.role === 'lider' ? React.createElement(PanelLiderConAutoevaluacion, { cicloId: cicloActivo.id, profile: profile }) : null,
    !esAdmin && !esGerente && profile.role !== 'lider' ? React.createElement(PanelColaboradorConEquipo, { userId: profile.id, seniority: profile.seniority, cicloId: cicloActivo.id, profile: profile }) : null
  );
}

function PanelLiderConAutoevaluacion({ cicloId, profile }) {
  var v = 'equipo'; var setV;
  var s1 = useState('equipo'); v = s1[0]; setV = s1[1];
  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 20 } },
      React.createElement('button', { onClick: function() { setV('equipo'); }, style: v === 'equipo' ? s.btnPrimario : s.btnInfo }, '👥 Mi Equipo'),
      React.createElement('button', { onClick: function() { setV('mievaluacion'); }, style: v === 'mievaluacion' ? s.btnPrimario : s.btnInfo }, '📝 Mi Evaluacion')
    ),
    v === 'equipo' ? React.createElement(EquipoLider, { cicloId: cicloId, profile: profile }) : null,
    v === 'mievaluacion' ? React.createElement(PanelColaborador, { userId: profile.id, seniority: profile.seniority, cicloId: cicloId }) : null
  );
}

function PanelAdminConEquipo({ profile, cicloId, tieneAutoevaluacion }) {
  var vista = 'dashboard'; var setVista;
  var stats = { total: 0, enviadas: 0, pendientes: 0 }; var setStats;
  var colabs = []; var setColabs;
  var hist = null; var setHist;
  var s1 = useState('dashboard'); vista = s1[0]; setVista = s1[1];
  var s2 = useState({ total: 0, enviadas: 0, pendientes: 0 }); stats = s2[0]; setStats = s2[1];
  var s3 = useState([]); colabs = s3[0]; setColabs = s3[1];
  var s4 = useState(null); hist = s4[0]; setHist = s4[1];
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() {
    var resps = await Promise.all([
      supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId),
      supabase.from('evaluaciones').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('estado', 'enviado'),
      supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', cicloId),
      supabase.from('profiles').select('id, email, full_name, area, seniority, role, activo').neq('role', 'admin_rrhh')
    ]);
    var ids = (resps[2].data || []).map(function(x) { return x.colaborador_id; });
    setColabs((resps[3].data || []).filter(function(c) { return ids.includes(c.id); }));
    setStats({ total: resps[0].count || 0, enviadas: resps[1].count || 0, pendientes: (resps[0].count || 0) - (resps[1].count || 0) });
  }
  if (hist) return React.createElement(HistorialAdmin, { colaborador: hist, onVolver: function() { setHist(null); } });
  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' } },
      React.createElement('button', { onClick: function() { setVista('dashboard'); }, style: vista === 'dashboard' ? s.btnPrimario : s.btnInfo }, '📊 Dashboard'),
      React.createElement('button', { onClick: function() { setVista('evaluaciones'); }, style: vista === 'evaluaciones' ? s.btnPrimario : s.btnInfo }, '📋 Evaluaciones'),
      React.createElement('button', { onClick: function() { setVista('calibracion'); }, style: vista === 'calibracion' ? s.btnPrimario : s.btnInfo }, '🎯 Calibracion'),
      React.createElement('button', { onClick: function() { setVista('feedback'); }, style: vista === 'feedback' ? s.btnPrimario : s.btnInfo }, '💬 Feedback'),
      React.createElement('button', { onClick: function() { setVista('equipo'); }, style: vista === 'equipo' ? s.btnPrimario : s.btnInfo }, '👥 Mi Equipo'),
      tieneAutoevaluacion ? React.createElement('button', { onClick: function() { setVista('mievaluacion'); }, style: vista === 'mievaluacion' ? s.btnPrimario : s.btnInfo }, '📝 Mi Evaluacion') : null,
      React.createElement('button', { onClick: function() { setVista('colaboradores'); }, style: vista === 'colaboradores' ? s.btnPrimario : s.btnInfo }, '👥 Participantes')
    ),
    vista === 'dashboard' ? React.createElement(DashboardView, { stats: stats, colabs: colabs }) : null,
    vista === 'evaluaciones' ? React.createElement(EvaluacionesAdmin, { cicloId: cicloId }) : null,
    vista === 'calibracion' ? React.createElement(PanelCalibracion, { cicloId: cicloId, colabs: colabs, onHist: setHist }) : null,
    vista === 'feedback' ? React.createElement(FeedbackAdmin, { cicloId: cicloId }) : null,
    vista === 'equipo' ? React.createElement(EquipoLider, { cicloId: cicloId, profile: profile }) : null,
    vista === 'mievaluacion' && tieneAutoevaluacion ? React.createElement(PanelColaborador, { userId: profile.id, seniority: profile.seniority, cicloId: cicloId }) : null,
    vista === 'colaboradores' ? React.createElement(ParticipantesView, { colabs: colabs }) : null
  );
}

function PanelColaboradorConEquipo({ userId, seniority, cicloId, profile }) {
  var v = 'autoevaluacion'; var setV;
  var tieneEq = false; var setTieneEq;
  var part = false; var setPart;
  var verif = true; var setVerif;
  var s1 = useState('autoevaluacion'); v = s1[0]; setV = s1[1];
  var s2 = useState(false); tieneEq = s2[0]; setTieneEq = s2[1];
  var s3 = useState(false); part = s3[0]; setPart = s3[1];
  var s4 = useState(true); verif = s4[0]; setVerif = s4[1];
  useEffect(function() {
    (async function() {
      var resp = await supabase.auth.getSession();
      if (resp.data.session) {
        var resps = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('leader_id', resp.data.session.user.id),
          supabase.from('ciclo_colaboradores').select('*', { count: 'exact', head: true }).eq('ciclo_id', cicloId).eq('colaborador_id', resp.data.session.user.id)
        ]);
        setTieneEq((resps[0].count || 0) > 0);
        setPart((resps[1].count || 0) > 0);
      }
      setVerif(false);
    })();
  }, [cicloId]);
  if (verif) return React.createElement('p', null, 'Verificando...');
  if (!part) return React.createElement('div', { style: { ...s.tarjetaStat, textAlign: 'center', padding: 40 } }, React.createElement('p', null, 'No estas participando.'));
  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', gap: 12, marginBottom: 20 } },
      React.createElement('button', { onClick: function() { setV('autoevaluacion'); }, style: v === 'autoevaluacion' ? s.btnPrimario : s.btnInfo }, '📝 Mi Evaluacion'),
      tieneEq ? React.createElement('button', { onClick: function() { setV('equipo'); }, style: v === 'equipo' ? s.btnPrimario : s.btnInfo }, '👥 Mi Equipo') : null
    ),
    v === 'autoevaluacion' ? React.createElement(PanelColaborador, { userId: userId, seniority: seniority, cicloId: cicloId }) : null,
    v === 'equipo' && tieneEq ? React.createElement(EquipoLider, { cicloId: cicloId, profile: profile }) : null
  );
}

function CiclosLista({ esAdmin, onSelectCiclo }) {
  var ciclos = []; var setCiclos; var carg = true; var setCarg; var showC = false; var setShowC; var nom = ''; var setNom; var fIni = ''; var setFIni; var fFin = ''; var setFFin; var cSel = null; var setCSel; var todos = []; var setTodos; var parts = []; var setParts;
  var s1 = useState([]); ciclos = s1[0]; setCiclos = s1[1]; var s2 = useState(true); carg = s2[0]; setCarg = s2[1]; var s3 = useState(false); showC = s3[0]; setShowC = s3[1]; var s4 = useState(''); nom = s4[0]; setNom = s4[1]; var s5 = useState(''); fIni = s5[0]; setFIni = s5[1]; var s6 = useState(''); fFin = s6[0]; setFFin = s6[1]; var s7 = useState(null); cSel = s7[0]; setCSel = s7[1]; var s8 = useState([]); todos = s8[0]; setTodos = s8[1]; var s9 = useState([]); parts = s9[0]; setParts = s9[1];
  useEffect(function() { cargar(); if (esAdmin) cargarColabs(); }, []);
  async function cargar() { var resp = await supabase.from('ciclos').select('*').order('fecha_inicio', { ascending: false }); setCiclos(resp.data || []); setCarg(false); }
  async function cargarColabs() { var resp = await supabase.from('profiles').select('id, email, full_name, area, seniority').neq('role', 'admin_rrhh').eq('activo', true); setTodos(resp.data || []); }
  async function crear() { if (!nom || !fIni) return alert('Nombre y fecha obligatorios'); await supabase.from('ciclos').insert({ nombre: nom, fecha_inicio: fIni, fecha_fin: fFin || null, estado: 'activo' }); setNom(''); setFIni(''); setFFin(''); setShowC(false); cargar(); }
  async function abrir(ciclo) { setCSel(ciclo.id); var resp = await supabase.from('ciclo_colaboradores').select('colaborador_id').eq('ciclo_id', ciclo.id); setParts((resp.data || []).map(function(p) { return p.colaborador_id; })); }
  async function toggle(cid) { if (parts.includes(cid)) { await supabase.from('ciclo_colaboradores').delete().eq('ciclo_id', cSel).eq('colaborador_id', cid); setParts(function(p) { return p.filter(function(id) { return id !== cid; }); }); } else { await supabase.from('ciclo_colaboradores').insert({ ciclo_id: cSel, colaborador_id: cid }); setParts(function(p) { return p.concat([cid]); }); } }
  if (carg) return React.createElement('p', null, 'Cargando ciclos...');

  var botones = [];
  if (esAdmin) {
    botones.push(React.createElement('button', { key: 'nuevo', onClick: function() { setShowC(!showC); }, style: s.btnPrimario }, '+ Nuevo Ciclo'));
  }

  var formCrear = null;
  if (showC) {
    formCrear = React.createElement('div', { style: { ...s.tarjetaStat, marginBottom: 20 } },
      React.createElement('h4', null, 'Crear Ciclo'),
      React.createElement('div', { style: { display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 } },
        React.createElement('div', null, React.createElement('label', null, 'Nombre'), React.createElement('input', { value: nom, onChange: function(e) { setNom(e.target.value); }, placeholder: 'Ej: 1er Semestre 2025', style: { padding: 8, borderRadius: 6, border: '1px solid #D4D2C6', width: 200 } })),
        React.createElement('div', null, React.createElement('label', null, 'Inicio'), React.createElement('input', { type: 'date', value: fIni, onChange: function(e) { setFIni(e.target.value); }, style: { padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' } })),
        React.createElement('div', null, React.createElement('label', null, 'Fin'), React.createElement('input', { type: 'date', value: fFin, onChange: function(e) { setFFin(e.target.value); }, style: { padding: 8, borderRadius: 6, border: '1px solid #D4D2C6' } })),
        React.createElement('button', { onClick: crear, style: { ...s.btnPrimario, background: '#22c55e', alignSelf: 'flex-end' } }, 'Crear')
      )
    );
  }

  var panelParticipantes = null;
  if (cSel) {
    panelParticipantes = React.createElement('div', { style: { ...s.tarjetaStat, marginBottom: 20, background: '#f8fafc' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 12 } },
        React.createElement('h4', null, '👥 Participantes'),
        React.createElement('button', { onClick: function() { setCSel(null); }, style: s.btnInfo }, '✕')
      ),
      React.createElement('p', null, parts.length + ' seleccionados'),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' } },
        todos.map(function(c) {
          return React.createElement('div', { key: c.id, onClick: function() { toggle(c.id); }, style: { padding: 10, borderRadius: 8, cursor: 'pointer', display: 'flex', justifyContent: 'space-between', background: parts.includes(c.id) ? '#231F20' : 'white', color: parts.includes(c.id) ? '#D4D2C6' : '#231F20', border: '1px solid #D4D2C6' } },
            React.createElement('div', null, React.createElement('strong', null, c.full_name || c.email), React.createElement('p', { style: { fontSize: 11, margin: 0, opacity: 0.7 } }, (c.area || '') + '·' + (c.seniority || ''))),
            React.createElement('span', null, parts.includes(c.id) ? '✅' : '○')
          );
        })
      )
    );
  }

  var listaCiclos = null;
  if (ciclos.length === 0) {
    listaCiclos = React.createElement('div', { style: { ...s.tarjetaStat, textAlign: 'center', padding: 40 } }, React.createElement('p', null, 'No hay ciclos.'));
  } else {
    listaCiclos = React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 } },
      ciclos.map(function(c) {
        var botonEntrar = React.createElement('button', { onClick: function() { onSelectCiclo(c); }, style: { ...s.btnPrimario, flex: 1 } }, 'Entrar');
        var botonParticipantes = null;
        if (esAdmin) {
          botonParticipantes = React.createElement('button', { onClick: function() { abrir(c); }, style: s.btnSecundario }, '👥');
        }
        return React.createElement('div', { key: c.id, style: { ...s.tarjetaStat, border: '2px solid #D4D2C6' } },
          React.createElement('h3', null, c.nombre),
          React.createElement('p', null, '📅 Inicio: ' + new Date(c.fecha_inicio).toLocaleDateString('es-AR')),
          c.fecha_fin ? React.createElement('p', null, '📅 Fin: ' + new Date(c.fecha_fin).toLocaleDateString('es-AR')) : null,
          React.createElement('span', { style: { padding: '4px 10px', borderRadius: 12, fontSize: 11, fontWeight: 600, background: c.estado === 'activo' ? '#dcfce7' : '#f1f5f9', color: c.estado === 'activo' ? '#166534' : '#64748b', display: 'inline-block', marginTop: 8 } }, c.estado === 'activo' ? '✅ Activo' : '📁 ' + c.estado),
          React.createElement('div', { style: { display: 'flex', gap: 8, marginTop: 12 } }, botonEntrar, botonParticipantes)
        );
      })
    );
  }

  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 20 } }, React.createElement('h2', null, '📊 Ciclos de Evaluacion'), botones),
    formCrear,
    panelParticipantes,
    listaCiclos
  );
}

function DashboardView({ stats, colabs }) {
  return React.createElement('div', null,
    React.createElement('div', { style: s.grid },
      React.createElement('div', { style: s.tarjetaStat }, React.createElement('p', null, '👥 Participantes'), React.createElement('p', { style: { fontSize: 36, fontWeight: 700, color: '#231F20' } }, colabs.length)),
      React.createElement('div', { style: s.tarjetaStat }, React.createElement('p', null, '📋 Evaluaciones'), React.createElement('p', { style: { fontSize: 36, fontWeight: 700, color: '#231F20' } }, stats.total)),
      React.createElement('div', { style: { ...s.tarjetaStat, borderTop: '4px solid #231F20' } }, React.createElement('p', null, '✅ Completadas'), React.createElement('p', { style: { fontSize: 36, fontWeight: 700, color: '#231F20' } }, stats.enviadas)),
      React.createElement('div', { style: { ...s.tarjetaStat, borderTop: '4px solid #D4D2C6' } }, React.createElement('p', null, '⏳ Pendientes'), React.createElement('p', { style: { fontSize: 36, fontWeight: 700, color: '#231F20' } }, stats.pendientes))
    )
  );
}

function ParticipantesView({ colabs }) {
  return React.createElement('div', { style: s.tarjetaStat }, React.createElement('h4', null, '👥 Participantes (' + colabs.length + ')'), React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', { style: th }, 'Nombre'), React.createElement('th', { style: th }, 'Email'), React.createElement('th', { style: th }, 'Area'), React.createElement('th', { style: th }, 'Seniority'))), React.createElement('tbody', null, colabs.map(function(c) { return React.createElement('tr', { key: c.id }, React.createElement('td', { style: td }, c.full_name || '-'), React.createElement('td', { style: td }, c.email), React.createElement('td', { style: td }, c.area || '-'), React.createElement('td', { style: td }, c.seniority || '-')); }))));
}

function EvaluacionesAdmin({ cicloId }) {
  var evs = []; var setEvs; var carg = true; var setCarg;
  var s1 = useState([]); evs = s1[0]; setEvs = s1[1]; var s2 = useState(true); carg = s2[0]; setCarg = s2[1];
  useEffect(function() { (async function() { var resp = await supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, estado, rating_promedio, rating_calibrado, created_at, colaborador:colaborador_id(email, full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setEvs(resp.data || []); setCarg(false); })(); }, [cicloId]);
  if (carg) return React.createElement('p', null, 'Cargando...');
  return React.createElement('div', { style: s.tarjetaStat }, React.createElement('h4', null, '📋 Evaluaciones (' + evs.length + ')'), React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', { style: th }, 'Colaborador'), React.createElement('th', { style: th }, 'Tipo'), React.createElement('th', { style: th }, 'Estado'), React.createElement('th', { style: th }, 'Rating'), React.createElement('th', { style: th }, 'Calibrado'), React.createElement('th', { style: th }, 'Fecha'))), React.createElement('tbody', null, evs.map(function(ev) { return React.createElement('tr', { key: ev.id }, React.createElement('td', { style: td }, (ev.colaborador ? ev.colaborador.full_name : null) || '-'), React.createElement('td', { style: td }, ev.tipo_evaluacion === 'autoevaluacion' ? 'Auto' : 'Lider'), React.createElement('td', { style: td }, ev.estado), React.createElement('td', { style: { ...td, fontWeight: 700 } }, ev.rating_promedio || '-'), React.createElement('td', { style: td }, ev.rating_calibrado || '-'), React.createElement('td', { style: td }, new Date(ev.created_at).toLocaleDateString('es-AR'))); }))));
}

function PanelCalibracion({ cicloId, colabs, onHist }) {
  var datos = []; var setDatos; var carg = true; var setCarg; var filtro = 'Todas'; var setFiltro;
  var s1 = useState([]); datos = s1[0]; setDatos = s1[1]; var s2 = useState(true); carg = s2[0]; setCarg = s2[1]; var s3 = useState('Todas'); filtro = s3[0]; setFiltro = s3[1];
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() { setCarg(true); var resp = await supabase.from('evaluaciones').select('id, colaborador_id, tipo_evaluacion, rating_promedio, rating_calibrado, comentario_calibracion, colaborador:colaborador_id(id, email, full_name, area, seniority)').eq('ciclo_id', cicloId).in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']); var mapa = {}; (resp.data || []).forEach(function(ev) { if (!ev.colaborador) return; if (!mapa[ev.colaborador_id]) mapa[ev.colaborador_id] = { colaborador: ev.colaborador, promAuto: null, promLider: null, ratingFinal: null, comentarioCalibracion: null, evaluacionLider: null }; if (ev.tipo_evaluacion === 'autoevaluacion') mapa[ev.colaborador_id].promAuto = ev.rating_promedio; if (ev.tipo_evaluacion === 'evaluacion_lider') { mapa[ev.colaborador_id].promLider = ev.rating_promedio; mapa[ev.colaborador_id].ratingFinal = ev.rating_calibrado; mapa[ev.colaborador_id].comentarioCalibracion = ev.comentario_calibracion; mapa[ev.colaborador_id].evaluacionLider = ev; } }); colabs.forEach(function(c) { if (!mapa[c.id]) mapa[c.id] = { colaborador: c, promAuto: null, promLider: null, ratingFinal: null, comentarioCalibracion: null, evaluacionLider: null }; }); setDatos(Object.values(mapa)); setCarg(false); }
  async function guardarCal(evaluacionId, rating, comentario) { await supabase.from('evaluaciones').update({ rating_calibrado: rating, comentario_calibracion: comentario }).eq('id', evaluacionId); setDatos(function(p) { return p.map(function(d) { return d.evaluacionLider && d.evaluacionLider.id === evaluacionId ? { ...d, ratingFinal: rating, comentarioCalibracion: comentario } : d; }); }); }
  function clasificar(prom) { if (!prom) return { texto: '-', color: '#94a3b8' }; var p = parseFloat(prom); if (p <= 1.4) return { texto: 'No adecuado', color: '#dc2626' }; if (p <= 2.4) return { texto: 'Por debajo', color: '#f59e0b' }; if (p <= 3.4) return { texto: 'Cumple', color: '#3b82f6' }; if (p <= 4.4) return { texto: 'Excede', color: '#22c55e' }; return { texto: 'Distinguido', color: '#8b5cf6' }; }
  function generarPDF(d) { var pdf = new jsPDF(); var y = 28; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.text('EVALUACION DE DESEMPENO', 15, y); y += 7; pdf.setFontSize(9); pdf.text('Colaborador: ' + (d.colaborador.full_name || d.colaborador.email), 15, y); y += 5; pdf.text('Area: ' + (d.colaborador.area || '-') + '   Seniority: ' + (d.colaborador.seniority || '-'), 15, y); y += 10; pdf.setFontSize(12); pdf.text('Auto: ' + (d.promAuto || '-') + '   Lider: ' + (d.promLider || '-') + '   Calibrado: ' + (d.ratingFinal || '-'), 15, y + 10); if (d.comentarioCalibracion) { pdf.setFontSize(8); pdf.text('Justificacion: ' + d.comentarioCalibracion, 15, y + 18); } return pdf; }
  function verPDF(d) { var n = (d.colaborador.full_name || d.colaborador.email).split(' ').join('_'); generarPDF(d).save('Evaluacion_' + n + '.pdf'); }
  function enviarPDF(d) { verPDF(d); if (d.evaluacionLider && d.evaluacionLider.evaluador_id) { supabase.from('profiles').select('email').eq('id', d.evaluacionLider.evaluador_id).single().then(function(res) { abrirGmail(d.colaborador.email, res.data ? res.data.email : ''); }); } else { abrirGmail(d.colaborador.email, ''); } }
  var areas = useMemo(function() { return ['Todas'].concat([...new Set(datos.map(function(d) { return d.colaborador.area; }).filter(Boolean))]); }, [datos]); var df = filtro === 'Todas' ? datos : datos.filter(function(d) { return d.colaborador.area === filtro; });
  if (carg) return React.createElement('p', null, 'Cargando...');
  return React.createElement('div', { style: { ...s.tarjetaStat } }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', marginBottom: 16 } }, React.createElement('h3', { style: { margin: 0, color: '#231F20' } }, 'Calibracion'), React.createElement('select', { value: filtro, onChange: function(e) { setFiltro(e.target.value); }, style: { padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' } }, areas.map(function(a) { return React.createElement('option', { key: a, value: a }, a); }))), React.createElement('div', { style: { overflowX: 'auto' } }, React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', minWidth: 1000 } }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', { style: th }, 'Colaborador'), React.createElement('th', { style: th }, 'Auto'), React.createElement('th', { style: th }, 'Lider'), React.createElement('th', { style: th }, 'GAP'), React.createElement('th', { style: th }, 'Calibrado'), React.createElement('th', { style: th }, 'Justificacion'), React.createElement('th', { style: th }, 'Hist'), React.createElement('th', { style: th }, 'PDF'), React.createElement('th', { style: th }, 'Enviar'))), React.createElement('tbody', null, df.map(function(d) { var gap = d.promAuto && d.promLider ? (parseFloat(d.promLider) - parseFloat(d.promAuto)).toFixed(1) : null; var clasF = clasificar(d.ratingFinal); return React.createElement('tr', { key: d.colaborador.id }, React.createElement('td', { style: td }, React.createElement('strong', null, d.colaborador.full_name || d.colaborador.email)), React.createElement('td', { style: { ...td, textAlign: 'center', fontWeight: 700, color: clasificar(d.promAuto).color } }, d.promAuto || '-'), React.createElement('td', { style: { ...td, textAlign: 'center', fontWeight: 700, color: clasificar(d.promLider).color } }, d.promLider || '-'), React.createElement('td', { style: { ...td, textAlign: 'center', fontWeight: 700 } }, gap || '-'), React.createElement('td', { style: td }, d.evaluacionLider ? React.createElement('select', { value: d.ratingFinal || '', onChange: function(e) { guardarCal(d.evaluacionLider.id, parseFloat(e.target.value), d.comentarioCalibracion || ''); }, style: { padding: 4, borderRadius: 6, border: '2px solid ' + clasF.color, fontWeight: 600, color: clasF.color } }, React.createElement('option', { value: '' }, '-'), React.createElement('option', { value: '1' }, '1.0'), React.createElement('option', { value: '1.5' }, '1.5'), React.createElement('option', { value: '2' }, '2.0'), React.createElement('option', { value: '2.5' }, '2.5'), React.createElement('option', { value: '3' }, '3.0'), React.createElement('option', { value: '3.5' }, '3.5'), React.createElement('option', { value: '4' }, '4.0'), React.createElement('option', { value: '4.5' }, '4.5'), React.createElement('option', { value: '5' }, '5.0')) : '-'), React.createElement('td', { style: td }, d.evaluacionLider ? React.createElement('input', { value: d.comentarioCalibracion || '', onChange: function(e) { guardarCal(d.evaluacionLider.id, d.ratingFinal || null, e.target.value); }, placeholder: 'Justificar...', style: { width: '100%', padding: 4, borderRadius: 6, border: '1px solid #D4D2C6', fontSize: 11 } }) : '-'), React.createElement('td', { style: td }, React.createElement('button', { onClick: function() { onHist(d.colaborador); }, style: { background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' } }, '📋')), React.createElement('td', { style: td }, React.createElement('button', { onClick: function() { verPDF(d); }, style: { background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11 } }, 'PDF')), React.createElement('td', { style: td }, d.ratingFinal ? React.createElement('button', { onClick: function() { enviarPDF(d); }, style: { background: '#231F20', color: '#D4D2C6', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600 } }, 'Enviar') : '-')); })))));
}

function FeedbackAdmin({ cicloId }) {
  var fbs = []; var setFbs; var carg = true; var setCarg;
  var s1 = useState([]); fbs = s1[0]; setFbs = s1[1]; var s2 = useState(true); carg = s2[0]; setCarg = s2[1];
  useEffect(function() { (async function() { var resp = await supabase.from('feedback').select('*, lider:lider_id(email, full_name), colaborador:colaborador_id(email, full_name)').eq('ciclo_id', cicloId).order('created_at', { ascending: false }); setFbs(resp.data || []); setCarg(false); })(); }, [cicloId]);
  if (carg) return React.createElement('p', null, 'Cargando...');
  return React.createElement('div', { style: s.tarjetaStat }, React.createElement('h4', null, '💬 Feedback (' + fbs.length + ')'), fbs.length === 0 ? React.createElement('p', { style: { textAlign: 'center', padding: 20, color: '#94a3b8' } }, 'Sin registros.') : React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', { style: th }, 'Lider'), React.createElement('th', { style: th }, 'Colaborador'), React.createElement('th', { style: th }, 'Comentario'), React.createElement('th', { style: th }, 'Fecha'), React.createElement('th', { style: th }, 'OK'))), React.createElement('tbody', null, fbs.map(function(f) { return React.createElement('tr', { key: f.id }, React.createElement('td', { style: td }, (f.lider ? f.lider.full_name : null) || '-'), React.createElement('td', { style: td }, (f.colaborador ? f.colaborador.full_name : null) || '-'), React.createElement('td', { style: td }, f.comentario_lider || '-'), React.createElement('td', { style: td }, f.fecha_feedback_lider ? new Date(f.fecha_feedback_lider).toLocaleDateString('es-AR') : '-'), React.createElement('td', { style: td }, f.confirmacion_colaborador ? '✅' : '⏳')); }))));
}

function HistorialAdmin({ colaborador, onVolver }) {
  var hist = []; var setHist; var carg = true; var setCarg;
  var s1 = useState([]); hist = s1[0]; setHist = s1[1]; var s2 = useState(true); carg = s2[0]; setCarg = s2[1];
  useEffect(function() { (async function() { var resp = await supabase.from('evaluaciones_historicas').select('*').eq('colaborador_id', colaborador.id).order('fecha_evaluacion', { ascending: false }); setHist(resp.data || []); setCarg(false); })(); }, []);
  if (carg) return React.createElement('p', null, 'Cargando...');
  return React.createElement('div', null, React.createElement('button', { onClick: onVolver, style: { ...s.btnInfo, marginBottom: 16 } }, '← Volver'), React.createElement('h3', null, '📋 Historial: ' + (colaborador.full_name || colaborador.email)), hist.length === 0 ? React.createElement('p', { style: { padding: 40, color: '#94a3b8' } }, 'Sin historial.') : React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } }, React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', { style: th }, 'Fecha'), React.createElement('th', { style: th }, 'Rating'))), React.createElement('tbody', null, hist.map(function(h) { return React.createElement('tr', { key: h.id }, React.createElement('td', { style: td }, new Date(h.fecha_evaluacion + 'T12:00:00').toLocaleDateString('es-AR')), React.createElement('td', { style: td }, h.rating_final || '-')); }))));
}

function DetalleAutoEvaluacion({ autoevaluacion }) {
  if (!autoevaluacion) return React.createElement('p', { style: { padding: 16, color: '#94a3b8' } }, 'Sin autoevaluacion.');
  var puntuaciones = autoevaluacion.puntuaciones || [];
  return React.createElement('div', { style: { marginTop: 16, background: 'white', borderRadius: 12, border: '2px solid #D4D2C6', overflow: 'hidden' } },
    React.createElement('div', { style: { background: '#231F20', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 } },
      React.createElement('h4', { style: { margin: 0, color: '#D4D2C6', fontSize: 16 } }, '📝 Autoevaluacion Completa'),
      React.createElement('div', { style: { display: 'flex', gap: 16, alignItems: 'center' } },
        React.createElement('span', { style: { color: '#D4D2C6', fontSize: 13 } }, autoevaluacion.estado === 'enviado' ? '✅ Enviada' : '📝 Borrador'),
        React.createElement('span', { style: { background: '#D4D2C6', color: '#231F20', padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 20 } }, autoevaluacion.rating_promedio || '-')
      )
    ),
    React.createElement('div', { style: { padding: 20 } },
      autoevaluacion.comentarios_finales ? React.createElement('div', { style: { marginBottom: 20, padding: 16, background: '#f8fafc', borderRadius: 8 } }, React.createElement('strong', null, '💬 Comentarios Finales:'), React.createElement('p', { style: { color: '#475569', fontSize: 14, marginTop: 4 } }, autoevaluacion.comentarios_finales)) : null,
      React.createElement('h5', null, '📊 Calificacion por Competencia'),
      puntuaciones.length === 0 ? React.createElement('p', { style: { color: '#94a3b8' } }, 'Sin competencias calificadas.') :
        React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', border: '1px solid #e2e8f0' } },
          React.createElement('thead', null, React.createElement('tr', { style: { background: '#231F20' } }, React.createElement('th', { style: { padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'left' } }, 'Competencia'), React.createElement('th', { style: { padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'center', width: 80 } }, 'Rating'), React.createElement('th', { style: { padding: '12px 16px', color: '#D4D2C6', fontSize: 12, textAlign: 'left' } }, 'Comentario'))),
          React.createElement('tbody', null, puntuaciones.map(function(p, i) { return React.createElement('tr', { key: p.id || i, style: { background: i % 2 === 0 ? 'white' : '#f8fafc', borderBottom: '1px solid #e2e8f0' } }, React.createElement('td', { style: { padding: '12px 16px', fontSize: 14, color: '#231F20', fontWeight: 500 } }, (p.competencias ? p.competencias.nombre : null) || 'ID: ' + p.competencia_id), React.createElement('td', { style: { padding: '12px 16px', textAlign: 'center' } }, React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 10, background: '#231F20', color: '#D4D2C6', fontSize: 16, fontWeight: 700 } }, p.rating)), React.createElement('td', { style: { padding: '12px 16px', fontSize: 13, color: '#475569' } }, p.comentario || 'Sin comentario')); }))
        )
    )
  );
}

function EquipoLider({ cicloId, profile }) {
  var equipo = []; var setEquipo; var colSel = null; var setColSel; var fbVis = null; var setFbVis; var detalleVisible = null; var setDetalleVisible;
  var s1 = useState([]); equipo = s1[0]; setEquipo = s1[1]; var s2 = useState(null); colSel = s2[0]; setColSel = s2[1]; var s3 = useState(null); fbVis = s3[0]; setFbVis = s3[1]; var s4 = useState(null); detalleVisible = s4[0]; setDetalleVisible = s4[1];
  useEffect(function() { cargar(); }, [cicloId]);
  async function cargar() { var resp = await supabase.auth.getSession(); if (!resp.data.session) return; var resp2 = await supabase.from('profiles').select('id, email, full_name, area, seniority').eq('leader_id', resp.data.session.user.id); if (!resp2.data) return; var eq = await Promise.all(resp2.data.map(async function(c) { var resp3 = await supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', c.id).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle(); var punts = []; if (resp3.data) { var resp4 = await supabase.from('puntuaciones').select('id, rating, comentario, competencia_id, competencias!inner(nombre)').eq('evaluacion_id', resp3.data.id); punts = resp4.data || []; } var resp5 = await supabase.from('evaluaciones').select('id, estado, rating_promedio').eq('colaborador_id', c.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(); var resp6 = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', c.id).maybeSingle(); return { ...c, autoevaluacion: resp3.data ? { ...resp3.data, puntuaciones: punts } : null, evaluacionLider: resp5.data, feedback: resp6.data }; })); setEquipo(eq); }
  if (colSel) return React.createElement(EvaluacionLider, { colaborador: colSel, cicloId: cicloId, onVolver: function() { setColSel(null); cargar(); } });
  if (fbVis) return React.createElement(FeedbackForm, { feedback: fbVis, cicloId: cicloId, onVolver: function() { setFbVis(null); cargar(); } });
return React.createElement('div', null, React.createElement('h3', null, '👥 Mi Equipo (' + equipo.length + ')'), equipo.length === 0 ? React.createElement('p', null, 'No tienes colaboradores.') : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 16 } }, equipo.map(function(c) { return React.createElement('div', { key: c.id, style: { ...s.tarjetaStat } }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 } }, React.createElement('div', { style: { flex: 1 } }, React.createElement('h4', null, c.full_name || c.email), React.createElement('p', { style: { color: '#64748b', fontSize: 13 } }, (c.area || '') + ' · ' + (c.seniority || '')), React.createElement('div', { style: { display: 'flex', gap: 16, marginTop: 8, fontSize: 12 } }, React.createElement('span', null, '📝 Auto: ', React.createElement('strong', { style: { color: (c.autoevaluacion ? c.autoevaluacion.estado === 'enviado' : false) ? '#22c55e' : '#f59e0b' } }, c.autoevaluacion && c.autoevaluacion.estado === 'enviado' ? '✅ Enviada' : '⏳ Pendiente')), React.createElement('span', null, '👥 Mi eval: ', React.createElement('strong', { style: { color: (c.evaluacionLider ? c.evaluacionLider.estado === 'enviado' : false) ? '#22c55e' : c.evaluacionLider ? '#f59e0b' : '#94a3b8' } }, c.evaluacionLider && c.evaluacionLider.estado === 'enviado' ? '✅ Completada' : c.evaluacionLider ? '📝 Borrador' : '❌ Sin evaluar')), React.createElement('span', null, '💬 FB: ', React.createElement('strong', { style: { color: (c.feedback ? c.feedback.confirmacion_colaborador : false) ? '#22c55e' : c.feedback ? '#f59e0b' : '#94a3b8' } }, c.feedback && c.feedback.confirmacion_colaborador ? '✅' : c.feedback ? '⏳' : '-')))), React.createElement('div', { style: { display: 'flex', gap: 8 } }, c.autoevaluacion && c.autoevaluacion.estado === 'enviado' ? React.createElement('button', { onClick: function() { setDetalleVisible(detalleVisible === c.id ? null : c.id); }, style: { ...s.btnInfo, background: '#dbeafe', color: '#1e40af', fontWeight: 600 } }, detalleVisible === c.id ? '🔼 Ocultar' : '👁️ Ver Autoevaluacion') : null, React.createElement('button', { onClick: function() { setFbVis(c); }, style: { ...s.btnInfo, background: '#fef3c7', color: '#92400e' } }, '💬 FB'), React.createElement('button', { onClick: function() { setColSel(c); }, style: s.btnPrimario }, c.evaluacionLider ? '✏️ Editar' : '📝 Evaluar'))), detalleVisible === c.id ? React.createElement(DetalleAutoEvaluacion, { autoevaluacion: c.autoevaluacion }) : null); }))));}

function FeedbackForm({ feedback: col, cicloId, onVolver }) {
  var com = ''; var setCom; var fb = null; var setFb; var carg = true; var setCarg;
  var s1 = useState(''); com = s1[0]; setCom = s1[1]; var s2 = useState(null); fb = s2[0]; setFb = s2[1]; var s3 = useState(true); carg = s3[0]; setCarg = s3[1];
  useEffect(function() { (async function() { var resp = await supabase.auth.getSession(); var resp2 = await supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', col.id).maybeSingle(); if (resp2.data) { setFb(resp2.data); setCom(resp2.data.comentario_lider || ''); } else { await supabase.from('feedback').insert({ ciclo_id: cicloId, lider_id: resp.data.session.user.id, colaborador_id: col.id }); } setCarg(false); })(); }, []);
  async function guardar() { var resp = await supabase.auth.getSession(); await supabase.from('feedback').upsert({ ciclo_id: cicloId, lider_id: resp.data.session.user.id, colaborador_id: col.id, comentario_lider: com, fecha_feedback_lider: new Date() }, { onConflict: 'ciclo_id, colaborador_id' }); alert('✅ Guardado'); onVolver(); }
  if (carg) return React.createElement('p', null, 'Cargando...');
  return React.createElement('div', { style: { maxWidth: 600 } }, React.createElement('button', { onClick: onVolver, style: { ...s.btnInfo, marginBottom: 16 } }, '← Volver'), React.createElement('h3', null, '💬 Feedback: ' + (col.full_name || col.email)), React.createElement('textarea', { value: com, onChange: function(e) { setCom(e.target.value); }, placeholder: 'Deja tu feedback...', style: { ...s.textarea, minHeight: 120, marginBottom: 12 } }), fb && fb.confirmacion_colaborador ? React.createElement('div', { style: { padding: 12, background: '#dcfce7', borderRadius: 8, marginBottom: 16 } }, '✅ Confirmado') : null, React.createElement('button', { onClick: guardar, style: s.btnPrimario }, '💾 Guardar'));
}

function EvaluacionLider({ colaborador, cicloId, onVolver }) {
  var competencias = []; var setComp; var ratings = {}; var setRatings; var comentarios = {}; var setComent; var comFin = ''; var setComFin; var msg = ''; var setMsg; var carg = true; var setCarg; var autoEval = null; var setAutoEval; var evalData = null; var setEvalData; var showInfo = {}; var setShowInfo;
  var s1 = useState([]); competencias = s1[0]; setComp = s1[1]; var s2 = useState({}); ratings = s2[0]; setRatings = s2[1]; var s3 = useState({}); comentarios = s3[0]; setComent = s3[1]; var s4 = useState(''); comFin = s4[0]; setComFin = s4[1]; var s5 = useState(''); msg = s5[0]; setMsg = s5[1]; var s6 = useState(true); carg = s6[0]; setCarg = s6[1]; var s7 = useState(null); autoEval = s7[0]; setAutoEval = s7[1]; var s8 = useState(null); evalData = s8[0]; setEvalData = s8[1]; var s9 = useState({}); showInfo = s9[0]; setShowInfo = s9[1];
  useEffect(function() { (async function() { var resps = await Promise.all([supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', colaborador.seniority || 'Analista'), supabase.auth.getSession()]); setComp(resps[0].data || []); var resp3 = await supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).maybeSingle(); if (resp3.data) { var resp4 = await supabase.from('puntuaciones').select('id, rating, comentario, competencia_id, competencias!inner(nombre)').eq('evaluacion_id', resp3.data.id); setAutoEval({ ...resp3.data, puntuaciones: resp4.data || [] }); } var resp5 = await supabase.from('evaluaciones').select('id, estado, comentarios_finales, rating_promedio').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(); if (resp5.data) { setEvalData(resp5.data); setComFin(resp5.data.comentarios_finales || ''); var resp6 = await supabase.from('puntuaciones').select('rating, competencia_id, comentario').eq('evaluacion_id', resp5.data.id); var rm = {}; var cm = {}; (resp6.data || []).forEach(function(p) { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComent(cm); } else { await supabase.from('evaluaciones').insert({ colaborador_id: colaborador.id, evaluador_id: resps[1].data.session.user.id, tipo_evaluacion: 'evaluacion_lider', estado: 'borrador', ciclo_id: cicloId }); } setCarg(false); })(); }, []);
  async function guardar() { var falt = competencias.filter(function(c) { return !comentarios[c.id] || !comentarios[c.id].trim(); }); if (falt.length > 0) { setMsg('❌ Completa: ' + falt.map(function(c) { return c.nombre; }).join(', ')); setTimeout(function() { setMsg(''); }, 4000); return; } if (!comFin || !comFin.trim()) { setMsg('❌ Comentarios finales obligatorios'); setTimeout(function() { setMsg(''); }, 4000); return; } var resp = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (!resp.data) return; var vals = Object.values(ratings).filter(function(r) { return r > 0; }); var prom = vals.length > 0 ? parseFloat((vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1)) : null; await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', resp.data.id); for (var cid in ratings) { await supabase.from('puntuaciones').upsert({ evaluacion_id: resp.data.id, competencia_id: cid, rating: ratings[cid], comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMsg('✅ Guardado'); setTimeout(function() { setMsg(''); }, 2500); }
  async function enviar() { await guardar(); var resp = await supabase.from('evaluaciones').select('id').eq('colaborador_id', colaborador.id).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).single(); if (resp.data) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', resp.data.id); setMsg('🎉 Enviada'); }
  var calcProm = function() { var v = Object.values(ratings).filter(function(r) { return r > 0; }); return v.length > 0 ? (v.reduce(function(a, b) { return a + b; }, 0) / v.length).toFixed(1) : null; };
  if (carg) return React.createElement('p', null, 'Cargando...'); var enviada = evalData && evalData.estado === 'enviado'; var prom = calcProm();
  return React.createElement('div', { style: { maxWidth: 900 } }, React.createElement('button', { onClick: onVolver, style: { ...s.btnInfo, marginBottom: 16 } }, '← Volver'), React.createElement('h3', null, '📝 Evaluando a: ' + (colaborador.full_name || colaborador.email)), React.createElement('p', null, (colaborador.area || '') + ' · ' + (colaborador.seniority || '')), autoEval && autoEval.estado === 'enviado' ? React.createElement(DetalleAutoEvaluacion, { autoevaluacion: autoEval }) : null, competencias.map(function(comp) { return React.createElement('div', { key: comp.id, style: s.competenciaCard }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, React.createElement('div', null, React.createElement('h5', null, comp.nombre), React.createElement('p', { style: { fontSize: 13, color: '#64748b' } }, comp.descripcion)), React.createElement('button', { onClick: function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }, style: s.btnInfo }, showInfo[comp.id] ? '🔼' : '🔽')), showInfo[comp.id] ? React.createElement('div', { style: { ...s.ratingInfoBox, marginTop: 8 } }, [1, 2, 3, 4, 5].map(function(r) { return React.createElement('div', { key: r, style: s.ratingInfoItem }, React.createElement('strong', null, 'Nivel ' + r + ': '), React.createElement(RatingDesc, { competenciaId: comp.id, rating: r })); })) : null, React.createElement('div', { style: s.ratingRow }, [1, 2, 3, 4, 5].map(function(r) { return React.createElement('button', { key: r, onClick: function() { if (!enviada) setRatings({...ratings, [comp.id]: r}); }, style: { ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', cursor: enviada ? 'not-allowed' : 'pointer' }, disabled: enviada }, r); })), React.createElement('textarea', { value: comentarios[comp.id] || '', onChange: function(e) { setComent({...comentarios, [comp.id]: e.target.value}); }, placeholder: 'Comentario obligatorio', style: { ...s.textareaSmall, borderColor: enviada ? '#D4D2C6' : (comentarios[comp.id] && comentarios[comp.id].trim() ? '#D4D2C6' : '#dc2626') }, disabled: enviada })); }), React.createElement(SeccionText, { titulo: '📝 Comentarios Finales (obligatorio)', valor: comFin, onChange: setComFin, disabled: enviada }), prom ? React.createElement('div', { style: { marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: '2px solid #231F20', textAlign: 'center' } }, React.createElement('p', null, 'Resultado Final'), React.createElement('p', { style: { fontSize: 48, fontWeight: 700, color: '#231F20' } }, prom)) : null, msg ? React.createElement('div', { style: s.mensajeToast }, msg) : null, !enviada ? React.createElement('div', { style: { display: 'flex', gap: 12, marginTop: 20 } }, React.createElement('button', { onClick: guardar, style: s.btnSecundario }, '💾 Guardar'), React.createElement('button', { onClick: enviar, style: s.btnPrimario }, '📤 Enviar')) : null);
}

function PanelColaborador({ userId, seniority, cicloId }) {
  var competencias = []; var setComp; var ratings = {}; var setRatings; var comentarios = {}; var setComent; var comFin = ''; var setComFin; var msg = ''; var setMsg; var carg = true; var setCarg; var evalLider = null; var setEvalLider; var feedback = null; var setFeedback; var evalData = null; var setEvalData; var showInfo = {}; var setShowInfo;
  var s1 = useState([]); competencias = s1[0]; setComp = s1[1]; var s2 = useState({}); ratings = s2[0]; setRatings = s2[1]; var s3 = useState({}); comentarios = s3[0]; setComent = s3[1]; var s4 = useState(''); comFin = s4[0]; setComFin = s4[1]; var s5 = useState(''); msg = s5[0]; setMsg = s5[1]; var s6 = useState(true); carg = s6[0]; setCarg = s6[1]; var s7 = useState(null); evalLider = s7[0]; setEvalLider = s7[1]; var s8 = useState(null); feedback = s8[0]; setFeedback = s8[1]; var s9 = useState(null); evalData = s9[0]; setEvalData = s9[1]; var s10 = useState({}); showInfo = s10[0]; setShowInfo = s10[1];
  useEffect(function() { (async function() { var resps = await Promise.all([supabase.from('competencias').select('id, nombre, descripcion').eq('aplica_a', seniority || 'Analista'), supabase.from('evaluaciones').select('id, estado, rating_promedio, comentarios_finales').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(), supabase.from('evaluaciones').select('id, rating_calibrado, comentario_calibracion').eq('colaborador_id', userId).eq('tipo_evaluacion', 'evaluacion_lider').eq('ciclo_id', cicloId).maybeSingle(), supabase.from('feedback').select('*').eq('ciclo_id', cicloId).eq('colaborador_id', userId).maybeSingle()]); setComp(resps[0].data || []); setEvalLider(resps[2].data); setFeedback(resps[3].data); if (resps[1].data) { setEvalData(resps[1].data); setComFin(resps[1].data.comentarios_finales || ''); var resp5 = await supabase.from('puntuaciones').select('rating, competencia_id, comentario').eq('evaluacion_id', resps[1].data.id); var rm = {}; var cm = {}; (resp5.data || []).forEach(function(p) { rm[p.competencia_id] = p.rating; cm[p.competencia_id] = p.comentario || ''; }); setRatings(rm); setComent(cm); } else { await supabase.from('evaluaciones').insert({ colaborador_id: userId, evaluador_id: userId, tipo_evaluacion: 'autoevaluacion', estado: 'borrador', ciclo_id: cicloId }); } setCarg(false); })(); }, []);
  async function guardar() { var falt = competencias.filter(function(c) { return !comentarios[c.id] || !comentarios[c.id].trim(); }); if (falt.length > 0) { setMsg('❌ Completa: ' + falt.map(function(c) { return c.nombre; }).join(', ')); setTimeout(function() { setMsg(''); }, 4000); return; } if (!comFin || !comFin.trim()) { setMsg('❌ Comentarios finales obligatorios'); setTimeout(function() { setMsg(''); }, 4000); return; } var resp = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (!resp.data) return; var vals = Object.values(ratings).filter(function(r) { return r > 0; }); var prom = vals.length > 0 ? parseFloat((vals.reduce(function(a, b) { return a + b; }, 0) / vals.length).toFixed(1)) : null; await supabase.from('evaluaciones').update({ comentarios_finales: comFin, rating_promedio: prom }).eq('id', resp.data.id); for (var cid in ratings) { await supabase.from('puntuaciones').upsert({ evaluacion_id: resp.data.id, competencia_id: cid, rating: ratings[cid], comentario: comentarios[cid] || '' }, { onConflict: 'evaluacion_id, competencia_id' }); } setMsg('✅ Guardado'); setTimeout(function() { setMsg(''); }, 2500); }
  async function enviar() { await guardar(); var resp = await supabase.from('evaluaciones').select('id').eq('colaborador_id', userId).eq('tipo_evaluacion', 'autoevaluacion').eq('ciclo_id', cicloId).single(); if (resp.data) await supabase.from('evaluaciones').update({ estado: 'enviado' }).eq('id', resp.data.id); setMsg('🎉 Enviada'); }
  async function confirmarFB() { await supabase.from('feedback').update({ confirmacion_colaborador: true, fecha_confirmacion: new Date() }).eq('id', feedback.id); setFeedback({ ...feedback, confirmacion_colaborador: true }); alert('✅ Confirmado'); }
  var calcProm = function() { var v = Object.values(ratings).filter(function(r) { return r > 0; }); return v.length > 0 ? (v.reduce(function(a, b) { return a + b; }, 0) / v.length).toFixed(1) : null; };
  if (carg) return React.createElement('p', null, 'Cargando...'); var enviada = evalData && evalData.estado === 'enviado'; var prom = calcProm();
  return React.createElement('div', { style: { maxWidth: 900 } }, React.createElement('h3', null, '📝 Mi Autoevaluacion'), React.createElement('p', null, 'Seniority: ', React.createElement('strong', null, seniority || 'No definido')), React.createElement('p', null, 'Estado: ', React.createElement('strong', { style: { color: enviada ? '#231F20' : '#f59e0b' } }, enviada ? '✅ Enviada' : '📝 En progreso')), feedback ? React.createElement('div', { style: { padding: 16, background: feedback.confirmacion_colaborador ? '#dcfce7' : '#fef3c7', borderRadius: 10, marginBottom: 20 } }, React.createElement('h4', null, '💬 Feedback'), React.createElement('p', null, feedback.comentario_lider || 'Sin comentarios.'), !feedback.confirmacion_colaborador ? React.createElement('button', { onClick: confirmarFB, style: { ...s.btnPrimario, background: '#22c55e', marginTop: 8, fontSize: 13 } }, '✅ Confirmar') : React.createElement('p', { style: { color: '#166534', marginTop: 8 } }, '✅ Confirmado')) : null, evalLider && evalLider.rating_calibrado ? React.createElement('div', { style: { padding: 16, background: '#D4D2C6', borderRadius: 10, marginBottom: 20, textAlign: 'center' } }, React.createElement('p', null, '🎯 Resultado Final Calibrado'), React.createElement('p', { style: { fontSize: 36, fontWeight: 700 } }, evalLider.rating_calibrado)) : null, competencias.map(function(comp) { return React.createElement('div', { key: comp.id, style: s.competenciaCard }, React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } }, React.createElement('div', null, React.createElement('h5', null, comp.nombre), React.createElement('p', { style: { fontSize: 13, color: '#64748b' } }, comp.descripcion)), React.createElement('button', { onClick: function() { setShowInfo({ ...showInfo, [comp.id]: !showInfo[comp.id] }); }, style: s.btnInfo }, showInfo[comp.id] ? '🔼' : '🔽')), showInfo[comp.id] ? React.createElement('div', { style: { ...s.ratingInfoBox, marginTop: 8 } }, [1, 2, 3, 4, 5].map(function(r) { return React.createElement('div', { key: r, style: s.ratingInfoItem }, React.createElement('strong', null, 'Nivel ' + r + ': '), React.createElement(RatingDesc, { competenciaId: comp.id, rating: r })); })) : null, React.createElement('div', { style: s.ratingRow }, [1, 2, 3, 4, 5].map(function(r) { return React.createElement('button', { key: r, onClick: function() { if (!enviada) setRatings({...ratings, [comp.id]: r}); }, style: { ...s.ratingBtn, backgroundColor: ratings[comp.id] === r ? '#231F20' : '#f1f5f9', color: ratings[comp.id] === r ? 'white' : '#475569', cursor: enviada ? 'not-allowed' : 'pointer' }, disabled: enviada }, r); })), React.createElement('textarea', { value: comentarios[comp.id] || '', onChange: function(e) { setComent({...comentarios, [comp.id]: e.target.value}); }, placeholder: 'Comentario obligatorio', style: { ...s.textareaSmall, borderColor: enviada ? '#D4D2C6' : (comentarios[comp.id] && comentarios[comp.id].trim() ? '#D4D2C6' : '#dc2626') }, disabled: enviada })); }), React.createElement(SeccionText, { titulo: '📝 Comentarios Finales (obligatorio)', valor: comFin, onChange: setComFin, disabled: enviada }), prom ? React.createElement('div', { style: { marginTop: 24, padding: 20, background: 'white', borderRadius: 12, border: '2px solid #231F20', textAlign: 'center' } }, React.createElement('p', null, 'Resultado Final'), React.createElement('p', { style: { fontSize: 48, fontWeight: 700, color: '#231F20' } }, prom)) : null, msg ? React.createElement('div', { style: s.mensajeToast }, msg) : null, !enviada ? React.createElement('div', { style: { display: 'flex', gap: 12, marginTop: 20 } }, React.createElement('button', { onClick: guardar, style: s.btnSecundario }, '💾 Guardar'), React.createElement('button', { onClick: enviar, style: s.btnPrimario }, '📤 Enviar')) : null);
}

function RatingDesc({ competenciaId, rating }) {
  var desc = '...'; var setDesc;
  var s1 = useState('...'); desc = s1[0]; setDesc = s1[1];
  useEffect(function() { (async function() { var resp = await supabase.from('rating_descriptions').select('titulo, descripcion').eq('competencia_id', competenciaId).eq('rating', rating).single(); if (resp.data) setDesc(resp.data.titulo + ': ' + resp.data.descripcion); })(); }, [competenciaId, rating]);
  return React.createElement('span', null, desc);
}

function SeccionText({ titulo, valor, onChange, disabled }) {
  return React.createElement('div', { style: { marginBottom: 24 } }, React.createElement('h4', { style: s.seccionTitulo }, titulo), React.createElement('textarea', { value: valor, onChange: function(e) { onChange(e.target.value); }, style: { ...s.textarea, borderColor: disabled ? '#D4D2C6' : (valor && valor.trim() ? '#D4D2C6' : '#dc2626') }, disabled: disabled }));
}

var th = { textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: '11px' };
var td = { padding: '6px 8px', fontSize: '13px' };
var sidebar = { aside: { width: '260px', background: '#231F20', minHeight: '100vh', display: 'flex', flexDirection: 'column', padding: '20px 0' }, logoContainer: { padding: '0 20px 20px', borderBottom: '1px solid #D4D2C6', marginBottom: 16, textAlign: 'center' }, nav: { display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px', flex: 1 }, menuItem: { padding: '14px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, fontWeight: 500, transition: 'all 0.15s', width: '100%' }, footer: { padding: '16px 20px', borderTop: '1px solid #D4D2C6' } };
var s = { centrado: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 20 }, header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 24px', background: '#231F20' }, badge: { padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: '#D4D2C6', color: '#231F20' }, btnSalir: { padding: '8px 16px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 500, fontSize: 13 }, tarjetaStat: { background: 'white', padding: 20, borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }, grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }, seccionTitulo: { fontSize: 15, fontWeight: 600, color: '#231F20', marginBottom: 10, paddingBottom: 8, borderBottom: '2px solid #D4D2C6' }, competenciaCard: { background: '#f8fafc', padding: 18, borderRadius: 10, marginBottom: 14, border: '1px solid #e2e8f0' }, btnInfo: { fontSize: 12, padding: '5px 12px', borderRadius: 6, border: '1px solid #D4D2C6', background: 'white', cursor: 'pointer', color: '#231F20', fontWeight: 500 }, ratingRow: { display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }, ratingBtn: { width: 42, height: 42, borderRadius: 10, fontSize: 18, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #e2e8f0' }, ratingInfoBox: { background: 'white', padding: 14, borderRadius: 8, marginBottom: 12, border: '1px solid #e2e8f0' }, ratingInfoItem: { padding: '6px 10px', marginBottom: 3, borderRadius: 4, fontSize: 13, color: '#475569', lineHeight: 1.5 }, textareaSmall: { width: '100%', minHeight: 44, padding: 10, borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, textarea: { width: '100%', minHeight: 100, padding: 12, borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 14, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }, btnPrimario: { padding: '12px 24px', background: '#231F20', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, btnSecundario: { padding: '12px 24px', background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }, mensajeToast: { padding: '12px 20px', background: '#D4D2C6', borderRadius: 8, marginBottom: 16, color: '#231F20', fontWeight: 500, fontSize: 14, textAlign: 'center' }, bannerEnviado: { padding: 20, background: '#D4D2C6', borderRadius: 10, color: '#231F20', fontWeight: 600, textAlign: 'center', marginTop: 20 } };
