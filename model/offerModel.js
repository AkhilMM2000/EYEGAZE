const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    offerName: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    discount: {
        type: Number,
        required: true,
    },
    type: {
        type: String,
        // required: true,
    },
    products: [
        {
            productId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'product',
                required: true,
            },

        }
    ],
    category: [
        {
            categoryId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'category',
                required: true,
            }
        }
    ],
    status: {
        type: Boolean,
        required: true
    },
});

module.exports = mongoose.model('Offer', offerSchema);
