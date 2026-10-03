/**
 * AP INSTRUMENT - MODERN FULLSTACK CLIENT APPLICATION
 * High-performance, reactive, zero-delay rendering with Satomi Showcase
 */

let currentLang = 'it';
let catalogData = { categories: [], products: [] };
let activeCategory = 'all';
let activeHardness = 'all';
let activeShaft = 'all';
let activeSort = 'default';
let cart = JSON.parse(localStorage.getItem('ap_cart') || '[]');
let currentModalProduct = null;
let currentShippingRate = 9.0;
let currentActiveST = 'ST1';

// Fallback SVG Data-URI that cannot 404 or trigger infinite loops
const FALLBACK_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 300'%3E%3Crect width='100%25' height='100%25' fill='%23f5f3ef'/%3E%3Cline x1='60' y1='240' x2='220' y2='80' stroke='%238c5835' stroke-width='8' stroke-linecap='round'/%3E%3Ccircle cx='220' cy='80' r='28' fill='%23c48243'/%3E%3Ctext x='150' y='270' font-family='sans-serif' font-size='12' font-weight='bold' fill='%235c3a21' text-anchor='middle'%3EAP INSTRUMENT%3C/text%3E%3C/svg%3E";

// ============================================================================
// SATOMI TAKASHIMA SIGNATURE DATA (5 MODELS)
// ============================================================================
const SATOMI_MODELS = {
  ST1: {
    id: 3613,
    sku: 'ST1',
    name: 'ST1 SOFT',
    tone: 'Timbro Vellutato da Concerto',
    colorTag: 'Collarino Verde',
    colorStyle: '#689f38',
    desc: 'Morbida come un cuscino, ideale per far emergere i toni caldi e profondi della marimba. Perfetta per grandi sale da concerto e pianissimi espressivi.',
    weight: '43g Legno / 48g Rattan',
    core: 'Gomma Tecnica Morbida (Indeformabile)',
    price: 31.50,
    img: '/uploads/2024/06/ST1-01.jpg',
    videoId: '56F9QY-Bs40'
  },
  ST2: {
    id: 3623,
    sku: 'ST2',
    name: 'ST2 MEDIUM SOFT',
    tone: 'Calda, Dinamica & Versatile',
    colorTag: 'Collarino Bianco',
    colorStyle: '#9e9e9e',
    desc: 'Più leggera della ST1, versatile su tutto lo spettro della marimba. Dalle melodie dolci ed espressive a passaggi vigorosi con attacco nitido.',
    weight: '43g Legno / 48g Rattan',
    core: 'Gomma Tecnica Medio-Morbida',
    price: 32.50,
    img: '/uploads/2024/06/ST2_01.jpg',
    videoId: 'cRX38buEL3A'
  },
  ST3: {
    id: 3628,
    sku: 'ST3',
    name: 'ST3 MEDIUM',
    tone: 'Articolazione Equilibrata',
    colorTag: 'Collarino Rosso',
    colorStyle: '#d32f2f',
    desc: 'Si alza la posta in gioco: ha grinta ma mantiene morbidezza. Articola ogni nota con naturalezza sui registri centrali e superiori della marimba.',
    weight: '40.5g Legno / 43.5g Rattan',
    core: 'Gomma Tecnica Media',
    price: 32.50,
    img: '/uploads/2024/06/ST3_01.jpg',
    videoId: '66u8N1_ZKfw'
  },
  ST4: {
    id: 3633,
    sku: 'ST4',
    name: 'ST4 MEDIUM HARD',
    tone: 'Definizione Cristallina & Agilità',
    colorTag: 'Collarino Oro',
    colorStyle: '#fbc02d',
    desc: 'Costruzione agile che proietta il suono con nitidezza straordinaria. Massima precisione e controllo nelle dinamiche virtuosistiche.',
    weight: '39.5g Legno / 41g Rattan',
    core: 'Gomma Tecnica Medio-Dura',
    price: 32.50,
    img: '/uploads/2024/06/ST4_01.jpg',
    videoId: 'eQLXXs4B4OA'
  },
  ST5: {
    id: 3638,
    sku: 'ST5',
    name: 'ST5 HARD',
    tone: 'Massima Incisività & Virtuosismo',
    colorTag: 'Collarino Arcobaleno',
    colorStyle: 'linear-gradient(135deg, #e91e63, #9c27b0, #2196f3, #4caf50, #ffeb3b)',
    desc: 'Ideale per suonare rapido e con decisione nell\'ottava superiore. Anche il passaggio più virtuoso otterrà una chiarezza immacolata.',
    weight: '38g Legno / 40.5g Rattan',
    core: 'Gomma Tecnica Dura',
    price: 32.50,
    img: '/uploads/2024/06/ST5_01.jpg',
    videoId: 'kQdBqXxz6io'
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Instant Render from bundled cache (0ms latency)
  if (window.INITIAL_CATALOG && window.INITIAL_CATALOG.products && window.INITIAL_CATALOG.products.length > 0) {
    catalogData = window.INITIAL_CATALOG;
    renderCategoriesTree();
    renderProducts();
  }

  // 2. Fetch live data update
  loadCatalog();
  updateCartBadge();
  switchSTModel('ST1');

  // Key listeners
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeProductModal();
      closeVideoModal();
      closeCraftModal();
      if (document.getElementById('cart-drawer')?.classList.contains('open')) {
        toggleCart();
      }
    }
  });
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
  }
}

