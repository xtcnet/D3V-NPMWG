import fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import { global as logger } from "../logger.js";
import * as wgHelpers from "../lib/wg-helpers.js";
import internalWireguardFs from "./wireguard-fs.js";
import internalAuditLog from "./audit-log.js";

const execAsync = promisify(exec);

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
let connectionMemoryMap = {};

const internalWireguard = {

	/**
	 * Get or create the WireGuard interface in DB
	 */
	async getOrCreateInterface(knex) {
		let iface = await knex("wg_interface").first();
		if (!iface) {
			const privateKey = await wgHelpers.generatePrivateKey();
			const publicKey = await wgHelpers.getPublicKey(privateKey);
			// Seed a default config if it doesn't exist
			const insertData = {
				name: "wg0",
				private_key: privateKey,
				public_key: publicKey,
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
	 * Save WireGuard config to /etc/wireguard/wgX.conf and sync
	 */
	async saveConfig(knex) {
		await this.getOrCreateInterface(knex); // Ensure at least wg0 exists
		
		const ifaces = await knex("wg_interface").select("*");
		const clients = await knex("wg_client").where("enabled", true);

		for (const iface of ifaces) {
			// 1. Render IPTables Rules dynamically for this interface
			const { postUp, postDown } = await this.renderIptablesRules(knex, iface);

			// 2. Generate server interface section
			const parsed = wgHelpers.parseCIDR(iface.ipv4_cidr);
			const serverAddress = `${parsed.firstHost}/${parsed.prefix}`;

			let configContent = wgHelpers.generateServerInterface({
				privateKey: iface.private_key,
				address: serverAddress,
				listenPort: iface.listen_port,
				mtu: iface.mtu,
				dns: null, // DNS is for clients, not server
				postUp: postUp,
				postDown: postDown,
			});

			// 3. Generate peer sections for each enabled client ON THIS SERVER
			const ifaceClients = clients.filter(c => c.interface_id === iface.id);
			for (const client of ifaceClients) {
				configContent += "\n\n" + wgHelpers.generateServerPeer({
					publicKey: client.public_key,
					preSharedKey: client.pre_shared_key,
					allowedIps: `${client.ipv4_address}/32`,
				});
			}

			configContent += "\n";

			// 4. Write config file
			const configPath = `${WG_CONFIG_DIR}/${iface.name}.conf`;
			fs.writeFileSync(configPath, configContent, { mode: 0o600 });
			logger.info(`WireGuard config saved to ${configPath}`);

			// 5. Sync config
			try {
				await wgHelpers.wgSync(iface.name);
				logger.info(`WireGuard config synced for ${iface.name}`);
				
				// 6. Apply traffic control bandwidth partitions non-blocking
				this.applyBandwidthLimits(knex, iface).catch((e) => logger.warn(`Skipping QoS on ${iface.name}: ${e.message}`));
			} catch (err) {
				logger.warn(`WireGuard sync failed for ${iface.name}, may need full restart:`, err.message);
			}
		}
	},

	/**
	 * Start WireGuard interfaces
	 */
	async startup(knex) {
		try {
			await this.getOrCreateInterface(knex); // ensure at least wg0

			// Ensure config dir exists
			if (!fs.existsSync(WG_CONFIG_DIR)) {
				fs.mkdirSync(WG_CONFIG_DIR, { recursive: true });
			}

			// Save configs first (generates .conf files dynamically for all wg_interfaces)
			await this.saveConfig(knex);

			// Bring down/up all interfaces sequentially
			const ifaces = await knex("wg_interface").select("name", "listen_port");
			for (const iface of ifaces) {
				try {
					await wgHelpers.wgDown(iface.name);
				} catch (_) {
					// Ignore if not up
				}

				try {
					await wgHelpers.wgUp(iface.name);
					logger.info(`WireGuard interface ${iface.name} started on port ${iface.listen_port}`);
				} catch (err) {
					logger.error(`WireGuard startup failed for ${iface.name}:`, err.message);
				}
			}

			// Start cron job for expiration
			this.startCronJob(knex);
		} catch (err) {
			logger.error("WireGuard startup failed overall:", err.message);
		}
	},

	/**
	 * Shutdown WireGuard interfaces
	 */
	async shutdown(knex) {
		if (cronTimer) {
			clearInterval(cronTimer);
			cronTimer = null;
		}
		try {
			const ifaces = await knex("wg_interface").select("name");
			for (const iface of ifaces) {
				try {
					await wgHelpers.wgDown(iface.name);
					logger.info(`WireGuard interface ${iface.name} stopped`);
				} catch (err) {
					logger.warn(`WireGuard shutdown warning for ${iface.name}:`, err.message);
				}
			}
		} catch (err) {
			logger.error("WireGuard shutdown failed querying DB:", err.message);
		}
	},

	/**
	 * Get all clients with live status and interface name correlation
	 */
	async getClients(knex, access, accessData) {
		await this.getOrCreateInterface(knex); // Ensure structure exists
		
		const query = knex("wg_client")
			.join("wg_interface", "wg_client.interface_id", "=", "wg_interface.id")
			.select("wg_client.*", "wg_interface.name as interface_name")
			.orderBy("wg_client.created_on", "desc");

		if (access) {
			query.andWhere("wg_client.owner_user_id", access.token.getUserId(1));
		}

		const dbClients = await query;

		const clients = dbClients.map((c) => ({
			id: c.id,
			name: c.name,
			interfaceName: c.interface_name,
			interfaceId: c.interface_id,
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

		// Get live WireGuard status from ALL interfaces
		const ifaces = await knex("wg_interface").select("name");
		for (const iface of ifaces) {
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
				// WireGuard might be off or particular interface fails
			}
		}

		// Inject Storage Utilization Metrics
		for (const client of clients) {
			client.storage_usage_bytes = await internalWireguardFs.getClientStorageUsage(client.ipv4_address);
		}

		return clients;
	},

	/**
	 * Create a new WireGuard client
	 */
	async createClient(knex, data, access, accessData) {
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

		if (!ipv4Address) {
			throw new Error("No available IP addresses remaining in this WireGuard server subnet.");
		}

		// Scrub any old junk partitions to prevent leakage
		await internalWireguardFs.deleteClientDir(ipv4Address);

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
			owner_user_id: access ? access.token.getUserId(1) : 1,
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
	async deleteClient(knex, clientId, access, accessData) {
		const query = knex("wg_client").where("id", clientId);
		if (access) {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
		if (!client) {
			throw new Error("Client not found");
		}

		await knex("wg_client").where("id", clientId).del();
		
		// Hard-remove the encrypted partition safely mapped to the ipv4_address since it's deleted
		await internalWireguardFs.deleteClientDir(client.ipv4_address);

		await this.saveConfig(knex);

		return { success: true };
	},

	/**
	 * Toggle a WireGuard client enabled/disabled
	 */
	async toggleClient(knex, clientId, enabled, access, accessData) {
		const query = knex("wg_client").where("id", clientId);
		if (access) {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
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
	async updateClient(knex, clientId, data, access, accessData) {
		const query = knex("wg_client").where("id", clientId);
		if (access) {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const client = await query.first();
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
		const client = await knex("wg_client").where("id", clientId).first();
		if (!client) {
			throw new Error("Client not found");
		}
		
		const iface = await knex("wg_interface").where("id", client.interface_id).first();
		if (!iface) {
			throw new Error("Interface not found for this client");
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
	async createInterface(knex, data, access, accessData) {
		const existingIfaces = await knex("wg_interface").select("name", "listen_port");
		
		if (existingIfaces.length >= 100) {
			throw new Error("Maximum limit of 100 WireGuard servers reached.");
		}

		// Find the lowest available index between 0 and 99
		const usedPorts = new Set(existingIfaces.map(i => i.listen_port));
		let newIndex = 0;
		while (usedPorts.has(51820 + newIndex)) {
			newIndex++;
		}
		
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
			owner_user_id: access ? access.token.getUserId(1) : 1,
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
	async updateInterface(knex, id, data, access, accessData) {
		const query = knex("wg_interface").where("id", id);
		if (access) {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const iface = await query.first();
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
	async deleteInterface(knex, id, access, accessData) {
		const query = knex("wg_interface").where("id", id);
		if (access) {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const iface = await query.first();
		if (!iface) throw new Error("Interface not found");

		// Prevent deletion of the initial wg0 interface if it's the only one or a critical one
		if (iface.name === "wg0") {
			const otherIfaces = await knex("wg_interface").whereNot("id", id);
			if (otherIfaces.length === 0) {
				throw new Error("Cannot delete the initial wg0 interface. It is required.");
			}
		}
		
		try {
			await wgHelpers.wgDown(iface.name);
			if (fs.existsSync(`${WG_CONFIG_DIR}/${iface.name}.conf`)) {
				fs.unlinkSync(`${WG_CONFIG_DIR}/${iface.name}.conf`);
			}
		} catch (e) {
			logger.warn(`Failed to teardown WG interface ${iface.name}: ${e.message}`);
		}
		
		// Pre-emptively Cascade delete all Clients & Partitions tied to this interface
		const clients = await knex("wg_client").where("interface_id", iface.id);
		for (const c of clients) {
			await internalWireguardFs.deleteClientDir(c.ipv4_address);
		}
		await knex("wg_client").where("interface_id", iface.id).del();

		// Cascading deletion handles links in DB schema
		await knex("wg_interface").where("id", id).del();
		return { success: true };
	},

	/**
	 * Update Peering Links between WireGuard Interfaces
	 */
	async updateInterfaceLinks(knex, id, linkedServers, access, accessData) {
		// Verify ownership
		const query = knex("wg_interface").where("id", id);
		if (access) {
			query.andWhere("owner_user_id", access.token.getUserId(1));
		}
		const iface = await query.first();
		if (!iface) throw new Error("Interface not found");

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
	async getInterfacesInfo(knex, access, accessData) {
		const query = knex("wg_interface").select("*");
		if (access) {
			if (accessData.permission_visibility !== "all") {
				query.andWhere("owner_user_id", access.token.getUserId(1));
			}
		}
		const ifaces = await query;
		const allLinks = await knex("wg_server_link").select("*");
		const allClients = await knex("wg_client").select("interface_id", "ipv4_address");

		const result = [];
		for (const i of ifaces) {
			const links = allLinks.filter(l => l.interface_id_1 === i.id || l.interface_id_2 === i.id);
			const client_count = allClients.filter(c => c.interface_id === i.id).length;
            
			let storage_usage_bytes = 0;
			for (const c of allClients.filter(c => c.interface_id === i.id)) {
				storage_usage_bytes += await internalWireguardFs.getClientStorageUsage(c.ipv4_address);
			}

			result.push({
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
				client_count,
				storage_usage_bytes
			});
		}
		return result;
	},

	/**
	 * Run TC Traffic Control QoS limits on a WireGuard Interface (Bytes per sec)
	 */
	async applyBandwidthLimits(knex, iface) {
		const clients = await knex("wg_client").where("interface_id", iface.id).where("enabled", true);
		const cmds = [];
		
		// Detach old qdiscs gracefully allowing error suppression
		cmds.push(`tc qdisc del dev ${iface.name} root 2>/dev/null || true`);
		cmds.push(`tc qdisc del dev ${iface.name} ingress 2>/dev/null || true`);
		
		let hasLimits = false;
		for (let i = 0; i < clients.length; i++) {
			const client = clients[i];
			if (client.tx_limit > 0 || client.rx_limit > 0) {
				if (!hasLimits) {
					cmds.push(`tc qdisc add dev ${iface.name} root handle 1: htb default 10`);
					cmds.push(`tc class add dev ${iface.name} parent 1: classid 1:1 htb rate 10gbit`);
					cmds.push(`tc qdisc add dev ${iface.name} handle ffff: ingress`);
					hasLimits = true;
				}
				
				const mark = i + 10;
				// client.rx_limit (Server -> Client = Download = root qdisc TX) - Rate is Bytes/sec so mult by 8 -> bits, /1000 -> Kbits
				if (client.rx_limit > 0) {
					const rateKbit = Math.floor((client.rx_limit * 8) / 1000);
					cmds.push(`tc class add dev ${iface.name} parent 1:1 classid 1:${mark} htb rate ${rateKbit}kbit`);
					cmds.push(`tc filter add dev ${iface.name} protocol ip parent 1:0 prio 1 u32 match ip dst ${client.ipv4_address}/32 flowid 1:${mark}`);
				}
				
				// client.tx_limit (Client -> Server = Upload = ingress qdisc RX)
				if (client.tx_limit > 0) {
					const rateKbit = Math.floor((client.tx_limit * 8) / 1000);
					cmds.push(`tc filter add dev ${iface.name} parent ffff: protocol ip u32 match ip src ${client.ipv4_address}/32 police rate ${rateKbit}kbit burst 1m drop flowid :1`);
				}
			}
		}
		
		if (hasLimits) {
			await execAsync(cmds.join(" && "));
		}
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

				// Audit Logging Polling
				const ifaces = await knex("wg_interface").select("name");
				const allClients = await knex("wg_client").select("id", "public_key", "name", "owner_user_id");
				
				for (const iface of ifaces) {
					try {
						const dump = await wgHelpers.wgDump(iface.name);
						for (const peer of dump) {
							const client = allClients.find((c) => c.public_key === peer.publicKey);
							if (client) {
								const lastHandshakeTime = new Date(peer.latestHandshakeAt).getTime();
								const wasConnected = connectionMemoryMap[client.id] || false;
								const isConnected = lastHandshakeTime > 0 && (Date.now() - lastHandshakeTime < 3 * 60 * 1000);

								if (isConnected && !wasConnected) {
									connectionMemoryMap[client.id] = true;
									// Log connection (dummy token signature for audit logic)
									internalAuditLog.add({ token: { getUserId: () => client.owner_user_id } }, {
										action: "connected",
										meta: { message: `WireGuard client ${client.name} came online.` },
										object_type: "wireguard-client",
										object_id: client.id
									}).catch(()=>{});
								} else if (!isConnected && wasConnected) {
									connectionMemoryMap[client.id] = false;
									// Log disconnection
									internalAuditLog.add({ token: { getUserId: () => client.owner_user_id } }, {
										action: "disconnected",
										meta: { message: `WireGuard client ${client.name} went offline or drifted past TTL.` },
										object_type: "wireguard-client",
										object_id: client.id
									}).catch(()=>{});
								}
							}
						}
					} catch (_) {}
				}

			} catch (err) {
				logger.error("WireGuard cron job error:", err.message);
			}
		}, 60 * 1000); // every 60 seconds
	},
};

export default internalWireguard;
