import si from "systeminformation";
import express from "express";
import internalReport from "../internal/report.js";
import jwtdecode from "../lib/express/jwt-decode.js";
import { debug, express as logger } from "../logger.js";

const router = express.Router({
	caseSensitive: true,
	strict: true,
	mergeParams: true,
});

router
	.route("/hosts")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())

	/**
	 * GET /reports/hosts
	 */
	.get(async (req, res, next) => {
		try {
			const data = await internalReport.getHostsReport(res.locals.access);
			res.status(200).send(data);
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

	/**
	 * GET /reports/system
	 */
router
	.route("/system")
	.options((_, res) => {
		res.sendStatus(204);
	})
	.all(jwtdecode())
	.get(async (req, res, next) => {
		try {
			const [cpuTotal, memData, networkStats, fsData] = await Promise.all([
				si.currentLoad(),
				si.mem(),
				si.networkStats("*"),
				si.fsSize()
			]);

			// Grab eth0 or the first active interface
			const activeNet = networkStats.find(n => n.operstate === 'up' && n.iface !== 'lo') || networkStats[0] || {};
			
			// Summarize all detected physical drives to find total storage and used storage
			const totalStorage = fsData.reduce((acc, disk) => acc + (disk.size || 0), 0);
			const usedStorage = fsData.reduce((acc, disk) => acc + (disk.used || 0), 0);
			const storagePercent = totalStorage > 0 ? Math.round((usedStorage / totalStorage) * 100) : 0;
			
			res.status(200).json({
				cpu: Math.round(cpuTotal.currentLoad),
				memory: Math.round((memData.active / memData.total) * 100),
				memoryTotal: memData.total,
				memoryActive: memData.active,
				storage: storagePercent,
				storageTotal: totalStorage,
				storageUsed: usedStorage,
				networkRx: (activeNet.rx_sec / 1024 / 1024 * 8).toFixed(2), // Mbps
				networkTx: (activeNet.tx_sec / 1024 / 1024 * 8).toFixed(2), // Mbps
			});
		} catch (err) {
			debug(logger, `${req.method.toUpperCase()} ${req.path}: ${err}`);
			next(err);
		}
	});

export default router;
