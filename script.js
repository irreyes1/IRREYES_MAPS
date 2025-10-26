const clientHome = { lat: 41.642155, lon: -0.873633, label: "CLIENTE" };

const initialStations = [
  ["ARA0011", 1, 41.648031, -0.880675, 0, "ZTE"],
  ["ARA0011", 2, 41.648031, -0.880675, 120, "ZTE"],
  ["ARA0011", 3, 41.648031, -0.880675, 255, "ZTE"],
  ["ARA0012", 1, 41.646781, -0.872578, 0, "ZTE"],
  ["ARA0012", 2, 41.646781, -0.872578, 120, "ZTE"],
  ["ARA0012", 3, 41.646781, -0.872578, 240, "ZTE"],
  ["ARA0022", 1, 41.63988845, -0.869192292, 120, "ZTE"],
  ["ARA0022", 2, 41.63988845, -0.869192292, 240, "ZTE"],
  ["ARA0022", 3, 41.63988845, -0.869192292, 240, "ZTE"],
  ["ARA0309", 1, 41.647884, -0.875625, 0, "ZTE"],
  ["ARA0309", 2, 41.647884, -0.875625, 120, "ZTE"],
  ["ARA0309", 3, 41.647884, -0.875625, 240, "ZTE"],
  ["ARA0319", 1, 41.641478, -0.883681, 0, "ZTE"],
  ["ARA0319", 2, 41.641478, -0.883681, 120, "ZTE"],
  ["ARA0319", 3, 41.641478, -0.883681, 240, "ZTE"],
  ["ARA0359", 1, 41.643953, -0.883145, -1, "ZTE"],
  ["ARA0359", 1, 41.644784, -0.882117, 0, "ZTE"],
  ["ARA0359", 2, 41.644784, -0.882117, 120, "ZTE"],
  ["ARA0359", 3, 41.644784, -0.882117, 240, "ZTE"],
  ["ARA0362", 1, 41.643473, -0.869597, 0, "ZTE"],
  ["ARA0362", 2, 41.643473, -0.869597, 120, "ZTE"],
  ["ARA0362", 3, 41.643473, -0.869597, 240, "ZTE"],
  ["ARA0196", 1, 41.64238549, -0.871247422, 150, "ERI"],
  ["ARA0196", 2, 41.64238549, -0.871247422, 250, "ERI"],
  ["ARA0196", 3, 41.64238549, -0.871247422, 325, "ERI"],
];

const $ = (id) => document.getElementById(id);
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

const colorByVendor = (vendor) => {
  if (vendor === "ZTE") return "#1e3a8a";
  if (vendor === "ERI" || vendor === "ERICSSON") return "#e67e22";
  return "#4a4a4a";
};

function beamTriangle(lat, lon, azimuthDeg, beamLenMeters, beamWidth = 60) {
  const R = 6378137;
  const d = beamLenMeters / R;
  const lat0 = toRad(lat);
  const lon0 = toRad(lon);
  const az1 = toRad(azimuthDeg - beamWidth / 2);
  const az2 = toRad(azimuthDeg + beamWidth / 2);

  function destination(azimuth) {
    const lat1 = Math.asin(
      Math.sin(lat0) * Math.cos(d) + Math.cos(lat0) * Math.sin(d) * Math.cos(azimuth),
    );
    const lon1 =
      lon0 +
      Math.atan2(
        Math.sin(azimuth) * Math.sin(d) * Math.cos(lat0),
        Math.cos(d) - Math.sin(lat0) * Math.sin(lat1),
      );
    return [toDeg(lat1), toDeg(lon1)];
  }

  const p1 = destination(az1);
  const p2 = destination(az2);
  return [[lat, lon], p1, p2, [lat, lon]];
}

const map = L.map("map").setView([clientHome.lat, clientHome.lon], 17);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 20,
  attribution: "&copy; OpenStreetMap",
}).addTo(map);

const coverageRoot = L.layerGroup().addTo(map);
const siteMarkerRoot = L.layerGroup().addTo(map);
const labelRoot = L.layerGroup().addTo(map);
const clientRoot = L.layerGroup().addTo(map);
const measurementLayer = L.layerGroup().addTo(map);

let currentLabelPx = 24;

const clientMarker = L.marker([clientHome.lat, clientHome.lon], {
  title: clientHome.label,
});

const buildClientLabelHtml = (text) =>
  `<div style='background:#ffe8ec;color:#c0392b;font-weight:700;font-size:${currentLabelPx}px;padding:6px 10px;border:2px solid #ffcad3;text-align:center;'>${text}</div>`;

