const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const app = express();

app.use(express.json());

app.post("/api/download-tiktok", async (req, res) => {
  const { url } = req.body;

  if (!url || !url.includes("tiktok.com")) {
    return res.status(400).json({ error: "❌ Valid TikTok URL required." });
  }

  const downloadDir = path.join(__dirname, "downloads");
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const outputPath = path.join(downloadDir, "%(title)s.%(ext)s");
  const cmd = `yt-dlp -o "${outputPath}" "${url}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp error:", err.message, stderr);
      return res.status(500).json({ error: "Download failed.", details: err.message + " " + stderr });
    }

    console.log("yt-dlp output:", stdout);
    return res.json({
      message: "✅ Download triggered",
      output: stdout
    });
  });
});

// Debug endpoint to check yt-dlp
app.get("/api/check-yt-dlp", (req, res) => {
  exec("yt-dlp --version", (err, stdout, stderr) => {
    if (err) return res.status(500).json({ error: "yt-dlp not found", details: stderr });
    res.json({ version: stdout });
  });
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});