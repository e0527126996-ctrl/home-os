import React, { useState } from 'react';
import { X, Play, CheckCircle2, XCircle, Clock, ShieldCheck, RefreshCw } from 'lucide-react';
import { db } from '../lib/db.ts';
import { ThemeConfig } from '../lib/themes.ts';

interface TestRunnerModalProps {
  activeTheme: ThemeConfig;
  onClose: () => void;
  onTestsFinished?: () => void;
}

export const TestRunnerModal: React.FC<TestRunnerModalProps> = ({ activeTheme, onClose, onTestsFinished }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [testSuiteResult, setTestSuiteResult] = useState<{
    passed: boolean;
    results: Array<{ testName: string; passed: boolean; message: string; durationMs: number }>;
  } | null>(null);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const res = await db.runTestSuite();
      setTestSuiteResult(res);
      if (onTestsFinished) onTestsFinished();
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="homeos-themed-modal homeos-test-runner-modal fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div
        className="w-full max-w-2xl rounded-xl border shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: activeTheme.bgCard,
          borderColor: activeTheme.borderSubtle,
          color: activeTheme.textPrimary,
        }}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="font-serif text-base font-semibold">סוויטת בדיקות אינטגרציה אוטומטית</h3>
              <p className="text-xs opacity-75">
                בדיקת תרחישי Phase 0, Phase 1 ו-Phase 2-א'+ב' (IndexedDB, RBAC, חשבונות, ספר עסקאות, העברות אטומיות, אגורות שלמות, פירעון אשראי ו-Audit)
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 opacity-70" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          <div className="p-4 rounded border flex items-center justify-between" style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}>
            <div>
              <h4 className="font-serif font-semibold text-sm">הרצת 26 בדיקות קבלה אוטומטיות</h4>
              <p className="text-[11px] opacity-75 mt-0.5">
                ספר עסקאות, העברות, דיוק אגורות, בידוד דיירים, גיבוי, פענוח מתכונים וסנכרון קניות
              </p>
            </div>

            <button
              onClick={handleRun}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded text-white shadow-sm transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: activeTheme.accent }}
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>מריץ בדיקות...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  <span>הפעל בדיקות כעת</span>
                </>
              )}
            </button>
          </div>

          {/* Test Results */}
          {testSuiteResult && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between font-serif border-b pb-2" style={{ borderColor: activeTheme.borderSubtle }}>
                <span className="font-semibold text-sm">
                  תוצאת ההרצה: {testSuiteResult.passed ? (
                    <span className="text-emerald-600 font-bold">
                      כל {testSuiteResult.results.length} הבדיקות עברו בהצלחה (100%)
                    </span>
                  ) : (
                    <span className="text-rose-600 font-bold">חלק מהבדיקות נכשלו</span>
                  )}
                </span>
                <span className="text-[11px] font-mono opacity-70">
                  סה"כ זמן ריצה:{' '}
                  {testSuiteResult.results.reduce((acc, curr) => acc + curr.durationMs, 0)}ms
                </span>
              </div>

              <div className="divide-y rounded border overflow-hidden" style={{ borderColor: activeTheme.borderSubtle }}>
                {testSuiteResult.results.map((r, i) => (
                  <div key={i} className="p-3 flex items-start justify-between gap-3" style={{ backgroundColor: activeTheme.bgCard }}>
                    <div className="flex items-start gap-2.5">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-medium font-serif">{r.testName}</div>
                        <div className="text-[11px] opacity-75 mt-0.5">{r.message}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 font-mono text-[10px] opacity-60 tabular-nums shrink-0 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{r.durationMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-end" style={{ borderColor: activeTheme.borderSubtle }}>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            style={{ borderColor: activeTheme.borderSubtle }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
