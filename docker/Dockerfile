# This is a Dockerfile intended to be built using `docker buildx`
# for multi-arch support. Building with `docker build` may have unexpected results.

# This file assumes that the frontend has been built using ./scripts/frontend-build

FROM nginxproxymanager/testca AS testca
FROM nginxproxymanager/nginx-full:certbot-node

ARG TARGETPLATFORM
ARG BUILD_VERSION
ARG BUILD_COMMIT
ARG BUILD_DATE

# See: https://github.com/just-containers/s6-overlay/blob/master/README.md
ENV SUPPRESS_NO_CONFIG_WARNING=1 \
	S6_BEHAVIOUR_IF_STAGE2_FAILS=1 \
	S6_CMD_WAIT_FOR_SERVICES_MAXTIME=0 \
	S6_FIX_ATTRS_HIDDEN=1 \
	S6_KILL_FINISH_MAXTIME=10000 \
	S6_VERBOSITY=1 \
	NODE_ENV=production \
	NPM_BUILD_VERSION="${BUILD_VERSION}" \
	NPM_BUILD_COMMIT="${BUILD_COMMIT}" \
	NPM_BUILD_DATE="${BUILD_DATE}" \
	NODE_OPTIONS="--openssl-legacy-provider"

RUN echo "fs.file-max = 65535" > /etc/sysctl.conf \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends jq logrotate wireguard-tools iptables qrencode \
	&& apt-get clean \
	&& rm -rf /var/lib/apt/lists/*

# s6 overlay
COPY docker/scripts/install-s6 /tmp/install-s6
RUN /tmp/install-s6 "${TARGETPLATFORM}" && rm -f /tmp/install-s6

EXPOSE 80 81 443 51820/udp

COPY backend       /app
COPY frontend/dist /app/frontend

WORKDIR /app
RUN yarn install \
	&& yarn cache clean

# add late to limit cache-busting by modifications
COPY docker/rootfs /
COPY --from=testca /home/step/certs/root_ca.crt /etc/ssl/certs/NginxProxyManager.crt

# Remove frontend service not required for prod, dev nginx config as well
RUN rm -rf /etc/s6-overlay/s6-rc.d/user/contents.d/frontend /etc/nginx/conf.d/dev.conf \
	&& chmod 644 /etc/logrotate.d/nginx-proxy-manager

VOLUME [ "/data", "/etc/wireguard" ]

# WireGuard environment defaults
ENV WG_ENABLED=true \
	WG_HOST= \
	WG_PORT=51820 \
	WG_DEFAULT_ADDRESS=10.8.0.0/24 \
	WG_DNS=1.1.1.1,8.8.8.8 \
	WG_MTU=1420 \
	WG_PERSISTENT_KEEPALIVE=25 \
	WG_ALLOWED_IPS=0.0.0.0/0,::/0

ENTRYPOINT [ "/init" ]

LABEL org.label-schema.schema-version="1.0" \
	org.label-schema.license="MIT" \
	org.label-schema.name="d3v-npmwg" \
	org.label-schema.description="D3V-NPMWG: Nginx Proxy Manager + WireGuard VPN Manager" \
	org.label-schema.url="https://github.com/xtcnet/D3V-NPMWG" \
	org.label-schema.cmd="docker run --rm -ti --cap-add=NET_ADMIN --cap-add=SYS_MODULE d3v-npmwg:latest"
