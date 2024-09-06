const User = require("../model/userModel")
const nodemailer = require('nodemailer');
const passport = require('passport');
const product = require('../model/productModel')
const Cart = require('../model/cartModel')
const Address = require('../model/addressModel')
const Orders = require('../model/orderModel')
const Razorpay = require('razorpay')
const userwallet = require('../model/walletModal')
const Coupon = require('../model/coupenModel')
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const fs = require('fs');
const path = require('path');

const load_checkout = async (req, res) => {

  try {

    const coupon_data = await Coupon.find({

      expirationDate: { $gt: new Date() },
      status: true // Only coupons with status set to true
    });


    const addres_data = await Address.find({ user_id: req.session.userid })
    const userId = req.session.userid;
    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'products.product',
      populate: [
        { path: 'offers' }

      ]
    });

    if (cart && cart.products.length > 0) {
      let totalCartAmount = 0; // Initialize the total amount

      cart.products.forEach(item => {
        const product = item.product;

        let highestDiscountPrice = product.price; // Default to normal price

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
        item.discountPrice = highestDiscountPrice;
        totalCartAmount += highestDiscountPrice * item.quantity;
      });

      
      res.render('users/checkout', { address: addres_data, totalCartAmount, cart, coupon: coupon_data })
    }
  } catch (error) {

    console.log(error);

  }
}

function generateOrderId() {
  return 'ORD' + Date.now() + Math.random().toString(27).substr(2, 5).toUpperCase();
}

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
//place order start here--------------------------------------------------------------------------------------place order--------------------------------

