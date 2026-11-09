// Utilidades del visor sin DOM: se prueban con Node (web/pruebas/visor.test.mjs).

// ¿Puede el navegador dibujar el mapa? MapLibre 6 exige WebGL 2; cualquier error cuenta como no
export function soportaWebGL(crearCanvas = () => document.createElement("canvas")) {
  try {
    return Boolean(crearCanvas().getContext("webgl2"));
  } catch {
    return false;
  }
}

// [[oeste, sur], [este, norte]] de un Polygon o MultiPolygon, con todas sus partes y anillos
export function cajaDe(geometria) {
  const caja = [[Infinity, Infinity], [-Infinity, -Infinity]];
  const recorrer = (c) => {
    if (typeof c[0] === "number") {
      caja[0][0] = Math.min(caja[0][0], c[0]);
      caja[0][1] = Math.min(caja[0][1], c[1]);
      caja[1][0] = Math.max(caja[1][0], c[0]);
      caja[1][1] = Math.max(caja[1][1], c[1]);
    } else {
      c.forEach(recorrer);
    }
  };
  recorrer(geometria.coordinates);
  return caja;
}

// márgenes para encuadrar sin quedar bajo el buscador (arriba) ni la hoja del barrio (abajo).
// En pantallas bajas (celular horizontal) se reducen en proporción: si suman más del 70 % del alto,
// MapLibre no encuadra.
export function paddingVisor({ arriba, abajo, alto = Infinity }) {
  let [top, bottom] = [arriba + 16, abajo + 16];
  const tope = 0.7 * alto;
  if (top + bottom > tope) {
    const f = tope / (top + bottom);
    [top, bottom] = [Math.floor(top * f), Math.floor(bottom * f)];
  }
  return { top, bottom, left: 20, right: 20 };
}
