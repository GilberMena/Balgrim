const {
  createOrder,
  formatCurrency,
  getCatalog,
  getContentBlocks,
  getSettings,
  loadCart,
  loadCatalogFromSource,
  loadProductBySlugFromSource,
  loadContentBlocksFromSource,
  loadSettingsFromSource,
  saveCart,
} = window.BalgrimStore;

let catalog = getCatalog();
let contentBlocks = getContentBlocks();
let settings = getSettings();
let cart = loadCart();

const getProduct = (id) => catalog[id];
const getCatalogList = () => Object.values(catalog);
const getProductBySlug = (slug) => getCatalogList().find((product) => product.slug === slug || product.id === slug) || null;
const getProductUrl = (product) => `producto.html?slug=${encodeURIComponent(product.slug || product.id)}`;

const getProductImage = (product, fallback = "") =>
  product?.primaryImage || product?.secondaryImage || product?.images?.[0] || fallback;

const getProductHoverImage = (product, fallback = "") =>
  product?.secondaryImage || product?.primaryImage || product?.images?.[1] || fallback;

const getCartCount = () => cart.reduce((sum, item) => sum + item.quantity, 0);

const getCartTotal = () =>
  cart.reduce((sum, item) => {
    const variant = getCartVariant(item);
    return variant ? sum + variant.price * item.quantity : sum;
  }, 0);

const getDefaultVariant = (product) => product?.variants?.[0] || null;
const getFirstAvailableVariant = (product) =>
  product?.variants?.find((variant) => Number(variant.stock || 0) > 0) || getDefaultVariant(product);

const getVariantLabel = (variant) =>
  variant ? [variant.size, variant.color].filter(Boolean).join(" / ") : "Seleccion base";

const getProductVariant = (product, variantId) =>
  product?.variants?.find((variant) => variant.id === variantId) || getDefaultVariant(product);

const isVariantInStock = (variant) => Number(variant?.stock || 0) > 0;

const getOptionValues = (product, key) =>
  [...new Set((product?.variants || []).map((variant) => variant?.[key]).filter(Boolean))];

const findVariantByOptions = (product, size, color) =>
  (product?.variants || []).find(
    (variant) => (!size || variant.size === size) && (!color || variant.color === color)
  ) || null;

const findAvailableVariantByOptions = (product, size, color) =>
  (product?.variants || []).find(
    (variant) =>
      isVariantInStock(variant) &&
      (!size || variant.size === size) &&
      (!color || variant.color === color)
  ) || null;

const getVariantStockMessage = (variant) => {
  if (!variant) return "Selecciona una combinacion.";
  if (!isVariantInStock(variant)) return "Agotado";
  if (variant.stock <= 3) return `Quedan ${variant.stock} unidades`;
  return "Disponible";
};

const getColorSwatchStyle = (colorName = "") => {
  const normalized = String(colorName).toLowerCase();
  if (normalized.includes("negro") || normalized.includes("black")) return "background:#111;";
  if (normalized.includes("blanco") || normalized.includes("white") || normalized.includes("ivory")) {
    return "background:#f5f1e9; box-shadow: inset 0 0 0 1px rgba(10,10,10,0.14);";
  }
  if (normalized.includes("gris") || normalized.includes("gray")) return "background:#76777a;";
  if (normalized.includes("beige") || normalized.includes("arena") || normalized.includes("sand")) return "background:#baa287;";
  if (normalized.includes("azul") || normalized.includes("blue")) return "background:#365f8b;";
  if (normalized.includes("verde") || normalized.includes("green")) return "background:#5e7251;";
  if (normalized.includes("rojo") || normalized.includes("red") || normalized.includes("vino")) return "background:#7d2d2d;";
  return "background:linear-gradient(135deg, #0d0d0d, #9d8267);";
};

const getCartItemQuantity = (id, variantId) =>
  cart
    .filter((item) => item.id === id && item.variantId === variantId)
    .reduce((sum, item) => sum + item.quantity, 0);

const getCartVariant = (item) => {
  const product = getProduct(item.id);
  if (!product) return null;
  return getProductVariant(product, item.variantId);
};

const getCartIssues = () =>
  cart
    .map((item) => {
      const product = getProduct(item.id);
      const variant = getCartVariant(item);
      if (!product || !variant) return { item, type: "missing" };
      if (!isVariantInStock(variant)) return { item, type: "out_of_stock", product, variant };
      if (item.quantity > variant.stock) return { item, type: "quantity_exceeded", product, variant };
      return null;
    })
    .filter(Boolean);

const normalizeCartItems = () => {
  cart = cart
    .map((item) => {
      const product = getProduct(item.id);
      const variant = getProductVariant(product, item.variantId);
      if (!product || !variant) return null;
      return {
        ...item,
        variantId: variant.id,
        quantity: Math.max(1, Math.min(Number(item.quantity || 1), Math.max(Number(variant.stock || 0), 1))),
      };
    })
    .filter(Boolean);
  saveCart(cart);
};

const getWhatsappUrl = (customer, orderId) => {
  const lines = cart
    .map((item) => {
      const product = getProduct(item.id);
      const variant = getCartVariant(item);
      if (!product) {
        return null;
      }

      return `- ${product.name}${variant ? ` (${getVariantLabel(variant)})` : ""} x${item.quantity}: ${formatCurrency(
        (variant?.price || product.price) * item.quantity
      )}`;
    })
    .filter(Boolean);

  const message = [
    `Hola, quiero hacer un pedido en ${settings.storeName}.`,
    orderId ? `Pedido: ${orderId}` : null,
    "",
    "Datos del cliente:",
    `Nombre: ${customer.name}`,
    `Celular: ${customer.phone}`,
    `Direccion: ${customer.address}`,
    customer.notes ? `Notas: ${customer.notes}` : null,
    "",
    "Resumen del pedido:",
    ...lines,
    `Subtotal: ${formatCurrency(getCartTotal())}`,
  ]
    .filter(Boolean)
    .join("\n");

  return `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
    message
  )}`;
};

const getWhatsappSupportUrl = (message = `Hola, quiero mas informacion sobre ${settings.storeName}.`) =>
  `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(message)}`;

