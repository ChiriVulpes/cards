import { sql as vercelPool } from '@vercel/postgres'
import { drizzle as localDrizzle } from 'drizzle-orm/node-postgres'
import { drizzle as vercelDrizzle } from 'drizzle-orm/vercel-postgres'

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
let localPool: import('pg').Pool | undefined
if (process.env.NODE_ENV === 'development') {
	// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/consistent-type-imports
	const { Pool } = require('pg') as typeof import('pg')
	localPool = new Pool({
		connectionString: process.env.DATABASE_URL,
	})
}

export const db = localPool ? localDrizzle(localPool) : vercelDrizzle(vercelPool)
