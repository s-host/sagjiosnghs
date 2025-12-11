const express = require("express");
const session = require("express-session");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const archiver = require("archiver");
const extract = require("extract-zip");
const app = express();
const PORT = 3000;
const multer = require("multer");
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "audio"));
  },
  filename: (req, file, cb) => {
    // save og filename
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: '34867n36%3s23y8s63qw01',
  resave: false,
  saveUninitialized: false
}));

// Store active user sessions for ban enforcement
const activeSessions = new Map(); // userId -> Set of sessionIds

// Middleware to track user sessions
app.use((req, res, next) => {
  if (req.session && req.session.user) {
    const userId = req.session.user.id;
    const sessionId = req.sessionID;
    
    if (!activeSessions.has(userId)) {
      activeSessions.set(userId, new Set());
    }
    activeSessions.get(userId).add(sessionId);
  }
  next();
});

// Middleware to check if user is banned/muted on each request
app.use((req, res, next) => {
  if (req.session && req.session.user && !req.session.isAdmin) {
    const user = users.find(u => u.id === req.session.user.id);
    if (user && user.banned) {
      // Destroy session for banned user
      req.session.destroy();
      return res.status(403).json({ 
        success: false, 
        error: 'Your account has been banned. Please contact an administrator.',
        banned: true 
      });
    }
  }
  next();
});

function reloadTracksFromFile() {
  if (fs.existsSync(tracksFile)) {
    tracks = JSON.parse(fs.readFileSync(tracksFile, "utf-8"));
  }
}

function ensureAdmin(req, res, next) {
  // Check if user is logged in
  if (!req.session || (!req.session.isLoggedIn && !req.session.isAdmin)) {
    return res.status(403).json({ error: "Access denied. Admins only." });
  }
  
  // Check if it's the hardcoded admin
  if (req.session.isAdmin) {
    return next();
  }
  
  // Check if it's a user with admin privileges in users.json
  if (req.session.user && req.session.user.id) {
    const user = users.find(u => u.id === req.session.user.id);
    if (user && user.isAdmin) {
      return next();
    }
  }
  
  return res.status(403).json({ error: "Access denied. Admins only." });
}

// load existing track data
const tracksFile = path.join(__dirname, "data", "tracks.json");
let tracks = [];

if (fs.existsSync(tracksFile)) {
  tracks = JSON.parse(fs.readFileSync(tracksFile, "utf-8"));
}

// --- Comments storage ---
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  try { fs.mkdirSync(dataDir, { recursive: true }); } catch (_) {}
}
const commentsFile = path.join(dataDir, "comments.json");
let commentsByTrack = {};
try {
  if (!fs.existsSync(commentsFile)) {
    // Initialize empty comments store if not present
    fs.writeFileSync(commentsFile, "{}", "utf-8");
  }
  commentsByTrack = JSON.parse(fs.readFileSync(commentsFile, "utf-8"));
} catch (e) {
  console.error("Failed to read/initialize comments.json, starting fresh.", e);
  commentsByTrack = {};
}
function saveComments() {
  try {
    fs.writeFileSync(commentsFile, JSON.stringify(commentsByTrack, null, 2));
  } catch (e) {
    console.error("Failed to write comments.json", e);
  }
}

// --- Activity tracking storage ---
const activityFile = path.join(dataDir, "activity.json");
let userActivity = {};
try {
  if (!fs.existsSync(activityFile)) {
    // Initialize empty activity store if not present
    fs.writeFileSync(activityFile, "{}", "utf-8");
  }
  userActivity = JSON.parse(fs.readFileSync(activityFile, "utf-8"));
} catch (e) {
  console.error("Failed to read/initialize activity.json, starting fresh.", e);
  userActivity = {};
}
function saveActivity() {
  try {
    fs.writeFileSync(activityFile, JSON.stringify(userActivity, null, 2));
  } catch (e) {
    console.error("Failed to write activity.json", e);
  }
}

// --- Playlists storage ---
const playlistsFile = path.join(dataDir, "playlists.json");
let playlists = [];
try {
  if (!fs.existsSync(playlistsFile)) {
    // Initialize empty playlists store if not present
    fs.writeFileSync(playlistsFile, "[]", "utf-8");
  }
  playlists = JSON.parse(fs.readFileSync(playlistsFile, "utf-8"));
} catch (e) {
  console.error("Failed to read/initialize playlists.json, starting fresh.", e);
  playlists = [];
}
function savePlaylists() {
  try {
    fs.writeFileSync(playlistsFile, JSON.stringify(playlists, null, 2));
  } catch (e) {
    console.error("Failed to write playlists.json", e);
  }
}

// --- Follows storage ---
const followsFile = path.join(dataDir, "follows.json");
let follows = {}; // { artistSlug: [userId1, userId2, ...] }
try {
  if (!fs.existsSync(followsFile)) {
    fs.writeFileSync(followsFile, "{}", "utf-8");
  }
  follows = JSON.parse(fs.readFileSync(followsFile, "utf-8"));
} catch (e) {
  console.error("Failed to read/initialize follows.json, starting fresh.", e);
  follows = {};
}
function saveFollows() {
  try {
    fs.writeFileSync(followsFile, JSON.stringify(follows, null, 2));
  } catch (e) {
    console.error("Failed to write follows.json", e);
  }
}

// --- Notifications storage ---
const notificationsFile = path.join(dataDir, "notifications.json");
// Structure: { userId: { unread: [...], history: [...] } }
let notifications = {};
try {
  if (!fs.existsSync(notificationsFile)) {
    fs.writeFileSync(notificationsFile, "{}", "utf-8");
  }
  const raw = JSON.parse(fs.readFileSync(notificationsFile, "utf-8"));
  // Migrate old format if needed
  Object.keys(raw).forEach(userId => {
    if (Array.isArray(raw[userId])) {
      // Old format - migrate to new
      notifications[userId] = { unread: raw[userId], history: [] };
    } else {
      notifications[userId] = raw[userId];
    }
  });
} catch (e) {
  console.error("Failed to read/initialize notifications.json, starting fresh.", e);
  notifications = {};
}
function saveNotifications() {
  try {
    fs.writeFileSync(notificationsFile, JSON.stringify(notifications, null, 2));
  } catch (e) {
    console.error("Failed to write notifications.json", e);
  }
}

// Helper to notify followers when a new track is added
function notifyFollowersOfNewTrack(artistSlug, artistName, trackTitle, trackSlug) {
  const followers = follows[artistSlug] || [];
  const now = Date.now();
  
  followers.forEach(userId => {
    if (!notifications[userId]) {
      notifications[userId] = { unread: [], history: [] };
    }
    notifications[userId].unread.unshift({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'new_release',
      artistSlug,
      artistName,
      trackTitle,
      trackSlug,
      createdAt: now
    });
  });
  
  if (followers.length > 0) {
    saveNotifications();
  }
}

