require('dotenv').config();
const { Client } = require('pg');

async function testConnection() {
    console.log('Testing Neon DB connection...');
    
    // Initialize the Postgres client using your new environment variable
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        const start = Date.now();
        
        // Attempt to connect to the database
        await client.connect();
        
        // Run a simple query to check the server time and database name
        const res = await client.query('SELECT NOW() as current_time, current_database() as db_name;');
        
        console.log(`Time: ${Date.now() - start} ms`);
        console.log('Success! Connected to Neon.');
        console.log(`Database Name: ${res.rows[0].db_name}`);
        
        // Optional: Let's also check if your auth.users table is accessible!
        const users = await client.query('SELECT count(*) FROM auth.users;');
        console.log(`Users found in auth table: ${users.rows[0].count}`);

    } catch (error) {
        console.error('Neon DB Connection Error:', error.message);
    } finally {
        // Always close the connection when the script finishes
        await client.end();
    }
}

testConnection();