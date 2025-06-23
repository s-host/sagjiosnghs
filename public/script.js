let tracks = [
  {
    title: "TAKE-ME-AWAY ˢᵒ ʷʰʸ ᵗʳʸ ᵗᵒ ᶠⁱᵍʰᵗ ⁱᵗ?",
    artist: "xaev",
    album: "TO-THE-CORE_153BPM",
    cover: "https://i1.sndcdn.com/artworks-7fznRxX5kZb59Oy5-vYgzig-t500x500.jpg",
    file: "/audio/TAKE ME AWAY so why try to fight it.mp3",
    isNew: true,
    isPopular: true,
    createdAt: "2025-05-09"
  },
  {
    title: "ta1lsd024",
    artist: "ta1lsd0ll",
    album: "cursed003",
    cover: "https://i1.sndcdn.com/artworks-Oq46huYBdV2Mdgyk-z5C8mw-t500x500.png",
    file: "/audio/ta1lsd024.mp3",
    isNew: true,
    isPopular: false,
    createdAt: "2025-01-23"
  },
  {
    title: "ta1lsd003",
    artist: "ta1lsd0ll",
    album: "cursed001",
    cover: "https://i1.sndcdn.com/artworks-MTQcZ6DmlGzZzt1B-DwiknQ-t500x500.jpg",
    file: "/audio/ta1lsd003.mp3",
    isNew: false,
    isPopular: true,
    createdAt: "2021-06-29"
  }
];

const app = document.getElementById("app");

function slugify(str) {
  return str.toLowerCase().replace(/[^\w]+/g, "-");
}

// On page load, check if we’re at a track page
document.addEventListener("DOMContentLoaded", async () => {
  await loadTracks();
  checkAdmin();

  const pathParts = window.location.pathname.split('/').filter(Boolean); // removes empty strings

  if (pathParts.length === 2) {
    const [artistSlug, titleSlug] = pathParts;

    fetch("/api/tracks")
      .then(res => res.json())
      .then(tracks => {
        const track = tracks.find(t =>
          slugify(t.artist) === artistSlug && slugify(t.title) === titleSlug
        );

        if (track) {
          showTrackPage(track);
        } else {
          document.body.innerHTML = "<h1>Track not found</h1>";
        }
      });
  } else {
    renderHome();
  }
  setupSearch();
});


function navigateTo(path) {
  history.pushState({}, "", path);
  router();
}

function updateUIForAdmin(isAdmin) {
  document.getElementById('login-button').style.display = isAdmin ? 'none' : 'inline-block';
  document.getElementById('logout-button').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('add-song-link').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('login-box').style.display = 'none'; // hide login form after login
}

let isLoggedIn = localStorage.getItem("isLoggedIn") === "true";

function login() {
  localStorage.setItem("isLoggedIn", "true");
  isLoggedIn = true;
  navigateTo("/upload");
}

function logout() {
  localStorage.removeItem("isLoggedIn");
  isLoggedIn = false;
  navigateTo("/");
}

async function router() {
  const path = window.location.pathname;
  const segments = path.split("/").filter(Boolean);

  // Admin upload page check
  if (path === "/upload") {
    await checkAdminAndRedirect();
    if (!isLoggedIn) return; // stop rendering if not admin
    return renderUpload();
  }

  // Homepage
  if (path === "/") return renderHome();

  // Admin login page
  if (segments[0] === "login") return renderLogin();

  // Artist and Song pages
  if (segments.length === 1) {
    return renderArtist(segments[0]);
  }

  if (segments.length === 2) {
    return renderSong(segments[0], segments[1]);
  }

  // Default fallback
  renderNotFound();
}


window.onload = () => {
  checkAdmin();
};

function renderHome() {
  app.innerHTML = `
    <section>
      <h2 class="text-2xl mb-4 font-semibold">🎧 Newly Added</h2>
      <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${tracks
          .filter(t => t.isNew)
          .map(renderTrackCard)
          .join("")}
      </div>
    </section>

    <section>
      <h2 class="text-2xl mb-4 font-semibold">🔥 Popular Tracks</h2>
      <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${tracks
          .filter(t => t.isPopular)
          .map(renderTrackCard)
          .join("")}
      </div>
    </section>
  `;
}

