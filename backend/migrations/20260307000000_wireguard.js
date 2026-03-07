const migrate_name = "wireguard";

/**
 * Wireguard tables migration
 */
export function up(knex) {
	return knex.schema
		.createTable("wg_interface", (table) => {
			table.increments("id").primary();
			table.string("name").notNullable().defaultTo("wg0");
			table.text("private_key").notNullable();
			table.text("public_key").notNullable();
			table.string("ipv4_cidr").notNullable().defaultTo("10.8.0.0/24");
			table.integer("listen_port").notNullable().defaultTo(51820);
			table.integer("mtu").notNullable().defaultTo(1420);
			table.string("dns").defaultTo("1.1.1.1, 8.8.8.8");
			table.string("host").defaultTo("");
			table.text("post_up").defaultTo("");
			table.text("post_down").defaultTo("");
			table.dateTime("created_on").notNullable();
			table.dateTime("modified_on").notNullable();
		})
		.createTable("wg_client", (table) => {
			table.increments("id").primary();
			table.string("name").notNullable().defaultTo("Unnamed Client");
			table.boolean("enabled").notNullable().defaultTo(true);
			table.string("ipv4_address").notNullable();
			table.text("private_key").notNullable();
			table.text("public_key").notNullable();
			table.text("pre_shared_key").notNullable();
			table.string("allowed_ips").notNullable().defaultTo("0.0.0.0/0, ::/0");
			table.integer("persistent_keepalive").notNullable().defaultTo(25);
			table.dateTime("expires_at").nullable();
			table.dateTime("created_on").notNullable();
			table.dateTime("modified_on").notNullable();
		});
};

export function down(knex) {
	return knex.schema.dropTableIfExists("wg_client").dropTableIfExists("wg_interface");
};
