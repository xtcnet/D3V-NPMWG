import {
	IconDeviceFloppy,
	IconX,
} from "@tabler/icons-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

interface WireGuardServerModalProps {
	wgInterface?: any;
	onHide?: () => void;
	resolve?: (data: any) => void;
}

const WG_DEFAULT_MTU = 1420;
const WG_DEFAULT_DNS = "1.1.1.1, 8.8.8.8";

function WireGuardServerModal({ wgInterface, onHide, resolve }: WireGuardServerModalProps) {
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
		if (resolve) {
			resolve(submitData);
		}
		if (onHide) {
			onHide();
		}
	};

	return (
		<div className="modal modal-blur fade show d-block" tabIndex={-1}>
			<div className="modal-dialog modal-dialog-centered" role="document">
				<form className="modal-content" onSubmit={handleSubmit(onSubmit)}>
					<div className="modal-header">
						<h5 className="modal-title">
							{wgInterface ? `Edit Server: ${wgInterface.name}` : "New WireGuard Server"}
						</h5>
						<button
							type="button"
							className="btn-close"
							onClick={onHide}
							aria-label="Close"
						></button>
					</div>
					<div className="modal-body">
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
					</div>
					<div className="modal-footer">
						<button
							type="button"
							className="btn btn-link link-secondary me-auto"
							onClick={onHide}
						>
							<IconX size={16} className="me-1" /> Cancel
						</button>
						<button type="submit" className="btn btn-primary">
							<IconDeviceFloppy size={16} className="me-1" /> Save
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export default WireGuardServerModal;
