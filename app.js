// Visor: mapa vectorial (MapLibre), buscador, hoja del barrio y ayuda.
import * as maplibregl from "./vendor/maplibre-gl/maplibre-gl.mjs";
import { buscar, masParecido, fichaBotones, etiqueta, otrosNombresTexto } from "./buscar.mjs";
import { estilo } from "./mapa/estilo.mjs";
import { registrarImagenes } from "./mapa/imagenes.mjs";
import { soportaWebGL, cajaDe, paddingVisor } from "./mapa/visor.mjs";

const $ = (id) => document.getElementById(id);

const consulta = $("consulta");
const sugerencias = $("sugerencias");
const sinResultados = $("sin-resultados");
const hojaInicio = $("hoja-inicio");
const hojaBarrio = $("hoja-barrio");
const barrioNombre = $("barrio-nombre");
const barrioBajada = $("barrio-bajada");
const botones = $("botones");
const ayuda = $("ayuda");

const ICONOS = {
  descarga:
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  ver:
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 16l5-5 4 4 3-3 5 5"/></svg>',
};

const barrios = [];          // [{nombre, slug, ...props, geometria}]
const porSlug = new Map();
let elegido = null;
const existencia = new Map(); // ruta → true (solo se guardan los aciertos)
let pintado = 0;               // turno de pintarBotones: solo pinta el último
const sinMovimiento = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Datos ----------

async function fetchJson(ruta) {
  const r = await fetch(ruta);
  if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
  return r.json();
}

async function cargarJson(ruta) {
  try {
    return await fetchJson(ruta);
  } catch (e) {
    console.error(e);
    avisarFallaMapa();
    throw e;
  }
}

function avisarFallaMapa() {
  const bajada = document.querySelector("#hoja-inicio .bajada");
  if (bajada) bajada.textContent = "No se pudo cargar el mapa. Revisa tu conexión y recarga la página.";
}

// Sin mapa (sin WebGL 2, sin sus datos o si el motor falla) la ficha, el buscador y las descargas siguen.
function mostrarSinMapa(texto) {
  const aviso = $("sin-mapa");
  aviso.textContent = `${texto} Igual puedes buscar tu barrio y descargar su tarjeta.`;
  aviso.hidden = false;
}

// todo en paralelo: el mapa no espera a los barrios ni al revés. Solo los barrios son indispensables.
const pedidoMapa = soportaWebGL()
  ? Promise.all([fetchJson("datos/limites.json"), fetchJson("mapa/capas/indice.json")]).catch((e) => {
    console.error("Sin datos del mapa:", e);
    mostrarSinMapa("No se pudo cargar el mapa.");
    return null;
  })
  : (mostrarSinMapa("Tu navegador no puede dibujar el mapa."), Promise.resolve(null));
const geo = await cargarJson("datos/barrios.geojson");
const datosMapa = await pedidoMapa;
for (const feature of geo.features) {
  const barrio = { ...feature.properties, geometria: feature.geometry };
  barrios.push(barrio);
  porSlug.set(barrio.slug, barrio);
}

// ---------- Mapa ----------

const margenes = () => paddingVisor({
  arriba: document.querySelector(".buscador").getBoundingClientRect().bottom,
  abajo: document.querySelector(".abajo").offsetHeight,
  alto: window.innerHeight,
});

let mapa = null;     // null si el navegador no puede dibujar el mapa
let listo = false;   // el estilo y las fuentes cargaron (evento load)
let modo = "color";  // "color" | "colorear" | "satelite"
let capasIndice = [];
const pendientes = [];

function cuandoListo(fn) {
  if (!mapa) return;
  if (listo) fn();
  else pendientes.push(fn);
}

if (datosMapa) {
  try {
    crearMapa(...datosMapa);
  } catch (e) {
    // cualquier fallo del motor (contexto WebGL perdido, worker no soportado…) no debe tumbar la ficha
    console.error("No se pudo crear el mapa:", e);
    mapa = null;
    mostrarSinMapa("Tu navegador no puede dibujar el mapa.");
  }
}

