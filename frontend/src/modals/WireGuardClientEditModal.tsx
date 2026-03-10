import EasyModal, { useModal } from "ez-modal-react";
import { useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Button } from "src/components";
import type { WgClient } from "src/api/backend/wireguard";

interface WireGuardClientEditModalProps {
	client: WgClient;
}

const WireGuardClientEditModal = EasyModal.create(({ client }: WireGuardClientEditModalProps) => {
	const modal = useModal<any>();
	const [name, setName] = useState(client.name);
	const [storageLimitMb, setStorageLimitMb] = useState<number>(client.storageLimitMb ?? 500);
	const [txLimit, setTxLimit] = useState<number>(client.txLimit ? client.txLimit / 125000 : 0);
	const [rxLimit, setRxLimit] = useState<number>(client.rxLimit ? client.rxLimit / 125000 : 0);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (name.trim()) {
			modal.resolve({ 
				name: name.trim(),
				storage_limit_mb: storageLimitMb,
				tx_limit: txLimit * 125000,
				rx_limit: rxLimit * 125000
			});
			modal.hide();
		}
	};

	const handleClose = () => {
		modal.resolve(null);
		modal.hide();
	};

	return (
		<Modal show={modal.visible} onHide={handleClose} backdrop="static">
			<form onSubmit={(e) => {
				e.stopPropagation();
				handleSubmit(e);
			}}>
				<Modal.Header closeButton>
					<Modal.Title>Edit Client: {client.name}</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<div className="mb-3">
						<label htmlFor="wg-edit-name" className="form-label required">
							Client Name
						</label>
						<input
							type="text"
							className="form-control"
							id="wg-edit-name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
						/>
					</div>

					<hr />
					<h5 className="mb-3">Limits & Quotas</h5>
					
					<div className="mb-3">
						<label htmlFor="wg-edit-storage" className="form-label required">
							Storage Partition Limit (MB)
						</label>
						<input
							type="number"
							className="form-control"
							id="wg-edit-storage"
							value={storageLimitMb}
							onChange={(e) => setStorageLimitMb(Number(e.target.value))}
							min="0"
							required
						/>
						<div className="form-text">
							Maximum size of encrypted file storage per client. 0 = Unlimited.
						</div>
					</div>

					<div className="row">
						<div className="col-md-6 mb-3">
							<label htmlFor="wg-edit-tx" className="form-label">
								Upload Bandwidth Limit (Mbps)
							</label>
							<input
								type="number"
								className="form-control"
								id="wg-edit-tx"
								value={txLimit}
								onChange={(e) => setTxLimit(Number(e.target.value))}
								min="0"
								step="1"
								required
							/>
							<div className="form-text">0 = Unlimited.</div>
						</div>
						<div className="col-md-6 mb-3">
							<label htmlFor="wg-edit-rx" className="form-label">
								Download Bandwidth Limit (Mbps)
							</label>
							<input
								type="number"
								className="form-control"
								id="wg-edit-rx"
								value={rxLimit}
								onChange={(e) => setRxLimit(Number(e.target.value))}
								min="0"
								step="1"
								required
							/>
							<div className="form-text">0 = Unlimited.</div>
						</div>
					</div>

				</Modal.Body>
				<Modal.Footer>
					<Button data-bs-dismiss="modal" onClick={handleClose}>
						Cancel
					</Button>
					<Button type="submit" className="ms-auto btn-primary" disabled={!name.trim()}>
						Save Modifications
					</Button>
				</Modal.Footer>
			</form>
		</Modal>
	);
});

export default WireGuardClientEditModal;
