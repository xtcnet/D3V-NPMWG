import db from "../db.js";
import { debug, express as logger } from "../logger.js";

const internalDatabase = {
	/**
	 * Get all tables in the database (SQLite specific, but Knex supports raw queries for others too)
	 */
	async getTables() {
		const knex = db();
		
		// Attempt SQLite first, fallback to generic if using mysql/mariadb
		try {
			// For SQLite
			const tables = await knex.raw("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
			return tables.map(t => t.name).sort();
		} catch (e) {
			// For MySQL/MariaDB
			const tables = await knex.raw("SHOW TABLES");
			return tables[0].map(t => Object.values(t)[0]).sort();
		}
	},

	/**
	 * Get table schema and paginated rows
	 */
	async getTableData(tableName, limit = 50, offset = 0) {
		const knex = db();
		
		// 1. Get Schema/PRAGMA
		let schema = [];
		try {
			const info = await knex.raw(`PRAGMA table_info("${tableName}")`);
			schema = info; // SQLite structure
		} catch (e) {
			// MySQL fallback
			const info = await knex.raw(`DESCRIBE \`${tableName}\``);
			schema = info[0];
		}

		// 2. Count total rows
		const countResult = await knex(tableName).count("id as count").first();
		const total = parseInt(countResult.count || 0, 10);

		// 3. Get rows
		const rows = await knex(tableName)
			.select("*")
			.limit(limit)
			.offset(offset)
			// Try ordering by ID or created_on if possible, fallback to whatever db returns
			.orderBy(
				schema.find(col => col.name === 'created_on' || col.Field === 'created_on') ? 'created_on' : 
				(schema.find(col => col.name === 'id' || col.Field === 'id') ? 'id' : undefined) || '1',
				'desc'
			)
			.catch(() => knex(tableName).select("*").limit(limit).offset(offset)); // If order fails
			
		return {
			name: tableName,
			schema,
			total,
			rows
		};
	}
};

export default internalDatabase;
