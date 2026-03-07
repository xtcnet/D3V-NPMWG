// WireGuard Client model - simple Knex queries
// Used directly in internal/wireguard.js via knex

const tableName = "wg_client";

export default {
	tableName,

	async getAll(knex) {
		return knex(tableName).orderBy("created_on", "desc");
	},

	async get(knex, id) {
		return knex(tableName).where("id", id).first();
	},

	async create(knex, data) {
		const [id] = await knex(tableName).insert({
			...data,
			created_on: knex.fn.now(),
			modified_on: knex.fn.now(),
		});
		return knex(tableName).where("id", id).first();
	},

	async update(knex, id, data) {
		return knex(tableName).where("id", id).update({
			...data,
			modified_on: knex.fn.now(),
		});
	},

	async delete(knex, id) {
		return knex(tableName).where("id", id).del();
	},

	async toggle(knex, id, enabled) {
		return knex(tableName).where("id", id).update({
			enabled: enabled,
			modified_on: knex.fn.now(),
		});
	},
};
