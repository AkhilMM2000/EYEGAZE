const mongoose = require('mongoose');

const  category= new mongoose.Schema({
   categoryName:{
    type : String,
    required : true
   },
   listed: {
    type : Boolean,
    required:true
}

})
module.exports = mongoose.model('category',category);
