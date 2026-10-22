# Mapa Rodaditas

Mapa de los barrios de Roldanillo (Valle del Cauca) para el Club Rodaditas. Buscas tu barrio en el mapa y puedes descargar la tarjeta de tu barrio para imprimir.

Sitio: https://deauveide.github.io/rodaditas-mapa/

## Créditos de datos

- PBOT Roldanillo (límites de barrios)
- Esri World Imagery (imagen satelital)
- © colaboradores de OpenStreetMap (calles y datos de base)
- TerraLab
- OpenMoji, licencia CC BY-SA 4.0 (íconos)

## Cómo se regenera

1. Cerrar QGIS.
2. En el repositorio del proyecto: `python-qgis.bat scripts\web.py todo` (debe terminar con `problemas: 0`).
3. Copiar `web/` en este repositorio sin la carpeta `pruebas/` y conservando `.git`, `.nojekyll` y este README: `robocopy web ..\rodaditas-mapa-sitio /MIR /XD .git pruebas /XF .nojekyll README.md`.
4. `git add -A`, `git commit` y `git push` aquí.
5. Esperar a que GitHub Pages termine de construir.
