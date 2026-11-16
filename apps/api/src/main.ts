import "reflect-metadata";
import "./env";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe, Logger } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { corsOrigins, loadEnv } from "@paktenders/config";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

async function bootstrap() {
  const env = loadEnv();
  const logger = new Logger("Bootstrap");

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: env.NODE_ENV === "production" ? ["error", "warn", "log"] : ["error", "warn", "log", "debug"],
  });

  app.setGlobalPrefix("v1");
  // The API is intended to sit behind a reverse proxy. Trust one proxy hop so
  // per-IP throttling sees the real client address from X-Forwarded-For.
  app.set("trust proxy", 1);
  app.use(
    helmet({
      // The API serves JSON; Swagger UI is the only HTML surface.
      contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigins(env),
    credentials: true,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Pak Tenders API")
    .setDescription(
      "Shared REST API for the Pak Tenders website, Android and iOS applications. " +
        "All timestamps are ISO-8601 UTC; render them in Asia/Karachi (PKT).",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(env.API_PORT, "0.0.0.0");
  logger.log(`API listening on ${env.API_PUBLIC_URL} (port ${env.API_PORT})`);
  logger.log(`OpenAPI docs: ${env.API_PUBLIC_URL}/api/docs`);
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error during API bootstrap:", error);
  process.exit(1);
});
