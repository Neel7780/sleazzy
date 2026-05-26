import dotenv from 'dotenv';
import { Pool } from 'pg';

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('Missing DATABASE_URL in .env file');
}

// We use a Pool here instead of a Client. 
// A Pool manages multiple connections automatically, which is required 
// for an Express server handling simultaneous incoming API requests.
export const db = new Pool({
  connectionString: databaseUrl,
});