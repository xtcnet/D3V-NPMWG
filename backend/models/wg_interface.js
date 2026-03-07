// WireGuard Interface model - simple Knex queries (no Objection.js for simplicity)
// Used directly in internal/wireguard.js via knex
// This file exports table name and basic query helpers

const tableName = "wg_interface";

export default {
	tableName,

	async get(knex) {
		return knex(tableName).first();
	},

	async update(knex, id, data) {
		return knex(tableName).where("id", id).update({
			...data,
			modified_on: knex.fn.now(),
		});
	},
};
