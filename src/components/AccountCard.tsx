import React, { useState, useEffect } from 'react';
import { Copy, Check, Trash2, Edit3, Eye, Shield, Clock } from 'lucide-react';
import { DecryptedAccount } from '../lib/storage';
import { generateTOTP, getRemainingSeconds, formatOTPCode } from '../lib/totp';

interface AccountCardProps {
  account: DecryptedAccount;
  onEdit: (account: DecryptedAccount) => void;
  onDelete: (id: string, name: string) => void;
  showNextPreviewDefault?: boolean;
}

export const AccountCard: React.FC<AccountCardProps> = ({
  account,
  onEdit,
  onDelete,
  showNextPreviewDefault = false,
}) => {
  const [code, setCode] = useState<string>('------');
  const [nextCode, setNextCode] = useState<string | null>(null);
  const [showNext, setShowNext] = useState<boolean>(showNextPreviewDefault);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(30);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const period = account.period || 30;

  // Refresh code and timer every second
  useEffect(() => {
    let isMounted = true;

    const update = async () => {
      const now = Date.now();
      const remaining = getRemainingSeconds(period, now);
      if (isMounted) setRemainingSeconds(remaining);

      try {
        const currentOtp = await generateTOTP(account.secret, {
          timestamp: now,
          period,
          digits: account.digits || 6,
          algorithm: account.algorithm || 'SHA-1',
        });
        if (isMounted) {
          setCode(currentOtp);
          setError(null);
        }

        // Also calculate next code if preview is active
        if (showNext) {
          const nextOtp = await generateTOTP(account.secret, {
            timestamp: now + period * 1000,
            period,
            digits: account.digits || 6,
            algorithm: account.algorithm || 'SHA-1',
          });
          if (isMounted) setNextCode(nextOtp);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Invalid Key';
          setError(msg);
          setCode('ERROR');
        }
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [account, period, showNext]);

  const handleCopy = () => {
    if (code && code !== '------' && code !== 'ERROR') {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // SVG circular countdown progress math
  const radius = 16;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = (period - remainingSeconds) / period;
  const strokeDashoffset = circumference * progressRatio;

  // Color dynamics: purple/blue normal, amber warning, red critical
  const timerColor =
    remainingSeconds <= 5
      ? '#ef4444' // red
      : remainingSeconds <= 10
      ? '#f59e0b' // amber
      : '#818cf8'; // indigo-purple

  // Color hash for issuer avatar icon
  const getBrandHue = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hues = [
      'from-blue-600 to-indigo-700',
      'from-purple-600 to-pink-700',
      'from-emerald-600 to-teal-700',
      'from-indigo-600 to-cyan-700',
      'from-violet-600 to-purple-800',
      'from-sky-600 to-blue-800',
    ];
    return hues[Math.abs(hash) % hues.length];
  };

  return (
    <div className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/30 rounded-2xl p-4 sm:p-5 transition-all duration-200 shadow-md shadow-black/20 relative">
      <div className="flex items-start justify-between gap-3 mb-3">
        {/* Issuer & Account Identification */}
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getBrandHue(
              account.issuer
            )} flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0`}
          >
            {account.issuer.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-sm sm:text-base truncate group-hover:text-indigo-200 transition-colors">
              {account.issuer}
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[200px] sm:max-w-[280px]">
              {account.accountName}
            </p>
          </div>
        </div>

        {/* Card Actions: Next Code Peek, Edit, Delete */}
        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowNext(!showNext)}
            title={showNext ? 'Hide next code' : 'Preview next cycle code'}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors ${
              showNext ? 'bg-indigo-500/20 text-indigo-300' : 'hover:bg-slate-800'
            }`}
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(account)}
            title="Edit account details"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(account.id, `${account.issuer} (${account.accountName})`)}
            title="Delete account"
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main OTP Code Row & Circular Countdown */}
      <div className="flex items-center justify-between gap-4 pt-1">
        {/* OTP Code Display */}
        <div
          onClick={handleCopy}
          role="button"
          tabIndex={0}
          title="Click to copy code"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleCopy();
            }
          }}
          className="cursor-pointer select-all group/code flex items-center gap-3"
        >
          <div className="text-2xl sm:text-3xl font-bold font-mono tracking-wider text-sky-400 group-hover/code:text-sky-300 transition-colors">
            {formatOTPCode(code)}
          </div>
          <button
            type="button"
            className={`p-2 rounded-xl transition-all ${
              copied
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                : 'bg-slate-800/80 text-slate-400 group-hover/code:text-white group-hover/code:bg-slate-800'
            }`}
            title="Copy code"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Circular Countdown Progress Ring */}
        <div className="flex items-center gap-2">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="w-10 h-10 -rotate-90 transform" viewBox="0 0 36 36">
              {/* Background ring */}
              <circle
                cx="18"
                cy="18"
                r={radius}
                strokeWidth="3"
                className="stroke-slate-800 fill-none"
              />
              {/* Animated countdown progress ring */}
              <circle
                cx="18"
                cy="18"
                r={radius}
                strokeWidth="3"
                fill="none"
                stroke={timerColor}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 linear"
              />
            </svg>
            <span
              className="absolute text-[11px] font-mono font-semibold"
              style={{ color: timerColor }}
            >
              {remainingSeconds}
            </span>
          </div>
        </div>
      </div>

      {/* Next Code Preview Strip */}
      {showNext && nextCode && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 bg-slate-950/40 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 px-4 sm:px-5 py-2.5 rounded-b-2xl">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
            <span>Next code in {remainingSeconds}s:</span>
          </span>
          <span className="font-mono font-semibold text-slate-300 tracking-wider">
            {formatOTPCode(nextCode)}
          </span>
        </div>
      )}

      {/* Metadata footnote */}
      <div className="mt-2.5 flex items-center gap-2 text-[10px] text-slate-500 font-medium">
        <span>{account.digits || 6} Digits</span>
        <span aria-hidden="true">·</span>
        <span>{account.period || 30}s Period</span>
        <span aria-hidden="true">·</span>
        <span>{account.algorithm || 'SHA-1'}</span>
        {error && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-rose-400">{error}</span>
          </>
        )}
      </div>

      {/* Copied visual flash message */}
      {copied && (
        <div className="absolute top-2 right-12 text-[11px] font-medium text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-2 py-0.5 rounded-md animate-fade-in">
          Copied!
        </div>
      )}
    </div>
  );
};
