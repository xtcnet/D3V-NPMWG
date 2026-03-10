import EasyModal, { useModal } from "ez-modal-react";
import { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { Button } from "src/components";
import type { WgInterface } from "src/api/backend/wireguard";

interface WireGuardClientModalProps {
	interfaces: WgInterface[];
	defaultInterfaceId?: number;
}

const WireGuardClientModal = EasyModal.create(({ interfaces, defaultInterfaceId }: WireGuardClientModalProps) => {
	const modal = useModal<any>();
	const [name, setName] = useState("");
	const [selectedInterfaceId, setSelectedInterfaceId] = useState<number>(0);
	const [storageLimitMb, setStorageLimitMb] = useState<number>(500);
	const [txLimit, setTxLimit] = useState<number>(0);
	const [rxLimit, setRxLimit] = useState<number>(0);

	useEffect(() => {
		if (defaultInterfaceId) {
			setSelectedInterfaceId(defaultInterfaceId);
		} else if (interfaces && interfaces.length > 0) {
			setSelectedInterfaceId(interfaces[0].id);
		}
	}, [interfaces, defaultInterfaceId]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (name.trim() && selectedInterfaceId) {
			modal.resolve({ 
				name: name.trim(),
				interface_id: selectedInterfaceId,
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
					<Modal.Title>New WireGuard Client</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<div className="mb-3">
						<label htmlFor="wg-client-name" className="form-label required">
							Client Name
						</label>
						<input
							type="text"
							className="form-control"
							id="wg-client-name"
							placeholder="e.g. My Phone, Laptop, ..."
							value={name}
							onChange={(e) => setName(e.target.value)}
							autoFocus
							required
						/>
						<div className="form-text">
							A friendly name to identify this client.
						</div>
					</div>

					{interfaces && interfaces.length > 0 && (
						<div className="mb-3">
							<label htmlFor="wg-server-select" className="form-label required">
								WireGuard Server
							</label>
							<select
								className="form-select"
								id="wg-server-select"
								value={selectedInterfaceId}
								onChange={(e) => setSelectedInterfaceId(Number(e.target.value))}
								required
							>
								{interfaces.map(iface => (
									<option key={iface.id} value={iface.id}>
										{iface.name} ({iface.ipv4Cidr})
									</option>
								))}
							</select>
							<div className="form-text">
								Select which server this client will connect to.
							</div>
						</div>
					)}

					<hr />
					<h5 className="mb-3">Limits & Quotas</h5>
					
					<div className="mb-3">
						<label htmlFor="wg-client-storage" className="form-label required">
							Storage Partition Limit (MB)
						</label>
						<input
							type="number"
							className="form-control"
							id="wg-client-storage"
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
							<label htmlFor="wg-client-tx" className="form-label">
								Upload Bandwidth Limit (Mbps)
							</label>
							<input
								type="number"
								className="form-control"
								id="wg-client-tx"
								value={txLimit}
								onChange={(e) => setTxLimit(Number(e.target.value))}
								min="0"
								step="1"
								required
							/>
							<div className="form-text">Optional. 0 = Unlimited.</div>
						</div>
						<div className="col-md-6 mb-3">
							<label htmlFor="wg-client-rx" className="form-label">
								Download Bandwidth Limit (Mbps)
							</label>
							<input
								type="number"
								className="form-control"
								id="wg-client-rx"
								value={rxLimit}
								onChange={(e) => setRxLimit(Number(e.target.value))}
								min="0"
								step="1"
								required
							/>
							<div className="form-text">Optional. 0 = Unlimited.</div>
						</div>
					</div>

				</Modal.Body>
				<Modal.Footer>
					<Button data-bs-dismiss="modal" onClick={handleClose}>
						Cancel
					</Button>
					<Button type="submit" className="ms-auto btn-primary" disabled={!name.trim() || !selectedInterfaceId}>
						Create Client
					</Button>
				</Modal.Footer>
			</form>
		</Modal>
	);
});

export default WireGuardClientModal;
