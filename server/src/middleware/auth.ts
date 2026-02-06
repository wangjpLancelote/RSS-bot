import type { NextFunction, Response } from "express";
import { authClient } from "../services/supabase";
import type { AuthedRequest } from "../types";

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing Authorization token" });
    }

    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ error: "Invalid token" });
    }

    req.user = {
      id: data.user.id,
      email: data.user.email
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
}