const footerTemplate = () => `
  <div class="footer__columns">
    <div class="footer-column">
      <span class="footer-title">Balgrim</span>
      <a href="index.html">Brand</a>
      <a href="nuevos-lanzamientos.html">Colecciones</a>
      <a href="/">Nuestras tiendas</a>
      <a href="/">Formulario PQRS</a>
    </div>
    <div class="footer-column">
      <span class="footer-title">Information</span>
      <a href="/">Politicas de cambios y devoluciones</a>
      <a href="/">Politicas de envios</a>
      <a href="/">Politicas de privacidad</a>
      <a href="/">Terminos y condiciones</a>
    </div>
  </div>
  <div class="footer__visual" aria-hidden="true">
    <div class="footer__glow"></div>
    <div class="footer__figure footer__figure--left"></div>
    <div class="footer__figure footer__figure--right"></div>
  </div>
  <div class="footer__signature">
    <div class="socials" aria-label="Redes sociales">
      <a class="social-icon" href="/" aria-label="Instagram">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3.5" y="3.5" width="17" height="17" rx="4"></rect>
          <circle cx="12" cy="12" r="4.2"></circle>
          <circle cx="17.3" cy="6.8" r="0.9" fill="currentColor" stroke="none"></circle>
        </svg>
      </a>
      <a class="social-icon" href="/" aria-label="YouTube">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.2 7.4C20 6.6 19.4 6 18.6 5.8C17.2 5.4 12 5.4 12 5.4C12 5.4 6.8 5.4 5.4 5.8C4.6 6 4 6.6 3.8 7.4C3.4 8.8 3.4 12 3.4 12C3.4 12 3.4 15.2 3.8 16.6C4 17.4 4.6 18 5.4 18.2C6.8 18.6 12 18.6 12 18.6C12 18.6 17.2 18.6 18.6 18.2C19.4 18 20 17.4 20.2 16.6C20.6 15.2 20.6 12 20.6 12C20.6 12 20.6 8.8 20.2 7.4Z"></path>
          <path d="M10 15.2V8.8L15.4 12L10 15.2Z" fill="none" stroke="currentColor"></path>
        </svg>
      </a>
      <a class="social-icon" href="/" aria-label="TikTok">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 4V13.4C14 15.2 12.7 16.5 10.9 16.5C9.4 16.5 8.2 15.3 8.2 13.8C8.2 12.2 9.5 11 11.1 11C11.5 11 11.9 11.1 12.2 11.2V8.1C11.8 8 11.4 8 11 8C7.8 8 5.2 10.6 5.2 13.8C5.2 17 7.8 19.6 11 19.6C14.2 19.6 16.8 17 16.8 13.8V9.4C17.9 10.2 19.2 10.7 20.6 10.8V7.7C18.2 7.5 16.1 6 15.3 4H14Z"></path>
        </svg>
      </a>
      <a class="social-icon" href="/" aria-label="Facebook">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13.5 20V12.6H16L16.4 9.8H13.5V8C13.5 7.1 14 6.4 15.4 6.4H16.5V4C15.9 3.9 15.3 3.8 14.7 3.8C11.9 3.8 10.2 5.4 10.2 8.5V9.8H8V12.6H10.2V20"></path>
        </svg>
      </a>
    </div>
    <div class="footer-logo footer-logo--hero">BALGRIM</div>
  </div>
`;

const drawerMarkup = `
  <div class="cart-overlay" hidden></div>
  <aside class="cart-drawer" aria-hidden="true" aria-label="Carrito de compras">
    <div class="cart-drawer__header">
      <div>
        <p class="cart-drawer__eyebrow">Balgrim</p>
        <h2>Tu carrito</h2>
      </div>
      <button class="cart-close" type="button" aria-label="Cerrar carrito">x</button>
    </div>
    <div class="cart-drawer__content">
      <div class="cart-items"></div>
      <div class="cart-summary">
        <div class="cart-summary__row">
          <span>Subtotal</span>
          <strong class="cart-subtotal">$0</strong>
        </div>
        <p class="cart-summary__note">Checkout invitado con respaldo de pedido y cierre por WhatsApp.</p>
        <form class="checkout-form" novalidate>
          <label class="checkout-field">
            <span>Nombre completo</span>
            <input type="text" name="name" placeholder="Tu nombre" required>
          </label>
          <label class="checkout-field">
            <span>Celular</span>
            <input type="tel" name="phone" placeholder="300 000 0000" required>
          </label>
          <label class="checkout-field">
            <span>Direccion</span>
            <textarea name="address" rows="3" placeholder="Barrio, direccion y referencias" required></textarea>
          </label>
          <label class="checkout-field">
            <span>Notas adicionales</span>
            <textarea name="notes" rows="2" placeholder="Opcional"></textarea>
          </label>
          <p class="checkout-error" hidden></p>
          <div class="checkout-actions">
            <a class="button button--ghost button--checkout-link" href="checkout.html">Ir al checkout</a>
            <button class="button button--add-to-cart cart-clear" type="button">Vaciar carrito</button>
            <button class="button button--add-to-cart button--checkout" type="submit">Pedir por WhatsApp</button>
          </div>
        </form>
      </div>
    </div>
  </aside>
  <div class="product-modal" hidden aria-hidden="true">
    <div class="product-modal__overlay" data-product-modal-close></div>
    <div class="product-modal__dialog">
      <button class="product-modal__close" type="button" aria-label="Cerrar ficha" data-product-modal-close>x</button>
      <div class="product-modal__media">
        <div class="product-modal__gallery">
          <div class="product-modal__main" data-product-main-image></div>
          <div class="product-modal__thumbs" data-product-thumbs></div>
        </div>
      </div>
      <div class="product-modal__copy">
        <p class="product-modal__category" data-product-category></p>
        <h2 data-product-title></h2>
        <p class="product-modal__note" data-product-note></p>
        <strong class="product-modal__price" data-product-price></strong>
        <div class="product-modal__section">
          <span class="product-modal__label">Variantes</span>
          <div class="product-modal__variants" data-product-variants></div>
        </div>
        <div class="product-modal__section">
          <span class="product-modal__label">Seleccion actual</span>
          <p class="product-modal__selected" data-product-selected-variant></p>
        </div>
        <div class="product-modal__actions">
          <button class="button button--add-to-cart" type="button" data-product-add-selected>Agregar al carrito</button>
        </div>
      </div>
    </div>
  </div>
  <div class="cart-toast" aria-live="polite" hidden></div>
`;

