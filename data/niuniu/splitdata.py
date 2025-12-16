#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
from pathlib import Path

SRC = Path("data.json")
OUT_DIR = Path("users")  # 输出目录：data/users/<末两位>/<qq>.json

def main():
    if not SRC.exists():
        raise FileNotFoundError(f"找不到 {SRC.resolve()}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with SRC.open("r", encoding="utf-8") as f:
        all_users = json.load(f)

    if not isinstance(all_users, dict):
        raise ValueError("data.json 顶层必须是对象（dict），形如 {\"qq\": {...}, ...}")

    count = 0
    for uid, niuniu in all_users.items():
        uid = str(uid).strip()
        if not uid:
            continue
        if not isinstance(niuniu, dict):
            continue

        # 按末两位分目录（更均匀）
        sub = uid[-2:] if len(uid) >= 2 else "00"
        user_dir = OUT_DIR / sub
        user_dir.mkdir(parents=True, exist_ok=True)

        payload = {"niuniu": niuniu}

        user_path = user_dir / f"{uid}.json"
        tmp_path = user_dir / f"{uid}.json.tmp"

        # 原子写：先写 tmp，再 replace
        with tmp_path.open("w", encoding="utf-8") as wf:
            json.dump(payload, wf, ensure_ascii=False, indent=2)
            wf.write("\n")
        tmp_path.replace(user_path)

        count += 1

    print(f"OK: 拆分完成，共写入 {count} 个用户文件到 {OUT_DIR.resolve()}")

if __name__ == "__main__":
    main()