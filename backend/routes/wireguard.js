import express from "express";
import internalWireguard from "../internal/wireguard.js";
import db from "../db.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

/**
 * GET /api/wireguard
 * Get WireGuard interfaces info
 */
router.get("/", async (_req, res, next) => {
	try {
		const knex = db();
		const ifaces = await internalWireguard.getInterfacesInfo(knex);
		res.status(200).json(ifaces);
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
		const clients = await internalWireguard.getClients(knex);
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
		const client = await internalWireguard.createClient(knex, req.body);
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
		const client = await knex("wg_client").where("id", req.params.id).first();
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
		const client = await internalWireguard.updateClient(knex, req.params.id, req.body);
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
		const result = await internalWireguard.deleteClient(knex, req.params.id);
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
		const client = await internalWireguard.toggleClient(knex, req.params.id, true);
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
		const client = await internalWireguard.toggleClient(knex, req.params.id, false);
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
		const client = await knex("wg_client").where("id", req.params.id).first();
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
		const svg = await internalWireguard.getClientQRCode(knex, req.params.id);
		res.set("Content-Type", "image/svg+xml");
		res.status(200).send(svg);
	} catch (err) {
		next(err);
	}
});

export default router;
