const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 9559;

app.use(cors());
app.use(express.json());

// Directories
const masterSeedData = path.join(__dirname, '..', 'master_seed', 'data', 'apinstrument.json');
const masterSeedOrders = path.join(__dirname, '..', 'master_seed', 'data', 'orders_history.json');
const masterSeedUploads = path.join(__dirname, '..', 'master_seed', 'uploads');

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');

const dataFilePath = path.join(dataDir, 'apinstrument.json');
const ordersFilePath = path.join(dataDir, 'orders_history.json');
const liveOrdersFilePath = path.join(dataDir, 'live_orders.json');

// Ensure directories exist
fs.mkdirSync(dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

// Copy file recursively helper
function copyDirRecursive(src, dest) {
  try {
    if (!fs.existsSync(src)) return;
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyDirRecursive(srcPath, destPath);
      } else if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  } catch (err) {
    console.error('Error in copyDirRecursive:', err);
  }
}

// 1. Initial Sync & Data Loading:
// If data directory was shadowed by an empty Docker mount, restore from master_seed
function initializeData() {
  // Restore apinstrument.json if missing or empty
  if (!fs.existsSync(dataFilePath) || fs.statSync(dataFilePath).size < 100) {
    if (fs.existsSync(masterSeedData)) {
      console.log('Restoring catalog data from master_seed...');
      fs.copyFileSync(masterSeedData, dataFilePath);
    }
  }

  // Restore orders_history.json if missing
  if (!fs.existsSync(ordersFilePath) || fs.statSync(ordersFilePath).size < 10) {
    if (fs.existsSync(masterSeedOrders)) {
      fs.copyFileSync(masterSeedOrders, ordersFilePath);
    }
  }

  // Restore uploads if empty
  const currentUploads = fs.readdirSync(uploadsDir);
  if (currentUploads.length <= 1) {
    console.log('Populating uploads from master_seed...');
    copyDirRecursive(masterSeedUploads, uploadsDir);
  }
}

initializeData();

// In-memory catalog guaranteed from master_seed or active file
let memoryCatalog = { categories: [], products: [], pages: [] };
try {
  if (fs.existsSync(dataFilePath) && fs.statSync(dataFilePath).size > 100) {
    memoryCatalog = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
  } else if (fs.existsSync(masterSeedData)) {
    memoryCatalog = JSON.parse(fs.readFileSync(masterSeedData, 'utf8'));
  }
  console.log(`[AP Instrument] Loaded ${memoryCatalog.products.length} products and ${memoryCatalog.categories.length} categories.`);
} catch (err) {
  console.error('Error loading catalog into memory:', err);
}

function getCatalog() {
  try {
    if (fs.existsSync(dataFilePath)) {
      const fileData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      if (fileData && fileData.products && fileData.products.length > 0) {
        return fileData;
      }
    }
  } catch (err) {}
  return memoryCatalog;
}

function getLiveOrders() {
  if (fs.existsSync(liveOrdersFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(liveOrdersFilePath, 'utf8'));
    } catch (e) {}
  }
  return [];
}

function saveLiveOrders(orders) {
  try {
    fs.writeFileSync(liveOrdersFilePath, JSON.stringify(orders, null, 2));
  } catch (e) {
    console.error('Error saving orders:', e);
  }
}

// Fallback Mallet SVG if any media file is not present
const FALLBACK_MALLET_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">
  <rect width="100%" height="100%" fill="#f7f6f2"/>
  <line x1="80" y1="320" x2="300" y2="100" stroke="#8b5a2b" stroke-width="12" stroke-linecap="round"/>
  <circle cx="300" cy="100" r="42" fill="#c48243"/>
  <circle cx="300" cy="100" r="32" fill="#e8d8c8"/>
  <text x="200" y="360" font-family="sans-serif" font-size="16" font-weight="bold" fill="#5c3a21" text-anchor="middle">AP INSTRUMENT</text>
  <text x="200" y="380" font-family="sans-serif" font-size="12" fill="#888" text-anchor="middle">Handcrafted Mallets</text>
