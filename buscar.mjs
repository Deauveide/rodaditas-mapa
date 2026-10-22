// Búsqueda de barrios y botones de la ficha. Módulo puro (sin DOM): lo usan app.js y las pruebas.

/** Minúsculas, sin tildes, ñ→n, puntuación → espacio, espacios colapsados. */
export function normalizar(texto) {
  return String(texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const palabras = (texto) => {
  const n = normalizar(texto);
  return n ? n.split(" ") : [];
};

const alfabetico = (a, b) => a.nombre.localeCompare(b.nombre, "es");

/**
 * Barrios cuyo nombre contiene, para cada palabra de la consulta, una palabra que empieza por ella.
 * Primero los nombres que empiezan por la consulta; luego orden alfabético.
 */
export function buscar(consulta, barrios, max = 6) {
  const q = normalizar(consulta);
  if (!q) return [];
  const qPalabras = q.split(" ");
  const empiezan = [];
  const resto = [];
  for (const barrio of barrios) {
    const nombre = palabras(barrio.nombre);
    const coincide = qPalabras.every((p) => nombre.some((w) => w.startsWith(p)));
    if (!coincide) continue;
    (normalizar(barrio.nombre).startsWith(q) ? empiezan : resto).push(barrio);
  }
  return [...empiezan.sort(alfabetico), ...resto.sort(alfabetico)].slice(0, max);
}

function distancia(a, b) {
  let previa = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const fila = [i];
    for (let j = 1; j <= b.length; j++) {
      fila[j] = Math.min(
        previa[j] + 1,
        fila[j - 1] + 1,
        previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previa = fila;
  }
  return previa[b.length];
}

/**
 * El barrio más parecido a la consulta (distancia de edición sobre `normalizar`).
 * Compara con el nombre completo y con sus finales ("la asuncion", "asuncion"),
 * para que "asumcion" encuentre "La Asunción" aunque falte el artículo.
 */
export function masParecido(consulta, barrios) {
  const q = normalizar(consulta);
  if (!q || barrios.length === 0) return null;
  let mejor = null;
  let mejorDist = Infinity;
  for (const barrio of [...barrios].sort(alfabetico)) {
    const w = palabras(barrio.nombre);
    for (let i = 0; i < w.length; i++) {
      const d = distancia(q, w.slice(i).join(" "));
      if (d < mejorDist) {
        mejorDist = d;
        mejor = barrio;
      }
    }
  }
  return mejor;
}

/** Botones de la ficha del barrio, en el orden del spec, sin los que no tienen archivo. */
export function fichaBotones(props, existe) {
  return [
    { texto: "Tarjeta a color (PDF)", href: props.color_pdf, descarga: true },
    { texto: "Tarjeta para colorear (PDF)", href: props.colorear_pdf, descarga: true },
    { texto: "Ver tarjeta", href: props.vista, descarga: false },
  ].filter((b) => b.href && existe(b.href));
}