// ============================================================================
// SATOMI TAKASHIMA INTERACTIVE HERO SWITCHER
// ============================================================================
function switchSTModel(modelKey) {
  const model = SATOMI_MODELS[modelKey];
  if (!model) return;
  currentActiveST = modelKey;

  // Update tabs active state
  document.querySelectorAll('.st-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-model') === modelKey);
  });

  // Update image
  const imgEl = document.getElementById('st-preview-img');
  if (imgEl) {
    imgEl.style.opacity = '0';
    setTimeout(() => {
      imgEl.src = model.img;
      imgEl.alt = model.name;
      imgEl.style.opacity = '1';
    }, 150);
  }

  // Update text & badges
  const titleEl = document.getElementById('st-model-title');
  const badgeEl = document.getElementById('st-sound-badge');
  const tagEl = document.getElementById('st-color-tag');
  const descEl = document.getElementById('st-description');
  const weightEl = document.getElementById('st-spec-weight');
  const coreEl = document.getElementById('st-spec-core');
  const priceEl = document.getElementById('st-price-tag');
  const buyBtn = document.getElementById('btn-st-buy');

  if (titleEl) titleEl.textContent = model.name;
  if (badgeEl) badgeEl.textContent = model.tone;
  if (descEl) descEl.textContent = model.desc;
  if (weightEl) weightEl.textContent = model.weight;
  if (coreEl) coreEl.textContent = model.core;
  if (priceEl) priceEl.innerHTML = `€ ${model.price.toFixed(2)} <small>/ paio</small>`;

  if (tagEl) {
    tagEl.textContent = model.colorTag;
    tagEl.style.background = model.colorStyle;
  }

  if (buyBtn) {
    buyBtn.innerHTML = `<i class="fa-solid fa-cart-plus"></i> Acquista ${model.sku} (€ ${model.price.toFixed(2)})`;
  }
}

function playCurrentSTVideo() {
  const model = SATOMI_MODELS[currentActiveST];
  if (model && model.videoId) {
    openVideoModal(model.videoId, `Satomi Takashima • Demo ${model.name}`);
  }
}

function addCurrentSTToCart() {
  const model = SATOMI_MODELS[currentActiveST];
  if (!model) return;

  const targetProd = catalogData.products.find(p => p.id === model.id) || {
    id: model.id,
    sku: model.sku,
    title: { it: `SERIE ST MARIMBA - ${model.name}`, en: `ST SERIES MARIMBA - ${model.name}` },
    price: model.price,
    thumbnail: model.img.replace('/uploads/', '')
  };

  addToCartItem(targetProd, 1);
  showToast(model.name, `Aggiunto al carrello: € ${model.price.toFixed(2)}`, true);
}

function scrollToHero() {
  const hero = document.getElementById('satomi-hero');
  if (hero) hero.scrollIntoView({ behavior: 'smooth' });
}

