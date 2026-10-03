let currentLang = 'it';
let catalogData = { categories: [], products: [] };
let activeCategory = 'all';
let cart = JSON.parse(localStorage.getItem('ap_cart') || '[]');
let currentModalProduct = null;
let currentShippingRate = 9.0;

document.addEventListener('DOMContentLoaded', () => {
  loadCatalog();
  updateCartBadge();
  setupNavLinks();
});

// 1. Fetch catalog from backend API
async function loadCatalog() {
  try {
    const [resCats, resProds] = await Promise.all([
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/products').then(r => r.json())
    ]);

    if (resCats.success && resProds.success) {
      catalogData.categories = resCats.data;
      catalogData.products = resProds.data;
      renderCategoriesTree();
      renderProducts();
    }
  } catch (err) {
    console.error('Error loading catalog:', err);
  }
}

// 2. Render sidebar categories (MG Mallets tree style)
function renderCategoriesTree() {
  const container = document.getElementById('categories-tree-container');
  if (!container) return;

  const topCats = catalogData.categories.filter(c => c.parentId === 0 && c.count > 0);
  
  let html = `<div class="category-group">
    <div class="cat-parent ${activeCategory === 'all' ? 'active' : ''}" onclick="filterByCategory('all')">
      <span><i class="fa-solid fa-layer-group" style="margin-right: 6px; color: var(--wood-amber);"></i> ${currentLang === 'it' ? 'Tutti i Prodotti' : 'All Products'}</span>
      <span class="subcat-count">${catalogData.products.length}</span>
    </div>
  </div>`;

  for (const tc of topCats) {
    const subcats = catalogData.categories.filter(c => c.parentId === tc.id && c.count > 0);
    const isCatActive = activeCategory === tc.slug;

    html += `<div class="category-group">
      <div class="cat-parent ${isCatActive ? 'active' : ''}" onclick="filterByCategory('${tc.slug}')">
        <span>${tc.name[currentLang] || tc.name.it}</span>
        <span class="subcat-count">${tc.count}</span>
      </div>`;

    if (subcats.length > 0) {
      html += `<ul class="subcat-list">`;
      for (const sc of subcats) {
        const isSubActive = activeCategory === sc.slug;
        html += `<li class="subcat-item">
          <a href="javascript:void(0)" class="subcat-link ${isSubActive ? 'active' : ''}" onclick="filterByCategory('${sc.slug}')">
            <span>› ${sc.name[currentLang] || sc.name.it}</span>
            <span class="subcat-count">${sc.count}</span>
          </a>
        </li>`;
      }
      html += `</ul>`;
    }

    html += `</div>`;
  }

  container.innerHTML = html;
}

