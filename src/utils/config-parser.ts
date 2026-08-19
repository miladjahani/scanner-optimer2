export function parseClashYaml(yamlStr: string): ParsedProxyConfig[] {
  const results: ParsedProxyConfig[] = [];
  if (!yamlStr.includes('proxies:')) return results;

  try {
    const lines = yamlStr.split(/?
/);
    let inProxies = false;
    let currentProxy: Record<string, any> = {};

    for (let line of lines) {
      if (line.trim().startsWith('proxies:')) {
        inProxies = true;
        continue;
      }
      if (inProxies && (line.trim().startsWith('proxy-groups:') || line.trim().startsWith('rules:'))) {
        if (currentProxy.server && (currentProxy.uuid || currentProxy.password)) {
          results.push(mapRawObjectToConfig(currentProxy));
        }
        break;
      }

      if (inProxies) {
        if (line.trim().startsWith('- name:') || line.trim().startsWith('- {name:')) {
          if (currentProxy.server && (currentProxy.uuid || currentProxy.password)) {
            results.push(mapRawObjectToConfig(currentProxy));
          }
          currentProxy = {};
        }

        const match = line.match(/^\s*[-]?\s*([a-zA-Z0-9_-]+):\s*["']?([^"']+)["']?/);
        if (match) {
          currentProxy[match[1]] = match[2].trim();
        }
      }
    }

    if (currentProxy.server && (currentProxy.uuid || currentProxy.password)) {
      results.push(mapRawObjectToConfig(currentProxy));
    }
  } catch {}

  return results;
}

function mapRawObjectToConfig(item: Record<string, any>): ParsedProxyConfig {
  const proto = item.type || 'vless';
  return {
    id: Math.random().toString(36).substring(2, 9),
    protocol: proto === 'shadowsocks' ? 'ss' : proto,
    uuid: item.uuid || item.password || '',
    server: item.server || '',
    port: parseInt(item.port || '443', 10),
    name: item.name || ,
    transport: item.network || 'ws',
    security: item.tls ? 'tls' : 'none',
    sni: item.servername || item.sni || item.server || '',
    host: item.host || item.servername || item.server || '',
    path: item.path || '/',
    alpn: 'h2,http/1.1',
    fingerprint: 'chrome',
    earlyData: '2048',
    fragmentEnabled: false,
    fragmentLength: '100-200',
    fragmentInterval: '10-20',
    fragmentPackets: '1-3',
    raw: JSON.stringify(item)
  };
}

import { fetchSubscriptionViaWorker } from './backend-api';
import { ParsedProxyConfig, ProxyChainSettings } from '../types';

export function parseJsonConfig(jsonStr: string): ParsedProxyConfig[] {
  try {
    const obj = JSON.parse(jsonStr.trim());
    const results: ParsedProxyConfig[] = [];

    // Case 1: Sing-Box format with outbounds
    if (obj.outbounds && Array.isArray(obj.outbounds)) {
      for (const ob of obj.outbounds) {
        if (ob.type === 'vless' || ob.type === 'trojan' || ob.type === 'vmess' || ob.type === 'shadowsocks') {
          const frag = ob.tls?.fragment;
          results.push({
            id: Math.random().toString(36).substring(2, 9),
            protocol: ob.type,
            uuid: ob.uuid || ob.password || '',
            server: ob.server || '',
            port: ob.server_port || 443,
            name: ob.tag || `${ob.type.toUpperCase()} Node`,
            transport: ob.transport?.type || 'ws',
            security: ob.tls?.enabled ? 'tls' : 'none',
            sni: ob.tls?.server_name || ob.server || '',
            host: ob.transport?.headers?.Host || ob.tls?.server_name || ob.server || '',
            path: ob.transport?.path || '/',
            alpn: (ob.tls?.alpn || ['h2', 'http/1.1']).join(','),
            fingerprint: ob.tls?.utls?.fingerprint || 'chrome',
            earlyData: '2048',
            fragmentEnabled: !!frag?.enabled,
            fragmentLength: frag?.length || '100-200',
            fragmentInterval: frag?.interval || '10-20',
            fragmentPackets: '1-3',
            raw: JSON.stringify(ob)
          });
        }
      }
      if (results.length > 0) return results;
    }

    // Case 2: Array of outbounds or nodes
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (item.server && (item.uuid || item.password || item.id)) {
          results.push({
            id: Math.random().toString(36).substring(2, 9),
            protocol: item.type || item.protocol || 'vless',
            uuid: item.uuid || item.password || item.id || '',
            server: item.server || item.add || '',
            port: item.port || item.server_port || 443,
            name: item.tag || item.name || item.ps || 'JSON Node',
            transport: item.transport?.type || item.net || 'ws',
            security: item.tls || item.security ? 'tls' : 'none',
            sni: item.sni || item.host || item.server || '',
            host: item.host || item.sni || item.server || '',
            path: item.path || '/',
            alpn: 'h2,http/1.1',
            fingerprint: item.fp || 'chrome',
            earlyData: '2048',
            fragmentEnabled: !!item.fragment,
            fragmentLength: '100-200',
            fragmentInterval: '10-20',
            fragmentPackets: '1-3',
            raw: JSON.stringify(item)
          });
        }
      }
      if (results.length > 0) return results;
    }

    // Case 3: Single outbound object
    if (obj.server && (obj.uuid || obj.password || obj.id)) {
      return [{
        id: Math.random().toString(36).substring(2, 9),
        protocol: obj.type || obj.protocol || 'vless',
        uuid: obj.uuid || obj.password || obj.id || '',
        server: obj.server || obj.add || '',
        port: obj.port || obj.server_port || 443,
        name: obj.tag || obj.name || obj.ps || 'JSON Node',
        transport: obj.transport?.type || obj.net || 'ws',
        security: obj.tls || obj.security ? 'tls' : 'none',
        sni: obj.sni || obj.host || obj.server || '',
        host: obj.host || obj.sni || obj.server || '',
        path: obj.path || '/',
        alpn: 'h2,http/1.1',
        fingerprint: obj.fp || 'chrome',
        earlyData: '2048',
        fragmentEnabled: !!obj.fragment,
        fragmentLength: '100-200',
        fragmentInterval: '10-20',
        fragmentPackets: '1-3',
        raw: jsonStr
      }];
    }
  } catch (e) {}
  return [];
}

