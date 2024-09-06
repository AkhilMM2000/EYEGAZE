const mongoose = require('mongoose');

const CouponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: true,
        unique: true
    },
    discount: {
        type: Number,
        required: true
    },
    minPurchaseAmount: {
        type: Number,
        default: 0
    },
    maxDiscountAmount: {
        type: Number,
        default: 0
    },
    expirationDate: {
        type: Date,
        required: true
    },
    status: {
        type: Boolean,
        required: true

    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});


module.exports = mongoose.model('Coupon', CouponSchema);
