import express from "express";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function createServer() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));

  // Data directory for persistent shared state across all users and devices
  const DATA_DIR = path.resolve(__dirname, "data");
  const SHARED_STATE_FILE = path.join(DATA_DIR, "shared-state.json");
  const UPLOADS_DIR = path.resolve(__dirname, "public", "uploads");

  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn("Could not create data directory:", e);
    }
  }

  if (!fs.existsSync(UPLOADS_DIR)) {
    try {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    } catch (e) {
      console.warn("Could not create uploads directory:", e);
    }
  }

  // Serve uploaded images statically
  app.use("/uploads", express.static(UPLOADS_DIR));

  // Import baseline shared state
  const { getBaseSharedState } = await import("./src/lib/defaultSharedState");
  const baseDefaults = getBaseSharedState();

  let memorySharedState: any = null;
  if (fs.existsSync(SHARED_STATE_FILE)) {
    try {
      const raw = fs.readFileSync(SHARED_STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        memorySharedState = {
          ...baseDefaults,
          ...parsed,
          heroBanners: parsed.heroBanners && parsed.heroBanners.length > 0 ? parsed.heroBanners : baseDefaults.heroBanners,
          products: parsed.products && parsed.products.length > 0 ? parsed.products : baseDefaults.products,
        };
      }
    } catch (e) {
      console.warn("Failed to load existing shared state from disk, using base defaults:", e);
      memorySharedState = { ...baseDefaults };
    }
  } else {
    memorySharedState = { ...baseDefaults };
  }

  if (!memorySharedState || !memorySharedState.heroBanners || memorySharedState.heroBanners.length === 0) {
    memorySharedState = { ...baseDefaults, ...(memorySharedState || {}) };
  }

  // Active SSE subscribers (connected smartphones, PCs, tablets)
  const sseClients = new Set<express.Response>();

  const broadcastSharedStateUpdate = (updatedState: any) => {
    const payload = JSON.stringify({
      ok: true,
      state: updatedState,
      timestamp: updatedState._lastUpdatedByAdmin || new Date().toISOString(),
    });
    for (const client of sseClients) {
      try {
        client.write(`data: ${payload}\n\n`);
      } catch (e) {
        sseClients.delete(client);
      }
    }
  };

  // Helper for atomic file persistence
  const saveStateToDisk = (stateToSave: any) => {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpFile = path.join(DATA_DIR, `shared-state-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.tmp`);
      fs.writeFileSync(tmpFile, JSON.stringify(stateToSave, null, 2), "utf-8");
      fs.renameSync(tmpFile, SHARED_STATE_FILE);
      return true;
    } catch (err) {
      console.warn("Atomic disk save failed, attempting direct write fallback:", err);
      try {
        fs.writeFileSync(SHARED_STATE_FILE, JSON.stringify(stateToSave, null, 2), "utf-8");
        return true;
      } catch (directErr) {
        console.error("Direct write failed as well:", directErr);
        return false;
      }
    }
  };

  // Ensure initial state is persisted on disk so all devices see the baseline immediately
  saveStateToDisk(memorySharedState);

  // GET /api/shared-state/stream - Server-Sent Events (SSE) for instant real-time synchronization
  app.get("/api/shared-state/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Send immediate initial sync
    const initialPayload = JSON.stringify({
      ok: true,
      state: memorySharedState,
      timestamp: memorySharedState._lastUpdatedByAdmin || new Date().toISOString(),
    });
    res.write(`data: ${initialPayload}\n\n`);

    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  // GET /api/shared-state - returns shared settings, hero banners, catalog overrides for all visitors
  app.get("/api/shared-state", (_req, res) => {
    // Aggressive anti-caching headers so mobile networks never cache stale state
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    return res.json({
      ok: true,
      state: memorySharedState || null,
      timestamp: new Date().toISOString(),
    });
  });

  // POST /api/shared-state - saves admin updates to disk & memory so all users see them
  app.post("/api/shared-state", (req, res) => {
    try {
      const { state } = req.body;
      if (!state || typeof state !== "object") {
        return res.status(400).json({ error: "Invalid state payload" });
      }

      memorySharedState = {
        ...(memorySharedState || {}),
        ...state,
        _lastUpdatedByAdmin: new Date().toISOString(),
      };

      const persisted = saveStateToDisk(memorySharedState);
      broadcastSharedStateUpdate(memorySharedState);

      return res.json({
        ok: true,
        persisted,
        message: "Shared state updated and published to all users",
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error("Error in /api/shared-state POST:", err);
      return res.status(500).json({ error: "Failed to save shared state", message: err.message });
    }
  });

  // POST /api/admin-save - dedicated atomic endpoint for admin panel forms with audit confirmation
  app.post("/api/admin-save", (req, res) => {
    try {
      const { state, action, user, role, details } = req.body;
      if (!state || typeof state !== "object") {
        return res.status(400).json({ error: "Invalid admin state payload" });
      }

      const timestamp = new Date().toISOString();
      const existingLogs = Array.isArray(memorySharedState?.auditLogs) ? memorySharedState.auditLogs : [];
      const newLog = action
        ? [
            {
              id: `LOG-${Date.now()}`,
              action: action || "Alteração Administrativa",
              user: user || "Super Admin",
              role: role || "SUPER_ADMIN",
              timestamp: timestamp.replace("T", " ").slice(0, 16),
              details: details || "Atualização confirmada e gravada no servidor.",
            },
            ...existingLogs,
          ]
        : existingLogs;

      memorySharedState = {
        ...(memorySharedState || {}),
        ...state,
        auditLogs: newLog,
        _lastUpdatedByAdmin: timestamp,
      };

      const persisted = saveStateToDisk(memorySharedState);
      broadcastSharedStateUpdate(memorySharedState);

      return res.json({
        ok: true,
        persisted,
        message: "Alterações administrativas gravadas com sucesso no servidor e base de dados.",
        timestamp,
      });
    } catch (err: any) {
      console.error("Error in /api/admin-save:", err);
      return res.status(500).json({ error: "Falha na gravação administrativa", message: err.message });
    }
  });

  // POST /api/upload-image - stores image to disk and returns a lightweight URL (/uploads/...)
  app.post("/api/upload-image", (req, res) => {
    try {
      const { dataUrl, filename } = req.body;
      if (!dataUrl || typeof dataUrl !== "string") {
        return res.status(400).json({ error: "Missing dataUrl" });
      }

      // Check format
      const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
      if (!match) {
        return res.status(400).json({ error: "Invalid dataUrl format" });
      }

      let ext = match[1].toLowerCase();
      if (ext === "jpeg") ext = "jpg";
      if (ext === "svg+xml") ext = "svg";
      const base64Data = match[2];
      const buffer = Buffer.from(base64Data, "base64");

      if (!fs.existsSync(UPLOADS_DIR)) {
        fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      }

      const safeBase = filename ? path.basename(filename).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 30) : "img";
      const uniqueName = `${safeBase || "img"}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, uniqueName);

      fs.writeFileSync(filePath, buffer);

      const publicUrl = `/uploads/${uniqueName}`;
      return res.json({
        ok: true,
        url: publicUrl,
        size: buffer.length,
      });
    } catch (err: any) {
      console.error("Error in /api/upload-image:", err);
      return res.status(500).json({ error: "Failed to upload image", message: err.message });
    }
  });

  // Helper to count references of an image URL across the platform shared state
  function countImageReferences(imageUrl: string, state: any): number {
    if (!imageUrl || typeof imageUrl !== "string") return 0;
    const target = imageUrl.trim();
    if (!target) return 0;

    let count = 0;

    // Check customLogo
    if (state?.customLogo && state.customLogo.trim() === target) {
      count++;
    }

    // Check heroBanners
    if (Array.isArray(state?.heroBanners)) {
      for (const b of state.heroBanners) {
        if (b?.imageUrl && b.imageUrl.trim() === target) count++;
      }
    }

    // Check products
    if (Array.isArray(state?.products)) {
      for (const p of state.products) {
        if (p?.imageUrl && p.imageUrl.trim() === target) count++;
      }
    }

    // Check serviceOverrides
    if (Array.isArray(state?.serviceOverrides)) {
      for (const s of state.serviceOverrides) {
        if (s?.imageUrl && s.imageUrl.trim() === target) count++;
      }
    }

    // Check customServices
    if (Array.isArray(state?.customServices)) {
      for (const s of state.customServices) {
        if (s?.imageUrl && s.imageUrl.trim() === target) count++;
      }
    }

    // Check categoryOverrides
    if (Array.isArray(state?.categoryOverrides)) {
      for (const c of state.categoryOverrides) {
        if (c?.imageUrl && c.imageUrl.trim() === target) count++;
      }
    }

    return count;
  }

  // POST /api/storage/safe-replace-image - safely replaces image reference and prunes orphaned files
  app.post("/api/storage/safe-replace-image", (req, res) => {
    try {
      const { oldUrl, newUrl, role } = req.body;

      // 1. Authorization: Only administrative roles can purge old platform images
      const allowedRoles = ["SUPER_ADMIN", "ADMIN", "OPERATIONS"];
      if (!role || !allowedRoles.includes(role)) {
        return res.status(403).json({
          ok: false,
          error: "Acesso negado: apenas administradores autorizados podem substituir ficheiros.",
        });
      }

      if (!oldUrl || typeof oldUrl !== "string" || !oldUrl.trim()) {
        return res.json({
          ok: true,
          deleted: false,
          message: "Nenhuma imagem antiga para remover.",
        });
      }

      const trimmedOld = oldUrl.trim();
      const trimmedNew = (newUrl || "").trim();

      // If new and old are identical, nothing to clean up
      if (trimmedOld === trimmedNew) {
        return res.json({
          ok: true,
          deleted: false,
          message: "A nova imagem é idêntica à anterior.",
        });
      }

      // Security: Never delete default assets or system stock files
      if (
        trimmedOld.startsWith("/assets/") ||
        trimmedOld.includes("file_0000000077e8820eae7db33507894d75") ||
        trimmedOld.includes("images.unsplash.com")
      ) {
        return res.json({
          ok: true,
          deleted: false,
          reason: "asset_protected",
          message: "Ativo padrão do sistema preservado contra eliminação.",
        });
      }

      // 2. Reference counting: check if oldUrl is used in any other records
      const refCount = countImageReferences(trimmedOld, memorySharedState);
      if (refCount > 0) {
        return res.json({
          ok: true,
          deleted: false,
          reason: "referenced_by_other_records",
          references: refCount,
          message: `Ficheiro antigo mantido porque ainda está referenciado em ${refCount} elemento(s).`,
        });
      }

      // 3. If zero references, safely delete from /uploads/
      let deleted = false;
      if (trimmedOld.startsWith("/uploads/")) {
        const filename = path.basename(trimmedOld.replace(/^\/uploads\//, ""));
        // Prevent path traversal
        const safePath = path.resolve(UPLOADS_DIR, filename);
        if (safePath.startsWith(path.resolve(UPLOADS_DIR)) && fs.existsSync(safePath)) {
          fs.unlinkSync(safePath);
          deleted = true;
          console.log(`[Storage] Orphaned local upload removed safely: ${filename}`);
        }
      }

      return res.json({
        ok: true,
        deleted,
        message: deleted
          ? "Imagem antiga órfã eliminada com segurança após confirmação de substituição."
          : "Ficheiro antigo não requeria eliminação local.",
      });
    } catch (err: any) {
      console.error("Error in /api/storage/safe-replace-image:", err);
      return res.status(500).json({
        ok: false,
        error: "Falha na verificação de substituição de imagem",
        message: err.message,
      });
    }
  });

  // Initialize Google GenAI client if API key is present

  const apiKey = process.env.GEMINI_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }

  // API endpoint for Resolve AI Assistant
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const { prompt, context } = req.body;
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }

      if (!ai) {
        return res.status(503).json({
          error: "Gemini API key not configured on server",
        });
      }

      const systemInstruction = `Você é o RESOLVE AI, o assistente oficial inteligente da plataforma RESOLVE EXPRESS sediada no Huambo, Angola.
Slogan: "VOCÊ PEDE. NÓS RESOLVEMOS!"

Departamentos de Serviços da Resolve Express (com equipas verificadas e atendimento ao domicílio):
1. Resolve Casa: Limpeza geral, profunda, lavagem de sofás, higienização e organização pós-mudança.
2. Resolve Lavandaria: Lavagem de roupas, engomadoria, cortinas e tapetes com recolha e entrega.
3. Resolve Food: Refeições quentes, frango assado, marmitas e catering.
4. Resolve Family: Babysitting, acompanhamento de idosos e apoio familiar com cuidadores verificados.
5. Resolve Auto: Lavagem exterior e interior, higienização e polimento ao domicílio.
6. Resolve Shopping: Compras de supermercado e mercado municipal no Huambo com talão comprovativo.
7. Resolve Garden: Corte de relva, poda, manutenção de jardins e quintais.
8. Resolve Tech: Canalização, eletricidade, carpintaria, pintura e montagem de móveis.
9. Resolve Beauty: Cabeleireiro, tranças, barbeiro e manicure ao domicílio com materiais esterilizados.
10. Resolve Delivery: Estafetas para entrega rápida de documentos, encomendas e compras.
11. Resolve Water & Gas: Botijas de gás autorizadas (Sonangol/Saquel) e garrafões de água mineral entregues à porta.
12. Resolve Business: Limpeza de escritórios, lavagem de frotas e apoio logístico B2B.
13. Resolve Educação / Apoio Escolar: Explicações individuais e em pequenos grupos para ensino primário, secundário e pré-universitário (Matemática, Física, Química, Língua Portuguesa e Inglês).

Loja de Produtos / Marketplace Oficial (preços em Kwanzas - AOA):
- Botija de Gás 12kg (Sonangol Gás Huambo): 15.000 Kz (Entrega ao domicílio em 45 min)
- Garrafão de Água Mineral 18.9L: 4.500 Kz (Entrega em 30-60 min)
- Cesta Básica Familiar Completa: 38.500 Kz (Arroz, massa, óleo, fuba, açúcar, feijão, leite)
- Frango Assado Inteiro com Batata e Molho: 6.500 Kz
- Kit Limpeza Profunda Residencial: 12.000 Kz
- Saco de Cimento Portland 50kg: 6.200 Kz
- Tinta Acrílica Branca 15L Robbialac: 24.500 Kz
- Lâmpadas LED Económicas 12W (Pack 4 un): 5.800 Kz
- Kit Shampoo e Máscara Nutritiva Profissional: 14.500 Kz

Contexto do utilizador:
- Localidade selecionada: ${context?.location || "Huambo"}
- Pedidos ativos registados: ${JSON.stringify(context?.bookings || [])}

Diretrizes:
- Seja prestativo, educado, ágil e acolhedor (estilo angolano profissional e claro).
- Se o cliente quiser comprar um produto, informe o preço exato em Kwanzas (Kz), tempo de entrega e recomende a secção Loja de Produtos (/produtos).
- Se o cliente perguntar por apoio escolar ou explicações, explique as disciplinas disponíveis e indique o departamento de Apoio Escolar e Explicação.
- Se o cliente perguntar por um código de pedido (REX-YYYY-XXXXXX), consulte o contexto e informe o estado atual.
- Nunca confirme pagamentos fictícios ou invente valores finais sem orçamentação.
- Encoraje o utilizador a navegar diretamente na plataforma ou falar pelo WhatsApp oficial.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      return res.json({ reply: response.text });
    } catch (err: any) {
      console.error("Gemini API error in /api/ai/chat:", err);
      return res.status(500).json({
        error: "Failed to generate AI response",
        message: err.message,
      });
    }
  });

  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(Number(port), "0.0.0.0", () => {
    console.log(`Resolve Express Server listening on port ${port}`);
  });
}

createServer().catch((err) => {
  console.error("Failed to start server:", err);
});
