/* Keeps the app's own files on the phone so it opens without a connection. */
var CACHE = "ezfuel-v2";
var FILES = ["./", "index.html", "app.css", "app.js", "store.js", "pdf.js", "config.js", "manifest.webmanifest",
  "img/logo.png", "img/logo.js", "img/icon-192.png", "img/icon-512.png", "img/apple-touch-icon.png",
  "vendor/jspdf.umd.min.js", "vendor/firebase-app-compat.js", "vendor/firebase-auth-compat.js", "vendor/firebase-firestore-compat.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

// Network first for the app's own files (so updates arrive), cache when offline.
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(function (res) {
    var copy = res.clone();
    caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    return res;
  }).catch(function () {
    return caches.match(e.request).then(function (r) { return r || caches.match("index.html"); });
  }));
});
