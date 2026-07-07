const grid = document.getElementById('grid-puestos');
const zonaAsignacion = document.getElementById('zona-asignacion');
const selectFeriante = document.getElementById('select-feriante');
const puestoElegidoTxt = document.getElementById('puesto-elegido');

let puestoSeleccionadoActualmente = null;

// Inicializar mapa de puestos (1 al 40)
function initMapa() {
    grid.innerHTML = '';
    // Traer el estado de los puestos guardados (ej: { "1": "feriante_123", "5": "feriante_456" })
    const mapaPuestos = JSON.parse(localStorage.getItem('db_mapa_puestos')) || {};

    for (let i = 1; i <= 40; i++) {
        const btn = document.createElement('button');
        btn.classList.add('puesto-btn');
        btn.innerText = i;
        
        if (mapaPuestos[i]) {
            btn.classList.add('ocupado'); // Si tiene ID de feriante, se pinta rojo
        }

        btn.onclick = () => abrirVentanaAsignacion(i, mapaPuestos[i]);
        grid.appendChild(btn);
    }
}

function abrirVentanaAsignacion(numeroPuesto, ferianteId) {
    puestoSeleccionadoActualmente = numeroPuesto;
    puestoElegidoTxt.innerText = numeroPuesto;
    zonaAsignacion.classList.remove('hidden');

    // Cargar los feriantes registrados en el desplegable
    const feriantes = JSON.parse(localStorage.getItem('db_feriantes')) || [];
    selectFeriante.innerHTML = '<option value="">-- Seleccionar Feriante --</option>' + 
        feriantes.map(f => `<option value="${f.id}" ${f.id === ferianteId ? 'selected' : ''}>${f.nombre}</option>`).join('');
}

function confirmarAsignacion() {
    const ferianteId = selectFeriante.value;
    if (!ferianteId) return alert("Selecciona un feriante");

    let mapaPuestos = JSON.parse(localStorage.getItem('db_mapa_puestos')) || {};
    mapaPuestos[puestoSeleccionadoActualmente] = ferianteId; // Vincular puesto con feriante
    
    localStorage.setItem('db_mapa_puestos', JSON.stringify(mapaPuestos));
    zonaAsignacion.classList.add('hidden');
    initMapa(); // Recargar mapa visual
}

function liberarPuesto() {
    let mapaPuestos = JSON.parse(localStorage.getItem('db_mapa_puestos')) || {};
    delete mapaPuestos[puestoSeleccionadoActualmente];
    
    localStorage.setItem('db_mapa_puestos', JSON.stringify(mapaPuestos));
    zonaAsignacion.classList.add('hidden');
    initMapa();
}

initMapa();