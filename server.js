const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.BALGRIM_SECRET || "balgrim-local-secret";

const FILES = {
  orders: path.join(DATA_DIR, "orders.json"),
  products: path.join(DATA_DIR, "products.json"),
  settings: path.join(DATA_DIR, "settings.json"),
  users: path.join(DATA_DIR, "users.json"),
};

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

const seedProducts = {
  "fortitude-tee": { id: "fortitude-tee", name: "T-Shirt Fortitude", price: 129000, category: "Nuevos lanzamientos", note: "Drop esencial" },
  "special-edition-tee": { id: "special-edition-tee", name: "T-Shirt Special Edition", price: 149000, category: "Nuevos lanzamientos", note: "Edicion limitada" },
  "creative-sanctuary-tee": { id: "creative-sanctuary-tee", name: "Creative Sanctuary", price: 139000, category: "Nuevos lanzamientos", note: "Grafico posterior" },
  "black-fortitude-tee": { id: "black-fortitude-tee", name: "Black Fortitude Tee", price: 139000, category: "Hombre", note: "Algodon pesado" },
  "ivory-core-tee": { id: "ivory-core-tee", name: "Ivory Core Tee", price: 129000, category: "Hombre", note: "Fit regular" },
  "statement-back-print": { id: "statement-back-print", name: "Statement Back Print", price: 149000, category: "Hombre", note: "Edicion grafica" },
  "signature-crop-tee": { id: "signature-crop-tee", name: "Signature Crop Tee", price: 129000, category: "Mujer", note: "Bordado fino" },
  "noir-essential-tee": { id: "noir-essential-tee", name: "Noir Essential Tee", price: 139000, category: "Mujer", note: "Negro profundo" },
  "sanctuary-oversize": { id: "sanctuary-oversize", name: "Sanctuary Oversize", price: 149000, category: "Mujer", note: "Espalda statement" },
  "balgrim-cap": { id: "balgrim-cap", name: "Balgrim Cap", price: 119000, category: "Accesorios", note: "Logo frontal" },
  "minimal-backpack": { id: "minimal-backpack", name: "Minimal Backpack", price: 249000, category: "Accesorios", note: "Utility line" },
  "signature-tote": { id: "signature-tote", name: "Signature Tote", price: 169000, category: "Accesorios", note: "Neutral canvas" },
};

const seedSettings = {
  storeName: "Balgrim",
  whatsappNumber: "573000000000",
};

const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
};

const readJsonFile = async (file, fallback) => {
  try {
    return JSON.parse(await fsp.readFile(file, "utf8"));
  } catch (error) {
    return fallback;
  }
};

const writeJsonFile = async (file, value) => {
  await fsp.writeFile(file, JSON.stringify(value, null, 2));
};

const hashPassword = (password, salt) =>
  crypto.pbkdf2Sync(password, salt, 120000, 64, "sha512").toString("hex");

const createToken = (payload) => {
  const base = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", SECRET).update(base).digest("base64url");
  return `${base}.${sig}`;
};

const verifyToken = (token) => {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [base, signature] = token.split(".");
  const expected = crypto.createHmac("sha256", SECRET).update(base).digest("base64url");
  if (signature !== expected) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(base, "base64url").toString("utf8"));
  if (!payload.exp || Date.now() > payload.exp) {
    return null;
  }

  return payload;
};

const getBearerToken = (req) => {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
};

const getAdminUser = async (req) => {
  const token = getBearerToken(req);
  const payload = verifyToken(token);
  if (!payload) {
    return null;
  }

  const users = await readJsonFile(FILES.users, []);
  return users.find((user) => user.email === payload.email && user.role === "admin") || null;
};

const requireAdmin = async (req, res) => {
  const user = await getAdminUser(req);
  if (!user) {
    json(res, 401, { error: "Sesion admin requerida." });
    return null;
  }
  return user;
};

const ensureData = async () => {
  await fsp.mkdir(DATA_DIR, { recursive: true });

  if (!fs.existsSync(FILES.products)) {
    await writeJsonFile(FILES.products, seedProducts);
  }
  if (!fs.existsSync(FILES.orders)) {
    await writeJsonFile(FILES.orders, []);
  }
  if (!fs.existsSync(FILES.settings)) {
    await writeJsonFile(FILES.settings, seedSettings);
  }
  if (!fs.existsSync(FILES.users)) {
    const salt = crypto.randomBytes(16).toString("hex");
    const password = "Balgrim123!";
    await writeJsonFile(FILES.users, [
      {
        email: "admin@balgrim.local",
        passwordHash: hashPassword(password, salt),
        role: "admin",
        salt,
      },
    ]);
    console.log("Admin inicial: admin@balgrim.local / Balgrim123!");
  }
};

const createOrderId = () => {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `BAL-${stamp}-${random}`;
};

