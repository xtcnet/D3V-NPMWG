import express from "express";
import internalDatabase from "../../internal/database.js";
import jwtdecode from "../../lib/express/jwt-decode.js";
import { debug, express as logger } from "../../logger.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router.use(jwtdecode());

/**
 * Middleware to strictly ensure only Super Admins can access this route
 */
const requireSuperAdmin = async (req, res, next) => {
	try {
		const accessData = await res.locals.access.can("proxy_hosts:list");
		if (!accessData || accessData.permission_visibility !== "all") {
			return res.status(403).json({ error: { message: "Forbidden: Super Admin only" } });
		}
		next();
	} catch (err) {
		next(err);
	}
};

router.use(requireSuperAdmin);

/**
 * GET /api/database/tables
 * List all tables in the database
 */
router.get("/tables", async (req, res, next) => {
	try {
		const tables = await internalDatabase.getTables();
		res.status(200).json(tables);
	} catch (err) {
		debug(logger, `GET ${req.path} error: ${err.message}`);
		next(err);
	}
});

/**
 * GET /api/database/tables/:name
 * Get table schema and data rows
 */
router.get("/tables/:name", async (req, res, next) => {
	try {
		const limit = parseInt(req.query.limit, 10) || 50;
		const offset = parseInt(req.query.offset, 10) || 0;
		const name = req.params.name;

		const data = await internalDatabase.getTableData(name, limit, offset);
		res.status(200).json(data);
	} catch (err) {
		debug(logger, `GET ${req.path} error: ${err.message}`);
		next(err);
	}
});

export default router;
