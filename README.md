# Quiz App - Production-Ready Architecture

A full-stack quiz application with modern architecture, security features, and professional UI.

## Features

### Backend Features
- **MVC Architecture** - Clean separation of concerns with controllers, models, routes
- **JWT Authentication** - Access tokens with refresh token mechanism
- **Role-Based Authorization** - User, Moderator, Admin roles
- **Input Validation** - Server-side validation with express-validator
- **Security Headers** - Helmet.js for secure HTTP headers
- **Rate Limiting** - Protection against brute-force attacks
- **Account Locking** - Auto-lock after 5 failed login attempts
- **Password Strength** - Minimum 8 chars with uppercase, lowercase, number
- **MongoDB Optimization** - Proper indexing and aggregation pipelines

### Frontend Features
- **React Router** - Protected routes with auth context
- **Token Refresh** - Automatic token refresh on expiry
- **Loading States** - Spinners and skeleton screens
- **Error Handling** - User-friendly error messages
- **Quiz Timer** - Countdown timer per question
- **Categories & Difficulty** - Filter questions by category/difficulty
- **Leaderboard** - Paginated leaderboard with filters
- **Quiz History** - Personal quiz history with stats
- **Admin Dashboard** - Analytics, user/question management

## Project Structure

```
backend/
├── src/
│   ├── config/           # Configuration files
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth, admin, error handling
│   ├── models/          # Mongoose schemas
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   ├── validators/      # Input validation
│   └── server.js        # Entry point

frontend/
├── src/
│   ├── components/     # Reusable components
│   ├── context/        # Auth context
│   ├── pages/          # Page components
│   ├── services/       # API service
│   └── App.jsx         # Main app with routing
```

## Security Improvements

| Issue | Before | After |
|-------|--------|-------|
| JWT | 1h expiry, no refresh | 15m access + 7d refresh tokens |
| Password | Min 4 chars | 8+ chars, uppercase, lowercase, number |
| Brute Force | None | Rate limiting + account locking |
| Headers | None | Helmet.js |
| Answer Leakage | Full question data | correctAnswer excluded |
| SQL Injection | None | Parameterized queries (Mongoose) |
| XSS | None | Input sanitization |

## Setup Instructions

### Prerequisites
- Node.js 16+
- MongoDB Atlas account

### Backend Setup
```bash
cd backend
npm install
# Update .env with your values
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

**Backend (.env)**
```env
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret_min_32_chars
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh-token` - Refresh tokens
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Questions
- `GET /api/questions` - Get random questions
- `GET /api/questions/categories` - Get categories
- `POST /api/questions` - Add question (admin)
- `PUT /api/questions/:id` - Update question
- `DELETE /api/questions/:id` - Delete question

### Scores
- `POST /api/scores` - Submit score
- `GET /api/scores/leaderboard` - Get leaderboard
- `GET /api/scores/history` - Get user history
- `GET /api/scores/stats` - Get user stats

### Admin
- `GET /api/admin/dashboard` - Dashboard stats
- `GET /api/admin/users` - Manage users
- `GET /api/admin/questions` - Manage questions

## Deployment Checklist

- [ ] Update JWT secrets in production
- [ ] Set NODE_ENV=production
- [ ] Configure MongoDB connection string
- [ ] Set up CORS for production domain
- [ ] Enable HTTPS/SSL
- [ ] Set up environment variables in deployment platform
- [ ] Configure rate limiting for production
- [ ] Set up monitoring (Sentry, LogRocket)
- [ ] Configure database backups
- [ ] Test all API endpoints
- [ ] Verify frontend build works

## License

ISC
