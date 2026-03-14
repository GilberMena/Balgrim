const {
  adminCreateInventoryAdjustment, adminDeleteContentBlock, adminDeleteCoupon, adminDeleteProduct,
  adminLoadDashboard, adminLoadProducts, adminSaveContentBlock, adminSaveCoupon,
  adminSaveProduct, adminSaveStoreSettings, adminUpdateOrder, adminUploadImage, adminDeleteUploadedImage,
  canUseApi, formatCurrency, getAdminSession, loginAdmin, logoutAdmin,
} = window.BalgrimStore;

const ORDER_STATUSES = ["PENDING", "AWAITING_PAYMENT", "PAID", "PREPARING", "SHIPPED", "DELIVERED", "CANCELLED"];
const state = {
  user: null,
  activeView: "dashboard",
  dashboard: { metrics: {}, lowStock: [], recentOrders: [] },
  products: [], orders: [], customers: [],
  inventory: { variants: [], adjustments: [] },
  coupons: [], contentBlocks: [], settings: {}, auditLogs: [],
  orderFilters: { query: "", status: "ALL", payment: "ALL" },
  selectedProductId: null, selectedCouponId: null, selectedContentId: null, draftProduct: null,
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(date);
};

const parseShippingRulesText = (raw = "") =>
  String(raw || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label = "", department = "", city = "", price = "0", eta = ""] = line.split("|").map((part) => part.trim());
      return {
        id: `rule-${index + 1}`,
        label,
        department,
        city,
        price: Number(price || 0),
        eta,
      };
    })
    .filter((rule) => rule.label && Number.isFinite(rule.price));

const formatShippingRulesText = (rules = []) =>
  (Array.isArray(rules) ? rules : [])
    .map((rule) => [
      rule.label || "",
      rule.department || "",
      rule.city || "",
      Number(rule.price || 0),
      rule.eta || "",
    ].join("|"))
    .join("\n");

const getPrimaryPayment = (order) => (Array.isArray(order.payments) && order.payments.length ? order.payments[0] : null);

const getStatusTone = (status = "") => {
  if (["PAID", "DELIVERED", "APPROVED"].includes(status)) return "is-positive";
  if (["CANCELLED", "DECLINED", "ERROR"].includes(status)) return "is-negative";
  if (["PREPARING", "SHIPPED"].includes(status)) return "is-neutral";
  return "";
};

const emptyShippingRule = (index = 0) => ({
  id: `rule-${index + 1}`,
  label: "",
  department: "",
  city: "",
  price: 0,
  eta: "",
});

const emptyVariant = () => ({ id: "", sku: "", size: "M", color: "Negro", stock: 0, price: 0, compareAtPrice: "", imageUrl: "" });
const emptyProduct = () => ({ id: "", name: "", category: "Nuevos lanzamientos", description: "", active: true, featured: false, images: [], variants: [emptyVariant()] });
const emptyCoupon = () => ({ code: "", description: "", discountType: "percentage", discountValue: "", minOrderAmount: "", active: true, startsAt: "", endsAt: "", usageLimit: "" });
const emptyContentBlock = () => ({ key: "", title: "", body: "", imageUrl: "", actionLabel: "", actionHref: "", active: true, position: 0 });
const findProduct = (id) => state.products.find((product) => product.id === id || product.slug === id) || null;
const currentProduct = () => state.draftProduct || findProduct(state.selectedProductId) || emptyProduct();
const currentCoupon = () => state.coupons.find((coupon) => coupon.id === state.selectedCouponId) || emptyCoupon();
const currentContent = () => state.contentBlocks.find((block) => block.id === state.selectedContentId) || emptyContentBlock();
let cropperSession = null;

const writeFeedback = (selector, message, isError = false) => {
  const node = document.querySelector(selector);
  if (!node) return;
  node.textContent = message;
  node.dataset.state = isError ? "error" : "success";
};

const getUploadFilename = (url) => {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname.startsWith("/uploads/")) return "";
    return parsed.pathname.split("/").pop() || "";
  } catch (error) {
    if (!url.includes("/uploads/")) return "";
    return url.split("/").pop()?.split("?")[0] || "";
  }
};

const getProductForm = () => document.querySelector(".admin-product-form");

const getProductImageUrls = () => {
  const form = getProductForm();
  if (!form) return [];
  return form.elements.images.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
};

const updateDraftProduct = (updater) => {
  const next = structuredClone(currentProduct());
  updater(next);
  state.draftProduct = next;
};

const compressImageFile = async (file, maxSize = 1600, quality = 0.82) => {
  if (!file?.type?.startsWith("image/")) return file;
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(file);
  });

  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
    img.src = dataUrl;
  });

  let { width, height } = image;
  if (width <= maxSize && height <= maxSize) return file;

  const scale = Math.min(maxSize / width, maxSize / height);
  width = Math.round(width * scale);
  height = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0, width, height);

  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
  if (!blob) return file;
  const extension = mimeType === "image/png" ? "png" : "jpg";
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + `.${extension}`, { type: mimeType });
};

const openLightbox = (src) => {
  const root = document.querySelector("[data-admin-lightbox]");
  const image = document.querySelector("[data-lightbox-image]");
  if (!root || !image || !src) return;
  image.src = src;
  root.hidden = false;
};

const closeLightbox = () => {
  const root = document.querySelector("[data-admin-lightbox]");
  const image = document.querySelector("[data-lightbox-image]");
  if (!root || !image) return;
  root.hidden = true;
  image.src = "";
};

const renderCropperPreview = () => {
  if (!cropperSession) return;
  const image = document.querySelector("[data-crop-image]");
  const frame = document.querySelector("[data-crop-frame]");
  if (!image || !frame) return;

  const cropWidth = frame.clientWidth || 360;
  const cropHeight = frame.clientHeight || 360;
  frame.dataset.aspect = cropperSession.aspect > 1 ? "wide" : cropperSession.aspect < 1 ? "portrait" : "square";

  const coverScale = Math.max(cropWidth / cropperSession.width, cropHeight / cropperSession.height);
  const displayWidth = cropperSession.width * coverScale * cropperSession.zoom;
  const displayHeight = cropperSession.height * coverScale * cropperSession.zoom;
  const minX = Math.min(0, cropWidth - displayWidth);
  const minY = Math.min(0, cropHeight - displayHeight);
  const offsetX = minX * (cropperSession.x / 100);
  const offsetY = minY * (cropperSession.y / 100);

  cropperSession.bounds = { minX, minY };
  cropperSession.render = { cropWidth, cropHeight, displayWidth, displayHeight, offsetX, offsetY };

  image.style.width = `${displayWidth}px`;
  image.style.height = `${displayHeight}px`;
  image.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
};

