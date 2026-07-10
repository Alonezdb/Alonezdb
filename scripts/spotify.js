const fs = require('fs');
const path = require('path');

// Credentials from environment variables
const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN;

const OUTPUT_PATH = path.join(__dirname, '../assets/spotify.svg');

// Mock data to use if credentials are not provided (so build doesn't crash during local tests)
const mockTrack = {
  isPlaying: true,
  title: "After Hours",
  artist: "The Weeknd",
  albumArtUrl: "https://i.scdn.co/image/ab67616d0000b2738863bc11d4aa12b0e6df9001",
  progress: 180000,
  duration: 361000
};

async function getAccessToken() {
  if (!client_id || !client_secret || !refresh_token) {
    throw new Error("Missing Spotify credentials");
  }
  const basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token request failed: ${response.statusText}`);
  }
  return response.json();
}

async function getNowPlaying(accessToken) {
  const response = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (response.status === 204 || response.status > 400) {
    return null;
  }
  return response.json();
}

async function getRecentlyPlayed(accessToken) {
  const response = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=1", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  if (!response.ok) return null;
  return response.json();
}

async function fetchImageBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
  } catch (e) {
    console.error("Failed to fetch album art as Base64", e);
    return null;
  }
}

function generateOfflineSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 120" width="100%" height="120" fill="none">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&amp;display=swap');
      .text-title { font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; fill: #a1a1aa; }
      .text-artist { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 400; fill: #71717a; }
      .border-glow { stroke: url(#borderGrad); stroke-width: 1.2; }
    </style>
    
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02" />
    </linearGradient>

    <filter id="noiseFilter">
      <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.05 0" />
    </filter>
  </defs>

  <rect width="450" height="120" rx="18" fill="#09090b" fill-opacity="0.8" stroke="url(#borderGrad)" stroke-width="1.2" />
  <rect width="450" height="120" rx="18" filter="url(#noiseFilter)" pointer-events="none" />

  <!-- Offline Vinyl Icon -->
  <g transform="translate(20, 20)">
    <rect width="80" height="80" rx="12" fill="#18181b" />
    <circle cx="40" cy="40" r="28" fill="#09090b" stroke="#27272a" stroke-width="2" />
    <circle cx="40" cy="40" r="12" fill="#18181b" />
    <circle cx="40" cy="40" r="3" fill="#3f3f46" />
  </g>

  <!-- Text -->
  <text x="120" y="52" class="text-title">Currently Offline</text>
  <text x="120" y="74" class="text-artist">Not listening to Spotify right now.</text>
  
  <!-- Spotify Indicator -->
  <circle cx="410" cy="30" r="4" fill="#1db954" />
</svg>`;
}

