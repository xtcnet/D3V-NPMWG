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

	const formatDate = (dateString: string) => {
		const d = new Date(dateString);
		return d.toLocaleString();
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
												{formatDate(log.created_on)}
											</td>
											<td>{getActionBadge(log.action)}</td>
											<td className="small text-muted text-wrap">
												{log.meta && log.meta.message ? log.meta.message : JSON.stringify(log.meta)}
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
