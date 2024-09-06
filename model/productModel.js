const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  productName: {
    type: String,
    required: true
  },
  productimages: {
    type: [String],
    required: true
  },
  productBrand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "brand",
    required: true,

  },
  description: {
    type: String
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  // discountPrice: {
  //   type: Number,
  //   min: 0
  // },
  gender: {
    type: String,
    enum: ['men', 'women', 'kids'],
    // required: true,

  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "category",
    required: true
  },
  Date: {
    type: Date,
    default: Date.now,
    require: true
  },
  listed: {
    type: Boolean,
    required: true
  },
  
  offers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer'
  }],

  stock: {
    type: Number,
    required: true
  }

});

module.exports = mongoose.model('product', productSchema);