function generatePlayingSVG(track) {
  const progressPercent = Math.min(100, Math.max(0, (track.progress / track.duration) * 100));
  const equalizerBars = track.isPlaying ? `
    <g class="eq" transform="translate(400, 48)" fill="#1db954">
      <rect class="bar bar-1" x="0" y="0" width="3" height="12" rx="1.5" />
      <rect class="bar bar-2" x="5" y="0" width="3" height="12" rx="1.5" />
      <rect class="bar bar-3" x="10" y="0" width="3" height="12" rx="1.5" />
    </g>
  ` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 120" width="100%" height="120" fill="none">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&amp;display=swap');
      .text-title { font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; fill: #ffffff; }
      .text-artist { font-family: 'Outfit', sans-serif; font-size: 12px; font-weight: 400; fill: #a1a1aa; }
      .text-status { font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600; fill: #1db954; letter-spacing: 0.1em; }
      .border-glow { stroke: url(#borderGrad); stroke-width: 1.2; }
      
      /* Equalizer Animation */
      @keyframes eq-scale-1 { 0%, 100% { transform: scaleY(0.3); } 50% { transform: scaleY(1); } }
      @keyframes eq-scale-2 { 0%, 100% { transform: scaleY(0.6); } 50% { transform: scaleY(0.2); } }
      @keyframes eq-scale-3 { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(0.9); } }
      
      .bar-1 { animation: eq-scale-1 1.2s ease-in-out infinite; transform-origin: 1.5px 12px; }
      .bar-2 { animation: eq-scale-2 0.8s ease-in-out infinite; transform-origin: 6.5px 12px; }
      .bar-3 { animation: eq-scale-3 1.0s ease-in-out infinite; transform-origin: 11.5px 12px; }
    </style>
    
    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.03" />
    </linearGradient>

    <filter id="noiseFilter">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.05 0" />
    </filter>
  </defs>

  <!-- Glass Card -->
  <rect width="450" height="120" rx="18" fill="#09090b" fill-opacity="0.8" stroke="url(#borderGrad)" stroke-width="1.2" />
  <rect width="450" height="120" rx="18" filter="url(#noiseFilter)" pointer-events="none" />

  <!-- Album Artwork -->
  <g transform="translate(20, 20)">
    <clipPath id="albumArtClip">
      <rect width="80" height="80" rx="10" />
    </clipPath>
    <rect width="80" height="80" rx="10" fill="#18181b" />
    <image width="80" height="80" href="${track.albumArtUrl}" clip-path="url(#albumArtClip)" />
  </g>

  <!-- Text Section -->
  <text x="120" y="38" class="text-status">${track.isPlaying ? 'NOW PLAYING' : 'RECENTLY PLAYED'}</text>
  <text x="120" y="58" class="text-title">${track.title}</text>
  <text x="120" y="76" class="text-artist">${track.artist}</text>

  <!-- Progress Bar -->
  <g transform="translate(120, 92)">
    <!-- Base track -->
    <line x1="0" y1="0" x2="280" y2="0" stroke="#27272a" stroke-width="3" stroke-linecap="round" />
    <!-- Progress fill -->
    <line x1="0" y1="0" x2="${(progressPercent * 280) / 100}" y2="0" stroke="#ffffff" stroke-width="3" stroke-linecap="round" />
  </g>

  ${equalizerBars}
</svg>`;
}

async function main() {
  console.log("Checking Spotify status...");
  
  try {
    const tokenData = await getAccessToken();
    const accessToken = tokenData.access_token;
    
    let nowPlaying = await getNowPlaying(accessToken);
    let trackData = null;
    
    if (nowPlaying && nowPlaying.item) {
      const albumArtBase64 = await fetchImageBase64(nowPlaying.item.album.images[0].url);
      trackData = {
        isPlaying: nowPlaying.is_playing,
        title: nowPlaying.item.name,
        artist: nowPlaying.item.artists.map(a => a.name).join(", "),
        albumArtUrl: albumArtBase64 || nowPlaying.item.album.images[0].url,
        progress: nowPlaying.progress_ms,
        duration: nowPlaying.item.duration_ms
      };
      console.log(`Currently playing: ${trackData.title} by ${trackData.artist}`);
    } else {
      // Fallback to recently played
      const recentlyPlayed = await getRecentlyPlayed(accessToken);
      if (recentlyPlayed && recentlyPlayed.items && recentlyPlayed.items.length > 0) {
        const lastTrack = recentlyPlayed.items[0].track;
        const albumArtBase64 = await fetchImageBase64(lastTrack.album.images[0].url);
        trackData = {
          isPlaying: false,
          title: lastTrack.name,
          artist: lastTrack.artists.map(a => a.name).join(", "),
          albumArtUrl: albumArtBase64 || lastTrack.album.images[0].url,
          progress: lastTrack.duration_ms, // Full progress bar for offline/static
          duration: lastTrack.duration_ms
        };
        console.log(`Last played: ${trackData.title} by ${trackData.artist}`);
      }
    }
    
    if (trackData) {
      const svg = generatePlayingSVG(trackData);
      fs.writeFileSync(OUTPUT_PATH, svg);
      console.log("Updated spotify.svg successfully.");
    } else {
      throw new Error("No track data found.");
    }
    
  } catch (error) {
    console.error("Spotify API error, writing offline SVG:", error.message);
    
    // In local development or PRs, use Mock data to present a beautiful showcase card
    if (!client_id || !client_secret) {
      console.log("Credentials missing. Writing mock track card for demonstration...");
      try {
        const mockArtBase64 = await fetchImageBase64(mockTrack.albumArtUrl);
        if (mockArtBase64) mockTrack.albumArtUrl = mockArtBase64;
        const svg = generatePlayingSVG(mockTrack);
        fs.writeFileSync(OUTPUT_PATH, svg);
        console.log("Updated spotify.svg with mock showcase data.");
      } catch (e) {
        fs.writeFileSync(OUTPUT_PATH, generateOfflineSVG());
      }
    } else {
      fs.writeFileSync(OUTPUT_PATH, generateOfflineSVG());
    }
  }
}

main();
