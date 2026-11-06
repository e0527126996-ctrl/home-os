import React, { useState } from 'react';
import { X, Download, Copy, Check, FileCode, Chrome, Shield } from 'lucide-react';
import { ThemeConfig } from '../lib/themes.ts';

interface StandaloneExportModalProps {
  activeTheme: ThemeConfig;
  onClose: () => void;
  getStandaloneHtmlCode: () => string;
}

export const StandaloneExportModal: React.FC<StandaloneExportModalProps> = ({
  activeTheme,
  onClose,
  getStandaloneHtmlCode,
}) => {
  const [copied, setCopied] = useState(false);

  const handleDownload = () => {
    const code = getStandaloneHtmlCode();
    const blob = new Blob([code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'HOME-OS.html';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    const code = getStandaloneHtmlCode();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div
        className="w-full max-w-xl rounded-xl border shadow-xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: activeTheme.bgCard,
          borderColor: activeTheme.borderSubtle,
          color: activeTheme.textPrimary,
        }}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-amber-600" />
            <div>
              <h3 className="font-serif text-base font-semibold">קובץ עצמאי יחיד: HOME-OS.html</h3>
              <p className="text-xs opacity-75">הפעלה מיידית במחשב האישי ללא שרת וללא תלויות</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 opacity-70" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          <div className="p-3.5 rounded-lg border space-y-2" style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}>
            <div className="flex items-center gap-2 font-serif font-semibold text-sm">
              <Chrome className="w-4 h-4 text-amber-600" />
              <span>כיצד להפעיל במחשבך:</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 opacity-90 pr-1 text-[11px] leading-relaxed">
              <li>הורד את הקובץ באמצעות הכפתור למטה, או העתק את הקוד ושמור אותו בפנקס רשימות (Notepad) כ-<code>HOME-OS.html</code>.</li>
              <li>שמור את הקובץ בכל תיקייה במחשב שלך (למשל בשולחן העבודה).</li>
              <li>לחץ לחיצה כפולה על הקובץ כדי לפתוח אותו ב-Google Chrome.</li>
              <li>המערכת תרוץ ב-100% אופליין ותשמור את כל הנתונים ב-IndexedDB המקומי שלך.</li>
            </ol>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded font-semibold text-white shadow-sm transition-all hover:opacity-90"
              style={{ backgroundColor: activeTheme.accent }}
            >
              <Download className="w-4 h-4" />
              <span>הורד את HOME-OS.html</span>
            </button>

            <button
              onClick={handleCopy}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded border font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              style={{ borderColor: activeTheme.borderSubtle }}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-600">הועתק ללוח!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 opacity-75" />
                  <span>העתק קוד מקור מלא</span>
                </>
              )}
            </button>
          </div>

          <div className="text-[11px] opacity-60 text-center pt-1 font-mono">
            מבנה: HTML5 + Modern Editorial CSS + Embedded IndexedDB Core · אפס תלויות חיצוניות
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t flex items-center justify-end" style={{ borderColor: activeTheme.borderSubtle }}>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded border hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            style={{ borderColor: activeTheme.borderSubtle }}
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
