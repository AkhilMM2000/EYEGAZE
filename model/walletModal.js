const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "costomer",
    required: true,
  },
  balance: {
    type: Number,
    required: true,
    default: 0
  },
  transactions: [
    {
      amount: {
        type: Number,
        required: true
      },
      date: {
        type: Date,
        default: Date.now
      },
      description: {
        type: String,
        required: true
      },
      type: {
        type: String,
        enum: ['debit', 'credit'],
       
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model('wallet',walletSchema);
