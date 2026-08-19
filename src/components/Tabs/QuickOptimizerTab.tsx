import React, { useState, useRef } from 'react';
import {
  Zap,
  Copy,
  Check,
  QrCode,
  Sliders,
  Sparkles,
  RefreshCw,
  Layers,
  Globe,
  AlertCircle,
  Download,
  Upload,
  FileCode2,
  Bot,
  Lock,
  ArrowRight
} from 'lucide-react';
import { ParsedProxyConfig, Language, AppTab, ProxyChainSettings } from '../../types';
import { translations } from '../../i18n';
import { resolveInputToConfigs, buildOptimizedVlessUri, buildSingBoxJson } from '../../utils/config-parser';
import { saveBatchConfigs } from '../../utils/db';

interface Props {
  lang: Language;
  onOpenQr: (title: string, url: string) => void;
  activeConfigs: ParsedProxyConfig[];
  setActiveConfigs: (cfgs: ParsedProxyConfig[]) => void;
  onNavigateTab: (tab: AppTab) => void;
}

export const QuickOptimizerTab: React.FC<Props> = ({
  lang,
  onOpenQr,
  activeConfigs,
  setActiveConfigs,
  onNavigateTab
}) => {
  const t = translations[lang];
  const isFa = lang === 'fa';
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [inputConfig, setInputConfig] = useState(
    'https://edge-relay-cbbf.miladjahanii.workers.dev/feed/milad'
  );

  const [selectedPreset, setSelectedPreset] = useState<'anti_dpi' | 'multi_op' | 'gaming' | 'ai_unblock'>('anti_dpi');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [optimizedOutputs, setOptimizedOutputs] = useState<string[]>([]);

  // Advanced & Proxy Chain Settings
  const [customPath, setCustomPath] = useState('/stream');
  const [customEarlyData, setCustomEarlyData] = useState('2048');
  const [proxyIp, setProxyIp] = useState('www.visa.com.sg');
  const [socks5Server, setSocks5Server] = useState('');
  const [socks5Port, setSocks5Port] = useState('1080');
  const [enableChain, setEnableChain] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleOptimize = async (presetKey = selectedPreset) => {
    setLoading(true);
    setError('');
    try {
      const parsedList = await resolveInputToConfigs(inputConfig);
      if (parsedList.length === 0) {
        throw new Error(isFa ? 'کانفیگ یا لینک سابسکریپشن وارد شده نامعتبر است' : 'Invalid config or sub URL');
      }

      setActiveConfigs(parsedList);
      saveBatchConfigs(parsedList);
      const outputs: string[] = [];

      for (const p of parsedList) {
        if (presetKey === 'ai_unblock') {
          // Preset for Claude, Gemini, OpenAI Unlock (Injects ProxyIP & Clean Edge)
          const opt: ParsedProxyConfig = {
            ...p,
            path: customPath || p.path,
            earlyData: '2048',
            fingerprint: 'chrome',
            alpn: 'h2,http/1.1',
            fragmentEnabled: true,
            fragmentLength: '100-200',
            fragmentInterval: '10-20',
            fragmentPackets: '1-3',
            proxyIp: proxyIp || 'www.visa.com.sg'
          };
          outputs.push(buildOptimizedVlessUri(opt, '104.16.1.1', `${p.name} 🤖 [Claude & Gemini Unlocked]`, proxyIp || 'www.visa.com.sg'));
          outputs.push(buildOptimizedVlessUri(opt, '104.17.2.2', `${p.name} 🤖 [OpenAI & ChatGPT Fixed-IP]`, 'ip.sb'));
        } else if (presetKey === 'anti_dpi') {
          const opt: ParsedProxyConfig = {
            ...p,
            path: customPath || p.path,
            earlyData: customEarlyData || '2048',
            fingerprint: 'chrome',
            alpn: 'h2,http/1.1',
            fragmentEnabled: true,
            fragmentLength: '100-200',
            fragmentInterval: '10-20',
            fragmentPackets: '1-3'
          };
          outputs.push(buildOptimizedVlessUri(opt, '104.16.1.1', `${p.name} ⚡ [Anti-DPI Ultra]`));
          outputs.push(buildOptimizedVlessUri(opt, '104.17.2.2', `${p.name} ⚡ [Anti-DPI MTN]`));
        } else if (presetKey === 'multi_op') {
          const operators = [
            { op: 'MCI', ip: '104.16.1.1', tag: '🟢 همراه اول' },
            { op: 'MTN', ip: '104.17.2.2', tag: '🟡 ایرانسل' },
            { op: 'RTL', ip: '162.159.192.1', tag: '🟣 رایتل' },
            { op: 'FIXED', ip: '172.67.182.11', tag: '🔵 مخابرات / شاتل' }
          ];

          operators.forEach((item) => {
            const opt: ParsedProxyConfig = {
              ...p,
              path: customPath || p.path,
              earlyData: customEarlyData || '2048',
              fragmentEnabled: true,
              fragmentLength: '100-200',
              fragmentInterval: '10-20',
              fragmentPackets: '1-3'
            };
            outputs.push(buildOptimizedVlessUri(opt, item.ip, `${p.name} ${item.tag}`));
          });
        } else {
          const opt: ParsedProxyConfig = {
            ...p,
            path: customPath || p.path,
            earlyData: customEarlyData || '2048',
            fragmentEnabled: true,
            fragmentLength: '50-100',
            fragmentInterval: '1-3',
            fragmentPackets: '1-2',
            transport: 'ws'
          };
          outputs.push(buildOptimizedVlessUri(opt, '104.16.1.1', `${p.name} 🎮 [Low-Latency Gaming]`));
        }
      }

      setOptimizedOutputs(outputs);
    } catch (err: any) {
      setError(err.message || 'خطا در واکشی یا بهینه‌سازی');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInputConfig(content);
      }
    };
    reader.readAsText(file);
  };

  const getChainSettings = (): ProxyChainSettings | undefined => {
    if (!enableChain || !socks5Server) return undefined;
    return {
      enabled: true,
      type: 'socks5',
      server: socks5Server,
      port: parseInt(socks5Port, 10) || 1080,
      label: 'SOCKS5 Fixed IP Relay'
    };
  };

  const downloadJsonConfig = () => {
    if (activeConfigs.length === 0) return;
    const chain = getChainSettings();
    const jsonStr = buildSingBoxJson(activeConfigs, chain);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sing-box-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(optimizedOutputs.join('\n'));
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-lime/30 shadow-2xl space-y-3">
        <div className="flex items-center gap-3 text-lime">
          <div className="p-3 bg-lime/10 border border-lime/30 rounded-2xl">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">بهینه‌ساز پیشرفته کانفیگ، تزریق فرگمنت و زنجیره آی‌پی ثابت</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              پشتیبانی از پروکسی SOCKS5/HTTP جهت آی‌پی ثابت و آنلاک Claude و Gemini، بانک آی‌پی تمیز و خروجی JSON
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Input & Presets */}
        <div className="lg:col-span-5 glass-card rounded-3xl p-6 border border-white/10 shadow-xl space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-300 font-bold">
                کانفیگ، لینک فید یا فایل JSON:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".json,.txt,.data,.dat,.cfg"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] font-bold text-cyan hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>آپلود فایل JSON / TXT / DATA</span>
                </button>
              </div>
            </div>
            <textarea
              rows={4}
              value={inputConfig}
              onChange={(e) => {
                setInputConfig(e.target.value);
                setError('');
              }}
              placeholder="vless://, trojan://, JSON object یا لینک فید https://.../feed/..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-3 text-white font-mono text-[11px] focus:border-lime focus:outline-none leading-relaxed"
              dir="ltr"
            />
          </div>

          {error && (
            <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SOCKS5 / HTTP Relay & ProxyIP Section (AI Unblock) */}
          <div className="p-3 bg-slate-950/90 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan flex items-center gap-1.5">
                <Bot className="w-4 h-4" />
                <span>آی‌پی ثابت برای Claude، Gemini و ChatGPT:</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-[10px] text-lime hover:underline cursor-pointer"
              >
                {showAdvanced ? 'بستن تنظیمات' : 'تنظیمات پیشرفته'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-slate-400 block">ProxyIP (خروج از لبه کلودفلر):</span>
                <input
                  type="text"
                  value={proxyIp}
                  onChange={(e) => setProxyIp(e.target.value)}
                  placeholder="www.visa.com.sg"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-white text-[11px]"
                  dir="ltr"
                />
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Custom Path (مسیر وب‌سوکت):</span>
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-white text-[11px]"
                  dir="ltr"
                />
              </div>
            </div>

            {showAdvanced && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="enable_chain_cb"
                    checked={enableChain}
                    onChange={(e) => setEnableChain(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="enable_chain_cb" className="font-bold text-purple-300">
                    زنجیره پروکسی SOCKS5 خروجی (Outbound Chaining Relay)
                  </label>
                </div>

                {enableChain && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="col-span-2">
                      <input
                        type="text"
                        value={socks5Server}
                        onChange={(e) => setSocks5Server(e.target.value)}
                        placeholder="127.0.0.1 یا سرور SOCKS5"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-white text-[10px]"
                        dir="ltr"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={socks5Port}
                        onChange={(e) => setSocks5Port(e.target.value)}
                        placeholder="1080"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 font-mono text-white text-[10px] text-center"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="space-y-2">
            <label className="block text-slate-300 font-bold">استراتژی بهینه‌سازی:</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'ai_unblock', label: '🤖 آنلاک هوش مصنوعی (Claude & Gemini)', desc: 'تزریق ProxyIP اختصاصی جهت جلوگیری از بلاک کلودفلر و ارور ۴۰۳' },
                { id: 'anti_dpi', label: '⚡ ضد فیلتر هوشمند (Fragment + EarlyData)', desc: 'Fragment 100-200 + EarlyData 2048 + Chrome uTLS' },
                { id: 'multi_op', label: '🌐 ۴ اپراتور (همراه اول، ایرانسل، رایتل)', desc: 'تولید نود اختصاصی برای تمامی اپراتورها با آی‌پی‌های تمیز' },
                { id: 'gaming', label: '🎮 کاهش پینگ و تاخیر گیمینگ (1-3ms)', desc: 'فرگمنت با وقفه فوق‌سریع ۱ تا ۳ میلی‌ثانیه' }
              ].map((pst) => (
                <div
                  key={pst.id}
                  onClick={() => {
                    setSelectedPreset(pst.id as any);
                    handleOptimize(pst.id as any);
                  }}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    selectedPreset === pst.id
                      ? 'bg-lime/10 border-lime shadow-[0_0_15px_rgba(0,255,136,0.2)]'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className="font-bold text-white block text-xs">{pst.label}</span>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">{pst.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => handleOptimize()}
            disabled={loading}
            className="w-full py-3.5 bg-lime text-black font-black text-xs rounded-2xl hover:shadow-[0_0_20px_rgba(0,255,136,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                <span>در حال واکشی و بهینه‌سازی زنده...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>تزریق فرگمنت و بهینه‌سازی نودها</span>
              </>
            )}
          </button>
        </div>

        {/* Right Output Showcase & Chained Actions */}
        <div className="lg:col-span-7 glass-card rounded-3xl p-6 border border-white/10 shadow-xl space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-300">
                کانفیگ‌های بهینه‌شده نهایی:
              </span>
              {optimizedOutputs.length > 0 && (
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-lime/15 text-lime border border-lime/30">
                  {optimizedOutputs.length} نود
                </span>
              )}
            </div>

            {optimizedOutputs.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={downloadJsonConfig}
                  className="px-3 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  title="دانلود فایل JSON برای Sing-Box"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>دانلود JSON</span>
                </button>

                <button
                  onClick={handleCopyAll}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-lime font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                >
                  {copiedId === 'all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedId === 'all' ? 'کپی شد!' : 'کپی همه'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {optimizedOutputs.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                <Sparkles className="w-8 h-8 text-slate-600" />
                <span>کانفیگ یا لینک فید خود را وارد کرده و دکمه بهینه‌سازی را بزنید...</span>
              </div>
            ) : (
              optimizedOutputs.map((outUri, idx) => (
                <div
                  key={idx}
                  className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 hover:border-slate-700 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono font-bold text-cyan truncate max-w-[260px]">
                      {decodeURIComponent(outUri.split('#')[1] || `Node ${idx + 1}`)}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-lime/10 text-lime border border-lime/20">
                      Fragment + ProxyIP ⚡
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded-xl font-mono text-[10px] text-slate-300 break-all max-h-16 overflow-y-auto" dir="ltr">
                    {outUri}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => handleCopy(outUri, `out-${idx}`)}
                      className="flex-1 py-1.5 bg-lime text-black font-black text-xs rounded-xl hover:shadow-[0_0_12px_rgba(0,255,136,0.3)] transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      {copiedId === `out-${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId === `out-${idx}` ? t.copied : t.copy}</span>
                    </button>
                    <button
                      onClick={() => onOpenQr('کانفیگ بهینه‌شده', outUri)}
                      className="p-1.5 bg-slate-900 hover:bg-slate-800 text-cyan border border-cyan/30 rounded-xl cursor-pointer"
                      title="QR Code"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chained Workflow Quick Jump Buttons */}
          {optimizedOutputs.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px] font-bold">
              <button
                onClick={() => onNavigateTab('sub_link_gen')}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-lime border border-lime/30 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>🔗 ساخت لینک ساب</span>
              </button>
              <button
                onClick={() => onNavigateTab('converter')}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-purple-300 border border-purple-500/30 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>🔄 مبدل Sing-Box</span>
              </button>
              <button
                onClick={() => onNavigateTab('gaming_live_ping')}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-cyan border border-cyan/30 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>🎮 پینگ زنده نودها</span>
              </button>
              <button
                onClick={() => onNavigateTab('ip_scanner')}
                className="p-2.5 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-400/30 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>🧪 بانک آی‌پی تمیز</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
