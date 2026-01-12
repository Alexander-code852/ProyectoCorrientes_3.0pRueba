/* ==========================================
   RUTA CORRENTINA - LÓGICA V65 (FIXED & LIFE)
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
    initMap(); // El mapa se inicia primero con la corrección del maxZoom
    mostrarSkeleton(true); 
    
    if(document.body.classList.contains('dark-mode')) setTileLayer('dark');
    
    // Animación Splash
    setTimeout(() => {
        const s = document.getElementById('splash-screen');
        if(s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 500); }
    }, 2000);

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
    
    markers = L.markerClusterGroup({ 
        showCoverageOnHover: false, 
        maxClusterRadius: 40,
        iconCreateFunction: function(cluster) {
            const count = cluster.getChildCount();
            return L.divIcon({
                html: `<div class="cluster-custom"><span>${count}</span></div>`,
                className: 'custom-cluster-icon',
                iconSize: [40, 40]
            });
        }
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
    if (ficha && ficha.classList.contains('activa')) {
        cerrarFicha();
        return;
    }
    // Si hay modales, los cerramos
    const modales = document.querySelectorAll('.modal');
    let algunModalAbierto = false;
    modales.forEach(m => {
        if(m.style.display === 'block') { m.style.display = 'none'; algunModalAbierto = true; }
    });
    if(algunModalAbierto) return;

    // Si el menú está abierto, lo bajamos
    const sheet = document.getElementById('bottom-sheet');
    if (sheet && sheet.classList.contains('abierto')) {
        toggleMenuSheet('cerrar');
    }
}

function checkDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const lugarParam = params.get('lugar');
    if (lugarParam && allLugares.length > 0) {
        const lugarEncontrado = allLugares.find(l => l.nombre === lugarParam);
        if (lugarEncontrado) {
            setTimeout(() => {
                mostrarFicha(lugarEncontrado);
                map.setView([lugarEncontrado.lat, lugarEncontrado.lng], 16);
            }, 1000);
        }
    }
}

function actualizarListaFavoritos() {
    const ul = document.getElementById('lista-favoritos-panel');
    if (!ul) return;
    ul.innerHTML = '';
    const favItems = allLugares.filter(l => favoritos.includes(l.nombre));
    
    if (favItems.length === 0) {
        ul.innerHTML = '<li style="padding:15px; color:var(--text-sec); text-align:center;">Aún no tienes favoritos</li>';
        return;
    }

    favItems.forEach(l => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:500">${l.nombre}</span>
                <i class="fas fa-heart" style="color:#FF2D55;"></i>
            </div>`;
        li.onclick = () => { 
            map.flyTo([l.lat, l.lng], 17); 
            mostrarFicha(l); 
            toggleMenuSheet('cerrar'); 
        };
        ul.appendChild(li);
    });
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

window.checkInLugar = function(nombre) {
    if(!visitados.includes(nombre)) {
        visitados.push(nombre);
        localStorage.setItem('visitados_v1', JSON.stringify(visitados));
        showToast(`¡Check-in en ${nombre}! ✅`);
        
        if(visitados.length === 1) showToast("🏅 Logro desbloqueado: Primeros Pasos");
        if(visitados.length === 5) showToast("🏅 Logro desbloqueado: Explorador");
        
        const btn = document.getElementById('btn-checkin');
        if(btn) {
            btn.innerHTML = '<i class="fas fa-check-circle"></i> Visitado';
            btn.style.background = '#30D158';
            btn.style.color = '#fff';
            btn.disabled = true;
        }
    }
};

window.abrirLogros = function() {
    abrirModal('modal-logros');
    const container = document.getElementById('logros-container');
    const n = visitados.length;
    const medallas = [
        { min: 1, titulo: "Turista", icon: "fa-suitcase", color: "#FF9500" },
        { min: 3, titulo: "Caminante", icon: "fa-hiking", color: "#30D158" },
        { min: 5, titulo: "Explorador", icon: "fa-compass", color: "#007AFF" },
        { min: 10, titulo: "Experto", icon: "fa-crown", color: "#AF52DE" }
    ];
    container.innerHTML = '';
    medallas.forEach(m => {
        const ganado = n >= m.min;
        const opacity = ganado ? '1' : '0.3';
        const status = ganado ? '¡Ganado!' : `${n}/${m.min}`;
        const filtro = ganado ? '' : 'grayscale(100%)';
        container.innerHTML += `
            <div style="background:var(--bg-input); padding:15px; border-radius:15px; opacity:${opacity}; filter:${filtro}; display:flex; flex-direction:column; align-items:center;">
                <i class="fas ${m.icon}" style="font-size:2rem; color:${m.color}; margin-bottom:10px;"></i>
                <strong style="font-size:0.9rem;">${m.titulo}</strong>
                <span style="font-size:0.75rem; color:var(--text-sec);">${status}</span>
            </div>`;
    });
};

function mostrarFicha(l) {
    const f = document.getElementById('ficha-lugar');
    const sheet = document.getElementById('bottom-sheet');
    const fabControls = document.querySelector('.floating-controls');

    if(sheet) sheet.classList.add('oculto-total');
    if(fabControls) fabControls.classList.add('oculto-en-ruta');

    let imagenHTML = '';
    let margenExtra = '65px'; 
    if(l.img) {
        margenExtra = '10px';
        imagenHTML = `<div class="img-skeleton-container"><img src="${l.img}" class="ficha-img" onload="this.classList.add('loaded')" onerror="this.parentElement.style.display='none'"></div>`;
    }

    const descHTML = l.desc || 'Sin descripción disponible.';
    const textoTTS = (l.desc || "").replace(/'/g, "\\'").replace(/"/g, '\\"');
    
    const wpBtn = l.wp ? `<a href="https://wa.me/${l.wp}" target="_blank" class="btn-primary btn-whatsapp-pro"><i class="fab fa-whatsapp"></i> Enviar mensaje</a>` : '';
    const gmapsBtn = `<a href="https://www.google.com/maps/dir/?api=1&destination=${l.lat},${l.lng}" target="_blank" class="btn-google"><i class="fas fa-map-marked-alt"></i> G.Maps</a>`;
    const shareBtn = `<button onclick="compartirLugarNativo('${l.nombre}', '${l.desc.substring(0,50)}...')" class="btn-primary btn-share"><i class="fas fa-share-alt"></i> Compartir</button>`;
    
    const yaVisitado = visitados.includes(l.nombre);
    const checkInBtn = `<button id="btn-checkin" onclick="checkInLugar('${l.nombre}')" class="btn-google" style="background:${yaVisitado ? '#30D158' : 'var(--bg-input)'}; color:${yaVisitado ? 'white' : 'var(--text-main)'}" ${yaVisitado ? 'disabled' : ''}>
        <i class="fas ${yaVisitado ? 'fa-check-circle' : 'fa-map-pin'}"></i> ${yaVisitado ? 'Visitado' : 'Estuve aquí'}
    </button>`;

    let estadoHTML = '';
    if(l.horarios && Array.isArray(l.horarios)) {
        const hora = new Date().getHours();
        const abierto = hora >= l.horarios[0] && hora < l.horarios[1];
        estadoHTML = abierto ? `<span class="badge-estado abierto">Abierto</span>` : `<span class="badge-estado cerrado">Cerrado</span>`;
    }

    const esFav = favoritos.includes(l.nombre);
    const corazonClass = esFav ? 'es-favorito' : '';
    const iconClass = esFav ? 'fas' : 'far';
    
    f.innerHTML = `
        <button onclick="toggleFavorito('${l.nombre}')" id="btn-fav-ficha" class="btn-fav ${corazonClass}"><i class="${iconClass} fa-heart"></i></button>
        <button onclick="cerrarFicha()" class="btn-close-ficha">×</button>
        ${imagenHTML}
        <div style="display:flex; align-items:flex-start; justify-content:space-between; margin-top:${margenExtra}; margin-bottom: 10px;">
            <h2 style="font-size:1.35rem; margin:0; line-height:1.2; text-align:left; flex:1; padding-right:10px;">${l.nombre}</h2>
            <button onclick="leerDescripcion('${textoTTS}')" class="btn-tts"><i class="fas fa-volume-up"></i></button>
        </div>
        <div style="display:flex; justify-content:flex-start; align-items:center; gap:8px; margin-bottom:18px;">
            <span class="badge-tipo">${l.tipo}</span>
            <span class="badge-star"><i class="fas fa-star"></i> ${l.estrellas || 4.5}</span>
            ${estadoHTML}
        </div>
        <p style="font-size:0.95rem; color:var(--text-sec); margin-bottom:25px; line-height:1.5;">${descHTML}</p>
        <div style="display:grid; grid-template-columns: 2fr 1fr; gap:15px; margin-bottom: 10px;">
             <button class="btn-primary" onclick="irRutaGPS(${l.lat}, ${l.lng})"><i class="fas fa-location-arrow"></i> IR AHORA</button>
             ${gmapsBtn}
        </div>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:10px;">
            ${shareBtn}
            ${checkInBtn}
        </div>
        ${wpBtn}
    `;
    f.classList.add('activa');
    history.pushState({modal: 'ficha'}, null, "");
}

function cerrarFicha() { 
    const f = document.getElementById('ficha-lugar');
    const sheet = document.getElementById('bottom-sheet');
    const fabControls = document.querySelector('.floating-controls');
    if(f) f.classList.remove('activa'); 
    if(sheet) { 
        sheet.classList.remove('oculto-total'); 
        sheet.classList.remove('abierto'); 
        sheet.classList.add('cerrado'); 
    }
    if(fabControls) fabControls.classList.remove('oculto-en-ruta');
    if(window.speechSynthesis) window.speechSynthesis.cancel();
}

window.toggleFavorito = function(nombre) {
    const idx = favoritos.indexOf(nombre);
    if(idx === -1) { favoritos.push(nombre); showToast("Guardado en favoritos"); } 
    else { favoritos.splice(idx, 1); showToast("Eliminado de favoritos"); }
    localStorage.setItem('favoritos_v1', JSON.stringify(favoritos));
    
    const btn = document.getElementById('btn-fav-ficha');
    if(btn) {
        btn.classList.toggle('es-favorito');
        const icon = btn.querySelector('i');
        icon.classList.toggle('fas'); icon.classList.toggle('far');
    }
    actualizarListaFavoritos(); 
};

function mostrarSkeleton(mostrar) {
    const container = document.getElementById('skeleton-container');
    if(!container) return;
    if(mostrar) { container.innerHTML = `<div class="skeleton-item"></div><div class="skeleton-item"></div><div class="skeleton-item"></div>`; container.style.display = 'block'; } 
    else { container.style.display = 'none'; container.innerHTML = ''; }
}

let speaking = false;
window.leerDescripcion = function(texto) {
    if ('speechSynthesis' in window) {
        if (speaking) { window.speechSynthesis.cancel(); speaking = false; return; }
        const utter = new SpeechSynthesisUtterance(texto);
        utter.lang = 'es-ES'; utter.rate = 0.9; 
        utter.onend = () => { speaking = false; };
        window.speechSynthesis.speak(utter);
        speaking = true;
        showToast("Reproduciendo audioguía...");
    } else { showToast("Tu celular no soporta audio"); }
};

window.toggleTransportMode = function() {
    currentTransportMode = (currentTransportMode === 'car') ? 'foot' : 'car';
    showToast(`Modo cambiado a: ${currentTransportMode === 'car' ? 'Auto 🚗' : 'Caminata 🚶'}`, "info");
    if (routingControl && userMarker) {
        const waypoints = routingControl.getWaypoints();
        if(waypoints && waypoints.length >= 2) { 
            const dest = waypoints[waypoints.length - 1].latLng; 
            if(dest) irRutaGPS(dest.lat, dest.lng); 
        }
    }
};

window.iniciarCircuito = function(tipo) {
    const puntos = circuitosData[tipo];
    if (!puntos) return;
    const waypoints = puntos.map(p => L.latLng(p[0], p[1]));
    
    prepararUIparaNavegacion();
    showToast(`Iniciando circuito ${tipo}...`, "info");
    
    if (routingControl) try { map.removeControl(routingControl); } catch(e){}
    routingControl = L.Routing.control({ 
        waypoints: waypoints, 
        router: new L.Routing.osrmv1({ language: 'es', profile: 'car' }),
        routeWhileDragging: false, 
        showAlternatives: false, 
        createMarker: () => null, 
        lineOptions: { styles: [{color: 'black', opacity: 0.4, weight: 10}, {color: '#FF9500', opacity: 1, weight: 7}] } 
    }).addTo(map);
    setupRoutingUI();
};

window.irRutaGPS = function(dLat, dLng) { 
    if (!userMarker) { alert("⚠️ Activando GPS... permite la ubicación."); iniciarGPS(true); return; }
    
    prepararUIparaNavegacion();
    showToast(`Calculando ruta (${currentTransportMode === 'car' ? 'Auto' : 'Pie'})...`, "info"); 
    iniciarGPS(true);
    
    const lineColor = currentTransportMode === 'car' ? '#30D158' : '#007AFF'; 
    if (routingControl) try { map.removeControl(routingControl); } catch(e){}
    
    routingControl = L.Routing.control({ 
        waypoints: [ L.latLng(userMarker.getLatLng()), L.latLng(dLat, dLng) ], 
        router: new L.Routing.osrmv1({ language: 'es', profile: currentTransportMode }),
        routeWhileDragging: false, 
        showAlternatives: true, 
        fitSelectedRoutes: true, 
        createMarker: () => null, 
        lineOptions: { styles: [{color: 'black', opacity: 0.4, weight: 10}, {color: lineColor, opacity: 1, weight: 7}] } 
    }).addTo(map);
    setupRoutingUI();
};

function prepararUIparaNavegacion() {
    cerrarFicha(); 
    document.querySelector('.top-ui-layer').classList.add('hide-up'); 
    document.getElementById('bottom-sheet').classList.add('oculto-total');
    document.querySelector('.floating-controls').classList.add('oculto-en-ruta');
}

function setupRoutingUI() {
    routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        const summary = routes[0].summary;
        const mins = Math.round(summary.totalTime / 60);
        const timeTxt = mins > 60 ? `${Math.floor(mins/60)} h ${mins%60} min` : `${mins} min`;
        const distTxt = (summary.totalDistance / 1000).toFixed(1) + " km";
        
        setTimeout(() => {
            const container = document.querySelector('.leaflet-routing-container');
            if(container) {
                container.classList.remove('expandido');
                const oldHeader = container.querySelector('.gps-header-custom');
                if(oldHeader) oldHeader.remove();
                
                const header = document.createElement('div');
                header.className = 'gps-header-custom';
                const modeIcon = currentTransportMode === 'car' ? 'fa-car' : 'fa-walking';
                
                header.innerHTML = `
                    <div class="gps-info-left">
                        <div class="gps-time">${timeTxt}</div>
                        <div class="gps-sub-info"><span><i class="fas ${modeIcon}"></i> ${distTxt}</span><span class="ver-pasos-btn">Detalles <i class="fas fa-chevron-down"></i></span></div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <div class="btn-toggle-mode" onclick="toggleTransportMode(event)"><i class="fas fa-exchange-alt"></i></div>
                        <div class="btn-stop-nav" onclick="cancelarRuta(event)"><i class="fas fa-times"></i></div>
                    </div>`;
                
                header.onclick = (ev) => { 
                    if(!ev.target.closest('.btn-stop-nav') && !ev.target.closest('.btn-toggle-mode')) { 
                        container.classList.toggle('expandido'); 
                    } 
                };
                container.insertBefore(header, container.firstChild);
            }
        }, 100);
    });
    routingControl.on('routingerror', function() { showToast("Error ruta. Reintentando...", "error"); });
}

window.cancelarRuta = function(e) { 
    if(e && e.stopPropagation) e.stopPropagation();
    if (routingControl) { try { map.removeControl(routingControl); } catch(err){} routingControl = null; } 
    document.querySelector('.top-ui-layer').classList.remove('hide-up');
    document.getElementById('bottom-sheet').classList.remove('oculto-total');
    document.querySelector('.floating-controls').classList.remove('oculto-en-ruta');
    if(userMarker) map.setView(userMarker.getLatLng(), 16); 
    if(gpsWatchId) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; }
    const container = document.querySelector('.leaflet-routing-container');
    if(container) container.remove(); 
}

function activarDeslizamiento() {
    const sheet = document.getElementById('bottom-sheet');
    const handle = document.querySelector('.sheet-handle-area');
    let startY = 0; let isDragging = false; let currentTranslateY = 0;
    
    const touchStart = (e) => { isDragging = true; startY = e.touches[0].clientY; sheet.style.transition = 'none'; currentTranslateY = sheet.classList.contains('abierto') ? 0 : (sheet.offsetHeight - 90); };
    const touchMove = (e) => { 
        if (!isDragging) return; 
        const y = e.touches[0].clientY; 
        const delta = y - startY; 
        let newPos = currentTranslateY + delta; 
        const maxClosed = sheet.offsetHeight - 90; 
        if (newPos < 0) newPos = newPos * 0.3; 
        if (newPos > maxClosed) newPos = maxClosed + (newPos - maxClosed) * 0.3; 
        sheet.style.transform = `translateY(${newPos}px)`; 
    };
    const touchEnd = () => { 
        if (!isDragging) return; 
        isDragging = false; 
        sheet.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'; 
        const style = window.getComputedStyle(sheet); 
        const currentVisualY = new DOMMatrix(style.transform).m42; 
        if (currentVisualY < (sheet.offsetHeight - 90) / 2) { toggleMenuSheet('abrir'); } else { toggleMenuSheet('cerrar'); } 
        setTimeout(() => { sheet.style.transform = ''; }, 50); 
    };
    handle.addEventListener('touchstart', touchStart, { passive: true }); 
    handle.addEventListener('touchmove', touchMove, { passive: false }); 
    handle.addEventListener('touchend', touchEnd);
}

function iniciarGPS(continuo = false) { 
    if(!navigator.geolocation) return;
    const onPos = (pos) => { 
        const latlng = [pos.coords.latitude, pos.coords.longitude]; 
        if(!userMarker) { 
            const userIcon = L.divIcon({className: 'user-location-dot', html: '<div class="dot-core"></div><div class="dot-pulse"></div>', iconSize: [20, 20]}); 
            userMarker = L.marker(latlng, {icon: userIcon}).addTo(map); 
        } else { userMarker.setLatLng(latlng); } 
    };
    if (continuo) { 
        if(gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId); 
        gpsWatchId = navigator.geolocation.watchPosition(onPos, err => console.log(err), {enableHighAccuracy: true}); 
    } else { 
        navigator.geolocation.getCurrentPosition(onPos, err => console.log(err), {enableHighAccuracy: true}); 
    }
}
document.addEventListener("visibilitychange", () => { if (document.hidden && gpsWatchId) { navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = null; } });

async function obtenerDireccionReversa(lat, lng) {
    const txt = document.getElementById('sos-direccion-text');
    txt.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando dirección...';
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await response.json();
        if (data && data.address) {
            const a = data.address;
            const calle = a.road || 'Calle desconocida';
            const altura = a.house_number || '';
            const zona = a.suburb || a.neighbourhood || a.city || '';
            const direccionCorta = `${calle} ${altura}, ${zona}`;
            txt.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${direccionCorta}`;
            window.sosDireccionCache = direccionCorta; 
        } else {
            txt.innerHTML = `<i class="fas fa-map-marker-alt"></i> Ubicación desconocida`;
            window.sosDireccionCache = "Ubicación desconocida";
        }
    } catch (e) {
        console.warn("Fallo Geocoding:", e);
        txt.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
        window.sosDireccionCache = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
}

window.abrirSOS = () => {
    abrirModal('modal-sos');
    const txt = document.getElementById('sos-direccion-text');
    if(userMarker) { const { lat, lng } = userMarker.getLatLng(); obtenerDireccionReversa(lat, lng); } 
    else { txt.innerText = "Obteniendo satélites..."; iniciarGPS(false); setTimeout(() => { if(userMarker) { const { lat, lng } = userMarker.getLatLng(); obtenerDireccionReversa(lat, lng); } else { txt.innerText = "Señal GPS débil. Sal al exterior."; } }, 4000); }
};

window.compartirWpSOS = () => {
    let msg = "🚨 ¡AYUDA! 🚨\nEstoy en: " + (window.sosDireccionCache || "Mi ubicación actual") + ".";
    if(userMarker) { const coords = userMarker.getLatLng(); msg += `\n\nVer en mapa: https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`; }
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
};

window.sugerirLugar = () => { window.open(`https://wa.me/5493794XXXXXX?text=${encodeURIComponent("Hola, me gustaría sugerir un nuevo lugar para Ruta Correntina: ")}`, '_blank'); };

window.cargarTransporte = function() { 
    const contenedor = document.getElementById('contenedor-horarios'); 
    contenedor.innerHTML = ''; 
    datosTransporte.forEach(t => { 
        const item = document.createElement('div'); 
        item.className = 'transporte-card'; 
        item.style.borderBottom = "1px solid var(--border-color)";
        item.style.padding = "10px 0";
        item.innerHTML = `<h4 style="margin:0; color:var(--primary); font-size:1.1rem;">${t.empresa}</h4><div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-top:8px;"><span><strong>Ida:</strong> ${t.horarios.ida.join(', ')}</span><span><strong>Vuelta:</strong> ${t.horarios.vuelta.join(', ')}</span></div>`; 
        contenedor.appendChild(item); 
    }); 
    toggleMenuSheet('cerrar'); 
    abrirModal('modal-info'); 
};

window.cargarEventos = function() { /* Implementar futuro */ };

