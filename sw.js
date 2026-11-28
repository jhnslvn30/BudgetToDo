const CACHE = "budget-todo-v13";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// 1. When installed, save all the files
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});

// 2. When a new version takes over, delete old saved files
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
});

// 3. For every request, use the saved copy first, then the network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((saved) => saved || fetch(event.request)),
  );
});
