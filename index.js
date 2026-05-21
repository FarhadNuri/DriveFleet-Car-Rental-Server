const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const dotenv = require("dotenv");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const uri = process.env.MONGO_URI;


app.use(
  cors({
    origin: [
      "https://drive-fleet-car-rental-client.vercel.app",
      "http://localhost:3000",
    ],
    credentials: true,
  })
);

app.use(express.json());


let cachedClient = null;

async function getDB() {
  if (cachedClient) {
    return cachedClient.db("driverfleetdb");
  }
  const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });
  await client.connect();
  cachedClient = client;
  console.log("Connected to MongoDB!");
  return client.db("driverfleetdb");
}

const logger = (req, res, next) => {
  console.log(`${req.method} | ${req.url}`);
  next();
};


const verifyToken = async (req, res, next) => {
  const { authorization } = req.headers;
  const token = authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "Unauthorized - No token provided" });
  }

  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`)
    );
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload;
    next();
  } catch (error) {
    console.error("Token validation failed:", error.message);
    return res.status(401).json({ message: "Unauthorized - Invalid token" });
  }
};


app.get("/", (req, res) => {
  res.send("Driver Fleet API is running!");
});


app.get("/cars", logger, async (req, res) => {
  try {
    const db = await getDB();
    const { search, type } = req.query;
    let query = {};
    if (search) query.carName = { $regex: search, $options: "i" };
    if (type) query.carType = type;
    const result = await db.collection("cars").find(query).toArray();
    res.send(result);
  } catch (error) {
    console.error("GET /cars error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/featured-cars", logger, async (req, res) => {
  try {
    const db = await getDB();
    const result = await db
      .collection("cars")
      .find({ availabilityStatus: "Available" })
      .limit(6)
      .toArray();
    res.send(result);
  } catch (error) {
    console.error("GET /featured-cars error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/cars/:carId", logger, async (req, res) => {
  try {
    const db = await getDB();
    const { carId } = req.params;
    if (!ObjectId.isValid(carId)) {
      return res.status(400).json({ message: "Invalid car ID" });
    }
    const result = await db
      .collection("cars")
      .findOne({ _id: new ObjectId(carId) });
    if (!result) {
      return res.status(404).json({ message: "Car not found" });
    }
    res.send(result);
  } catch (error) {
    console.error("GET /cars/:carId error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.post("/cars", logger, verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const carData = req.body;
    const newCar = {
      ...carData,
      ownerEmail: req.user.email,
      ownerId: req.user.sub,
      createdAt: new Date(),
      bookingCount: 0,
    };
    const result = await db.collection("cars").insertOne(newCar);
    res.send(result);
  } catch (error) {
    console.error("POST /cars error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.patch("/cars/:carId", logger, verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const { carId } = req.params;
    const { _id, ownerId, ownerEmail, createdAt, bookingCount, ...updateData } =
      req.body;

    if (!ObjectId.isValid(carId)) {
      return res.status(400).json({ message: "Invalid car ID" });
    }

    const car = await db
      .collection("cars")
      .findOne({ _id: new ObjectId(carId) });
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }
    if (car.ownerId !== req.user.sub) {
      return res.status(403).json({ message: "Car does not belong to you" });
    }

    const result = await db.collection("cars").updateOne(
      { _id: new ObjectId(carId) },
      { $set: { ...updateData, updatedAt: new Date() } }
    );
    res.send(result);
  } catch (error) {
    console.error("PATCH /cars/:carId error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.delete("/cars/:carId", logger, verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const { carId } = req.params;

    if (!ObjectId.isValid(carId)) {
      return res.status(400).json({ message: "Invalid car ID" });
    }

    const car = await db
      .collection("cars")
      .findOne({ _id: new ObjectId(carId) });
    if (!car) {
      return res.status(404).json({ message: "Car not found" });
    }
    if (car.ownerId !== req.user.sub) {
      return res.status(403).json({ message: "Car does not belong to you" });
    }

    const result = await db
      .collection("cars")
      .deleteOne({ _id: new ObjectId(carId) });
    res.send(result);
  } catch (error) {
    console.error("DELETE /cars/:carId error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.get("/my-cars/:userId", logger, verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const { userId } = req.params;

    if (userId !== req.user.sub) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db
      .collection("cars")
      .find({ ownerId: userId })
      .toArray();
    res.send(result);
  } catch (error) {
    console.error("GET /my-cars/:userId error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});


app.post("/bookings", logger, verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const bookingData = req.body;
    const { carId } = bookingData;

    if (!ObjectId.isValid(carId)) {
      return res.status(400).json({ message: "Invalid car ID" });
    }

    const car = await db
      .collection("cars")
      .findOne({ _id: new ObjectId(carId) });
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
    const result = await db.collection("bookings").insertOne(newBooking);

    await db.collection("cars").updateOne(
      { _id: new ObjectId(carId) },
      {
        $set: { availabilityStatus: "Booked" },
        $inc: { bookingCount: 1 },
      }
    );

    res.send(result);
  } catch (error) {
    console.error("POST /bookings error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.get("/bookings/:userId", logger, verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const { userId } = req.params;

    if (userId !== req.user.sub) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await db
      .collection("bookings")
      .find({ userId })
      .toArray();
    res.send(result);
  } catch (error) {
    console.error("GET /bookings/:userId error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/bookings/:bookingId", logger, verifyToken, async (req, res) => {
  try {
    const db = await getDB();
    const { bookingId } = req.params;

    if (!ObjectId.isValid(bookingId)) {
      return res.status(400).json({ message: "Invalid booking ID" });
    }

    const booking = await db
      .collection("bookings")
      .findOne({ _id: new ObjectId(bookingId) });
    if (!booking) {
      return res.status(404).json({ message: "Booking not found" });
    }
    if (booking.userId !== req.user.sub) {
      return res.status(403).json({ message: "You are not allowed" });
    }

    const result = await db
      .collection("bookings")
      .deleteOne({ _id: new ObjectId(bookingId) });

    await db.collection("cars").updateOne(
      { _id: new ObjectId(booking.carId) },
      { $set: { availabilityStatus: "Available" } }
    );

    res.send(result);
  } catch (error) {
    console.error("DELETE /bookings/:bookingId error:", error.message);
    res.status(500).json({ message: "Internal server error" });
  }
});


if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;