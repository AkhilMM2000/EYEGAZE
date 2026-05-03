
const User = require('../model/userModel')
const Cart = require('../model/cartModel')

async function verifyLogin(req, res, next) {
  try {
    const user = await User.findById(req.session.userid);
    if (req.session.userid && user.is_blocked == 0) {
    } else {
      return res.redirect('/sign');
    }

    return next();
  } catch (error) {

    console.log(error);

  }

}



async function verifyLogout(req, res, next) {

  try {
    if (req.session.userid) {
      const user = await User.findById(req.session.userid);
      if (user.is_blocked == 0) {
        return res.redirect('/home');
      } else {
        return next();
      }
    } else {
      return next();
    }
  } catch (error) {
    console.log(error);

  }

}


async function getCartCount(req, res, next) {
  try {
    if (req.session.userid) {
      const user = await User.findById(req.session.userid);
      if (user && user.is_blocked === 0) {
        res.locals.userdata = user;
        const cart = await Cart.findOne({ user: req.session.userid });
        res.locals.cartCount = cart ? cart.products.length : 0;
      } else {
        res.locals.userdata = null;
        res.locals.cartCount = 0;
      }
    } else {
      res.locals.userdata = null;
      res.locals.cartCount = 0;
    }
    next();
  } catch (error) {
    console.log("Error in getCartCount middleware:", error);
    res.locals.cartCount = 0;
    res.locals.userdata = null;
    next();
  }
}

module.exports = {
  verifyLogin,
  verifyLogout,
  getCartCount
}






