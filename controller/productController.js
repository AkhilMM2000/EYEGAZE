const User = require("../model/userModel")
const product = require('../model/productModel')
const brand = require('../model/brandModel')
const mongoose = require('mongoose')
const category = require("../model/category")

const get_addbrand = async (req, res) => {
  try {

    res.render('admin/addbrand')

  } catch (error) {

    console.log(error);

  }

}

const add_brand = async (req, res) => {
  try {
    const { brandStatus } = req.body;

    let status;
    if (brandStatus === "Listed") {
      status = true;
    } else {
      status = false;
    }
    const newName = req.body.brandName.trim();

    // Check if the category already exists (case-insensitive)
    const existingBrand = await brand.findOne({
      brandName: { $regex: new RegExp('^' + newName + '$', 'i') }
    });
    console.log(existingBrand);
    if (existingBrand) {
      // If the category exists, redirect with an error message
      return res.status(201).redirect('/admin/addbrand?id=already_exist');
    }

    const data = new brand({
      brandName: newName,
      listed: status
    });

    const result = await data.save();
    res.status(201).redirect('/admin/brand');
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'An error occurred', error });
  }

}
const load_brand = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 3; // Number of brands per page
    const skip = (page - 1) * limit; // Calculate the number of documents to skip

    // Fetch brands with pagination
    const [brands, totalBrands] = await Promise.all([
      brand.find().skip(skip).limit(limit),
      brand.countDocuments() // Get total count of brands for pagination calculation
    ]);

    const totalPages = Math.ceil(totalBrands / limit); 

    res.render('admin/brandlist', { 
      brands, 
      currentPage: page, 
      totalPages: totalPages 
    });
  } catch (error) {
    console.log(error);
    res.status(500).send('Server Error');
  }
}

const brand_listed = async (req, res) => {
  try {
    const brandid = req.query.id;
    const branddata = await brand.findByIdAndUpdate(brandid, { listed: true });
    console.log(branddata);
    if (branddata) {
      res.status(200).json({ message: 'category listed successfully' });
    } else {
      res.status(200).json({ message: "Couldn't  list brand" });
    }
  } catch (error) {
    res.send(error);
  }
};
const brand_Unlisted = async (req, res) => {
  try {
    const brandid = req.query.id;
    const branddata = await brand.findByIdAndUpdate(brandid, { listed: false });
    console.log(branddata);
    if (branddata) {
      res.status(200).json({ message: 'category Unlisted successfully' });
    } else {
      res.status(200).json({ message: "Couldn't  Unlist brand" });
    }
  } catch (error) {
    res.send(error);
  }
};

const brand_editname = async (req, res) => {
  try {
    const brandid = req.query.id
    const newname = req.query.brandname
    const existingbrand = await brand.findOne({
      brandName: { $regex: new RegExp('^' + newname + '$', 'i') }
    });

    if (existingbrand) {
      // Handle the case where the category name already exists
      return res.status(400).json({ message: 'brand name already exists.' });
    }

    // Update the category name
    const branddata = await brand.findByIdAndUpdate(
      brandid,
      { brandName: newname },

    );

    res.json({
      message: 'Brand name successfully updated.',

    });

  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'An error occurred while updating the category.' });
  }
}




const load_product = async (req, res) => {
  try {
    const categorydata = await category.find({ listed: true })
    const brandata = await brand.find({ listed: true })


    res.render('admin/addproduct', { categorydata, brandata })

  } catch (error) {

    console.log(error);

  }

}

const add_product = async (req, res) => {
  try {
    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).send('No files were uploaded.');
    }
    const { listStatus } = req.body;
    const { quantity } = req.body;
    let total = parseInt(quantity)
    let status;

    if (listStatus === "listed") {
      status = true;
    } else {
      status = false;
    }
    // Map file paths
    const imagePaths = files.map(file => file.filename);
    const {
      productName,
      branded,
      description,
      price,

      gender,
      category

    } = req.body;
    console.log(branded);
    console.log(category);
    // Create new product document
    const newProduct = new product({
      productName,
      productimages: imagePaths,
      quantity,
      productBrand: branded,
      description,
      price,
      gender,
      category,
      listed: status,
      stock: total

    });

    // Insert the new product
    await newProduct.save();

    //  console.log(result);
    res.status(200).json({ message: 'Product uploaded successfully'});
  } catch (error) {

    res.status(500).json({ message: error.message });
  }
};


//  listproduct in the admin side in  table wise

const listproduct = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = 5; // 5 products per page
    const skip = (page - 1) * limit;

    const totalProducts = await product.countDocuments();
    const totalPages = Math.ceil(totalProducts / limit);
    const products = await product.find()
      .populate('productBrand', 'brandName')
      .populate('category', 'categoryName')
       .skip(skip)
       .limit(limit)

    res.render('admin/productlist', { products, currentPage: page,
      totalPages: totalPages })

  } catch (error) {
    console.log(error);

  }

}

const list_item = async (req, res) => {
  try {
    const productid = req.query.id;
    const productdata = await product.findByIdAndUpdate(productid, { listed: true });

    if (productdata) {
      res.status(200).json({ message: 'product listed successfully' });
    } else {
      res.status(200).json({ message: "Couldn't unlist the produts" });
    }
  } catch (error) {
    res.send(error);
  }



}


const Unlist_item = async (req, res) => {

  try {
    const productid = req.query.id;
    const productdata = await product.findByIdAndUpdate(productid, { listed: false });

    if (productdata) {
      res.status(200).json({ message: 'product Unlisted successfully' });
    } else {
      res.status(200).json({ message: "Couldn't unlist the produts" });
    }
  } catch (error) {
    res.send(error);
  }

}

const load_editproduct = async (req, res) => {
  try {
    const productid = req.query.id

    const productdata = await product.findById(productid).populate('category').populate('productBrand');
    const categories = await category.find();
    const brands = await brand.find();

    if (!productdata) {
      console.log("product not found here");
    }
    res.render('admin/editproduct', { productdata, categories, brands });

  } catch (error) {

    console.log(error);

  }
}
const update_product = async (req, res) => {
  try {
    const files = req.files;
    // if (!files || files.length === 0) {
    //   return res.status(400).json({ message: 'No files were uploaded.' });
    // }

    console.log(req.files,'this is the images for edit u got');
    
    const product_id = req.query.id
    const product_current=await product.findById(product_id)
 const current_imagearray=product_current.productimages

    console.log(current_imagearray);
    const { listStatus, quantity, productName, branded, description, price, gender, category } = req.body;

    let total = parseInt(quantity);
    let status;

    if (listStatus === "listed") {
      status = true;
    } else {
      status = false;
    }
    // Map file paths
    files.forEach(file => {
      current_imagearray.push(file.filename); // Add the new filename to the array
      if (current_imagearray.length > 3) {
         current_imagearray.shift(); // Remove the first element if the array length exceeds 3
      }
    });
  
    // Create updated product document
    const updatedProduct = {
      listed: status, stock: quantity, productName, productBrand: branded, description, price, gender, category, productimages: current_imagearray
    };
    const result = await product.findByIdAndUpdate(product_id, updatedProduct, { new: true });

    if (!result) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.status(200).json({
      message: 'Product updated successfully',
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message:"validation failed" });
  }
}

module.exports = {
  load_product,
  add_product,
  load_brand,
  get_addbrand,
  add_brand,
  brand_listed,
  brand_Unlisted,
  brand_editname,
  listproduct,
  list_item,
  Unlist_item,
  load_editproduct,
  update_product

}