function renderTrackCard(track) {
  const artistSlug = slugify(track.artist);
  const songSlug = slugify(track.title);

  return `
    <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg p-4 text-center">
      <img src="${track.cover}" alt="${track.album}" class="w-32 h-32 mx-auto object-cover rounded mb-4" />
      <h3 class="text-lg font-bold hover:underline cursor-pointer" onclick="navigateTo('/${artistSlug}/${songSlug}')">
        ${track.title}
      </h3>
      <p class="text-sm text-gray-400 hover:underline cursor-pointer" onclick="navigateTo('/${artistSlug}')">
        ${track.artist}
      </p>
    </div>
  `;
}

function renderSong(artistSlug, songSlug) {
  const track = tracks.find(
    t => slugify(t.artist) === artistSlug && slugify(t.title) === songSlug
  );

  if (!track) return renderNotFound();

  app.innerHTML = `
    <div class="max-w-xl mx-auto bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
      <img src="${track.cover}" alt="${track.album}" class="w-full h-full object-cover rounded"/>
      <h2 class="text-2xl font-bold">${track.title}</h2>
      <p class="text-gray-400">
        by <span class="hover:underline cursor-pointer" onclick="navigateTo('/${slugify(track.artist)}')">${track.artist}</span>
      </p>
      <p class="italic text-gray-500">${track.album}</p>

      <div class="audio-player" style="display:flex; flex-direction:column; gap:12px; margin-top:1rem; color:#eee;">
        <audio id="audio" src="${track.file}"></audio>
        
        <div style="display:flex; align-items:center; gap:12px;">
          <button id="btnPlayPause" title="Play/Pause" style="cursor:pointer; background:none; border:none; color:#aaa; width:32px; height:32px;">
            <svg id="iconPlay" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-play">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <svg id="iconPause" style="display:none;" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-pause">
              <rect x="6" y="4" width="4" height="16"/>
              <rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>

          <div class="timestamp" id="timestamp">0:00 / 0:00</div>

          <button class="btn-loop" id="btnLoop" title="Toggle loop" aria-pressed="false" type="button" aria-label="Loop" style="cursor:pointer; background:none; border:none; color:#aaa; width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; transition: color 0.3s, background-color 0.3s;">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-repeat" style="width:20px; height:20px;">
              <polyline points="17 1 21 5 17 9"/>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
              <polyline points="7 23 3 19 7 15"/>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
            </svg>
          </button>

          <div class="volume-container" style="position:relative; display:flex; align-items:center;">
            <svg class="volume-icon" id="volumeIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:24px; height:24px; cursor:pointer;">
              <path d="M3 9v6h4l5 5V4L7 9H3z"></path>
            </svg>
            <input
              class="volume-slider"
              id="volumeSlider"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value="1"
              aria-label="Volume slider"
              style="position:absolute; bottom:36px; left:50%; transform:translateX(-50%); width:100px; background:#444; border-radius:4px; display:none;"
            />
          </div>
        </div>

        <input type="range" id="progressBar" value="0" min="0" max="100" step="0.1" style="
    width: 100%;
    height: 6px;
    background: #444;
    border-radius: 4px;
    outline: none;-webkit-appearance: none; appearance: none; cursor: pointer;">
      </div>

      ${isLoggedIn ? `<button onclick="deleteTrack('${track.artistSlug}', '${track.songSlug}')" class="mt-4 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Delete Track</button>` : ''}
    </div>
  `;

  setupAudioPlayer();
}

function renderArtist(artistSlug) {
  const artistTracks = tracks
    .filter(t => slugify(t.artist) === artistSlug)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!artistTracks.length) return renderNotFound();

  const artistName = artistTracks[0].artist;

  app.innerHTML = `
    <h2 class="text-2xl mb-4 font-bold">🎤 ${artistName}</h2>
    <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      ${artistTracks.map(renderTrackCard).join("")}
    </div>
  `;
}

function renderNotFound() {
  app.innerHTML = `<h2 class="text-2xl font-bold text-red-400">404 - Not Found</h2>`;
}

function renderLogin() {
  app.innerHTML = `
    <div class="max-w-md mx-auto bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
      <h2 class="text-2xl font-bold">🔐 Admin Login</h2>
      <button onclick="login()" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white">Login as Admin</button>
    </div>
  `;
}

function renderUpload() {
  app.innerHTML = `
    <div class="max-w-xl mx-auto bg-gray-800 p-6 rounded-lg shadow-lg space-y-4">
      <h2 class="text-2xl font-bold">📤 Upload New Track</h2>
      <form id="uploadForm" class="space-y-4">
        <input name="title" placeholder="Song Title" class="w-full p-2 rounded bg-gray-700" required />
        <input name="artist" placeholder="Artist" class="w-full p-2 rounded bg-gray-700" required />
        <input name="album" placeholder="Album" class="w-full p-2 rounded bg-gray-700" />
        <input name="cover" placeholder="Cover Image URL" class="w-full p-2 rounded bg-gray-700" />
        <input name="file" placeholder="Audio File URL (MP3/WAV)" class="w-full p-2 rounded bg-gray-700" required />
        <div class="flex gap-4">
          <label><input type="checkbox" name="isNew" /> New</label>
          <label><input type="checkbox" name="isPopular" /> Popular</label>
        </div>
        <button type="submit" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white">Upload</button>
        <button onclick="logout()" type="button" class="ml-4 text-red-400 hover:underline">Log out</button>
      </form>
    </div>
  `;

  document.getElementById("uploadForm").onsubmit = async function (e) {
  e.preventDefault();
  const form = e.target;
  const newTrack = {
    title: form.title.value,
    artist: form.artist.value,
    album: form.album.value,
    cover: form.cover.value || "https://via.placeholder.com/300",
    file: form.file.value,
    isNew: form.isNew.checked,
    isPopular: form.isPopular.checked
  };

  const res = await fetch("/api/tracks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newTrack)
  });

  const savedTrack = await res.json();
    tracks.unshift(savedTrack.track);
    navigateTo("/");
  };
 
}

function setupAudioPlayer() {
  const audio = document.getElementById("audio");
  const playPause = document.getElementById("btnPlayPause");
  const iconPlay = document.getElementById("iconPlay");
  const iconPause = document.getElementById("iconPause");
  const progressBar = document.getElementById("progressBar");
  const timestamp = document.getElementById("timestamp");
  const loopBtn = document.getElementById("btnLoop");
  const volumeSlider = document.getElementById("volumeSlider");
  const volumeIcon = document.getElementById("volumeIcon");

  let rafId = null; // requestAnimationFrame ID

  function updateProgress() {
    if (audio.duration) {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressBar.value = percent;
      progressBar.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, #444 ${percent}%, #444 100%)`;
      timestamp.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
    rafId = requestAnimationFrame(updateProgress);
  }

  playPause.addEventListener("click", () => {
    if (audio.paused) {
      audio.play();
      iconPlay.style.display = "none";
      iconPause.style.display = "block";
      rafId = requestAnimationFrame(updateProgress); // start smooth update
    } else {
      audio.pause();
      iconPlay.style.display = "block";
      iconPause.style.display = "none";
      cancelAnimationFrame(rafId); // stop smooth update when paused
    }
  });

  audio.addEventListener("ended", () => {
    if (!audio.loop) {
      iconPlay.style.display = "block";
      iconPause.style.display = "none";
      cancelAnimationFrame(rafId);
    }
  });

  progressBar.addEventListener("input", () => {
    if (audio.duration) {
      const percent = parseFloat(progressBar.value);
      audio.currentTime = (percent / 100) * audio.duration;
      progressBar.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, #444 ${percent}%, #444 100%)`;
    }
  });

  loopBtn.addEventListener("click", () => {
    audio.loop = !audio.loop;
    loopBtn.setAttribute("aria-pressed", audio.loop);
    loopBtn.style.color = audio.loop ? "#4ade80" : "#aaa";
  });

  let volumeVisible = false;
  const volumeContainer = volumeIcon.parentElement;

  volumeIcon.addEventListener("click", () => {
    volumeVisible = !volumeVisible;
    volumeSlider.style.display = volumeVisible ? "block" : "none";
    volumeContainer.classList.toggle("active", volumeVisible);
  });

  volumeContainer.addEventListener("mouseenter", () => {
    if (!volumeVisible) {
      volumeSlider.style.display = "block";
    }
  });

  volumeContainer.addEventListener("mouseleave", () => {
    if (!volumeVisible) {
      volumeSlider.style.display = "none";
    }
  });

  function formatTime(t) {
    const minutes = Math.floor(t / 60);
    const seconds = Math.floor(t % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }

  function updateVolumeFill() {
  const percent = parseFloat(volumeSlider.value) * 100;
  volumeSlider.style.background = `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${percent}%, #444 ${percent}%, #444 100%)`;
  }

  // Update volume and fill on slider change
  volumeSlider.addEventListener("input", () => {
    const volume = parseFloat(volumeSlider.value);
    audio.volume = volume;
    updateVolumeFill();
  });

  // Initialize volume and fill on load
  audio.volume = parseFloat(volumeSlider.value);
  updateVolumeFill();

}

