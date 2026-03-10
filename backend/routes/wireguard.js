import express from "express";
import archiver from "archiver";
import internalWireguard from "../internal/wireguard.js";
import internalWireguardFs from "../internal/wireguard-fs.js";
import internalAuditLog from "../internal/audit-log.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import db from "../db.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

// Protect all WireGuard routes
router.use(jwtdecode());

/**
 * GET /api/wireguard
 * Get WireGuard interfaces info
 */
router.get("/", async (_req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:list");
		const ifaces = await internalWireguard.getInterfacesInfo(knex, access, accessData);
		res.status(200).json(ifaces);
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wireguard/dashboard
 * Aggregated analytics for the main dashboard
 */
router.get("/dashboard", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:list");
		
		const clients = await internalWireguard.getClients(knex, access, accessData);
		
		let totalStorageBytes = 0;
		let totalTransferRx = 0;
		let totalTransferTx = 0;
		let online24h = 0;
		let online7d = 0;
		let online30d = 0;
		
		const now = Date.now();
		const DAY = 24 * 60 * 60 * 1000;
		
		for (const client of clients) {
			try {
				totalStorageBytes += await internalWireguardFs.getClientStorageUsage(client.ipv4_address);
			} catch (_) {}
			
			totalTransferRx += parseInt(client.transfer_rx || 0, 10);
			totalTransferTx += parseInt(client.transfer_tx || 0, 10);
			
			if (client.latest_handshake_at) {
				const handshakeStr = String(client.latest_handshake_at);
				let handshakeTime = Date.parse(handshakeStr);
				
				// Handle 0 or invalid epoch
				if (handshakeTime > 0) {
					if (now - handshakeTime <= DAY) online24h++;
					if (now - handshakeTime <= 7 * DAY) online7d++;
					if (now - handshakeTime <= 30 * DAY) online30d++;
				}
			}
		}
		
		res.status(200).json({
			totalStorageBytes,
			totalTransferRx,
			totalTransferTx,
			online24h,
			online7d,
			online30d,
			totalClients: clients.length
		});
	} catch (err) {
		next(err);
	}
});

/**
 * POST /api/wireguard
 * Create a new WireGuard interface
 */
router.post("/", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:create");
		const iface = await internalWireguard.createInterface(knex, req.body, access, accessData);
		await internalAuditLog.add(access, {
			action: "created",
			object_type: "wireguard-server",
			object_id: iface.id,
			meta: req.body,
		});
		res.status(201).json(iface);
	} catch (err) {
		next(err);
	}
});

/**
 * PUT /api/wireguard/:id
 * Update a WireGuard interface
 */
router.put("/:id", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:update");
		const iface = await internalWireguard.updateInterface(knex, req.params.id, req.body, access, accessData);
		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "wireguard-server",
			object_id: iface.id,
			meta: req.body,
		});
		res.status(200).json(iface);
	} catch (err) {
		next(err);
	}
});

/**
 * DELETE /api/wireguard/:id
 * Delete a WireGuard interface
 */
router.delete("/:id", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:delete");
		const result = await internalWireguard.deleteInterface(knex, req.params.id, access, accessData);
		await internalAuditLog.add(access, {
			action: "deleted",
			object_type: "wireguard-server",
			object_id: req.params.id,
			meta: {},
		});
		res.status(200).json(result);
	} catch (err) {
		next(err);
	}
});

/**
 * POST /api/wireguard/:id/links
 * Update peering links for a WireGuard interface
 */
router.post("/:id/links", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:update");
		const result = await internalWireguard.updateInterfaceLinks(knex, req.params.id, req.body.linked_servers || [], access, accessData);
		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "wireguard-server-links",
			object_id: req.params.id,
			meta: req.body,
		});
		res.status(200).json(result);
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wireguard/client
 * List all WireGuard clients with live status
 */
router.get("/client", async (_req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:list");
		const clients = await internalWireguard.getClients(knex, access, accessData);
		res.status(200).json(clients);
	} catch (err) {
		next(err);
	}
});

/**
 * POST /api/wireguard/client
 * Create a new WireGuard client
 */
