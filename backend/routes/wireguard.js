import express from "express";
import archiver from "archiver";
import internalWireguard from "../internal/wireguard.js";
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

export default router;