function setupSearch() {
  const searchForm = document.getElementById("searchForm");
  const searchInput = document.getElementById("searchInput");
  const searchResultsContainer = document.getElementById("searchResults");
  const newTracks = document.getElementById("new-tracks");
  const popularTracks = document.getElementById("popular-tracks");

  console.log(renderTrackCard(tracks[0]));

 searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = searchInput.value.toLowerCase().trim();
  console.log("Search submitted:", query);

  if (!query) {
    searchResultsContainer.innerHTML = "";
    searchResultsContainer.classList.add("hidden");
    newTracks.style.display = "";
    popularTracks.style.display = "";
    return;
  }

  const results = tracks.filter(track =>
    track.title.toLowerCase().includes(query) ||
    track.artist.toLowerCase().includes(query)
  );
  console.log("Search results found:", results.length);

  newTracks.style.display = "none";
  popularTracks.style.display = "none";

  if (results.length === 0) {
    searchResultsContainer.innerHTML = `<p class="text-gray-400">No tracks found.</p>`;
  } else {
    searchResultsContainer.innerHTML = results.map(renderTrackCard).join("");
  }
  searchResultsContainer.classList.remove("hidden");
});

}

document.addEventListener("DOMContentLoaded", () => {
  const searchForm = document.getElementById("searchForm");
  const searchInput = document.getElementById("searchInput");
  const searchResultsContainer = document.getElementById("searchResults");
  const newTracks = document.getElementById("new-tracks");
  const popularTracks = document.getElementById("popular-tracks");

  if (!searchResultsContainer) {
    console.error("searchResults container missing in HTML");
    return;
  }

  searchInput.addEventListener("keydown", async (e) => {
    if (e.key === "Enter") {
      e.preventDefault(); // Prevent default form submission
      const query = searchInput.value.trim();

      if (!query) {
        // Restore homepage layout if empty input
        searchResultsContainer.classList.add("hidden");
        newTracks.parentElement.style.display = "block";
        popularTracks.parentElement.style.display = "block";
        return;
      }

      history.pushState({}, "", `?search=${encodeURIComponent(query)}`);

      searchResultsContainer.innerHTML = "";
      searchResultsContainer.classList.remove("hidden");
      newTracks.parentElement.style.display = "none";
      popularTracks.parentElement.style.display = "none";

      try {
        const res = await fetch(`/api/tracks?q=${encodeURIComponent(query)}`);
        const results = await res.json();

        if (results.length === 0) {
          searchResultsContainer.innerHTML = `<p class="text-lg text-gray-400">No results found for "${query}".</p>`;
          return;
        }

        const resultsHTML = results.map(song => renderSongCard(song)).join("");
        searchResultsContainer.innerHTML = `
          <h2 class="text-2xl mb-4 font-semibold">🔍 Search Results for "${query}"</h2>
          <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            ${resultsHTML}
          </div>
        `;
      } catch (err) {
        console.error("Search failed:", err);
        searchResultsContainer.innerHTML = `<p class="text-red-500">An error occurred while searching. Please try again later.</p>`;
      }
    }
  });
});

