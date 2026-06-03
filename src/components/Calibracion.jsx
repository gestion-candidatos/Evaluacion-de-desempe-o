import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { jsPDF } from 'jspdf';

function abrirGmail(colaboradorEmail, liderEmail) {
  var to = colaboradorEmail + (liderEmail ? ',' + liderEmail : '');
  var subject = 'Evaluacion de Desempeno - Fabric Group';
  var body = 'Adjunto encontraras el resumen.%0D%0A%0D%0AFabric Group.';
  window.open('https://mail.google.com/mail/?view=cm&fs=1&to=' + to + '&su=' + encodeURIComponent(subject) + '&body=' + body, '_blank');
}

export default function PanelCalibracion({ cicloId, colabs, onHist }) {
  var [datos, setDatos] = useState([]);
  var [carg, setCarg] = useState(true);
  var [filtro, setFiltro] = useState('Todas');

  useEffect(function() { cargar(); }, [cicloId]);

  async function cargar() {
    setCarg(true);
    var resp = await supabase.from('evaluaciones')
      .select('id,colaborador_id,tipo_evaluacion,rating_promedio,rating_calibrado,comentario_calibracion,colaborador:colaborador_id(id,email,full_name,area,seniority)')
      .eq('ciclo_id', cicloId)
      .in('tipo_evaluacion', ['autoevaluacion', 'evaluacion_lider']);
    
    var mapa = {};
    (resp.data || []).forEach(function(ev) {
      if (!ev.colaborador) return;
      if (!mapa[ev.colaborador_id]) {
        mapa[ev.colaborador_id] = {
          colaborador: ev.colaborador,
          promAuto: null, promLider: null,
          ratingFinal: null, comentarioCalibracion: null,
          evaluacionLider: null
        };
      }
      if (ev.tipo_evaluacion === 'autoevaluacion') {
        mapa[ev.colaborador_id].promAuto = ev.rating_promedio;
      }
      if (ev.tipo_evaluacion === 'evaluacion_lider') {
        mapa[ev.colaborador_id].promLider = ev.rating_promedio;
        mapa[ev.colaborador_id].ratingFinal = ev.rating_calibrado;
        mapa[ev.colaborador_id].comentarioCalibracion = ev.comentario_calibracion;
        mapa[ev.colaborador_id].evaluacionLider = ev;
      }
    });

    colabs.forEach(function(c) {
      if (!mapa[c.id]) {
        mapa[c.id] = {
          colaborador: c,
          promAuto: null, promLider: null,
          ratingFinal: null, comentarioCalibracion: null,
          evaluacionLider: null
        };
      }
    });

    setDatos(Object.values(mapa));
    setCarg(false);
  }

  async function guardarCal(evaluacionId, rating, comentario) {
    await supabase.from('evaluaciones')
      .update({ rating_calibrado: rating, comentario_calibracion: comentario })
      .eq('id', evaluacionId);
    setDatos(function(p) {
      return p.map(function(d) {
        if (d.evaluacionLider && d.evaluacionLider.id === evaluacionId) {
          return { ...d, ratingFinal: rating, comentarioCalibracion: comentario };
        }
        return d;
      });
    });
  }

  function clasificar(prom) {
    if (!prom) return { texto: '-', color: '#94a3b8' };
    var p = parseFloat(prom);
    if (p <= 1.4) return { texto: 'No adecuado', color: '#dc2626' };
    if (p <= 2.4) return { texto: 'Por debajo', color: '#f59e0b' };
    if (p <= 3.4) return { texto: 'Cumple', color: '#3b82f6' };
    if (p <= 4.4) return { texto: 'Excede', color: '#22c55e' };
    return { texto: 'Distinguido', color: '#8b5cf6' };
  }

  function generarPDF(d) {
    var pdf = new jsPDF();
    var y = 28;
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('EVALUACION DE DESEMPENO', 15, y);
    y += 7;
    pdf.setFontSize(9);
    pdf.text('Colaborador: ' + (d.colaborador.full_name || d.colaborador.email), 15, y);
    y += 5;
    pdf.text('Area: ' + (d.colaborador.area || '-') + '   Seniority: ' + (d.colaborador.seniority || '-'), 15, y);
    y += 10;
    pdf.setFontSize(12);
    pdf.text('Auto: ' + (d.promAuto || '-') + '   Lider: ' + (d.promLider || '-') + '   Calibrado: ' + (d.ratingFinal || '-'), 15, y + 10);
    if (d.comentarioCalibracion) {
      pdf.setFontSize(8);
      pdf.text('Justificacion: ' + d.comentarioCalibracion, 15, y + 18);
    }
    return pdf;
  }

  function verPDF(d) {
    var n = (d.colaborador.full_name || d.colaborador.email).split(' ').join('_');
    generarPDF(d).save('Evaluacion_' + n + '.pdf');
  }

  function enviarPDF(d) {
    verPDF(d);
    if (d.evaluacionLider && d.evaluacionLider.evaluador_id) {
      supabase.from('profiles').select('email').eq('id', d.evaluacionLider.evaluador_id).single()
        .then(function(res) {
          abrirGmail(d.colaborador.email, res.data ? res.data.email : '');
        });
    } else {
      abrirGmail(d.colaborador.email, '');
    }
  }

  var areas = useMemo(function() {
    return ['Todas'].concat([...new Set(datos.map(function(d) { return d.colaborador.area; }).filter(Boolean))]);
  }, [datos]);

  var df = filtro === 'Todas' ? datos : datos.filter(function(d) { return d.colaborador.area === filtro; });

  if (carg) return <p>Cargando...</p>;

  return (
    <div style={{ background: 'white', padding: 20, borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 style={{ margin: 0, color: '#231F20' }}>Calibracion</h3>
        <select value={filtro} onChange={function(e) { setFiltro(e.target.value); }} 
          style={{ padding: '8px 12px', borderRadius: 6, border: '2px solid #D4D2C6' }}>
          {areas.map(function(a) { return <option key={a} value={a}>{a}</option>; })}
        </select>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: 11 }}>Colaborador</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: 11 }}>Auto</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: 11 }}>Lider</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: 11 }}>GAP</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: 11 }}>Calibrado</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: 11 }}>Justificacion</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: 11 }}>Hist</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: 11 }}>PDF</th>
              <th style={{ textAlign: 'left', padding: '6px 8px', color: '#231F20', fontSize: 11 }}>Enviar</th>
            </tr>
          </thead>
          <tbody>
            {df.map(function(d) {
              var gap = d.promAuto && d.promLider ? (parseFloat(d.promLider) - parseFloat(d.promAuto)).toFixed(1) : null;
              var clasF = clasificar(d.ratingFinal);
              return (
                <tr key={d.colaborador.id}>
                  <td style={{ padding: '6px 8px', fontSize: 13 }}><strong>{d.colaborador.full_name || d.colaborador.email}</strong></td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'center', fontWeight: 700, color: clasificar(d.promAuto).color }}>{d.promAuto || '-'}</td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'center', fontWeight: 700, color: clasificar(d.promLider).color }}>{d.promLider || '-'}</td>
                  <td style={{ padding: '6px 8px', fontSize: 13, textAlign: 'center', fontWeight: 700 }}>{gap || '-'}</td>
                  <td style={{ padding: '6px 8px', fontSize: 13 }}>
                    {d.evaluacionLider ? (
                      <select value={d.ratingFinal || ''} 
                        onChange={function(e) { guardarCal(d.evaluacionLider.id, parseFloat(e.target.value), d.comentarioCalibracion || ''); }}
                        style={{ padding: 4, borderRadius: 6, border: '2px solid ' + clasF.color, fontWeight: 600, color: clasF.color }}>
                        <option value="">-</option>
                        <option value="1">1.0</option><option value="1.5">1.5</option>
                        <option value="2">2.0</option><option value="2.5">2.5</option>
                        <option value="3">3.0</option><option value="3.5">3.5</option>
                        <option value="4">4.0</option><option value="4.5">4.5</option>
                        <option value="5">5.0</option>
                      </select>
                    ) : '-'}
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13 }}>
                    {d.evaluacionLider ? (
                      <input value={d.comentarioCalibracion || ''} 
                        onChange={function(e) { guardarCal(d.evaluacionLider.id, d.ratingFinal || null, e.target.value); }}
                        placeholder="Justificar..." 
                        style={{ width: '100%', padding: 4, borderRadius: 6, border: '1px solid #D4D2C6', fontSize: 11 }} />
                    ) : '-'}
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13 }}>
                    <button onClick={function() { onHist(d.colaborador); }}
                      style={{ background: '#D4D2C6', color: '#231F20', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer' }}>📋</button>
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13 }}>
                    <button onClick={function() { verPDF(d); }}
                      style={{ background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11 }}>PDF</button>
                  </td>
                  <td style={{ padding: '6px 8px', fontSize: 13 }}>
                    {d.ratingFinal ? (
                      <button onClick={function() { enviarPDF(d); }}
                        style={{ background: '#231F20', color: '#D4D2C6', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 600 }}>Enviar</button>
                    ) : '-'}
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
