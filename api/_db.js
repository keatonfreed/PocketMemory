import { Pool } from "pg";

let pool;

export function getPool() {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error("Missing DATABASE_URL");
        }
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            // Neon usually wants SSL
            ssl: { rejectUnauthorized: false },
            max: 5,
        });
    }
    return pool;
}

export async function query(text, params) {
    const p = getPool();
    return p.query(text, params);
}
