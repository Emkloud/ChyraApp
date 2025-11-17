# ChyraApp Backend

> Real-time messaging backend API built with Node.js, Express, MongoDB, and Socket.IO

## 🚀 Features

- ✅ User authentication with JWT
- ✅ Real-time messaging with Socket.IO
- ✅ Group chats and 1-on-1 conversations
- ✅ Message reactions and replies
- ✅ Read receipts and delivery status
- ✅ File uploads to AWS S3
- ✅ User presence (online/offline)
- ✅ Typing indicators
- ✅ Security best practices (Helmet, CORS, Rate limiting)
- ✅ Input validation
- ✅ Error handling
- ✅ Logging with Winston

## 📋 Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MongoDB (local) OR MongoDB Atlas (cloud)
- AWS Account (optional - for S3 file uploads)

## 🛠️ Installation

### 1. Clone or Download

Download the backend folder to your computer.

### 2. Install Dependencies

```bash
cd backend
npm install
```

### 3. Configure Environment

Create `.env` file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/chyraapp

# JWT
JWT_SECRET=your_super_secret_jwt_key_32_characters_min
JWT_REFRESH_SECRET=your_refresh_secret_key_32_characters_min
JWT_EXPIRES_IN=7d

# AWS (optional)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=chyraapp-uploads

# Frontend
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

### 4. Start Server

Development:
```bash
npm run dev
```

Production:
```bash
npm start
```

Server will run on: `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── src/
│   ├── models/           # MongoDB models
│   │   ├── User.js
│   │   ├── Conversation.js
│   │   └── Message.js
│   ├── routes/           # API routes
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── chats.js
│   │   └── messages.js
│   ├── middleware/       # Express middleware
│   │   ├── auth.js
│   │   ├── validation.js
│   │   ├── errorHandler.js
│   │   └── upload.js
│   ├── services/         # Business logic
│   │   ├── socketService.js
│   │   └── s3Service.js
│   ├── config/           # Configuration
│   │   ├── database.js
│   │   └── constants.js
│   ├── utils/            # Utilities
│   │   └── logger.js
│   └── server.js         # Main server file
├── logs/                 # Log files
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 🔌 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user

### Users

- `GET /api/users` - Get all users
- `GET /api/users/search?q=query` - Search users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/profile` - Update profile
- `PUT /api/users/status` - Update status
- `PUT /api/users/settings` - Update settings
- `POST /api/users/contacts/:userId` - Add contact
- `DELETE /api/users/contacts/:userId` - Remove contact

### Chats

- `POST /api/chats` - Create conversation
- `GET /api/chats` - Get user conversations
- `GET /api/chats/:id` - Get conversation
- `PUT /api/chats/:id` - Update conversation
- `DELETE /api/chats/:id` - Delete conversation
- `POST /api/chats/:id/participants` - Add participant
- `DELETE /api/chats/:id/participants/:userId` - Remove participant

### Messages

- `POST /api/messages` - Send message
- `GET /api/messages/:conversationId` - Get messages
- `PUT /api/messages/:messageId` - Edit message
- `DELETE /api/messages/:messageId` - Delete message
- `POST /api/messages/:messageId/react` - React to message
- `DELETE /api/messages/:messageId/react` - Remove reaction

## 🔐 Authentication

All protected endpoints require JWT token in header:

```
Authorization: Bearer <token>
```

## 🌐 Socket.IO Events

### Client → Server

- `connection` - User connected
- `conversation:join` - Join conversation room
- `conversation:leave` - Leave conversation room
- `user:typing` - User is typing
- `user:stop_typing` - User stopped typing
- `message:send` - Send message
- `message:read` - Mark message as read

### Server → Client

- `user:online` - User came online
- `user:offline` - User went offline
- `message:receive` - New message received
- `message:delivered` - Message delivered
- `message:read` - Message read
- `user:typing` - User is typing
- `user:stop_typing` - User stopped typing

## 🗄️ Database Models

### User

- Username, email, password
- Full name, profile picture, bio
- Status (online/offline/away/busy)
- Contacts, blocked users
- Settings (notifications, theme, privacy)

### Conversation

- Name, description, picture (for groups)
- Participants with roles (admin/member)
- Last message, last message time
- Settings (admin controls, disappearing messages)

### Message

- Content, type (text/image/video/audio/file)
- Sender, conversation
- Media attachments
- Reply to another message
- Reactions
- Read receipts, delivery status
- Edit history

## 🧪 Testing

Test health endpoint:

```bash
curl http://localhost:5000/health
```

Register user:

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123",
    "fullName": "Test User"
  }'
```

Login:

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123"
  }'
```

## 🐛 Debugging

View logs:

```bash
# All logs
tail -f logs/combined.log

# Errors only
tail -f logs/error.log
```

## 🚀 Deployment

### Heroku

```bash
heroku create chyraapp
git push heroku main
heroku config:set MONGODB_URI=your_uri
```

### AWS EC2

1. Launch EC2 instance (Ubuntu)
2. Install Node.js and PM2
3. Clone repository
4. Install dependencies
5. Configure environment
6. Start with PM2

```bash
pm2 start src/server.js --name chyraapp
pm2 save
pm2 startup
```

### Docker

```bash
docker build -t chyraapp-backend .
docker run -p 5000:5000 chyraapp-backend
```

## 🔒 Security

- Passwords hashed with bcrypt
- JWT for authentication
- Helmet for HTTP headers
- CORS configured
- Rate limiting enabled
- Input validation
- SQL injection prevention
- XSS protection

## 📝 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| PORT | No | 5000 | Server port |
| NODE_ENV | No | development | Environment |
| MONGODB_URI | Yes | - | MongoDB connection string |
| JWT_SECRET | Yes | - | JWT secret key |
| JWT_REFRESH_SECRET | Yes | - | JWT refresh secret |
| AWS_REGION | No | us-east-1 | AWS region |
| AWS_S3_BUCKET | No | - | S3 bucket name |
| FRONTEND_URL | No | http://localhost:3000 | Frontend URL |

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

MIT License

## 👨‍💻 Author

ChyraApp Team

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Email: support@chyraapp.com

## 📚 Documentation

Full API documentation: `/api/docs`

## 🔄 Changelog

### Version 1.0.0
- Initial release
- User authentication
- Real-time messaging
- Group chats
- File uploads

---

Made with ❤️ by ChyraApp Team