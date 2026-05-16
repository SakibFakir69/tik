require("dotenv").config();
const express = require("express");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const mongoose = require("mongoose");
const { randomUUID: uuidv4 } = require("crypto");
const pLimit = require("p-limit").default ?? require("p-limit");

const { limiter } = require("./middleware/rate-limiting");
const { Count } = require("./model/model.count");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://www.quicksavevid.com",
    "https://quick-save-ui-nine.vercel.app",
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
}));
app.use(limiter);

// ── DB ────────────────────────────────────────────────────────────────────────
const DB_URL = process.env.DB_URL;
if (!DB_URL) throw new Error("DB_URL env var required");

mongoose.connect(DB_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => { console.error("❌ DB error:", err.message); process.exit(1); });

// ── Downloads dir ─────────────────────────────────────────────────────────────
const DOWNLOAD_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

// ── Concurrency: 10 parallel yt-dlp processes ─────────────────────────────────
// Tune this based on your server CPU/RAM
// 1 core  → limit(3)
// 2 cores → limit(6)
// 4 cores → limit(10)
const limit = pLimit(3);

// Track active child processes for cleanup on shutdown
const activeJobs = new Map(); // jobId → { child, jobDir }

function sanitizeFilename(name) {
  return name.replace(/\.+/g, "_").replace(/[^\w\-]+/g, "_").substring(0, 100);
}

function cleanupDir(dirPath) {
  try { fs.rmSync(dirPath, { recursive: true, force: true }); }
  catch (err) { console.error("Cleanup error:", err.message); }
}

// Fire-and-forget counter
function incrementCounter() {
  Count.findOne({})
    .then(counter => {
      if (!counter) return new Count({ count: 1 }).save();
      counter.count += 1;
      return counter.save();
    })
    .catch(err => console.error("Counter error (non-fatal):", err.message));
}

// ── Routes ────────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => res.json({
  status: "ok",
  message: "TikTok Downloader API",
  timestamp: new Date().toISOString()
}));

app.post("/api/counter", async (_req, res) => {
  try {
    let counter = await Count.findOne({});
    if (!counter) counter = new Count({ count: 1 });
    else counter.count += 1;
    await counter.save();
    res.status(201).json({ status: true, count: counter.count });
  } catch (err) {
    res.status(500).json({ status: false, message: "Failed to update count" });
  }
});

app.get("/counter", async (_req, res) => {
  try {
    const counter = await Count.findOne();
    res.json({ status: true, count: counter?.count ?? 0 });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
});

// ── Main download endpoint ────────────────────────────────────────────────────
app.post("/api/download-tiktok", async (req, res) => {
  const { url } = req.body;

  // Strict URL validation
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "URL is required." });
  }
  let parsedUrl;
  try { parsedUrl = new URL(url); }
  catch { return res.status(400).json({ error: "Invalid URL format." }); }
  if (!parsedUrl.hostname.endsWith("tiktok.com")) {
    return res.status(400).json({ error: "Only TikTok URLs are supported." });
  }

  const jobId = uuidv4();
  const jobDir = path.join(DOWNLOAD_DIR, jobId);
  fs.mkdirSync(jobDir, { recursive: true });

  let clientGone = false;
  req.on("close", () => {
    clientGone = true;
    // Kill the yt-dlp process if client disconnects
    const job = activeJobs.get(jobId);
    if (job?.child) {
      job.child.kill("SIGKILL");
      console.log(`Job ${jobId} killed — client disconnected`);
    }
    cleanupDir(jobDir);
    activeJobs.delete(jobId);
  });

  try {
    await limit(() => new Promise((resolve, reject) => {
      if (clientGone) return reject(new Error("Client disconnected"));

      const child = execFile(
        "yt-dlp",
        [
          "-o", path.join(jobDir, "%(title)s.%(ext)s"),
          "--restrict-filenames",
          "--no-playlist",
          "--no-warnings",
          "--socket-timeout", "15",   // network timeout per request
          url,
        ],
        { timeout: 90_000 },          // 90s hard kill (long videos)
        (err, _stdout, stderr) => {
          activeJobs.delete(jobId);
          if (err) reject(Object.assign(err, { stderr }));
          else resolve();
        }
      );

      activeJobs.set(jobId, { child, jobDir });
    }));

  } catch (err) {
    if (!clientGone) {
      cleanupDir(jobDir);
      return res.status(500).json({
        error: "Download failed.",
        details: err.stderr || err.message
      });
    }
    return; // client already gone, nothing to send
  }

  if (clientGone) return;

  const files = fs.readdirSync(jobDir);
  if (files.length === 0) {
    cleanupDir(jobDir);
    return res.status(500).json({ error: "No file was downloaded." });
  }

  const originalFile = files[0];
  const ext = path.extname(originalFile);
  const baseName = path.basename(originalFile, ext);
  const safeBase = sanitizeFilename(baseName);
  const safeFilename = safeBase + ext;

  if (originalFile !== safeFilename) {
    fs.renameSync(
      path.join(jobDir, originalFile),
      path.join(jobDir, safeFilename)
    );
  }

  incrementCounter(); // non-blocking

  res.json({
    success: true,
    message: "Download complete",
    filename: safeFilename,
    downloadUrl: `/video/${jobId}/${encodeURIComponent(safeFilename)}`,
    title: safeBase,
  });
});

// ── File serve + cleanup ──────────────────────────────────────────────────────
app.get("/video/:jobId/:filename", (req, res) => {
  const { jobId, filename } = req.params;

  // UUID format guard
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(jobId)) {
    return res.status(400).send("Invalid job ID");
  }

  const safeFilename = path.basename(filename);
  const filePath = path.join(DOWNLOAD_DIR, jobId, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File not found or already downloaded");
  }

  res.download(filePath, safeFilename, (err) => {
    if (err && !res.headersSent) res.status(500).send("Server error");
    cleanupDir(path.join(DOWNLOAD_DIR, jobId)); // cleanup after delivery
  });
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`${signal} received — shutting down`);
  // Kill all active yt-dlp processes
  for (const [jobId, { child, jobDir }] of activeJobs) {
    child.kill("SIGKILL");
    cleanupDir(jobDir);
    console.log(`Cleaned up job ${jobId}`);
  }
  mongoose.connection.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000); // force exit after 5s
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException",  (err) => console.error("Uncaught:", err));
process.on("unhandledRejection", (r)   => console.error("Unhandled:", r));

// ── Stale file cleanup (runs every 30 min) ────────────────────────────────────
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000; // 30 minutes
  try {
    for (const entry of fs.readdirSync(DOWNLOAD_DIR)) {
      const full = path.join(DOWNLOAD_DIR, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory() && stat.mtimeMs < cutoff) {
        cleanupDir(full);
        console.log("Cleaned stale job dir:", entry);
      }
    }
  } catch (err) {
    console.error("Stale cleanup error:", err.message);
  }
}, 30 * 60 * 1000);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));