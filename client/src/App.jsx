import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Download,
  AlertCircle,
  Loader2,
  ExternalLink,
  Youtube,
} from "lucide-react";

function App() {

  const apiUrl = import.meta.env.VITE_API_URL;

  const [videoUrl, setVideoUrl] = useState("");
  const [downloadVideoLink, setDownloadVideoLink] = useState("");
  const [downloadAudioLink, setDownloadAudioLink] = useState("");
  const [title, setTitle] = useState("");
  const [uploader, setUploader] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Add structured data for SEO
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "YouTube Video Downloader",
      applicationCategory: "DownloadApplication",
      operatingSystem: "Web Browser",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description:
        "Download YouTube videos in high quality for free. Fast, easy, and secure YouTube video downloader.",
    };

    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
    };
  }, []);

  const handleDownload = async () => {
    if (!videoUrl.trim()) {
      setError("Please enter a video URL");
      return;
    }
    setError("");
    setDownloadVideoLink("");
    setDownloadAudioLink("");
    setTitle("");
    setUploader("");
    setThumbnail("");
    setLoading(true);
    try {
      const response = await axios.post(
        `${apiUrl}/download-youtube`,
        { videoUrl }
      );
      const data = response.data;
      setDownloadVideoLink(data.videoFilePath);
      setDownloadAudioLink(data.audioFilePath);
      setTitle(data.title);
      setUploader(data.uploader);
      setThumbnail(data.thumbnail);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Error downloading video/audio");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-gray-100 flex flex-col items-center p-6">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
            <Youtube size={32} className="text-red-600" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            YouTube Downloader (Video & Audio)
          </h1>
          <p className="text-lg text-gray-600">
            Download your favorite YouTube videos along with audio.
          </p>
        </div>

        {/* Input Form */}
        <div className="bg-white shadow-lg rounded-xl p-6 mb-8">
          <input
            type="text"
            placeholder="Enter YouTube video URL"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500"
            disabled={loading}
          />
          <button
            onClick={handleDownload}
            className="mt-4 w-full flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin h-5 w-5 mr-2" /> Processing...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" /> Download Video & Audio
              </>
            )}
          </button>
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Download Results */}
        {downloadVideoLink && (
          <div className="bg-white shadow-xl rounded-2xl overflow-hidden mb-8">
            <div className="bg-gradient-to-r from-red-600 to-red-700 p-4 text-white flex items-center gap-3">
              <Youtube className="h-6 w-6" />
              <h2 className="font-semibold text-lg">Download Options</h2>
            </div>
            <div className="p-6 flex flex-col md:flex-row gap-6">
              {/* Thumbnail */}
              <div className="flex-shrink-0">
                {thumbnail ? (
                  <img
                    src={`${apiUrl}${thumbnail}`}
                    alt={title}
                    className="w-64 h-auto rounded-lg shadow"
                  />
                ) : (
                  <div className="w-64 h-36 bg-gray-200 flex items-center justify-center rounded-lg">
                    <Youtube className="h-10 w-10 text-gray-400" />
                  </div>
                )}
              </div>
              {/* Video Details and Download Links */}
              <div className="flex-1 space-y-4">
                <h3 className="text-2xl font-bold text-gray-900">{title}</h3>
                <p className="text-gray-600">Uploaded by: {uploader}</p>
                <div className="flex flex-wrap gap-4">
                  <a
                    href={`${apiUrl}${downloadVideoLink}`}
                    download
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Download className="h-5 w-5" /> Download Video
                  </a>
                  <a
                    href={`${apiUrl}${downloadAudioLink}`}
                    download
                    className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Download className="h-5 w-5" /> Download Audio
                  </a>
                </div>
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-red-600 transition-colors"
                >
                  <ExternalLink className="h-4 w-4" />
                  Watch on YouTube
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Features Section */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              title: "High Quality",
              description: "Download videos in the best available quality",
              icon: <Download className="h-6 w-6 text-red-600" />,
            },
            {
              title: "Fast & Easy",
              description: "Simple interface for quick downloads",
              icon: <Youtube className="h-6 w-6 text-red-600" />,
            },
            {
              title: "Multiple Formats",
              description: "Choose from various quality options",
              icon: <Download className="h-6 w-6 text-red-600" />,
            },
          ].map((feature, index) => (
            <div
              key={index}
              className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow"
            >
              <div className="mb-3 p-3 bg-red-50 rounded-full">
                {feature.icon}
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
      <footer className="flex flex-col items-center text-center p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow mt-12 w-full">
        <div className="container mx-auto px-4 py-6 text-center font-bold text-gray-600">
          <p>© {new Date().getFullYear()} Video Downloader. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
