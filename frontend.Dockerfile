# ============================================
# Frontend Estático (Nginx)
# ============================================
# Serve os arquivos de src/ como site estático, encaminhando
# apenas os assets — a API roda em um container separado.

FROM nginx:1.27-alpine

COPY src /usr/share/nginx/html
COPY nginx.frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