// basic profanity list; case-insensitive; replace with ***
const PROFANITY = [
  'fuck','shit','bitch','asshole','bastard','dick','cunt','piss','slut','whore','fag','retard','nigger','motherfucker','bullshit','cock','prick','twat','wank','cum'
];
function censorText(text) {
  if (!text || typeof text !== 'string') return '';
  let result = text;
  PROFANITY.forEach(word => {
    const re = new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'gi');
    result = result.replace(re, '***');
  });
  return result;
}

// Build a track key from provided slugs; keep exactly as provided to avoid mismatch
function trackKeyFromSlugs(artistSlug, songSlug) {
  return `${artistSlug}/${songSlug}`;
}

// Comments endpoints (router)
const commentsRouter = express.Router();

// Debug: ping to verify router mounting
commentsRouter.get('/ping', (req, res) => {
  res.json({ success: true, message: 'comments router ok' });
});

commentsRouter.get('/:artistSlug/:songSlug', (req, res) => {
  const { artistSlug, songSlug } = req.params;
  const key = trackKeyFromSlugs(artistSlug, songSlug);
  const list = commentsByTrack[key] || [];
  
  // Enhance comments with current user information (gradient and profile picture)
  const enhancedComments = list.map(comment => {
    let currentGradient = 1; // default
    let profilePicture = null;
    
    if (comment.userId === '0') {
      // Admin comment - check session if available, otherwise use default
      currentGradient = (req.session.admin && req.session.admin.selectedGradient) || 1;
      profilePicture = (req.session.admin && req.session.admin.profilePicture) || null;
    } else {
      // Regular user comment - look up current user info
      const user = users.find(u => u.id === comment.userId);
      if (user) {
        currentGradient = user.selectedGradient || 1;
        profilePicture = user.profilePicture || null;
      }
    }
    
    // Always use current user info, not stored info
    return { ...comment, selectedGradient: currentGradient, profilePicture };
  });
  
  res.json({ success: true, comments: enhancedComments });
});

commentsRouter.post('/:artistSlug/:songSlug', (req, res) => {
  const { artistSlug, songSlug } = req.params;
  const { text } = req.body || {};

  // Require auth (user or admin)
  if (!req.session.isLoggedIn && !req.session.isAdmin) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  // Check if user is muted (only for regular users, not admin)
  if (req.session.user && !req.session.isAdmin) {
    const user = users.find(u => u.id === req.session.user.id);
    if (user && user.muted) {
      return res.status(403).json({ success: false, error: 'You are muted and cannot post comments' });
    }
    
    // Check if user is banned
    if (user && user.banned) {
      return res.status(403).json({ success: false, error: 'You are banned and cannot post comments' });
    }
  }

  const trimmed = (text || '').toString().trim();
  if (!trimmed) {
    return res.status(400).json({ success: false, error: 'Comment text is required' });
  }
  if (trimmed.length > 500) {
    return res.status(400).json({ success: false, error: 'Comment too long (max 500 characters)' });
  }

  // simple per-session rate limit: 1 comment per 2 seconds
  const now = Date.now();
  req.session.lastCommentAt = req.session.lastCommentAt || 0;
  if (now - req.session.lastCommentAt < 2000) {
    return res.status(429).json({ success: false, error: 'Please wait before posting another comment' });
  }
  req.session.lastCommentAt = now;

  const key = trackKeyFromSlugs(artistSlug, songSlug);
  if (!commentsByTrack[key]) commentsByTrack[key] = [];

  // Identify user
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'User session not found' });
  }

  const userId = req.session.user.id;
  const username = req.session.user.username;

  const newComment = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    username,
    createdAt: new Date().toISOString(),
    text: censorText(trimmed)
  };
  commentsByTrack[key].push(newComment);
  saveComments();
  
  // Add current gradient for immediate display
  const user = users.find(u => u.id === userId);
  const currentGradient = user ? (user.selectedGradient || 1) : 1;
  
  const responseComment = { ...newComment, selectedGradient: currentGradient };
  res.json({ success: true, comment: responseComment });
});

// Edit existing comment
commentsRouter.put('/:artistSlug/:songSlug/:commentId', (req, res) => {
  const { artistSlug, songSlug, commentId } = req.params;
  const { text } = req.body || {};

  // Require auth
  if (!req.session.isLoggedIn && !req.session.isAdmin) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const key = trackKeyFromSlugs(artistSlug, songSlug);
  const list = commentsByTrack[key] || [];
  const idx = list.findIndex(c => c.id === commentId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Comment not found' });
  }

  const authorId = list[idx].userId;
  const currentUserId = req.session.user ? req.session.user.id : null;
  const isOwner = currentUserId && currentUserId === authorId;
  const isAdmin = !!req.session.isAdmin;
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: 'You cannot edit this comment' });
  }

  const trimmed = (text || '').toString().trim();
  if (!trimmed) {
    return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
  }
  if (trimmed.length > 500) {
    return res.status(400).json({ success: false, message: 'Comment too long (max 500 chars)' });
  }

  list[idx].text = censorText(trimmed);
  list[idx].editedAt = new Date().toISOString();
  commentsByTrack[key] = list;
  saveComments();
  res.json({ success: true, comment: list[idx] });
});

// Delete existing comment
commentsRouter.delete('/:artistSlug/:songSlug/:commentId', (req, res) => {
  const { artistSlug, songSlug, commentId } = req.params;

  // Require auth
  if (!req.session.isLoggedIn && !req.session.isAdmin) {
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  const key = trackKeyFromSlugs(artistSlug, songSlug);
  const list = commentsByTrack[key] || [];
  const idx = list.findIndex(c => c.id === commentId);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: 'Comment not found' });
  }

  const authorId = list[idx].userId;
  const currentUserId = req.session.user ? req.session.user.id : null;
  const isOwner = currentUserId && currentUserId === authorId;
  const isAdmin = !!req.session.isAdmin;
  if (!isOwner && !isAdmin) {
    return res.status(403).json({ success: false, message: 'You cannot delete this comment' });
  }

  // Remove comment
  list.splice(idx, 1);
  commentsByTrack[key] = list;
  saveComments();
  res.json({ success: true });
});

app.use('/api/comments', commentsRouter);

// routes

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/tracks", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) {
    return res.json(tracks);
  }

  const filtered = tracks.filter(track =>
    track.title.toLowerCase().includes(q) ||
    track.artist.toLowerCase().includes(q)
  );

  res.json(filtered);
});

