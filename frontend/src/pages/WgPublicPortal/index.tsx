import { useState, useEffect, useRef } from "react";
import {
	IconShieldLock, IconNetwork, IconApi, IconFolders,
	IconUpload, IconDownload, IconTrash, IconPencil,
	IconCheck, IconX, IconRefresh, IconFile,
} from "@tabler/icons-react";

function formatBytes(bytes: number | null, unit?: string): string {
	if (bytes === null || bytes === 0) return unit ? `0.00 ${unit}` : "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	let i: number;
	if (unit) {
		i = sizes.indexOf(unit.toUpperCase());
		if (i === -1) i = Math.floor(Math.log(bytes) / Math.log(k));
	} else {
		i = Math.floor(Math.log(bytes) / Math.log(k));
	}
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function formatDate(dateStr: string): string {
	const d = new Date(dateStr);
	return d.toLocaleString();
}

interface FileEntry {
	name: string;
	size: number;
	created: string;
	modified: string;
}

interface RenameState {
	oldName: string;
	newName: string;
}

export default function WgPublicPortal() {
	const [client, setClient] = useState<any>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const [files, setFiles] = useState<FileEntry[]>([]);
	const [filesLoading, setFilesLoading] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [renaming, setRenaming] = useState<RenameState | null>(null);
	const [actionError, setActionError] = useState("");

	const fileInputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		fetch("/api/wg-public/me")
			.then(res => res.json().then(data => ({ status: res.status, data })))
			.then(({ status, data }) => {
				if (status === 200) {
					setClient(data);
					loadFiles();
				} else {
					setError(data.error?.message || "Unauthorized context");
				}
			})
			.catch((e) => setError("Network Error: " + e.message))
			.finally(() => setLoading(false));
	}, []);

	const loadFiles = async () => {
		setFilesLoading(true);
		setActionError("");
		try {
			const res = await fetch("/api/wg-public/files");
			const data = await res.json();
			setFiles(Array.isArray(data) ? data : []);
		} catch (e: any) {
			setActionError("Failed to load files: " + e.message);
		}
		setFilesLoading(false);
	};

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setUploading(true);
		setActionError("");
		try {
			const formData = new FormData();
			formData.append("file", file);
			const res = await fetch("/api/wg-public/files", { method: "POST", body: formData });
			const data = await res.json();
			if (!res.ok) {
				setActionError(data.error?.message || "Upload failed");
			} else {
				await loadFiles();
			}
		} catch (e: any) {
			setActionError("Upload error: " + e.message);
		}
		setUploading(false);
		e.target.value = "";
	};

	const handleDownload = (filename: string) => {
		window.open(`/api/wg-public/files/${encodeURIComponent(filename)}`, "_blank");
	};

	const handleDelete = async (filename: string) => {
		if (!window.confirm(`Delete "${filename}"?`)) return;
		setActionError("");
		try {
			const res = await fetch(`/api/wg-public/files/${encodeURIComponent(filename)}`, { method: "DELETE" });
			const data = await res.json();
			if (!res.ok) {
				setActionError(data.error?.message || "Delete failed");
			} else {
				await loadFiles();
			}
		} catch (e: any) {
			setActionError("Delete error: " + e.message);
		}
	};

	const handleRenameConfirm = async () => {
		if (!renaming) return;
		const { oldName, newName } = renaming;
		if (!newName.trim() || newName.trim() === oldName) {
			setRenaming(null);
			return;
		}
		setActionError("");
		try {
			const res = await fetch(`/api/wg-public/files/${encodeURIComponent(oldName)}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newName.trim() }),
			});
			const data = await res.json();
			if (!res.ok) {
				setActionError(data.error?.message || "Rename failed");
			} else {
				setRenaming(null);
				await loadFiles();
			}
		} catch (e: any) {
			setActionError("Rename error: " + e.message);
		}
	};

	if (loading) {
		return (
			<div className="page page-center bg-dark text-white text-center">
				<h2>Verifying WireGuard Tunnel...</h2>
			</div>
		);
	}

	if (error || !client) {
		return (
			<div className="page page-center bg-dark text-white">
				<div className="container-tight py-4 text-center">
					<IconShieldLock size={64} className="text-danger mb-4" />
					<h1 className="text-danger">Access Denied</h1>
					<p className="text-muted">
						This portal is restricted to devices actively connected through the WireGuard VPN.<br />
						{error}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="page bg-dark text-white" style={{ minHeight: "100vh" }}>
			<div className="container-xl py-4">
				<div className="row justify-content-center">
					<div className="col-12 col-md-10">

						{/* Connection Info */}
						<div className="card bg-dark text-light border-secondary mb-4">
							<div className="card-header border-secondary">
								<h3 className="card-title text-success d-flex align-items-center">
									<IconNetwork className="me-2" />
									Secure Intranet Connection Active
								</h3>
							</div>
							<div className="card-body">
								<div className="row text-center mb-4">
									<div className="col-md-3">
										<div className="text-muted small">Assigned IP</div>
										<h2 className="text-info">{client.ipv4_address}</h2>
									</div>
									<div className="col-md-3">
										<div className="text-muted small">Client Name</div>
										<h2 className="text-light">{client.name}</h2>
									</div>
									<div className="col-md-3">
										<div className="text-muted small">Storage Quota</div>
										<h2 className="text-warning">
											{formatBytes(client.storage_usage_bytes)} / {client.storage_limit_mb ? formatBytes(client.storage_limit_mb * 1024 * 1024) : "Unlimited"}
										</h2>
									</div>
									<div className="col-md-3">
										<div className="text-muted small">Traffic Throttle (RX/TX)</div>
										<h2 className="text-success">
											{client.rx_limit ? formatBytes(client.rx_limit) + "/s" : "Unlimited"} / {client.tx_limit ? formatBytes(client.tx_limit) + "/s" : "Unlimited"}
										</h2>
									</div>
								</div>
							</div>
						</div>

						{/* File Manager */}
						<div className="card bg-dark text-light border-secondary mb-4">
							<div className="card-header border-secondary d-flex align-items-center justify-content-between">
								<h3 className="card-title d-flex align-items-center mb-0">
									<IconFolders className="me-2" />
									File Manager
								</h3>
								<div className="d-flex gap-2">
									<button
										className="btn btn-sm btn-outline-secondary"
										onClick={loadFiles}
										disabled={filesLoading}
										title="Refresh"
									>
										<IconRefresh size={16} className={filesLoading ? "spin" : ""} />
									</button>
									<input
										ref={fileInputRef}
										type="file"
										className="d-none"
										onChange={handleUpload}
									/>
									<button
										className="btn btn-sm btn-success"
										onClick={() => fileInputRef.current?.click()}
										disabled={uploading}
									>
										<IconUpload size={16} className="me-1" />
										{uploading ? "Uploading..." : "Upload"}
									</button>
								</div>
							</div>
							<div className="card-body p-0">
								{actionError && (
									<div className="alert alert-danger m-3 mb-0 py-2">
										{actionError}
									</div>
								)}
								<div className="table-responsive">
									<table className="table table-dark table-hover table-sm mb-0">
										<thead>
											<tr>
												<th style={{ width: 32 }}></th>
												<th>Name</th>
												<th style={{ width: 100 }}>Size</th>
												<th style={{ width: 180 }}>Modified</th>
												<th style={{ width: 120 }} className="text-end">Actions</th>
											</tr>
										</thead>
										<tbody>
											{filesLoading ? (
												<tr>
													<td colSpan={5} className="text-center text-muted py-4">
														Loading...
													</td>
												</tr>
											) : files.length === 0 ? (
												<tr>
													<td colSpan={5} className="text-center text-muted py-4">
														No files yet. Upload your first file.
													</td>
												</tr>
											) : (
												files.map((file) => (
													<tr key={file.name}>
														<td className="text-muted ps-3">
															<IconFile size={16} />
														</td>
														<td>
															{renaming?.oldName === file.name ? (
																<div className="d-flex align-items-center gap-1">
																	<input
																		type="text"
																		className="form-control form-control-sm bg-dark text-white border-secondary"
																		value={renaming.newName}
																		autoFocus
																		onChange={(e) => setRenaming({ ...renaming, newName: e.target.value })}
																		onKeyDown={(e) => {
																			if (e.key === "Enter") handleRenameConfirm();
																			if (e.key === "Escape") setRenaming(null);
																		}}
																		style={{ maxWidth: 260 }}
																	/>
																	<button className="btn btn-sm btn-success p-1" onClick={handleRenameConfirm} title="Confirm">
																		<IconCheck size={14} />
																	</button>
																	<button className="btn btn-sm btn-secondary p-1" onClick={() => setRenaming(null)} title="Cancel">
																		<IconX size={14} />
																	</button>
																</div>
															) : (
																<span className="text-light">{file.name}</span>
															)}
														</td>
														<td className="text-muted small">{formatBytes(file.size)}</td>
														<td className="text-muted small">{formatDate(file.modified)}</td>
														<td className="text-end pe-3">
															<div className="d-flex gap-1 justify-content-end">
																<button
																	className="btn btn-sm btn-outline-primary p-1"
																	onClick={() => handleDownload(file.name)}
																	title="Download"
																>
																	<IconDownload size={14} />
																</button>
																<button
																	className="btn btn-sm btn-outline-warning p-1"
																	onClick={() => setRenaming({ oldName: file.name, newName: file.name })}
																	title="Rename"
																	disabled={!!renaming}
																>
																	<IconPencil size={14} />
																</button>
																<button
																	className="btn btn-sm btn-outline-danger p-1"
																	onClick={() => handleDelete(file.name)}
																	title="Delete"
																>
																	<IconTrash size={14} />
																</button>
															</div>
														</td>
													</tr>
												))
											)}
										</tbody>
									</table>
								</div>
							</div>
						</div>

						{/* REST API Documentation */}
						<div className="card bg-dark text-light border-secondary">
							<div className="card-header border-secondary">
								<h3 className="card-title d-flex align-items-center">
									<IconApi className="me-2" />
									REST API Documentation
								</h3>
							</div>
							<div className="card-body">
								<p className="text-muted mb-4">
									You can access your isolated AES-256 encrypted storage partition directly through these headless programmatic endpoints securely.
								</p>

								<div className="mb-4">
									<h4 className="text-info"><IconFolders size={18} className="me-2" />List Files</h4>
									<code className="d-block p-3 bg-black rounded border border-secondary text-success">
										GET http://{window.location.host}/api/wg-public/files
									</code>
								</div>

								<div className="mb-4">
									<h4 className="text-info"><IconFolders size={18} className="me-2" />Upload File</h4>
									<code className="d-block p-3 bg-black rounded border border-secondary text-warning">
										curl -F "file=@/path/to/local/file.txt" http://{window.location.host}/api/wg-public/files
									</code>
								</div>

								<div className="mb-4">
									<h4 className="text-info"><IconFolders size={18} className="me-2" />Download File</h4>
									<code className="d-block p-3 bg-black rounded border border-secondary text-primary">
										curl -O http://{window.location.host}/api/wg-public/files/filename.txt
									</code>
								</div>

								<div className="mb-4">
									<h4 className="text-info"><IconFolders size={18} className="me-2" />Rename File</h4>
									<code className="d-block p-3 bg-black rounded border border-secondary text-warning">
										{`curl -X PATCH -H "Content-Type: application/json" -d '{"name":"newname.txt"}' http://${window.location.host}/api/wg-public/files/oldname.txt`}
									</code>
								</div>

								<div>
									<h4 className="text-info"><IconFolders size={18} className="me-2" />Delete File</h4>
									<code className="d-block p-3 bg-black rounded border border-secondary text-danger">
										curl -X DELETE http://{window.location.host}/api/wg-public/files/filename.txt
									</code>
								</div>
							</div>
						</div>

					</div>
				</div>
			</div>
		</div>
	);
}