const serveStatic = async (req, res, pathname) => {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const safePath = path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    json(res, 403, { error: "Ruta invalida." });
    return;
  }

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) {
      return serveStatic(req, res, `${pathname.replace(/\/$/, "")}/index.html`);
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    json(res, 404, { error: "No encontrado." });
  }
};

const handleApi = async (req, res, url) => {
  const { pathname } = url;

  if (req.method === "GET" && pathname === "/api/products") {
    const products = await readJsonFile(FILES.products, seedProducts);
    return json(res, 200, { products });
  }

  if (req.method === "GET" && pathname === "/api/settings") {
    const settings = await readJsonFile(FILES.settings, seedSettings);
    return json(res, 200, { settings });
  }

  if (req.method === "POST" && pathname === "/api/orders") {
    const body = await readBody(req);
    if (!body.customer?.name || !body.customer?.phone || !body.customer?.address) {
      return json(res, 400, { error: "Faltan datos del cliente." });
    }

    if (!Array.isArray(body.items) || !body.items.length) {
      return json(res, 400, { error: "No hay items para crear el pedido." });
    }

    const orders = await readJsonFile(FILES.orders, []);
    const order = {
      id: createOrderId(),
      createdAt: new Date().toISOString(),
      customer: body.customer,
      items: body.items,
      source: body.source || "web",
      subtotal: Number(body.subtotal) || 0,
      status: "pending",
    };
    orders.push(order);
    await writeJsonFile(FILES.orders, orders);
    return json(res, 201, { ok: true, order });
  }

  if (req.method === "POST" && pathname === "/api/admin/login") {
    const body = await readBody(req);
    const users = await readJsonFile(FILES.users, []);
    const user = users.find((entry) => entry.email === body.email && entry.role === "admin");

    if (!user) {
      return json(res, 401, { error: "Credenciales invalidas." });
    }

    const passwordHash = hashPassword(String(body.password || ""), user.salt);
    if (passwordHash !== user.passwordHash) {
      return json(res, 401, { error: "Credenciales invalidas." });
    }

    const token = createToken({
      email: user.email,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 12,
    });

    return json(res, 200, {
      token,
      user: { email: user.email, role: user.role },
    });
  }

  if (req.method === "GET" && pathname === "/api/admin/me") {
    const user = await requireAdmin(req, res);
    if (!user) {
      return;
    }
    return json(res, 200, { user: { email: user.email, role: user.role } });
  }

  if (pathname.startsWith("/api/admin/")) {
    const user = await requireAdmin(req, res);
    if (!user) {
      return;
    }

    if (req.method === "GET" && pathname === "/api/admin/products") {
      const products = await readJsonFile(FILES.products, seedProducts);
      return json(res, 200, { products });
    }

    if (req.method === "POST" && pathname === "/api/admin/products") {
      const body = await readBody(req);
      if (!body.id || !body.name || !body.category || !body.price) {
        return json(res, 400, { error: "Datos de producto incompletos." });
      }

      const products = await readJsonFile(FILES.products, seedProducts);
      products[body.id] = {
        id: String(body.id).trim(),
        name: String(body.name).trim(),
        category: String(body.category).trim(),
        note: String(body.note || "").trim(),
        price: Number(body.price) || 0,
      };
      await writeJsonFile(FILES.products, products);
      return json(res, 200, { products });
    }

    if (req.method === "DELETE" && pathname.startsWith("/api/admin/products/")) {
      const id = decodeURIComponent(pathname.split("/").pop());
      const products = await readJsonFile(FILES.products, seedProducts);
      delete products[id];
      await writeJsonFile(FILES.products, products);
      return json(res, 200, { products });
    }

    if (req.method === "GET" && pathname === "/api/admin/orders") {
      const orders = await readJsonFile(FILES.orders, []);
      return json(res, 200, { orders });
    }

    if (req.method === "GET" && pathname === "/api/admin/settings") {
      const settings = await readJsonFile(FILES.settings, seedSettings);
      return json(res, 200, { settings });
    }

    if (req.method === "PUT" && pathname === "/api/admin/settings") {
      const body = await readBody(req);
      const settings = {
        storeName: String(body.storeName || "Balgrim").trim(),
        whatsappNumber: String(body.whatsappNumber || "").trim(),
      };
      await writeJsonFile(FILES.settings, settings);
      return json(res, 200, { settings });
    }
  }

  return json(res, 404, { error: "Endpoint no encontrado." });
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname.startsWith("/api/")) {
      return await handleApi(req, res, url);
    }
    return await serveStatic(req, res, url.pathname);
  } catch (error) {
    console.error(error);
    return json(res, 500, { error: "Error interno del servidor." });
  }
});

ensureData()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`Balgrim server activo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("No se pudo iniciar el servidor:", error);
    process.exit(1);
  });
