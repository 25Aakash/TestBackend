# Wholesale Marketplace Backend API

B2B Wholesale Marketplace Backend built with Node.js, Express, and MongoDB.

## Features
- User Authentication (Wholesalers & Retailers)
- Product Management
- Order Management
- Connection Management (Wholesaler-Retailer relationships)
- Cart Management
- GST Verification
- Dynamic Categories

## Tech Stack
- Node.js
- Express.js
- MongoDB (Mongoose)
- JWT Authentication
- bcryptjs for password hashing

## Setup

### Prerequisites
- Node.js (v14 or higher)
- MongoDB Atlas account or local MongoDB

### Installation

1. Clone the repository
```bash
git clone <your-repo-url>
cd WholesaleMarketplace-backend
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file
```bash
cp .env.example .env
```

4. Update `.env` with your values
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

5. Start the server
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/signup-wholesaler` - Register wholesaler
- `POST /api/auth/signup-retailer` - Register retailer
- `POST /api/auth/login` - Login

### Products
- `GET /api/products` - Get all products
- `POST /api/products` - Create product (wholesaler only)
- `PUT /api/products/:id` - Update product
- `DELETE /api/products/:id` - Delete product

### Orders
- `GET /api/orders/my-orders` - Get retailer orders
- `GET /api/orders/received-orders` - Get wholesaler orders
- `POST /api/orders/place` - Place order
- `PUT /api/orders/:id/status` - Update order status
- `PUT /api/orders/:id/cancel` - Cancel order

### Connections
- `GET /api/connections` - Get connections
- `POST /api/connections/request` - Request connection
- `PUT /api/connections/:id/approve` - Approve connection
- `PUT /api/connections/:id/reject` - Reject connection

### Cart
- `GET /api/cart` - Get cart items
- `POST /api/cart` - Add to cart
- `PUT /api/cart/:id` - Update cart item
- `DELETE /api/cart/:id` - Remove from cart

### Categories
- `GET /api/categories` - Get all categories
- `POST /api/categories` - Create category

## Deployment

### Render.com (Recommended)

1. Push your code to GitHub
2. Go to [Render.com](https://render.com)
3. Create a new Web Service
4. Connect your GitHub repository
5. Set environment variables in Render dashboard
6. Deploy!

### Environment Variables to Set on Render
- `MONGODB_URI`
- `JWT_SECRET`

## License
ISC
