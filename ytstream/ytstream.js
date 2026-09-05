// YouTube ses köprüsü (yt-dlp -> seekable dosya -> Lavalink http kaynağı).
// Canlı WebM akışını Lavalink algılayamıyordu; onun yerine sesi temp dosyaya
// indirip Range destekli servis ediyoruz (Lavalink kusursuz algılıyor).
// URL:  http://127.0.0.1:2444/stream?v=<videoId>
const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const PORT = 2444;
const HOST = "127.0.0.1";
const YTDLP = "/usr/local/bin/yt-dlp";
const FORMAT = "251/250/249/bestaudio"; // opus/webm önce
const CACHE = "/root/ytstream/cache";
const TTL_MS = 60 * 60 * 1000; // 1 saat sonra sil
const SWEEP_MS = 15 * 60 * 1000;

fs.mkdirSync(CACHE, { recursive: true });

const pending = new Map(); // id -> Promise<filePath>

function filePathFor(id) {
  return path.join(CACHE, id + ".webm");
}

function ensureFile(id) {
  const fp = filePathFor(id);
  if (fs.existsSync(fp) && fs.statSync(fp).size > 0) {
    fs.utimes(fp, new Date(), new Date(), () => {});
    return Promise.resolve(fp);
  }
  if (pending.has(id)) return pending.get(id);

  const tmp = fp + ".tmp";
  const pr = new Promise((resolve, reject) => {
    const args = ["-q", "--no-warnings", "-f", FORMAT, "-o", tmp, "--", "https://www.youtube.com/watch?v=" + id];
    const p = spawn(YTDLP, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", (e) => reject(e));
    p.on("close", (code) => {
      if (code === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 0) {
        try { fs.renameSync(tmp, fp); } catch (e) { return reject(e); }
        resolve(fp);
      } else {
        try { fs.existsSync(tmp) && fs.unlinkSync(tmp); } catch (_) {}
        reject(new Error("yt-dlp exit " + code + ": " + err.slice(-300)));
      }
    });
  }).finally(() => pending.delete(id));

  pending.set(id, pr);
  return pr;
}

function serveFile(fp, req, res) {
  const size = fs.statSync(fp).size;
  const range = req.headers.range;
  const headBase = {
    "Content-Type": "audio/webm",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
  };
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : 0;
    let end = m && m[2] ? parseInt(m[2], 10) : size - 1;
    if (isNaN(start)) start = 0;
    if (isNaN(end) || end >= size) end = size - 1;
    if (start > end || start >= size) {
      res.writeHead(416, { "Content-Range": `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, {
      ...headBase,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": end - start + 1,
    });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(fp, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { ...headBase, "Content-Length": size });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(fp).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  const v = u.searchParams.get("v");
  if (!v || !/^[\w-]{11}$/.test(v)) {
    res.writeHead(400);
    return res.end("bad video id");
  }
  // /prepare: sesi indir (cache'e al), hazir olunca kucuk JSON don. Bot bunu
  // bekleyip sonra Lavalink'e /stream URL'ini veriyor (cache hit = hizli+seekable).
  if (u.pathname === "/prepare") {
    try {
      const fp = await ensureFile(v);
      const size = fs.statSync(fp).size;
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ready: true, size }));
    } catch (e) {
      console.error(`[ytstream] prepare ${v} HATA:`, e.message);
      res.writeHead(502, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ready: false, error: String(e.message).slice(0, 200) }));
    }
  }
  if (u.pathname !== "/stream") {
    res.writeHead(404);
    return res.end("not found");
  }
  try {
    const fp = await ensureFile(v);
    serveFile(fp, req, res);
  } catch (e) {
    console.error(`[ytstream] ${v} HATA:`, e.message);
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("stream error");
  }
});

// eski cache temizligi
setInterval(() => {
  const now = Date.now();
  for (const f of fs.readdirSync(CACHE)) {
    const fp = path.join(CACHE, f);
    try {
      if (now - fs.statSync(fp).mtimeMs > TTL_MS) fs.unlinkSync(fp);
    } catch (_) {}
  }
}, SWEEP_MS).unref();

server.listen(PORT, HOST, () => console.log(`[ytstream] dinliyor http://${HOST}:${PORT} (yt-dlp -> seekable dosya)`));