window.compartirLugarNativo = function(nombre, desc) { 
    const url = `${window.location.origin}${window.location.pathname}?lugar=${encodeURIComponent(nombre)}`; 
    if (navigator.share) { navigator.share({ title: 'Ruta Correntina', text: `¡Mira este lugar en Corrientes! ${nombre} - ${desc}`, url: url }).catch(console.error); } 
    else { mostrarQR(); } 
};

function toggleMenuSheet(accion) { 
    const sheet = document.getElementById('bottom-sheet'); 
    if(accion === 'abrir') { sheet.classList.remove('cerrado'); sheet.classList.add('abierto'); history.pushState({menu: 'abierto'}, null, ""); } 
    else if (accion === 'cerrar') { sheet.classList.remove('abierto'); sheet.classList.add('cerrado'); } 
    else { 
        sheet.classList.toggle('abierto'); 
        sheet.classList.toggle('cerrado'); 
        if(sheet.classList.contains('abierto')) history.pushState({menu: 'abierto'}, null, ""); 
    } 
}

window.filtrarMapa = function(cat) { 
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); 
    const chips = document.querySelectorAll('.chip'); 
    for(let c of chips) { if(c.innerText.toLowerCase().includes(cat) || c.getAttribute('onclick').includes(cat)) c.classList.add('active'); } 
    
    if(cat === 'todos') { renderizarMarcadores(allLugares); } 
    else if(cat === 'favoritos') { 
        const favs = allLugares.filter(l => favoritos.includes(l.nombre)); 
        renderizarMarcadores(favs); 
        if(favs.length === 0) showToast("Aún no tienes favoritos"); 
    } else { 
        const tiposPermitidos = categoriasUI[cat] || [cat]; 
        const filtrados = allLugares.filter(l => tiposPermitidos.includes(l.tipo ? l.tipo.toLowerCase() : '')); 
        renderizarMarcadores(filtrados); 
    } 
    toggleMenuSheet('abrir'); 
}

