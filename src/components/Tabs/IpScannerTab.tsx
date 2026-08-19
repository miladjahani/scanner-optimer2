import React, { useState, useEffect } from 'react';
import {
  Activity,
  Play,
  Clock,
  Zap,
  Copy,
  Check,
  RefreshCw,
  Server,
  Filter,
  Sparkles,
  Bot,
  ArrowRight,
  ShieldCheck,
  Cpu,
  Download
} from 'lucide-react';
import { CleanIpItem, Language, ParsedProxyConfig, AppTab } from '../../types';
import { DEFAULT_CLEAN_IPS, CLOUDFLARE_CIDR_BLOCKS } from '../../utils/clean-ips';
import { translations } from '../../i18n';
import { scanCleanIpsViaPython, probeIpLatencyReal, checkPythonBackendStatus, fetchMultiRepoCleanIpsViaPython, runCloudflareCleanIpScanner } from '../../utils/backend-api';
import { GITHUB_CLEAN_IP_REPOSITORIES } from '../../utils/clean-ips';

interface Props {
  lang: Language;
  activeConfigs: ParsedProxyConfig[];
  setActiveConfigs: (cfgs: ParsedProxyConfig[]) => void;
  onNavigateTab: (tab: AppTab) => void;
}

export const IpScannerTab: React.FC<Props> = ({
  lang,
  activeConfigs,
  setActiveConfigs,
  onNavigateTab
}) => {
  const t = translations[lang];
  const isFa = lang === 'fa';

  const [items, setItems] = useState<CleanIpItem[]>(DEFAULT_CLEAN_IPS);
  const [testing, setTesting] = useState(false);
  const [filterOp, setFilterOp] = useState<'all' | 'mci' | 'mtn' | 'rtl' | 'shatel' | 'ai_proxyip' | 'fastly'>('all');
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [pythonOnline, setPythonOnline] = useState(false);
  const [syncingRepos, setSyncingRepos] = useState(false);
  const [scanningOfficial, setScanningOfficial] = useState(false);

  const handleRunOfficialCfScanner = async () => {
    setScanningOfficial(true);
    setTesting(true);
    try {
      const res = await runCloudflareCleanIpScanner(35, 443, 4, true);
      if (res && res.results && res.results.length > 0) {
        setItems(res.results);
        setPythonOnline(true);
        alert(isFa ? `اسکن با موتور Cloudflare-Clean-IP-Scanner کامل شد: ${res.count} آی‌پی تست و بر اساس سرعت دانلود رتبه‌بندی شدند!` : `Scan completed: ${res.count} clean IPs benchmarked!`);
      } else {
        await handleTestAll();
      }
    } catch (e: any) {
      alert(e.message || 'خطا در اسکن');
    } finally {
      setScanningOfficial(false);
      setTesting(false);
    }
  };

  const [selectedRepo, setSelectedRepo] = useState('all');

  const handleMultiRepoSync = async () => {
    setSyncingRepos(true);
    setTesting(true);

    try {
      const pyData = await fetchMultiRepoCleanIpsViaPython();
      if (pyData && pyData.results && pyData.results.length > 0) {
        setItems(pyData.results);
        setPythonOnline(true);
        alert(isFa ? `تعداد ${pyData.totalFound} آی‌پی تمیز از ۵ مخزن برتر گیت‌هاب دریافت و تست شد!` : `Synced and tested clean IPs from 5 top GitHub repositories!`);
      } else {
        // Fallback: fetch directly from vfarid and bih-cf-ip in browser
        const sources = [
          'https://raw.githubusercontent.com/vfarid/v2ray-share/master/ip/clean.txt',
          'https://raw.githubusercontent.com/bih-cf-ip/clean-ips/master/clean-ips.txt'
        ];
        const newItems: CleanIpItem[] = [];
        for (const s of sources) {
          try {
            const res = await fetch(s);
            if (res.ok) {
              const text = await res.text();
              const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).slice(0, 10);
              lines.forEach((l) => {
                const ipOnly = l.split('#')[0].split(':')[0].trim();
                if (ipOnly && !newItems.some((x) => x.ip === ipOnly)) {
                  newItems.push({
                    ip: ipOnly,
                    port: 443,
                    operator: 'global',
                    label: `⚡ [GitHub Live] ${ipOnly}`,
                    latency: null,
                    status: 'idle'
                  });
                }
              });
            }
          } catch {}
        }
        if (newItems.length > 0) {
          setItems((prev) => [...newItems, ...prev]);
          alert(isFa ? 'آی‌پی‌های جدید از مخازن گیت‌هاب دریافت شدند.' : 'Clean IPs fetched from GitHub!');
        }
      }
    } catch (err: any) {
      alert(err.message || 'خطا در دریافت مخازن');
    } finally {
      setSyncingRepos(false);
      setTesting(false);
    }
  };


  useEffect(() => {
    checkPythonBackendStatus().then(setPythonOnline);
  }, []);

  const handleTestAll = async () => {
    setTesting(true);
    const updated = items.map((it) => ({ ...it, status: 'testing' as const, latency: null, ttfb: null }));
    setItems(updated);

    // Try Python Multi-threaded Backend Scanner First (inspired by CloudflareSpeedTest)
    const pyResults = await scanCleanIpsViaPython(items.length);
    if (pyResults && pyResults.length > 0) {
      setItems(pyResults);
      setPythonOnline(true);
      setTesting(false);
      return;
    }

    // Fallback: Dual-Mode Accurate Latency Probe
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const res = await probeIpLatencyReal(it.ip, 2500);
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, latency: res.latency, ttfb: res.latency ? Math.round(res.latency * 0.75) : null, status: res.status } : item
        )
      );
    }
    setTesting(false);
  };

  const handleInjectToActiveConfigs = (cleanIp: string, label: string) => {
    if (activeConfigs.length === 0) {
      alert(isFa ? 'ابتدا کانفیگی در تب بهینه‌ساز وارد کنید.' : 'Please add configs in the Optimizer tab first.');
      onNavigateTab('quick_optimizer');
      return;
    }

    const updated = activeConfigs.map((c) => ({
      ...c,
      server: cleanIp,
      name: `${c.name} ⚡ [${label.split('-')[0].trim()}]`
    }));

    setActiveConfigs(updated);
    alert(isFa ? `آی‌پی تمیز ${cleanIp} با موفقیت به تمام کانفیگ‌های فعال تزریق شد!` : `Injected ${cleanIp} to active configs!`);
    onNavigateTab('quick_optimizer');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIp(text);
    setTimeout(() => setCopiedIp(null), 2000);
  };

  const filteredItems = items.filter((it) => {
    if (filterOp === 'all') return true;
    return it.operator === filterOp;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-fadeIn">
      {/* Top Banner */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-amber-400/30 shadow-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3 text-amber-400">
            <div className="p-3 bg-amber-400/10 border border-amber-400/30 rounded-2xl">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-white">بانک جامع آی‌پی تمیز، ساب‌نت‌ها و ProxyIP</h2>
                <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  pythonOnline
                    ? 'bg-lime/20 text-lime border-lime/40 shadow-[0_0_10px_rgba(0,255,136,0.3)]'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {pythonOnline ? '🐍 Python 20-Thread Engine' : '🌐 Browser Engine'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                سنجش چندریسمانی تاخیر TCP، سرعت دانلود واقعی (Mbps) و فیلتر اپراتورها (همراه اول، ایرانسل، رایتل و ProxyIP)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleRunOfficialCfScanner}
              disabled={scanningOfficial || testing}
              className="px-3.5 py-2.5 bg-lime text-black font-black text-xs rounded-xl hover:shadow-[0_0_15px_rgba(0,255,136,0.4)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {scanningOfficial ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>در حال اسکن رنج‌های رسمی...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-3.5 h-3.5" />
                  <span>اسکن موتور Cloudflare-Clean-IP</span>
                </>
              )}
            </button>

            <button
              onClick={handleMultiRepoSync}
              disabled={syncingRepos || testing}
              className="px-3.5 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-black text-xs rounded-xl hover:shadow-[0_0_15px_rgba(168,85,247,0.4)] transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {syncingRepos ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>در حال دریافت از ۵ مخزن...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>اسکن از ۵ مخزن برتر گیت‌هاب</span>
                </>
              )}
            </button>

            <button
              onClick={handleTestAll}
              disabled={testing}
              className="px-4 py-2.5 bg-amber-400 text-black font-black text-xs rounded-xl hover:shadow-[0_0_15px_rgba(245,158,11,0.4)] transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
            >
              {testing ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>در حال اسکن و سنجش سرعت...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-black" />
                  <span>شروع بنچ‌مارک پایتون</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 pt-2 flex-wrap text-xs font-bold border-t border-slate-800">
          <span className="text-slate-400">فیلتر بانک:</span>
          <button
            onClick={() => setFilterOp('all')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer ${
              filterOp === 'all' ? 'bg-amber-400 text-black font-black' : 'bg-slate-900 text-slate-300'
            }`}
          >
            همه ({items.length})
          </button>
          <button
            onClick={() => setFilterOp('mci')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer ${
              filterOp === 'mci' ? 'bg-lime text-black font-black' : 'bg-slate-900 text-lime'
            }`}
          >
            🟢 همراه اول (MCI)
          </button>
          <button
            onClick={() => setFilterOp('mtn')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer ${
              filterOp === 'mtn' ? 'bg-amber-400 text-black font-black' : 'bg-slate-900 text-amber-300'
            }`}
          >
            🟡 ایرانسل (MTN)
          </button>
          <button
            onClick={() => setFilterOp('rtl')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer ${
              filterOp === 'rtl' ? 'bg-purple-500 text-white font-black' : 'bg-slate-900 text-purple-300'
            }`}
          >
            🟣 رایتل (RTL)
          </button>
          <button
            onClick={() => setFilterOp('ai_proxyip')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer ${
              filterOp === 'ai_proxyip' ? 'bg-cyan text-black font-black' : 'bg-slate-900 text-cyan'
            }`}
          >
            🤖 آی‌پی آنلاک AI (Claude/Gemini)
          </button>
          <button
            onClick={() => setFilterOp('shatel')}
            className={`px-3 py-1.5 rounded-xl cursor-pointer ${
              filterOp === 'shatel' ? 'bg-blue-500 text-white font-black' : 'bg-slate-900 text-blue-300'
            }`}
          >
            🔵 مخابرات / شاتل
          </button>
        </div>
      </div>

      {/* Grid of Clean IPs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredItems.map((item, idx) => (
          <div
            key={idx}
            className="p-4 rounded-2xl bg-slate-950/85 border border-slate-800/90 hover:border-amber-400/40 transition-all flex flex-col justify-between text-xs space-y-3"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1 truncate">
                <span className="font-bold text-white block truncate">{item.label}</span>
                <span className="font-mono text-cyan text-[11px] block" dir="ltr">
                  {item.ip}:{item.port}
                </span>
              </div>

              <div className="text-right">
                {item.status === 'testing' && <Clock className="w-4 h-4 text-amber-400 animate-spin ml-auto" />}
                {item.status === 'success' && (
                  <div className="space-y-0.5">
                    <span
                      className={`font-black font-mono px-2 py-0.5 rounded text-[11px] block ${
                        (item.latency || 0) < 180
                          ? 'bg-lime/20 text-lime border border-lime/30'
                          : (item.latency || 0) < 320
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      {item.latency} ms
                    </span>
                    {(item as any).speedMbps && (
                      <span className="text-[10px] font-mono text-cyan font-bold block">
                        {(item as any).speedMbps} Mbps
                      </span>
                    )}
                  </div>
                )}
                {item.status === 'timeout' && (
                  <span className="text-slate-500 text-[10px] px-2 py-0.5 bg-slate-900 rounded">Timeout</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/80">
              <button
                onClick={() => handleInjectToActiveConfigs(item.ip, item.label)}
                className="flex-1 py-1.5 bg-amber-400/15 hover:bg-amber-400/25 text-amber-300 border border-amber-400/30 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <Zap className="w-3 h-3 text-amber-400" />
                <span>تزریق به کانفیگ‌ها</span>
              </button>

              <button
                onClick={() => handleCopy(item.ip)}
                className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl cursor-pointer"
                title="کپی IP"
              >
                {copiedIp === item.ip ? <Check className="w-3.5 h-3.5 text-lime" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
