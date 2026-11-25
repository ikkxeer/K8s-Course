FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY --chown=101:101 dist/ /usr/share/nginx/html/
COPY --chmod=644 nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
