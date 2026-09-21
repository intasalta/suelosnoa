/**
 * ============================================================================
 * Atlas Digital de Suelos del NOA (Salta & Jujuy) - INTA / UNSa
 * Motor JavaScript Moderno para Dashboard Cartográfico e Interactivo
 * ============================================================================
 */

(function() {
  'use strict';

  // --- Estado Global de la Aplicación ---
  const state = {
    geoData: null,
    dbData: null,
    map: null,
    geojsonLayer: null,
    selectedFeature: null,
    activeThematic: 'grupo_tier', // 'grupo_tier' | 'usda_orden' | 'clas_fao' | 'reg_geo' | 'transparente'
    currentBasemap: 'esri_sat',
    basemaps: {},
    activeFilters: {
      usda: 'ALL',
      grupo: 'ALL',
      region: 'ALL'
    },
    charts: {
      usdaDist: null,
      grupoDist: null,
      labPhMo: null,
      labTextura: null,
      labCic: null
    }
  };

  // --- Paletas de Colores Edafológicas ---
  const colorPalettes = {
    grupo_tier: {
      'A': '#16a34a',
      'B': '#65a30d',
      'C': '#eab308',
      'D': '#ea580c',
      'E': '#dc2626',
      'D-E': '#b91c1c',
      'C-D': '#d97706',
      'B-C': '#84cc16',
      'default': '#64748b'
    },
    usda_orden: {
      'Molisol': '#22c55e',
      'Entisol': '#f59e0b',
      'Inceptisol': '#10b981',
      'Alfisol': '#3b82f6',
      'Aridisol': '#ea580c',
      'default': '#94a3b8'
    },
    clas_fao: {
      'Litosol': '#ef4444',
      'Cambisol': '#10b981',
      'Fluvisol': '#06b6d4',
      'Regosol': '#f59e0b',
      'Phaeozem': '#22c55e',
      'Luvisol': '#3b82f6',
      'Kastanozem': '#84cc16',
      'Solonetz': '#8b5cf6',
      'Planosol': '#ec4899',
      'default': '#64748b'
    },
    reg_geo: {
      'Puna': '#f97316',
      'Cordillera Oriental': '#a855f7',
      'Area montañosa y Valles Intermontanos': '#3b82f6',
      'Sierras Subandinas': '#10b981',
      'Llanura Chaco-Pampeana': '#eab308',
      'Llanura Chaqueña': '#eab308',
      'default': '#64748b'
    },
    water: '#0284c7'
  };

  // --- Inicialización Principal ---
  document.addEventListener('DOMContentLoaded', async () => {
    initLucide();
    initMap();
    setupEventListeners();
    await loadData();
    initFiltersAndCharts();
  });

  function initLucide() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // --- Inicialización de Leaflet ---
  function initMap() {
    // Coordenadas centrales de Salta y Jujuy
    const defaultCenter = [-24.5, -65.2];
    const defaultZoom = 7;

    state.map = L.map('map', {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      attributionControl: false
    });

    // Control de zoom en esquina inferior derecha
    L.control.zoom({ position: 'bottomright' }).addTo(state.map);

    // Escala métrica gráfica en esquina inferior izquierda
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(state.map);

    // Mapas Base 100% Libres de API Key (Satelital, Topográfico y OpenStreetMap)
    state.basemaps = {
      esri_sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
      }),
      esri_topo: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19
      }),
      osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      })
    };

    // Agregar mapa satelital por defecto
    state.basemaps.esri_sat.addTo(state.map);
  }

  // --- Carga Asíncrona de GeoJSON y Base de Datos ---
  async function loadData() {
    try {
      showLoading(true);
      const [geoRes, dbRes] = await Promise.all([
        fetch('data/suelos_geo.json'),
        fetch('data/suelos_db.json')
      ]);

      state.geoData = await geoRes.json();
      state.dbData = await dbRes.json();

      // Renderizar polígonos
      renderGeojsonLayer();

      // Actualizar contadores
      document.getElementById('totalPolygons').textContent = state.geoData.features.length;
      document.getElementById('totalUnits').textContent = Object.keys(state.dbData).length;

      // Actualizar Leyenda
      updateLegend();

      showLoading(false);
    } catch (err) {
      console.error('Error cargando los datos edafológicos:', err);
      showLoading(false);
      alert('Ocurrió un error al cargar los datos. Verifique que la carpeta data/ contenga los archivos generados.');
    }
  }

  // --- Renderizado y Estilo de la Capa GeoJSON ---
  function renderGeojsonLayer() {
    if (state.geojsonLayer) {
      state.map.removeLayer(state.geojsonLayer);
    }

    state.geojsonLayer = L.geoJSON(state.geoData, {
      filter: filterFeature,
      style: featureStyle,
      onEachFeature: (feature, layer) => {
        // Tooltip interactivo al pasar el mouse
        const p = feature.properties;
        const tooltipContent = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem; line-height: 1.4;">
            <strong style="color: #38bdf8;">${p.nom_aso || p.nomencla}</strong>
            ${p.nomencla ? `<span style="background: rgba(255,255,255,0.15); padding: 1px 4px; border-radius: 3px; font-size: 0.7rem; margin-left: 4px;">${p.nomencla}</span>` : ''}
            <div style="color: #cbd5e1; font-size: 0.72rem; margin-top: 2px;">
              ${p.is_water ? 'Cuerpo de Agua / Salar' : `Orden: ${p.usda_orden || 'S/D'} • Grupo: ${p.grupo_tier || 'S/D'}`}
            </div>
            <div style="color: #94a3b8; font-size: 0.7rem;">
              Superficie: <strong>${p.area_km2.toLocaleString()} km²</strong> (${p.area_ha.toLocaleString()} ha)
            </div>
          </div>
        `;
        layer.bindTooltip(tooltipContent, { sticky: true, className: 'leaflet-soil-tooltip' });

        layer.on({
          mouseover: (e) => {
            const l = e.target;
            if (state.selectedFeature !== feature) {
              // Solo resalta los límites del polígono sin alterar el relleno
              l.setStyle({
                weight: 2.8,
                color: '#38bdf8'
              });
              l.bringToFront();
            }
          },
          mouseout: (e) => {
            const l = e.target;
            if (state.selectedFeature !== feature) {
              state.geojsonLayer.resetStyle(l);
            }
          },
          click: (e) => {
            selectFeature(feature, e.target);
          }
        });
      }
    }).addTo(state.map);

    // Ajustar vista a los datos si es la primera carga
    if (!state.selectedFeature && state.geojsonLayer.getLayers().length > 0) {
      state.map.fitBounds(state.geojsonLayer.getBounds(), { padding: [20, 20] });
    }
  }

  // --- Filtro de Características ---
  function filterFeature(feature) {
    const p = feature.properties;
    if (state.activeFilters.usda !== 'ALL') {
      if (p.usda_orden !== state.activeFilters.usda) return false;
    }
    if (state.activeFilters.grupo !== 'ALL') {
      if (p.grupo_tier !== state.activeFilters.grupo) return false;
    }
    if (state.activeFilters.region !== 'ALL') {
      if (p.reg_geo !== state.activeFilters.region) return false;
    }
    return true;
  }

  // --- Función de Estilizado Dinámico ---
  function featureStyle(feature) {
    const p = feature.properties;
    const isSelected = state.selectedFeature === feature;

    // Modo Transparente: solo límites de polígonos visibles sobre el mapa base
    if (state.activeThematic === 'transparente') {
      if (p.is_water) {
        return {
          fillColor: '#0284c7',
          fillOpacity: 0.2,
          color: '#38bdf8',
          weight: 1.5,
          dashArray: '3, 3'
        };
      }
      return {
        fillColor: '#ffffff',
        fillOpacity: 0.001, // Transparente a la vista pero interactivo al clic
        color: isSelected ? '#ffffff' : '#38bdf8',
        weight: isSelected ? 3.5 : 1.4,
        dashArray: ''
      };
    }

    if (p.is_water) {
      return {
        fillColor: colorPalettes.water,
        fillOpacity: 0.65,
        color: '#0369a1',
        weight: 1,
        dashArray: '2, 2'
      };
    }

    const color = getFeatureColor(p, state.activeThematic);

    return {
      fillColor: color,
      fillOpacity: isSelected ? 0.9 : 0.65,
      color: isSelected ? '#ffffff' : '#0f172a',
      weight: isSelected ? 3 : 0.8,
      dashArray: ''
    };
  }

  function getFeatureColor(props, thematicKey) {
    if (props.is_water) return colorPalettes.water;
    const pal = colorPalettes[thematicKey] || colorPalettes.grupo_tier;
    const val = props[thematicKey] || '';

    // Coincidencia exacta
    if (pal[val]) return pal[val];

    // Coincidencias por prefijo (ej: "Molisoles" -> "Molisol", "Grupo C" -> "C")
    for (const [k, color] of Object.entries(pal)) {
      if (k !== 'default' && val.toLowerCase().includes(k.toLowerCase())) {
        return color;
      }
    }
    return pal.default;
  }

  // --- Selección de Polígono e Inspección ("Cajitas cosas lindas") ---
  function selectFeature(feature, layer) {
    state.selectedFeature = feature;
    const p = feature.properties;

    // Resetear estilos anteriores y destacar seleccionado
    state.geojsonLayer.eachLayer(l => state.geojsonLayer.resetStyle(l));
    if (layer) {
      layer.setStyle({
        weight: 3.5,
        color: '#ffffff'
      });
      layer.bringToFront();
      state.map.flyToBounds(layer.getBounds(), { padding: [60, 60], maxZoom: 11, duration: 0.8 });
    }

    // Cargar datos correspondientes de suelos_db
    const pdfId = p.pdf_id;
    const dbItem = pdfId && state.dbData[pdfId] ? state.dbData[pdfId] : null;

    populateDetailDrawer(p, dbItem);
    openDetailDrawer(true);
  }

  // --- Llenado de las Tarjetas ("Cajitas") de Detalle ---
  function populateDetailDrawer(props, db) {
    state.currentProps = props;
    state.currentDbItem = db;
    state.selectedSoilIndex = 0;

    // Encabezado
    const code = props.nomencla || (db ? db.nomencla : '--');
    const name = props.nom_aso || (db ? db.asociacion : 'Cuerpo de Agua / Sin Datos');
    const group = props.grupo_tier || (db ? db.grupo_tierra : 'S/D');
    const region = props.reg_geo || (db ? db.region_geografica : 'Noroeste Argentino');

    document.getElementById('detBadgeCode').textContent = code;
    document.getElementById('detBadgeGroup').textContent = `Grupo ${group}`;
    document.getElementById('detBadgeGroup').className = `badge-group ${group.replace(/[^A-Za-z]/g, '')}`;
    document.getElementById('detBadgeRegion').textContent = region;
    document.getElementById('detTitle').textContent = name;

    // Pestaña 1: Visión General
    document.getElementById('detAreaKm').textContent = `${props.area_km2.toLocaleString()} km²`;
    document.getElementById('detAreaHa').textContent = `${props.area_ha.toLocaleString()} ha`;
    document.getElementById('detCuenca').textContent = props.subcuenca || (db ? db.subcuenca : 'S/D');
    document.getElementById('detOrdenTaxo').textContent = props.usda_orden || 'S/D';

    document.getElementById('detUbicacion').textContent = (db && db.ubicacion) ? db.ubicacion : 'Ubicación delimitada según relevamiento cartográfico de Salta y Jujuy.';
    document.getElementById('detFisiografia').textContent = (db && db.fisiografia) ? db.fisiografia : (props.fisiografi || 'S/D');
    document.getElementById('detRelieve').textContent = (db && db.relieve) ? db.relieve : (props.relieve || 'S/D');

    document.getElementById('detTemperatura').textContent = (db && db.temperatura) ? db.temperatura : 'Varía con la altitud';
    document.getElementById('detPrecipitacion').textContent = (db && db.precipitacion) ? db.precipitacion : 'Régimen monzónico NOA';
    document.getElementById('detVegetacion').textContent = (db && db.vegetacion) ? db.vegetacion : (props.vegetac || 'Vegetación nativa de la ecorregión.');
    document.getElementById('detMaterial').textContent = (db && db.material_original) ? db.material_original : (props.materiao || 'Depósitos aluviales, coluviales y rocas sedimentarias.');

    // Pestaña 2: Aptitud & Capacidad
    populateAptitudTab(group, db);

    // Barra de Selección de Suelos Componentes
    setupSoilSelectorBar(db);

    // Actualizar datos del suelo activo en pestañas 3, 4 y 5
    updateActiveSoilView(db);
  }

  function setupSoilSelectorBar(db) {
    const selectorBar = document.getElementById('detailSoilSelectorBar');
    const pillsWrap = document.getElementById('detailSoilPills');
    pillsWrap.innerHTML = '';

    if (!db || !db.suelos_asociados || db.suelos_asociados.length === 0) {
      selectorBar.style.display = 'none';
      return;
    }

    selectorBar.style.display = 'flex';
    db.suelos_asociados.forEach((soil, idx) => {
      const pill = document.createElement('button');
      pill.className = `soil-bar-pill ${idx === state.selectedSoilIndex ? 'active' : ''}`;
      pill.innerHTML = `
        <span>${soil.nombre}</span>
        <small style="opacity: 0.7; font-size: 0.68rem;">(${soil.dominancia || 'Suelo'})</small>
      `;
      pill.addEventListener('click', () => {
        state.selectedSoilIndex = idx;
        pillsWrap.querySelectorAll('.soil-bar-pill').forEach((p, i) => {
          p.classList.toggle('active', i === idx);
        });
        updateActiveSoilView(db);
      });
      pillsWrap.appendChild(pill);
    });
  }

  function updateActiveSoilView(db) {
    if (!db || !db.suelos_asociados || db.suelos_asociados.length === 0) {
      populatePerfilModalTab(null);
      populateLaboratorioTab(null);
      return;
    }

    const currentSoil = db.suelos_asociados[state.selectedSoilIndex] || db.suelos_asociados[0];

    // Actualizar Pestaña 3: Suelos Asociados
    populateSuelosAsociadosTab(db);

    // Actualizar Pestaña 4: Perfil de Horizontes
    populatePerfilModalTab(currentSoil);

    // Actualizar Pestaña 5: Laboratorio Analítico
    populateLaboratorioTab(currentSoil);
  }

  function populateAptitudTab(group, db) {
    const banner = document.getElementById('detSuitabilityBanner');
    const icon = document.getElementById('detSuitabilityIcon');
    const title = document.getElementById('detSuitabilityTitle');
    const subtitle = document.getElementById('detSuitabilitySubtitle');

    const cleanG = group.charAt(0).toUpperCase();
    banner.className = `suitability-banner ${cleanG}`;
    icon.textContent = group;

    const groupDescriptions = {
      'A': { title: 'Tierras de Muy Alta Aptitud Agrícola', sub: 'Suelos profundos, fértiles y sin limitaciones severas para agricultura continua intensiva.' },
      'B': { title: 'Tierras de Alta Aptitud Agrícola', sub: 'Aptas para cultivos con prácticas moderadas de conservación de suelo y agua.' },
      'C': { title: 'Tierras de Aptitud Agrícola Moderada', sub: 'Limitaciones moderadas por relieve, textura o drenaje; requieren prácticas constantes de manejo.' },
      'D': { title: 'Tierras de Aptitud Ganadera y Forestal', sub: 'No aptas para agricultura continua. Destino recomendado: pastoreo planificado y silvicultura.' },
      'E': { title: 'Tierras de Protección y Reserva', sub: 'Severas limitaciones por pendiente, pedregosidad o clima árido; exclusivas de conservación.' }
    };

    const desc = groupDescriptions[cleanG] || { title: `Grupo ${group}`, sub: 'Evaluación de capacidad agronómica según estudio INTA.' };
    title.textContent = desc.title;
    subtitle.textContent = desc.sub;

    document.getElementById('detGrupoDesc').textContent = (db && db.grupo_tierra_desc) ? db.grupo_tierra_desc : desc.sub;

    // Listado de clases de capacidad de uso
    const clasesList = document.getElementById('detClasesList');
    clasesList.innerHTML = '';

    if (db && db.suelos_asociados) {
      db.suelos_asociados.forEach(s => {
        if (s.clase_capacidad) {
          const item = document.createElement('div');
          item.className = 'mini-metric-item';
          item.style.padding = '0.65rem 0.85rem';
          item.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
              <strong style="color: var(--accent); font-size: 0.85rem;">Suelo ${s.nombre} (${s.dominancia || 'Componente'})</strong>
              <span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 700; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem;">Clase ${s.clase_capacidad}</span>
            </div>
            <div style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.4;">${s.clase_capacidad_desc || s.limitaciones || 'Sin descripción adicional.'}</div>
          `;
          clasesList.appendChild(item);
        }
      });
    }

    if (clasesList.children.length === 0) {
      clasesList.innerHTML = '<p class="cajita-text" style="color: var(--text-muted);">No se especificaron sub-clases individuales para esta unidad.</p>';
    }
  }

  function populateSuelosAsociadosTab(db) {
    const subselector = document.getElementById('soilSubselector');
    subselector.innerHTML = '';

    if (!db || !db.suelos_asociados || db.suelos_asociados.length === 0) {
      subselector.innerHTML = '<p class="cajita-text">Sin suelos individuales desglosados.</p>';
      return;
    }

    db.suelos_asociados.forEach((soil, idx) => {
      const btn = document.createElement('button');
      btn.className = `soil-sub-btn ${idx === 0 ? 'active' : ''}`;
      btn.innerHTML = `<i data-lucide="${idx === 0 ? 'star' : 'circle-dot'}"></i> ${soil.nombre}`;
      btn.addEventListener('click', () => {
        document.querySelectorAll('.soil-sub-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        showSoilCard(soil);
      });
      subselector.appendChild(btn);
    });

    // Mostrar el primer suelo
    showSoilCard(db.suelos_asociados[0]);
    initLucide();
  }

  function showSoilCard(soil) {
    document.getElementById('selectedSoilTitle').innerHTML = `
      <i data-lucide="disc"></i> Suelo ${soil.nombre} ${soil.nomencla ? `(${soil.nomencla})` : ''} 
      <span style="font-size: 0.7rem; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; margin-left: auto;">${soil.dominancia || 'Componente'}</span>
    `;
    document.getElementById('selectedSoilUsda').textContent = soil.usda || 'No clasificado';
    document.getElementById('selectedSoilFao').textContent = soil.fao || 'No clasificado';
    document.getElementById('selectedSoilCaract').textContent = soil.caracteristica || 'Desarrollo edáfico de acuerdo a las condiciones fisiográficas locales.';
    document.getElementById('selectedSoilLimit').textContent = soil.limitaciones || 'Sin limitaciones críticas registradas.';
    document.getElementById('selectedSoilClase').textContent = soil.clase_capacidad ? `Clase ${soil.clase_capacidad}: ${soil.clase_capacidad_desc}` : 'S/D';
    initLucide();
  }

  // --- Perfil Gráfico de Horizontes a Escala ---
  function populatePerfilModalTab(soilOrDb) {
    const layersWrap = document.getElementById('horizonLayersWrap');
    const detailCard = document.getElementById('horizonModalDetailCard');
    const detailTitle = document.getElementById('horizonDetailTitle');
    const detailText = document.getElementById('horizonDetailText');
    layersWrap.innerHTML = '';
    detailCard.style.display = 'none';

    let horizons = [];
    let soilName = 'Componente';

    if (soilOrDb) {
      if (soilOrDb.perfil_modal) {
        horizons = soilOrDb.perfil_modal;
        soilName = soilOrDb.nombre || 'Componente';
      } else if (soilOrDb.suelos_asociados) {
        for (const s of soilOrDb.suelos_asociados) {
          if (s.perfil_modal && s.perfil_modal.length > 0) {
            horizons = s.perfil_modal;
            soilName = s.nombre;
            break;
          }
        }
      }
    }

    if (horizons.length === 0) {
      layersWrap.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--text-muted); font-size: 0.85rem;">
          <i data-lucide="info" style="margin-bottom: 0.5rem;"></i>
          <p>El suelo <strong>${soilName}</strong> no cuenta con horizontes modales discriminados numéricamente en la campaña.</p>
        </div>
      `;
      initLucide();
      return;
    }

    // Calcular altura total del perfil
    const maxDepth = Math.max(...horizons.map(h => h.bottom_cm || 100), 100);

    horizons.forEach(h => {
      const top = h.top_cm || 0;
      const bottom = h.bottom_cm || (top + 25);
      const thickness = Math.max(bottom - top, 15);
      // Proporción de altura mínima
      const heightPercent = Math.max((thickness / maxDepth) * 100, 16);

      // Determinar clase de color según letra del horizonte
      const hChar = h.horizonte.charAt(0).toUpperCase();
      let layerClass = 'soil-layer-A';
      if (hChar === 'E') layerClass = 'soil-layer-E';
      else if (hChar === 'B') layerClass = 'soil-layer-B';
      else if (hChar === 'C') layerClass = 'soil-layer-C';
      else if (hChar === 'R') layerClass = 'soil-layer-R';

      const layerDiv = document.createElement('div');
      layerDiv.className = `horizon-layer-card ${layerClass}`;
      layerDiv.style.minHeight = `${Math.round(heightPercent * 2.5)}px`;
      layerDiv.innerHTML = `
        <div class="horizon-top-row">
          <span class="horizon-badge">${h.horizonte}</span>
          <span class="horizon-depth-label">${h.profundidad}</span>
        </div>
        <div class="horizon-brief-desc">${h.descripcion || 'Sin descripción morfométrica.'}</div>
      `;

      layerDiv.addEventListener('click', () => {
        detailCard.style.display = 'block';
        detailTitle.innerHTML = `<i data-lucide="eye"></i> Horizonte ${h.horizonte} (${h.profundidad}) - Suelo ${soilName}`;
        detailText.textContent = h.descripcion || 'Descripción no disponible.';
        initLucide();
      });

      layersWrap.appendChild(layerDiv);
    });

    initLucide();
  }

  // --- Laboratorio Físico-Químico y Gráficos ---
  function populateLaboratorioTab(soilOrDb) {
    const noLabAlert = document.getElementById('noLabAlert');
    const labContent = document.getElementById('labContentWrap');

    let labData = null;
    let soilName = 'este suelo';

    if (soilOrDb) {
      if (soilOrDb.laboratorio) {
        labData = soilOrDb.laboratorio;
        soilName = soilOrDb.nombre || 'este suelo';
      } else if (soilOrDb.suelos_asociados) {
        for (const s of soilOrDb.suelos_asociados) {
          if (s.laboratorio && s.laboratorio.horizontes) {
            labData = s.laboratorio;
            soilName = s.nombre;
            break;
          }
        }
      }
    }

    if (!labData) {
      noLabAlert.style.display = 'block';
      noLabAlert.querySelector('.cajita-text').textContent = `El suelo ${soilName} no presenta determinaciones analíticas de laboratorio en la campaña original (fue correlacionado morfológicamente por perfil de campo). Si la asociación cuenta con otros suelos, selecciónelos en la barra superior.`;
      labContent.style.display = 'none';
      return;
    }

    noLabAlert.style.display = 'none';
    labContent.style.display = 'block';

    const horizons = labData.horizontes;
    const filas = labData.filas || {};

    // 1. Gráfico pH y MO %
    renderChartPhMo(horizons, filas);

    // 2. Gráfico Textura %
    renderChartTextura(horizons, filas);

    // 3. Gráfico CIC y Cationes
    renderChartCic(horizons, filas);

    // 4. Tabla Completa
    renderLabTable(horizons, filas);
  }

  function parseNumbers(arr) {
    if (!arr) return [];
    return arr.map(v => {
      if (!v) return null;
      const clean = v.replace(',', '.').replace(/[^0-9\.\-]/g, '');
      const num = parseFloat(clean);
      return isNaN(num) ? null : num;
    });
  }

  function renderChartPhMo(horizons, filas) {
    const ctx = document.getElementById('chartLabPhMo').getContext('2d');
    if (state.charts.labPhMo) state.charts.labPhMo.destroy();

    const phVals = parseNumbers(filas.ph_pasta || filas.ph_agua);
    const moVals = parseNumbers(filas.materia_organica);

    state.charts.labPhMo = new Chart(ctx, {
      type: 'line',
      data: {
        labels: horizons,
        datasets: [
          {
            label: 'pH (pasta saturación)',
            data: phVals,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            borderWidth: 2.5,
            yAxisID: 'yPh',
            tension: 0.3,
            fill: true
          },
          {
            label: 'Materia Orgánica (%)',
            data: moVals,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            borderWidth: 2.5,
            yAxisID: 'yMo',
            tension: 0.3,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          yPh: {
            type: 'linear',
            position: 'left',
            min: 4,
            max: 9,
            ticks: { color: '#38bdf8' },
            grid: { color: 'rgba(255,255,255,0.05)' }
          },
          yMo: {
            type: 'linear',
            position: 'right',
            min: 0,
            ticks: { color: '#10b981' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  function renderChartTextura(horizons, filas) {
    const ctx = document.getElementById('chartLabTextura').getContext('2d');
    if (state.charts.labTextura) state.charts.labTextura.destroy();

    const arena = parseNumbers(filas.arena);
    const limo = parseNumbers(filas.limo);
    const arcilla = parseNumbers(filas.arcilla);

    state.charts.labTextura = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: horizons,
        datasets: [
          { label: 'Arena (%)', data: arena, backgroundColor: '#f59e0b' },
          { label: 'Limo (%)', data: limo, backgroundColor: '#94a3b8' },
          { label: 'Arcilla (%)', data: arcilla, backgroundColor: '#ea580c' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 11 } } }
        },
        scales: {
          x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { stacked: true, max: 100, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  function renderChartCic(horizons, filas) {
    const ctx = document.getElementById('chartLabCic').getContext('2d');
    if (state.charts.labCic) state.charts.labCic.destroy();

    const cic = parseNumbers(filas.cic);
    const ca = parseNumbers(filas.calcio);
    const mg = parseNumbers(filas.magnesio);
    const na = parseNumbers(filas.sodio);
    const k = parseNumbers(filas.potasio);

    state.charts.labCic = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: horizons,
        datasets: [
          { label: 'CIC (meq/100g)', data: cic, backgroundColor: '#6366f1' },
          { label: 'Ca++', data: ca, backgroundColor: '#3b82f6' },
          { label: 'Mg++', data: mg, backgroundColor: '#06b6d4' },
          { label: 'Na+', data: na, backgroundColor: '#f43f5e' },
          { label: 'K+', data: k, backgroundColor: '#eab308' }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#94a3b8', font: { size: 10 } } }
        },
        scales: {
          x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  function renderLabTable(horizons, filas) {
    const table = document.getElementById('labFullTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    thead.innerHTML = `
      <tr>
        <th>Determinación Físico-Química</th>
        ${horizons.map(h => `<th>${h}</th>`).join('')}
      </tr>
    `;

    const friendlyNames = {
      profundidad: 'Profundidad (cm)',
      ph_pasta: 'pH (pasta saturación)',
      ph_agua: 'pH (en agua 1:2.5)',
      resistencia_electrica: 'Resistencia Eléctrica (ohm/cm)',
      conductividad_electrica: 'Conductividad Eléc. (mmhos/cm)',
      co3ca: 'Carbonato de Calcio CO3Ca (%)',
      carbono_organico: 'Carbono Orgánico (%)',
      nitrogeno_total: 'Nitrógeno Total (%)',
      relacion_cn: 'Relación C / N',
      materia_organica: 'Materia Orgánica (%)',
      textura_clase: 'Clase Textural',
      arena: 'Arena (%)',
      limo: 'Limo (%)',
      arcilla: 'Arcilla (%)',
      cic: 'CIC (meq/100g)',
      calcio: 'Calcio Ca++ (meq/100g)',
      magnesio: 'Magnesio Mg++ (meq/100g)',
      sodio: 'Sodio Na+ (meq/100g)',
      potasio: 'Potasio K+ (meq/100g)',
      saturacion_bases: 'Saturación de Bases (%)',
      psi: 'PSI (% Sodio Intercambiable)'
    };

    tbody.innerHTML = '';
    for (const [key, label] of Object.entries(friendlyNames)) {
      if (filas[key]) {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td class="metric-name">${label}</td>
          ${filas[key].map(v => `<td>${v || '--'}</td>`).join('')}
        `;
        tbody.appendChild(row);
      }
    }
  }

  // --- Actualización de la Leyenda Flotante ---
  function updateLegend() {
    const titleEl = document.getElementById('legendTitle');
    const itemsEl = document.getElementById('legendItems');

    const titles = {
      grupo_tier: 'Grupo de la Tierra (Aptitud)',
      usda_orden: 'Orden Taxonómico USDA',
      clas_fao: 'Clasificación FAO',
      reg_geo: 'Región Geográfica',
      transparente: 'Solo Límites (Transparente)'
    };
    titleEl.textContent = titles[state.activeThematic] || 'Leyenda';
    itemsEl.innerHTML = '';

    if (state.activeThematic === 'transparente') {
      const item1 = document.createElement('div');
      item1.className = 'legend-item';
      item1.innerHTML = `
        <span class="legend-color" style="background-color: transparent; border: 2px solid #38bdf8;"></span>
        <span>Límites de Suelos (Cian)</span>
      `;
      itemsEl.appendChild(item1);

      const item2 = document.createElement('div');
      item2.className = 'legend-item';
      item2.innerHTML = `
        <span class="legend-color" style="background-color: transparent; border: 3px solid #ffffff;"></span>
        <span>Polígono Seleccionado (Blanco)</span>
      `;
      itemsEl.appendChild(item2);

      const item3 = document.createElement('div');
      item3.className = 'legend-item';
      item3.innerHTML = `
        <span class="legend-color" style="background-color: rgba(2,132,199,0.25); border: 1.5px dashed #38bdf8;"></span>
        <span>Salares y Cuerpos de Agua</span>
      `;
      itemsEl.appendChild(item3);
      return;
    }

    const pal = colorPalettes[state.activeThematic] || {};

    for (const [name, color] of Object.entries(pal)) {
      if (name === 'default') continue;
      const item = document.createElement('div');
      item.className = 'legend-item';
      item.innerHTML = `
        <span class="legend-color" style="background-color: ${color};"></span>
        <span>${name}</span>
      `;
      itemsEl.appendChild(item);
    }

    // Agregar agua/salares
    const waterItem = document.createElement('div');
    waterItem.className = 'legend-item';
    waterItem.innerHTML = `
      <span class="legend-color" style="background-color: ${colorPalettes.water}; border-style: dashed;"></span>
      <span>Salares y Cuerpos de Agua</span>
    `;
    itemsEl.appendChild(waterItem);
  }

  // --- Buscador Global Predictivo ---
  function setupSearch() {
    const input = document.getElementById('searchInput');
    const clearBtn = document.getElementById('searchClearBtn');
    const suggestions = document.getElementById('searchSuggestions');

    input.addEventListener('input', () => {
      const q = input.value.trim().toLowerCase();
      if (q.length > 0) {
        clearBtn.classList.add('visible');
      } else {
        clearBtn.classList.remove('visible');
        suggestions.classList.remove('active');
        return;
      }

      if (!state.geoData) return;

      // Buscar coincidencias
      const matches = [];
      for (const f of state.geoData.features) {
        const p = f.properties;
        const nom = (p.nomencla || '').toLowerCase();
        const aso = (p.nom_aso || '').toLowerCase();
        const ord = (p.usda_orden || '').toLowerCase();
        const reg = (p.reg_geo || '').toLowerCase();

        if (nom.includes(q) || aso.includes(q) || ord.includes(q) || reg.includes(q)) {
          matches.push(f);
          if (matches.length >= 10) break; // Límite de sugerencias
        }
      }

      if (matches.length > 0) {
        suggestions.innerHTML = matches.map(f => `
          <div class="suggestion-item" data-fid="${f.properties.fid}">
            <div>
              <div class="suggestion-title">${f.properties.nom_aso || f.properties.nomencla}</div>
              <div class="suggestion-sub">
                ${f.properties.nomencla ? `Código: ${f.properties.nomencla} • ` : ''}
                Orden: ${f.properties.usda_orden || 'S/D'} • 
                Superficie: ${f.properties.area_km2.toLocaleString()} km²
              </div>
            </div>
            <i data-lucide="chevron-right" style="color: var(--text-muted); width: 16px;"></i>
          </div>
        `).join('');
        suggestions.classList.add('active');
        initLucide();

        // Click en sugerencia
        suggestions.querySelectorAll('.suggestion-item').forEach(item => {
          item.addEventListener('click', () => {
            const fid = parseInt(item.dataset.fid, 10);
            const targetFeature = state.geoData.features.find(f => f.properties.fid === fid);
            if (targetFeature) {
              // Buscar layer correspondiente
              state.geojsonLayer.eachLayer(l => {
                if (l.feature.properties.fid === fid) {
                  selectFeature(targetFeature, l);
                }
              });
            }
            suggestions.classList.remove('active');
            input.value = targetFeature.properties.nom_aso || targetFeature.properties.nomencla;
          });
        });
      } else {
        suggestions.innerHTML = '<div style="padding: 0.8rem; color: var(--text-muted); font-size: 0.8rem;">No se encontraron suelos con ese término.</div>';
        suggestions.classList.add('active');
      }
    });

    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.classList.remove('visible');
      suggestions.classList.remove('active');
    });

    // Cerrar sugerencias al hacer click afuera
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-container')) {
        suggestions.classList.remove('active');
      }
    });
  }

  // --- Filtros y Gráficos Globales ---
  function initFiltersAndCharts() {
    if (!state.geoData) return;

    const usdaSelect = document.getElementById('filterUsda');
    const grupoSelect = document.getElementById('filterGrupo');
    const regionSelect = document.getElementById('filterRegion');

    const usdaSet = new Set();
    const grupoSet = new Set();
    const regionSet = new Set();

    const usdaAreas = {};
    const grupoAreas = {};

    state.geoData.features.forEach(f => {
      const p = f.properties;
      if (p.usda_orden && !p.is_water) {
        usdaSet.add(p.usda_orden);
        usdaAreas[p.usda_orden] = (usdaAreas[p.usda_orden] || 0) + p.area_km2;
      }
      if (p.grupo_tier && !p.is_water) {
        grupoSet.add(p.grupo_tier);
        grupoAreas[p.grupo_tier] = (grupoAreas[p.grupo_tier] || 0) + p.area_ha;
      }
      if (p.reg_geo && !p.is_water) regionSet.add(p.reg_geo);
    });

    // Llenar selects
    Array.from(usdaSet).sort().forEach(u => {
      const opt = document.createElement('option');
      opt.value = u;
      opt.textContent = u;
      usdaSelect.appendChild(opt);
    });

    Array.from(grupoSet).sort().forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      opt.textContent = `Grupo ${g}`;
      grupoSelect.appendChild(opt);
    });

    Array.from(regionSet).sort().forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      regionSelect.appendChild(opt);
    });

    // Eventos de cambio en filtros
    const applyFilters = () => {
      state.activeFilters.usda = usdaSelect.value;
      state.activeFilters.grupo = grupoSelect.value;
      state.activeFilters.region = regionSelect.value;
      renderGeojsonLayer();
    };

    usdaSelect.addEventListener('change', applyFilters);
    grupoSelect.addEventListener('change', applyFilters);
    regionSelect.addEventListener('change', applyFilters);

    document.getElementById('btnResetFilters').addEventListener('click', () => {
      usdaSelect.value = 'ALL';
      grupoSelect.value = 'ALL';
      regionSelect.value = 'ALL';
      applyFilters();
    });

    // Gráfico de distribución de órdenes USDA
    const ctxUsda = document.getElementById('chartUsdaDist').getContext('2d');
    state.charts.usdaDist = new Chart(ctxUsda, {
      type: 'doughnut',
      data: {
        labels: Object.keys(usdaAreas),
        datasets: [{
          data: Object.values(usdaAreas).map(v => Math.round(v)),
          backgroundColor: Object.keys(usdaAreas).map(k => colorPalettes.usda_orden[k] || '#64748b'),
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12 } }
        }
      }
    });

    // Gráfico de distribución de Grupos de Aptitud
    const ctxGrupo = document.getElementById('chartGrupoDist').getContext('2d');
    state.charts.grupoDist = new Chart(ctxGrupo, {
      type: 'bar',
      data: {
        labels: Object.keys(grupoAreas).sort(),
        datasets: [{
          label: 'Hectáreas',
          data: Object.keys(grupoAreas).sort().map(k => Math.round(grupoAreas[k])),
          backgroundColor: Object.keys(grupoAreas).sort().map(k => colorPalettes.grupo_tier[k] || '#64748b'),
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { display: false } },
          y: { ticks: { color: '#94a3b8', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.05)' } }
        }
      }
    });
  }

  // --- Manejo de Eventos Generales ---
  function setupEventListeners() {
    setupSearch();

    // Selector de Capas Temáticas
    document.querySelectorAll('.thematic-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.thematic-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.activeThematic = tab.dataset.theme;
        renderGeojsonLayer();
        updateLegend();
      });
    });

    // Alternar Mapas Base (Satelital, Topográfico, OpenStreetMap) - 100% libres sin API key
    const basemapNames = {
      esri_sat: '🛰️ Satelital (Esri World Imagery)',
      esri_topo: '🏔️ Relieve Topográfico (Esri Topo)',
      osm: '🗺️ OpenStreetMap'
    };
    const basemapKeys = ['esri_sat', 'esri_topo', 'osm'];
    let basemapIdx = 0;
    const btnBasemap = document.getElementById('btnToggleBasemap');

    btnBasemap.addEventListener('click', () => {
      state.map.removeLayer(state.basemaps[basemapKeys[basemapIdx]]);
      basemapIdx = (basemapIdx + 1) % basemapKeys.length;
      const nextKey = basemapKeys[basemapIdx];
      state.basemaps[nextKey].addTo(state.map);
      state.currentBasemap = nextKey;
      if (state.geojsonLayer) state.geojsonLayer.bringToFront();
      btnBasemap.title = `Mapa base activo: ${basemapNames[nextKey]} (clic para cambiar)`;
    });

    // Restablecer límites a Salta y Jujuy
    document.getElementById('btnResetBounds').addEventListener('click', () => {
      if (state.geojsonLayer) {
        state.map.flyToBounds(state.geojsonLayer.getBounds(), { padding: [20, 20], duration: 0.8 });
      }
    });

    // Geolocalización del usuario
    document.getElementById('btnLocateUser').addEventListener('click', () => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition((pos) => {
          const latlng = [pos.coords.latitude, pos.coords.longitude];
          state.map.flyTo(latlng, 12, { duration: 1.2 });
          L.circleMarker(latlng, {
            radius: 8,
            color: '#ffffff',
            fillColor: '#38bdf8',
            fillOpacity: 1,
            weight: 3
          }).addTo(state.map).bindPopup('Tu ubicación actual').openPopup();
        }, () => {
          alert('No se pudo obtener su ubicación.');
        });
      }
    });

    // Pestañas del Drawer de Detalle
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetPane = document.getElementById(btn.dataset.tab);
        if (targetPane) targetPane.classList.add('active');
      });
    });

    // Abrir/Cerrar Drawer de Filtros
    const filterDrawer = document.getElementById('filterDrawer');
    document.getElementById('btnOpenFilters').addEventListener('click', () => {
      filterDrawer.classList.toggle('open');
      document.getElementById('btnOpenFilters').classList.toggle('active');
    });
    document.getElementById('btnCloseFilter').addEventListener('click', () => {
      filterDrawer.classList.remove('open');
      document.getElementById('btnOpenFilters').classList.remove('active');
    });

    // Cerrar Drawer de Detalle
    document.getElementById('btnCloseDetail').addEventListener('click', () => {
      openDetailDrawer(false);
      state.selectedFeature = null;
      if (state.geojsonLayer) {
        state.geojsonLayer.eachLayer(l => state.geojsonLayer.resetStyle(l));
      }
    });

    // Modal Informativo
    const modal = document.getElementById('infoModal');
    document.getElementById('btnInfoModal').addEventListener('click', () => modal.classList.add('open'));
    document.getElementById('btnCloseModal').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('open');
    });

    // Modal de Exportación y Descargas
    const exportModal = document.getElementById('exportModal');
    const openExport = () => {
      if (!state.selectedFeature) {
        alert('Por favor seleccione primero un suelo en el mapa.');
        return;
      }
      const p = state.selectedFeature.properties;
      document.getElementById('exportModalSubtitle').textContent = `${p.nom_aso || p.nomencla} (${p.nomencla || 'Suelo'})`;
      exportModal.classList.add('open');
    };

    const btnOpenExport = document.getElementById('btnOpenExportModal');
    if (btnOpenExport) btnOpenExport.addEventListener('click', openExport);

    const btnDownloadBanner = document.getElementById('btnDownloadFichaBanner');
    if (btnDownloadBanner) btnDownloadBanner.addEventListener('click', openExport);

    const btnCloseExport = document.getElementById('btnCloseExportModal');
    if (btnCloseExport) btnCloseExport.addEventListener('click', () => exportModal.classList.remove('open'));

    exportModal.addEventListener('click', (e) => {
      if (e.target === exportModal) exportModal.classList.remove('open');
    });

    // 1. Exportar Ficha Completa en PDF / Documento
    document.getElementById('optExportPdf').addEventListener('click', () => {
      exportModal.classList.remove('open');
      if (!state.selectedFeature) return;
      const p = state.selectedFeature.properties;
      const db = p.pdf_id && state.dbData[p.pdf_id] ? state.dbData[p.pdf_id] : null;
      openCompleteReportWindow(p, db, true);
    });

    // 2. Descargar Documento HTML Offline
    document.getElementById('optExportHtml').addEventListener('click', () => {
      exportModal.classList.remove('open');
      if (!state.selectedFeature) return;
      const p = state.selectedFeature.properties;
      const db = p.pdf_id && state.dbData[p.pdf_id] ? state.dbData[p.pdf_id] : null;
      downloadCompleteReportHtml(p, db);
    });

    // 3. Descargar Laboratorio en CSV / Excel
    document.getElementById('optExportCsv').addEventListener('click', () => {
      exportModal.classList.remove('open');
      if (!state.selectedFeature) return;
      const p = state.selectedFeature.properties;
      const db = p.pdf_id && state.dbData[p.pdf_id] ? state.dbData[p.pdf_id] : null;
      downloadLaboratoryCsv(p, db);
    });

    // 4. Descargar Base de Datos JSON
    document.getElementById('optExportJson').addEventListener('click', () => {
      exportModal.classList.remove('open');
      if (!state.selectedFeature) return;
      const p = state.selectedFeature.properties;
      const db = p.pdf_id && state.dbData[p.pdf_id] ? state.dbData[p.pdf_id] : null;
      downloadJsonRecord(p, db);
    });

    // Plegar/Desplegar Leyenda
    const legendCard = document.getElementById('legendCard');
    const legendHeader = document.getElementById('legendHeader');
    const legendItems = document.getElementById('legendItems');
    const chevron = document.getElementById('legendChevron');
    legendHeader.addEventListener('click', () => {
      if (legendItems.style.display === 'none') {
        legendItems.style.display = 'flex';
        chevron.style.transform = 'rotate(0deg)';
      } else {
        legendItems.style.display = 'none';
        chevron.style.transform = 'rotate(180deg)';
      }
    });
  }

  // =========================================================================
  // Generador de Ficha Técnica Integral y Exportaciones
  // =========================================================================
  function buildCompleteReportHtml(props, db) {
    const code = props.nomencla || (db ? db.nomencla : 'S/D');
    const name = props.nom_aso || (db ? db.asociacion : 'Unidad Cartográfica');
    const group = props.grupo_tier || (db ? db.grupo_tierra : 'S/D');
    const region = props.reg_geo || (db ? db.region_geografica : 'Noroeste Argentino');
    const areaKm = props.area_km2 ? `${props.area_km2.toLocaleString()} km²` : 'S/D';
    const areaHa = props.area_ha ? `${props.area_ha.toLocaleString()} ha` : 'S/D';
    const dateStr = new Date().toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' });

    // HTML de Suelos Asociados
    let suelosHtml = '';
    if (db && db.suelos_asociados && db.suelos_asociados.length > 0) {
      suelosHtml = db.suelos_asociados.map((s, idx) => `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 8px; margin-bottom: 12px;">
            <h3 style="font-size: 16px; color: #0f172a; margin: 0;">${idx + 1}. Suelo ${s.nombre} ${s.nomencla ? `(${s.nomencla})` : ''}</h3>
            <span style="background: #2563eb; color: #ffffff; padding: 3px 10px; border-radius: 4px; font-size: 12px; font-weight: 700;">${s.dominancia || 'Componente'}</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; font-size: 13px;">
            <div><strong>Clasificación USDA:</strong> ${s.usda || 'No clasificado'}</div>
            <div><strong>Clasificación FAO:</strong> ${s.fao || 'No clasificado'}</div>
            <div><strong>Capacidad de Uso:</strong> ${s.clase_capacidad ? `Clase ${s.clase_capacidad}` : 'S/D'}</div>
            <div><strong>Símbolo Cartográfico:</strong> ${s.nomencla || 'S/D'}</div>
          </div>

          <div style="font-size: 13px; line-height: 1.5; color: #334155; margin-bottom: 8px;">
            <strong>Características diagnósticas:</strong> ${s.caracteristica || 'Sin características específicas registradas.'}
          </div>
          <div style="font-size: 13px; line-height: 1.5; color: #334155; margin-bottom: 8px;">
            <strong>Limitaciones agronómicas:</strong> ${s.limitaciones || 'Sin limitaciones severas registradas.'}
          </div>
          ${s.clase_capacidad_desc ? `<div style="font-size: 13px; line-height: 1.5; color: #334155;"><strong>Diagnóstico de clase:</strong> ${s.clase_capacidad_desc}</div>` : ''}

          <!-- Perfil Modal de este suelo -->
          ${s.perfil_modal && s.perfil_modal.length > 0 ? `
            <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              <h4 style="font-size: 14px; color: #1e293b; margin-bottom: 10px;">Perfil Modal (Horizontes):</h4>
              <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
                <thead>
                  <tr style="background: #e2e8f0; color: #1e293b;">
                    <th style="padding: 6px 10px; border: 1px solid #cbd5e1; width: 90px;">Horizonte</th>
                    <th style="padding: 6px 10px; border: 1px solid #cbd5e1; width: 110px;">Profundidad</th>
                    <th style="padding: 6px 10px; border: 1px solid #cbd5e1;">Descripción Morfológica de Campo</th>
                  </tr>
                </thead>
                <tbody>
                  ${s.perfil_modal.map(h => `
                    <tr>
                      <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-weight: 700; background: #f1f5f9;">${h.horizonte}</td>
                      <td style="padding: 6px 10px; border: 1px solid #cbd5e1; font-family: monospace;">${h.profundidad}</td>
                      <td style="padding: 6px 10px; border: 1px solid #cbd5e1; color: #334155;">${h.descripcion || 'Sin descripción.'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : '<div style="margin-top: 12px; font-size: 12px; color: #64748b; font-style: italic;">Sin perfil modal discriminado numéricamente.</div>'}

          <!-- Laboratorio de este suelo -->
          ${s.laboratorio && s.laboratorio.horizontes ? `
            <div style="margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              <h4 style="font-size: 14px; color: #1e293b; margin-bottom: 10px;">Determinaciones Analíticas de Laboratorio:</h4>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
                  <thead>
                    <tr style="background: #0f172a; color: #ffffff;">
                      <th style="padding: 6px 8px; border: 1px solid #334155;">Determinación Físico-Química</th>
                      ${s.laboratorio.horizontes.map(h => `<th style="padding: 6px 8px; border: 1px solid #334155; text-align: center;">${h}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${renderLabRowsHtml(s.laboratorio.filas, s.laboratorio.horizontes.length)}
                  </tbody>
                </table>
              </div>
            </div>
          ` : '<div style="margin-top: 12px; font-size: 12px; color: #64748b; font-style: italic;">Suelo clasificado por correlación morfológica de campo (sin matriz analítica de laboratorio).</div>'}
        </div>
      `).join('');
    } else {
      suelosHtml = '<p style="color: #64748b; font-size: 13px;">No se discriminaron sub-suelos individuales para esta unidad cartográfica.</p>';
    }

    return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ficha Edafológica: ${name} (${code}) — INTA/UNSa</title>
  <style>
    @page { size: A4; margin: 15mm; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 24px;
      line-height: 1.5;
    }
    .report-top-bar {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000;
      margin: -24px -24px 24px -24px;
    }
    .btn-action {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      margin-left: 8px;
    }
    .btn-action:hover { background: #1d4ed8; }
    .btn-close { background: #475569; }
    .btn-close:hover { background: #334155; }
    .header-box {
      border-bottom: 3px solid #059669;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .inst-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }
    h1 {
      font-size: 22px;
      color: #0f172a;
      margin: 0 0 6px 0;
      font-weight: 800;
    }
    .subtitle {
      font-size: 13px;
      color: #475569;
      margin: 0;
    }
    .section-title {
      font-size: 14px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #059669;
      border-bottom: 1.5px solid #059669;
      padding-bottom: 4px;
      margin: 24px 0 12px 0;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      font-size: 13px;
    }
    .field-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
    }
    .field-label {
      font-size: 10px;
      text-transform: uppercase;
      font-weight: 700;
      color: #64748b;
      margin-bottom: 3px;
    }
    .field-value {
      font-size: 13px;
      color: #0f172a;
      font-weight: 600;
    }
    .suitability-callout {
      background: #ecfdf5;
      border: 1.5px solid #10b981;
      border-radius: 8px;
      padding: 14px;
      margin: 14px 0;
    }
    .footer {
      margin-top: 36px;
      border-top: 1px solid #cbd5e1;
      padding-top: 12px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
      line-height: 1.5;
    }
    @media print {
      .report-top-bar { display: none !important; }
      body { padding: 0 !important; }
      .field-card { background: #ffffff !important; border-color: #cbd5e1 !important; }
    }
  </style>
</head>
<body>

  <div class="report-top-bar">
    <div style="font-weight: 700; font-size: 14px;">🌱 Ficha Edafológica Completa: ${name}</div>
    <div>
      <button class="btn-action" onclick="window.print()">🖨️ Guardar como PDF / Imprimir</button>
      <button class="btn-action btn-close" onclick="window.close()">✖️ Cerrar</button>
    </div>
  </div>

  <div class="header-box">
    <div class="inst-row">
      <span>INTA EEA Salta • Universidad Nacional de Salta (UNSa)</span>
      <span>Fecha: ${dateStr}</span>
    </div>
    <h1>${name} (${code})</h1>
    <p class="subtitle">
      Estudio de referencia: <em>"Los Suelos del NOA (Salta y Jujuy)"</em> — Nadir A. & Chafatinos T. (1990) | Digitalización SIGSSSJ 2009
    </p>
  </div>

  <!-- Identificadores -->
  <div class="grid-2">
    <div class="field-card">
      <div class="field-label">Superficie Cartográfica</div>
      <div class="field-value">${areaKm} (${areaHa})</div>
    </div>
    <div class="field-card">
      <div class="field-label">Grupo de Aptitud de la Tierra</div>
      <div class="field-value" style="color: #059669;">Grupo ${group}</div>
    </div>
    <div class="field-card">
      <div class="field-label">Región Geográfica</div>
      <div class="field-value">${region}</div>
    </div>
    <div class="field-card">
      <div class="field-label">Subcuenca Hidrográfica</div>
      <div class="field-value">${props.subcuenca || (db ? db.subcuenca : 'S/D')}</div>
    </div>
  </div>

  <!-- Factores Ambientales -->
  <div class="section-title">1. Ubicación y Entorno Fisiográfico</div>
  <div class="field-card" style="margin-bottom: 12px;">
    <div class="field-label">Ubicación Geográfica Detallada</div>
    <div style="font-size: 13px; color: #334155; line-height: 1.5;">${(db && db.ubicacion) ? db.ubicacion : 'Ubicación identificada en cartografía de Salta y Jujuy.'}</div>
  </div>
  <div class="grid-2">
    <div class="field-card">
      <div class="field-label">Fisiografía</div>
      <div class="field-value">${(db && db.fisiografia) ? db.fisiografia : 'S/D'}</div>
    </div>
    <div class="field-card">
      <div class="field-label">Relieve</div>
      <div class="field-value">${(db && db.relieve) ? db.relieve : 'S/D'}</div>
    </div>
  </div>

  <!-- Clima y Vegetación -->
  <div class="section-title">2. Clima, Vegetación Nativa y Material Geológico</div>
  <div class="grid-2" style="margin-bottom: 12px;">
    <div class="field-card">
      <div class="field-label">Régimen Térmico</div>
      <div class="field-value">${(db && db.temperatura) ? db.temperatura : 'Varía con la altitud'}</div>
    </div>
    <div class="field-card">
      <div class="field-label">Precipitaciones Anuales</div>
      <div class="field-value">${(db && db.precipitacion) ? db.precipitacion : 'Régimen monzónico'}</div>
    </div>
  </div>
  <div class="field-card" style="margin-bottom: 12px;">
    <div class="field-label">Comunidad Vegetal Nativa</div>
    <div style="font-size: 13px; color: #334155; line-height: 1.5;">${(db && db.vegetacion) ? db.vegetacion : 'Vegetación nativa de la ecorregión.'}</div>
  </div>
  <div class="field-card">
    <div class="field-label">Material Original (Geología)</div>
    <div style="font-size: 13px; color: #334155; line-height: 1.5;">${(db && db.material_original) ? db.material_original : 'Depósitos sedimentarios aluviales y coluviales.'}</div>
  </div>

  <!-- Capacidad de Uso -->
  <div class="section-title">3. Aptitud y Capacidad de Uso Agropecuario</div>
  <div class="suitability-callout">
    <h3 style="margin: 0 0 6px 0; color: #065f46; font-size: 15px;">Evaluación: Grupo de la Tierra ${group}</h3>
    <p style="margin: 0; font-size: 13px; color: #047857; line-height: 1.5;">
      ${(db && db.grupo_tierra_desc) ? db.grupo_tierra_desc : 'Evaluación agronómica según criterios edafológicos del INTA.'}
    </p>
  </div>

  <!-- Suelos Asociados, Perfiles y Laboratorio -->
  <div class="section-title">4. Suelos Asociados, Perfiles Modales y Determinaciones Analíticas</div>
  ${suelosHtml}

  <!-- Pie de Informe -->
  <div class="footer">
    <strong>Atlas Digital de Suelos del NOA (Salta y Jujuy)</strong><br>
    Convenio INTA - UNSa (SIGSSSJ, Ediciones INTA 2009, ISBN: 978-987-25050-8-0).<br>
    Documento generado digitalmente. Para uso científico, técnico, académico y de planificación territorial.
  </div>

</body>
</html>
    `;
  }

  function renderLabRowsHtml(filas, numCols) {
    if (!filas) return '';
    const friendlyNames = {
      profundidad: 'Profundidad (cm)',
      ph_pasta: 'pH (pasta saturación)',
      ph_agua: 'pH (en agua 1:2.5)',
      resistencia_electrica: 'Resistencia Eléc. (ohm/cm)',
      conductividad_electrica: 'Conductividad Eléc. (mmhos/cm)',
      co3ca: 'CO3Ca (%)',
      carbono_organico: 'Carbono Orgánico (%)',
      nitrogeno_total: 'Nitrógeno Total (%)',
      relacion_cn: 'Relación C / N',
      materia_organica: 'Materia Orgánica (%)',
      textura_clase: 'Clase Textural',
      arena: 'Arena (%)',
      limo: 'Limo (%)',
      arcilla: 'Arcilla (%)',
      cic: 'CIC (meq/100g)',
      calcio: 'Calcio Ca++ (meq/100g)',
      magnesio: 'Magnesio Mg++ (meq/100g)',
      sodio: 'Sodio Na+ (meq/100g)',
      potasio: 'Potasio K+ (meq/100g)',
      saturacion_bases: 'Saturación de Bases (%)',
      psi: 'PSI (% Sodio Intercambiable)'
    };

    let rowsHtml = '';
    for (const [key, label] of Object.entries(friendlyNames)) {
      if (filas[key]) {
        const vals = filas[key];
        rowsHtml += `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-weight: 600; background: #f8fafc;">${label}</td>
            ${vals.map(v => `<td style="padding: 5px 8px; border: 1px solid #cbd5e1; text-align: center;">${v || '--'}</td>`).join('')}
          </tr>
        `;
      }
    }
    return rowsHtml;
  }

  function openCompleteReportWindow(props, db, autoPrint) {
    const reportHtml = buildCompleteReportHtml(props, db);
    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      reportWindow.document.open();
      reportWindow.document.write(reportHtml);
      reportWindow.document.close();
      if (autoPrint) {
        reportWindow.onload = () => {
          setTimeout(() => { reportWindow.print(); }, 400);
        };
      }
    } else {
      alert('Por favor permita ventanas emergentes en su navegador para visualizar la ficha.');
    }
  }

  function downloadCompleteReportHtml(props, db) {
    const reportHtml = buildCompleteReportHtml(props, db);
    const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCode = (props.nomencla || 'suelo').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `ficha_tecnica_${safeCode}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadLaboratoryCsv(props, db) {
    if (!db || !db.suelos_asociados) {
      alert('Esta unidad no posee determinaciones analíticas de laboratorio.');
      return;
    }

    const soilsWithLab = db.suelos_asociados.filter(s => s.laboratorio && s.laboratorio.horizontes);
    if (soilsWithLab.length === 0) {
      alert('Esta unidad fue clasificada por correlación morfológica (sin tablas de laboratorio).');
      return;
    }

    let csvContent = 'Suelo,Dominancia,Determinacion,' + '\n';
    soilsWithLab.forEach(s => {
      const lab = s.laboratorio;
      const headers = ['Suelo', 'Dominancia', 'Determinacion', ...lab.horizontes].join(',');
      csvContent += `\n--- SUELO: ${s.nombre} (${s.dominancia || 'Componente'}) ---\n`;
      csvContent += headers + '\n';

      for (const [key, vals] of Object.entries(lab.filas || {})) {
        const row = [`"${s.nombre}"`, `"${s.dominancia || ''}"`, `"${key}"`, ...vals.map(v => `"${v}"`)].join(',');
        csvContent += row + '\n';
      }
    });

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCode = (props.nomencla || 'suelo').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `laboratorio_suelos_${safeCode}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadJsonRecord(props, db) {
    const exportData = {
      metadatos: {
        fuente: 'Estudio Los Suelos del NOA (Salta y Jujuy) - Nadir & Chafatinos (INTA - UNSa)',
        fecha_exportacion: new Date().toISOString()
      },
      cartografia: props,
      estudio_edafologico: db
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCode = (props.nomencla || 'suelo').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `suelo_noa_${safeCode}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function openDetailDrawer(open) {
    const drawer = document.getElementById('detailDrawer');
    if (open) {
      drawer.classList.add('open');
    } else {
      drawer.classList.remove('open');
    }
  }

  function showLoading(show) {
    let loader = document.getElementById('appLoader');
    if (show && !loader) {
      loader = document.createElement('div');
      loader.id = 'appLoader';
      loader.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 3000; color: #f8fafc; font-family: 'Plus Jakarta Sans', sans-serif;
      `;
      loader.innerHTML = `
        <div style="width: 48px; height: 48px; border: 4px solid rgba(56,189,248,0.2); border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite; margin-bottom: 1rem;"></div>
        <h3 style="font-size: 1.1rem; font-weight: 700;">Cargando Suelos del NOA...</h3>
        <p style="font-size: 0.82rem; color: #94a3b8; margin-top: 0.25rem;">Procesando cartografía digital y 216 fichas edafológicas</p>
        <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
      `;
      document.body.appendChild(loader);
    } else if (!show && loader) {
      loader.remove();
    }
  }

})();
