// Visor: mapa, buscador, hoja del barrio y ayuda. Leaflet llega como global (vendor/leaflet).
import { buscar, masParecido, fichaBotones } from "./buscar.mjs";

const L = window.L;
const $ = (id) => document.getElementById(id);

const consulta = $("consulta");
const sugerencias = $("sugerencias");
const sinResultados = $("sin-resultados");
const hojaInicio = $("hoja-inicio");
const hojaBarrio = $("hoja-barrio");
const barrioNombre = $("barrio-nombre");
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
const existencia = new Map(); // ruta → Promise<boolean>
let pintado = 0;               // turno de pintarBotones: solo pinta el último

// ---------- Mapa ----------

const [[sur, oeste], [norte, este]] = await (await fetch("datos/limites.json")).json();
const limites = L.latLngBounds([sur, oeste], [norte, este]);

const mapa = L.map("mapa", {
  zoomControl: false,
  attributionControl: false,
  minZoom: 13,
  maxZoom: 19,
  maxBounds: limites.pad(0.4),
  maxBoundsViscosity: 0.8,
  zoomSnap: 0.25,
}).fitBounds(limites, {
  paddingTopLeft: [0, document.querySelector(".buscador").getBoundingClientRect().bottom + 8],
  paddingBottomRight: [0, document.querySelector(".abajo").offsetHeight + 8],
});

L.tileLayer("teselas/{z}/{x}/{y}.jpg", {
  minZoom: 13,
  maxZoom: 19,
  minNativeZoom: 14,
  maxNativeZoom: 19,
  bounds: limites,
}).addTo(mapa);

const geo = await (await fetch("datos/barrios.geojson")).json();

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

function encuadrar(barrio) {
  const altoHoja = document.querySelector(".abajo").offsetHeight;
  const altoArriba = document.querySelector(".buscador").getBoundingClientRect().bottom;
  mapa.fitBounds(barrio.capa.getBounds(), {
    paddingTopLeft: [20, altoArriba + 16],
    paddingBottomRight: [20, altoHoja + 16],
    maxZoom: 18,
  });
}

function existe(ruta) {
  if (!existencia.has(ruta)) {
    existencia.set(
      ruta,
      fetch(ruta, { method: "HEAD" }).then((r) => r.ok, () => false),
    );
  }
  return existencia.get(ruta);
}

async function pintarBotones(barrio) {
  const turno = ++pintado;
  botones.replaceChildren();
  botones.setAttribute("aria-busy", "true");
  const rutas = [barrio.color_pdf, barrio.colorear_pdf, barrio.vista].filter(Boolean);
  const hay = new Set();
  await Promise.all(rutas.map(async (r) => { if (await existe(r)) hay.add(r); }));
  if (turno !== pintado) return; // llegó otra elección (o la misma dos veces)
  botones.removeAttribute("aria-busy");
  for (const r of rutas) if (!hay.has(r)) console.warn("Falta archivo de tarjeta:", r);
  botones.replaceChildren();

  const lista = fichaBotones(barrio, (r) => hay.has(r));
  if (lista.length === 0) {
    const aviso = document.createElement("p");
    aviso.className = "aviso";
    aviso.textContent = "La tarjeta de este barrio todavía no está lista.";
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
  elegido = barrio;
  limpiarBusqueda();
  consulta.blur();
  barrioNombre.textContent = `Barrio ${barrio.nombre}`;
  document.title = `Barrio ${barrio.nombre} · Mapa de Roldanillo`;
  hojaInicio.hidden = true;
  hojaBarrio.hidden = false;
  dibujarContorno(barrio);
  pintarBotones(barrio);
  actualizarUrl(barrio.slug);
  if (mover) encuadrar(barrio);
}

function soltar() {
  elegido = null;
  if (contorno) { contorno.remove(); contorno = null; }
  hojaBarrio.hidden = true;
  hojaInicio.hidden = false;
  document.title = "Mapa de Roldanillo · Club Rodaditas";
  actualizarUrl(null);
}

$("cerrar-hoja").addEventListener("click", soltar);

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
  b.textContent = barrio.nombre;
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
