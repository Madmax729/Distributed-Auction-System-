// ─── MongoDB Connection Config ────────────────────────────────
// Supports both local MongoDB (Compass) and Atlas.
// Set MONGO_URI in .env:
//   Local:  mongodb://localhost:27017/auction_system
//   Docker: mongodb://host.docker.internal:27017/auction_system
//   Atlas:  mongodb+srv://<user>:<pass>@cluster.mongodb.net/auction_system
const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error(
      '[DB] MONGO_URI is not set.\n' +
      '  For local MongoDB:  MONGO_URI=mongodb://localhost:27017/auction_system\n' +
      '  For Docker:         MONGO_URI=mongodb://host.docker.internal:27017/auction_system'
    );
  }

  // Mask credentials in logs
  const maskedUri = uri.replace(/:\/\/([^:]+):([^@]+)@/, '://***:***@');
  console.log(`[DB] Connecting to: ${maskedUri}`);

  const isAtlas = uri.startsWith('mongodb+srv');

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: isAtlas ? 15000 : 8000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    // retryWrites only supported on Atlas replica sets
    ...(isAtlas ? { retryWrites: true, w: 'majority' } : {}),
  });

  console.log('[DB] ✅ MongoDB connected successfully');
};

module.exports = connectDB;