function crearMapa(limitesJson, indice) {
  const [[sur, oeste], [norte, este]] = limitesJson;
  capasIndice = Object.keys(indice.capas);
  // techos y árboles (≈ 75 % de los datos) llegan después del primer dibujo: la base aparece antes
  const estiloInicial = estilo("color", { capas: capasIndice, diferir: true });
  const [dx, dy] = [(este - oeste) * 0.4, (norte - sur) * 0.4];
  mapa = new maplibregl.Map({
    container: "mapa",
    style: estiloInicial,
    bounds: [[oeste, sur], [este, norte]],
    fitBoundsOptions: { padding: margenes() },
    minZoom: 13,
    maxZoom: 20,
    maxBounds: [[oeste - dx, sur - dy], [este + dx, norte + dy]],
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: false,
  });
  window.mapa = mapa; // solo para las pruebas en navegador (Playwright)
  registrarImagenes(mapa);
  mapa.addControl(new maplibregl.NavigationControl({ showZoom: false, visualizePitch: false }), "top-right");
  mapa.addControl(new maplibregl.AttributionControl({
    compact: true,
    customAttribution: "PBOT Roldanillo · © colaboradores de OpenStreetMap · OpenMoji CC BY-SA 4.0 · MapLibre",
  }), "bottom-left");
  mapa.addControl(controlModos(), "top-right");

  mapa.on("error", (e) => {
    if (e.sourceId) console.warn(`No se pudo cargar la capa ${e.sourceId}:`, e.error?.message ?? e.error);
    else console.error(e.error ?? e);
    if (e.sourceId === "barrios") avisarFallaMapa();
  });
  mapa.on("load", () => {
    for (const [id, url] of Object.entries(estiloInicial.metadata["rodaditas:diferidas"])) {
      mapa.getSource(id)?.setData(url);
    }
    listo = true;
    pendientes.splice(0).forEach((fn) => fn());
  });

  mapa.on("click", (e) => {
    const r = 9; // zona de clic de 18 px alrededor del sector, para acertarle en vistas alejadas
    const caja = [[e.point.x - r, e.point.y - r], [e.point.x + r, e.point.y + r]];
    const sector = mapa.queryRenderedFeatures(caja, { layers: ["sectores-zona", "sectores-zona-borde"] })[0];
    if (sector && elegido) return elegirSector(sector);
    const barrio = mapa.queryRenderedFeatures(e.point, { layers: ["barrios-velo"] })[0];
    if (barrio) elegir(porSlug.get(barrio.properties.slug));
  });
  mapa.on("mouseenter", "barrios-velo", () => { mapa.getCanvas().style.cursor = "pointer"; });
  mapa.on("mouseleave", "barrios-velo", () => { mapa.getCanvas().style.cursor = ""; });
}

// ---------- Modos: Mapa · Colorear · Satélite ----------

function controlModos() {
  const caja = document.createElement("div");
  caja.className = "maplibregl-ctrl modos";
  caja.setAttribute("role", "group");
  caja.setAttribute("aria-label", "Cómo se ve el mapa");
  for (const [valor, texto] of [["color", "Mapa"], ["colorear", "Colorear"], ["satelite", "Satélite"]]) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = texto;
    b.dataset.modo = valor;
    b.setAttribute("aria-pressed", String(valor === modo));
    b.addEventListener("click", () => cambiarModo(valor));
    caja.append(b);
  }
  return { onAdd: () => caja, onRemove: () => caja.remove() };
}

function mostrarDibujo(visible) {
  for (const capa of mapa.getStyle().layers) {
    if (capa.metadata?.["rodaditas:grupo"] === "dibujo") {
      mapa.setLayoutProperty(capa.id, "visibility", visible ? "visible" : "none");
    }
  }
  mapa.setLayoutProperty("satelite", "visibility", visible ? "none" : "visible");
}

