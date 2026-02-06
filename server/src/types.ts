import type { Request } from "express";

export type AuthedRequest = Request & {
  user: {
    id: string;
    email?: string | null;
  };
};
