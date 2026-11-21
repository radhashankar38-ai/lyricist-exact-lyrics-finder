import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Room state storage (in-memory for now)
  const rooms = new Map<string, any>();

  function generateRoomCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("create-room", (data) => {
      const code = generateRoomCode();
      rooms.set(code, {
        host: socket.id,
        state: data || {}
      });
      socket.join(code);
      socket.emit("room-created", { code });
      console.log(`Room created: ${code}`);
    });

    socket.on("join-room", ({ code }) => {
      const roomCode = code.toUpperCase();
      const room = rooms.get(roomCode);
      if (room) {
        socket.join(roomCode);
        socket.emit("room-joined", { code: roomCode, state: room.state });
        
        // Broadcast updated participant count
        const count = io.sockets.adapter.rooms.get(roomCode)?.size || 0;
        io.to(roomCode).emit("room-stats", { count });
        
        console.log(`User ${socket.id} joined room ${roomCode}. Total: ${count}`);
      } else {
        socket.emit("error", { message: "Room not found" });
      }
    });

    socket.on("sync-event", ({ code, event }) => {
      const roomCode = code.toUpperCase();
      const room = rooms.get(roomCode);
      if (room && room.host === socket.id) {
        // Update room state if song changes or scroll occurs
        if (event.type === 'song_change') {
            room.state = { ...room.state, ...event.payload };
        } else if (event.type === 'scroll') {
            room.state = { 
              ...room.state, 
              currentStanzaIndex: event.payload.stanzaIdx, 
              currentLineIndex: event.payload.lineIdx 
            };
        } else if (event.type === 'focus_toggle') {
            room.state = { ...room.state, isFocusMode: event.payload.enabled };
        }
        // Broadcast to everyone else in the room
        socket.to(roomCode).emit("sync-update", event);
      }
    });

    socket.on("disconnecting", () => {
      // Broadcast updated participant count before fully leaving
      for (const roomCode of socket.rooms) {
        if (rooms.has(roomCode)) {
          const count = (io.sockets.adapter.rooms.get(roomCode)?.size || 1) - 1;
          io.to(roomCode).emit("room-stats", { count: Math.max(0, count) });
        }
      }
    });

    socket.on("disconnect", () => {
      // Cleanup rooms if host leaves
      for (const [code, room] of rooms.entries()) {
        if (room.host === socket.id) {
          io.to(code).emit("room-closed");
          rooms.delete(code);
          console.log(`Room ${code} closed because host left`);
        }
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
