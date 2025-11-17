const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const crypto = require('crypto');

const connectDatabase = require('../src/config/database');
const User = require('../src/models/User');

function normalizePhone(raw) {
  if (!raw) return null;
  return raw.replace(/[^\d+]/g, '');
}

(async function run() {
  try {
    await connectDatabase();

    console.log('Connected. Starting backfill for hashedPhone...');

    const cursor = User.find({ phoneNumber: { $ne: null } }).cursor();
    let updated = 0;

    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const normalized = normalizePhone(doc.phoneNumber);
      const hash = normalized ? crypto.createHash('sha256').update(normalized).digest('hex') : null;

      if (hash && doc.hashedPhone !== hash) {
        await User.updateOne({ _id: doc._id }, { $set: { hashedPhone: hash } });
        updated++;
        if (updated % 100 === 0) {
          console.log(`Updated ${updated} users...`);
        }
      }
    }

    // Ensure index exists
    await User.collection.createIndex({ hashedPhone: 1 });

    console.log(`Backfill complete. Users updated: ${updated}`);
  } catch (err) {
    console.error('Backfill error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
})();
