import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "nexus-chat-secret-key-123";

// Database Initialization
const db = new Database("nexus.db");
db.pragma("journal_mode = WAL");

// Migration
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar_url TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_online INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL, -- 'private', 'group'
    name TEXT, -- only for groups
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chat_members (
    chat_id INTEGER,
    user_id INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, user_id),
    FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    sender_id INTEGER,
    content TEXT,
    type TEXT DEFAULT 'text', -- 'text', 'image', 'file'
    status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'seen'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edited_at DATETIME,
    deleted_at DATETIME,
    FOREIGN KEY (chat_id) REFERENCES chats (id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE CASCADE
  );
`);

// Multer for file uploads
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({ storage });

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  app.use(express.json());
  app.use("/uploads", express.static(uploadDir));

  // --- Auth Middleware ---
  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // --- API Routes ---

  // Auth: Signup
  app.post("/api/auth/signup", async (req, res) => {
    const { username, email, password } = req.body;
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      const stmt = db.prepare("INSERT INTO users (username, email, password) VALUES (?, ?, ?)");
      const result = stmt.run(username, email, hashedPassword);
      const user = { id: result.lastInsertRowid, username, email };
      const token = jwt.sign(user, JWT_SECRET);
      res.json({ token, user });
    } catch (err: any) {
      res.status(400).json({ error: "Username or email already exists" });
    }
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as any;
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email, avatar_url: user.avatar_url } });
  });

  // User: Search
  app.get("/api/users/search", authenticateToken, (req: any, res) => {
    const { q } = req.query;
    const users = db.prepare("SELECT id, username, avatar_url FROM users WHERE username LIKE ? AND id != ?").all(`%${q}%`, req.user.id);
    res.json(users);
  });

  // Chats: Get list
  app.get("/api/chats", authenticateToken, (req: any, res) => {
    const chats = db.prepare(`
      SELECT c.*, 
      (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM chats c
      JOIN chat_members cm ON c.id = cm.chat_id
      WHERE cm.user_id = ?
      ORDER BY last_message_time DESC
    `).all(req.user.id);
    
    // For each chat, get participants
    const detailedChats = chats.map((chat: any) => {
      const participants = db.prepare(`
        SELECT u.id, u.username, u.avatar_url, u.is_online, u.last_seen
        FROM users u
        JOIN chat_members cm ON u.id = cm.user_id
        WHERE cm.chat_id = ?
      `).all(chat.id);
      return { ...chat, participants };
    });

    res.json(detailedChats);
  });

  // Chats: Create private chat
  app.post("/api/chats/private", authenticateToken, (req: any, res) => {
    const { targetUserId } = req.body;
    
    // Check if chat already exists
    const existing = db.prepare(`
      SELECT chat_id FROM chat_members 
      WHERE chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = ?)
      AND user_id = ?
      AND chat_id IN (SELECT id FROM chats WHERE type = 'private')
    `).get(req.user.id, targetUserId);

    if (existing) {
      return res.json({ chatId: (existing as any).chat_id });
    }

    const info = db.prepare("INSERT INTO chats (type) VALUES ('private')").run();
    const chatId = info.lastInsertRowid;
    db.prepare("INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)").run(chatId, req.user.id);
    db.prepare("INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)").run(chatId, targetUserId);
    
    res.json({ chatId });
  });

  // Messages: Get for chat
  app.get("/api/messages/:chatId", authenticateToken, (req: any, res) => {
    const messages = db.prepare("SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC").all(req.params.chatId);
    res.json(messages);
  });

  // Files: Upload
  app.post("/api/upload", authenticateToken, upload.single("file"), (req: any, res) => {
    if (!req.file) return res.status(400).send("No file uploaded.");
    res.json({ url: `/uploads/${req.file.filename}`, type: req.file.mimetype });
  });

  // --- Socket.io ---
  const userSockets = new Map<number, string>(); // userId -> socketId

  io.on("connection", (socket) => {
    console.log("A user connected", socket.id);

    socket.on("authenticate", (token) => {
      jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return;
        userSockets.set(user.id, socket.id);
        (socket as any).userId = user.id;
        
        // Update online status
        db.prepare("UPDATE users SET is_online = 1 WHERE id = ?").run(user.id);
        socket.broadcast.emit("user_status_change", { userId: user.id, isOnline: true });
        
        // Join rooms for all chats
        const chats = db.prepare("SELECT chat_id FROM chat_members WHERE user_id = ?").all(user.id);
        (chats as any[]).forEach(chat => socket.join(`chat_${chat.chat_id}`));
      });
    });

    socket.on("send_message", (data) => {
      const { chatId, content, type } = data;
      const userId = (socket as any).userId;
      if (!userId) return;

      const stmt = db.prepare("INSERT INTO messages (chat_id, sender_id, content, type) VALUES (?, ?, ?, ?)");
      const result = stmt.run(chatId, userId, content, type || 'text');
      const message = {
        id: result.lastInsertRowid,
        chat_id: chatId,
        sender_id: userId,
        content,
        type: type || 'text',
        status: 'sent',
        created_at: new Date().toISOString()
      };

      io.to(`chat_${chatId}`).emit("new_message", message);
    });

    socket.on("typing", (data) => {
      const { chatId } = data;
      const userId = (socket as any).userId;
      socket.to(`chat_${chatId}`).emit("user_typing", { chatId, userId });
    });

    socket.on("stop_typing", (data) => {
      const { chatId } = data;
      const userId = (socket as any).userId;
      socket.to(`chat_${chatId}`).emit("user_stop_typing", { chatId, userId });
    });

    socket.on("message_seen", (data) => {
      const { messageId, chatId } = data;
      db.prepare("UPDATE messages SET status = 'seen' WHERE id = ?").run(messageId);
      socket.to(`chat_${chatId}`).emit("message_status_update", { messageId, status: 'seen' });
    });

    socket.on("disconnect", () => {
      const userId = (socket as any).userId;
      if (userId) {
        userSockets.delete(userId);
        db.prepare("UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?").run(userId);
        socket.broadcast.emit("user_status_change", { userId, isOnline: false, lastSeen: new Date().toISOString() });
      }
      console.log("User disconnected", socket.id);
    });
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
