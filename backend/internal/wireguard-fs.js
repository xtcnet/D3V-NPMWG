import fs from "fs";
import path from "path";
import crypto from "crypto";
import { debug, express as logger } from "../logger.js";

const WG_FILES_DIR = process.env.WG_FILES_DIR || "/data/wg_clients";

// Ensure root dir exists
if (!fs.existsSync(WG_FILES_DIR)) {
	fs.mkdirSync(WG_FILES_DIR, { recursive: true });
}

export default {
	/**
	 * Derive a 32-byte AES-256 key from the client's private key
	 */
	getKey(privateKey) {
		return crypto.createHash("sha256").update(privateKey).digest();
	},

	getClientDir(ipv4Address) {
		// Clean the IP address to prevent traversal
		const safeIp = ipv4Address.replace(/[^0-9.]/g, "");
		const dirPath = path.join(WG_FILES_DIR, safeIp);
		if (!fs.existsSync(dirPath)) {
			fs.mkdirSync(dirPath, { recursive: true });
		}
		return dirPath;
	},

	/**
	 * Destroys a client's entire isolated file directory and all encrypted contents
	 */
	async deleteClientDir(ipv4Address) {
		const safeIp = ipv4Address.replace(/[^0-9.]/g, "");
		const dirPath = path.join(WG_FILES_DIR, safeIp);
		if (fs.existsSync(dirPath)) {
			await fs.promises.rm(dirPath, { recursive: true, force: true });
		}
	},

	/**
	 * Scans a client partition and returns the total byte size utilized
	 */
	async getClientStorageUsage(ipv4Address) {
		const dir = this.getClientDir(ipv4Address);
		try {
			const files = await fs.promises.readdir(dir);
			let totalBytes = 0;
			for (const file of files) {
				const filePath = path.join(dir, file);
				const stats = await fs.promises.stat(filePath);
				if (stats.isFile()) {
					totalBytes += stats.size;
				}
			}
			return totalBytes;
		} catch (err) {
			return 0;
		}
	},

	/**
	 * List all files in a client's isolated directory
	 */
	async listFiles(ipv4Address) {
		const dir = this.getClientDir(ipv4Address);
		const files = await fs.promises.readdir(dir);
		
		const result = [];
		for (const file of files) {
			const filePath = path.join(dir, file);
			const stats = await fs.promises.stat(filePath);
			if (stats.isFile()) {
				result.push({
					name: file,
					size: stats.size, // Note: Encrypted size includes 16 byte IV + pad
					created: stats.birthtime,
					modified: stats.mtime
				});
			}
		}
		return result;
	},

	/**
	 * Encrypt and save a file buffer to disk
	 */
	async uploadFile(ipv4Address, privateKey, filename, fileBuffer) {
		const dir = this.getClientDir(ipv4Address);
		// Prevent path traversal
		const safeFilename = path.basename(filename);
		const filePath = path.join(dir, safeFilename);

		const key = this.getKey(privateKey);
		const iv = crypto.randomBytes(16);
		const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

		return new Promise((resolve, reject) => {
			const writeStream = fs.createWriteStream(filePath);
			
			writeStream.on("error", (err) => reject(err));
			writeStream.on("finish", () => resolve({ success: true, name: safeFilename }));

			// Write the 16-byte IV first
			writeStream.write(iv);

			// Pipe the cipher output to the file
			cipher.pipe(writeStream);

			// Write the actual file buffer into the cipher
			cipher.write(fileBuffer);
			cipher.end();
		});
	},

	/**
	 * Decrypt a file and pipe it to standard response stream
	 */
	async downloadFile(ipv4Address, privateKey, filename, res) {
		const dir = this.getClientDir(ipv4Address);
		const safeFilename = path.basename(filename);
		const filePath = path.join(dir, safeFilename);

		if (!fs.existsSync(filePath)) {
			throw new Error("File not found");
		}

		const key = this.getKey(privateKey);
		const fileDescriptor = await fs.promises.open(filePath, "r");
		
		// Read first 16 bytes to extract IV
		const ivBuffer = Buffer.alloc(16);
		await fileDescriptor.read(ivBuffer, 0, 16, 0);
		await fileDescriptor.close();

		// Create a read stream starting AFTER the 16 byte IV
		const readStream = fs.createReadStream(filePath, { start: 16 });
		const decipher = crypto.createDecipheriv("aes-256-cbc", key, ivBuffer);

		// Set response headers for download
		res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
		res.setHeader("Content-Type", "application/octet-stream");

		// Catch error in pipeline without crashing the root process
		readStream.on("error", (err) => {
			logger.error(`Error reading encrypted file ${safeFilename}: ${err.message}`);
			if (!res.headersSent) res.status(500).end();
		});

		decipher.on("error", (err) => {
			logger.error(`Error decrypting file ${safeFilename}: ${err.message}`);
			if (!res.headersSent) res.status(500).end();
		});

		readStream.pipe(decipher).pipe(res);
	},

	/**
	 * Delete an encrypted file
	 */
	async deleteFile(ipv4Address, filename) {
		const dir = this.getClientDir(ipv4Address);
		const safeFilename = path.basename(filename);
		const filePath = path.join(dir, safeFilename);

		if (fs.existsSync(filePath)) {
			await fs.promises.unlink(filePath);
		}
		return { success: true };
	},

	/**
	 * Rename an encrypted file (no re-encryption needed, just fs.rename)
	 */
	async renameFile(ipv4Address, oldName, newName) {
		const dir = this.getClientDir(ipv4Address);
		const safeOld = path.basename(oldName);
		const safeNew = path.basename(newName);
		const oldPath = path.join(dir, safeOld);
		const newPath = path.join(dir, safeNew);

		if (!fs.existsSync(oldPath)) {
			throw new Error("File not found");
		}
		if (fs.existsSync(newPath)) {
			throw new Error("File name already exists");
		}
		await fs.promises.rename(oldPath, newPath);
		return { success: true };
	}
};
