import * as api from "./base";

export interface WgClient {
	id: number;
	name: string;
	enabled: boolean;
	ipv4Address: string;
	publicKey: string;
	allowedIps: string;
	persistentKeepalive: number;
	createdOn: string;
	updatedOn: string;
	expiresAt: string | null;
	interfaceId: number;
	interfaceName: string;
	latestHandshakeAt: string | null;
	endpoint: string | null;
	transferRx: number;
	transferTx: number;
	txLimit: number;
	rxLimit: number;
	storageLimitMb: number;
	storageUsageBytes?: number;
}

export interface WgInterface {
	id: number;
	name: string;
	publicKey: string;
	ipv4Cidr: string;
	listenPort: number;
	mtu: number;
	dns: string;
	host: string | null;
	isolateClients: boolean;
	linkedServers: number[];
	storageUsageBytes?: number;
	clientCount?: number;
}

export async function getWgClients(): Promise<WgClient[]> {
	return await api.get({ url: "/wireguard/client" });
}

export async function getWgInterfaces(): Promise<WgInterface[]> {
	return await api.get({ url: "/wireguard" });
}

export async function createWgInterface(data: { mtu?: number; dns?: string; host?: string; isolate_clients?: boolean; linked_servers?: number[] }): Promise<WgInterface> {
	return await api.post({ url: "/wireguard", data });
}

export async function updateWgInterface(id: number, data: { mtu?: number; dns?: string; host?: string; isolate_clients?: boolean; linked_servers?: number[] }): Promise<WgInterface> {
	return await api.put({ url: `/wireguard/${id}`, data });
}

export async function deleteWgInterface(id: number): Promise<boolean> {
	return await api.del({ url: `/wireguard/${id}` });
}

export async function updateWgInterfaceLinks(id: number, data: { linked_servers: number[] }): Promise<WgInterface> {
	return await api.post({ url: `/wireguard/${id}/links`, data });
}

export async function createWgClient(data: { name: string; interface_id?: number; tx_limit?: number; rx_limit?: number; storage_limit_mb?: number; }): Promise<WgClient> {
	return await api.post({ url: "/wireguard/client", data });
}

export async function updateWgClient(id: number, data: { name?: string; allowed_ips?: string; persistent_keepalive?: number; expires_at?: string; tx_limit?: number; rx_limit?: number; storage_limit_mb?: number; }): Promise<WgClient> {
	return await api.put({ url: `/wireguard/client/${id}`, data });
}

export async function deleteWgClient(id: number): Promise<boolean> {
	return await api.del({ url: `/wireguard/client/${id}` });
}

export async function enableWgClient(id: number): Promise<WgClient> {
	return await api.post({ url: `/wireguard/client/${id}/enable` });
}

export async function disableWgClient(id: number): Promise<WgClient> {
	return await api.post({ url: `/wireguard/client/${id}/disable` });
}

export async function getWgClientConfig(id: number): Promise<string> {
	return await api.get({ url: `/wireguard/client/${id}/configuration` });
}

export function downloadWgConfig(id: number, name: string) {
	return api.download({ url: `/wireguard/client/${id}/configuration` }, `${name}.conf`);
}

export function downloadWgConfigZip(id: number, name: string) {
	return api.download({ url: `/wireguard/client/${id}/configuration.zip` }, `${name}.zip`);
}

export async function getWgClientFiles(id: number): Promise<any[]> {
	return await api.get({ url: `/wireguard/client/${id}/files` });
}

export async function getWgClientStorage(id: number): Promise<{ totalBytes: number; limitMb: number }> {
	return await api.get({ url: `/wireguard/client/${id}/storage` });
}

export async function getWgDashboardStats(): Promise<any> {
	return await api.get({ url: `/wireguard/dashboard` });
}

export async function getWgClientLogs(id: number): Promise<any[]> {
	return await api.get({ url: `/wireguard/client/${id}/logs` });
}

export async function uploadWgClientFile(id: number, file: File): Promise<any> {
	const formData = new FormData();
	formData.append("file", file);
	
	return await api.post({ 
		url: `/wireguard/client/${id}/files`, 
		data: formData 
	});
}

export function downloadWgClientFile(id: number, filename: string) {
	return api.download({ url: `/wireguard/client/${id}/files/${encodeURIComponent(filename)}` }, filename);
}

export async function deleteWgClientFile(id: number, filename: string): Promise<boolean> {
	return await api.del({ url: `/wireguard/client/${id}/files/${encodeURIComponent(filename)}` });
}
