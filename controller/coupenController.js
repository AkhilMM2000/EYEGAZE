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
const Coupon=require('../model/coupenModel')

const load_coupon = async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;  
      const limit = 2;  
      const skip = (page - 1) * limit;  

      const coupen_data = await Coupon.find().skip(skip).limit(limit);

      const totalCoupons = await Coupon.countDocuments();

      // Calculate the total number of pages
      const totalPages = Math.ceil(totalCoupons / limit);

        res.render('admin/addCoupen',{coupen:coupen_data, currentPage: page,
          totalPages: totalPages})
    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');

    }
}

// add coupon--------------------------------------------------------------------------------------
const add_coupon = async (req, res) => {

    try {
        const { Code, discount, minPurchaseAmount, maxDiscountAmount,   expiredate, status } = req.body;
 console.log(req.body);

        if (!Code || !discount || !minPurchaseAmount || !maxDiscountAmount || !expiredate|| status === undefined) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        let value;
        if(status=='active'){
            value=true
        }else{
            value=false
        }
        const existingCoupon = await Coupon.findOne({    code:Code });
        if (existingCoupon) {
            return res.status(400).json({ message: 'Coupon code already exists' });
        }

        // Create a new coupon instance
        const newCoupon = new Coupon({
            code:Code,
            discount,
            minPurchaseAmount,
            maxDiscountAmount,
            expirationDate:expiredate,
            status:value
        });

        // Save the coupon to the database
        await newCoupon.save();

        res.status(201).json({ message: 'Coupon added successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }

}

// edit coupon --------------------------------------------------------------
const edit_coupon=async(req,res)=>{
try {
    const coupon=req.params.couponid
   
   
    const {editcode, editdiscount, MinPurchaseedit, MaxDiscountedit, editExpiredate, statusedit } = req.body;

    // Validate input
    if (!editcode || !editdiscount || !MinPurchaseedit || !MaxDiscountedit || !editExpiredate || statusedit === undefined) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    let value;
    if(statusedit=='active'){
        value=true
    }else{
        value=false
    }

    // Find and update the coupon
    const updatedCoupon = await Coupon.findByIdAndUpdate(
        coupon,
        {
            code: editcode,
            discount: editdiscount,
            minPurchaseAmount: MinPurchaseedit,
            maxDiscountAmount: MaxDiscountedit,
            expirationDate: new Date(editExpiredate),
            status:value
        },
        { new: true }
    );

    if (!updatedCoupon) {
        return res.status(404).json({ message: 'Coupon not found' });
    }

    res.json({ message: 'Coupon updated successfully', coupon: updatedCoupon });
} catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
}
    

}

//user apply that coupon while checkout---------------------------------------user apply that coupon while checkout------------
const applyCoupon = async (req, res) => {
    try {
      const { couponCode } = req.body;
      const userId = req.session.userid;
  
      // Find the user and populate used coupons
      const user = await User.findById(userId).populate('usedCoupons');
  
      // Check if the coupon has already been used by the user
      const alreadyUsed = user.usedCoupons.some(coupon => coupon.code === couponCode);
      if (alreadyUsed) {
        return res.status(400).json({ message: 'already used the coupon' });
      }
  
      // Find the coupon by code
      const coupon = await Coupon.findOne({ code: couponCode });
      if (!coupon || !coupon.status) {
        return res.status(400).json({ message: 'Invalid coupon code' });
      }
  
      // Get the cart for the user
      const cart = await Cart.findOne({ user: userId }).populate({
        path: 'products.product',
        populate: [{ path: 'offers' }]
      });
  
      let discountAmount = 0;
      let totalCartAmount = 0;
  
      // Calculate total cart amount and apply coupon discount
      cart.products.forEach(item => {
        const product = item.product;
        let highestDiscountPrice = product.price;
  
        if (product.offers && product.offers.length > 0) {
          product.offers.forEach(offer => {
            if (offer.status === true) {
              const discountAmount = (product.price * offer.discount) / 100;
              const discountedPrice = product.price - discountAmount;
  
              if (discountedPrice < highestDiscountPrice) {
                highestDiscountPrice = discountedPrice;
              }
            }
          });
        }

        totalCartAmount += highestDiscountPrice * item.quantity;
      });
  
      if (totalCartAmount < coupon.minPurchaseAmount) {
        return res.status(400).json({ message: `Minimum purchase amount for this coupon is ₹${coupon.minPurchaseAmount}.` });
      }
  
      // Apply coupon discount
      discountAmount = (totalCartAmount * coupon.discount) / 100;
      discountAmount = Math.min(discountAmount, coupon.maxDiscountAmount);
      totalCartAmount -= discountAmount;
      
      res.json({ 
        discountAmount:Math.floor( discountAmount.toFixed(2)), 
        totalCartAmount:Math.ceil(totalCartAmount.toFixed(2))
      });

    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error' });
    }

  };



module.exports = {
    load_coupon,
    add_coupon,
    edit_coupon,
    applyCoupon

}

