import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "7d";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  roleId: string;
  roleSlug: string;
  permissions: string[];
}

export interface RefreshTokenPayload {
  sub: string;
  tokenVersion?: number;
}

function requireSecret(secret: string | undefined, name: string): string {
  if (!secret) {
    throw new Error(`${name} environment variable is not defined`);
  }
  return secret;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, requireSecret(process.env.JWT_ACCESS_SECRET, "JWT_ACCESS_SECRET"), {
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, requireSecret(process.env.JWT_REFRESH_SECRET, "JWT_REFRESH_SECRET"), {
    expiresIn: REFRESH_TOKEN_TTL,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(
    token,
    requireSecret(process.env.JWT_ACCESS_SECRET, "JWT_ACCESS_SECRET")
  ) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(
    token,
    requireSecret(process.env.JWT_REFRESH_SECRET, "JWT_REFRESH_SECRET")
  ) as RefreshTokenPayload;
}

export const ACCESS_TOKEN_COOKIE = "jaris_access_token";
export const REFRESH_TOKEN_COOKIE = "jaris_refresh_token";

export const ACCESS_TOKEN_MAX_AGE = 15 * 60; // seconds
export const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60; // seconds
