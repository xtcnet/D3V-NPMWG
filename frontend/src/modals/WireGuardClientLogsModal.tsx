import EasyModal, { useModal } from "ez-modal-react";
import { useQuery } from "@tanstack/react-query";
import { Modal, Button, Table, Spinner, Badge } from "react-bootstrap";
import { getWgClientLogs } from "src/api/backend";
import { IconNotes } from "@tabler/icons-react";

interface Props {
	clientId: number;
	clientName: string;
}

const WireGuardClientLogsModal = EasyModal.create(({ clientId, clientName }: Props) => {
	const modal = useModal<any>();

	const { data: logs, isLoading } = useQuery({
		queryKey: ["wg-client-logs", clientId],
		queryFn: () => getWgClientLogs(clientId),
		refetchInterval: 5000
	});

	const handleClose = () => {
		modal.resolve(null);
		modal.hide();
	};

	const formatDate = (dateValue: string | number | undefined) => {
		if (!dateValue) return "Unknown Date";
		try {
			const dateString = String(dateValue);
			let d: Date;
			// If it's pure numbers, it might be an epoch timestamp (ms)
			if (/^\d+$/.test(dateString) && Number(dateString) > 1000000000) {
				d = new Date(Number(dateString));
			} else if (dateString.includes("-") && !dateString.endsWith("Z")) {
				// Ensure UTC parsing from raw SQLite timestamp
				d = new Date(dateString + "Z");
			} else {
				d = new Date(dateString);
			}
			return isNaN(d.getTime()) ? dateString : d.toLocaleString();
		} catch {
			return String(dateValue);
		}
	};

	const parseLogMeta = (metaString: string | any) => {
		try {
			const meta = typeof metaString === 'string' ? JSON.parse(metaString) : metaString;
			if (meta && typeof meta === 'object') {
				// If it's an object with a message, return the message string, else stringify the whole object
				return meta.message ? String(meta.message) : JSON.stringify(meta);
			}
			return typeof meta === 'string' ? meta : JSON.stringify(meta);
		} catch {
			return String(metaString);
		}
	};

	const getActionBadge = (action: string) => {
		switch (action) {
			case "connected":
				return <Badge bg="success">Connected</Badge>;
			case "disconnected":
				return <Badge bg="warning" text="dark">Disconnected</Badge>;
			case "uploaded-file":
				return <Badge bg="info">File Upload</Badge>;
			case "deleted-file":
				return <Badge bg="danger">File Deleted</Badge>;
			default:
				return <Badge bg="secondary">{action}</Badge>;
		}
	};

	return (
		<Modal show={modal.visible} onHide={handleClose} size="lg">
			<Modal.Header closeButton>
				<Modal.Title>
					<IconNotes className="me-2" size={20} />
					Event Logs: {clientName}
				</Modal.Title>
			</Modal.Header>
			<Modal.Body className="p-0">
				{isLoading ? (
					<div className="text-center py-5">
						<Spinner animation="border" variant="primary" />
					</div>
				) : (
					<div className="table-responsive" style={{ maxHeight: "500px" }}>
						<Table hover className="card-table table-vcenter table-nowrap mb-0">
							<thead className="sticky-top bg-white">
								<tr>
									<th>Date / Time</th>
									<th>Event</th>
									<th>Details</th>
								</tr>
							</thead>
							<tbody>
								{logs && logs.length > 0 ? (
									logs.map((log: any) => (
										<tr key={log.id}>
											<td className="text-muted small">
												{formatDate(log.created_on || log.createdOn)}
											</td>
											<td>{getActionBadge(log.action)}</td>
											<td className="small text-muted text-wrap">
												{parseLogMeta(log.meta)}
											</td>
										</tr>
									))
								) : (
									<tr>
										<td colSpan={3} className="text-center py-4 text-muted">
											No events recorded for this client yet.
										</td>
									</tr>
								)}
							</tbody>
						</Table>
					</div>
				)}
			</Modal.Body>
			<Modal.Footer>
				<Button data-bs-dismiss="modal" onClick={handleClose}>
					Close
				</Button>
			</Modal.Footer>
		</Modal>
	);
});

export default WireGuardClientLogsModal;
