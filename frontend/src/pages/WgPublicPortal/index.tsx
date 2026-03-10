import { useState, useEffect } from "react";
import { IconShieldLock, IconNetwork, IconApi, IconFolders } from "@tabler/icons-react";

function formatBytes(bytes: number | null): string {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function WgPublicPortal() {
    const [client, setClient] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/wg-public/me")
            .then(res => res.json().then(data => ({ status: res.status, data })))
            .then(({ status, data }) => {
                if (status === 200) {
                    setClient(data);
                } else {
                    setError(data.error?.message || "Unauthorized context");
                }
            })
            .catch((e) => setError("Network Error: " + e.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="page page-center bg-dark text-white text-center">
                <h2>Verifying WireGuard Tunnel...</h2>
            </div>
        );
    }

    if (error || !client) {
        return (
            <div className="page page-center bg-dark text-white">
                <div className="container-tight py-4 text-center">
                    <IconShieldLock size={64} className="text-danger mb-4" />
                    <h1 className="text-danger">Access Denied</h1>
                    <p className="text-muted">
                        This portal is restricted to devices actively connected through the WireGuard VPN.<br/>
                        {error}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="page bg-dark text-white" style={{ minHeight: "100vh" }}>
            <div className="container-xl py-4">
                <div className="row justify-content-center">
                    <div className="col-12 col-md-10">
                        <div className="card bg-dark text-light border-secondary mb-4">
                            <div className="card-header border-secondary">
                                <h3 className="card-title text-success d-flex align-items-center">
                                    <IconNetwork className="me-2" />
                                    Secure Intranet Connection Active
                                </h3>
                            </div>
                            <div className="card-body">
                                <div className="row text-center mb-4">
                                    <div className="col-md-3">
                                        <div className="text-muted small">Assigned IP</div>
                                        <h2 className="text-info">{client.ipv4_address}</h2>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="text-muted small">Client Name</div>
                                        <h2 className="text-light">{client.name}</h2>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="text-muted small">Storage Quota</div>
                                        <h2 className="text-warning">
                                            {formatBytes(client.storage_usage_bytes)} / {client.storage_limit_mb ? formatBytes(client.storage_limit_mb * 1024 * 1024) : "Unlimited"}
                                        </h2>
                                    </div>
                                    <div className="col-md-3">
                                        <div className="text-muted small">Traffic Throttle (RX/TX)</div>
                                        <h2 className="text-success">
                                            {client.rx_limit ? formatBytes(client.rx_limit) + "/s" : "Unlimited"} / {client.tx_limit ? formatBytes(client.tx_limit) + "/s" : "Unlimited"}
                                        </h2>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* API Capabilities */}
                        <div className="card bg-dark text-light border-secondary">
                            <div className="card-header border-secondary">
                                <h3 className="card-title d-flex align-items-center">
                                    <IconApi className="me-2" />
                                    REST API Documentation
                                </h3>
                            </div>
                            <div className="card-body">
                                <p className="text-muted mb-4">
                                    You can access your isolated AES-256 encrypted storage partition directly through these headless programmatic endpoints securely.
                                </p>
                                
                                <div className="mb-4">
                                    <h4 className="text-info"><IconFolders size={18} className="me-2"/>List Files</h4>
                                    <code className="d-block p-3 bg-black rounded border border-secondary text-success">
                                        GET http://{window.location.host}/api/wg-public/files
                                    </code>
                                </div>

                                <div className="mb-4">
                                    <h4 className="text-info"><IconFolders size={18} className="me-2"/>Upload File</h4>
                                    <code className="d-block p-3 bg-black rounded border border-secondary text-warning">
                                        curl -F "file=@/path/to/local/file.txt" http://{window.location.host}/api/wg-public/files
                                    </code>
                                </div>

                                <div className="mb-4">
                                    <h4 className="text-info"><IconFolders size={18} className="me-2"/>Download File</h4>
                                    <code className="d-block p-3 bg-black rounded border border-secondary text-primary">
                                        curl -O http://{window.location.host}/api/wg-public/files/filename.txt
                                    </code>
                                </div>

                                <div>
                                    <h4 className="text-info"><IconFolders size={18} className="me-2"/>Delete File</h4>
                                    <code className="d-block p-3 bg-black rounded border border-secondary text-danger">
                                        curl -X DELETE http://{window.location.host}/api/wg-public/files/filename.txt
                                    </code>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
