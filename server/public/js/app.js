let currentLang = 'it';
let catalogData = { categories: [], products: [] };
let activeCategory = 'all';
let cart = JSON.parse(localStorage.getItem('ap_cart') || '[]');
let currentModalProduct = null;
let currentShippingRate = 9.0;

// Inline SVG Data-URI that CANNOT 404 or loop
const FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'%3E%3Crect width='100%25' height='100%25' fill='%23f5f3ef'/%3E%3Cline x1='60' y1='240' x2='220' y2='80' stroke='%238c5835' stroke-width='8' stroke-linecap='round'/%3E%3Ccircle cx='220' cy='80' r='28' fill='%23c48243'/%3E%3Ctext x='150' y='270' font-family='sans-serif' font-size='12' font-weight='bold' fill='%235c3a21' text-anchor='middle'%3EAP INSTRUMENT%3C/text%3E%3C/svg%3E";

document.addEventListener('DOMContentLoaded', () => {
  // 1. Instant render if bundled catalog data is available
  if (window.INITIAL_CATALOG && window.INITIAL_CATALOG.products && window.INITIAL_CATALOG.products.length > 0) {
    catalogData = window.INITIAL_CATALOG;
    renderCategoriesTree();
    renderProducts();
  }

  // 2. Fetch live updates from API
  loadCatalog();
  updateCartBadge();
});

