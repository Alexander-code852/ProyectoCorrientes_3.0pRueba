/* ==========================================
   TURISMO CORRIENTES CAPITAL - LOGIC V6.3 (GESTURES & AUDIO)
   ========================================== */

// 1. DATOS DE RESPALDO (Fallback)
const datosLocales = [
  { "nombre": "Puente Gral. Belgrano", "tipo": "turismo", "destacado": true, "estrellas": 5, "lat": -27.464738, "lng": -58.847527, "img": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Puente_General_Manuel_Belgrano.jpg/640px-Puente_General_Manuel_Belgrano.jpg", "desc": "Icono que une Corrientes y Chaco." }
];

// --- CIRCUITOS OFICIALES ---
const paseosOficiales = [
    { id: "costanera", titulo: "Circuito Costanera Total", desc: "Del Parque Mitre a la Playa Arazaty (5 km).", color: "#00897B", puntos: [[-27.458900, -58.828500], [-27.461000, -58.833000], [-27.464738, -58.847527], [-27.472000, -58.843000], [-27.481500, -58.841000]] },
    { id: "historico", titulo: "Casco Histórico", desc: "Plaza 25 de Mayo, Iglesias y Museos.", color: "#FF8F00", puntos: [[-27.463000, -58.835000], [-27.465800, -58.834600], [-27.468000, -58.835000], [-27.469000, -58.831000]] }
];

// Recuperar datos del Usuario
let misPaseos = JSON.parse(localStorage.getItem('mis_paseos_custom')) || [];
let favoritos = JSON.parse(localStorage.getItem('favs_ctes')) || [];
let visitados = JSON.parse(localStorage.getItem('visitados_ctes')) || [];

const eventosCtes = [
    { fecha: "Enero", titulo: "Fiesta Nacional del Chamamé", desc: "Música y tradición." },
    { fecha: "Febrero", titulo: "Carnavales Oficiales", desc: "Capital Nacional del Carnaval." }
];

const datosTransporte = [
    { empresa: "Chaco - Corrientes", telefono: "", horarios: { ida: ["Frecuencia", "15 min"], vuelta: ["Servicio", "24hs"] } },
    { empresa: "Aeropuerto Piraginé", telefono: "5493794123456", horarios: { ida: ["Vuelos", "Diarios"], vuelta: ["Consultar", "Aerolíneas"] } }
];

// Variables Globales
let map, markers, userMarker, routingControl, parkingMarker;
let rutaLayer = null; 
let tileLayer; 
let lugaresCtes = []; 

// VARIABLES CREADOR DE RUTAS
let modoCreacion = false, puntosTemp = [], lineaTemp = null, marcadoresTemp = [];

const urlIconos = {
    costa: 'https://cdn-icons-png.flaticon.com/128/2664/2664593.png', 
    puente: 'https://cdn-icons-png.flaticon.com/128/4046/4046362.png',
    turismo: 'https://cdn-icons-png.flaticon.com/128/10507/10507095.png', 
    plaza: 'https://cdn-icons-png.flaticon.com/128/3896/3896232.png',
    iglesia: 'https://cdn-icons-png.flaticon.com/512/2236/2236962.png',
    comida: 'https://cdn-icons-png.flaticon.com/512/3448/3448609.png',
    parrilla: 'https://cdn-icons-png.flaticon.com/512/1134/1134447.png',
    hotel: 'https://cdn-icons-png.flaticon.com/512/3009/3009489.png',
    hospedaje: 'https://cdn-icons-png.flaticon.com/128/9027/9027521.png',
    salud: 'https://cdn-icons-png.flaticon.com/512/3063/3063176.png',
    farmacia: 'https://cdn-icons-png.flaticon.com/128/4320/4320337.png'
};

/* ==========================================
   2. INICIO Y CARGA
   ========================================== */
async function initApp() {
    initTheme();
    configurarSplash(); 
    mostrarSkeletons();
    renderizarListaPaseos();
    
    // Nueva funcionalidad de gestos
    initGesturesFicha();

    window.addEventListener('offline', () => { document.getElementById('offline-indicator').style.display = 'block'; showToast("Sin conexión"); });
    window.addEventListener('online', () => { document.getElementById('offline-indicator').style.display = 'none'; showToast("Conectado", "success"); });

    try {
        const response = await fetch('lugares.json');
        lugaresCtes = response.ok ? await response.json() : datosLocales;
    } catch (e) { lugaresCtes = datosLocales; }

    initMap();
    iniciarGPS();
    fetchClima();
    
    const autoGuardado = localStorage.getItem('mi_auto_ctes'); 
    if(autoGuardado) setTimeout(() => dibujarAuto(JSON.parse(autoGuardado)), 2000);

    setTimeout(() => {
        const s = document.getElementById('splash-screen');
        if(s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 800); }
    }, 2500);
}

