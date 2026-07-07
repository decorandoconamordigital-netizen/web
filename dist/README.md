# Paquetes ZIP del Panel EUCA

Los archivos `EUCA-PANEL-*.zip` se generan localmente y no se suben al repositorio porque son binarios. Algunas plataformas de pull request rechazan archivos binarios dentro del diff.

Para generar todos los ZIP solicitados, ejecuta desde la raíz del proyecto:

```bash
./scripts/build-zips.sh
```

El comando crea:

- `EUCA-PANEL-01_Base.zip`
- `EUCA-PANEL-02_Contabilidad.zip`
- `EUCA-PANEL-03_Participantes.zip`
- `EUCA-PANEL-04_Puestos.zip`
- `EUCA-PANEL-05_Configuracion.zip`
- `EUCA-PANEL-06_Backups.zip`
- `EUCA-PANEL-FINAL.zip`
