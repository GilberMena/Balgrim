(function () {
  const DEFAULT_PRODUCTS = {
    "fortitude-tee": {
      id: "fortitude-tee",
      name: "T-Shirt Fortitude",
      price: 129000,
      category: "Nuevos lanzamientos",
      note: "Drop esencial",
    },
    "special-edition-tee": {
      id: "special-edition-tee",
      name: "T-Shirt Special Edition",
      price: 149000,
      category: "Nuevos lanzamientos",
      note: "Edicion limitada",
    },
    "creative-sanctuary-tee": {
      id: "creative-sanctuary-tee",
      name: "Creative Sanctuary",
      price: 139000,
      category: "Nuevos lanzamientos",
      note: "Grafico posterior",
    },
    "black-fortitude-tee": {
      id: "black-fortitude-tee",
      name: "Black Fortitude Tee",
      price: 139000,
      category: "Hombre",
      note: "Algodon pesado",
    },
    "ivory-core-tee": {
      id: "ivory-core-tee",
      name: "Ivory Core Tee",
      price: 129000,
      category: "Hombre",
      note: "Fit regular",
    },
    "statement-back-print": {
      id: "statement-back-print",
      name: "Statement Back Print",
      price: 149000,
      category: "Hombre",
      note: "Edicion grafica",
    },
    "signature-crop-tee": {
      id: "signature-crop-tee",
      name: "Signature Crop Tee",
      price: 129000,
      category: "Mujer",
      note: "Bordado fino",
    },
    "noir-essential-tee": {
      id: "noir-essential-tee",
      name: "Noir Essential Tee",
      price: 139000,
      category: "Mujer",
      note: "Negro profundo",
    },
    "sanctuary-oversize": {
      id: "sanctuary-oversize",
      name: "Sanctuary Oversize",
      price: 149000,
      category: "Mujer",
      note: "Espalda statement",
    },
    "balgrim-cap": {
      id: "balgrim-cap",
      name: "Balgrim Cap",
      price: 119000,
      category: "Accesorios",
      note: "Logo frontal",
    },
    "minimal-backpack": {
      id: "minimal-backpack",
      name: "Minimal Backpack",
      price: 249000,
      category: "Accesorios",
      note: "Utility line",
    },
    "signature-tote": {
      id: "signature-tote",
      name: "Signature Tote",
      price: 169000,
      category: "Accesorios",
      note: "Neutral canvas",
    },
  };

  const DEFAULT_SETTINGS = {
    whatsappNumber: "573000000000",
    storeName: "Balgrim",
    shippingFlatRate: 15000,
    freeShippingFrom: 280000,
    supportEmail: "soporte@balgrim.co",
  };

  const DEFAULT_CONTENT_BLOCKS = [];

  const KEYS = {
    adminToken: "balgrim-admin-token",
    cart: "balgrim-cart",
    catalog: "balgrim-catalog",
    content: "balgrim-content",
    settings: "balgrim-settings",
  };

  const API_BASE_URL =
    window.BALGRIM_API_URL ||
    (window.location.protocol === "file:"
      ? ""
      : `${window.location.protocol}//${window.location.hostname}:4000`);

  const clone = (value) => JSON.parse(JSON.stringify(value));

  const safeParse = (raw, fallback) => {
    try {
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  };

  const normalizeProducts = (products) => {
    const source = Array.isArray(products)
      ? products.reduce((acc, product) => {
          acc[product.slug || product.id] = product;
          return acc;
        }, {})
      : products || {};

    return Object.entries(source).reduce((acc, [id, product]) => {
      if (!id || !product) {
        return acc;
      }

      const baseVariant =
        Array.isArray(product.variants) && product.variants.length
          ? product.variants[0]
          : {
              id: `${product.slug || id}-default`,
              sku: `${String(product.slug || id).toUpperCase()}-BASE`,
              size: "UNI",
              color: "Base",
              stock: Number(product.stock ?? 10) || 10,
              imageUrl: "",
              price: Number(product.price) || 0,
            };
      const variants = Array.isArray(product.variants) && product.variants.length
        ? product.variants.map((variant, index) => ({
            id: variant.id || `${product.slug || id}-variant-${index + 1}`,
            sku: variant.sku || `${String(product.slug || id).toUpperCase()}-${index + 1}`,
            size: variant.size || "UNI",
            color: variant.color || "Base",
            stock: Number(variant.stock ?? 0),
            imageUrl: variant.imageUrl || "",
            price: Number(variant.price ?? product.price) || 0,
          }))
        : [baseVariant];
      const firstVariant = variants[0] || null;
      const images = Array.isArray(product.images)
        ? product.images.map((image) => (typeof image === "string" ? image : image?.url)).filter(Boolean)
        : [];
      const variantImages = variants.map((variant) => variant?.imageUrl).filter(Boolean);
      const categoryName =
        typeof product.category === "string"
          ? product.category
          : product.category?.name || "Sin categoria";
      const primaryImage =
        product.primaryImage ||
        images[0] ||
        firstVariant?.imageUrl ||
        "";
      const secondaryImage = images[1] || variantImages[0] || primaryImage;

      acc[id] = {
        id,
        slug: product.slug || id,
        name: String(product.name || id).trim(),
        price: Number(product.price ?? firstVariant?.price) || 0,
        category: String(categoryName).trim(),
        note: String(product.note ?? product.description ?? "").trim(),
        variantId: product.variantId || firstVariant?.id || null,
        images,
        primaryImage,
        secondaryImage,
        variants,
      };
      return acc;
    }, {});
  };

  const getCatalog = () => {
    const saved = safeParse(localStorage.getItem(KEYS.catalog), null);
    return saved ? normalizeProducts(saved) : normalizeProducts(clone(DEFAULT_PRODUCTS));
  };

  const saveCatalog = (catalog) => {
    localStorage.setItem(KEYS.catalog, JSON.stringify(normalizeProducts(catalog)));
  };

  const resetCatalog = () => {
    localStorage.removeItem(KEYS.catalog);
    return normalizeProducts(clone(DEFAULT_PRODUCTS));
  };

  const getSettings = () => {
    const saved = safeParse(localStorage.getItem(KEYS.settings), {});
    return { ...DEFAULT_SETTINGS, ...saved };
  };

  const getContentBlocks = () => {
    const saved = safeParse(localStorage.getItem(KEYS.content), DEFAULT_CONTENT_BLOCKS);
    return Array.isArray(saved) ? saved : DEFAULT_CONTENT_BLOCKS;
  };

  const saveContentBlocks = (blocks) => {
    localStorage.setItem(KEYS.content, JSON.stringify(Array.isArray(blocks) ? blocks : []));
  };

  const saveSettings = (settings) => {
    localStorage.setItem(
      KEYS.settings,
      JSON.stringify({ ...DEFAULT_SETTINGS, ...settings })
    );
  };

  const loadCart = () => safeParse(localStorage.getItem(KEYS.cart), []);

  const saveCart = (cart) => {
    localStorage.setItem(KEYS.cart, JSON.stringify(cart));
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(value);

  const canUseApi = () => /^https?:$/.test(window.location.protocol);

  const getAdminToken = () => localStorage.getItem(KEYS.adminToken) || "";

  const setAdminToken = (token) => {
    if (token) {
      localStorage.setItem(KEYS.adminToken, token);
    } else {
      localStorage.removeItem(KEYS.adminToken);
    }
  };

  const apiRequest = async (path, options = {}) => {
    if (!canUseApi()) {
      throw new Error("API no disponible en modo archivo.");
    }

    const headers = new Headers(options.headers || {});
    if (!headers.has("Content-Type") && options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const token = getAdminToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...options,
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || "No se pudo completar la solicitud.");
    }
    return data;
  };

  const loadCatalogFromSource = async () => {
    try {
      const data = await apiRequest("/api/products");
      const catalog = normalizeProducts(data.products);
      saveCatalog(catalog);
      return catalog;
    } catch (error) {
      return getCatalog();
    }
  };

  const loadProductBySlugFromSource = async (slug) => {
    try {
      const data = await apiRequest(`/api/products/${encodeURIComponent(slug)}`);
      const normalized = normalizeProducts([data.product]);
      const product = normalized[slug] || Object.values(normalized)[0] || null;
      if (product) {
        saveCatalog({ ...getCatalog(), [product.id]: product });
      }
      return product;
    } catch (error) {
      const catalog = getCatalog();
      return catalog[slug] || Object.values(catalog).find((product) => product.slug === slug) || null;
    }
  };

  const loadSettingsFromSource = async () => {
    try {
      const data = await apiRequest("/api/settings");
      const settings = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
      saveSettings(settings);
      return settings;
    } catch (error) {
      return getSettings();
    }
  };

  const loadContentBlocksFromSource = async () => {
    try {
      const data = await apiRequest("/api/content");
      const blocks = Array.isArray(data.blocks) ? data.blocks : [];
      saveContentBlocks(blocks);
      return blocks;
    } catch (error) {
      return getContentBlocks();
    }
  };

  const createOrder = async (order) => {
    try {
      return await apiRequest("/api/orders", {
        method: "POST",
        body: JSON.stringify(order),
      });
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const createWompiCheckout = async (payload) => {
    try {
      return await apiRequest("/api/payments/wompi/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (error) {
      return { ok: false, error: error.message };
    }
  };

  const loginAdmin = async (credentials) => {
    const data = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
    setAdminToken(data.token || "");
    return data;
  };

  const getAdminSession = async () => {
    const data = await apiRequest("/api/auth/me");
    return data.user;
  };

  const logoutAdmin = () => {
    setAdminToken("");
  };

  const adminLoadDashboard = async () => {
    const [
      dashboardResponse,
      productsResponse,
      ordersResponse,
      settingsResponse,
      customersResponse,
      inventoryResponse,
      couponsResponse,
      contentResponse,
      auditResponse,
    ] = await Promise.all([
      apiRequest("/api/admin/dashboard"),
      apiRequest("/api/admin/products"),
      apiRequest("/api/admin/orders"),
      apiRequest("/api/admin/settings"),
      apiRequest("/api/admin/customers"),
      apiRequest("/api/admin/inventory"),
      apiRequest("/api/admin/coupons"),
      apiRequest("/api/admin/content"),
      apiRequest("/api/admin/audit-logs"),
    ]);

    const catalog = normalizeProducts(productsResponse.products);
    const settings = { ...DEFAULT_SETTINGS, ...(settingsResponse.settings || {}) };

    saveCatalog(catalog);
    saveSettings(settings);

    return {
      dashboard: dashboardResponse || { metrics: {}, lowStock: [], recentOrders: [] },
      catalog,
      orders: Array.isArray(ordersResponse.orders) ? ordersResponse.orders : [],
      customers: Array.isArray(customersResponse.customers) ? customersResponse.customers : [],
      inventory: {
        variants: Array.isArray(inventoryResponse.variants) ? inventoryResponse.variants : [],
        adjustments: Array.isArray(inventoryResponse.adjustments)
          ? inventoryResponse.adjustments
          : [],
      },
      coupons: Array.isArray(couponsResponse.coupons) ? couponsResponse.coupons : [],
      contentBlocks: Array.isArray(contentResponse.blocks) ? contentResponse.blocks : [],
      auditLogs: Array.isArray(auditResponse.logs) ? auditResponse.logs : [],
      settings,
    };
  };

  const adminSaveProduct = async (product) => {
    const data = await apiRequest("/api/admin/products", {
      method: "POST",
      body: JSON.stringify(product),
    });
    return Array.isArray(data.products) ? data.products : [];
  };

  const adminLoadProducts = async () => {
    const data = await apiRequest("/api/admin/products");
    return Array.isArray(data.products) ? data.products : [];
  };

  const adminDeleteProduct = async (id) => {
    const data = await apiRequest(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return Array.isArray(data.products) ? data.products : [];
  };

  const adminSaveStoreSettings = async (settings) => {
    const data = await apiRequest("/api/admin/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    });
    return { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  };

  const adminUploadImage = async (file) => {
    const formData = new FormData();
    formData.append("image", file);

    const data = await apiRequest("/api/uploads", {
      method: "POST",
      body: formData,
    });

    return data.file || null;
  };

  const adminDeleteUploadedImage = async (filename) => {
    const data = await apiRequest(`/api/uploads/${encodeURIComponent(filename)}`, {
      method: "DELETE",
    });
    return data.ok === true;
  };

  const adminLoadOrders = async () => {
    const data = await apiRequest("/api/admin/orders");
    return Array.isArray(data.orders) ? data.orders : [];
  };

  const adminUpdateOrder = async (id, payload) => {
    const data = await apiRequest(`/api/admin/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    return data.order;
  };

  const adminLoadCustomers = async () => {
    const data = await apiRequest("/api/admin/customers");
    return Array.isArray(data.customers) ? data.customers : [];
  };

  const adminLoadInventory = async () => {
    const data = await apiRequest("/api/admin/inventory");
    return {
      variants: Array.isArray(data.variants) ? data.variants : [],
      adjustments: Array.isArray(data.adjustments) ? data.adjustments : [],
    };
  };

  const adminCreateInventoryAdjustment = async (payload) => {
    const data = await apiRequest("/api/admin/inventory/adjustments", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return {
      variants: Array.isArray(data.variants) ? data.variants : [],
      adjustments: Array.isArray(data.adjustments) ? data.adjustments : [],
    };
  };

  const adminLoadCoupons = async () => {
    const data = await apiRequest("/api/admin/coupons");
    return Array.isArray(data.coupons) ? data.coupons : [];
  };

  const adminSaveCoupon = async (payload) => {
    const data = await apiRequest("/api/admin/coupons", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return Array.isArray(data.coupons) ? data.coupons : [];
  };

  const adminDeleteCoupon = async (id) => {
    const data = await apiRequest(`/api/admin/coupons/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return Array.isArray(data.coupons) ? data.coupons : [];
  };

  const adminLoadContentBlocks = async () => {
    const data = await apiRequest("/api/admin/content");
    return Array.isArray(data.blocks) ? data.blocks : [];
  };

  const adminSaveContentBlock = async (payload) => {
    const data = await apiRequest("/api/admin/content", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return Array.isArray(data.blocks) ? data.blocks : [];
  };

  const adminDeleteContentBlock = async (id) => {
    const data = await apiRequest(`/api/admin/content/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    return Array.isArray(data.blocks) ? data.blocks : [];
  };

  const adminLoadAuditLogs = async () => {
    const data = await apiRequest("/api/admin/audit-logs");
    return Array.isArray(data.logs) ? data.logs : [];
  };

  window.BalgrimStore = {
    DEFAULT_PRODUCTS: clone(DEFAULT_PRODUCTS),
    DEFAULT_SETTINGS: { ...DEFAULT_SETTINGS },
    KEYS,
    adminCreateInventoryAdjustment,
    adminDeleteContentBlock,
    adminDeleteCoupon,
    adminDeleteProduct,
    adminDeleteUploadedImage,
    adminLoadAuditLogs,
    adminLoadContentBlocks,
    adminLoadCoupons,
    adminLoadCustomers,
    adminLoadDashboard,
    adminLoadProducts,
    adminLoadInventory,
    adminLoadOrders,
    adminSaveProduct,
    adminSaveContentBlock,
    adminSaveCoupon,
    adminSaveStoreSettings,
    adminUploadImage,
    adminUpdateOrder,
    canUseApi,
    createOrder,
    createWompiCheckout,
    formatCurrency,
    API_BASE_URL,
    getAdminSession,
    getCatalog,
    getContentBlocks,
    getSettings,
    loadCart,
    loadCatalogFromSource,
    loadProductBySlugFromSource,
    loadContentBlocksFromSource,
    loadSettingsFromSource,
    loginAdmin,
    logoutAdmin,
    resetCatalog,
    saveCart,
    saveCatalog,
    saveContentBlocks,
    saveSettings,
  };
})();
