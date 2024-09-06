const User = require("../model/userModel")
const nodemailer = require('nodemailer');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require("bcrypt");
const product = require('../model/productModel')
const Cart = require('../model/cartModel')
const category = require('../model/category')
const brand = require('../model/brandModel')
const Wishlist = require('../model/wishlistModel')
const Wallet=require('../model/walletModal')

// Function to render the registration page
const get_register = async (req, res) => {
  try {
    res.render('users/register');
  } catch (error) {
    console.log(error);
    res.status(500).send('An error occurred while rendering the registration page.');
  }
};

// Function to hash a password securely
const securePassword = async (password) => {
  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    return passwordHash;
  } catch (error) {
    console.log(error.message);
    throw new Error('An error occurred while hashing the password.');
  }
};
// Set up the transporter using Gmail service and environment variables for authentication
const transporter = nodemailer.createTransport({
  service: 'Gmail',
  auth: {
    user: process.env.USER,
    pass: process.env.PASS
  }
});

// Function to generate a 4-digit OTP
function generateOTP() {
  const otp = Math.floor(1000 + Math.random() * 9000);
  return otp.toString();
}

// Function to send the OTP via email
async function sendOTPViaEmail(email, otp) {
  const mailOptions = {
    from: process.env.USER, // The email address you're sending from
    to: email,
    subject: 'Your OTP for registration',
    text: `Your OTP: ${otp}`
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error occurred while sending email:', error);
        reject(error);
      } else {
        console.log('Email sent:', info.response);
        resolve('OTP sent successfully.');
      }
    });
  });
}
const register_user = async (req, res) => {
  try {
    const existingUser = await User.findOne({ userName: req.body.userName });

    if (existingUser) {
      return res.status(400).json({ success: false, message: "Username already taken" });
    }

    const existingEmail = await User.findOne({ userEmail: req.body.userEmail });
    if (existingEmail) {
      return res.status(400).json({ success: false, message: "Email already in use" });
    }

    const { userName, userEmail, mobileNo, password } = req.body;
    const spassword = await securePassword(password);

    const otp = generateOTP();
    req.session.otp = otp;
    console.log(req.session.otp);

    req.session.user = {
      userName,
      userEmail,
      mobileNo,
      password: spassword,
      is_admin: 0
    };

    await sendOTPViaEmail(req.body.userEmail, otp);
    return res.status(200).json({ success: true, message: "OTP sent successfully", redirectUrl: "/otp" });

  } catch (error) {
    console.error(error.message);
    return res.status(500).json({ success: false, message: "An error occurred, please try again later" });
  }
};


const get_otp = async (req, res) => {
  try {

    if (!req.session.user) {
      res.redirect("/register")

    }
    res.render("users/otp")
  } catch (error) {
    console.log(error.message);
  }
}

const verify_otp = async (req, res) => {
  try {
    const { otp1, otp2, otp3, otp4 } = req.body;
    const otp = otp1 + otp2 + otp3 + otp4;

    const sessionOTP = req.session.otp;

    if (sessionOTP === otp) {
      req.session.otp = null;
      const userData = req.session.user;
      const user = new User(userData);
      user.isOTPVerified = true;
      await user.save();
      const userwallet = new Wallet({
        user_id: user._id, 
        balance: 0,
        transactions: [] 
      });
      await userwallet.save();
      req.session.user = null;

      return res.status(200).json({ success: true });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }

};


const resendOTP = async (req, res) => {
  try {
    const userData = req.session.user;
    if (!userData) {
      return res.render('users/register', { message: "Session expired, please register again" });
    }

    const newOTP = generateOTP();
    req.session.otp = newOTP;
    await sendOTPViaEmail(userData.userEmail, newOTP);

    res.redirect(`/otp`);
  } catch (error) {
    res.status(500).send(error.message);
  }
};
///currently work------------------------------------------------------------------------------------------------------------
async function passwordmail(email, link) {
  const mailOptions = {
    from: process.env.USER, // The email address you're sending from
    to: email,
    subject: 'Your link for reset password',
    text: `click this link reset your password: ${link}`
  };

  return new Promise((resolve, reject) => {
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error occurred while sending email:', error);
        reject(error);
      } else {
        console.log('Email sent:', info.response);
        resolve('link sent successfully.');
      }
    });
  });
}