function configurarSplash() {
    const hora = new Date().getHours();
    const splash = document.getElementById('splash-screen');
    splash.classList.remove('splash-theme-morning', 'splash-theme-day', 'splash-theme-sunset', 'splash-theme-night');
    if (hora >= 6 && hora < 12) splash.classList.add('splash-theme-morning'); 
    else if (hora >= 12 && hora < 19) splash.classList.add('splash-theme-day'); 
    else if (hora >= 19 && hora < 21) splash.classList.add('splash-theme-sunset'); 
    else splash.classList.add('splash-theme-night'); 
}

function mostrarSkeletons() {
    const skeletonHTML = `<li class="skeleton-li"><div class="skeleton skeleton-img"></div><div style="flex:1"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-text"></div></div></li>`;
    ['lista-turismo', 'lista-gastronomia', 'lista-hospedaje', 'lista-servicios'].forEach(id => {
        const el = document.getElementById(id); if(el) el.innerHTML = skeletonHTML;
    });
}

/* ==========================================
   3. MAPA Y EVENTOS
   ========================================== */
function initMap() {
    map = L.map('map', { zoomControl: false }).setView([-27.469213, -58.830635], 14);
    
    const isDark = document.body.classList.contains('dark-mode');
    updateMapTiles(isDark);
    
    // Clusters Personalizados
    markers = L.markerClusterGroup({ 
        showCoverageOnHover: false, maxClusterRadius: 40,
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
        cerrarFicha(); // Cierra la ficha al tocar el mapa
    });
}

function updateMapTiles(isDark) {
    if (tileLayer) map.removeLayer(tileLayer);
    const urlLight = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    const urlDark = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'; 
    tileLayer = L.tileLayer(isDark ? urlDark : urlLight, { attribution: '© CartoDB', maxZoom: 20 }).addTo(map);
}

// FUNCION RENDERIZAR MARCADOES (SIN POPUPS, CON FICHA)
function renderizarMarcadores(lista) {
    markers.clearLayers();
    lista.forEach(lugar => {
        let tipo = lugar.tipo;
        let icon = L.icon({ iconUrl: urlIconos[tipo] || urlIconos.turismo, iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -30] });
        let m = L.marker([lugar.lat, lugar.lng], { icon: icon });

        // Evento Click: Abre la Ficha en vez del Popup
        m.on('click', () => {
            mostrarFichaLugar(lugar);
            centrarEnMapa(lugar.lat, lugar.lng);
        });

        markers.addLayer(m);
    });
    map.addLayer(markers);
    actualizarListas(lista);
}

// LOGICA FICHA DESLIZANTE
function mostrarFichaLugar(lugar) {
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
    
    // Reinicializar eventos de gestos para el nuevo contenido
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

/* ==========================================
   4. DISTANCIA Y LISTAS
   ========================================== */
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; 
}

