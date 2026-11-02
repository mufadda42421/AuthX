import React from 'react';
import { Shield, Settings, Lock, Plus, Search, ExternalLink } from 'lucide-react';
import { DecryptedAccount } from '../lib/storage';
import { AccountCard } from './AccountCard';

interface ExtensionPreviewFrameProps {
  accounts: DecryptedAccount[];
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onAddAccount: () => void;
  onEditAccount: (acc: DecryptedAccount) => void;
  onDeleteAccount: (id: string, name: string) => void;
  onLockVault: () => void;
  onOpenSettings: () => void;
  onOpenExtensionFiles: () => void;
  showNextPreview: boolean;
}

export const ExtensionPreviewFrame: React.FC<ExtensionPreviewFrameProps> = ({
  accounts,
  searchQuery,
  onSearchChange,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onLockVault,
  onOpenSettings,
  onOpenExtensionFiles,
  showNextPreview,
}) => {
  const filtered = accounts.filter(
    (a) =>
      a.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.accountName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col items-center justify-center py-6 px-4">
      {/* Chrome Browser Extension Container Mockup */}
      <div className="w-full max-w-[400px] bg-[#1e2330] rounded-2xl shadow-2xl shadow-black/80 border border-slate-700/60 overflow-hidden flex flex-col">
        {/* Mock Browser Header / Chrome Toolbar */}
        <div className="bg-[#181c27] px-4 py-2.5 border-b border-slate-700/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>

          <div className="flex items-center gap-2 bg-[#0f131c] px-3 py-1 rounded-lg border border-slate-700/40 text-[11px] text-slate-400 font-mono">
            <span>chrome-extension://authenticatorx</span>
          </div>

          <div className="flex items-center gap-1 text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" title="MV3 Active" />
          </div>
        </div>

        {/* Real Extension Dimensions (380px x 580px) */}
        <div className="w-full h-[580px] bg-[#080c16] flex flex-col text-slate-100 overflow-hidden relative">
          {/* Extension Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-sm text-white block leading-tight">
                  AuthenticatorX
                </span>
                <span className="text-[10px] text-slate-400 block">Secure 2FA Vault</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={onOpenSettings}
                title="Settings"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={onLockVault}
                title="Lock Vault"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search & Add Bar */}
          <div className="p-3 pb-2 flex gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search accounts..."
                className="w-full bg-[#131b2e] border border-slate-800 focus:border-indigo-500 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
              />
            </div>
            <button
              onClick={onAddAccount}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors shadow-sm cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>

          {/* Accounts List Viewport */}
          <div className="flex-1 overflow-y-auto p-3 pt-1 space-y-2.5">
            {filtered.length > 0 ? (
              filtered.map((acc) => (
                <AccountCard
                  key={acc.id}
                  account={acc}
                  onEdit={onEditAccount}
                  onDelete={onDeleteAccount}
                  showNextPreviewDefault={showNextPreview}
                />
              ))
            ) : accounts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
                  <Shield className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">No 2FA Accounts</h4>
                <p className="text-xs text-slate-400 mb-4 max-w-[220px]">
                  Add your first service via Base32 key, otpauth:// URI, or QR upload.
                </p>
                <button
                  onClick={onAddAccount}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-md shadow-indigo-600/20"
                >
                  Add First Account
                </button>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-500">
                No accounts match &quot;{searchQuery}&quot;
              </div>
            )}
          </div>

          {/* Extension Bottom Bar */}
          <div className="px-3 py-2 bg-[#0f172a] border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>{accounts.length} encrypted account(s)</span>
            <button
              onClick={onOpenExtensionFiles}
              className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>View Source</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400 mt-3 text-center max-w-sm">
        Simulating the actual 380×580px Chrome extension popup window running real Web Crypto TOTP.
      </p>
    </div>
  );
};
