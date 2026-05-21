const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const dotenv = require("dotenv");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;


app.use(cors({
  origin: [
    'https://drive-fleet-car-rental-client.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true
}));

app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const logger = (req, res, next) => {
  console.log(`${req.method} | ${req.url}`);
  next();
};

const verifyToken = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized - No token provided" });
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token validation failed:", error.message);
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};

async function run() {
  try {
    await client.connect();
    const db = client.db("driverfleetdb");
    const carCollection = db.collection("cars");
    const bookingCollection = db.collection("bookings");

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );

    app.get("/cars", logger, async (req, res) => {
      const { search, type } = req.query;
      let query = {};
      if (search) {
        query.carName = { $regex: search, $options: "i" };
      }
      if (type) {
        query.carType = type;
      }
      const result = await carCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/cars/:carId", logger, async (req, res) => {
      const { carId } = req.params;

      if (!ObjectId.isValid(carId)) {
        return res.status(400).json({ message: "Invalid car ID" });
      }

      const result = await carCollection.findOne({ _id: new ObjectId(carId) });
      if (!result) {
        return res.status(404).json({ message: "Car not found" });
      }
      res.send(result);
    });

    app.get("/featured-cars", logger, async (req, res) => {
      const result = await carCollection
        .find({ availabilityStatus: "Available" })
        .limit(6)
        .toArray();
      res.send(result);
    });

    app.post("/cars", logger, verifyToken, async (req, res) => {
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

    app.patch("/cars/:carId", logger, verifyToken, async (req, res) => {
      const { carId } = req.params;
      const {
        _id,
        ownerId,
        ownerEmail,
        createdAt,
        bookingCount,
        ...updateData
      } = req.body;

      if (!ObjectId.isValid(carId)) {
        return res.status(400).json({ message: "Invalid car ID" });
      }

      const car = await carCollection.findOne({ _id: new ObjectId(carId) });
      if (!car) {
        return res.status(404).json({ message: "Car not found" });
      }
      if (car.ownerId !== req.user.sub) {
        return res.status(403).json({ message: "Car does not belong to you" });
      }

      const result = await carCollection.updateOne(
        { _id: new ObjectId(carId) },
        {
          $set: {
            ...updateData,
            updatedAt: new Date(),
          },
        },
      );
      res.send(result);
    });

    app.delete("/cars/:carId", logger, verifyToken, async (req, res) => {
      const { carId } = req.params;

      if (!ObjectId.isValid(carId)) {
        return res.status(400).json({ message: "Invalid car ID" });
      }

      const car = await carCollection.findOne({ _id: new ObjectId(carId) });
      if (!car) {
        return res.status(404).json({ message: "Car not found" });
      }
      if (car.ownerId !== req.user.sub) {
        return res.status(403).json({ message: "Car does not belong to you" });
      }

      const result = await carCollection.deleteOne({
        _id: new ObjectId(carId),
      });
      res.send(result);
    });

    app.get("/my-cars/:userId", logger, verifyToken, async (req, res) => {
      const { userId } = req.params;

      if (userId !== req.user.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }
      const result = await carCollection.find({ ownerId: userId }).toArray();
      res.send(result);
    });
    app.post("/bookings", logger, verifyToken, async (req, res) => {
      const bookingData = req.body;
      const { carId } = bookingData;

      if (!ObjectId.isValid(carId)) {
        return res.status(400).json({ message: "Invalid car ID" });
      }

      const car = await carCollection.findOne({ _id: new ObjectId(carId) });
      if (!car) {
        return res.status(404).json({ message: "Car not found" });
      }
      if (car.availabilityStatus !== "Available") {
        return res
          .status(400)
          .json({ message: "Car is not available for booking" });
      }

      const newBooking = {
        ...bookingData,
        userId: req.user.sub,
        userEmail: req.user.email,
        bookedAt: new Date(),
        status: "Confirmed",
      };
      const result = await bookingCollection.insertOne(newBooking);

      await carCollection.updateOne(
        { _id: new ObjectId(carId) },
        {
          $set: { availabilityStatus: "Booked" },
          $inc: { bookingCount: 1 },
        },
      );

      res.send(result);
    });

    app.get("/bookings/:userId", logger, verifyToken, async (req, res) => {
      const { userId } = req.params;

      if (userId !== req.user.sub) {
        return res.status(403).json({ message: "Forbidden" });
      }

      const result = await bookingCollection.find({ userId }).toArray();
      res.send(result);
    });

    app.delete(
      "/bookings/:bookingId",
      logger,
      verifyToken,
      async (req, res) => {
        const { bookingId } = req.params;
        if (!ObjectId.isValid(bookingId)) {
          return res.status(400).json({ message: "Invalid booking ID" });
        }

        const booking = await bookingCollection.findOne({
          _id: new ObjectId(bookingId),
        });
        if (!booking) {
          return res.status(404).json({ message: "Booking not found" });
        }

        if (booking.userId !== req.user.sub) {
          return res.status(403).json({ message: "You are not allowed" });
        }
        const result = await bookingCollection.deleteOne({
          _id: new ObjectId(bookingId),
        });

        await carCollection.updateOne(
          { _id: new ObjectId(booking.carId) },
          { $set: { availabilityStatus: "Available" } },
        );

        res.send(result);
      },
    );
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Driver Fleet API is running!");
});


if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
  });
}

module.exports = app;
