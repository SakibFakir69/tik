const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const cors = require("cors");

const app = express();
app.use(express.json());

// CORS for local + Netlify
app.use(cors({
  origin: ["http://localhost:5173", "https://marvelous-dusk-b0bc58.netlify.app"]
}));

const DOWNLOAD_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

// Sanitize filename to avoid multiple dots and special chars
function sanitizeFilename(name) {
  return name
    .replace(/\.+/g, '_')               // Replace one or more dots with underscore
    .replace(/[^\w\-]+/g, '_')          // Replace non-word chars except dash with underscore
    .substring(0, 100);                 // Limit length to 100 chars
}

// TikTok download endpoint
app.post("/api/download-tiktok", (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes("tiktok.com")) {
    return res.status(400).json({ error: "❌ Valid TikTok URL required." });
  }

  // Clean up old files (optional)
  const existingFiles = fs.readdirSync(DOWNLOAD_DIR);
  for (const file of existingFiles) {
    fs.unlinkSync(path.join(DOWNLOAD_DIR, file));
  }

  const cmd = `yt-dlp -o "${DOWNLOAD_DIR}/%(title)s.%(ext)s" --restrict-filenames --no-playlist "${url}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp error:", err.message, stderr);
      return res.status(500).json({ error: "Download failed.", details: err.message });
    }

    const files = fs.readdirSync(DOWNLOAD_DIR);
    if (files.length === 0) {
      return res.status(500).json({ error: "No file was downloaded." });
    }

    let originalFile = files[0];
    const ext = path.extname(originalFile);
    const baseName = path.basename(originalFile, ext);
    const safeBaseName = sanitizeFilename(baseName);
    const safeFilename = safeBaseName + ext;

    // Rename if needed
    if (originalFile !== safeFilename) {
      fs.renameSync(path.join(DOWNLOAD_DIR, originalFile), path.join(DOWNLOAD_DIR, safeFilename));
    }

    const downloadUrl = `/video/${encodeURIComponent(safeFilename)}`;
    res.json({
      success: true,
      message: "✅ Download complete",
      filename: safeFilename,
      downloadUrl,
      title: safeBaseName,
    });
  });
});

// Force download route with security
app.get('/video/:filename', (req, res) => {
  const filename = req.params.filename;

  const safeFilename = path.basename(filename); // prevent directory traversal
  const filePath = path.join(DOWNLOAD_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.download(filePath, safeFilename, (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(500).send('Server error');
    }
  });
});

// Health check
app.get("/", (req, res) => {
  res.send("✅ TikTok Downloader API is running.");
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