// 3. Render Products Grid
function renderProducts() {
  const grid = document.getElementById('products-grid');
  const countBadge = document.getElementById('products-count-badge');
  const titleElem = document.getElementById('active-category-title');
  if (!grid) return;

  let filtered = catalogData.products;

  // Filter category
  if (activeCategory !== 'all') {
    filtered = filtered.filter(p => p.categories.some(c => c.slug === activeCategory || c.parentId === getCatIdBySlug(activeCategory)));
    const activeCatObj = catalogData.categories.find(c => c.slug === activeCategory);
    if (activeCatObj && titleElem) {
      titleElem.textContent = activeCatObj.name[currentLang] || activeCatObj.name.it;
    }
  } else {
    if (titleElem) titleElem.textContent = currentLang === 'it' ? 'Tutti i Modelli' : 'All Models';
  }

  // Filter search
  const searchInput = document.getElementById('search-box');
  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.toLowerCase().trim();
    filtered = filtered.filter(p => 
      (p.title[currentLang] && p.title[currentLang].toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.excerpt[currentLang] && p.excerpt[currentLang].toLowerCase().includes(q))
    );
  }

  if (countBadge) {
    countBadge.textContent = `${filtered.length} ${currentLang === 'it' ? 'modelli disponibili' : 'models available'}`;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--wood-text-muted);">
      <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; color: var(--wood-border); margin-bottom: 1rem;"></i>
      <p style="font-size: 1.1rem;">Nessun modello trovato per i criteri selezionati.</p>
    </div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const title = p.title[currentLang] || p.title.it;
    const series = p.categories.find(c => c.parentId !== 0)?.name[currentLang] || p.categories[0]?.name[currentLang] || 'Handcrafted';
    const imgUrl = p.thumbnail ? `/uploads/${p.thumbnail}` : '/uploads/placeholder.jpg';
    
    // Key specs pills
    const specsHtml = Object.entries(p.specs || {})
      .slice(0, 3)
      .map(([k, v]) => `<span class="spec-pill">${k}: <strong>${v}</strong></span>`)
      .join('');

    return `
      <article class="product-card" onclick="openProductModal(${p.id})">
        <div class="product-img-box">
          <span class="product-badge-sku">${p.sku || 'AP'}</span>
          <img src="${imgUrl}" alt="${title}" loading="lazy" onerror="this.src='/uploads/placeholder.jpg'">
        </div>
        <div class="product-details">
          <div class="product-series">${series}</div>
          <h3 class="product-title">${title}</h3>
          
          <div class="product-specs-pills">
            ${specsHtml}
          </div>

          <div class="product-bottom-row">
            <div class="product-price">€ ${p.price.toFixed(2)} <span>/ paio</span></div>
            <button class="btn-add-cart" onclick="event.stopPropagation(); addToCartDirect(${p.id})">
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

  // Highlight top nav if matching
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.cat === slug || (slug === 'all' && el.dataset.nav === 'all'));
  });

  const catSection = document.getElementById('catalog');
  if (catSection) {
    catSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function handleSearch() {
  renderProducts();
}

function setupNavLinks() {
  document.querySelectorAll('[data-cat]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      filterByCategory(el.dataset.cat);
    });
  });
}

// 4. Modal Product Details
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
  const desc = product.excerpt[currentLang] || product.excerpt.it || 'Bacchetta artigianale di altissima precisione sonora.';
  document.getElementById('modal-desc').innerHTML = desc.replace(/\\r\\n/g, '<br>');

  // Main Image
  const imgUrl = product.thumbnail ? `/uploads/${product.thumbnail}` : '/uploads/placeholder.jpg';
  document.getElementById('modal-img').src = imgUrl;

  // Gallery Thumbs
  const thumbsContainer = document.getElementById('modal-gallery-thumbs');
  if (product.gallery && product.gallery.length > 0) {
    thumbsContainer.innerHTML = product.gallery.map(g => `
      <img src="/uploads/${g}" style="width: 50px; height: 50px; object-fit: contain; background: #fff; border: 1px solid var(--wood-border); border-radius: 4px; cursor: pointer;" onclick="document.getElementById('modal-img').src='/uploads/${g}'">
    `).join('');
  } else {
    thumbsContainer.innerHTML = '';
  }

  // Specs
  const specsContainer = document.getElementById('modal-specs');
  if (product.specs && Object.keys(product.specs).length > 0) {
    specsContainer.innerHTML = Object.entries(product.specs).map(([k, v]) => `
      <span class="spec-pill" style="font-size: 0.85rem; padding: 4px 10px;">${k.toUpperCase()}: <strong>${v}</strong></span>
    `).join('');
  } else {
    specsContainer.innerHTML = '<span style="color: var(--wood-text-muted); font-size: 0.85rem;">Standard bilanciato</span>';
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
  if (event.target.classList.contains('modal-overlay')) {
    event.target.style.display = 'none';
  }
}

// 5. Cart Management
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
      <div style="text-align: center; color: var(--wood-text-muted); margin-top: 3rem;">
        <i class="fa-solid fa-bag-shopping" style="font-size: 3rem; color: var(--wood-border); margin-bottom: 1rem;"></i>
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
    const imgUrl = item.thumbnail ? `/uploads/${item.thumbnail}` : '/uploads/placeholder.jpg';
    return `
      <div class="cart-item">
        <img src="${imgUrl}" class="cart-item-img" alt="${item.title}">
        <div style="flex: 1;">
          <h4 style="font-size: 1rem; color: var(--wood-text-dark); margin-bottom: 4px;">${item.title}</h4>
          <span style="font-size: 0.75rem; color: var(--wood-text-muted); display: block; margin-bottom: 6px;">SKU: ${item.sku || 'AP'}</span>
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <button onclick="updateCartQty(${item.id}, -1)" style="width: 24px; height: 24px; border: 1px solid var(--wood-border); background: var(--wood-cream); border-radius: 4px; cursor: pointer;">-</button>
              <span style="font-weight: 600; font-size: 0.9rem;">${item.qty}</span>
              <button onclick="updateCartQty(${item.id}, 1)" style="width: 24px; height: 24px; border: 1px solid var(--wood-border); background: var(--wood-cream); border-radius: 4px; cursor: pointer;">+</button>
            </div>
            <strong style="color: var(--wood-primary); font-size: 1rem;">€ ${(item.price * item.qty).toFixed(2)}</strong>
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

