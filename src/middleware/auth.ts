import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { adminAuth } from '../lib/firebase-admin.ts';

export interface AuthTokenUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface AuthRequest extends Request {
  user?: AuthTokenUser;
}

const LOCAL_TOKEN_SECRET =
  process.env.AUTH_TOKEN_SECRET ||
  process.env.SQL_PASSWORD ||
  'trackmo-family-ledger-secret-key-2026';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derivedKey = crypto.scryptSync(password, salt, 64);
  const keyBuffer = Buffer.from(keyHex, 'hex');
  if (derivedKey.length !== keyBuffer.length) return false;
  return crypto.timingSafeEqual(derivedKey, keyBuffer);
}

export function createLocalAuthToken(payload: {
  uid: string;
  email: string;
  name: string;
}): string {
  const data = {
    uid: payload.uid,
    email: payload.email,
    name: payload.name,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  const base64Payload = Buffer.from(JSON.stringify(data)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', LOCAL_TOKEN_SECRET)
    .update(base64Payload)
    .digest('base64url');
  return `tm_local.${base64Payload}.${signature}`;
}

function verifyLocalAuthToken(token: string): AuthTokenUser | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'tm_local') return null;
  const [, base64Payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', LOCAL_TOKEN_SECRET)
    .update(base64Payload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSig);
  if (
    sigBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expectedBuf)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(base64Payload, 'base64url').toString('utf-8')
    );
    if (!parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return {
      uid: parsed.uid,
      email: parsed.email,
      name: parsed.name,
    };
  } catch {
    return null;
  }
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];

  if (token.startsWith('tm_local.')) {
    const localUser = verifyLocalAuthToken(token);
    if (!localUser) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }
    req.user = localUser;
    return next();
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name,
      picture: decodedToken.picture,
    };
    return next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
