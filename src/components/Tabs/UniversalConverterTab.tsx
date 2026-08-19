import React, { useState } from 'react';
import {
  RefreshCw,
  Copy,
  Check,
  Download,
  QrCode,
  FileCode2,
  ExternalLink,
  Shield,
  Sparkles,
  Layers
} from 'lucide-react';
import { Language, ParsedProxyConfig } from '../../types';
import { translations } from '../../i18n';
import { parseBatchConfigs, buildSingBoxJson, buildClashMetaYaml, buildOptimizedVlessUri } from '../../utils/config-parser';

interface Props {
  lang: Language;
  onOpenQr: (title: string, url: string) => void;
  activeConfigs: ParsedProxyConfig[];
}

export const UniversalConverterTab: React.FC<Props> = ({ lang, onOpenQr, activeConfigs }) => {
  const t = translations[lang];
  const isFa = lang === 'fa';

  const [inputData, setInputData] = useState(() => {
    if (activeConfigs.length > 0) {
      return activeConfigs.map((c) => buildOptimizedVlessUri(c)).join('\n');
    }
    return `vless://351c9981-04b6-4103-aa4b-864aa9c91469@104.16.1.1:443?type=ws&security=tls&path=/stream&host=example.workers.dev#⚡-Node-1
vless://351c9981-04b6-4103-aa4b-864aa9c91469@104.17.2.2:443?type=ws&security=tls&path=/stream&host=example.workers.dev#⚡-Node-2`;
  });

  const [targetFormat, setTargetFormat] = useState<'singbox' | 'clash' | 'vless' | 'base64'>('singbox');
  const [copied, setCopied] = useState(false);

  const getConvertedOutput = (): string => {
    const configs = parseBatchConfigs(inputData);
    if (configs.length === 0) return isFa ? 'هیچ کانفیگ معتبری در ورودی یافت نشد.' : 'No valid configs found in input.';

    if (targetFormat === 'singbox') {
      return buildSingBoxJson(configs);
    } else if (targetFormat === 'clash') {
      return buildClashMetaYaml(configs);
    } else if (targetFormat === 'base64') {
      const vlessList = configs.map((c) => buildOptimizedVlessUri(c)).join('\n');
      return btoa(unescape(encodeURIComponent(vlessList)));
    } else {
      return configs.map((c) => buildOptimizedVlessUri(c)).join('\n');
    }
  };

  const handleDownloadFile = () => {
    const content = getConvertedOutput();
    const isJson = targetFormat === 'singbox';
    const isYaml = targetFormat === 'clash';
    const filename = isJson ? 'sing-box-config.json' : isYaml ? 'clash-config.yaml' : 'subscription.txt';
    const mimeType = isJson ? 'application/json' : isYaml ? 'text/yaml' : 'text/plain';

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getConvertedOutput());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner */}
      <div className="glass-card rounded-3xl p-6 sm:p-8 border border-purple-500/30 shadow-2xl space-y-3">
        <div className="flex items-center gap-3 text-purple-400">
          <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-2xl">
            <RefreshCw className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white">{t.conv_title}</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{t.conv_desc}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="glass-card rounded-3xl p-6 border border-white/10 shadow-xl space-y-4 text-xs flex flex-col">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-300">کانفیگ‌های ورودی (Multi-line / Sub / JSON):</span>
            <button
              onClick={() => setInputData('')}
              className="text-[11px] text-rose-400 hover:underline cursor-pointer"
            >
              پاک‌سازی
            </button>
          </div>

          <textarea
            rows={12}
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            placeholder="کانفیگ‌های خود را خط به خط، فرمت JSON یا رشته Base64 سابسکریپشن را وارد کنید..."
            className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-2xl p-3.5 text-white font-mono text-[11px] focus:border-purple-400 focus:outline-none leading-relaxed"
            dir="ltr"
          />
        </div>

        {/* Right: Converted Output */}
        <div className="glass-card rounded-3xl p-6 border border-white/10 shadow-xl space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-bold">
              <button
                onClick={() => setTargetFormat('singbox')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                  targetFormat === 'singbox' ? 'bg-purple-500 text-white font-black' : 'text-slate-400'
                }`}
              >
                Sing-Box 1.11+ JSON
              </button>
              <button
                onClick={() => setTargetFormat('clash')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                  targetFormat === 'clash' ? 'bg-blue-500 text-white font-black' : 'text-slate-400'
                }`}
              >
                Clash Meta YAML
              </button>
              <button
                onClick={() => setTargetFormat('vless')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                  targetFormat === 'vless' ? 'bg-lime text-black font-black' : 'text-slate-400'
                }`}
              >
                VLESS Links
              </button>
              <button
                onClick={() => setTargetFormat('base64')}
                className={`px-3 py-1.5 rounded-xl cursor-pointer ${
                  targetFormat === 'base64' ? 'bg-cyan text-black font-black' : 'text-slate-400'
                }`}
              >
                Base64 Sub
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownloadFile}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 font-bold text-xs rounded-xl cursor-pointer"
                title="دانلود فایل"
              >
                <Download className="w-3.5 h-3.5" />
                <span>دانلود فایل</span>
              </button>

              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 bg-lime text-black font-black text-xs rounded-xl hover:shadow-[0_0_12px_rgba(0,255,136,0.3)] transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t.copied : t.copy}</span>
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-950 p-3.5 rounded-2xl border border-slate-800 font-mono text-[11px] text-purple-300 max-h-[320px] overflow-y-auto leading-relaxed" dir="ltr">
            <pre className="whitespace-pre-wrap break-all">{getConvertedOutput()}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