function renderSongCard(song) {
  return `
    <div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200">
      <h3 class="text-xl font-semibold mb-2">${song.title}</h3>
      <p class="text-gray-400 mb-1">By ${song.artist}</p>
      <audio controls class="w-full mt-2">
        <source src="${song.audioUrl}" type="audio/mpeg" />
        Your browser does not support the audio element.
      </audio>
    </div>
  `;
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/'/g, '')          // remove apostrophes
    .replace(/[^\w]+/g, '-')   // replace non-word chars with dash
    .replace(/^-+|-+$/g, '');  // trim starting/ending dashes
}

async function loadTracks() {
  const res = await fetch("/api/tracks");
  tracks = await res.json();

  tracks = tracks.map(track => ({
    ...track,
    artistSlug: slugify(track.artist),
    songSlug: slugify(track.title),
  }));
  router(); // Trigger render after loading
}

async function deleteTrack(artistSlug, songSlug) {
  try {
    const encodedArtistSlug = encodeURIComponent(artistSlug);
    const encodedSongSlug = encodeURIComponent(songSlug);

    const res = await fetch(`/api/tracks/${encodedArtistSlug}/${encodedSongSlug}`, {
      method: "DELETE"
    });
    if (res.ok) {
      // Update tracks array and navigate as before
      tracks = tracks.filter(
        t => !(t.artistSlug === artistSlug && t.songSlug === songSlug)
      );

      const artistHasTracks = tracks.some(t => t.artistSlug === artistSlug);
      if (artistHasTracks) {
        navigateTo(`/${artistSlug}`);
      } else {
        navigateTo(`/`);
      }
    } else {
      const error = await res.text();
      alert(`Delete failed: ${error}`);
    }
  } catch (error) {
    alert(`Delete error: ${error.message}`);
  }
}