const ensureCartUi = () => {
  if (!document.querySelector(".cart-drawer") || !document.querySelector(".product-modal")) {
    document.body.insertAdjacentHTML("beforeend", drawerMarkup);
  }
};

const ensureFloatingWhatsapp = () => {
  const existing = document.querySelector(".floating-whatsapp");
  if (existing) {
    existing.setAttribute("href", getWhatsappSupportUrl());
    return;
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <a class="floating-whatsapp" href="${getWhatsappSupportUrl()}" target="_blank" rel="noopener" aria-label="Hablar por WhatsApp">
        <span class="floating-whatsapp__label">WhatsApp</span>
        <span class="floating-whatsapp__icon">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12.1 3.6C7.5 3.6 3.8 7.3 3.8 11.9C3.8 13.4 4.2 14.8 5 16L3.9 20.1L8.1 19C9.3 19.7 10.6 20 12.1 20C16.7 20 20.4 16.3 20.4 11.8C20.4 7.3 16.7 3.6 12.1 3.6Z"></path>
            <path d="M9.3 8.7C9.1 8.2 8.9 8.2 8.7 8.2H8.2C8 8.2 7.7 8.3 7.5 8.6C7.3 8.8 6.7 9.4 6.7 10.6C6.7 11.8 7.5 13 7.6 13.2C7.8 13.3 9.2 15.6 11.4 16.5C13.3 17.2 13.7 17.1 14.2 17C14.7 16.9 15.7 16.3 15.9 15.8C16.1 15.3 16.1 14.9 16 14.8C16 14.6 15.7 14.5 15.2 14.3C14.8 14.1 14.2 13.8 13.8 13.7C13.5 13.6 13.2 13.5 12.9 13.9C12.6 14.3 12.1 14.8 11.9 15C11.7 15.1 11.5 15.2 11.1 15C10.8 14.8 9.9 14.5 9 13.6C8.4 13 8 12.2 7.9 11.9C7.8 11.6 7.9 11.4 8.1 11.2C8.3 11 8.4 10.8 8.6 10.5C8.7 10.2 8.8 10 8.9 9.7C9 9.4 9 9.1 8.8 8.9L9.3 8.7Z"></path>
          </svg>
        </span>
      </a>
    `
  );
};

const renderSiteFooter = () => {
  document.querySelectorAll(".footer").forEach((footer) => {
    footer.innerHTML = footerTemplate();
  });
};

const updateBadges = () => {
  document.querySelectorAll(".cart-badge").forEach((badge) => {
    badge.textContent = String(getCartCount());
  });
};

const showToast = (message) => {
  const toast = document.querySelector(".cart-toast");
  if (!toast) {
    return;
  }

  toast.textContent = message;
  toast.hidden = false;
  toast.classList.add("is-visible");

  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    toast.classList.remove("is-visible");
    setTimeout(() => {
      toast.hidden = true;
    }, 180);
  }, 2200);
};

const openCart = () => {
  const overlay = document.querySelector(".cart-overlay");
  const drawer = document.querySelector(".cart-drawer");
  if (!overlay || !drawer) {
    return;
  }

  overlay.hidden = false;
  document.body.classList.add("cart-open");
  drawer.setAttribute("aria-hidden", "false");
};

const closeCart = () => {
  const overlay = document.querySelector(".cart-overlay");
  const drawer = document.querySelector(".cart-drawer");
  if (!overlay || !drawer) {
    return;
  }

  overlay.hidden = true;
  document.body.classList.remove("cart-open");
  drawer.setAttribute("aria-hidden", "true");
};

const addToCart = (id, variantId = null) => {
  const product = getProduct(id);
  if (!product) {
    return false;
  }

  const variant = getProductVariant(product, variantId);
  if (!variant) {
    showToast("No encontramos esa variante.");
    return false;
  }

  if (!isVariantInStock(variant)) {
    showToast(`${product.name} en ${getVariantLabel(variant)} esta agotado.`);
    return false;
  }

  const resolvedVariantId = variant.id || null;
  const existingItem = cart.find((item) => item.id === id && item.variantId === resolvedVariantId);
  const nextQuantity = (existingItem?.quantity || 0) + 1;

  if (nextQuantity > Number(variant.stock || 0)) {
    showToast(`Solo quedan ${variant.stock} unidades de ${product.name} en ${getVariantLabel(variant)}.`);
    return false;
  }

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ id, variantId: resolvedVariantId, quantity: 1 });
  }

  saveCart(cart);
  updateBadges();
  renderCart();
  showToast(`${product.name} · ${getVariantLabel(variant)} se agrego al carrito.`);
  return true;
};

const updateQuantity = (id, variantId, nextQuantity) => {
  const product = getProduct(id);
  const variant = getProductVariant(product, variantId);
  const resolvedQuantity = Math.max(0, Number(nextQuantity || 0));

  if (resolvedQuantity > 0 && variant && resolvedQuantity > Number(variant.stock || 0)) {
    showToast(`Solo quedan ${variant.stock} unidades de ${product?.name || "este producto"}.`);
    return;
  }

  if (resolvedQuantity <= 0) {
    cart = cart.filter((item) => !(item.id === id && item.variantId === variantId));
  } else {
    cart = cart.map((item) =>
      item.id === id && item.variantId === variantId ? { ...item, quantity: resolvedQuantity } : item
    );
  }

  saveCart(cart);
  updateBadges();
  renderCart();
};

const renderCart = () => {
  const container = document.querySelector(".cart-items");
  const subtotal = document.querySelector(".cart-subtotal");
  const clearButton = document.querySelector(".cart-clear");
  const submitButton = document.querySelector(".button--checkout");
  const errorBox = document.querySelector(".checkout-error");

  if (!container || !subtotal || !clearButton || !submitButton || !errorBox) {
    return;
  }

  errorBox.hidden = true;
  errorBox.textContent = "";

  if (!cart.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <p>Tu carrito esta vacio.</p>
        <span>Agrega productos desde cualquier coleccion y el resumen quedara listo para checkout invitado.</span>
      </div>
    `;
    subtotal.textContent = formatCurrency(0);
    clearButton.disabled = true;
    submitButton.disabled = true;
    return;
  }

  const cartIssues = getCartIssues();

  container.innerHTML = cart
    .map(({ id, variantId, quantity }) => {
      const product = getProduct(id);
      const variant = getProductVariant(product, variantId);
      if (!product || !variant) {
        return "";
      }

      const issue = cartIssues.find((entry) => entry.item.id === id && entry.item.variantId === variantId);
      const isMaxed = quantity >= Number(variant.stock || 0);
      const itemImage = variant.imageUrl || getProductImage(product);

      return `
        <article class="cart-item${issue ? " is-warning" : ""}">
          <div class="cart-item__visual${itemImage ? " has-image" : ""}" aria-hidden="true">
            ${itemImage ? `<img src="${itemImage}" alt="${product.name}">` : product.name.charAt(0)}
          </div>
          <div class="cart-item__copy">
            <p class="cart-item__category">${product.category}</p>
            <h3>${product.name}</h3>
            <span>${getVariantLabel(variant)} · ${product.note}</span>
            <p class="cart-item__unit">Unidad: ${formatCurrency(variant.price)}</p>
            ${issue ? `<p class="cart-item__status">${issue.type === "out_of_stock" ? "Esta variante esta agotada." : "Tu cantidad supera el stock disponible."}</p>` : `<p class="cart-item__status is-success">${getVariantStockMessage(variant)}</p>`}
          </div>
          <div class="cart-item__meta">
            <strong>${formatCurrency(variant.price * quantity)}</strong>
            <div class="cart-item__qty" aria-label="Cantidad de ${product.name}">
              <button type="button" data-cart-action="decrease" data-product-id="${id}" data-variant-id="${variant.id}">-</button>
              <span>${quantity}</span>
              <button type="button" ${isMaxed || !isVariantInStock(variant) ? "disabled" : ""} data-cart-action="increase" data-product-id="${id}" data-variant-id="${variant.id}">+</button>
            </div>
            <button class="cart-item__remove" type="button" data-cart-action="remove" data-product-id="${id}" data-variant-id="${variant.id}">
              Eliminar
            </button>
          </div>
        </article>
      `;
    })
    .join("");

  subtotal.textContent = formatCurrency(getCartTotal());
  clearButton.disabled = false;
  submitButton.disabled = cartIssues.length > 0;

  if (cartIssues.length) {
    errorBox.hidden = false;
    errorBox.textContent = "Ajusta los productos agotados o cantidades fuera de stock antes de continuar.";
  }
};

