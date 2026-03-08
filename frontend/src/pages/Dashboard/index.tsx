import {
	IconArrowsCross,
	IconBolt,
	IconBoltOff,
	IconDisc,
	IconNetwork,
	IconServer,
} from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { HasPermission } from "src/components";
import { useHostReport } from "src/hooks";
import { T } from "src/locale";
import {
	DEAD_HOSTS,
	PROXY_HOSTS,
	REDIRECTION_HOSTS,
	STREAMS,
	VIEW,
} from "src/modules/Permissions";

const Dashboard = () => {
	const { data: hostReport } = useHostReport();
	const navigate = useNavigate();

	return (
		<div>
			<h2>
				<T id="dashboard" />
			</h2>
			<div className="row row-deck row-cards">
				<div className="col-12 my-4">
					<div className="row row-cards">
						<HasPermission section={PROXY_HOSTS} permission={VIEW} hideError>
							<div className="col-sm-6 col-lg-3">
								<a
									href="/nginx/proxy"
									className="card card-sm card-link card-link-pop"
									onClick={(e) => {
										e.preventDefault();
										navigate("/nginx/proxy");
									}}
								>
									<div className="card-body">
										<div className="row align-items-center">
											<div className="col-auto">
												<span className="bg-green text-white avatar">
													<IconBolt />
												</span>
											</div>
											<div className="col">
												<div className="font-weight-medium">
													<T id="proxy-hosts.count" data={{ count: hostReport?.proxy }} />
												</div>
											</div>
										</div>
									</div>
								</a>
							</div>
						</HasPermission>
						<HasPermission section={REDIRECTION_HOSTS} permission={VIEW} hideError>
							<div className="col-sm-6 col-lg-3">
								<a
									href="/nginx/redirection"
									className="card card-sm card-link card-link-pop"
									onClick={(e) => {
										e.preventDefault();
										navigate("/nginx/redirection");
									}}
								>
									<div className="card-body">
										<div className="row align-items-center">
											<div className="col-auto">
												<span className="bg-yellow text-white avatar">
													<IconArrowsCross />
												</span>
											</div>
											<div className="col">
												<T
													id="redirection-hosts.count"
													data={{ count: hostReport?.redirection }}
												/>
											</div>
										</div>
									</div>
								</a>
							</div>
						</HasPermission>
						<HasPermission section={STREAMS} permission={VIEW} hideError>
							<div className="col-sm-6 col-lg-3">
								<a
									href="/nginx/stream"
									className="card card-sm card-link card-link-pop"
									onClick={(e) => {
										e.preventDefault();
										navigate("/nginx/stream");
									}}
								>
									<div className="card-body">
										<div className="row align-items-center">
											<div className="col-auto">
												<span className="bg-blue text-white avatar">
													<IconDisc />
												</span>
											</div>
											<div className="col">
												<T id="streams.count" data={{ count: hostReport?.stream }} />
											</div>
										</div>
									</div>
								</a>
							</div>
						</HasPermission>
						<HasPermission section={DEAD_HOSTS} permission={VIEW} hideError>
							<div className="col-sm-6 col-lg-3">
								<a
									href="/nginx/404"
									className="card card-sm card-link card-link-pop"
									onClick={(e) => {
										e.preventDefault();
										navigate("/nginx/404");
									}}
								>
									<div className="card-body">
										<div className="row align-items-center">
											<div className="col-auto">
												<span className="bg-red text-white avatar">
													<IconBoltOff />
												</span>
											</div>
											<div className="col">
												<T id="dead-hosts.count" data={{ count: hostReport?.dead }} />
											</div>
										</div>
									</div>
								</a>
							</div>
						</HasPermission>
						{/* WireGuard Servers */}
						<div className="col-sm-6 col-lg-3">
							<a
								href="/wireguard"
								className="card card-sm card-link card-link-pop"
								onClick={(e) => {
									e.preventDefault();
									navigate("/wireguard");
								}}
							>
								<div className="card-body">
									<div className="row align-items-center">
										<div className="col-auto">
											<span className="bg-purple text-white avatar">
												<IconServer />
											</span>
										</div>
										<div className="col">
											<div className="font-weight-medium">
												<T id="wireguard-servers.count" data={{ count: hostReport?.wgServers ?? 0 }} />
											</div>
										</div>
									</div>
								</div>
							</a>
						</div>
						{/* WireGuard Clients */}
						<div className="col-sm-6 col-lg-3">
							<a
								href="/wireguard"
								className="card card-sm card-link card-link-pop"
								onClick={(e) => {
									e.preventDefault();
									navigate("/wireguard");
								}}
							>
								<div className="card-body">
									<div className="row align-items-center">
										<div className="col-auto">
											<span className="bg-cyan text-white avatar">
												<IconNetwork />
											</span>
										</div>
										<div className="col">
											<div className="font-weight-medium">
												<T id="wireguard-clients.count" data={{ count: hostReport?.wgClients ?? 0 }} />
											</div>
										</div>
									</div>
								</div>
							</a>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Dashboard;
