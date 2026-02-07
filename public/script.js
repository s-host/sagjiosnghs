function getApp() {
  return document.getElementById("app");
}

function slugify(str) {
  return str.toLowerCase().replace(/[^\w]+/g, "-");
}

// Multi-artist support: parse artists separated by semicolons
function parseArtists(artistString) {
  if (!artistString) return [];
  return artistString.split(';').map(a => a.trim()).filter(a => a.length > 0);
}

// Check if a track has a specific artist (supports multi-artist tracks)
function trackHasArtist(track, artistSlug) {
  const artists = parseArtists(track.artist);
  return artists.some(a => slugify(a) === artistSlug);
}

// Get the display name for an artist slug from a track
function getArtistDisplayName(track, artistSlug) {
  const artists = parseArtists(track.artist);
  const match = artists.find(a => slugify(a) === artistSlug);
  return match || artists[0] || track.artist;
}

// Render artists as clickable links
function renderArtistLinks(artistString, separator = ', ') {
  const artists = parseArtists(artistString);
  if (artists.length === 0) return artistString;
  return artists.map(artist => 
    `<span class="link-hover" onclick="navigateTo('/${slugify(artist)}')">${artist}</span>`
  ).join(separator);
}

// Render verification badge HTML
function renderVerifiedBadge(isVerified, small = false) {
  if (!isVerified) return '';
  const sizeClass = small ? 'verified-badge-small' : '';
  return `<span class="verified-badge ${sizeClass}" title="Verified User">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  </span>`;
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

function updateUIForAdmin(isAdmin, isVerified = false) {
  document.getElementById('login-button').style.display = isAdmin ? 'none' : 'inline-block';
  document.getElementById('logout-button').style.display = isAdmin ? 'inline-block' : 'none';
  document.getElementById('add-song-link').style.display = (isAdmin || isVerified) ? 'inline-block' : 'none';
  document.getElementById('login-box').style.display = 'none';
}

let isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
let currentlyPlayingSlug = null;
let savedSpeed = 1.0;
let tracks = []; // Global tracks array
// reposts for current logged in user
window.currentUserReposts = [];

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

  // Playlist page
  if (segments[0] === "playlist" && segments[1]) {
    return renderPlaylist(segments[1]);
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
        <h2 class="section-title">From ${lastArtist}</h2>
        <div class="track-grid">
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
        <h2 class="section-title">
          <span class="link-hover" onclick="navigateTo('/section/${key}')">${label}</span>
        </h2>
        <div class="track-grid">
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
      <h2 class="page-title">${category.label}</h2>
      <div class="track-grid">
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
  const artistSlug = slugify(parseArtists(track.artist)[0] || track.artist);
  const songSlug = slugify(track.title);
  const truncatedTitle = truncateTitle(track.title);
  
  // Render all artists as clickable links
  const artistLinks = renderArtistLinks(track.artist);

  return `
    <div class="track-card track">
      <button class="track-card-btn playlist-menu-btn" 
              onclick="event.stopPropagation(); togglePlaylistMenu(this, '${artistSlug}', '${songSlug}', '${escapeHtml(track.title)}', '${escapeHtml(track.artist)}')"
              aria-label="Add to playlist">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-more-vertical"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
      <img src="${track.cover}" alt="${track.album}" class="track-cover" />
      <h3 class="track-title-card" onclick="navigateTo('/${artistSlug}/${songSlug}')" title="${track.title}">
        ${truncatedTitle}
      </h3>
      <p class="track-meta-card">
        ${artistLinks}
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
    t => trackHasArtist(t, artistSlug) && slugify(t.title) === songSlug
  );

  if (!track) return renderNotFound();

  track.slugArtist = artistSlug;
  track.slugTitle = songSlug;

  const audioFileProvided = track.file && track.file !== '';

  const artistLinks = renderArtistLinks(track.artist);
  
  getApp().innerHTML = `
    <div class="max-w-xl mx-auto bg-gray-800 p-6 rounded-lg shadow-lg space-y-4 track">
      <img src="${track.cover}" alt="${track.album}" class="w-full h-full object-cover rounded"/>
      <h2 class="text-2xl font-bold">${track.title}</h2>
      <p class="text-gray-400 artistPointer">
        by ${artistLinks}
      </p>
      <p class="italic text-gray-500 hover:underline cursor-pointer albumPointer" onclick="navigateTo('/album/${slugify(track.album)}')">${track.album}</p>

      <div id="audio-warning-container"></div>

      <div class="audio-player" style="display:flex; flex-direction:column; gap:12px; margin-top:1rem; color:#eee;">
        ${audioFileProvided ? `<audio id="audio" src="${track.file}"></audio>` : `<audio id="audio"></audio>`}
        
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

          ${window.isLoggedIn ? `<button id="btnRepost" class="btn-repost noprint" title="Repost" data-inactive-color="#aaa" onclick="toggleRepostButton(this, '${track.slugArtist}','${track.slugTitle}','${escapeHtml(track.title)}','${escapeHtml(track.artist)}')" style="cursor:pointer; background:none; border:none; color:${isTrackReposted(track.slugArtist, track.slugTitle) ? getThemeAccentColor() : '#aaa'}; width:28px; height:28px; display:flex; align-items:center; justify-content:center;">
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:20px;height:20px;"><path d="M7.08034 5.71966L4.05001 2.68933L1.01968 5.71966L2.08034 6.78032L3.30002 5.56065V9.75C3.30002 11.2688 4.53124 12.5 6.05002 12.5H8.05002V11H6.05002C5.35966 11 4.80002 10.4404 4.80002 9.75V5.56066L6.01968 6.78032L7.08034 5.71966Z" fill="currentColor"></path><path d="M11.95 13.3107L8.91969 10.2803L9.98035 9.21968L11.2 10.4393L11.2 5.75C11.2 5.05964 10.6404 4.5 9.95001 4.5L7.95001 4.5L7.95001 3L9.95001 3C11.4688 3 12.7 4.23122 12.7 5.75L12.7 10.4394L13.9197 9.21968L14.9803 10.2803L11.95 13.3107Z" fill="currentColor"></path></svg>
          </button>` : ''}

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
      ` : (window.currentUser && track.uploadedBy === window.currentUser.id ? `
        <div class="flex gap-4 mt-4">
          <button onclick="editTrack('${track.slugArtist}', '${track.slugTitle}')" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">Edit Track</button>
        </div>
      ` : '')}
    </div>

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

  // initialize repost button state
  try {
    const rb = document.getElementById('btnRepost');
    if (rb) {
      if (isTrackReposted(track.slugArtist, track.slugTitle)) rb.classList.add('text-green-400');
      else rb.classList.remove('text-green-400');
    }
  } catch(e){}

  // Load comments and show form for authenticated users
  initComments(track);
}

function editTrack(artistSlug, songSlug) {
  localStorage.setItem('editTrackArtistSlug', artistSlug);
  localStorage.setItem('editTrackTitleSlug', songSlug);
  window.location.href = '/edit-song.html';
}

async function renderArtist(artistSlug) {
  // Find tracks where any of the artists match this slug (supports multi-artist tracks)
  const artistTracks = tracks.filter(t => trackHasArtist(t, artistSlug));
  if (!artistTracks.length) return renderNotFound();

  // Get the display name for this specific artist
  const artistName = getArtistDisplayName(artistTracks[0], artistSlug);

  // Check if user is following this artist
  let isFollowing = false;
  let followerCount = 0;
  try {
    const followRes = await fetch(`/api/follows/${artistSlug}`);
    const followData = await followRes.json();
    if (followData.success) {
      isFollowing = followData.isFollowing;
      followerCount = followData.followerCount;
    }
  } catch (e) {
    console.error('Failed to check follow status:', e);
  }

  // Group tracks by year
  const tracksByYear = {};
  artistTracks.forEach(track => {
    const year = track.createdAt ? new Date(track.createdAt).getFullYear() : 'Unknown';
    if (!tracksByYear[year]) {
      tracksByYear[year] = [];
    }
    tracksByYear[year].push(track);
  });

  // Sort years in descending order (newest first)
  const sortedYears = Object.keys(tracksByYear).sort((a, b) => {
    if (a === 'Unknown') return 1;
    if (b === 'Unknown') return -1;
    return b - a;
  });

  // Generate tracks HTML grouped by year
  const tracksHTML = sortedYears.map(year => `
    <div class="mb-8">
      <h3 class="text-3xl font-bold mb-4 text-gray-300">${year}</h3>
      <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${tracksByYear[year].map(renderTrackCard).join("")}
      </div>
    </div>
  `).join("");

  const albumMap = new Map();
  for (const track of artistTracks) {
    const albumSlug = slugify(track.album || "Unknown Album");
    if (!albumMap.has(albumSlug)) {
      albumMap.set(albumSlug, track);
    }
  }

  // Only show follow button if user is authenticated
  const followButtonHtml = window.isLoggedIn ? `
    <button id="follow-btn" onclick="toggleFollow('${artistSlug}')" 
            class="follow-btn ml-3 px-3 py-1 rounded text-sm flex items-center gap-2 ${isFollowing ? 'following' : ''}"
            data-artist-slug="${artistSlug}">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
           fill="${isFollowing ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" 
           stroke-linecap="round" stroke-linejoin="round" class="feather feather-bell">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
      ${isFollowing ? 'Following' : 'Follow'}
    </button>
  ` : '';

  getApp().innerHTML = `
    <div class="flex items-center mb-4">
      <h2 class="text-2xl font-bold">🎤 ${artistName}</h2>
      ${followButtonHtml}
    </div>
    ${tracksHTML}
    <h3 class="text-xl font-semibold mb-2 mt-10">📀 Albums featuring ${artistName}</h3>
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

// Toggle follow/unfollow artist
async function toggleFollow(artistSlug) {
  const btn = document.getElementById('follow-btn');
  if (!btn) return;
  
  const isCurrentlyFollowing = btn.classList.contains('following');
  
  try {
    const method = isCurrentlyFollowing ? 'DELETE' : 'POST';
    const res = await fetch(`/api/follows/${artistSlug}`, { method });
    const data = await res.json();
    
    if (data.success) {
      const bellIcon = btn.querySelector('svg');
      if (data.isFollowing) {
        btn.classList.add('following');
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
               fill="currentColor" stroke="currentColor" stroke-width="2" 
               stroke-linecap="round" stroke-linejoin="round" class="feather feather-bell">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Following
        `;
      } else {
        btn.classList.remove('following');
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
               fill="none" stroke="currentColor" stroke-width="2" 
               stroke-linecap="round" stroke-linejoin="round" class="feather feather-bell">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Follow
        `;
      }
    } else if (data.error === 'Authentication required') {
      showAuthPopup('Please log in to follow artists');
    }
  } catch (e) {
    console.error('Failed to toggle follow:', e);
  }
}

function isOnAlbumPage() {
  // Don't consider 'queue' as an album page
  if (albumPlayer.albumSlug === 'queue') return false;
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

  // Get currently playing track info (from queue or album player)
  let currentlyPlayingTrack = null;
  if (albumPlayer.tracks && albumPlayer.tracks.length > 0 && albumPlayer.currentIndex >= 0) {
    currentlyPlayingTrack = albumPlayer.tracks[albumPlayer.currentIndex];
  }

  // Count all artists (including from multi-artist tracks)
  const artistCount = {};
  sorted.forEach(t => {
    const artists = parseArtists(t.artist);
    artists.forEach(artist => {
      artistCount[artist] = (artistCount[artist] || 0) + 1;
    });
  });
  const sortedArtists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]);

  getApp().innerHTML = `
    <div class="max-w-3xl mx-auto space-y-6">
      <h2 class="text-3xl font-bold mb-2">
        ${albumTitle}
        <span class="text-sm text-gray-400 block mt-1 artistPointer">
          by ${sortedArtists.map(([name]) => `<span class="hover:underline cursor-pointer" onclick="navigateTo('/${slugify(name)}')">${name}</span>`).join(', ')}
        </span>
        <span id="album-total-time" class="text-xs text-gray-500 block mt-1">
          ${sorted.length} track${sorted.length !== 1 ? 's' : ''} • <span id="album-duration-text">Loading...</span>
        </span>
      </h2>
      <button class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white" onclick="playAlbumTracks('${albumSlug}')">▶ Play All</button>
      <div class="flex flex-col divide-y-4 divide-transparent mt-4">
        ${sorted.map((track, idx) => {
          // Check if this track is currently playing (compare titles and first artist)
          const trackFirstArtist = parseArtists(track.artist)[0] || track.artist;
          const currentFirstArtist = currentlyPlayingTrack ? (parseArtists(currentlyPlayingTrack.artist)[0] || currentlyPlayingTrack.artist) : '';
          const isPlaying = currentlyPlayingTrack && 
            slugify(currentlyPlayingTrack.title) === slugify(track.title) && 
            slugify(currentFirstArtist) === slugify(trackFirstArtist);
          
          return `
          <div class="p-4 flex justify-between items-center albumtrack ${isPlaying ? 'bg-gray-700 currenttrack' : ''}">
            <div class="flex-1">
              <div class="text-lg font-semibold hover:underline cursor-pointer" onclick="playAlbumTrack('${albumSlug}', ${idx})">${track.title}</div>
              <div class="text-gray-400 text-sm albumtracktext">
                #${track.albumNumber || '?'} <span class="text-xs text-gray-500 albumtracktext">(Track ${idx + 1})</span> • <span class="text-gray-500 albumtracktext" data-track-title="${track.title.replace(/"/g, '&quot;')}">${trackDurationMap[track.title] || '<span class="animate-pulse">--:--</span>'}</span>
              </div>
            </div>
            <div class="flex items-center gap-2">
              ${isPlaying ? '<span class="text-green-400 text-sm playingtext">Playing...</span>' : ''}
            </div>
          </div>
        `}).join('')}
      </div>
    </div>
  `;

  // Preload all track durations in parallel
  preloadTrackDurations(
    sorted,
    (track, duration, index) => {
      // Update individual track duration display
      const durationElement = document.querySelector(`[data-track-title="${track.title.replace(/"/g, '&quot;')}"]`);
      if (durationElement) {
        durationElement.textContent = duration;
      }
    },
    (totalSeconds) => {
      // Update total album duration
      const totalElement = document.getElementById('album-duration-text');
      if (totalElement) {
        totalElement.textContent = formatTime(totalSeconds);
      }
    }
  );
}