async function checkAdmin() {
  const res = await fetch("/api/is-admin");
  const data = await res.json();
  const isAdmin = data.isAdmin;

  isLoggedIn = isAdmin; // sync local variable

  const loginButton = document.getElementById("login-button");
  if (loginButton) {
    loginButton.style.display = isAdmin ? "none" : "block";
  }

  const logoutButton = document.getElementById("logout-button");
  if (logoutButton) {
    logoutButton.style.display = isAdmin ? "block" : "none";
  }

  const addSongLink = document.getElementById("add-song-link");
  if (addSongLink) {
    addSongLink.style.display = isAdmin ? "inline-block" : "none";
  }

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.style.display = isAdmin ? "inline-block" : "none";
  });
}


function showLogin() {
  document.getElementById("login-box").style.display = "block";
}

async function submitLogin() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (res.ok) {
    alert("Logged in!");
    document.getElementById("login-box").style.display = "none";
    await checkAdmin(); // update UI after login
    navigateTo("/");    // optionally refresh view
  } else {
    alert("Login failed.");
  }
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  alert("Logged out.");
  isLoggedIn = false;
  await checkAdmin(); // update UI after logout
  navigateTo("/");    // optionally refresh view
}

async function checkAdminAndRedirect() {
  const res = await fetch("/api/is-admin");
  const data = await res.json();
  if (!data.isAdmin) {
    alert("You must be an admin to access this page.");
    window.location.href = "/"; // redirect to homepage or login page
  } else {
    // Show form or load page normally
  }
}

async function loadTracks() {
  const res = await fetch("/api/tracks");
  tracks = await res.json();

  // Optional: normalize or sanitize the data if needed
  tracks = tracks.map(t => ({
    ...t,
    slugArtist: slugify(t.artist),
    slugTitle: slugify(t.title),
    createdAt: t.createdAt || new Date().toISOString() // fallback if missing
  }));
}

window.addEventListener("DOMContentLoaded", loadTracks);

window.addEventListener("popstate", router);
window.addEventListener("DOMContentLoaded", router);
