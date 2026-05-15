require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

const adminName = process.env.ADMIN_INIT_NAME || 'admin';
const adminPassword = process.env.ADMIN_INIT_PASSWORD || 'admin123';
const adminEmail = process.env.ADMIN_INIT_EMAIL || 'admin@example.com';
const adminNickname = process.env.ADMIN_INIT_NICKNAME || '超级管理员';

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const existing = await Admin.findOne({ name: adminName });
  if (!existing) {
    await Admin.create({
      name: adminName,
      password: bcrypt.hashSync(adminPassword, 10),
      email: adminEmail,
      nickname: adminNickname,
      groupId: 1,
      status: 1
    });
    console.log(`Admin account created: ${adminName} (password loaded from .env)`);
  } else {
    console.log(`Admin account already exists: ${adminName}`);
  }
  await mongoose.disconnect();
});