async function renderPlaylist(playlistId) {
  try {
    const response = await fetch(`/api/playlists/${playlistId}`);
    const data = await response.json();

    if (!data.success) {
      return renderNotFound();
    }

    const playlist = data.playlist;

    // Get auth status to check if user owns this playlist or is a collaborator
    const authResponse = await fetch('/api/auth-status');
    const authData = await authResponse.json();
    let userId = null;
    if (authData.isLoggedIn) {
      userId = authData.user?.id;
    }
    const isOwner = userId === playlist.userId;
    const isCollaborator = playlist.collaborators && playlist.collaborators.includes(userId);
    const canEdit = isOwner || isCollaborator;

    // Get playlist owner info
    const ownerResponse = await fetch(`/api/profile/${playlist.userId}`);
    const ownerData = await ownerResponse.json();
    const ownerUsername = ownerData.success ? ownerData.user.username : 'Unknown User';

    // Get collaborator info if there are collaborators
    let collaborators = [];
    if (playlist.collaborators && playlist.collaborators.length > 0) {
      const collaboratorResponse = await fetch(`/api/playlists/${playlistId}/collaborators`);
      const collaboratorData = await collaboratorResponse.json();
      if (collaboratorData.success) {
        collaborators = collaboratorData.collaborators;
      }
    }

    // Resolve full track details for songs in playlist
    const playlistTracks = playlist.songs.map(song => {
      const track = tracks.find(t => 
        slugify(t.artist) === song.artistSlug && slugify(t.title) === song.songSlug
      );
      return track ? { ...track, playlistEntry: song } : null;
    }).filter(Boolean);

    // Get unique artists from the playlist (including from multi-artist tracks)
    const artistCount = {};
    playlistTracks.forEach(t => {
      const artists = parseArtists(t.artist);
      artists.forEach(artist => {
        artistCount[artist] = (artistCount[artist] || 0) + 1;
      });
    });
    const sortedArtists = Object.entries(artistCount).sort((a, b) => b[1] - a[1]);

    getApp().innerHTML = `
      <div class="max-w-3xl mx-auto space-y-6">
        <h2 class="text-3xl font-bold mb-2">
          ${escapeHtml(playlist.name)}
          <span class="text-sm text-gray-400 block mt-1 artistPointer">
            by <span class="hover:underline cursor-pointer" onclick="navigateTo('/profile/${playlist.userId}')">${escapeHtml(ownerUsername)}</span>
          </span>
          ${sortedArtists.length > 0 ? `
            <span class="text-sm text-gray-400 block mt-1">
              Artists: ${sortedArtists.map(([name]) => `<span class="hover:underline cursor-pointer" onclick="navigateTo('/${slugify(name)}')">${escapeHtml(name)}</span>`).join(', ')}
            </span>
          ` : ''}
        </h2>
        ${playlist.description ? `<p class="text-gray-400 mb-4">${escapeHtml(playlist.description)}</p>` : ''}
        
        ${collaborators.length > 0 ? `
          <div class="mb-4">
            <h3 class="text-sm font-semibold mb-2 text-gray-300">Collaborators:</h3>
            <div class="flex flex-wrap gap-2">
              ${collaborators.map(collab => {
                const profilePic = collab.profilePicture ? 
                  `<div class="w-6 h-6 rounded-full" style="background-image: url('${collab.profilePicture}'); background-size: cover; background-position: center;"></div>` :
                  `<div class="w-6 h-6 rounded-full profile-gradient-${collab.selectedGradient || 1} flex items-center justify-center text-xs font-bold text-white">${(collab.username || '').substring(0,1).toUpperCase()}</div>`;
                const verifiedBadge = renderVerifiedBadge(collab.isVerified, true);
                
                return `
                  <div class="track flex items-center gap-2 bg-gray-700 rounded px-2 py-1">
                    ${profilePic}
                    <span class="text-sm hover:underline cursor-pointer flex items-center" onclick="navigateTo('/profile/${collab.id}')">${escapeHtml(collab.username)}${verifiedBadge}</span>
                    ${isOwner ? `<button onclick="removeCollaborator('${playlist.id}', '${collab.id}')" class="text-red-400 hover:text-red-300 ml-1 text-xs">×</button>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}
        
        <p class="text-sm text-gray-500 mb-4">${playlist.songs.length} song${playlist.songs.length !== 1 ? 's' : ''} • <span id="playlist-duration-text">Loading...</span></p>
        
        <div class="flex gap-2">
          ${playlistTracks.length > 0 ? `
            <button onclick="playPlaylist('${playlist.id}')" class="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white text-sm font-semibold">
              ▶ Play Playlist
            </button>
          ` : ''}
          ${isOwner ? `
            <button onclick="editPlaylistDetails('${playlist.id}')" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-white text-sm">
              Edit Details
            </button>
            <button onclick="showCollaboratorModal('${playlist.id}')" class="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded text-white text-sm">
              Manage Collaborators
            </button>
          ` : ''}
          ${canEdit && !isOwner ? `
            <span class="text-sm text-yellow-400 bg-yellow-900 px-2 py-1 rounded">
              ✏️ Collaborator
            </span>
          ` : ''}
        </div>

        ${playlistTracks.length === 0 ? `
          <p class="text-gray-400 text-center py-8">This playlist is empty.</p>
        ` : `
          <div id="playlist-tracks" class="flex flex-col divide-y-4 divide-transparent mt-4">
            ${playlistTracks.map((track, idx) => `
              <div class="p-4 flex justify-between items-center albumtrack playlist-track-item" data-index="${idx}" draggable="${canEdit}">
                <div class="flex items-center gap-3 flex-1">
                  ${canEdit ? `
                    <div class="drag-handle cursor-move text-gray-500 hover:text-gray-300">
                      ⋮⋮
                    </div>
                  ` : ''}
                  <div class="flex-1">
                    <div class="text-lg font-semibold hover:underline cursor-pointer" onclick="navigateTo('/${slugify(parseArtists(track.artist)[0] || track.artist)}/${slugify(track.title)}')">
                      ${track.title}
                    </div>
                    <div class="text-gray-400 text-sm albumtracktext">
                      ${renderArtistLinks(track.artist)}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-gray-500 text-sm mr-2" data-playlist-track-title="${track.title.replace(/"/g, '&quot;')}">
                    ${trackDurationMap[track.title] || '--:--'}
                  </span>
                  ${canEdit ? `
                    <button onclick="removeSongFromPlaylist('${playlist.id}', '${slugify(parseArtists(track.artist)[0] || track.artist)}', '${slugify(track.title)}')"
                            class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
                      Remove
                    </button>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    // Setup drag and drop if user can edit
    if (canEdit && playlistTracks.length > 0) {
      setupPlaylistDragAndDrop(playlist.id);
    }

    // Preload all track durations in parallel
    preloadTrackDurations(
      playlistTracks,
      (track, duration, index) => {
        // Update individual track duration display
        const durationElement = document.querySelector(`[data-playlist-track-title="${track.title.replace(/"/g, '&quot;')}"]`);
        if (durationElement) {
          durationElement.textContent = duration;
        }
      },
      (totalSeconds) => {
        // Update total playlist duration
        const totalElement = document.getElementById('playlist-duration-text');
        if (totalElement) {
          totalElement.textContent = formatTime(totalSeconds);
        }
      }
    );
  } catch (error) {
    console.error('Error rendering playlist:', error);
    renderNotFound();
  }
}

async function editPlaylistDetails(playlistId) {
  const response = await fetch(`/api/playlists/${playlistId}`);
  const data = await response.json();
  
  if (!data.success) {
    alert('Failed to load playlist details');
    return;
  }

  const playlist = data.playlist;
  const newName = prompt('Enter new playlist name:', playlist.name);
  if (!newName || !newName.trim()) return;

  const newDescription = prompt('Enter new playlist description:', playlist.description);

  try {
    const updateResponse = await fetch(`/api/playlists/${playlistId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDescription ? newDescription.trim() : '' })
    });

    const updateData = await updateResponse.json();
    if (updateData.success) {
      renderPlaylist(playlistId);
    } else {
      alert('Failed to update playlist: ' + updateData.error);
    }
  } catch (error) {
    console.error('Error updating playlist:', error);
    alert('Failed to update playlist');
  }
}

async function playPlaylist(playlistId) {
  try {
    const response = await fetch(`/api/playlists/${playlistId}`);
    const data = await response.json();

    if (!data.success) {
      alert('Failed to load playlist');
      return;
    }

    const playlist = data.playlist;

    // Resolve full track details for songs in playlist
    const playlistTracks = playlist.songs.map(song => {
      const track = tracks.find(t => 
        slugify(t.artist) === song.artistSlug && slugify(t.title) === song.songSlug
      );
      return track ? { ...track, playlistEntry: song } : null;
    }).filter(Boolean);

    if (playlistTracks.length === 0) {
      alert('This playlist has no playable songs');
      return;
    }

    // Use the album player to play the playlist
    albumPlayer.tracks = playlistTracks;
    albumPlayer.albumSlug = `playlist-${playlistId}`;
    albumPlayer.currentIndex = 0;
    albumPlayer.loopMode = 0;
    
    // Add playlist tracks to queue
    addTracksToQueue(playlistTracks, true);
    
    // Start playing the first track without calling playAlbumTracks (which would reset tracks)
    startAlbumAudio();
    updatePersistentPlayer();
    saveAlbumPlayerState();

    const persistentVolumeSlider = document.getElementById("volumeSlider");
    if (albumPlayer.audio && persistentVolumeSlider) {
      const volume = parseFloat(persistentVolumeSlider.value);
      albumPlayer.audio.volume = volume;
      persistentVolumeSlider.value = volume;
      const percent = volume * 100;
      const color = getProgressBarColor();
      persistentVolumeSlider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${percent}%, #444 ${percent}%, #444 100%)`;
    }
  } catch (error) {
    console.error('Error playing playlist:', error);
    alert('Failed to play playlist');
  }
}

async function removeSongFromPlaylist(playlistId, artistSlug, songSlug) {
  try {
    const response = await fetch(`/api/playlists/${playlistId}/songs`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistSlug, songSlug })
    });

    const data = await response.json();

    if (data.success) {
      renderPlaylist(playlistId);
    } else {
      alert('Failed to remove song: ' + data.error);
    }
  } catch (error) {
    console.error('Error removing song:', error);
    alert('Failed to remove song');
  }
}

