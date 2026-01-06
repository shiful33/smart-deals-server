const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

// --- Firebase Admin Initialization ---
try {
  const decoded = Buffer.from(
    process.env.FIREBASE_SERVICE_KEY,
    "base64"
  ).toString("utf8");
  const serviceAccount = JSON.parse(decoded);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
} catch (e) {
  console.error(
    "❌ CRITICAL: Could not initialize Firebase Admin. Check service account file path and content."
  );
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://your-frontend-domain.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  })
);
app.use(express.json());

app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

// --- Token Verify Middleware ---
const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res
      .status(401)
      .send({ message: "Unauthorized access: No token provided" });
  }

  const token = authorization.split(" ")[1];
  if (!token) {
    return res
      .status(401)
      .send({ message: "Unauthorized access: Invalid token format" });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;

    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);
    return res
      .status(401)
      .send({ message: "Unauthorized access: Invalid or expired token" });
  }
};

// --- MongoDB Setup ---
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@ahmedtpro.4kxy1cz.mongodb.net/SmartDeals?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
  serverSelectionTimeoutMS: 15000,
});

// --- Default Route ---
app.get("/", (req, res) => res.send("Smart Deals Server Running!"));

// --- Main Server Function ---
async function run() {
  try {
    await client.connect();
    console.log("✅ MongoDB Connected Successfully!");

    const db = client.db("SmartDeals");
    const products = db.collection("products");
    const bids = db.collection("bids");
    const users = db.collection("users");

    // --- USER ROUTES ---
    app.post("/users", async (req, res) => {
      const user = req.body;
      try {
        const exists = await users.findOne({ email: user.email });
        if (exists) return res.send({ message: "Exists" });
        const result = await users.insertOne(user);
        res.send(result);
      } catch (e) {
        res.status(500).send({ error: "Failed to create user." });
      }
    });

    // GET Products (with optional email query)
    app.get("/products", async (req, res) => {
      try {
        const { email } = req.query;
        const query = email ? { email } : {};
        const result = await products.find(query).toArray();
        res.send(result);
      } catch (e) {
        res.status(500).send({ error: "Failed to fetch products" });
      }
    });

    // GET Latest Products (Sorted by descending time: 1)
    app.get("/latest-products", async (req, res) => {
      try {
        const db = client.db("SmartDeals");
        const result = await db
          .collection("products")
          .find()
          .limit(6)
          .toArray();
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });

    // GET All Products (Sorted by descending time: 1)
    app.get("/all-products", async (req, res) => {
      try {
        const result = await products
          .find()
          .sort({ created_at: 1 })
          .limit(21)
          .toArray();
        res.send(result);
      } catch (e) {
        res.status(500).send({ error: "Failed to fetch latest products" });
      }
    });

    app.get("/products/bids/:productId", async (req, res) => {
      const { productId } = req.params;
      try {
        const result = await bids
          .find({ product: productId })
          .sort({ bid_price: -1 })
          .toArray();
        res.send(result);
      } catch (e) {
        res.status(500).send({ error: "Database error fetching product bids" });
      }
    });

    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await products.findOne(query);

      if (result) {
        res.send(result);
      } else {
        res.status(404).send({ message: "Product not found" });
      }
    });

    // POST a New Product
    app.post("/products", async (req, res) => {
      const p = req.body;
      p.created_at = new Date();
      try {
        const result = await products.insertOne(p);
        res.send(result);
      } catch (e) {
        res.status(500).send({ error: "Failed to insert product." });
      }
    });

    app.get("/bids", verifyToken, async (req, res) => {
      const { buyer_email } = req.query;
      const query = {};

      if (buyer_email && buyer_email !== req.user.email) {
        return res
          .status(403)
          .send({ error: "Forbidden: Cannot view other users' bids" });
      }

      query.buyer_email = buyer_email || req.user.email;

      try {
        const result = await bids.find(query).sort({ bid_price: -1 }).toArray();
        res.send(result);
      } catch (e) {
        res.status(500).send({ error: "Database error fetching user bids" });
      }
    });

    // POST a New Bid (Protected Route)
    app.post("/bids", verifyToken, async (req, res) => {
      const bid = req.body;
      bid.buyer_email = req.user.email;
      bid.buyer_name = req.user.name || req.user.email.split("@")[0];
      bid.created_at = new Date();

      try {
        const result = await bids.insertOne(bid);
        res.send(result);
      } catch (e) {
        res.status(500).send({ error: "Failed to place bid." });
      }
    });

    // DELETE a Bid (Protected Route)
    app.delete("/bids/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id))
        return res.status(400).send({ error: "Invalid Bid ID format" });

      try {
        const result = await bids.deleteOne({
          _id: new ObjectId(id),
          buyer_email: req.user.email,
        });
        if (result.deletedCount === 0) {
          return res
            .status(404)
            .send({ error: "Bid not found or not owned by user." });
        }
        res.send(result);
      } catch (e) {
        console.error("Database error deleting bid:", e);
        res.status(500).send({ error: "Database error deleting bid" });
      }
    });

    console.log("APIs Ready!");
  } catch (err) {
    console.error(
      "❌ CRITICAL DB Error: Check URI, Network Access, or DB credentials.",
      err.message
    );
    process.exit(1);
  }
}

run();

app.listen(port, () =>
  console.log(`🚀 Server listening at http://localhost:${port}`)
);

module.exports = app;
