function getApp() {
  return document.getElementById("app");
}

function slugify(str) {
  return str.toLowerCase().replace(/[^\w]+/g, "-");
}

function isSameTrack(a, b) {
  return slugify(a.artist) === slugify(b.artist) &&
         slugify(a.title) === slugify(b.title);
}

const CATEGORY_MAP = {
  "featured": { label: "Featured", filter: t => t.isFeatured },
  "new":      { label: "Newly Added", filter: t => t.isNew },
  "popular":  { label: "Popular Tracks", filter: t => t.isPopular },
  "clean":    { label: "Clean Tracks", filter: t => t.isClean }
};

function navigateTo(path) {
  history.pushState({}, "", path);
  router();
}

function updateUIForAdmin(isAdmin) {
  document.getElementById('login-button').style.display = isAdmin ? 'none' : 'inline-block';
  document.getElementById('logout-button').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('add-song-link').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('login-box').style.display = 'none';
}

let isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
let currentlyPlayingSlug = null;
let savedSpeed = 1.0;
let tracks = []; // Global tracks array

function getSavedSpeed() {
  let s = parseFloat(localStorage.getItem('htn_speed'));
  if (isNaN(s)) s = 1.0;
  return s;
}

function getAlbumSpeedKey(albumSlug) {
  return `albumSpeed_${albumSlug}`;
}

function getSavedAlbumSpeed(albumSlug) {
  const s = parseFloat(localStorage.getItem(getAlbumSpeedKey(albumSlug)));
  return isNaN(s) ? 1.0 : s;
}

function saveAlbumSpeed(albumSlug, speed) {
  localStorage.setItem(getAlbumSpeedKey(albumSlug), speed);
}

function saveSpeed(speed) {
  localStorage.setItem('htn_speed', speed);
}

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

function getSavedVolume() {
  let v = parseFloat(localStorage.getItem('htn_volume'));
  if (isNaN(v)) v = 0.5;
  return v;
}
function saveVolume(vol) {
  localStorage.setItem('htn_volume', vol);
}

async function router() {
  const path = window.location.pathname;
  const segments = path.split("/").filter(Boolean);
  const urlParams = new URLSearchParams(window.location.search);
  const page = parseInt(urlParams.get('page')) || 1;

  if (path === "/upload") {
    await checkAdminAndRedirect();
    if (!window.isLoggedIn) return renderNotFound();
    return renderUpload();
  }
  if (path === "/") return renderHome();
  if (segments[0] === "login") return renderLogin();
  if (segments[0] === "register") return renderRegister();
  
  // Profile handled in SPA to keep persistent album bar
  if (segments[0] === "profile" && segments[1]) {
    return renderProfile(segments[1]);
  }

  if (segments[0] === "section" && segments[1] && CATEGORY_MAP[segments[1]]) {
    return renderCategoryPage(segments[1], page);
  }

  if (segments[0] === "album" && segments[1]) return renderAlbum(segments[1]);
  if (segments.length === 2) return renderSong(segments[0], segments[1]);
  if (segments.length === 1) return renderArtist(segments[0]);

  renderNotFound();
}

function renderHome() {
  const lastArtist = localStorage.getItem('lastListenedArtist');
  let recentArtistSection = '';
  if (lastArtist) {
    const artistTracks = tracks.filter(t => t.artist === lastArtist);
    for (let i = artistTracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [artistTracks[i], artistTracks[j]] = [artistTracks[j], artistTracks[i]];
    }
    const picks = artistTracks.slice(0, 4);
    while (picks.length < 4) picks.push(null);

    recentArtistSection = `
      <section>
        <h2 class="text-2xl mb-4 font-semibold">From ${lastArtist}</h2>
        <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          ${picks.map(track => track ? renderTrackCard(track) : '<div></div>').join("")}
        </div>
      </section>
    `;
  }

  let sections = Object.entries(CATEGORY_MAP).map(([key, { label, filter }]) => {
    const filtered = tracks.filter(filter);
    const firstFour = filtered.slice(0, 4);
    return `
      <section>
        <h2 class="text-2xl mb-4 font-semibold">
          <span class="hover:underline cursor-pointer" onclick="navigateTo('/section/${key}')">${label}</span>
        </h2>
        <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          ${firstFour.map(renderTrackCard).join("")}
        </div>
      </section>
    `;
  }).join("");

  getApp().innerHTML = `
    ${recentArtistSection || ''}
    ${sections}
    <br><br>
  `;
}

// Function to style pagination buttons based on current theme
function stylePaginationButtons() {
  const paginationButtons = document.querySelectorAll('.flex.justify-center button');
  if (paginationButtons.length === 0) return;

  let themeColors = {
    inactive: { bg: 'rgba(255,255,255,0.2)', hover: 'rgba(255,255,255,0.3)', text: 'white', border: 'rgba(255,255,255,0.3)' },
    active: { bg: '#3b82f6', text: 'white', border: '#3b82f6' }
  };

  // Determine theme-specific colors
  if (document.body.classList.contains('theme-midnight-blurple')) {
    themeColors.active = { bg: '#9b89fd', text: 'white', border: '#9b89fd' };
  } else if (document.body.classList.contains('theme-strawberry-lemonade')) {
    themeColors.active = { bg: '#e84c8c', text: 'white', border: '#e84c8c' };
  } else if (document.body.classList.contains('theme-ocean-breeze')) {
    themeColors.inactive.text = '#006064';
    themeColors.inactive.border = 'rgba(32,178,170,0.3)';
    themeColors.active = { bg: '#20B2AA', text: 'white', border: '#20B2AA' };
  } else if (document.body.classList.contains('theme-sunset-glow')) {
    themeColors.inactive.text = '#bf360c';
    themeColors.inactive.border = 'rgba(255,99,71,0.3)';
    themeColors.active = { bg: '#FF6347', text: 'white', border: '#FF6347' };
  } else if (document.body.classList.contains('theme-forest-night')) {
    themeColors.active = { bg: '#32CD32', text: '#0d1f0f', border: '#32CD32' };
  } else if (document.body.classList.contains('theme-lavender-dreams')) {
    themeColors.inactive.text = '#4a148c';
    themeColors.inactive.border = 'rgba(147,112,219,0.3)';
    themeColors.active = { bg: '#9370DB', text: 'white', border: '#9370DB' };
  } else if (document.body.classList.contains('theme-blue')) {
    themeColors.active = { bg: '#25bdeb', text: 'white', border: '#25bdeb' };
  } else if (document.body.classList.contains('theme-sc')) {
    themeColors.inactive.text = 'black';
    themeColors.inactive.border = 'rgba(0,0,0,0.3)';
    themeColors.active = { bg: '#f45714', text: 'white', border: '#f45714' };
  } else if (document.body.classList.contains('theme-games')) {
    themeColors.active = { bg: '#f41414', text: 'white', border: '#f41414' };
  } else if (document.body.classList.contains('theme-light')) {
    themeColors.inactive.text = 'black';
    themeColors.inactive.border = 'rgba(0,0,0,0.3)';
    themeColors.active = { bg: '#2563eb', text: 'white', border: '#2563eb' };
  } else if (document.body.classList.contains('theme-dark')) {
    themeColors.active = { bg: '#2563eb', text: 'white', border: '#2563eb' };
  }

  paginationButtons.forEach(button => {
    // Reset existing styles
    button.style.background = '';
    button.style.color = '';
    button.style.border = '';
    button.style.transition = 'all 0.2s';

    if (button.disabled) {
      // Active/current page button
      button.style.background = themeColors.active.bg;
      button.style.color = themeColors.active.text;
      button.style.border = `1px solid ${themeColors.active.border}`;
    } else {
      // Inactive buttons
      button.style.background = themeColors.inactive.bg;
      button.style.color = themeColors.inactive.text;
      button.style.border = `1px solid ${themeColors.inactive.border}`;
      
      // Add hover effect
      button.addEventListener('mouseenter', () => {
        if (!button.disabled) {
          button.style.background = themeColors.inactive.hover;
        }
      });
      
      button.addEventListener('mouseleave', () => {
        if (!button.disabled) {
          button.style.background = themeColors.inactive.bg;
        }
      });
    }
  });
}

function renderCategoryPage(categoryKey, page = 1) {
  const category = CATEGORY_MAP[categoryKey];
  if (!category) return renderNotFound();
  const filtered = tracks.filter(category.filter);
  
  // Pagination logic
  const tracksPerPage = 8;
  const totalPages = Math.ceil(filtered.length / tracksPerPage);
  const startIndex = (page - 1) * tracksPerPage;
  const endIndex = startIndex + tracksPerPage;
  const paginatedTracks = filtered.slice(startIndex, endIndex);
  
  // Helper to get theme colors for pagination
  function getThemePaginationColors(isActive) {
    let themeColors = {
      inactive: { bg: 'rgba(255,255,255,0.2)', hover: 'rgba(255,255,255,0.3)', text: 'white', border: 'rgba(255,255,255,0.3)' },
      active: { bg: '#3b82f6', text: 'white', border: '#3b82f6' }
    };
    if (document.body.classList.contains('theme-midnight-blurple')) {
      themeColors.active = { bg: '#9b89fd', text: 'white', border: '#9b89fd' };
    } else if (document.body.classList.contains('theme-strawberry-lemonade')) {
      themeColors.active = { bg: '#e84c8c', text: 'white', border: '#e84c8c' };
    } else if (document.body.classList.contains('theme-ocean-breeze')) {
      themeColors.inactive.text = '#006064';
      themeColors.inactive.border = 'rgba(32,178,170,0.3)';
      themeColors.active = { bg: '#20B2AA', text: 'white', border: '#20B2AA' };
    } else if (document.body.classList.contains('theme-sunset-glow')) {
      themeColors.inactive.text = '#bf360c';
      themeColors.inactive.border = 'rgba(255,99,71,0.3)';
      themeColors.active = { bg: '#FF6347', text: 'white', border: '#FF6347' };
    } else if (document.body.classList.contains('theme-forest-night')) {
      themeColors.active = { bg: '#32CD32', text: '#0d1f0f', border: '#32CD32' };
    } else if (document.body.classList.contains('theme-lavender-dreams')) {
      themeColors.inactive.text = '#4a148c';
      themeColors.inactive.border = 'rgba(147,112,219,0.3)';
      themeColors.active = { bg: '#9370DB', text: 'white', border: '#9370DB' };
    } else if (document.body.classList.contains('theme-blue')) {
      themeColors.active = { bg: '#25bdeb', text: 'white', border: '#25bdeb' };
    } else if (document.body.classList.contains('theme-sc')) {
      themeColors.inactive.text = 'black';
      themeColors.inactive.border = 'rgba(0,0,0,0.3)';
      themeColors.active = { bg: '#f45714', text: 'white', border: '#f45714' };
    } else if (document.body.classList.contains('theme-games')) {
      themeColors.active = { bg: '#f41414', text: 'white', border: '#f41414' };
    } else if (document.body.classList.contains('theme-light')) {
      themeColors.inactive.text = 'black';
      themeColors.inactive.border = 'rgba(0,0,0,0.3)';
      themeColors.active = { bg: '#2563eb', text: 'white', border: '#2563eb' };
    } else if (document.body.classList.contains('theme-dark')) {
      themeColors.active = { bg: '#2563eb', text: 'white', border: '#2563eb' };
    }
    return isActive ? themeColors.active : themeColors.inactive;
  }

  // Generate pagination buttons with inline themed styles
  function generatePagination(currentPage, totalPages) {
    if (totalPages <= 1) return '';
    const buttons = [];
    // Always show page 1
    if (currentPage > 1) {
      const c = getThemePaginationColors(false);
      buttons.push(`<button onclick="navigateTo('/section/${categoryKey}?page=1')" style="background:${c.bg};color:${c.text};border:1px solid ${c.border};transition:all 0.2s;" class="px-3 py-2 rounded font-semibold"${currentPage === 1 ? ' disabled' : ''}>1</button>`);
    }
    // Show ellipsis if there's a gap after page 1
    if (currentPage > 3) {
      buttons.push(`<span class="px-2 text-gray-400">...</span>`);
    }
    // Show previous page if applicable
    if (currentPage > 2 && currentPage > 1) {
      const c = getThemePaginationColors(false);
      buttons.push(`<button onclick="navigateTo('/section/${categoryKey}?page=${currentPage - 1}')" style="background:${c.bg};color:${c.text};border:1px solid ${c.border};transition:all 0.2s;" class="px-3 py-2 rounded font-semibold">${currentPage - 1}</button>`);
    }
    // Show current page (always visible and highlighted)
    const cActive = getThemePaginationColors(true);
    buttons.push(`<button style="background:${cActive.bg};color:${cActive.text};border:1px solid ${cActive.border};transition:all 0.2s;" class="px-3 py-2 rounded font-semibold" disabled>${currentPage}</button>`);
    // Show next page if applicable
    if (currentPage < totalPages - 1 && currentPage < totalPages) {
      const c = getThemePaginationColors(false);
      buttons.push(`<button onclick="navigateTo('/section/${categoryKey}?page=${currentPage + 1}')" style="background:${c.bg};color:${c.text};border:1px solid ${c.border};transition:all 0.2s;" class="px-3 py-2 rounded font-semibold">${currentPage + 1}</button>`);
    }
    // Show ellipsis if there's a gap before last page
    if (currentPage < totalPages - 2) {
      buttons.push(`<span class="px-2 text-gray-400">...</span>`);
    }
    // Always show last page
    if (currentPage < totalPages) {
      const c = getThemePaginationColors(false);
      buttons.push(`<button onclick="navigateTo('/section/${categoryKey}?page=${totalPages}')" style="background:${c.bg};color:${c.text};border:1px solid ${c.border};transition:all 0.2s;" class="px-3 py-2 rounded font-semibold"${currentPage === totalPages ? ' disabled' : ''}>${totalPages}</button>`);
    }
    return `
      <div class="flex justify-center items-center gap-2 mt-8">
        ${buttons.join('')}
      </div>
    `;
  }

  getApp().innerHTML = `
    <section>
      <h2 class="text-3xl font-bold mb-6">${category.label}</h2>
      <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${paginatedTracks.map(renderTrackCard).join("")}
      </div>
      ${generatePagination(page, totalPages)}
      <br>
    </section>
  `;
  
  // Apply theme-specific styling to pagination buttons
  setTimeout(() => stylePaginationButtons(), 0);
}