function cambiarModo(nuevo) {
  if (!mapa || nuevo === modo) return;
  const base = nuevo === "colorear" ? "colorear" : "color";
  const baseActual = modo === "colorear" ? "colorear" : "color";
  modo = nuevo;
  document.querySelectorAll(".modos button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.modo === modo)));
  cuandoListo(() => {
    if (base !== baseActual) {
      mapa.setStyle(estilo(base, { capas: capasIndice }), { diff: true });
      // el estilo nuevo trae satélite oculto y el estado global por defecto
      mapa.once("styledata", () => {
        if (modo === "satelite") mostrarDibujo(false);
        restaurarSeleccion();
      });
    } else {
      mostrarDibujo(modo !== "satelite");
      restaurarSeleccion();
    }
  });
}

// ---------- Selección ----------

let sectorActivo = null;

function marcarBarrio(slug) {
  mapa.removeFeatureState({ source: "barrios" });
  mapa.removeFeatureState({ source: "sectores" });
  sectorActivo = null;
  const filtro = ["==", ["get", "barrio"], slug ?? ""];
  mapa.setFilter("sectores-zona", filtro);
  mapa.setFilter("sectores-zona-borde", filtro);
  mapa.setGlobalStateProperty("hayElegido", Boolean(slug));
  if (slug) mapa.setFeatureState({ source: "barrios", id: slug }, { elegido: true });
}

function restaurarSeleccion() {
  const sector = sectorActivo;
  marcarBarrio(elegido?.slug ?? null);
  if (sector) {
    sectorActivo = sector;
    mapa.setFeatureState({ source: "sectores", id: sector }, { activo: true });
  }
}

function elegirSector(feature) {
  if (sectorActivo) mapa.setFeatureState({ source: "sectores", id: sectorActivo }, { activo: false });
  sectorActivo = feature.properties.nombre;
  mapa.setFeatureState({ source: "sectores", id: sectorActivo }, { activo: true });
  barrioBajada.textContent = `Sector ${feature.properties.nombre} (zona aproximada) · Barrio ${elegido.nombre}`;
}

function encuadrar(barrio) {
  // vuelo suave: el mapa se desplaza y ajusta el zoom en vez de saltar
  cuandoListo(() => mapa.fitBounds(cajaDe(barrio.geometria), {
    padding: margenes(),
    maxZoom: 18,
    duration: sinMovimiento ? 0 : 900,
  }));
}

// "si" | "no" (404 limpio) | "error" (la petición falló: red). Solo "si" se recuerda.
async function existe(ruta) {
  if (existencia.has(ruta)) return "si";
  try {
    const r = await fetch(ruta, { method: "HEAD" });
    if (r.ok) {
      existencia.set(ruta, true);
      return "si";
    }
    return "no";
  } catch {
    return "error";
  }
}

async function pintarBotones(barrio) {
  const turno = ++pintado;
  botones.replaceChildren();
  botones.setAttribute("aria-busy", "true");
  const rutas = [barrio.color_pdf, barrio.colorear_pdf, barrio.vista].filter(Boolean);
  const hay = new Set();
  const fallos = [];
  await Promise.all(rutas.map(async (r) => {
    const estado = await existe(r);
    if (estado === "si") hay.add(r);
    else if (estado === "error") fallos.push(r);
    else console.warn("Falta archivo de tarjeta:", r);
  }));
  if (turno !== pintado) return; // llegó otra elección (o la misma dos veces)
  botones.removeAttribute("aria-busy");
  botones.replaceChildren();

  const lista = fichaBotones(barrio, (r) => hay.has(r));
  if (lista.length === 0) {
    const aviso = document.createElement("p");
    aviso.className = "aviso";
    aviso.textContent = fallos.length === rutas.length
      ? "No se pudo comprobar la tarjeta. Revisa tu conexión e inténtalo de nuevo."
      : "La tarjeta de este barrio todavía no está lista.";
    botones.append(aviso);
    return;
  }
  lista.forEach((b, i) => {
    const a = document.createElement("a");
    a.className = i === 0 && b.descarga ? "boton principal" : "boton";
    a.href = b.href;
    if (b.descarga) {
      a.download = `${barrio.slug}-${b.href.split("/").pop()}`;
      a.innerHTML = ICONOS.descarga;
    } else {
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = ICONOS.ver;
    }
    a.append(b.texto);
    botones.append(a);
  });
}

function actualizarUrl(slug) {
  const url = new URL(location.href);
  url.searchParams.delete("q");
  if (slug) url.searchParams.set("barrio", slug);
  else url.searchParams.delete("barrio");
  history.replaceState(null, "", url);
}

function elegir(barrio, { mover = true } = {}) {
  // ya estás en este barrio: un clic sobre él no vuelve a encuadrar ni borra el sector elegido
  if (mover && elegido?.slug === barrio.slug) {
    limpiarBusqueda();
    consulta.blur();
    return;
  }
  elegido = barrio;
  limpiarBusqueda();
  consulta.blur();
  barrioNombre.textContent = `Barrio ${barrio.nombre}`;
  barrioBajada.textContent = ["Roldanillo, Valle · Club Rodaditas", otrosNombresTexto(barrio)].filter(Boolean).join(" · ");
  document.title = `Barrio ${barrio.nombre} · Mapa de Roldanillo`;
  hojaInicio.hidden = true;
  hojaBarrio.hidden = false;
  cuandoListo(() => marcarBarrio(barrio.slug));
  pintarBotones(barrio);
  actualizarUrl(barrio.slug);
  if (mover) encuadrar(barrio);
}

function soltar() {
  elegido = null;
  cuandoListo(() => marcarBarrio(null));
  hojaBarrio.hidden = true;
  hojaInicio.hidden = false;
  document.title = "Mapa de Roldanillo · Club Rodaditas";
  actualizarUrl(null);
}

$("cerrar-hoja").addEventListener("click", soltar);
$("ver-barrio").addEventListener("click", () => {
  if (elegido) encuadrar(elegido);
});

// ---------- Buscador ----------

function limpiarBusqueda() {
  consulta.value = "";
  sugerencias.hidden = true;
  sugerencias.replaceChildren();
  sinResultados.hidden = true;
}

function botonPlaca(barrio) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = etiqueta(barrio);
  b.addEventListener("click", () => elegir(porSlug.get(barrio.slug)));
  return b;
}