function setupPlaylistDragAndDrop(playlistId) {
  const container = document.getElementById('playlist-tracks');
  if (!container) return;

  let draggedElement = null;
  let draggedIndex = null;

  const items = container.querySelectorAll('.playlist-track-item');
  
  items.forEach(item => {
    item.addEventListener('dragstart', function(e) {
      draggedElement = this;
      draggedIndex = parseInt(this.getAttribute('data-index'));
      this.style.opacity = '0.5';
      e.dataTransfer.effectAllowed = 'move';
    });

    item.addEventListener('dragend', function() {
      this.style.opacity = '1';
    });

    item.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      
      const afterElement = getDragAfterElement(container, e.clientY);
      if (afterElement == null) {
        container.appendChild(draggedElement);
      } else {
        container.insertBefore(draggedElement, afterElement);
      }
    });
  });

  container.addEventListener('drop', async function(e) {
    e.preventDefault();
    
    // Get new order
    const items = container.querySelectorAll('.playlist-track-item');
    const newOrder = [];
    const response = await fetch(`/api/playlists/${playlistId}`);
    const data = await response.json();
    
    if (!data.success) return;
    
    const currentSongs = data.playlist.songs;
    
    items.forEach(item => {
      const originalIndex = parseInt(item.getAttribute('data-index'));
      newOrder.push(currentSongs[originalIndex]);
    });

    // Save new order
    try {
      const updateResponse = await fetch(`/api/playlists/${playlistId}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ songs: newOrder })
      });

      const updateData = await updateResponse.json();

      if (updateData.success) {
        renderPlaylist(playlistId); // Refresh to show new order
      } else {
        alert('Failed to reorder songs: ' + updateData.error);
      }
    } catch (error) {
      console.error('Error reordering songs:', error);
      alert('Failed to reorder songs');
    }
  });
}

function getDragAfterElement(container, y) {
  const draggableElements = [...container.querySelectorAll('.playlist-track-item:not(.dragging)')];

  return draggableElements.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;

    if (offset < 0 && offset > closest.offset) {
      return { offset: offset, element: child };
    } else {
      return closest;
    }
  }, { offset: Number.NEGATIVE_INFINITY }).element;
}

// =================== QUEUE SYSTEM ===================
let songQueue = [];
let queueIndex = -1; // Current position in the queue (-1 means not playing from queue)

// Load queue from localStorage on startup
function loadQueueFromStorage() {
  try {
    const saved = localStorage.getItem('htn_song_queue');
    if (saved) {
      const data = JSON.parse(saved);
      songQueue = data.queue || [];
      queueIndex = data.index !== undefined ? data.index : -1;
    }
  } catch (e) {
    console.error('Failed to load queue from storage:', e);
    songQueue = [];
    queueIndex = -1;
  }
}

// Save queue to localStorage
function saveQueueToStorage() {
  try {
    localStorage.setItem('htn_song_queue', JSON.stringify({
      queue: songQueue,
      index: queueIndex
    }));
  } catch (e) {
    console.error('Failed to save queue to storage:', e);
  }
}

// Add track to end of queue
function addToQueue(artistSlug, songSlug, title, artist, file, cover, album) {
  const track = { artistSlug, songSlug, title, artist, file, cover, album };
  const wasEmpty = songQueue.length === 0;
  songQueue.push(track);
  saveQueueToStorage();
  showTempMessage(`"${title}" added to queue`, 'success');
  updateQueueButton();
  
  // If queue was empty and no player is active, start playing this track
  if (wasEmpty && !isPlayerActive()) {
    queueIndex = 0;
    saveQueueToStorage();
    playQueueTracks(0);
  }
}

// Check if player is currently active (has audio playing or paused AND bar is visible)
function isPlayerActive() {
  const bar = document.getElementById("persistent-album-bar");
  const barVisible = bar && !bar.classList.contains('hide');
  return barVisible && (albumPlayer.audio !== null || (albumPlayer.tracks && albumPlayer.tracks.length > 0));
}

// Add track to play next (after current track in queue)
function playNext(artistSlug, songSlug, title, artist, file, cover, album) {
  const track = { artistSlug, songSlug, title, artist, file, cover, album };
  const wasEmpty = songQueue.length === 0;
  // Insert after current position
  const insertPos = queueIndex >= 0 ? queueIndex + 1 : 0;
  songQueue.splice(insertPos, 0, track);
  saveQueueToStorage();
  showTempMessage(`"${title}" will play next`, 'success');
  updateQueueButton();
  
  // If queue was empty and no player is active, start playing this track
  if (wasEmpty && !isPlayerActive()) {
    queueIndex = 0;
    saveQueueToStorage();
    playQueueTracks(0);
  }
}

// Add multiple tracks to queue (for albums/playlists)
function addTracksToQueue(tracksToAdd, clearExisting = true) {
  if (clearExisting) {
    songQueue = [];
    queueIndex = 0;
  }
  
  tracksToAdd.forEach(track => {
    songQueue.push({
      artistSlug: slugify(parseArtists(track.artist)[0] || track.artist),
      songSlug: slugify(track.title),
      title: track.title,
      artist: track.artist,
      file: track.file,
      cover: track.cover,
      album: track.album
    });
  });
  
  saveQueueToStorage();
  updateQueueButton();
}

// Remove track from queue by index
function removeFromQueue(index) {
  if (index >= 0 && index < songQueue.length) {
    const removed = songQueue.splice(index, 1)[0];
    
    // Adjust queueIndex if needed
    if (index < queueIndex) {
      queueIndex--;
    } else if (index === queueIndex) {
      // If we removed the current track, stay at same index (next track slides in)
      // But if we removed the last track, go back one
      if (queueIndex >= songQueue.length) {
        queueIndex = songQueue.length - 1;
      }
    }
    
    saveQueueToStorage();
    renderQueueModal();
    updateQueueButton();
    showTempMessage(`"${removed.title}" removed from queue`, 'success');
  }
}

// Clear entire queue
function clearQueue() {
  songQueue = [];
  queueIndex = -1;
  saveQueueToStorage();
  renderQueueModal();
  updateQueueButton();
  showTempMessage('Queue cleared', 'success');
}

// Move to next track in queue
function queueNextTrack() {
  if (queueIndex < songQueue.length - 1) {
    queueIndex++;
    saveQueueToStorage();
    return songQueue[queueIndex];
  }
  return null;
}

// Move to previous track in queue
function queuePrevTrack() {
  if (queueIndex > 0) {
    queueIndex--;
    saveQueueToStorage();
    return songQueue[queueIndex];
  }
  return null;
}

// Get current queue track
function getCurrentQueueTrack() {
  if (queueIndex >= 0 && queueIndex < songQueue.length) {
    return songQueue[queueIndex];
  }
  return null;
}

// Check if queue has more tracks after current
function hasNextInQueue() {
  return queueIndex < songQueue.length - 1;
}

// Check if queue has tracks before current
function hasPrevInQueue() {
  return queueIndex > 0;
}

// Check if we're currently playing from queue
function isPlayingFromQueue() {
  return queueIndex >= 0 && songQueue.length > 0;
}

// Update queue button badge
function updateQueueButton() {
  const queueBtn = document.getElementById('queueBtn');
  if (queueBtn) {
    const badge = queueBtn.querySelector('.queue-badge');
    if (badge) {
      if (songQueue.length > 0) {
        badge.textContent = songQueue.length;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }
  }
}

// Show queue modal
function showQueueModal() {
  let modal = document.getElementById('queue-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'queue-modal';
    modal.className = 'queue-modal-overlay';
    document.body.appendChild(modal);
  }
  renderQueueModal();
  modal.style.display = 'flex';
}

// Hide queue modal
function hideQueueModal() {
  const modal = document.getElementById('queue-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Render queue modal content
function renderQueueModal() {
  const modal = document.getElementById('queue-modal');
  if (!modal) return;

  const queueItems = songQueue.map((track, index) => {
    const isCurrentTrack = index === queueIndex;
    return `
    <div class="queue-track-item ${isCurrentTrack ? 'queue-track-current' : ''}" data-index="${index}">
      <div class="queue-track-index">${isCurrentTrack ? '▶' : index + 1}</div>
      <img src="${track.cover || '/default-cover.png'}" alt="${track.album || 'Album'}" class="queue-track-cover" />
      <div class="queue-track-info">
        <div class="queue-track-title">${escapeHtml(track.title)}</div>
        <div class="queue-track-artist">${parseArtists(track.artist).map(a => escapeHtml(a)).join(', ')}</div>
      </div>
      <button class="queue-track-play" onclick="playFromQueue(${index})" title="Play now">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <polygon points="5 3 19 12 5 21 5 3"/>
        </svg>
      </button>
      <button class="queue-track-remove" onclick="removeFromQueue(${index})" title="Remove from queue">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  `;
  }).join('');

  modal.innerHTML = `
    <div class="queue-modal-content">
      <div class="queue-modal-header">
        <h2>Queue</h2>
        <div class="queue-modal-actions">
          ${songQueue.length > 0 ? '<button class="queue-clear-btn" onclick="clearQueue()">Clear All</button>' : ''}
          <button class="queue-close-btn" onclick="hideQueueModal()">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="queue-track-list">
        ${songQueue.length > 0 ? queueItems : '<div class="queue-empty">Your queue is empty. Add songs using the menu on any track, or play an album/playlist.</div>'}
      </div>
      <div class="queue-modal-footer">
        <span class="queue-count">${songQueue.length} ${songQueue.length === 1 ? 'track' : 'tracks'} in queue${queueIndex >= 0 ? ` • Playing ${queueIndex + 1} of ${songQueue.length}` : ''}</span>
      </div>
    </div>
  `;

  // Close when clicking overlay
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      hideQueueModal();
    }
  });
  
  // Scroll current track into view
  setTimeout(() => {
    const currentItem = modal.querySelector('.queue-track-current');
    if (currentItem) {
      currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 100);
}

// Play a track from the queue at specific index
function playFromQueue(index) {
  if (index >= 0 && index < songQueue.length) {
    queueIndex = index;
    saveQueueToStorage();
    
    // Set up album player with the FULL queue, not just the current track
    playQueueTracks(index);
    
    renderQueueModal();
  }
}

// Play the queue starting from a specific index
function playQueueTracks(startIndex) {
  // Stop current audio
  if (albumPlayer.audio) {
    albumPlayer.audio.pause();
    albumPlayer.audio = null;
  }

  // Convert queue to albumPlayer.tracks format
  albumPlayer.tracks = songQueue.map(track => ({
    title: track.title,
    artist: track.artist,
    file: track.file,
    cover: track.cover,
    album: track.album || 'Queue',
    slug: track.songSlug
  }));
  albumPlayer.currentIndex = startIndex;
  albumPlayer.albumSlug = 'queue';
  albumPlayer.paused = false;

  // Ensure persistent bar is created/visible
  updatePersistentPlayer();
  
  startAlbumAudio();
  saveAlbumPlayerState();
  updateQueueButton();
}

// Initialize queue on load
loadQueueFromStorage();

// =================== END QUEUE SYSTEM ===================

// Playlist menu functions
let currentPlaylistMenu = null;

async function togglePlaylistMenu(button, artistSlug, songSlug, title, artist) {
  // Close any existing menu
  if (currentPlaylistMenu) {
    currentPlaylistMenu.remove();
    currentPlaylistMenu = null;
    return;
  }

  // Get track info for queue functionality
  const trackInfo = tracks.find(t => slugify(t.artist) === artistSlug && slugify(t.title) === songSlug);
  const file = trackInfo ? trackInfo.file : '';
  const cover = trackInfo ? trackInfo.cover : '';
  const album = trackInfo ? trackInfo.album : '';

  // Check if user is logged in (for playlist features)
  const authResponse = await fetch('/api/auth-status');
  const authData = await authResponse.json();

  let playlistMenuItems = '';
  if (authData.isLoggedIn) {
    const userId = authData.isAdmin ? '0' : authData.user?.id;

    // Fetch user's playlists
    const playlistsResponse = await fetch(`/api/playlists/user/${userId}`);
    const playlistsData = await playlistsResponse.json();

    if (playlistsData.success) {
      const playlists = playlistsData.playlists;
      if (playlists.length === 0) {
        playlistMenuItems = `
          <div class="playlist-menu-divider"></div>
          <div class="playlist-menu-header">Add to Playlist:</div>
          <div class="playlist-menu-item disabled">No playlists available</div>
          <div class="playlist-menu-item" onclick="createPlaylistFromTrackMenu('${artistSlug}', '${songSlug}', '${escapeForAttribute(title)}', '${escapeForAttribute(artist)}')">+ New Playlist</div>
        `;
      } else {
        playlistMenuItems = `
          <div class="playlist-menu-divider"></div>
          <div class="playlist-menu-header">Add to Playlist:</div>
          ${playlists.map(playlist => `
            <div class="playlist-menu-item" onclick="addSongToPlaylistFromMenu('${playlist.id}', '${artistSlug}', '${songSlug}', '${escapeForAttribute(title)}', '${escapeForAttribute(artist)}')">
              ${escapeHtml(playlist.name)}
            </div>
          `).join('')}
          <div class="playlist-menu-item" onclick="createPlaylistFromTrackMenu('${artistSlug}', '${songSlug}', '${escapeForAttribute(title)}', '${escapeForAttribute(artist)}')">+ New Playlist</div>
        `;
      }
    }
  }

  // Create dropdown menu
  const menu = document.createElement('div');
  menu.className = 'playlist-dropdown-menu';
  menu.style.position = 'absolute';
  menu.style.zIndex = '1000';
  
  const buttonRect = button.getBoundingClientRect();
  
  menu.innerHTML = `
    <div class="playlist-menu-header">Queue Options:</div>
    <div class="playlist-menu-item queue-menu-item" onclick="addToQueueFromMenu('${artistSlug}', '${songSlug}', '${escapeForAttribute(title)}', '${escapeForAttribute(artist)}', '${escapeForAttribute(file)}', '${escapeForAttribute(cover)}', '${escapeForAttribute(album)}')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add to Queue
    </div>
    <div class="playlist-menu-item queue-menu-item" onclick="playNextFromMenu('${artistSlug}', '${songSlug}', '${escapeForAttribute(title)}', '${escapeForAttribute(artist)}', '${escapeForAttribute(file)}', '${escapeForAttribute(cover)}', '${escapeForAttribute(album)}')">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      Play Next
    </div>
    ${playlistMenuItems}
  `;

  document.body.appendChild(menu);
  currentPlaylistMenu = menu;

  // Position the menu, adjusting if it would overflow edges
  // Use requestAnimationFrame to ensure the menu is rendered before measuring
  requestAnimationFrame(() => {
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 12; // Padding from viewport edges
    
    let leftPos = buttonRect.left + window.scrollX;
    let topPos = buttonRect.bottom + window.scrollY + 4; // 4px gap below button
    
    // Check if menu overflows right edge
    if (leftPos + menuRect.width > viewportWidth - padding) {
      // Align menu to the right, relative to the button
      leftPos = buttonRect.right + window.scrollX - menuRect.width;
      
      // If still overflows right, align to viewport right edge
      if (leftPos + menuRect.width > viewportWidth - padding) {
        leftPos = viewportWidth - menuRect.width - padding;
      }
      
      // Ensure it doesn't go off the left edge
      if (leftPos < padding) {
        leftPos = padding;
      }
    }
    
    // Check if menu overflows bottom edge
    if (topPos + menuRect.height > viewportHeight + window.scrollY - padding) {
      // Position above the button instead
      topPos = buttonRect.top + window.scrollY - menuRect.height - 4;
      // Ensure it doesn't go off the top edge
      if (topPos < window.scrollY + padding) {
        topPos = window.scrollY + padding;
      }
    }
    
    menu.style.top = `${topPos}px`;
    menu.style.left = `${leftPos}px`;
  });

  // Close menu when clicking outside
  setTimeout(() => {
    document.addEventListener('click', closePlaylistMenu);
  }, 0);
}

function closePlaylistMenu(e) {
  if (currentPlaylistMenu && !currentPlaylistMenu.contains(e.target)) {
    currentPlaylistMenu.remove();
    currentPlaylistMenu = null;
    document.removeEventListener('click', closePlaylistMenu);
  }
}

// Repost helpers
async function loadCurrentUserReposts(userId) {
  try {
    const resp = await fetch(`/api/me/reposts`);
    if (!resp.ok) return;
    const data = await resp.json();
    if (data.success) {
      window.currentUserReposts = data.reposts || [];
    }
  } catch (e) {
    console.error('Failed to load reposts', e);
  }
}

function isTrackReposted(artistSlug, songSlug) {
  const key = `${artistSlug}:${songSlug}`;
  return window.currentUserReposts.includes(key);
}

async function toggleRepostButton(btn, artistSlug, songSlug, title, artist) {
  if (!window.isLoggedIn) return showAuthPopup('Please log in to repost');
  btn.disabled = true;
  try {
    const result = await toggleRepost(artistSlug, songSlug);
    if (result) {
      if (isTrackReposted(artistSlug, songSlug)) {
        btn.style.color = getThemeAccentColor();
        btn.classList.remove('text-green-400');
        if (btn.dataset.inactiveClass) btn.classList.remove(btn.dataset.inactiveClass);
      } else {
        btn.style.color = btn.dataset.inactiveColor || ''; 
        btn.classList.remove('text-green-400');
        if (btn.dataset.inactiveClass) btn.classList.add(btn.dataset.inactiveClass);
      }
    }
  } catch (e) {
    console.error('Repost failed', e);
  } finally {
    btn.disabled = false;
  }
}

async function toggleRepost(artistSlug, songSlug) {
  try {
    const resp = await fetch('/api/repost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistSlug, songSlug })
    });
    
    const data = await resp.json();
    if (data.success) {
      window.currentUserReposts = data.reposts;
      return true;
    }
    return false;
  } catch (e) {
    console.error(e);
    return false;
  }
}

// Queue menu helper functions
function addToQueueFromMenu(artistSlug, songSlug, title, artist, file, cover, album) {
  addToQueue(artistSlug, songSlug, title, artist, file, cover, album);
  // Close the menu
  if (currentPlaylistMenu) {
    currentPlaylistMenu.remove();
    currentPlaylistMenu = null;
    document.removeEventListener('click', closePlaylistMenu);
  }
}

function playNextFromMenu(artistSlug, songSlug, title, artist, file, cover, album) {
  playNext(artistSlug, songSlug, title, artist, file, cover, album);
  // Close the menu
  if (currentPlaylistMenu) {
    currentPlaylistMenu.remove();
    currentPlaylistMenu = null;
    document.removeEventListener('click', closePlaylistMenu);
  }
}

async function addSongToPlaylistFromMenu(playlistId, artistSlug, songSlug, title, artist) {
  try {
    const response = await fetch(`/api/playlists/${playlistId}/songs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistSlug, songSlug, title, artist })
    });

    const data = await response.json();

    if (data.success) {
      // Show success message
      showTempMessage('Song added to playlist!', 'success');
    } else {
      showTempMessage(data.error || 'Failed to add song', 'error');
    }
  } catch (error) {
    console.error('Error adding song to playlist:', error);
    showTempMessage('Failed to add song to playlist', 'error');
  }

  // Close the menu
  if (currentPlaylistMenu) {
    currentPlaylistMenu.remove();
    currentPlaylistMenu = null;
    document.removeEventListener('click', closePlaylistMenu);
  }
}

