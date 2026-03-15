import express from "express";
import { createServer as createViteServer } from "vite";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    maxHttpBufferSize: 5e6, // 5MB limit for file uploads
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Chat logic
  const users = new Map<string, { id: string, username: string, avatar: string, lastSeen: number }>();
  const messages: any[] = []; // In-memory message store for simplicity

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // 1. LÓGICA DE ENTRADA (JOIN)
    socket.on("join", (data: { username: string, avatar: string } | string) => {
      const username = typeof data === 'string' ? data : data.username;
      const avatar = typeof data === 'string' ? '' : data.avatar;

      users.set(socket.id, { id: socket.id, username, avatar, lastSeen: Date.now() });
      io.emit("users", Array.from(users.values()));
      
      socket.emit("history", messages.slice(-50));
      
      io.emit("message", {
        id: Date.now().toString(),
        type: "system",
        action: "join",
        username: username,
        text: `${username} entrou no chat.`,
        timestamp: Date.now()
      });
    }); // <-- AQUI TERMINA O JOIN

    // 2. LÓGICA DA LIXEIRA (LIMPAR TUDO)
    socket.on("clear_all_messages", (data: { password: string }) => {
      const ADMIN_PASSWORD = "Bruno"; // Você pode mudar para sua senha Wyz... se preferir
      if (data.password === ADMIN_PASSWORD) {
        messages.length = 0; 
        io.emit("messages_cleared");
        console.log("Histórico apagado por admin.");
      } else {
        socket.emit("error_notification", "Senha incorreta!");
      }
    }); // <-- AQUI TERMINA A LIXEIRA

    // 3. LÓGICA DE MENSAGENS COMUM
    socket.on("message", (data: { text: string, file?: any }) => {
      const user = users.get(socket.id);
      if (user) {
        const message = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
          type: "user",
          userId: user.id,
          username: user.username,
          avatar: user.avatar,
          text: data.text,
          file: data.file,
          timestamp: Date.now()
        };
        messages.push(message);
        if (messages.length > 100) messages.shift();
        io.emit("message", message);
      }
    });
    socket.on("typing", () => {
      const user = users.get(socket.id);
      if (user) {
        socket.broadcast.emit("typing", user.username);
      }
    });

    socket.on("stopTyping", () => {
      const user = users.get(socket.id);
      if (user) {
        socket.broadcast.emit("stopTyping", user.username);
      }
    });

    socket.on("deleteMessage", (messageId: string) => {
      const user = users.get(socket.id);
      if (user) {
        const messageIndex = messages.findIndex(m => m.id === messageId);
        // Ensure the user deleting the message is the one who sent it
        if (messageIndex !== -1 && messages[messageIndex].userId === user.id) {
          messages.splice(messageIndex, 1);
          io.emit("messageDeleted", messageId);
        }
      }
    });

    socket.on("editMessage", (data: { id: string, text: string }) => {
      const user = users.get(socket.id);
      if (user) {
        const messageIndex = messages.findIndex(m => m.id === data.id);
        // Ensure the user editing the message is the one who sent it
        if (messageIndex !== -1 && messages[messageIndex].userId === user.id) {
          messages[messageIndex].text = data.text;
          messages[messageIndex].isEdited = true;
          io.emit("messageEdited", { id: data.id, text: data.text });
        }
      }
    });

    socket.on("readMessage", (messageId: string) => {
      const user = users.get(socket.id);
      if (user) {
        const message = messages.find(m => m.id === messageId);
        if (message && message.userId !== user.id) {
          if (!message.readBy) message.readBy = [];
          if (!message.readBy.includes(user.id)) {
            message.readBy.push(user.id);
            io.emit("messageRead", { messageId, userId: user.id });
          }
        }
      }
    });

    socket.on("disconnect", () => {
      const user = users.get(socket.id);
      if (user) {
        users.delete(socket.id);
        io.emit("users", Array.from(users.values()));
        io.emit("message", {
          id: Date.now().toString(),
          type: "system",
          action: "leave",
          username: user.username,
          text: `${user.username} saiu do chat.`,
          timestamp: Date.now()
        });
      }
      console.log("User disconnected:", socket.id);
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
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();