// Function to truncate text to prevent line breaks
function truncateTitle(text, containerClass = 'track') {
  // Create a temporary element to measure text width
  const tempElement = document.createElement('div');
  tempElement.style.position = 'absolute';
  tempElement.style.visibility = 'hidden';
  tempElement.style.whiteSpace = 'nowrap';
  tempElement.style.fontSize = '18px'; // text-lg equivalent
  tempElement.style.fontWeight = 'bold';
  tempElement.style.fontFamily = getComputedStyle(document.body).fontFamily;
  document.body.appendChild(tempElement);
  
  // Calculate available width based on track card dimensions
  // Track cards are in responsive grid: gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4
  // Each track card has p-4 (16px padding on all sides)
  // We need to account for container width and grid gaps
  
  let availableWidth;
  const viewportWidth = window.innerWidth;
  
  if (viewportWidth >= 1024) { // lg breakpoint - 4 columns
    availableWidth = (viewportWidth - 48 - (3 * 24)) / 4 - 32; // container padding, gaps, card padding
  } else if (viewportWidth >= 768) { // md breakpoint - 3 columns  
    availableWidth = (viewportWidth - 48 - (2 * 24)) / 3 - 32;
  } else if (viewportWidth >= 640) { // sm breakpoint - 2 columns
    availableWidth = (viewportWidth - 48 - (1 * 24)) / 2 - 32;
  } else { // 1 column
    availableWidth = viewportWidth - 48 - 32; // container padding, card padding
  }
  
  // Ensure minimum width and maximum reasonable width
  availableWidth = Math.max(120, Math.min(availableWidth, 300));
  
  // Check if original text fits
  tempElement.textContent = text;
  if (tempElement.offsetWidth <= availableWidth) {
    document.body.removeChild(tempElement);
    return text;
  }
  
  // If text doesn't fit, truncate word by word
  const words = text.split(' ');
  let truncated = '';
  
  for (let i = 0; i < words.length; i++) {
    const testText = truncated + (truncated ? ' ' : '') + words[i];
    tempElement.textContent = testText + '...';
    
    if (tempElement.offsetWidth > availableWidth) {
      break;
    }
    truncated = testText;
  }
  
  // Final check with ellipsis
  if (truncated) {
    tempElement.textContent = truncated + '...';
    if (tempElement.offsetWidth > availableWidth) {
      // Remove last word if ellipsis causes overflow
      const wordsInTruncated = truncated.split(' ');
      wordsInTruncated.pop();
      truncated = wordsInTruncated.join(' ');
    }
    document.body.removeChild(tempElement);
    return truncated + '...';
  }
  
  document.body.removeChild(tempElement);
  return text;
}

function renderTrackCard(track) {
  const artistSlug = slugify(track.artist);
  const songSlug = slugify(track.title);
  const truncatedTitle = truncateTitle(track.title);

  return `
    <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg p-4 text-center track">
      <img src="${track.cover}" alt="${track.album}" class="w-32 h-32 mx-auto object-cover rounded mb-4" />
      <h3 class="text-lg font-bold hover:underline cursor-pointer" onclick="navigateTo('/${artistSlug}/${songSlug}')" title="${track.title}">
        ${truncatedTitle}
      </h3>
      <p class="text-sm text-gray-400 hover:underline cursor-pointer" onclick="navigateTo('/${artistSlug}')">
        ${track.artist}
      </p>
    </div>
  `;
}

function updateLoopButtonColor(btn, mode) {
  btn.classList.remove("loop1", "loopall", "noloop");

  if (mode === 2) btn.classList.add("loop1");
  else if (mode === 1) btn.classList.add("loopall");
  else btn.classList.add("noloop");
}

function renderSong(artistSlug, songSlug) {
  const track = tracks.find(
    t => slugify(t.artist) === artistSlug && slugify(t.title) === songSlug
  );

  if (!track) return renderNotFound();

  // Check if audio file exists by trying to load it
  const audioExists = track.file && track.file !== '';
  
  getApp().innerHTML = `
    <div class="max-w-xl mx-auto bg-gray-800 p-6 rounded-lg shadow-lg space-y-4 track">
      <img src="${track.cover}" alt="${track.album}" class="w-full h-full object-cover rounded"/>
      <h2 class="text-2xl font-bold">${track.title}</h2>
      <p class="text-gray-400 artistPointer">
        by <span class="hover:underline cursor-pointer" onclick="navigateTo('/${slugify(track.artist)}')">${track.artist}</span>
      </p>
      <p class="italic text-gray-500 hover:underline cursor-pointer albumPointer" onclick="navigateTo('/album/${slugify(track.album)}')">${track.album}</p>

      ${!audioExists ? `
        <div class="bg-yellow-800 border border-yellow-600 text-yellow-200 px-4 py-3 rounded mb-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            <span class="font-medium">Audio file not found</span>
          </div>
          <p class="mt-1 text-sm">The audio file for this track is missing or the path is invalid.</p>
        </div>
      ` : ''}

      <div class="audio-player" style="display:flex; flex-direction:column; gap:12px; margin-top:1rem; color:#eee;">
        ${audioExists ? `<audio id="audio" src="${track.file}"></audio>` : `<audio id="audio"></audio>`}
        
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

          <button class="btn-loop noloop" id="btnLoop" title="Toggle loop" aria-pressed="false" type="button" aria-label="Loop" style="cursor:pointer; background:none; border:none; color:#aaa; width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; transition: color 0.3s, background-color 0.3s;">
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
          <div class="speed-container" style="position:relative; display:flex; align-items:center;">
          <button id="speedBtn" title="Playback Speed" style="cursor:pointer; background:none; border:none; color:#aaa; width:28px; height:28px; border-radius:4px; display:flex; align-items:center; justify-content:center; transition: color 0.3s;">
            <!-- Your sliders SVG -->
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-sliders">
              <line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line>
              <line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line>
              <line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line>
              <line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line>
              <line x1="17" y1="16" x2="23" y2="16"></line>
            </svg>
          </button>

          <div id="speedModal" class="speed-modal hidden">
            <label for="speedSlider">Speed</label>
            <input type="range" id="speedSlider" class="speed-slider" min="0.5" max="2" step="0.02" value="1"/>
            <div id="speedValue" class="speed-value">1.000x</div>
          </div>
        </div>
        </div>

        <input type="range" id="progressBar" value="0" min="0" max="100" step="0.1" style="
    width: 100%;
    height: 6px;
    background: #444;
    border-radius: 4px;
    outline: none;-webkit-appearance: none; appearance: none; cursor: pointer;">
      </div>

      ${window.isAdmin ? `
        <div class="flex gap-4 mt-4">
          <button onclick="deleteTrack('${track.slugArtist}', '${track.slugTitle}', '${track.file}')" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">Delete Track</button>
          <button onclick="editTrack('${track.slugArtist}', '${track.slugTitle}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Edit Track</button>
        </div>
      ` : ''}
    </div>

    <!-- Comments Section -->
    <div class="max-w-xl mx-auto mt-6 space-y-4">
      <h3 class="text-xl font-bold">Comments</h3>

      <div id="comment-form-wrapper" class="track p-4 rounded hidden">
        <form id="comment-form" class="space-y-3">
          <textarea id="comment-input" rows="3" class="auth-input w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500" placeholder="Write a comment..." maxlength="500"></textarea>
          <button id="comment-submit" type="submit" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white submitbtn">Post</button>
          <div id="comment-error" class="text-red-400 text-sm hidden"></div>
        </form>
      </div>
      <div id="comments-list" class="space-y-3"></div>
    </div>

    <br>
  `;

  setupAudioPlayer(track);

  // Load comments and show form for authenticated users
  initComments(track);
}

function editTrack(artistSlug, songSlug) {
  localStorage.setItem('editTrackArtistSlug', artistSlug);
  localStorage.setItem('editTrackTitleSlug', songSlug);
  window.location.href = '/edit-song.html';
}

function renderArtist(artistSlug) {
  const artistTracks = tracks.filter(t => slugify(t.artist) === artistSlug);
  if (!artistTracks.length) return renderNotFound();

  const artistName = artistTracks[0].artist;

  const albumMap = new Map();
  for (const track of artistTracks) {
    const albumSlug = slugify(track.album || "Unknown Album");
    if (!albumMap.has(albumSlug)) {
      albumMap.set(albumSlug, track);
    }
  }

  getApp().innerHTML = `
    <h2 class="text-2xl mb-4 font-bold">🎤 ${artistName}</h2>
    <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 mb-10">
      ${artistTracks.map(renderTrackCard).join("")}
    </div>
    <h3 class="text-xl font-semibold mb-2">📀 Albums featuring ${artistName}</h3>
    <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      ${[...albumMap.entries()].map(([slug, albumTrack]) => `
        <div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200 albumlink">
          <img src="${albumTrack.cover}" alt="${albumTrack.album}" class="w-full h-32 object-cover rounded mb-2" />
          <div class="font-semibold text-lg cursor-pointer hover:underline" onclick="navigateTo('/album/${slug}')">${albumTrack.album}</div>
        </div>
      `).join("")}
    </div>
    <br><br>
  `;

  setTimeout(adjustForPersistentBar, 0);
}

function isOnAlbumPage() {
  return window.location.pathname === `/album/${albumPlayer.albumSlug}`;
}

function adjustForPersistentBar() {
  const persistentBar = document.getElementById("persistent-album-bar");
  const bottomPadding = persistentBar ? persistentBar.offsetHeight + 24 : 0;

  document.documentElement.style.scrollPaddingBottom = `${bottomPadding}px`;

  window.scrollTo({ top: 0, behavior: "auto" });
}

