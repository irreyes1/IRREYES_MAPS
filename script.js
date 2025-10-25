const canvas = document.getElementById("handoverCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 800;
canvas.height = 400;

// Dibujar dos estaciones y zonas de cobertura
const sites = [
  {x: 200, y: 200, color: "blue", name: "Site A"},
  {x: 600, y: 200, color: "green", name: "Site B"}
];

function drawSites() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  sites.forEach(site => {
    for (let r = 60; r <= 180; r += 40) {
      ctx.beginPath();
      ctx.arc(site.x, site.y, r, 0, 2 * Math.PI);
      ctx.strokeStyle = site.color;
      ctx.globalAlpha = 0.25;
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = site.color;
    ctx.fillText(site.name, site.x - 25, site.y + 5);
  });
}
drawSites();
