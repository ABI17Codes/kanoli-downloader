const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const util = require("util");

const app = express();
app.use(cors());
app.use(express.json());

const execPromise = util.promisify(exec);

// Ensure the downloads folder exists
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Path to yt-dlp.exe (place yt-dlp.exe in your project folder)
const YT_DLP_PATH = path.join(__dirname, "yt-dlp.exe");

app.post("/download-youtube", async (req, res) => {
  try {
    const { videoUrl } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ error: "Video URL is required" });
    }

    // STEP 1: Extract metadata using --dump-json
    const metadataCommand = `"${YT_DLP_PATH}" --dump-json --no-playlist "${videoUrl}"`;
    const { stdout: metadataStdout } = await execPromise(metadataCommand);
    const metadata = JSON.parse(metadataStdout);
    
    const title = metadata.title || "Unknown Title";
    const uploader = metadata.uploader || "Unknown Uploader";
    // (Optional) You can extract other fields as needed

    // Sanitize title for file naming (removes illegal characters)
    const sanitizedTitle = title
      .replace(/[<>:"\/\\|?*\x00-\x1F]/g, "")
      .replace(/\.$/, "")
      .trim();

    // Use a timestamp to generate a unique output filename
    const timestamp = Date.now();
    const outputTemplate = path.join(DOWNLOADS_DIR, `%(title)s-${timestamp}.%(ext)s`);

    // STEP 2: Download the video using yt-dlp.
    // This command selects the best video (MP4) and best audio (M4A),
    // merges them into an MP4, and forces re-encoding for compatibility.
    const downloadCommand = [
      `"${YT_DLP_PATH}"`,
      `--no-playlist`,
      `-v`,
      `-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best"`,
      `--merge-output-format mp4`,
      `--recode-video mp4`,
      `--output "${outputTemplate}"`,
      `--write-thumbnail`,
      `"${videoUrl}"`
    ].join(" ");
    
    console.log("Running download command:", downloadCommand);
    const { stderr: downloadStderr } = await execPromise(downloadCommand);
    if (downloadStderr && downloadStderr.trim().length > 0) {
      console.error("Download STDERR:", downloadStderr);
      // Note: yt-dlp may output warnings even on success.
    }
    
    // Wait a few seconds to ensure file I/O is complete
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    // STEP 3: Locate the downloaded video file.
    // We assume the file will be named as "<video title>-<timestamp>.mp4"
    const expectedFileName = `${sanitizedTitle}-${timestamp}.mp4`;
    const videoPath = path.join(DOWNLOADS_DIR, expectedFileName);
    
    if (!fs.existsSync(videoPath)) {
      return res.status(500).json({ error: "Downloaded file not found" });
    }
    
    const stats = fs.statSync(videoPath);
    if (stats.size < 1024) {
      fs.unlinkSync(videoPath);
      return res.status(500).json({ error: "Downloaded file appears to be corrupted (size too small)" });
    }
    
    // (Optional) If yt-dlp downloads a thumbnail, it will be saved with the same template but with an image extension.
    // // We'll check for common thumbnail formats.
    // const thumbExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    // let thumbnailUrl = null;
    // for (const ext of thumbExtensions) {
    //   const thumbFileName = `${sanitizedTitle}-${timestamp}${ext}`;
    //   if (fs.existsSync(path.join(DOWNLOADS_DIR, thumbFileName))) {
    //     thumbnailUrl = `/downloads/${encodeURIComponent(thumbFileName)}`;
    //     break;
    //   }
    // }

    const thumbExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    let thumbnail = null;
    for (const ext of thumbExtensions) {
      const thumbFileName = `${await getTitleFromOutput(DOWNLOADS_DIR, timestamp)}-${timestamp}${ext}`;
      const thumbPath = path.join(DOWNLOADS_DIR, thumbFileName);
      if (fs.existsSync(thumbPath)) {
        thumbnail = `/downloads/${encodeURIComponent(thumbFileName)}`;
        break;
      }
    }
    
    res.json({
      message: "Download successful",
      filePath: `/downloads/${encodeURIComponent(expectedFileName)}`,
      title,
      uploader,
      thumbnail: thumbnail
    });
  } catch (error) {
    console.error("Error in /download-youtube endpoint:", error);
    res.status(500).json({ error: error.stderr || error.message || "Server error" });
  }
});

function getTitleFromOutput(downloadDir, timestamp) {
  const files = fs.readdirSync(downloadDir);
  const matching = files.find(file => file.includes(`-${timestamp}.mp4`));
  if (matching) {
    // Remove the trailing "-<timestamp>.mp4" to extract the title.
    return matching.replace(`-${timestamp}.mp4`, "");
  }
  return "video";
}

// Serve downloaded files with forced download headers
app.use("/downloads", express.static(DOWNLOADS_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".mp4")) {
      res.set("Content-Type", "application/octet-stream");
      res.set("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
    }
  }
}));

const PORT = 5000;
app.listen(PORT, () => {     
  console.log(`Server running on port ${PORT}`);
});
