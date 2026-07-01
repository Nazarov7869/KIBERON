#!/usr/bin/env python3
# =====================================================================
#  freeport.py — berilgan TCP portni egallab turgan jarayonni to'xtatadi
#  (fuser/lsof/ss bo'lmaganda ishlatiladigan zaxira). Faqat Linux (/proc).
#  Ishlatish:  python3 freeport.py 5555 [4444 3535 ...]
# =====================================================================
import os
import signal
import sys
import glob
import time


def _listen_inodes(port: int) -> set:
    """LISTEN holatidagi shu portga tegishli socket inode'larini topadi."""
    want = f"{port:04X}"
    inodes = set()
    for path in ("/proc/net/tcp", "/proc/net/tcp6"):
        try:
            with open(path) as fh:
                next(fh, None)  # sarlavha
                for line in fh:
                    p = line.split()
                    if len(p) < 10:
                        continue
                    local = p[1]              # HEXIP:HEXPORT
                    state = p[3]              # 0A = LISTEN
                    if state != "0A":
                        continue
                    if local.rsplit(":", 1)[-1].upper() == want:
                        inodes.add(p[9])      # inode
        except FileNotFoundError:
            pass
    return inodes


def _pids_for_inodes(inodes: set) -> set:
    if not inodes:
        return set()
    targets = {f"socket:[{i}]" for i in inodes}
    pids = set()
    for fd in glob.glob("/proc/[0-9]*/fd/*"):
        try:
            if os.readlink(fd) in targets:
                pids.add(int(fd.split("/")[2]))
        except (OSError, ValueError):
            continue
    pids.discard(os.getpid())
    return pids


def free_port(port: int) -> list:
    pids = _pids_for_inodes(_listen_inodes(port))
    for pid in pids:
        try:
            os.kill(pid, signal.SIGTERM)
        except OSError:
            pass
    if pids:
        time.sleep(0.4)
        for pid in pids:
            try:
                os.kill(pid, signal.SIGKILL)
            except OSError:
                pass
    return sorted(pids)


def main():
    ports = [int(a) for a in sys.argv[1:] if a.isdigit()] or [5555, 4444, 3535]
    for port in ports:
        killed = free_port(port)
        if killed:
            print(f"   port {port} bo'shatildi (PID: {' '.join(map(str, killed))})")


if __name__ == "__main__":
    main()