// Search users endpoint
app.get("/api/users/search", (req, res) => {
  const q = (req.query.q || "").toLowerCase().trim();
  if (!q) {
    return res.json([]);
  }

  // Search through registered users
  const matchingUsers = users.filter(user =>
    user.username.toLowerCase().includes(q)
  ).map(user => {
    // Return user data without password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });

  res.json(matchingUsers);
});

app.post("/api/tracks", ensureAdmin, (req, res) => {
  const track = req.body;
  track.createdAt = new Date().toISOString();
  tracks.unshift(track);

  fs.writeFileSync(tracksFile, JSON.stringify(tracks, null, 2));
  reloadTracksFromFile(); // <--- Add this line
  res.json({ track });
});

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const tracksFilePath = path.join(__dirname, 'data', 'tracks.json');

app.delete('/api/tracks/:artistSlug/:songSlug', ensureAdmin, (req, res) => {
  fs.readFile(tracksFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error('Error reading tracks.json:', err);
      return res.status(500).send('Internal Server Error: reading file failed');
    }

    let fileTracks;
    try {
      fileTracks = JSON.parse(data);
    } catch (parseErr) {
      console.error('Error parsing tracks.json:', parseErr);
      return res.status(500).send('Internal Server Error: parsing JSON failed');
    }

    const { artistSlug, songSlug } = req.params;
    const index = fileTracks.findIndex(track => {
      const aSlug = slugify(track.artist);
      const sSlug = slugify(track.title);
      return aSlug === artistSlug && sSlug === songSlug;
    });

    if (index === -1) {
      console.warn('Track not found to delete');
      return res.status(404).send('Track not found');
    }

    // Get audio file path (relative, e.g. "/audio/foo.mp3")
    const track = fileTracks[index];
    const audioPath = track.file ? path.join(__dirname, track.file.startsWith('/') ? track.file.slice(1) : track.file) : null;

    fileTracks.splice(index, 1);

    fs.writeFile(tracksFilePath, JSON.stringify(fileTracks, null, 2), 'utf8', writeErr => {
      if (writeErr) {
        console.error('Error writing tracks.json:', writeErr);
        return res.status(500).send('Internal Server Error: writing file failed');
      }

      reloadTracksFromFile(); // <--- Add this line

      // Also delete audio file if it exists
      if (audioPath && fs.existsSync(audioPath)) {
        fs.unlink(audioPath, (err) => {
          if (err) {
            console.error('Failed to delete audio file:', audioPath, err);
            // Don't fail the response, just log
          }
        });
      }

      console.log('Track and audio deleted successfully');
      res.status(200).send('Track and audio deleted');
    });
  });
});

// EDIT/UPDATE TRACK endpoint
app.put('/api/tracks/:artistSlug/:songSlug', ensureAdmin, (req, res) => {
  fs.readFile(tracksFilePath, 'utf8', (err, data) => {
    if (err) {
      return res.status(500).send('Internal Server Error: reading file failed');
    }

    let fileTracks;
    try {
      fileTracks = JSON.parse(data);
    } catch (parseErr) {
      return res.status(500).send('Internal Server Error: parsing JSON failed');
    }

    const { artistSlug, songSlug } = req.params;
    const index = fileTracks.findIndex(track => {
      const aSlug = slugify(track.artist);
      const sSlug = slugify(track.title);
      return aSlug === artistSlug && sSlug === songSlug;
    });

    if (index === -1) {
      return res.status(404).send('Track not found');
    }

    // Overwrite track with new data from req.body
    const updated = Object.assign({}, fileTracks[index], req.body);
    fileTracks[index] = updated;

    fs.writeFile(tracksFilePath, JSON.stringify(fileTracks, null, 2), 'utf8', writeErr => {
      if (writeErr) {
        return res.status(500).send('Internal Server Error: writing file failed');
      }
      reloadTracksFromFile(); // <--- Add this line
      res.json({ track: updated });
    });
  });
});

// Update track file endpoint (admin only)
app.put('/api/tracks/:artistSlug/:songSlug/file', ensureAdmin, upload.single("audioFile"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No audio file uploaded' });
    }

    const { artistSlug, songSlug } = req.params;
    
    // Find the track
    const trackIndex = tracks.findIndex(t => 
      slugify(t.artist) === artistSlug && 
      slugify(t.title) === songSlug
    );

    if (trackIndex === -1) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    // Update the track's file path
    const newFilePath = `/audio/${req.file.filename}`;
    tracks[trackIndex].file = newFilePath;

    // Save tracks to file
    fs.writeFileSync(tracksFile, JSON.stringify(tracks, null, 2));
    reloadTracksFromFile();

    res.json({ 
      success: true, 
      message: 'Track file updated successfully',
      newFilePath: newFilePath
    });
  } catch (error) {
    console.error('Track file update failed:', error);
    res.status(500).json({ success: false, error: 'File update failed: ' + error.message });
  }
});

// Update track audio file path (admin only - just updates the path, doesn't upload file)
app.patch('/api/tracks/:artistSlug/:songSlug', ensureAdmin, (req, res) => {
  try {
    const { artistSlug, songSlug } = req.params;
    const { file } = req.body;

    if (!file) {
      return res.status(400).json({ success: false, error: 'Audio file path is required' });
    }

    // Find the track
    const trackIndex = tracks.findIndex(t => 
      slugify(t.artist) === artistSlug && 
      slugify(t.title) === songSlug
    );

    if (trackIndex === -1) {
      return res.status(404).json({ success: false, error: 'Track not found' });
    }

    // Update the track's file path
    tracks[trackIndex].file = file;

    // Save tracks to file
    fs.writeFileSync(tracksFile, JSON.stringify(tracks, null, 2));
    reloadTracksFromFile();

    res.json({ 
      success: true, 
      message: 'Track audio file path updated successfully',
      track: tracks[trackIndex]
    });
  } catch (error) {
    console.error('Track update failed:', error);
    res.status(500).json({ success: false, error: 'Update failed: ' + error.message });
  }
});

// load existing users data
const usersFile = path.join(__dirname, "data", "users.json");
let users = [];

if (fs.existsSync(usersFile)) {
  try {
    users = JSON.parse(fs.readFileSync(usersFile, "utf-8"));
  } catch (err) {
    console.error("Error reading users.json:", err);
    users = [];
  }
}

function saveUsers() {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// verification questions for registration
const VERIFICATION_QUESTIONS = [
  { question: "What is 5 + 7?", answer: "12" },
  { question: "What color do you get when you mix red and blue?", answer: "purple" },
  { question: "How many days are in a week?", answer: "7" },
  { question: "What is the capital of France?", answer: "paris" },
  { question: "What is 3 × 4?", answer: "12" }
];

// get verification question endpoint
app.get("/api/verification-question", (req, res) => {
  const randomIndex = Math.floor(Math.random() * VERIFICATION_QUESTIONS.length);
  const randomQuestion = VERIFICATION_QUESTIONS[randomIndex];
  res.json({ question: randomQuestion.question, id: randomIndex });
});

// user registration endpoint
app.post("/api/register", async (req, res) => {
  const { username, password, verificationAnswer, verificationId, bio } = req.body;

  if (!username || !password || !verificationAnswer || verificationId === undefined) {
    return res.status(400).json({ success: false, message: "All fields are required" });
  }

  // validate username (alphanumeric and underscore only, 3-20 chars)
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ 
      success: false, 
      message: "Username must be 3-20 characters and contain only letters, numbers, and underscores" 
    });
  }

  // validate password (min 6 characters)
  if (password.length < 6) {
    return res.status(400).json({ 
      success: false, 
      message: "Password must be at least 6 characters long" 
    });
  }

  // check verification answer
  if (verificationId < 0 || verificationId >= VERIFICATION_QUESTIONS.length) {
    return res.status(400).json({ success: false, message: "Invalid verification question" });
  }

  const correctAnswer = VERIFICATION_QUESTIONS[verificationId].answer.toLowerCase().trim();
  if (verificationAnswer.toLowerCase().trim() !== correctAnswer) {
    return res.status(400).json({ success: false, message: "Incorrect verification answer" });
  }

  // check if username already exists (case insensitive)
  const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existingUser) {
    return res.status(409).json({ success: false, message: "Username already exists" });
  }

  try {
    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Calculate sequential ID
    const sequentialId = users.length + 1;

    // create new user
    const newUser = {
      id: sequentialId.toString(),
      username: username,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      isAdmin: false,
      bio: bio || "",
      selectedGradient: 1,
      profilePicture: null
    };

    users.push(newUser);
    saveUsers();

    res.json({ success: true, message: "Account created successfully" });
  } catch (error) {
    console.error("Password hashing error:", error);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
});

