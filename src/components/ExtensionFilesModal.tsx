import React, { useState } from 'react';
import { Download, Copy, Check, FileCode, CheckCircle2, X, FolderGit2, Info } from 'lucide-react';
import { getExtensionFilesList, downloadExtensionZipPackage } from '../lib/extension-files';

interface ExtensionFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExtensionFilesModal: React.FC<ExtensionFilesModalProps> = ({ isOpen, onClose }) => {
  const files = getExtensionFilesList();
  const [selectedFile, setSelectedFile] = useState<string>('manifest.json');
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const activeFile = files.find((f) => f.filename === selectedFile) || files[0];

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadExtensionZipPackage();
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                Chrome Extension Manifest V3 Source Files
              </h3>
              <p className="text-[11px] text-slate-400">
                11 production-ready files with zero external dependencies
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold rounded-xl transition-all shadow-md shadow-indigo-600/20 flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Packing...' : 'Download Unpacked .zip'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Installation Instructions Bar */}
        <div className="px-6 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400 flex-wrap gap-2">
          <div className="flex items-center gap-2 text-indigo-300 font-medium">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>Install in Chrome: 1. Download & unzip → 2. Open chrome://extensions → 3. Turn on Developer mode → 4. Click &quot;Load unpacked&quot;</span>
          </div>
        </div>

        {/* Master-Detail Explorer */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* File List Sidebar */}
          <div className="w-full md:w-64 border-r border-slate-800 bg-slate-950/40 p-3 overflow-y-auto space-y-1 shrink-0">
            <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Extension Files (11)
            </div>
            {files.map((file) => (
              <button
                key={file.filename}
                onClick={() => {
                  setSelectedFile(file.filename);
                  setCopied(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-mono flex items-center justify-between transition-all ${
                  selectedFile === file.filename
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <FileCode className="w-3.5 h-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{file.filename}</span>
                </div>
                <span className="text-[10px] uppercase text-slate-500 font-sans">
                  {file.category}
                </span>
              </button>
            ))}
          </div>

          {/* Code Viewer */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-950/90 overflow-hidden">
            {/* Viewer Toolbar */}
            <div className="px-4 py-2 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/60">
              <div className="truncate">
                <span className="font-mono text-xs font-bold text-white mr-2">
                  {activeFile.filename}
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  {activeFile.description}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>

            {/* Code Content */}
            <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-slate-300 leading-relaxed bg-[#060911] selection:bg-indigo-600/40">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            Generated with Manifest V3, Web Crypto, and standard HTML/CSS.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