function renderAlbum(albumSlug) {
  const matchingTracks = tracks.filter(t => slugify(t.album) === albumSlug);
  if (!matchingTracks.length) return renderNotFound();

  const sorted = matchingTracks.sort((a, b) => parseInt(a.albumNumber || 9999) - parseInt(b.albumNumber || 9999));
  const albumTitle = sorted[0].album;

  sorted.forEach(track => {
    const audio = new Audio(track.file);
    audio.addEventListener("loadedmetadata", () => {
      trackDurationMap[track.title] = formatTime(audio.duration);
      if (isOnAlbumPage()) renderAlbum(albumPlayer.albumSlug || albumSlug); // force update
    });
  });


  const artistCount = {};
  sorted.forEach(t => {
    artistCount[t.artist] = (artistCount[t.artist] || 0) + 1;
  });
  const sortedArtists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]);

  getApp().innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6">
      <h2 class="text-3xl font-bold mb-2">
        ${albumTitle}
        <span class="text-sm text-gray-400 block mt-1 artistPointer">
          by ${sortedArtists.map(([name]) => `<span class="hover:underline cursor-pointer" onclick="navigateTo('/${slugify(name)}')">${name}</span>`).join(', ')}
        </span>
      </h2>
      <button class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white" onclick="playAlbumTracks('${albumSlug}')">▶ Play All</button>
      <div class="flex flex-col divide-y-4 divide-transparent mt-4">
        ${sorted.map((track, idx) => `
          <div class="p-4 flex justify-between items-center albumtrack">
            <div>
              <div class="text-lg font-semibold hover:underline cursor-pointer" onclick="playAlbumTrack('${albumSlug}', ${idx})">${track.title}</div>
              <div class="text-gray-400 text-sm albumtracktext hover:underline cursor-pointer" onclick="navigateTo('/${slugify(track.artist)}/${slugify(track.title)}')">
                #${track.albumNumber || '?'} <span class="text-xs text-gray-500 albumtracktext">(Track ${idx + 1})</span>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderNotFound() {
  const app = getApp();
  if (app) {
    app.innerHTML = `<h2 class="text-2xl font-bold text-red-400">404 - Not Found</h2>`;
  }
}

function renderLogin() {
  getApp().innerHTML = `
    <div class="max-w-md mx-auto space-y-6">
      <!-- User Login -->
      <div class="bg-gray-800 p-6 rounded-lg shadow-lg track">
        <h2 class="text-2xl font-bold mb-4 text-center">Sign In</h2>
        <form id="user-login-form" class="space-y-4">
          <div>
            <input 
              id="user-login-username" 
              type="text" 
              placeholder="Username" 
              class="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500" 
              required
            />
          </div>
          <div>
            <input 
              id="user-login-password" 
              type="password" 
              placeholder="Password" 
              class="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500" 
              required
            />
          </div>
          <div id="user-login-error" class="text-red-500 text-sm hidden"></div>
          <button 
            type="submit" 
            class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-semibold"
          >
            Sign In
          </button>
        </form>
        <div class="mt-4 text-center">
          <p class="text-gray-400">Don't have an account?</p>
          <button onclick="navigateTo('/register')" class="text-blue-400 hover:text-blue-300">Create Account</button>
        </div>
      </div>
    </div>
  `;

  // Add user login form handler
  document.getElementById('user-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('user-login-username').value.trim();
    const password = document.getElementById('user-login-password').value;
    const errorEl = document.getElementById('user-login-error');
    
    errorEl.classList.add('hidden');
    
    try {
      const result = await submitUserLogin(username, password);
      
      if (result.success) {
        await checkAdmin();
        navigateTo('/');
      } else {
        errorEl.textContent = result.message || 'Login failed';
        errorEl.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Login error:', error);
      errorEl.textContent = 'Login failed. Please try again.';
      errorEl.classList.remove('hidden');
    }
  });
}

function renderRegister() {
  // Redirect to register route
  window.location.href = '/register';
}

async function renderProfile(userId) {
  // skeleton UI while loading
  getApp().innerHTML = `
    <div class="p-6">
      <div class="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 track animate-pulse">
        <div class="flex items-center space-x-4">
          <div class="w-20 h-20 bg-gray-700 rounded-full"></div>
          <div class="space-y-2">
            <div class="h-6 w-48 bg-gray-700 rounded"></div>
            <div class="h-4 w-64 bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  try {
    const auth = await getAuthStatus();
    const resp = await fetch(`/api/profile/${userId}`);
    const data = await resp.json();
    if (!data.success) {
      getApp().innerHTML = `
        <div class="text-center p-8">
          <div class="bg-red-900 border border-red-600 rounded-lg p-6 max-w-md mx-auto">
            <h2 class="text-xl font-bold mb-2">Profile not found</h2>
            <p class="text-red-200 mb-4">${escapeHtml(data.message || 'The requested profile could not be loaded.')}</p>
            <button class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded" onclick="navigateTo('/')">Go to Home</button>
          </div>
        </div>`;
      return;
    }

    const user = data.user;
    const isOwnProfile = !!auth.isLoggedIn && auth.user && auth.user.id === userId;

    function formatDate(dateString) {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    }
    function getInitials(username) {
      return (username || '').substring(0, 2).toUpperCase();
    }

    function getProfileGradientClass(user) {
      const gradientNum = user.selectedGradient || 1;
      return `profile-gradient-${gradientNum}`;
    }

    getApp().innerHTML = `
      <div class="max-w-5xl mx-auto p-6">
        <div class="bg-gray-800 rounded-lg shadow-lg p-6 mb-6 track">
          <div class="flex items-center space-x-4">
            <div id="profile-picture" class="w-20 h-20 ${getProfileGradientClass(user)} rounded-full flex items-center justify-center">
              <span class="text-2xl font-bold text-white">${getInitials(user.username)}</span>
            </div>
            <div>
              <h1 class="text-3xl font-bold">${escapeHtml(user.username)}</h1>
              <p class="text-gray-400">Member since ${formatDate(user.createdAt)}</p>
              ${user.isAdmin ? '<span class="bg-yellow-600 text-yellow-100 px-2 py-1 rounded text-xs font-semibold">ADMIN</span>' : ''}
            </div>
          </div>

          <div class="mt-4" id="profile-bio-section">
            <div id="profile-bio-display">
              <h3 class="text-lg font-semibold mb-2">About</h3>
              <p id="profile-bio" class="text-gray-300"></p>
            </div>

            <div id="profile-bio-edit" class="hidden">
              <h3 class="text-lg font-semibold mb-2">Edit Bio</h3>
              <textarea id="bio-edit-input" rows="4" class="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none"></textarea>
              <div class="mt-2 space-x-2">
                <button id="save-bio-btn" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">Save</button>
                <button id="cancel-bio-btn" class="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm navbutton">Cancel</button>
              </div>
            </div>

            ${isOwnProfile ? '<button id="edit-bio-btn" class="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm">Edit Bio</button>' : ''}
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2">
          <div class="bg-gray-800 rounded-lg shadow-lg p-6 track">
            <h2 class="text-xl font-bold mb-4">Account Information</h2>
            <div class="space-y-3 text-gray-300">
              <div><span class="text-gray-400">User ID:</span> ${escapeHtml(user.id)}</div>
              <div><span class="text-gray-400">Username:</span> ${escapeHtml(user.username)}</div>
              <div><span class="text-gray-400">Account Type:</span> ${user.isAdmin ? 'Administrator' : 'Standard User'}</div>
              <div><span class="text-gray-400">Created:</span> ${formatDate(user.createdAt)}</div>
            </div>
            ${isOwnProfile ? `
              <div class="mt-4 pt-4 border-t border-gray-700 space-y-2">
                ${user.id !== "0" ? `
                  <button id="change-password-link" class="text-blue-400 hover:text-blue-300 text-sm hover:underline block">
                    🔒 Change Password
                  </button>
                ` : ''}
                <div class="gradient-selector">
                  <button id="gradient-selector-btn" class="text-blue-400 hover:text-blue-300 text-sm hover:underline">
                    🎨 Change Profile Picture
                  </button>
                  <div id="gradient-dropdown" class="gradient-dropdown">
                    <div class="gradient-option profile-gradient-1" data-gradient="1" title="Purple Blue"></div>
                    <div class="gradient-option profile-gradient-2" data-gradient="2" title="Pink Red"></div>
                    <div class="gradient-option profile-gradient-3" data-gradient="3" title="Blue Cyan"></div>
                    <div class="gradient-option profile-gradient-4" data-gradient="4" title="Green Cyan"></div>
                    <div class="gradient-option profile-gradient-5" data-gradient="5" title="Pink Yellow"></div>
                    <div class="gradient-option profile-gradient-6" data-gradient="6" title="Mint Pink"></div>
                    <div class="gradient-option profile-gradient-7" data-gradient="7" title="Coral Pink"></div>
                    <div class="gradient-option profile-gradient-8" data-gradient="8" title="Sky Blue"></div>
                    <div class="gradient-option profile-gradient-9" data-gradient="9" title="Lavender Cream"></div>
                    <div class="gradient-option profile-gradient-10" data-gradient="10" title="Ice Blue"></div>
                    <div class="gradient-option profile-gradient-11" data-gradient="11" title="Sunset Ocean"></div>
                    <div class="gradient-option profile-gradient-12" data-gradient="12" title="Rose Pink"></div>
                  </div>
                </div>
              </div>
            ` : ''}
          </div>

          <div class="bg-gray-800 rounded-lg shadow-lg p-6 track">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold">Activity Tracking</h2>
              ${isOwnProfile ? `
                <div class="flex gap-2">
                  <button id="toggle-activity-btn" class="text-sm px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white">
                    Loading...
                  </button>
                  <button id="reset-activity-btn" class="text-sm px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white">
                    Reset Data
                  </button>
                </div>
              ` : ''}
            </div>
            <div id="activity-content">
              <div class="text-gray-400">Loading activity...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Fill bio text
    const bioEl = document.getElementById('profile-bio');
    if (user.bio && user.bio.trim()) {
      bioEl.textContent = user.bio;
      bioEl.classList.remove('text-gray-500', 'italic');
    } else {
      bioEl.textContent = user.isAdmin ? 'System Administrator' : 'No bio available.';
      bioEl.classList.add('text-gray-500', 'italic');
    }

    // Wire bio editing if allowed
    const editBtn = document.getElementById('edit-bio-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        document.getElementById('profile-bio-display').classList.add('hidden');
        document.getElementById('profile-bio-edit').classList.remove('hidden');
        editBtn.classList.add('hidden');
        document.getElementById('bio-edit-input').value = user.bio || '';
      });

      document.getElementById('cancel-bio-btn').addEventListener('click', () => {
        document.getElementById('profile-bio-display').classList.remove('hidden');
        document.getElementById('profile-bio-edit').classList.add('hidden');
        editBtn.classList.remove('hidden');
      });

      document.getElementById('save-bio-btn').addEventListener('click', async () => {
        const newBio = document.getElementById('bio-edit-input').value.trim();
        try {
          const r = await fetch(`/api/profile/${user.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bio: newBio })
          });
          const result = await r.json();
          if (result.success) {
            user.bio = newBio;
            bioEl.classList.remove('text-gray-500', 'italic');
            if (newBio) {
              bioEl.textContent = newBio;
            } else {
              bioEl.textContent = 'No bio available.';
              bioEl.classList.add('text-gray-500', 'italic');
            }
            document.getElementById('profile-bio-display').classList.remove('hidden');
            document.getElementById('profile-bio-edit').classList.add('hidden');
            editBtn.classList.remove('hidden');
          } else {
            alert('Failed to update bio: ' + (result.message || 'Unknown error'));
          }
        } catch (e) {
          console.error('Error updating bio', e);
          alert('Failed to update bio');
        }
      });
    }

    // Load and display activity tracking
    await loadActivityTracking(userId, isOwnProfile);

    // Wire change password link
    const changePasswordLink = document.getElementById('change-password-link');
    if (changePasswordLink) {
      changePasswordLink.addEventListener('click', () => {
        renderChangePassword(user.id);
      });
    }

    // Wire gradient selector
    const gradientSelectorBtn = document.getElementById('gradient-selector-btn');
    const gradientDropdown = document.getElementById('gradient-dropdown');
    if (gradientSelectorBtn && gradientDropdown) {
      // Mark current selection
      const currentGradient = user.selectedGradient || 1;
      const currentOption = gradientDropdown.querySelector(`[data-gradient="${currentGradient}"]`);
      if (currentOption) {
        currentOption.classList.add('selected');
      }

      // Toggle dropdown
      gradientSelectorBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        gradientDropdown.classList.toggle('show');
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!gradientDropdown.contains(e.target) && e.target !== gradientSelectorBtn) {
          gradientDropdown.classList.remove('show');
        }
      });

      // Handle gradient selection
      gradientDropdown.addEventListener('click', async (e) => {
        if (e.target.classList.contains('gradient-option')) {
          const selectedGradient = parseInt(e.target.dataset.gradient);
          
          try {
            const response = await fetch(`/api/profile/${user.id}/gradient`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ selectedGradient })
            });
            
            if (!response.ok) {
              const errorData = await response.json();
              console.error('Gradient update failed:', response.status, errorData);
              
              if (response.status === 401) {
                alert('You need to be logged in to change your profile picture. Please log in and try again.');
                return;
              } else if (response.status === 403) {
                alert('You can only change your own profile picture.');
                return;
              } else {
                alert('Failed to update profile picture: ' + (errorData.message || 'Unknown error'));
                return;
              }
            }
            
            const result = await response.json();
            if (result.success) {
              // Update profile picture
              const profilePic = document.getElementById('profile-picture');
              profilePic.className = `w-20 h-20 profile-gradient-${selectedGradient} rounded-full flex items-center justify-center`;
              
              // Update selection indicators
              gradientDropdown.querySelectorAll('.gradient-option').forEach(opt => {
                opt.classList.remove('selected');
              });
              e.target.classList.add('selected');
              
              // Close dropdown
              gradientDropdown.classList.remove('show');
              
              // Update user object
              user.selectedGradient = selectedGradient;
            } else {
              alert('Failed to update profile picture: ' + (result.message || 'Unknown error'));
            }
          } catch (error) {
            console.error('Error updating gradient:', error);
            alert('Failed to update profile picture. Please check your connection and try again.');
          }
        }
      });
    }
  } catch (e) {
    console.error('Failed to load profile', e);
    getApp().innerHTML = `
      <div class="text-center p-8">
        <div class="bg-red-900 border border-red-600 rounded-lg p-6 max-w-md mx-auto">
          <h2 class="text-xl font-bold mb-2">Error</h2>
          <p class="text-red-200 mb-4">Failed to load profile.</p>
          <button class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded" onclick="navigateTo('/')">Go to Home</button>
        </div>
      </div>`;
  }
}

async function loadActivityTracking(userId, isOwnProfile) {
  try {
    const response = await fetch(`/api/activity/${userId}`);
    const data = await response.json();
    
    const activityContent = document.getElementById('activity-content');
    const toggleBtn = document.getElementById('toggle-activity-btn');
    const resetBtn = document.getElementById('reset-activity-btn');
    
    if (!data.success) {
      activityContent.innerHTML = '<div class="text-red-400">Failed to load activity data.</div>';
      return;
    }

    // Update toggle button
    if (toggleBtn && isOwnProfile) {
      toggleBtn.textContent = data.activityVisible ? 'Hide Activity' : 'Show Activity';
      toggleBtn.onclick = () => toggleActivityVisibility(userId, !data.activityVisible);
    }

    // Update reset button
    if (resetBtn && isOwnProfile) {
      resetBtn.onclick = () => showResetActivityModal(userId);
    }

    // Display activity
    if (!data.activityVisible) {
      activityContent.innerHTML = `
        <div class="activity-hidden text-center py-6">
          <div class="text-6xl mb-2">🔒</div>
          <div>Activity tracking is hidden</div>
        </div>
      `;
      return;
    }

    if (data.topTracks.length === 0) {
      activityContent.innerHTML = `
        <div class="activity-empty text-center py-6">
          <div class="text-6xl mb-2">🎵</div>
          <div>No activity yet</div>
          <div class="text-sm mt-1">Start listening to tracks to see your activity!</div>
        </div>
      `;
      return;
    }

    // Display top tracks
    const tracksHtml = data.topTracks.map((track, index) => `
      <div class="activity-track-card">
        <div class="track-rank text-2xl font-bold w-8">#${index + 1}</div>
        <img src="${track.trackCover}" alt="${track.trackTitle}" 
             class="w-12 h-12 object-cover rounded" 
             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
        <div class="w-12 h-12 bg-gray-600 rounded flex items-center justify-center text-gray-400 text-xs" style="display:none;">
          No Image
        </div>
        <div class="flex-1">
          <div class="track-title font-semibold hover:underline cursor-pointer" 
               onclick="navigateTo('/${slugify(track.trackArtist)}/${slugify(track.trackTitle)}')"
               title="Go to track page">
            ${escapeHtml(track.trackTitle)}
          </div>
          <div class="track-artist text-sm hover:underline cursor-pointer" 
               onclick="navigateTo('/${slugify(track.trackArtist)}')"
               title="Go to artist page">
            by ${escapeHtml(track.trackArtist)}
          </div>
        </div>
        <div class="text-right">
          <div class="play-count font-semibold">${track.count} plays</div>
          <div class="track-date text-xs">Last: ${new Date(track.lastPlayed).toLocaleDateString()}</div>
        </div>
      </div>
    `).join('');

    activityContent.innerHTML = `
      <div class="space-y-3">
        <div class="text-sm text-gray-400 mb-3">Top 3 most played tracks:</div>
        ${tracksHtml}
      </div>
    `;

  } catch (error) {
    console.error('Error loading activity:', error);
    document.getElementById('activity-content').innerHTML = 
      '<div class="text-red-400">Failed to load activity data.</div>';
  }
}

