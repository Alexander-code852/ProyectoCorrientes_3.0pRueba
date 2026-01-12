/* ==========================================
   RUTA CORRENTINA - LÓGICA V31 (CLEAN & FIXED)
   ========================================== */

let map, markers, userMarker, routingControl, gpsWatchId;
let allLugares = []; 
let favoritos = JSON.parse(localStorage.getItem('favoritos_v1') || '[]');

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

const categoriasUI = {
    'turismo': ['turismo', 'plaza', 'costa', 'puente', 'museo', 'iglesia', 'historico', 'religioso', 'playa'],
    'gastronomia': ['comida', 'bar', 'cafe', 'restaurante'],
    'hospedaje': ['hotel', 'hostel', 'alojamiento'],
    'servicios': ['salud', 'farmacia', 'banco', 'servicios', 'policia']
};

const datosTransporte = [
    { empresa: "Chaco - Corrientes", horarios: { ida: ["Frecuencia 15'"], vuelta: ["24hs"] } },
    { empresa: "Línea 104", horarios: { ida: ["05:00", "23:00"], vuelta: ["Circular"] } },
    { empresa: "Línea 103", horarios: { ida: ["06:00", "00:00"], vuelta: ["Puerto"] } }
];
const eventosCtes = [
    { fecha: "Ene/Feb", titulo: "Carnavales Oficiales", desc: "Corsódromo Nolo Alias. Fiesta Nacional." },
    { fecha: "Todo el año", titulo: "Peña en Punta Tacuara", desc: "Música en vivo los domingos." },
    { fecha: "Julio", titulo: "Feria del Libro", desc: "Costanera Sur." }
];

async function initApp() {
    initMap();
    mostrarSkeleton(true); 
    
    setTimeout(() => {
        const s = document.getElementById('splash-screen');
        if(s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 500); }
    }, 2000);

    try {
        const response = await fetch('lugares.json');
        const data = await response.json();
        
        let listaPlana = [];
        if(Array.isArray(data) && data[0]) {
            Object.keys(data[0]).forEach(key => {
                const items = data[0][key];
                const categoriaKey = key.toLowerCase(); 
                items.forEach(item => {
                    if(item.lat_lng) { item.lat = item.lat_lng[0]; item.lng = item.lat_lng[1]; }
                    if(!item.tipo) item.tipo = categoriaKey;
                    else item.tipo = item.tipo.toLowerCase();
                    listaPlana.push(item);
                });
            });
        } else { listaPlana = data; }
        
        allLugares = listaPlana;
        renderizarMarcadores(allLugares);
        mostrarSkeleton(false);
    } catch (e) {
        console.error("Error JSON:", e);
        mostrarSkeleton(false);
        showToast("Modo Offline activado", "info");
    }

    activarDeslizamiento(); 
    iniciarGPS(false);
    fetchClima();
    window.addEventListener('popstate', handleBackButton);
}

function handleBackButton(event) {
    const modales = document.querySelectorAll('.modal');
    let accionRealizada = false;
    modales.forEach(m => {
        if(m.style.display === 'block') { m.style.display = 'none'; accionRealizada = true; }
    });
    if(accionRealizada) return;

    const ficha = document.getElementById('ficha-lugar');
    if (ficha && ficha.classList.contains('activa')) {
        cerrarFicha();
        return;
    }

    const sheet = document.getElementById('bottom-sheet');
    if (sheet && sheet.classList.contains('abierto')) {
        toggleMenuSheet('cerrar');
        return;
    }
}

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

