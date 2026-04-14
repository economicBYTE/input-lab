#!/bin/bash
# 仅管理 typinglab.online 的 nginx 配置与证书，不影响服务器上其他站点。

set -e

DOMAIN="typinglab.online"
DOMAIN_WWW="www.typinglab.online"
WEBROOT="/var/www/type_practice"
SITE_NAME="type_practice"
CERT_DIR="/etc/letsencrypt/live/${DOMAIN}"

# 安装 Nginx（如果尚未安装）
if ! command -v nginx &> /dev/null; then
    echo "安装 Nginx..."
    apt-get update
    apt-get install -y nginx
fi

# 安装 Certbot（如果尚未安装）
if ! command -v certbot &> /dev/null; then
    echo "安装 Certbot..."
    apt-get update
    apt-get install -y certbot
fi

# 写入 HTTP 配置（用于 ACME 验证；证书签发后会追加 HTTPS）
write_http_only_conf() {
cat > /etc/nginx/sites-available/${SITE_NAME} << EOF
server {
    listen 80;
    server_name ${DOMAIN} ${DOMAIN_WWW};

    # ACME http-01 验证
    location /.well-known/acme-challenge/ {
        root ${WEBROOT};
    }

    location / {
        root ${WEBROOT};
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
}

# 写入 HTTP + HTTPS 完整配置
write_full_conf() {
cat > /etc/nginx/sites-available/${SITE_NAME} << EOF
# HTTP: ACME 验证 + 跳转 HTTPS
server {
    listen 80;
    server_name ${DOMAIN} ${DOMAIN_WWW};

    location /.well-known/acme-challenge/ {
        root ${WEBROOT};
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS
server {
    listen 443 ssl http2;
    server_name ${DOMAIN} ${DOMAIN_WWW};

    ssl_certificate     ${CERT_DIR}/fullchain.pem;
    ssl_certificate_key ${CERT_DIR}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    root ${WEBROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~* \.(?:js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|ico)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
EOF
}

# 第一次部署：先用 HTTP 配置启动 nginx，再申请证书
if [ ! -f "${CERT_DIR}/fullchain.pem" ]; then
    echo "未发现 ${DOMAIN} 证书，开始首次签发流程..."
    write_http_only_conf
    ln -sf /etc/nginx/sites-available/${SITE_NAME} /etc/nginx/sites-enabled/
    nginx -t
    systemctl reload nginx

    mkdir -p ${WEBROOT}/.well-known/acme-challenge
    certbot certonly --webroot -w ${WEBROOT} \
        -d ${DOMAIN} -d ${DOMAIN_WWW} \
        --non-interactive --agree-tos --register-unsafely-without-email \
        --keep-until-expiring
fi

# 写入完整 HTTP + HTTPS 配置
write_full_conf
ln -sf /etc/nginx/sites-available/${SITE_NAME} /etc/nginx/sites-enabled/

# 检查 Nginx 配置并重载
nginx -t
systemctl reload nginx

echo "服务器配置完成！访问 https://${DOMAIN}"