const getPageProducts = () => {
  const pathname = window.location.pathname.toLowerCase();
  const products = getCatalogList();

  if (pathname.endsWith("/hombre.html") || pathname.endsWith("hombre.html")) {
    return products.filter((product) => product.category === "Hombre");
  }

  if (pathname.endsWith("/mujer.html") || pathname.endsWith("mujer.html")) {
    return products.filter((product) => product.category === "Mujer");
  }

  if (pathname.endsWith("/accesorios.html") || pathname.endsWith("accesorios.html")) {
    return products.filter((product) => product.category === "Accesorios");
  }

  if (
    pathname.endsWith("/nuevos-lanzamientos.html") ||
    pathname.endsWith("nuevos-lanzamientos.html")
  ) {
    return products.filter((product) => product.category === "Nuevos lanzamientos");
  }

  return products.filter((product) => product.category === "Nuevos lanzamientos").slice(0, 3);
};

const getProductGallery = (product, selectedVariant = null) => {
  const gallery = [];
  if (selectedVariant?.imageUrl) {
    gallery.push(selectedVariant.imageUrl);
  }
  if (Array.isArray(product?.images)) {
    gallery.push(...product.images);
  }
  if (Array.isArray(product?.variants)) {
    product.variants.forEach((variant) => {
      if (variant.imageUrl) {
        gallery.push(variant.imageUrl);
      }
    });
  }
  return [...new Set(gallery.filter(Boolean))];
};

const resolveVariantSelection = (product, selection = {}) => {
  const selectedVariant =
    findAvailableVariantByOptions(product, selection.size, selection.color) ||
    findVariantByOptions(product, selection.size, selection.color) ||
    findAvailableVariantByOptions(product, selection.size, null) ||
    findAvailableVariantByOptions(product, null, selection.color) ||
    getFirstAvailableVariant(product) ||
    findVariantByOptions(product, selection.size, null) ||
    findVariantByOptions(product, null, selection.color) ||
    getDefaultVariant(product);

  const selectedSize = selectedVariant?.size || selection.size || "";
  const selectedColor = selectedVariant?.color || selection.color || "";

  const sizeOptions = getOptionValues(product, "size").map((size) => {
    const anyMatch = findVariantByOptions(product, size, selectedColor);
    const availableMatch = findAvailableVariantByOptions(product, size, selectedColor);
    const fallbackAvailable = findAvailableVariantByOptions(product, size, null);
    return {
      value: size,
      active: size === selectedSize,
      disabled: selectedColor ? !availableMatch : !fallbackAvailable,
      soldOut: !!anyMatch && !availableMatch,
    };
  });

  const colorOptions = getOptionValues(product, "color").map((color) => {
    const anyMatch = findVariantByOptions(product, selectedSize, color);
    const availableMatch = findAvailableVariantByOptions(product, selectedSize, color);
    const fallbackAvailable = findAvailableVariantByOptions(product, null, color);
    return {
      value: color,
      active: color === selectedColor,
      disabled: selectedSize ? !availableMatch : !fallbackAvailable,
      soldOut: !!anyMatch && !availableMatch,
    };
  });

  return {
    selectedVariant,
    selectedSize,
    selectedColor,
    sizeOptions,
    colorOptions,
  };
};