async function toggleActivityVisibility(userId, visible) {
  try {
    const response = await fetch('/api/activity/visibility', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible })
    });

    const data = await response.json();
    if (data.success) {
      // Reload activity to reflect changes
      await loadActivityTracking(userId, true);
    } else {
      alert('Failed to update activity visibility');
    }
  } catch (error) {
    console.error('Error toggling activity visibility:', error);
    alert('Failed to update activity visibility');
  }
}

function showResetActivityModal(userId) {
  // Create modal HTML
  const modalHtml = `
    <div id="reset-activity-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style="backdrop-filter: blur(4px);">
      <div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 track" style="border: 1px solid rgba(255,255,255,0.1);">
        <div class="p-6">
          <div class="flex items-center mb-4">
            <div class="text-3xl mr-3">⚠️</div>
            <h3 class="text-xl font-bold text-white">Reset Activity Data</h3>
          </div>
          
          <div class="mb-6">
            <p class="text-gray-300 mb-3">
              Are you sure you want to reset all your activity data? This action will:
            </p>
            <ul class="text-gray-300 text-sm space-y-1 ml-4">
              <li>• Remove all play counts</li>
              <li>• Clear your top tracks history</li>
              <li>• Reset all listening statistics</li>
            </ul>
            <p class="text-red-400 text-sm mt-3 font-semibold">
              This action cannot be undone!
            </p>
          </div>
          
          <div class="flex gap-3">
            <button id="confirm-reset-btn" class="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded font-semibold transition-colors">
              Yes, Reset Data
            </button>
            <button id="cancel-reset-btn" class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded font-semibold transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Add modal to document
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Add event listeners
  document.getElementById('confirm-reset-btn').onclick = () => resetActivityData(userId);
  document.getElementById('cancel-reset-btn').onclick = hideResetActivityModal;
  
  // Allow clicking outside modal to close
  document.getElementById('reset-activity-modal').onclick = (e) => {
    if (e.target.id === 'reset-activity-modal') {
      hideResetActivityModal();
    }
  };

  // Add escape key listener
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      hideResetActivityModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
}

function hideResetActivityModal() {
  const modal = document.getElementById('reset-activity-modal');
  if (modal) {
    modal.remove();
  }
}

async function resetActivityData(userId) {
  try {
    // Show loading state
    const confirmBtn = document.getElementById('confirm-reset-btn');
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = 'Resetting...';
    confirmBtn.disabled = true;

    const response = await fetch('/api/activity/reset', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();
    
    if (data.success) {
      // Hide modal
      hideResetActivityModal();
      
      // Show success message
      showSuccessMessage('Activity data has been reset successfully!');
      
      // Reload activity to reflect changes
      await loadActivityTracking(userId, true);
    } else {
      throw new Error(data.error || 'Failed to reset activity data');
    }
  } catch (error) {
    console.error('Error resetting activity:', error);
    
    // Restore button state
    const confirmBtn = document.getElementById('confirm-reset-btn');
    if (confirmBtn) {
      confirmBtn.textContent = 'Yes, Reset Data';
      confirmBtn.disabled = false;
    }
    
    // Show error
    showErrorMessage('Failed to reset activity data. Please try again.');
  }
}

function showSuccessMessage(message) {
  const messageHtml = `
    <div id="success-message" class="fixed top-4 right-4 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 track">
      <div class="flex items-center">
        <div class="text-xl mr-2">✅</div>
        <div>${message}</div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', messageHtml);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    const msgEl = document.getElementById('success-message');
    if (msgEl) msgEl.remove();
  }, 3000);
}

function showErrorMessage(message) {
  const messageHtml = `
    <div id="error-message" class="fixed top-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 track">
      <div class="flex items-center">
        <div class="text-xl mr-2">❌</div>
        <div>${message}</div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', messageHtml);
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    const msgEl = document.getElementById('error-message');
    if (msgEl) msgEl.remove();
  }, 4000);
}

function renderChangePassword(userId) {
  getApp().innerHTML = `
    <div class="max-w-md mx-auto p-6">
      <div class="bg-gray-800 rounded-lg shadow-lg p-6 track">
        <h2 class="text-2xl font-bold mb-4">🔒 Change Password</h2>
        
        <form id="change-password-form" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Current Password</label>
            <input 
              type="password" 
              id="current-password" 
              class="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500" 
              required
              autocomplete="current-password"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">New Password</label>
            <input 
              type="password" 
              id="new-password" 
              class="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500" 
              required
              minlength="6"
              autocomplete="new-password"
            />
            <p class="text-xs text-gray-400 mt-1">Minimum 6 characters</p>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">Confirm New Password</label>
            <input 
              type="password" 
              id="confirm-password" 
              class="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500" 
              required
              minlength="6"
              autocomplete="new-password"
            />
          </div>
          
          <div id="password-error" class="text-red-400 text-sm hidden"></div>
          <div id="password-success" class="text-green-400 text-sm hidden"></div>
          
          <div class="flex gap-3">
            <button 
              type="submit" 
              class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-semibold"
            >
              Change Password
            </button>
            <button 
              type="button" 
              onclick="navigateTo('/profile/${userId}')"
              class="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Handle form submission
  document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    const errorEl = document.getElementById('password-error');
    const successEl = document.getElementById('password-success');
    
    // Hide previous messages
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');
    
    // Validate passwords match
    if (newPassword !== confirmPassword) {
      errorEl.textContent = 'New passwords do not match';
      errorEl.classList.remove('hidden');
      return;
    }
    
    // Validate password length
    if (newPassword.length < 6) {
      errorEl.textContent = 'New password must be at least 6 characters long';
      errorEl.classList.remove('hidden');
      return;
    }
    
    try {
      const response = await fetch(`/api/profile/${userId}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      const result = await response.json();
      
      if (result.success) {
        successEl.textContent = 'Password changed successfully! Redirecting...';
        successEl.classList.remove('hidden');
        
        // Redirect to profile after 2 seconds
        setTimeout(() => {
          navigateTo(`/profile/${userId}`);
        }, 2000);
      } else {
        errorEl.textContent = result.message || 'Failed to change password';
        errorEl.classList.remove('hidden');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      errorEl.textContent = 'An error occurred. Please try again.';
      errorEl.classList.remove('hidden');
    }
  });
}

function renderUpload() {
  getApp().innerHTML = `
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
          <label><input type="checkbox" name="isFeatured" /> Popular</label>
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
    isPopular: form.isPopular.checked,
    isFeatured :form.isFeatured.checked,
    isClean: form.isClean.checked,
    albumNumber: albumNumber ? parseInt(albumNumber) : null,
  };

  try {
    const res = await fetch("/api/tracks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTrack)
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response is not JSON");
    }

    const savedTrack = await res.json();
    tracks.unshift(savedTrack.track);
    navigateTo("/");
  } catch (error) {
    console.error('Error adding track:', error);
    alert('Failed to add track: ' + error.message);
  }
  };
 
}

// album page stuff below this point key: albumbelow //

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

let albumPlayer = {
  currentIndex: 0,
  tracks: [],
  albumSlug: '',
  loopMode: 0,
  audio: null,
  paused: false,
  volumeVisible: false
};

function saveAlbumPlayerState() {
  const state = {
    currentIndex: albumPlayer.currentIndex,
    tracks: albumPlayer.tracks,
    albumSlug: albumPlayer.albumSlug,
    loopMode: albumPlayer.loopMode,
    paused: albumPlayer.paused,
    currentTime: albumPlayer.audio ? albumPlayer.audio.currentTime : 0,
    playbackRate: albumPlayer.audio ? albumPlayer.audio.playbackRate : 1.0,
    volume: albumPlayer.audio ? albumPlayer.audio.volume : getSavedVolume()
  };
  localStorage.setItem('albumPlayerState', JSON.stringify(state));
}

function restorePersistentPlayer() {
  // Check if we have album player state in localStorage
  const savedAlbumState = localStorage.getItem('albumPlayerState');
  if (savedAlbumState) {
    try {
      const state = JSON.parse(savedAlbumState);
      albumPlayer.currentIndex = state.currentIndex || 0;
      albumPlayer.tracks = state.tracks || [];
      albumPlayer.albumSlug = state.albumSlug || '';
      albumPlayer.loopMode = state.loopMode || 0;
      albumPlayer.paused = state.paused !== false; // Default to paused on page load
      
      if (albumPlayer.tracks.length > 0 && albumPlayer.currentIndex < albumPlayer.tracks.length) {
        // Set currentlyPlayingSlug for consistency
        currentlyPlayingSlug = slugify(albumPlayer.tracks[albumPlayer.currentIndex].title);
        localStorage.setItem('lastListenedArtist', albumPlayer.tracks[albumPlayer.currentIndex].artist);
        
        // Create the audio player without auto-playing
        const currentTrack = albumPlayer.tracks[albumPlayer.currentIndex];
        const bar = document.getElementById("persistent-album-bar");
        if (bar) bar.classList.remove("hide");
        
        // Create new audio element
        const audio = new Audio();
        albumPlayer.audio = audio;
        audio.preservesPitch = false;
        audio.mozPreservesPitch = false;
        audio.webkitPreservesPitch = false;
        
  // Set saved properties
  audio.playbackRate = state.playbackRate || getSavedAlbumSpeed(albumPlayer.albumSlug) || 1.0;
        audio.volume = state.volume || getSavedVolume();
        audio.src = currentTrack.file;
        
        // Add event listeners
        audio.addEventListener("play", () => {
          albumPlayer.paused = false;
          updatePersistentPlayer();
          saveAlbumPlayerState();
          if (isOnAlbumPage()) renderCurrentAlbumView();
        });

        audio.addEventListener("pause", () => {
          albumPlayer.paused = true;
          updatePersistentPlayer();
          saveAlbumPlayerState();
          if (isOnAlbumPage()) renderCurrentAlbumView();
        });
        
        audio.addEventListener("loadedmetadata", () => {
          // Restore playback position once metadata is loaded
          if (state.currentTime && state.currentTime > 0) {
            audio.currentTime = Math.min(state.currentTime, audio.duration);
          }
        });
        
        audio.addEventListener("canplaythrough", () => {
          // Don't auto-play when restoring, respect paused state
          if (!albumPlayer.paused) {
            audio.play();
          }
          // After restored, persist the playback rate for this album and refresh UI
          saveAlbumSpeed(albumPlayer.albumSlug, audio.playbackRate);
          updatePersistentPlayer();
        });

        audio.addEventListener("error", () => {
          console.error("Audio failed to load:", currentTrack.file);
        });

        // Keep UI and state in sync while playing after restore
        let lastSaveTime = 0;
        audio.addEventListener("timeupdate", () => {
          const now = Date.now();
          if (now - lastSaveTime > 5000) {
            saveAlbumPlayerState();
            lastSaveTime = now;
          }

          // Update persistent album progress bar
          const hasDuration = !!audio.duration && !isNaN(audio.duration);
          const percent = hasDuration ? (audio.currentTime / audio.duration) * 100 : 0;
          const color = getProgressBarColor();
          const bar = document.querySelector("#albumProgress");
          if (bar) {
            bar.value = percent;
            bar.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
          }

          // Update persistent timestamp
          const albumTimestamp = document.querySelector("#albumTimestamp");
          if (albumTimestamp && hasDuration) {
            albumTimestamp.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
          }

          // If on a song page that matches the current track, sync its UI too
          const progressBar = document.getElementById("progressBar");
          const timestamp = document.getElementById("timestamp");
          if (
            progressBar &&
            timestamp &&
            hasDuration &&
            typeof currentlyPlayingSlug !== "undefined" &&
            slugify(albumPlayer.tracks[albumPlayer.currentIndex].title) === currentlyPlayingSlug
          ) {
            progressBar.value = percent;
            progressBar.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
            timestamp.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
          }
        });

        // Keep album view durations fresh when restoring
        audio.addEventListener("durationchange", () => {
          const current = albumPlayer.tracks[albumPlayer.currentIndex];
          if (current && audio.duration) {
            trackDurationMap[current.title] = formatTime(audio.duration);
            if (isOnAlbumPage()) renderCurrentAlbumView();
            updatePersistentPlayer();
          }
        });

        audio.onended = () => {
          if (albumPlayer.loopMode === 2) {
            audio.currentTime = 0;
            audio.play();
          } else if (albumPlayer.currentIndex + 1 < albumPlayer.tracks.length) {
            albumPlayer.currentIndex++;
            if (isOnAlbumPage()) renderCurrentAlbumView();
            startAlbumAudio();
            saveAlbumPlayerState();
          } else if (albumPlayer.loopMode === 1) {
            albumPlayer.currentIndex = 0;
            startAlbumAudio();
            saveAlbumPlayerState();
          }
        };
        
        // Load the audio
        audio.load();
        
        // Update the persistent player UI
        updatePersistentPlayer();
      }
    } catch (error) {
      console.error('Error restoring album player state:', error);
    }
  }
}

