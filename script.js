/* ==========================================
   TURISMO CORRIENTES CAPITAL - LOGIC V7
   (GESTOS + AUDIO + RUTA FLOTANTE)
   ========================================== */

let map, markers, userMarker, routingControl, gpsWatchId;
let allLugares = []; 
let favoritos = JSON.parse(localStorage.getItem('favoritos_v1') || '[]');
let visitados = JSON.parse(localStorage.getItem('visitados_v1') || '[]');
window.sosDireccionCache = ""; 
let currentTransportMode = 'car'; 
let searchTimeout; // Para optimizar el buscador

let eventosCtes = []; 

const iconosMap = {
    'puente': 'https://cdn-icons-png.flaticon.com/128/2258/2258798.png',
    'costa': 'https://cdn-icons-png.flaticon.com/128/2847/2847171.png',
    'plaza': 'https://cdn-icons-png.flaticon.com/128/2316/2316680.png',
    'museo': 'https://cdn-icons-png.flaticon.com/128/2007/2007558.png',
    'iglesia': 'https://cdn-icons-png.flaticon.com/128/2165/2165089.png',
    'religioso': 'https://cdn-icons-png.flaticon.com/128/2165/2165089.png',
    'historico': 'https://cdn-icons-png.flaticon.com/128/2873/2873919.png',
    'comida': 'https://cdn-icons-png.flaticon.com/128/3448/3448609.png',
    'bar': 'https://cdn-icons-png.flaticon.com/128/931/931949.png',
    'cafe': 'https://cdn-icons-png.flaticon.com/128/924/924514.png',
    'restaurante': 'https://cdn-icons-png.flaticon.com/128/3448/3448609.png',
    'hotel': 'https://cdn-icons-png.flaticon.com/128/3009/3009489.png',
    'salud': 'https://cdn-icons-png.flaticon.com/128/3063/3063176.png',
    'farmacia': 'https://cdn-icons-png.flaticon.com/128/883/883407.png',
    'playa': 'https://cdn-icons-png.flaticon.com/128/2664/2664582.png',
    'turismo': 'https://cdn-icons-png.flaticon.com/128/3203/3203071.png',
    'default': 'https://cdn-icons-png.flaticon.com/128/149/149060.png'
};

const categoriasUI = {
    'turismo': ['turismo', 'plaza', 'costa', 'puente', 'museo', 'iglesia', 'historico', 'religioso', 'playa'],
    'gastronomia': ['comida', 'bar', 'cafe', 'restaurante'],
    'hospedaje': ['hotel', 'hostel', 'alojamiento'],
    'servicios': ['salud', 'farmacia', 'banco', 'servicios', 'policia']
};

const circuitosData = {
    'historico': [[-27.4697, -58.8313], [-27.4630, -58.8396], [-27.4627, -58.8387], [-27.4644, -58.8396]],
    'costanera': [[-27.4605, -58.8288], [-27.4614, -58.8381], [-27.4771, -58.8551], [-27.4756, -58.8560]]
};

const datosTransporte = [
    { empresa: "Chaco - Corrientes", horarios: { ida: ["Frecuencia 15'"], vuelta: ["24hs"] } },
    { empresa: "Línea 104", horarios: { ida: ["05:00", "23:00"], vuelta: ["Circular"] } },
    { empresa: "Línea 103", horarios: { ida: ["06:00", "00:00"], vuelta: ["Puerto"] } }
];

if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.body.classList.add('dark-mode');
}

async function initApp() {
    initTheme();
    configurarSplash(); 
    mostrarSkeletons();
    renderizarListaPaseos();
    initGesturesFicha();

    window.addEventListener('offline', () => { document.getElementById('offline-indicator').style.display = 'block'; showToast("Sin conexión"); });
    window.addEventListener('online', () => { document.getElementById('offline-indicator').style.display = 'none'; showToast("Conectado", "success"); });

    try {
        const response = await fetch('lugares.json');
        const data = await response.json();
        
        if (data.lugares && Array.isArray(data.lugares)) {
            allLugares = data.lugares;
        } else {
            console.error("JSON no válido");
            allLugares = [];
        }
        if (data.eventos && Array.isArray(data.eventos)) eventosCtes = data.eventos;
        
        renderizarMarcadores(allLugares);
        actualizarListaFavoritos(); 
        mostrarSkeleton(false);
        checkDeepLink(); 
    } catch (e) {
        console.error("Error cargando JSON:", e);
        mostrarSkeleton(false);
        showToast("Modo Offline (Sin datos nuevos)", "info");
    }

    activarDeslizamiento(); 
    iniciarGPS(false);
    fetchClima();
    
    // Evita que el botón atrás cierre la app
    window.addEventListener('popstate', handleBackButton);
}

