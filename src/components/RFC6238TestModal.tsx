import React, { useState, useEffect } from 'react';
import { CheckCircle2, XCircle, RotateCw, X, ShieldCheck, ExternalLink } from 'lucide-react';
import { runRFC6238TestSuite, RFC_6238_TEST_VECTORS, HashAlgorithm } from '../lib/totp';

interface RFC6238TestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TestResultRow {
  timeSeconds: number;
  algorithm: HashAlgorithm;
  calculated: string;
  expected: string;
  passed: boolean;
}

export const RFC6238TestModal: React.FC<RFC6238TestModalProps> = ({ isOpen, onClose }) => {
  const [results, setResults] = useState<TestResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [allPassed, setAllPassed] = useState<boolean | null>(null);

  const runTests = async () => {
    setLoading(true);
    try {
      const suite = await runRFC6238TestSuite();
      setResults(suite.results);
      setAllPassed(suite.allPassed);
    } catch (err) {
      console.error(err);
      setAllPassed(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      runTests();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">RFC 6238 Official Test Suite</h3>
              <p className="text-[11px] text-slate-400">
                Mathematical verification against IETF RFC 6238 Appendix B test vectors
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Verification Status Banner */}
        <div className="px-6 py-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {allPassed ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/50 border border-emerald-500/30 px-3 py-1 rounded-full">
                <CheckCircle2 className="w-4 h-4" />
                <span>All 18 Official Test Vectors Passed (100% Verified)</span>
              </span>
            ) : allPassed === false ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 bg-rose-950/50 border border-rose-500/30 px-3 py-1 rounded-full">
                <XCircle className="w-4 h-4" />
                <span>Test Failures Detected</span>
              </span>
            ) : (
              <span className="text-xs text-slate-400">Computing Web Crypto HMAC signatures...</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <a
              href="https://www.rfc-editor.org/rfc/rfc6238"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors mr-2"
            >
              <span>IETF Spec</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <button
              onClick={runTests}
              disabled={loading}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Re-run Suite</span>
            </button>
          </div>
        </div>

        {/* Test Vector Table */}
        <div className="p-6 overflow-y-auto">
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Time (Seconds)</th>
                  <th className="py-2.5 px-3">Algorithm</th>
                  <th className="py-2.5 px-3">Expected OTP</th>
                  <th className="py-2.5 px-3">Calculated OTP</th>
                  <th className="py-2.5 px-3 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {results.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-300 tabular-nums">
                      {row.timeSeconds}s
                    </td>
                    <td className="py-2 px-3">
                      <span className="text-indigo-400 font-semibold">{row.algorithm}</span>
                    </td>
                    <td className="py-2 px-3 text-slate-400 tabular-nums">{row.expected}</td>
                    <td className="py-2 px-3 text-sky-400 font-bold tabular-nums">
                      {row.calculated}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {row.passed ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-sans font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>PASS</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-sans font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>FAIL</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl text-xs text-slate-400 leading-relaxed space-y-1">
            <p className="font-semibold text-slate-300">RFC 6238 Mathematical Compliance Guarantee:</p>
            <p>
              These test cases use the reference seed keys specified in RFC 6238 Appendix B: 20 bytes for HMAC-SHA1, 32 bytes for HMAC-SHA256, and 64 bytes for HMAC-SHA512.
              Dynamic truncation, big-endian counter serialization, and modulo reduction are strictly verified.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-end">
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
