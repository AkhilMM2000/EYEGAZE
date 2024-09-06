const express=require('express');
const user_route=express();
const session=require('express-session')
const config = require('../config/config');
const passport = require('passport');
const nocache =require('nocache')
const islogin=require('../middleWares/islogin')
const couponController=require('../controller/coupenController')

user_route.use(session({
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
  
}));

user_route.use(nocache())
// Middleware to parse JSON and urlencoded data
user_route.use(express.json());
user_route.use(express.urlencoded({ extended: true }));


const userController=require('../controller/userController')
const orderController=require('../controller/orderController')
const accountController=require('../controller/accountController')

user_route.get('/',islogin.verifyLogout,userController.loginhome)
user_route.get('/register',islogin.verifyLogout,userController.get_register)
user_route.post('/register',islogin.verifyLogout,userController.register_user)
user_route.get('/home',islogin.verifyLogin,userController.loginhome)
user_route.get('/sign',islogin.verifyLogout,userController.loadsign)

user_route.get('/otp',islogin.verifyLogout,userController.get_otp)

user_route.post('/otp',islogin.verifyLogout,userController.verify_otp)
user_route.post('/sign',islogin.verifyLogout,userController.verify_user)
user_route.post('/otp_resend',islogin.verifyLogout,userController.resendOTP)
user_route.get('/forgetpassword',islogin.verifyLogout,userController.forget_password)
user_route.patch('/forgetpassword',islogin.verifyLogout,userController.new_password)
user_route.patch('/savenewpassword',islogin.verifyLogout,userController.save_password)
//route for google authentication

// //google auth
user_route.get('/auth/google/callback',islogin.verifyLogout,passport.authenticate('google', { failureRedirect: '/sign' }),userController.googleSuccess);

user_route.get('/auth/google',islogin.verifyLogout,passport.authenticate('google', { scope: ['profile', 'email'] }));

//route for products......................................................................................................................>

user_route.get('/product',userController.load_product)
user_route.get('/productdetail/:id',userController.product_detail)

//route for cart.............................................................................................................................>
user_route.get('/cart',islogin.verifyLogin,userController.load_cart)
user_route.post('/cart/:productid/:count',islogin.verifyLogin,userController.add_cart)
user_route.post('/cart/update/:count/:productid',islogin.verifyLogin,userController.update_cart)
user_route.delete('/cart/delete/:productid',islogin.verifyLogin,userController.cart_remove)

//route for wishlist under
user_route.get('/whishlist',islogin.verifyLogin,userController.load_wishlist)
user_route.post('/wishlist/:productid',islogin.verifyLogin,userController.add_wishlist)
user_route.delete('/wishlist/delete/:productid',islogin.verifyLogin,userController.wishlist_remove)
user_route.post('/wishlist/addtocart/:productId',islogin.verifyLogin,userController.whishlist_addcart)

//route for order-------------------------------------------------------------------------------------------------------
user_route.get('/checkout',islogin.verifyLogin,orderController.load_checkout)
user_route.post('/place-order',islogin.verifyLogin,orderController.place_order)
user_route.post('/walletplace-order',islogin.verifyLogin,orderController.walletplace_order)
user_route.post('/retry-payment',islogin.verifyLogin,orderController.retry_payment)
user_route.post('/update-payment-status',islogin.verifyLogin,orderController.update_orderstatus)
user_route.get('/placeorder',islogin.verifyLogin,orderController.order_success)
user_route.post('/return-product',islogin.verifyLogin,orderController.return_request)
user_route.post('/order/invoice',islogin.verifyLogin,orderController.invoice_download)
// account controller below routes------------------------------------------------------------------------------------------------------->

//route for account adress
user_route.get('/address',islogin.verifyLogin,accountController.load_address)
user_route.post('/address',islogin.verifyLogin,accountController.add_address)
user_route.delete('/address/delete/:addressId',islogin.verifyLogin,accountController.delete_address)
user_route.patch('/address/edit/:id',islogin.verifyLogin,accountController.edit_address)

// route for  orders
user_route.get("/orders",islogin.verifyLogin,accountController.load_orders)
user_route.get('/detailorder',islogin.verifyLogin,accountController.order_details)
user_route.patch('/cancelorder',islogin.verifyLogin,accountController.cancel_order)

//route for wallet 
user_route.get('/wallet',islogin.verifyLogin,orderController.load_wallet)

// routes for myaccount
user_route.get('/myaccount',islogin.verifyLogin,userController.my_account)
user_route.patch('/password/change',islogin.verifyLogin,userController.change_password)
user_route.patch('/user/edit-profile',islogin.verifyLogin,userController.change_profile)
user_route.get('/logout',userController.logout)

//routes for coupon applying
user_route.post('/apply-coupon',islogin.verifyLogin,couponController.applyCoupon)

//404 error page render
user_route.get('/404',userController.not_found)

//about page render
user_route.get('/abouts',userController.abouts)

//render the contacts page 
user_route.get('/contacts',userController.contacts)

module.exports=user_route


 