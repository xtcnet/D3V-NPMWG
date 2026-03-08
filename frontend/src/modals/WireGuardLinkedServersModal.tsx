import {
	IconDeviceFloppy,
	IconX,
} from "@tabler/icons-react";
import { useState, useEffect } from "react";
import type { WgInterface } from "src/api/backend/wireguard";

interface WireGuardLinkedServersModalProps {
	wgInterface: WgInterface;
	allInterfaces: WgInterface[];
	onHide?: () => void;
	resolve?: (data: { linked_servers: number[] }) => void;
}

function WireGuardLinkedServersModal({ wgInterface, allInterfaces, onHide, resolve }: WireGuardLinkedServersModalProps) {
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
		if (resolve) {
			resolve({ linked_servers: Array.from(selected) });
		}
		if (onHide) {
			onHide();
		}
	};

	const availableServers = allInterfaces.filter(i => i.id !== wgInterface.id);

	return (
		<div className="modal modal-blur fade show d-block" tabIndex={-1}>
			<div className="modal-dialog modal-dialog-centered" role="document">
				<div className="modal-content">
					<div className="modal-header">
						<h5 className="modal-title">
							Linked Servers for {wgInterface.name}
						</h5>
						<button
							type="button"
							className="btn-close"
							onClick={onHide}
							aria-label="Close"
						></button>
					</div>
					<div className="modal-body">
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
					</div>
					<div className="modal-footer">
						<button
							type="button"
							className="btn btn-link link-secondary me-auto"
							onClick={onHide}
						>
							<IconX size={16} className="me-1" /> Cancel
						</button>
						<button type="button" className="btn btn-primary" onClick={onSave} disabled={availableServers.length === 0 && selected.size === 0}>
							<IconDeviceFloppy size={16} className="me-1" /> Save Links
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default WireGuardLinkedServersModal;
