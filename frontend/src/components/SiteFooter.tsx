import { useEffect, useState } from "react";
import { IconCpu, IconServer, IconArrowsDownUp } from "@tabler/icons-react";
import * as api from "../api/backend/base";

export function SiteFooter() {
	const [sysStats, setSysStats] = useState({
		cpu: 0,
		memory: 0,
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

	return (
		<footer className="footer d-print-none py-3">
			<div className="container-xl">
				<div className="row text-center align-items-center flex-row-reverse">
					<div className="col-lg-auto ms-lg-auto d-flex gap-3 align-items-center text-muted small">
						<div title="CPU Usage" className="d-flex align-items-center gap-1">
							<IconCpu size={16} />
							<span>{sysStats.cpu}%</span>
						</div>
						<div title="Memory Usage" className="d-flex align-items-center gap-1">
							<IconServer size={16} />
							<span>{sysStats.memory}%</span>
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
