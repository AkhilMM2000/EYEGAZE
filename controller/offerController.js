const User = require("../model/userModel")
const nodemailer = require('nodemailer');
const passport = require('passport');
const product = require('../model/productModel')
const Cart = require('../model/cartModel')
const Address = require('../model/addressModel')
const Orders = require('../model/orderModel')
const Razorpay = require('razorpay')
const userwallet = require('../model/walletModal')
const Userdata = require('../model/userModel')
const category = require('../model/category')
const Offer = require('../model/offerModel')
const get_addoffer = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get current page from query params, default is 1
        const limit = 2; // Number of offers per page
        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        // Fetch offers with pagination
        const [productdata, categorydata, offerdata, totalOffers] = await Promise.all([
            product.find({ listed: true }),
            category.find({ listed: true }),
            Offer.find()
                .populate('category.categoryId')
                .populate('products.productId')
                .skip(skip)
                .limit(limit),
            Offer.countDocuments() // Get total count of offers for pagination calculation
        ]);

        const totalPages = Math.ceil(totalOffers / limit); // Calculate total pages

        res.render('admin/addOffer', { 
            productdata, 
            categorydata, 
            offerdata, 
            currentPage: page, 
            totalPages: totalPages 
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
}


const add_offer = async (req, res) => {
    try {

        const { offerName, offerDescription, offerDiscount, offerType, offerProducts } = req.body;

        let value;
        if (offerType == 'Inactive') {
            value = false
        } else {
            value = true
        }
        const newOffer = new Offer({
            offerName,
            description: offerDescription,
            discount: parseInt(offerDiscount, 10), // Convert discount to number
            type: "productOffer",
            products: offerProducts.map(productId => ({
                productId: productId
            })),
            category: [],
            status: value
        });

        await newOffer.save();

        if (offerProducts && offerProducts.length > 0) {
            await product.updateMany(
                { _id: { $in: offerProducts } },
                { $addToSet: { offers: newOffer._id } } // Add offer reference to the products
            );
        }

        // Respond with success
        res.status(200).json({ success: true, message: 'Offer saved successfully' });
    } catch (error) {
        console.error('Error saving offer:', error);
        res.status(500).json({ success: false, message: 'Error saving offer' });
    }

}

const category_offer = async (req, res) => {
    try {
        const { offerName, offerDescription, offerDiscount, offerType, offerProducts } = req.body
        let value;
        if (offerType == 'Inactive') {
            value = false
        } else {
            value = true
        }
        console.log(offerProducts);

        const newOffer = new Offer({
            offerName,
            description: offerDescription,
            discount: parseInt(offerDiscount, 10), // Convert discount to number
            type: "categoryOffer",
            products: [],
            category: offerProducts.map(productId => ({
                categoryId: productId
            })),
            status: value
        });

        await newOffer.save();
        if (offerProducts && offerProducts.length > 0) {
            await product.updateMany(
                { category: { $in: offerProducts } },
                { $addToSet: { offers: newOffer._id } } // Add offer reference to the products
            );
        }

        // Respond with success
        res.status(200).json({ success: true, message: 'Offer saved successfully' });
    } catch (error) {
        console.error('Error saving offer:', error);
        res.status(500).json({ success: false, message: 'Error saving offer' });
    }

}

const categoryoffer_edit = async (req, res) => {
    try {
        const offerId = req.params.offerId;
        const { offerName, description, discount, categories, status } = req.body;
        let value;
        if (status === 'Inactive') {
            value = false;
        } else {
            value = true;
        }
        const existingOffer = await Offer.findById(offerId);
        if (!existingOffer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        const oldCategoryIds = existingOffer.category.map(cat => cat.categoryId.toString());
        const newCategoryIds = categories;
        await product.updateMany(
            { category: { $in: oldCategoryIds } },
            { $pull: { offers: existingOffer._id } }
        );
        await product.updateMany(
            { category: { $in: newCategoryIds } },
            { $addToSet: { offers: existingOffer._id } }
        );

        const updatedOffer = await Offer.findByIdAndUpdate(
            offerId,
            {
                offerName,
                description,
                discount: parseInt(discount, 10),
                type: "categoryOffer",
                products: [],
                category: categories.map(productId => ({
                    categoryId: productId
                })),
                status: value
            },
            { new: true }
        );

        if (!updatedOffer) {

            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        res.status(200).json({ success: true, message: 'Offer updated successfully' });
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).json({ success: false, message: 'Error updating offer' });
    }

}


const productoffer_edit = async (req, res) => {
    try {

        const offerId = req.params.offerId;
        const { offerName, offerDescription, offerDiscount, selectedProducts, offerStatus } = req.body;

        let value;
        if (offerStatus === 'Inactive') {
            value = false;
        } else {
            value = true;
        }
        const existingOffer = await Offer.findById(offerId);
        if (!existingOffer) {
            return res.status(404).json({ success: false, message: 'Offer not found' });
        }
        const oldProductIds = existingOffer.products.map(prod => prod.productId.toString());
        const newProductIds = selectedProducts;

        await product.updateMany(
            { _id: { $in: oldProductIds } },
            { $pull: { offers: existingOffer._id } }
        );
        await product.updateMany(
            { _id: { $in: newProductIds } },
            { $addToSet: { offers: existingOffer._id } }
        );

        const updatedOffer = await Offer.findByIdAndUpdate(
            offerId,
            {
                offerName,
                description: offerDescription,
                discount: parseInt(offerDiscount, 10),
                type: "productOffer",
                products: selectedProducts.map(productId => ({
                    productId: productId
                })),
                category: [],
                status: value
            },
            { new: true }
        );

        if (!updatedOffer) {

            return res.status(404).json({ success: false, message: 'Offer not found' });
        }

        res.status(200).json({ success: true, message: 'Offer updated successfully' });
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).json({ success: false, message: 'Error updating offer' });
    }

}


module.exports = {
    get_addoffer,
    add_offer,
    category_offer,
    categoryoffer_edit,
    productoffer_edit
}




