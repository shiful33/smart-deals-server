const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Id: SmartDeals
// Pass: JKsitqQQwe25vlaT
const uri = "mongodb+srv://SmartDeals:JKsitqQQwe25vlaT@ahmedtpro.4kxy1cz.mongodb.net/?appName=AhmedTPro";


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
})

app.get('/', (req, res) => {
  res.send('Smart Deals Running!')
})

async function run() {
  try {
    await client.connect();

    const database = client.db('SmartDeals'); 
    const productsCollection = database.collection('products');

    app.get('/products', async(req, res) => {
      const cursor = productsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })

    app.get('/products/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await productsCollection.findOne(query);
      res.send(result);
    })

    app.post('/products', async(req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    })

    app.patch('/products/:id', async (req, res) => {
      const id = req.params.id;
      const updateProduct = req.body;
      const query = { _id: new ObjectId(id) }
      const update = {
        $set: {
           name: updateProduct.name,
           price: updateProduct.price
        }
      }
      const result = await productsCollection.updateOne(query, update);
      res.send(result);
    })

    app.delete('/products/:id', async(req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    })

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})