// 6. Checkout Handlers
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
      alert(`🎉 Ordine #${res.orderId} creato con successo!\nMetodo di pagamento: ${method === 'paypal' ? 'PayPal / Carta di Credito' : 'Bonifico Bancario'}\nAbbiamo inviato un'email di riepilogo a ${customer.email}.`);
      hideCheckoutView();
    } else {
      alert('Errore creazione ordine: ' + res.error);
    }
  } catch (err) {
    alert('Errore di comunicazione con il server.');
  }
}

// 7. Language Switcher (qTranslate replacement)
function setLanguage(lang) {
  currentLang = lang;
  document.getElementById('btn-it').classList.toggle('active', lang === 'it');
  document.getElementById('btn-en').classList.toggle('active', lang === 'en');

  // Translations dictionary
  if (lang === 'en') {
    document.getElementById('top-msg').textContent = 'Handcrafted Professional Mallets 100% Made in Italy • Worldwide Shipping';
    document.getElementById('hero-badge-txt').textContent = 'Selected Wood & Fine Wool';
    document.getElementById('hero-title').textContent = 'The Acoustic Art of Handcrafted Mallets';
    document.getElementById('hero-sub').textContent = 'Handcrafted using noble Maple, Olive, Rosewood, and Natural Rattan. Perfect balance of weight, flexibility, and tone projection for marimba, vibraphone, and percussions.';
    document.getElementById('btn-explore').textContent = 'Explore Catalog';
    document.getElementById('btn-story').textContent = 'Our Philosophy';
    document.getElementById('txt-categories').textContent = 'Categories';
  } else {
    document.getElementById('top-msg').textContent = 'Bacchette Professionali Artigianali 100% Made in Italy • Spedizioni in Tutto il Mondo';
    document.getElementById('hero-badge-txt').textContent = 'Legno Selezionato & Lana Pregiata';
    document.getElementById('hero-title').textContent = "L'Arte Sonora delle Bacchette Artigianali";
    document.getElementById('hero-sub').textContent = 'Create a mano con legni nobili di Acero, Ulivo, Palissandro e Rattan naturale. Il perfetto bilanciamento tra peso, flessibilità e proiezione timbrica per marimba, vibrafono e percussioni.';
    document.getElementById('btn-explore').textContent = 'Esplora il Catalogo';
    document.getElementById('btn-story').textContent = 'La Nostra Filosofia';
    document.getElementById('txt-categories').textContent = 'Categorie';
  }

  renderCategoriesTree();
  renderProducts();
}

function toggleMobileNav() {
  const nav = document.getElementById('nav-links');
  nav.classList.toggle('show');
}
