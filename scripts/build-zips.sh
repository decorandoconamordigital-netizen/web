#!/usr/bin/env bash
set -euo pipefail

# Genera los respaldos ZIP solicitados para entrega manual.
# Los archivos ZIP no se versionan porque muchas plataformas de PR rechazan binarios.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
FILES=(
  index.html
  inicio.html
  assets
  modulos
)
VERSIONS=(
  EUCA-PANEL-01_Base
  EUCA-PANEL-02_Contabilidad
  EUCA-PANEL-03_Participantes
  EUCA-PANEL-04_Puestos
  EUCA-PANEL-05_Configuracion
  EUCA-PANEL-06_Backups
  EUCA-PANEL-FINAL
)

mkdir -p "$DIST_DIR"
rm -f "$DIST_DIR"/*.zip

for version in "${VERSIONS[@]}"; do
  (cd "$ROOT_DIR" && zip -qr "$DIST_DIR/$version.zip" "${FILES[@]}")
  echo "Generado: dist/$version.zip"
done
