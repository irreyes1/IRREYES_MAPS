const clientHome = { lat: 41.642155, lon: -0.873633, label: "CLIENTE" };

const initialStations = [
  ["ARA0011", 1, 41.648031, -0.880675,   0, "ZTE"],
  ["ARA0011", 2, 41.648031, -0.880675, 120, "ZTE"],
  ["ARA0011", 3, 41.648031, -0.880675, 255, "ZTE"],
  ["ARA0012", 1, 41.646781, -0.872578,   0, "ZTE"],
  ["ARA0012", 2, 41.646781, -0.872578, 120, "ZTE"],
  ["ARA0012", 3, 41.646781, -0.872578, 240, "ZTE"],
  ["ARA0022", 1, 41.63988845, -0.869192292, 120, "ZTE"],
  ["ARA0022", 2, 41.63988845, -0.869192292, 240, "ZTE"],
  ["ARA0022", 3, 41.63988845, -0.869192292, 240, "ZTE"],
  ["ARA0309", 1, 41.647884, -0.875625,   0, "ZTE"],
  ["ARA0309", 2, 41.647884, -0.875625, 120, "ZTE"],
  ["ARA0309", 3, 41.647884, -0.875625, 240, "ZTE"],
  ["ARA0319", 1, 41.641478, -0.883681,   0, "ZTE"],
  ["ARA0319", 2, 41.641478, -0.883681, 120, "ZTE"],
  ["ARA0319", 3, 41.641478, -0.883681, 240, "ZTE"],
  ["ARA0359", 1, 41.643953, -0.883145,  -1, "ZTE"],
  ["ARA0359", 1, 41.644784, -0.882117,   0, "ZTE"],
  ["ARA0359", 2, 41.644784, -0.882117, 120, "ZTE"],
  ["ARA0359", 3, 41.644784, -0.882117, 240, "ZTE"],
  ["ARA0362", 1, 41.643473, -0.869597,   0, "ZTE"],
  ["ARA0362", 2, 41.643473, -0.869597, 120, "ZTE"],
  ["ARA0362", 3, 41.643473, -0.869597, 240, "ZTE"],
  ["ARA0196", 1, 41.64238549, -0.871247422, 150, "ERI"],
  ["ARA0196", 2, 41.64238549, -0.871247422, 250, "ERI"],
  ["ARA0196", 3, 41.64238549, -0.871247422, 325, "ERI"]
];

