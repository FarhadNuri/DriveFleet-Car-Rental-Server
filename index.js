const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const dotenv = require('dotenv')
dotenv.config()

const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGO_URI

app.use(cors())
app.use(express.json())

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const logger = (req, res, next) => {
  console.log(`${req.method} | ${req.url}`);
  next(); 
};

const verifyToken = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Unauthorized - No token provided' });
  }

  try {
    const JWKS = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error('Token validation failed:', error.message);
    return res.status(401).json({ message: 'Unauthorized - Invalid token' });
  }
};

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

    app.get('/featured', async(req,res) => {
      const featuredCars = carCollection.find().limit(6)
      const result = await featuredCars.toArray()
      res.send(result)
    })

     app.post('/cars', logger, verifyToken, async (req, res) => {
      const carData = req.body;
      const newCar = {
        ...carData,
        ownerEmail: req.user.email,
        ownerId: req.user.sub,      
        createdAt: new Date(),
        bookingCount: 0,
      };
      const result = await carCollection.insertOne(newCar);
      res.send(result);
    });

    app.patch('/cars/:carId', logger, verifyToken, async (req, res) => {
      const { carId } = req.params;
      const updateData = req.body;

      if (!ObjectId.isValid(carId)) {
        return res.status(400).json({ message: 'Invalid car ID' });
      }

      const car = await carCollection.findOne({ _id: new ObjectId(carId) });
      if (!car) {
        return res.status(404).json({ message: 'Car not found' });
      }
      if (car.ownerId !== req.user.sub) {
        return res.status(403).json({ message: 'Car does not belong to you' });
      }

      const result = await carCollection.updateOne(
        { _id: new ObjectId(carId) },
        {
          $set: {
            ...updateData,
            updatedAt: new Date(),
          },
        }
      );
      res.send(result);
    });




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