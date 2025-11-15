const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Firebase Admin Init (env var theke)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const app = express();
app.use(cors());
app.use(express.json());

// Example Route
app.get('/api/products', async (req, res) => {
  try {
    const snapshot = await admin.firestore().collection('products').limit(10).get();
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(products);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Vercel Serverless Export
module.exports = app;