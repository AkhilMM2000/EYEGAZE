const mongoose = require('mongoose');
const Address = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'costomer',
        required: true
    },
    addressName: {
        type: String,
        required: true
    },
    addressEmail: {
        type: String,
        required: true
    },
    addressMobile: {
        type: Number,
        required: true
    },
    addressHouse: {
        type: String,
        required: true
    },
    addressStreet: {
        type: String,
        required: true
    },
    addressPost: {
        type: String,
        required: true
    },
    addressCity: {
        type: String,
        required: true
    },
    addressDistrict: {
        type: String,
        required: true
    },
    addressState: {
        type: String,
        required: true
    },
    addressPin: {
        type: Number,
        required: true
    }

})

module.exports = mongoose.model('address', Address);
