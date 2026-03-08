const migrate_name = "wireguard_multi_server";

/**
 * Migration to add multi-server support to WireGuard tables
 */
export async function up(knex) {
	// First, check if the tables exist
	const hasInterfaceTable = await knex.schema.hasTable("wg_interface");
	const hasClientTable = await knex.schema.hasTable("wg_client");

	if (!hasInterfaceTable || !hasClientTable) {
		throw new Error("Missing wg_interface or wg_client tables. Ensure previous migrations ran.");
	}

	// 1. Add isolate_clients to wg_interface
	await knex.schema.alterTable("wg_interface", (table) => {
		table.boolean("isolate_clients").notNullable().defaultTo(false);
	});

	// 2. Add interface_id to wg_client
	await knex.schema.alterTable("wg_client", (table) => {
		table.integer("interface_id").unsigned().nullable(); // Initially nullable to allow adding
	});

	// 3. Assign existing clients to the first interface (wg0)
	const firstInterface = await knex("wg_interface").orderBy("id").first();

	if (firstInterface) {
		await knex("wg_client").whereNull("interface_id").update({
			interface_id: firstInterface.id,
		});
	}

	// 4. Make interface_id not nullable and add foreign key
	await knex.schema.alterTable("wg_client", (table) => {
		table.integer("interface_id")
			.unsigned()
			.notNullable()
			.references("id")
			.inTable("wg_interface")
			.onDelete("CASCADE")
			.alter();
	});

	// 5. Create wg_server_link for server peering
	await knex.schema.createTable("wg_server_link", (table) => {
		table.integer("interface_id_1").unsigned().notNullable()
			.references("id").inTable("wg_interface").onDelete("CASCADE");
		table.integer("interface_id_2").unsigned().notNullable()
			.references("id").inTable("wg_interface").onDelete("CASCADE");
		table.primary(["interface_id_1", "interface_id_2"]);
	});
}

export async function down(knex) {
	await knex.schema.dropTableIfExists("wg_server_link");

	await knex.schema.alterTable("wg_client", (table) => {
		table.dropForeign("interface_id");
		table.dropColumn("interface_id");
	});

	await knex.schema.alterTable("wg_interface", (table) => {
		table.dropColumn("isolate_clients");
	});
}