const clientLabel = () =>
  L.divIcon({
    className: "client-label",
    html: buildClientLabelHtml(clientHome.label),
    iconAnchor: [0, 0],
  });

const clientLabelMarker = L.marker([clientHome.lat, clientHome.lon], {
  icon: clientLabel(),
});

clientMarker.addTo(map);
clientLabelMarker.addTo(map);

let currentBeamLen = 150;

const siteGroups = new Map();
const labelBySite = new Map();
let sitesOrder = [];
let clients = [];

let isMeasuring = false;
let measurementPoints = [];
let measurementMarkers = [];
let measurementLine = null;

function renderSite(site, sector, lat, lon, az, vendor) {
  let info = siteGroups.get(site);

  if (!info) {
    const coverageGroup = L.featureGroup();
    const markerGroup = L.featureGroup();
    coverageRoot.addLayer(coverageGroup);
    siteMarkerRoot.addLayer(markerGroup);

    info = {
      vendor,
      lat,
      lon,
      coverageGroup,
      markerGroup,
      marker: null,
      sectors: [],
      visible: true,
    };
    siteGroups.set(site, info);
    sitesOrder.push(site);
  }

  const color = colorByVendor(vendor);
  const triangle = beamTriangle(lat, lon, az, currentBeamLen);
  const polygon = L.polygon(triangle, {
    color,
    weight: 2,
    fillOpacity: 0.25,
  }).bindPopup(`${site} S${sector} (${vendor}) - ${az}°`);

  info.coverageGroup.addLayer(polygon);
  info.sectors.push({ sector, polygon, az });

  if (!info.marker) {
    const dot = L.circleMarker([lat, lon], {
      radius: 5,
      color,
      fill: true,
      fillOpacity: 1,
    }).bindPopup(`${site} (${vendor})`);
    info.markerGroup.addLayer(dot);
    info.marker = dot;
  }
}

function renderLabel(site) {
  if (labelBySite.has(site)) return;

  const info = siteGroups.get(site);
  const bg = info.vendor === "ZTE" ? "#bfd6ff" : info.vendor === "ERI" ? "#ffd9b3" : "#d7d7d7";
  const border = info.vendor === "ZTE" ? "#4a6edb" : info.vendor === "ERI" ? "#e67e22" : "#7d7d7d";

  const icon = L.divIcon({
    className: "site-label",
    html: `<div style='background:${bg};color:#002b5b;font-weight:700;font-size:${currentLabelPx}px;padding:6px 12px;border:2px solid ${border};text-align:center;'>${site}</div>`,
    iconAnchor: [0, 0],
  });

  const marker = L.marker([info.lat, info.lon], { icon });
  marker.vendor = info.vendor;
  labelBySite.set(site, marker);
  labelRoot.addLayer(marker);
}

function refreshSitesListUI() {
  const container = $("sitesList");
  container.innerHTML = "";

  let highlightRow = null;
  const searchValue = $("siteSearchInput").value.trim().toUpperCase();

  sitesOrder.forEach((site) => {
    const info = siteGroups.get(site);
    const id = `sitecb_${site}`;
    const row = document.createElement("label");
    row.dataset.site = site;

    const borderColor =
      info.vendor === "ZTE" ? "#4a6edb" : info.vendor === "ERI" ? "#e67e22" : "#555";

    row.innerHTML = `<input type="checkbox" id="${id}" ${info.visible ? "checked" : ""} /> <span class="pill" style="border-color:${borderColor};">${site}</span>`;
    container.appendChild(row);

    if (searchValue && site.toUpperCase().includes(searchValue)) {
      row.classList.add("highlight");
      highlightRow = row;
    }

    row.querySelector("input").addEventListener("change", (event) => {
      info.visible = event.target.checked;
      applyVisibilityFilters();
    });
  });

  if (highlightRow) highlightRow.scrollIntoView({ block: "nearest" });
}