const forget_password = async (req, res) => {
  try {
    res.render('users/forgott')
  } catch (error) {
    console.log(error);
  }
}

const new_password = async (req, res) => {
  try {
    const get_email = req.body.email;
    const link = `http://localhost:5000/forgetpassword`;
    const check_mail = await User.findOne({ userEmail: get_email });

    if (!check_mail) {
      return res.status(404).json({ success: false, message: "You are not registered" });
    }
    req.session.link = get_email
    await passwordmail(get_email, link);
    res.status(200).json({ success: true, message: "A link has been sent to your email. Please check it." });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};

const save_password = async (req, res) => {
  try {
    const { password } = req.body;
    const userdata = await User.findOne({ userEmail: req.session.link });

    if (!userdata) {
      return res.status(404).json({ success: false, message: "You are not registered" });
    }

    const isMatch = await bcrypt.compare(password, userdata.password);
    if (isMatch) {
      return res.status(400).json({ success: false, message: 'It is your old password' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Update the user's password
    userdata.password = hashedPassword;
    await userdata.save();

    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Failed to destroy session" });
      }
    })

    res.status(200).json({ success: true, message: "Successfully reset your password", redirect: `/sign` });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

///-------------------------------------------------------------------------------load home with lates product------------------------------------------
const loginhome = async (req, res) => {
  try {

    const userdata = await User.findById(req.session.userid)
    const latestProducts = await product.find({ listed: true }).sort({ Date: -1 }).limit(4).populate('category')
      .populate('productBrand')
      .populate('offers');

    latestProducts.forEach(prod => {
      if (prod.offers && prod.offers.length > 0) {
        let biggestDiscount = 0;
        let bestOffer = null;

        prod.offers.forEach(offer => {
          if (offer.status === true) {
            const discountAmount = Math.ceil((prod.price * offer.discount) / 100);
            if (offer.discount > biggestDiscount) {
              biggestDiscount = offer.discount;
              prod.discountPrice = prod.price - discountAmount;
              bestOffer = offer;
            }
          }
        });
        prod.bestOffer = bestOffer;
      } else {
        prod.discountPrice = prod.price;
      }
    });

    res.render('users/home', { userdata, products: latestProducts })

  } catch (error) {
    console.log(error.message)
  }
}

const loadsign = async (req, res) => {
  try {

    res.render('users/sign')

  } catch (error) {
    console.log(error.message)
  }

}

const verify_user = async (req, res) => {
  try {
    const userEmail = req.body.userEmail;
    const password = req.body.password;
    const userData = await User.findOne({ userEmail });
    if (userData) {
      const passwordMatch = await bcrypt.compare(password, userData.password);
      if (passwordMatch) {
        if (userData.is_blocked === 0) {

          req.session.userid = userData._id

          res.redirect('/home')
        } else {
          res.render('users/sign', { message: "User blocked" });
        }
      } else {
        res.render('users/sign', { message: "Incorrect Password" });
      }
    } else {
      res.render('users/sign', { message: "User not found" });
    }
  } catch (error) {
    res.send(error);
  }
}

//middleware function for google authentication
passport.use(new GoogleStrategy({
  clientID: process.env.clientID,
  clientSecret: process.env.clientSecret,
  callbackURL: process.env.callbackURL,
  passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ userEmail: profile.emails[0].value });

    if (!user) {
      user = new User({
        googleId: profile.id,
        userName: profile.displayName,
        userEmail: profile.emails[0].value,
        password: null,
        is_admin: 0

      });
      await user.save();
    }
    req.session.userid = user._id

    done(null, user);
  } catch (err) {
    console.error('Error in Google OAuth:', err);
    done(err);
  }
}));
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});


const googleSuccess = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.redirect('/sign');
    }
    if (req.user.is_blocked) {
      return res.render('users/sign', { message: 'User blocked' });
    }
    console.log(req.user);
    req.session.userid = req.user._id

    res.redirect('/home');
  } catch (error) {
    res.send(error);
  }
};