const renderProductPage = async () => {
  const root = document.querySelector("[data-product-page-root]");
  if (!root) return;

  const slug = new URLSearchParams(window.location.search).get("slug");
  if (!slug) {
    root.innerHTML = `
      <section class="product-page__empty">
        <p class="product-page__eyebrow">Balgrim</p>
        <h1>No encontramos este producto.</h1>
        <a class="button button--add-to-cart" href="nuevos-lanzamientos.html">Volver al catalogo</a>
      </section>
    `;
    return;
  }

  let product = getProductBySlug(slug);
  if (!product) {
    product = await loadProductBySlugFromSource(slug);
    if (product) {
      catalog = { ...catalog, [product.id]: product };
    }
  }

  if (!product) {
    root.innerHTML = `
      <section class="product-page__empty">
        <p class="product-page__eyebrow">Balgrim</p>
        <h1>Este producto ya no esta disponible.</h1>
        <a class="button button--add-to-cart" href="nuevos-lanzamientos.html">Seguir explorando</a>
      </section>
    `;
    return;
  }

  let selectedImage = getProductImage(product);
  let selection = resolveVariantSelection(product, getFirstAvailableVariant(product) || getDefaultVariant(product) || {});

  const render = () => {
    const currentVariant = selection.selectedVariant;
    const gallery = getProductGallery(product, currentVariant);
    const currentImage = currentVariant?.imageUrl || selectedImage || gallery[0] || getProductImage(product);
    const relatedProducts = getCatalogList()
      .filter((item) => item.id !== product.id && item.category === product.category)
      .slice(0, 3);

    selectedImage = gallery.includes(currentImage) ? currentImage : gallery[0] || currentImage || "";

    root.innerHTML = `
      <section class="product-page__hero">
        <nav class="product-page__breadcrumbs" aria-label="Ruta de navegacion">
          <a href="index.html">Inicio</a>
          <span>/</span>
          <a href="${product.category === "Hombre" ? "hombre.html" : product.category === "Mujer" ? "mujer.html" : product.category === "Accesorios" ? "accesorios.html" : "nuevos-lanzamientos.html"}">${product.category}</a>
          <span>/</span>
          <strong>${product.name}</strong>
        </nav>
        <div class="product-page__grid">
          <div class="product-page__gallery">
            <div class="product-page__main">
              ${selectedImage ? `<img src="${selectedImage}" alt="${product.name}">` : `<div class="product-modal__fallback">${product.name.charAt(0)}</div>`}
            </div>
            <div class="product-page__thumbs">
              ${gallery.map((imageUrl) => `
                <button class="product-page__thumb${imageUrl === selectedImage ? " is-active" : ""}" type="button" data-product-page-thumb="${imageUrl}">
                  <img src="${imageUrl}" alt="${product.name}">
                </button>
              `).join("")}
            </div>
          </div>
          <div class="product-page__copy">
            <p class="product-page__eyebrow">${product.category}</p>
            <h1>${product.name}</h1>
            <p class="product-page__note">${product.note || "Pieza Balgrim con identidad propia."}</p>
            <div class="product-page__price-row">
              <strong>${formatCurrency(currentVariant?.price || product.price)}</strong>
              <span class="product-page__stock${isVariantInStock(currentVariant) ? " is-available" : " is-sold-out"}">${getVariantStockMessage(currentVariant)}</span>
            </div>
            <p class="product-page__description">${product.note || "Diseno sobrio, materiales con presencia y un fit pensado para elevar el look diario."}</p>

            <div class="product-page__selector-group">
              <div class="product-page__selector-header">
                <span>Talla</span>
                <strong>${selection.selectedSize || "-"}</strong>
              </div>
              <div class="product-page__selector product-page__selector--size">
                ${selection.sizeOptions.map((option) => `
                  <button class="product-option-chip${option.active ? " is-active" : ""}${option.soldOut ? " is-sold-out" : ""}" type="button" data-product-page-size="${option.value}" ${option.disabled ? "disabled" : ""}>
                    <span>${option.value}</span>
                    ${option.soldOut ? `<small>Agotada</small>` : ""}
                  </button>
                `).join("")}
              </div>
            </div>

            <div class="product-page__selector-group">
              <div class="product-page__selector-header">
                <span>Color</span>
                <strong>${selection.selectedColor || "-"}</strong>
              </div>
              <div class="product-page__selector product-page__selector--color">
                ${selection.colorOptions.map((option) => `
                  <button class="product-color-chip${option.active ? " is-active" : ""}${option.soldOut ? " is-sold-out" : ""}" type="button" data-product-page-color="${option.value}" ${option.disabled ? "disabled" : ""}>
                    <span class="product-color-chip__swatch" style="${getColorSwatchStyle(option.value)}"></span>
                    <span>${option.value}</span>
                  </button>
                `).join("")}
              </div>
            </div>

            <div class="product-page__summary-card">
              <p>Seleccion actual</p>
              <strong>${getVariantLabel(currentVariant)}</strong>
              <span>${currentVariant?.sku || "SKU pendiente"}</span>
            </div>

            <div class="product-page__actions">
              <button class="button button--add-to-cart" type="button" data-product-page-add ${!isVariantInStock(currentVariant) ? "disabled" : ""}>
                ${isVariantInStock(currentVariant) ? "Agregar al carrito" : "Variante agotada"}
              </button>
              <a class="button button--ghost" href="https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(`Hola, quiero informacion sobre ${product.name} (${getVariantLabel(currentVariant)}).`)}" target="_blank" rel="noopener">Hablar por WhatsApp</a>
            </div>
          </div>
        </div>
      </section>
      <section class="product-page__related">
        <div class="product-page__related-head">
          <p class="product-page__eyebrow">Tambien te puede gustar</p>
          <h2>Mas piezas de ${product.category}</h2>
        </div>
        <div class="catalog-grid catalog-grid--related">
          ${relatedProducts.map((item, index) => `
            <article class="catalog-card" data-product-id="${item.id}">
              <div class="catalog-card__media${index % 2 ? " catalog-card__media--dark" : ""}${getProductImage(item) ? " has-image" : ""}"${getProductImage(item) ? ` style="background-image:url('${getProductImage(item)}')"` : ""}></div>
              <div class="catalog-card__body">
                <h2 class="catalog-card__title">${item.name}</h2>
                <div class="catalog-card__meta">
                  <span>${item.note}</span>
                  <span class="catalog-card__price">${formatCurrency(item.price)}</span>
                </div>
                <div class="catalog-card__actions">
                  <a class="button button--ghost" href="${getProductUrl(item)}">Ver producto</a>
                  <button class="button button--add-to-cart" type="button" data-add-to-cart="${item.id}">Agregar al carrito</button>
                </div>
              </div>
            </article>
          `).join("")}
        </div>
      </section>
    `;
  };

  render();

  root.onclick = (event) => {
    const thumb = event.target.closest("[data-product-page-thumb]");
    if (thumb) {
      selectedImage = thumb.dataset.productPageThumb;
      render();
      return;
    }

    const sizeButton = event.target.closest("[data-product-page-size]");
    if (sizeButton) {
      selection = resolveVariantSelection(product, {
        size: sizeButton.dataset.productPageSize,
        color: selection.selectedColor,
      });
      selectedImage = selection.selectedVariant?.imageUrl || getProductImage(product);
      render();
      return;
    }

    const colorButton = event.target.closest("[data-product-page-color]");
    if (colorButton) {
      selection = resolveVariantSelection(product, {
        size: selection.selectedSize,
        color: colorButton.dataset.productPageColor,
      });
      selectedImage = selection.selectedVariant?.imageUrl || getProductImage(product);
      render();
      return;
    }

    const addButton = event.target.closest("[data-product-page-add]");
    if (addButton && selection.selectedVariant) {
      addToCart(product.id, selection.selectedVariant.id);
    }
  };
};

