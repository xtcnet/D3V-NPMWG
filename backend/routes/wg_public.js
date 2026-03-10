import express from "express";
import internalWireguardFs from "../internal/wireguard-fs.js";
import db from "../db.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

/**
 * Authenticate WireGuard client by tunnel remote socket IP
 */
const authenticateWgClientIp = async (req, res, next) => {
    let clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || req.ip;
    if (clientIp) {
        if (clientIp.includes("::ffff:")) {
            clientIp = clientIp.split("::ffff:")[1];
        }
        clientIp = clientIp.split(',')[0].trim();
    }
    
    if (!clientIp) {
        return res.status(401).json({ error: { message: "Unknown remote IP address" } });
    }
    
    try {
        const knex = db();
        const client = await knex("wg_client").where("ipv4_address", clientIp).first();
        if (!client) {
            return res.status(401).json({ error: { message: `Unauthorized: IP ${clientIp} does not match any registered WireGuard Client in the Hub Database` } });
        }
        
        req.wgClient = client;
        next();
    } catch (err) {
        next(err);
    }
};

router.use(authenticateWgClientIp);

/**
 * GET /api/wg-public/me
 * Returns connection metrics and identity details dynamically mapped to this IP
 */
router.get("/me", async (req, res, next) => {
    try {
		const totalStorageBytes = await internalWireguardFs.getClientStorageUsage(req.wgClient.ipv4_address);
        res.status(200).json({
            id: req.wgClient.id,
            name: req.wgClient.name,
            ipv4_address: req.wgClient.ipv4_address,
            enabled: !!req.wgClient.enabled,
            rx_limit: req.wgClient.rx_limit,
            tx_limit: req.wgClient.tx_limit,
            storage_limit_mb: req.wgClient.storage_limit_mb,
            transfer_rx: req.wgClient.transfer_rx,
            transfer_tx: req.wgClient.transfer_tx,
			storage_usage_bytes: totalStorageBytes
        });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /api/wg-public/files
 * Fetch encrypted files directory securely
 */
router.get("/files", async (req, res, next) => {
	try {
		const files = await internalWireguardFs.listFiles(req.wgClient.ipv4_address);
		res.status(200).json(files);
	} catch (err) {
		if (err.code === "ENOENT") return res.status(200).json([]);
		next(err);
	}
});

/**
 * POST /api/wg-public/files
 * Upload directly into backend AES storage limits
 */
router.post("/files", async (req, res, next) => {
	try {
		if (!req.files || !req.files.file) {
			return res.status(400).json({ error: { message: "No file provided" } });
		}
		const file = req.files.file;
		
		if (req.wgClient.storage_limit_mb > 0) {
			const existingStorage = await internalWireguardFs.getClientStorageUsage(req.wgClient.ipv4_address);
			if (existingStorage + file.size > req.wgClient.storage_limit_mb * 1024 * 1024) {
				return res.status(413).json({ error: { message: "Storage Quota Exceeded limits assigned by Administrator" } });
			}
		}

		await internalWireguardFs.saveEncryptedFile(req.wgClient.ipv4_address, req.wgClient.pre_shared_key, file.name, file.data);
		res.status(200).json({ success: true, message: "File encrypted and saved safely via your Wireguard IP Auth!" });
	} catch (err) {
		next(err);
	}
});

/**
 * GET /api/wg-public/files/:filename
 * Decrypt stream
 */
router.get("/files/:filename", async (req, res, next) => {
	try {
		const filename = req.params.filename;
		const fileStream = await internalWireguardFs.getDecryptedFileStream(req.wgClient.ipv4_address, req.wgClient.pre_shared_key, filename);
		res.attachment(filename);
		fileStream.pipe(res);
	} catch (err) {
		next(err);
	}
});

/**
 * DELETE /api/wg-public/files/:filename
 */
router.delete("/files/:filename", async (req, res, next) => {
	try {
		const filename = req.params.filename;
		await internalWireguardFs.deleteFile(req.wgClient.ipv4_address, filename);
		res.status(200).json({ success: true, message: "Destroyed safely" });
	} catch (err) {
		next(err);
	}
});

export default router;
