const form = document.getElementById('form-feriante');
const lista = document.getElementById('lista-feriantes');

// Escuchar cuando se envía el formulario
form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const nuevoFeriante = {
        id: 'feriante_' + Date.now(), // ID único para identificarlo después
        nombre: document.getElementById('nombre').value,
        rubro: document.getElementById('rubro').value,
        telefono: document.getElementById('telefono').value
    };

    // Traer los que ya existen, sumar el nuevo y volver a guardar
    let feriantes = JSON.parse(localStorage.getItem('db_feriantes')) || [];
    feriantes.push(nuevoFeriante);
    localStorage.setItem('db_feriantes', JSON.stringify(feriantes));

    form.reset();
    renderFeriantes();
});

// Dibujar la lista en pantalla
function renderFeriantes() {
    let feriantes = JSON.parse(localStorage.getItem('db_feriantes')) || [];
    lista.innerHTML = feriantes.map(f => `<li><strong>${f.nombre}</strong> - ${f.rubro} (${f.telefono})</li>`).join('');
}

// Cargar al iniciar
renderFeriantes();