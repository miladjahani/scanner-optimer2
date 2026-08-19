/**
 * Cloudflare Worker Enterprise Backend & Universal CORS Proxy Engine
 * MiSub + CF-Optimizer + Clean-IP-Scanner Serverless Suite
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, User-Agent, X-Requested-With, Cache-Control, Accept',
  'Access-Control-Expose-Headers': 'Subscription-Userinfo, Content-Disposition, Content-Length, X-Total-Nodes',
  'Access-Control-Max-Age': '86400',
};

const CLOUDFLARE_IPV4_CIDRS = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/22',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22'
];

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      if (pathname === '/' || pathname === '/api') {
        return new Response(JSON.stringify({
          status: 'online',
          engine: 'CF-Optimizor & MiSub Universal Serverless Backend',
          version: '4.5.0',
          endpoints: [
            '/api/fetch-sub?url=...',
            '/api/proxy-fetch (POST)',
            '/api/probe?ip=...&port=...',
            '/api/ip/ranges',
            '/api/doh?name=...',
            '/api/geoip?ip=...',
            '/api/speedtest?bytes=...',
            '/api/ping',
            '/sub?url=...&ip=...&port=...&sni=...'
          ]
        }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json; charset=utf-8' }
        });
      }

      // 1. Fetch Remote Subscription without CORS
      if (pathname === '/api/proxy-fetch' || pathname === '/api/fetch-sub') {
        let targetUrl = url.searchParams.get('url');
        let customUa = url.searchParams.get('ua') || request.headers.get('User-Agent') || 'v2rayNG/1.8.12';

        if (!targetUrl && request.method === 'POST') {
          const body = await request.json().catch(() => ({}));
          targetUrl = body.url;
          if (body.userAgent) customUa = body.userAgent;
        }

        if (!targetUrl) {
          return new Response(JSON.stringify({ success: false, error: 'url required' }), {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }

        const subRes = await fetch(targetUrl, { headers: { 'User-Agent': customUa } });
        const rawData = await subRes.text();
        const userinfo = subRes.headers.get('Subscription-Userinfo') || '';

        if (request.method === 'GET' && !url.searchParams.get('json')) {
          return new Response(rawData, {
            status: subRes.status,
            headers: {
              ...CORS_HEADERS,
              'Content-Type': 'text/plain; charset=utf-8',
              'Subscription-Userinfo': userinfo
            }
          });
        }

        return new Response(JSON.stringify({ success: true, userinfo, data: rawData }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // 2. Real Edge Latency Probe Test
      if (pathname === '/api/probe') {
        const ip = url.searchParams.get('ip');
        if (!ip) return new Response(JSON.stringify({ error: 'ip required' }), { status: 400, headers: CORS_HEADERS });
        const start = Date.now();
        try {
          const probeRes = await fetch(`http://${ip}/cdn-cgi/trace`, {
            headers: { 'User-Agent': 'Cloudflare-Edge-Probe' }
          });
          const latency = Date.now() - start;
          return new Response(JSON.stringify({ success: true, ip, latency, status: 'ok' }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        } catch {
          return new Response(JSON.stringify({ success: false, ip, latency: null, status: 'error' }), {
            headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
          });
        }
      }

      // 3. Cloudflare CIDR List
      if (pathname === '/api/ip/ranges') {
        return new Response(JSON.stringify({ success: true, cidrs: CLOUDFLARE_IPV4_CIDRS }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // 4. DoH Gateway
      if (pathname === '/api/doh') {
        const domain = url.searchParams.get('name');
        const provider = url.searchParams.get('provider') || 'https://1.1.1.1/dns-query';
        if (!domain) return new Response(JSON.stringify({ error: 'name required' }), { status: 400, headers: CORS_HEADERS });

        const dohRes = await fetch(`${provider}?name=${encodeURIComponent(domain)}&type=A`, {
          headers: { Accept: 'application/dns-json' }
        });
        const dohData = await dohRes.json();
        return new Response(JSON.stringify(dohData), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // 5. GeoIP Lookup
      if (pathname === '/api/geoip') {
        const ip = url.searchParams.get('ip') || '';
        const geoRes = await fetch(`https://ipwho.is/${ip}`);
        const geoData = await geoRes.json();
        return new Response(JSON.stringify(geoData), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      // 6. Speedtest Stream Payload
      if (pathname === '/api/speedtest' || pathname === '/__down') {
        const bytes = parseInt(url.searchParams.get('bytes') || '5000000', 10);
        const safeBytes = Math.min(Math.max(bytes, 1024), 50000000);
        const buffer = new Uint8Array(safeBytes);
        return new Response(buffer, {
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/octet-stream',
            'Content-Length': safeBytes.toString(),
            'Cache-Control': 'no-store'
          }
        });
      }

      // 7. Direct Client Subscription Provider Endpoint (/sub)
      if (pathname === '/sub') {
        const targetUrl = url.searchParams.get('url');
        const cleanIp = url.searchParams.get('ip');
        const cleanPort = url.searchParams.get('port');
        const customSni = url.searchParams.get('sni');

        if (!targetUrl) {
          return new Response('Usage: /sub?url=<sub_url>&ip=<clean_ip>&port=<port>&sni=<sni>', {
            status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' }
          });
        }

        const subRes = await fetch(targetUrl, {
          headers: { 'User-Agent': request.headers.get('User-Agent') || 'v2rayNG/1.8.12' }
        });
        let rawData = await subRes.text();

        try {
          rawData = decodeURIComponent(escape(atob(rawData.trim())));
        } catch {}

        const lines = rawData.split('\n').map(l => l.trim()).filter(Boolean);
        const optimized = lines.map(line => {
          if (line.startsWith('vless://') || line.startsWith('trojan://')) {
            const parts = line.split('@');
            if (parts.length > 1) {
              const auth = parts[0];
              const [hostPort, queryStr = ''] = parts[1].split('?');
              const [host, port] = hostPort.split(':');
              const newHost = cleanIp || host;
              const newPort = cleanPort || port;
              const params = new URLSearchParams(queryStr);
              if (customSni) {
                params.set('sni', customSni);
                params.set('host', customSni);
              }
              return `${auth}@${newHost}:${newPort}?${params.toString()}`;
            }
          }
          return line;
        });

        const outBase64 = btoa(unescape(encodeURIComponent(optimized.join('\n'))));
        return new Response(outBase64, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'text/plain; charset=utf-8',
            'Subscription-Userinfo': subRes.headers.get('Subscription-Userinfo') || ''
          }
        });
      }

      // 8. Latency Ping Probe
      if (pathname === '/api/ping') {
        return new Response(JSON.stringify({ success: true, timestamp: Date.now() }), {
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: CORS_HEADERS });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS_HEADERS });
    }
  }
};