router.post("/client", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:create");
		const client = await internalWireguard.createClient(knex, req.body, access, accessData);
		await internalAuditLog.add(access, {
			action: "created",
			object_type: "wireguard-client",
			object_id: client.id,
			meta: req.body,
		});
		res.status(201).json(client);
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wireguard/client/:id
 * Get a specific WireGuard client
 */
router.get("/client/:id", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:get");
		const query = knex("wg_client").where("id", req.params.id);
		if (accessData.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			return res.status(404).json({ error: { message: "Client not found" } });
		}
		res.status(200).json(client);
	} catch (err) {
		next(err);
	}
});

/**
 * PUT /api/wireguard/client/:id
 * Update a WireGuard client
 */
router.put("/client/:id", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:update");
		const client = await internalWireguard.updateClient(knex, req.params.id, req.body, access, accessData);
		await internalAuditLog.add(access, {
			action: "updated",
			object_type: "wireguard-client",
			object_id: client.id,
			meta: req.body,
		});
		res.status(200).json(client);
	} catch (err) {
		next(err);
	}
});

/**
 * DELETE /api/wireguard/client/:id
 * Delete a WireGuard client
 */
router.delete("/client/:id", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:delete");
		const result = await internalWireguard.deleteClient(knex, req.params.id, access, accessData);
		await internalAuditLog.add(access, {
			action: "deleted",
			object_type: "wireguard-client",
			object_id: req.params.id,
			meta: {},
		});
		res.status(200).json(result);
	} catch (err) {
		next(err);
	}
});

/**
 * POST /api/wireguard/client/:id/enable
 * Enable a WireGuard client
 */
router.post("/client/:id/enable", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:update");
		const client = await internalWireguard.toggleClient(knex, req.params.id, true, access, accessData);
		await internalAuditLog.add(access, {
			action: "enabled",
			object_type: "wireguard-client",
			object_id: client.id,
			meta: {},
		});
		res.status(200).json(client);
	} catch (err) {
		next(err);
	}
});

/**
 * POST /api/wireguard/client/:id/disable
 * Disable a WireGuard client
 */
