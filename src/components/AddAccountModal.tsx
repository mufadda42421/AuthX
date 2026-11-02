import React, { useState, useEffect, useRef } from 'react';
import { QrCode, Key, Link as LinkIcon, Camera, Upload, AlertCircle, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { DecryptedAccount } from '../lib/storage';
import { HashAlgorithm, parseOtpAuthUri, validateBase32, generateTOTP, formatOTPCode } from '../lib/totp';
import { scanQRCodeFile, scanImageData } from '../lib/qr-import';

interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (account: {
    issuer: string;
    accountName: string;
    secret: string;
    digits: number;
    period: number;
    algorithm: HashAlgorithm;
    id?: string;
  }) => Promise<void>;
  editAccount?: DecryptedAccount | null;
}

export const AddAccountModal: React.FC<AddAccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editAccount,
}) => {
  const [tab, setTab] = useState<'qr' | 'manual' | 'uri'>('manual');
  const [issuer, setIssuer] = useState('');
  const [accountName, setAccountName] = useState('');
  const [secret, setSecret] = useState('');
  const [digits, setDigits] = useState<number>(6);
  const [period, setPeriod] = useState<number>(30);
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('SHA-1');
  const [uriText, setUriText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  // Camera scanner state
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  // Populate fields if editing
  useEffect(() => {
    if (editAccount) {
      setIssuer(editAccount.issuer);
      setAccountName(editAccount.accountName);
      setSecret(editAccount.secret);
      setDigits(editAccount.digits);
      setPeriod(editAccount.period);
      setAlgorithm(editAccount.algorithm);
      setTab('manual');
    } else {
      setIssuer('');
      setAccountName('');
      setSecret('');
      setDigits(6);
      setPeriod(30);
      setAlgorithm('SHA-1');
      setUriText('');
      setTab('manual');
    }
    setError(null);
  }, [editAccount, isOpen]);

  // Clean camera stream on modal close
  useEffect(() => {
    if (!isOpen) {
      stopCamera();
    }
  }, [isOpen]);

  // Live OTP Code Preview as user types secret
  useEffect(() => {
    const cleanSecret = secret.toUpperCase().replace(/[\s\-=]/g, '');
    if (cleanSecret && validateBase32(cleanSecret)) {
      generateTOTP(cleanSecret, { digits, period, algorithm })
        .then((code) => setPreviewCode(code))
        .catch(() => setPreviewCode(null));
    } else {
      setPreviewCode(null);
    }
  }, [secret, digits, period, algorithm]);

  const handleUriChange = (val: string) => {
    setUriText(val);
    setError(null);
    if (val.trim().startsWith('otpauth://')) {
      try {
        const parsed = parseOtpAuthUri(val.trim());
        setIssuer(parsed.issuer);
        setAccountName(parsed.account);
        setSecret(parsed.secret);
        setDigits(parsed.digits);
        setPeriod(parsed.period);
        setAlgorithm(parsed.algorithm);
        setError(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid URI';
        setError(msg);
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);

    try {
      const parsed = await scanQRCodeFile(file);
      setIssuer(parsed.issuer);
      setAccountName(parsed.account);
      setSecret(parsed.secret);
      setDigits(parsed.digits);
      setPeriod(parsed.period);
      setAlgorithm(parsed.algorithm);
      setTab('manual'); // Switch to manual to show extracted fields and preview!
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to scan QR';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Paste image directly from clipboard
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setError(null);
          setLoading(true);
          try {
            const parsed = await scanQRCodeFile(file);
            setIssuer(parsed.issuer);
            setAccountName(parsed.account);
            setSecret(parsed.secret);
            setDigits(parsed.digits);
            setPeriod(parsed.period);
            setAlgorithm(parsed.algorithm);
            setTab('manual');
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'QR code not found in pasted image';
            setError(msg);
          } finally {
            setLoading(false);
          }
          break;
        }
      }
    }
  };

  const startCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          startScanningLoop();
        }
      }, 100);
    } catch {
      setError('Unable to access camera. Please allow camera permissions or upload a QR image.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startScanningLoop = () => {
    scanIntervalRef.current = window.setInterval(() => {
      if (!videoRef.current || !canvasRef.current || videoRef.current.readyState !== 4) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const qrText = scanImageData(imageData);

      if (qrText && qrText.startsWith('otpauth://')) {
        try {
          const parsed = parseOtpAuthUri(qrText);
          setIssuer(parsed.issuer);
          setAccountName(parsed.account);
          setSecret(parsed.secret);
          setDigits(parsed.digits);
          setPeriod(parsed.period);
          setAlgorithm(parsed.algorithm);
          stopCamera();
          setTab('manual');
        } catch (err: unknown) {
          console.error(err);
        }
      }
    }, 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanSecret = secret.toUpperCase().replace(/[\s\-=]/g, '');
    if (!cleanSecret) {
      setError('Secret key is required.');
      return;
    }

    if (!validateBase32(cleanSecret)) {
      setError('Invalid Base32 secret key. Allowed characters: A-Z and 2-7.');
      return;
    }

    setLoading(true);
    try {
      await onSave({
        id: editAccount?.id,
        issuer: issuer.trim() || 'Service',
        accountName: accountName.trim() || 'Account',
        secret: cleanSecret,
        digits,
        period,
        algorithm,
      });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save account';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onPaste={handlePaste}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
    >
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Key className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">
              {editAccount ? 'Edit 2FA Account' : 'Add 2FA Account'}
            </h3>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Import Tabs */}
        {!editAccount && (
          <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/40 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setTab('manual');
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                tab === 'manual'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Manual Key</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('qr');
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                tab === 'qr'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Scan QR Code</span>
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setTab('uri');
              }}
              className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                tab === 'uri'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Key URI</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Tab: QR Code */}
          {tab === 'qr' && !editAccount && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 text-center bg-slate-950/40 transition-colors">
                <Upload className="w-8 h-8 mx-auto text-indigo-400 mb-2" />
                <p className="text-sm font-semibold text-white mb-1">
                  Upload or paste QR code image
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  Drag & drop an image, click to browse, or paste with{' '}
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300">
                    Ctrl + V
                  </kbd>
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer transition-colors shadow-md shadow-indigo-600/20">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Choose Image File</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Camera Scanner */}
              <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4 text-center">
                {!cameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors"
                  >
                    <Camera className="w-4 h-4 text-indigo-400" />
                    <span>Scan with Web Camera</span>
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-xl overflow-hidden aspect-video bg-black flex items-center justify-center border border-indigo-500/40">
                      <video
                        ref={videoRef}
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <canvas ref={canvasRef} className="hidden" />
                      {/* Aim reticle overlay */}
                      <div className="absolute inset-8 border-2 border-indigo-400/80 rounded-lg pointer-events-none animate-pulse" />
                    </div>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      Stop Camera
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: URI Import */}
          {tab === 'uri' && !editAccount && (
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                Paste otpauth:// Key URI
              </label>
              <textarea
                value={uriText}
                onChange={(e) => handleUriChange(e.target.value)}
                rows={3}
                placeholder="otpauth://totp/GitHub:alice?secret=JBSWY3DPEHPK3PXP&issuer=GitHub..."
                className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400">
                Standard RFC 6238 key URI format generated by two-factor authentication providers.
              </p>
            </div>
          )}

          {/* Form fields (Always visible on manual tab or populated from QR/URI) */}
          {(tab === 'manual' || editAccount) && (
            <form id="add-account-form" onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Service / Issuer
                  </label>
                  <input
                    type="text"
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    placeholder="e.g. GitHub, Google, AWS"
                    required
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Account Identifier
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. user@domain.com"
                    required
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Secret Key (Base32)
                </label>
                <input
                  type="text"
                  value={secret}
                  onChange={(e) => setSecret(e.target.value.toUpperCase())}
                  placeholder="e.g. JBSWY3DPEHPK3PXP"
                  required
                  autoComplete="off"
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs font-mono tracking-wider text-sky-400 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Spaces and dashes are automatically stripped. Case-insensitive Base32 alphabet.
                </p>
              </div>

              {/* Advanced Parameters: Digits, Period, Algorithm */}
              <div className="grid grid-cols-3 gap-2.5 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Digits
                  </label>
                  <select
                    value={digits}
                    onChange={(e) => setDigits(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={6}>6 digits (Standard)</option>
                    <option value={8}>8 digits</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Period
                  </label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value={30}>30 seconds</option>
                    <option value={60}>60 seconds</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Algorithm
                  </label>
                  <select
                    value={algorithm}
                    onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="SHA-1">SHA-1 (Default)</option>
                    <option value="SHA-256">SHA-256</option>
                    <option value="SHA-512">SHA-512</option>
                  </select>
                </div>
              </div>

              {/* Live Verification Code Preview */}
              {previewCode && (
                <div className="p-3 bg-indigo-950/30 border border-indigo-500/30 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold text-indigo-200">
                        Live Code Preview:
                      </span>
                      <p className="text-[10px] text-slate-400">
                        Generated right now using Web Crypto RFC 6238
                      </p>
                    </div>
                  </div>
                  <div className="font-mono font-bold text-lg text-sky-400 tracking-wider">
                    {formatOTPCode(previewCode)}
                  </div>
                </div>
              )}
            </form>
          )}

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-account-form"
            disabled={loading || (tab === 'manual' && !secret)}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>{editAccount ? 'Update Account' : 'Save Encrypted Account'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
