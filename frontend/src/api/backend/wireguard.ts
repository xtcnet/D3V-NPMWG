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
}

export async function getWgClients(): Promise<WgClient[]> {
	return await api.get({ url: "/wireguard/client" });
}

export async function getWgInterface(): Promise<WgInterface> {
	return await api.get({ url: "/wireguard" });
}

export async function createWgClient(data: { name: string }): Promise<WgClient> {
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
