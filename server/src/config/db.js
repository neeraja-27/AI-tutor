const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai_learning_companion';
  const maskedUri = uri.replace(/:([^@:]+)@/, ':****@');

  console.log(`[Database] Attempting connection to: ${maskedUri}`);

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Fail fast after 5s instead of hanging
    });

    console.log(`✓ MongoDB Connected Successfully: ${conn.connection.host} (DB: ${conn.connection.name})`);
  } catch (error) {
    console.error('\n==================== ❌ MONGODB CONNECTION ERROR ====================');
    console.error(`Error Code   : ${error.code || 'N/A'}`);
    console.error(`Error Name   : ${error.name}`);
    console.error(`Error Message: ${error.message}`);

    console.error('\n--- Diagnostic & Troubleshooting Guide ---');
    if (error.message.includes('ECONNREFUSED')) {
      console.error('• Cause: No local MongoDB server is running on 127.0.0.1:27017.');
      console.error('• Fix  : Run `sudo systemctl start mongod` or start MongoDB via Docker.');
    } else if (error.message.includes('bad auth') || error.message.includes('AuthenticationFailed')) {
      console.error('• Cause: Invalid MongoDB Atlas username or password.');
      console.error('• Fix  : Check your database user in Atlas (Database Access). If your password has special chars (like @), encode it (e.g., @ -> %40).');
    } else if (error.message.includes('querySrv ENOTFOUND') || error.message.includes('queryTxt ETIMEOUT')) {
      console.error('• Cause: DNS SRV resolution failed for your Atlas cluster.');
      console.error('• Fix  : Add Google DNS (8.8.8.8) to /etc/resolv.conf or check cluster hostname in .env.');
    } else if (error.message.includes('Could not connect to any servers') || error.name === 'MongooseServerSelectionError') {
      console.error('• Cause: Network timeout or IP firewall block.');
      console.error('• Fix 1: Ensure 0.0.0.0/0 is added and "Active" in MongoDB Atlas > Network Access.');
      console.error('• Fix 2: If on university/office Wi-Fi, port 27017 may be blocked. Try mobile hotspot or local MongoDB.');
    } else {
      console.error('• Full Stack Trace:');
      console.error(error.stack);
    }
    console.error('=====================================================================\n');

    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  // Connection lifecycle listeners
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️ MongoDB disconnected.');
  });
  mongoose.connection.on('reconnected', () => {
    console.log('✓ MongoDB reconnected.');
  });
};

module.exports = connectDB;