async function createPlaylistFromTrackMenu(artistSlug, songSlug, title, artist) {
  // Close the menu first
  if (currentPlaylistMenu) {
    currentPlaylistMenu.remove();
    currentPlaylistMenu = null;
    document.removeEventListener('click', closePlaylistMenu);
  }

  // Check if user is logged in
  const authResponse = await fetch('/api/auth-status');
  const authData = await authResponse.json();

  if (!authData.isLoggedIn) {
    showAuthPopup('Please log in or register to create a playlist');
    return;
  }

  // Use default values
  const name = 'Untitled Playlist';
  const description = '';

  try {
    const response = await fetch('/api/playlists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), description: description.trim() })
    });

    const data = await response.json();

    if (data.success) {
      const playlistId = data.playlist.id;
      
      // Now add the song to the newly created playlist
      const addResponse = await fetch(`/api/playlists/${playlistId}/songs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artistSlug, songSlug, title, artist })
      });

      const addData = await addResponse.json();

      if (addData.success) {
        showTempMessage(`Playlist created and song added!`, 'success');
      } else {
        showTempMessage('Playlist created but failed to add song', 'error');
      }
    } else {
      showTempMessage('Failed to create playlist: ' + data.error, 'error');
    }
  } catch (error) {
    console.error('Error creating playlist:', error);
    showTempMessage('Failed to create playlist', 'error');
  }
}

function showTempMessage(message, type = 'success') {
  const messageDiv = document.createElement('div');
  messageDiv.className = `temp-message temp-message-${type}`;
  messageDiv.textContent = message;
  messageDiv.style.position = 'fixed';
  messageDiv.style.top = '20px';
  messageDiv.style.right = '20px';
  messageDiv.style.zIndex = '9999';
  messageDiv.style.padding = '12px 20px';
  messageDiv.style.borderRadius = '8px';
  messageDiv.style.fontWeight = 'bold';
  messageDiv.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.3)';
  
  if (type === 'success') {
    messageDiv.style.backgroundColor = '#10b981';
    messageDiv.style.color = 'white';
  } else {
    messageDiv.style.backgroundColor = '#ef4444';
    messageDiv.style.color = 'white';
  }

  document.body.appendChild(messageDiv);

  setTimeout(() => {
    messageDiv.remove();
  }, 3000);
}

function showAuthPopup(message) {
  // Create modal HTML styled to match theme
  const modalHtml = `
    <div id="auth-popup-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style="backdrop-filter: blur(4px); animation: fadeIn 0.2s ease-out;">
      <div class="bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 track" style="border: 1px solid rgba(255,255,255,0.1); animation: slideIn 0.3s ease-out; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div class="p-6">
          <div class="flex items-center mb-4">
            <div class="text-3xl mr-3">🔒</div>
            <h3 class="text-xl font-bold text-white">Authentication Required</h3>
          </div>
          
          <div class="mb-6">
            <p class="text-gray-300">
              ${message}
            </p>
          </div>
          
          <div class="flex gap-3">
            <button id="auth-popup-login" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded font-semibold transition-colors" style="color: white; font-weight: bold;">
              Sign In
            </button>
            <button id="auth-popup-register" class="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded font-semibold transition-colors" style="color: white; font-weight: bold;">
              Register
            </button>
          </div>
          
          <button id="auth-popup-close" class="w-full mt-3 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded font-semibold transition-colors" style="color: white; font-weight: bold;">
            Cancel
          </button>
        </div>
      </div>
    </div>
  `;

  // Add modal to document
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Add event listeners
  document.getElementById('auth-popup-login').onclick = () => {
    closeAuthPopup();
    navigateTo('/login');
  };
  
  document.getElementById('auth-popup-register').onclick = () => {
    closeAuthPopup();
    navigateTo('/register');
  };
  
  document.getElementById('auth-popup-close').onclick = closeAuthPopup;

  // Close on backdrop click
  document.getElementById('auth-popup-modal').addEventListener('click', (e) => {
    if (e.target.id === 'auth-popup-modal') {
      closeAuthPopup();
    }
  });
}

function closeAuthPopup() {
  const modal = document.getElementById('auth-popup-modal');
  if (modal) {
    modal.remove();
  }
}

function escapeForAttribute(str) {
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
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
    <div class="profile-load-container">
      <div class="profile-skeleton-card track">
        <div class="profile-skeleton-content">
          <div class="profile-skeleton-avatar"></div>
          <div class="profile-skeleton-text-group">
            <div class="profile-skeleton-title"></div>
            <div class="profile-skeleton-subtitle"></div>
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
        <div class="profile-error-container">
          <div class="profile-error-box">
            <h2 class="profile-error-title">Profile not found</h2>
            <p class="profile-error-text">${escapeHtml(data.message || 'The requested profile could not be loaded.')}</p>
            <button class="profile-error-button" onclick="navigateTo('/')">Go to Home</button>
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
      <div class="profile-page-container">
        <div class="profile-header-card track">
          <div class="profile-header-content">
            <div class="profile-main-info">
              <div class="profile-user-info">
                <div id="profile-picture" class="profile-avatar ${user.profilePicture ? '' : getProfileGradientClass(user)}" ${user.profilePicture ? `style="background-image: url('${user.profilePicture}'); background-size: cover; background-position: center;"` : ''}>
                  ${user.profilePicture ? '' : `<span class="profile-avatar-initials">${getInitials(user.username)}</span>`}
                </div>
                <div>
                  <h1 class="profile-username">
                    ${escapeHtml(user.username)}${renderVerifiedBadge(user.isVerified)}
                  </h1>
                  <p class="profile-join-date">Member since ${formatDate(user.createdAt)}</p>
                  <div class="profile-badges">
                    ${user.isAdmin ? '<span class="badge-admin">ADMIN</span>' : ''}
                    ${user.isVerified && !user.isAdmin ? '<span class="badge-verified">VERIFIED</span>' : ''}
                  </div>
                </div>
              </div>

              <div class="profile-bio-section" id="profile-bio-section">
                <div id="profile-bio-display">
                  <h3 class="profile-section-title">About</h3>
                  <p id="profile-bio" class="profile-bio-text"></p>
                </div>

                <div id="profile-bio-edit" class="hidden">
                  <h3 class="profile-section-title">Edit Bio</h3>
                  <textarea id="bio-edit-input" rows="4" class="profile-bio-textarea"></textarea>
                  <div class="profile-bio-actions">
                    <button id="save-bio-btn" class="btn-primary">Save</button>
                    <button id="cancel-bio-btn" class="btn-secondary navbutton">Cancel</button>
                  </div>
                </div>

                ${isOwnProfile ? '<button id="edit-bio-btn" class="btn-primary" style="margin-top: 0.5rem;">Edit Bio</button>' : ''}
              </div>
            </div>

            <div class="profile-account-info">
               <h3 class="profile-section-title">Account Info</h3>
               <div class="profile-info-list">
                  <div>
                    <span class="profile-label">Account Type:</span>
                    <span class="profile-value">${user.isAdmin ? 'Administrator' : (user.isVerified ? 'Verified User' : 'Standard User')}</span>
                  </div>
                  <div>
                    <span class="profile-label">Member Since:</span>
                    <span class="profile-value">${formatDate(user.createdAt)}</span>
                  </div>
                  ${user.isVerified && user.verifiedAt ? `<div><span class="profile-label">Verified:</span> ${formatDate(user.verifiedAt)}</div>` : ''}
               </div>
               ${isOwnProfile ? `
                  <div class="profile-actions-list">
                    ${user.id !== "0" ? `
                      <button id="change-password-link" class="btn-text-blue">
                        Change Password
                      </button>
                    ` : ''}
                    <div class="profile-picture-controls" style="margin-top: 0.5rem;">
                      <input type="file" id="profile-picture-upload" accept="image/*" style="display: none;">
                      <button id="upload-picture-btn" class="btn-text-green">
                        Upload Profile Picture
                      </button>
                      ${user.profilePicture ? `<button id="delete-picture-btn" class="btn-text-red">
                        Delete Profile Picture
                      </button>` : ''}
                    </div>
                    ${!user.isAdmin ? `
                      <div class="verification-controls" style="padding-top: 0.5rem;">
                        ${user.isVerified ? `
                          <div class="btn-text-green flex-gap-1" style="cursor: default; text-decoration: none;">
                            ✓ Your account is verified
                          </div>
                        ` : user.verificationPending ? `
                          <div style="margin-top: 0.5rem;">
                            <div class="text-yellow-status">Verification request pending...</div>
                            <button id="cancel-verification-btn" class="btn-text-red">
                              ✕ Cancel Verification Request
                            </button>
                          </div>
                        ` : `
                          <button id="request-verification-btn" class="btn-text-purple">
                            ✓ Request Verification
                          </button>
                        `}
                      </div>
                    ` : ''}
                  </div>
                ` : ''}
            </div>
          </div>
        </div>

        <div class="profile-grid">
          <div class="profile-content-card track profile-content-scrollable">
            <div class="profile-card-header">
              <h2 class="profile-card-title">Playlists</h2>
              ${isOwnProfile ? `
                <button id="create-playlist-btn" class="btn-green">
                  Create Playlist
                </button>
              ` : ''}
            </div>
            <div id="playlists-container">
              <p class="profile-empty-text">Loading playlists...</p>
            </div>
          </div>

          <div class="profile-content-card track">
            <div class="profile-card-header">
              <h2 class="profile-card-title">Activity Tracking</h2>
              ${isOwnProfile ? `
                <div class="profile-card-actions">
                  <button id="toggle-activity-btn" class="btn-primary">
                    Loading...
                  </button>
                  <button id="reset-activity-btn" class="btn-red-action">
                    Reset Data
                  </button>
                </div>
              ` : ''}
            </div>
            <div id="activity-content">
              <div class="profile-empty-text">Loading activity...</div>
            </div>
          </div>
        </div>

        <div class="profile-content-card-reposts track">
          <h2 class="profile-card-title" style="margin-bottom: 1rem;">Reposted Songs</h2>
          <div id="reposts-container" class="profile-reposts-list">
            <p class="profile-empty-text">Loading reposts...</p>
          </div>
        </div>
      </div>
    `;
    // Fill bio text
    const bioEl = document.getElementById('profile-bio');
    if (user.bio && user.bio.trim()) {
      bioEl.textContent = user.bio;
      bioEl.classList.remove('profile-bio-placeholder');
    } else {
      bioEl.textContent = user.isAdmin ? 'System Administrator' : 'No bio available.';
      bioEl.classList.add('profile-bio-placeholder');
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
            bioEl.classList.remove('profile-bio-placeholder');
            if (newBio) {
              bioEl.textContent = newBio;
            } else {
              bioEl.textContent = 'No bio available.';
              bioEl.classList.add('profile-bio-placeholder');
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

    // Load playlists
    await loadUserPlaylists(userId, isOwnProfile);

    // Render reposts
    const repostsContainer = document.getElementById('reposts-container');
    if (repostsContainer) {
      if (user.reposts && user.reposts.length > 0) {
        const repostsHtml = user.reposts.map(repostKey => {
          // repostKey is "artistSlug:songSlug"
          const parts = repostKey.split(':');
          if (parts.length !== 2) return '';
          const [artistSlug, songSlug] = parts;
          // Find track in global tracks array
          const track = tracks.find(t => trackHasArtist(t, artistSlug) && slugify(t.title) === songSlug);
          if (!track) return ''; // Track might have been deleted
          
          return renderRepostItem(track);
        }).join('');
        
        repostsContainer.innerHTML = repostsHtml || '<p class="text-gray-400">No reposts found.</p>';
      } else {
        repostsContainer.innerHTML = '<p class="text-gray-400">No reposts yet.</p>';
      }
    }

    // Wire change password link
    const changePasswordLink = document.getElementById('change-password-link');
    if (changePasswordLink) {
      changePasswordLink.addEventListener('click', () => {
        renderChangePassword(user.id);
      });
    }

    // Wire profile picture upload
    const uploadPictureBtn = document.getElementById('upload-picture-btn');
    const profilePictureUpload = document.getElementById('profile-picture-upload');
    const deletePictureBtn = document.getElementById('delete-picture-btn');

    if (uploadPictureBtn && profilePictureUpload) {
      uploadPictureBtn.addEventListener('click', () => {
        profilePictureUpload.click();
      });

      profilePictureUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
          alert('File size must be less than 5MB');
          return;
        }

        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert('Please select an image file');
          return;
        }

        const formData = new FormData();
        formData.append('profilePicture', file);

        try {
          const response = await fetch(`/api/profile/${user.id}/picture`, {
            method: 'POST',
            body: formData
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Upload failed');
          }

          const result = await response.json();
          if (result.success) {
            // Update profile picture display
            const profilePic = document.getElementById('profile-picture');
            profilePic.style.backgroundImage = `url('${result.profilePicture}')`;
            profilePic.style.backgroundSize = 'cover';
            profilePic.style.backgroundPosition = 'center';
            profilePic.className = 'w-20 h-20 rounded-full flex items-center justify-center';
            profilePic.innerHTML = '';

            // Update user object and refresh page to show delete button
            user.profilePicture = result.profilePicture;
            renderProfile(userId); // Refresh to show delete button
          } else {
            alert('Failed to upload profile picture: ' + result.message);
          }
        } catch (error) {
          console.error('Upload error:', error);
          alert('Failed to upload profile picture: ' + error.message);
        }
      });
    }

    if (deletePictureBtn) {
      deletePictureBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete your profile picture?')) {
          return;
        }

        try {
          const response = await fetch(`/api/profile/${user.id}/picture`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Delete failed');
          }

          const result = await response.json();
          if (result.success) {
            // Update user object and refresh page
            user.profilePicture = null;
            renderProfile(userId); // Refresh to remove delete button and show gradient
          } else {
            alert('Failed to delete profile picture: ' + result.message);
          }
        } catch (error) {
          console.error('Delete error:', error);
          alert('Failed to delete profile picture: ' + error.message);
        }
      });
    }

    // Wire verification request button
    const requestVerificationBtn = document.getElementById('request-verification-btn');
    if (requestVerificationBtn) {
      requestVerificationBtn.addEventListener('click', async () => {
        if (!confirm('Request account verification? This will allow you to upload songs once approved (2 per day limit).')) {
          return;
        }

        try {
          const response = await fetch(`/api/profile/${user.id}/request-verification`, {
            method: 'POST'
          });

          const result = await response.json();
          if (result.success) {
            showSuccessMessage('Verification request submitted! An admin will review your request.');
            renderProfile(userId); // Refresh to show pending state
          } else {
            alert('Failed to request verification: ' + result.message);
          }
        } catch (error) {
          console.error('Verification request error:', error);
          alert('Failed to request verification');
        }
      });
    }

    // Wire cancel verification button
    const cancelVerificationBtn = document.getElementById('cancel-verification-btn');
    if (cancelVerificationBtn) {
      cancelVerificationBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to cancel your verification request?')) {
          return;
        }

        try {
          const response = await fetch(`/api/profile/${user.id}/request-verification`, {
            method: 'DELETE'
          });

          const result = await response.json();
          if (result.success) {
            showSuccessMessage('Verification request cancelled.');
            renderProfile(userId); // Refresh
          } else {
            alert('Failed to cancel verification request: ' + result.message);
          }
        } catch (error) {
          console.error('Cancel verification error:', error);
          alert('Failed to cancel verification request');
        }
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
              // Update profile picture (only if no uploaded picture exists)
              const profilePic = document.getElementById('profile-picture');
              if (!user.profilePicture) {
                profilePic.className = `w-20 h-20 profile-gradient-${selectedGradient} rounded-full flex items-center justify-center`;
                profilePic.style.backgroundImage = '';
                profilePic.innerHTML = `<span class="text-2xl font-bold text-white">${getInitials(user.username)}</span>`;
              }
              
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

