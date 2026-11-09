// Medidas en metros de terreno → píxeles de MapLibre: así calles, cauces y flechas conservan su
// tamaño real a cualquier zoom, como en las tarjetas (QGIS, unidades de mapa).

const CIRCUNFERENCIA = 40075016.686; // m, ecuador WGS84
const LATITUD = 4.41; // Roldanillo
const TESELA = 512; // px por tesela en MapLibre

export function metrosPorPixel(z, lat = LATITUD) {
  return (CIRCUNFERENCIA * Math.cos((lat * Math.PI) / 180)) / (TESELA * 2 ** z);
}

// El tamaño en píxeles crece como 2^z: la interpolación exponencial base 2 es exacta en todo zoom.
export function metros(m) {
  return ["interpolate", ["exponential", 2], ["zoom"], 12, m / metrosPorPixel(12), 22, m / metrosPorPixel(22)];
}

// line-dasharray va en múltiplos del ancho de la línea
export function trazos(largo, ancho) {
  return [largo / ancho, largo / ancho];
}