const $ = (id) => document.getElementById(id);
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;
const colorByVendor = (vendor) => {
  if (vendor === "ZTE") return "blue";
  if (vendor === "ERI" || vendor === "ERICSSON") return "orange";
  return "gray";
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
      Math.sin(lat0) * Math.cos(d) +
        Math.cos(lat0) * Math.sin(d) * Math.cos(azimuth)
    );
    const lon1 =
      lon0 +
      Math.atan2(
        Math.sin(azimuth) * Math.sin(d) * Math.cos(lat0),
        Math.cos(d) - Math.sin(lat0) * Math.sin(lat1)
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

const clientMarker = L.marker([clientHome.lat, clientHome.lon], {
  title: clientHome.label,
}).addTo(map);

let clientLabelPx = 24;
const clientLabel = () =>
  L.divIcon({
    className: "client-label",
    html: `<div style="background:#DC143C;color:red;font-weight:bold;font-size:${clientLabelPx}px;padding:4px 8px;border:2px solid #8B0000;text-align:center;">${clientHome.label}</div>`,
    iconAnchor: [0, 0],
  });

const clientLabelMarker = L.marker([clientHome.lat, clientHome.lon], {
  icon: clientLabel(),
}).addTo(map);

const stationRoot = L.layerGroup().addTo(map);
const labelRoot = L.layerGroup().addTo(map);
const clientRoot = L.layerGroup().addTo(map);

let currentBeamLen = 150;
let currentLabelPx = 24;

const siteGroups = new Map();
const labelBySite = new Map();
let sitesOrder = [];
let clients = [];

function renderSite(site, sector, lat, lon, az, vendor) {
  const color = colorByVendor(vendor);
  const triangle = beamTriangle(lat, lon, az, currentBeamLen);
  const polygon = L.polygon(triangle, {
    color,
    weight: 2,
    fillOpacity: 0.25,
  }).bindPopup(`${site} S${sector} (${vendor}) - ${az}°`);

  const dot = L.circleMarker([lat, lon], {
    radius: 3,
    color,
    fill: true,
    fillOpacity: 1,
  });

  if (!siteGroups.has(site)) {
    const layers = L.layerGroup().addTo(stationRoot);
    siteGroups.set(site, { vendor, lat, lon, layers, visible: true });
  }

  const info = siteGroups.get(site);
  info.layers.addLayer(polygon);
  info.layers.addLayer(dot);
}

function renderLabel(site) {
  if (labelBySite.has(site)) return;

  const info = siteGroups.get(site);
  const bg = info.vendor === "ZTE" ? "#1E90FF" : info.vendor === "ERI" ? "#FF8C00" : "#888";
  const border = info.vendor === "ZTE" ? "#104E8B" : info.vendor === "ERI" ? "#CD6600" : "#555";

  const icon = L.divIcon({
    className: "site-label",
    html: `<div style="background:${bg};color:red;font-weight:bold;font-size:${currentLabelPx}px;padding:4px 8px;border:2px solid ${border};text-align:center;">${site}</div>`,
    iconAnchor: [0, 0],
  });

  const marker = L.marker([info.lat, info.lon], { icon }).addTo(labelRoot);
  marker.vendor = info.vendor;
  labelBySite.set(site, marker);
}

function refreshSitesListUI() {
  const container = $("sitesList");
  container.innerHTML = "";

  sitesOrder.forEach((site) => {
    const info = siteGroups.get(site);
    const id = `sitecb_${site}`;
    const row = document.createElement("label");

    const borderColor =
      info.vendor === "ZTE" ? "#104E8B" : info.vendor === "ERI" ? "#CD6600" : "#555";

    row.innerHTML = `<input type="checkbox" id="${id}" checked /> <span class="pill" style="border-color:${borderColor};">${site}</span>`;
    container.appendChild(row);

    row.querySelector("input").addEventListener("change", (event) => {
      const checked = event.target.checked;
      const siteInfo = siteGroups.get(site);
      siteInfo.visible = checked;

      if (checked) {
        stationRoot.addLayer(siteInfo.layers);
        labelRoot.addLayer(labelBySite.get(site));
      } else {
        stationRoot.removeLayer(siteInfo.layers);
        labelRoot.removeLayer(labelBySite.get(site));
      }
    });
  });
}

function applyVisibilityFilters() {
  const showStations = $("toggleStations").checked;
  const showLabels = $("toggleLabels").checked;
  const showZTE = $("toggleZTE").checked;
  const showERI = $("toggleERI").checked;

  siteGroups.forEach((info, site) => {
    const vendorVisible =
      (info.vendor === "ZTE" && showZTE) ||
      (info.vendor === "ERI" && showERI) ||
      (info.vendor !== "ZTE" && info.vendor !== "ERI");

    const shouldShow = vendorVisible && siteGroups.get(site).visible && showStations;

    if (shouldShow) {
      stationRoot.addLayer(info.layers);
    } else {
      stationRoot.removeLayer(info.layers);
    }
  });

  labelBySite.forEach((marker, site) => {
    const info = siteGroups.get(site);
    const vendorVisible =
      (info.vendor === "ZTE" && showZTE) ||
      (info.vendor === "ERI" && showERI) ||
      (info.vendor !== "ZTE" && info.vendor !== "ERI");

    const shouldShow = vendorVisible && info.visible && showLabels;

    if (shouldShow) {
      labelRoot.addLayer(marker);
    } else {
      labelRoot.removeLayer(marker);
    }
  });

  const showClients = $("toggleClients").checked;
  clients.forEach((client) => {
    if (showClients) {
      clientRoot.addLayer(client.marker);
      clientRoot.addLayer(client.labelMarker);
    } else {
      clientRoot.removeLayer(client.marker);
      clientRoot.removeLayer(client.labelMarker);
    }
  });

  clientMarker.addTo(map);
  clientLabelMarker.addTo(map);
}

function rebuildAll(stationsArray) {
  stationRoot.clearLayers();
  labelRoot.clearLayers();
  siteGroups.clear();
  labelBySite.clear();
  sitesOrder = [];

  clientLabelPx = currentLabelPx;
  clientLabelMarker.setIcon(clientLabel());

  stationsArray.forEach(([site, sector, lat, lon, az, vendor]) => {
    renderSite(site, sector, lat, lon, az, vendor);
    if (!sitesOrder.includes(site)) sitesOrder.push(site);
  });

  sitesOrder.forEach(renderLabel);
  refreshSitesListUI();
  applyVisibilityFilters();
}

function addClientPoint(lat, lon, label) {
  const marker = L.marker([lat, lon], { title: label || "Cliente" });

  const labelIcon = L.divIcon({
    html: `<div style="background:#DC143C;color:red;font-weight:bold;font-size:${currentLabelPx}px;padding:4px 8px;border:2px solid #8B0000;text-align:center;">${label || "CLIENTE"}</div>`,
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

let stationsState = initialStations.slice();
rebuildAll(stationsState);

$("applyStyle").addEventListener("click", () => {
  const len = parseFloat($("beamLength").value);
  const px = parseFloat($("labelSize").value);

  if (!Number.isNaN(len) && len > 0) currentBeamLen = len;
  if (!Number.isNaN(px) && px > 0) currentLabelPx = px;
  rebuildAll(stationsState);
});

$("showAllSites").addEventListener("click", () => {
  document
    .querySelectorAll("#sitesList input[type=checkbox]")
    .forEach((checkbox) => {
      checkbox.checked = true;
    });

  siteGroups.forEach((info) => {
    info.visible = true;
  });

  applyVisibilityFilters();
});

$("hideAllSites").addEventListener("click", () => {
  document
    .querySelectorAll("#sitesList input[type=checkbox]")
    .forEach((checkbox) => {
      checkbox.checked = false;
    });

  siteGroups.forEach((info) => {
    info.visible = false;
  });

  applyVisibilityFilters();
});

$("toggleStations").addEventListener("change", applyVisibilityFilters);
$("toggleLabels").addEventListener("change", applyVisibilityFilters);
$("toggleZTE").addEventListener("change", applyVisibilityFilters);
$("toggleERI").addEventListener("change", applyVisibilityFilters);

$("fitAll").addEventListener("click", () => {
  const group = L.featureGroup([
    stationRoot,
    labelRoot,
    clientRoot,
    clientMarker,
    clientLabelMarker,
  ]);
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
  map.setView([clientHome.lat, clientHome.lon], 17);
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
        rows = data.map((item) => [
          item.site_name,
          Number(item.sector_fisico_sector),
          Number(item.latitude),
          Number(item.longitude),
          Number(item.azimuth),
          String(item.VENDOR || item.vendor || "OTRO").toUpperCase(),
        ]);
      } else {
        const text = reader.result.replace(/\r/g, "");
        const lines = text.split("\n").filter((line) => line.trim().length > 0);
        const head = lines[0].toLowerCase();
        let start = 0;
        if (
          head.includes("site_name") &&
          head.includes("sector") &&
          head.includes("latitude")
        ) {
          start = 1;
        }

        for (let i = start; i < lines.length; i += 1) {
          const cols = lines[i].split(",").map((col) => col.trim());
          if (cols.length < 6) continue;
          rows.push([
            cols[0],
            Number(cols[1]),
            Number(cols[2]),
            Number(cols[3]),
            Number(cols[4]),
            String(cols[5] || "OTRO").toUpperCase(),
          ]);
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

$("clearAll").addEventListener("click", () => {
  stationsState = [];
  rebuildAll(stationsState);
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
    return;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      txt
    )}`;
    const resp = await fetch(url, { headers: { "Accept-Language": "es" } });
    const data = await resp.json();
    if (data && data[0]) {
      addClientPoint(parseFloat(data[0].lat), parseFloat(data[0].lon), txt);
      $("clientInput").value = "";
    } else {
      alert("No se encontró esa dirección. Introduce coordenadas lat,lon.");
    }
  } catch (error) {
    alert("Geocodificación no disponible. Introduce coordenadas lat,lon.");
  }
});

$("toggleClients").addEventListener("change", applyVisibilityFilters);