const place_order = async (req, res) => {
  try {
    const { paymentMethod, addressId, coupon, razorpay_order_id, razorpay_payment_id, couponDiscountPercentage, couponDiscountAmount } = req.body;
    const userId = req.session.userid;

    console.log('your payment method is', paymentMethod);


    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'products.product',
      populate: [{ path: 'offers' }]
    });

    if (!cart || cart.products.length === 0) {
      return res.json({ success: false, message: 'Your cart is empty' });
    }

    const address = await Address.findById(addressId);
    if (!address) {
      return res.json({ success: false, message: 'Invalid address selected' });
    }

    let totalAmount = 0;
    let discountAmount = 0;
    let discountPercentage = null;
    let couponApplied = null;

    const productsWithDiscounts = cart.products.map(item => {
      const product = item.product;
      let highestDiscountPrice = product.price;

      if (product.offers && product.offers.length > 0) {
        product.offers.forEach(offer => {
          const discount = (product.price * offer.discount) / 100;
          const discountedPrice = product.price - discount;

          if (discountedPrice < highestDiscountPrice) {
            highestDiscountPrice = discountedPrice;
          }
        });
      }

      totalAmount += highestDiscountPrice * item.quantity;

      return {
        productId: product._id,
        quantity: item.quantity,
        price: highestDiscountPrice,
        status: 'Pending'
      };
    });

    if (coupon) {
      const foundCoupon = await Coupon.findOne({ code: coupon });
      console.log('your coupon is', foundCoupon);

      if (foundCoupon && foundCoupon.status) {
        if (totalAmount >= foundCoupon.minPurchaseAmount) {
          discountAmount = Math.floor((totalAmount * foundCoupon.discount) / 100);
          discountAmount = Math.min(discountAmount, foundCoupon.maxDiscountAmount);
          totalAmount -= discountAmount;
          discountPercentage = foundCoupon.discount;
          couponApplied = foundCoupon._id;
        } else {
          return res.status(400).json({ success: false, message: `Minimum purchase amount for this coupon is ₹${foundCoupon.minPurchaseAmount}.` });
        }
      }

    }

    if (paymentMethod === 'razorpay' && !razorpay_order_id) {
      const options = {
        amount: totalAmount * 100,
        currency: "INR",
        receipt: "receipt_" + Math.random().toString(36).substr(2, 9),
        payment_capture: 1
      };

      const razorpayOrder = await razorpayInstance.orders.create(options);

      if (!razorpayOrder) {
        console.log("Failed to create Razorpay order");

        return res.status(500).json({ success: false, message: "Failed to create Razorpay order" });
      }

      console.log('you discountamounta nd persontage is', discountAmount, discountPercentage);

      return res.json({
        success: true,
        key_id: process.env.RAZORPAY_KEY_ID,
        order_id: razorpayOrder.id,
        amount: razorpayOrder.amount,
        currency: razorpayOrder.currency,
        discountPercentage: discountPercentage,
        discountAmount: discountAmount,
        couponApplied: couponApplied
      });
    }

    console.log('req.body next time', req.body);



    let paymentStatus;
    if (paymentMethod == 'cod') {
      paymentStatus = 'Success'
    }

    if (paymentMethod === 'razorpay' && razorpay_payment_id) {
      paymentStatus = 'Success';
      discountAmount = req.body.couponDiscountAmount
      discountPercentage = req.body.couponDiscountPercentage

    } else if (paymentMethod === 'razorpay' && !razorpay_payment_id) {
      paymentStatus = 'Failed';
      discountAmount = req.body.couponDiscountAmount
      discountPercentage = req.body.couponDiscountPercentage
    }

    const newOrder = new Orders({
      userId: userId,
      orderId: generateOrderId(),
      paymentMethod: paymentMethod,
      address: address,
      products: productsWithDiscounts,
      totalAmount: totalAmount,
      discountAmount: discountAmount,
      discountPercentage: discountPercentage,
      razorpay_id: razorpay_payment_id,
      orderDate: new Date(),
      paymentStatus: paymentStatus
    });
    console.log(newOrder);

    await newOrder.save();

    if (paymentStatus === 'Success') {

      for (const item of cart.products) {
        await product.findByIdAndUpdate(
          item.product._id,
          { $inc: { stock: -item.quantity } }, // Decrease the stock by item.quantity
          { new: true } // Returns the updated document
        );
      }

      if (couponApplied) {
        const user = await User.findById(userId);
        user.usedCoupons.push(couponApplied);
        await user.save();
      }

      await Cart.findOneAndUpdate({ user: userId }, { $set: { products: [] } });


      res.json({ success: true, message: 'Order placed successfully', redirect: `/placeorder?id=${newOrder.orderId}` });
    } else {

      for (const item of cart.products) {
        await product.findByIdAndUpdate(
          item.product._id,
          { $inc: { stock: -item.quantity } }, // Decrease the stock by item.quantity
          { new: true } // Returns the updated document
        );
      }

      if (couponApplied) {
        const user = await User.findById(userId);
        user.usedCoupons.push(couponApplied);
        await user.save();
      }

      await Cart.findOneAndUpdate({ user: userId }, { $set: { products: [] } });
      res.json({ success: true, message: 'Payment failed. Order saved with failed status.', redirect: `/orders` });
    }

  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, message: 'An error occurred while placing the order' });
  }
};

////place order end here--------------------------------------------------------------------------------place order end here----------------------

//place order using wallet amount-------------------------------------------------------------------------wallet payment start here

