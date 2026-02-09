import type { NextFunction, Response } from "express";
import { verifyAuthToken } from "../services/supabase";
import type { AuthedRequest } from "../types";

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({
        error: "Missing Authorization token",
        detail: "Authorization header must be Bearer token",
        code: "AUTH_TOKEN_MISSING"
      });
    }

    const result = await verifyAuthToken(token);
    if ("status" in result) {
      return res.status(result.status).json({
        error: result.status === 503 ? "Auth service unavailable" : "Invalid token",
        detail: result.detail,
        code: result.code
      });
    }

    req.user = {
      id: result.userId,
      email: result.email
    };

    return next();
  } catch (err) {
    return res.status(401).json({
      error: "Unauthorized",
      detail: err instanceof Error ? err.message : "Unknown auth error",
      code: "AUTH_UNAUTHORIZED"
    });
  }
}