// === FIX CRÍTICO: maxZoom agregado ===
function initMap() {
    map = L.map('map', { 
        zoomControl: false,
        maxZoom: 19 // <--- ESTO EVITA QUE SE CONGELE LA INTRO
    }).setView([-27.469, -58.830], 14);
    
    setTileLayer('light'); // Cargamos capa base inmediatamente
    
    // Clusters Personalizados
    markers = L.markerClusterGroup({ 
        showCoverageOnHover: false, 
        maxClusterRadius: 40,
        iconCreateFunction: function(cluster) {
            var childCount = cluster.getChildCount();
            var c = ' marker-cluster-custom-small';
            if (childCount > 10) { c = ' marker-cluster-custom-medium'; }
            return new L.DivIcon({ html: '<div><span>' + childCount + '</span></div>', className: 'marker-cluster' + c, iconSize: new L.Point(40, 40) });
        }
    });

    renderizarMarcadores(lugaresCtes);
    
    map.on('click', function(e) { 
        if(modoCreacion) agregarPuntoRuta(e.latlng);
        cerrarFicha(); 
    });
}

function updateMapTiles(isDark) {
    if (tileLayer) map.removeLayer(tileLayer);
    const urlLight = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const urlDark = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'; 
    tileLayer = L.tileLayer(isDark ? urlDark : urlLight, { attribution: '© CartoDB', maxZoom: 20 }).addTo(map);
}

function renderizarMarcadores(lista) {
    markers.clearLayers();
    lista.forEach(lugar => {
        let tipo = lugar.tipo;
        let icon = L.icon({ iconUrl: urlIconos[tipo] || urlIconos.turismo, iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -30] });
        let m = L.marker([lugar.lat, lugar.lng], { icon: icon });

        m.on('click', () => {
            mostrarFichaLugar(lugar);
            centrarEnMapa(lugar.lat, lugar.lng);
        });

        markers.addLayer(m);
    });
    map.addLayer(markers);
    map.on('click', () => { cerrarFicha(); toggleMenuSheet('cerrar'); });
}

function setTileLayer(mode) {
    map.eachLayer((layer) => { if(layer._url) map.removeLayer(layer); });
    let url = mode === 'dark' 
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    L.tileLayer(url, { attribution: '© CartoDB', maxZoom: 19 }).addTo(map);
}

// === FUNCIONES FALTANTES AGREGADAS ===

