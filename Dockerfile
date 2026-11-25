FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY --chown=101:101 dist/ /usr/share/nginx/html/
EXPOSE 8080