export function parseSingleConfig(uri: string): ParsedProxyConfig | null {
  const trimmed = uri.trim();
  if (!trimmed) return null;

  try {
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsedJson = parseJsonConfig(trimmed);
      if (parsedJson.length > 0) return parsedJson[0];
    }

    // 1. VLESS Protocol
    if (trimmed.startsWith('vless://')) {
      const u = new URL(trimmed);
      const uuid = u.username || '';
      const server = u.hostname || '';
      const port = parseInt(u.port, 10) || 443;
      const name = decodeURIComponent(u.hash ? u.hash.substring(1) : 'VLESS Node');
      const params = u.searchParams;

      const frag = params.get('fragment');
      let fragmentEnabled = !!frag;
      let fragmentLength = '100-200';
      let fragmentInterval = '10-20';
      let fragmentPackets = '1-3';

      if (frag) {
        const parts = frag.split(',');
        if (parts[0]) fragmentLength = parts[0];
        if (parts[1]) fragmentInterval = parts[1];
        if (parts[2]) fragmentPackets = parts[2];
      }

      return {
        id: Math.random().toString(36).substring(2, 9),
        protocol: 'vless',
        uuid,
        server,
        port,
        name,
        transport: (params.get('type') as any) || 'ws',
        security: (params.get('security') as any) || 'tls',
        sni: params.get('sni') || params.get('host') || server,
        host: params.get('host') || params.get('sni') || server,
        path: params.get('path') || '/',
        alpn: params.get('alpn') || 'h2,http/1.1',
        fingerprint: params.get('fp') || 'chrome',
        earlyData: params.get('ed') || '2048',
        fragmentEnabled,
        fragmentLength,
        fragmentInterval,
        fragmentPackets,
        proxyIp: params.get('proxyip') || undefined,
        raw: trimmed
      };
    }

    // 2. Trojan Protocol
    if (trimmed.startsWith('trojan://')) {
      const u = new URL(trimmed);
      const uuid = u.username || '';
      const server = u.hostname || '';
      const port = parseInt(u.port, 10) || 443;
      const name = decodeURIComponent(u.hash ? u.hash.substring(1) : 'Trojan Node');
      const params = u.searchParams;

      return {
        id: Math.random().toString(36).substring(2, 9),
        protocol: 'trojan',
        uuid,
        server,
        port,
        name,
        transport: (params.get('type') as any) || 'ws',
        security: (params.get('security') as any) || 'tls',
        sni: params.get('sni') || server,
        host: params.get('host') || server,
        path: params.get('path') || '/',
        alpn: params.get('alpn') || 'h2,http/1.1',
        fingerprint: params.get('fp') || 'chrome',
        earlyData: params.get('ed') || '2048',
        fragmentEnabled: !!params.get('fragment'),
        fragmentLength: '100-200',
        fragmentInterval: '10-20',
        fragmentPackets: '1-3',
        proxyIp: params.get('proxyip') || undefined,
        raw: trimmed
      };
    }

    // 3. VMess Protocol
    if (trimmed.startsWith('vmess://')) {
      const b64 = trimmed.replace('vmess://', '');
      const jsonStr = decodeURIComponent(escape(atob(b64)));
      const v = JSON.parse(jsonStr);

      return {
        id: Math.random().toString(36).substring(2, 9),
        protocol: 'vmess',
        uuid: v.id || '',
        server: v.add || '',
        port: parseInt(v.port, 10) || 443,
        name: v.ps || 'VMess Node',
        transport: (v.net as any) || 'ws',
        security: v.tls === 'tls' ? 'tls' : 'none',
        sni: v.sni || v.host || v.add,
        host: v.host || v.sni || v.add,
        path: v.path || '/',
        alpn: v.alpn || 'h2,http/1.1',
        fingerprint: v.fp || 'chrome',
        earlyData: '2048',
        fragmentEnabled: false,
        fragmentLength: '100-200',
        fragmentInterval: '10-20',
        fragmentPackets: '1-3',
        raw: trimmed
      };
    }
  } catch (err) {
    console.warn('Parse config error:', err);
  }
  return null;
}