function actualizarListas(lista) {
    document.querySelectorAll('.lista-lugares').forEach(ul => ul.innerHTML='');
    const catsMap = { turismo: 'lista-turismo', iglesia: 'lista-turismo', plaza: 'lista-turismo', comida: 'lista-gastronomia', parrilla: 'lista-gastronomia', hotel: 'lista-hospedaje', hospedaje: 'lista-hospedaje', camping: 'lista-hospedaje', salud: 'lista-servicios', farmacia: 'lista-servicios' };

    let userLat = userMarker ? userMarker.getLatLng().lat : null;
    let userLng = userMarker ? userMarker.getLatLng().lng : null;
    let listaOrdenada = [...lista];

    if(userLat) {
        listaOrdenada.sort((a, b) => {
            return calcularDistancia(userLat, userLng, a.lat, a.lng) - calcularDistancia(userLat, userLng, b.lat, b.lng);
        });
    }

    listaOrdenada.forEach(l => {
        let ul = document.getElementById(catsMap[l.tipo] || 'lista-turismo');
        let stars = ''; for(let i=0; i<(l.estrellas||0); i++) stars += '<i class="fas fa-star" style="color:#FFD700; font-size:0.7rem;"></i>';
        const heartClass = favoritos.includes(l.nombre) ? "fas fa-heart" : "far fa-heart";
        const heartColor = favoritos.includes(l.nombre) ? "#ff4757" : "#ccc";
        let distText = "";
        if(userLat) {
            let d = calcularDistancia(userLat, userLng, l.lat, l.lng);
            distText = d < 1 ? `${Math.round(d*1000)} m` : `${d.toFixed(1)} km`;
        }
        if(ul) {
            ul.innerHTML += `
            <li class="${l.destacado ? 'destacado-item' : ''}">
                <img src="${urlIconos[l.tipo] || urlIconos.turismo}" class="icono-lista" onerror="this.onerror=null;this.src='https://cdn-icons-png.flaticon.com/512/2236/2236962.png';">
                <div class="info-container" onclick="centrarEnMapa(${l.lat}, ${l.lng})">
                    <div style="display:flex; justify-content:space-between;">
                        <span class="nombre-lugar">${l.nombre}</span>
                        ${distText ? `<span style="font-size:0.75rem; color:var(--color-primario); font-weight:bold;">${distText}</span>` : ''}
                    </div>
                    <div style="display:flex; gap:5px; align-items:center;">${stars} <span class="meta-info">${l.tipo}</span></div>
                </div>
                <i class="${heartClass}" onclick="event.stopPropagation(); toggleFavorito('${l.nombre}')" style="color:${heartColor}; cursor:pointer; font-size:1.2rem; padding:5px;"></i>
            </li>`;
        }
    });
}

// LOGICA CHECK-IN
window.toggleVisitado = function(nombre) {
    if(visitados.includes(nombre)) { visitados = visitados.filter(v => v !== nombre); showToast("Marcado como pendiente"); } 
    else { visitados.push(nombre); showToast("¡Lugar visitado! 🎉", "success"); }
    localStorage.setItem('visitados_ctes', JSON.stringify(visitados));
    // Actualizar botones (si existe en ficha)
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

// --- FUNCION GPS CORREGIDA PARA SEGUIR CALLES (FOOT) ---
window.irRutaGPS = function(dLat, dLng) { 
    if (!userMarker) { showToast("Esperando señal GPS...", "error"); return; } 
    cerrarFicha(); 
    cerrarMenu(); 
    if (routingControl) map.removeControl(routingControl); 
    showToast("Calculando ruta a pie...", "info"); 
    
    routingControl = L.Routing.control({ 
        waypoints: [ L.latLng(userMarker.getLatLng()), L.latLng(dLat, dLng) ], 
        router: new L.Routing.osrmv1({
            language: 'es',
            profile: 'foot' 
        }),
        routeWhileDragging: false, 
        showAlternatives: false, 
        createMarker: () => null, 
        lineOptions: { styles: [{color: '#00897B', opacity: 0.9, weight: 6, dashArray: '1, 10'}] } 
    }).addTo(map); 
    
    let btn = document.getElementById('btn-cancelar-ruta'); 
    if(!btn) { 
        btn = document.createElement('button'); 
        btn.id = 'btn-cancelar-ruta'; 
        btn.innerHTML = '<i class="fas fa-times"></i> Cancelar Ruta'; 
        btn.onclick = cancelarRuta; 
        document.body.appendChild(btn); 
    } 
    btn.style.display = 'block'; 
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
   NUEVA FUNCION GPS (VISUAL GOOGLE MAPS + SMART PARKING + AUDIOGUIA AUTO)
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

            // LOGICA PROXIMIDAD AL AUTO
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

            // --- NUEVO: AUDIOGUÍA AUTOMÁTICA POR PROXIMIDAD (GEOFENCING) ---
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
                            <div>
                                <strong>${lugarCercano.nombre}</strong><br>
                                <span style="font-size:0.8rem">¿Escuchar historia?</span>
                            </div>
                        </div>
                        <button onclick="leerDescripcion('${lugarCercano.desc.replace(/'/g, "\\'")}')" style="margin-top:5px; background:white; color:#333; border:none; padding:5px 10px; border-radius:15px; font-weight:bold; cursor:pointer; width:100%;">Reproducir</button>
                    `;
                    toast.style.background = "linear-gradient(135deg, #6A1B9A, #4A148C)";
                    document.getElementById('toast-container').appendChild(toast);
                    if(navigator.vibrate) navigator.vibrate([50, 50, 50]);
                    setTimeout(() => { toast.style.opacity='0'; setTimeout(()=>toast.remove(), 500); }, 10000);
                }
            }
            // ----------------------------------------------------------------

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