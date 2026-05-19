const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(process.cwd(), "public");
const port = Number(process.env.PORT || 5173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  let requested = decodeURIComponent(url.pathname);
  if (requested === "/") {
    requested = "/index.html";
  }

  const full = path.normalize(path.join(root, requested));
  if (!full.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(full, (error, data) => {
    if (error) {
      fs.readFile(path.join(root, "index.html"), (fallbackError, fallback) => {
        if (fallbackError) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": types[".html"] });
        res.end(fallback);
      });
      return;
    }

    res.writeHead(200, { "Content-Type": types[path.extname(full)] || "application/octet-stream" });
    res.end(data);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`http://127.0.0.1:${port}/`);
});
