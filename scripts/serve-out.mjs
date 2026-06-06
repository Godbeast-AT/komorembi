import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import http from "node:http";

const port = Number(process.env.PORT || 3000);
const root = normalize(join(process.cwd(), "out"));

const mimeTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".ico": "image/x-icon",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
    ".webp": "image/webp",
};

function resolvePath(urlPath) {
    const safePath = normalize(decodeURIComponent(urlPath.split("?")[0]));
    const candidate = safePath === "/" ? "/index.html" : safePath;
    let filePath = normalize(join(root, candidate));

    if (!filePath.startsWith(root)) {
        return null;
    }

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
        filePath = join(filePath, "index.html");
    }

    if (!existsSync(filePath) && !extname(filePath)) {
        const htmlPath = `${filePath}.html`;
        if (existsSync(htmlPath)) {
            filePath = htmlPath;
        } else {
            filePath = join(filePath, "index.html");
        }
    }

    return existsSync(filePath) ? filePath : null;
}

const server = http.createServer((req, res) => {
    const filePath = resolvePath(req.url || "/");

    if (!filePath) {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        res.end("Not found");
        return;
    }

    const ext = extname(filePath);
    res.writeHead(200, {
        "Content-Type": mimeTypes[ext] || "application/octet-stream",
        "Cache-Control": "no-cache",
    });

    createReadStream(filePath).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
    console.log(`Serving ${root} at http://127.0.0.1:${port}`);
});
