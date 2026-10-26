// The web page behind shared listing links (https://gumacartfinal.web.app/listing/<id>,
// routed here by firebase.json). It shows the item's photo, name and price,
// so Messenger / Facebook previews show the item too, and opens the app:
// on Android an intent link opens GumaCart (or comes back with ?noapp=1).
// Only active or sold listings are shown; anything else gets the plain page.

const SITE = "https://gumacartfinal.web.app";
const PACKAGE = "com.omargerez.gumacart";

const TYPE_LABELS = { sell: "For Sale", buy: "Looking For", barter: "Barter", donate: "Donate" };
const TYPE_COLORS = { sell: "#1B6B3A", buy: "#2563EB", barter: "#7C3AED", donate: "#DB2777" };

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
const peso = (n) => "₱" + Number(n || 0).toLocaleString("en-PH");

// Same wording as priceLabel() in constants/listings.js.
function priceText(item) {
  if (item.type === "donate") return "FREE";
  if (item.type === "barter") return "For Barter";
  if (item.type === "buy") return item.price ? `Budget ${peso(item.price)}` : "Looking For";
  return item.price != null ? peso(item.price) : "₱—";
}

function renderListingPage(id, item) {
  const shown = item && (item.status === "active" || item.status === "sold");
  const name = shown ? (item.name || item.title || "A listing") : null;
  const image = shown ? ((item.images && item.images[0]) || item.image || null) : null;
  const price = shown ? priceText(item) : null;
  const sold = shown && item.status === "sold";
  const type = shown ? (item.type || "sell") : null;
  const details = shown ? [item.condition, item.location ? `Meet-up: ${item.location}` : null].filter(Boolean).join(" · ") : "";

  const title = shown ? `${name} · ${sold ? "Sold" : price}` : "A listing on SLSU-GumaCart";
  const description = shown
    ? `${TYPE_LABELS[type] || "Listing"}${details ? " · " + details : ""} — on SLSU-GumaCart, the campus marketplace of SLSU Gumaca.`
    : "Tap to view it in the GumaCart app, the campus marketplace of SLSU Gumaca.";
  const ogImage = image || `${SITE}/icon.png`;
  const url = `${SITE}/listing/${id}`;
  const appPath = id ? `listing/${id}` : "";
  const intent = `intent://${appPath}#Intent;scheme=gumacart;package=${PACKAGE};S.browser_fallback_url=${encodeURIComponent(url + "?noapp=1")};end`;

  const card = shown ? `
    <div class="card">
      ${image ? `<div class="photo" style="background-image:url('${esc(image)}')">${sold ? "<span class=\"sold\">SOLD</span>" : ""}</div>` : ""}
      <div class="info">
        <span class="badge" style="color:${TYPE_COLORS[type] || "#1B6B3A"};background:${TYPE_COLORS[type] || "#1B6B3A"}1A">${esc(TYPE_LABELS[type] || "Listing")}</span>
        <h1>${esc(name)}</h1>
        <div class="price">${esc(sold ? "Sold" : price)}</div>
        ${details ? `<div class="details">${esc(details)}</div>` : ""}
      </div>
    </div>` : `
    <img class="logo" src="/icon.png" alt="GumaCart">
    <h1>Open in GumaCart</h1>
    <p>This listing is on SLSU-GumaCart, the campus marketplace for SLSU Gumaca students and faculty.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="SLSU-GumaCart">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:url" content="${esc(url)}">
  <meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}">
  <meta name="theme-color" content="#1B6B3A">
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
           background: #F6FAF7; font-family: system-ui, sans-serif; color: #1F2D24; }
    main { width: 100%; max-width: 380px; padding: 28px 20px; box-sizing: border-box; text-align: center; }
    .brand { display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700;
             color: #1B6B3A; margin-bottom: 16px; }
    .brand img { width: 28px; height: 28px; border-radius: 8px; }
    .card { background: #fff; border-radius: 20px; overflow: hidden; text-align: left;
            box-shadow: 0 6px 24px rgba(27, 107, 58, 0.12); margin-bottom: 20px; }
    .photo { position: relative; aspect-ratio: 1 / 1; background: #E8F1EB center / cover no-repeat; }
    .sold { position: absolute; top: 12px; left: 12px; background: #1F2D24; color: #fff; font-weight: 800;
            font-size: 13px; padding: 5px 10px; border-radius: 8px; letter-spacing: 1px; }
    .info { padding: 16px 18px 18px; }
    .badge { display: inline-block; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
    .card h1 { font-size: 20px; margin: 10px 0 4px; line-height: 1.3; }
    .price { font-size: 22px; font-weight: 800; color: #1B6B3A; }
    .details { margin-top: 6px; font-size: 14px; color: #5B6B60; }
    .logo { width: 96px; height: 96px; border-radius: 24px; }
    main > h1 { font-size: 22px; margin: 18px 0 8px; }
    p { font-size: 15px; line-height: 1.5; color: #5B6B60; margin: 0 0 22px; }
    a.btn { display: block; padding: 15px; border-radius: 14px; background: #1B6B3A; color: #fff;
            font-weight: 700; font-size: 16px; text-decoration: none; }
    small { display: block; margin-top: 16px; font-size: 13px; color: #8A988E; line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    ${shown ? "<div class=\"brand\"><img src=\"/icon.png\" alt=\"\">SLSU-GumaCart</div>" : ""}
    ${card}
    <a class="btn" id="open" href="gumacart://${esc(appPath)}">Open in GumaCart</a>
    <small id="note">Don't have the app yet? Ask a friend or the GumaCart team for it.</small>
  </main>
  <script>
    var isAndroid = /Android/i.test(navigator.userAgent);
    var intent = ${JSON.stringify(intent)};
    if (isAndroid) document.getElementById('open').href = intent;
    if (/[?&]noapp=1/.test(location.search)) {
      document.getElementById('note').textContent = 'GumaCart isn\\u2019t installed on this phone. Ask a friend or the GumaCart team for the app, then tap the link again.';
    } else if (isAndroid) {
      location.replace(intent);
    }
  </script>
</body>
</html>`;
}

module.exports = { renderListingPage };
