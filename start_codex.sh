#!/usr/bin/env bash

# 使用脚本执行时所在目录，而不是脚本文件所在目录
export CODEX_HOME="$(pwd)/.my_codex"

# 创建独立 Codex 数据目录
mkdir -p "$CODEX_HOME"
chmod 700 "$CODEX_HOME"

# 使用文件存储凭据，确保不同 CODEX_HOME 的账号互相隔离
if [[ ! -f "$CODEX_HOME/config.toml" ]]; then
    printf '%s\n' 'cli_auth_credentials_store = "file"' > "$CODEX_HOME/config.toml"
    chmod 600 "$CODEX_HOME/config.toml"
fi

# 开启代理
if declare -F proxy_on >/dev/null; then
    proxy_on
else
    echo "警告：当前 Shell 中没有定义 proxy_on"
fi

echo "CODEX_HOME=$CODEX_HOME"
echo "已切换到项目独立 Codex 环境，请运行：codex"