const renderCheckoutPage = () => {
  const root = document.querySelector("[data-checkout-page-root]");
  if (!root) return;

  const cartItems = cart
    .map((item) => {
      const product = getProduct(item.id);
      const variant = getCartVariant(item);
      if (!product || !variant) return null;
      return {
        product,
        variant,
        quantity: item.quantity,
        total: variant.price * item.quantity,
        image: variant.imageUrl || getProductImage(product),
      };
    })
    .filter(Boolean);

  const cartIssues = getCartIssues();

  root.innerHTML = `
    <section class="checkout-page">
      <div class="checkout-page__head">
        <div>
          <p class="product-page__eyebrow">Checkout</p>
          <h1>Finaliza tu pedido</h1>
          <p class="checkout-page__intro">Completa tus datos, revisa el resumen y deja el pedido listo para cierre manual o paso a pago.</p>
        </div>
        <a class="button button--ghost" href="nuevos-lanzamientos.html">Seguir comprando</a>
      </div>
      <div class="checkout-page__grid">
        <section class="checkout-page__panel">
          <div class="cart-summary cart-summary--page">
            <div class="cart-summary__row">
              <span>Subtotal</span>
              <strong>${formatCurrency(getCartTotal())}</strong>
            </div>
            ${cartIssues.length ? `<p class="checkout-error">Ajusta las variantes agotadas o cantidades fuera de stock para continuar.</p>` : `<p class="cart-summary__note">Tu pedido queda listo para validacion, pago y confirmacion por WhatsApp.</p>`}
            <form class="checkout-form checkout-form--page" novalidate>
              <label class="checkout-field">
                <span>Nombre completo</span>
                <input type="text" name="name" placeholder="Tu nombre" required>
              </label>
              <label class="checkout-field">
                <span>Celular</span>
                <input type="tel" name="phone" placeholder="300 000 0000" required>
              </label>
              <label class="checkout-field">
                <span>Direccion</span>
                <textarea name="address" rows="3" placeholder="Barrio, direccion y referencias" required></textarea>
              </label>
              <label class="checkout-field">
                <span>Notas adicionales</span>
                <textarea name="notes" rows="2" placeholder="Opcional"></textarea>
              </label>
              <p class="checkout-error" hidden></p>
              <div class="checkout-actions checkout-actions--page">
                <button class="button button--ghost" type="button" data-checkout-back-cart>Volver al carrito</button>
                <button class="button button--add-to-cart button--checkout" type="submit" ${cartIssues.length || !cartItems.length ? "disabled" : ""}>Pedir por WhatsApp</button>
              </div>
            </form>
          </div>
        </section>
        <aside class="checkout-page__panel checkout-page__panel--summary">
          <div class="checkout-page__summary-head">
            <p class="product-page__eyebrow">Resumen</p>
            <strong>${cartItems.length} item${cartItems.length === 1 ? "" : "s"}</strong>
          </div>
          <div class="checkout-page__items">
            ${cartItems.length ? cartItems.map(({ product, variant, quantity, total, image }) => `
              <article class="checkout-item${!isVariantInStock(variant) || quantity > variant.stock ? " is-warning" : ""}">
                <div class="checkout-item__media${image ? " has-image" : ""}">
                  ${image ? `<img src="${image}" alt="${product.name}">` : product.name.charAt(0)}
                </div>
                <div class="checkout-item__copy">
                  <h3>${product.name}</h3>
                  <p>${getVariantLabel(variant)}</p>
                  <span>${quantity} x ${formatCurrency(variant.price)}</span>
                </div>
                <div class="checkout-item__meta">
                  <strong>${formatCurrency(total)}</strong>
                  <small>${getVariantStockMessage(variant)}</small>
                </div>
              </article>
            `).join("") : `<div class="checkout-empty"><p>Tu carrito esta vacio.</p><a class="button button--add-to-cart" href="nuevos-lanzamientos.html">Explorar catalogo</a></div>`}
          </div>
        </aside>
      </div>
    </section>
  `;

  root.onclick = (event) => {
    if (event.target.closest("[data-checkout-back-cart]")) {
      window.location.href = "index.html#carrito";
    }
  };
};
const renderEditorialBlocks = () => {
  const main = document.querySelector("main");
  if (!main) return;

  document.querySelectorAll(".dynamic-editorial-block").forEach((node) => node.remove());

  const heroBlock = contentBlocks.find((block) => block.key === "home-hero");
  if (heroBlock) {
    const heroTitle = document.querySelector(".hero h1");
    const heroButton = document.querySelector(".button--hero");
    const manifesto = document.querySelector(".manifesto p");
    if (heroTitle) heroTitle.textContent = heroBlock.title || heroTitle.textContent;
    if (heroButton) {
      heroButton.textContent = heroBlock.actionLabel || heroButton.textContent;
      heroButton.setAttribute("href", heroBlock.actionHref || heroButton.getAttribute("href") || "#");
    }
    if (manifesto && heroBlock.body) {
      manifesto.textContent = heroBlock.body;
    }
  }

  const extraBlocks = contentBlocks.filter((block) => block.key !== "home-hero");
  if (!extraBlocks.length) return;

  const productsSection = document.querySelector(".products");
  let anchor = productsSection;
  extraBlocks.forEach((block, index) => {
    anchor?.insertAdjacentHTML(
      "afterend",
      `
        <section class="editorial-strip dynamic-editorial-block">
          <div class="editorial-strip__copy">
            <p class="subhero-kicker">${block.key.replace(/-/g, " ")}</p>
            <h2>${block.title}</h2>
            <p>${block.body || ""}</p>
            ${
              block.actionHref
                ? `<a class="button button--ghost" href="${block.actionHref}">${block.actionLabel || "Ver mas"}</a>`
                : ""
            }
          </div>
          <div class="editorial-strip__visual${index % 2 ? " editorial-strip__visual--soft" : ""}"${
            block.imageUrl ? ` style="background-image:url('${block.imageUrl}'); background-size:cover; background-position:center;"` : ""
          }></div>
        </section>
      `
    );
    anchor = anchor?.nextElementSibling || anchor;
  });
};

