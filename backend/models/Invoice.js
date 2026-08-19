const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  invoiceNumber: { type: String, required: true },
  
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  status: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
  
  plan: { type: String, required: true },
  period: {
    start: Date,
    end: Date
  },
  
  razorpayInvoiceId: String,
  razorpayPaymentIntentId: String,
  
  paidAt: Date,
  pdfUrl: String,
  
  items: [{
    description: String,
    amount: Number,
    quantity: Number
  }]
  
}, { timestamps: true });

invoiceSchema.index({ tenantId: 1, createdAt: -1 });
invoiceSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
invoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

module.exports = mongoose.model('Invoice', invoiceSchema);