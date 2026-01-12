/* ==========================================
   RUTA CORRENTINA - LÓGICA V19 (FINAL)
   ========================================== */

let map, markers, userMarker, routingControl;
let allLugares = []; // Variable global para guardar datos

// --- 1. CONFIGURACIÓN DE ICONOS ---
const iconosMap = {
    'puente': 'https://cdn-icons-png.flaticon.com/128/2258/2258798.png',
    'costa': 'https://cdn-icons-png.flaticon.com/128/2847/2847171.png',
    'plaza': 'https://cdn-icons-png.flaticon.com/128/2316/2316680.png',
    'museo': 'https://cdn-icons-png.flaticon.com/128/2007/2007558.png',
    'iglesia': 'https://cdn-icons-png.flaticon.com/128/2165/2165089.png',
    'religioso': 'https://cdn-icons-png.flaticon.com/128/2165/2165089.png',
    'historico': 'https://cdn-icons-png.flaticon.com/128/2873/2873919.png',
    'comida': 'https://cdn-icons-png.flaticon.com/128/3448/3448609.png',
    'hotel': 'https://cdn-icons-png.flaticon.com/128/3009/3009489.png',
    'salud': 'https://cdn-icons-png.flaticon.com/128/3063/3063176.png',
    'farmacia': 'https://cdn-icons-png.flaticon.com/128/883/883407.png',
    'playa': 'https://cdn-icons-png.flaticon.com/128/2664/2664582.png',
    'turismo': 'https://cdn-icons-png.flaticon.com/128/3203/3203071.png',
    'default': 'https://cdn-icons-png.flaticon.com/128/149/149060.png'
};

// --- 2. MAPEO DE CATEGORÍAS (Traductor JSON -> UI) ---
const categoriasUI = {
    'turismo': ['turismo', 'plaza', 'costa', 'puente', 'museo', 'iglesia', 'historico', 'religioso', 'playa'],
    'gastronomia': ['comida', 'bar', 'cafe', 'restaurante'],
    'hospedaje': ['hotel', 'hostel', 'alojamiento'],
    'servicios': ['salud', 'farmacia', 'banco', 'servicios', 'policia']
};

const datosTransporte = [
    { empresa: "Chaco - Corrientes", horarios: { ida: ["Frecuencia 15'"], vuelta: ["24hs"] } },
    { empresa: "Línea 104", horarios: { ida: ["05:00", "23:00"], vuelta: ["Circular"] } }
];
const eventosCtes = [
    { fecha: "Ene/Feb", titulo: "Carnavales Oficiales", desc: "Corsódromo Nolo Alias. Fiesta Nacional." },
    { fecha: "Todo el año", titulo: "Peña en Punta Tacuara", desc: "Música en vivo los domingos." }
];

// --- 3. INICIO DE LA APP ---
async function initApp() {
    initMap();
    setTimeout(() => {
        const s = document.getElementById('splash-screen');
        if(s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 500); }
    }, 2000);

    try {
        const response = await fetch('lugares.json');
        const data = await response.json();
        
        // Aplanar el JSON (manejar tu formato específico)
        let listaPlana = [];
        if(Array.isArray(data) && data[0]) {
            Object.keys(data[0]).forEach(key => {
                const items = data[0][key];
                items.forEach(item => {
                    if(item.lat_lng) { item.lat = item.lat_lng[0]; item.lng = item.lat_lng[1]; }
                    if(!item.tipo) item.tipo = key.toLowerCase();
                    listaPlana.push(item);
                });
            });
        } else { listaPlana = data; }
        
        allLugares = listaPlana;
        renderizarMarcadores(allLugares);
    } catch (e) {
        console.error("Error JSON:", e);
        showToast("Error cargando lugares.json", "error");
    }

    iniciarGPS();
    fetchClima();
}

// --- 4. MAPA ---
function initMap() {
    map = L.map('map', { zoomControl: false }).setView([-27.469, -58.830], 14);
    setTileLayer('light');
    markers = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 40 });
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

// --- 5. RENDERIZADO ---
function renderizarMarcadores(lista) {
    markers.clearLayers();
    ['turismo', 'gastronomia', 'hospedaje', 'servicios'].forEach(c => {
        const ul = document.getElementById(`lista-${c}`);
        if(ul) ul.innerHTML = '';
    });

    lista.forEach(l => {
        if (!l.lat || !l.lng) return;

        let tipoClean = l.tipo ? l.tipo.toLowerCase() : 'default';
        let iconUrl = iconosMap[tipoClean] || iconosMap.default;
        
        let icon = L.icon({ 
            iconUrl: iconUrl, iconSize: [36, 36], iconAnchor: [18, 36], 
            popupAnchor: [0, -30], className: 'custom-marker' 
        });
        
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
            li.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-weight:500">${l.nombre}</span><small style="color:var(--text-sec); font-size:0.75rem">${l.tipo}</small></div>`;
            li.onclick = () => { map.flyTo([l.lat, l.lng], 17); mostrarFicha(l); toggleMenuSheet('cerrar'); };
            ul.appendChild(li);
        }
    });
}