const openProductModal = (productId) => {
  const product = getProduct(productId);
  const modal = document.querySelector(".product-modal");
  if (!product || !modal) return;

  let selectedVariant = getFirstAvailableVariant(product);
  let selectedImage = getProductImage(product);

  const title = modal.querySelector("[data-product-title]");
  const note = modal.querySelector("[data-product-note]");
  const category = modal.querySelector("[data-product-category]");
  const price = modal.querySelector("[data-product-price]");
  const selected = modal.querySelector("[data-product-selected-variant]");
  const mainImage = modal.querySelector("[data-product-main-image]");
  const thumbs = modal.querySelector("[data-product-thumbs]");
  const variants = modal.querySelector("[data-product-variants]");
  const addButton = modal.querySelector("[data-product-add-selected]");

  const renderModal = () => {
    const currentVariant = getProductVariant(product, selectedVariant?.id);
    const gallery = getProductGallery(product, currentVariant);
    if (!selectedImage) selectedImage = gallery[0] || "";
    if (!gallery.includes(selectedImage)) selectedImage = gallery[0] || "";

    if (title) title.textContent = product.name;
    if (note) note.textContent = product.note;
    if (category) category.textContent = product.category;
    if (price) price.textContent = formatCurrency(currentVariant?.price || product.price);
    if (selected) selected.textContent = getVariantLabel(currentVariant);
    if (mainImage) {
      mainImage.innerHTML = selectedImage
        ? `<img src="${selectedImage}" alt="${product.name}">`
        : `<div class="product-modal__fallback">${product.name.charAt(0)}</div>`;
    }
    if (thumbs) {
      thumbs.innerHTML = gallery
        .map(
          (imageUrl) => `
            <button class="product-modal__thumb${imageUrl === selectedImage ? " is-active" : ""}" type="button" data-product-thumb="${imageUrl}">
              <img src="${imageUrl}" alt="${product.name}">
            </button>
          `
        )
        .join("");
    }
    if (variants) {
      variants.innerHTML = (product.variants || [])
        .map(
          (variant) => `
            <button class="product-modal__variant${variant.id === currentVariant?.id ? " is-active" : ""}${!isVariantInStock(variant) ? " is-sold-out" : ""}" type="button" data-product-variant="${variant.id}" ${!isVariantInStock(variant) ? "disabled" : ""}>
              <span>${variant.size}</span>
              <small>${variant.color}${!isVariantInStock(variant) ? " · Agotado" : ""}</small>
            </button>
          `
        )
        .join("");
    }
    if (addButton) {
      addButton.dataset.productId = product.id;
      addButton.dataset.variantId = currentVariant?.id || "";
      addButton.disabled = !isVariantInStock(currentVariant);
      addButton.textContent = isVariantInStock(currentVariant) ? "Agregar al carrito" : "Variante agotada";
    }
  };

  renderModal();
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");

  modal.onclick = (event) => {
    const closeTrigger = event.target.closest("[data-product-modal-close]");
    if (closeTrigger) {
      closeProductModal();
      return;
    }

    const thumb = event.target.closest("[data-product-thumb]");
    if (thumb) {
      selectedImage = thumb.dataset.productThumb;
      renderModal();
      return;
    }

    const variantButton = event.target.closest("[data-product-variant]");
    if (variantButton) {
      selectedVariant = getProductVariant(product, variantButton.dataset.productVariant);
      selectedImage = selectedVariant?.imageUrl || getProductImage(product);
      renderModal();
      return;
    }

    const addSelected = event.target.closest("[data-product-add-selected]");
    if (addSelected) {
      addToCart(addSelected.dataset.productId, addSelected.dataset.variantId || null);
      closeProductModal();
    }
  };
};

