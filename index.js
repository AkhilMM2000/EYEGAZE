const mongoose=require('mongoose');
require('dotenv').config();
// mongoose.connect(process.env.DB,{    ssl: false});
mongoose.connect(process.env.DB, {
    useNewUrlParser: true,
    useUnifiedTopology: true,

}).then(() => {
    console.log('Connected to MongoDB');
}).catch((err) => {
    console.error('Error connecting to MongoDB:', err.message);
});
require('dotenv').config()

//require express module
const express=require('express');
const app=express();

//require path
const path=require('path')
//set view engine

app.set('views',express.static(path.join(__dirname,'views')));
app.set('view engine','ejs')
app.use(express.static(path.join(__dirname,'public')))


app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//for users route
const userRoute=require("./routes/userRoute")
app.use('/',userRoute)

//for users route
const adminRoute=require('./routes/adminRoute')
app.use('/admin',adminRoute)

//port for host
const port=process.env.port||3500

app.listen(port,()=>{
    console.log(`server running http://localhost:${port} `);
})

