const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const util = require("util");
// const helmet = require("helmet");
const dotenv = require("dotenv");
// const serverless = require("serverless-http");

const app = express();

dotenv.config();
// app.use(helmet());
// const hostUrl = process.env.HOST_URL;

// app.use(
//   helmet.contentSecurityPolicy({
//     directives: {
//       defaultSrc: ["'self'"],
//       imgSrc: ["'self'", hostUrl],
//       scriptSrc: ["'self'", hostUrl],
//       styleSrc: ["'self'", hostUrl],
//       // Other directives can be added as needed.
//     },
//   })
// );
// app.use(helmet());
app.use(
  cors({
    origin: `${process.env.API_URL}`,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

const execPromise = util.promisify(exec);

// Ensure the downloads folder exists
const DOWNLOADS_DIR = path.join(__dirname, "downloads");
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Path to yt-dlp.exe (place yt-dlp.exe in your project folder)
// const YT_DLP_PATH = path.join(__dirname, "yt-dlp.exe");  // windows
const YT_DLP_PATH = path.join(__dirname, "yt-dlp_linux"); // Linux

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
    // (Optional) Other metadata can be extracted as needed

    // Sanitize title for file naming (remove illegal characters)
    const sanitizedTitle = title
      .replace(/[<>:"\/\\|?*\x00-\x1F]/g, "")
      .replace(/\.$/, "")
      .trim();

    // Use a timestamp to generate unique output filenames (shared for both video and audio)
    const timestamp = Date.now();

    // Build output templates for video and audio downloads
    // We add a suffix ("-video" or "-audio") to distinguish the files.
    const videoOutputTemplate = path.join(
      DOWNLOADS_DIR,
      `%(title)s-video-${timestamp}.%(ext)s`
    );
    const audioOutputTemplate = path.join(
      DOWNLOADS_DIR,
      `%(title)s-audio-${timestamp}.%(ext)s`
    );

    // STEP 2: Download the merged video (video + audio)
    const videoDownloadCommand = [
      `"${YT_DLP_PATH}"`,
      `--no-playlist`,
      `-v`,
      `-f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best"`,
      `--merge-output-format mp4`,
      `--recode-video mp4`,
      `--output "${videoOutputTemplate}"`,
      `--write-thumbnail`,
      `"${videoUrl}"`,
    ].join(" ");

    console.log("Running video download command:", videoDownloadCommand);
    const { stderr: videoStderr } = await execPromise(videoDownloadCommand);
    if (videoStderr && videoStderr.trim().length > 0) {
      console.error("Video Download STDERR:", videoStderr);
      // yt-dlp may output warnings even on success.
    }

    // Wait a few seconds to ensure file I/O is complete for video
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Instead of assuming the filename, search the downloads folder for an MP4 file that includes the timestamp and "-video-"
    const videoFiles = fs
      .readdirSync(DOWNLOADS_DIR)
      .filter((file) => file.includes(`-video-${timestamp}.mp4`));
    if (!videoFiles || videoFiles.length === 0) {
      return res.status(500).json({ error: "Downloaded video file not found" });
    }
    const expectedVideoFileName = videoFiles[0];
    const videoFilePath = path.join(DOWNLOADS_DIR, expectedVideoFileName);

    const videoStats = fs.statSync(videoFilePath);
    if (videoStats.size < 1024) {
      fs.unlinkSync(videoFilePath);
      return res.status(500).json({
        error: "Downloaded video appears to be corrupted (size too small)",
      });
    }

    // STEP 3: Download audio-only file (as MP3)
    const audioDownloadCommand = [
      `"${YT_DLP_PATH}"`,
      `--no-playlist`,
      `-v`,
      `-x`, // extract audio
      `--audio-format mp3`, // convert to MP3
      `--output "${audioOutputTemplate}"`,
      `"${videoUrl}"`,
    ].join(" ");

    console.log("Running audio download command:", audioDownloadCommand);
    const { stderr: audioStderr } = await execPromise(audioDownloadCommand);
    if (audioStderr && audioStderr.trim().length > 0) {
      console.error("Audio Download STDERR:", audioStderr);
    }

    // Wait a few seconds to ensure file I/O is complete for audio
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Search for the audio file by filtering for MP3 files with the timestamp and "-audio-"
    const audioFiles = fs
      .readdirSync(DOWNLOADS_DIR)
      .filter((file) => file.includes(`-audio-${timestamp}.mp3`));
    if (!audioFiles || audioFiles.length === 0) {
      return res.status(500).json({ error: "Downloaded audio file not found" });
    }
    const expectedAudioFileName = audioFiles[0];
    const audioFilePath = path.join(DOWNLOADS_DIR, expectedAudioFileName);

    const audioStats = fs.statSync(audioFilePath);
    if (audioStats.size < 1024) {
      fs.unlinkSync(audioFilePath);
      return res.status(500).json({
        error: "Downloaded audio appears to be corrupted (size too small)",
      });
    }

    // STEP 4: Check for thumbnail file (try multiple extensions)
    const thumbExtensions = [".jpg", ".jpeg", ".png", ".webp"];
    let thumbnail = null;
    for (const ext of thumbExtensions) {
      const thumbFileName = `${await getTitleFromOutput(
        DOWNLOADS_DIR,
        timestamp
      )}-${timestamp}${ext}`;
      const thumbPath = path.join(DOWNLOADS_DIR, thumbFileName);
      if (fs.existsSync(thumbPath)) {
        thumbnail = `/downloads/${encodeURIComponent(thumbFileName)}`;
        break;
      }
    }

    // Return the JSON response with video and audio download links along with metadata.
    res.json({
      message: "Download successful",
      title,
      uploader,
      videoFilePath: `/downloads/${encodeURIComponent(expectedVideoFileName)}`,
      audioFilePath: `/downloads/${encodeURIComponent(expectedAudioFileName)}`,
      thumbnail: thumbnail,
    });
  } catch (error) {
    console.error("Error in /download-youtube endpoint:", error);
    res
      .status(500)
      .json({ error: error.stderr || error.message || "Server error" });
  }
});

function getTitleFromOutput(downloadDir, timestamp) {
  const files = fs.readdirSync(downloadDir);
  const matching = files.find((file) => file.includes(`-${timestamp}.mp4`));
  if (matching) {
    // Remove the trailing "-<timestamp>.mp4" to extract the title.
    return matching.replace(`-${timestamp}.mp4`, "");
  }
  return "video";
}

// Serve downloaded files with forced download headers
app.use(
  "/downloads",
  express.static(DOWNLOADS_DIR, {
    setHeaders: (res, filePath) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (
        filePath.endsWith(".mp4") ||
        filePath.endsWith(".mp3") ||
        filePath.match(/\.(jpg|jpeg|png|webp)$/)
      ) {
        res.set("Content-Type", "application/octet-stream");
        res.set(
          "Content-Disposition",
          `attachment; filename="${sanitizeFileName(path.basename(filePath))}"`
        );
      }
    },
  })
);

/**
 * Helper to sanitize file names by replacing invalid characters.
 */
function sanitizeFileName(fileName) {
  return fileName.replace(/[^a-zA-Z0-9_.\-]/g, "_");
}

// app.get("/", (req, res) => {
//   res.send("Hello from Express on Vercel!");
// });

app.get("/", (req, res) => {
  res.send("Backend Home Page");
});

const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
