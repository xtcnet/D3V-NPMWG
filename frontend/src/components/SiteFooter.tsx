import { useEffect, useState } from "react";
import { IconCpu, IconServer, IconArrowsDownUp, IconDatabase } from "@tabler/icons-react";
import * as api from "../api/backend/base";

export function SiteFooter() {
	const [sysStats, setSysStats] = useState({
		cpu: 0,
		memory: 0,
		memoryTotal: 0,
		memoryActive: 0,
		storage: 0,
		storageTotal: 0,
		storageUsed: 0,
		networkRx: "0.00",
		networkTx: "0.00"
	});

	useEffect(() => {
		let isMounted = true;
		
		const fetchStats = async () => {
			try {
				const data = await api.get({ url: "/reports/system" });
				if (isMounted && data) {
					setSysStats(data);
				}
			} catch (err) {
				// Silently fail polling to prevent console flood
			}
		};

		// Initial fetch
		fetchStats();
		
		// Poll every 1 second
		const interval = setInterval(fetchStats, 1000);
		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, []);

	// Convert bytes to GB string
	const formatGB = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(1);

	return (
		<footer className="footer d-print-none py-3">
			<div className="container-xl">
				<div className="row text-center align-items-center flex-row-reverse">
					<div className="col-lg-auto ms-lg-auto d-flex gap-3 align-items-center text-muted small">
						<div title="CPU Usage" className="d-flex align-items-center gap-1">
							<IconCpu size={16} />
							<span>{sysStats.cpu}%</span>
						</div>
						<div title={`Memory Usage (${formatGB(sysStats.memoryActive)}GB / ${formatGB(sysStats.memoryTotal)}GB)`} className="d-flex align-items-center gap-1">
							<IconServer size={16} />
							<span>{sysStats.memory}% of {Math.round(sysStats.memoryTotal / 1024 / 1024 / 1024)}GB</span>
						</div>
						<div title={`Storage Usage (${formatGB(sysStats.storageUsed)}GB / ${formatGB(sysStats.storageTotal)}GB)`} className="d-flex align-items-center gap-1">
							<IconDatabase size={16} />
							<span>Free {formatGB(sysStats.storageTotal - sysStats.storageUsed)}GB</span>
						</div>
						<div title="Network Bandwidth" className="d-flex align-items-center gap-1">
							<IconArrowsDownUp size={16} />
							<span>↓{sysStats.networkRx} ↑{sysStats.networkTx} Mbps</span>
						</div>
					</div>
					<div className="col-12 col-lg-auto mt-3 mt-lg-0">
						<ul className="list-inline list-inline-dots mb-0">
							<li className="list-inline-item">
								© D3V.AC 2026{" "}
							</li>
						</ul>
					</div>
				</div>
			</div>
		</footer>
	);
}
