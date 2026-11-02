# Imágenes satelitales

Imágenes de origen que se usan para delimitar los techos y construir el mapa. No las carga el sitio web; son material fuente.

| Archivo | Qué es |
|---|---|
| `charter_pleiades_sertit.jpg` | Mapa de impacto de ICube-SERTIT (activación de cartografía de emergencia) sobre imagen Pléiades de 0,5 m del 13/08/2026, posterior al sismo. |
| `esri_05m.tif` | Esri World Imagery, 0,5 m (2017), recortada a Roldanillo. Fondo del mapa general, fuente del color de los techos y base del índice de verdor. Se guarda con Git LFS porque pesa 132 MB. |
| `esri_05m.tif.aux.xml` | Estadísticas del GeoTIFF (GDAL). |

Para clonar el TIF completo hace falta Git LFS (`git lfs install`).
