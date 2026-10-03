const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 9559;

app.use(cors());
app.use(express.json());

// Serve static assets and product uploads
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
app.use(express.static(path.join(__dirname, 'public')));

// Database loading
const dataFilePath = path.join(__dirname, 'data', 'apinstrument.json');
const ordersFilePath = path.join(__dirname, 'data', 'orders_history.json');
const liveOrdersFilePath = path.join(__dirname, 'data', 'live_orders.json');

function getCatalog() {
  if (fs.existsSync(dataFilePath)) {
    return JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
  }
  return { categories: [], products: [], pages: [] };
}

function getLiveOrders() {
  if (fs.existsSync(liveOrdersFilePath)) {
    return JSON.parse(fs.readFileSync(liveOrdersFilePath, 'utf8'));
  }
  return [];
}

function saveLiveOrders(orders) {
  fs.writeFileSync(liveOrdersFilePath, JSON.stringify(orders, null, 2));
}

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

// 3. Single Product by Slug or ID
app.get('/api/products/:identifier', (req, res) => {
  const catalog = getCatalog();
  const idOrSlug = req.params.identifier;
  const product = catalog.products.find(p => p.slug === idOrSlug || p.id === parseInt(idOrSlug));

  if (!product) {
    return res.status(404).json({ success: false, error: 'Product not found' });
  }

  // Related products in same category
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

// 4. Shipping calculation rules (migrated from WooCommerce advanced shipping)
app.post('/api/shipping/calculate', (req, res) => {
  const { country, itemsCount, totalWeight } = req.body;
  
  // Standard logic:
  // Italy: 9.00 EUR (Free above 150 EUR)
  // EU: 16.00 EUR
  // Extra EU: 25.00 EUR
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

// 5. Checkout & Order Creation
app.post('/api/orders/create', (req, res) => {
  const {
    customer,
    items,
    shipping,
    paymentMethod,
    totals
  } = req.body;

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

// 6. PayPal Client Configuration
app.get('/api/payment/paypal-config', (req, res) => {
  res.json({
    success: true,
    clientId: process.env.PAYPAL_CLIENT_ID || 'sb', // sandbox default or custom
    currency: 'EUR'
  });
});

// 7. Pages content (About, Craftsmanship, Contact)
app.get('/api/pages/:slug', (req, res) => {
  const catalog = getCatalog();
  const page = catalog.pages.find(p => p.slug === req.params.slug);
  if (!page) {
    return res.status(404).json({ success: false, error: 'Page not found' });
  }
  res.json({ success: true, data: page });
});

// 8. Order lookup by ID
app.get('/api/orders/:orderId', (req, res) => {
  const liveOrders = getLiveOrders();
  const order = liveOrders.find(o => o.orderId === parseInt(req.params.orderId));
  if (order) {
    return res.json({ success: true, order });
  }
  res.status(404).json({ success: false, error: 'Order not found' });
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
