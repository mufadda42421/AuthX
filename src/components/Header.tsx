import React from 'react';
import { Shield, Lock, Settings, CheckCircle2, Download, Code2, Monitor, Smartphone } from 'lucide-react';
import { VaultSettings } from '../lib/storage';

interface HeaderProps {
  isLocked: boolean;
  onLock: () => void;
  onOpenSettings: () => void;
  onOpenTestSuite: () => void;
  onOpenExtensionFiles: () => void;
  onDownloadExtension: () => void;
  viewMode: 'dashboard' | 'popup';
  onToggleViewMode: (mode: 'dashboard' | 'popup') => void;
  settings: VaultSettings;
  accountCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  isLocked,
  onLock,
  onOpenSettings,
  onOpenTestSuite,
  onOpenExtensionFiles,
  onDownloadExtension,
  viewMode,
  onToggleViewMode,
  accountCount,
}) => {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-base tracking-tight">AuthenticatorX</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-400 border border-indigo-500/30">
                  MV3
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">Your security codes. Always within reach.</p>
            </div>
          </div>

          {/* Mobile Quick Action Buttons */}
          <div className="flex items-center gap-1.5 md:hidden">
            {!isLocked && (
              <button
                onClick={onLock}
                title="Lock Vault"
                className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <Lock className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onOpenSettings}
              title="Settings"
              className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center: Viewport Switcher (Dashboard vs Extension Popup Simulator) */}
        <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-medium text-slate-400">
          <button
            onClick={() => onToggleViewMode('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'dashboard'
                ? 'bg-indigo-600/90 text-white shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            <span>Vault Dashboard</span>
            {!isLocked && accountCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-black/30 rounded-full text-[10px] font-mono">
                {accountCount}
              </span>
            )}
          </button>
          <button
            onClick={() => onToggleViewMode('popup')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              viewMode === 'popup'
                ? 'bg-indigo-600/90 text-white shadow-sm'
                : 'hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Extension Popup View</span>
          </button>
        </div>

        {/* Right Zone: Security Controls & Download Action */}
        <div className="hidden md:flex items-center gap-2.5">
          {/* RFC 6238 Verified Badge */}
          <button
            onClick={onOpenTestSuite}
            title="Click to view RFC 6238 official test vectors verification"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-900/30 text-xs font-medium transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>RFC 6238 Verified</span>
          </button>

          {/* Extension Source Files Explorer */}
          <button
            onClick={onOpenExtensionFiles}
            title="Inspect Chrome Extension Manifest V3 files"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 text-xs font-medium transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Extension Source</span>
          </button>

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            title="Settings & Backup"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Lock Button */}
          {!isLocked && (
            <button
              onClick={onLock}
              title="Lock Vault immediately"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-rose-400 hover:border-rose-500/40 text-xs font-medium transition-colors"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock Vault</span>
            </button>
          )}

          {/* Download Extension Package (.zip) */}
          <button
            onClick={onDownloadExtension}
            title="Download ready-to-load unpacked Chrome Extension .zip"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Get Chrome Extension (.zip)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
