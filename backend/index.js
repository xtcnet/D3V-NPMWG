#!/usr/bin/env node

import app from "./app.js";
import db from "./db.js";
import internalCertificate from "./internal/certificate.js";
import internalIpRanges from "./internal/ip_ranges.js";
import internalWireguard from "./internal/wireguard.js";
import { global as logger } from "./logger.js";
import { migrateUp } from "./migrate.js";
import { getCompiledSchema } from "./schema/index.js";
import setup from "./setup.js";

const IP_RANGES_FETCH_ENABLED = process.env.IP_RANGES_FETCH_ENABLED !== "false";
const WG_ENABLED = process.env.WG_ENABLED !== "false";

async function appStart() {
	return migrateUp()
		.then(setup)
		.then(getCompiledSchema)
		.then(() => {
			if (!IP_RANGES_FETCH_ENABLED) {
				logger.info("IP Ranges fetch is disabled by environment variable");
				return;
			}
			logger.info("IP Ranges fetch is enabled");
			return internalIpRanges.fetch().catch((err) => {
				logger.error("IP Ranges fetch failed, continuing anyway:", err.message);
			});
		})
		.then(async () => {
			internalCertificate.initTimer();
			internalIpRanges.initTimer();

			// Start WireGuard
			if (WG_ENABLED) {
				logger.info("WireGuard is enabled, starting...");
				try {
					const knex = db();
					await internalWireguard.startup(knex);
					logger.info("WireGuard started successfully");
				} catch (err) {
					logger.error("WireGuard startup failed:", err.message);
					logger.warn("NPM will continue without WireGuard functionality");
				}
			} else {
				logger.info("WireGuard is disabled by environment variable");
			}

			const server = app.listen(3000, () => {
				logger.info(`Backend PID ${process.pid} listening on port 3000 ...`);

				process.on("SIGTERM", async () => {
					logger.info(`PID ${process.pid} received SIGTERM`);

					// Shutdown WireGuard gracefully
					if (WG_ENABLED) {
						try {
							const knex = db();
							await internalWireguard.shutdown(knex);
						} catch (err) {
							logger.warn("WireGuard shutdown warning:", err.message);
						}
					}

					server.close(() => {
						logger.info("Stopping.");
						process.exit(0);
					});
				});
			});
		})
		.catch((err) => {
			logger.error(`Startup Error: ${err.message}`, err);
			setTimeout(appStart, 1000);
		});
}

try {
	appStart();
} catch (err) {
	logger.fatal(err);
	process.exit(1);
}