function renderizarMarcadores(lista) {
    markers.clearLayers();
    ['turismo', 'gastronomia', 'hospedaje', 'servicios'].forEach(c => {
        const ul = document.getElementById(`lista-${c}`);
        if(ul) ul.innerHTML = '';
    });

    const emptyMsg = document.getElementById('empty-state-msg');
    const listContainer = document.getElementById('lista-principal-container');
    
    if (lista.length === 0) {
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
        let icon = L.icon({ iconUrl: iconUrl, iconSize: [36, 36], iconAnchor: [18, 36], popupAnchor: [0, -30], className: 'custom-marker' });
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

function mostrarFicha(l) {
    const f = document.getElementById('ficha-lugar');
    const imagenHTML = l.img ? `<img src="${l.img}" loading="lazy" onerror="this.style.display='none'" style="width:100%; height:140px; object-fit:cover; border-radius:12px; margin-bottom:10px;">` : '';
    const descHTML = l.desc || 'Sin descripción disponible.';
    const wpBtn = l.wp ? `<a href="https://wa.me/${l.wp}" target="_blank" class="btn-primary" style="background:#25D366; margin-top:5px"><i class="fab fa-whatsapp"></i> Contactar</a>` : '';
    const shareBtn = `<button onclick="compartirLugarNativo('${l.nombre}', '${l.desc}')" class="btn-primary" style="background:var(--bg-input); color:var(--text-main); margin-top:5px; font-size:0.9rem;"><i class="fas fa-share-alt"></i> Compartir</button>`;
    
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
        <button onclick="toggleFavorito('${l.nombre}')" id="btn-fav-${l.nombre.replace(/\s/g, '')}" class="btn-fav ${corazonClass}"><i class="${iconClass} fa-heart"></i></button>
        <button onclick="cerrarFicha()" class="btn-close-ficha">×</button>
        ${imagenHTML}
        <h2 style="font-size:1.4rem; margin:5px 0;">${l.nombre}</h2>
        <div style="display:flex; justify-content:center; align-items:center; gap:5px; margin-bottom:10px;">
            <span class="badge-tipo">${l.tipo}</span>
            <span class="badge-star"><i class="fas fa-star"></i> ${l.estrellas || 4.5}</span>
            ${estadoHTML}
        </div>
        <p style="font-size:0.95rem; color:var(--text-sec); margin-bottom:15px;">${descHTML}</p>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
             <button class="btn-primary" onclick="irRutaGPS(${l.lat}, ${l.lng})"><i class="fas fa-location-arrow"></i> Ir</button>
             ${shareBtn}
        </div>
        ${wpBtn}
    `;
    f.classList.add('activa');
    history.pushState({modal: 'ficha'}, null, "");
}
function cerrarFicha() { document.getElementById('ficha-lugar').classList.remove('activa'); }

window.toggleFavorito = function(nombre) {
    const idx = favoritos.indexOf(nombre);
    if(idx === -1) { favoritos.push(nombre); showToast("Guardado en favoritos"); } 
    else { favoritos.splice(idx, 1); showToast("Eliminado de favoritos"); }
    localStorage.setItem('favoritos_v1', JSON.stringify(favoritos));
    
    const btn = document.getElementById(`btn-fav-${nombre.replace(/\s/g, '')}`);
    if(btn) {
        btn.classList.toggle('es-favorito');
        const icon = btn.querySelector('i');
        icon.classList.toggle('fas');
        icon.classList.toggle('far');
    }
};

function mostrarSkeleton(mostrar) {
    const container = document.getElementById('skeleton-container');
    if(!container) return;
    if(mostrar) {
        container.innerHTML = `<div class="skeleton-item"></div><div class="skeleton-item"></div><div class="skeleton-item"></div><div class="skeleton-item"></div>`;
        container.style.display = 'block';
    } else {
        container.style.display = 'none';
        container.innerHTML = '';
    }
}

window.irRutaGPS = function(dLat, dLng) { 
    if (!userMarker) { alert("⚠️ Activando GPS... permite la ubicación."); iniciarGPS(true); return; }
    
    cerrarFicha(); toggleMenuSheet('cerrar');
    document.querySelector('.top-ui-layer').classList.add('hide-up'); 
    document.getElementById('bottom-sheet').classList.add('oculto-total');
    document.querySelector('.floating-controls').classList.add('oculto-en-ruta');

    if (routingControl) try { map.removeControl(routingControl); } catch(e){}
    showToast("Calculando ruta...", "info"); 
    iniciarGPS(true);

    routingControl = L.Routing.control({ 
        waypoints: [ L.latLng(userMarker.getLatLng()), L.latLng(dLat, dLng) ], 
        router: new L.Routing.osrmv1({ language: 'es', profile: 'car' }),
        routeWhileDragging: false, showAlternatives: false, fitSelectedRoutes: true, createMarker: () => null, 
        lineOptions: { styles: [{color: 'black', opacity: 0.4, weight: 10}, {color: '#30D158', opacity: 1, weight: 7}] } 
    }).addTo(map);

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
                header.innerHTML = `
                    <div class="gps-info-left">
                        <div class="gps-time">${timeTxt}</div>
                        <div class="gps-sub-info">
                            <span><i class="fas fa-car"></i> ${distTxt}</span>
                            <span class="ver-pasos-btn">Pasos <i class="fas fa-chevron-down"></i></span>
                        </div>
                    </div>
                    <div class="btn-stop-nav" onclick="cancelarRuta(event)"><i class="fas fa-times"></i></div>
                `;
                header.onclick = (e) => {
                    if(!e.target.closest('.btn-stop-nav')) {
                        container.classList.toggle('expandido');
                        const flecha = container.querySelector('.ver-pasos-btn i');
                        if(flecha) flecha.classList.toggle('fa-rotate-180');
                    }
                };
                container.insertBefore(header, container.firstChild);
            }
        }, 100);
    });
    routingControl.on('routingerror', function() {
        showToast("Error ruta. Abriendo Maps...", "error");
        setTimeout(() => { window.open(`https://www.google.com/maps/dir/?api=1&destination=${dLat},${dLng}&travelmode=driving`, '_blank'); cancelarRuta(); }, 1500);
    });
};

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
    const getInitialPosition = () => sheet.classList.contains('abierto') ? 0 : (sheet.offsetHeight - 90);
    const touchStart = (e) => { isDragging = true; startY = e.touches[0].clientY; sheet.style.transition = 'none'; currentTranslateY = getInitialPosition(); };
    const touchMove = (e) => { if (!isDragging) return; const y = e.touches[0].clientY; const delta = y - startY; let newPos = currentTranslateY + delta; const maxClosed = sheet.offsetHeight - 90; if (newPos < 0) newPos = newPos * 0.3; if (newPos > maxClosed) newPos = maxClosed + (newPos - maxClosed) * 0.3; sheet.style.transform = `translateY(${newPos}px)`; };
    const touchEnd = () => { if (!isDragging) return; isDragging = false; sheet.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)'; const style = window.getComputedStyle(sheet); const matrix = new DOMMatrix(style.transform); const currentVisualY = matrix.m42; const threshold = (sheet.offsetHeight - 90) / 2; if (currentVisualY < threshold) { toggleMenuSheet('abrir'); } else { toggleMenuSheet('cerrar'); } setTimeout(() => { sheet.style.transform = ''; }, 50); };
    handle.addEventListener('touchstart', touchStart, { passive: true }); handle.addEventListener('touchmove', touchMove, { passive: false }); handle.addEventListener('touchend', touchEnd);
}