const walletplace_order=async(req,res)=>{
  try {
    const userId = req.session.userid;
    const { paymentMethod, addressId, coupon } = req.body;

    // Fetch the user's cart
    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'products.product',
      populate: [{ path: 'offers' }]
    });

    if (!cart || cart.products.length === 0) {
      return res.json({ success: false, message: 'Your cart is empty' });
    }

    const foundCoupon = await Coupon.findOne({ code: coupon });
    if(foundCoupon){
    const user = await User.findById(userId);
  
    
    // Check if the coupon has already been used by the user
    const usedCoupon = user.usedCoupons.some(item => item.equals(foundCoupon._id));
    
    if (usedCoupon) {
      return res.json({ success: false, message: 'Coupon already used' });
    }
  }

    // Fetch the selected address
    const address = await Address.findById(addressId);
    if (!address) {
      return res.json({ success: false, message: 'Invalid address selected' });
    }

    let totalAmount = 0;
    let discountAmount = 0;
    let discountPercentage = null;
    let couponApplied = null;

    // Calculate total amount with applicable discounts
    const productsWithDiscounts = cart.products.map(item => {
      const product = item.product;
      let highestDiscountPrice = product.price;

      if (product.offers && product.offers.length > 0) {
        product.offers.forEach(offer => {
          const discount = (product.price * offer.discount) / 100;
          const discountedPrice = product.price - discount;

          if (discountedPrice < highestDiscountPrice) {
            highestDiscountPrice = discountedPrice;
          }
        });
      }

      totalAmount += highestDiscountPrice * item.quantity;

      return {
        productId: product._id,
        quantity: item.quantity,
        price: highestDiscountPrice,
        status: 'Pending'
      };
    });

    // Apply coupon if available
    if (coupon) {
      const foundCoupon = await Coupon.findOne({ code: coupon });

      if (foundCoupon && foundCoupon.status) {
        if (totalAmount >= foundCoupon.minPurchaseAmount) {
          discountAmount = Math.floor((totalAmount * foundCoupon.discount) / 100);
          discountAmount = Math.min(discountAmount, foundCoupon.maxDiscountAmount);
          totalAmount -= discountAmount;
          discountPercentage = foundCoupon.discount;
          couponApplied = foundCoupon._id;
        } else {
          return res.status(400).json({ success: false, message: `Minimum purchase amount for this coupon is ₹${foundCoupon.minPurchaseAmount}.` });
        }
      }
    }

    // If payment method is wallet, check the wallet balance
    
   const wallet = await userwallet.findOne({ user_id: userId });

if (!wallet) {
  return res.json({ success: false, message: 'Wallet not found' });
}

if (wallet.balance < totalAmount) {
  return res.json({ success: false, message: 'Insufficient wallet balance' });
}

// Deduct the total amount from the wallet balance
wallet.balance -= totalAmount;

// Add a debit transaction record
wallet.transactions.push({
  amount: totalAmount,
  description: 'Order Payment',
  type: 'debit' // This indicates that this is a debit transaction
});

// Save the wallet with the updated balance and transaction
await wallet.save();
    // Save the order
    const newOrder = new Orders({
      userId: userId,
      orderId:  generateOrderId(),
      paymentMethod: paymentMethod,
      address: address,
      products: productsWithDiscounts,
      totalAmount: totalAmount+discountAmount,
      discountAmount: discountAmount,
      discountPercentage: discountPercentage,
      orderDate: new Date(),
      paymentStatus:'Success'
    });

    await newOrder.save();

    // Update product stock
    for (const item of cart.products) {
      await product.findByIdAndUpdate(
        item.product._id,
        { $inc: { stock: -item.quantity } }, // Decrease the stock by item.quantity
        { new: true } // Returns the updated document
      );
    }

    // If a coupon was applied, add it to the user's used coupons
    if (couponApplied) {
      const user = await User.findById(userId);
      user.usedCoupons.push(couponApplied);
      await user.save();
    }

    // Clear the user's cart after the order is placed
    await Cart.findOneAndUpdate({ user: userId }, { $set: { products: [] } });

    // Send success response
    return res.json({ success: true, message: 'Order placed successfully', orderId: newOrder.orderId });

  } catch (error) {
    console.error('Error placing order:', error);
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again later.' });
  }

}


