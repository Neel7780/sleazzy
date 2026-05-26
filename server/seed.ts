import dotenv from 'dotenv';
import { Client } from 'pg';
import { randomUUID } from 'crypto';
import bcrypt from 'bcrypt'; // You'll need this to manually hash passwords now

dotenv.config();

const ADMIN_EMAIL = 'sbg_convener@dau.ac.in';
const CLUB_EMAIL = 'music_club@dau.ac.in';
const DANCE_EMAIL = 'dance_club@dau.ac.in';

async function seed() {
    console.log('Connecting to Neon DB...');
    
    // Connect directly using your new Neon connection string
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });
    await client.connect();

    console.log('Seeding data...');

    const profiles = [
        { email: ADMIN_EMAIL, full_name: 'SBG Convener', role: 'admin' },
        { email: CLUB_EMAIL, full_name: 'Music Club', role: 'club' },
        { email: DANCE_EMAIL, full_name: 'Dance Club', role: 'club' },
    ];

    for (const p of profiles) {
        try {
            const userId = randomUUID();
            
            // 1. Manually hash the password (Replaces supabase.auth.admin.createUser)
            const hashedPassword = await bcrypt.hash('password123', 10);

            // 2. Insert into the Auth table (Adjust 'auth.users' to your actual Neon Auth table name)
            await client.query(`
                INSERT INTO auth.users (id, email, encrypted_password)
                VALUES ($1, $2, $3)
                ON CONFLICT (email) DO NOTHING
                RETURNING id;
            `, [userId, p.email, hashedPassword]);

            // 3. Upsert the Profile (Replaces supabase.from('profiles').upsert)
            // ON CONFLICT (email) handles the 'upsert' logic natively in SQL
            await client.query(`
                INSERT INTO public.profiles (id, email, full_name, role)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (id) DO UPDATE 
                SET email = EXCLUDED.email, 
                    full_name = EXCLUDED.full_name, 
                    role = EXCLUDED.role;
            `, [userId, p.email, p.full_name, p.role]);

            console.log(`Upserted user & profile: ${p.email}`);
        } catch (error) {
            console.error(`Error processing ${p.email}:`, error);
        }
    }

    const clubs = [
        { name: 'Music Club', email: CLUB_EMAIL, group_category: 'B' },
        { name: 'Dance Club', email: DANCE_EMAIL, group_category: 'B' },
    ];

    for (const c of clubs) {
        try {
            // Upsert Clubs using standard SQL
            await client.query(`
                INSERT INTO public.clubs (name, email, group_category)
                VALUES ($1, $2, $3)
                ON CONFLICT (name) DO UPDATE 
                SET email = EXCLUDED.email, 
                    group_category = EXCLUDED.group_category;
            `, [c.name, c.email, c.group_category]);

            console.log(`Upserted club: ${c.name}`);
        } catch (error) {
             console.error(`Error processing club ${c.name}:`, error);
        }
    }

    await client.end();
    console.log('Seeding complete!');
}

seed();