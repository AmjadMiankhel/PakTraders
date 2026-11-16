import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "@paktenders/database";

/**
 * Normalises error responses and records unexpected failures in error_logs.
 * Prisma errors are mapped to safe messages so schema details never leak.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpExceptionFilter");

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "Internal server error";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === "string") {
        message = body;
      } else if (body && typeof body === "object") {
        const record = body as Record<string, unknown>;
        message = (record.message as string | string[]) ?? exception.message;
        error = (record.error as string) ?? exception.name;
      }
    } else if (exception instanceof Error) {
      const prismaCode = (exception as { code?: string }).code;
      if (prismaCode === "P2002") {
        status = HttpStatus.CONFLICT;
        message = "A record with these details already exists";
        error = "Conflict";
      } else if (prismaCode === "P2025") {
        status = HttpStatus.NOT_FOUND;
        message = "Record not found";
        error = "Not Found";
      } else if (prismaCode?.startsWith("P1") || prismaCode?.startsWith("P2")) {
        status = HttpStatus.BAD_REQUEST;
        message = "The request could not be processed";
        error = "Bad Request";
      } else {
        this.logger.error(
          `${request.method} ${request.url} failed: ${exception.message}`,
          exception.stack,
        );
        void this.persistError(exception, request, requestId);
      }
    }

    if (status >= 500) {
      void this.persistError(exception, request, requestId);
    }

    response.status(status).json({
      statusCode: status,
      message,
      error,
      requestId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private async persistError(exception: unknown, request: Request, requestId: string) {
    try {
      await prisma.errorLog.create({
        data: {
          level: "ERROR",
          message: exception instanceof Error ? exception.message : "Unknown error",
          stack: exception instanceof Error ? exception.stack : undefined,
          requestId,
          context: {
            method: request.method,
            url: request.url,
            userAgent: request.headers["user-agent"],
          },
        },
      });
    } catch {
      // Never let logging failures affect the response.
    }
  }
}
