import {
	IconDeviceFloppy,
	IconX,
} from "@tabler/icons-react";
import EasyModal, { useModal } from "ez-modal-react";
import { useEffect } from "react";
import Modal from "react-bootstrap/Modal";
import { useForm } from "react-hook-form";
import { Button } from "src/components";

interface WireGuardServerModalProps {
	wgInterface?: any;
}

const WG_DEFAULT_MTU = 1420;
const WG_DEFAULT_DNS = "1.1.1.1, 8.8.8.8";

const WireGuardServerModal = EasyModal.create(({ wgInterface }: WireGuardServerModalProps) => {
	const modal = useModal<any>();
	const {
		register,
		handleSubmit,
		setValue,
		formState: { errors },
	} = useForm({
		defaultValues: {
			host: "",
			dns: WG_DEFAULT_DNS,
			mtu: WG_DEFAULT_MTU,
			isolate_clients: false,
		},
	});

	useEffect(() => {
		if (wgInterface) {
			setValue("host", wgInterface.host || "");
			setValue("dns", wgInterface.dns || WG_DEFAULT_DNS);
			setValue("mtu", wgInterface.mtu || WG_DEFAULT_MTU);
			setValue("isolate_clients", wgInterface.isolateClients || false);
		}
	}, [wgInterface, setValue]);

	const onSubmit = (data: any) => {
		// Convert number types appropriately
		const submitData = {
			...data,
			mtu: Number(data.mtu) || WG_DEFAULT_MTU,
		};
		modal.resolve(submitData);
		modal.hide();
	};

	const handleClose = () => {
		modal.resolve(null);
		modal.hide();
	};

	return (
		<Modal show={modal.visible} onHide={handleClose} backdrop="static">
			<form onSubmit={handleSubmit(onSubmit)}>
				<Modal.Header closeButton>
					<Modal.Title>
						{wgInterface ? `Edit Server: ${wgInterface.name}` : "New WireGuard Server"}
					</Modal.Title>
				</Modal.Header>
				<Modal.Body>
					<div className="mb-3">
						<label className="form-label required">Host / Endpoint IP</label>
						<input
							type="text"
							className={`form-control ${errors.host ? "is-invalid" : ""}`}
							placeholder="e.g., 203.0.113.1"
							{...register("host", { required: "Host IP is required" })}
						/>
						{errors.host && (
							<div className="invalid-feedback">{errors.host.message as string}</div>
						)}
						<small className="form-hint">
							The public IP or hostname domain that clients will use to connect.
						</small>
					</div>
					
					<div className="mb-3">
						<label className="form-label">Client DNS Servers</label>
						<input
							type="text"
							className="form-control"
							placeholder={WG_DEFAULT_DNS}
							{...register("dns")}
						/>
						<small className="form-hint">Comma separated list. Assigned to clients.</small>
					</div>

					<div className="mb-3">
						<label className="form-label">MTU</label>
						<input
							type="number"
							className="form-control"
							placeholder={WG_DEFAULT_MTU.toString()}
							{...register("mtu")}
						/>
					</div>

					<div className="mb-3">
						<label className="form-label">Client Isolation</label>
						<label className="form-check form-switch">
							<input
								className="form-check-input"
								type="checkbox"
								{...register("isolate_clients")}
							/>
							<span className="form-check-label">Prevent clients on this server from communicating with each other</span>
						</label>
					</div>
				</Modal.Body>
				<Modal.Footer>
					<Button type="button" data-bs-dismiss="modal" onClick={handleClose}>
						<IconX size={16} className="me-1" /> Cancel
					</Button>
					<Button type="submit" className="ms-auto btn-primary">
						<IconDeviceFloppy size={16} className="me-1" /> Save
					</Button>
				</Modal.Footer>
			</form>
		</Modal>
	);
});

export default WireGuardServerModal;
