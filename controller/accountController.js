const User = require("../model/userModel")
const nodemailer = require('nodemailer');
const bcrypt = require("bcrypt");
const product = require('../model/productModel')
const Cart = require('../model/cartModel')
const Address = require('../model/addressModel')
const Orders = require("../model/orderModel");
const userwallet = require('../model/walletModal')

const load_address = async (req, res) => {
    try {
        const address_data = await Address.find({ user_id: req.session.userid })
        // console.log(address_data);

        res.render('users/address', { data: address_data })

    } catch (error) {

        console.log(error);

    }

}

const add_address = async (req, res) => {
    try {
        const { addressName, addressEmail, addressMobile, addressHouse, addressStreet, addressPost, addressCity,
            addressDistrict, addressState, addressPin
        } = req.body;

        // console.log(addressName, addressEmail, addressMobile, addressHouse, addressStreet, addressPost, addressCity, addressDistrict, addressState, addressPin);

        const newAddress = new Address({
            user_id: req.session.userid, addressName, addressEmail, addressMobile, addressHouse, addressStreet, addressPost,
            addressCity, addressDistrict, addressState, addressPin
        });
        await newAddress.save();
        res.json({ success: true, message: 'Address saved successfully!' });
    } catch (error) {
        console.log("add address", error);
        res.status(500).json({ success: false, message: 'Error saving address. Please try again.' });
    }

}

const delete_address = async (req, res) => {

    try {
        const addressId = req.params.addressId;
        // console.log("deleted id is", addressId);

        const result = await Address.deleteOne({ _id: addressId });

        if (result.deletedCount === 1) {

            res.json({ success: true });
        } else {

            res.json({ success: false, error: 'Address not found or could not be deleted.' });
        }
    } catch (error) {

        console.error("Error deleting address:", error);
        res.json({ success: false, error: error.message });
    }

}

const edit_address = async (req, res) => {
    try {
        const addressId = req.params.id;
        const updatedData = req.body;
        console.log(updatedData);

        const updatedAddress = await Address.findByIdAndUpdate(addressId, updatedData, { new: true });

        if (updatedAddress) {

            res.json({ success: true, message: 'Address updated successfully' });
        } else {

            res.status(404).json({ success: false, message: 'Address not found' });
        }
    } catch (error) {
        // Handle any errors that occur during the update process
        console.error('Error updating address:', error);
        res.status(500).json({ success: false, message: 'An error occurred while updating the address' });
    }
};


const load_orders = async (req, res) => {
    try {
        const user = req.session.userid
        const page = parseInt(req.query.page) || 1; // Get the page from query params, default to 1
        const limit = 5; // Number of orders per page
        const skip = (page - 1) * limit;

        const totalOrders = await Orders.countDocuments({userId:user});
        const totalPages = Math.ceil(totalOrders / limit);

        const order = await Orders.find({ userId: user }).populate('products.productId').skip(skip)
            .limit(limit)
            .sort({ orderDate: -1 });

        res.render('users/myorders', {
            order, currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        })

    } catch (error) {
        console.log(error);

    }

}

const order_details = async (req, res) => {
    try {
        const orderid = req.query.orderId;
        const order_data = await Orders.find({ orderId: orderid }).populate("products.productId")
        const addressdata = order_data[0].address;

        if (order_data[0].discountAmount && order_data[0].discountAmount !== 0) {
            const discountPercentage = ((order_data[0].discountAmount * 100) / order_data[0].totalAmount)
            if (order_data[0].products.length == 1) {
                order_data[0].products.forEach(item => {
                    item.product_discount = order_data[0].discountAmount
                })

            }

            else {

                order_data[0].products.forEach(item => {
                    item.product_discount = Math.round((item.price * item.quantity) * (discountPercentage / 100))
                })
            }

        }

        res.render('users/orderdetails', { order: order_data[0], addressdata })

    } catch (error) {
        console.log(error);
    }
}


const cancel_order = async (req, res) => {
    try {

        const { orderid, productid } = req.body;
      

        const order = await Orders.findOne({ orderId: orderid });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const productIndex = order.products.findIndex(p => p.productId.toString() === productid);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in this order' });
        }
        
        const totalamount = order.products[productIndex].quantity * order.products[productIndex].price
        const user_id = order.userId
        if (order.paymentMethod === 'razorpay'||order.paymentMethod === 'wallet') {
            let wallet = await userwallet.findOne({ user_id: user_id });
            let refunt_amount = 0
            if (order.discountAmount != 0) {
                const refund_persontage = (order.discountAmount * 100 / order.totalAmount)
                refunt_amount = totalamount - Math.round(totalamount * (refund_persontage / 100))
            

            } else {
                refunt_amount = totalamount

            }
            if (!wallet) {

                wallet = new userwallet({
                    user_id: user_id,
                    balance: refunt_amount,
                    transactions: [{
                        amount: amount,
                        description: 'cancel order',
                        type:'credit'
                    }]
                });
            } else {

                wallet.balance += refunt_amount;
                wallet.transactions.push({
                    amount: refunt_amount,
                    description:'cancel order',
                         type:'credit'
                });
            }
            // Save the wallet
            console.log('reach here');

            await wallet.save();

        }
        order.products[productIndex].status = 'Cancelled';
        await order.save();
        await product.findByIdAndUpdate(productid, { $inc: { stock: order.products[productIndex].quantity } });
        return res.json({ success: true, message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        return res.status(500).json({ success: false, message: 'Server error' });
    }

}

module.exports = {
    load_address,
    add_address,
    delete_address,
    edit_address,
    load_orders,
    order_details,
    cancel_order
}