function iniciarGPS(continuo = false) { 
    if(!navigator.geolocation) return;
    const onPos = (pos) => { const latlng = [pos.coords.latitude, pos.coords.longitude]; if(!userMarker) { const userIcon = L.divIcon({className: 'user-location-dot', html: '<div class="dot-core"></div><div class="dot-pulse"></div>', iconSize: [20, 20]}); userMarker = L.marker(latlng, {icon: userIcon}).addTo(map); } else { userMarker.setLatLng(latlng); } };
    if (continuo) { if(gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId); gpsWatchId = navigator.geolocation.watchPosition(onPos, err => console.log(err), {enableHighAccuracy: true}); } else { navigator.geolocation.getCurrentPosition(onPos, err => console.log(err), {enableHighAccuracy: true}); }
}

window.cargarTransporte = function() { const contenedor = document.getElementById('contenedor-horarios'); contenedor.innerHTML = ''; datosTransporte.forEach(t => { const item = document.createElement('div'); item.className = 'transporte-card'; item.innerHTML = `<h4 style="margin:0; color:var(--primary); font-size:1.1rem;">${t.empresa}</h4><div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-top:8px;"><span><strong>Ida:</strong> ${t.horarios.ida.join(', ')}</span><span><strong>Vuelta:</strong> ${t.horarios.vuelta.join(', ')}</span></div>`; contenedor.appendChild(item); }); toggleMenuSheet('cerrar'); abrirModal('modal-info'); };
window.cargarEventos = function() { const container = document.getElementById('eventos-container'); container.innerHTML = ''; eventosCtes.forEach(e => { const div = document.createElement('div'); div.className = 'evento-item'; div.innerHTML = `<div class="evento-fecha">${e.fecha}</div><div class="evento-info"><strong style="display:block; font-size:1rem;">${e.titulo}</strong><p>${e.desc}</p></div>`; container.appendChild(div); }); toggleMenuSheet('cerrar'); abrirModal('modal-eventos'); };
window.compartirLugarNativo = function(nombre, desc) { if (navigator.share) { navigator.share({ title: 'Ruta Correntina', text: `¡Mira este lugar en Corrientes! ${nombre} - ${desc}`, url: window.location.href }).catch(console.error); } else { mostrarQR(); } };
function toggleMenuSheet(accion) { const sheet = document.getElementById('bottom-sheet'); if(accion === 'abrir') { sheet.classList.remove('cerrado'); sheet.classList.add('abierto'); history.pushState({menu: 'abierto'}, null, ""); } else if (accion === 'cerrar') { sheet.classList.remove('abierto'); sheet.classList.add('cerrado'); } else { sheet.classList.toggle('abierto'); sheet.classList.toggle('cerrado'); if(sheet.classList.contains('abierto')) history.pushState({menu: 'abierto'}, null, ""); } }
window.filtrarMapa = function(cat) { 
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); 
    const chips = document.querySelectorAll('.chip'); 
    for(let c of chips) { if(c.innerText.toLowerCase().includes(cat) || c.getAttribute('onclick').includes(cat)) c.classList.add('active'); }
    if(cat === 'todos') { renderizarMarcadores(allLugares); } 
    else if(cat === 'favoritos') { const favs = allLugares.filter(l => favoritos.includes(l.nombre)); renderizarMarcadores(favs); if(favs.length === 0) showToast("Aún no tienes favoritos"); } 
    else { const tiposPermitidos = categoriasUI[cat] || [cat]; const filtrados = allLugares.filter(l => tiposPermitidos.includes(l.tipo ? l.tipo.toLowerCase() : '')); renderizarMarcadores(filtrados); }
    toggleMenuSheet('abrir'); 
}
window.alternarTema = function() { document.body.classList.toggle('dark-mode'); const isDark = document.body.classList.contains('dark-mode'); document.querySelector('#theme-toggle i').className = isDark ? 'fas fa-sun' : 'fas fa-moon'; setTileLayer(isDark ? 'dark' : 'light'); }
window.filtrarPorBusqueda = () => { let txt = document.getElementById('buscador-input').value.toLowerCase(); const encontrados = allLugares.filter(l => l.nombre.toLowerCase().includes(txt) || (l.tipo && l.tipo.includes(txt))); renderizarMarcadores(encontrados); }
window.expandirMenu = () => toggleMenuSheet('abrir');
window.toggleAcordeon = (id) => document.getElementById(id).classList.toggle('open');
window.verCercanos = () => { if(userMarker) { map.flyTo(userMarker.getLatLng(), 15); showToast("Buscando en tu zona..."); } else { showToast("Activa tu GPS"); iniciarGPS(true); } };
window.mostrarQR = () => { document.getElementById('qr-image').src=`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${window.location.href}`; abrirModal('modal-qr'); };
window.centrarMapaUsuario = () => { if(userMarker) map.setView(userMarker.getLatLng(), 16); else { iniciarGPS(true); showToast("Buscando señal..."); } };
function abrirModal(id) { document.getElementById(id).style.display='block'; history.pushState({modal: id}, null, ""); }
window.cerrarModal = (id) => document.getElementById(id).style.display='none';
function showToast(msg, type) { const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg; if(type==='error') t.style.background = '#FF3B30'; document.getElementById('toast-container').appendChild(t); setTimeout(() => t.remove(), 3000); }
async function fetchClima() { try { const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 5000); const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=-27.46&longitude=-58.83&current_weather=true', { signal: controller.signal }); clearTimeout(timeoutId); if (!response.ok) throw new Error("Clima no disponible"); const d = await response.json(); document.getElementById('clima-widget').innerHTML = `<i class="fas fa-sun"></i> ${Math.round(d.current_weather.temperature)}°`; } catch(e) { console.warn("Clima off:", e); document.getElementById('clima-widget').innerHTML = `<i class="fas fa-cloud"></i>`; } }

initApp();