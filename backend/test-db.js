const mongoose = require('mongoose');
require('dotenv').config();

async function testConn() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('SUCCESS: Connected to MongoDB Atlas!');
  } catch (error) {
    console.error('FAILED TO CONNECT:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

testConn();
