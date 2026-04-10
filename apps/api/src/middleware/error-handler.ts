import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-error.js";

export function errorHandler(
  error: unknown,
  _request: Request,
  response: Response,
  _next: NextFunction
): void {
  if (error instanceof HttpError) {
    response.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details
      }
    });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: "validation.failed",
        message: "The request payload is invalid.",
        details: error.flatten()
      }
    });
    return;
  }

  if (error instanceof mongoose.Error.ValidationError) {
    response.status(400).json({
      error: {
        code: "validation.failed",
        message: "The request payload failed validation.",
        details: error.errors
      }
    });
    return;
  }

  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    response.status(409).json({
      error: {
        code: "database.unique_conflict",
        message: "A record with the same unique value already exists."
      }
    });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  response.status(500).json({
    error: {
      code: "internal.error",
      message
    }
  });
}
