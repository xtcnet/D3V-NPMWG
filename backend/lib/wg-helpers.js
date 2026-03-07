import { spawn } from "child_process";

/**
 * Execute a shell command and return stdout
 */
export function exec(cmd) {
	return new Promise((resolve, reject) => {
		const child = spawn("bash", ["-c", cmd], {
			stdio: ["pipe", "pipe", "pipe"],
		});
		let stdout = "";
		let stderr = "";
		child.stdout.on("data", (data) => {
			stdout += data.toString();
		});
		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});
		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`Command failed (exit ${code}): ${cmd}\n${stderr}`));
			} else {
				resolve(stdout.trim());
			}
		});
		child.on("error", reject);
	});
}

/**
 * Generate a WireGuard private key
 */
export async function generatePrivateKey() {
	return exec("wg genkey");
}

/**
 * Derive a public key from a private key
 */
export async function getPublicKey(privateKey) {
	return exec(`echo ${privateKey} | wg pubkey`);
}

/**
 * Generate a pre-shared key
 */
export async function generatePreSharedKey() {
	return exec("wg genpsk");
}

/**
 * Bring up the WireGuard interface
 */
export async function wgUp(interfaceName) {
	return exec(`wg-quick up ${interfaceName}`);
}

/**
 * Bring down the WireGuard interface
 */
export async function wgDown(interfaceName) {
	return exec(`wg-quick down ${interfaceName}`);
}

/**
 * Sync WireGuard config without restarting
 */
export async function wgSync(interfaceName) {
	return exec(`wg syncconf ${interfaceName} <(wg-quick strip ${interfaceName})`);
}

/**
 * Get WireGuard status dump
 * Returns array of peer objects
 */
export async function wgDump(interfaceName) {
	const rawDump = await exec(`wg show ${interfaceName} dump`);
	return rawDump
		.trim()
		.split("\n")
		.slice(1) // skip interface line
		.map((line) => {
			const [publicKey, preSharedKey, endpoint, allowedIps, latestHandshakeAt, transferRx, transferTx, persistentKeepalive] = line.split("\t");
			return {
				publicKey,
				preSharedKey,
				endpoint: endpoint === "(none)" ? null : endpoint,
				allowedIps,
				latestHandshakeAt: latestHandshakeAt === "0" ? null : new Date(Number.parseInt(`${latestHandshakeAt}000`)),
				transferRx: Number.parseInt(transferRx),
				transferTx: Number.parseInt(transferTx),
				persistentKeepalive,
			};
		});
}

/**
 * Generate the [Interface] section for the server config
 */
export function generateServerInterface({ privateKey, address, listenPort, mtu, dns, postUp, postDown }) {
	const lines = ["[Interface]", `PrivateKey = ${privateKey}`, `Address = ${address}`, `ListenPort = ${listenPort}`];
	if (mtu) lines.push(`MTU = ${mtu}`);
	if (dns) lines.push(`DNS = ${dns}`);
	if (postUp) lines.push(`PostUp = ${postUp}`);
	if (postDown) lines.push(`PostDown = ${postDown}`);
	return lines.join("\n");
}

/**
 * Generate a [Peer] section for the server config
 */
export function generateServerPeer({ publicKey, preSharedKey, allowedIps }) {
	const lines = ["[Peer]", `PublicKey = ${publicKey}`, `PresharedKey = ${preSharedKey}`, `AllowedIPs = ${allowedIps}`];
	return lines.join("\n");
}

/**
 * Generate complete client config file
 */
export function generateClientConfig({ clientPrivateKey, clientAddress, dns, mtu, serverPublicKey, preSharedKey, allowedIps, persistentKeepalive, endpoint }) {
	const lines = [
		"[Interface]",
		`PrivateKey = ${clientPrivateKey}`,
		`Address = ${clientAddress}`,
	];
	if (mtu) lines.push(`MTU = ${mtu}`);
	if (dns) lines.push(`DNS = ${dns}`);
	lines.push("", "[Peer]", `PublicKey = ${serverPublicKey}`, `PresharedKey = ${preSharedKey}`, `AllowedIPs = ${allowedIps}`, `PersistentKeepalive = ${persistentKeepalive}`, `Endpoint = ${endpoint}`);
	return lines.join("\n");
}

/**
 * Simple QR code generator (outputs SVG via qrencode)
 */
export async function generateQRCodeSVG(text) {
	return exec(`echo -n '${text.replace(/'/g, "'\\''")}' | qrencode -t SVG -o -`);
}

/**
 * Parse a CIDR string and return the network details
 */
export function parseCIDR(cidr) {
	const [ip, prefix] = cidr.split("/");
	const prefixLen = Number.parseInt(prefix, 10);
	const parts = ip.split(".").map(Number);
	const ipNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
	const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;
	const networkNum = (ipNum & mask) >>> 0;
	const broadcastNum = (networkNum | ~mask) >>> 0;
	return {
		network: numToIp(networkNum),
		broadcast: numToIp(broadcastNum),
		firstHost: numToIp(networkNum + 1),
		lastHost: numToIp(broadcastNum - 1),
		prefix: prefixLen,
		networkNum,
		broadcastNum,
	};
}

function numToIp(num) {
	return `${(num >>> 24) & 255}.${(num >>> 16) & 255}.${(num >>> 8) & 255}.${num & 255}`;
}

/**
 * Find next available IP in a CIDR range given existing allocated IPs
 * The first IP (network+1) is reserved for the server
 */
export function findNextAvailableIP(cidr, allocatedIPs) {
	const parsed = parseCIDR(cidr);
	// Start from network+2 (network+1 is server)
	const startIP = parsed.networkNum + 2;
	const endIP = parsed.broadcastNum - 1;
	const allocatedSet = new Set(allocatedIPs);

	for (let ip = startIP; ip <= endIP; ip++) {
		const ipStr = numToIp(ip);
		if (!allocatedSet.has(ipStr)) {
			return ipStr;
		}
	}
	throw new Error("No available IP addresses in the CIDR range");
}