function mostrarSugerencias() {
  const texto = consulta.value;
  sugerencias.replaceChildren();
  sinResultados.replaceChildren();
  if (!texto.trim()) {
    sugerencias.hidden = true;
    sinResultados.hidden = true;
    return;
  }
  const hallados = buscar(texto, barrios);
  if (hallados.length) {
    for (const barrio of hallados) {
      const li = document.createElement("li");
      li.setAttribute("role", "option");
      li.append(botonPlaca(barrio));
      sugerencias.append(li);
    }
    sugerencias.hidden = false;
    sinResultados.hidden = true;
    return;
  }
  sugerencias.hidden = true;
  const parecido = masParecido(texto, barrios);
  sinResultados.append("No encontré ese barrio.");
  if (parecido) {
    sinResultados.append(" ¿Quisiste decir ");
    sinResultados.append(botonPlaca(parecido));
    sinResultados.append("?");
  }
  sinResultados.hidden = false;
}

consulta.addEventListener("input", mostrarSugerencias);
consulta.addEventListener("keydown", (e) => {
  if (e.key === "Escape") limpiarBusqueda();
});
document.querySelector(".buscador").addEventListener("submit", (e) => {
  e.preventDefault();
  const primero = buscar(consulta.value, barrios, 1)[0];
  if (primero) elegir(porSlug.get(primero.slug));
});

// ---------- Ayuda ----------

document.querySelector(".boton-ayuda").addEventListener("click", () => ayuda.showModal());
ayuda.addEventListener("click", (e) => { if (e.target === ayuda) ayuda.close(); });
ayuda.addEventListener("close", () => {
  if (location.hash === "#ayuda") history.replaceState(null, "", location.pathname + location.search);
});

// ---------- Estado inicial desde la URL ----------

const params = new URLSearchParams(location.search);
const inicial = porSlug.get(params.get("barrio") ?? "");
if (inicial) {
  elegir(inicial);
} else if (params.get("q")) {
  consulta.value = params.get("q");
  mostrarSugerencias();
}
if (location.hash === "#ayuda") ayuda.showModal();
