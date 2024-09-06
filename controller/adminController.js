const User = require("../model/userModel")
const product = require('../model/productModel')
const bcrypt = require('bcrypt')
const category = require("../model/category")
const Order = require('../model/orderModel')
const Brand = require('../model/brandModel')



const sign = async (req, res) => {
    let data = ''
    try {

        res.render('admin/login', { data })
    } catch (error) {
        console.log(error);

    }
}
const verify_admin = async (req, res) => {
    try {
        const adminEmail = req.body.email;
        const password = req.body.password;
        const admin = await User.findOne({ userEmail: adminEmail });

        if (admin) {
            if (admin.is_admin === 1) {
                const isMatch = await bcrypt.compare(password, admin.password);
                if (isMatch) {
                    req.session.admin = admin._id
                    res.redirect('admin/dashboard');
                } else {
                    res.render('admin/login', { data: "Incorrect password" });
                }
            } else {
                res.render('admin/login', { data: "You are not the admin" });
            }
        } else {
            res.render('admin/login', { data: "Admin not found" });
        }
    } catch (error) {
        console.log(error);
        res.render('admin/login', { data: "An error occurred. Please try again." });
    }

}

//admin dashboard start here
const admhome = async (req, res) => {
    try {
        const { timeframe } = req.query;

        // Initialize the date range for filtering
        let startDate, endDate;
        const currentDate = new Date();

        if (timeframe === 'weekly') {
            startDate = new Date(currentDate.setDate(currentDate.getDate() - 7));
            endDate = new Date();
        } else if (timeframe === 'monthly') {
            startDate = new Date(currentDate.setMonth(currentDate.getMonth() - 1));
            endDate = new Date();
        } else {
            // Default to yearly
            startDate = new Date(currentDate.setFullYear(currentDate.getFullYear() - 1));
            endDate = new Date();
        }

        // Aggregate sales data
        const salesData = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lt: endDate }
                }
            },
            {
                $group: {
                    _id: {
                        $dateToString: {
                            format: timeframe === 'weekly' ? "%Y-%m-%d" : "%Y-%m",
                            date: "$orderDate"
                        }
                    },
                    totalSales: { $sum: "$totalAmount" }
                }
            },
            { $sort: { _id: 1 } }
        ]);


        const totalSales = salesData.reduce((sum, day) => sum + day.totalSales, 0);

        // Aggregate to find top 5 most-selling products
        const topProductsAgg = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lt: endDate }
                }
            },
            {
                $unwind: "$products" // Unwind the products array
            },
            {
                $group: {
                    _id: "$products.productId", // Group by product ID
                    totalSold: { $sum: "$products.quantity" } // Sum the quantity sold
                }
            },
            { $sort: { totalSold: -1 } }, // Sort by totalSold in descending order
            { $limit: 10 } // Limit to top 5 products
        ]);

        // Manually query the Product model to get product details
        const productIds = topProductsAgg.map(item => item._id);
        const products = await product.find({ _id: { $in: productIds } })
            .select('productName price category productBrand');

        // Merge product details with the aggregation result
        const topProducts = topProductsAgg.map(item => {
            const product = products.find(p => p._id.toString() === item._id.toString());
            return {
                productName: product.productName,
                price: product.price,
                totalSold: item.totalSold,
                category: product.category,
                productBrand: product.productBrand
            };
        });

        // Aggregate for best-selling categories
        const bestCategoriesAgg = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lt: endDate }
                }
            },
            {
                $unwind: "$products" // Unwind the products array
            },
            {
                $group: {
                    _id: "$products.productId", // Group by product ID
                    totalSold: { $sum: "$products.quantity" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            {
                $unwind: "$productDetails"
            },
            {
                $group: {
                    _id: "$productDetails.category", // Group by category
                    totalSold: { $sum: "$totalSold" }
                }
            },
            { $sort: { totalSold: -1 } }, // Sort by totalSold in descending order
            { $limit: 10 } // Limit to top 5 categories
        ]);

        // Aggregate for best-selling brands
        const bestBrandsAgg = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lt: endDate }
                }
            },
            {
                $unwind: "$products" // Unwind the products array
            },
            {
                $group: {
                    _id: "$products.productId", // Group by product ID
                    totalSold: { $sum: "$products.quantity" }
                }
            },
            {
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            {
                $unwind: "$productDetails"
            },
            {
                $group: {
                    _id: "$productDetails.productBrand", // Group by brand
                    totalSold: { $sum: "$totalSold" }
                }
            },
            { $sort: { totalSold: -1 } }, // Sort by totalSold in descending order
            { $limit: 5 } // Limit to top 5 brands
        ]);

        // Fetch category names using the bestCategoriesAgg IDs
        const categoryIds = bestCategoriesAgg.map(item => item._id);
        const categories = await category.find({ _id: { $in: categoryIds } })
            .select('categoryName');

        // Fetch brand names using the bestBrandsAgg IDs
        const brandIds = bestBrandsAgg.map(item => item._id);
        const brands = await Brand.find({ _id: { $in: brandIds } })
            .select('brandName');

        // Map the category and brand names to the aggregation results
        const bestCategories = bestCategoriesAgg.map(item => {
            const category = categories.find(c => c._id.toString() === item._id.toString());
            return {
                categoryName: category ? category.categoryName : 'Unknown',
                totalSold: item.totalSold
            };
        });

        const bestBrands = bestBrandsAgg.map(item => {
            const brand = brands.find(b => b._id.toString() === item._id.toString());
            return {
                brandName: brand ? brand.brandName : 'Unknown',
                totalSold: item.totalSold
            };
        });
        ///to show the status in dashboard 
        const orderStatusCounts = await Order.aggregate([
            {
                $match: {
                    orderDate: { $gte: startDate, $lt: endDate }
                }
            },
            {
                $unwind: "$products"  // Unwind the products array to consider each product's status
            },
            {
                $group: {
                    _id: "$products.status",
                    count: { $sum: 1 }
                }
            }
        ]);
        const statusData = {
            delivered: 0,
            cancelled: 0,
            returned: 0
        };

        orderStatusCounts.forEach(order => {
            if (order._id === 'Delivered') statusData.delivered = order.count;
            if (order._id === 'Cancelled') statusData.cancelled = order.count;
            if (order._id === 'Returned') statusData.returned = order.count;

        });


        const no_of_orders = await Order.countDocuments({
            orderDate: { $gte: startDate, $lt: endDate }
        });
      

        res.render('admin/dashboard', {
            salesData: JSON.stringify(salesData),
            totalSales,
            statusData,
            timeframe,
            topProducts,
            bestCategories,
            bestBrands,
            count: no_of_orders
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
};

///admin home  end here--------------------------------------------------------------------------------------------------


const userlist = async (req, res) => {
    try {

        const perPage = 5;
        const page = parseInt(req.query.page) || 1;

        const users = await User.find()
            .skip((perPage * page) - perPage)
            .limit(perPage);

        const count = await User.countDocuments();
        res.render('admin/userlist', {
            users, currentPage: page,
            totalPages: Math.ceil(count / perPage)
        })
    } catch (error) {
        console.log(error);
    }
}

const blockUser = async (req, res) => {
    try {
        const userId = req.query.id;
        const userData = await User.findByIdAndUpdate(userId, { is_blocked: 1 });
        if (userData) {
            res.status(200).json({ message: 'User blocked successfully' });
        } else {
            res.status(200).json({ message: "Couldn't block user" });
        }
    } catch (error) {
        res.send(error);
    }
};

const unblockUser = async (req, res) => {
    try {
        const userId = req.query.id;
        const userData = await User.findByIdAndUpdate(userId, { is_blocked: 0 });
        if (userData) {
            res.status(200).json({ message: 'User unblocked successfully' });
        } else {
            res.status(200).json({ message: "Couldn't unblock user" });
        }
    } catch (error) {
        res.send(error);
    }
};

const get_addcategory = async (req, res) => {
    try {

        res.render('admin/addcategory')
        res
    } catch (error) {
        console.log(error);
    }

}
const addcategory = async (req, res) => {
    try {
        const { categoryStatus } = req.body;

        let status;

        if (categoryStatus === "Listed") {
            status = true;
        } else {
            status = false;
        }
        const newName = req.body.categoryName.trim();

        // Check if the category already exists (case-insensitive)
        const existingCategory = await category.findOne({
            categoryName: { $regex: new RegExp('^' + newName + '$', 'i') }
        });
        console.log(existingCategory);
        if (existingCategory) {
            // If the category exists, redirect with an error message
            return res.status(201).redirect('/admin/addcategory?id=already_exist');
        }

        const data = new category({
            categoryName: newName, // assuming your schema has 'name' field for category name
            listed: status // assuming your schema has 'listed' field for status
        });

        const result = await data.save();
        res.status(201).redirect('/admin/category');
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: 'An error occurred', error });
    }
};


