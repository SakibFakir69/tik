const path = require('path');
const { exec, execSync } = require('child_process');
const fs = require('fs');

const ytdlpPath = path.join(__dirname, 'yt-dlp');

try {
  execSync(`chmod +x ${ytdlpPath}`);
} catch (err) {
  console.warn('Failed to chmod yt-dlp');
}

// Create downloads folder if missing
if (!fs.existsSync('downloads')) {
  fs.mkdirSync('downloads');
}

const cmd = `${ytdlpPath} -o "downloads/%(title)s.%(ext)s" "https://vt.tiktok.com/ZSBJkHPeG/"`;

exec(cmd, (error, stdout, stderr) => {
  if (error) {
    console.error('yt-dlp error:', error.message);
  } else {
    console.log('yt-dlp output:', stdout);
  }
});
