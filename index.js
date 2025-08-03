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

  const outputPath = "downloads/%(title)s.%(ext)s";
  const cmd = `yt-dlp -o "${outputPath}" "${url}"`;

  exec(cmd, (err, stdout, stderr) => {
    if (err) {
      console.error("yt-dlp error:", err.message);
      return res.status(500).json({ error: "Download failed." });
    }

    console.log("yt-dlp output:", stdout);
    return res.json({
      message: "✅ Download triggered",
    });
  });
});

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
