import {
	IconPlus,
	IconDownload,
	IconQrcode,
	IconPlayerPlay,
	IconPlayerPause,
	IconTrash,
	IconNetwork,
	IconServer,
	IconEdit,
	IconLink,
	IconZip,
	IconFolder,
} from "@tabler/icons-react";
import EasyModal from "ez-modal-react";
import { useState } from "react";
import { downloadWgConfig, downloadWgConfigZip } from "src/api/backend/wireguard";
import { Loading } from "src/components";
import {
	useWgClients,
	useWgInterfaces,
	useCreateWgInterface,
	useUpdateWgInterface,
	useDeleteWgInterface,
	useUpdateWgInterfaceLinks,
	useCreateWgClient,
	useDeleteWgClient,
	useToggleWgClient,
} from "src/hooks/useWireGuard";
import WireGuardClientModal from "src/modals/WireGuardClientModal";
import WireGuardServerModal from "src/modals/WireGuardServerModal";
import WireGuardLinkedServersModal from "src/modals/WireGuardLinkedServersModal";
import WireGuardQRModal from "src/modals/WireGuardQRModal";
import WireGuardFileManagerModal from "src/modals/WireGuardFileManagerModal";

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
	const { data: interfaces, isLoading: ifacesLoading } = useWgInterfaces();

	const createServer = useCreateWgInterface();
	const updateServer = useUpdateWgInterface();
	const deleteServer = useDeleteWgInterface();
	const updateLinks = useUpdateWgInterfaceLinks();

	const createClient = useCreateWgClient();
	const deleteClient = useDeleteWgClient();
	const toggleClient = useToggleWgClient();

	const [clientFilter, setClientFilter] = useState("");
	const [serverFilter, setServerFilter] = useState("");
	const [selectedServerId, setSelectedServerId] = useState<number | "all">("all");

	if (clientsLoading || ifacesLoading) {
		return <Loading />;
	}

	const filteredInterfaces = interfaces?.filter(
		(i) =>
			!serverFilter ||
			i.name.toLowerCase().includes(serverFilter.toLowerCase()) ||
			i.ipv4Cidr.includes(serverFilter) ||
			(i.host && i.host.toLowerCase().includes(serverFilter.toLowerCase()))
	);

	const filteredClients = clients?.filter((c: any) => {
		// Filter by selected server
		const cInterfaceId = c.interfaceId || c.interface_id;
		if (selectedServerId !== "all" && Number(cInterfaceId) !== selectedServerId) {
			return false;
		}
		// Filter by search text
		if (
			clientFilter &&
			!c.name.toLowerCase().includes(clientFilter.toLowerCase()) &&
			!c.ipv4Address.includes(clientFilter) &&
			!c.interfaceName?.toLowerCase().includes(clientFilter.toLowerCase())
		) {
			return false;
		}
		return true;
	});

	// Server Handlers
	const handleNewServer = async () => {
		const result = (await EasyModal.show(WireGuardServerModal)) as any;
		if (result) {
			createServer.mutate(result);
		}
	};

	const handleEditServer = async (wgInterface: any) => {
		const result = (await EasyModal.show(WireGuardServerModal, { wgInterface })) as any;
		if (result) {
			updateServer.mutate({ id: wgInterface.id, data: result });
		}
	};

	const handleManageLinks = async (wgInterface: any) => {
		if (!interfaces) return;
		const result = (await EasyModal.show(WireGuardLinkedServersModal, { wgInterface, allInterfaces: interfaces })) as any;
		if (result) {
			updateLinks.mutate({ id: wgInterface.id, data: result });
		}
	};

	const handleDeleteServer = async (id: number, name: string) => {
		if (window.confirm(`Are you absolutely sure you want to delete server "${name}"? This will also delete all associated clients and peering links.`)) {
			deleteServer.mutate(id);
		}
	};

	// Client Handlers
	const handleNewClient = async () => {
		if (!interfaces || interfaces.length === 0) {
			alert("Bạn phải tạo một WireGuard Server trước khi tạo Client.");
			return;
		}
		const result = (await EasyModal.show(WireGuardClientModal, { interfaces: interfaces || [] })) as any;
		if (result && result.name && result.interface_id) {
			createClient.mutate({ name: result.name, interface_id: result.interface_id });
		}
	};

	const handleDeleteClient = async (id: number, name: string) => {
		if (window.confirm(`Are you sure you want to delete client "${name}"?`)) {
			deleteClient.mutate(id);
		}
	};

	const handleToggleClient = (id: number, currentlyEnabled: boolean) => {
		toggleClient.mutate({ id, enabled: !currentlyEnabled });
	};

	const handleQR = (id: number, name: string) => {
		EasyModal.show(WireGuardQRModal, { clientId: id, clientName: name });
	};

	const handleDownload = (id: number, name: string) => {
		const cleanName = name.replace(/[^a-zA-Z0-9_.-]/g, "-").substring(0, 32);
		downloadWgConfig(id, cleanName);
	};

	const handleDownloadZip = (id: number, name: string) => {
		const cleanName = name.replace(/[^a-zA-Z0-9_.-]/g, "-").substring(0, 32);
		downloadWgConfigZip(id, cleanName);
	};

	const handleManageFiles = (client: any) => {
		EasyModal.show(WireGuardFileManagerModal, { 
			clientId: client.id, 
			clientName: client.name,
			ipv4Address: client.ipv4Address
		});
	};

	return (
		<div className="container-xl">
			{/* Page Header */}
			<div className="page-header d-print-none">
				<div className="row align-items-center">
					<div className="col">
						<h2 className="page-title">
							<IconNetwork className="me-2" size={28} />
							WireGuard VPN
						</h2>
					</div>
				</div>
			</div>

			{/* ================== SERVERS TABLE ================== */}
			<div className="card mb-4">
				<div className="card-header">
					<h3 className="card-title">
						<IconServer className="me-2" size={20} />
						WireGuard Servers
						<span className="badge bg-blue ms-2">{interfaces?.length || 0}</span>
					</h3>
				</div>
				<div className="table-responsive">
					<div className="p-3 border-bottom d-flex align-items-center justify-content-between">
						<div className="d-flex w-100 flex-column flex-md-row justify-content-between align-items-center">
							<div className="text-muted d-none d-md-block">
								Listing WireGuard Servers
							</div>
							<div className="d-flex flex-wrap gap-2 justify-content-md-end w-100 w-md-auto align-items-center">
								<input
									type="text"
									className="form-control form-control-sm"
									placeholder="Search servers..."
									value={serverFilter}
									onChange={(e) => setServerFilter(e.target.value)}
									style={{ width: 250 }}
								/>
								<button
									type="button"
									className="btn btn-primary btn-sm"
									onClick={handleNewServer}
									id="wg-new-server-btn"
								>
									<IconPlus size={16} className="me-1" />
									New Server
								</button>
							</div>
						</div>
					</div>
					<table className="table table-vcenter table-nowrap card-table">
						<thead>
							<tr>
								<th>Interface</th>
								<th>Subnet</th>
								<th>Port</th>
								<th>Endpoint Host</th>
								<th>Isolation</th>
								<th>Links</th>
								<th className="text-end">Actions</th>
							</tr>
						</thead>
						<tbody>
							{filteredInterfaces?.map((iface) => (
								<tr key={iface.id}>
									<td className="fw-bold">{iface.name}</td>
									<td>
										<code>{iface.ipv4Cidr}</code>
									</td>
									<td>{iface.listenPort}</td>
									<td className="text-muted">{iface.host || "None"}</td>
									<td>
										{iface.isolateClients ? (
											<span className="badge bg-green text-green-fg">Enabled</span>
										) : (
											<span className="badge bg-secondary text-secondary-fg">Disabled</span>
										)}
									</td>
									<td>
										<div className="d-flex align-items-center">
											<span className="badge bg-azure me-2">{iface.linkedServers?.length || 0}</span>
											{iface.linkedServers?.length > 0 && interfaces && (
												<span className="text-muted small">
													({interfaces.filter(i => iface.linkedServers.includes(i.id)).map(i => i.name).join(", ")})
												</span>
											)}
										</div>
									</td>
									<td className="text-end">
										<div className="btn-group btn-group-sm">
											<button
												type="button"
												className="btn btn-outline-primary"
												title="Linked Servers"
												onClick={() => handleManageLinks(iface)}
											>
												<IconLink size={16} />
											</button>
											<button
												type="button"
												className="btn btn-outline-primary"
												title="Edit Server"
												onClick={() => handleEditServer(iface)}
											>
												<IconEdit size={16} />
											</button>
											<button
												type="button"
												className="btn btn-outline-danger"
												title="Delete Server"
												onClick={() => handleDeleteServer(iface.id, iface.name)}
											>
												<IconTrash size={16} />
											</button>
										</div>
									</td>
								</tr>
							))}
							{(!filteredInterfaces || filteredInterfaces.length === 0) && (
								<tr>
									<td colSpan={7} className="text-center text-muted py-5">
										{serverFilter
											? "No servers match your filter"
											: "No WireGuard servers configured. Click 'New Server' to create one."}
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{/* ================== CLIENTS TABLE ================== */}
			<div className="card">
				<div className="card-header">
					<h3 className="card-title">
						<IconNetwork className="me-2" size={20} />
						WireGuard Clients
						<span className="badge bg-green ms-2">{clients?.length || 0}</span>
					</h3>
				</div>
				<div className="table-responsive">
					<div className="p-3 border-bottom d-flex align-items-center justify-content-between">
						<div className="d-flex w-100 flex-column flex-md-row justify-content-between align-items-center">
							<div className="text-muted d-none d-md-block">
								Listing WireGuard Clients
							</div>
							<div className="d-flex flex-wrap gap-2 justify-content-md-end w-100 w-md-auto align-items-center">
								{/* Server filter dropdown */}
								<select
									className="form-select form-select-sm"
									style={{ width: 200 }}
									value={selectedServerId}
									onChange={(e) =>
										setSelectedServerId(e.target.value === "all" ? "all" : Number(e.target.value))
									}
								>
									<option value="all">All Servers</option>
									{interfaces?.map((iface) => (
										<option key={iface.id} value={iface.id}>
											{iface.name}
										</option>
									))}
								</select>
								<input
									type="text"
									className="form-control form-control-sm"
									placeholder="Search clients..."
									value={clientFilter}
									onChange={(e) => setClientFilter(e.target.value)}
									style={{ width: 250 }}
								/>
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
					<table className="table table-vcenter table-nowrap card-table">
						<thead>
							<tr>
								<th>Status</th>
								<th>Name</th>
								<th>Server</th>
								<th>IP Address</th>
								<th>Last Handshake</th>
								<th>Transfer ↓ / ↑</th>
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
											<div className="text-muted">{client.interfaceName || "—"}</div>
										</td>
										<td>
											<code>{client.ipv4Address}</code>
										</td>
										<td>{timeAgo(client.latestHandshakeAt)}</td>
										<td>
											<div className="d-flex flex-column text-muted small">
												<span>↓ {formatBytes(client.transferRx)}</span>
												<span>↑ {formatBytes(client.transferTx)}</span>
											</div>
										</td>
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
													className="btn btn-outline-info"
													title="Manage Secure Files"
													onClick={() =>
														handleManageFiles(client)
													}
												>
													<IconFolder size={16} />
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
													className="btn btn-outline-primary"
													title="Download Config + QR (ZIP)"
													onClick={() =>
														handleDownloadZip(client.id, client.name)
													}
												>
													<IconZip size={16} />
												</button>
												<button
													type="button"
													className={`btn ${client.enabled ? "btn-outline-warning" : "btn-outline-success"}`}
													title={
														client.enabled ? "Disable" : "Enable"
													}
													onClick={() =>
														handleToggleClient(client.id, client.enabled)
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
														handleDeleteClient(client.id, client.name)
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
									<td colSpan={7} className="text-center text-muted py-5">
										{clientFilter || selectedServerId !== "all"
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