// --- 6. FICHA DETALLE ---
function mostrarFicha(l) {
    const f = document.getElementById('ficha-lugar');
    const imagenHTML = l.img ? `<img src="${l.img}" onerror="this.style.display='none'" style="width:100%; height:140px; object-fit:cover; border-radius:12px; margin-bottom:10px;">` : '';
    const descHTML = l.desc || 'Sin descripción disponible.';
    const wpBtn = l.wp ? `<a href="https://wa.me/${l.wp}" target="_blank" class="btn-primary" style="background:#25D366; margin-top:5px"><i class="fab fa-whatsapp"></i> Contactar</a>` : '';

    f.innerHTML = `
        <button onclick="cerrarFicha()" class="btn-close-ficha">×</button>
        ${imagenHTML}
        <h2 style="font-size:1.4rem; margin:5px 0;">${l.nombre}</h2>
        <div style="display:flex; justify-content:center; gap:5px; margin-bottom:10px;">
            <span class="badge-tipo">${l.tipo}</span>
            <span class="badge-star"><i class="fas fa-star"></i> ${l.estrellas || 4.5}</span>
        </div>
        <p style="font-size:0.95rem; color:var(--text-sec); margin-bottom:15px;">${descHTML}</p>
        <button class="btn-primary" onclick="irRutaGPS(${l.lat}, ${l.lng})"><i class="fas fa-location-arrow"></i> Cómo llegar</button>
        ${wpBtn}
    `;
    f.classList.add('activa');
}
function cerrarFicha() { document.getElementById('ficha-lugar').classList.remove('activa'); }

// --- 7. SISTEMA GPS CORREGIDO (Uber/Waze Style) ---
window.irRutaGPS = function(dLat, dLng) { 
    if (!userMarker) { 
        alert("⚠️ Activando GPS... permite la ubicación.");
        iniciarGPS(); 
        return; 
    }
    
    // Preparar interfaz (ocultar menús)
    cerrarFicha(); 
    toggleMenuSheet('cerrar');
    document.querySelector('.top-ui-layer').classList.add('hide-up'); 
    document.getElementById('bottom-sheet').classList.add('oculto-total');

    if (routingControl) try { map.removeControl(routingControl); } catch(e){}
    
    showToast("Calculando ruta...", "info"); 

    // Configurar Routing Machine
    routingControl = L.Routing.control({ 
        waypoints: [ L.latLng(userMarker.getLatLng()), L.latLng(dLat, dLng) ], 
        router: new L.Routing.osrmv1({ language: 'es', profile: 'car' }),
        routeWhileDragging: false, 
        showAlternatives: false,
        fitSelectedRoutes: true, 
        createMarker: () => null, 
        lineOptions: { 
            styles: [
                {color: 'black', opacity: 0.4, weight: 10}, // Borde
                {color: '#30D158', opacity: 1, weight: 7}   // Línea Verde
            ] 
        } 
    }).addTo(map);

    // PERSONALIZAR LA TARJETA
    routingControl.on('routesfound', function(e) {
        const routes = e.routes;
        const summary = routes[0].summary;
        const mins = Math.round(summary.totalTime / 60);
        const timeTxt = mins > 60 ? `${Math.floor(mins/60)} h ${mins%60} min` : `${mins} min`;
        const distTxt = (summary.totalDistance / 1000).toFixed(1) + " km";

        setTimeout(() => {
            const container = document.querySelector('.leaflet-routing-container');
            if(container) {
                container.classList.remove('expandido'); // Empezar cerrado
                const oldHeader = container.querySelector('.gps-header-custom');
                if(oldHeader) oldHeader.remove();

                const header = document.createElement('div');
                header.className = 'gps-header-custom';
                header.innerHTML = `
                    <div class="gps-info-main">
                        <span class="gps-time">${timeTxt}</span>
                        <span class="gps-dist">Distancia: ${distTxt}</span>
                    </div>
                    <i class="fas fa-chevron-up gps-chevron"></i>
                `;
                
                header.onclick = (e) => {
                    e.stopPropagation();
                    container.classList.toggle('expandido');
                };

                container.insertBefore(header, container.firstChild);
            }
        }, 100);
    });

    routingControl.on('routingerror', function() {
        showToast("Error. Abriendo Maps...", "error");
        setTimeout(() => {
             window.open(`https://www.google.com/maps/dir/?api=1&destination=${dLat},${dLng}`, '_blank');
             cancelarRuta();
        }, 1500);
    });

    // Botón Flotante para salir
    const btn = document.getElementById('btn-cancelar-ruta');
    btn.innerHTML = '<i class="fas fa-times"></i> Terminar Viaje'; 
    btn.onclick = cancelarRuta; 
    btn.style.display = 'flex';
};