router.post("/client/:id/disable", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:update");
		const client = await internalWireguard.toggleClient(knex, req.params.id, false, access, accessData);
		await internalAuditLog.add(access, {
			action: "disabled",
			object_type: "wireguard-client",
			object_id: client.id,
			meta: {},
		});
		res.status(200).json(client);
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wireguard/client/:id/configuration
 * Download WireGuard client configuration file
 */
router.get("/client/:id/configuration", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:get");
		const query = knex("wg_client").where("id", req.params.id);
		if (accessData.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			return res.status(404).json({ error: { message: "Client not found" } });
		}
		const config = await internalWireguard.getClientConfiguration(knex, req.params.id);
		const safeName = client.name.replace(/[^a-zA-Z0-9_.-]/g, "-").substring(0, 32);
		res.set("Content-Disposition", `attachment; filename="${safeName}.conf"`);
		res.set("Content-Type", "text/plain");
		res.status(200).send(config);
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wireguard/client/:id/qrcode.svg
 * Get QR code SVG for client configuration
 */
router.get("/client/:id/qrcode.svg", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:get");
		const query = knex("wg_client").where("id", req.params.id);
		if (accessData.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			return res.status(404).json({ error: { message: "Client not found" } });
		}
		const svg = await internalWireguard.getClientQRCode(knex, req.params.id);
		res.set("Content-Type", "image/svg+xml");
		res.status(200).send(svg);
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wireguard/client/:id/configuration.zip
 * Download WireGuard client configuration as a ZIP archive
 */
router.get("/client/:id/configuration.zip", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:get");
		const query = knex("wg_client").where("id", req.params.id);
		if (accessData.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			return res.status(404).json({ error: { message: "Client not found" } });
		}
		
		const configStr = await internalWireguard.getClientConfiguration(knex, req.params.id);
		const svgStr = await internalWireguard.getClientQRCode(knex, req.params.id);
		const safeName = client.name.replace(/[^a-zA-Z0-9_.-]/g, "-").substring(0, 32);

		res.set("Content-Disposition", `attachment; filename="${safeName}.zip"`);
		res.set("Content-Type", "application/zip");

		const archive = archiver("zip", { zlib: { level: 9 } });
		archive.on("error", (err) => next(err));
		archive.pipe(res);

		archive.append(configStr, { name: `${safeName}.conf` });
		archive.append(svgStr, { name: `${safeName}-qrcode.svg` });
		
		await archive.finalize();
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wireguard/client/:id/storage
 * Get storage usage for a client
 */
router.get("/client/:id/storage", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:get");
		const query = knex("wg_client").where("id", req.params.id);
		if (accessData.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			return res.status(404).json({ error: { message: "Client not found" } });
		}
		
		const totalBytes = await internalWireguardFs.getClientStorageUsage(client.ipv4_address);
		res.status(200).json({ totalBytes, limitMb: client.storage_limit_mb });
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wireguard/client/:id/logs
 * Get connection history logs for a client
 */
router.get("/client/:id/logs", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:get");
		const query = knex("wg_client").where("id", req.params.id);
		if (accessData.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			return res.status(404).json({ error: { message: "Client not found" } });
		}
		
		const logs = await knex("audit_log")
			.where("object_type", "wireguard-client")
			.andWhere("object_id", req.params.id)
			.orderBy("created_on", "desc")
			.limit(100);
			
		res.status(200).json(logs);
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wireguard/client/:id/files
 * List files for a client
 */
router.get("/client/:id/files", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:get");
		const query = knex("wg_client").where("id", req.params.id);
		if (accessData.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			return res.status(404).json({ error: { message: "Client not found" } });
		}
		
		const files = await internalWireguardFs.listFiles(client.ipv4_address);
		res.status(200).json(files);
	} catch (err) {
		next(err);
	}
});

/**
 * POST /api/wireguard/client/:id/files
 * Upload an encrypted file for a client
 */
router.post("/client/:id/files", async (req, res, next) => {
	try {
		if (!req.files || !req.files.file) {
			return res.status(400).json({ error: { message: "No file uploaded" } });
		}

		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:update");
		const query = knex("wg_client").where("id", req.params.id);
		if (accessData.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			return res.status(404).json({ error: { message: "Client not found" } });
		}
		
		const uploadedFile = req.files.file;

		// Enforce Storage Quota if not unlimited (0)
		if (client.storage_limit_mb > 0) {
			const currentUsageBytes = await internalWireguardFs.getClientStorageUsage(client.ipv4_address);
			const requestedSize = uploadedFile.size;
			const maxBytes = client.storage_limit_mb * 1024 * 1024;
			
			if (currentUsageBytes + requestedSize > maxBytes) {
				return res.status(413).json({ 
					error: { 
						message: `Storage Quota Exceeded. Maximum allowed: ${client.storage_limit_mb} MB.` 
					} 
				});
			}
		}

		const result = await internalWireguardFs.uploadFile(client.ipv4_address, client.private_key, uploadedFile.name, uploadedFile.data);
		
		await internalAuditLog.add(access, {
			action: "uploaded-file",
			object_type: "wireguard-client",
			object_id: client.id,
			meta: { filename: uploadedFile.name }
		});
		
		res.status(200).json(result);
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wireguard/client/:id/files/:filename
 * Download a decrypted file for a client
 */
router.get("/client/:id/files/:filename", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:get");
		const query = knex("wg_client").where("id", req.params.id);
		if (accessData.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			return res.status(404).json({ error: { message: "Client not found" } });
		}
		
		await internalWireguardFs.downloadFile(client.ipv4_address, client.private_key, req.params.filename, res);
	} catch (err) {
		next(err);
	}
});

/**
 * DELETE /api/wireguard/client/:id/files/:filename
 * Delete a file for a client
 */
router.delete("/client/:id/files/:filename", async (req, res, next) => {
	try {
		const knex = db();
		const access = res.locals.access;
		const accessData = await access.can("proxy_hosts:update");
		const query = knex("wg_client").where("id", req.params.id);
		if (accessData.permission_visibility !== "all") {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			return res.status(404).json({ error: { message: "Client not found" } });
		}
		
		const result = await internalWireguardFs.deleteFile(client.ipv4_address, req.params.filename);
		
		await internalAuditLog.add(access, {
			action: "deleted-file",
			object_type: "wireguard-client",
			object_id: client.id,
			meta: { filename: req.params.filename }
		});
		
		res.status(200).json(result);
	} catch (err) {
		next(err);
	}
});

export default router;
