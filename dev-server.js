/**
 * Local Development Server for GCOunsel (Netlify Function & Static File Runner)
 * Run with: node dev-server.js
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const FUNCTIONS_DIR = path.join(__dirname, "netlify", "functions");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = reqUrl.pathname;

  // 1. Route Netlify Serverless Functions (/api/*)
  if (pathname.startsWith("/api/")) {
    const fnName = pathname.slice(5).split("/")[0]; // e.g. /api/book-appointment -> book-appointment
    const fnPath = path.join(FUNCTIONS_DIR, `${fnName}.js`);

    if (fs.existsSync(fnPath)) {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          delete require.cache[require.resolve(fnPath)];
          const { handler } = require(fnPath);

          const event = {
            httpMethod: req.method,
            path: pathname,
            queryStringParameters: Object.fromEntries(reqUrl.searchParams),
            headers: req.headers,
            body: body || null,
          };

          const result = await handler(event, {});

          res.writeHead(result.statusCode || 200, {
            "Content-Type": "application/json",
            ...(result.headers || {}),
          });
          res.end(result.body || "");
        } catch (err) {
          console.error(`Error in function ${fnName}:`, err);
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err.message || "Internal Server Error" }));
        }
      });
      return;
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Function ${fnName} not found` }));
      return;
    }
  }

  // 2. Serve Static Frontend Files
  let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);

  // If path doesn't have an extension, try appending .html
  if (!path.extname(filePath) && fs.existsSync(`${filePath}.html`)) {
    filePath = `${filePath}.html`;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": contentType });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  // SPA fallback to index.html
  const fallbackPath = path.join(PUBLIC_DIR, "index.html");
  if (fs.existsSync(fallbackPath)) {
    res.writeHead(200, { "Content-Type": "text/html" });
    fs.createReadStream(fallbackPath).pipe(res);
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`==================================================================`);
  console.log(` GCOunsel Local Development Server`);
  console.log(` Running at: http://localhost:${PORT}`);
  console.log(` Student Portal: http://localhost:${PORT}/index.html`);
  console.log(` Counselor/Admin Login: http://localhost:${PORT}/login.html`);
  console.log(`==================================================================`);
});
