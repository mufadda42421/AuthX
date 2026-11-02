import React, { useState } from 'react';
import { ShieldAlert, KeyRound, Eye, EyeOff, Lock, Sparkles, AlertCircle } from 'lucide-react';

interface LockScreenProps {
  isInitialized: boolean;
  onInitialize: (password: string) => Promise<void>;
  onUnlock: (password: string) => Promise<boolean>;
  onResetVault: () => Promise<void>;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  isInitialized,
  onInitialize,
  onUnlock,
  onResetVault,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isInitialized) {
      if (password.length < 8) {
        setError('Master password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please re-enter carefully.');
        return;
      }

      setLoading(true);
      try {
        await onInitialize(password);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg || 'Failed to initialize vault.');
      } finally {
        setLoading(false);
      }
    } else {
      setLoading(true);
      try {
        const success = await onUnlock(password);
        if (!success) {
          setError('Incorrect master password. Please verify and try again.');
        } else {
          setPassword('');
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg || 'Decryption failed.');
      } finally {
        setLoading(false);
      }
    }
  };

  const calculatePasswordStrength = (pass: string) => {
    let score = 0;
    if (pass.length >= 8) score++;
    if (pass.length >= 12) score++;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;
    return score; // 0 to 5
  };

  const strength = calculatePasswordStrength(password);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-6 md:p-8 shadow-2xl shadow-black/60 relative overflow-hidden">
        {/* Subtle glowing ambient gradient */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 text-white mb-4">
            {isInitialized ? <Lock className="w-7 h-7" /> : <KeyRound className="w-7 h-7" />}
          </div>

          <h2 className="text-xl font-bold text-white mb-1.5">
            {isInitialized ? 'AuthenticatorX Vault Locked' : 'Initialize AuthenticatorX Vault'}
          </h2>
          <p className="text-xs text-slate-400 mb-6 max-w-sm mx-auto leading-relaxed">
            {isInitialized
              ? 'Enter your master password to decrypt your TOTP secret keys with Web Crypto AES-GCM.'
              : 'Create a master password to encrypt all your two-factor authentication secrets locally with 256-bit AES-GCM.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isInitialized ? 'Master Password' : 'Create Master Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter master password..."
                  required
                  autoFocus
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {!isInitialized && password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3, 4, 5].map((lvl) => (
                      <div
                        key={lvl}
                        className={`flex-1 rounded-full transition-colors ${
                          strength >= lvl
                            ? strength <= 2
                              ? 'bg-rose-500'
                              : strength <= 3
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                            : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>At least 8 characters</span>
                    <span>
                      {strength <= 2 ? 'Weak' : strength <= 3 ? 'Medium' : 'Strong'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!isInitialized && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Confirm Master Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat master password..."
                  required
                  className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-400 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isInitialized ? (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Unlock Vault</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Secure & Initialize Vault</span>
                </>
              )}
            </button>
          </form>

          {/* Security architecture highlights */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1.5 text-left">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Zero-knowledge client-side encryption</span>
            </div>
            <p className="text-slate-400 leading-relaxed pl-3.5">
              Derived with PBKDF2 (100,000 iterations, SHA-256) and AES-GCM 256-bit authenticated cipher. Stored keys are never exposed or transmitted.
            </p>
          </div>

          {isInitialized && (
            <div className="mt-4 text-center">
              {!showResetConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="text-[11px] text-slate-500 hover:text-rose-400 transition-colors"
                >
                  Forgot master password? Reset vault
                </button>
              ) : (
                <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-xl space-y-2 mt-2">
                  <div className="flex items-center gap-1.5 text-rose-300 text-xs font-semibold justify-center">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Resetting will wipe all local encrypted accounts</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Without your master password, AES-GCM encrypted data cannot be decrypted.
                  </p>
                  <div className="flex gap-2 justify-center pt-1">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="px-3 py-1 bg-slate-800 text-slate-300 rounded-lg text-xs hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await onResetVault();
                        setShowResetConfirm(false);
                      }}
                      className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-500"
                    >
                      Confirm Reset
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
