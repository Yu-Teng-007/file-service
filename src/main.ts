import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import * as compression from "compression";
import { AppModule } from "./app.module";

async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    const configService = app.get(ConfigService);

    // Security middleware
    app.use(
        helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" },
            contentSecurityPolicy: false, // Allow file serving
        })
    );

    // Compression middleware
    app.use(compression());

    // CORS configuration
    const corsOrigins = configService.get<string>("CORS_ORIGINS")?.split(",") || ["http://localhost:3000"];
    app.enableCors({
        origin: corsOrigins,
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    });

    // Global validation pipe
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        })
    );

    // API prefix
    app.setGlobalPrefix("api");

    // Add a simple root route handler
    app.getHttpAdapter().get("/", (req, res) => {
        res.json({
            message: "Welcome to File Service API",
            version: "1.0.0",
            documentation: "/api",
            health: "/api",
            endpoints: {
                upload: "/api/files/upload",
                files: "/api/files",
                stats: "/api/files/stats",
            },
        });
    });

    // Swagger documentation
    const config = new DocumentBuilder()
        .setTitle("File Service API")
        .setDescription("Comprehensive file service for static resource management")
        .setVersion("1.0")
        .addBearerAuth(
            {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
            },
            "JWT-auth"
        )
        .addApiKey(
            {
                type: "apiKey",
                name: "X-API-Key",
                in: "header",
            },
            "API-Key"
        )
        .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api", app, document);

    const port = configService.get<number>("PORT") || 3001;
    await app.listen(port);

    console.log(`🚀 File Service is running on: http://localhost:${port}`);
    console.log(`📚 API Documentation: http://localhost:${port}/api`);
}

bootstrap();