async function loadUserPlaylists(userId, isOwnProfile) {
  try {
    const response = await fetch(`/api/playlists/user/${userId}`);
    const data = await response.json();
    
    const container = document.getElementById('playlists-container');
    
    if (!data.success) {
      container.innerHTML = '<p class="text-gray-400">Failed to load playlists</p>';
      return;
    }

    if (data.playlists.length === 0) {
      container.innerHTML = '<p class="text-gray-400">No playlists yet.</p>';
    } else {
      container.innerHTML = data.playlists.map(playlist => `
      <div class="bg-gray-700 p-4 rounded-lg mb-3 cursor-pointer transition track" onclick="navigateTo('/playlist/${playlist.id}')">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="font-semibold text-lg">${escapeHtml(playlist.name)}</h3>
            <p class="text-sm text-gray-400">${playlist.songs.length} song${playlist.songs.length !== 1 ? 's' : ''}</p>
            ${playlist.description ? `<p class="text-sm text-gray-300 mt-1">${escapeHtml(playlist.description)}</p>` : ''}
          </div>
          ${isOwnProfile ? `
            <button onclick="event.stopPropagation(); deleteUserPlaylist('${playlist.id}', '${escapeHtml(playlist.name)}', '${userId}')" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm">
              Delete
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
    }

    // Wire create playlist button
    const createBtn = document.getElementById('create-playlist-btn');
    if (createBtn && isOwnProfile) {
      createBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Use default values
        const name = 'Untitled Playlist';
        const description = '';

        try {
          const response = await fetch('/api/playlists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name.trim(), description: description.trim() })
          });

          const data = await response.json();

          if (data.success) {
            // Navigate to the new playlist page
            navigateTo(`/playlist/${data.playlist.id}`);
          } else {
            showTempMessage('Failed to create playlist: ' + data.error, 'error');
          }
        } catch (error) {
          console.error('Error creating playlist:', error);
          showTempMessage('Failed to create playlist', 'error');
        }
      });
    }
  } catch (error) {
    console.error('Error loading playlists:', error);
    document.getElementById('playlists-container').innerHTML = '<p class="text-gray-400">Error loading playlists</p>';
  }
}

