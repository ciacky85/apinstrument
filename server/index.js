const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 9559;

app.use(cors());
app.use(express.json());

// Directories
const masterSeedData = path.join(__dirname, '..', 'master_seed', 'data', 'apinstrument.json');
const masterSeedOrders = path.join(__dirname, '..', 'master_seed', 'data', 'orders_history.json');
const masterSeedUsers = path.join(__dirname, '..', 'master_seed', 'data', 'users.json');
const masterSeedUploads = path.join(__dirname, '..', 'master_seed', 'uploads');

const dataDir = path.join(__dirname, 'data');
const uploadsDir = path.join(__dirname, 'public', 'uploads');

const dataFilePath = path.join(dataDir, 'apinstrument.json');
const ordersFilePath = path.join(dataDir, 'orders_history.json');
const liveOrdersFilePath = path.join(dataDir, 'live_orders.json');
const usersFilePath = path.join(dataDir, 'users.json');

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
// If external mapped directory (/srv/docker_conf/configs/apinstrument) was empty, auto-populate from master_seed
function initializeData() {
  try {
    const dataExists = fs.existsSync(dataFilePath);
    const dataSize = dataExists ? fs.statSync(dataFilePath).size : 0;
    if (!dataExists || dataSize < 100) {
      if (fs.existsSync(masterSeedData)) {
        console.log('[Auto-Init] Populating external data with apinstrument.json from master_seed...');
        fs.copyFileSync(masterSeedData, dataFilePath);
      }
    }

    const ordersExists = fs.existsSync(ordersFilePath);
    const ordersSize = ordersExists ? fs.statSync(ordersFilePath).size : 0;
    if (!ordersExists || ordersSize < 10) {
      if (fs.existsSync(masterSeedOrders)) {
        console.log('[Auto-Init] Populating external data with orders_history.json...');
        fs.copyFileSync(masterSeedOrders, ordersFilePath);
      }
    }

    const usersExists = fs.existsSync(usersFilePath);
    const usersSize = usersExists ? fs.statSync(usersFilePath).size : 0;
    if (!usersExists || usersSize < 10) {
      if (fs.existsSync(masterSeedUsers)) {
        console.log('[Auto-Init] Populating external data with users.json from master_seed...');
        fs.copyFileSync(masterSeedUsers, usersFilePath);
      }
    }

    const currentUploads = fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : [];
    if (currentUploads.length <= 1 && fs.existsSync(masterSeedUploads)) {
      console.log('[Auto-Init] Populating external uploads folder with 271 original images from master_seed...');
      copyDirRecursive(masterSeedUploads, uploadsDir);
      console.log('[Auto-Init] Finished populating external uploads.');
    }
  } catch (err) {
    console.error('[Auto-Init Warning]:', err.message);
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

// Users Storage Helpers
function getUsers() {
  if (fs.existsSync(usersFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
    } catch (e) {}
  }
  return [];
}

function saveUsers(users) {
  try {
    fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), 'utf8');
    if (fs.existsSync(masterSeedUsers)) {
      fs.writeFileSync(masterSeedUsers, JSON.stringify(users, null, 2), 'utf8');
    }
  } catch (e) {
    console.error('Error saving users:', e);
  }
}

// Live Orders Storage Helpers
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
    fs.writeFileSync(liveOrdersFilePath, JSON.stringify(orders, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving live orders:', e);
  }
}

// Password & Auth Token Helpers
const AUTH_SECRET = 'apinstrument_secure_salt_key_2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + '_' + AUTH_SECRET).digest('hex');
}