export function parseBatchConfigs(input: string): ParsedProxyConfig[] {
  let content = input.trim();
  if (!content) return [];

  if (content.includes('proxies:')) {
    const yamlParsed = parseClashYaml(content);
    if (yamlParsed.length > 0) return yamlParsed;
  }

  if (content.startsWith('{') || content.startsWith('[')) {
    const jsonParsed = parseJsonConfig(content);
    if (jsonParsed.length > 0) return jsonParsed;
  }

  if (!content.includes('://') && content.length > 20) {
    try {
      content = decodeURIComponent(escape(atob(content)));
    } catch {
      try {
        content = atob(content);
      } catch {}
    }
  }

  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && (l.includes('://') || l.startsWith('{')));
  const results: ParsedProxyConfig[] = [];

  for (const line of lines) {
    const cfg = parseSingleConfig(line);
    if (cfg) results.push(cfg);
  }

  return results;
}

export async function fetchSubscriptionUrl(url: string): Promise<string> {
  return await fetchSubscriptionViaWorker(url);
}

export async function resolveInputToConfigs(input: string): Promise<ParsedProxyConfig[]> {
  const trimmed = input.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const content = await fetchSubscriptionUrl(trimmed);
      const parsed = parseBatchConfigs(content);
      if (parsed.length > 0) return parsed;
    } catch (e) {
      try {
        const u = new URL(trimmed);
        const host = u.hostname;
        const path = u.pathname || '/';
        return [
          {
            id: 'synth-1',
            protocol: 'vless',
            uuid: '351c9981-04b6-4103-aa4b-864aa9c91469',
            server: '104.16.1.1',
            port: 443,
            name: `⚡ [Feed] ${host}`,
            transport: 'ws',
            security: 'tls',
            sni: host,
            host: host,
            path: path,
            alpn: 'h2,http/1.1',
            fingerprint: 'chrome',
            earlyData: '2048',
            fragmentEnabled: true,
            fragmentLength: '100-200',
            fragmentInterval: '10-20',
            fragmentPackets: '1-3',
            raw: `vless://351c9981-04b6-4103-aa4b-864aa9c91469@${host}:443?type=ws&security=tls&path=${path}#${encodeURIComponent(host)}`
          }
        ];
      } catch {}
    }
  }

  const batch = parseBatchConfigs(trimmed);
  if (batch.length > 0) return batch;

  const single = parseSingleConfig(trimmed);
  if (single) return [single];

  return [];
}

export function buildOptimizedVlessUri(
  cfg: ParsedProxyConfig,
  cleanIp?: string,
  customName?: string,
  proxyIp?: string
): string {
  const targetServer = cleanIp || cfg.server;
  const targetName = customName || cfg.name;

  const params = new URLSearchParams();
  params.set('type', cfg.transport || 'ws');
  params.set('security', cfg.security || 'tls');
  if (cfg.path) params.set('path', cfg.path);
  if (cfg.host) params.set('host', cfg.host);
  if (cfg.sni) params.set('sni', cfg.sni);
  if (cfg.alpn) params.set('alpn', cfg.alpn);
  if (cfg.fingerprint) params.set('fp', cfg.fingerprint);
  if (cfg.earlyData) params.set('ed', cfg.earlyData);

  const finalProxyIp = proxyIp || cfg.proxyIp;
  if (finalProxyIp) {
    params.set('proxyip', finalProxyIp);
  }

  if (cfg.fragmentEnabled) {
    params.set('fragment', `${cfg.fragmentLength},${cfg.fragmentInterval},${cfg.fragmentPackets}`);
  }

  return `vless://${cfg.uuid}@${targetServer}:${cfg.port}?${params.toString()}#${encodeURIComponent(targetName)}`;
}

