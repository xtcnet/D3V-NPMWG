import { IconFolder, IconUpload, IconTrash, IconDownload } from "@tabler/icons-react";
import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal, Button, Table, Spinner, Badge, ProgressBar } from "react-bootstrap";
import { getWgClientFiles, getWgClientStorage, uploadWgClientFile, deleteWgClientFile, downloadWgClientFile } from "src/api/backend";
import { showError, showSuccess } from "src/notifications";
import { Loading } from "src/components";

interface Props {
	resolve: (value: boolean) => void;
	clientId: number;
	clientName: string;
	ipv4Address: string;
}

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

export default function WireGuardFileManagerModal({ resolve, clientId, clientName, ipv4Address }: Props) {
	const [visible, setVisible] = useState(true);
	const queryClient = useQueryClient();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const { data: files, isLoading } = useQuery({
		queryKey: ["wg-client-files", clientId],
		queryFn: () => getWgClientFiles(clientId)
	});

	const { data: storageData, refetch: refetchStorage } = useQuery({
		queryKey: ["wg-client-storage", clientId],
		queryFn: () => getWgClientStorage(clientId)
	});

	const uploadMutation = useMutation({
		mutationFn: (file: File) => uploadWgClientFile(clientId, file),
		onSuccess: () => {
			showSuccess("File uploaded and encrypted successfully!");
			queryClient.invalidateQueries({ queryKey: ["wg-client-files", clientId] });
			refetchStorage();
			if (fileInputRef.current) fileInputRef.current.value = "";
		},
		onError: (err: any) => {
			showError(err.message || "Failed to upload file");
		}
	});

	const deleteMutation = useMutation({
		mutationFn: (filename: string) => deleteWgClientFile(clientId, filename),
		onSuccess: () => {
			showSuccess("File deleted successfully!");
			queryClient.invalidateQueries({ queryKey: ["wg-client-files", clientId] });
			refetchStorage();
		},
		onError: (err: any) => {
			showError(err.message || "Failed to delete file");
		}
	});

	const onClose = () => {
		setVisible(false);
		resolve(false);
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		if (e.target.files && e.target.files.length > 0) {
			uploadMutation.mutate(e.target.files[0]);
		}
	};

	const handleDownload = (filename: string) => {
		downloadWgClientFile(clientId, filename);
	};

	const handleDelete = (filename: string) => {
		if (window.confirm(`Are you sure you want to completely delete "${filename}"?`)) {
			deleteMutation.mutate(filename);
		}
	};

	return (
		<Modal show={visible} onHide={onClose} size="lg" backdrop="static">
			<Modal.Header closeButton>
				<Modal.Title>
					<IconFolder className="me-2 text-primary" />
					Secure File Manager
				</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<div className="mb-4">
					<h5 className="mb-1">Client: <strong>{clientName}</strong></h5>
					<p className="text-muted mb-0">Storage Partition: <code>/data/wg_clients/{ipv4Address}/</code></p>
					
					{storageData && (
						<div className="mt-3">
							<div className="d-flex justify-content-between align-items-end mb-1">
								<span className="small fw-bold">Partition Capacity</span>
								<span className="small text-muted">
									{formatBytes(storageData.totalBytes)} / {storageData.limitMb === 0 ? "Unlimited" : formatBytes(storageData.limitMb * 1024 * 1024)}
								</span>
							</div>
							<ProgressBar 
								now={storageData.limitMb === 0 ? 0 : (storageData.totalBytes / (storageData.limitMb * 1024 * 1024)) * 100} 
								variant={storageData.limitMb > 0 && (storageData.totalBytes / (storageData.limitMb * 1024 * 1024)) > 0.9 ? "danger" : "primary"}
								style={{ height: "8px" }}
							/>
						</div>
					)}

					<div className="mt-3">
						<Badge bg="success" className="d-inline-flex align-items-center">
							<span className="me-1">✓</span> AES-256-CBC End-to-End Encryption Active
						</Badge>
					</div>
				</div>

				<div className="d-flex justify-content-between align-items-center mb-3">
					<h5 className="mb-0">Encrypted Files</h5>
					<div>
						<input
							type="file"
							ref={fileInputRef}
							className="d-none"
							onChange={handleFileSelect}
						/>
						<Button
							variant="primary"
							size="sm"
							onClick={() => fileInputRef.current?.click()}
							disabled={uploadMutation.isPending}
						>
							{uploadMutation.isPending ? (
								<Spinner size="sm" className="me-2" />
							) : (
								<IconUpload size={16} className="me-2" />
							)}
							{uploadMutation.isPending ? "Encrypting..." : "Upload File"}
						</Button>
					</div>
				</div>

				<div className="table-responsive border rounded" style={{ maxHeight: "400px", overflowY: "auto" }}>
					<Table striped hover size="sm" className="mb-0">
						<thead className="bg-light sticky-top">
							<tr>
								<th>Filename</th>
								<th>Encrypted Size</th>
								<th>Last Modified</th>
								<th className="text-end">Actions</th>
							</tr>
						</thead>
						<tbody>
							{isLoading ? (
								<tr>
									<td colSpan={4} className="text-center py-5">
										<Loading />
									</td>
								</tr>
							) : files && files.length > 0 ? (
								files.map((file) => (
									<tr key={file.name}>
										<td className="align-middle fw-medium">{file.name}</td>
										<td className="align-middle text-muted">{formatBytes(file.size)}</td>
										<td className="align-middle text-muted">{new Date(file.modified).toLocaleString()}</td>
										<td className="text-end">
											<div className="btn-group btn-group-sm">
												<Button
													variant="outline-primary"
													title="Download & Decrypt"
													onClick={() => handleDownload(file.name)}
												>
													<IconDownload size={16} />
												</Button>
												<Button
													variant="outline-danger"
													title="Delete File"
													onClick={() => handleDelete(file.name)}
													disabled={deleteMutation.isPending}
												>
													<IconTrash size={16} />
												</Button>
											</div>
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan={4} className="text-center py-5 text-muted">
										No files found. The partition is empty.
									</td>
								</tr>
							)}
						</tbody>
					</Table>
				</div>
			</Modal.Body>
			<Modal.Footer>
				<Button variant="secondary" onClick={onClose}>
					Close
				</Button>
			</Modal.Footer>
		</Modal>
	);
}