// login endpoint
app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  // Find user
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  
  if (!user) {
    return res.status(401).json({ success: false, message: "User not found" });
  }

  // Check if user is banned
  if (user.banned) {
    return res.status(403).json({ 
      success: false, 
      message: 'Your account has been banned. Please contact an administrator.',
      banned: true 
    });
  }

  try {
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: "Incorrect password" });
    }

    // Login successful
    req.session.isLoggedIn = true;
    const isUserAdmin = !!user.isAdmin;
    req.session.user = { 
      id: user.id, 
      username: user.username, 
      isAdmin: isUserAdmin
    };
    
    // Set isAdmin flag if user has admin privileges
    if (isUserAdmin) {
      req.session.isAdmin = true;
    }
    
    res.json({ 
      success: true, 
      isAdmin: isUserAdmin, 
      user: { 
        id: user.id, 
        username: user.username, 
        isAdmin: isUserAdmin 
      } 
    });
  } catch (error) {
    console.error("Password comparison error:", error);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// logout
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// check login status
app.get("/api/auth-status", (req, res) => {
  res.json({ 
    isAdmin: !!req.session.isAdmin,
    isLoggedIn: !!req.session.isLoggedIn || !!req.session.isAdmin,
    user: req.session.user || null
  });
});

// get user profile
app.get("/api/profile/:userId", (req, res) => {
  const { userId } = req.params;

  // Find user by ID
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const { password, ...userProfile } = user;
  // Ensure gradient selection exists
  if (!userProfile.selectedGradient) {
    userProfile.selectedGradient = 1; // Default gradient
  }
  res.json({ success: true, user: userProfile });
});

// Add endpoint to update user profile (requires authentication)
app.put("/api/profile/:userId", async (req, res) => {
  const { userId } = req.params;
  const { bio } = req.body;
  
  // Check authentication
  if (!req.session.isLoggedIn && !req.session.isAdmin) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  // Check if user can edit this profile
  if (!req.session.isAdmin && req.session.user.id !== userId) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Update user bio
  if (bio !== undefined) {
    users[userIndex].bio = bio;
  }

  saveUsers();
  const { password, ...userProfile } = users[userIndex];
  res.json({ success: true, user: userProfile });
});

// Change password endpoint (requires authentication)
app.put("/api/profile/:userId/change-password", async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;

  // Check authentication
  if (!req.session.isLoggedIn && !req.session.isAdmin) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  // Check if user can change this password (must be own account)
  if (!req.session.isAdmin && req.session.user.id !== userId) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // Validate new password
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: "New password must be at least 6 characters long" });
  }

  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  try {
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, users[userIndex].password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    users[userIndex].password = hashedPassword;
    saveUsers();

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    console.error("Password change error:", error);
    res.status(500).json({ success: false, message: "Server error during password change" });
  }
});

// Update profile gradient endpoint (requires authentication)
app.put("/api/profile/:userId/gradient", async (req, res) => {
  const { userId } = req.params;
  const { selectedGradient } = req.body;

  // Check authentication
  if (!req.session.isLoggedIn && !req.session.isAdmin) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  // Check if user can change this gradient (must be own account)
  if (!req.session.isAdmin && (!req.session.user || req.session.user.id !== userId)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // Validate gradient number
  if (!selectedGradient || selectedGradient < 1 || selectedGradient > 12) {
    return res.status(400).json({ success: false, message: "Invalid gradient selection" });
  }

  // Find user
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  users[userIndex].selectedGradient = selectedGradient;
  saveUsers();

  res.json({ success: true, message: "Gradient updated successfully" });
});

// Profile picture upload storage configuration
const profilePictureStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public", "profile-pictures"));
  },
  filename: (req, file, cb) => {
    const userId = req.params.userId;
    const extension = path.extname(file.originalname);
    cb(null, `${userId}_${Date.now()}${extension}`);
  }
});