function handleBackButton(event) {
    // Si hay ficha abierta, la cerramos
    const ficha = document.getElementById('ficha-lugar');
    const imgs = lugar.imagenes || (lugar.img ? [lugar.img] : []);
    const imgUrl = imgs.length > 0 ? imgs[0] : 'https://via.placeholder.com/400x200?text=Corrientes';
    
    const esFav = favoritos.includes(lugar.nombre);
    const esVisitado = visitados.includes(lugar.nombre);
    const btnCheckStyle = esVisitado ? 'checkin-active' : 'checkin-inactive';
    const txtCheck = esVisitado ? 'Visitado' : 'Check-in';
    const iconCheck = esVisitado ? 'fas fa-check-circle' : 'far fa-circle';
    const textoAudio = lugar.desc ? lugar.desc.replace(/'/g, "\\'") : "Sin descripción";

    ficha.innerHTML = `
        <div class="ficha-header" style="background-image: url('${imgUrl}');">
            <button class="ficha-btn-cerrar" onclick="cerrarFicha()"><i class="fas fa-times"></i></button>
            <h3 class="ficha-titulo">${lugar.nombre}</h3>
        </div>
        <div class="ficha-body">
            <p class="ficha-desc">${lugar.desc || 'Sin descripción disponible.'}</p>
            <div class="ficha-acciones">
                <button onclick="irRutaGPS(${lugar.lat}, ${lugar.lng})" class="btn-pill primary"><i class="fas fa-location-arrow"></i> Ir</button>
                <button onclick="leerDescripcion('${textoAudio}')" class="btn-pill audio"><i class="fas fa-headphones-alt"></i> Oír</button>
                <button id="btn-check-ficha" onclick="toggleVisitado('${lugar.nombre}'); actualizarBotonCheckFicha('${lugar.nombre}')" class="btn-pill ${btnCheckStyle}"><i class="${iconCheck}"></i> <span>${txtCheck}</span></button>
                <button onclick="compartirLugar('${lugar.nombre}')" class="btn-pill share-btn"><i class="fas fa-share-alt"></i></button>
            </div>
            ${lugar.wp ? `<a href="https://wa.me/${lugar.wp}" target="_blank" style="display:block; margin-top:15px; text-align:center; color:#25D366; font-weight:bold; text-decoration:none;"><i class="fab fa-whatsapp"></i> WhatsApp</a>` : ''}
        </div>`;
    
    initGesturesFicha();
    ficha.classList.add('activa');
}

function cerrarFicha() {
    const ficha = document.getElementById('ficha-lugar');
    if(ficha) ficha.classList.remove('activa');
}

function actualizarBotonCheckFicha(nombre) {
    const btn = document.getElementById('btn-check-ficha');
    if(!btn) return;
    const esVisitado = visitados.includes(nombre);
    if(esVisitado) { btn.className = "btn-pill checkin-active"; btn.innerHTML = `<i class="fas fa-check-circle"></i> <span>Visitado</span>`; } 
    else { btn.className = "btn-pill checkin-inactive"; btn.innerHTML = `<i class="far fa-circle"></i> <span>Check-in</span>`; }
}

// === LOGICA PRINCIPAL ===

function getDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

window.ordenarPorCercania = function() {
    if (!userMarker) {
        showToast("⚠️ Activa el GPS para ordenar");
        iniciarGPS(true);
        return;
    }
    const { lat: userLat, lng: userLng } = userMarker.getLatLng();
    allLugares.forEach(l => { l.distancia = getDistancia(userLat, userLng, l.lat, l.lng); });
    
    const lugaresOrdenados = [...allLugares].sort((a, b) => a.distancia - b.distancia);
    renderizarMarcadores(lugaresOrdenados);
    toggleMenuSheet('abrir');
    showToast("📍 Lugares ordenados por cercanía");
    
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    const chips = document.querySelectorAll('.chip');
    chips.forEach(c => { if(c.innerText.includes("Cercanos")) c.classList.add('active'); });
};

function normalizeText(text) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Buscador con espera (Debounce)
window.filtrarPorBusqueda = () => { 
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        let txt = normalizeText(document.getElementById('buscador-input').value);
        if(txt.length === 0) { renderizarMarcadores(allLugares); return; }
        
        const encontrados = allLugares.filter(l => {
            const nombre = normalizeText(l.nombre);
            const tipo = normalizeText(l.tipo || "");
            const desc = normalizeText(l.desc || "");
            return nombre.includes(txt) || tipo.includes(txt) || desc.includes(txt);
        });
        renderizarMarcadores(encontrados); 
    }, 300);
}

