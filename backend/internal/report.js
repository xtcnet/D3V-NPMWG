import db from "../db.js";
import internalDeadHost from "./dead-host.js";
import internalProxyHost from "./proxy-host.js";
import internalRedirectionHost from "./redirection-host.js";
import internalStream from "./stream.js";

const internalReport = {
	/**
	 * @param  {Access}   access
	 * @return {Promise}
	 */
	getHostsReport: (access) => {
		return access
			.can("reports:hosts", 1)
			.then((access_data) => {
				const userId = access.token.getUserId(1);

				const promises = [
					internalProxyHost.getCount(userId, access_data.permission_visibility),
					internalRedirectionHost.getCount(userId, access_data.permission_visibility),
					internalStream.getCount(userId, access_data.permission_visibility),
					internalDeadHost.getCount(userId, access_data.permission_visibility),
				];

				return Promise.all(promises);
			})
			.then(async (counts) => {
				const knex = db();
				let wgServers = 0;
				let wgClients = 0;
				try {
					const srvResult = await knex("wg_interface").count("id as count").first();
					wgServers = srvResult?.count || 0;
					const cliResult = await knex("wg_client").count("id as count").first();
					wgClients = cliResult?.count || 0;
				} catch (_) {
					// WireGuard tables may not exist yet
				}
				return {
					proxy: counts.shift(),
					redirection: counts.shift(),
					stream: counts.shift(),
					dead: counts.shift(),
					wgServers: Number(wgServers),
					wgClients: Number(wgClients),
				};
			});
	},
};

export default internalReport;

