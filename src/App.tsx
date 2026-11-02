/**
 * AuthenticatorX - Chrome Extension & Security Vault Web Application
 * TAGLINE: Your security codes. Always within reach.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Plus,
  Search,
  Lock,
  Download,
  CheckCircle2,
  Code2,
  Trash2,
  AlertTriangle,
  QrCode,
  Key,
  Database,
  ExternalLink,
} from 'lucide-react';
import { vault, DecryptedAccount, VaultSettings } from './lib/storage';
import { downloadExtensionZipPackage } from './lib/extension-files';
import { Header } from './components/Header';
import { LockScreen } from './components/LockScreen';
import { AccountCard } from './components/AccountCard';
import { AddAccountModal } from './components/AddAccountModal';
import { SettingsModal } from './components/SettingsModal';
import { RFC6238TestModal } from './components/RFC6238TestModal';
import { ExtensionFilesModal } from './components/ExtensionFilesModal';
import { ExtensionPreviewFrame } from './components/ExtensionPreviewFrame';

export default function App() {
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [isLocked, setIsLocked] = useState<boolean>(true);
  const [accounts, setAccounts] = useState<DecryptedAccount[]>([]);
  const [settings, setSettings] = useState<VaultSettings>({
    autoLockMinutes: 5,
    theme: 'dark-navy',
    showNextCode: false,
    compactView: false,
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'dashboard' | 'popup'>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<DecryptedAccount | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isTestSuiteModalOpen, setIsTestSuiteModalOpen] = useState(false);
  const [isExtensionFilesModalOpen, setIsExtensionFilesModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  // Check vault status on mount
  const checkStatus = useCallback(async () => {
    try {
      const meta = await vault.getMetadata();
      setIsInitialized(meta.isInitialized);
      setSettings(meta.settings);
      const locked = vault.isLocked();
      setIsLocked(locked);

      if (!locked) {
        const accs = await vault.getAccounts();
        setAccounts(accs);
      }
    } catch (err) {
      console.error('Failed to load vault status:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const unsub = vault.onLock(() => {
      setIsLocked(true);
      setAccounts([]);
    });
    return () => unsub();
  }, [checkStatus]);

  // Periodic Auto-Lock Check
  useEffect(() => {
    const timer = setInterval(() => {
      if (!isLocked && settings.autoLockMinutes > 0) {
        const didLock = vault.checkAutoLock(settings.autoLockMinutes);
        if (didLock) {
          setIsLocked(true);
          setAccounts([]);
        }
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [isLocked, settings.autoLockMinutes]);

  // Apply Theme class/colors to document
  useEffect(() => {
    const themeBgMap: Record<string, string> = {
      'dark-navy': '#080c16',
      'cyber-midnight': '#0b0f19',
      'deep-slate': '#0f172a',
      'oled-black': '#000000',
    };
    document.body.style.backgroundColor = themeBgMap[settings.theme] || '#080c16';
  }, [settings.theme]);

  // Handlers
  const handleInitialize = async (password: string) => {
    await vault.initializeVault(password);
    setIsInitialized(true);
    setIsLocked(false);
    setAccounts([]);
  };

  const handleUnlock = async (password: string): Promise<boolean> => {
    const success = await vault.unlock(password);
    if (success) {
      setIsLocked(false);
      const accs = await vault.getAccounts();
      setAccounts(accs);
      return true;
    }
    return false;
  };

  const handleLock = () => {
    vault.lock();
    setIsLocked(true);
    setAccounts([]);
  };

  const handleSaveAccount = async (accountData: {
    issuer: string;
    accountName: string;
    secret: string;
    digits: number;
    period: number;
    algorithm: 'SHA-1' | 'SHA-256' | 'SHA-512';
    id?: string;
  }) => {
    if (accountData.id) {
      await vault.updateAccount(accountData.id, {
        issuer: accountData.issuer,
        accountName: accountData.accountName,
        secret: accountData.secret,
        digits: accountData.digits,
        period: accountData.period,
        algorithm: accountData.algorithm,
      });
    } else {
      await vault.addAccount({
        issuer: accountData.issuer,
        accountName: accountData.accountName,
        secret: accountData.secret,
        digits: accountData.digits,
        period: accountData.period,
        algorithm: accountData.algorithm,
      });
    }
    const updated = await vault.getAccounts();
    setAccounts(updated);
    setEditingAccount(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    await vault.deleteAccount(deleteTarget.id);
    const updated = await vault.getAccounts();
    setAccounts(updated);
    setDeleteTarget(null);
  };

  const handleUpdateSettings = async (newSettings: Partial<VaultSettings>) => {
    const updated = await vault.updateSettings(newSettings);
    setSettings(updated);
  };

  const handleChangePassword = async (current: string, next: string) => {
    await vault.changeMasterPassword(current, next);
  };

  const handleExportBackup = async (backupPassword: string) => {
    const jsonStr = await vault.exportBackup(backupPassword);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AuthenticatorX_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = async (content: string, backupPassword: string): Promise<number> => {
    const res = await vault.importBackup(content, backupPassword);
    const updated = await vault.getAccounts();
    setAccounts(updated);
    return res.importedCount;
  };

  const handleResetVault = async () => {
    await vault.resetVault();
    setIsInitialized(false);
    setIsLocked(true);
    setAccounts([]);
  };

  const handleDownloadExtension = async () => {
    await downloadExtensionZipPackage();
  };

  const filteredAccounts = accounts.filter(
    (a) =>
      a.issuer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.accountName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080c16] flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-600/40">
      {/* Top Header */}
      <Header
        isLocked={isLocked}
        onLock={handleLock}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenTestSuite={() => setIsTestSuiteModalOpen(true)}
        onOpenExtensionFiles={() => setIsExtensionFilesModalOpen(true)}
        onDownloadExtension={handleDownloadExtension}
        viewMode={viewMode}
        onToggleViewMode={setViewMode}
        settings={settings}
        accountCount={accounts.length}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
        {/* If vault is uninitialized or locked, render LockScreen */}
        {!isInitialized || isLocked ? (
          <LockScreen
            isInitialized={isInitialized}
            onInitialize={handleInitialize}
            onUnlock={handleUnlock}
            onResetVault={handleResetVault}
          />
        ) : viewMode === 'popup' ? (
          /* Extension Popup View (Simulator) */
          <ExtensionPreviewFrame
            accounts={accounts}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onAddAccount={() => {
              setEditingAccount(null);
              setIsAddModalOpen(true);
            }}
            onEditAccount={(acc) => {
              setEditingAccount(acc);
              setIsAddModalOpen(true);
            }}
            onDeleteAccount={(id, name) => setDeleteTarget({ id, name })}
            onLockVault={handleLock}
            onOpenSettings={() => setIsSettingsModalOpen(true)}
            onOpenExtensionFiles={() => setIsExtensionFilesModalOpen(true)}
            showNextPreview={settings.showNextCode}
          />
        ) : (
          /* Full Vault Dashboard View */
          <div className="space-y-6">
            {/* Toolbar: Search & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search accounts or issuers..."
                  className="w-full bg-slate-900/80 border border-slate-800 focus:border-indigo-500 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingAccount(null);
                    setIsAddModalOpen(true);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add 2FA Account</span>
                </button>
              </div>
            </div>

            {/* Account Cards Grid or Empty State */}
            {filteredAccounts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onEdit={(acc) => {
                      setEditingAccount(acc);
                      setIsAddModalOpen(true);
                    }}
                    onDelete={(id, name) => setDeleteTarget({ id, name })}
                    showNextPreviewDefault={settings.showNextCode}
                  />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              /* High-fidelity Empty State (No demo accounts) */
              <div className="border border-slate-800 bg-slate-900/40 rounded-2xl p-8 md:p-12 text-center max-w-2xl mx-auto space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
                  <Shield className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white">No 2FA Accounts In Your Vault</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                    AuthenticatorX generates RFC 6238 time-based two-factor authentication codes. Add your accounts manually, parse an otpauth:// URI, or upload a QR code.
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      setEditingAccount(null);
                      setIsAddModalOpen(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-md shadow-indigo-600/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add First 2FA Account</span>
                  </button>
                  <button
                    onClick={() => setIsSettingsModalOpen(true)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4 text-indigo-400" />
                    <span>Import Encrypted Backup</span>
                  </button>
                  <button
                    onClick={() => setIsTestSuiteModalOpen(true)}
                    className="px-4 py-2 bg-emerald-950/40 border border-emerald-500/30 hover:bg-emerald-900/30 text-emerald-400 text-xs font-semibold rounded-xl flex items-center gap-2 transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Run RFC 6238 Test Suite</span>
                  </button>
                </div>

                {/* 3 Step Guide Strip */}
                <div className="pt-6 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
                    <Key className="w-4 h-4 text-indigo-400 mb-1.5" />
                    <h4 className="text-xs font-semibold text-slate-200">1. Add Secret</h4>
                    <p className="text-[11px] text-slate-400">
                      Scan or enter the Base32 setup key provided by your service.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
                    <Shield className="w-4 h-4 text-indigo-400 mb-1.5" />
                    <h4 className="text-xs font-semibold text-slate-200">2. Encrypted at Rest</h4>
                    <p className="text-[11px] text-slate-400">
                      Keys are encrypted using 256-bit AES-GCM and stored locally in IndexedDB.
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/60">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mb-1.5" />
                    <h4 className="text-xs font-semibold text-slate-200">3. 1-Click OTP</h4>
                    <p className="text-[11px] text-slate-400">
                      Codes automatically refresh every 30 seconds with 1-click copy.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-slate-500 text-xs">
                No accounts match &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-4 px-4 text-center text-xs text-slate-400 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">AuthenticatorX</span>
            <span aria-hidden="true">·</span>
            <span>RFC 6238 TOTP Engine</span>
            <span aria-hidden="true">·</span>
            <span>Web Crypto AES-GCM</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <button
              onClick={() => setIsTestSuiteModalOpen(true)}
              className="hover:text-emerald-400 transition-colors"
            >
              RFC 6238 Test Suite
            </button>
            <button
              onClick={() => setIsExtensionFilesModalOpen(true)}
              className="hover:text-indigo-400 transition-colors"
            >
              Extension Files (11)
            </button>
            <button
              onClick={handleDownloadExtension}
              className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              <span>Download Chrome Extension (.zip)</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Add / Edit Account Modal */}
      <AddAccountModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingAccount(null);
        }}
        onSave={handleSaveAccount}
        editAccount={editingAccount}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        settings={settings}
        onUpdateSettings={handleUpdateSettings}
        onChangePassword={handleChangePassword}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        onResetVault={handleResetVault}
      />

      {/* RFC 6238 Official Test Suite Modal */}
      <RFC6238TestModal
        isOpen={isTestSuiteModalOpen}
        onClose={() => setIsTestSuiteModalOpen(false)}
      />

      {/* Chrome Extension Manifest V3 Source Code Explorer */}
      <ExtensionFilesModal
        isOpen={isExtensionFilesModalOpen}
        onClose={() => setIsExtensionFilesModalOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-white text-sm">Delete 2FA Account?</h4>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800 font-medium">
              {deleteTarget.name}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3.5 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