function applyVisibilityFilters() {
  const showCoverage = $("toggleCoverage").checked;
  const showMarkers = $("toggleSiteMarkers").checked;
  const showLabels = $("toggleLabels").checked;
  const showClients = $("toggleClients").checked;
  const showClientHome = $("toggleClientHome").checked;
  const showZTE = $("toggleZTE").checked;
  const showERI = $("toggleERI").checked;

  siteGroups.forEach((info, site) => {
    const vendorVisible =
      (info.vendor === "ZTE" && showZTE) ||
      (info.vendor === "ERI" && showERI) ||
      (info.vendor !== "ZTE" && info.vendor !== "ERI");

    const baseVisible = vendorVisible && info.visible;

    if (baseVisible && showCoverage) {
      coverageRoot.addLayer(info.coverageGroup);
    } else {
      coverageRoot.removeLayer(info.coverageGroup);
    }

    if (baseVisible && showMarkers) {
      siteMarkerRoot.addLayer(info.markerGroup);
    } else {
      siteMarkerRoot.removeLayer(info.markerGroup);
    }

    const labelMarker = labelBySite.get(site);
    if (labelMarker) {
      if (baseVisible && showLabels) {
        labelRoot.addLayer(labelMarker);
      } else {
        labelRoot.removeLayer(labelMarker);
      }
    }
  });

  if (showClients) {
    if (!map.hasLayer(clientRoot)) clientRoot.addTo(map);
  } else {
    map.removeLayer(clientRoot);
  }

  if (showClientHome) {
    if (!map.hasLayer(clientMarker)) clientMarker.addTo(map);
    if (!map.hasLayer(clientLabelMarker)) clientLabelMarker.addTo(map);
  } else {
    map.removeLayer(clientMarker);
    map.removeLayer(clientLabelMarker);
  }
}

function rebuildAll(stationsArray) {
  coverageRoot.clearLayers();
  siteMarkerRoot.clearLayers();
  labelRoot.clearLayers();
  siteGroups.clear();
  labelBySite.clear();
  sitesOrder = [];

  clientLabelMarker.setIcon(clientLabel());

  stationsArray.forEach(([site, sector, lat, lon, az, vendor]) => {
    renderSite(site, sector, lat, lon, az, vendor);
  });

  sitesOrder.sort();
  sitesOrder.forEach(renderLabel);
  refreshSitesListUI();
  applyVisibilityFilters();
}

function addClientPoint(lat, lon, label) {
  const marker = L.marker([lat, lon], { title: label || "Cliente" });

  const labelIcon = L.divIcon({
    html: buildClientLabelHtml(label || "CLIENTE"),
    iconAnchor: [0, 0],
  });

  const labelMarker = L.marker([lat, lon], { icon: labelIcon });

  marker.addTo(clientRoot);
  labelMarker.addTo(clientRoot);

  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  clients.push({ id, lat, lon, label, marker, labelMarker });

  const row = document.createElement("div");
  row.innerHTML = `<span>${label || "CLIENTE"}</span><span class="small" style="margin-left:auto;">${lat.toFixed(5)}, ${lon.toFixed(5)}</span><button class="btn danger" data-id="${id}" title="Eliminar">❌</button>`;
  $("clientsList").appendChild(row);

  row.querySelector("button").addEventListener("click", () => {
    const index = clients.findIndex((client) => client.id === id);
    if (index >= 0) {
      clientRoot.removeLayer(clients[index].marker);
      clientRoot.removeLayer(clients[index].labelMarker);
      clients.splice(index, 1);
      row.remove();
    }
  });

  applyVisibilityFilters();
}

function updateMeasureInfo(message) {
  $("measureInfo").innerHTML = message;
}

function resetMeasurement() {
  measurementPoints = [];
  measurementMarkers.forEach((mark) => measurementLayer.removeLayer(mark));
  measurementMarkers = [];
  if (measurementLine) {
    measurementLayer.removeLayer(measurementLine);
    measurementLine = null;
  }
  isMeasuring = false;
  updateMeasureInfo("Sin mediciones activas.");
}

map.on("click", (event) => {
  if (!isMeasuring) return;

  measurementPoints.push(event.latlng);
  const mark = L.circleMarker(event.latlng, {
    radius: 6,
    color: "#d92027",
    fillColor: "#ff6363",
    fillOpacity: 0.8,
  }).addTo(measurementLayer);
  measurementMarkers.push(mark);

  if (measurementPoints.length === 1) {
    updateMeasureInfo("Primer punto fijado. Selecciona el segundo punto.");
  }

  if (measurementPoints.length === 2) {
    const [start, end] = measurementPoints;
    const distanceMeters = map.distance(start, end);
    const distanceKm = distanceMeters / 1000;
    measurementLine = L.polyline([start, end], {
      color: "#d92027",
      weight: 3,
      dashArray: "6 6",
    }).addTo(measurementLayer);
    measurementLine.bindPopup(`Distancia: ${distanceKm.toFixed(2)} km`).openPopup();
    updateMeasureInfo(`Distancia calculada: <strong>${distanceKm.toFixed(2)} km</strong>. Usa "Limpiar" para empezar de nuevo.`);
    isMeasuring = false;
  }
});

