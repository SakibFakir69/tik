const { spawn } = require("child_process");

app.get("/api/download-tiktok", (req, res) => {
  const { url } = req.query;

  if (!url || !url.includes("tiktok.com")) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const yt = spawn("yt-dlp", [
    "--no-playlist",
    "-f",
    "mp4",
    "-o",
    "-", // 🔥 OUTPUT TO STDOUT (NO FILE)
    url,
  ]);

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="tiktok.mp4"'
  );

  yt.stdout.pipe(res);

  yt.stderr.on("data", (err) => {
    console.error("yt-dlp error:", err.toString());
  });

  yt.on("close", () => {
    res.end();
  });

  req.on("close", () => {
    yt.kill("SIGKILL");
  });
});




<!-- improved tik tok downlaod  -->