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
        } else if (timeframe === 'all') {
            startDate = new Date(0); // Beginning of time
            endDate = new Date();
        } else {
            // Default to yearly
            startDate = new Date(currentDate.setFullYear(currentDate.getFullYear() - 1));
            endDate = new Date();
        }

        // Run all independent queries in parallel (Round 1)
        const [
            salesData,
            topProductsAgg,
            bestCategoriesAgg,
            bestBrandsAgg,
            orderStatusCounts,
            no_of_orders,
            totalUsers,
            totalProductsCount
        ] = await Promise.all([
            // 1. Aggregate sales data
            Order.aggregate([
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
            ]),
            // 2. Aggregate to find top 10 most-selling products
            Order.aggregate([
                {
                    $match: {
                        orderDate: { $gte: startDate, $lt: endDate }
                    }
                },
                {
                    $unwind: "$products"
                },
                {
                    $group: {
                        _id: "$products.productId",
                        totalSold: { $sum: "$products.quantity" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 }
            ]),
            // 3. Aggregate for best-selling categories
            Order.aggregate([
                {
                    $match: {
                        orderDate: { $gte: startDate, $lt: endDate }
                    }
                },
                {
                    $unwind: "$products"
                },
                {
                    $group: {
                        _id: "$products.productId",
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
                        _id: "$productDetails.category",
                        totalSold: { $sum: "$totalSold" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 10 }
            ]),
            // 4. Aggregate for best-selling brands
            Order.aggregate([
                {
                    $match: {
                        orderDate: { $gte: startDate, $lt: endDate }
                    }
                },
                {
                    $unwind: "$products"
                },
                {
                    $group: {
                        _id: "$products.productId",
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
                        _id: "$productDetails.productBrand",
                        totalSold: { $sum: "$totalSold" }
                    }
                },
                { $sort: { totalSold: -1 } },
                { $limit: 5 }
            ]),
            // 5. Aggregate order status counts
            Order.aggregate([
                {
                    $match: {
                        orderDate: { $gte: startDate, $lt: endDate }
                    }
                },
                {
                    $unwind: "$products"
                },
                {
                    $group: {
                        _id: "$products.status",
                        count: { $sum: 1 }
                    }
                }
            ]),
            // 6. Count number of orders
            Order.countDocuments({
                orderDate: { $gte: startDate, $lt: endDate }
            }),
            // 7. Count total users
            User.countDocuments({ is_admin: 0 }),
            // 8. Count total products
            product.countDocuments()
        ]);

        const totalSales = salesData.reduce((sum, day) => sum + day.totalSales, 0);

        // Map IDs for dependent lookup queries
        const productIds = topProductsAgg.map(item => item._id);
        const categoryIds = bestCategoriesAgg.map(item => item._id);
        const brandIds = bestBrandsAgg.map(item => item._id);

        // Run all dependent detail queries in parallel (Round 2)
        const [products, categories, brands] = await Promise.all([
            product.find({ _id: { $in: productIds } }).select('productName price category productBrand'),
            category.find({ _id: { $in: categoryIds } }).select('categoryName'),
            Brand.find({ _id: { $in: brandIds } }).select('brandName')
        ]);

        // Merge product details with the aggregation result
        const topProducts = topProductsAgg.map(item => {
            const prod = products.find(p => p._id.toString() === item._id.toString());
            return {
                productName: prod ? prod.productName : 'Unknown',
                price: prod ? prod.price : 0,
                totalSold: item.totalSold,
                category: prod ? prod.category : null,
                productBrand: prod ? prod.productBrand : null
            };
        });

        // Map the category and brand names to the aggregation results
        const bestCategories = bestCategoriesAgg.map(item => {
            const cat = categories.find(c => c._id.toString() === item._id.toString());
            return {
                categoryName: cat ? cat.categoryName : 'Unknown',
                totalSold: item.totalSold
            };
        });

        const bestBrands = bestBrandsAgg.map(item => {
            const br = brands.find(b => b._id.toString() === item._id.toString());
            return {
                brandName: br ? br.brandName : 'Unknown',
                totalSold: item.totalSold
            };
        });

        const statusData = {};
        orderStatusCounts.forEach(order => {
            statusData[order._id] = order.count;
        });

        const averageOrderValue = no_of_orders > 0 ? (totalSales / no_of_orders) : 0;

        res.render('admin/dashboard', {
            salesData: JSON.stringify(salesData),
            totalSales,
            statusData,
            timeframe,
            topProducts,
            bestCategories,
            bestBrands,
            count: no_of_orders,
            totalUsers,
            totalProductsCount,
            averageOrderValue
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


