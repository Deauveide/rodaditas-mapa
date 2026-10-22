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

/** Otros nombres del barrio: el alias y los sectores que la gente nombra dentro de él. */
const otrosNombres = (barrio) => [barrio.alias, ...(barrio.sectores ?? [])].filter(Boolean);

/** Texto para mostrar: "Chiminangos (La Asunción)" si se halló por otro nombre (`via`). */
export function etiqueta(barrio) {
  return barrio.via ? `${barrio.via} (${barrio.nombre})` : barrio.nombre;
}

const alfabetico = (a, b) => etiqueta(a).localeCompare(etiqueta(b), "es");

/**
 * Barrios cuyo nombre (o un alias o sector, que queda en `via`) contiene, para cada palabra de la
 * consulta, una palabra que empieza por ella.
 * Primero los nombres que empiezan por la consulta; luego orden alfabético.
 */
export function buscar(consulta, barrios, max = 6) {
  const q = normalizar(consulta);
  if (!q) return [];
  const qPalabras = q.split(" ");
  const coincide = (texto) => {
    const w = palabras(texto);
    return qPalabras.every((p) => w.some((x) => x.startsWith(p)));
  };
  const empiezan = [];
  const resto = [];
  for (const barrio of barrios) {
    let hallado = coincide(barrio.nombre) ? barrio : null;
    let texto = barrio.nombre;
    if (!hallado) {
      const via = otrosNombres(barrio).find(coincide);
      if (!via) continue;
      hallado = { ...barrio, via };
      texto = via;
    }
    (normalizar(texto).startsWith(q) ? empiezan : resto).push(hallado);
  }
  return [...empiezan.sort(alfabetico), ...resto.sort(alfabetico)].slice(0, max);
}

/** "Incluye: Chiminangos · También llamado Guachal", como en la tarjeta impresa; "" si no hay. */
export function otrosNombresTexto(barrio) {
  const partes = [];
  if (barrio.sectores?.length) partes.push(`Incluye: ${barrio.sectores.join(", ")}`);
  if (barrio.alias) partes.push(`También llamado ${barrio.alias}`);
  return partes.join(" · ");
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
 * El barrio más parecido a la consulta (distancia de edición sobre `normalizar`), también por sus
 * otros nombres (queda en `via`).
 * Compara con el nombre completo y con sus finales ("la asuncion", "asuncion"),
 * para que "asumcion" encuentre "La Asunción" aunque falte el artículo.
 */
export function masParecido(consulta, barrios) {
  const q = normalizar(consulta);
  if (!q || barrios.length === 0) return null;
  let mejor = null;
  let mejorDist = Infinity;
  for (const barrio of [...barrios].sort(alfabetico)) {
    for (const nombre of [barrio.nombre, ...otrosNombres(barrio)]) {
      const w = palabras(nombre);
      for (let i = 0; i < w.length; i++) {
        const d = distancia(q, w.slice(i).join(" "));
        if (d < mejorDist) {
          mejorDist = d;
          mejor = nombre === barrio.nombre ? barrio : { ...barrio, via: nombre };
        }
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