</svg>`;

// Ultra-reliable static file handler for uploads:
// 1. Checks server/public/uploads
// 2. Checks master_seed/uploads
// 3. Fallbacks gracefully without 404
app.use('/uploads', (req, res, next) => {
  const reqSubPath = decodeURIComponent(req.path).replace(/^\/+/, '');
  
  // 1. Try public uploads
  const primaryPath = path.join(uploadsDir, reqSubPath);
  if (fs.existsSync(primaryPath) && fs.statSync(primaryPath).isFile()) {
    return res.sendFile(primaryPath);
  }

  // 2. Try master seed uploads
  const seedPath = path.join(masterSeedUploads, reqSubPath);
  if (fs.existsSync(seedPath) && fs.statSync(seedPath).isFile()) {
    return res.sendFile(seedPath);
  }

  // 3. If it is an image request, return fallback SVG
  if (reqSubPath.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(FALLBACK_MALLET_SVG);
  }

  next();
});

// Serve frontend static assets (CSS, JS, HTML)
app.use(express.static(path.join(__dirname, 'public'), {
  etag: false,
  maxAge: 0
}));

// API Routes

// 1. Categories
app.get('/api/categories', (req, res) => {
  const catalog = getCatalog();
  res.json({ success: true, count: catalog.categories.length, data: catalog.categories });
});

// 2. Products with filters
app.get('/api/products', (req, res) => {
  const catalog = getCatalog();
  let list = catalog.products;

  const { category, search, instrument } = req.query;

  if (category) {
    list = list.filter(p => p.categories.some(c => c.slug === category || c.id === parseInt(category)));
  }

  if (instrument) {
    list = list.filter(p => p.categories.some(c => 
      c.slug === instrument || 
      (c.name && c.name.it && c.name.it.toLowerCase().includes(instrument.toLowerCase()))
    ));
  }

  if (search) {
    const q = search.toLowerCase();
    list = list.filter(p => 
      (p.title.it && p.title.it.toLowerCase().includes(q)) ||
      (p.title.en && p.title.en.toLowerCase().includes(q)) ||
      (p.sku && p.sku.toLowerCase().includes(q)) ||
      (p.excerpt.it && p.excerpt.it.toLowerCase().includes(q))
    );
  }

  res.json({
    success: true,
    count: list.length,
    data: list
  });
});

// 3. Single Product
app.get('/api/products/:identifier', (req, res) => {
  const catalog = getCatalog();
  const idOrSlug = req.params.identifier;
  const product = catalog.products.find(p => p.slug === idOrSlug || p.id === parseInt(idOrSlug));

  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  const catIds = product.categories.map(c => c.id);
  const related = catalog.products
    .filter(p => p.id !== product.id && p.categories.some(c => catIds.includes(c.id)))
    .slice(0, 4);

  res.json({
    success: true,
    data: product,
    related
  });
});

// 4. Shipping Calculation
app.post('/api/shipping/calculate', (req, res) => {
  const { country } = req.body;
  let rate = 9.00;
  let zoneName = 'Italia';

  if (!country || country === 'IT') {
    rate = 9.00;
    zoneName = 'Italia Standard (Corriere Espresso 24/48h)';
  } else if (['FR', 'DE', 'ES', 'AT', 'BE', 'NL', 'PT', 'PL', 'SE'].includes(country)) {
    rate = 16.00;
    zoneName = 'Unione Europea (Express Courier)';
  } else {
    rate = 25.00;
    zoneName = 'Extra UE / Worldwide';
  }

  res.json({
    success: true,
    shippingCost: rate,
    zone: zoneName
  });
});

// 5. Orders Creation (PayPal / BACS)
app.post('/api/orders/create', (req, res) => {
  const { customer, items, shipping, paymentMethod, totals } = req.body;

  if (!customer || !items || !items.length) {
    return res.status(400).json({ success: false, error: 'Dati carrello o cliente non validi' });
  }

  const liveOrders = getLiveOrders();
  const orderId = 10000 + liveOrders.length + 1;

  const newOrder = {
    orderId,
    dateCreated: new Date().toISOString(),
    status: paymentMethod === 'paypal' ? 'processing' : 'on-hold',
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      city: customer.city,
      postcode: customer.postcode,
      country: customer.country,
      fiscalCode: customer.fiscalCode || '',
      vatNumber: customer.vatNumber || ''
    },
    items,
    shipping,
    paymentMethod,
    totals: {
      subtotal: totals.subtotal,
      shipping: totals.shipping,
      total: totals.total
    }
  };

  liveOrders.push(newOrder);
  saveLiveOrders(liveOrders);

  res.json({
    success: true,
    orderId,
    status: newOrder.status,
    message: 'Ordine registrato con successo'
  });
});

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`AP Instrument Modern Store running on port ${PORT}`);
  console.log(`Ready at: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