// ============================================================================
// CINEMATIC VIDEO PLAYER MODAL
// ============================================================================
function openVideoModal(videoId, title) {
  const modal = document.getElementById('video-modal');
  const iframe = document.getElementById('video-modal-iframe');
  const titleEl = document.getElementById('video-modal-title');

  if (!modal || !iframe) return;

  if (titleEl && title) {
    titleEl.innerHTML = `<i class="fa-brands fa-youtube" style="color: #ff0000; margin-right: 8px;"></i> ${title}`;
  }

  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
  modal.style.display = 'flex';
}

function closeVideoModal() {
  const modal = document.getElementById('video-modal');
  const iframe = document.getElementById('video-modal-iframe');
  if (iframe) iframe.src = '';
  if (modal) modal.style.display = 'none';
}

function closeVideoModalOnBg(e) {
  if (e.target.id === 'video-modal') {
    closeVideoModal();
  }
}

// ============================================================================
// INSTRUMENT & CATEGORY FILTERING
// ============================================================================
function filterByCategory(slug) {
  activeCategory = slug;
  
  // Reset subfilters if user jumps category
  activeHardness = 'all';
  activeShaft = 'all';
  updatePillUI();

  renderCategoriesTree();
  renderProducts();

  // Update header nav active states
  document.querySelectorAll('.mg-nav-item').forEach(el => {
    el.classList.toggle('active', el.textContent.toLowerCase() === slug.toLowerCase() || (slug === 'all' && el.textContent.toLowerCase().includes('tutti')));
  });

  // Update horizontal instrument bar active states
  document.querySelectorAll('.inst-tab').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-cat') === slug);
  });

  const catSection = document.getElementById('catalog');
  if (catSection && window.scrollY > 400) {
    catSection.scrollIntoView({ behavior: 'smooth' });
  }
}

function filterByHardness(val) {
  activeHardness = val;
  updatePillUI();
  renderProducts();
}

function filterByShaft(val) {
  activeShaft = val;
  updatePillUI();
  renderProducts();
}

function updatePillUI() {
  document.querySelectorAll('.filter-pill[data-hardness]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-hardness') === activeHardness);
  });
  document.querySelectorAll('.filter-pill[data-shaft]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-shaft') === activeShaft);
  });
}

function handleSortChange() {
  const sel = document.getElementById('sort-select');
  if (sel) {
    activeSort = sel.value;
    renderProducts();
  }
}

function handleSearch() {
  const input = document.getElementById('search-box');
  const clearBtn = document.getElementById('search-clear-btn');
  if (clearBtn) {
    clearBtn.style.display = input.value.trim() ? 'block' : 'none';
  }
  renderProducts();
}

function clearSearch() {
  const input = document.getElementById('search-box');
  const clearBtn = document.getElementById('search-clear-btn');
  if (input) input.value = '';
  if (clearBtn) clearBtn.style.display = 'none';
  renderProducts();
}

// ============================================================================
// PRODUCTS RENDERING & HARDNESS/ACOUSTIC METER CALCULATION
// ============================================================================
function detectAcousticProfile(p) {
  const title = (p.title.it || '').toLowerCase();
  const desc = (p.content?.it || p.excerpt?.it || '').toLowerCase();
  const allText = title + ' ' + desc;

  let hardness = 'medium';
  let dots = 3;
  let timbre = 'Equilibrato';

  if (allText.includes('soft') || allText.includes('morbido') || allText.includes('morbida') || allText.includes('15') || allText.includes('16') || allText.includes('st1')) {
    hardness = 'soft';
    dots = 1;
    timbre = 'Caldo / Profondo';
  } else if (allText.includes('medium soft') || allText.includes('medio morbido') || allText.includes('st2') || allText.includes('18')) {
    hardness = 'soft';
    dots = 2;
    timbre = 'Risonante / Morbido';
  } else if (allText.includes('medium hard') || allText.includes('medio duro') || allText.includes('st4') || allText.includes('30') || allText.includes('40')) {
    hardness = 'hard';
    dots = 4;
    timbre = 'Articolato / Nitido';
  } else if (allText.includes('hard') || allText.includes('duro') || allText.includes('dura') || allText.includes('st5') || allText.includes('50') || allText.includes('60') || allText.includes('ottone')) {
    hardness = 'hard';
    dots = 5;
    timbre = 'Brillante / Cristallino';
  }

  // Shaft detection
  let shaft = 'rattan';
  if (allText.includes('legno') || allText.includes('acero') || allText.includes('ebano') || allText.includes('palissandro') || allText.includes('azobe') || allText.includes('ulivo')) {
    shaft = 'legno';
  }

  return { hardness, dots, timbre, shaft };
}

