FROM node:22-alpine

WORKDIR /app
COPY . /app

ENV VESPER_MODE=cloud
ENV HOST=0.0.0.0
ENV PORT=8788

EXPOSE 8788

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://127.0.0.1:8788/api/status >/dev/null || exit 1

CMD ["node", "scripts/dashboard-server.mjs"]