async function deleteUserPlaylist(playlistId, playlistName, userId) {
  if (!confirm(`Are you sure you want to delete the playlist "${playlistName}"?`)) {
    return;
  }

  try {
    const response = await fetch(`/api/playlists/${playlistId}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (data.success) {
      // Reload playlists for this user
      const auth = await getAuthStatus();
      const isOwnProfile = auth.isLoggedIn && auth.user && auth.user.id === userId;
      await loadUserPlaylists(userId, isOwnProfile);
    } else {
      alert('Failed to delete playlist: ' + data.error);
    }
  } catch (error) {
    console.error('Error deleting playlist:', error);
    alert('Failed to delete playlist');
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
        <h2 class="text-2xl font-bold mb-4">Change Password</h2>
        
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
        audio.playbackRate = 1;
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

          // Update repost item progress bar if visible
          if (hasDuration && albumPlayer.tracks && albumPlayer.tracks[albumPlayer.currentIndex]) {
            const currentTrack = albumPlayer.tracks[albumPlayer.currentIndex];
            const artistSlug = slugify(parseArtists(currentTrack.artist)[0] || currentTrack.artist);
            const songSlug = slugify(currentTrack.title);
            
            const repostProgressFill = document.getElementById(`repost-progress-fill-${artistSlug}-${songSlug}`);
            const repostTimestamp = document.getElementById(`repost-timestamp-${artistSlug}-${songSlug}`);
            
            if (repostProgressFill) {
               repostProgressFill.style.width = `${percent}%`;
            }
            if (repostTimestamp) {
               repostTimestamp.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
            }
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

  // Add album tracks to queue
  addTracksToQueue(albumPlayer.tracks, true);

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
  // Store first artist for "last listened" feature
  const firstArtist = parseArtists(currentTrack.artist)[0] || currentTrack.artist;
  localStorage.setItem('lastListenedArtist', firstArtist);
  const audio = new Audio();
  albumPlayer.audio = audio;
  audio.preservesPitch = false;
  audio.mozPreservesPitch = false;
  audio.webkitPreservesPitch = false;

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
    // Track the play for album track (use first artist slug)
    trackPlay(slugify(firstArtist), slugify(currentTrack.title));
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
      // Loop single track
      audio.currentTime = 0;
      audio.play();
    } else if (albumPlayer.albumSlug === 'queue') {
      // Playing from queue
      if (queueIndex < songQueue.length - 1) {
        // Move to next track in queue
        queueIndex++;
        albumPlayer.currentIndex = queueIndex;
        saveQueueToStorage();
        startAlbumAudio();
        updatePersistentPlayer();
        saveAlbumPlayerState();
        renderQueueModal();
      } else if (albumPlayer.loopMode === 1) {
        // Loop all - restart queue from beginning
        queueIndex = 0;
        albumPlayer.currentIndex = 0;
        saveQueueToStorage();
        startAlbumAudio();
        updatePersistentPlayer();
        saveAlbumPlayerState();
        renderQueueModal();
      }
    } else if (albumPlayer.currentIndex + 1 < albumPlayer.tracks.length) {
      // Not playing from queue, advance in album/playlist
      albumPlayer.currentIndex++;
      if (isOnAlbumPage()) renderCurrentAlbumView();
      startAlbumAudio();
      saveAlbumPlayerState();
    } else if (albumPlayer.loopMode === 1) {
      // Loop all - restart from beginning
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
    const artists = parseArtists(track.artist);
    artists.forEach(artist => {
      uniqueArtists[artist] = (uniqueArtists[artist] || 0) + 1;
    });
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
              <div class="text-gray-400 text-sm albumtracktext hover:underline cursor-pointer" onclick="navigateTo('/${slugify(parseArtists(track.artist)[0] || track.artist)}/${slugify(track.title)}')">
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
        ${isLoggedIn ? `<button id="persistent-repost-btn" class="text-white hover:text-opacity-80" title="Repost">
          <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:20px;height:20px;"><path d="M7.08034 5.71966L4.05001 2.68933L1.01968 5.71966L2.08034 6.78032L3.30002 5.56065V9.75C3.30002 11.2688 4.53124 12.5 6.05002 12.5H8.05002V11H6.05002C5.35966 11 4.80002 10.4404 4.80002 9.75V5.56066L6.01968 6.78032L7.08034 5.71966Z" fill="currentColor"></path><path d="M11.95 13.3107L8.91969 10.2803L9.98035 9.21968L11.2 10.4393L11.2 5.75C11.2 5.05964 10.6404 4.5 9.95001 4.5L7.95001 4.5L7.95001 3L9.95001 3C11.4688 3 12.7 4.23122 12.7 5.75L12.7 10.4394L13.9197 9.21968L14.9803 10.2803L11.95 13.3107Z" fill="currentColor"></path></svg>
        </button>` : ''}
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
        <button id="queueBtn" onclick="showQueueModal()" class="text-white queue-btn" title="View Queue">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-list"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          <span class="queue-badge" style="display: ${songQueue.length > 0 ? 'flex' : 'none'};">${songQueue.length}</span>
        </button>
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

    // Repost functionality for persistent player
    const repostBtn = bar.querySelector("#persistent-repost-btn");
    if (repostBtn) {
      const currentArtistSlug = slugify(parseArtists(current.artist)[0] || current.artist);
      const currentSongSlug = slugify(current.title);

      // Set initial state
      if (isTrackReposted(currentArtistSlug, currentSongSlug)) {
        repostBtn.style.color = getThemeAccentColor();
        repostBtn.classList.remove("text-green-400"); // cleanup only
      }

      repostBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleRepostButton(repostBtn, currentArtistSlug, currentSongSlug, current.title, current.artist);
      });
    }

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
      if (albumPlayer.volumeVisible) {
        volumeSlider.classList.remove("hidden");
      } else {
        volumeSlider.classList.add("hidden");
      }
      volumeContainer.classList.toggle("active", albumPlayer.volumeVisible);
    });

    volumeContainer.addEventListener("mouseenter", () => {
      if (!albumPlayer.volumeVisible) volumeSlider.classList.remove("hidden");
    });

    volumeContainer.addEventListener("mouseleave", () => {
      if (!albumPlayer.volumeVisible) volumeSlider.classList.add("hidden");
    });

    updateVolumeFill();

    const albumSpeedBtn = bar.querySelector("#albumSpeedBtn");
    const albumSpeedModal = bar.querySelector("#albumSpeedModal");
    const albumSpeedSlider = bar.querySelector("#albumSpeedSlider");
    const albumSpeedValue = bar.querySelector("#albumSpeedValue");

    if (albumSpeedBtn && albumSpeedModal && albumSpeedSlider && albumSpeedValue) {
      // Initialize speed slider to default
      albumSpeedSlider.value = 1;
      albumSpeedValue.textContent = "1.000x";
      updateSpeedFill(albumSpeedSlider, albumSpeedValue);

      // Set up event listeners
      albumSpeedBtn.addEventListener("click", () => {
        albumSpeedModal.classList.toggle("hidden");
        albumSpeedBtn.classList.toggle("active");
      });

      albumSpeedSlider.addEventListener("input", () => {
        const speed = parseFloat(albumSpeedSlider.value);
        albumPlayer.audio.playbackRate = speed;
        albumSpeedValue.textContent = speed.toFixed(3) + "x";
        updateSpeedFill(albumSpeedSlider, albumSpeedValue);
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
  // bar.querySelector("#bar-track-meta").textContent = `${current.album} • ${current.artist}`;
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
    
    // Create artist links element for multi-artist support
    const artistEl = document.createElement('span');
    artistEl.innerHTML = renderArtistLinks(current.artist);

    barMeta.appendChild(albumEl);
    barMeta.appendChild(separator);
    barMeta.appendChild(artistEl);
  }

  // Update queue button badge
  updateQueueButton();
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
  
  // Check if playing from queue
  if (albumPlayer.albumSlug === 'queue') {
    // Move to next track in queue
    if (queueIndex < songQueue.length - 1) {
      queueIndex++;
      albumPlayer.currentIndex = queueIndex;
      saveQueueToStorage();
      startAlbumAudio();
      updatePersistentPlayer();
      saveAlbumPlayerState();
      renderQueueModal(); // Update the queue modal if open
    }
    return;
  }
  
  // Album/playlist navigation
  if (albumPlayer.currentIndex + 1 < albumPlayer.tracks.length) {
    albumPlayer.currentIndex++;
    if (isOnAlbumPage()) renderCurrentAlbumView();
    startAlbumAudio();
    updatePersistentPlayer();
    saveAlbumPlayerState();
  }
}

function albumPrevTrack(event) {
  if (event) event.stopPropagation();
  
  // Check if playing from queue
  if (albumPlayer.albumSlug === 'queue') {
    // Move to previous track in queue
    if (queueIndex > 0) {
      queueIndex--;
      albumPlayer.currentIndex = queueIndex;
      saveQueueToStorage();
      startAlbumAudio();
      updatePersistentPlayer();
      saveAlbumPlayerState();
      renderQueueModal(); // Update the queue modal if open
    }
    return;
  }
  
  // Album/playlist navigation
  if (albumPlayer.currentIndex > 0) {
    albumPlayer.currentIndex--;
    if (isOnAlbumPage()) renderCurrentAlbumView();
    startAlbumAudio();
    updatePersistentPlayer();
    saveAlbumPlayerState();
  }
}

const trackDurationMap = {};

// Efficiently load all track durations in parallel
function preloadTrackDurations(tracksToLoad, onProgress, onComplete) {
  let loadedCount = 0;
  let totalDuration = 0;
  const totalTracks = tracksToLoad.length;
  
  if (totalTracks === 0) {
    if (onComplete) onComplete(0);
    return;
  }
  
  const checkComplete = () => {
    if (loadedCount === totalTracks && onComplete) {
      onComplete(totalDuration);
    }
  };
  
  tracksToLoad.forEach((track, index) => {
    // If already cached, use cached value
    if (trackDurationMap[track.title]) {
      const durationParts = trackDurationMap[track.title].split(':');
      if (durationParts.length === 2) {
        const seconds = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
        if (!isNaN(seconds)) totalDuration += seconds;
      }
      loadedCount++;
      if (onProgress) onProgress(track, trackDurationMap[track.title], index);
      checkComplete();
      return;
    }
    
    const audio = new Audio();
    audio.preload = 'metadata';
    
    const handleLoad = () => {
      const duration = formatTime(audio.duration);
      trackDurationMap[track.title] = duration;
      totalDuration += audio.duration;
      loadedCount++;
      if (onProgress) onProgress(track, duration, index);
      checkComplete();
      audio.src = '';
    };
    
    const handleError = () => {
      trackDurationMap[track.title] = '--:--';
      loadedCount++;
      if (onProgress) onProgress(track, '--:--', index);
      checkComplete();
      audio.src = '';
    };
    
    audio.addEventListener('loadedmetadata', handleLoad);
    audio.addEventListener('error', handleError);
    audio.src = track.file;
  });
}

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
  const audioFileProvided = track.file && track.file !== '';
  
  // Function to show the audio missing warning
  function showAudioMissingWarning() {
    const warningContainer = document.getElementById('audio-warning-container');
    if (warningContainer) {
      warningContainer.innerHTML = `
        <div class="bg-yellow-800 border border-yellow-600 text-yellow-200 px-4 py-3 rounded mb-4">
          <div class="flex items-center">
            <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path>
            </svg>
            <span class="font-medium">Audio file not found</span>
          </div>
          <p class="mt-1 text-sm">The audio file for this track is missing, invalid, or too short (under 10 seconds).</p>
        </div>
      `;
    }
  }
  
  // Function to disable player controls
  function disablePlayerControls() {
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
  }
  
  // Disable player controls if no audio file provided
  if (!audioFileProvided) {
    showAudioMissingWarning();
    disablePlayerControls();
    return; // Exit early if no audio
  }
  
  // Check audio duration when metadata loads - if under 10 seconds, treat as missing
  audio.addEventListener('loadedmetadata', function checkDuration() {
    if (audio.duration < 10) {
      showAudioMissingWarning();
      disablePlayerControls();
      audio.removeEventListener('loadedmetadata', checkDuration);
    }
  });
  
  // Also handle error loading audio file
  audio.addEventListener('error', function() {
    showAudioMissingWarning();
    disablePlayerControls();
  });

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
  // Load current user's reposts if authenticated
  try { const auth = await getAuthStatus(); if (auth.isLoggedIn && auth.user) await loadCurrentUserReposts(auth.user.id); } catch(e){}
  
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

async function searchPlaylists(query) {
  try {
    // Fetch all playlists from the server
    const response = await fetch(`/api/playlists`);
    if (!response.ok) {
      throw new Error('Failed to fetch playlists');
    }
    const data = await response.json();
    const playlists = data.playlists || [];
    
    // Filter playlists by name or description
    const q = query.toLowerCase();
    return playlists.filter(p => 
      p.name.toLowerCase().includes(q) || 
      (p.description || '').toLowerCase().includes(q)
    );
  } catch (error) {
    console.error('Error searching playlists:', error);
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

  const artistSet = new Set();
  tracks
    .filter(t => t.artist.toLowerCase().includes(q))
    .forEach(t => {
      // Parse multi-artist tracks and add each individual artist
      const artists = parseArtists(t.artist);
      artists.forEach(artist => {
        if (artist.toLowerCase().includes(q)) {
          artistSet.add(artist);
        }
      });
    });

  // Search for users and playlists
  Promise.all([
    searchUsers(query),
    searchPlaylists(query)
  ]).then(([matchingUsers, matchingPlaylists]) => {
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

    if (matchingPlaylists.length) {
      html += `<h3 class="text-xl font-semibold mt-6 mb-2">Playlists</h3>
        <div class="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        ${matchingPlaylists.map(playlist =>
          `<div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200 track cursor-pointer" onclick="navigateTo('/playlist/${playlist.id}')">
            <div class="flex items-center mb-2">
              <svg class="w-8 h-8 text-purple-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path>
              </svg>
            </div>
            <div class="font-semibold text-lg">${escapeHtml(playlist.name)}</div>
            ${playlist.description ? `<div class="text-sm text-gray-400 mt-1 line-clamp-2">${escapeHtml(playlist.description)}</div>` : '<div class="text-sm text-gray-400 mt-1">No description</div>'}
            <div class="text-xs text-gray-500 mt-2">${playlist.songs.length} songs</div>
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
          const verifiedBadge = renderVerifiedBadge(user.isVerified, true);
          const profilePicHtml = user.profilePicture 
            ? `<div class="w-12 h-12 rounded-full" style="background-image: url('${user.profilePicture}'); background-size: cover; background-position: center;"></div>`
            : `<div class="w-12 h-12 ${gradientClass} rounded-full flex items-center justify-center text-white font-bold text-lg">${user.username.charAt(0).toUpperCase()}</div>`;
          return `<div class="bg-gray-800 rounded-lg shadow p-4 hover:bg-gray-700 transition duration-200 track">
            <div class="flex items-center space-x-3">
              ${profilePicHtml}
              <div class="flex-1">
                <div class="font-semibold cursor-pointer hover:underline flex items-center" onclick="navigateTo('/profile/${user.id}')">${escapeHtml(user.username)}${verifiedBadge}${adminBadge}</div>
                ${user.bio ? `<div class="text-sm text-gray-400 mt-1 line-clamp-2 biotext">${escapeHtml(user.bio)}</div>` : ''}
              </div>
            </div>
          </div>`;
        }).join("")}
        </div>`;
    }

    if (!matchingTracks.length && !albumMap.size && !artistSet.size && !matchingPlaylists.length && !matchingUsers.length) {
      html += `<p class="text-gray-400 mt-6">No results found.</p>`;
    }

    html += `<br><br>`

    getApp().innerHTML = html;
  }).catch(error => {
    console.error('Error during search:', error);
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

  // Show/hide notification bell based on login status
  const notificationBell = document.getElementById("notification-bell");
  if (notificationBell) {
    notificationBell.classList.toggle("hidden", !isLoggedIn);
    // Update badge count when logged in
    if (isLoggedIn) {
      updateNotificationBadge();
    }
  }

  const addSongLink = document.getElementById("add-song-link");
  if (addSongLink) {
    // Show for admins immediately, check verified status for regular users
    if (isAdmin) {
      addSongLink.style.display = "inline-block";
    } else if (isLoggedIn && user) {
      // Fetch user profile to check verification status
      try {
        const profileRes = await fetch(`/api/profile/${user.id}`);
        const profileData = await profileRes.json();
        if (profileData.success && profileData.user.isVerified) {
          addSongLink.style.display = "inline-block";
        } else {
          addSongLink.style.display = "none";
        }
      } catch (err) {
        addSongLink.style.display = "none";
      }
    } else {
      addSongLink.style.display = "none";
    }
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
  const profileLink = document.getElementById("profile-link");
  
  if (!profileLink) return;
  
  if (isLoggedIn && user) {
    // Update text content to show username
    profileLink.textContent = user.username;
    profileLink.onclick = () => navigateTo(`/profile/${user.id}`);
    profileLink.classList.remove("hidden");
  } else {
    profileLink.classList.add("hidden");
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
  const verifiedBadge = renderVerifiedBadge(c.isVerified, true);
  const adminBadge = c.isAdmin ? ' <span class="text-xs bg-yellow-600 text-yellow-100 px-1 py-0.5 rounded ml-1">ADMIN</span>' : '';
  
  // Use profile picture if available, otherwise use gradient
  const profilePictureHtml = c.profilePicture ? 
    `<div class="w-8 h-8 rounded-full" style="background-image: url('${c.profilePicture}'); background-size: cover; background-position: center;"></div>` :
    `<div class="w-8 h-8 rounded-full profile-gradient-${c.selectedGradient || 1} flex items-center justify-center text-xs font-bold text-white">${initials}</div>`;
  
  return `
    <div class="track p-4 rounded" data-comment-id="${c.id}">
      <div class="flex items-center gap-3 mb-2">
        ${profilePictureHtml}
        <div class="flex-1">
          <span class="flex items-center">
            <a class="hover:underline profilelink cursor-pointer" href="${profileHref}" onclick="navigateTo('${profileHref}'); return false;">${c.username}</a>${verifiedBadge}${adminBadge}
          </span>
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

// --- Collaborative Playlist Functions ---

function showCollaboratorModal(playlistId) {
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
  modal.innerHTML = `
    <div class="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
      <h3 class="text-xl font-bold mb-4">Manage Collaborators</h3>
      <div class="space-y-4">
        <div>
          <input type="text" id="collaborator-username" placeholder="Enter username..." 
                 class="w-full p-2 bg-gray-700 rounded text-white">
          <button onclick="addCollaborator('${playlistId}')" 
                  class="mt-2 bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-white text-sm w-full">
            Add Collaborator
          </button>
        </div>
        <div id="collaborator-list" class="max-h-40 overflow-y-auto">
        </div>
        <div class="flex gap-2">
          <button onclick="closeCollaboratorModal()" 
                  class="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded text-white text-sm">
            Close
          </button>
        </div>
      </div>
      <div id="collaborator-error" class="text-red-400 text-sm mt-2 hidden"></div>
    </div>
  `;
  
  document.body.appendChild(modal);
  loadCollaboratorsList(playlistId);
  
  // Focus on input
  setTimeout(() => {
    document.getElementById('collaborator-username').focus();
  }, 100);
  
  // Close modal when clicking outside
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeCollaboratorModal();
    }
  });
  
  // Handle Enter key in input
  document.getElementById('collaborator-username').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addCollaborator(playlistId);
    }
  });
}

function closeCollaboratorModal() {
  const modal = document.querySelector('.fixed.inset-0');
  if (modal) {
    modal.remove();
  }
}

async function loadCollaboratorsList(playlistId) {
  try {
    const response = await fetch(`/api/playlists/${playlistId}/collaborators`);
    const data = await response.json();
    
    const listEl = document.getElementById('collaborator-list');
    if (data.success && data.collaborators.length > 0) {
      listEl.innerHTML = data.collaborators.map(collab => {
        const profilePic = collab.profilePicture ? 
          `<div class="w-8 h-8 rounded-full" style="background-image: url('${collab.profilePicture}'); background-size: cover; background-position: center;"></div>` :
          `<div class="w-8 h-8 rounded-full profile-gradient-${collab.selectedGradient || 1} flex items-center justify-center text-xs font-bold text-white">${(collab.username || '').substring(0,1).toUpperCase()}</div>`;
        
        return `
          <div class="flex items-center justify-between p-2 bg-gray-700 rounded">
            <div class="flex items-center gap-2">
              ${profilePic}
              <span class="text-sm">${escapeHtml(collab.username)}</span>
            </div>
            <button onclick="removeCollaborator('${playlistId}', '${collab.id}')" 
                    class="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded">
              Remove
            </button>
          </div>
        `;
      }).join('');
    } else {
      listEl.innerHTML = '<p class="text-gray-400 text-sm text-center py-4">No collaborators yet</p>';
    }
  } catch (error) {
    console.error('Error loading collaborators:', error);
    document.getElementById('collaborator-list').innerHTML = '<p class="text-red-400 text-sm">Failed to load collaborators</p>';
  }
}

async function addCollaborator(playlistId) {
  const usernameInput = document.getElementById('collaborator-username');
  const errorEl = document.getElementById('collaborator-error');
  const username = usernameInput.value.trim();
  
  if (!username) {
    showCollaboratorError('Please enter a username');
    return;
  }
  
  try {
    const response = await fetch(`/api/playlists/${playlistId}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    const data = await response.json();
    
    if (data.success) {
      usernameInput.value = '';
      hideCollaboratorError();
      loadCollaboratorsList(playlistId);
    } else {
      showCollaboratorError(data.error || 'Failed to add collaborator');
    }
  } catch (error) {
    console.error('Error adding collaborator:', error);
    showCollaboratorError('Failed to add collaborator. Please try again.');
  }
}

async function removeCollaborator(playlistId, collaboratorId) {
  if (!confirm('Remove this collaborator? They will lose edit access to this playlist.')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/playlists/${playlistId}/collaborators/${collaboratorId}`, {
      method: 'DELETE'
    });
    
    const data = await response.json();
    
    if (data.success) {
      // If modal is open, refresh the list
      const modal = document.querySelector('.fixed.inset-0');
      if (modal) {
        loadCollaboratorsList(playlistId);
      }
      // Refresh the playlist page to update the collaborators display
      renderPlaylist(playlistId);
    } else {
      alert('Failed to remove collaborator: ' + (data.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('Error removing collaborator:', error);
    alert('Failed to remove collaborator. Please try again.');
  }
}

function showCollaboratorError(message) {
  const errorEl = document.getElementById('collaborator-error');
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function hideCollaboratorError() {
  const errorEl = document.getElementById('collaborator-error');
  errorEl.classList.add('hidden');
}

// ==================== NOTIFICATION SYSTEM ====================

async function updateNotificationBadge() {
  try {
    const response = await fetch('/api/notifications');
    const data = await response.json();
    
    const badge = document.getElementById('notification-badge');
    const bellBtn = document.getElementById('notification-bell');
    
    if (!badge || !bellBtn) return;
    
    if (data.success && data.notifications && data.notifications.length > 0) {
      const count = data.notifications.length;
      badge.textContent = count > 9 ? '9+' : count;
      badge.style.display = 'flex';
      bellBtn.classList.add('has-notifications');
    } else {
      badge.style.display = 'none';
      bellBtn.classList.remove('has-notifications');
    }
  } catch (error) {
    console.error('Error updating notification badge:', error);
  }
}

async function toggleNotificationModal() {
  let overlay = document.getElementById('notification-modal-overlay');
  
  if (overlay) {
    // Close modal and clear notifications
    overlay.remove();
    // Clear notifications when modal is closed (moves to history)
    try {
      await fetch('/api/notifications', { method: 'DELETE' });
      updateNotificationBadge();
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
    return;
  }
  
  // Open modal
  overlay = document.createElement('div');
  overlay.id = 'notification-modal-overlay';
  overlay.className = 'notification-modal-overlay';
  overlay.innerHTML = `
    <div class="notification-modal-content">
      <div class="notification-modal-header">
        <h2>Notifications</h2>
        <button class="close-notification-modal" onclick="toggleNotificationModal()">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="notification-list">
        <div class="notification-loading">Loading notifications...</div>
      </div>
      <div class="notification-modal-footer">
        <button class="notification-history-btn" onclick="toggleNotificationHistory(this)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          View History
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      toggleNotificationModal();
    }
  });
  
  // Load notifications
  await loadNotifications(overlay, false);
}

