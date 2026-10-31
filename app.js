// Visor: mapa, buscador, hoja del barrio y ayuda. Leaflet llega como global (vendor/leaflet).
import { buscar, masParecido, fichaBotones, etiqueta, otrosNombresTexto } from "./buscar.mjs";

const L = window.L;
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

let barrios = [];          // [{nombre, slug, ...props, capa}]
let porSlug = new Map();
let elegido = null;
let contorno = null;
const existencia = new Map(); // ruta → true (solo se guardan los aciertos)
let pintado = 0;               // turno de pintarBotones: solo pinta el último

// ---------- Mapa ----------

async function cargarJson(ruta) {
  try {
    const r = await fetch(ruta);
    if (!r.ok) throw new Error(`${ruta}: ${r.status}`);
    return await r.json();
  } catch (e) {
    console.error(e);
    const bajada = document.querySelector("#hoja-inicio .bajada");
    if (bajada) bajada.textContent = "No se pudo cargar el mapa. Revisa tu conexión y recarga la página.";
    throw e;
  }
}

const [[sur, oeste], [norte, este]] = await cargarJson("datos/limites.json");
const limites = L.latLngBounds([sur, oeste], [norte, este]);

const mapa = L.map("mapa", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 13,
  maxZoom: 19,
  maxBounds: limites.pad(0.4),
  maxBoundsViscosity: 0.8,
  zoomSnap: 0.25,
  // Leaflet salta sin animación si el zoom cambia más de 4 niveles; aquí siempre se anima
  zoomAnimationThreshold: 12,
}).fitBounds(limites, {
  paddingTopLeft: [0, document.querySelector(".buscador").getBoundingClientRect().bottom + 8],
  paddingBottomRight: [0, document.querySelector(".abajo").offsetHeight + 8],
});

const dibujo = L.tileLayer("teselas/{z}/{x}/{y}.jpg", {
  minZoom: 13,
  maxZoom: 19,
  minNativeZoom: 14,
  maxNativeZoom: 19,
  bounds: limites,
}).addTo(mapa);

// Satélite (Esri World Imagery) para validar errores del mapa dibujado
const satelite = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
  minZoom: 13,
  maxZoom: 19,
  maxNativeZoom: 19,
  bounds: limites,
  attribution: "Esri World Imagery",
});

L.control.layers({ "Mapa": dibujo, "Satélite": satelite }, null, { position: "topright" }).addTo(mapa);

const geo = await cargarJson("datos/barrios.geojson");

L.geoJSON(geo, {
  style: () => ({
    color: "#3a2a14",
    weight: 1,
    opacity: 0.25,
    dashArray: "2 4",
    fill: true,
    fillColor: "#3a2a14",
    fillOpacity: 0,
  }),
  onEachFeature: (feature, capa) => {
    const barrio = { ...feature.properties, capa };
    barrios.push(barrio);
    porSlug.set(barrio.slug, barrio);
    capa.on("click", () => elegir(barrio));
  },
}).addTo(mapa);

// ---------- Selección ----------

function dibujarContorno(barrio) {
  if (contorno) contorno.remove();
  const anillos = barrio.capa.getLatLngs();
  contorno = L.layerGroup([
    L.polygon(anillos, { interactive: false, fill: false, weight: 8, color: "#ffffff", opacity: 0.95 }),
    L.polygon(anillos, { interactive: false, fill: false, weight: 4.5, color: "#e8590c", dashArray: "12 8", lineCap: "butt" }),
  ]).addTo(mapa);
}

// Sectores populares: zona aproximada (bloque donde cae el sector), solo del barrio elegido
let sectoresGeo = { features: [] };
try {
  sectoresGeo = await cargarJson("datos/sectores.geojson");
} catch {
  // sin sectores el mapa sigue funcionando
}
let capaSectores = null;
let sectorElegido = null;

function estiloSector(activo) {
  return activo
    ? { color: "#ffffff", weight: 5, opacity: 0.95, fill: true, fillColor: "#e8590c", fillOpacity: 0.35, dashArray: null }
    : { color: "#e8590c", weight: 2.5, opacity: 0.9, fill: true, fillColor: "#e8590c", fillOpacity: 0.12, dashArray: "6 5" };
}

function quitarSectores() {
  if (capaSectores) capaSectores.remove();
  capaSectores = null;
  sectorElegido = null;
}

function mostrarSectores(barrio) {
  quitarSectores();
  const propios = sectoresGeo.features.filter((f) => f.properties.barrio === barrio.slug);
  if (propios.length === 0) return;
  const coleccion = { type: "FeatureCollection", features: propios };
  const visibles = new Map();
  const grupo = L.featureGroup([
    L.geoJSON(coleccion, {
      style: () => estiloSector(false),
      onEachFeature: (feature, capa) => visibles.set(feature, capa),
    }),
    // zona de clic: borde invisible de 18 px alrededor del sector, para acertarle en vistas alejadas
    L.geoJSON(coleccion, {
      style: () => ({ weight: 18, opacity: 0, fill: true, fillOpacity: 0 }),
      onEachFeature: (feature, capa) => {
        capa.bindTooltip(feature.properties.nombre, { sticky: true });
        capa.on("click", () => elegirSector(feature, visibles.get(feature)));
      },
    }),
  ]).addTo(mapa);
  capaSectores = grupo;
}

function elegirSector(feature, capa) {
  if (sectorElegido) sectorElegido.setStyle(estiloSector(false));
  sectorElegido = capa;
  capa.setStyle(estiloSector(true));
  barrioBajada.textContent = `Sector ${feature.properties.nombre} (zona aproximada) · Barrio ${elegido.nombre}`;
}

function encuadrar(barrio) {
  const altoHoja = document.querySelector(".abajo").offsetHeight;
  const altoArriba = document.querySelector(".buscador").getBoundingClientRect().bottom;
  // vuelo suave: el mapa se desplaza y ajusta el zoom en vez de saltar
  mapa.flyToBounds(barrio.capa.getBounds(), {
    paddingTopLeft: [20, altoArriba + 16],
    paddingBottomRight: [20, altoHoja + 16],
    maxZoom: 18,
    duration: 0.9,
  });
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
  dibujarContorno(barrio);
  mostrarSectores(barrio);
  pintarBotones(barrio);
  actualizarUrl(barrio.slug);
  if (mover) encuadrar(barrio);
}

function soltar() {
  elegido = null;
  if (contorno) { contorno.remove(); contorno = null; }
  quitarSectores();
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
