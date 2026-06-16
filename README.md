# EYEGAZE — Premium E-Commerce Platform

EYEGAZE is a high-performance, full-stack e-commerce engine designed to deliver a seamless shopping experience for users and a robust management suite for administrators. Built using Node.js, Express, and MongoDB, the system emphasizes clean architecture, database optimization, and secure transactional flows.

---

## 🛠️ Tech Stack & Architecture

*   **Runtime Environment**: Node.js
*   **Backend Framework**: Express.js
*   **Database & ODM**: MongoDB with Mongoose ODM
*   **Templating Engine**: EJS (Embedded JavaScript) with Vanilla CSS
*   **Authentication & OAuth**: Passport.js (Local & Google OAuth 2.0)
*   **Payment Gateway**: Razorpay API Integration
*   **Document & Report Engines**: PDFKit (PDF generation) & ExcelJS (Excel exports)
*   **UI Components & Modals**: SweetAlert2 (Dynamic client-side notifications)

---

## 🚀 Key Engineering & Performance Highlights

This project implements advanced backend design patterns and database optimizations to guarantee scalability, security, and low latency:

### 1. Database Indexing Strategy
Without indexes, MongoDB performs full collection scans to satisfy queries. As datasets grow, search operations degrade to $O(N)$ time complexity. To prevent this, indexes were applied to fields queried during high-frequency operations:
*   **`userEmail` (Unique Index)**: Fast-tracks authentication lookup on login/sign-up.
*   **`listed`, `category`, `productBrand`, and `Date`**: Optimizes shop page filtering and sorting (sorting by newest products), changing lookups from linear scans to $O(\log N)$ tree lookups.
*   **`userId` and `orderDate`**: Speeds up admin sales reports and user order history fetches.

### 2. Query Parallelization via `Promise.all()`
In standard Express controllers, independent queries are often awaited sequentially, creating a cumulative blocking latency. By refactoring these into parallel execution groups using `Promise.all()`, the server sends queries to MongoDB concurrently:
*   **Admin Dashboard (`admhome`)**: Reduced database roundtrips from **11 sequential steps to just 2 parallel rounds** (one round for independent data aggregations/counts, and a second round for dependent detail fetches). This cut page load time on the dashboard by over 60%.
*   **Shop Catalog (`load_product`)**: Parallelized category list, brand list, product counts, and paginated product fetches.

### 3. Session Restoration in Google OAuth Callback
Passport.js v0.6.0+ regenerates the session ID during authentication (`req.logIn()`) to protect against session fixation attacks. This process wipes custom session data, such as the `returnTo` URL (used to redirect a user back to the product details page they were looking at before logging in).
*   **Solution**: Implemented a custom pre-authentication middleware on the `/auth/google/callback` route to intercept and cache the target URL in `res.locals.keepReturnTo` (which persists through the request lifecycle). Once Passport completes authentication, the target URL is restored to the new session in `googleSuccess`, ensuring a seamless redirection flow.

### 4. Graceful AJAX Authentication & Redirects
Standard HTTP `302 Redirect` responses sent from server-side middleware fail to redirect the browser when called inside asynchronous AJAX fetches (such as adding an item to the cart or wishlist). Instead, the browser's fetch API follows the redirect in the background, leading to a silent failure.
*   **Solution**: Updated authentication middleware to detect AJAX/Fetch requests. If unauthorized, the server responds with a structured `401 Unauthorized` JSON payload containing the redirect target. The client-side scripts catch this status code, show a user-friendly SweetAlert notification, and change `window.location.href` on the frontend.

### 5. Transactional Integrity & Refund Calculations
*   **Stock Lock**: System automatically decrements stock when payments succeed and increments stock when orders are canceled or payment transactions fail.
*   **Partial Return Refund Logic**: When an admin accepts a product return from a multi-product order where a coupon was applied, the system dynamically calculates the partial discount percentage applied to that specific item. It deducts the relative discount from the item's original price and automatically credits the exact net refund to the user's custom in-app Wallet.

---

## 📦 Key System Features

### 🛒 User Features
*   **Authentication & Profiles**: Secure registration with password hashing (Bcrypt), Google OAuth integration, profile management, and multi-address book.
*   **Shopping Flow**: Sorting (price, alphabetical), filtering (categories, brands), and fuzzy text search.
*   **Interactive Cart & Wishlist**: Real-time stock status validation, and quantity capping.
*   **Checkout & Payments**: Integrated Razorpay API for card/UPI payments, COD, and a custom **Wallet System** supporting payments, debit transactions, and automatic return refunds.
*   **Order & Return Management**: Real-time order status tracking, payment retry options for failed gateway processes, and return request submissions with reason fields.

### 👑 Admin Suite
*   **Dashboard & Analytics**: Daily, weekly, monthly, and custom-range sales data aggregation, order counts, status breakdowns, and lists of top-performing products, categories, and brands.
*   **Product & Inventory Control**: CRUD operations for products (supporting multi-image uploads via Multer), categories, and brands, featuring clean catalog list/unlist controls.
*   **Promotion Engine**: Coupon creator (min purchase amounts, max discount caps) and Offer builder (supporting category-wide or product-specific discounts).
*   **Sales Reports Engine**: On-demand sales report generator exporting formatted PDF documents (using PDFKit) and spreadsheet reports (using ExcelJS).

---

## 📂 Project Directory Structure

```text
EYEGAZE/
├── config/             # DB & authentication configuration
├── controller/         # Request handling & business logic (User, Product, Order, Admin)
├── middleWares/        # Authentication, role access, and request interceptors
├── model/              # MongoDB Mongoose Schemas (User, Product, Order, Cart, Wallet, Coupon)
├── multer/             # File upload configuration for product images
├── public/             # Static assets (stylesheets, client JS, images)
├── routes/             # Route declarations (User routes, Admin routes)
├── views/              # EJS template templates (organized by panels)
├── index.js            # Express application entrypoint
└── package.json        # Project metadata and dependencies
```

---

## ⚡ Getting Started & Installation

### Prerequisites
*   Node.js (v16.x or higher)
*   MongoDB Instance (Local or Atlas)
*   Google Developer Console account (for Google OAuth credentials)
*   Razorpay Dashboard account (for payment APIs)

### Setup Instructions

1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/AkhilMM2000/EYEGAZE.git
    cd EYEGAZE
    ```

2.  **Install Dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory and define the following variables:
    ```env
    PORT=5000
    DB=mongodb://localhost:27017/eyegaze
    sessionSecretos=your_session_secret
    RAZORPAY_KEY_ID=your_razorpay_key_id
    RAZORPAY_KEY_SECRET=your_razorpay_key_secret
    GOOGLE_CLIENT_ID=your_google_client_id
    GOOGLE_CLIENT_SECRET=your_google_client_secret
    ```

4.  **Run the Application**:
    ```bash
    # Dev mode (with nodemon)
    npm start
    ```
    Open your browser and navigate to `http://localhost:5000`.