async function loadNotifications(overlay, showHistory) {
  const notificationList = overlay.querySelector('.notification-list');
  notificationList.innerHTML = '<div class="notification-loading">Loading...</div>';
  
  try {
    const endpoint = showHistory ? '/api/notifications/history' : '/api/notifications';
    const response = await fetch(endpoint);
    const data = await response.json();
    
    const items = showHistory ? data.history : data.notifications;
    
    if (items && items.length > 0) {
      notificationList.innerHTML = items.map(notif => `
        <div class="notification-item" onclick="window.location = '${notif.artistSlug}/${notif.trackSlug}'; toggleNotificationModal();">
          <div class="notification-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <polygon points="10 8 16 12 10 16 10 8"></polygon>
            </svg>
          </div>
          <div class="notification-content">
            <div class="notification-title">${notif.artistName} released a new track</div>
            <div class="notification-track">${notif.trackTitle}</div>
            <div class="notification-time">${formatNotificationTime(notif.createdAt)}</div>
          </div>
        </div>
      `).join('');
    } else {
      const emptyMessage = showHistory 
        ? 'No notification history yet'
        : 'No new notifications';
      const emptySubtext = showHistory
        ? 'Your past notifications will appear here'
        : 'Follow artists to get notified when they release new music';
      
      notificationList.innerHTML = `
        <div class="notification-empty">
          <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          <p>${emptyMessage}</p>
          <span>${emptySubtext}</span>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading notifications:', error);
    notificationList.innerHTML = '<div class="notification-empty"><p>Failed to load notifications</p></div>';
  }
}

async function toggleNotificationHistory(btn) {
  const overlay = document.getElementById('notification-modal-overlay');
  if (!overlay) return;
  
  const isShowingHistory = btn.classList.contains('active');
  
  if (isShowingHistory) {
    // Switch back to current notifications
    btn.classList.remove('active');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <polyline points="12 6 12 12 16 14"></polyline>
      </svg>
      View History
    `;
    // update header
    overlay.querySelector('.notification-modal-header h2').textContent = 'Notifications';
    await loadNotifications(overlay, false);
  } else {
    // switch to history
    btn.classList.add('active');
    btn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
      View New
    `;
    overlay.querySelector('.notification-modal-header h2').textContent = 'Notification History';
    await loadNotifications(overlay, true);
  }
}

function formatNotificationTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return days === 1 ? '1 day ago' : `${days} days ago`;
  if (hours > 0) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  if (minutes > 0) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
  return 'Just now';
}

function renderRepostItem(track) {
  const artistSlug = slugify(parseArtists(track.artist)[0] || track.artist);
  const songSlug = slugify(track.title);
  const isReposted = isTrackReposted(artistSlug, songSlug);
  const accentColor = getThemeAccentColor();
  const duration = trackDurationMap[track.title] || '--:--';
  const progressId = `repost-progress-fill-${artistSlug}-${songSlug}`;
  const timestampId = `repost-timestamp-${artistSlug}-${songSlug}`;
  
  return `
    <div class="profile-repost-item repost-card">
      <img src="${track.cover}" class="profile-repost-cover" alt="Cover">
      
      <div class="profile-repost-content">
        <div class="profile-repost-top">
          <button class="profile-repost-play-btn" onclick="playRepostTrack('${artistSlug}', '${songSlug}')">
             <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none">
               <polygon points="5 3 19 12 5 21 5 3"/>
             </svg>
          </button>

          <div class="profile-repost-info">
            <div class="profile-repost-title" onclick="navigateTo('/${artistSlug}/${songSlug}')">${escapeHtml(track.title)}</div>
            <div class="profile-repost-artist">
              ${renderArtistLinks(track.artist)}
              <span class="profile-repost-separator">•</span>
              <span class="profile-repost-link" onclick="navigateTo('/album/${slugify(track.album)}')">${escapeHtml(track.album)}</span>
            </div>
          </div>
          
          <button class="profile-repost-action-btn" 
                  style="${isReposted ? `color: ${accentColor}` : ''}"
                  onclick="event.stopPropagation(); toggleRepostButton(this, '${artistSlug}', '${songSlug}', '${escapeHtml(track.title)}', '${escapeHtml(track.artist)}')"
                  title="${isReposted ? 'Unrepost' : 'Repost'}">
            <svg viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="width:20px;height:20px;"><path d="M7.08034 5.71966L4.05001 2.68933L1.01968 5.71966L2.08034 6.78032L3.30002 5.56065V9.75C3.30002 11.2688 4.53124 12.5 6.05002 12.5H8.05002V11H6.05002C5.35966 11 4.80002 10.4404 4.80002 9.75V5.56066L6.01968 6.78032L7.08034 5.71966Z" fill="currentColor"></path><path d="M11.95 13.3107L8.91969 10.2803L9.98035 9.21968L11.2 10.4393L11.2 5.75C11.2 5.05964 10.6404 4.5 9.95001 4.5L7.95001 4.5L7.95001 3L9.95001 3C11.4688 3 12.7 4.23122 12.7 5.75L12.7 10.4394L13.9197 9.21968L14.9803 10.2803L11.95 13.3107Z" fill="currentColor"></path></svg>
          </button>
        </div>

        <div class="profile-repost-progress-container">
          <div id="${timestampId}" class="profile-repost-timestamp">0:00 / ${duration}</div>
          <div class="profile-repost-bar-bg">
            <div id="${progressId}" class="profile-repost-bar-fill" style="background-color: ${accentColor}"></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function playRepostTrack(artistSlug, songSlug) {
  const track = tracks.find(t => trackHasArtist(t, artistSlug) && slugify(t.title) === songSlug);
  if (!track) return;
  
  albumPlayer.tracks = [track];
  albumPlayer.albumSlug = 'reposts';
  albumPlayer.currentIndex = 0;
  albumPlayer.loopMode = 0;
  
  // Need to ensure global tracks array is used correctly or we might lose context?
  // Actually albumPlayer relies on .tracks property.
  
  addTracksToQueue([track], true);
  
  // startAlbumAudio calls playTrack(albumPlayer.currentIndex) which uses albumPlayer.tracks
  startAlbumAudio();
  updatePersistentPlayer();
}

function getThemeAccentColor() {
  const body = document.body;
  
  if (body.classList.contains('theme-midnight-blurple')) return '#9b89fd';
  if (body.classList.contains('theme-strawberry-lemonade')) return '#e84c8c';
  if (body.classList.contains('theme-ocean-breeze')) return '#20B2AA';
  if (body.classList.contains('theme-sunset-glow')) return '#FF6347';
  if (body.classList.contains('theme-lavender-dreams')) return '#9370DB';
  if (body.classList.contains('theme-game')) return '#f41414'; 
  if (body.classList.contains('theme-sc')) return '#f45714';
  if (body.classList.contains('theme-forest-night')) return '#32CD32';
  if (body.classList.contains('theme-aero-glass')) return '#4A90E2';
  
  return '#3b82f6'; // Default Blue
}