//product in shop page load below-------------------------------------------------------------
const load_product = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 6; // Number of products per page
    const skip = (page - 1) * limit;

    let sortOption = {};
    let selectedSort = req.query.sort || '';

    // Get filter parameters
    const categoryIds = req.query.categories ? (Array.isArray(req.query.categories) ? req.query.categories : [req.query.categories]) : [];
    const brandIds = req.query.brands ? (Array.isArray(req.query.brands) ? req.query.brands : [req.query.brands]) : [];
    const searchQuery = req.query.search || '';

    // Prepare filter object
    let filterObject = { listed: true };
    if (categoryIds.length > 0) {
      filterObject.category = { $in: categoryIds };
    }
    if (brandIds.length > 0) {
      filterObject.productBrand = { $in: brandIds };
    }
    if (searchQuery) {
      filterObject.productName = { $regex: searchQuery, $options: 'i' };
    }

    const categories = await category.find();
    const brands = await brand.find();

    const totalProducts = await product.countDocuments(filterObject);
    const totalPages = Math.ceil(totalProducts / limit);

    const product_data = await product.find(filterObject)
      .populate('category')
      .populate('productBrand')
      .populate('offers')
      .sort({ Date: -1 })
      .skip(skip)
      .limit(limit);

    product_data.forEach(prod => {
      if (prod.offers && prod.offers.length > 0) {
        let biggestDiscount = 0;
        let bestOffer = null;

        prod.offers.forEach(offer => {
          if (offer.status === true) {
            const discountAmount = Math.ceil((prod.price * offer.discount) / 100);
            if (offer.discount > biggestDiscount) {
              biggestDiscount = offer.discount;
              prod.discountPrice = prod.price - discountAmount;
              bestOffer = offer;
            }
          }
        });
        prod.bestOffer = bestOffer;
      } else {
        prod.discountPrice = prod.price;
      }
    });

    // Sort based on discountPrice instead of price
    if (selectedSort === 'low-high') {
      sortOption = { discountPrice: 1 };
    } else if (selectedSort === 'high-low') {
      sortOption = { discountPrice: -1 };
    } else if (selectedSort === 'name_asc') {
      sortOption = { productName: 1 };
    } else if (selectedSort === 'name_desc') {
      sortOption = { productName: -1 };
    }

    // Sort the product_data array after applying discountPrice
    product_data.sort((a, b) => {
      if (sortOption.discountPrice) {
        return sortOption.discountPrice * (a.discountPrice - b.discountPrice);
      } else if (sortOption.productName) {
        return sortOption.productName * a.productName.localeCompare(b.productName);
      }
      return 0;
    });

    const queryString = Object.entries(req.query)
      .filter(([key]) => key !== 'page')
      .map(([key, value]) => `&${key}=${value}`)
      .join('');

    res.render("users/products", {
      products: product_data,
      selectedSort,
      categories,
      brands,
      currentPage: page,
      totalPages,
      queryString,
      selectedCategories: categoryIds,
      selectedBrands: brandIds,
      searchQuery
    });

  } catch (error) {
    console.log(error);
    res.status(500).send("An error occurred while loading products");
  }
}



const product_detail = async (req, res) => {
  try {
    const product_id = await req.params.id
    const product_data = await product.findById(product_id).populate('category').populate('offers')
      .populate('productBrand');

    let highestDiscountPrice = product_data.price;

    if (product_data.offers && product_data.offers.length > 0) {
      let biggestDiscount = 0;

      product_data.offers.forEach(offer => {
        if (offer.status === true) {
          const discountAmount = (product_data.price * offer.discount) / 100;
          const discountedPrice = product_data.price - discountAmount;

          if (discountedPrice < highestDiscountPrice) {
            biggestDiscount = offer.discount;
            highestDiscountPrice = discountedPrice;
          }
        }
      });
    }

    // Set the highest discount price for rendering
    product_data.discountPrice = highestDiscountPrice;

    res.render("users/productdetail", { pro: product_data })
  } catch (error) {
    console.log(error);
  }
}

// cart controller....................................................................................................

const load_cart = async (req, res) => {
  const userId = req.session.userid;

  try {
    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'products.product',
      populate: [
        { path: 'offers' }, // Populate the offers for each product
        { path: 'category' },
        { path: 'productBrand' }
      ]
    });

    if (cart && cart.products.length > 0) {
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

        // Set the highest discount price to the cart item for rendering
        item.discountPrice = highestDiscountPrice;
      });
    }

    res.render('users/cart', { cart });
  } catch (error) {
    console.error(error);
    res.status(500).send('Server Error');
  }

}

