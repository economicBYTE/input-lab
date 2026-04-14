#!/bin/bash
# 为了方便部署，建议将本地 .ssh 目录下 id_rsa.pub 文件内容拷贝到服务器 ~/.ssh/authorized_keys 文件中, 避免输入密码

set -e
set -o pipefail

# 定义变量
SERVER_IP="124.222.230.225"
SERVER_USER="ubuntu"
REMOTE_DIR="/var/www/type_practice"
FONTEND="~/script/type_practice"
LOCAL_DIST_DIR="./dist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10"

# 日志函数
log() {
  echo -e "\033[1;34m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m $1"
}

error() {
  echo -e "\033[1;31m[$(date '+%Y-%m-%d %H:%M:%S')]\033[0m 错误: $1" >&2
  exit 1
}

# 检查命令是否存在
check_command() {
  if ! command -v "$1" &> /dev/null; then
    error "$1 命令未找到，请先安装"
  fi
}

check_command ssh
check_command scp
check_command npm

# 切换到项目根目录
cd "${SCRIPT_DIR}/.." || error "无法切换到项目根目录"

# 编译项目
log "开始编译项目..."
npm install || error "npm install 失败"
npm run build || error "npm run build 失败"

# 检查编译结果
if [ ! -d "${LOCAL_DIST_DIR}" ]; then
  error "编译后的目录 ${LOCAL_DIST_DIR} 不存在"
fi

if [ ! "$(ls -A ${LOCAL_DIST_DIR})" ]; then
  error "编译后的目录 ${LOCAL_DIST_DIR} 为空"
fi

# 确保远程目录存在并清空旧文件
# /var/www 需要 sudo；首次部署后 chown 给 ubuntu，后续 scp 即可直接写入
log "准备远程目录..."
ssh ${SSH_OPTS} ${SERVER_USER}@${SERVER_IP} "\
  sudo mkdir -p ${REMOTE_DIR} && \
  sudo chown -R ${SERVER_USER}:${SERVER_USER} ${REMOTE_DIR} && \
  mkdir -p ${FONTEND} && \
  rm -rf ${REMOTE_DIR}/*" || error "准备远程目录失败"

# 传输编译后的文件到服务器
log "传输文件到服务器..."
scp ${SSH_OPTS} -r ${LOCAL_DIST_DIR}/* ${SERVER_USER}@${SERVER_IP}:${REMOTE_DIR}/ || error "传输编译文件失败"
scp ${SSH_OPTS} -r "${SCRIPT_DIR}/server_setup.sh" ${SERVER_USER}@${SERVER_IP}:${FONTEND} || error "传输配置脚本失败"

# 设置服务器脚本执行权限
log "设置脚本执行权限..."
ssh ${SSH_OPTS} ${SERVER_USER}@${SERVER_IP} "chmod +x ${FONTEND}/server_setup.sh" || error "设置脚本执行权限失败"

# 在服务器上执行配置脚本（需要 root 权限管理 nginx/certbot）
log "在服务器上执行配置..."
ssh ${SSH_OPTS} ${SERVER_USER}@${SERVER_IP} "sudo bash ${FONTEND}/server_setup.sh" || error "服务器配置脚本执行失败"

log "部署完成！可以通过 https://typinglab.online 访问应用"
