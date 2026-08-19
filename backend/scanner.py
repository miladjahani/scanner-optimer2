#!/usr/bin/env python3
"""
Cloudflare Clean IP Scanner Engine (High-Performance Python Implementation)
Ported directly from Cloudflare-Clean-IP-Scanner architecture (task/tcping, task/httping, task/download, task/ip).
"""

import socket
import ssl
import time
import random
import ipaddress
import urllib.request
import urllib.parse
import re
import concurrent.futures
import threading

class CloudflareScanner:
    def __init__(self, port=443, max_threads=30, ping_trials=4, download_timeout=3.0):
        self.port = port
        self.max_threads = max_threads
        self.ping_trials = ping_trials
        self.download_timeout = download_timeout
        self.is_running = False
        self.progress = 0
        self.total_ips = 0
        self.tested_count = 0
        self.results = []
        self._lock = threading.Lock()

    def generate_random_ips_from_cidr(self, cidr_str, count_per_cidr=4):
        """Generates random IP addresses from a CIDR block."""
        try:
            net = ipaddress.ip_network(cidr_str.strip())
            num_hosts = net.num_addresses
            if num_hosts <= 4:
                return [str(ip) for ip in net.hosts()]
            
            ips = set()
            attempts = 0
            while len(ips) < count_per_cidr and attempts < count_per_cidr * 4:
                rand_idx = random.randint(2, num_hosts - 3)
                ips.add(str(net[rand_idx]))
                attempts += 1
            return list(ips)
        except Exception:
            return []

    def tcping(self, ip, port, count=3, timeout=1.2):
        """Performs TCP ping on the target IP (similar to task/tcping.go)."""
        latencies = []
        loss_count = 0
        
        for _ in range(count):
            t0 = time.perf_counter()
            try:
                s = socket.create_connection((ip, port), timeout=timeout)
                dur_ms = (time.perf_counter() - t0) * 1000
                s.close()
                latencies.append(dur_ms)
            except Exception:
                loss_count += 1

        loss_rate = round((loss_count / count) * 100, 1)
        if latencies:
            avg_lat = round(sum(latencies) / len(latencies), 1)
            min_lat = round(min(latencies), 1)
            max_lat = round(max(latencies), 1)
            jitter = round(max_lat - min_lat, 1)
            return {
                "ok": True,
                "latency": avg_lat,
                "min": min_lat,
                "max": max_lat,
                "jitter": jitter,
                "lossRate": loss_rate
            }
        return {"ok": False, "latency": None, "lossRate": 100.0, "jitter": None}

    def httping(self, ip, port=443, host="speed.cloudflare.com", timeout=2.0):
        """Verifies TLS handshake & HTTP response (similar to task/httping.go)."""
        t0 = time.perf_counter()
        try:
            req = urllib.request.Request(
                f"https://{ip}:{port}/cdn-cgi/trace",
                headers={"Host": host, "User-Agent": "Cloudflare-Clean-IP-Scanner/5.0"}
            )
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
                status = resp.status
                ttfb_ms = round((time.perf_counter() - t0) * 1000, 1)
                body = resp.read(256).decode("utf-8", errors="ignore")
                colo_match = re.search(r"colo=([A-Z]{3})", body)
                colo = colo_match.group(1) if colo_match else "Edge"
                return {"ok": status == 200, "ttfb": ttfb_ms, "colo": colo}
        except Exception:
            return {"ok": False, "ttfb": None, "colo": "Unknown"}

    def measure_download_speed(self, ip, port=443, host="speed.cloudflare.com", size_bytes=1000000):
        """Measures download speed in MB/s and Mbps (similar to task/download.go)."""
        try:
            url = f"https://{ip}:{port}/__down?bytes={size_bytes}"
            req = urllib.request.Request(
                url,
                headers={"Host": host, "User-Agent": "Cloudflare-Clean-IP-Scanner/5.0"}
            )
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE

            t0 = time.perf_counter()
            with urllib.request.urlopen(req, timeout=self.download_timeout, context=ctx) as resp:
                chunk = resp.read()
                dur = time.perf_counter() - t0
                bytes_received = len(chunk)
                if dur > 0 and bytes_received > 0:
                    mbps = round((bytes_received * 8) / (dur * 1_000_000), 2)
                    mb_per_sec = round(bytes_received / (dur * 1_000_000), 2)
                    return {"mbps": mbps, "mb_per_sec": mb_per_sec}
        except Exception:
            pass
        return {"mbps": 0.0, "mb_per_sec": 0.0}

    def scan_ip_task(self, ip):
        """Executes Phase 1 (TCPing), Phase 2 (HTTPing) and records result."""
        if not self.is_running:
            return None

        # Phase 1: TCPing
        tcp_res = self.tcping(ip, self.port, count=self.ping_trials)
        if not tcp_res["ok"]:
            with self._lock:
                self.tested_count += 1
                if self.total_ips > 0:
                    self.progress = round((self.tested_count / self.total_ips) * 100, 1)
            return None

        # Phase 2: HTTPing
        http_res = self.httping(ip, self.port)
        
        # Categorize operator based on IP prefix
        op = "global"
        if ip.startswith("104.16") or ip.startswith("104.19") or ip.startswith("104.26"):
            op = "mci"
        elif ip.startswith("104.17") or ip.startswith("172.67") or ip.startswith("104.21"):
            op = "mtn"
        elif ip.startswith("162.159") or ip.startswith("104.22") or ip.startswith("104.18"):
            op = "rtl"
        elif ip.startswith("172.64") or ip.startswith("198.41"):
            op = "shatel"

        item = {
            "ip": ip,
            "port": self.port,
            "operator": op,
            "label": f"⚡ [{op.upper()}] {ip} ({http_res.get('colo', 'Edge')})",
            "latency": tcp_res["latency"],
            "ttfb": http_res["ttfb"] or tcp_res["latency"],
            "jitter": tcp_res["jitter"],
            "lossRate": tcp_res["lossRate"],
            "colo": http_res.get("colo", "Edge"),
            "speedMbps": 0.0,
            "status": "success"
        }

        with self._lock:
            self.results.append(item)
            self.tested_count += 1
            if self.total_ips > 0:
                self.progress = round((self.tested_count / self.total_ips) * 100, 1)

        return item

    def start_scan(self, cidrs=None, count_per_cidr=4, run_speed_test=True):
        """Starts full multi-threaded 3-phase scan."""
        self.is_running = True
        self.results = []
        self.tested_count = 0
        self.progress = 0

        if not cidrs:
            # Read from backend/ip.txt
            ip_file = os.path.join(os.path.dirname(__file__), "ip.txt")
            if os.path.exists(ip_file):
                with open(ip_file, "r") as f:
                    cidrs = [line.strip() for line in f if line.strip() and not line.startswith("#")]
            else:
                cidrs = ["104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "162.158.0.0/15", "188.114.96.0/20", "198.41.128.0/17"]

        candidate_ips = []
        for cidr in cidrs:
            candidate_ips.extend(self.generate_random_ips_from_cidr(cidr, count_per_cidr=count_per_cidr))

        self.total_ips = len(candidate_ips)

        # Phase 1 & 2 in Parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_threads) as executor:
            executor.map(self.scan_ip_task, candidate_ips)

        # Sort results by latency
        self.results.sort(key=lambda x: (x["latency"] if x["latency"] is not None else 9999))

        # Phase 3: Speed test on top 10 lowest-latency IPs
        if run_speed_test and self.results:
            top_candidates = self.results[:10]
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                def speed_task(res_item):
                    spd = self.measure_download_speed(res_item["ip"], res_item["port"])
                    res_item["speedMbps"] = spd["mbps"]
                    res_item["speedMBs"] = spd["mb_per_sec"]
                list(executor.map(speed_task, top_candidates))

            # Re-sort by download speed then latency
            self.results.sort(key=lambda x: (-x.get("speedMbps", 0), x.get("latency", 9999)))

        self.is_running = False
        self.progress = 100.0
        return self.results

    def stop_scan(self):
        self.is_running = False
