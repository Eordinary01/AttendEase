/**
 * syncPlans.js
 * Migration script to update existing Plan documents in MongoDB
 * to match the synchronized pricing tiers displayed on the Landing Page.
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const Plan = require('../models/Plan');

const canonicalPlans = [
  {
    code: 'free',
    name: 'Free',
    pricing: { monthly: 0, yearly: 0, currency: 'INR' },
    limits: {
      maxStudents: 50,
      maxTeachers: 5,
      maxAdmins: 1,
      maxStorageMB: 1024,
      maxAPIcallsPerDay: 10000
    }
  },
  {
    code: 'basic',
    name: 'Basic',
    description: 'Great for growing schools',
    pricing: { monthly: 999, yearly: 9588, currency: 'INR' },
    limits: {
      maxStudents: 200,
      maxTeachers: 20,
      maxAdmins: 3,
      maxStorageMB: 10240,
      maxAPIcallsPerDay: 50000
    }
  },
  {
    code: 'professional',
    name: 'Professional',
    description: 'For large institutions',
    pricing: { monthly: 2499, yearly: 23988, currency: 'INR' },
    limits: {
      maxStudents: 1000,
      maxTeachers: 100,
      maxAdmins: 10,
      maxStorageMB: 51200,
      maxAPIcallsPerDay: 200000
    }
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'Complete ERP solution',
    pricing: { monthly: 4999, yearly: 47988, currency: 'INR' },
    limits: {
      maxStudents: 10000,
      maxTeachers: 1000,
      maxAdmins: 50,
      maxStorageMB: 512000,
      maxAPIcallsPerDay: 1000000
    }
  }
];

async function run() {
  const mongoURI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/attendance_dev';
  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoURI);
  console.log('Connected to MongoDB');

  for (const item of canonicalPlans) {
    const existing = await Plan.findOne({ code: item.code });
    if (existing) {
      existing.pricing = item.pricing;
      if (item.limits) {
        existing.limits = { ...existing.limits, ...item.limits };
      }
      await existing.save();
      console.log(`✓ Updated plan [${item.code}]: ₹${item.pricing.monthly}/mo, ₹${item.pricing.yearly}/yr`);
    } else {
      await Plan.create(item);
      console.log(`✓ Created missing plan [${item.code}]: ₹${item.pricing.monthly}/mo, ₹${item.pricing.yearly}/yr`);
    }
  }

  console.log('\nAll plans successfully synchronized with Landing Page pricing!');
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Error synchronizing plans:', err);
  process.exit(1);
});
