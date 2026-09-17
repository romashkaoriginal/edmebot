FROM postgres:16-alpine

RUN apk add --no-cache openssl

COPY generate-ssl.sh /docker-entrypoint-initdb.d/00-generate-ssl.sh
COPY postgresql.conf /etc/postgresql/postgresql.conf

RUN chmod +x /docker-entrypoint-initdb.d/00-generate-ssl.sh

CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf"]