const add_cart = async (req, res) => {

  try {
    const userId = req.session.userid
    const productId = req.params.productid
    const count = parseInt(req.params.count)

    if (!userId) {
      return res.redirect('/sign');
    }

    const productdata = await product.findById(productId);
    const existing_stock = productdata.stock
    if (!productdata) {
      return res.status(404).json({ message: 'Product not found' });
    }
    if (existing_stock < 1) {
      return res.status(404).json({ message: 'no stock left the product' });
    }

    let cart = await Cart.findOne({ user: userId });


    if (!cart) {
      cart = new Cart({ user: userId, products: [] });
    }


    // Find the product in the cart
    const productIndex = cart.products.findIndex(p => p.product.toString() === productId);

    if (productIndex > -1) {
      let count_add = count + cart.products[productIndex].quantity <= productdata.stock ? count : productdata.stock - cart.products[productIndex].quantity;
      cart.products[productIndex].quantity += count_add
    } else {
      let first_count = productdata.stock < count ? productdata.stock : count
      cart.products.push({ product: productId, quantity: first_count });
    }

    await cart.save();
    // Respond with success
    res.status(200).json({ message: 'Product added to cart' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server Error' });
  }

}

//update cart when i increase the quantity userside
const update_cart = async (req, res) => {

  try {
    const count = req.params.count;
    const productId = req.params.productid;
    const userId = req.session.userid;


    const newQuantity = Math.min(Math.max(parseInt(count), 1), 5);

    const cart = await Cart.findOne({ user: userId });

    if (cart) {
      const productIndex = cart.products.findIndex(p => p.product.toString() === productId);

      if (productIndex > -1) {
        cart.products[productIndex].quantity = newQuantity;
      } else {

        return res.status(404).json({ success: false, message: 'Product not found in cart' });
      }

      await cart.save();
      res.json({ success: true, message: 'Cart updated successfully' });
    } else {
      res.status(404).json({ success: false, message: 'Cart not found' });
    }
  } catch (error) {
    console.error('Error updating cart:', error);
    res.status(500).json({ success: false, message: 'Failed to update cart', error: error.message });
  }
}

//remove product from cart
const cart_remove = async (req, res) => {
  try {
    const product = req.params.productid
    const userId = req.session.userid;
    const cart = await Cart.findOne({ user: userId });

    if (cart) {

      const productIndex = cart.products.findIndex(item => item.product.toString() === product);

      if (productIndex > -1) {

        cart.products.splice(productIndex, 1);
        await cart.save();
        res.json({ success: true, message: 'Product removed from cart' });
      } else {
        res.status(404).json({ success: false, message: 'Product not found in cart' });
      }
    } else {
      res.status(404).json({ success: false, message: 'Cart not found' });
    }
  } catch (error) {
    console.error('Error removing product from cart:', error);
    res.status(500).json({ success: false, message: 'Failed to remove product from cart', error: error.message });
  }
}


const my_account = async (req, res) => {
  try {
    const userdata = await User.findOne({ _id: req.session.userid })
    console.log(userdata);
    res.render('users/myAccount', { user: userdata })
  } catch (error) {
    console.log(error);
  }

}

//function for change password in the userprofile............................

const change_password = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.session.userid;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Old password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error in changePassword:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }

}
const change_profile = async (req, res) => {
  try {
    const { username, mobile } = req.body;
    const userId = req.session.userid; // Assuming you have user info in the request after authentication

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Update user fields
    user.userName = username;
    user.mobileNo = mobile;
    // Save the updated user
    await user.save();
    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error in editProfile:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }

}

const logout = async (req, res) => {
  try {

    delete req.session.userid
    res.redirect('/')
  } catch (error) {
    console.log(error);

  }

}

const load_wishlist = async (req, res) => {

  try {
    const userId = req.session.userid;
    const whishlist = await Wishlist.findOne({ user: userId }).populate({
      path: 'products.product',
      match: { listed: true },
      populate: [
        { path: 'offers' }, // Populate the offers for each product

      ]
    });

    if (whishlist && whishlist.products.length > 0) {
      whishlist.products.forEach(item => {
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
        // Set the highest discount price to the cart item for rendering
        item.discountPrice = highestDiscountPrice;
      });
    }

    res.render('users/wishlist', { whishlist })


  } catch (error) {
    console.log(error);

  }

}