const load_category = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get current page from query params, default is 1
        const limit = 3; // Number of categories per page
        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        // Fetch categories with pagination
        const [categories, totalCategories] = await Promise.all([
            category.find().skip(skip).limit(limit),
            category.countDocuments() // Get total count of categories for pagination calculation
        ]);

        const totalPages = Math.ceil(totalCategories / limit); // Calculate total pages

        res.render('admin/category', {
            categories,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Server Error');
    }
}


const category_listed = async (req, res) => {
    try {
        const categoryid = req.query.id;
        const categorydata = await category.findByIdAndUpdate(categoryid, { listed: true });

        if (categorydata) {
            res.status(200).json({ message: 'category listed successfully' });
        } else {
            res.status(200).json({ message: "Couldn't unblock user" });
        }
    } catch (error) {
        res.send(error);
    }
};
const category_Unlisted = async (req, res) => {
    try {
        const categoryid = req.query.id;

        const categorydata = await category.findByIdAndUpdate(categoryid, { listed: false });


        if (categorydata) {
            res.status(200).json({ message: 'category Ulisted successfully' });
        } else {
            res.status(200).json({ message: "Couldn't Unlist the category" });
        }
    } catch (error) {
        res.send(error);
    }
}

const edit_category = async (req, res) => {
    try {
        const newName = req.query.catname;
        const categoryid = req.query.id;




        const existingCategory = await category.findOne({
            categoryName: { $regex: new RegExp('^' + newName + '$', 'i') }
        });

        if (existingCategory) {
            // Handle the case where the category name already exists
            return res.status(400).json({ message: 'Category name already exists.' });
        }

        // Update the category name
        const categorydata = await category.findByIdAndUpdate(
            categoryid,
            { categoryName: newName },

        );

        res.json({
            message: 'Category name successfully updated.',

        });
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).json({ message: 'An error occurred while updating the category.' });
    }
}


const logout = async (req, res) => {

    try {

        delete req.session.admin
        res.redirect('/admin')
    } catch (error) {
        console.log(error);

    }

}


module.exports = {
    sign,
    verify_admin,
    admhome,
    userlist,
    blockUser,
    unblockUser,
    load_category,
    get_addcategory,
    addcategory,
    edit_category,
    category_listed,
    category_Unlisted,
    logout
}


