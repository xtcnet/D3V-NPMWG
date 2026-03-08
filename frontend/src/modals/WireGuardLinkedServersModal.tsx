import {
	IconDeviceFloppy,
	IconX,
} from "@tabler/icons-react";
import EasyModal, { useModal } from "ez-modal-react";
import { useState, useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import type { WgInterface } from "src/api/backend/wireguard";
import { Button } from "src/components";

interface WireGuardLinkedServersModalProps {
	wgInterface: WgInterface;
	allInterfaces: WgInterface[];
}

const WireGuardLinkedServersModal = EasyModal.create(({ wgInterface, allInterfaces }: WireGuardLinkedServersModalProps) => {
	const modal = useModal<any>();
	// A map or set to manage checked status easily
	const [selected, setSelected] = useState<Set<number>>(new Set());

	useEffect(() => {
		if (wgInterface && wgInterface.linkedServers) {
			setSelected(new Set(wgInterface.linkedServers));
		}
	}, [wgInterface]);

	const toggleServer = (id: number) => {
		const newSelected = new Set(selected);
		if (newSelected.has(id)) {
			newSelected.delete(id);
		} else {
			newSelected.add(id);
		}
		setSelected(newSelected);
	};

	const onSave = () => {
		modal.resolve({ linked_servers: Array.from(selected) });
		modal.hide();
	};

	const handleClose = () => {
		modal.resolve(null);
		modal.hide();
	};

	const availableServers = allInterfaces.filter(i => i.id !== wgInterface.id);

	return (
		<Modal show={modal.visible} onHide={handleClose} backdrop="static">
			<Modal.Header closeButton>
				<Modal.Title>
					Linked Servers for {wgInterface.name}
				</Modal.Title>
			</Modal.Header>
			<Modal.Body>
				<p className="text-muted mb-3">
					Select the WireGuard servers that clients from <strong>{wgInterface.name}</strong> will be allowed to communicate with.
				</p>

				{availableServers.length === 0 ? (
					<div className="alert alert-info border-0 mb-0">
						There are no other servers available to link to.
					</div>
				) : (
					<div className="list-group list-group-flush mb-3">
						{availableServers.map(server => (
							<label key={server.id} className="list-group-item d-flex align-items-center cursor-pointer px-0">
								<input
									className="form-check-input mt-0 me-3"
									type="checkbox"
									checked={selected.has(server.id)}
									onChange={() => toggleServer(server.id)}
								/>
								<div className="flex-grow-1">
									<div><strong>{server.name}</strong></div>
									<div className="text-muted small border border-light border-1 bg-light rounded mt-1 p-1 d-inline-block">
										Subnet: {server.ipv4Cidr}
									</div>
								</div>
							</label>
						))}
					</div>
				)}
			</Modal.Body>
			<Modal.Footer>
				<Button type="button" data-bs-dismiss="modal" onClick={handleClose}>
					<IconX size={16} className="me-1" /> Cancel
				</Button>
				<Button type="button" className="ms-auto btn-primary" onClick={onSave} disabled={availableServers.length === 0 && selected.size === 0}>
					<IconDeviceFloppy size={16} className="me-1" /> Save Links
				</Button>
			</Modal.Footer>
		</Modal>
	);
});

export default WireGuardLinkedServersModal;
