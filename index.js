const express = require('express');
const { MongoClient, ServerApiVersion } = require('mongodb');
const cors = require('cors')
const dotenv = require('dotenv')
dotenv.config()

const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGO_URI

app.use(cors())


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    const db = client.db("driverfleetdb")
    const carCollection = db.collection("cars")

    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    app.get('/cars', async (req, res) => {
      const carData = carCollection.find();
      const result = await carData.toArray();
      res.send(result)
    })

    app.get('/cars/:carsId', async (req, res) => {
      const {carsId} = req.params
      const query = {_id: new ObjectId(carsId)}
      const car = await carCollection.findOne(query)

      res.send(car)
    })

  } catch (error) {
    console.error("MongoDB connection error:", error.message);
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!');
});
app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});