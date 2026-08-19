import { ParsedProxyConfig, CleanIpItem, DohQueryResult } from '../types';

export function getWorkerUrl(): string {
  return (
    localStorage.getItem('cf_hub_worker_url') ||
    localStorage.getItem('cf_worker_url') ||
    ''
  ).trim().replace(/\/$/, '');
}

export function setWorkerUrl(url: string): void {
  const clean = (url || '').trim().replace(/\/$/, '');
  localStorage.setItem('cf_hub_worker_url', clean);
  localStorage.setItem('cf_worker_url', clean);
}

export const BACKEND_URL = 'http://localhost:8080';

export async function checkPythonBackendStatus(): Promise<boolean> {
  const worker = getWorkerUrl();
  if (worker) {
    try {
      const res = await fetch(`${worker}/api/ping`, { mode: 'cors' });
      if (res.ok) return true;
    } catch {}
  }
  try {
    const res = await fetch(`${BACKEND_URL}/api/status`, { mode: 'cors' });
    if (res.ok) {
      const data = await res.json();
      return data.status === 'online';
    }
  } catch {}
  return false;
}

export async function fetchSubscriptionViaWorker(url: string): Promise<string> {
  const cleanUrl = url.trim();
  const worker = getWorkerUrl();

  // Try Cloudflare Worker first
  if (worker) {
    try {
      const res = await fetch(`${worker}/api/proxy-fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: cleanUrl })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.data && data.data.length > 5) {
          return data.data;
        }
      }
    } catch {}
  }

  // Fallback Proxies
  const proxies = [
    cleanUrl,
    `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`
  ];

  for (const target of proxies) {
    try {
      const res = await fetch(target, { headers: { 'User-Agent': 'v2rayNG/1.8.12 (MiSub)' } });
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().length > 10) {
          return text.trim();
        }
      }
    } catch {}
  }

  throw new Error('عدم دسترسی به لینک سابسکریپشن. لطفاً آدرس Cloudflare Worker خود را در تنظیمات وارد کنید یا محتوای لینک را مستقیماً پیست نمایید.');
}

export async function probeIpLatencyReal(ip: string, timeoutMs: number = 2500): Promise<{ latency: number | null; status: 'success' | 'timeout' }> {
  const worker = getWorkerUrl();

  // If worker available, probe via edge
  if (worker) {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(`${worker}/api/probe?ip=${ip}`, { signal: controller.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.latency !== null) {
          return { latency: data.latency, status: 'success' };
        }
      }
    } catch {}
  }

  // Browser-based HTTP probe on port 80 (avoids raw IP SSL cert mismatch)
  const start = performance.now();
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), timeoutMs);

    await fetch(`http://${ip}/cdn-cgi/trace?_t=${Date.now()}`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(tid);
    const duration = Math.round(performance.now() - start);
    return { latency: duration, status: 'success' };
  } catch {
    // Fallback attempt on down endpoint
    try {
      const start2 = performance.now();
      const controller2 = new AbortController();
      const tid2 = setTimeout(() => controller2.abort(), timeoutMs);
      await fetch(`https://${ip}/__down`, {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller2.signal
      });
      clearTimeout(tid2);
      const duration2 = Math.round(performance.now() - start2);
      return { latency: duration2, status: 'success' };
    } catch {
      return { latency: null, status: 'timeout' };
    }
  }
}

export async function scanCleanIpsViaPython(limit: number = 25): Promise<CleanIpItem[] | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/scan-clean-ips?limit=${limit}`, { mode: 'cors' });
    if (res.ok) {
      const data = await res.json();
      return data.results;
    }
  } catch {}
  return null;
}

export async function testConfigsViaPython(configs: ParsedProxyConfig[]): Promise<any[] | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/test-configs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs }),
      mode: 'cors'
    });
    if (res.ok) {
      const data = await res.json();
      return data.results;
    }
  } catch {}
  return null;
}

export async function queryDoh(domain: string, provider: string = 'https://1.1.1.1/dns-query'): Promise<DohQueryResult | null> {
  const worker = getWorkerUrl();
  if (worker) {
    try {
      const res = await fetch(`${worker}/api/doh?name=${encodeURIComponent(domain)}&provider=${encodeURIComponent(provider)}`);
      if (res.ok) return await res.json();
    } catch {}
  }
  try {
    const res = await fetch(`${provider}?name=${encodeURIComponent(domain)}&type=A`, {
      headers: { Accept: 'application/dns-json' }
    });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export async function fetchMultiRepoCleanIpsViaPython(): Promise<{ totalFound: number; results: CleanIpItem[] } | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/sync-multi-repos`, { mode: 'cors' });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}

export async function runCloudflareCleanIpScanner(threads: number = 35, port: number = 443, pings: number = 4, testDownload: boolean = true): Promise<{ count: number; results: CleanIpItem[] } | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/run-cf-scanner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ threads, port, pings, testDownload }),
      mode: 'cors'
    });
    if (res.ok) return await res.json();
  } catch {}
  return null;
}
