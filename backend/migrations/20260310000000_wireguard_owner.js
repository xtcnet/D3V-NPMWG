/**
 * Migration to add owner_user_id to WireGuard tables for user-based data isolation
 */
export async function up(knex) {
	// 1. Add owner_user_id to wg_interface
	await knex.schema.alterTable("wg_interface", (table) => {
		table.integer("owner_user_id").unsigned().nullable();
	});

	// 2. Add owner_user_id to wg_client
	await knex.schema.alterTable("wg_client", (table) => {
		table.integer("owner_user_id").unsigned().nullable();
	});

	// 3. Backfill existing rows with admin user (id=1)
	await knex("wg_interface").whereNull("owner_user_id").update({ owner_user_id: 1 });
	await knex("wg_client").whereNull("owner_user_id").update({ owner_user_id: 1 });

	// 4. Make columns not nullable
	await knex.schema.alterTable("wg_interface", (table) => {
		table.integer("owner_user_id").unsigned().notNullable().defaultTo(1).alter();
	});
	await knex.schema.alterTable("wg_client", (table) => {
		table.integer("owner_user_id").unsigned().notNullable().defaultTo(1).alter();
	});
}

export async function down(knex) {
	await knex.schema.alterTable("wg_client", (table) => {
		table.dropColumn("owner_user_id");
	});
	await knex.schema.alterTable("wg_interface", (table) => {
		table.dropColumn("owner_user_id");
	});
}
