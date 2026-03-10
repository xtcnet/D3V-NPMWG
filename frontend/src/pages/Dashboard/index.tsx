import {
	IconArrowsCross,
	IconBolt,
	IconBoltOff,
	IconDisc,
	IconNetwork,
	IconServer,
	IconFolder
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getWgDashboardStats } from "src/api/backend/wireguard";
import { HasPermission } from "src/components";
import { useHostReport } from "src/hooks";
import { T } from "src/locale";
import {
	DEAD_HOSTS,
	PROXY_HOSTS,
	REDIRECTION_HOSTS,
	STREAMS,
	VIEW,
} from "src/modules/Permissions";

function formatBytes(bytes: number | null, unit?: string): string {
	if (bytes === null || bytes === 0) return unit ? `0.00 ${unit}` : "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
	let i: number;
	if (unit) {
		i = sizes.indexOf(unit.toUpperCase());
		if (i === -1) i = Math.floor(Math.log(bytes) / Math.log(k));
	} else {
		i = Math.floor(Math.log(bytes) / Math.log(k));
	}
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

const Dashboard = () => {
	const { data: hostReport } = useHostReport();
	const navigate = useNavigate();

	const { data: wgStats } = useQuery({
		queryKey: ["wg-dashboard-stats"],
		queryFn: getWgDashboardStats,
		refetchInterval: 10000
	});

	return (
		<div>
			<h2>
				<T id="dashboard" />
			</h2>
			<div className="row row-deck row-cards">
				<div className="col-12 my-4">
					<div className="row row-cards">
						<HasPermission section={PROXY_HOSTS} permission={VIEW} hideError>
							<div className="col-sm-6 col-lg-3">
								<a
									href="/nginx/proxy"
									className="card card-sm card-link card-link-pop"
									onClick={(e) => {
										e.preventDefault();
										navigate("/nginx/proxy");
									}}
								>
									<div className="card-body">
										<div className="row align-items-center">
											<div className="col-auto">
												<span className="bg-green text-white avatar">
													<IconBolt />
												</span>
											</div>
											<div className="col">
												<div className="font-weight-medium">
													<T id="proxy-hosts.count" data={{ count: hostReport?.proxy }} />
												</div>
											</div>
										</div>
									</div>
								</a>
							</div>
						</HasPermission>
						<HasPermission section={REDIRECTION_HOSTS} permission={VIEW} hideError>
							<div className="col-sm-6 col-lg-3">
								<a
									href="/nginx/redirection"
									className="card card-sm card-link card-link-pop"
									onClick={(e) => {
										e.preventDefault();
										navigate("/nginx/redirection");
									}}
								>
									<div className="card-body">
										<div className="row align-items-center">
											<div className="col-auto">
												<span className="bg-yellow text-white avatar">
													<IconArrowsCross />
												</span>
											</div>
											<div className="col">
												<T
													id="redirection-hosts.count"
													data={{ count: hostReport?.redirection }}
												/>
											</div>
										</div>
									</div>
								</a>
							</div>
						</HasPermission>
						<HasPermission section={STREAMS} permission={VIEW} hideError>
							<div className="col-sm-6 col-lg-3">
								<a
									href="/nginx/stream"
									className="card card-sm card-link card-link-pop"
									onClick={(e) => {
										e.preventDefault();
										navigate("/nginx/stream");
									}}
								>
									<div className="card-body">
										<div className="row align-items-center">
											<div className="col-auto">
												<span className="bg-blue text-white avatar">
													<IconDisc />
												</span>
											</div>
											<div className="col">
												<T id="streams.count" data={{ count: hostReport?.stream }} />
											</div>
										</div>
									</div>
								</a>
							</div>
						</HasPermission>
						<HasPermission section={DEAD_HOSTS} permission={VIEW} hideError>
							<div className="col-sm-6 col-lg-3">
								<a
									href="/nginx/404"
									className="card card-sm card-link card-link-pop"
									onClick={(e) => {
										e.preventDefault();
										navigate("/nginx/404");
									}}
								>
									<div className="card-body">
										<div className="row align-items-center">
											<div className="col-auto">
												<span className="bg-red text-white avatar">
													<IconBoltOff />
												</span>
											</div>
											<div className="col">
												<T id="dead-hosts.count" data={{ count: hostReport?.dead }} />
											</div>
										</div>
									</div>
								</a>
							</div>
						</HasPermission>
						{/* WireGuard Servers */}
						<div className="col-sm-6 col-lg-3">
							<a
								href="/wireguard"
								className="card card-sm card-link card-link-pop"
								onClick={(e) => {
									e.preventDefault();
									navigate("/wireguard");
								}}
							>
								<div className="card-body">
									<div className="row align-items-center">
										<div className="col-auto">
											<span className="bg-purple text-white avatar">
												<IconServer />
											</span>
										</div>
										<div className="col">
											<div className="font-weight-medium">
												<T id="wireguard-servers.count" data={{ count: hostReport?.wgServers ?? 0 }} />
											</div>
										</div>
									</div>
								</div>
							</a>
						</div>
						{/* WireGuard Clients */}
						<div className="col-sm-6 col-lg-3">
							<a
								href="/wireguard"
								className="card card-sm card-link card-link-pop"
								onClick={(e) => {
									e.preventDefault();
									navigate("/wireguard");
								}}
							>
								<div className="card-body">
									<div className="row align-items-center">
										<div className="col-auto">
											<span className="bg-cyan text-white avatar">
												<IconNetwork />
											</span>
										</div>
										<div className="col">
											<div className="font-weight-medium">
												<T id="wireguard-clients.count" data={{ count: hostReport?.wgClients ?? 0 }} />
											</div>
										</div>
									</div>
								</div>
							</a>
						</div>
					</div>
				</div>
			</div>

			{/* ====== WireGuard Extended Analytics ====== */}
			<div className="mt-4 mb-4">
				<h3 className="mb-3"><IconNetwork className="me-2 text-muted" size={24} />WireGuard Global Analytics</h3>
				<div className="row row-cards">
					<div className="col-sm-6 col-lg-3">
						<div className="card">
							<div className="card-body">
								<div className="d-flex align-items-center">
									<div className="subheader">Total Storage Utilized</div>
								</div>
								<div className="h1 mb-3">{((wgStats?.totalStorageBytes || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB</div>
								<div className="d-flex mb-2">
									<div className="text-muted small"><IconFolder size={14} className="me-1"/> Encrypted Partition Capacity</div>
								</div>
							</div>
						</div>
					</div>
					<div className="col-sm-6 col-lg-3">
						<div className="card">
							<div className="card-body">
								<div className="d-flex align-items-center">
									<div className="subheader">Global Traffic Transfer</div>
								</div>
								<div className="h1 mb-3 text-blue">{formatBytes((wgStats?.totalTransferRx || 0) + (wgStats?.totalTransferTx || 0), "GB")}</div>
								<div className="d-flex mb-2">
									<div className="text-muted small">
										↓ {formatBytes(wgStats?.totalTransferRx || 0, "GB")} | ↑ {formatBytes(wgStats?.totalTransferTx || 0, "GB")}
									</div>
								</div>
							</div>
						</div>
					</div>
					<div className="col-sm-6 col-lg-3">
						<div className="card">
							<div className="card-body">
								<div className="d-flex align-items-center">
									<div className="subheader">Active Connectivity</div>
								</div>
								<div className="h1 mb-3 text-green">{wgStats?.online24h || 0} Clients</div>
								<div className="d-flex mb-2">
									<div className="text-muted small">Online past 24 hours</div>
								</div>
							</div>
						</div>
					</div>
					<div className="col-sm-6 col-lg-3">
						<div className="card">
							<div className="card-body">
								<div className="d-flex align-items-center">
									<div className="subheader">Extended Retention</div>
								</div>
								<div className="h1 mb-3">{wgStats?.online7d || 0} <span className="text-muted fs-4">/ {wgStats?.online30d || 0}</span></div>
								<div className="d-flex mb-2">
									<div className="text-muted small">7 Days / 30 Days Trend</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

		</div>
	);
};

export default Dashboard;