const closeProductModal = () => {
  const modal = document.querySelector(".product-modal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  modal.onclick = null;
};

const renderDynamicProductGrids = () => {
  const homeGrid = document.querySelector(".product-grid");
  if (homeGrid) {
    const products = getPageProducts();
    homeGrid.innerHTML = products
      .map(
        (product, index) => `
          <article class="product-card" data-product-id="${product.id}">
            <div class="product-stack">
              <div class="product-image product-image--0${(index % 3) + 1} product-image--front${getProductImage(product) ? " has-image" : ""}"${getProductImage(product) ? ` style="background-image:url('${getProductImage(product)}')"` : ""}></div>
              <div class="product-image product-image--0${(index % 3) + 4} product-image--back${getProductHoverImage(product) ? " has-image" : ""}"${getProductHoverImage(product) ? ` style="background-image:url('${getProductHoverImage(product)}')"` : ""}></div>
            </div>
            <h3>${product.name}</h3>
          </article>
        `
      )
      .join("");
  }

  const catalogGrid = document.querySelector(".catalog-grid");
  if (catalogGrid) {
    const products = getPageProducts();
    catalogGrid.innerHTML = products
      .map(
        (product, index) => `
          <article class="catalog-card" data-product-id="${product.id}">
            <div class="catalog-card__media${index % 2 ? " catalog-card__media--dark" : ""}${getProductImage(product) ? " has-image" : ""}"${getProductImage(product) ? ` style="background-image:url('${getProductImage(product)}')"` : ""}></div>
            <div class="catalog-card__body">
              <h2 class="catalog-card__title">${product.name}</h2>
              <div class="catalog-card__meta">
                <span>${product.note}</span>
                <span class="catalog-card__price">${formatCurrency(product.price)}</span>
              </div>
            </div>
          </article>
        `
      )
      .join("");
  }
};

const enhanceProductCards = () => {
  document.querySelectorAll("[data-product-id]").forEach((card) => {
    const id = card.getAttribute("data-product-id");
    const product = getProduct(id);
    if (!product) {
      return;
    }

    const title = card.querySelector("h2, h3");
    if (title) {
      title.textContent = product.name;
    }

    const price = card.querySelector(".catalog-card__price");
    if (price) {
      price.textContent = formatCurrency(product.price);
    }

    const metaLabel = card.querySelector(".catalog-card__meta span");
    if (metaLabel) {
      metaLabel.textContent = product.note;
    }

    const mediaNode = card.querySelector(".catalog-card__media");
    if (mediaNode && getProductImage(product)) {
      mediaNode.style.backgroundImage = `url('${getProductImage(product)}')`;
      mediaNode.classList.add("has-image");
    }

    const frontImage = card.querySelector(".product-image--front");
    if (frontImage && getProductImage(product)) {
      frontImage.style.backgroundImage = `url('${getProductImage(product)}')`;
      frontImage.classList.add("has-image");
    }

    const backImage = card.querySelector(".product-image--back");
    if (backImage && getProductHoverImage(product)) {
      backImage.style.backgroundImage = `url('${getProductHoverImage(product)}')`;
      backImage.classList.add("has-image");
    }

    if (card.classList.contains("product-card") && !card.querySelector(".button--add-to-cart")) {
      card.insertAdjacentHTML(
        "beforeend",
        `
          <p class="product-card__price">${formatCurrency(product.price)}</p>
          <div class="product-card__actions">
            <a class="button button--ghost" href="${getProductUrl(product)}">Ver producto</a>
            <button class="button button--add-to-cart" type="button" data-add-to-cart="${id}">
              Agregar al carrito
            </button>
          </div>
        `
      );
    }

    if (card.classList.contains("catalog-card")) {
      const body = card.querySelector(".catalog-card__body");
      if (body && !body.querySelector(".catalog-card__actions")) {
        body.insertAdjacentHTML(
          "beforeend",
          `
            <div class="catalog-card__actions">
              <a class="button button--ghost" href="${getProductUrl(product)}">Ver producto</a>
              <button class="button button--add-to-cart" type="button" data-add-to-cart="${id}">
                Agregar al carrito
              </button>
            </div>
          `
        );
      }
    }
  });
};

const submitCheckout = async (form) => {
  const formData = new FormData(form);
  const customer = {
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim(),
    address: String(formData.get("address") || "").trim(),
    notes: String(formData.get("notes") || "").trim(),
  };

  const errorBox = document.querySelector(".checkout-error");

  if (!customer.name || !customer.phone || !customer.address) {
    errorBox.hidden = false;
    errorBox.textContent = "Completa nombre, celular y direccion para continuar.";
    return;
  }

  if (!cart.length) {
    errorBox.hidden = false;
    errorBox.textContent = "Tu carrito esta vacio.";
    return;
  }

  if (getCartIssues().length) {
    errorBox.hidden = false;
    errorBox.textContent = "Ajusta las variantes agotadas o las cantidades fuera de stock antes de continuar.";
    return;
  }

  const payload = {
    customer,
    items: cart
      .map((item) => {
        const product = getProduct(item.id);
        if (!product) {
          return null;
        }

        return {
          id: item.id,
          variantId: item.variantId || product.variantId || null,
          name: product.name,
          variantLabel: getVariantLabel(getCartVariant(item)),
          quantity: item.quantity,
          price: getCartVariant(item)?.price || product.price,
        };
      })
      .filter(Boolean),
    subtotal: getCartTotal(),
    source: "web",
  };

  const submitButton = form.querySelector(".button--checkout");
  submitButton.disabled = true;

  const orderResponse = await createOrder(payload);
  submitButton.disabled = false;

  if (!orderResponse.ok && orderResponse.error) {
    errorBox.hidden = false;
    errorBox.textContent = `No se pudo guardar el pedido: ${orderResponse.error}`;
    return;
  }

  const orderId = orderResponse.order ? orderResponse.order.id : "";
  window.open(getWhatsappUrl(customer, orderId), "_blank", "noopener");
  showToast(orderId ? `Pedido ${orderId} enviado a WhatsApp.` : "Resumen enviado a WhatsApp.");
};

const bindEvents = () => {
  document.addEventListener("click", (event) => {
    const addButton = event.target.closest("[data-add-to-cart]");
    if (addButton) {
      const product = getProduct(addButton.getAttribute("data-add-to-cart"));
      addToCart(addButton.getAttribute("data-add-to-cart"), getFirstAvailableVariant(product)?.id || null);
      return;
    }

    const productCard = event.target.closest("[data-product-id]");
    if (
      productCard &&
      !event.target.closest("[data-add-to-cart]") &&
      !event.target.closest(".catalog-card__actions") &&
      !event.target.closest(".product-card__actions")
    ) {
      const product = getProduct(productCard.getAttribute("data-product-id"));
      if (product) {
        window.location.href = getProductUrl(product);
      }
      return;
    }

    if (event.target.closest(".icon-button--cart")) {
      event.preventDefault();
      openCart();
      return;
    }

    if (event.target.closest(".cart-close") || event.target.closest(".cart-overlay")) {
      closeCart();
      return;
    }

    if (event.target.closest(".cart-clear")) {
      cart = [];
      saveCart(cart);
      updateBadges();
      renderCart();
      return;
    }

    const cartAction = event.target.closest("[data-cart-action]");
    if (!cartAction) {
      return;
    }

    const { cartAction: action, productId, variantId } = cartAction.dataset;
    const currentItem = cart.find((item) => item.id === productId && item.variantId === variantId);
    if (!currentItem && action !== "remove") {
      return;
    }

    if (action === "increase") {
      updateQuantity(productId, variantId, currentItem.quantity + 1);
    }

    if (action === "decrease") {
      updateQuantity(productId, variantId, currentItem.quantity - 1);
    }

    if (action === "remove") {
      updateQuantity(productId, variantId, 0);
    }
  });

  document.addEventListener("submit", (event) => {
    if (!event.target.matches(".checkout-form")) {
      return;
    }

    event.preventDefault();
    submitCheckout(event.target);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeCart();
      closeProductModal();
    }
  });
};

const init = async () => {
  ensureCartUi();
  ensureFloatingWhatsapp();
  catalog = await loadCatalogFromSource();
  contentBlocks = await loadContentBlocksFromSource();
  settings = await loadSettingsFromSource();
  ensureFloatingWhatsapp();
  cart = loadCart();
  normalizeCartItems();
  renderSiteFooter();
  renderEditorialBlocks();
  renderDynamicProductGrids();
  await renderProductPage();
  renderCheckoutPage();
  enhanceProductCards();
  updateBadges();
  renderCart();
  bindEvents();
};

document.addEventListener("DOMContentLoaded", init);