// Load catalog from API
async function loadCatalog() {
  try {
    const [resCats, resProds] = await Promise.all([
      fetch('/api/categories').then(r => r.json()).catch(() => null),
      fetch('/api/products').then(r => r.json()).catch(() => null)
    ]);

    if (resCats && resCats.success && resProds && resProds.success) {
      catalogData.categories = resCats.data;
      catalogData.products = resProds.data;
      renderCategoriesTree();
      renderProducts();
    }
  } catch (err) {
    console.warn('API sync warning:', err);
    // If memory already had INITIAL_CATALOG, do nothing, it already rendered!
    if (!catalogData.products || catalogData.products.length === 0) {
      document.getElementById('products-grid').innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #777;">
          <p>Caricamento catalogo in corso...</p>
        </div>
      `;
    }
  }
}

// Render Categories in the Right Sidebar (Exact MG Mallets Structure)
function renderCategoriesTree() {
  const container = document.getElementById('categories-tree-container');
  if (!container || !catalogData.categories) return;

  const topCats = catalogData.categories.filter(c => c.parentId === 0 && c.count > 0);
  
  let html = `
    <div class="mg-cat-section">
      <div class="mg-cat-name ${activeCategory === 'all' ? 'active' : ''}" onclick="filterByCategory('all')">
        <span>TUTTI I PRODOTTI</span>
        <span class="mg-count-pill">${catalogData.products ? catalogData.products.length : 127}</span>
      </div>
    </div>
  `;

  for (const tc of topCats) {
    const subcats = catalogData.categories.filter(c => c.parentId === tc.id && c.count > 0);
    const isCatActive = activeCategory === tc.slug;

    html += `
      <div class="mg-cat-section">
        <div class="mg-cat-name ${isCatActive ? 'active' : ''}" onclick="filterByCategory('${tc.slug}')">
          <span>${tc.name[currentLang] || tc.name.it}</span>
          <span class="mg-count-pill">${tc.count}</span>
        </div>
    `;

    if (subcats.length > 0) {
      for (const sc of subcats) {
        const isSubActive = activeCategory === sc.slug;
        html += `
          <div class="mg-subcat-row ${isSubActive ? 'active' : ''}" onclick="filterByCategory('${sc.slug}')">
            <span><span class="chevron">&gt;&gt;</span> ${sc.name[currentLang] || sc.name.it}</span>
            <span class="mg-count-pill">${sc.count}</span>
          </div>
        `;
      }
    }

    html += `</div>`;
  }

  container.innerHTML = html;
}

// Render Products Grid
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const countBadge = document.getElementById('products-count-badge');
  const titleElem = document.getElementById('active-category-title');
  if (!grid || !catalogData.products) return;

  let filtered = catalogData.products;

  // Filter category
  if (activeCategory !== 'all') {
    filtered = filtered.filter(p => p.categories.some(c => c.slug === activeCategory || c.parentId === getCatIdBySlug(activeCategory)));
    const activeCatObj = catalogData.categories.find(c => c.slug === activeCategory);
    if (activeCatObj && titleElem) {
      titleElem.textContent = (activeCatObj.name[currentLang] || activeCatObj.name.it).toUpperCase();
    }
  } else {
    if (titleElem) titleElem.textContent = currentLang === 'it' ? 'TUTTI I MODELLI' : 'ALL MODELS';
  }

  // Search filter
  const searchInput = document.getElementById('search-box');
  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.toLowerCase().trim();
    filtered = filtered.filter(p => 
      (p.title[currentLang] && p.title[currentLang].toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.excerpt && p.excerpt[currentLang] && p.excerpt[currentLang].toLowerCase().includes(q))
    );
  }

  if (countBadge) {
    countBadge.textContent = `${filtered.length} ${currentLang === 'it' ? 'modelli disponibili' : 'models available'}`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--mg-text-muted);">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; margin-bottom: 1rem; color: #ccc;"></i>
        <p style="font-size: 1.1rem;">Nessun modello trovato per i criteri selezionati.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const title = p.title[currentLang] || p.title.it;
    const series = p.categories.find(c => c.parentId !== 0)?.name[currentLang] || p.categories[0]?.name[currentLang] || 'Handcrafted Series';
    const imgUrl = p.thumbnail ? `/uploads/${p.thumbnail}` : FALLBACK_SVG;
    
    // Top specs tags
    const specsHtml = Object.entries(p.specs || {})
      .slice(0, 3)
      .map(([k, v]) => `<span class="mg-spec-pill">${k}: <strong>${v}</strong></span>`)
      .join('');

    return `
      <article class="mg-card" onclick="openProductModal(${p.id})">
        <div class="mg-card-img-wrap">
          <span class="mg-sku-badge">${p.sku || 'AP'}</span>
          <img src="${imgUrl}" alt="${title}" loading="lazy" class="mg-card-img" onerror="this.onerror=null; this.src='${FALLBACK_SVG}';">
          <div class="mg-hover-btn">Scopri di più</div>
        </div>

        <div class="mg-card-content">
          <div class="mg-card-series">${series}</div>
          <h3 class="mg-card-title">${title}</h3>
          
          <div class="mg-card-specs">
            ${specsHtml}
          </div>

          <div class="mg-card-bottom">
            <div class="mg-card-price">€ ${p.price.toFixed(2)} <span>/ paio</span></div>
            <button class="mg-card-add-btn" onclick="event.stopPropagation(); addToCartDirect(${p.id})">
              <i class="fa-solid fa-cart-plus"></i> ${currentLang === 'it' ? 'Aggiungi' : 'Add'}
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function getCatIdBySlug(slug) {
  const cat = catalogData.categories.find(c => c.slug === slug);
  return cat ? cat.id : null;
}

function filterByCategory(slug) {
  activeCategory = slug;
  renderCategoriesTree();
  renderProducts();

  document.querySelectorAll('.mg-nav-item').forEach(el => {
    el.classList.toggle('active', el.textContent.toLowerCase() === slug.toLowerCase() || (slug === 'all' && el.textContent.toLowerCase().includes('tutti')));
  });

  const catSection = document.getElementById('catalog');
  if (catSection) {
    catSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function handleSearch() {
  renderProducts();
}

// Modal Product Details
function openProductModal(id) {
  const product = catalogData.products.find(p => p.id === id);
  if (!product) return;

  currentModalProduct = product;
  const modal = document.getElementById('product-modal');
  
  const title = product.title[currentLang] || product.title.it;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-sku').textContent = `Codice: ${product.sku || 'N/A'}`;
  document.getElementById('modal-price').textContent = `€ ${product.price.toFixed(2)}`;
  
  const series = product.categories.find(c => c.parentId !== 0)?.name[currentLang] || product.categories[0]?.name[currentLang] || 'Handcrafted Series';
  document.getElementById('modal-series').textContent = series;

  // Description
  const desc = (product.excerpt && (product.excerpt[currentLang] || product.excerpt.it)) || 'Bacchetta artigianale di altissima precisione acustica e bilanciamento perfetto.';
  document.getElementById('modal-desc').innerHTML = desc.replace(/\\r\\n/g, '<br>');

  // Main Image
  const imgUrl = product.thumbnail ? `/uploads/${product.thumbnail}` : FALLBACK_SVG;
  const modalImg = document.getElementById('modal-img');
  modalImg.onerror = function() { this.onerror = null; this.src = FALLBACK_SVG; };
  modalImg.src = imgUrl;

  // Gallery
  const thumbsContainer = document.getElementById('modal-gallery-thumbs');
  if (product.gallery && product.gallery.length > 0) {
    thumbsContainer.innerHTML = product.gallery.map(g => `
      <img src="/uploads/${g}" style="width: 46px; height: 46px; object-fit: contain; background: #fff; border: 1px solid var(--mg-card-border); border-radius: 4px; cursor: pointer; padding: 2px;" onerror="this.onerror=null; this.src='${FALLBACK_SVG}';" onclick="document.getElementById('modal-img').src='/uploads/${g}'">
    `).join('');
  } else {
    thumbsContainer.innerHTML = '';
  }

  // Specifications
  const specsContainer = document.getElementById('modal-specs');
  if (product.specs && Object.keys(product.specs).length > 0) {
    specsContainer.innerHTML = Object.entries(product.specs).map(([k, v]) => `
      <span class="mg-spec-pill" style="font-size: 0.8rem; padding: 4px 8px;">${k.toUpperCase()}: <strong>${v}</strong></span>
    `).join('');
  } else {
    specsContainer.innerHTML = '<span style="color: var(--mg-text-muted); font-size: 0.8rem;">Standard calibrato da concerto</span>';
  }

  document.getElementById('modal-qty').value = 1;
  modal.style.display = 'flex';
}

function closeProductModal() {
  document.getElementById('product-modal').style.display = 'none';
}

function openCraftModal() {
  document.getElementById('craft-modal').style.display = 'flex';
}

function closeCraftModal() {
  document.getElementById('craft-modal').style.display = 'none';
}

function closeModalOnBg(event) {
  if (event.target.classList.contains('mg-modal-overlay')) {
    event.target.style.display = 'none';
  }
}

// Cart Drawer
function toggleCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  const isOpen = drawer.classList.contains('open');

  if (isOpen) {
    drawer.classList.remove('open');
    overlay.style.display = 'none';
  } else {
    renderCart();
    drawer.classList.add('open');
    overlay.style.display = 'block';
  }
}

function addToCartDirect(id) {
  const product = catalogData.products.find(p => p.id === id);
  if (!product) return;
  addToCart(product, 1);
}

function addModalToCart() {
  if (!currentModalProduct) return;
  const qty = parseInt(document.getElementById('modal-qty').value) || 1;
  addToCart(currentModalProduct, qty);
  closeProductModal();
}

function addToCart(product, qty) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: product.id,
      title: product.title[currentLang] || product.title.it,
      sku: product.sku,
      price: product.price,
      thumbnail: product.thumbnail,
      qty: qty
    });
  }

  saveCart();
  updateCartBadge();
  toggleCart();
}

function updateCartQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.id !== id);
  }
  saveCart();
  renderCart();
  updateCartBadge();
}

function saveCart() {
  localStorage.setItem('ap_cart', JSON.stringify(cart));
}

function updateCartBadge() {
  const counter = document.getElementById('cart-counter');
  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  if (counter) counter.textContent = totalItems;
}

function renderCart() {
  const container = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--mg-text-muted); margin-top: 3rem;">
        <i class="fa-solid fa-bag-shopping" style="font-size: 3rem; color: #ddd; margin-bottom: 1rem;"></i>
        <p>Il tuo carrello è vuoto</p>
      </div>
    `;
    if (footer) footer.style.display = 'none';
    return;
  }

  if (footer) footer.style.display = 'block';

  let subtotal = 0;
  container.innerHTML = cart.map(item => {
    subtotal += item.price * item.qty;
    const imgUrl = item.thumbnail ? `/uploads/${item.thumbnail}` : FALLBACK_SVG;
    return `
      <div style="display: flex; gap: 12px; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--mg-card-border);">
        <img src="${imgUrl}" style="width: 55px; height: 55px; background: #fff; border-radius: 4px; object-fit: contain; padding: 2px; border: 1px solid #e0dcd4;" onerror="this.onerror=null; this.src='${FALLBACK_SVG}';">
        <div style="flex: 1;">
          <h4 style="font-family: var(--mg-font-title); font-size: 1.05rem; color: var(--mg-text-main); margin-bottom: 2px;">${item.title}</h4>
          <span style="font-size: 0.72rem; color: var(--mg-text-muted); display: block; margin-bottom: 6px;">SKU: ${item.sku || 'AP'}</span>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <button onclick="updateCartQty(${item.id}, -1)" style="width: 22px; height: 22px; border: 1px solid var(--mg-card-border); background: #f0eee8; color: #333; border-radius: 3px; cursor: pointer;">-</button>
              <span style="font-weight: 700; font-size: 0.85rem;">${item.qty}</span>
              <button onclick="updateCartQty(${item.id}, 1)" style="width: 22px; height: 22px; border: 1px solid var(--mg-card-border); background: #f0eee8; color: #333; border-radius: 3px; cursor: pointer;">+</button>
            </div>
            <strong style="color: var(--mg-wood-warm); font-family: var(--mg-font-title); font-size: 1.15rem;">€ ${(item.price * item.qty).toFixed(2)}</strong>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const shipping = currentShippingRate;
  const total = subtotal + shipping;

  document.getElementById('cart-subtotal').textContent = `€ ${subtotal.toFixed(2)}`;
  document.getElementById('cart-shipping').textContent = `€ ${shipping.toFixed(2)}`;
  document.getElementById('cart-total').textContent = `€ ${total.toFixed(2)}`;
}