const add_wishlist = async (req, res) => {
  try {
    const userId = req.session.userid; // Assuming user ID is stored in session
    const productId = req.params.productid; // Assuming productId is passed as a URL parameter


    // Find the product by its ID
    const productData = await product.findById(productId);
    if (!productData) {
      return res.json({ success: false, message: 'Product not found' });
    }

    // Find the wishlist for the current user
    let wishlist = await Wishlist.findOne({ user: userId });
    if (!wishlist) {
      // If no wishlist exists for the user, create a new one
      wishlist = new Wishlist({
        user: userId,
        products: [{ product: productId }] // Add the product object with the correct schema structure
      });
    } else {
      // Check if the product is already in the wishlist
      const productExists = wishlist.products.some(item => item.product.equals(productId));

      if (productExists) {
        return res.json({ success: true, message: 'Product already in wishlist' });
      }

      // Add the product to the wishlist
      wishlist.products.push({ product: productId }); // Add as an object according to your schema
    }

    // Save the updated wishlist
    await wishlist.save();

    // Respond with success
    res.json({ success: true, message: 'Product added to wishlist' });

  } catch (error) {
    console.error('Error adding product to wishlist:', error);
    res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
  }
};

//remove wishlist -----------------------------------------
const wishlist_remove = async (req, res) => {
  try {
    const productId = req.params.productid;
    const userId = req.session.userid;
    const wishlist = await Wishlist.findOne({ user: userId });
    if (wishlist) {
      // Find the index of the product in the wishlist
      const productIndex = wishlist.products.findIndex(item => item.product.toString() === productId);
      if (productIndex > -1) {
        // Remove the product from the wishlist
        wishlist.products.splice(productIndex, 1);
        await wishlist.save();
        res.json({ success: true, message: 'Product removed from wishlist' });
      } else {
        res.status(404).json({ success: false, message: 'Product not found in wishlist' });
      }
    } else {
      res.status(404).json({ success: false, message: 'Wishlist not found' });
    }
  } catch (error) {
    console.error('Error removing product from wishlist:', error);
    res.status(500).json({ success: false, message: 'Failed to remove product from wishlist', error: error.message });
  }
}

const whishlist_addcart = async (req, res) => {
  try {
    const productId = req.params.productId;
    const userId = req.session.userid;
    const cart = await Cart.findOne({ user: userId });
    const wishlist = await Wishlist.findOne({ user: userId });

    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }

    // Check if the product is already in the cart
    const productInCart = cart.products.find(item => item.product.toString() === productId);

    if (productInCart) {
      return res.json({ message: 'Product already in cart' });
    }

    // Add the product to the cart
    cart.products.push({ product: productId, quantity: 1 }); // Assuming default quantity is 1
    await cart.save();

    // Optionally, remove the product from the wishlist after adding to the cart
    const productIndex = wishlist.products.findIndex(item => item.product.toString() === productId);
    if (productIndex > -1) {
      wishlist.products.splice(productIndex, 1);
      await wishlist.save();
    }

    res.json({ message: 'Product added to cart' });

  } catch (error) {
    console.error('Error adding product to cart:', error);
    res.status(500).json({ message: 'Failed to add product to cart', error: error.message });
  }

}


const not_found = async (req, res) => {
  try {
    res.render('users/404error')
  } catch (error) {
    console.log(error);

  }


}
//render abouts page
const abouts =async (req, res) => {
  try {
    res.render('users/about')
  } catch (error) {
    console.log(error);

  }
}

const contacts=async(req,res)=>{
try {
  res.render('users/contacts')
} catch (error) {
  console.log(error);
  
}

}

module.exports = {
  loginhome,
  get_register,
  register_user,
  get_otp,
  loadsign,
  verify_otp,
  verify_otp,
  verify_user,
  resendOTP,
  googleSuccess,
  load_product,
  product_detail,
  load_cart,
  add_cart,
  update_cart,
  cart_remove,
  load_wishlist,
  add_wishlist,
  whishlist_addcart,
  wishlist_remove,
  my_account,
  change_password,
  change_profile,
  forget_password,
  new_password,
  save_password,
  not_found,
  abouts,
  contacts,
  logout
}