window.alternarTema = function() { 
    document.body.classList.toggle('dark-mode'); 
    const isDark = document.body.classList.contains('dark-mode'); 
    document.querySelector('#theme-toggle i').className = isDark ? 'fas fa-sun' : 'fas fa-moon'; 
    setTileLayer(isDark ? 'dark' : 'light'); 
}

window.expandirMenu = () => toggleMenuSheet('abrir');
window.toggleAcordeon = (id) => document.getElementById(id).classList.toggle('open');
window.verCercanos = () => { if(userMarker) { map.flyTo(userMarker.getLatLng(), 15); showToast("Buscando en tu zona..."); } else { showToast("Activa tu GPS"); iniciarGPS(true); } };
window.mostrarQR = () => { document.getElementById('qr-image').src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`; abrirModal('modal-qr'); };
window.centrarMapaUsuario = () => { if(userMarker) map.setView(userMarker.getLatLng(), 16); else { iniciarGPS(true); showToast("Buscando señal..."); } };
function abrirModal(id) { document.getElementById(id).style.display='block'; history.pushState({modal: id}, null, ""); }
window.cerrarModal = (id) => document.getElementById(id).style.display='none';
function showToast(msg, type) { const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg; if(type==='error') t.style.background = '#FF3B30'; document.getElementById('toast-container').appendChild(t); setTimeout(() => t.remove(), 3000); }

async function fetchClima() { 
    try { 
        const controller = new AbortController(); 
        const timeoutId = setTimeout(() => controller.abort(), 5000); 
        const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-27.46&longitude=-58.83&current_weather=true', { signal: controller.signal }); 
        clearTimeout(timeoutId); 
        if (!response.ok) throw new Error("Clima no disponible"); 
        const d = await response.json(); 
        document.getElementById('clima-widget').innerHTML = `<i class="fas fa-sun"></i> ${Math.round(d.current_weather.temperature)}°`; 
    } catch(e) { 
        document.getElementById('clima-widget').innerHTML = `<i class="fas fa-cloud"></i>`; 
    } 
}

initApp();