////retry_payment start here-----------------------------------------------------------------------------------------------------------
const retry_payment = async (req, res) => {
  try {
    const { orderId } = req.body;
    // Fetch order details and calculate amount, etc.
    const order = await Orders.find({
      orderId
    })
    const totalamount = (order[0].totalAmount - order[0].discountAmount) * 100

    const options = {
      amount: totalamount, // Example amount, should be fetched from order details
      currency: "INR",
      receipt: orderId,
      payment_capture: 1
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);
    res.json({
      success: true,
      key_id: process.env.RAZORPAY_KEY_ID,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      order_id: razorpayOrder.id
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    res.json({ success: false, message: 'Error creating Razorpay order.' });
  }

}

const update_orderstatus = async (req, res) => {
  try {
    const { orderId, paymentMethod, razorpay_payment_id, razorpay_order_id } = req.body;
    // Update order status based on payment confirmation
    console.log('success of payment status change', req.body);

    const order = await Orders.findOne({ orderId });
    if (order) {
      order.paymentStatus = 'Success';
      order.razorpay_id = razorpay_payment_id;
      await order.save();
      res.json({ success: true, orderId });
    } else {
      res.json({ success: false, message: 'Order not found.' });
    }
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.json({ success: false, message: 'Error updating payment status.' });
  }

}
//retry payment end here---------------------------------------------------------------------------------
const order_success = async (req, res) => {
  try {
    const orderid = req.query.id
    const order_data = await Orders.find({ orderId: orderid }).populate("products.productId")

    let b = order_data[0]
    // order_data.forEach(item => {
    b.products.forEach(an => {
      // console.log(an.productId.productName);

    })
    // })
    const addressdata = order_data[0].address;
    // console.log(order_data[0].orderId,order_data[0].orderDate);
    res.render('users/orderplaced', { order: order_data[0], addressdata })
  } catch (error) {
    console.log(error);
  }
}

//for admin orders-------------------------------------------------------------------------------------------------------------->
const admin_orders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Get the current page from query params
    const limit = 7;
    const skip = (page - 1) * limit;

    // Fetch total count of orders
    const totalOrders = await Orders.countDocuments({
      paymentStatus: "Success"
    });

    // Fetch orders with pagination
    // const orders = await Orders.find()
    //     .sort({ orderDate: -1 }) // Sort by creation date, newest first
    //     .skip(skip)
    //     .limit(limit);

    const totalPages = Math.ceil(totalOrders / limit);
    const order = await Orders.find({
      paymentStatus: "Success"
    })
      .populate('userId')
      .populate('products.productId')
      .sort({ orderDate: -1 }) // Sort by creation date, newest first
      .skip(skip)
      .limit(limit);

    res.render('admin/userorder', {
      order,
      currentPage: page,
      totalPages,
    })

  } catch (error) {
    console.log(error);
  }

}

const view_order = async (req, res) => {
  try {
    const order = req.query.orderID
    const orderdata = await Orders.find({ orderId: order }).populate('products.productId')
    let b = orderdata[0]
    res.render('admin/userdetailorder', { orderdata })

  } catch (error) {
    console.log(error);
  }

}

const update_order = async (req, res) => {
  try {
    const { status, productid, orderID } = req.body
    const order = await Orders.findOne({ orderId: orderID });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const productIndex = order.products.findIndex(p => p._id.toString() === productid);
   
    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: 'Product not found in this order' });
    }


    order.products[productIndex].status = status;

    await order.save();

    res.json({ success: true, message: 'Order status updated successfully' });
  } catch (error) {
    console.error('Error updating product status:', error);
    res.status(500).json({ success: false, message: 'An error occurred while updating the status' });
  }

}

///for get wallet----------------------------
const load_wallet = async (req, res) => {
  try {
    const userId = req.session.userid;
    const page = parseInt(req.query.page) || 1; // Current page, default is 1
    const limit = parseInt(req.query.limit) || 5; // Transactions per page, default is 5

    // Fetch the user's wallet
    const wallet = await userwallet.findOne({ user_id: userId });

    wallet.transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    if (!wallet) {
      return res.render('users/wallet', { wallet: null, transactions: [], currentPage: page, totalPages: 0 });
    }

    // Total transactions
    const totalTransactions = wallet.transactions.length;
    const totalPages = Math.ceil(totalTransactions / limit); // Calculate total pages
    const startIndex = (page - 1) * limit; // Starting index for slicing
    const endIndex = page * limit; // Ending index for slicing

    // Slice transactions for the current page
    const paginatedTransactions = wallet.transactions.slice(startIndex, endIndex);

    // Render the wallet page with the paginated transactions
    res.render('users/wallet', {
      wallet,
      transactions: paginatedTransactions,
      currentPage: page,
      totalPages
    });
  } catch (error) {
    console.log(error);
  }
};


