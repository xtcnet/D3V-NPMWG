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
}

export interface WgInterface {
	id: number;
	name: string;
	publicKey: string;
	ipv4Cidr: string;
	listenPort: number;
	mtu: number;
	dns: string;
	host: string;
	isolateClients: boolean;
	linkedServers: number[];
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

export async function createWgClient(data: { name: string; interface_id?: number }): Promise<WgClient> {
	return await api.post({ url: "/wireguard/client", data });
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

export async function uploadWgClientFile(id: number, file: File): Promise<any> {
	const formData = new FormData();
	formData.append("file", file);
	
	// Direct fetch to bypass base JSON content-type overrides for multipart formdata
	const token = localStorage.getItem("token");
	const response = await fetch(`/api/wireguard/client/${id}/files`, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`
		},
		body: formData
	});
	
	if (!response.ok) {
		const err = await response.json();
		throw new Error(err.error?.message || "Upload failed");
	}
	
	return await response.json();
}

export function downloadWgClientFile(id: number, filename: string) {
	return api.download({ url: `/wireguard/client/${id}/files/${encodeURIComponent(filename)}` }, filename);
}

export async function deleteWgClientFile(id: number, filename: string): Promise<boolean> {
	return await api.del({ url: `/wireguard/client/${id}/files/${encodeURIComponent(filename)}` });
}
