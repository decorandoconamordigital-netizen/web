function agregarMovimiento(tipo, monto, detalle) {
    // tipo: 'ingreso' o 'gasto'
    let caja = JSON.parse(localStorage.getItem('db_caja')) || [];
    
    caja.push({
        id: Date.now(),
        tipo: tipo,
        monto: parseFloat(monto),
        detalle: detalle,
        fecha: new Date().toLocaleDateString()
    });

    localStorage.setItem('db_caja', JSON.stringify(caja));
    calcularBalance();
}

function calcularBalance() {
    let caja = JSON.parse(localStorage.getItem('db_caja')) || [];
    let total = 0;

    caja.forEach(mov => {
        if (mov.tipo === 'ingreso') total += mov.monto;
        if (mov.tipo === 'gasto') total -= mov.monto;
    });

    console.log("Saldo Actual en Caja Local: $" + total);
    // Aquí actualizas tu HTML de contabilidad para mostrar el total
}