function playAlbumTrack(albumSlug, index) {
  playAlbumTracks(albumSlug);
  albumPlayer.currentIndex = index;
  startAlbumAudio();
  updatePersistentPlayer();
  saveAlbumPlayerState();

  const persistentVolumeSlider = document.getElementById("volumeSlider");
  if (albumPlayer.audio && persistentVolumeSlider) {
    const volume = parseFloat(persistentVolumeSlider.value);
    albumPlayer.audio.volume = volume;
    persistentVolumeSlider.value = volume;
    // Update volume fill
    const percent = volume * 100;
    const color = getProgressBarColor();
    persistentVolumeSlider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
  }
}

function setupVolumeSlider(slider, audio) {
  if (!slider || !audio) return;

  function updateVolumeFill() {
    const percent = parseFloat(volumeSlider.value) * 100;
    const color = getProgressBarColor();
    volumeSlider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
  }

  slider.addEventListener("input", () => {
    audio.volume = parseFloat(slider.value);
    updateVolumeFill();
    saveVolume(parseFloat(slider.value));
  });

  updateVolumeFill();
}

function playAlbumTracks(albumSlug) {
  albumPlayer.tracks = tracks
    .filter(t => slugify(t.album) === albumSlug)
    .sort((a, b) => parseInt(a.albumNumber || 9999) - parseInt(b.albumNumber || 9999));
  albumPlayer.currentIndex = 0;
  albumPlayer.albumSlug = albumSlug;
  saveAlbumPlayerState();

  renderCurrentAlbumView();
  startAlbumAudio();
  updatePersistentPlayer();
}

function stopAlbumAudio() {
  if (albumPlayer.audio) {
    albumPlayer.audio.pause();
    albumPlayer.audio.src = '';
    albumPlayer.audio = null;
  }
}

function setupVolumeSlider(slider, audio) {
  if (!slider || !audio) return;

  function updateVolumeFill() {
    const percent = parseFloat(volumeSlider.value) * 100;
    const color = getProgressBarColor();
    volumeSlider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
  }

  slider.addEventListener("input", () => {
    audio.volume = parseFloat(slider.value);
    updateVolumeFill();
  });

  updateVolumeFill();
}

