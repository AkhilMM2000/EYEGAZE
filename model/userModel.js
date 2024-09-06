const mongoose=require("mongoose");
const userSchema = new mongoose.Schema({
      googleId : {
        type : String,
        required : false
    },
  userName: {
      type: String,
      required: true
    },
    userEmail: {
      type: String,
      required: true
    },
    mobileNo: {
      type: Number,
      required: false
    },
    password: {
      type: String,
      required: false
    },
    is_admin: {
      type: Number,
      default: 0
    },
    is_blocked: {
      type: Number,
      default: 0
    },
    usedCoupons: [
      {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Coupon'
      }
  ]
  
  });
  

module.exports = mongoose.model("costomer",userSchema)