$("startMeasure").addEventListener("click", () => {
  resetMeasurement();
  isMeasuring = true;
  updateMeasureInfo("Haz clic en el mapa para elegir el primer punto.");
});

$("clearMeasure").addEventListener("click", () => {
  resetMeasurement();
});

let stationsState = initialStations.slice();
rebuildAll(stationsState);

$("applyStyle").addEventListener("click", () => {
  const len = parseFloat($("beamLength").value);
  const px = parseFloat($("labelSize").value);

  if (!Number.isNaN(len) && len > 0) currentBeamLen = len;
  if (!Number.isNaN(px) && px > 0) currentLabelPx = px;
  rebuildAll(stationsState);
  clients.forEach((client) => {
    const labelIcon = L.divIcon({
      html: buildClientLabelHtml(client.label || "CLIENTE"),
      iconAnchor: [0, 0],
    });
    client.labelMarker.setIcon(labelIcon);
  });
  applyVisibilityFilters();
});

$("showAllSites").addEventListener("click", () => {
  document.querySelectorAll("#sitesList input[type=checkbox]").forEach((checkbox) => {
    checkbox.checked = true;
  });

  siteGroups.forEach((info) => {
    info.visible = true;
  });

  applyVisibilityFilters();
});

$("hideAllSites").addEventListener("click", () => {
  document.querySelectorAll("#sitesList input[type=checkbox]").forEach((checkbox) => {
    checkbox.checked = false;
  });

  siteGroups.forEach((info) => {
    info.visible = false;
  });

  applyVisibilityFilters();
});

$("toggleCoverage").addEventListener("change", applyVisibilityFilters);
$("toggleSiteMarkers").addEventListener("change", applyVisibilityFilters);
$("toggleLabels").addEventListener("change", applyVisibilityFilters);
$("toggleZTE").addEventListener("change", applyVisibilityFilters);
$("toggleERI").addEventListener("change", applyVisibilityFilters);
$("toggleClients").addEventListener("change", applyVisibilityFilters);
$("toggleClientHome").addEventListener("change", applyVisibilityFilters);

$("fitAll").addEventListener("click", () => {
  const layers = [];
  coverageRoot.eachLayer((layer) => layers.push(layer));
  siteMarkerRoot.eachLayer((layer) => layers.push(layer));
  labelRoot.eachLayer((layer) => layers.push(layer));
  clientRoot.eachLayer((layer) => layers.push(layer));
  if (map.hasLayer(clientMarker)) layers.push(clientMarker);
  if (map.hasLayer(clientLabelMarker)) layers.push(clientLabelMarker);
  if (measurementLine) layers.push(measurementLine);

  if (layers.length === 0) return;

  const group = L.featureGroup(layers);
  const bounds = group.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds.pad(0.2));
});

$("reset").addEventListener("click", () => {
  stationsState = initialStations.slice();
  $("beamLength").value = 150;
  $("labelSize").value = 24;
  currentBeamLen = 150;
  currentLabelPx = 24;
  rebuildAll(stationsState);

  clients.forEach((client) => {
    clientRoot.removeLayer(client.marker);
    clientRoot.removeLayer(client.labelMarker);
  });

  clients = [];
  $("clientsList").innerHTML = "";
  $("toggleClients").checked = true;
  $("toggleClientHome").checked = true;
  resetMeasurement();
  map.setView([clientHome.lat, clientHome.lon], 17);
  applyVisibilityFilters();
});