// Checkout Handlers
function showCheckoutView() {
  document.getElementById('cart-items').style.display = 'none';
  document.getElementById('cart-footer').style.display = 'none';
  document.getElementById('checkout-pane').style.display = 'block';
}

function hideCheckoutView() {
  document.getElementById('checkout-pane').style.display = 'none';
  document.getElementById('cart-items').style.display = 'block';
  document.getElementById('cart-footer').style.display = 'block';
}

function updateShippingCountry() {
  const country = document.getElementById('cust-country').value;
  if (country === 'IT') currentShippingRate = 9.0;
  else if (['FR', 'DE', 'ES'].includes(country)) currentShippingRate = 16.0;
  else currentShippingRate = 25.0;

  renderCart();
}

async function processPayment(method) {
  const form = document.getElementById('checkout-form');
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const customer = {
    firstName: document.getElementById('cust-first').value,
    lastName: document.getElementById('cust-last').value,
    email: document.getElementById('cust-email').value,
    phone: document.getElementById('cust-phone').value,
    address: document.getElementById('cust-addr').value,
    city: document.getElementById('cust-city').value,
    postcode: document.getElementById('cust-zip').value,
    country: document.getElementById('cust-country').value,
    fiscalCode: document.getElementById('cust-cf').value,
    vatNumber: document.getElementById('cust-piva').value
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totals = {
    subtotal,
    shipping: currentShippingRate,
    total: subtotal + currentShippingRate
  };

  try {
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer,
        items: cart,
        shipping: { cost: currentShippingRate, country: customer.country },
        paymentMethod: method,
        totals
      })
    }).then(r => r.json());

    if (res.success) {
      cart = [];
      saveCart();
      updateCartBadge();
      toggleCart();
      alert(`🎉 Ordine #${res.orderId} registrato con successo!\nMetodo: ${method === 'paypal' ? 'PayPal / Carte' : 'Bonifico Bancario'}\nConferma inviata a ${customer.email}.`);
      hideCheckoutView();
    } else {
      alert('Errore: ' + res.error);
    }
  } catch (err) {
    alert('Errore di connessione al server.');
  }
}

// Multilingual Switcher
function setLanguage(lang) {
  currentLang = lang;
  document.getElementById('btn-it').classList.toggle('active', lang === 'it');
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');

  if (lang === 'en') {
    document.getElementById('top-msg').textContent = 'Handcrafted Mallets Made in Italy • Worldwide Shipping';
    document.getElementById('hero-title').innerHTML = 'PERCUSSION MALLETS <span>- AP INSTRUMENT</span>';
    document.getElementById('hero-desc').textContent = 'Every mallet is meticulously engineered for optimal dynamic range and tone projection. Made with select Maple and Natural Rattan handles and hand-wound with premium wool.';
    document.getElementById('txt-categories-heading').textContent = 'CATEGORIES & SERIES';
  } else {
    document.getElementById('top-msg').textContent = 'Bacchette Artigianali Made in Italy • Spedizioni in Tutto il Mondo';
    document.getElementById('hero-title').innerHTML = 'BACCHETTE PERCUSSIONE <span>- AP INSTRUMENT</span>';
    document.getElementById('hero-desc').textContent = 'Ogni bacchetta è studiata nei minimi particolari per ottenere la massima gamma dinamica ed espressiva. Il bilanciamento meticoloso favorisce la corretta proiezione sonora: tutti i modelli montano manici in Acero e Rattan naturale e avvolgimento artigianale in lana selezionata.';
    document.getElementById('txt-categories-heading').textContent = 'CATEGORIE & SERIE';
  }

  renderCategoriesTree();
  renderProducts();
}

function toggleMobileNav() {
  const nav = document.getElementById('mg-nav-menu');
  nav.classList.toggle('show');
}