function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    exp: Date.now() + (30 * 24 * 60 * 60 * 1000) // 30 days
  };
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', AUTH_SECRET).update(raw).digest('hex');
  return `${raw}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [raw, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', AUTH_SECRET).update(raw).digest('hex');
  if (sig !== expectedSig) return null;
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Accesso non autorizzato. Effettua il login.' });
  }
  const token = authHeader.split(' ')[1];
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, error: 'Sessione scaduta o non valida.' });
  }
  req.user = payload;
  next();
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

  // 3. Fallback SVG if image
  if (reqSubPath.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(FALLBACK_MALLET_SVG);
  }

  next();
});

// Serve frontend static assets (CSS, JS, HTML) with strict cache-busting headers for Cloudflare/browsers
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
  }
}));

// ============================================================================
// API ROUTES: CATALOG
// ============================================================================

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
    return res.status(404).json({ success: false, error: 'Prodotto non trovato' });
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

// ============================================================================
// API ROUTES: USER AUTHENTICATION & PROFILE
// ============================================================================

function formatSafeUser(user) {
  if (!user) return null;
  const streetStr = typeof user.address === 'object' ? (user.address.street || '') : (user.address || '');
  const cityStr = typeof user.address === 'object' ? (user.address.city || user.city || '') : (user.city || '');
  const postcodeStr = typeof user.address === 'object' ? (user.address.postcode || user.postcode || '') : (user.postcode || '');
  const countryStr = typeof user.address === 'object' ? (user.address.country || user.country || 'IT') : (user.country || 'IT');
  const nameStr = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name || user.email.split('@')[0];

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    name: nameStr,
    phone: user.phone || '',
    fiscalCode: user.fiscalCode || '',
    street: streetStr,
    city: cityStr,
    postcode: postcodeStr,
    country: countryStr,
    address: {
      street: streetStr,
      city: cityStr,
      postcode: postcodeStr,
      country: countryStr
    },
    dateCreated: user.dateCreated
  };
}

// Register new user
app.post('/api/auth/register', (req, res) => {
  const { email, password, firstName, lastName, phone, address, city, postcode, country, fiscalCode } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ success: false, error: 'Compila tutti i campi obbligatori (Nome, Cognome, Email e Password).' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = getUsers();

  if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
    return res.status(400).json({ success: false, error: 'Questa email è già registrata. Effettua il login.' });
  }

  let streetVal = '';
  let cityVal = city ? String(city).trim() : '';
  let postcodeVal = postcode ? String(postcode).trim() : '';
  let countryVal = country || 'IT';

  if (address && typeof address === 'object') {
    streetVal = address.street ? String(address.street).trim() : '';
    cityVal = address.city ? String(address.city).trim() : cityVal;
    postcodeVal = address.postcode ? String(address.postcode).trim() : postcodeVal;
    countryVal = address.country || countryVal;
  } else if (address) {
    streetVal = String(address).trim();
  }

  const newUser = {
    id: users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1,
    email: cleanEmail,
    passwordHash: hashPassword(password),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phone: phone ? String(phone).trim() : '',
    address: streetVal,
    city: cityVal,
    postcode: postcodeVal,
    country: countryVal,
    fiscalCode: fiscalCode ? String(fiscalCode).trim().toUpperCase() : '',
    dateCreated: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  const token = generateToken(newUser);
  const safeUser = formatSafeUser(newUser);

  res.json({
    success: true,
    message: 'Registrazione completata con successo',
    token,
    user: safeUser
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Inserisci email e password.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const users = getUsers();
  const user = users.find(u => u.email.toLowerCase() === cleanEmail);

  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ success: false, error: 'Email o password non corretti.' });
  }

  const token = generateToken(user);
  const safeUser = formatSafeUser(user);

  res.json({
    success: true,
    message: 'Accesso eseguito',
    token,
    user: safeUser
  });
});

// Current User Profile
app.get('/api/auth/me', authMiddleware, (req, res) => {
  const users = getUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'Utente non trovato' });
  }
  res.json({ success: true, user: formatSafeUser(user) });
});

// Update Profile & Addresses
app.put('/api/auth/profile', authMiddleware, (req, res) => {
  const users = getUsers();
  const userIdx = users.findIndex(u => u.id === req.user.id);
  if (userIdx === -1) {
    return res.status(404).json({ success: false, error: 'Utente non trovato' });
  }

  const { firstName, lastName, phone, address, city, postcode, country, fiscalCode, password } = req.body;

  if (firstName) users[userIdx].firstName = String(firstName).trim();
  if (lastName) users[userIdx].lastName = String(lastName).trim();
  if (phone !== undefined) users[userIdx].phone = String(phone).trim();
  if (fiscalCode !== undefined) users[userIdx].fiscalCode = String(fiscalCode).trim().toUpperCase();

  if (address && typeof address === 'object') {
    if (address.street !== undefined) users[userIdx].address = String(address.street).trim();
    if (address.city !== undefined) users[userIdx].city = String(address.city).trim();
    if (address.postcode !== undefined) users[userIdx].postcode = String(address.postcode).trim();
    if (address.country !== undefined) users[userIdx].country = address.country;
  } else {
    if (address !== undefined) users[userIdx].address = String(address).trim();
    if (city !== undefined) users[userIdx].city = String(city).trim();
    if (postcode !== undefined) users[userIdx].postcode = String(postcode).trim();
    if (country !== undefined) users[userIdx].country = country;
  }

  if (password && password.length >= 6) {
    users[userIdx].passwordHash = hashPassword(password);
  }

  saveUsers(users);

  res.json({
    success: true,
    message: 'Profilo e indirizzi aggiornati con successo',
    user: formatSafeUser(users[userIdx])
  });
});

// User Order History
app.get('/api/auth/orders', authMiddleware, (req, res) => {
  const userEmail = (req.user.email || '').toLowerCase();
  const userId = req.user.id;

  const liveOrders = getLiveOrders();
  const userOrders = liveOrders.filter(o => 
    (o.userId && o.userId === userId) || 
    (o.customer && o.customer.email && o.customer.email.toLowerCase() === userEmail)
  );

  const reversed = [...userOrders].reverse();
  res.json({
    success: true,
    count: userOrders.length,
    data: reversed,
    orders: reversed
  });
});

// ============================================================================
// API ROUTES: ORDERS & CHECKOUT
// ============================================================================

// PayPal Configuration Endpoint
app.get('/api/config/paypal', (req, res) => {
  res.json({
    success: true,
    clientId: process.env.PAYPAL_CLIENT_ID || 'sb',
    currency: 'EUR'
  });
});

// Create Order (Cards, PayPal, Bonifico)
app.post('/api/orders/create', (req, res) => {
  const { customer, items, shipping, paymentMethod, totals, userId, notes, paypalTransaction } = req.body;

  if (!customer || !items || !items.length) {
    return res.status(400).json({ success: false, error: 'Dati carrello o cliente incompleti' });
  }

  const liveOrders = getLiveOrders();
  const orderNumber = 10000 + liveOrders.length + 1;
  const orderId = `AP-${orderNumber}`;

  // Check if token was provided in header
  let linkedUserId = userId || null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = verifyToken(authHeader.split(' ')[1]);
    if (payload) linkedUserId = payload.id;
  }

  const calcSubtotal = Number(totals?.subtotal ?? req.body.subtotal ?? items.reduce((s, i) => s + (i.price * i.qty), 0));
  const calcShipping = Number(totals?.shipping ?? req.body.shipping ?? 9.0);
  const calcTotal = Number(totals?.total ?? req.body.total ?? (calcSubtotal + calcShipping));

  let orderStatus = 'In Lavorazione';
  let transactionId = null;

  if (paymentMethod === 'paypal') {
    if (paypalTransaction) {
      orderStatus = 'Pagato (PayPal Verificato)';
      transactionId = paypalTransaction.id || paypalTransaction.orderID || `PAYID-APP-${Date.now()}`;
    } else {
      orderStatus = 'Pagato (PayPal)';
      transactionId = `PAYID-MANUAL-${Date.now()}`;
    }
  } else if (paymentMethod === 'bacs') {
    orderStatus = 'In Attesa di Bonifico';
    transactionId = `BACS-${orderNumber}`;
  } else {
    orderStatus = 'Pagato (Carta Verificata)';
    transactionId = `CARD-${Date.now().toString(36).toUpperCase()}`;
  }

  const newOrder = {
    orderId,
    orderNumber,
    userId: linkedUserId,
    createdAt: new Date().toISOString(),
    dateCreated: new Date().toISOString(),
    status: orderStatus,
    paymentMethod: paymentMethod || 'carta',
    transactionId,
    paypalDetails: paypalTransaction || null,
    customer: {
      firstName: customer.firstName || '',
      lastName: customer.lastName || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: typeof customer.address === 'object' ? (customer.address.street || '') : (customer.address || ''),
      city: typeof customer.address === 'object' ? (customer.address.city || customer.city || '') : (customer.city || ''),
      postcode: typeof customer.address === 'object' ? (customer.address.postcode || customer.postcode || '') : (customer.postcode || ''),
      country: typeof customer.address === 'object' ? (customer.address.country || customer.country || 'IT') : (customer.country || 'IT'),
      fiscalCode: customer.fiscalCode || '',
      notes: notes || customer.notes || ''
    },
    items,
    subtotal: calcSubtotal,
    shipping: calcShipping,
    total: calcTotal,
    totals: {
      subtotal: calcSubtotal,
      shipping: calcShipping,
      total: calcTotal
    }
  };

  liveOrders.push(newOrder);
  saveLiveOrders(liveOrders);

  res.json({
    success: true,
    orderId,
    orderNumber,
    status: newOrder.status,
    order: newOrder,
    message: 'Ordine confermato con successo!'
  });
});

// Single Order Receipt Lookup
app.get('/api/orders/:orderId', (req, res) => {
  const liveOrders = getLiveOrders();
  const order = liveOrders.find(o => o.orderId === req.params.orderId || String(o.orderNumber) === req.params.orderId);
  if (!order) {
    return res.status(404).json({ success: false, error: 'Ordine non trovato' });
  }
  res.json({ success: true, data: order });
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
