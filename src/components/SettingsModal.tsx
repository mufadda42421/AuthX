import React, { useState } from 'react';
import { Settings, Shield, Clock, Palette, Download, Upload, KeyRound, AlertTriangle, X, Check, CheckCircle2 } from 'lucide-react';
import { VaultSettings, ThemeType } from '../lib/storage';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VaultSettings;
  onUpdateSettings: (newSettings: Partial<VaultSettings>) => Promise<void>;
  onChangePassword: (current: string, next: string) => Promise<void>;
  onExportBackup: (backupPassword: string) => Promise<void>;
  onImportBackup: (backupContent: string, backupPassword: string) => Promise<number>;
  onResetVault: () => Promise<void>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onChangePassword,
  onExportBackup,
  onImportBackup,
  onResetVault,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'backup'>('general');

  // Change Password state
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState<string | null>(null);
  const [passSuccess, setPassSuccess] = useState<string | null>(null);
  const [passLoading, setPassLoading] = useState(false);

  // Backup Export state
  const [exportPass, setExportPass] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Backup Import state
  const [importPass, setImportPass] = useState('');
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!isOpen) return null;

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError(null);
    setPassSuccess(null);

    if (newPass.length < 8) {
      setPassError('New password must be at least 8 characters long.');
      return;
    }
    if (newPass !== confirmPass) {
      setPassError('New passwords do not match.');
      return;
    }

    setPassLoading(true);
    try {
      await onChangePassword(currentPass, newPass);
      setPassSuccess('Master password changed and all accounts re-encrypted successfully.');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to change password';
      setPassError(msg);
    } finally {
      setPassLoading(false);
    }
  };

  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportError(null);
    if (!exportPass || exportPass.length < 6) {
      setExportError('Backup encryption password must be at least 6 characters.');
      return;
    }

    setExportLoading(true);
    try {
      await onExportBackup(exportPass);
      setExportSuccess(true);
      setExportPass('');
      setTimeout(() => setExportSuccess(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      setExportError(msg);
    } finally {
      setExportLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportError(null);
    setImportSuccess(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      setImportFileContent(evt.target?.result as string);
    };
    reader.onerror = () => setImportError('Failed to read file.');
    reader.readAsText(file);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFileContent) {
      setImportError('Please select a backup .json file first.');
      return;
    }
    if (!importPass) {
      setImportError('Enter the backup password to decrypt the file.');
      return;
    }

    setImportLoading(true);
    setImportError(null);
    try {
      const count = await onImportBackup(importFileContent, importPass);
      setImportSuccess(`Successfully decrypted and imported ${count} account(s).`);
      setImportPass('');
      setImportFileContent(null);
      setImportFileName(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Decryption failed';
      setImportError(msg);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Settings className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">Vault Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-3 border-b border-slate-800 bg-slate-950/40 p-1 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'general'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Preferences</span>
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'security'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Master Key</span>
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'backup'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Encrypted Backup</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: General Preferences */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Auto-Lock Interval */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Auto-Lock Interval
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Automatically lock the vault and clear active decryption keys after inactivity.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { label: '1 Min', val: 1 },
                    { label: '5 Mins', val: 5 },
                    { label: '15 Mins', val: 15 },
                    { label: '30 Mins', val: 30 },
                    { label: 'Never', val: 0 },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => onUpdateSettings({ autoLockMinutes: opt.val })}
                      className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                        settings.autoLockMinutes === opt.val
                          ? 'border-indigo-500 bg-indigo-500/15 text-indigo-300'
                          : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Theme Selection */}
              <div>
                <label className="block text-xs font-semibold text-white mb-1.5">
                  Visual Theme
                </label>
                <p className="text-xs text-slate-400 mb-2">
                  Choose a refined security dashboard visual appearance.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'dark-navy', name: 'Dark Navy', bg: 'bg-[#080c16]' },
                    { id: 'cyber-midnight', name: 'Cyber Midnight', bg: 'bg-[#0b0f19]' },
                    { id: 'deep-slate', name: 'Deep Slate', bg: 'bg-[#0f172a]' },
                    { id: 'oled-black', name: 'OLED Black', bg: 'bg-[#000000]' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onUpdateSettings({ theme: t.id as ThemeType })}
                      className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                        settings.theme === t.id
                          ? 'border-indigo-500 bg-indigo-500/10'
                          : 'border-slate-800 bg-slate-950/60 hover:border-slate-700'
                      }`}
                    >
                      <div className={`w-full h-4 rounded-md ${t.bg} border border-slate-700/60`} />
                      <span className="text-xs font-medium text-slate-200">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Advanced UI Toggles */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">
                      Always Show Next Code
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Preview upcoming code across all account cards
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.showNextCode}
                    onChange={(e) => onUpdateSettings({ showNextCode: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Security & Master Password */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Change Master Password
                </h4>
                <p className="text-xs text-slate-400">
                  Changing your master password will re-encrypt all stored account secrets with a new salt and PBKDF2 derived key.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Current Master Password
                  </label>
                  <input
                    type="password"
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    required
                    placeholder="Enter current password..."
                    className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      New Master Password
                    </label>
                    <input
                      type="password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                      required
                      placeholder="At least 8 characters..."
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      value={confirmPass}
                      onChange={(e) => setConfirmPass(e.target.value)}
                      required
                      placeholder="Repeat new password..."
                      className="w-full bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {passError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                    {passError}
                  </div>
                )}
                {passSuccess && (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs">
                    {passSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={passLoading}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-md shadow-indigo-600/20 disabled:opacity-50"
                >
                  {passLoading ? 'Re-encrypting...' : 'Update & Re-encrypt Vault'}
                </button>
              </form>

              {/* Danger Zone */}
              <div className="pt-6 border-t border-slate-800">
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-1">
                  Danger Zone
                </h4>
                <p className="text-xs text-slate-400 mb-3">
                  Wipe all local encrypted accounts and reset vault initialization.
                </p>

                {!showResetConfirm ? (
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold transition-colors"
                  >
                    Wipe Vault & Reset All Accounts
                  </button>
                ) : (
                  <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-300 text-xs font-bold">
                      <AlertTriangle className="w-4 h-4" />
                      <span>Are you absolutely sure? This cannot be undone.</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      All TOTP secret keys stored in this browser will be permanently deleted.
                    </p>
                    <div className="flex gap-2 pt-1">
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
                          onClose();
                        }}
                        className="px-3 py-1 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-500"
                      >
                        Confirm Delete Vault
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Encrypted Backup */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              {/* Export Backup */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Export Encrypted Backup
                </h4>
                <p className="text-xs text-slate-400">
                  Exports an AES-GCM (256-bit) encrypted file with SHA-256 integrity checksum. You must provide a passphrase to protect the exported file.
                </p>
                <form onSubmit={handleExport} className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={exportPass}
                    onChange={(e) => setExportPass(e.target.value)}
                    placeholder="Set backup passphrase (min 6 chars)..."
                    required
                    className="flex-1 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={exportLoading}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-md shadow-indigo-600/20 whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .json Backup</span>
                  </button>
                </form>
                {exportSuccess && (
                  <div className="text-emerald-400 text-xs flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Encrypted backup downloaded successfully!</span>
                  </div>
                )}
                {exportError && (
                  <div className="text-rose-400 text-xs">{exportError}</div>
                )}
              </div>

              {/* Import Backup */}
              <div className="pt-6 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Restore Encrypted Backup
                </h4>
                <p className="text-xs text-slate-400">
                  Restore accounts from an existing AuthenticatorX encrypted backup file.
                </p>

                <div className="flex items-center gap-3">
                  <label className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl cursor-pointer transition-colors flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Select Backup File</span>
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                  {importFileName && (
                    <span className="text-xs font-mono text-indigo-300 truncate max-w-xs">
                      {importFileName}
                    </span>
                  )}
                </div>

                {importFileContent && (
                  <form onSubmit={handleImport} className="space-y-2 pt-1">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={importPass}
                        onChange={(e) => setImportPass(e.target.value)}
                        placeholder="Enter backup decryption passphrase..."
                        required
                        className="flex-1 bg-slate-950/80 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={importLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors whitespace-nowrap flex items-center justify-center gap-1.5"
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Verify & Restore</span>
                      </button>
                    </div>
                  </form>
                )}

                {importSuccess && (
                  <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{importSuccess}</span>
                  </div>
                )}
                {importError && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs">
                    {importError}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