function renderProducts() {
  const grid = document.getElementById('products-grid');
  const countBadge = document.getElementById('products-count-badge');
  const titleElem = document.getElementById('active-category-title');
  if (!grid || !catalogData.products) return;

  let filtered = catalogData.products;

  // 1. Category Filter
  if (activeCategory !== 'all') {
    if (activeCategory === 'satomi-takashima') {
      filtered = filtered.filter(p => p.categories.some(c => c.slug === 'satomi-takashima') || (p.sku && p.sku.startsWith('ST')));
      if (titleElem) titleElem.textContent = 'SERIE SIGNATURE SATOMI TAKASHIMA';
    } else {
      filtered = filtered.filter(p => p.categories.some(c => c.slug === activeCategory || c.parentId === getCatIdBySlug(activeCategory)));
      const activeCatObj = catalogData.categories.find(c => c.slug === activeCategory);
      if (activeCatObj && titleElem) {
        titleElem.textContent = (activeCatObj.name[currentLang] || activeCatObj.name.it).toUpperCase();
      }
    }
  } else {
    if (titleElem) titleElem.textContent = currentLang === 'it' ? 'TUTTI I MODELLI' : 'ALL MODELS';
  }

  // 2. Hardness Filter
  if (activeHardness !== 'all') {
    filtered = filtered.filter(p => {
      const { hardness } = detectAcousticProfile(p);
      return hardness === activeHardness;
    });
  }

  // 3. Shaft Material Filter
  if (activeShaft !== 'all') {
    filtered = filtered.filter(p => {
      const { shaft } = detectAcousticProfile(p);
      return shaft === activeShaft;
    });
  }

  // 4. Search Filter
  const searchInput = document.getElementById('search-box');
  if (searchInput && searchInput.value.trim()) {
    const q = searchInput.value.toLowerCase().trim();
    filtered = filtered.filter(p => 
      (p.title[currentLang] && p.title[currentLang].toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.excerpt && p.excerpt[currentLang] && p.excerpt[currentLang].toLowerCase().includes(q)) ||
      (p.categories && p.categories.some(c => c.name.it.toLowerCase().includes(q)))
    );
  }

  // 5. Sorting
  if (activeSort === 'price-asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (activeSort === 'price-desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else if (activeSort === 'name-asc') {
    filtered.sort((a, b) => (a.title.it || '').localeCompare(b.title.it || ''));
  }

  // Update Count Badge
  if (countBadge) {
    countBadge.textContent = `${filtered.length} ${currentLang === 'it' ? 'modelli disponibili' : 'models available'}`;
  }

  // Empty State
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem; color: var(--mg-text-muted);">
        <i class="fa-solid fa-filter-circle-xmark" style="font-size: 3rem; margin-bottom: 1rem; color: #ccc;"></i>
        <h3 style="font-size: 1.25rem; font-family: var(--mg-font-heading); color: var(--mg-text-main); margin-bottom: 0.5rem;">Nessun modello trovato</h3>
        <p style="font-size: 0.95rem;">Prova a modificare i filtri di ricerca o la categoria selezionata.</p>
        <button onclick="resetAllFilters()" style="margin-top: 1rem; padding: 8px 18px; background: var(--mg-dark-base); color: #fff; border: none; border-radius: var(--mg-radius); cursor: pointer;">Mostra tutti i 127 modelli</button>
      </div>
    `;
    return;
  }

  // Render Grid Cards
  grid.innerHTML = filtered.map(p => {
    const title = p.title[currentLang] || p.title.it;
    const series = p.categories.find(c => c.parentId !== 0)?.name[currentLang] || p.categories[0]?.name[currentLang] || 'Handcrafted Series';
    const imgUrl = p.thumbnail ? `/uploads/${p.thumbnail}` : FALLBACK_SVG;
    
    // Instrument tag
    const instrumentCat = p.categories.find(c => ['marimba','vibrafono','xilofono','glockenspiel','setup'].includes(c.slug));
    const instTag = instrumentCat ? instrumentCat.name.it : 'Percussione';

    // Acoustic Profile
    const { dots, timbre, shaft } = detectAcousticProfile(p);
    const dotsHtml = [1,2,3,4,5].map(i => `<span class="acoustic-dot ${i <= dots ? 'filled' : ''}"></span>`).join('');

    // Specs pills
    const shaftPill = shaft === 'rattan' ? '🌿 Rattan' : '🌳 Legno';
    const skuDisplay = p.sku || 'AP';

    return `
      <article class="mg-card" onclick="openProductModal(${p.id})">
        <div class="mg-card-img-wrap">
          <span class="mg-sku-badge">${skuDisplay}</span>
          <span class="mg-instrument-pill">${instTag}</span>
          <img src="${imgUrl}" alt="${title}" loading="lazy" class="mg-card-img" onerror="this.onerror=null; this.src='${FALLBACK_SVG}';">
          <div class="mg-hover-btn"><i class="fa-solid fa-eye"></i> Vista Rapida</div>
        </div>

        <div class="mg-card-content">
          <div class="mg-card-series">${series}</div>
          <h3 class="mg-card-title">${title}</h3>
          
          <!-- Acoustic Profile Bar -->
          <div class="mg-card-acoustic">
            <span class="acoustic-label">${timbre}</span>
            <div class="acoustic-dots" title="Durezza: ${dots}/5">
              ${dotsHtml}
            </div>
          </div>

          <div class="mg-card-specs">
            <span class="mg-spec-pill">${shaftPill}</span>
            <span class="mg-spec-pill">Made in Italy</span>
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

function resetAllFilters() {
  activeCategory = 'all';
  activeHardness = 'all';
  activeShaft = 'all';
  activeSort = 'default';
  const searchInput = document.getElementById('search-box');
  if (searchInput) searchInput.value = '';
  updatePillUI();
  renderCategoriesTree();
  renderProducts();
}

function getCatIdBySlug(slug) {
  const cat = catalogData.categories.find(c => c.slug === slug);
  return cat ? cat.id : null;
}

// Render Categories in the Right Sidebar (Hierarchical MG Mallets Style)
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

// ============================================================================
// PRODUCT MODAL DETAILS ("VISTA RAPIDA")
// ============================================================================
function openProductModal(id) {
  const product = catalogData.products.find(p => p.id === id);
  if (!product) return;

  currentModalProduct = product;
  const modal = document.getElementById('product-modal');
  
  const title = product.title[currentLang] || product.title.it;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-sku').textContent = `CODICE: ${product.sku || 'AP'}`;
  document.getElementById('modal-price').textContent = `€ ${product.price.toFixed(2)}`;
  
  const series = product.categories.find(c => c.parentId !== 0)?.name[currentLang] || product.categories[0]?.name[currentLang] || 'Handcrafted Series';
  document.getElementById('modal-series').textContent = series;

  // Description
  const desc = (product.excerpt && (product.excerpt[currentLang] || product.excerpt.it)) || 
               'Bacchetta professionale realizzata e calibrata a mano in Italia per la massima proiezione armonica.';
  document.getElementById('modal-desc').innerHTML = desc.replace(/\\r\\n/g, '<br>');

  // Main Image
  const imgUrl = product.thumbnail ? `/uploads/${product.thumbnail}` : FALLBACK_SVG;
  const modalImg = document.getElementById('modal-img');
  modalImg.onerror = function() { this.onerror = null; this.src = FALLBACK_SVG; };
  modalImg.src = imgUrl;

  // Gallery
  const thumbsContainer = document.getElementById('modal-gallery-thumbs');
  if (product.gallery && product.gallery.length > 0) {
    thumbsContainer.innerHTML = [product.thumbnail, ...product.gallery].filter(Boolean).map(g => `
      <img src="/uploads/${g}" class="modal-thumb" onerror="this.onerror=null; this.src='${FALLBACK_SVG}';" onclick="document.getElementById('modal-img').src='/uploads/${g}'">
    `).join('');
  } else {
    thumbsContainer.innerHTML = '';
  }

  // Specifications
  const specsContainer = document.getElementById('modal-specs');
  if (product.specs && Object.keys(product.specs).length > 0) {
    specsContainer.innerHTML = Object.entries(product.specs).map(([k, v]) => `
      <span class="mg-spec-pill" style="font-size: 0.8rem; padding: 5px 10px;">${k.toUpperCase()}: <strong>${v}</strong></span>
    `).join('');
  } else {
    specsContainer.innerHTML = '<span class="mg-spec-pill">Bilanciamento: <strong>Calibrato da Concerto</strong></span><span class="mg-spec-pill">Manico: <strong>Rattan / Acero</strong></span>';
  }

  // Video Demo Button if Satomi or has video
  const videoBox = document.getElementById('modal-video-box');
  const isSatomi = product.sku && SATOMI_MODELS[product.sku];
  if (isSatomi && SATOMI_MODELS[product.sku].videoId) {
    videoBox.style.display = 'block';
  } else {
    videoBox.style.display = 'none';
  }

  document.getElementById('modal-qty').value = 1;
  modal.style.display = 'flex';
}

function openProductVideo() {
  if (currentModalProduct && currentModalProduct.sku && SATOMI_MODELS[currentModalProduct.sku]) {
    const model = SATOMI_MODELS[currentModalProduct.sku];
    openVideoModal(model.videoId, `Satomi Takashima • Demo ${model.name}`);
  }
}

function closeProductModal() {
  const modal = document.getElementById('product-modal');
  if (modal) modal.style.display = 'none';
}

function closeModalOnBg(e) {
  if (e.target.classList.contains('mg-modal-overlay')) {
    e.target.style.display = 'none';
    const iframe = e.target.querySelector('iframe');
    if (iframe) iframe.src = '';
  }
}

function changeModalQty(delta) {
  const input = document.getElementById('modal-qty');
  let val = parseInt(input.value) + delta;
  if (val < 1) val = 1;
  if (val > 50) val = 50;
  input.value = val;
}

function addModalToCart() {
  if (!currentModalProduct) return;
  const qty = parseInt(document.getElementById('modal-qty').value) || 1;
  addToCartItem(currentModalProduct, qty);
  closeProductModal();
  showToast(currentModalProduct.title.it, `${qty}x aggiunti al carrello!`, true);
}

// ============================================================================
// SHOPPING CART LOGIC
// ============================================================================
function addToCartDirect(id) {
  const prod = catalogData.products.find(p => p.id === id);
  if (!prod) return;
  addToCartItem(prod, 1);
  showToast(prod.title.it, 'Aggiunto al carrello!', true);
}

function addToCartItem(product, qty) {
  const existing = cart.find(item => item.id === product.id);
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push({
      id: product.id,
      title: product.title[currentLang] || product.title.it,
      sku: product.sku || 'AP',
      price: product.price,
      thumbnail: product.thumbnail || '',
      qty: qty
    });
  }

  saveCart();
  updateCartBadge();
  renderCartDrawer();
  animateCartBounce();
}

function updateCartQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.id !== id);
  }
  saveCart();
  updateCartBadge();
  renderCartDrawer();
}