//return the order------------------------------------------------------------>
const return_request = async (req, res) => {

  try {
    const { reason, order, product } = req.body;

    console.log(reason, order, product);

    const orderdata = await Orders.findOne({
      orderId: order
    });

    if (!orderdata) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const productIndex = orderdata.products.findIndex(p => p.productId.toString() === product);

    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: 'Product not found in order' });
    }

    orderdata.products[productIndex].return_request = true;
    orderdata.products[productIndex].return_reason = reason;


    await orderdata.save();

    res.json({ success: true, message: 'Return request processed successfully' });
  } catch (error) {
    console.error('Error processing return request:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }

}
//admin accept return request
const return_accept = async (req, res) => {
  try {
    const { order, productid } = req.body;

    const orderdata = await Orders.findOne({
      orderId: order
    });

   
    
    
    if (!orderdata) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const productdata = await product.findOne({
      _id: productid
    });

    if (!productdata) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const user_id = orderdata.userId;

    const productIndex = orderdata.products.findIndex(p => p.productId.toString() === productid);

    if (productIndex === -1) {
      return res.status(404).json({ success: false, message: 'Product not found in order' });
    }


    // Update the product status and return request status
    orderdata.products[productIndex].return_request = false;
    orderdata.products[productIndex].status = 'Returned';

    const quantity = orderdata.products[productIndex].quantity;
    const totalAmount = orderdata.products[productIndex].price * quantity;

    // Update the product stock
    await product.updateOne(
      { _id: productid },
      { $inc: { stock: quantity } }
    );

    // Calculate the refund amount
    let refundAmount = totalAmount;

    if (orderdata.discountAmount && orderdata.discountAmount !== 0) {
      const discountPercentage = (orderdata.discountAmount * 100) / orderdata.totalAmount;
      refundAmount = totalAmount - Math.round(totalAmount * (discountPercentage / 100));
    }

    // Check if the user already has a wallet
    let wallet = await userwallet.findOne({ user_id: user_id });


    if (!wallet) {
      wallet = new userwallet({
        user_id: user_id,
        balance: refundAmount,
        transactions: [{
          amount: refundAmount,
          description:'Order returned',
          type:'credit'
        }]
      });
    } else {
      wallet.balance += refundAmount;
      wallet.transactions.push({
        amount: refundAmount,
       description:'Order returned',
          type:'credit'
      });
    }
    // Save the wallet and order data
    await wallet.save();

    await orderdata.save();

    res.json({ success: true });
  } catch (error) {
    console.error('Error processing return:', error);
    res.json({ success: false, error: error.message });
  }
}


//get the sales report page here----------------------------------------------------------------
const load_sales = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3;
    const skip = (page - 1) * limit;
    const filter = req.query.filter || 'monthly';
    // Construct the query string for pagination links, excluding the 'page' parameter
    const queryString = Object.entries(req.query)
      .filter(([key]) => key !== 'page')
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    let dateFilter = {};
    if (filter === 'custom') {
      const startDate = new Date(req.query.startDate);
      let endDate = new Date(req.query.endDate);

      // Adjust endDate to include the full day
      endDate.setHours(23, 59, 59, 999);

      if (startDate && endDate) {
        dateFilter = {
          orderDate: {
            $gte: startDate,
            $lte: endDate
          }
        };
      }
    } else {
      const now = new Date();
      if (filter === 'daily') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = { orderDate: { $gte: startOfDay } };
      } else if (filter === 'weekly') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = { orderDate: { $gte: startOfWeek } };
      } else if (filter === 'monthly') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { orderDate: { $gte: startOfMonth } };
      }
    }

    const orders = await Orders.find(dateFilter)
      .populate('products.productId')
      .skip(skip)
      .limit(limit)
      .lean();
    let totalAmount = 0
    let totalDiscount = 0
    orders.forEach(order => {
      totalAmount += order.totalAmount;
      totalDiscount += order.discountAmount || 0;
    });

    const totalOrders = await Orders.countDocuments(dateFilter);

    res.render('admin/salesreport', {
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      selectedFilter: filter,
      totalOrders,
      totalAmount,
      totalDiscount,
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      queryString: queryString ? `&${queryString}` : ''
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("An error occurred while loading the sales report.");
  }
};

