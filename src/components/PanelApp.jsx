<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard de Capacitaciones</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #f0f2f5;
      padding: 20px;
      color: #333;
    }
    
    .container { max-width: 1400px; margin: 0 auto; }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
      border-radius: 15px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
    }
    
    .header h1 { font-size: 24px; font-weight: 600; }
    
    .header-right { display: flex; gap: 10px; align-items: center; }
    
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
      transition: all 0.3s;
      white-space: nowrap;
    }
    
    .btn-refresh { background: white; color: #667eea; }
    .btn-refresh:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.2); }
    
    .btn-export { background: rgba(255,255,255,0.2); color: white; border: 1px solid rgba(255,255,255,0.3); }
    .btn-export:hover { background: rgba(255,255,255,0.3); }
    
    .filters-container {
      background: white;
      padding: 20px 25px;
      border-radius: 15px;
      margin-bottom: 20px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.1);
      border: 2px solid #e8e8e8;
    }
    
    .filters-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    
    .filters-title {
      font-size: 18px;
      font-weight: 700;
      color: #333;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 15px;
    }
    
    .filter-group { display: flex; flex-direction: column; gap: 4px; }
    
    .filter-group label {
      font-size: 11px;
      font-weight: 700;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }
    
    .filter-select {
      padding: 10px 35px 10px 12px;
      border: 2px solid #ddd;
      border-radius: 8px;
      font-size: 13px;
      background: #fafafa;
      cursor: pointer;
      transition: all 0.3s;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 10px center;
      width: 100%;
      font-weight: 500;
    }
    
    .filter-select:hover { border-color: #667eea; background-color: #f5f7ff; }
    .filter-select:focus { border-color: #667eea; outline: none; box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15); background-color: white; }
    
    .filter-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      padding-top: 10px;
      border-top: 1px solid #f0f0f0;
    }
    
    .btn-filter {
      padding: 10px 20px;
      border-radius: 8px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.3s;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .btn-apply { background: #667eea; color: white; }
    .btn-apply:hover { background: #5a6fd6; transform: translateY(-1px); }
    
    .btn-clear { background: #f5f5f5; color: #666; }
    .btn-clear:hover { background: #e8e8e8; }
    
    .results-badge {
      font-size: 13px;
      color: #667eea;
      padding: 8px 16px;
      background: #f0f2ff;
      border-radius: 20px;
      font-weight: 700;
      border: 2px solid #667eea;
    }
    
    .active-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
    
    .filter-tag {
      background: #667eea;
      color: white;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: fadeIn 0.3s;
      font-weight: 500;
    }
    
    .filter-tag .remove { cursor: pointer; font-weight: bold; font-size: 18px; line-height: 1; opacity: 0.8; }
    .filter-tag .remove:hover { opacity: 1; color: #ffc107; }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }
    
    .kpi-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      border-left: 4px solid #667eea;
      transition: transform 0.3s, box-shadow 0.3s;
    }
    
    .kpi-card:hover { transform: translateY(-3px); box-shadow: 0 5px 20px rgba(0,0,0,0.12); }
    .kpi-card.active { border-left-color: #667eea; }
    .kpi-card.warning { border-left-color: #ffc107; }
    .kpi-card.success { border-left-color: #43e97b; }
    .kpi-card.info { border-left-color: #4facfe; }
    .kpi-card.purple { border-left-color: #764ba2; }
    
    .kpi-label { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; font-weight: 600; margin-bottom: 8px; }
    .kpi-value { font-size: 32px; font-weight: bold; color: #333; }
    
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    
    .chart-card {
      background: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    }
    
    .chart-card.full-width { grid-column: 1 / -1; }
    .chart-card h3 { font-size: 16px; color: #333; margin-bottom: 20px; font-weight: 600; }
    .chart-container { position: relative; height: 300px; width: 100%; }
    .chart-container.large { height: 350px; }
    
    .table-container {
      background: white;
      padding: 25px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      overflow-x: auto;
    }
    
    .table-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    
    thead th {
      background: #f8f9fa;
      padding: 12px 15px;
      text-align: left;
      font-weight: 600;
      color: #555;
      border-bottom: 2px solid #e0e0e0;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      transition: background 0.2s;
    }
    
    thead th:hover { background: #e9ecef; }
    tbody td { padding: 12px 15px; border-bottom: 1px solid #f0f0f0; }
    tbody tr:hover { background: #f8f9ff; }
    
    .progress-bar { background: #e9ecef; border-radius: 10px; height: 22px; overflow: hidden; min-width: 100px; }
    
    .progress-fill {
      height: 100%;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
      transition: width 0.6s ease;
      border-radius: 10px;
    }
    
    .badge {
      padding: 5px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: inline-block;
    }
    
    .badge-success { background: #d4edda; color: #155724; }
    .badge-warning { background: #fff3cd; color: #856404; }
    .badge-danger { background: #f8d7da; color: #721c24; }
    
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    
    @media (max-width: 768px) {
      body { padding: 10px; }
      .header { flex-direction: column; gap: 15px; }
      .charts-grid { grid-template-columns: 1fr; }
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .filters-grid { grid-template-columns: 1fr; }
      .filter-actions { flex-direction: column; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Dashboard de Capacitaciones</h1>
      <div class="header-right">
        <button class="btn btn-export" onclick="exportarDatos()">📥 Exportar CSV</button>
        <button class="btn btn-refresh" onclick="cargarDatos()">🔄 Actualizar</button>
      </div>
    </div>
    
    <div id="errorContainer"></div>
    
    <div id="loadingContainer" style="text-align: center; padding: 60px; background: white; border-radius: 15px; box-shadow: 0 2px 10px rgba(0,0,0,0.08);">
      <div style="border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; width: 50px; height: 50px; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
      <p style="color: #666; font-size: 15px;">Cargando datos del Google Sheet...</p>
    </div>
    
    <div id="mainContent" style="display: none;">
      
      <!-- FILTROS -->
      <div class="filters-container">
        <div class="filters-header">
          <div class="filters-title">
            <span>🔍</span> Filtros de Búsqueda
          </div>
          <div class="results-badge" id="contadorResultados">Mostrando 0 de 0</div>
        </div>
        
        <div class="filters-grid">
          <div class="filter-group">
            <label>🏢 Departamento</label>
            <select class="filter-select" id="filtroDepartamento" onchange="aplicarFiltros()">
              <option value="">Todos los departamentos</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>📚 Tipo de Capacitación</label>
            <select class="filter-select" id="filtroTipo" onchange="aplicarFiltros()">
              <option value="">Todos los tipos</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>📌 Estado</label>
            <select class="filter-select" id="filtroEstado" onchange="aplicarFiltros()">
              <option value="">Todos los estados</option>
              <option value="En curso">🔄 En curso</option>
              <option value="Completada">✅ Completada</option>
              <option value="Pendiente">⏳ Pendiente</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>👤 Empleado</label>
            <select class="filter-select" id="filtroEmpleado" onchange="aplicarFiltros()">
              <option value="">Todos los empleados</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>💼 Puesto</label>
            <select class="filter-select" id="filtroPuesto" onchange="aplicarFiltros()">
              <option value="">Todos los puestos</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>📊 Progreso Mínimo</label>
            <select class="filter-select" id="filtroProgreso" onchange="aplicarFiltros()">
              <option value="">Cualquier progreso</option>
              <option value="0">0% o más</option>
              <option value="25">25% o más</option>
              <option value="50">50% o más</option>
              <option value="75">75% o más</option>
              <option value="100">100% (Completado)</option>
            </select>
          </div>
        </div>
        
        <div class="active-filters" id="filtrosActivos"></div>
        
        <div class="filter-actions">
          <div style="display: flex; gap: 10px;">
            <button class="btn-filter btn-clear" onclick="limpiarFiltros()">✖ Limpiar Todo</button>
          </div>
          <span style="font-size: 12px; color: #999;">💡 Selecciona un filtro para actualizar automáticamente</span>
        </div>
      </div>
      
      <!-- KPIs -->
      <div class="kpi-grid">
        <div class="kpi-card active">
          <div class="kpi-label">📚 Total Capacitaciones</div>
          <div class="kpi-value" id="kpi-total">0</div>
        </div>
        <div class="kpi-card warning">
          <div class="kpi-label">🔄 En Curso</div>
          <div class="kpi-value" id="kpi-activas">0</div>
        </div>
        <div class="kpi-card success">
          <div class="kpi-label">✅ Completadas</div>
          <div class="kpi-value" id="kpi-completadas">0</div>
        </div>
        <div class="kpi-card info">
          <div class="kpi-label">👥 Empleados</div>
          <div class="kpi-value" id="kpi-empleados">0</div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-label">📈 Progreso Promedio</div>
          <div class="kpi-value" id="kpi-progreso">0%</div>
        </div>
      </div>
      
      <!-- GRÁFICOS -->
      <div class="charts-grid">
        <div class="chart-card">
          <h3>🍩 Distribución por Tipo de Capacitación</h3>
          <div class="chart-container"><canvas id="chartTipos"></canvas></div>
        </div>
        
        <div class="chart-card">
          <h3>📊 Progreso Promedio por Tipo</h3>
          <div class="chart-container"><canvas id="chartProgreso"></canvas></div>
        </div>
        
        <div class="chart-card full-width">
          <h3>🏢 Capacitaciones por Departamento y Estado</h3>
          <div class="chart-container large"><canvas id="chartDeptos"></canvas></div>
        </div>
        
        <div class="chart-card full-width">
          <h3>👤 Top 10 Empleados con Más Capacitaciones</h3>
          <div class="chart-container large"><canvas id="chartEmpleados"></canvas></div>
        </div>
      </div>
      
      <!-- TABLA -->
      <div class="table-container">
        <div class="table-header">
          <h3 style="font-size: 16px; font-weight: 600;">📋 Detalle de Capacitaciones</h3>
          <span style="font-size: 13px; color: #666;" id="tablaInfo"></span>
        </div>
        <table>
          <thead>
            <tr>
              <th onclick="ordenarTabla('id')">ID ↕</th>
              <th onclick="ordenarTabla('capacitacion')">Capacitación ↕</th>
              <th onclick="ordenarTabla('tipo')">Tipo ↕</th>
              <th onclick="ordenarTabla('empleado')">Empleado ↕</th>
              <th onclick="ordenarTabla('puesto')">Puesto ↕</th>
              <th onclick="ordenarTabla('departamento')">Departamento ↕</th>
              <th onclick="ordenarTabla('progreso')">Progreso ↕</th>
              <th onclick="ordenarTabla('estado')">Estado ↕</th>
              <th>Fechas</th>
            </tr>
          </thead>
          <tbody id="tablaBody">
            <tr><td colspan="9" style="text-align: center; padding: 30px; color: #999;">Cargando datos...</td></tr>
          </tbody>
        </table>
      </div>
      
    </div>
  </div>
  
  <script>
    let todosLosDatos = [];
    let datosFiltrados = [];
    let graficos = {};
    let ordenActual = { campo: null, ascendente: true };
    
    window.addEventListener('load', cargarDatos);
    
    function cargarDatos() {
      document.getElementById('loadingContainer').style.display = 'block';
      document.getElementById('mainContent').style.display = 'none';
      document.getElementById('errorContainer').innerHTML = '';
      
      google.script.run
        .withSuccessHandler(procesarDatos)
        .withFailureHandler(error => {
          document.getElementById('loadingContainer').style.display = 'none';
          document.getElementById('errorContainer').innerHTML = `
            <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
              <strong>⚠️ Error de conexión:</strong> ${error.message}
              <br><br>
              <button class="btn btn-refresh" onclick="cargarDatos()" style="background: #dc3545; color: white;">🔄 Reintentar</button>
            </div>
          `;
        })
        .obtenerDatosCompletos();
    }
    
    function procesarDatos(response) {
      document.getElementById('loadingContainer').style.display = 'none';
      
      if (!response.success) {
        document.getElementById('errorContainer').innerHTML = `
          <div style="background: #f8d7da; color: #721c24; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <strong>⚠️ Error:</strong> ${response.error}
          </div>
        `;
        return;
      }
      
      document.getElementById('mainContent').style.display = 'block';
      todosLosDatos = response.datos;
      datosFiltrados = [...todosLosDatos];
      
      actualizarKPIs(response.stats);
      llenarFiltros(response.stats);
      destruirGraficos();
      crearGraficos(response);
      aplicarFiltros();
    }
    
    function actualizarKPIs(stats) {
      document.getElementById('kpi-total').textContent = stats.total || 0;
      document.getElementById('kpi-activas').textContent = stats.activas || 0;
      document.getElementById('kpi-completadas').textContent = stats.completadas || 0;
      document.getElementById('kpi-empleados').textContent = stats.empleados || 0;
      document.getElementById('kpi-progreso').textContent = (stats.progresoPromedio || 0) + '%';
    }
    
    function actualizarKPIsFiltrados() {
      const activas = datosFiltrados.filter(d => d.estado === 'En curso').length;
      const completadas = datosFiltrados.filter(d => d.estado === 'Completada').length;
      const empleadosUnicos = new Set(datosFiltrados.map(d => d.empleado)).size;
      const progresoPromedio = datosFiltrados.length > 0 ? 
        Math.round(datosFiltrados.reduce((sum, d) => sum + d.progreso, 0) / datosFiltrados.length) : 0;
      
      document.getElementById('kpi-total').textContent = datosFiltrados.length;
      document.getElementById('kpi-activas').textContent = activas;
      document.getElementById('kpi-completadas').textContent = completadas;
      document.getElementById('kpi-empleados').textContent = empleadosUnicos;
      document.getElementById('kpi-progreso').textContent = progresoPromedio + '%';
    }
    
    function llenarFiltros(stats) {
      const opciones = {
        'filtroDepartamento': stats.departamentos || [],
        'filtroTipo': stats.tipos || [],
        'filtroEmpleado': stats.empleadosLista || [],
        'filtroPuesto': stats.puestos || []
      };
      
      Object.entries(opciones).forEach(([id, items]) => {
        const select = document.getElementById(id);
        if (select && items.length > 0) {
          const valorActual = select.value;
          const textoDefault = select.options[0]?.text || 'Todos';
          select.innerHTML = `<option value="">${textoDefault}</option>`;
          items.forEach(item => {
            select.innerHTML += `<option value="${item}">${item}</option>`;
          });
          select.value = valorActual;
        }
      });
    }
    
    function aplicarFiltros() {
      const filtros = {
        departamento: document.getElementById('filtroDepartamento').value,
        tipo: document.getElementById('filtroTipo').value,
        estado: document.getElementById('filtroEstado').value,
        empleado: document.getElementById('filtroEmpleado').value,
        puesto: document.getElementById('filtroPuesto').value,
        progresoMin: document.getElementById('filtroProgreso').value
      };
      
      datosFiltrados = todosLosDatos.filter(d => {
        return (!filtros.departamento || d.departamento === filtros.departamento) &&
               (!filtros.tipo || d.tipo === filtros.tipo) &&
               (!filtros.estado || d.estado === filtros.estado) &&
               (!filtros.empleado || d.empleado === filtros.empleado) &&
               (!filtros.puesto || d.puesto === filtros.puesto) &&
               (!filtros.progresoMin || d.progreso >= parseInt(filtros.progresoMin));
      });
      
      const filtrosActivos = [];
      if (filtros.departamento) filtrosActivos.push({ label: 'Departamento', value: filtros.departamento });
      if (filtros.tipo) filtrosActivos.push({ label: 'Tipo', value: filtros.tipo });
      if (filtros.estado) filtrosActivos.push({ label: 'Estado', value: filtros.estado });
      if (filtros.empleado) filtrosActivos.push({ label: 'Empleado', value: filtros.empleado });
      if (filtros.puesto) filtrosActivos.push({ label: 'Puesto', value: filtros.puesto });
      if (filtros.progresoMin) filtrosActivos.push({ label: 'Progreso ≥', value: filtros.progresoMin + '%' });
      
      document.getElementById('filtrosActivos').innerHTML = filtrosActivos.map(f => `
        <span class="filter-tag">
          ${f.label}: <strong>${f.value}</strong>
          <span class="remove" onclick="removerFiltro('${f.label}')" title="Quitar filtro">×</span>
        </span>
      `).join('');
      
      document.getElementById('contadorResultados').textContent = `Mostrando ${datosFiltrados.length} de ${todosLosDatos.length}`;
      document.getElementById('tablaInfo').textContent = `${datosFiltrados.length} capacitaciones encontradas`;
      
      actualizarKPIsFiltrados();
      actualizarGraficosFiltrados();
      
      if (ordenActual.campo) {
        ordenarDatos();
      } else {
        mostrarTabla(datosFiltrados);
      }
    }
    
    function removerFiltro(label) {
      const mapa = {
        'Departamento': 'filtroDepartamento',
        'Tipo': 'filtroTipo',
        'Estado': 'filtroEstado',
        'Empleado': 'filtroEmpleado',
        'Puesto': 'filtroPuesto',
        'Progreso ≥': 'filtroProgreso'
      };
      
      const selectId = mapa[label];
      if (selectId) {
        document.getElementById(selectId).value = '';
        aplicarFiltros();
      }
    }
    
    function limpiarFiltros() {
      ['filtroDepartamento', 'filtroTipo', 'filtroEstado', 'filtroEmpleado', 'filtroPuesto', 'filtroProgreso'].forEach(id => {
        document.getElementById(id).value = '';
      });
      aplicarFiltros();
    }
    
    function ordenarTabla(campo) {
      if (ordenActual.campo === campo) {
        ordenActual.ascendente = !ordenActual.ascendente;
      } else {
        ordenActual.campo = campo;
        ordenActual.ascendente = true;
      }
      ordenarDatos();
    }
    
    function ordenarDatos() {
      const datosOrdenados = [...datosFiltrados].sort((a, b) => {
        let valA = a[ordenActual.campo];
        let valB = b[ordenActual.campo];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return ordenActual.ascendente ? -1 : 1;
        if (valA > valB) return ordenActual.ascendente ? 1 : -1;
        return 0;
      });
      mostrarTabla(datosOrdenados);
    }
    
    function mostrarTabla(datos) {
      const tbody = document.getElementById('tablaBody');
      if (datos.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 30px; color: #999;">No se encontraron resultados con los filtros aplicados</td></tr>';
        return;
      }
      
      tbody.innerHTML = datos.map(d => {
        let badgeClass = 'badge-warning';
        if (d.estado === 'Completada') badgeClass = 'badge-success';
        else if (d.estado === 'Pendiente') badgeClass = 'badge-danger';
        const progresoColor = d.progreso >= 80 ? '#43e97b' : d.progreso >= 40 ? '#667eea' : '#fa709a';
        
        return `<tr>
          <td><strong>${d.id}</strong></td>
          <td>${d.capacitacion}</td>
          <td>${d.tipo}</td>
          <td>${d.empleado}</td>
          <td>${d.puesto}</td>
          <td>${d.departamento}</td>
          <td><div class="progress-bar"><div class="progress-fill" style="width: ${d.progreso}%; background: ${progresoColor};">${d.progreso}%</div></div></td>
          <td><span class="badge ${badgeClass}">${d.estado}</span></td>
          <td style="font-size: 11px;">📅 ${d.fechaInicio}<br>📅 ${d.fechaFin}</td>
        </tr>`;
      }).join('');
    }
    
    function actualizarGraficosFiltrados() {
      const porTipo = {};
      const porDepto = {};
      const progresoPorTipo = {};
      const porEmpleado = {};
      
      datosFiltrados.forEach(d => {
        porTipo[d.tipo] = (porTipo[d.tipo] || 0) + 1;
        porEmpleado[d.empleado] = (porEmpleado[d.empleado] || 0) + 1;
        if (!porDepto[d.departamento]) porDepto[d.departamento] = { 'En curso': 0, 'Completada': 0, 'Pendiente': 0 };
        porDepto[d.departamento][d.estado] = (porDepto[d.departamento][d.estado] || 0) + 1;
        if (!progresoPorTipo[d.tipo]) progresoPorTipo[d.tipo] = { total: 0, count: 0 };
        progresoPorTipo[d.tipo].total += d.progreso;
        progresoPorTipo[d.tipo].count++;
      });
      
      if (graficos.tipos) {
        const labels = Object.keys(porTipo);
        graficos.tipos.data.labels = labels.length > 0 ? labels : ['Sin datos'];
        graficos.tipos.data.datasets[0].data = labels.length > 0 ? Object.values(porTipo) : [1];
        graficos.tipos.update();
      }
      
      if (graficos.progreso) {
        const labels = Object.keys(progresoPorTipo);
        const data = labels.map(t => {
          const { total, count } = progresoPorTipo[t];
          return count > 0 ? Math.round(total / count) : 0;
        });
        graficos.progreso.data.labels = labels.length > 0 ? labels : ['Sin datos'];
        graficos.progreso.data.datasets[0].data = data.length > 0 ? data : [0];
        graficos.progreso.data.datasets[0].backgroundColor = data.map(v => v >= 80 ? '#43e97b' : v >= 40 ? '#667eea' : '#fa709a');
        graficos.progreso.update();
      }
      
      if (graficos.deptos) {
        const deptos = Object.keys(porDepto).sort();
        graficos.deptos.data.labels = deptos.length > 0 ? deptos : ['Sin datos'];
        graficos.deptos.data.datasets[0].data = deptos.length > 0 ? deptos.map(d => porDepto[d]['En curso'] || 0) : [0];
        graficos.deptos.data.datasets[1].data = deptos.length > 0 ? deptos.map(d => porDepto[d]['Completada'] || 0) : [0];
        graficos.deptos.data.datasets[2].data = deptos.length > 0 ? deptos.map(d => porDepto[d]['Pendiente'] || 0) : [0];
        graficos.deptos.update();
      }
      
      if (graficos.empleados) {
        const empOrdenados = Object.entries(porEmpleado).sort((a, b) => b[1] - a[1]).slice(0, 10);
        graficos.empleados.data.labels = empOrdenados.length > 0 ? empOrdenados.map(e => e[0]) : ['Sin datos'];
        graficos.empleados.data.datasets[0].data = empOrdenados.length > 0 ? empOrdenados.map(e => e[1]) : [0];
        graficos.empleados.update();
      }
    }
    
    function crearGraficos(response) {
      const { charts } = response;
      
      const ctx1 = document.getElementById('chartTipos')?.getContext('2d');
      if (ctx1 && charts.porTipo) {
        graficos.tipos = new Chart(ctx1, {
          type: 'doughnut',
          data: {
            labels: Object.keys(charts.porTipo),
            datasets: [{ data: Object.values(charts.porTipo), backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'], borderWidth: 3, borderColor: 'white' }]
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 20, font: { size: 12 } } } } }
        });
      }
      
      const ctx2 = document.getElementById('chartProgreso')?.getContext('2d');
      if (ctx2 && charts.progresoPorTipo) {
        const labels = Object.keys(charts.progresoPorTipo);
        const data = labels.map(t => Math.round(charts.progresoPorTipo[t].total / charts.progresoPorTipo[t].count));
        graficos.progreso = new Chart(ctx2, {
          type: 'bar',
          data: {
            labels: labels,
            datasets: [{ label: 'Progreso Promedio %', data: data, backgroundColor: data.map(v => v >= 80 ? '#43e97b' : v >= 40 ? '#667eea' : '#fa709a'), borderRadius: 8 }]
          },
          options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } }, plugins: { legend: { display: false } } }
        });
      }
      
      const ctx3 = document.getElementById('chartDeptos')?.getContext('2d');
      if (ctx3 && charts.porDepartamento) {
        const deptos = Object.keys(charts.porDepartamento).sort();
        graficos.deptos = new Chart(ctx3, {
          type: 'bar',
          data: {
            labels: deptos,
            datasets: [
              { label: 'En Curso', data: deptos.map(d => charts.porDepartamento[d]['En curso'] || 0), backgroundColor: '#667eea', borderRadius: 5 },
              { label: 'Completadas', data: deptos.map(d => charts.porDepartamento[d]['Completada'] || 0), backgroundColor: '#43e97b', borderRadius: 5 },
              { label: 'Pendientes', data: deptos.map(d => charts.porDepartamento[d]['Pendiente'] || 0), backgroundColor: '#fa709a', borderRadius: 5 }
            ]
          },
          options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, ticks: { stepSize: 1 } } }, plugins: { legend: { position: 'bottom', labels: { padding: 20 } } } }
        });
      }
      
      const ctx4 = document.getElementById('chartEmpleados')?.getContext('2d');
      if (ctx4 && charts.porEmpleado) {
        const empOrdenados = Object.entries(charts.porEmpleado).sort((a, b) => b[1] - a[1]).slice(0, 10);
        graficos.empleados = new Chart(ctx4, {
          type: 'bar',
          data: {
            labels: empOrdenados.map(e => e[0]),
            datasets: [{ label: 'Capacitaciones', data: empOrdenados.map(e => e[1]), backgroundColor: '#764ba2', borderRadius: 5 }]
          },
          options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } }
        });
      }
    }
    
    function destruirGraficos() {
      Object.values(graficos).forEach(g => { if (g) g.destroy(); });
      graficos = {};
    }
    
    function exportarDatos() {
      if (datosFiltrados.length === 0) { alert('No hay datos para exportar'); return; }
      let csv = 'ID,Capacitación,Tipo,Empleado,Puesto,Departamento,Estado,Progreso,Fecha Inicio,Fecha Fin\n';
      datosFiltrados.forEach(d => {
        csv += `"${d.id}","${d.capacitacion}","${d.tipo}","${d.empleado}","${d.puesto}","${d.departamento}","${d.estado}","${d.progreso}%","${d.fechaInicio}","${d.fechaFin}"\n`;
      });
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `capacitaciones_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    
    setInterval(cargarDatos, 300000);
  </script>
</body>
</html>
