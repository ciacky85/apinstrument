const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 9559;

app.use(cors());
app.use(express.json());

// Path references
const dataFilePath = path.join(__dirname, 'data', 'apinstrument.json');
const ordersFilePath = path.join(__dirname, 'data', 'orders_history.json');
const liveOrdersFilePath = path.join(__dirname, 'data', 'live_orders.json');
const bundledUploadsDir = path.join(__dirname, 'public', 'uploads');
const externalUploadsDir = '/srv/docker_conf/configs/apinstrument/uploads';

// In-memory catalog loaded from bundled file at boot
let memoryCatalog = { categories: [], products: [], pages: [] };

function loadInitialCatalog() {
  try {
    if (fs.existsSync(dataFilePath)) {
      memoryCatalog = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      console.log(`Loaded ${memoryCatalog.products.length} products and ${memoryCatalog.categories.length} categories.`);
    }
  } catch (e) {
    console.error('Error loading dataFilePath:', e);
  }
}

loadInitialCatalog();

function getCatalog() {
  // If external mapped file exists and has content, use it, else memoryCatalog
  if (fs.existsSync(dataFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
      if (data && data.products && data.products.length > 0) {
        return data;
      }
    } catch (e) {}
  }
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
    fs.mkdirSync(path.dirname(liveOrdersFilePath), { recursive: true });
    fs.writeFileSync(liveOrdersFilePath, JSON.stringify(orders, null, 2));
  } catch (e) {
    console.error('Error saving orders:', e);
  }
}

// Media fallback handler: if external mount is empty or file not found there, serve from bundled public/uploads!
app.use('/uploads', (req, res, next) => {
  const reqPath = decodeURIComponent(req.path);
  // 1. Check external mount
  const externalFile = path.join(externalUploadsDir, reqPath);
  if (fs.existsSync(externalFile) && fs.statSync(externalFile).isFile()) {
    return res.sendFile(externalFile);
  }
  // 2. Check bundled uploads inside container
  const bundledFile = path.join(bundledUploadsDir, reqPath);
  if (fs.existsSync(bundledFile) && fs.statSync(bundledFile).isFile()) {
    return res.sendFile(bundledFile);
  }
  next();
});

// Serve other static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// 1. Categories
app.get('/api/categories', (req, res) => {
  const catalog = getCatalog();
  res.json({ success: true, data: catalog.categories });
});

// 2. Products
app.get('/api/products', (req, res) => {
  const catalog = getCatalog();
  let list = catalog.products;

  const { category, search, instrument, lang } = req.query;

  if (category) {
    list = list.filter(p => p.categories.some(c => c.slug === category || c.id === parseInt(category)));
  }

  if (instrument) {
    list = list.filter(p => p.categories.some(c => c.slug === instrument || (c.name && c.name.it && c.name.it.toLowerCase().includes(instrument.toLowerCase()))));
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
    zoneName = 'Italia Standard (Corriere Espresso)';
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

// 5. Orders Creation
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
  console.log(`Open at: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