function removeCartItem(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartBadge();
  renderCartDrawer();
}

function saveCart() {
  localStorage.setItem('ap_cart', JSON.stringify(cart));
}

function updateCartBadge() {
  const totalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const badge = document.getElementById('cart-counter');
  if (badge) {
    badge.textContent = totalQty;
    badge.style.display = totalQty > 0 ? 'flex' : 'none';
  }
}

function animateCartBounce() {
  const badge = document.getElementById('cart-counter');
  if (badge) {
    badge.style.transform = 'scale(1.4)';
    setTimeout(() => { badge.style.transform = 'scale(1)'; }, 200);
  }
}

function toggleCart() {
  const drawer = document.getElementById('cart-drawer');
  const overlay = document.getElementById('cart-overlay');
  if (!drawer || !overlay) return;

  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    drawer.classList.remove('open');
    overlay.style.display = 'none';
  } else {
    renderCartDrawer();
    drawer.classList.add('open');
    overlay.style.display = 'block';
  }
}

function renderCartDrawer() {
  const container = document.getElementById('cart-items');
  const footer = document.getElementById('cart-footer');
  const subtotalEl = document.getElementById('cart-subtotal');
  const totalEl = document.getElementById('cart-total');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: var(--mg-text-muted);">
        <i class="fa-solid fa-basket-shopping" style="font-size: 3rem; color: #ddd; margin-bottom: 1rem;"></i>
        <h4 style="font-family: var(--mg-font-heading); font-size: 1.2rem; color: var(--mg-text-main); margin-bottom: 0.5rem;">Il tuo carrello è vuoto</h4>
        <p style="font-size: 0.9rem;">Scegli le tue bacchette ideali e aggiungile con un click.</p>
      </div>
    `;
    if (footer) footer.style.display = 'none';
    return;
  }

  if (footer) footer.style.display = 'block';

  let subtotal = 0;
  container.innerHTML = cart.map(item => {
    const itemTotal = item.price * item.qty;
    subtotal += itemTotal;
    const imgUrl = item.thumbnail ? `/uploads/${item.thumbnail}` : FALLBACK_SVG;

    return `
      <div class="cart-item-row">
        <img src="${imgUrl}" class="cart-item-thumb" onerror="this.onerror=null; this.src='${FALLBACK_SVG}';">
        <div>
          <div class="cart-item-title">${item.title}</div>
          <div class="cart-item-sku">SKU: ${item.sku}</div>
          <div class="cart-item-qty">
            <button class="cart-qty-btn" onclick="updateCartQty(${item.id}, -1)">-</button>
            <span style="font-size: 0.85rem; font-weight: 700; width: 20px; text-align: center;">${item.qty}</span>
            <button class="cart-qty-btn" onclick="updateCartQty(${item.id}, 1)">+</button>
          </div>
        </div>
        <div style="text-align: right;">
          <div class="cart-item-price">€ ${itemTotal.toFixed(2)}</div>
          <button class="cart-del-btn" onclick="removeCartItem(${item.id})" title="Rimuovi"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    `;
  }).join('');

  const grandTotal = subtotal + currentShippingRate;
  if (subtotalEl) subtotalEl.textContent = `€ ${subtotal.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `€ ${grandTotal.toFixed(2)}`;
}

// Checkout flow
function initiateCheckout(gateway) {
  if (cart.length === 0) return;
  alert(`Reindirizzamento verso il gateway sicuro ${gateway.toUpperCase()}...\nTotale ordine: € ${(cart.reduce((s, i) => s + (i.price * i.qty), 0) + currentShippingRate).toFixed(2)}`);
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================
function showToast(title, msg, isCart = false) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'mg-toast';
  toast.innerHTML = `
    <i class="fa-solid fa-circle-check toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    ${isCart ? `<button class="toast-btn" onclick="toggleCart()">VEDI</button>` : ''}
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    setTimeout(() => { toast.remove(); }, 300);
  }, 3500);
}

// ============================================================================
// MISC MODALS & NAV
// ============================================================================
function openCraftModal() {
  const modal = document.getElementById('craft-modal');
  if (modal) modal.style.display = 'flex';
}

function closeCraftModal() {
  const modal = document.getElementById('craft-modal');
  if (modal) modal.style.display = 'none';
}

function toggleMobileNav() {
  const menu = document.getElementById('mg-nav-menu');
  if (menu) menu.classList.toggle('mobile-open');
}

function setLanguage(lang) {
  currentLang = lang;
  document.getElementById('btn-it')?.classList.toggle('active', lang === 'it');
  document.getElementById('btn-en')?.classList.toggle('active', lang === 'en');
  renderCategoriesTree();
  renderProducts();
}
