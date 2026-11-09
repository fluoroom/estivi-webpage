FROM nginx:1.29-alpine

LABEL org.opencontainers.image.title="Estivi landing page" \
      org.opencontainers.image.description="The public landing page for Estivi — SSTV, on a schedule." \
      org.opencontainers.image.url="https://github.com/fluoroom/estivi-webpage" \
      org.opencontainers.image.source="https://github.com/fluoroom/estivi-webpage" \
      org.opencontainers.image.licenses="NOASSERTION"

COPY nginx.conf /etc/nginx/conf.d/default.conf

RUN rm -rf /usr/share/nginx/html/*

COPY index.html 404.html robots.txt favicon.ico favicon.svg favicon-32.png apple-touch-icon.png og-image.png og-image-es.png /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY es /usr/share/nginx/html/es

# The context may carry restrictive local modes; nginx workers only need read access.
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/healthz || exit 1
