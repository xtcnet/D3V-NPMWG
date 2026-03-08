import { useCheckVersion, useHealth } from "src/hooks";
import { T } from "src/locale";

export function SiteFooter() {
	const health = useHealth();
	const { data: versionData } = useCheckVersion();

	const getVersion = () => {
		if (!health.data) {
			return "";
		}
		const v = health.data.version;
		return `v${v.major}.${v.minor}.${v.revision}`;
	};

	return (
		<footer className="footer d-print-none py-3">
			<div className="container-xl">
				<div className="row text-center align-items-center flex-row-reverse">
					<div className="col-lg-auto ms-lg-auto">
						<ul className="list-inline list-inline-dots mb-0">
							<li className="list-inline-item">
								<a
									href="https://github.com/NginxProxyManager/nginx-proxy-manager"
									target="_blank"
									className="link-secondary"
									rel="noopener"
								>
									<T id="footer.github-fork" />
								</a>
							</li>
						</ul>
					</div>
					<div className="col-12 col-lg-auto mt-3 mt-lg-0">
						<ul className="list-inline list-inline-dots mb-0">
							<li className="list-inline-item">
								© D3V.AC 2026{" "}
								
							</li>
							
						
						</ul>
					</div>
				</div>
			</div>
		</footer>
	);
}
