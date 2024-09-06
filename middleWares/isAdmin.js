
const User=require('../model/userModel')


async function verifyLogin(req, res, next) {
  
    if (req.session.admin) {
      
    } else {
     return  res.redirect('/admin');
    }
   return next();

  }

  function verifyLogout(req, res, next) {
    if (req.session.admin) {
     return res.redirect('/admin/dashboard'); // Redirect to the home page or dashboard
    } else {
     return  next();
    }
  }
  
  module.exports ={
    verifyLogin,
    verifyLogout
  }
  



  
  