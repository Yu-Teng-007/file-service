# File Service

A comprehensive file service system for storing and managing static resources including images, scripts, stylesheets, fonts, documents, and more.

## Features

### Core Features

- 🚀 **Multi-format Support**: Images, JS, CSS, fonts, documents, music files
- 🔒 **Security**: File type validation, size limits, virus scanning
- 🎯 **Access Control**: Public, private, and protected access levels
- 📁 **Auto Classification**: Automatic file categorization and organization
- 🌐 **API-First**: RESTful API with comprehensive documentation
- 🐳 **Docker Ready**: Containerized deployment support

### Advanced Features

- ⚡ **Redis Caching**: File metadata caching, hot file caching, cache invalidation strategies
- ☁️ **CDN Integration**: Support for AWS S3, Alibaba Cloud OSS, Tencent Cloud COS
- 🖼️ **Image Processing**: Compression, resizing, format conversion, watermarking (Sharp-based)
- 📦 **File Compression**: Support for gzip, deflate, ZIP archives
- 📊 **Monitoring & Analytics**: File access statistics, performance monitoring, storage analysis
- 📚 **Version Control**: File history, version rollback, diff comparison
- 🔄 **Sync & Backup**: Automatic file synchronization and backup mechanisms
- 🔍 **Management**: File search, batch operations, metadata management

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd file-service
```

2. Install dependencies:

```bash
npm install
```

3. Configure environment:

```bash
cp .env.example .env
# Edit .env with your configuration
```

4. (Optional) Start Redis for caching:

```bash
# Using Docker (recommended)
.\scripts\start-redis.ps1

# Test Redis connection
.\scripts\test-redis.ps1

# Update .env to enable Redis
# REDIS_HOST=localhost
```

5. Start the development server:

```bash
npm run start:dev
```

The service will be available at `http://localhost:3001`

### Available Endpoints

- **API Documentation**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/info
- **Monitoring Dashboard**: http://localhost:3001/api/monitoring/dashboard

## Configuration

### Environment Variables

Key configuration options in `.env`:

**Basic Configuration:**

- `PORT`: Server port (default: 3001)
- `UPLOAD_DIR`: File storage directory
- `MAX_FILE_SIZE`: Global file size limit
- `JWT_SECRET`: JWT signing secret
- `CORS_ORIGINS`: Allowed CORS origins

**Redis Cache Configuration:**

- `REDIS_HOST`: Redis server host (default: localhost)
- `REDIS_PORT`: Redis server port (default: 6379)
- `REDIS_PASSWORD`: Redis password (optional)
- `REDIS_DB`: Redis database number (default: 0)
- `CACHE_TTL`: Cache time-to-live in seconds (default: 3600)

**CDN Configuration:**

- `CDN_PROVIDER`: CDN provider (local, aws, aliyun, tencent)
- `CDN_BUCKET`: CDN bucket name
- `CDN_ACCESS_KEY_ID`: CDN access key
- `CDN_ACCESS_KEY_SECRET`: CDN secret key
- `CDN_REGION`: CDN region

**Image Processing:**

- `IMAGE_PROCESSING_ENABLED`: Enable image processing (default: true)
- `IMAGE_QUALITY_DEFAULT`: Default image quality (default: 80)
- `IMAGE_MAX_SIZE`: Maximum image size (default: 50MB)

**Monitoring:**

- `MONITORING_ACCESS_LOGGING`: Enable access logging (default: true)
- `MONITORING_PERFORMANCE`: Enable performance monitoring (default: true)
- `MONITORING_LOG_RETENTION_DAYS`: Log retention period (default: 30)

### File Type Configuration

The service supports automatic file categorization:

- **Images**: jpg, png, gif, webp, svg
- **Scripts**: js, ts, json
- **Styles**: css, scss, less
- **Fonts**: ttf, woff, woff2, eot
- **Documents**: pdf, txt, doc, docx
- **Music**: mp3, wav, flac, ogg

## API Documentation

Once running, visit `http://localhost:3001/api` for interactive API documentation.

### Key Endpoints

#### File Management

- `POST /api/files/upload` - Upload files
- `GET /api/files` - List files
- `GET /api/files/:id` - Get file info
- `DELETE /api/files/:id` - Delete file
- `PUT /api/files/:id` - Update file metadata
- `GET /uploads/:category/:filename` - Access files

#### Image Processing

- `POST /api/image-processing/process` - Process images
- `POST /api/image-processing/thumbnails` - Generate thumbnails
- `POST /api/image-processing/compress` - Compress images
- `GET /api/image-processing/info/:path` - Get image info

#### File Compression

- `POST /api/compression/compress` - Compress files
- `POST /api/compression/archive` - Create archives
- `POST /api/compression/extract` - Extract archives

#### Monitoring

- `GET /api/monitoring/storage/stats` - Storage statistics
- `GET /api/monitoring/performance/metrics` - Performance metrics
- `GET /api/monitoring/dashboard` - Monitoring dashboard

## Development

### Scripts

- `npm run start:dev` - Development server with hot reload
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run test` - Run tests
- `npm run lint` - Lint code

### Project Structure

```
src/
├── config/          # Configuration modules
├── modules/         # Feature modules
│   ├── files/       # File management
│   ├── auth/        # Authentication
│   └── storage/     # Storage providers
├── common/          # Shared utilities
├── types/           # Type definitions
└── main.ts          # Application entry point
```

## Deployment

### Docker

```bash
docker build -t file-service .
docker run -p 3001:3001 file-service
```

### Production

1. Build the application:

```bash
npm run build
```

2. Start with PM2:

```bash
pm2 start dist/main.js --name file-service
```

## Security

- File type validation
- Size limits per category
- JWT-based authentication
- Rate limiting
- CORS protection
- Optional virus scanning

## License

MIT License - see LICENSE file for details.
