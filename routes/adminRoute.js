const express=require('express');
const admin_route=express();
const path=require('path')
const session=require('express-session')
const config = require('../config/config');
const multer=require('../multer/image')
const adminController=require('../controller/adminController')
const productController=require('../controller/productController')
const orderController=require('../controller/orderController')
const offerController=require('../controller/offerController')
const islogin=require('../middleWares/isAdmin')
const couponController=require('../controller/coupenController')
const nocache =require('nocache')
admin_route.use(session({
    secret: config.sessionSecretos,
    resave: false,
    saveUninitialized: false,
}));

admin_route.use(nocache())
// Middleware to parse JSON and urlencoded data
admin_route.use(express.json());
admin_route.use(express.urlencoded({ extended: true }));
admin_route.use(express.static(path.join(__dirname,'../public/admin')))

//admin login
admin_route.get('/',islogin.verifyLogout,adminController.sign)
admin_route.post('/',islogin.verifyLogout,adminController.verify_admin)


//-----------------------------------------------------------------------------------------------------------------====>
admin_route.get('/dashboard',islogin.verifyLogin,adminController.admhome)
admin_route.get('/users',islogin.verifyLogin,adminController.userlist)
admin_route.get('/users/block_user',islogin.verifyLogin,adminController.blockUser);
admin_route.get('/users/unblock_user',islogin.verifyLogin,adminController.unblockUser);

// category controller-----------------------------------------------------------------------------------------------------------------====>
admin_route.get('/category',islogin.verifyLogin,adminController.load_category)
admin_route.get('/addcategory',islogin.verifyLogin,adminController.get_addcategory)
admin_route.post('/addcategory',islogin.verifyLogin,adminController.addcategory)
admin_route.get("/category/list",islogin.verifyLogin,adminController.category_listed)
admin_route.get("/category/Unlist",islogin.verifyLogin,adminController.category_Unlisted)
admin_route.get('/category/editname',islogin.verifyLogin,adminController.edit_category)

//brand routes---------------------------------------------------------------------------------------------------------------------->
admin_route.get('/brand',islogin.verifyLogin,productController.load_brand)
admin_route.get('/brand/list',islogin.verifyLogin,productController.brand_listed)
admin_route.get('/brand/Unlist',islogin.verifyLogin,productController.brand_Unlisted)
admin_route.get('/addbrand',islogin.verifyLogin,productController.get_addbrand)
admin_route.post('/addbrand',islogin.verifyLogin,productController.add_brand)
admin_route.get('/brand/editname',islogin.verifyLogin,productController.brand_editname)
//product routes---------------------------------------------------------------------------------------------------------------------->
admin_route.get('/addproduct',islogin.verifyLogin,productController.load_product)
admin_route.post('/addproduct',islogin.verifyLogin,multer.array("productimage",3),productController.add_product)
admin_route.get('/products',islogin.verifyLogin,productController.listproduct)
admin_route.get('/products/list',islogin.verifyLogin,productController.list_item)
admin_route.get('/products/Unlist',islogin.verifyLogin, productController.Unlist_item)
admin_route.get('/editproduct',islogin.verifyLogin,productController.load_editproduct)
admin_route.patch('/editproduct',islogin.verifyLogin,multer.array("productimage",3),productController.update_product)

//order routes for admin
admin_route.get("/orders",islogin.verifyLogin,orderController.admin_orders)
admin_route.get("/detailorder",islogin.verifyLogin,orderController.view_order)
admin_route.patch('/detailorder',islogin.verifyLogin,orderController.update_order)
admin_route.patch('/accept_return',islogin.verifyLogin,orderController.return_accept)

//offer route for admin
admin_route.get('/offers',islogin.verifyLogin,offerController.get_addoffer)
admin_route.post("/add-offer",islogin.verifyLogin,offerController.add_offer)
admin_route.post("/category-offer",islogin.verifyLogin,offerController.category_offer)
admin_route.patch('/edit-offercategory/:offerId',islogin.verifyLogin,offerController.categoryoffer_edit)
admin_route.patch('/edit-productoffer/:offerId',islogin.verifyLogin,offerController.productoffer_edit)

//coupon route for admin
admin_route.get('/coupon',islogin.verifyLogin,couponController.load_coupon)
admin_route.post('/add-coupon',islogin.verifyLogin,couponController.add_coupon)
admin_route.put('/edit-coupon/:couponid',islogin.verifyLogin,couponController.edit_coupon)

// sales route for admin
admin_route.get('/sales',islogin.verifyLogin,orderController.load_sales)
admin_route.post('/sales', islogin.verifyLogin, orderController.pdf_download);
admin_route.post('/sales/excel',islogin.verifyLogin,orderController.excel_download)

admin_route.get('/logout',adminController.logout)

admin_route.get('*',function(req,res){
    res.redirect('/admin')
  })

  module.exports=admin_route