function startAlbumAudio() {
  stopAlbumAudio();
  const bar = document.getElementById("persistent-album-bar");
  if (bar) bar.classList.remove("hide");
  const currentTrack = albumPlayer.tracks[albumPlayer.currentIndex];
  currentlyPlayingSlug = slugify(currentTrack.title);
  localStorage.setItem('lastListenedArtist', currentTrack.artist);
  const audio = new Audio();
  albumPlayer.audio = audio;
  audio.preservesPitch = false;
  audio.mozPreservesPitch = false;
  audio.webkitPreservesPitch = false;
  const albumSlug = albumPlayer.albumSlug;
  const savedSpeed = getSavedAlbumSpeed(albumSlug);
  albumPlayer.audio.playbackRate = savedSpeed;

  const albumSpeedSlider = document.getElementById("albumSpeedSlider");
  if (albumSpeedSlider) {
    albumSpeedSlider.value = albumPlayer.audio.playbackRate;
    const albumSpeedValue = document.getElementById("albumSpeedValue");
    if (albumSpeedValue) albumSpeedValue.textContent = albumPlayer.audio.playbackRate.toFixed(3) + "x";
  }

  audio.src = currentTrack.file;
  audio.load();

  let defaultVolume = getSavedVolume();
  audio.volume = defaultVolume;

  const persistentVolumeSlider = document.getElementById("volumeSlider");
  if (persistentVolumeSlider) {
    persistentVolumeSlider.value = defaultVolume;
    setupVolumeSlider(persistentVolumeSlider, albumPlayer.audio);

    persistentVolumeSlider.addEventListener("input", () => {
      saveVolume(parseFloat(persistentVolumeSlider.value));
    });
  }

  audio.addEventListener("canplaythrough", () => {
    audio.play();
    // Track the play for album track
    trackPlay(slugify(currentTrack.artist), slugify(currentTrack.title));
  });

  audio.addEventListener("error", () => {
    console.error("Audio failed to load:", currentTrack.file);
  });

  // Add event listeners to keep persistent player UI in sync
  audio.addEventListener("play", () => {
    albumPlayer.paused = false;
    updatePersistentPlayer();
    saveAlbumPlayerState();
    if (isOnAlbumPage()) renderCurrentAlbumView();
  });

  audio.addEventListener("pause", () => {
    albumPlayer.paused = true;
    updatePersistentPlayer();
    saveAlbumPlayerState();
    if (isOnAlbumPage()) renderCurrentAlbumView();
  });

  // Save state periodically during playback to preserve position
  let lastSaveTime = 0;
  audio.addEventListener("timeupdate", () => {
    // Save state every 5 seconds to avoid too frequent saves
    const now = Date.now();
    if (now - lastSaveTime > 5000) {
      saveAlbumPlayerState();
      lastSaveTime = now;
    }
  });
  albumPlayer.paused = false;

  const savedVolume = persistentVolumeSlider ? parseFloat(persistentVolumeSlider.value) : 1;
  audio.volume = savedVolume;

  setupVolumeSlider(persistentVolumeSlider, albumPlayer.audio);

  audio.onended = () => {
    if (albumPlayer.loopMode === 2) {
      audio.currentTime = 0;
      audio.play();
    } else if (albumPlayer.currentIndex + 1 < albumPlayer.tracks.length) {
      albumPlayer.currentIndex++;
      if (isOnAlbumPage()) renderCurrentAlbumView();
      startAlbumAudio();
      saveAlbumPlayerState();
    } else if (albumPlayer.loopMode === 1) {
      albumPlayer.currentIndex = 0;
      startAlbumAudio();
      saveAlbumPlayerState();
    }
  };

  audio.ondurationchange = () => {
    const current = albumPlayer.tracks[albumPlayer.currentIndex];
    trackDurationMap[current.title] = formatTime(audio.duration);
    if (isOnAlbumPage()) renderCurrentAlbumView();
    updatePersistentPlayer();
  };

  audio.ontimeupdate = () => {
    const percent = (audio.currentTime / audio.duration) * 100;
    const bar = document.querySelector("#albumProgress");
    const color = getProgressBarColor();
    if (bar) {
      bar.value = percent;
      bar.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
    }

    // Only sync song page if the track matches
    const progressBar = document.getElementById("progressBar");
    const timestamp = document.getElementById("timestamp");
    if (
      progressBar &&
      timestamp &&
      typeof currentlyPlayingSlug !== "undefined" &&
      slugify(albumPlayer.tracks[albumPlayer.currentIndex].title) === currentlyPlayingSlug
    ) {
      progressBar.value = percent;
      progressBar.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
      timestamp.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }

    const albumTimestamp = document.querySelector("#albumTimestamp");
    if (albumTimestamp) {
      albumTimestamp.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
  };

  audio.play();
}

function renderCurrentAlbumView() {
  const currentTrack = albumPlayer.tracks[albumPlayer.currentIndex];
  const albumSlug = albumPlayer.albumSlug;
  const albumTitle = currentTrack.album;
  const uniqueArtists = {};

  for (let track of albumPlayer.tracks) {
    uniqueArtists[track.artist] = (uniqueArtists[track.artist] || 0) + 1;
  }
  const sortedArtists = Object.entries(uniqueArtists).sort((a, b) => b[1] - a[1]);

  getApp().innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6">
      <h2 class="text-3xl font-bold mb-2">
        ${albumTitle}
        <span class="text-sm text-gray-400 block mt-1 artistPointer">
          by ${sortedArtists.map(([name]) => `<span class='hover:underline cursor-pointer' onclick="navigateTo('/${slugify(name)}')">${name}</span>`).join(', ')}
        </span>
      </h2>
      <button class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white" onclick="playAlbumTracks('${albumSlug}')">▶ Restart Album</button>
      <div class="flex flex-col divide-y-4 divide-transparent mt-4">
        ${albumPlayer.tracks.map((track, idx) => `
          <div class="p-4 flex justify-between items-center albumtrack ${idx === albumPlayer.currentIndex ? 'bg-gray-700 currenttrack' : 'bg-gray-800'}">
            <div>
              <div class="text-lg font-semibold hover:underline cursor-pointer" onclick="playAlbumTrack('${albumSlug}', ${idx})">${track.title}</div>
              <div class="text-gray-400 text-sm albumtracktext hover:underline cursor-pointer" onclick="navigateTo('/${slugify(track.artist)}/${slugify(track.title)}')">
                #${track.albumNumber || '?'} <span class="text-xs text-gray-500 albumtracktext">(Track ${idx + 1})</span> • ${trackDurationMap[track.title] || '--:--'}
              </div>
            </div>
            ${idx === albumPlayer.currentIndex ? `<span class="text-green-400 text-sm playingtext">Playing...</span>` : ''}
          </div>
        `).join('')}
      </div>
    </div>
    <br>
    <br>

  `;
}

function updatePersistentPlayer() {
  const current = albumPlayer.tracks[albumPlayer.currentIndex];
  let bar = document.getElementById("persistent-album-bar");
  function updateSpeedFill(slider, valueEl) {
    const min = parseFloat(slider.min) || 0.5;
    const max = parseFloat(slider.max) || 2;
    const val = parseFloat(slider.value);
    const percent = ((val - min) / (max - min)) * 100;
    const color = getProgressBarColor();
    slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
    if (valueEl) valueEl.textContent = val.toFixed(3) + "x";
  }

  if (!bar) {
    const container = document.createElement("div");
    container.id = "persistent-album-bar";
    container.className = "fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 px-4 py-3 flex items-center justify-between z-50";
    container.innerHTML = `
      <div class="flex items-center gap-4">
        <button onclick="albumPrevTrack()" class="text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" 
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="19 20 9 12 19 4 19 20"/><line x1="5" y1="19" x2="5" y2="5"/>
          </svg>
        </button>
        <button onclick="toggleAlbumPlayPause()" class="text-white">
          <svg id="albumPlayIcon" ${!albumPlayer.paused ? 'style="display:none;"' : ''} 
               xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" 
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <svg id="albumPauseIcon" ${albumPlayer.paused ? 'style="display:none;"' : ''} 
               xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" 
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
          </svg>
        </button>
        <button onclick="albumNextTrack()" class="text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" 
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
        <div class="ml-4">
          <div class="font-semibold text-white text-sm" id="bar-track-title">${current.title}</div>
          <div class="text-gray-400 text-xs" id="bar-track-meta"></div>
        </div>
      </div>
      <div class="flex items-center gap-4">
        <button id="albumSpeedBtn" class="text-white" title="Playback Speed">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
        </button>
        <div id="albumSpeedModal" class="speed-modal hidden">
          <label for="albumSpeedSlider">Speed</label>
          <input type="range" id="albumSpeedSlider" class="speed-slider" min="0.5" max="2" step="0.02" value="1"/>
          <div id="albumSpeedValue" class="speed-value">1.000x</div>
        </div>
        <span id="albumTimestamp" class="text-gray-400 text-sm">0:00 / --:--</span>
        <input id="albumProgress" type="range" min="0" max="100" step="0.1" value="0" style="appearance: none; width: 200px; height: 6px; border-radius: 4px; cursor: pointer; outline: none;" />
        <div class="relative group volume-container">
          <svg class="volume-icon text-white cursor-pointer" id="volumeIcon" width="24" height="24" viewBox="0 0 24 24" 
               fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9v6h4l5 5V4L7 9H3z"/>
          </svg>
          <input type="range" id="volumeSlider" min="0" max="1" step="0.01" value="1"
            class="absolute left-1/2 transform -translate-x-1/2 bottom-8 hidden group-hover:block"
            style="width: 100px;" />
        </div>
        <button id="persistentLoopBtn" onclick="cycleAlbumLoopMode()" class="btn-loop ${albumPlayer.loopMode > 0 ? 'active' : ''} text-white">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" 
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="17 1 21 5 17 9"/>
            <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
            <polyline points="7 23 3 19 7 15"/>
            <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
          </svg>
        </button>
        <div class="speed-container relative flex items-center">
      </div>
    `;
    document.body.appendChild(container);

    bar = container;

    const loopBtn = bar.querySelector("#persistentLoopBtn");
    loopBtn.classList.remove("loopall", "loop1", "noloop");

    if (albumPlayer.loopMode === 2) {
      loopBtn.classList.add("loop1");
    } else if (albumPlayer.loopMode === 1) {
      loopBtn.classList.add("loopall");
    } else {
      loopBtn.classList.add("noloop");
    }


    // progress bar seek
    const progress = bar.querySelector("#albumProgress");
    progress.addEventListener("input", () => {
      if (albumPlayer.audio?.duration) {
        const percent = parseFloat(progress.value);
        albumPlayer.audio.currentTime = (percent / 100) * albumPlayer.audio.duration;

        // Only sync normal track progress bar if the track matches
        const currentTrack = albumPlayer.tracks[albumPlayer.currentIndex];
        const progressBar = document.getElementById("progressBar");
        const timestamp = document.getElementById("timestamp");
        const color = getProgressBarColor();
        if (
          progressBar &&
          timestamp &&
          typeof currentTrack !== "undefined" &&
          typeof currentlyPlayingSlug !== "undefined" &&
          currentTrack.slug === currentlyPlayingSlug
        ) {
          progressBar.value = percent;
          progressBar.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
          timestamp.textContent = `${formatTime(albumPlayer.audio.currentTime)} / ${formatTime(albumPlayer.audio.duration)}`;
        }
      }
    });

    progress.addEventListener("click", (e) => {
      const rect = progress.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      if (albumPlayer.audio?.duration) {
        albumPlayer.audio.currentTime = percent * albumPlayer.audio.duration;
      }
    });

    // volume
    const volumeSlider = bar.querySelector("#volumeSlider");
    const volumeIcon = bar.querySelector("#volumeIcon");
    const volumeContainer = bar.querySelector(".volume-container");

    function updateVolumeFill() {
      const percent = parseFloat(volumeSlider.value) * 100;
      const color = getProgressBarColor();
      volumeSlider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
    }

    volumeSlider.addEventListener("input", () => {
      if (albumPlayer.audio) {
        albumPlayer.audio.volume = parseFloat(volumeSlider.value);
        updateVolumeFill();
      }
    });

    albumPlayer.volumeVisible = albumPlayer.volumeVisible || false;

    volumeIcon.addEventListener("click", () => {
      albumPlayer.volumeVisible = !albumPlayer.volumeVisible;
      volumeSlider.style.display = albumPlayer.volumeVisible ? "block" : "none";
      volumeContainer.classList.toggle("active", albumPlayer.volumeVisible);
    });

    volumeContainer.addEventListener("mouseenter", () => {
      if (!albumPlayer.volumeVisible) volumeSlider.style.display = "block";
    });

    volumeContainer.addEventListener("mouseleave", () => {
      if (!albumPlayer.volumeVisible) volumeSlider.style.display = "none";
    });

    updateVolumeFill();

    const albumSpeedBtn = bar.querySelector("#albumSpeedBtn");
    const albumSpeedModal = bar.querySelector("#albumSpeedModal");
    const albumSpeedSlider = bar.querySelector("#albumSpeedSlider");
    const albumSpeedValue = bar.querySelector("#albumSpeedValue");

    if (albumSpeedBtn && albumSpeedModal && albumSpeedSlider && albumSpeedValue) {
      // Determine current speed preference: prefer live audio rate, fallback to saved album speed
      const albumSlug = albumPlayer.albumSlug;
      const audioSpeed = albumPlayer.audio ? albumPlayer.audio.playbackRate : NaN;
      const savedSpeed = getSavedAlbumSpeed(albumSlug);
      const currentSpeed = !isNaN(audioSpeed) && audioSpeed > 0 ? audioSpeed : savedSpeed;

      // Initialize speed and UI to current value
      if (albumPlayer.audio) albumPlayer.audio.playbackRate = currentSpeed;
      albumSpeedSlider.value = currentSpeed;
      albumSpeedValue.textContent = currentSpeed.toFixed(3) + "x";
      updateSpeedFill(albumSpeedSlider, albumSpeedValue);

      // Set up event listeners
      albumSpeedBtn.addEventListener("click", () => {
        albumSpeedModal.classList.toggle("hidden");
        albumSpeedBtn.classList.toggle("active");
      });

      albumSpeedSlider.addEventListener("input", () => {
        const speed = parseFloat(albumSpeedSlider.value);
        albumPlayer.audio.playbackRate = speed;
        saveAlbumSpeed(albumPlayer.albumSlug, speed);
        albumSpeedValue.textContent = speed.toFixed(3) + "x";
        updateSpeedFill(albumSpeedSlider, albumSpeedValue);
        saveAlbumPlayerState(); // Save state when speed changes
      });
    }

    let coverBox = document.getElementById("persistent-cover-box");

    if (!coverBox) {
      coverBox = document.createElement("div");
      coverBox.id = "persistent-cover-box";
      coverBox.className = "fixed bottom-20 right-4 bg-gray-900 shadow-lg rounded-lg overflow-hidden border border-gray-700 z-50";
      coverBox.style.width = "200px";
      coverBox.style.height = "200px";

      coverBox.innerHTML = `
        <div class="relative w-full h-full">
          <img id="cover-img" src="${current.cover}" alt="cover" class="w-full h-full object-cover"/>
          <button id="cover-close" class="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 rounded">✖</button>
        </div>
      `;

      document.body.appendChild(coverBox);
      
      // Make cover box draggable
      let isDragging = false;
      let dragStartX, dragStartY;
      let initialX, initialY;

      coverBox.addEventListener('mousedown', (e) => {
        // Don't start dragging if clicking the close button
        if (e.target.id === 'cover-close') return;
        
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const rect = coverBox.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        
        coverBox.style.position = 'fixed';
        coverBox.style.zIndex = '1000';
        coverBox.style.cursor = 'move';
        
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        const newX = Math.max(0, Math.min(window.innerWidth - 200, initialX + deltaX));
        const newY = Math.max(0, Math.min(window.innerHeight - 200, initialY + deltaY));
        
        coverBox.style.left = newX + 'px';
        coverBox.style.top = newY + 'px';
        coverBox.style.right = 'auto';
        coverBox.style.bottom = 'auto';
      });

      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          coverBox.style.zIndex = '50';
          coverBox.style.cursor = 'default';
        }
      });

      coverBox.querySelector("#cover-close").addEventListener("click", () => {
        coverBox.remove();
      });
    } else {
      const img = coverBox.querySelector("#cover-img");
      if (img) img.src = current.cover;
    }

  }

    let coverBox = document.getElementById("persistent-cover-box");

    if (!coverBox) {
      coverBox = document.createElement("div");
      coverBox.id = "persistent-cover-box";
      coverBox.className = "fixed bottom-20 right-4 bg-gray-900 shadow-lg rounded-lg overflow-hidden border border-gray-700 z-50";
      coverBox.style.width = "200px";
      coverBox.style.height = "200px";

      coverBox.innerHTML = `
        <div class="relative w-full h-full">
          <img id="cover-img" src="${current.cover}" alt="cover" class="w-full h-full object-cover"/>
          <button id="cover-close" class="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 rounded z-10">✖</button>
        </div>
      `;

      // Make cover box draggable
      let isDragging = false;
      let dragStartX, dragStartY;
      let initialX, initialY;

      coverBox.addEventListener('mousedown', (e) => {
        // Don't start dragging if clicking the close button
        if (e.target.id === 'cover-close') return;
        
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        
        const rect = coverBox.getBoundingClientRect();
        initialX = rect.left;
        initialY = rect.top;
        
        coverBox.style.position = 'fixed';
        coverBox.style.zIndex = '1000';
        coverBox.style.cursor = 'move';
        
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        e.preventDefault();
        
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;
        
        const newX = Math.max(0, Math.min(window.innerWidth - 200, initialX + deltaX));
        const newY = Math.max(0, Math.min(window.innerHeight - 200, initialY + deltaY));
        
        coverBox.style.left = newX + 'px';
        coverBox.style.top = newY + 'px';
        coverBox.style.right = 'auto';
        coverBox.style.bottom = 'auto';
      });

      document.addEventListener('mouseup', () => {
        if (isDragging) {
          isDragging = false;
          coverBox.style.zIndex = '50';
          coverBox.style.cursor = 'default';
        }
      });

      document.body.appendChild(coverBox);

      coverBox.querySelector("#cover-close").addEventListener("click", () => {
        coverBox.remove();
      });
    } else {
      const img = coverBox.querySelector("#cover-img");
      if (img) {
        img.src = current.cover;
        img.alt = current.album;
      }
    }

  bar.querySelector("#bar-track-title").textContent = current.title;
  bar.querySelector("#bar-track-meta").textContent = `${current.album} • ${current.artist}`;
  const playIcon = bar.querySelector("#albumPlayIcon");
  const pauseIcon = bar.querySelector("#albumPauseIcon");

  // Ensure albumPlayer.paused is synced with actual audio state
  if (albumPlayer.audio) {
    albumPlayer.paused = albumPlayer.audio.paused;
  }

  if (albumPlayer.paused) {
    playIcon.style.display = "block";
    pauseIcon.style.display = "none";
  } else {
    playIcon.style.display = "none";
    pauseIcon.style.display = "block";
  }

  const barMeta = bar.querySelector("#bar-track-meta");
  if (barMeta) {
    barMeta.innerHTML = "";

    const albumEl = document.createElement("span");
    albumEl.textContent = current.album;
    albumEl.className = "hover:underline cursor-pointer";
    albumEl.onclick = () => {
      history.pushState({}, "", '/album/' + slugify(current.album));
      renderCurrentAlbumView();
    };

    const separator = document.createTextNode(" • ");
    const artistText = document.createTextNode(current.artist);

    barMeta.appendChild(albumEl);
    barMeta.appendChild(separator);
    barMeta.appendChild(artistText);
  }

}

function toggleAlbumPlayPause(event) {
  if (event) event.stopPropagation();
  const audio = albumPlayer.audio;
  if (!audio) return;

  if (audio.paused) {
    audio.play();
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    if (speedSlider && speedValue) {
      const rate = parseFloat(speedSlider.value);
      updateSpeedFill(speedSlider, speedValue);
      audio.playbackRate = rate;
    }
    albumPlayer.paused = false;
  } else {
    audio.pause();
    albumPlayer.paused = true;
  }

  // Force update the persistent player icons
  updatePersistentPlayer();
  saveAlbumPlayerState();
  if (isOnAlbumPage()) renderCurrentAlbumView();
}

function cycleAlbumLoopMode() {
  albumPlayer.loopMode = (albumPlayer.loopMode + 1) % 3;
  updatePersistentPlayer();
  saveAlbumPlayerState();

  const loopBtn = document.getElementById("persistentLoopBtn");
  if (loopBtn) updateLoopButtonColor(loopBtn, albumPlayer.loopMode);

  if (isOnAlbumPage()) renderCurrentAlbumView();
}

function albumNextTrack(event) {
  if (event) event.stopPropagation();
  if (albumPlayer.currentIndex + 1 < albumPlayer.tracks.length) {
    albumPlayer.currentIndex++;
    if (isOnAlbumPage()) renderCurrentAlbumView();
    startAlbumAudio();
    updatePersistentPlayer();
    saveAlbumPlayerState();
  }
  const volume = parseFloat(volumeSlider.value);
  audio.volume = volume;
  updateVolumeFill();
}

function albumPrevTrack(event) {
  if (event) event.stopPropagation();
  if (albumPlayer.currentIndex > 0) {
    albumPlayer.currentIndex--;
    if (isOnAlbumPage()) renderCurrentAlbumView();
    startAlbumAudio();
    updatePersistentPlayer();
    saveAlbumPlayerState();
  }
  const volume = parseFloat(volumeSlider.value);
  audio.volume = volume;
  updateVolumeFill();
}

const trackDurationMap = {};

function setupAudioPlayer(track) {
  const audio = document.getElementById("audio");
  const playPause = document.getElementById("btnPlayPause");
  const iconPlay = document.getElementById("iconPlay");
  const iconPause = document.getElementById("iconPause");
  const progressBar = document.getElementById("progressBar");
  const timestamp = document.getElementById("timestamp");
  const loopBtn = document.getElementById("btnLoop");
  const volumeSlider = document.getElementById("volumeSlider");
  let defaultVolume = getSavedVolume();
  volumeSlider.value = defaultVolume;
  audio.volume = defaultVolume;
  const volumeIcon = document.getElementById("volumeIcon");
  const albumAudio = albumPlayer.audio;
  localStorage.setItem('lastListenedArtist', track.artist);
  const isShared = albumAudio &&
  albumPlayer.tracks.length === 1 &&
  isSameTrack(albumPlayer.tracks[0], track);
  currentlyPlayingSlug = track.slug;
  const speedBtn = document.getElementById("speedBtn");
  const speedModal = document.getElementById("speedModal");
  const speedSlider = document.getElementById("speedSlider");
  const speedValue = document.getElementById("speedValue");
  audio.preservesPitch = false;
  audio.mozPreservesPitch = false;
  audio.webkitPreservesPitch = false;   

  // Check if audio file exists
  const audioExists = track.file && track.file !== '';
  
  // Disable player controls if no audio file
  if (!audioExists) {
    playPause.disabled = true;
    playPause.style.opacity = '0.5';
    playPause.style.cursor = 'not-allowed';
    progressBar.disabled = true;
    progressBar.style.opacity = '0.5';
    loopBtn.disabled = true;
    loopBtn.style.opacity = '0.5';
    speedBtn.disabled = true;
    speedBtn.style.opacity = '0.5';
    volumeSlider.disabled = true;
    volumeSlider.style.opacity = '0.5';
    timestamp.textContent = 'No audio file';
    return; // Exit early if no audio
  }

  function updateSpeedFill(slider, valueEl) {
    const min = parseFloat(slider.min) || 0.5;
    const max = parseFloat(slider.max) || 2;
    const val = parseFloat(slider.value);
    const percent = ((val - min) / (max - min)) * 100;
    const color = getProgressBarColor();
    slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
    if (valueEl) valueEl.textContent = val.toFixed(3) + "x";
  }

  function updateVolumeFill() {
    const percent = parseFloat(volumeSlider.value) * 100;
    const color = getProgressBarColor();
    volumeSlider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
  }
  updateVolumeFill();

  volumeSlider.addEventListener("input", () => {
    const volume = parseFloat(volumeSlider.value);
    audio.volume = volume;
    updateVolumeFill();
    saveVolume(volume);
  });

  let rafId = null;

  // key: audioplayer
  playPause.addEventListener("click", () => {
    const isShared = albumPlayer.tracks.length === 1 && isSameTrack(albumPlayer.tracks[0], track);
    const albumAudio = albumPlayer.audio;

    // If this is a shared track with album player, delegate to album player
    if (isShared && albumAudio) {
      if (albumAudio.paused) {
        albumAudio.play();
        albumPlayer.paused = false;
        // Track the play for shared album track
        trackPlay(slugify(track.artist), slugify(track.title));
      } else {
        albumAudio.pause();
        albumPlayer.paused = true;
      }

      iconPlay.style.display = albumAudio.paused ? "block" : "none";
      iconPause.style.display = albumAudio.paused ? "none" : "block";

      updatePersistentPlayer();
      renderCurrentAlbumView();
      return;
    }

    // Stop album player and hide persistent bar for independent single track playback
    stopAlbumAudio();
    const bar = document.getElementById("persistent-album-bar");
    let coverBox = document.getElementById("persistent-cover-box");
    if (bar) bar.classList.add("hide");
    if (coverBox) coverBox.remove();

    // Handle single track playback
    if (audio.paused) {
      const rate = parseFloat(speedSlider.value) || savedSpeed || 1.0;
      audio.playbackRate = rate;
      audio.preservesPitch = false;
      audio.mozPreservesPitch = false;
      audio.webkitPreservesPitch = false;
      
      audio.play();
      // Track the play for single track
      trackPlay(slugify(track.artist), slugify(track.title));
      updateSpeedFill(speedSlider, speedValue);
      iconPlay.style.display = "none";
      iconPause.style.display = "block";
    } else {
      audio.pause();
      iconPlay.style.display = "block";
      iconPause.style.display = "none";
      cancelAnimationFrame(rafId);
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
      const color = getProgressBarColor();
      const newTime = (percent / 100) * audio.duration;
      audio.currentTime = newTime;
      progressBar.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
      
      timestamp.textContent = `${formatTime(newTime)} / ${formatTime(audio.duration)}`;

      const albumProgress = document.getElementById("albumProgress");
      const albumTimestamp = document.getElementById("albumTimestamp");
      if (albumProgress) {
        albumProgress.value = percent;
        albumProgress.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
      }
      if (albumTimestamp) {
        albumTimestamp.textContent = `${formatTime(newTime)} / ${formatTime(audio.duration)}`;
      }
    }
  });

  loopBtn.addEventListener("click", () => {
    audio.loop = !audio.loop;
    loopBtn.setAttribute("aria-pressed", audio.loop);
    updateLoopButtonColor(loopBtn, audio.loop ? 2 : 0);
  });

  audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
      const percent = (audio.currentTime / audio.duration) * 100;
      const color = getProgressBarColor();
      progressBar.value = percent;
      progressBar.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
      timestamp.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
  });

  track.volumeVisible = false;
  const volumeContainer = volumeIcon.parentElement;

  volumeIcon.addEventListener("click", () => {
    track.volumeVisible = !track.volumeVisible;
    volumeSlider.style.display = track.volumeVisible ? "block" : "none";
    volumeContainer.classList.toggle("active", track.volumeVisible);
  });

  volumeContainer.addEventListener("mouseenter", () => {
    if (!track.volumeVisible) {
      volumeSlider.style.display = "block";
    }
  });

  volumeContainer.addEventListener("mouseleave", () => {
    if (!track.volumeVisible) {
      volumeSlider.style.display = "none";
    }
  });


  function updateVolumeFill() {
    const percent = parseFloat(volumeSlider.value) * 100;
    const color = getProgressBarColor();
    volumeSlider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
  }

  volumeSlider.addEventListener("input", () => {
    const volume = parseFloat(volumeSlider.value);
    audio.volume = volume;
    updateVolumeFill();
  });

  audio.volume = parseFloat(volumeSlider.value);
  updateVolumeFill();

  if (speedBtn && speedModal && speedSlider && speedValue) {
    let savedSpeed = getSavedSpeed();
    audio.playbackRate = savedSpeed;
    speedSlider.value = savedSpeed;
    speedValue.textContent = savedSpeed.toFixed(3) + "x";
    updateSpeedFill(speedSlider, speedValue);

    speedSlider.addEventListener("input", () => {
      const rate = parseFloat(speedSlider.value);
      audio.playbackRate = rate;
      saveSpeed(rate);
      speedValue.textContent = rate.toFixed(3) + "x";
      updateSpeedFill(speedSlider, speedValue);
    });

    speedBtn.addEventListener("click", () => {
      speedModal.classList.toggle("hidden");
      speedBtn.classList.toggle("active");
    });

    // Initialize speed slider appearance
    updateSpeedFill(speedSlider, speedValue);
  }

}

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

let lastSearchQuery = "";

document.addEventListener("DOMContentLoaded", async () => {
  await loadTracks();
  await checkAdmin();
  
  // Always try to restore the persistent player first
  restorePersistentPlayer();
  
  await router();

  const searchToggle = document.getElementById("search-toggle");
  const searchBar = document.getElementById("search-bar");
  const searchInput = document.getElementById("search-input");

  if (searchToggle && searchBar) {
    searchToggle.addEventListener("click", () => {
      if (searchBar.style.display === "none") {
        searchBar.style.display = "flex";
        searchInput.value = lastSearchQuery || "";
        searchInput.focus();
      } else {
        searchBar.style.display = "none";
      }
    });
  }
});

function handleSearch(e) {
  e.preventDefault();
  const input = document.getElementById("search-input");
  const query = input.value.trim();
  lastSearchQuery = query;
  if (!query) return;
  renderSearchResults(query);
}

async function searchUsers(query) {
  try {
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('Failed to search users');
    }
    return await response.json();
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

function renderSearchResults(query) {
  const q = query.toLowerCase();
  const matchingTracks = tracks.filter(
    t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      (t.album || "").toLowerCase().includes(q)
  );

  const albumMap = new Map();
  tracks.forEach(t => {
    if (
      t.album &&
      (t.album.toLowerCase().includes(q) || t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q))
    ) {
      const slug = slugify(t.album);
      if (!albumMap.has(slug)) albumMap.set(slug, t);
    }
  });

  const artistSet = new Set(
    tracks
      .filter(t => t.artist.toLowerCase().includes(q))
      .map(t => t.artist)
  );

  // Search for users
  searchUsers(query).then(matchingUsers => {
    let html = `<h2 class="text-2xl font-bold mb-4">Search Results for "${query}"</h2>`;

    if (matchingTracks.length) {
      html += `<h3 class="text-xl font-semibold mt-4 mb-2">Tracks</h3>
        <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${matchingTracks.map(renderTrackCard).join("")}
        </div>`;
    }

    if (albumMap.size) {
      html += `<h3 class="text-xl font-semibold mt-6 mb-2">Albums</h3>
        <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${[...albumMap.values()].map(track =>
          `<div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200 albumlink">
            <img src="${track.cover}" alt="${track.album}" class="w-full h-32 object-cover rounded mb-2" />
            <div class="font-semibold text-lg cursor-pointer hover:underline" onclick="navigateTo('/album/${slugify(track.album)}')">${track.album}</div>
          </div>`
        ).join("")}
        </div>`;
    }

    if (artistSet.size) {
      html += `<h3 class="text-xl font-semibold mt-6 mb-2">Artists</h3>
        <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${[...artistSet].map(artist =>
          `<div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200 artistlink">
            <div class="font-semibold text-lg cursor-pointer hover:underline" onclick="navigateTo('/${slugify(artist)}')">${artist}</div>
          </div>`
        ).join("")}
        </div>`;
    }

    if (matchingUsers.length) {
      html += `<h3 class="text-xl font-semibold mt-6 mb-2">Users</h3>
        <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${matchingUsers.map(user => {
          const gradientClass = `profile-gradient-${user.selectedGradient || 1}`;
          const adminBadge = user.isAdmin ? ' <span class="text-xs bg-red-500 text-white px-1 py-0.5 rounded ml-1">ADMIN</span>' : '';
          return `<div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200 track">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 ${gradientClass} rounded-full flex items-center justify-center text-white font-bold text-lg">
                ${user.username.charAt(0).toUpperCase()}
              </div>
              <div class="flex-1">
                <div class="font-semibold cursor-pointer hover:underline" onclick="navigateTo('/profile/${user.id}')">${escapeHtml(user.username)}${adminBadge}</div>
                ${user.bio ? `<div class="text-sm text-gray-400 mt-1 line-clamp-2">${escapeHtml(user.bio)}</div>` : ''}
              </div>
            </div>
          </div>`;
        }).join("")}
        </div>`;
    }

    if (!matchingTracks.length && !albumMap.size && !artistSet.size && !matchingUsers.length) {
      html += `<p class="text-gray-400 mt-6">No results found.</p>`;
    }

    html += `<br><br>`

    getApp().innerHTML = html;
  }).catch(error => {
    console.error('Error searching users:', error);
    // Fallback to original results without users
    let html = `<h2 class="text-2xl font-bold mb-4">Search Results for "${query}"</h2>`;

    if (matchingTracks.length) {
      html += `<h3 class="text-xl font-semibold mt-4 mb-2">Tracks</h3>
        <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${matchingTracks.map(renderTrackCard).join("")}
        </div>`;
    }

    if (albumMap.size) {
      html += `<h3 class="text-xl font-semibold mt-6 mb-2">Albums</h3>
        <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${[...albumMap.values()].map(track =>
          `<div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200 albumlink">
            <img src="${track.cover}" alt="${track.album}" class="w-full h-32 object-cover rounded mb-2" />
            <div class="font-semibold text-lg cursor-pointer hover:underline" onclick="navigateTo('/album/${slugify(track.album)}')">${track.album}</div>
          </div>`
        ).join("")}
        </div>`;
    }

    if (artistSet.size) {
      html += `<h3 class="text-xl font-semibold mt-6 mb-2">Artists</h3>
        <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${[...artistSet].map(artist =>
          `<div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200 artistlink">
            <div class="font-semibold text-lg cursor-pointer hover:underline" onclick="navigateTo('/${slugify(artist)}')">${artist}</div>
          </div>`
        ).join("")}
        </div>`;
    }

    if (!matchingTracks.length && !albumMap.size && !artistSet.size) {
      html += `<p class="text-gray-400 mt-6">No results found.</p>`;
    }

    html += `<br><br>`

    getApp().innerHTML = html;
  });
}

function getProgressBarColor() {
  if (document.body.classList.contains('theme-midnight-blurple')) {
    return '#9b89fd';
  }
  if (document.body.classList.contains('theme-strawberry-lemonade')) {
    return '#e84c8c';
  }
  if (document.body.classList.contains('theme-ocean-breeze')) {
    return '#20B2AA';
  }
  if (document.body.classList.contains('theme-sunset-glow')) {
    return '#FF6347';
  }
  if (document.body.classList.contains('theme-forest-night')) {
    return '#32CD32';
  }
  if (document.body.classList.contains('theme-lavender-dreams')) {
    return '#9370DB';
  }
  // fallback to default blue
  return '#3b82f6';
}

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/'/g, '')          // remove apostrophes
    .replace(/[^\w]+/g, '-')   // replace non-word chars with dash
    .replace(/^-+|-+$/g, '');  // trim starting/ending dashes
}

async function deleteTrack(artistSlug, songSlug, audioFile) {
  try {
    const resTracks = await fetch("/api/tracks");
    
    if (!resTracks.ok) {
      throw new Error(`HTTP error! status: ${resTracks.status}`);
    }
    
    const contentType = resTracks.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response is not JSON");
    }
    
    const allTracks = await resTracks.json();
    function slugify(str) {
      return str.toLowerCase().replace(/'/g, '').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');
    }
    const track = allTracks.find(
      t => slugify(t.artist) === artistSlug && slugify(t.title) === songSlug
    );
    if (!track) { alert("Track not found!"); return; }

    const res = await fetch(
      `/api/tracks/${artistSlug}/${songSlug}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      alert("Track deleted!");
      tracks = tracks.filter(
        t => !(slugify(t.artist) === artistSlug && slugify(t.title) === songSlug)
      );
      navigateTo(`/`);
    } else {
      const error = await res.text();
      alert(`Delete failed: ${error}`);
    }
  } catch (error) {
    alert(`Delete error: ${error.message}`);
  }
}

