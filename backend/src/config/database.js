// ─── MongoDB Connection Config ────────────────────────────────
// MONGO_URI must be set in the root .env file (loaded by docker-compose via env_file).
// Falls back to the Atlas URI if the env var is missing (e.g. local dev).
const mongoose = require('mongoose');

const connectDB = async () => {
  const uriSource = process.env.MONGO_URI ? 'env:MONGO_URI' : 'hardcoded fallback';
  const uri = process.env.MONGO_URI ||
    'mongodb+srv://sujalpathrabe_db_user:8nJte3nTpye19yxS@cluster0.o8xhlxr.mongodb.net/auction_system?appName=Cluster0';

  // Mask credentials in logs for security
  const maskedUri = uri.replace(/:\/\/[^@]+@/, '://***:***@');

  console.log(`[DB] Connecting via (${uriSource}): ${maskedUri}`);

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,  // wait up to 10s to find Atlas
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      retryWrites: true,
    });
    console.log(`[DB] ✅ MongoDB connected successfully`);
  } catch (err) {
    console.error(`[DB] ❌ Connection error (${uriSource}): ${err.message}`);
    console.log('[DB] Retrying in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