////download the sales report as pdf form using pdfkit 

const pdf_download = async (req, res) => {
  try {
    const filter = req.body.filter || 'monthly';
    let dateFilter = {};

    if (filter === 'custom') {
      const startDate = new Date(req.body.startDate);
      let endDate = new Date(req.body.endDate);
      endDate.setHours(23, 59, 59, 999);
      dateFilter = { orderDate: { $gte: startDate, $lte: endDate } };
    } else {
      const now = new Date();
      if (filter === 'daily') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = { orderDate: { $gte: startOfDay } };
      } else if (filter === 'weekly') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = { orderDate: { $gte: startOfWeek } };
      } else if (filter === 'monthly') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { orderDate: { $gte: startOfMonth } };
      }
    }

    const orders = await Orders.find(dateFilter)
      .populate('products.productId')
      .lean();
      const doc = new PDFDocument({ margin: 30, size: 'A4' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');
      doc.pipe(res);
      
      let totalOrders = orders.length;
      let totalAmount = 0;
      let totalDiscount = 0;
      
      orders.forEach(order => {
        totalAmount += order.totalAmount;
        totalDiscount += order.discountAmount || 0;
      });
      
      // Add report title and summary
      doc.fontSize(18).text('Sales Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Total Orders: ${totalOrders}`);
      doc.text(`Total Amount: RS:${totalAmount.toFixed(2)}`);
      doc.text(`Total Discount: RS:${totalDiscount.toFixed(2)}`);
      doc.moveDown(2);
      
      // Define table layout
      const table = {
        x: 50,
        y: doc.y,
        width: 500,
        rowHeight: 20,
        columnWidths: [100, 73, 120, 70, 70, 70],
        headers: ['Order ID', 'Date', 'Product', 'Quantity', 'Price', 'Total']
      };
      
      // Function to draw table lines
      function drawTableLines(startY, endY) {
        doc.lineWidth(1);
        // Vertical lines
        table.columnWidths.reduce((x, width) => {
          doc.moveTo(x, startY).lineTo(x, endY).stroke();
          return x + width;
        }, table.x);
        doc.moveTo(table.x + table.width, startY).lineTo(table.x + table.width, endY).stroke();
        // Horizontal line
        doc.moveTo(table.x, endY).lineTo(table.x + table.width, endY).stroke();
      }
      
      // Draw table headers
      doc.font('Helvetica-Bold');
      table.headers.forEach((header, i) => {
        doc.text(header, 
          table.x + table.columnWidths.slice(0, i).reduce((sum, w) => sum + w, 0) + 5,
          table.y + 5,
          { width: table.columnWidths[i] - 10, align: 'left' }
        );
      });
      
      // Draw header line
      doc.y += table.rowHeight;
      drawTableLines(table.y, doc.y);
      
      // Reset font
      doc.font('Helvetica');
      
      // Function to add a row to the table
      function addRow(cells) {
        const startY = doc.y;
        const maxLines = Math.max(...cells.map(cell => doc.heightOfString(cell, { width: table.columnWidths[2] - 10 }))) / table.rowHeight;
        const rowHeight = Math.max(1, Math.ceil(maxLines)) * table.rowHeight;
      
        cells.forEach((cell, i) => {
          doc.text(cell, 
            table.x + table.columnWidths.slice(0, i).reduce((sum, w) => sum + w, 0) + 5,
            startY + 5,
            { 
              width: table.columnWidths[i] - 10, 
              align: i >= 3 ? 'right' : 'left',
              height: rowHeight - 5
            }
          );
        });
      
        doc.y = startY + rowHeight;
        drawTableLines(startY, doc.y);
      
        if (doc.y > 700) { // Start a new page if near the bottom
          doc.addPage();
          doc.y = 50;
          drawTableLines(doc.y - table.rowHeight, doc.y);
        }
      }
      
      // Add table rows with grouped products
      orders.forEach(order => {
        const productNames = order.products.map(product => product.productId.productName).join('\n');
        const quantities = order.products.map(product => product.quantity).join('\n');
        const prices = order.products.map(product => `RS:${product.productId.price.toFixed()}`).join('\n');
        const productTotal = order.products.reduce((total, product) => total + (product.quantity * product.productId.price), 0);
      
        addRow([
          order.orderId,
          order.orderDate.toISOString().split('T')[0],
          productNames,
          quantities,
          prices,
          `RS:${productTotal.toFixed()}`
        ]);
      });
      
      doc.end();
      
  } catch (error) {
    console.log(error);
    res.status(500).send("An error occurred while generating the PDF report.");
  }
};


const excel_download = async (req, res) => {
  try {
    const filter = req.body.filter || 'monthly';
    let dateFilter = {};

    if (filter === 'custom') {
      const startDate = new Date(req.body.startDate);
      let endDate = new Date(req.body.endDate);
      endDate.setHours(23, 59, 59, 999);
      dateFilter = { orderDate: { $gte: startDate, $lte: endDate } };
    } else {
      const now = new Date();
      if (filter === 'daily') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        dateFilter = { orderDate: { $gte: startOfDay } };
      } else if (filter === 'weekly') {
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        dateFilter = { orderDate: { $gte: startOfWeek } };
      } else if (filter === 'monthly') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { orderDate: { $gte: startOfMonth } };
      }
    }

    const orders = await Orders.find(dateFilter)
      .populate('products.productId')
      .lean();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    // Add headers
    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Product', key: 'product', width: 30 },
      { header: 'Price', key: 'price', width: 15 },
      { header: 'Total', key: 'total', width: 15 },
      { header: 'Discount', key: 'discount', width: 15 }
    ];

    let totalOrders = orders.length;
    let totalAmount = 0;
    let totalDiscount = 0;

    orders.forEach(order => {
      let discountAdded = false;

      order.products.forEach(product => {
        const productNameWithQuantity = `${product.productId.productName} (${product.quantity})`;
        const productTotal = product.quantity * product.productId.price;

        totalAmount += productTotal;
        if (!discountAdded) {
          totalDiscount += order.discountAmount || 0;
          discountAdded = true;
        }

        worksheet.addRow({
          orderId: order.orderId,
          date: order.orderDate.toISOString().split('T')[0],
          product: productNameWithQuantity,
          price: product.productId.price.toFixed(2),
          total: productTotal.toFixed(2),
          discount: discountAdded ? (order.discountAmount || 0).toFixed(2) : ''
        });
      });
    });

    // Add summary row
    worksheet.addRow([]);
    worksheet.addRow({
      product: `totalOrders:${totalOrders}`,
      total: totalAmount.toFixed(2),

      discount: totalDiscount.toFixed(2)
    });

    // Adjust the cell style (optional)
    worksheet.getRow(1).font = { bold: true };

    // Send the Excel file as a response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.log(error);
    res.status(500).send("An error occurred while generating the Excel report.");
  }
};