async function checkAdmin() {
  try {
    const res = await fetch("/api/auth-status");
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response is not JSON");
    }
    
    const data = await res.json();
    const isAdmin = data.isAdmin;
    const isLoggedIn = data.isLoggedIn;
    const user = data.user;

  // Update global state
  window.isLoggedIn = isLoggedIn;
  window.currentUser = user;
  window.isAdmin = isAdmin;

  const loginButton = document.getElementById("login-button");
  if (loginButton) {
    loginButton.style.display = isLoggedIn ? "none" : "block";
  }

  const registerButton = document.getElementById("register-button");
  if (registerButton) {
    registerButton.style.display = isLoggedIn ? "none" : "block";
  }

  const logoutButton = document.getElementById("logout-button");
  if (logoutButton) {
    logoutButton.style.display = isLoggedIn ? "block" : "none";
  }

  // Update logout button text to show username if logged in as user
  if (logoutButton && isLoggedIn && user && !isAdmin) {
    logoutButton.textContent = `Log Out (${user.username})`;
  } else if (logoutButton && isAdmin) {
    logoutButton.textContent = "Log Out";
  }

  const addSongLink = document.getElementById("add-song-link");
  if (addSongLink) {
    addSongLink.style.display = isAdmin ? "inline-block" : "none";
  }

  // Add admin panel link for admins
  updateAdminPanelLink(isAdmin);

  // Add profile link for logged in users
  updateProfileLink(isLoggedIn, user);

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.style.display = isAdmin ? "inline-block" : "none";
  });
  } catch (error) {
    console.error('Error checking admin status:', error);
    // Set default values if auth check fails
    window.isLoggedIn = false;
    window.currentUser = null;
    window.isAdmin = false;
  }
}