$("importFile").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      let rows = [];

      if (file.name.toLowerCase().endsWith(".json")) {
        const data = JSON.parse(reader.result);
        rows = [];
        data.forEach((item) => {
          const siteName = String(item.site_name || item.site || "").trim();
          const sector = Number(item.sector_fisico_sector ?? item.sector ?? item.sector_id ?? 0);
          const latitude = Number(item.latitude);
          const longitude = Number(item.longitude);
          const azimuth = Number(item.azimuth ?? item.az ?? item.bearing ?? 0);
          const vendor = String(item.VENDOR || item.vendor || "OTRO").toUpperCase();

          if (
            !siteName ||
            Number.isNaN(sector) ||
            Number.isNaN(latitude) ||
            Number.isNaN(longitude) ||
            Number.isNaN(azimuth)
          ) {
            return;
          }

          rows.push([siteName.toUpperCase(), sector, latitude, longitude, azimuth, vendor]);
        });
      } else {
        const text = reader.result.replace(/\r/g, "");
        const lines = text.split("\n").filter((line) => line.trim().length > 0);
        const head = lines[0].toLowerCase();
        let start = 0;
        if (
          head.includes("site") &&
          head.includes("sector") &&
          head.includes("latitude")
        ) {
          start = 1;
        }

        for (let i = start; i < lines.length; i += 1) {
          const cols = lines[i].split(",").map((col) => col.trim());
          if (cols.length < 6) continue;

          const siteName = cols[0];
          const sector = Number(cols[1]);
          const latitude = Number(cols[2]);
          const longitude = Number(cols[3]);
          const azimuth = Number(cols[4]);
          const vendor = String(cols[5] || "OTRO").toUpperCase();

          if (
            !siteName ||
            Number.isNaN(sector) ||
            Number.isNaN(latitude) ||
            Number.isNaN(longitude) ||
            Number.isNaN(azimuth)
          ) {
            continue;
          }

          rows.push([siteName.toUpperCase(), sector, latitude, longitude, azimuth, vendor]);
        }
      }

      rows.forEach((row) => stationsState.push(row));
      rebuildAll(stationsState);
    } catch (error) {
      alert(`No se pudo importar. Revisa el formato. ${error.message}`);
    }
  };

  reader.readAsText(file);
});

$("downloadTemplate").addEventListener("click", () => {
  const template = "site_name,sector,latitude,longitude,azimuth,vendor\nSITE001,1,41.64,-0.87,0,ZTE";
  const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "plantilla_estaciones.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

$("exportStations").addEventListener("click", () => {
  if (!stationsState.length) {
    alert("No hay estaciones para exportar.");
    return;
  }

  const header = "site_name,sector,latitude,longitude,azimuth,vendor";
  const lines = stationsState.map(
    ([site, sector, lat, lon, az, vendor]) => `${site},${sector},${lat},${lon},${az},${vendor}`,
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "irreyes_sites.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

$("clearAll").addEventListener("click", () => {
  if (!stationsState.length) return;
  if (!confirm("¿Seguro que quieres eliminar todas las estaciones?")) return;
  stationsState = [];
  rebuildAll(stationsState);
});

$("siteSearch").addEventListener("click", () => {
  const query = $("siteSearchInput").value.trim().toUpperCase();
  if (!query) {
    $("siteSearchHint").textContent = "Introduce un código para buscar.";
    refreshSitesListUI();
    return;
  }

  const site = sitesOrder.find((name) => name.toUpperCase() === query || name.toUpperCase().includes(query));
  if (!site) {
    $("siteSearchHint").textContent = `No se encontró ningún site con "${query}".`;
    refreshSitesListUI();
    return;
  }

  const info = siteGroups.get(site);
  map.flyTo([info.lat, info.lon], 18, { duration: 0.8 });
  if (info.marker) {
    info.marker.openPopup();
  }
  $("siteSearchHint").textContent = `Site ${site} centrado en el mapa.`;
  refreshSitesListUI();
});

$("siteSearchInput").addEventListener("keyup", (event) => {
  if (event.key === "Enter") {
    $("siteSearch").click();
  } else {
    refreshSitesListUI();
  }
});

$("addClient").addEventListener("click", async () => {
  const txt = $("clientInput").value.trim();
  if (!txt) return;

  const parts = txt.split(",").map((part) => part.trim());
  if (
    parts.length >= 2 &&
    !Number.isNaN(parseFloat(parts[0])) &&
    !Number.isNaN(parseFloat(parts[1]))
  ) {
    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    const label = parts[2] ? parts.slice(2).join(",") : "CLIENTE";
    addClientPoint(lat, lon, label);
    $("clientInput").value = "";
    map.flyTo([lat, lon], 18, { duration: 0.8 });
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(txt)}`;
    const resp = await fetch(url, { headers: { "Accept-Language": "es" } });
    const data = await resp.json();
    if (data && data[0]) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      addClientPoint(lat, lon, txt);
      $("clientInput").value = "";
      map.flyTo([lat, lon], 18, { duration: 0.8 });
    } else {
      alert("No se encontró esa dirección. Introduce coordenadas lat,lon.");
    }
  } catch (error) {
    alert("Geocodificación no disponible. Introduce coordenadas lat,lon.");
  }
});
