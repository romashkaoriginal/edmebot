FROM postgres:16-alpine

RUN apk add --no-cache openssl

COPY postgresql.conf /etc/postgresql/postgresql.conf
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
