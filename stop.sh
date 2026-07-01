#!/usr/bin/env bash
# =====================================================================
#  stop.sh — Ipak Yo'li portlarini (5555/4444/3535) bo'shatadi
#  start.sh Ctrl+C bilan to'xtamay qolsa yoki port band bo'lsa ishlatiladi.
# =====================================================================
free_port() {
  local port="$1" pids=""
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" >/dev/null 2>&1 && echo "port $port bo'shatildi" || echo "port $port bo'sh"
    return
  fi
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti "tcp:${port}" 2>/dev/null || true)
  elif command -v ss >/dev/null 2>&1; then
    pids=$(ss -ltnpH "sport = :${port}" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2 | sort -u)
  fi
  if [ -n "$pids" ]; then
    kill $pids 2>/dev/null; sleep 0.3; kill -9 $pids 2>/dev/null
    echo "port $port to'xtatildi (PID: $pids)"
  else
    DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    out=$(python3 "$DIR/freeport.py" "$port" 2>/dev/null)
    [ -n "$out" ] && echo "$out" || echo "port $port bo'sh"
  fi
}
for p in 5555 4444 3535; do free_port "$p"; done
echo "Tayyor."
