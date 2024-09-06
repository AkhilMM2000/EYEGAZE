const mongoose = require('mongoose');
const Brand = new mongoose.Schema({

    brandName: {
        type: String,
        required: true
    },
    listed: {
        type: Boolean,
        default: false
    }
})

module.exports = mongoose.model('brand', Brand);