function updateAdminPanelLink(isAdmin) {
  let adminLink = document.getElementById("admin-panel-link");
  
  if (isAdmin) {
    if (!adminLink) {
      // Create admin panel link if it doesn't exist
      adminLink = document.createElement("a");
      adminLink.id = "admin-panel-link";
      adminLink.href = "/admin.html";
      adminLink.className = "bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded navbutton";
      adminLink.textContent = "Admin Panel";
      
      // Insert before add-song link (first in the button group)
      const addSongLink = document.getElementById("add-song-link");
      if (addSongLink && addSongLink.parentNode) {
        addSongLink.parentNode.insertBefore(adminLink, addSongLink);
      }
    }
    
    adminLink.style.display = "inline-block";
  } else if (adminLink) {
    adminLink.style.display = "none";
  }
}

function updateProfileLink(isLoggedIn, user) {
  let profileLink = document.getElementById("profile-link");
  
  if (isLoggedIn && user) {
    if (!profileLink) {
      // Create profile link if it doesn't exist
      profileLink = document.createElement("button");
      profileLink.id = "profile-link";
      profileLink.className = "bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded navbutton";
      
      // Insert before add-song link (after admin panel)
      const addSongLink = document.getElementById("add-song-link");
      if (addSongLink && addSongLink.parentNode) {
        addSongLink.parentNode.insertBefore(profileLink, addSongLink);
      }
    }
    
    // Update text content to show username
    profileLink.textContent = user.username;
    profileLink.onclick = () => navigateTo(`/profile/${user.id}`);
    profileLink.style.display = "inline-block";
  } else if (profileLink) {
    profileLink.style.display = "none";
  }
}


function showLogin() {
  // Navigate to login page instead of showing inline form
  navigateTo("/login");
}

async function submitLogin() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, isAdminLogin: true })
    });

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response is not JSON");
    }

    const result = await res.json();

    if (result.success) {
      alert("Logged in as admin!");
      document.getElementById("login-box").style.display = "none";
      await checkAdmin();
      navigateTo("/");
    } else {
      alert(result.message || "Login failed.");
    }
  } catch (error) {
    console.error('Login error:', error);
    alert("Login failed due to network error.");
  }
}

async function submitUserLogin(username, password) {
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, isAdminLogin: false })
    });

    const result = await res.json();
    return result;
  } catch (error) {
    console.error('User login error:', error);
    return { success: false, message: "Login failed due to network error." };
  }
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  localStorage.removeItem("isLoggedIn");
  window.isLoggedIn = false;
  window.currentUser = null;
  await checkAdmin();
  navigateTo("/");
}

async function checkAdminAndRedirect() {
  try {
    const res = await fetch("/api/auth-status");
    
    if (!res.ok) {
      if (res.status === 403) {
        const errorData = await res.json();
        if (errorData.banned) {
          alert('Your account has been banned. You have been logged out.');
          localStorage.removeItem("isLoggedIn");
          localStorage.removeItem("user");
          window.location.href = "/";
          return;
        }
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response is not JSON");
    }
    
    const data = await res.json();
    if (data.banned) {
      alert('Your account has been banned. You have been logged out.');
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("user");
      window.location.href = "/";
      return;
    }
    
    if (!data.isAdmin) {
      alert("You must be an admin to access this page.");
      window.location.href = "/";
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
    alert("Error checking admin status. Redirecting to home page.");
    window.location.href = "/";
  }
}

// Global function to handle API responses and check for bans
async function handleApiResponse(response) {
  if (response.status === 403) {
    try {
      const data = await response.json();
      if (data.banned) {
        alert('Your account has been banned. You have been logged out.');
        localStorage.removeItem("isLoggedIn");
        localStorage.removeItem("user");
        isLoggedIn = false;
        navigateTo('/');
        return null;
      }
    } catch (e) {
      // If we can't parse JSON, continue with original response
    }
  }
  return response;
}

// Activity tracking functions
async function trackPlay(artistSlug, songSlug) {
  try {
    // Only track if user is logged in
    const authStatus = await getAuthStatus();
    if (!authStatus.isLoggedIn && !authStatus.isAdmin) {
      return; // Don't track for anonymous users
    }

    const response = await fetch('/api/activity/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistSlug, songSlug })
    });

    if (response.ok) {
      const result = await response.json();
      if (result.alreadyPlayed) {
        console.log('Play not counted - already played this session');
      } else if (result.newPlay) {
        console.log('Play tracked successfully');
      }
    } else {
      console.log('Failed to track play:', await response.text());
    }
  } catch (error) {
    console.log('Error tracking play:', error);
  }
}

async function loadTracks() {
  try {
    const res = await fetch("/api/tracks");
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const contentType = res.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Response is not JSON");
    }
    
    tracks = await res.json();

    tracks = tracks.map(t => ({
      ...t,
      slugArtist: slugify(t.artist),
      slugTitle: slugify(t.title),
      createdAt: t.createdAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error('Error loading tracks:', error);
    tracks = []; // Initialize to empty array if loading fails
  }
}

window.addEventListener("popstate", router);

// --- Comments Helpers ---
async function getAuthStatus() {
  try {
    const r = await fetch('/api/auth-status');
    return await r.json();
  } catch {
    return { isLoggedIn: false, isAdmin: false, user: null };
  }
}

function buildCommentItem(c, currentUser) {
  const initials = (c.username || '?').substring(0,2).toUpperCase();
  const profileHref = `/profile/${c.userId}`;
  const date = new Date(c.createdAt).toLocaleString();
  const isOwner = currentUser && currentUser.user && currentUser.user.id === c.userId;
  const isAdmin = currentUser && currentUser.isAdmin;
  const canEdit = !!(isOwner || isAdmin);
  const editedBadge = c.editedAt ? `<span class="ml-2 text-xs text-gray-400">(edited)</span>` : '';
  
  // Use the user's selected gradient, defaulting to gradient 1
  const gradientClass = `profile-gradient-${c.selectedGradient || 1}`;
  
  return `
    <div class="track p-4 rounded" data-comment-id="${c.id}">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-8 h-8 rounded-full ${gradientClass} flex items-center justify-center text-xs font-bold text-white">${initials}</div>
        <div class="flex-1">
          <a class="hover:underline profilelink cursor-pointer" href="${profileHref}" onclick="navigateTo('${profileHref}'); return false;">${c.username}</a>
          <div class="text-xs text-gray-400">${date} ${editedBadge}</div>
        </div>
        ${canEdit ? `<div class="flex gap-2"> 
          <button class="text-blue-400 hover:underline text-sm edit-comment-btn">Edit</button>
          <button class="text-red-400 hover:underline text-sm delete-comment-btn">Delete</button>
        </div>` : ''}
      </div>
      <div class="whitespace-pre-wrap comment-text">${escapeHtml(c.text)}</div>
    </div>
  `;
}

function escapeHtml(str) {
  if (str == null) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function initComments(track) {
  const artistSlug = slugify(track.artist);
  const songSlug = slugify(track.title);
  const listEl = document.getElementById('comments-list');
  const formWrap = document.getElementById('comment-form-wrapper');
  const form = document.getElementById('comment-form');
  const input = document.getElementById('comment-input');
  const errorEl = document.getElementById('comment-error');

  // Load auth and existing comments
  const auth = await getAuthStatus();
  try {
    const r = await fetch(`/api/comments/${artistSlug}/${songSlug}`);
    const data = await r.json();
    if (data && data.success && Array.isArray(data.comments)) {
      listEl.innerHTML = data.comments.map(c => buildCommentItem(c, auth)).join('');
    } else {
      listEl.innerHTML = '';
    }
  } catch (e) {
    listEl.innerHTML = '';
  }

  // Show form only if authenticated
  if (auth && (auth.isLoggedIn || auth.isAdmin)) {
    formWrap.classList.remove('hidden');
  } else {
    formWrap.classList.add('hidden');
    return;
  }

  // Anti-spam: disable submit while posting; also debounce rapid clicks
  let posting = false;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (posting) return;
    const text = input.value.trim();
    if (!text) return;
    posting = true;
    errorEl.classList.add('hidden');
    const btn = document.getElementById('comment-submit');
    btn.disabled = true;
    try {
      const r = await fetch(`/api/comments/${artistSlug}/${songSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      
      // Check for ban status
      const handledResponse = await handleApiResponse(r);
      if (!handledResponse) return; // User was banned and redirected
      
      const data = await handledResponse.json();
      if (data && data.success && data.comment) {
        // Clear form and prepend new comment
        input.value = '';
  const item = buildCommentItem(data.comment, auth);
  listEl.insertAdjacentHTML('afterbegin', item);
  wireEditButtons();
  wireDeleteButtons();
      } else {
        errorEl.textContent = (data && data.error) ? data.error : (data && data.message) ? data.message : 'Failed to post comment';
        errorEl.classList.remove('hidden');
      }
    } catch (err) {
      errorEl.textContent = 'You have been muted. Cannot post comments at this time.';
      errorEl.classList.remove('hidden');
    } finally {
      // Small delay to avoid spam clicking
      setTimeout(() => {
        posting = false;
        btn.disabled = false;
      }, 1200);
    }
  });

  // Wire up edit buttons for existing comments
  function wireEditButtons() {
    const buttons = listEl.querySelectorAll('.edit-comment-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const container = btn.closest('[data-comment-id]');
        const cid = container?.getAttribute('data-comment-id');
        const textEl = container?.querySelector('.comment-text');
        if (!cid || !textEl) return;

        // If already editing, ignore
        if (container.querySelector('textarea.comment-edit-input')) return;

        const originalText = textEl.textContent || '';
        // Build inline editor
        const editor = document.createElement('div');
        editor.className = 'mt-2 space-y-2';
        editor.innerHTML = `
          <textarea class="w-full px-3 py-2 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 comment-edit-input" rows="3" maxlength="500">${originalText}</textarea>
          <div class="flex gap-2">
            <button class="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-white save-edit-btn">Save</button>
            <button class="bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-white cancel-edit-btn">Cancel</button>
            <span class="text-red-400 text-sm edit-error hidden"></span>
          </div>
        `;
        // Swap display
        textEl.style.display = 'none';
        textEl.after(editor);

        const saveBtn = editor.querySelector('.save-edit-btn');
        const cancelBtn = editor.querySelector('.cancel-edit-btn');
        const inputEl = editor.querySelector('.comment-edit-input');
        const errEl = editor.querySelector('.edit-error');

        cancelBtn.addEventListener('click', () => {
          editor.remove();
          textEl.style.display = '';
        });

        let saving = false;
        saveBtn.addEventListener('click', async () => {
          if (saving) return; saving = true; saveBtn.disabled = true;
          errEl.classList.add('hidden');
          const newText = inputEl.value.trim();
          if (!newText) { errEl.textContent = 'Comment cannot be empty'; errEl.classList.remove('hidden'); saveBtn.disabled = false; saving = false; return; }
          try {
            const resp = await fetch(`/api/comments/${artistSlug}/${songSlug}/${cid}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: newText })
            });
            const d = await resp.json();
            if (d && d.success && d.comment) {
              textEl.textContent = d.comment.text;
              editor.remove();
              textEl.style.display = '';
              // Update edited badge if present
              const meta = container.querySelector('.text-xs.text-gray-400');
              if (meta && !/\(edited\)/.test(meta.textContent)) {
                meta.textContent = `${meta.textContent} (edited)`;
              }
            } else {
              errEl.textContent = (d && d.message) ? d.message : 'Failed to save edit';
              errEl.classList.remove('hidden');
            }
          } catch (_) {
            errEl.textContent = 'Network error while saving';
            errEl.classList.remove('hidden');
          } finally {
            saveBtn.disabled = false; saving = false;
          }
        });
      });
    });
  }

  wireEditButtons();
  // Wire up delete buttons
  function wireDeleteButtons() {
    const buttons = listEl.querySelectorAll('.delete-comment-btn');
    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const container = btn.closest('[data-comment-id]');
        const cid = container?.getAttribute('data-comment-id');
        if (!cid) return;
        btn.disabled = true;
        try {
          const resp = await fetch(`/api/comments/${artistSlug}/${songSlug}/${cid}`, { method: 'DELETE' });
          const d = await resp.json();
          if (d && d.success) {
            container.remove();
          } else {
            alert((d && d.message) ? d.message : 'Failed to delete comment');
          }
        } catch (_) {
          alert('Network error while deleting');
        } finally {
          btn.disabled = false;
        }
      });
    });
  }
  wireDeleteButtons();
}