/////////////////////////////////////////////////////////////////////////////invoice download for order in the user
const invoice_download = async (req, res) => {
  const { orderId, productId } = req.body;

  try {
    // Fetch the order from the database
    const order = await Orders.findOne({orderId:orderId}).populate('products.productId');

    // Find the specific product in the order
    const product = order.products.find(p => p.productId._id.toString() === productId);

    if (!product) {
      return res.status(404).json({ error: 'Product not found in order' });
    }
    
    // Generate a random invoice number
    const invoiceNumber = `INV-${Math.floor(Math.random() * 1000000)}`;
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
  
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${invoiceNumber}.pdf`);
    doc.pipe(res);
  
    // Header
   // Header
doc
.fontSize(24)
.font('Helvetica-Bold')
.fillColor('#2c3e50')
.text('EYEGAZE', { align: 'center' });

doc
.fontSize(10)
.font('Helvetica')
.fillColor('#7f8c8d')
.text('Iron Street, Kochi, Kerala 679333', { align: 'center' })
.moveDown(0.5)
.text('Phone:9001 9001 28 | Email: eyegaze@gmail.com', { align: 'center' });

doc.moveDown(1.5);

// Decorative line
doc
.moveTo(50, doc.y)
.lineTo(550, doc.y)
.strokeColor('#34495e')
.lineWidth(1)
.stroke();

doc.moveDown(2);

// Invoice title
doc
.fontSize(18)
.font('Helvetica-Bold')
.fillColor('#e74c3c')
.text('INVOICE', { align: 'center', underline: true });

doc.moveDown(1.5);

// Invoice details
doc
.fontSize(12)
.font('Helvetica-Bold')
.fillColor('#2c3e50')
.text(`Invoice Number: ${invoiceNumber}`, { align: 'right' })
.moveDown(0.5)
.text(`Order Date: ${order.orderDate.toDateString()}`, { align: 'right' })
.moveDown(0.5)
.text(`Payment Status: ${order.paymentStatus}`, { align: 'right' });

doc.moveDown(2);

// Decorative line below details
doc
.moveTo(60, doc.y)
.lineTo(550, doc.y)
.strokeColor('#34495e')
.lineWidth(1)
.stroke();

doc.moveDown(-7.3);

  
    // Bill To section
    doc.fontSize(10).text('Bill To:', { bold: true });
    const billToInfo = [
      order.address.addressName,
      order.address.addressHouse,
      order.address.addressStreet,
      `${order.address.addressPost}, ${order.address.addressCity}`,
      `${order.address.addressDistrict}, ${order.address.addressState}`,
      `PIN: ${order.address.addressPin}`,
      `Phone: ${order.address.addressMobile}`,
      `Email: ${order.address.addressEmail}`
    ];
    billToInfo.forEach(line => doc.text(line));
  
    doc.moveDown(4); // Adjust spacing before the table
  
    // Table
    const tableTop = 330; // Adjust the position of the table
    const tableHeaders = ['Product', 'Quantity', 'Unit Price', 'Total'];
    const tableWidths = [250, 100, 100, 100];
  
    // Table header
    doc.font('Helvetica-Bold').fillColor('blue'); // Set color for the header
    tableHeaders.forEach((header, i) => {
      doc.text(header, 50 + tableWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop);
    });
  
    // Table content
    doc.font('Helvetica').fillColor('black'); // Reset color for the content
    const tableRow = [
      product.productId.productName,
      product.quantity.toString(),
      product.price.toFixed(2),
      (product.quantity * product.price).toFixed(2)
    ];
  
    tableRow.forEach((cell, i) => {
      doc.text(cell, 50 + tableWidths.slice(0, i).reduce((a, b) => a + b, 0), tableTop + 25);
    });
  
    // Table lines
    doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();
    doc.moveTo(50, tableTop + 45).lineTo(550, tableTop + 45).stroke();
  
    // Total
    doc.moveDown(4);
    doc.fontSize(12).text(`Total: ${  (product.quantity * product.price).toFixed(2)}`, { align: 'right' });
  
    // Footer
    doc.fontSize(10).text('Thank you for your business!', 50, 700, { align: 'center' });
  
    doc.end();

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}


module.exports = {
  load_checkout,
  place_order,
  walletplace_order,
  retry_payment,
  update_orderstatus,
  order_success,
  admin_orders,
  view_order,
  update_order,
  load_wallet,
  return_request,
  return_accept,
  load_sales,
  pdf_download,
  excel_download,
  invoice_download
}



