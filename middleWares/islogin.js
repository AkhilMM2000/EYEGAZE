
const User = require('../model/userModel')
const Cart = require('../model/cartModel')
const Wishlist = require('../model/wishlistModel')

async function verifyLogin(req, res, next) {
  try {
    if (req.session.userid) {
      const user = await User.findById(req.session.userid);
      if (user && user.is_blocked == 0) {
        return next();
      }
    }

    // User is not logged in or blocked
    // Store the URL they came from (Referer) in session so we can redirect them back after login
    const referer = req.get('Referer');
    if (referer) {
      req.session.returnTo = referer;
      console.log("verifyLogin: Storing returnTo =", referer);
    }

    // Check if the request is an AJAX/Fetch request (expects JSON)
    const isAjax = req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1) || req.headers['content-type'] === 'application/json';
    if (isAjax) {
      return res.status(401).json({ 
        success: false, 
        message: 'Please login to continue.', 
        redirectUrl: '/sign' 
      });
    }

    return res.redirect('/sign');
  } catch (error) {
    console.log("Error in verifyLogin middleware:", error);
    return res.redirect('/sign');
  }
}

async function verifyLogout(req, res, next) {
  try {
    if (req.session.userid) {
      const user = await User.findById(req.session.userid);
      if (user && user.is_blocked == 0) {
        return res.redirect('/home');
      }
    }
    return next();
  } catch (error) {
    console.log("Error in verifyLogout middleware:", error);
    return next();
  }
}


async function getCartCount(req, res, next) {
  try {
    if (req.session.userid) {
      const user = await User.findById(req.session.userid);
      if (user && user.is_blocked === 0) {
        res.locals.userdata = user;
        
        // Fetch Cart Count
        const cart = await Cart.findOne({ user: req.session.userid });
        res.locals.cartCount = cart ? cart.products.length : 0;

        // Fetch Wishlist Count
        const wishlist = await Wishlist.findOne({ user: req.session.userid });
        res.locals.wishlistCount = wishlist ? wishlist.products.length : 0;
        
      } else {
        res.locals.userdata = null;
        res.locals.cartCount = 0;
        res.locals.wishlistCount = 0;
      }
    } else {
      res.locals.userdata = null;
      res.locals.cartCount = 0;
      res.locals.wishlistCount = 0;
    }
    res.locals.currentPath = req.path;
    next();
  } catch (error) {
    console.log("Error in getCartCount middleware:", error);
    res.locals.cartCount = 0;
    res.locals.wishlistCount = 0;
    res.locals.userdata = null;
    next();
  }
}

module.exports = {
  verifyLogin,
  verifyLogout,
  getCartCount
}