function renderizarMarcadores(lista) {
    markers.clearLayers();
    
    ['favoritos-panel', 'turismo', 'gastronomia', 'hospedaje', 'servicios'].forEach(c => {
        const ul = document.getElementById(`lista-${c}`);
        if(ul && c !== 'favoritos-panel') ul.innerHTML = '';
    });

    const emptyMsg = document.getElementById('empty-state-msg');
    const listContainer = document.getElementById('lista-principal-container');
    
    if (!lista || lista.length === 0) {
        if(emptyMsg) emptyMsg.style.display = 'block';
        if(listContainer) listContainer.style.display = 'none';
        return;
    } else {
        if(emptyMsg) emptyMsg.style.display = 'none';
        if(listContainer) listContainer.style.display = 'block';
    }

    lista.forEach(l => {
        if (!l.lat || !l.lng) return;
        let tipoClean = l.tipo ? l.tipo.toLowerCase() : 'default';
        let iconUrl = iconosMap[tipoClean] || iconosMap.default;
        
        let classMarker = 'custom-marker';
        if (l.destacado) classMarker += ' marker-destacado';

        let icon = L.icon({ iconUrl: iconUrl, iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -30], className: classMarker });
        let m = L.marker([l.lat, l.lng], { icon: icon });
        m.on('click', () => { mostrarFicha(l); map.flyTo([l.lat, l.lng], 16); toggleMenuSheet('cerrar'); });
        markers.addLayer(m);

        let catDestino = 'cat-turismo';
        for (const [catUI, tiposAdmitidos] of Object.entries(categoriasUI)) {
            if (tiposAdmitidos.includes(tipoClean)) { catDestino = `lista-${catUI}`; break; }
        }
        
        const ul = document.getElementById(catDestino);
        if(ul) {
            const li = document.createElement('li');
            if(l.destacado) li.classList.add('item-destacado');
            let distHtml = l.distancia ? `<span style="font-size:0.7rem; background:rgba(0,0,0,0.1); padding:2px 5px; border-radius:4px; margin-left:5px;">${l.distancia.toFixed(1)} km</span>` : '';
            
            li.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;">
                              <span style="font-weight:500">${l.nombre} ${l.destacado ? '⭐' : ''}</span>
                              <div>${distHtml} <small style="color:var(--text-sec); font-size:0.75rem">${l.tipo}</small></div>
                            </div>`;
            li.onclick = () => { map.flyTo([l.lat, l.lng], 17); mostrarFicha(l); toggleMenuSheet('cerrar'); };
            ul.appendChild(li);
        }
    });
    if(lista === allLugares) actualizarListaFavoritos();
}

window.toggleVisitado = function(nombre) {
    if(visitados.includes(nombre)) { visitados = visitados.filter(v => v !== nombre); showToast("Marcado como pendiente"); } 
    else { visitados.push(nombre); showToast("¡Lugar visitado! 🎉", "success"); }
    localStorage.setItem('visitados_ctes', JSON.stringify(visitados));
    actualizarBotonCheckFicha(nombre);
};

/* ==========================================
   5. SISTEMA RUTAS & HELPERS
   ========================================== */
function renderizarListaPaseos() {
    const contenedor = document.getElementById('lista-paseos');
    if(!contenedor) return;
    const todosPaseos = [...paseosOficiales, ...misPaseos];
    contenedor.innerHTML = todosPaseos.map(paseo => `
        <li class="paseo-card" onclick="verPaseo('${paseo.id}')" style="border-left: 5px solid ${paseo.color}">
            <div style="flex:1"><strong style="color:var(--text-main); display:block; font-size:0.95rem;">${paseo.titulo}</strong><span style="font-size:0.8rem; color:var(--text-secondary);">${paseo.desc}</span>${paseo.custom ? '<span style="font-size:0.7rem; background:#eee; padding:2px 6px; border-radius:4px; margin-top:2px; display:inline-block;">Mío</span>' : ''}</div>
            ${paseo.custom ? `<i class="fas fa-trash" style="color:#ff4757; font-size:1rem; padding:10px;" onclick="event.stopPropagation(); borrarPaseo('${paseo.id}')"></i>` : `<i class="fas fa-map-marked-alt" style="color:${paseo.color}; font-size:1.2rem;"></i>`}
        </li>`).join('');
}
window.iniciarCreacionRuta = function() { modoCreacion = true; puntosTemp = []; cerrarMenu(); document.getElementById('creator-toolbar').style.display = 'flex'; document.body.classList.add('cursor-crosshair'); showToast("¡Modo Creación! Toca el mapa"); if (rutaLayer) { map.removeLayer(rutaLayer); rutaLayer = null; } mostrarBotonLimpiarRuta(false); };
function agregarPuntoRuta(latlng) { puntosTemp.push(latlng); const marker = L.circleMarker(latlng, { radius: 6, color: '#FF4757', fillColor: '#fff', fillOpacity: 1 }).addTo(map); marcadoresTemp.push(marker); if(lineaTemp) map.removeLayer(lineaTemp); lineaTemp = L.polyline(puntosTemp, { color: '#FF4757', weight: 4, dashArray: '10, 10' }).addTo(map); }
window.deshacerUltimoPunto = function() { if(puntosTemp.length > 0) { puntosTemp.pop(); const m = marcadoresTemp.pop(); map.removeLayer(m); if(lineaTemp) map.removeLayer(lineaTemp); if(puntosTemp.length > 0) lineaTemp = L.polyline(puntosTemp, { color: '#FF4757', weight: 4, dashArray: '10, 10' }).addTo(map); else lineaTemp = null; } };
window.abrirGuardarRuta = function() { if(puntosTemp.length < 2) { showToast("Marca al menos 2 puntos", "error"); return; } abrirModal('modal-guardar-ruta'); };
window.confirmarGuardadoRuta = function() { const nombre = document.getElementById('input-nombre-ruta').value; const desc = document.getElementById('input-desc-ruta').value || "Ruta personalizada"; if(!nombre) { showToast("Ponle un nombre", "error"); return; } const nuevoPaseo = { id: 'custom_' + Date.now(), titulo: nombre, desc: desc, color: '#9C27B0', puntos: puntosTemp.map(p=>[p.lat, p.lng]), custom: true }; misPaseos.push(nuevoPaseo); localStorage.setItem('mis_paseos_custom', JSON.stringify(misPaseos)); cancelarCreacion(); cerrarModal('modal-guardar-ruta'); renderizarListaPaseos(); document.getElementById('sidebar').classList.add('activo'); showToast("¡Ruta Guardada!", "success"); document.getElementById('input-nombre-ruta').value = ""; };
window.cancelarCreacion = function() { modoCreacion = false; document.getElementById('creator-toolbar').style.display = 'none'; document.body.classList.remove('cursor-crosshair'); if(lineaTemp) map.removeLayer(lineaTemp); marcadoresTemp.forEach(m => map.removeLayer(m)); lineaTemp = null; marcadoresTemp = []; puntosTemp = []; };
window.borrarPaseo = function(id) { if(confirm("¿Seguro querés borrar este recorrido?")) { misPaseos = misPaseos.filter(p => p.id !== id); localStorage.setItem('mis_paseos_custom', JSON.stringify(misPaseos)); renderizarListaPaseos(); if(rutaLayer) { map.removeLayer(rutaLayer); rutaLayer = null; mostrarBotonLimpiarRuta(false); } showToast("Recorrido eliminado"); } };
window.verPaseo = function(id) { const todos = [...paseosOficiales, ...misPaseos]; const paseo = todos.find(p => p.id === id); if (!paseo) return; if (rutaLayer) { map.removeLayer(rutaLayer); } if(window.innerWidth < 768) cerrarMenu(); rutaLayer = L.polyline(paseo.puntos, { color: paseo.color, weight: 6, opacity: 0.8, lineCap: 'round' }).addTo(map); map.fitBounds(rutaLayer.getBounds(), { padding: [50, 50] }); mostrarBotonLimpiarRuta(true, paseo.titulo); showToast(`Mostrando: ${paseo.titulo}`); };
function mostrarBotonLimpiarRuta(mostrar, titulo) { let btn = document.getElementById('btn-limpiar-ruta'); if (!btn) { btn = document.createElement('div'); btn.id = 'btn-limpiar-ruta'; btn.innerHTML = `<span>Recorrido Activo</span> <button onclick="limpiarRutaActual()"><i class="fas fa-times"></i> Salir</button>`; document.body.appendChild(btn); } if (mostrar) { btn.querySelector('span').innerText = titulo; btn.style.display = 'flex'; } else { btn.style.display = 'none'; } }
window.limpiarRutaActual = function() { if (rutaLayer) { map.removeLayer(rutaLayer); rutaLayer = null; } mostrarBotonLimpiarRuta(false); map.flyTo([-27.469213, -58.830635], 14); showToast("Recorrido finalizado"); };
window.leerDescripcion = function(texto) { if ('speechSynthesis' in window) { window.speechSynthesis.cancel(); const l = new SpeechSynthesisUtterance(texto); l.lang = 'es-ES'; l.rate = 0.9; window.speechSynthesis.speak(l); showToast("🔊 Reproduciendo..."); } else { showToast("Tu celular no soporta audio", "error"); } };
window.gestionarEstacionamiento = function() { const g = localStorage.getItem('mi_auto_ctes'); if (g) { if(confirm("¿Ir a tu vehículo guardado?")) { const p = JSON.parse(g); irRutaGPS(p.lat, p.lng); showToast("Calculando ruta..."); cerrarMenu(); } else { localStorage.removeItem('mi_auto_ctes'); if(parkingMarker) map.removeLayer(parkingMarker); guardarUbicacionActual(); } } else { guardarUbicacionActual(); } };
function guardarUbicacionActual() { if (!userMarker) { showToast("Espera a tener señal GPS", "error"); return; } const ll = userMarker.getLatLng(); localStorage.setItem('mi_auto_ctes', JSON.stringify(ll)); dibujarAuto(ll); showToast("¡Estacionamiento guardado!", "success"); cerrarMenu(); }
function dibujarAuto(ll) { if(parkingMarker) map.removeLayer(parkingMarker); const i = L.icon({iconUrl: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png', iconSize: [40, 40], iconAnchor: [20, 20]}); parkingMarker = L.marker(ll, {icon: i}).addTo(map).bindPopup("🚗 Tu vehículo está aquí"); }

// --- FUNCION GPS MEJORADA (TARJETA FLOTANTE) ---
window.irRutaGPS = function(dLat, dLng) { 
    if (!userMarker) { alert("⚠️ Activando GPS... permite la ubicación."); iniciarGPS(true); return; }
    
    prepararUIparaNavegacion();
    showToast(`Calculando ruta (${currentTransportMode === 'car' ? 'Auto' : 'Pie'})...`, "info"); 
    iniciarGPS(true);
    
    const lineColor = currentTransportMode === 'car' ? '#30D158' : '#007AFF'; 
    if (routingControl) try { map.removeControl(routingControl); } catch(e){}
    
    routingControl = L.Routing.control({ 
        waypoints: [ L.latLng(userMarker.getLatLng()), L.latLng(dLat, dLng) ], 
        router: new L.Routing.osrmv1({
            language: 'es',
            profile: 'foot' 
        }),
        routeWhileDragging: false, 
        // Importante: No mostrar alternativas para ahorrar espacio
        showAlternatives: false, 
        containerClassName: 'ruta-flotante-container',
        createMarker: () => null, 
        lineOptions: { styles: [{color: '#00897B', opacity: 0.8, weight: 6}] } 
    }).addTo(map); 

    // Colapsar detalles al inicio
    routingControl.on('routesfound', function(e) {
        setTimeout(() => {
            const container = document.querySelector('.leaflet-routing-container');
            if(container) {
                const hint = document.createElement('div');
                hint.innerHTML = '<i class="fas fa-chevron-up"></i> Ver detalles';
                hint.style.textAlign = 'center'; hint.style.fontSize = '0.7rem';
                hint.style.color = '#aaa'; hint.style.paddingBottom = '5px';
                container.appendChild(hint);
            }
        }, 500);
    });
    
    let btn = document.getElementById('btn-cancelar-ruta'); 
    if(!btn) { 
        btn = document.createElement('button'); 
        btn.id = 'btn-cancelar-ruta'; 
        btn.innerHTML = '<i class="fas fa-times"></i> Salir de Ruta'; 
        btn.onclick = cancelarRuta; 
        document.body.appendChild(btn); 
    } 
    btn.style.display = 'flex'; 
};

function cancelarRuta() { if (routingControl) { map.removeControl(routingControl); routingControl = null; } document.getElementById('btn-cancelar-ruta').style.display = 'none'; map.setView(userMarker.getLatLng(), 15); }
window.compartirLugar = function(nombre) { const url = `${window.location.origin}${window.location.pathname}?lugar=${encodeURIComponent(nombre)}`; if (navigator.share) navigator.share({ title: 'Corrientes App', url: url }); else { navigator.clipboard.writeText(url); showToast("Link copiado"); } };
function toggleFavorito(nombre) { if(favoritos.includes(nombre)) { favoritos = favoritos.filter(f => f !== nombre); showToast("Eliminado de favoritos"); } else { favoritos.push(nombre); showToast("¡Añadido!", "success"); } localStorage.setItem('favs_ctes', JSON.stringify(favoritos)); const activeChip = document.querySelector('.chip.active'); if(activeChip) filtrarMapa(activeChip.getAttribute('onclick').match(/'([^']+)'/)[1]); actualizarListas(lugaresCtes); }
function filtrarMapa(cat) { document.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); const btn = Array.from(document.querySelectorAll('.chip')).find(b => b.getAttribute('onclick').includes(cat)); if(btn) btn.classList.add('active'); const grupos = { 'turismo': ['turismo', 'plaza', 'iglesia'], 'gastronomia': ['comida', 'parrilla'], 'hospedaje': ['hotel', 'hospedaje', 'camping'], 'servicios': ['salud', 'farmacia'] }; let f = lugaresCtes; if (cat === 'favoritos') { f = lugaresCtes.filter(l => favoritos.includes(l.nombre)); if(f.length === 0) showToast("Sin favoritos"); document.getElementById('sidebar').classList.add('activo'); } else if(cat !== 'todos') { f = lugaresCtes.filter(l => grupos[cat] && grupos[cat].includes(l.tipo)); document.getElementById('sidebar').classList.add('activo'); document.querySelectorAll('.categoria-item').forEach(e => e.classList.remove('open')); if(document.getElementById(`cat-${cat}`)) document.getElementById(`cat-${cat}`).classList.add('open'); } renderizarMarcadores(f); }
function filtrarPorBusqueda() { let txt = document.getElementById('buscador-input').value.toLowerCase(); renderizarMarcadores(lugaresCtes.filter(l => l.nombre.toLowerCase().includes(txt))); }

function centrarEnMapa(lat, lng) { 
    if(window.innerWidth < 768) {
        cerrarMenu();
        map.flyTo([lat, lng], 18);
    } else {
        const targetPoint = map.project([lat, lng], 18).subtract([200, 0]); 
        const targetLatLng = map.unproject(targetPoint, 18);
        map.flyTo(targetLatLng, 18);
    }
}

/* ==========================================
   NUEVA FUNCION GPS (VISUAL GOOGLE MAPS + SMART PARKING + AUDIOGUIA)
   ========================================== */
function iniciarGPS() {
    if(!navigator.geolocation) { showToast("Tu dispositivo no tiene GPS", "error"); return; }
    
    const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };
    
    navigator.geolocation.watchPosition(
        (pos) => {
            let lat = pos.coords.latitude, lng = pos.coords.longitude;
            
            const estadoDiv = document.getElementById('estado-gps');
            if(estadoDiv) estadoDiv.innerHTML = `<i class="fas fa-satellite-dish" style="color:#25D366"></i> GPS Preciso (${Math.round(pos.coords.accuracy)}m)`;
            
            if(!userMarker) { 
                userMarker = L.marker([lat, lng], {
                    icon: L.divIcon({ className: 'google-marker-core', html: '<div class="google-marker-pulse"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
                }).addTo(map); 
            } else { userMarker.setLatLng([lat, lng]); }

            const autoGuardado = localStorage.getItem('mi_auto_ctes');
            if(autoGuardado) {
                const auto = JSON.parse(autoGuardado);
                const distanciaAuto = calcularDistancia(lat, lng, auto.lat, auto.lng);
                if(distanciaAuto < 0.03) {
                    if(parkingMarker) map.removeLayer(parkingMarker);
                    localStorage.removeItem('mi_auto_ctes');
                    cancelarRuta();
                    showToast("¡Estás cerca de tu vehículo! 🚗", "success");
                    if(navigator.vibrate) navigator.vibrate([100, 50, 100]); 
                }
            }

            // --- AUDIOGUÍA AUTOMÁTICA ---
            if(lugaresCtes.length > 0) {
                const lugarCercano = lugaresCtes.find(l => {
                    const yaNotificado = sessionStorage.getItem(`notified_${l.nombre}`);
                    if (l.tipo === 'turismo' && !yaNotificado) {
                        const dist = calcularDistancia(lat, lng, l.lat, l.lng); 
                        return dist < 0.08; // 80 metros
                    }
                    return false;
                });

                if (lugarCercano) {
                    sessionStorage.setItem(`notified_${lugarCercano.nombre}`, 'true');
                    const toast = document.createElement('div');
                    toast.className = 'toast info';
                    toast.innerHTML = `
                        <div style="display:flex; align-items:center; gap:10px;">
                            <i class="fas fa-headphones-alt"></i>
                            <div><strong>${lugarCercano.nombre}</strong><br><span style="font-size:0.8rem">¿Escuchar historia?</span></div>
                        </div>
                        <button onclick="leerDescripcion('${lugarCercano.desc.replace(/'/g, "\\'")}')" style="margin-top:5px; background:white; color:#333; border:none; padding:5px 10px; border-radius:15px; font-weight:bold; cursor:pointer; width:100%;">Reproducir</button>
                    `;
                    toast.style.background = "linear-gradient(135deg, #6A1B9A, #4A148C)";
                    document.getElementById('toast-container').appendChild(toast);
                    if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
                    setTimeout(() => { toast.style.opacity='0'; setTimeout(()=>toast.remove(), 500); }, 10000);
                }
            }
            actualizarListas(lugaresCtes);
        }, 
        (err) => { 
            console.warn("Error GPS:", err.code); 
            let msg = "⚠️ GPS buscando..."; 
            if(err.code === 1) msg = "⚠️ Activa la ubicación"; 
            if(document.getElementById('estado-gps')) document.getElementById('estado-gps').innerText = msg; 
        }, 
        options
    );
}

function cargarTransporte() { const c = document.getElementById('contenedor-horarios'); c.innerHTML = datosTransporte.map(e => `<div class="empresa-card"><div class="empresa-header"><h4>${e.empresa}</h4></div><div class="horarios-grid"><div><h5><i class="fas fa-arrow-right" style="color:#ff4757"></i> Ida</h5><div style="display:flex; gap:5px; flex-wrap:wrap;">${e.horarios.ida.map(h=>`<span class="time-badge">${h}</span>`).join('')}</div></div><div><h5><i class="fas fa-arrow-left" style="color:#25D366"></i> Vuelta</h5><div style="display:flex; gap:5px; flex-wrap:wrap;">${e.horarios.vuelta.map(h=>`<span class="time-badge">${h}</span>`).join('')}</div></div></div></div>`).join(''); abrirModal('modal-info'); }
function cargarEventos() { document.getElementById('eventos-container').innerHTML = eventosCtes.map(ev => `<div class="evento-item"><div class="fecha-evento">${ev.fecha}</div><div style="padding-left:15px;"><strong style="color:var(--color-primario)">${ev.titulo}</strong><p style="margin:5px 0 0 0; font-size:0.85rem; color:var(--text-secondary)">${ev.desc}</p></div></div>`).join(''); abrirModal('modal-eventos'); }
function showToast(m, t='info') { const d = document.createElement('div'); d.className = `toast ${t}`; d.innerHTML = m; document.getElementById('toast-container').appendChild(d); setTimeout(() => { d.style.opacity='0'; setTimeout(()=>d.remove(),300); }, 3000); }

function fetchClima() {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=-27.46&longitude=-58.83&current_weather=true&timezone=auto';
    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error('Error en la respuesta de API');
            return response.json();
        })
        .then(data => {
            if (data && data.current_weather) {
                const temperatura = Math.round(data.current_weather.temperature);
                const widget = document.getElementById('clima-widget');
                if (widget) { widget.innerHTML = `<i class="fas fa-sun"></i> ${temperatura}°C`; }
            }
        })
        .catch(err => {
            console.error("Error cargando clima:", err);
            const widget = document.getElementById('clima-widget');
            if (widget) widget.innerHTML = `<i class="fas fa-cloud"></i> --`;
        });
}

function alternarTema() { document.body.classList.toggle('dark-mode'); const isDark = document.body.classList.contains('dark-mode'); localStorage.setItem('theme', isDark ? 'dark' : 'light'); document.getElementById('theme-toggle').innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; updateMapTiles(isDark); }
function initTheme() { if(localStorage.getItem('theme')==='dark') { document.body.classList.add('dark-mode'); document.getElementById('theme-toggle').innerHTML='<i class="fas fa-sun"></i>'; } }
function toggleAcordeon(id) { document.getElementById(id).classList.toggle('open'); }
function cerrarMenu() { document.getElementById('sidebar').classList.remove('activo'); }
document.getElementById('menu-toggle').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('activo'));
function abrirModal(id) { document.getElementById(id).style.display = 'block'; }
function cerrarModal(id) { document.getElementById(id).style.display = 'none'; }
function compartirApp() { if(navigator.share) navigator.share({title:'Turismo Corrientes', url:window.location.href}); else {navigator.clipboard.writeText(window.location.href); showToast("Link copiado");} }
function verCercanos() { if(userMarker) { map.flyTo(userMarker.getLatLng(), 16); showToast("Tu ubicación"); } else showToast("Activa tu GPS", "error"); }
let deferredPrompt; window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; document.getElementById('btn-instalar').style.display = 'flex'; });
async function instalarApp() { if(deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; } }
function mostrarQR() { const urlActual = window.location.href; const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlActual)}`; document.getElementById('qr-image').src = qrApi; abrirModal('modal-qr'); }

/* ==========================================
   LOGICA SOS CON DIRECCIÓN REAL
   ========================================== */
window.abrirSOS = function() {
    abrirModal('modal-sos');
    const dirDiv = document.getElementById('sos-direccion-text');
    if (!userMarker) { dirDiv.innerHTML = "<span style='color:#d32f2f'>⚠️ Esperando señal GPS...</span>"; return; }
    dirDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando dirección...';
    const { lat, lng } = userMarker.getLatLng();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, { signal: controller.signal })
        .then(response => response.json())
        .then(data => {
            clearTimeout(timeoutId);
            if(data && data.address) {
                const calle = data.address.road || "Calle sin nombre";
                const altura = data.address.house_number || "S/N";
                const barrio = data.address.neighbourhood || data.address.suburb || "";
                dirDiv.innerHTML = `<strong style="font-size:1.3rem">${calle} ${altura}</strong><br><span style="font-size:0.85rem; color:#666;">${barrio}</span>`;
            } else { dirDiv.innerText = "Ubicación en mapa detectada"; }
        })
        .catch((err) => { dirDiv.innerHTML = `<strong style="color:#333">Ubicación detectada</strong><br><span style="font-size:0.75rem; color:#d32f2f;">(Sin internet para ver calle)</span>`; });
};
window.copiarDireccion = function() {
    const texto = document.getElementById('sos-direccion-text').innerText;
    navigator.clipboard.writeText(texto).then(() => { showToast("Dirección copiada"); });
};
window.compartirWpSOS = function() {
    if (!userMarker) { showToast("Sin señal GPS", "error"); return; }
    const { lat, lng } = userMarker.getLatLng();
    const mapLink = `https://www.google.com/maps?q=${lat},${lng}`;
    const mensaje = `¡Ayuda! Esta es mi ubicación actual: ${mapLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensaje)}`, '_blank');
};

/* ==========================================
   LOGICA DE GESTOS (SWIPE) PARA FICHA
   ========================================== */
function initGesturesFicha() {
    const ficha = document.getElementById('ficha-lugar');
    if(!ficha) return;
    const header = ficha.querySelector('.ficha-header'); 
    if(!header) return;

    let startY = 0;
    let currentY = 0;

    header.addEventListener('touchstart', (e) => {
        startY = e.touches[0].clientY;
        ficha.style.transition = 'none'; 
    }, {passive: true});

    header.addEventListener('touchmove', (e) => {
        currentY = e.touches[0].clientY;
        let delta = currentY - startY;
        if(delta > 0) {
            ficha.style.transform = `translateY(${delta}px)`;
        }
    }, {passive: true});

    header.addEventListener('touchend', () => {
        ficha.style.transition = 'transform 0.3s ease-out';
        let delta = currentY - startY;
        if (delta > 100) {
            cerrarFicha();
        } else {
            ficha.style.transform = 'translateY(0)';
        }
    });
}

initApp();