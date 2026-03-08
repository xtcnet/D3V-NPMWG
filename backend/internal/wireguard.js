import fs from "fs";
import { global as logger } from "../logger.js";
import * as wgHelpers from "../lib/wg-helpers.js";

const WG_INTERFACE_NAME = process.env.WG_INTERFACE_NAME || "wg0";
const WG_DEFAULT_PORT = Number.parseInt(process.env.WG_PORT || "51820", 10);
const WG_DEFAULT_MTU = Number.parseInt(process.env.WG_MTU || "1420", 10);
const WG_DEFAULT_ADDRESS = process.env.WG_DEFAULT_ADDRESS || "10.8.0.0/24";
const WG_DEFAULT_DNS = process.env.WG_DNS || "1.1.1.1, 8.8.8.8";
const WG_HOST = process.env.WG_HOST || "";
const WG_DEFAULT_ALLOWED_IPS = process.env.WG_ALLOWED_IPS || "0.0.0.0/0, ::/0";
const WG_DEFAULT_PERSISTENT_KEEPALIVE = Number.parseInt(process.env.WG_PERSISTENT_KEEPALIVE || "25", 10);
const WG_CONFIG_DIR = "/etc/wireguard";

let cronTimer = null;

const internalWireguard = {

	/**
	 * Get or create the WireGuard interface in DB
	 */
	async getOrCreateInterface(knex) {
		let iface = await knex("wg_interface").first();
		if (!iface) {
			// Seed a default config if it doesn't exist
			const insertData = {
				name: "wg0",
				listen_port: 51820,
				ipv4_cidr: "10.0.0.1/24",
				mtu: 1420,
				dns: WG_DEFAULT_DNS,
				host: WG_HOST,
				post_up: "iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE",
				post_down: "iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE",
				created_on: knex.fn.now(),
				modified_on: knex.fn.now(),
			};
			const [id] = await knex("wg_interface").insert(insertData);

			iface = await knex("wg_interface").where("id", id).first();
			logger.info("WireGuard interface created with default config");
		}
		return iface;
	},

	/**
	 * Render PostUp and PostDown iptables rules based on interface, isolation, and links
	 */
	async renderIptablesRules(knex, iface) {
		const basePostUp = [];
		const basePostDown = [];

		// Default forward and NAT
		basePostUp.push("iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE");
		basePostDown.push("iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE");

		// Client Isolation: Prevent clients on this interface from communicating with each other
		if (iface.isolate_clients) {
			basePostUp.push("iptables -I FORWARD -i %i -o %i -j REJECT");
			basePostDown.push("iptables -D FORWARD -i %i -o %i -j REJECT");
		}

		// Server Isolation (Default DROP) & Server Peering
		// 1. By default, prevent this interface from talking to ANY OTHER wg+ interfaces
		basePostUp.push("iptables -I FORWARD -i %i -o wg+ -j DROP");
		basePostDown.push("iptables -D FORWARD -i %i -o wg+ -j DROP");

		// 2. Fetch linked servers to punch holes in the DROP rule
		// wg_server_link has interface_id_1 and interface_id_2
		const links = await knex("wg_server_link")
			.where("interface_id_1", iface.id)
			.orWhere("interface_id_2", iface.id);

		for (const link of links) {
			const peerIfaceId = link.interface_id_1 === iface.id ? link.interface_id_2 : link.interface_id_1;
			const peerIface = await knex("wg_interface").where("id", peerIfaceId).first();
			if (peerIface) {
				basePostUp.push(`iptables -I FORWARD -i %i -o ${peerIface.name} -j ACCEPT`);
				basePostDown.push(`iptables -D FORWARD -i %i -o ${peerIface.name} -j ACCEPT`);
			}
		}

		return {
			postUp: basePostUp.join("; "),
			postDown: basePostDown.join("; "),
		};
	},

	/**
	 * Save WireGuard config to /etc/wireguard/wg0.conf and sync
	 */
	async saveConfig(knex) {
		const iface = await this.getOrCreateInterface(knex);
		const clients = await knex("wg_client").where("enabled", true);

		// Generate server interface section
		const parsed = wgHelpers.parseCIDR(iface.ipv4_cidr);
		const serverAddress = `${parsed.firstHost}/${parsed.prefix}`;

		let configContent = wgHelpers.generateServerInterface({
			privateKey: iface.private_key,
			address: serverAddress,
			listenPort: iface.listen_port,
			mtu: iface.mtu,
			dns: null, // DNS is for clients, not server
			postUp: iface.post_up,
			postDown: iface.post_down,
		});

		// Generate peer sections for each enabled client
		for (const client of clients) {
			configContent += "\n\n" + wgHelpers.generateServerPeer({
				publicKey: client.public_key,
				preSharedKey: client.pre_shared_key,
				allowedIps: `${client.ipv4_address}/32`,
			});
		}

		configContent += "\n";

		// Write config file
		const configPath = `${WG_CONFIG_DIR}/${iface.name}.conf`;
		fs.writeFileSync(configPath, configContent, { mode: 0o600 });
		logger.info(`WireGuard config saved to ${configPath}`);

		// Sync config
		try {
			await wgHelpers.wgSync(iface.name);
			logger.info("WireGuard config synced");
		} catch (err) {
			logger.warn("WireGuard sync failed, may need full restart:", err.message);
		}
	},

	/**
	 * Start WireGuard interface
	 */
	async startup(knex) {
		try {
			const iface = await this.getOrCreateInterface(knex);

			// Ensure config dir exists
			if (!fs.existsSync(WG_CONFIG_DIR)) {
				fs.mkdirSync(WG_CONFIG_DIR, { recursive: true });
			}

			// Save config first
			await this.saveConfig(knex);

			// Bring down if already up, then up
			try {
				await wgHelpers.wgDown(iface.name);
			} catch (_) {
				// Ignore if not up
			}

			await wgHelpers.wgUp(iface.name);
			logger.info(`WireGuard interface ${iface.name} started on port ${iface.listen_port}`);

			// Start cron job for expiration
			this.startCronJob(knex);
		} catch (err) {
			logger.error("WireGuard startup failed:", err.message);
			logger.warn("WireGuard features will be unavailable. Ensure the host supports WireGuard kernel module.");
		}
	},

	/**
	 * Shutdown WireGuard interface
	 */
	async shutdown(knex) {
		if (cronTimer) {
			clearInterval(cronTimer);
			cronTimer = null;
		}
		try {
			const iface = await knex("wg_interface").first();
			if (iface) {
				await wgHelpers.wgDown(iface.name);
				logger.info(`WireGuard interface ${iface.name} stopped`);
			}
		} catch (err) {
			logger.warn("WireGuard shutdown warning:", err.message);
		}
	},

	/**
	 * Get all clients with live status
	 */
	async getClients(knex) {
		const iface = await this.getOrCreateInterface(knex);
		const dbClients = await knex("wg_client").orderBy("created_on", "desc");

		const clients = dbClients.map((c) => ({
			id: c.id,
			name: c.name,
			enabled: c.enabled === 1 || c.enabled === true,
			ipv4_address: c.ipv4_address,
			public_key: c.public_key,
			allowed_ips: c.allowed_ips,
			persistent_keepalive: c.persistent_keepalive,
			created_on: c.created_on,
			updated_on: c.modified_on,
			expires_at: c.expires_at,
			// Live status (populated below)
			latest_handshake_at: null,
			endpoint: null,
			transfer_rx: 0,
			transfer_tx: 0,
		}));

		// Get live WireGuard status
		try {
			const dump = await wgHelpers.wgDump(iface.name);
			for (const peer of dump) {
				const client = clients.find((c) => c.public_key === peer.publicKey);
				if (client) {
					client.latest_handshake_at = peer.latestHandshakeAt;
					client.endpoint = peer.endpoint;
					client.transfer_rx = peer.transferRx;
					client.transfer_tx = peer.transferTx;
				}
			}
		} catch (_) {
			// WireGuard may not be running
		}

		return clients;
	},

	/**
	 * Create a new WireGuard client
	 */
	async createClient(knex, data) {
		const iface = data.interface_id 
			? await knex("wg_interface").where("id", data.interface_id).first()
			: await this.getOrCreateInterface(knex);

		// Generate keys
		const privateKey = await wgHelpers.generatePrivateKey();
		const publicKey = await wgHelpers.getPublicKey(privateKey);
		const preSharedKey = await wgHelpers.generatePreSharedKey();

		// Allocate IP
		const existingClients = await knex("wg_client").select("ipv4_address").where("interface_id", iface.id);
		const allocatedIPs = existingClients.map((c) => c.ipv4_address);
		const ipv4Address = wgHelpers.findNextAvailableIP(iface.ipv4_cidr, allocatedIPs);

		const clientData = {
			name: data.name || "Unnamed Client",
			enabled: true,
			ipv4_address: ipv4Address,
			private_key: privateKey,
			public_key: publicKey,
			pre_shared_key: preSharedKey,
			allowed_ips: data.allowed_ips || WG_DEFAULT_ALLOWED_IPS,
			persistent_keepalive: data.persistent_keepalive || WG_DEFAULT_PERSISTENT_KEEPALIVE,
			expires_at: data.expires_at || null,
			interface_id: iface.id,
			created_on: knex.fn.now(),
			modified_on: knex.fn.now(),
		};

		const [id] = await knex("wg_client").insert(clientData);

		// Sync WireGuard config
		await this.saveConfig(knex);

		return knex("wg_client").where("id", id).first();
	},

	/**
	 * Delete a WireGuard client
	 */
	async deleteClient(knex, clientId) {
		const client = await knex("wg_client").where("id", clientId).first();
		if (!client) {
			throw new Error("Client not found");
		}

		await knex("wg_client").where("id", clientId).del();
		await this.saveConfig(knex);

		return { success: true };
	},

	/**
	 * Toggle a WireGuard client enabled/disabled
	 */
	async toggleClient(knex, clientId, enabled) {
		const client = await knex("wg_client").where("id", clientId).first();
		if (!client) {
			throw new Error("Client not found");
		}

		await knex("wg_client").where("id", clientId).update({
			enabled: enabled,
			modified_on: knex.fn.now(),
		});

		await this.saveConfig(knex);

		return knex("wg_client").where("id", clientId).first();
	},

	/**
	 * Update a WireGuard client
	 */
	async updateClient(knex, clientId, data) {
		const client = await knex("wg_client").where("id", clientId).first();
		if (!client) {
			throw new Error("Client not found");
		}

		const updateData = {};
		if (data.name !== undefined) updateData.name = data.name;
		if (data.allowed_ips !== undefined) updateData.allowed_ips = data.allowed_ips;
		if (data.persistent_keepalive !== undefined) updateData.persistent_keepalive = data.persistent_keepalive;
		if (data.expires_at !== undefined) updateData.expires_at = data.expires_at;
		updateData.modified_on = knex.fn.now();

		await knex("wg_client").where("id", clientId).update(updateData);
		await this.saveConfig(knex);

		return knex("wg_client").where("id", clientId).first();
	},

	/**
	 * Get client configuration file content
	 */
	async getClientConfiguration(knex, clientId) {
		const iface = await this.getOrCreateInterface(knex);
		const client = await knex("wg_client").where("id", clientId).first();
		if (!client) {
			throw new Error("Client not found");
		}

		const endpoint = `${iface.host || "YOUR_SERVER_IP"}:${iface.listen_port}`;

		return wgHelpers.generateClientConfig({
			clientPrivateKey: client.private_key,
			clientAddress: `${client.ipv4_address}/32`,
			dns: iface.dns,
			mtu: iface.mtu,
			serverPublicKey: iface.public_key,
			preSharedKey: client.pre_shared_key,
			allowedIps: client.allowed_ips,
			persistentKeepalive: client.persistent_keepalive,
			endpoint: endpoint,
		});
	},

	/**
	 * Get QR code SVG for client config
	 */
	async getClientQRCode(knex, clientId) {
		const config = await this.getClientConfiguration(knex, clientId);
		return wgHelpers.generateQRCodeSVG(config);
	},

	/**
	 * Create a new WireGuard Interface Endpoint
	 */
	async createInterface(knex, data) {
		const existingIfaces = await knex("wg_interface").select("name", "listen_port");
		const newIndex = existingIfaces.length;
		
		const name = `wg${newIndex}`;
		const listen_port = 51820 + newIndex;
		
		// Attempt to grab /24 subnets, ex 10.8.0.0/24 -> 10.8.1.0/24
		const ipv4_cidr = `10.8.${newIndex}.1/24`;
		
		// Generate keys
		const privateKey = await wgHelpers.generatePrivateKey();
		const publicKey = await wgHelpers.getPublicKey(privateKey);

		const insertData = {
			name,
			private_key: privateKey,
			public_key: publicKey,
			listen_port,
			ipv4_cidr,
			mtu: data.mtu || WG_DEFAULT_MTU,
			dns: data.dns || WG_DEFAULT_DNS,
			host: data.host || WG_HOST,
			isolate_clients: data.isolate_clients || false,
			post_up: "iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE",
			post_down: "iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE",
			created_on: knex.fn.now(),
			modified_on: knex.fn.now(),
		};

		const [id] = await knex("wg_interface").insert(insertData);
		
		const newIface = await knex("wg_interface").where("id", id).first();
		
		// Regenerate config and restart the new interface seamlessly
		const parsed = wgHelpers.parseCIDR(newIface.ipv4_cidr);
		let configContent = wgHelpers.generateServerInterface({
			privateKey: newIface.private_key,
			address: `${parsed.firstHost}/${parsed.prefix}`,
			listenPort: newIface.listen_port,
			mtu: newIface.mtu,
			dns: null,
			postUp: newIface.post_up,
			postDown: newIface.post_down,
		});
		
		fs.writeFileSync(`${WG_CONFIG_DIR}/${name}.conf`, configContent, { mode: 0o600 });
		await wgHelpers.wgUp(name);
		
		return newIface;
	},

	/**
	 * Update an existing Interface
	 */
	async updateInterface(knex, id, data) {
		const iface = await knex("wg_interface").where("id", id).first();
		if (!iface) throw new Error("Interface not found");
		
		const updateData = { modified_on: knex.fn.now() };
		if (data.host !== undefined) updateData.host = data.host;
		if (data.dns !== undefined) updateData.dns = data.dns;
		if (data.mtu !== undefined) updateData.mtu = data.mtu;
		if (data.isolate_clients !== undefined) updateData.isolate_clients = data.isolate_clients;
		
		await knex("wg_interface").where("id", id).update(updateData);
		
		await this.saveConfig(knex); // This will re-render IPTables and sync 
		return knex("wg_interface").where("id", id).first();
	},

	/**
	 * Delete an interface
	 */
	async deleteInterface(knex, id) {
		const iface = await knex("wg_interface").where("id", id).first();
		if (!iface) throw new Error("Interface not found");
		
		try {
			await wgHelpers.wgDown(iface.name);
			if (fs.existsSync(`${WG_CONFIG_DIR}/${iface.name}.conf`)) {
				fs.unlinkSync(`${WG_CONFIG_DIR}/${iface.name}.conf`);
			}
		} catch (e) {
			logger.warn(`Failed to teardown WG interface ${iface.name}: ${e.message}`);
		}
		
		// Cascading deletion handles clients and links in DB schema
		await knex("wg_interface").where("id", id).del();
		return { success: true };
	},

	/**
	 * Update Peering Links between WireGuard Interfaces
	 */
	async updateInterfaceLinks(knex, id, linkedServers) {
		// Clean up existing links where this interface is involved
		await knex("wg_server_link").where("interface_id_1", id).orWhere("interface_id_2", id).del();
		
		// Insert new ones
		for (const peerId of linkedServers) {
			if (peerId !== Number(id)) {
				await knex("wg_server_link").insert({
					interface_id_1: id,
					interface_id_2: peerId
				});
			}
		}
		await this.saveConfig(knex);
		return { success: true };
	},

	/**
	 * Get the WireGuard interfaces info
	 */
	async getInterfacesInfo(knex) {
		const ifaces = await knex("wg_interface").select("*");
		const allLinks = await knex("wg_server_link").select("*");

		return ifaces.map((i) => {
			const links = allLinks.filter(l => l.interface_id_1 === i.id || l.interface_id_2 === i.id);
			return {
				id: i.id,
				name: i.name,
				public_key: i.public_key,
				ipv4_cidr: i.ipv4_cidr,
				listen_port: i.listen_port,
				mtu: i.mtu,
				dns: i.dns,
				host: i.host,
				isolate_clients: i.isolate_clients,
				linked_servers: links.map(l => l.interface_id_1 === i.id ? l.interface_id_2 : l.interface_id_1),
			};
		});
	},

	/**
	 * Cron job to check client expirations
	 */
	startCronJob(knex) {
		cronTimer = setInterval(async () => {
			try {
				const clients = await knex("wg_client").where("enabled", true).whereNotNull("expires_at");
				let needsSave = false;

				for (const client of clients) {
					if (new Date() > new Date(client.expires_at)) {
						logger.info(`WireGuard client "${client.name}" (${client.id}) has expired, disabling.`);
						await knex("wg_client").where("id", client.id).update({
							enabled: false,
							modified_on: knex.fn.now(),
						});
						needsSave = true;
					}
				}

				if (needsSave) {
					await this.saveConfig(knex);
				}
			} catch (err) {
				logger.error("WireGuard cron job error:", err.message);
			}
		}, 60 * 1000); // every 60 seconds
	},
};

export default internalWireguard;