function cancelarRuta() { 
    if (routingControl) { try { map.removeControl(routingControl); } catch(e){} routingControl = null; } 
    document.getElementById('btn-cancelar-ruta').style.display = 'none'; 
    document.querySelector('.top-ui-layer').classList.remove('hide-up');
    document.getElementById('bottom-sheet').classList.remove('oculto-total');
    if(userMarker) map.setView(userMarker.getLatLng(), 16); 
}

// --- 8. UTILS ---
function iniciarGPS() { 
    if(navigator.geolocation) { 
        navigator.geolocation.watchPosition(
            pos => { 
                const latlng = [pos.coords.latitude, pos.coords.longitude];
                if(!userMarker) {
                    const userIcon = L.divIcon({className: 'user-location-dot', html: '<div class="dot-core"></div><div class="dot-pulse"></div>', iconSize: [20, 20]});
                    userMarker = L.marker(latlng, {icon: userIcon}).addTo(map);
                } else { userMarker.setLatLng(latlng); } 
            }, 
            err => console.log("GPS Error", err), {enableHighAccuracy: true}
        ); 
    } 
}

function toggleMenuSheet(accion) {
    const sheet = document.getElementById('bottom-sheet');
    if(accion === 'abrir') { sheet.classList.remove('cerrado'); sheet.classList.add('abierto'); }
    else if (accion === 'cerrar') { sheet.classList.remove('abierto'); sheet.classList.add('cerrado'); }
    else { sheet.classList.toggle('abierto'); sheet.classList.toggle('cerrado'); }
}

window.filtrarMapa = function(cat) {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    const chips = document.querySelectorAll('.chip');
    for(let c of chips) { if(c.innerText.toLowerCase().includes(cat) || c.getAttribute('onclick').includes(cat)) c.classList.add('active'); }

    if(cat === 'todos') { renderizarMarcadores(allLugares); } 
    else {
        const tiposPermitidos = categoriasUI[cat] || [cat];
        const filtrados = allLugares.filter(l => tiposPermitidos.includes(l.tipo ? l.tipo.toLowerCase() : ''));
        renderizarMarcadores(filtrados);
        toggleMenuSheet('abrir');
        setTimeout(() => {
            document.querySelectorAll('.categoria-item').forEach(i => i.classList.remove('open'));
            const target = document.getElementById('cat-'+cat);
            if(target) target.classList.add('open');
        }, 100);
    }
}

window.alternarTema = function() { 
    document.body.classList.toggle('dark-mode'); 
    const isDark = document.body.classList.contains('dark-mode'); 
    document.querySelector('#theme-toggle i').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
    setTileLayer(isDark ? 'dark' : 'light');
}

window.filtrarPorBusqueda = () => { 
    let txt = document.getElementById('buscador-input').value.toLowerCase(); 
    const encontrados = allLugares.filter(l => l.nombre.toLowerCase().includes(txt) || (l.tipo && l.tipo.includes(txt)));
    renderizarMarcadores(encontrados);
}
window.expandirMenu = () => toggleMenuSheet('abrir');
window.toggleAcordeon = (id) => document.getElementById(id).classList.toggle('open');
window.verCercanos = () => { if(userMarker) { map.flyTo(userMarker.getLatLng(), 15); showToast("Buscando en tu zona..."); } else { showToast("Activa tu GPS"); iniciarGPS(); } };
window.mostrarQR = () => { document.getElementById('qr-image').src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${window.location.href}`; abrirModal('modal-qr'); };
window.centrarMapaUsuario = () => { if(userMarker) map.setView(userMarker.getLatLng(), 16); else { iniciarGPS(); showToast("Buscando señal..."); } };
function abrirModal(id) { document.getElementById(id).style.display='block'; }
window.cerrarModal = (id) => document.getElementById(id).style.display='none';
function showToast(msg, type) { 
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg; 
    if(type==='error') t.style.background = '#FF3B30';
    document.getElementById('toast-container').appendChild(t); 
    setTimeout(() => t.remove(), 3000); 
}
function fetchClima() { fetch('https://api.open-meteo.com/v1/forecast?latitude=-27.46&longitude=-58.83&current_weather=true').then(r=>r.json()).then(d=>{ document.getElementById('clima-widget').innerHTML = `<i class="fas fa-sun"></i> ${Math.round(d.current_weather.temperature)}°`; }).catch(()=>null); }

// Iniciar
initApp();