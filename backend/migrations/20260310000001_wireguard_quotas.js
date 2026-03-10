export const up = function (knex) {
	return knex.schema.alterTable("wg_client", (table) => {
		// Traffic Bandwidth Limits (0 = Unlimited)
		table.bigInteger("tx_limit").notNull().defaultTo(0);
		table.bigInteger("rx_limit").notNull().defaultTo(0);
		
		// Disk Partition Ceiling Quota Configuration in Megabytes
		table.integer("storage_limit_mb").notNull().defaultTo(500);
	});
};

export const down = function (knex) {
	return knex.schema.alterTable("wg_client", (table) => {
		table.dropColumn("tx_limit");
		table.dropColumn("rx_limit");
		table.dropColumn("storage_limit_mb");
	});
};
