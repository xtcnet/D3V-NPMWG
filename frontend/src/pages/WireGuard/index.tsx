import {
	IconPlus,
	IconDownload,
	IconQrcode,
	IconPlayerPlay,
	IconPlayerPause,
	IconTrash,
	IconNetwork,
} from "@tabler/icons-react";
import EasyModal from "ez-modal-react";
import { useState } from "react";
import { downloadWgConfig } from "src/api/backend/wireguard";
import { Loading } from "src/components";
import {
	useWgClients,
	useWgInterface,
	useCreateWgClient,
	useDeleteWgClient,
	useToggleWgClient,
} from "src/hooks/useWireGuard";
import WireGuardClientModal from "src/modals/WireGuardClientModal";
import WireGuardQRModal from "src/modals/WireGuardQRModal";

function formatBytes(bytes: number | null): string {
	if (bytes === null || bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function timeAgo(date: string | null): string {
	if (!date) return "Never";
	const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86400)}d ago`;
}

function WireGuard() {
	const { data: clients, isLoading: clientsLoading } = useWgClients();
	const { data: wgInterface, isLoading: ifaceLoading } = useWgInterface();
	const createClient = useCreateWgClient();
	const deleteClient = useDeleteWgClient();
	const toggleClient = useToggleWgClient();
	const [filter, setFilter] = useState("");

	if (clientsLoading || ifaceLoading) {
		return <Loading />;
	}

	const filteredClients = clients?.filter(
		(c) =>
			!filter ||
			c.name.toLowerCase().includes(filter.toLowerCase()) ||
			c.ipv4Address.includes(filter),
	);

	const handleNewClient = async () => {
		const result = (await EasyModal.show(WireGuardClientModal)) as any;
		if (result && result.name) {
			createClient.mutate({ name: result.name });
		}
	};

	const handleDelete = async (id: number, name: string) => {
		if (window.confirm(`Are you sure you want to delete client "${name}"?`)) {
			deleteClient.mutate(id);
		}
	};

	const handleToggle = (id: number, currentlyEnabled: boolean) => {
		toggleClient.mutate({ id, enabled: !currentlyEnabled });
	};

	const handleQR = (id: number, name: string) => {
		EasyModal.show(WireGuardQRModal, { clientId: id, clientName: name });
	};

	const handleDownload = (id: number, name: string) => {
		const cleanName = name.replace(/[^a-zA-Z0-9_.-]/g, "-").substring(0, 32);
		downloadWgConfig(id, cleanName);
	};

	return (
		<div className="container-xl">
			{/* Interface Info Card */}
			<div className="page-header d-print-none">
				<div className="row align-items-center">
					<div className="col-auto">
						<h2 className="page-title">
							<IconNetwork className="me-2" size={28} />
							WireGuard VPN
						</h2>
					</div>
				</div>
			</div>

			{wgInterface && (
				<div className="card mb-3">
					<div className="card-body">
						<div className="row">
							<div className="col-md-3">
								<div className="mb-2">
									<span className="text-muted small">Interface</span>
									<div className="fw-bold">{wgInterface.name}</div>
								</div>
							</div>
							<div className="col-md-3">
								<div className="mb-2">
									<span className="text-muted small">Public Key</span>
									<div
										className="fw-bold text-truncate"
										title={wgInterface.publicKey}
										style={{ maxWidth: 200 }}
									>
										{wgInterface.publicKey}
									</div>
								</div>
							</div>
							<div className="col-md-2">
								<div className="mb-2">
									<span className="text-muted small">Address</span>
									<div className="fw-bold">{wgInterface.ipv4Cidr}</div>
								</div>
							</div>
							<div className="col-md-2">
								<div className="mb-2">
									<span className="text-muted small">Port</span>
									<div className="fw-bold">{wgInterface.listenPort}</div>
								</div>
							</div>
							<div className="col-md-2">
								<div className="mb-2">
									<span className="text-muted small">DNS</span>
									<div className="fw-bold">{wgInterface.dns}</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Clients Card */}
			<div className="card">
				<div className="card-header">
					<div className="row align-items-center w-100">
						<div className="col">
							<h3 className="card-title">
								Clients ({clients?.length || 0})
							</h3>
						</div>
						<div className="col-auto">
							<input
								type="text"
								className="form-control form-control-sm"
								placeholder="Filter..."
								value={filter}
								onChange={(e) => setFilter(e.target.value)}
								style={{ width: 200 }}
							/>
						</div>
						<div className="col-auto">
							<button
								type="button"
								className="btn btn-primary btn-sm"
								onClick={handleNewClient}
								id="wg-new-client-btn"
							>
								<IconPlus size={16} className="me-1" />
								New Client
							</button>
						</div>
					</div>
				</div>
				<div className="table-responsive">
					<table className="table table-vcenter card-table">
						<thead>
							<tr>
								<th>Status</th>
								<th>Name</th>
								<th>IP Address</th>
								<th>Last Handshake</th>
								<th>Transfer ↓</th>
								<th>Transfer ↑</th>
								<th className="text-end">Actions</th>
							</tr>
						</thead>
						<tbody>
							{filteredClients?.map((client) => {
								const isConnected =
									client.latestHandshakeAt &&
									Date.now() - new Date(client.latestHandshakeAt).getTime() <
										3 * 60 * 1000;
								return (
									<tr key={client.id}>
										<td>
											<span
												className={`badge ${
													!client.enabled
														? "bg-secondary"
														: isConnected
															? "bg-success"
															: "bg-warning"
												}`}
											>
												{!client.enabled
													? "Disabled"
													: isConnected
														? "Connected"
														: "Idle"}
											</span>
										</td>
										<td className="fw-bold">{client.name}</td>
										<td>
											<code>{client.ipv4Address}</code>
										</td>
										<td>{timeAgo(client.latestHandshakeAt)}</td>
										<td>{formatBytes(client.transferRx)}</td>
										<td>{formatBytes(client.transferTx)}</td>
										<td className="text-end">
											<div className="btn-group btn-group-sm">
												<button
													type="button"
													className="btn btn-outline-primary"
													title="QR Code"
													onClick={() =>
														handleQR(client.id, client.name)
													}
												>
													<IconQrcode size={16} />
												</button>
												<button
													type="button"
													className="btn btn-outline-primary"
													title="Download Config"
													onClick={() =>
														handleDownload(client.id, client.name)
													}
												>
													<IconDownload size={16} />
												</button>
												<button
													type="button"
													className={`btn ${client.enabled ? "btn-outline-warning" : "btn-outline-success"}`}
													title={
														client.enabled ? "Disable" : "Enable"
													}
													onClick={() =>
														handleToggle(client.id, client.enabled)
													}
												>
													{client.enabled ? (
														<IconPlayerPause size={16} />
													) : (
														<IconPlayerPlay size={16} />
													)}
												</button>
												<button
													type="button"
													className="btn btn-outline-danger"
													title="Delete"
													onClick={() =>
														handleDelete(client.id, client.name)
													}
												>
													<IconTrash size={16} />
												</button>
											</div>
										</td>
									</tr>
								);
							})}
							{(!filteredClients || filteredClients.length === 0) && (
								<tr>
									<td colSpan={7} className="text-center text-muted py-4">
										{filter
											? "No clients match your filter"
											: "No WireGuard clients yet. Click 'New Client' to create one."}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

export default WireGuard;