const openCropper = async (file, aspect = 1) =>
  new Promise(async (resolve, reject) => {
    try {
      const dataUrl = await new Promise((resolveFile, rejectFile) => {
        const reader = new FileReader();
        reader.onload = () => resolveFile(reader.result);
        reader.onerror = () => rejectFile(new Error("No se pudo abrir la imagen."));
        reader.readAsDataURL(file);
      });

      const imageMeta = await new Promise((resolveImage, rejectImage) => {
        const img = new Image();
        img.onload = () => resolveImage({ src: dataUrl, width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => rejectImage(new Error("No se pudo preparar la imagen."));
        img.src = dataUrl;
      });

      const root = document.querySelector("[data-admin-cropper]");
      const image = document.querySelector("[data-crop-image]");
      const zoom = document.querySelector("[data-crop-zoom]");
      const axisX = document.querySelector("[data-crop-x]");
      const axisY = document.querySelector("[data-crop-y]");
      if (!root || !image || !zoom || !axisX || !axisY) {
        resolve(file);
        return;
      }

      cropperSession = {
        file,
        src: imageMeta.src,
        width: imageMeta.width,
        height: imageMeta.height,
        aspect,
        zoom: 1,
        x: 50,
        y: 50,
        dragging: false,
        resolve,
        reject,
      };

      image.src = imageMeta.src;
      zoom.value = "100";
      axisX.value = "50";
      axisY.value = "50";
      root.hidden = false;
      document.querySelectorAll("[data-crop-aspect]").forEach((button) => {
        button.classList.toggle("is-active", Number(button.dataset.cropAspect) === aspect);
      });

      requestAnimationFrame(renderCropperPreview);
    } catch (error) {
      reject(error);
    }
  });

const closeCropper = () => {
  const root = document.querySelector("[data-admin-cropper]");
  const image = document.querySelector("[data-crop-image]");
  if (root) root.hidden = true;
  if (image) {
    image.src = "";
    image.style.width = "";
    image.style.height = "";
    image.style.transform = "";
  }
};

const applyCropper = async () => {
  if (!cropperSession?.render) return;
  const { file, src, width, height, aspect, render, resolve } = cropperSession;
  const targetWidth = aspect > 1 ? 1600 : 1600;
  const targetHeight = aspect > 1 ? 900 : 1600;
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");

  const image = await new Promise((resolveImage, rejectImage) => {
    const img = new Image();
    img.onload = () => resolveImage(img);
    img.onerror = () => rejectImage(new Error("No se pudo recortar la imagen."));
    img.src = src;
  });

  const scaleX = width / render.displayWidth;
  const scaleY = height / render.displayHeight;
  const sourceX = Math.max(0, -render.offsetX * scaleX);
  const sourceY = Math.max(0, -render.offsetY * scaleY);
  const sourceWidth = Math.min(width, render.cropWidth * scaleX);
  const sourceHeight = Math.min(height, render.cropHeight * scaleY);

  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
  const mimeType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise((resolveBlob) => canvas.toBlob(resolveBlob, mimeType, 0.86));
  const extension = mimeType === "image/png" ? "png" : "jpg";
  const cropped = blob
    ? new File([blob], file.name.replace(/\.[^.]+$/, "") + `.${extension}`, { type: mimeType })
    : file;

  closeCropper();
  cropperSession = null;
  resolve(cropped);
};

const skipCropper = () => {
  if (!cropperSession) return;
  const { file, resolve } = cropperSession;
  closeCropper();
  cropperSession = null;
  resolve(file);
};

const prepareImageForUpload = async (file, aspect = 1) => {
  const cropped = await openCropper(file, aspect);
  return compressImageFile(cropped);
};

const syncCropperInputs = () => {
  if (!cropperSession?.bounds) return;
  const axisX = document.querySelector("[data-crop-x]");
  const axisY = document.querySelector("[data-crop-y]");
  if (axisX) axisX.value = String(Math.round(cropperSession.x));
  if (axisY) axisY.value = String(Math.round(cropperSession.y));
};

const renderProductImagesPreview = (urls) => {
  const preview = document.querySelector("[data-product-images-preview]");
  if (!preview) return;
  preview.innerHTML = urls.length
    ? urls.map((imageUrl, index) => `
      <figure class="admin-image-preview admin-image-preview--draggable" draggable="true" data-product-image-item="${index}">
        <img src="${imageUrl}" alt="Preview de producto">
        <figcaption class="admin-image-preview__actions">
          ${index === 0 ? `<span class="admin-image-badge">Principal</span>` : `<button class="admin-image-action admin-image-action--ghost" type="button" data-make-primary-image="${index}">Hacer principal</button>`}
          <button class="admin-image-action" type="button" data-remove-product-image="${index}">Quitar</button>
        </figcaption>
      </figure>`).join("")
    : `<div class="admin-image-preview admin-image-preview--empty">Sin imagenes aun.</div>`;
};

const syncProductImageUrls = (urls) => {
  const form = getProductForm();
  if (!form) return;
  form.elements.images.value = urls.join("\n");
  updateDraftProduct((product) => {
    product.images = urls;
  });
  renderProductImagesPreview(urls);
};

const renderVariantMarkup = (variant, index) => `
  <div class="admin-variant-row" data-variant-index="${index}">
    <div class="admin-form-grid admin-form-grid--triple">
      <label class="checkout-field"><span>SKU</span><input type="text" name="variant-sku-${index}" value="${variant.sku || ""}" required></label>
      <label class="checkout-field"><span>Talla</span><input type="text" name="variant-size-${index}" value="${variant.size || ""}" required></label>
      <label class="checkout-field"><span>Color</span><input type="text" name="variant-color-${index}" value="${variant.color || ""}" required></label>
      <label class="checkout-field"><span>Stock</span><input type="number" name="variant-stock-${index}" value="${variant.stock ?? 0}" min="0" step="1" required></label>
      <label class="checkout-field"><span>Precio</span><input type="number" name="variant-price-${index}" value="${variant.price ?? 0}" min="0" step="1000" required></label>
      <label class="checkout-field"><span>Compare at</span><input type="number" name="variant-compare-${index}" value="${variant.compareAtPrice ?? ""}" min="0" step="1000"></label>
      <label class="checkout-field"><span>Subir imagen variante</span><input type="file" name="variant-image-file-${index}" accept="image/*" data-variant-upload="${index}"></label>
      <label class="checkout-field admin-field--full"><span>Imagen variante</span><input type="url" name="variant-image-${index}" value="${variant.imageUrl || ""}" placeholder="https://..."></label>
    </div>
    <div class="admin-image-preview-grid admin-image-preview-grid--single">
      ${variant.imageUrl
        ? `<figure class="admin-image-preview"><img src="${variant.imageUrl}" alt="Preview de variante"><figcaption class="admin-image-preview__actions"><button class="admin-image-action" type="button" data-remove-variant-image="${index}">Quitar</button></figcaption></figure>`
        : `<div class="admin-image-preview admin-image-preview--empty">Sin imagen de variante.</div>`}
    </div>
    <input type="hidden" name="variant-id-${index}" value="${variant.id || ""}">
    <button class="admin-link-button" type="button" data-remove-variant="${index}">Eliminar variante</button>
  </div>`;

const renderVariantList = (product) => {
  const variantsList = document.querySelector("[data-variants-list]");
  if (!variantsList) return;
  variantsList.innerHTML = (product.variants && product.variants.length ? product.variants : [emptyVariant()])
    .map(renderVariantMarkup)
    .join("");
};

const renderAuth = () => {
  const gate = document.querySelector(".admin-auth");
  const panel = document.querySelector(".admin-app");
  const emailNode = document.querySelector("[data-admin-user]");
  const isLoggedIn = Boolean(state.user);
  if (!gate || !panel) return;
  gate.hidden = isLoggedIn;
  panel.hidden = !isLoggedIn;
  if (emailNode) emailNode.textContent = isLoggedIn ? state.user.email : "";
};

const setView = (view) => {
  state.activeView = view;
  document.querySelectorAll("[data-admin-view-trigger]").forEach((button) => button.classList.toggle("is-active", button.dataset.adminViewTrigger === view));
  document.querySelectorAll("[data-admin-view]").forEach((section) => section.classList.toggle("is-active", section.dataset.adminView === view));
};

const renderKpis = () => {
  const metrics = state.dashboard.metrics || {};
  const map = {
    "[data-metric-products]": String(metrics.products || 0),
    "[data-metric-orders]": String(metrics.orders || 0),
    "[data-metric-revenue]": formatCurrency(metrics.revenue || 0),
    "[data-metric-low-stock]": String(metrics.lowStockCount || 0),
  };
  Object.entries(map).forEach(([selector, value]) => {
    const node = document.querySelector(selector);
    if (node) node.textContent = value;
  });
};

const renderDashboard = () => {
  const recent = document.querySelector("[data-dashboard-recent-orders]");
  const low = document.querySelector("[data-dashboard-low-stock]");
  if (recent) {
    recent.innerHTML = (state.dashboard.recentOrders || []).length
      ? state.dashboard.recentOrders.map((order) => `
        <article class="admin-stack-item"><div><strong>${order.guestName || order.id}</strong><span class="status-pill ${getStatusTone(order.status)}">${order.status}</span></div><div><strong>${formatCurrency(order.total || 0)}</strong><span>${formatDate(order.createdAt)}</span></div></article>`).join("")
      : `<p class="admin-empty">Todavia no hay pedidos recientes.</p>`;
  }
  if (low) {
    low.innerHTML = (state.dashboard.lowStock || []).length
      ? state.dashboard.lowStock.map((variant) => `
        <article class="admin-stack-item admin-stack-item--warning"><div><strong>${variant.productName}</strong><span>${variant.size} / ${variant.color}</span></div><div><strong>${variant.stock}</strong><span>${variant.sku}</span></div></article>`).join("")
      : `<p class="admin-empty">No hay alertas de stock en este momento.</p>`;
  }
};

const renderProducts = () => {
  const list = document.querySelector("[data-products-list]");
  const form = document.querySelector(".admin-product-form");
  if (list) {
    const products = state.products.slice().sort((a, b) => a.name.localeCompare(b.name));
    list.innerHTML = products.length
      ? products.map((product) => `
        <button class="admin-product${state.selectedProductId === product.id ? " is-active" : ""}" type="button" data-select-product="${product.id}">
          <span class="admin-product__category">${product.category || "Sin categoria"}</span><strong>${product.name}</strong><span>${(product.variants || []).length} variantes</span>
        </button>`).join("")
      : `<p class="admin-empty">No hay productos en catalogo.</p>`;
  }
  if (!form) return;
  const product = currentProduct();
  form.elements.id.value = product.id || product.slug || "";
  form.elements.name.value = product.name || "";
  form.elements.category.value = product.category || "Nuevos lanzamientos";
  form.elements.description.value = product.description || "";
  form.elements.active.value = String(product.active !== false);
  form.elements.featured.value = String(Boolean(product.featured));
  form.elements.images.value = Array.isArray(product.images) ? product.images.join("\n") : "";
  renderProductImagesPreview(Array.isArray(product.images) ? product.images : []);
  renderVariantList(product);
};

const renderShippingRulesEditor = (rules = []) => {
  const container = document.querySelector("[data-shipping-rules-list]");
  if (!container) return;
  const normalizedRules = Array.isArray(rules) && rules.length ? rules : [emptyShippingRule(0)];
  container.innerHTML = normalizedRules
    .map(
      (rule, index) => `
        <div class="admin-shipping-rule" data-shipping-rule-index="${index}">
          <div class="admin-form-grid admin-form-grid--double">
            <label class="checkout-field"><span>Etiqueta</span><input type="text" name="shipping-rule-label-${index}" value="${rule.label || ""}" placeholder="Bogota express"></label>
            <label class="checkout-field"><span>Departamento</span><input type="text" name="shipping-rule-department-${index}" value="${rule.department || ""}" placeholder="Cundinamarca"></label>
            <label class="checkout-field"><span>Ciudad</span><input type="text" name="shipping-rule-city-${index}" value="${rule.city || ""}" placeholder="Bogota"></label>
            <label class="checkout-field"><span>Precio</span><input type="number" name="shipping-rule-price-${index}" value="${Number(rule.price || 0)}" min="0" step="1000"></label>
            <label class="checkout-field admin-field--full"><span>ETA</span><input type="text" name="shipping-rule-eta-${index}" value="${rule.eta || ""}" placeholder="Mismo dia o 2 a 4 dias habiles"></label>
          </div>
          <button class="admin-link-button" type="button" data-remove-shipping-rule="${index}">Eliminar tarifa</button>
        </div>
      `
    )
    .join("");
};

const collectShippingRulesFromEditor = () => {
  const rows = Array.from(document.querySelectorAll("[data-shipping-rule-index]"));
  return rows
    .map((row, index) => ({
      id: `rule-${index + 1}`,
      label: String(row.querySelector(`[name="shipping-rule-label-${index}"]`)?.value || "").trim(),
      department: String(row.querySelector(`[name="shipping-rule-department-${index}"]`)?.value || "").trim(),
      city: String(row.querySelector(`[name="shipping-rule-city-${index}"]`)?.value || "").trim(),
      price: Number(row.querySelector(`[name="shipping-rule-price-${index}"]`)?.value || 0),
      eta: String(row.querySelector(`[name="shipping-rule-eta-${index}"]`)?.value || "").trim(),
    }))
    .filter((rule) => rule.label);
};

const renderOrders = () => {
  const container = document.querySelector("[data-orders-list]");
  const queryInput = document.querySelector("[data-order-filter-query]");
  const statusSelect = document.querySelector("[data-order-filter-status]");
  const paymentSelect = document.querySelector("[data-order-filter-payment]");
  if (!container) return;
  if (queryInput) queryInput.value = state.orderFilters.query;
  if (statusSelect) statusSelect.value = state.orderFilters.status;
  if (paymentSelect) paymentSelect.value = state.orderFilters.payment;
  const filteredOrders = state.orders.filter((order) => {
    const payment = getPrimaryPayment(order);
    const query = state.orderFilters.query.trim().toLowerCase();
    const matchesQuery =
      !query ||
      [order.id, order.guestName, order.guestPhone, order.guestCity]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    const matchesStatus = state.orderFilters.status === "ALL" || order.status === state.orderFilters.status;
    const paymentStatus = payment?.status || "NONE";
    const matchesPayment =
      state.orderFilters.payment === "ALL" || paymentStatus === state.orderFilters.payment;
    return matchesQuery && matchesStatus && matchesPayment;
  });

  container.innerHTML = filteredOrders.length ? filteredOrders.map((order) => `
    <article class="admin-order-card">
      <div class="admin-order-card__head"><div><p class="admin-order-card__eyebrow">${order.id}</p><h3>${order.guestName || "Cliente invitado"}</h3><span>${order.guestPhone || "Sin telefono"}</span></div><div class="admin-order-card__amounts"><strong>${formatCurrency(order.total || 0)}</strong><span>${formatDate(order.createdAt)}</span></div></div>
      <div class="admin-pill-row">
        <span class="status-pill ${getStatusTone(order.status)}">Pedido: ${order.status}</span>
        ${getPrimaryPayment(order) ? `<span class="status-pill ${getStatusTone(getPrimaryPayment(order)?.status)}">Pago: ${getPrimaryPayment(order)?.provider} / ${getPrimaryPayment(order)?.status}</span>` : `<span class="status-pill">Pago: pendiente manual</span>`}
      </div>
      <p class="admin-order-card__address">${order.guestAddress || "Sin direccion"}${order.guestCity ? `, ${order.guestCity}` : ""}</p>
      <div class="admin-pill-row">${order.items.map((item) => `<span class="admin-pill">${item.productName} x${item.quantity}</span>`).join("")}</div>
      <form class="admin-order-form" data-order-id="${order.id}"><div class="admin-form-grid admin-form-grid--double"><label class="checkout-field"><span>Estado</span><select name="status">${ORDER_STATUSES.map((status) => `<option value="${status}"${status === order.status ? " selected" : ""}>${status}</option>`).join("")}</select></label><label class="checkout-field admin-field--full"><span>Notas internas</span><textarea name="internalNotes" rows="3" placeholder="Notas de logistica o soporte">${order.internalNotes || ""}</textarea></label></div><p class="admin-feedback" data-order-feedback="${order.id}"></p><button class="button button--add-to-cart" type="submit">Actualizar pedido</button></form>
    </article>`).join("") : `<p class="admin-empty">No hay pedidos que coincidan con los filtros actuales.</p>`;
};
const renderCustomers = () => {
  const tbody = document.querySelector("[data-customers-table]");
  if (!tbody) return;
  tbody.innerHTML = state.customers.length ? state.customers.map((customer) => `
    <tr><td><strong>${customer.name}</strong><br><span>${customer.email}</span></td><td>${customer.phone || "-"}</td><td>${customer.role}</td><td>${customer.totalOrders}</td><td>${formatCurrency(customer.totalSpent || 0)}</td></tr>`).join("") : `<tr><td colspan="5" class="admin-empty">Todavia no hay clientes registrados.</td></tr>`;
};

const renderInventory = () => {
  const tbody = document.querySelector("[data-inventory-table]");
  const adjustments = document.querySelector("[data-adjustments-list]");
  const select = document.querySelector("[data-inventory-variant-select]");
  if (select) {
    select.innerHTML = state.inventory.variants.length ? state.inventory.variants.map((variant) => `<option value="${variant.id}">${variant.productName} | ${variant.size}/${variant.color} | ${variant.sku}</option>`).join("") : `<option value="">Sin variantes</option>`;
  }
  if (tbody) {
    tbody.innerHTML = state.inventory.variants.length ? state.inventory.variants.map((variant) => `
      <tr class="${variant.lowStock ? "is-warning" : ""}"><td>${variant.productName}</td><td>${variant.sku}</td><td>${variant.size} / ${variant.color}</td><td>${variant.stock}</td><td>${formatCurrency(variant.price || 0)}</td></tr>`).join("") : `<tr><td colspan="5" class="admin-empty">No hay variantes cargadas.</td></tr>`;
  }
  if (adjustments) {
    adjustments.innerHTML = state.inventory.adjustments.length ? state.inventory.adjustments.map((item) => `
      <article class="admin-stack-item"><div><strong>${item.productName}</strong><span>${item.reason}</span></div><div><strong>${item.quantityChange > 0 ? "+" : ""}${item.quantityChange}</strong><span>${formatDate(item.createdAt)}</span></div></article>`).join("") : `<p class="admin-empty">No hay ajustes recientes.</p>`;
  }
};

const renderCoupons = () => {
  const list = document.querySelector("[data-coupons-list]");
  const form = document.querySelector(".coupon-form");
  if (list) {
    list.innerHTML = state.coupons.length ? state.coupons.map((coupon) => `
      <article class="admin-stack-item admin-stack-item--interactive${state.selectedCouponId === coupon.id ? " is-active" : ""}">
        <button type="button" class="admin-stack-item__main" data-select-coupon="${coupon.id}"><strong>${coupon.code}</strong><span>${coupon.description || "Sin descripcion"}</span></button>
        <div class="admin-stack-item__meta"><strong>${coupon.discountType === "percentage" ? `${coupon.discountValue}%` : formatCurrency(coupon.discountValue || 0)}</strong><button class="admin-link-button" type="button" data-delete-coupon="${coupon.id}">Eliminar</button></div>
      </article>`).join("") : `<p class="admin-empty">No hay cupones creados.</p>`;
  }
  if (!form) return;
  const coupon = currentCoupon();
  form.elements.code.value = coupon.code || "";
  form.elements.description.value = coupon.description || "";
  form.elements.discountType.value = coupon.discountType || "percentage";
  form.elements.discountValue.value = coupon.discountValue || "";
  form.elements.minOrderAmount.value = coupon.minOrderAmount || "";
  form.elements.usageLimit.value = coupon.usageLimit || "";
  form.elements.active.value = String(coupon.active !== false);
  form.elements.startsAt.value = coupon.startsAt ? coupon.startsAt.slice(0, 16) : "";
  form.elements.endsAt.value = coupon.endsAt ? coupon.endsAt.slice(0, 16) : "";
};

const renderContent = () => {
  const list = document.querySelector("[data-content-list]");
  const form = document.querySelector(".content-form");
  const preview = document.querySelector("[data-content-image-preview]");
  if (list) {
    list.innerHTML = state.contentBlocks.length ? state.contentBlocks.map((block) => `
      <article class="admin-stack-item admin-stack-item--interactive${state.selectedContentId === block.id ? " is-active" : ""}">
        <button type="button" class="admin-stack-item__main" data-select-content="${block.id}"><strong>${block.title}</strong><span>${block.key}</span></button>
        <div class="admin-stack-item__meta"><strong>#${block.position}</strong><button class="admin-link-button" type="button" data-delete-content="${block.id}">Eliminar</button></div>
      </article>`).join("") : `<p class="admin-empty">No hay bloques editoriales guardados.</p>`;
  }
  if (!form) return;
  const block = currentContent();
  form.elements.key.value = block.key || "";
  form.elements.title.value = block.title || "";
  form.elements.body.value = block.body || "";
  form.elements.imageUrl.value = block.imageUrl || "";
  form.elements.actionLabel.value = block.actionLabel || "";
  form.elements.actionHref.value = block.actionHref || "";
  form.elements.active.value = String(block.active !== false);
  form.elements.position.value = block.position ?? 0;
  if (preview) {
    preview.innerHTML = block.imageUrl
      ? `<figure class="admin-image-preview"><img src="${block.imageUrl}" alt="Preview de bloque"><figcaption class="admin-image-preview__actions"><button class="admin-image-action" type="button" data-remove-content-image>Quitar</button></figcaption></figure>`
      : `<div class="admin-image-preview admin-image-preview--empty">Sin imagen cargada.</div>`;
  }
};

const renderSettings = () => {
  const form = document.querySelector(".settings-form");
  if (!form) return;
  form.elements.storeName.value = state.settings.storeName || "Balgrim";
  form.elements.whatsappNumber.value = state.settings.whatsappNumber || "";
  form.elements.supportEmail.value = state.settings.supportEmail || "";
  form.elements.shippingFlatRate.value = state.settings.shippingFlatRate || 0;
  form.elements.freeShippingFrom.value = state.settings.freeShippingFrom || 0;
  renderShippingRulesEditor(state.settings.shippingRules || []);
};

const renderAudit = () => {
  const list = document.querySelector("[data-audit-list]");
  if (!list) return;
  list.innerHTML = state.auditLogs.length ? state.auditLogs.map((log) => `
    <article class="admin-stack-item"><div><strong>${log.summary}</strong><span>${log.entityType} · ${log.action}</span></div><div><strong>${log.actorName}</strong><span>${formatDate(log.createdAt)}</span></div></article>`).join("") : `<p class="admin-empty">Aun no hay movimientos auditados.</p>`;
};

const renderAll = () => {
  renderKpis(); renderDashboard(); renderProducts(); renderOrders(); renderCustomers(); renderInventory(); renderCoupons(); renderContent(); renderSettings(); renderAudit(); setView(state.activeView);
};

const collectProductPayload = (form) => {
  const rows = Array.from(form.querySelectorAll("[data-variant-index]"));
  return {
    id: form.elements.id.value.trim(),
    name: form.elements.name.value.trim(),
    category: form.elements.category.value.trim(),
    description: form.elements.description.value.trim(),
    active: form.elements.active.value === "true",
    featured: form.elements.featured.value === "true",
    images: form.elements.images.value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
    variants: rows.map((row, index) => ({
      id: form.elements[`variant-id-${index}`].value.trim() || undefined,
      sku: form.elements[`variant-sku-${index}`].value.trim(),
      size: form.elements[`variant-size-${index}`].value.trim(),
      color: form.elements[`variant-color-${index}`].value.trim(),
      stock: Number(form.elements[`variant-stock-${index}`].value || 0),
      price: Number(form.elements[`variant-price-${index}`].value || 0),
      compareAtPrice: form.elements[`variant-compare-${index}`].value ? Number(form.elements[`variant-compare-${index}`].value) : null,
      imageUrl: form.elements[`variant-image-${index}`].value.trim() || null,
    })),
  };
};

const refreshAdminData = async () => {
  const currentProductId = state.selectedProductId;
  const currentCouponId = state.selectedCouponId;
  const currentContentId = state.selectedContentId;
  const [dashboardBundle, products] = await Promise.all([adminLoadDashboard(), adminLoadProducts()]);
  state.dashboard = dashboardBundle.dashboard || { metrics: {}, lowStock: [], recentOrders: [] };
  state.orders = dashboardBundle.orders || [];
  state.customers = dashboardBundle.customers || [];
  state.inventory = dashboardBundle.inventory || { variants: [], adjustments: [] };
  state.coupons = dashboardBundle.coupons || [];
  state.contentBlocks = dashboardBundle.contentBlocks || [];
  state.settings = dashboardBundle.settings || {};
  state.auditLogs = dashboardBundle.auditLogs || [];
  state.products = products || [];
  state.selectedProductId = findProduct(currentProductId)?.id || state.products[0]?.id || null;
  state.draftProduct = state.selectedProductId
    ? structuredClone(findProduct(state.selectedProductId) || emptyProduct())
    : state.draftProduct;
  state.selectedCouponId = state.coupons.some((coupon) => coupon.id === currentCouponId) ? currentCouponId : state.coupons[0]?.id || null;
  state.selectedContentId = state.contentBlocks.some((block) => block.id === currentContentId) ? currentContentId : state.contentBlocks[0]?.id || null;
  renderAll();
};

const uploadProductImages = async (input) => {
  const files = Array.from(input.files || []);
  if (!files.length) return;

  try {
    writeFeedback("[data-product-feedback]", "Subiendo imagenes...");
    const preparedFiles = [];
    for (const file of files) {
      preparedFiles.push(await prepareImageForUpload(file, 0.8));
    }
    const uploads = await Promise.all(preparedFiles.map((file) => adminUploadImage(file)));
    const form = document.querySelector(".admin-product-form");
    if (!form) return;
    const currentUrls = form.elements.images.value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    const nextUrls = [...currentUrls, ...uploads.map((item) => item?.url).filter(Boolean)];
    syncProductImageUrls(nextUrls);
    writeFeedback("[data-product-feedback]", "Imagenes subidas.");
  } catch (error) {
    writeFeedback("[data-product-feedback]", error.message, true);
  } finally {
    input.value = "";
  }
};

const uploadContentImage = async (input) => {
  const file = input.files?.[0];
  if (!file) return;

  try {
    writeFeedback("[data-content-feedback]", "Subiendo imagen...");
    const uploaded = await adminUploadImage(await prepareImageForUpload(file, 16 / 9));
    const form = document.querySelector(".content-form");
    if (!form) return;
    form.elements.imageUrl.value = uploaded?.url || "";
    const preview = document.querySelector("[data-content-image-preview]");
    if (preview && uploaded?.url) {
      preview.innerHTML = `<figure class="admin-image-preview"><img src="${uploaded.url}" alt="Preview de bloque"></figure>`;
    }
    writeFeedback("[data-content-feedback]", "Imagen subida.");
  } catch (error) {
    writeFeedback("[data-content-feedback]", error.message, true);
  } finally {
    input.value = "";
  }
};

const removeProductImage = async (index) => {
  const urls = getProductImageUrls();
  const [removedUrl] = urls.splice(index, 1);
  if (!removedUrl) return;

  const filename = getUploadFilename(removedUrl);
  if (filename) {
    try {
      await adminDeleteUploadedImage(filename);
    } catch (error) {
      writeFeedback("[data-product-feedback]", error.message, true);
      return;
    }
  }

  syncProductImageUrls(urls);
  writeFeedback("[data-product-feedback]", "Imagen retirada.");
};

const reorderProductImages = (fromIndex, toIndex) => {
  const urls = getProductImageUrls();
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= urls.length || toIndex >= urls.length) {
    return;
  }
  const [moved] = urls.splice(fromIndex, 1);
  urls.splice(toIndex, 0, moved);
  syncProductImageUrls(urls);
};

const uploadVariantImage = async (index, input) => {
  const file = input.files?.[0];
  if (!file) return;

  try {
    writeFeedback("[data-product-feedback]", "Subiendo imagen de variante...");
    const form = getProductForm();
    const previousUrl = form ? String(form.elements[`variant-image-${index}`]?.value || "").trim() : "";
    const uploaded = await adminUploadImage(await prepareImageForUpload(file, 1));
    if (!form || !uploaded?.url) return;
    const previousFilename = getUploadFilename(previousUrl);
    if (previousFilename && previousFilename !== getUploadFilename(uploaded.url)) {
      try {
        await adminDeleteUploadedImage(previousFilename);
      } catch (cleanupError) {
        console.warn("variant_image_cleanup_failed", cleanupError);
      }
    }
    form.elements[`variant-image-${index}`].value = uploaded.url;
    updateDraftProduct((product) => {
      if (product.variants?.[index]) product.variants[index].imageUrl = uploaded.url;
    });
    renderProducts();
    writeFeedback("[data-product-feedback]", "Imagen de variante subida.");
  } catch (error) {
    writeFeedback("[data-product-feedback]", error.message, true);
  } finally {
    input.value = "";
  }
};

const makePrimaryProductImage = (index) => {
  const urls = getProductImageUrls();
  if (index <= 0 || index >= urls.length) return;
  const [selected] = urls.splice(index, 1);
  urls.unshift(selected);
  syncProductImageUrls(urls);
  writeFeedback("[data-product-feedback]", "Imagen principal actualizada.");
};

const removeContentImage = async () => {
  const form = document.querySelector(".content-form");
  if (!form) return;
  const url = String(form.elements.imageUrl.value || "").trim();
  if (!url) return;

  const filename = getUploadFilename(url);
  if (filename) {
    try {
      await adminDeleteUploadedImage(filename);
    } catch (error) {
      writeFeedback("[data-content-feedback]", error.message, true);
      return;
    }
  }

  form.elements.imageUrl.value = "";
  const preview = document.querySelector("[data-content-image-preview]");
  if (preview) {
    preview.innerHTML = `<div class="admin-image-preview admin-image-preview--empty">Sin imagen cargada.</div>`;
  }
  writeFeedback("[data-content-feedback]", "Imagen retirada.");
};

const removeVariantImage = async (index) => {
  const form = getProductForm();
  if (!form) return;
  const currentUrl = String(form.elements[`variant-image-${index}`]?.value || "").trim();
  if (!currentUrl) return;

  const filename = getUploadFilename(currentUrl);
  if (filename) {
    try {
      await adminDeleteUploadedImage(filename);
    } catch (error) {
      writeFeedback("[data-product-feedback]", error.message, true);
      return;
    }
  }

  form.elements[`variant-image-${index}`].value = "";
  updateDraftProduct((product) => {
    if (product.variants?.[index]) product.variants[index].imageUrl = "";
  });
  renderProducts();
  writeFeedback("[data-product-feedback]", "Imagen de variante retirada.");
};
const bindEvents = () => {
  document.addEventListener("change", async (event) => {
    if (event.target.matches("[data-order-filter-status]")) {
      state.orderFilters.status = String(event.target.value || "ALL");
      renderOrders();
      return;
    }

    if (event.target.matches("[data-order-filter-payment]")) {
      state.orderFilters.payment = String(event.target.value || "ALL");
      renderOrders();
      return;
    }

    if (event.target.matches('input[name="productImageFiles"]')) {
      await uploadProductImages(event.target);
      return;
    }

    if (event.target.matches('input[name="contentImageFile"]')) {
      await uploadContentImage(event.target);
      return;
    }

    if (event.target.matches("[data-variant-upload]")) {
      await uploadVariantImage(Number(event.target.dataset.variantUpload), event.target);
    }
  });

  document.addEventListener("input", (event) => {
    if (event.target.matches("[data-order-filter-query]")) {
      state.orderFilters.query = String(event.target.value || "");
      renderOrders();
      return;
    }

    if (event.target.matches("[data-crop-zoom]")) {
      cropperSession.zoom = Number(event.target.value) / 100;
      renderCropperPreview();
      return;
    }
    if (event.target.matches("[data-crop-x]")) {
      cropperSession.x = Number(event.target.value);
      renderCropperPreview();
      return;
    }
    if (event.target.matches("[data-crop-y]")) {
      cropperSession.y = Number(event.target.value);
      renderCropperPreview();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    const frame = event.target.closest("[data-crop-frame]");
    if (!frame || !cropperSession?.render || event.target.closest("input, button")) return;
    cropperSession.dragging = {
      startX: event.clientX,
      startY: event.clientY,
      x: cropperSession.x,
      y: cropperSession.y,
    };
    frame.classList.add("is-dragging");
  });

  document.addEventListener("pointermove", (event) => {
    if (!cropperSession?.dragging || !cropperSession?.bounds || !cropperSession?.render) return;
    const deltaX = event.clientX - cropperSession.dragging.startX;
    const deltaY = event.clientY - cropperSession.dragging.startY;
    const xRange = Math.abs(cropperSession.bounds.minX) || 1;
    const yRange = Math.abs(cropperSession.bounds.minY) || 1;
    cropperSession.x = Math.min(100, Math.max(0, cropperSession.dragging.x + (deltaX / xRange) * 100));
    cropperSession.y = Math.min(100, Math.max(0, cropperSession.dragging.y + (deltaY / yRange) * 100));
    syncCropperInputs();
    renderCropperPreview();
  });

  document.addEventListener("pointerup", () => {
    const frame = document.querySelector("[data-crop-frame]");
    if (frame) frame.classList.remove("is-dragging");
    if (cropperSession) cropperSession.dragging = null;
  });

  document.addEventListener("dragstart", (event) => {
    const item = event.target.closest("[data-product-image-item]");
    if (!item) return;
    event.dataTransfer.setData("text/plain", item.dataset.productImageItem);
  });

  document.addEventListener("dragover", (event) => {
    const item = event.target.closest("[data-product-image-item]");
    if (!item) return;
    event.preventDefault();
  });

  document.addEventListener("drop", (event) => {
    const item = event.target.closest("[data-product-image-item]");
    if (!item) return;
    event.preventDefault();
    const fromIndex = Number(event.dataTransfer.getData("text/plain"));
    const toIndex = Number(item.dataset.productImageItem);
    reorderProductImages(fromIndex, toIndex);
  });

  document.addEventListener("click", async (event) => {
    if (event.target.closest("[data-lightbox-close]")) {
      closeLightbox();
      return;
    }
    if (event.target.closest("[data-crop-cancel]")) {
      skipCropper();
      return;
    }
    if (event.target.closest("[data-crop-skip]")) {
      skipCropper();
      return;
    }
    if (event.target.closest("[data-crop-apply]")) {
      await applyCropper();
      return;
    }
    const aspectButton = event.target.closest("[data-crop-aspect]");
    if (aspectButton && cropperSession) {
      cropperSession.aspect = Number(aspectButton.dataset.cropAspect);
      document.querySelectorAll("[data-crop-aspect]").forEach((button) => {
        button.classList.toggle("is-active", button === aspectButton);
      });
      renderCropperPreview();
      return;
    }

    const viewTrigger = event.target.closest("[data-admin-view-trigger]");
    if (viewTrigger) return setView(viewTrigger.dataset.adminViewTrigger);
    const viewJump = event.target.closest("[data-admin-view-jump]");
    if (viewJump) return setView(viewJump.dataset.adminViewJump);
    if (event.target.closest("[data-admin-logout]")) { logoutAdmin(); state.user = null; return renderAuth(); }
    if (event.target.closest("[data-add-shipping-rule]")) {
      const nextRules = [...(Array.isArray(state.settings.shippingRules) ? state.settings.shippingRules : []), emptyShippingRule((state.settings.shippingRules || []).length)];
      state.settings.shippingRules = nextRules;
      renderShippingRulesEditor(nextRules);
      return;
    }
    const removeShippingRule = event.target.closest("[data-remove-shipping-rule]");
    if (removeShippingRule) {
      const index = Number(removeShippingRule.dataset.removeShippingRule);
      const rules = [...(Array.isArray(state.settings.shippingRules) ? state.settings.shippingRules : [])];
      rules.splice(index, 1);
      state.settings.shippingRules = rules.length ? rules : [emptyShippingRule(0)];
      renderShippingRulesEditor(state.settings.shippingRules);
      return;
    }

    const removeProductImageButton = event.target.closest("[data-remove-product-image]");
    if (removeProductImageButton) {
      await removeProductImage(Number(removeProductImageButton.dataset.removeProductImage));
      return;
    }

    const zoomableImage = event.target.closest(".admin-image-preview img");
    if (zoomableImage?.src) {
      openLightbox(zoomableImage.src);
      return;
    }

    const makePrimaryButton = event.target.closest("[data-make-primary-image]");
    if (makePrimaryButton) {
      makePrimaryProductImage(Number(makePrimaryButton.dataset.makePrimaryImage));
      return;
    }

    if (event.target.closest("[data-remove-content-image]")) {
      await removeContentImage();
      return;
    }
    const removeVariantImageButton = event.target.closest("[data-remove-variant-image]");
    if (removeVariantImageButton) {
      await removeVariantImage(Number(removeVariantImageButton.dataset.removeVariantImage));
      return;
    }

    const productBtn = event.target.closest("[data-select-product]");
    if (productBtn) { state.selectedProductId = productBtn.dataset.selectProduct; state.draftProduct = structuredClone(findProduct(state.selectedProductId) || emptyProduct()); return renderProducts(); }
    if (event.target.closest("[data-admin-new-product]")) { state.selectedProductId = null; state.draftProduct = emptyProduct(); return renderProducts(); }
    if (event.target.closest("[data-admin-delete-product]")) {
      if (!state.selectedProductId) return writeFeedback("[data-product-feedback]", "Selecciona un producto para eliminar.", true);
      try { await adminDeleteProduct(state.selectedProductId); state.selectedProductId = null; await refreshAdminData(); writeFeedback("[data-product-feedback]", "Producto eliminado."); } catch (error) { writeFeedback("[data-product-feedback]", error.message, true); }
      return;
    }
    if (event.target.closest("[data-admin-add-variant]")) {
      const product = structuredClone(currentProduct());
      product.variants = [...(product.variants || []), emptyVariant()];
      state.draftProduct = product;
      const form = document.querySelector(".admin-product-form");
      if (form) {
        form.elements.id.value = product.id || ""; form.elements.name.value = product.name || ""; form.elements.category.value = product.category || "Nuevos lanzamientos"; form.elements.description.value = product.description || ""; form.elements.active.value = String(product.active !== false); form.elements.featured.value = String(Boolean(product.featured)); form.elements.images.value = Array.isArray(product.images) ? product.images.join("\n") : "";
      }
      renderVariantList(product);
      return;
    }
    const removeVariant = event.target.closest("[data-remove-variant]");
    if (removeVariant) {
      const index = Number(removeVariant.dataset.removeVariant);
      const product = structuredClone(currentProduct());
      product.variants = (product.variants || []).filter((_, itemIndex) => itemIndex !== index);
      if (!product.variants.length) product.variants = [emptyVariant()];
      state.draftProduct = product;
      return renderProducts();
    }

    const couponBtn = event.target.closest("[data-select-coupon]");
    if (couponBtn) { state.selectedCouponId = couponBtn.dataset.selectCoupon; return renderCoupons(); }
    const deleteCoupon = event.target.closest("[data-delete-coupon]");
    if (deleteCoupon) {
      try { await adminDeleteCoupon(deleteCoupon.dataset.deleteCoupon); await refreshAdminData(); writeFeedback("[data-coupon-feedback]", "Cupon eliminado."); } catch (error) { writeFeedback("[data-coupon-feedback]", error.message, true); }
      return;
    }
    if (event.target.closest("[data-admin-new-coupon]")) { state.selectedCouponId = null; return renderCoupons(); }

    const contentBtn = event.target.closest("[data-select-content]");
    if (contentBtn) { state.selectedContentId = contentBtn.dataset.selectContent; return renderContent(); }
    const deleteContent = event.target.closest("[data-delete-content]");
    if (deleteContent) {
      try { await adminDeleteContentBlock(deleteContent.dataset.deleteContent); await refreshAdminData(); writeFeedback("[data-content-feedback]", "Bloque eliminado."); } catch (error) { writeFeedback("[data-content-feedback]", error.message, true); }
      return;
    }
    if (event.target.closest("[data-admin-new-content]")) { state.selectedContentId = null; return renderContent(); }
  });

  document.addEventListener("submit", async (event) => {
    if (event.target.matches(".admin-login-form")) {
      event.preventDefault();
      const formData = new FormData(event.target);
      try { const session = await loginAdmin({ email: String(formData.get("email") || "").trim(), password: String(formData.get("password") || "").trim() }); state.user = session.user; renderAuth(); await refreshAdminData(); writeFeedback(".admin-login-form .admin-feedback", "Sesion iniciada."); } catch (error) { writeFeedback(".admin-login-form .admin-feedback", error.message, true); }
      return;
    }
    if (event.target.matches(".admin-product-form")) {
      event.preventDefault();
      try { const payload = collectProductPayload(event.target); await adminSaveProduct(payload); state.selectedProductId = payload.id; state.draftProduct = null; await refreshAdminData(); writeFeedback("[data-product-feedback]", "Producto guardado."); } catch (error) { writeFeedback("[data-product-feedback]", error.message, true); }
      return;
    }
    if (event.target.matches(".admin-order-form")) {
      event.preventDefault();
      const orderId = event.target.dataset.orderId;
      const formData = new FormData(event.target);
      try { await adminUpdateOrder(orderId, { status: String(formData.get("status") || "PENDING"), internalNotes: String(formData.get("internalNotes") || "").trim() }); await refreshAdminData(); writeFeedback(`[data-order-feedback="${orderId}"]`, "Pedido actualizado."); } catch (error) { writeFeedback(`[data-order-feedback="${orderId}"]`, error.message, true); }
      return;
    }
    if (event.target.matches(".inventory-form")) {
      event.preventDefault();
      const formData = new FormData(event.target);
      try { await adminCreateInventoryAdjustment({ productVariantId: String(formData.get("productVariantId") || ""), quantityChange: Number(formData.get("quantityChange") || 0), reason: String(formData.get("reason") || "").trim() }); event.target.reset(); await refreshAdminData(); writeFeedback("[data-inventory-feedback]", "Ajuste registrado."); } catch (error) { writeFeedback("[data-inventory-feedback]", error.message, true); }
      return;
    }
    if (event.target.matches(".coupon-form")) {
      event.preventDefault();
      const formData = new FormData(event.target);
      try { await adminSaveCoupon({ code: String(formData.get("code") || "").trim().toUpperCase(), description: String(formData.get("description") || "").trim(), discountType: String(formData.get("discountType") || "percentage"), discountValue: Number(formData.get("discountValue") || 0), minOrderAmount: formData.get("minOrderAmount") ? Number(formData.get("minOrderAmount")) : null, usageLimit: formData.get("usageLimit") ? Number(formData.get("usageLimit")) : null, active: String(formData.get("active") || "true") === "true", startsAt: String(formData.get("startsAt") || "").trim() || null, endsAt: String(formData.get("endsAt") || "").trim() || null }); await refreshAdminData(); writeFeedback("[data-coupon-feedback]", "Cupon guardado."); } catch (error) { writeFeedback("[data-coupon-feedback]", error.message, true); }
      return;
    }
    if (event.target.matches(".content-form")) {
      event.preventDefault();
      const formData = new FormData(event.target);
      try { await adminSaveContentBlock({ key: String(formData.get("key") || "").trim(), title: String(formData.get("title") || "").trim(), body: String(formData.get("body") || "").trim(), imageUrl: String(formData.get("imageUrl") || "").trim(), actionLabel: String(formData.get("actionLabel") || "").trim(), actionHref: String(formData.get("actionHref") || "").trim(), active: String(formData.get("active") || "true") === "true", position: Number(formData.get("position") || 0) }); await refreshAdminData(); writeFeedback("[data-content-feedback]", "Bloque guardado."); } catch (error) { writeFeedback("[data-content-feedback]", error.message, true); }
      return;
    }
    if (event.target.matches(".settings-form")) {
      event.preventDefault();
      const formData = new FormData(event.target);
      try { await adminSaveStoreSettings({ id: state.settings.id, storeName: String(formData.get("storeName") || "").trim(), whatsappNumber: String(formData.get("whatsappNumber") || "").trim(), supportEmail: String(formData.get("supportEmail") || "").trim(), shippingFlatRate: Number(formData.get("shippingFlatRate") || 0), freeShippingFrom: Number(formData.get("freeShippingFrom") || 0), shippingRules: collectShippingRulesFromEditor() }); await refreshAdminData(); writeFeedback("[data-settings-feedback]", "Configuracion guardada."); } catch (error) { writeFeedback("[data-settings-feedback]", error.message, true); }
    }
  });

};

const initAdmin = async () => {
  bindEvents();
  if (!canUseApi()) return writeFeedback(".admin-login-form .admin-feedback", "Abre este panel desde http://localhost:3000/admin.html para usar la API real.", true);
  try { state.user = await getAdminSession(); renderAuth(); await refreshAdminData(); } catch (error) { state.user = null; renderAuth(); }
};

document.addEventListener("DOMContentLoaded", initAdmin);
