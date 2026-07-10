const fs = require('fs');
const path = require('path');

const USERNAME = "Alonezdb";
const token = process.env.GITHUB_TOKEN;
const OUTPUT_PATH = path.join(__dirname, '../assets/metrics.svg');

// Mock fallback stats for beautiful initial presentation
const mockData = {
  commits: 482,
  repos: 28,
  stars: 34,
  followers: 12,
  languages: [
    { name: "Java", share: 38.5, color: "#b07219" },
    { name: "Python", share: 24.2, color: "#3572A5" },
    { name: "JavaScript", share: 18.3, color: "#f1e05a" },
    { name: "C#", share: 11.0, color: "#178600" },
    { name: "Docker", share: 8.0, color: "#3893e8" }
  ]
};

async function fetchGitHubData() {
  if (!token) {
    console.log("No GITHUB_TOKEN provided. Using fallback mock data.");
    return mockData;
  }

  try {
    // 1. Fetch User Profile
    const userRes = await fetch(`https://api.github.com/users/${USERNAME}`, {
      headers: { Authorization: `token ${token}` }
    });
    if (!userRes.ok) throw new Error(`User API failed: ${userRes.statusText}`);
    const userData = await userRes.json();

    // 2. Fetch User Repositories (first 100)
    const reposRes = await fetch(`https://api.github.com/users/${USERNAME}/repos?per_page=100`, {
      headers: { Authorization: `token ${token}` }
    });
    if (!reposRes.ok) throw new Error(`Repos API failed: ${reposRes.statusText}`);
    const reposData = await reposRes.json();

    // Calculate total stars and languages
    let stars = 0;
    const langBytes = {};
    let totalLangBytes = 0;

    for (const repo of reposData) {
      if (repo.fork) continue;
      stars += repo.stargazers_count;

      if (repo.language) {
        // Simple language weight by repo count/size approximation
        langBytes[repo.language] = (langBytes[repo.language] || 0) + (repo.size || 1) + 1000;
      }
    }

    // Process languages
    const langColors = {
      "Java": "#b07219",
      "Python": "#3572A5",
      "JavaScript": "#f1e05a",
      "React": "#61dafb",
      "C#": "#178600",
      "C++": "#f34b7d",
      "HTML": "#e34c26",
      "CSS": "#563d7c",
      "Docker": "#3893e8",
      "Shell": "#89e051"
    };

    const sortedLangs = Object.entries(langBytes)
      .map(([name, bytes]) => {
        totalLangBytes += bytes;
        return { name, bytes };
      })
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, 5); // Keep top 5

    const languages = sortedLangs.map(lang => ({
      name: lang.name,
      share: parseFloat(((lang.bytes / totalLangBytes) * 100).toFixed(1)),
      color: langColors[lang.name] || "#888888"
    }));

    // If no languages found, provide fallback
    if (languages.length === 0) {
      languages.push(...mockData.languages);
    }

    // Commits count approximation (Search commits by author)
    const commitSearchRes = await fetch(`https://api.github.com/search/commits?q=author:${USERNAME}`, {
      headers: { 
        Authorization: `token ${token}`,
        Accept: "application/vnd.github.cloak-preview+json" 
      }
    });
    let commits = mockData.commits; // fallback
    if (commitSearchRes.ok) {
      const commitSearchData = await commitSearchRes.json();
      commits = commitSearchData.total_count || commits;
    }

    return {
      commits,
      repos: userData.public_repos,
      stars,
      followers: userData.followers,
      languages
    };

  } catch (error) {
    console.error("Failed fetching GitHub API. Falling back to mock data.", error.message);
    return mockData;
  }
}