const profilePictureUpload = multer({ 
  storage: profilePictureStorage,
  fileFilter: (req, file, cb) => {
    // Allow only image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Upload profile picture endpoint
app.post("/api/profile/:userId/picture", profilePictureUpload.single("profilePicture"), async (req, res) => {
  const { userId } = req.params;

  // Check authentication
  if (!req.session.isLoggedIn && !req.session.isAdmin) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  // Check if user can change this profile picture (must be own account)
  if (!req.session.isAdmin && (!req.session.user || req.session.user.id !== userId)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  if (!req.file) {
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  // Find user
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Delete old profile picture if it exists
  const oldProfilePicture = users[userIndex].profilePicture;
  if (oldProfilePicture) {
    const oldPicturePath = path.join(__dirname, "public", oldProfilePicture);
    if (fs.existsSync(oldPicturePath)) {
      fs.unlinkSync(oldPicturePath);
    }
  }

  // Update user with new profile picture path
  users[userIndex].profilePicture = `/profile-pictures/${req.file.filename}`;
  saveUsers();

  res.json({ 
    success: true, 
    message: "Profile picture updated successfully",
    profilePicture: users[userIndex].profilePicture
  });
});

// Delete profile picture endpoint
app.delete("/api/profile/:userId/picture", async (req, res) => {
  const { userId } = req.params;

  // Check authentication
  if (!req.session.isLoggedIn && !req.session.isAdmin) {
    return res.status(401).json({ success: false, message: "Not authenticated" });
  }

  // Check if user can delete this profile picture (must be own account)
  if (!req.session.isAdmin && (!req.session.user || req.session.user.id !== userId)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // Find user
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  // Delete profile picture file if it exists
  const profilePicture = users[userIndex].profilePicture;
  if (profilePicture) {
    const picturePath = path.join(__dirname, "public", profilePicture);
    if (fs.existsSync(picturePath)) {
      fs.unlinkSync(picturePath);
    }
    users[userIndex].profilePicture = null;
    saveUsers();
  }

  res.json({ success: true, message: "Profile picture deleted successfully" });
});

// Ban/Unban user endpoint (admin only)
app.put("/api/admin/users/:userId/ban", ensureAdmin, (req, res) => {
  const { userId } = req.params;
  const { banned } = req.body;

  // Can't ban yourself
  if (req.session.user && req.session.user.id === userId) {
    return res.status(400).json({ error: "Cannot ban yourself" });
  }

  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  users[userIndex].banned = !!banned;
  
  // If banning, invalidate all user sessions
  if (banned && activeSessions.has(userId)) {
    const userSessions = activeSessions.get(userId);
    // Note: In a production environment, you would need a session store 
    // that allows session invalidation by session ID. For now, sessions 
    // will be invalidated on next request via middleware.
    activeSessions.delete(userId);
  }
  
  saveUsers();

  const { password, ...userProfile } = users[userIndex];
  res.json({ success: true, user: userProfile });
});

// Mute/Unmute user endpoint (admin only)
app.put("/api/admin/users/:userId/mute", ensureAdmin, (req, res) => {
  const { userId } = req.params;
  const { muted } = req.body;

  // Can't mute yourself
  if (req.session.user && req.session.user.id === userId) {
    return res.status(400).json({ error: "Cannot mute yourself" });
  }

  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  users[userIndex].muted = !!muted;
  saveUsers();

  const { password, ...userProfile } = users[userIndex];
  res.json({ success: true, user: userProfile });
});

// Toggle admin status endpoint (admin only)
app.put("/api/admin/users/:userId/admin", ensureAdmin, (req, res) => {
  const { userId } = req.params;
  const { isAdmin } = req.body;

  // Can't demote yourself
  if (!isAdmin && req.session.user && req.session.user.id === userId) {
    return res.status(400).json({ error: "Cannot demote yourself from admin" });
  }

  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }

  users[userIndex].isAdmin = !!isAdmin;
  saveUsers();

  const { password, ...userProfile } = users[userIndex];
  res.json({ success: true, user: userProfile });
});

// Delete user endpoint (admin only)
app.delete("/api/admin/users/:userId", ensureAdmin, (req, res) => {
  const { userId } = req.params;

  // Can't delete yourself
  if (req.session.user && req.session.user.id === userId) {
    return res.status(403).json({ success: false, message: "Cannot delete yourself" });
  }

  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const deletedUser = users[userIndex];
  users.splice(userIndex, 1);
  saveUsers();

  res.json({ success: true, message: `User ${deletedUser.username} deleted successfully` });
});

// Get all users endpoint (admin only)
app.get("/api/admin/users", ensureAdmin, (req, res) => {
  const userList = users.map(u => {
    const { password, ...userWithoutPassword } = u;
    return userWithoutPassword;
  });
  res.json({ success: true, users: userList });
});

// Get user comments endpoint (admin only)
app.get("/api/admin/users/:userId/comments", ensureAdmin, (req, res) => {
  const { userId } = req.params;
  
  // Find user to validate they exist
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  // Collect all comments by this user across all tracks
  const userComments = [];
  
  Object.entries(commentsByTrack).forEach(([trackKey, comments]) => {
    const userCommentsForTrack = comments.filter(c => c.userId === userId);
    userCommentsForTrack.forEach(comment => {
      // Add track information to the comment
      const [artistSlug, songSlug] = trackKey.split('/');
      
      // Find the actual track to get title and artist
      const track = tracks.find(t => 
        slugify(t.artist) === artistSlug && slugify(t.title) === songSlug
      );
      
      userComments.push({
        ...comment,
        trackKey,
        trackArtist: track ? track.artist : artistSlug,
        trackTitle: track ? track.title : songSlug
      });
    });
  });

  // Sort by creation date (newest first)
  userComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({ success: true, comments: userComments });
});

// Data export endpoints (admin only)

// Export site data (users, comments, activity, playlists, profile pictures)
app.get("/api/admin/export/site-data", ensureAdmin, (req, res) => {
  try {
    const exportData = {
      users: users,
      comments: commentsByTrack,
      activity: userActivity,
      playlists: playlists,
      exportDate: new Date().toISOString(),
      version: "2.0"
    };

    // Create a zip archive
    const archive = archiver('zip', { zlib: { level: 9 } });
    const dateStr = new Date().toISOString().split('T')[0];
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="hypertunes-site-data-${dateStr}.zip"`);
    
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      res.status(500).json({ success: false, error: 'Export failed' });
    });
    
    archive.pipe(res);
    
    // Add JSON data
    archive.append(JSON.stringify(exportData, null, 2), { name: 'data.json' });
    
    // Add profile pictures directory
    const profilePicturesDir = path.join(__dirname, 'public', 'profile-pictures');
    if (fs.existsSync(profilePicturesDir)) {
      archive.directory(profilePicturesDir, 'profile-pictures');
    }
    
    archive.finalize();
  } catch (error) {
    console.error('Site data export failed:', error);
    res.status(500).json({ success: false, error: 'Export failed' });
  }
});

// Export tracks data
app.get("/api/admin/export/tracks", ensureAdmin, (req, res) => {
  try {
    const exportData = {
      tracks: tracks,
      exportDate: new Date().toISOString(),
      version: "1.0"
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="hypertunes-tracks-${new Date().toISOString().split('T')[0]}.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Tracks export failed:', error);
    res.status(500).json({ success: false, error: 'Export failed' });
  }
});

// Import site data (admin only)
app.post("/api/admin/import/site-data", ensureAdmin, upload.single("dataFile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const uploadedFilePath = req.file.path;
    const isZipFile = req.file.originalname.endsWith('.zip');
    let importData;
    let extractedDir;

    if (isZipFile) {
      // Handle zip file with profile pictures
      extractedDir = path.join(__dirname, 'temp-import-' + Date.now());
      
      // Extract zip file
      await extract(uploadedFilePath, { dir: extractedDir });
      
      // Read JSON data from extracted files
      const dataJsonPath = path.join(extractedDir, 'data.json');
      if (!fs.existsSync(dataJsonPath)) {
        throw new Error('data.json not found in zip file');
      }
      
      importData = JSON.parse(fs.readFileSync(dataJsonPath, 'utf-8'));
    } else {
      // Handle plain JSON file (backward compatibility)
      importData = JSON.parse(fs.readFileSync(uploadedFilePath, 'utf-8'));
    }
    
    // Validate import data structure
    if (!importData.users || !importData.comments || !importData.activity) {
      if (extractedDir && fs.existsSync(extractedDir)) {
        fs.rmSync(extractedDir, { recursive: true, force: true });
      }
      return res.status(400).json({ success: false, error: 'Invalid data format' });
    }

    // Backup current data and profile pictures
    const backupData = {
      users: users,
      comments: commentsByTrack,
      activity: userActivity,
      playlists: playlists,
      backupDate: new Date().toISOString()
    };
    
    const backupPath = path.join(dataDir, `backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));

    // Import new data
    users = importData.users;
    commentsByTrack = importData.comments;
    userActivity = importData.activity;
    playlists = importData.playlists || []; // Handle older backups without playlists

    // Save to files
    saveUsers();
    saveComments();
    saveActivity();
    savePlaylists();

    // Import profile pictures if they exist in the zip
    if (isZipFile && extractedDir) {
      const extractedProfilePicsDir = path.join(extractedDir, 'profile-pictures');
      const targetProfilePicsDir = path.join(__dirname, 'public', 'profile-pictures');
      
      if (fs.existsSync(extractedProfilePicsDir)) {
        // Ensure target directory exists
        if (!fs.existsSync(targetProfilePicsDir)) {
          fs.mkdirSync(targetProfilePicsDir, { recursive: true });
        }
        
        // Copy all profile pictures
        const files = fs.readdirSync(extractedProfilePicsDir);
        files.forEach(file => {
          const sourcePath = path.join(extractedProfilePicsDir, file);
          const targetPath = path.join(targetProfilePicsDir, file);
          fs.copyFileSync(sourcePath, targetPath);
        });
      }
      
      // Clean up extracted directory
      fs.rmSync(extractedDir, { recursive: true, force: true });
    }

    // Clean up uploaded file
    fs.unlinkSync(uploadedFilePath);

    res.json({ 
      success: true, 
      message: 'Site data imported successfully',
      backupFile: path.basename(backupPath)
    });
  } catch (error) {
    console.error('Site data import failed:', error);
    res.status(500).json({ success: false, error: 'Import failed: ' + error.message });
  }
});

// Import tracks data (admin only)
app.post("/api/admin/import/tracks", ensureAdmin, upload.single("dataFile"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    let importData = JSON.parse(fs.readFileSync(req.file.path, 'utf-8'));
    
    // Handle both formats: direct array and { tracks: [...] } object
    let tracksToImport;
    if (Array.isArray(importData)) {
      // Direct array format from /api/tracks export
      tracksToImport = importData;
    } else if (importData.tracks && Array.isArray(importData.tracks)) {
      // Object format with tracks property
      tracksToImport = importData.tracks;
    } else {
      return res.status(400).json({ success: false, error: 'Invalid tracks data format - expected array or {tracks: [...]}' });
    }

    // Backup current tracks
    const backupPath = path.join(dataDir, `tracks-backup-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(tracks, null, 2));

    // Import new tracks
    tracks = tracksToImport;

    // Save to file
    fs.writeFileSync(tracksFile, JSON.stringify(tracks, null, 2));
    reloadTracksFromFile();

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({ 
      success: true, 
      message: 'Tracks imported successfully',
      backupFile: path.basename(backupPath)
    });
  } catch (error) {
    console.error('Tracks import failed:', error);
    res.status(500).json({ success: false, error: 'Import failed: ' + error.message });
  }
});

// --- Activity tracking endpoints ---

// Track a play for a user
app.post("/api/activity/play", (req, res) => {
  const { artistSlug, songSlug } = req.body;
  
  // Require authentication
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  // Get user ID
  const userId = req.session.user.id;

  // Validate track exists
  const track = tracks.find(t => 
    slugify(t.artist) === artistSlug && slugify(t.title) === songSlug
  );
  
  if (!track) {
    return res.status(404).json({ success: false, error: 'Track not found' });
  }

  const trackKey = `${artistSlug}/${songSlug}`;
  
  // Initialize session tracking for played songs if not exists
  if (!req.session.playedThisSession) {
    req.session.playedThisSession = [];
  }
  
  // Check if this song has already been played in this session
  if (req.session.playedThisSession.includes(trackKey)) {
    // Song already played this session, don't increment count
    return res.json({ success: true, alreadyPlayed: true });
  }
  
  // Mark this song as played in this session
  req.session.playedThisSession.push(trackKey);
  
  // Initialize user activity if not exists
  if (!userActivity[userId]) {
    userActivity[userId] = {
      plays: {},
      activityVisible: true // default to visible
    };
  }

  // Track the play
  if (!userActivity[userId].plays[trackKey]) {
    userActivity[userId].plays[trackKey] = {
      count: 0,
      trackTitle: track.title,
      trackArtist: track.artist,
      trackCover: track.cover,
      lastPlayed: new Date().toISOString()
    };
  }

  userActivity[userId].plays[trackKey].count++;
  userActivity[userId].plays[trackKey].lastPlayed = new Date().toISOString();

  saveActivity();
  res.json({ success: true, newPlay: true });
});

// Get user activity (top tracks)
app.get("/api/activity/:userId", (req, res) => {
  const { userId } = req.params;
  
  // Check if user exists
  const user = users.find(u => u.id === userId);
  if (!user) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  const activity = userActivity[userId];
  if (!activity) {
    return res.json({ 
      success: true, 
      topTracks: [], 
      activityVisible: true 
    });
  }

  // Check if activity is hidden
  if (!activity.activityVisible) {
    return res.json({ 
      success: true, 
      topTracks: [], 
      activityVisible: false 
    });
  }

  // Get top 3 most played tracks
  const topTracks = Object.entries(activity.plays)
    .map(([trackKey, data]) => ({
      trackKey,
      ...data
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  res.json({ 
    success: true, 
    topTracks, 
    activityVisible: true 
  });
});

// Update activity visibility
app.put("/api/activity/visibility", (req, res) => {
  const { visible } = req.body;

  // Require authentication
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  // Get user ID
  const userId = req.session.user.id;  // Initialize user activity if not exists
  if (!userActivity[userId]) {
    userActivity[userId] = {
      plays: {},
      activityVisible: true
    };
  }

  userActivity[userId].activityVisible = !!visible;
  saveActivity();

  res.json({ success: true, activityVisible: userActivity[userId].activityVisible });
});

// Reset user activity data
app.delete("/api/activity/reset", (req, res) => {
  // Require authentication
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  // Get user ID
  const userId = req.session.user.id;

  // Reset user's activity data
  userActivity[userId] = {
    plays: {},
    activityVisible: userActivity[userId]?.activityVisible !== false // Preserve visibility setting, default to true
  };

  saveActivity();
  res.json({ success: true, message: "Activity data has been reset successfully" });
});

// --- Playlist endpoints ---

// Get all playlists for a user
app.get("/api/playlists/user/:userId", (req, res) => {
  const { userId } = req.params;
  const userPlaylists = playlists.filter(p => p.userId === userId);
  res.json({ success: true, playlists: userPlaylists });
});

// Get a specific playlist
app.get("/api/playlists/:playlistId", (req, res) => {
  const { playlistId } = req.params;
  const playlist = playlists.find(p => p.id === playlistId);
  
  if (!playlist) {
    return res.status(404).json({ success: false, error: "Playlist not found" });
  }
  
  res.json({ success: true, playlist });
});

// Create a new playlist
app.post("/api/playlists", (req, res) => {
  // Require authentication (admin or user)
  if (!req.session.user && !req.session.isAdmin) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const { name, description } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, error: "Playlist name is required" });
  }

  // Get user ID (use '0' for hardcoded admin)
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user.id;

  const newPlaylist = {
    id: Date.now().toString(),
    userId,
    name: name.trim(),
    description: description ? description.trim() : '',
    collaborators: [], // Array of user IDs who can edit the playlist
    songs: [], // Array of {artistSlug, songSlug, title, artist}
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  playlists.push(newPlaylist);
  savePlaylists();
  
  res.json({ success: true, playlist: newPlaylist });
});

// Update playlist details (name, description)
app.put("/api/playlists/:playlistId", (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  
  // Require authentication (admin or user)
  if (!req.session.user && !req.session.isAdmin) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const playlist = playlists.find(p => p.id === playlistId);
  
  if (!playlist) {
    return res.status(404).json({ success: false, error: "Playlist not found" });
  }

  // Get user ID (use '0' for hardcoded admin)
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user.id;
  const isAdmin = !!req.session.isAdmin;

  // Only owners or admins can modify playlist details (name, description)
  if (playlist.userId !== userId && !isAdmin) {
    return res.status(403).json({ success: false, error: "Only the playlist owner can modify playlist details" });
  }

  if (name !== undefined) playlist.name = name.trim();
  if (description !== undefined) playlist.description = description.trim();
  playlist.updatedAt = new Date().toISOString();

  savePlaylists();
  res.json({ success: true, playlist });
});

// Add song to playlist
app.post("/api/playlists/:playlistId/songs", (req, res) => {
  const { playlistId } = req.params;
  const { artistSlug, songSlug, title, artist } = req.body;
  
  // Require authentication (admin or user)
  if (!req.session.user && !req.session.isAdmin) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const playlist = playlists.find(p => p.id === playlistId);
  
  if (!playlist) {
    return res.status(404).json({ success: false, error: "Playlist not found" });
  }

  // Get user ID (use '0' for hardcoded admin)
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user.id;
  const isAdmin = !!req.session.isAdmin;

  // Check ownership, collaboration permission, or admin
  const isOwner = playlist.userId === userId;
  const isCollaborator = playlist.collaborators && playlist.collaborators.includes(userId);
  
  if (!isOwner && !isCollaborator && !isAdmin) {
    return res.status(403).json({ success: false, error: "You don't have permission to add songs to this playlist" });
  }

  // Check if song already exists in playlist
  const exists = playlist.songs.some(s => 
    s.artistSlug === artistSlug && s.songSlug === songSlug
  );

  if (exists) {
    return res.status(400).json({ success: false, error: "Song already in playlist" });
  }

  playlist.songs.push({ artistSlug, songSlug, title, artist });
  playlist.updatedAt = new Date().toISOString();

  savePlaylists();
  res.json({ success: true, playlist });
});

// Remove song from playlist
app.delete("/api/playlists/:playlistId/songs", (req, res) => {
  const { playlistId } = req.params;
  const { artistSlug, songSlug } = req.body;
  
  // Require authentication (admin or user)
  if (!req.session.user && !req.session.isAdmin) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const playlist = playlists.find(p => p.id === playlistId);
  
  if (!playlist) {
    return res.status(404).json({ success: false, error: "Playlist not found" });
  }

  // Get user ID (use '0' for hardcoded admin)
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user.id;
  const isAdmin = !!req.session.isAdmin;

  // Check ownership, collaboration permission, or admin
  const isOwner = playlist.userId === userId;
  const isCollaborator = playlist.collaborators && playlist.collaborators.includes(userId);
  
  if (!isOwner && !isCollaborator && !isAdmin) {
    return res.status(403).json({ success: false, error: "You don't have permission to remove songs from this playlist" });
  }

  const originalLength = playlist.songs.length;
  playlist.songs = playlist.songs.filter(s => 
    !(s.artistSlug === artistSlug && s.songSlug === songSlug)
  );

  if (playlist.songs.length === originalLength) {
    return res.status(404).json({ success: false, error: "Song not found in playlist" });
  }

  playlist.updatedAt = new Date().toISOString();

  savePlaylists();
  res.json({ success: true, playlist });
});

// Reorder songs in playlist
app.put("/api/playlists/:playlistId/reorder", (req, res) => {
  const { playlistId } = req.params;
  const { songs } = req.body; // New order of songs array
  
  // Require authentication
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const playlist = playlists.find(p => p.id === playlistId);
  
  if (!playlist) {
    return res.status(404).json({ success: false, error: "Playlist not found" });
  }

  // Get user ID
  const userId = req.session.user.id;

  // Check ownership or collaboration permission
  const isOwner = playlist.userId === userId;
  const isCollaborator = playlist.collaborators && playlist.collaborators.includes(userId);
  
  if (!isOwner && !isCollaborator) {
    return res.status(403).json({ success: false, error: "You don't have permission to reorder songs in this playlist" });
  }

  if (!Array.isArray(songs)) {
    return res.status(400).json({ success: false, error: "Invalid songs array" });
  }

  playlist.songs = songs;
  playlist.updatedAt = new Date().toISOString();

  savePlaylists();
  res.json({ success: true, playlist });
});

// Delete a playlist
app.delete("/api/playlists/:playlistId", (req, res) => {
  const { playlistId } = req.params;
  
  // Require authentication
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const playlistIndex = playlists.findIndex(p => p.id === playlistId);
  
  if (playlistIndex === -1) {
    return res.status(404).json({ success: false, error: "Playlist not found" });
  }

  const playlist = playlists[playlistIndex];

  // Get user ID
  const userId = req.session.user.id;

  // Check ownership
  if (playlist.userId !== userId) {
    return res.status(403).json({ success: false, error: "You don't own this playlist" });
  }

  playlists.splice(playlistIndex, 1);
  savePlaylists();
  
  res.json({ success: true, message: "Playlist deleted successfully" });
});

// Add collaborator to playlist
app.post("/api/playlists/:playlistId/collaborators", (req, res) => {
  const { playlistId } = req.params;
  const { username } = req.body;
  
  // Require authentication
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const playlist = playlists.find(p => p.id === playlistId);
  
  if (!playlist) {
    return res.status(404).json({ success: false, error: "Playlist not found" });
  }

  // Get user ID
  const userId = req.session.user.id;

  // Only owner can add collaborators
  if (playlist.userId !== userId) {
    return res.status(403).json({ success: false, error: "Only the playlist owner can add collaborators" });
  }

  // Find user by username
  const collaboratorUser = users.find(u => u.username === username);
  if (!collaboratorUser) {
    return res.status(404).json({ success: false, error: "User not found" });
  }

  // Can't add yourself as collaborator
  if (collaboratorUser.id === userId) {
    return res.status(400).json({ success: false, error: "You can't add yourself as a collaborator" });
  }

  // Initialize collaborators array if it doesn't exist
  if (!playlist.collaborators) {
    playlist.collaborators = [];
  }

  // Check if user is already a collaborator
  if (playlist.collaborators.includes(collaboratorUser.id)) {
    return res.status(400).json({ success: false, error: "User is already a collaborator" });
  }

  playlist.collaborators.push(collaboratorUser.id);
  playlist.updatedAt = new Date().toISOString();

  savePlaylists();
  res.json({ success: true, playlist, collaborator: { id: collaboratorUser.id, username: collaboratorUser.username } });
});

// Remove collaborator from playlist
app.delete("/api/playlists/:playlistId/collaborators/:collaboratorId", (req, res) => {
  const { playlistId, collaboratorId } = req.params;
  
  // Require authentication
  if (!req.session.user) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }

  const playlist = playlists.find(p => p.id === playlistId);
  
  if (!playlist) {
    return res.status(404).json({ success: false, error: "Playlist not found" });
  }

  // Get user ID
  const userId = req.session.user.id;

  // Only owner can remove collaborators
  if (playlist.userId !== userId) {
    return res.status(403).json({ success: false, error: "Only the playlist owner can remove collaborators" });
  }

  // Initialize collaborators array if it doesn't exist
  if (!playlist.collaborators) {
    playlist.collaborators = [];
  }

  const originalLength = playlist.collaborators.length;
  playlist.collaborators = playlist.collaborators.filter(id => id !== collaboratorId);

  if (playlist.collaborators.length === originalLength) {
    return res.status(404).json({ success: false, error: "Collaborator not found" });
  }

  playlist.updatedAt = new Date().toISOString();

  savePlaylists();
  res.json({ success: true, playlist });
});

// Get playlist collaborators with user details
app.get("/api/playlists/:playlistId/collaborators", (req, res) => {
  const { playlistId } = req.params;
  
  const playlist = playlists.find(p => p.id === playlistId);
  
  if (!playlist) {
    return res.status(404).json({ success: false, error: "Playlist not found" });
  }

  // Get collaborator user details
  const collaborators = (playlist.collaborators || []).map(collaboratorId => {
    const user = users.find(u => u.id === collaboratorId);
    return user ? { 
      id: user.id, 
      username: user.username,
      profilePicture: user.profilePicture,
      selectedGradient: user.selectedGradient
    } : null;
  }).filter(Boolean);

  res.json({ success: true, collaborators });
});

// =================== FOLLOWS & NOTIFICATIONS API ===================

// Check if current user follows an artist
app.get("/api/follows/:artistSlug", (req, res) => {
  const { artistSlug } = req.params;
  
  if (!req.session.user && !req.session.isAdmin) {
    return res.json({ success: true, isFollowing: false, followerCount: (follows[artistSlug] || []).length });
  }
  
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user?.id;
  const artistFollowers = follows[artistSlug] || [];
  const isFollowing = artistFollowers.includes(userId);
  
  res.json({ success: true, isFollowing, followerCount: artistFollowers.length });
});

// Follow an artist
app.post("/api/follows/:artistSlug", (req, res) => {
  const { artistSlug } = req.params;
  
  if (!req.session.user && !req.session.isAdmin) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user?.id;
  
  if (!follows[artistSlug]) {
    follows[artistSlug] = [];
  }
  
  if (!follows[artistSlug].includes(userId)) {
    follows[artistSlug].push(userId);
    saveFollows();
  }
  
  res.json({ success: true, isFollowing: true, followerCount: follows[artistSlug].length });
});

// Unfollow an artist
app.delete("/api/follows/:artistSlug", (req, res) => {
  const { artistSlug } = req.params;
  
  if (!req.session.user && !req.session.isAdmin) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user?.id;
  
  if (follows[artistSlug]) {
    follows[artistSlug] = follows[artistSlug].filter(id => id !== userId);
    saveFollows();
  }
  
  res.json({ success: true, isFollowing: false, followerCount: (follows[artistSlug] || []).length });
});

// Get user's notifications
app.get("/api/notifications", (req, res) => {
  if (!req.session.user && !req.session.isAdmin) {
    return res.json({ success: true, notifications: [], unreadCount: 0 });
  }
  
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user?.id;
  const userData = notifications[userId] || { unread: [], history: [] };
  
  res.json({ success: true, notifications: userData.unread, unreadCount: userData.unread.length });
});

// Get notification history
app.get("/api/notifications/history", (req, res) => {
  if (!req.session.user && !req.session.isAdmin) {
    return res.json({ success: true, history: [] });
  }
  
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user?.id;
  const userData = notifications[userId] || { unread: [], history: [] };
  
  // Return last 50 history items
  res.json({ success: true, history: userData.history.slice(0, 50) });
});

// Mark all notifications as read (moves them to history)
app.post("/api/notifications/mark-read", (req, res) => {
  if (!req.session.user && !req.session.isAdmin) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user?.id;
  
  if (!notifications[userId]) {
    notifications[userId] = { unread: [], history: [] };
  }
  
  // Move unread to history
  if (notifications[userId].unread && notifications[userId].unread.length > 0) {
    notifications[userId].history = [
      ...notifications[userId].unread,
      ...notifications[userId].history
    ].slice(0, 50); // Keep only last 50
    notifications[userId].unread = [];
    saveNotifications();
  }
  
  res.json({ success: true });
});

// Clear unread notifications (moves them to history)
app.delete("/api/notifications", (req, res) => {
  if (!req.session.user && !req.session.isAdmin) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  
  const userId = req.session.isAdmin && !req.session.user ? '0' : req.session.user?.id;
  
  if (!notifications[userId]) {
    notifications[userId] = { unread: [], history: [] };
  }
  
  // Move unread to history
  if (notifications[userId].unread && notifications[userId].unread.length > 0) {
    notifications[userId].history = [
      ...notifications[userId].unread,
      ...notifications[userId].history
    ].slice(0, 50); // Keep only last 50
    notifications[userId].unread = [];
    saveNotifications();
  }
  
  res.json({ success: true });
});

// =================== END FOLLOWS & NOTIFICATIONS API ===================

app.post("/api/upload-song", upload.single("audioFile"), (req, res) => {
  if (!req.session.isAdmin) {
    return res.status(403).json({ error: "Only admin users can upload tracks" });
  }

  const { title, artist, album, cover, category, releaseDate, albumNumber } = req.body;
  const audioFile = req.file;

  if (!title || !artist || !audioFile) {
    return res.status(400).send("Missing required fields or audio file");
  }

  // create track object
  const newTrack = {
    title,
    artist,
    album: album || "",
    cover: cover || "",
    file: `/audio/${audioFile.filename}`,
    isNew: category === "isNew",
    isPopular: category === "isPopular",
    isClean: category === "isClean",
    isFeatured: category === "isFeatured",
    createdAt: releaseDate ? new Date(releaseDate).toISOString() : new Date().toISOString(),
    albumNumber,
  };

  // add to tracks array & save
  tracks.unshift(newTrack);
  fs.writeFile(tracksFile, JSON.stringify(tracks, null, 2), (err) => {
    if (err) {
      console.error("Error saving tracks.json:", err);
      return res.status(500).send("Error saving track data");
    }
    
    // Notify followers of the artist about the new release
    const artistSlug = artist.toLowerCase().replace(/[^\w]+/g, "-");
    const trackSlug = title.toLowerCase().replace(/[^\w]+/g, "-");
    notifyFollowersOfNewTrack(artistSlug, artist, title, trackSlug);
    
    res.status(200).send("Track uploaded and saved successfully");
  });
});

// Specific routes for static pages
// Static file serving (moved below API routes to avoid any interference)
app.use(express.static(path.join(__dirname, "public")));
app.use("/audio", express.static(path.join(__dirname, "audio")));

app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "register.html"));
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/profile/:userId", (req, res) => {
  // Serve SPA shell; script.js will render the profile view
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// catch-all only for client-side routes
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// start server
const server = app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);

});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Please close the other server or use a different port.`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});