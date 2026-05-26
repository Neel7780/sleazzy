import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
// Swap Supabase for your database pool
import { db } from '../db'; 

const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization || '';
    const mockEmail = req.headers['x-mock-user-email'];

    // Mock Login for Dev/Test
    if (process.env.NODE_ENV !== 'production' && typeof mockEmail === 'string' && mockEmail) {
      // Direct SQL Query instead of Supabase
      const { rows } = await db.query(
        'SELECT id, role, email FROM profiles WHERE email = $1 LIMIT 1',
        [mockEmail]
      );
      const profile = rows[0];

      if (!profile) {
        return res
          .status(401)
          .json({ error: `Mock user not found for email: ${mockEmail}` });
      }

      req.user = {
        id: profile.id,
        email: profile.email,
        role: profile.role,
      };
      return next();
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : null;

    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    // 1. Verify the JWT locally (Replaces supabase.auth.getUser)
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.error("CRITICAL: JWT_SECRET is missing from your .env file!");
      return res.status(500).json({ error: 'Internal server configuration error' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, secret) as { sub: string };
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const userId = decoded.sub; // 'sub' is the standard JWT property for the User ID

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token payload structure' });
    }

    // 2. Query profile directly from Postgres (Replaces supabase.from('profiles')...)
    const { rows } = await db.query(
      'SELECT role, email FROM profiles WHERE id = $1 LIMIT 1',
      [userId]
    );
    const profile = rows[0];

    if (!profile) {
      console.error('Profile not found for user:', userId);
      return res.status(401).json({ error: 'User profile does not exist' });
    }

    req.user = {
      id: userId,
      email: profile.email,
      role: profile.role,
    };

    return next();
  } catch (err) {
    return res.status(401).json({ error: `Unauthorized: ${(err as Error).message}` });
  }
};

export default authMiddleware;