import EasyModal, { useModal } from "ez-modal-react";
import { useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Button } from "src/components";

const WireGuardClientModal = EasyModal.create(() => {
	const modal = useModal<any>();
	const [name, setName] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (name.trim()) {
			modal.resolve({ name: name.trim() });
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
						<label htmlFor="wg-client-name" className="form-label">
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
				</Modal.Body>
				<Modal.Footer>
					<Button data-bs-dismiss="modal" onClick={handleClose}>
						Cancel
					</Button>
					<Button type="submit" className="ms-auto btn-primary" disabled={!name.trim()}>
						Create Client
					</Button>
				</Modal.Footer>
			</form>
		</Modal>
	);
});

export default WireGuardClientModal;
