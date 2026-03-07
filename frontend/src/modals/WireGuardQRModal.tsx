import EasyModal, { useModal } from "ez-modal-react";
import { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import { Button } from "src/components";
import AuthStore from "src/modules/AuthStore";

interface WireGuardQRModalProps {
	clientId: number;
	clientName: string;
}

const WireGuardQRModal = EasyModal.create((props: WireGuardQRModalProps) => {
	const modal = useModal();
	const [svgContent, setSvgContent] = useState<string>("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const fetchQR = async () => {
			try {
				const headers: Record<string, string> = {};
				if (AuthStore.token) {
					headers.Authorization = `Bearer ${AuthStore.token.token}`;
				}
				const res = await fetch(
					`/api/wireguard/client/${props.clientId}/qrcode.svg`,
					{ headers },
				);
				if (!res.ok) {
					throw new Error("Failed to load QR code");
				}
				const svg = await res.text();
				setSvgContent(svg);
			} catch (err: any) {
				setError(err.message || "Failed to load QR code");
			} finally {
				setLoading(false);
			}
		};
		fetchQR();
	}, [props.clientId]);

	return (
		<Modal show={modal.visible} onHide={() => modal.hide()} centered size="sm" backdrop="static">
			<Modal.Header closeButton>
				<Modal.Title>QR Code: {props.clientName}</Modal.Title>
			</Modal.Header>
			<Modal.Body className="text-center">
				{loading && (
					<div className="py-4">
						<div className="spinner-border text-primary" role="status" />
						<div className="mt-2 text-muted">Loading QR Code...</div>
					</div>
				)}
				{error && (
					<div className="alert alert-warning">
						<p>{error}</p>
						<small className="text-muted">
							QR code generation requires qrencode to be installed in the
							container. You can still download the configuration file.
						</small>
					</div>
				)}
				{!loading && !error && svgContent && (
					<div
						dangerouslySetInnerHTML={{ __html: svgContent }}
						style={{ maxWidth: "100%" }}
					/>
				)}
				<div className="mt-2 text-muted small">
					Scan this QR code with the WireGuard app on your device.
				</div>
			</Modal.Body>
			<Modal.Footer>
				<Button data-bs-dismiss="modal" onClick={() => modal.hide()}>
					Close
				</Button>
			</Modal.Footer>
		</Modal>
	);
});

export default WireGuardQRModal;