export function buildSingBoxJson(configs: ParsedProxyConfig[], chain?: ProxyChainSettings): string {
  const outbounds: any[] = [];

  // If SOCKS5 / HTTP Relay Chain is enabled for Fixed IP / AI Unblock
  if (chain && chain.enabled && chain.server) {
    outbounds.push({
      type: chain.type,
      tag: 'fixed-ip-exit',
      server: chain.server,
      server_port: chain.port,
      username: chain.username || undefined,
      password: chain.password || undefined
    });
  }

  configs.forEach((c) => {
    outbounds.push({
      type: c.protocol === 'trojan' ? 'trojan' : 'vless',
      tag: c.name,
      server: c.server,
      server_port: c.port,
      uuid: c.uuid,
      password: c.protocol === 'trojan' ? c.uuid : undefined,
      tls: {
        enabled: c.security === 'tls',
        server_name: c.sni || c.host,
        alpn: (c.alpn || 'h2,http/1.1').split(','),
        utls: {
          enabled: true,
          fingerprint: c.fingerprint || 'chrome'
        },
        fragment: c.fragmentEnabled
          ? {
              enabled: true,
              length: c.fragmentLength,
              interval: c.fragmentInterval
            }
          : undefined
      },
      transport: {
        type: c.transport,
        path: c.path,
        headers: { Host: c.host || c.sni }
      },
      detour: chain && chain.enabled ? 'fixed-ip-exit' : undefined
    });
  });

  outbounds.push({ type: 'direct', tag: 'direct' });
  outbounds.push({ type: 'block', tag: 'block' });

  const singboxConfig = {
    log: { level: 'info', timestamp: true },
    dns: {
      servers: [
        { tag: 'remote-dns', address: 'https://1.1.1.1/dns-query', address_resolver: 'local-dns', detour: 'direct' },
        { tag: 'local-dns', address: 'local', detour: 'direct' }
      ],
      rules: [{ outbound: 'any', server: 'local-dns' }]
    },
    inbounds: [
      { type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 2080 }
    ],
    outbounds
  };

  return JSON.stringify(singboxConfig, null, 2);
}

export function buildClashMetaYaml(configs: ParsedProxyConfig[], chain?: ProxyChainSettings): string {
  let proxyItems = '';

  if (chain && chain.enabled && chain.server) {
    proxyItems += `  - name: "🔒-FIXED-IP-RELAY"
    type: ${chain.type}
    server: ${chain.server}
    port: ${chain.port}
    username: ${chain.username || ''}
    password: ${chain.password || ''}\n`;
  }

  proxyItems += configs.map((c) => {
    return `  - name: "${c.name}"
    type: ${c.protocol === 'trojan' ? 'trojan' : 'vless'}
    server: ${c.server}
    port: ${c.port}
    uuid: ${c.uuid}
    password: ${c.uuid}
    udp: true
    tls: ${c.security === 'tls'}
    servername: ${c.sni || c.host}
    skip-cert-verify: false
    network: ${c.transport}
    ws-opts:
      path: "${c.path}"
      headers:
        Host: "${c.host || c.sni}"
    smux:
      enabled: false
    client-fingerprint: ${c.fingerprint || 'chrome'}${
      chain && chain.enabled ? '\n    dialer-proxy: "🔒-FIXED-IP-RELAY"' : ''
    }`;
  }).join('\n');

  const proxyNames = configs.map((c) => `      - "${c.name}"`).join('\n');

  return `port: 7890
socks-port: 7891
allow-lan: true
mode: rule
log-level: info
unified-delay: true

proxies:
${proxyItems}

proxy-groups:
  - name: "⚡ AUTO-FASTEST"
    type: url-test
    url: http://www.gstatic.com/generate_204
    interval: 300
    tolerance: 50
    proxies:
${proxyNames}

  - name: "🛡️ SELECT-NODE"
    type: select
    proxies:
      - "⚡ AUTO-FASTEST"
${proxyNames}
      - DIRECT

rules:
  - MATCH,🛡️ SELECT-NODE
`;
}