function generateMetricsSVG(data) {
  // Construct language bars
  let currentOffset = 0;
  const barSegments = data.languages.map((lang, idx) => {
    const width = (lang.share / 100) * 320;
    const x = currentOffset;
    currentOffset += width;
    return `<rect x="${x}" y="0" width="${Math.max(1, width)}" height="12" fill="${lang.color}" rx="${idx === 0 || idx === data.languages.length-1 ? 6 : 0}" />`;
  }).join("\n");

  // Construct language legend list
  const legendList = data.languages.map((lang, idx) => {
    const y = 145 + idx * 24;
    return `
      <g transform="translate(420, ${y})">
        <circle cx="10" cy="8" r="5" fill="${lang.color}" />
        <text x="24" y="12" class="legend-name">${lang.name}</text>
        <text x="280" y="12" class="legend-percent" text-anchor="end">${lang.share}%</text>
      </g>
    `;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 300" width="100%" height="300" fill="none">
  <defs>
    <!-- Fonts -->
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&amp;display=swap');
      
      .title-head {
        font-family: 'Outfit', -apple-system, sans-serif;
        font-weight: 700;
        font-size: 15px;
        fill: #ffffff;
        letter-spacing: 0.05em;
      }
      
      .stat-val {
        font-family: 'Outfit', -apple-system, sans-serif;
        font-weight: 700;
        font-size: 26px;
        fill: #ffffff;
      }

      .stat-lbl {
        font-family: 'Outfit', -apple-system, sans-serif;
        font-weight: 600;
        font-size: 11px;
        fill: #71717a;
        letter-spacing: 0.08em;
      }

      .legend-name {
        font-family: 'Outfit', -apple-system, sans-serif;
        font-weight: 600;
        font-size: 13px;
        fill: #a1a1aa;
      }

      .legend-percent {
        font-family: 'Outfit', -apple-system, sans-serif;
        font-weight: 700;
        font-size: 13px;
        fill: #ffffff;
      }

      .border-glow {
        stroke: url(#borderGrad);
        stroke-width: 1.2;
      }
    </style>

    <linearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.02" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.1" />
    </linearGradient>

    <!-- Noise filter -->
    <filter id="noiseFilter">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="3" stitchTiles="stitch" />
      <feColorMatrix type="matrix" values="0 0 0 0 0   0 0 0 0 0   0 0 0 0 0  0 0 0 0.05 0" />
    </filter>
  </defs>

  <!-- Card Background -->
  <rect width="800" height="300" rx="20" fill="#09090b" fill-opacity="0.8" stroke="url(#borderGrad)" stroke-width="1.2" />
  <rect width="800" height="300" rx="20" filter="url(#noiseFilter)" pointer-events="none" />

  <!-- LEFT PANE: GitHub Stats -->
  <g transform="translate(40, 40)">
    <text x="0" y="10" class="title-head">PROFILE STATISTICS</text>
    
    <!-- Grid of Stats -->
    <!-- Col 1, Row 1: Commits -->
    <g transform="translate(0, 40)">
      <text x="0" y="24" class="stat-val">${data.commits}</text>
      <text x="0" y="44" class="stat-lbl">TOTAL COMMITS</text>
    </g>

    <!-- Col 2, Row 1: Stars -->
    <g transform="translate(160, 40)">
      <text x="0" y="24" class="stat-val">${data.stars}</text>
      <text x="0" y="44" class="stat-lbl">STARS EARNED</text>
    </g>

    <!-- Col 1, Row 2: Repos -->
    <g transform="translate(0, 140)">
      <text x="0" y="24" class="stat-val">${data.repos}</text>
      <text x="0" y="44" class="stat-lbl">REPOSITORIES</text>
    </g>

    <!-- Col 2, Row 2: Followers -->
    <g transform="translate(160, 140)">
      <text x="0" y="24" class="stat-val">${data.followers}</text>
      <text x="0" y="44" class="stat-lbl">FOLLOWERS</text>
    </g>
  </g>

  <!-- Vertical Divider -->
  <line x1="390" y1="40" x2="390" y2="260" stroke="#27272a" stroke-width="1" />

  <!-- RIGHT PANE: Top Languages -->
  <g transform="translate(420, 40)">
    <text x="0" y="10" class="title-head">MOST USED LANGUAGES</text>
    
    <!-- Stack Bar -->
    <g transform="translate(0, 45)">
      <!-- Background track -->
      <rect width="320" height="12" rx="6" fill="#18181b" />
      
      <!-- Colored segments -->
      <g clip-path="url(#barClip)">
        ${barSegments}
      </g>
      <clipPath id="barClip">
        <rect width="320" height="12" rx="6" />
      </clipPath>
    </g>
  </g>

  <!-- Legend Items -->
  ${legendList}
</svg>`;
}

async function main() {
  console.log("Generating stats metrics...");
  const data = await fetchGitHubData();
  const svg = generateMetricsSVG(data);
  fs.writeFileSync(OUTPUT_PATH, svg);
  console.log("Updated metrics.svg successfully.");
}

main();
