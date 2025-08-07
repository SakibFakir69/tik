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

    // Get the most recently downloaded file
    const files = fs.readdirSync(DOWNLOAD_DIR);
    if (files.length === 0) {
      return res.status(500).json({ error: "No file was downloaded." });
    }

    // Assuming only one file downloaded
    const fileName = files[0];
    const downloadUrl = `/video/${fileName}`;
    res.json({
      success: true,
      message: "✅ Download complete",
      filename: fileName,
      downloadUrl: downloadUrl,
      title: path.parse(fileName).name
    });
  });
});

// // Serve downloaded videos
// app.use('/video', express.static(DOWNLOAD_DIR));

// // Check yt-dlp version
// app.get("/api/check-yt-dlp", (req, res) => {

//   exec("yt-dlp --version", (err, stdout, stderr) => {
//     if (err) return res.status(500).json({ error: "yt-dlp not found", details: stderr });
//     res.json({ version: stdout.trim() });
//   });
// });

// Remove or comment out this:
// app.use('/video', express.static(DOWNLOAD_DIR));

// Instead, add this route to force download:

app.get('/video/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Security: sanitize filename to avoid directory traversal
  const safeFilename = path.basename(filename);
  const filePath = path.join(DOWNLOAD_DIR, safeFilename);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  // Use res.download to force download
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
