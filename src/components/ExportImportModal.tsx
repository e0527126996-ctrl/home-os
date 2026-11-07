import React, { useState, useRef } from 'react';
import { X, Download, Upload, Database, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { db } from '../lib/db.ts';
import { BackupData, Household, User } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';

interface ExportImportModalProps {
  household: Household;
  currentUser: User | null;
  activeTheme: ThemeConfig;
  onClose: () => void;
  onDataRestored: () => void;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  household,
  currentUser,
  activeTheme,
  onClose,
  onDataRestored,
}) => {
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingBackupData, setPendingBackupData] = useState<BackupData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    if (!currentUser) { setErrorMsg('יש להתחבר לפני ייצוא גיבוי'); return; }
    setIsProcessing(true);
    setErrorMsg('');
    try {
      const backup = await db.exportFullBackup(household.id, currentUser.id);
      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `home_os_backup_${household.name.replace(/\s+/g, '_')}_${dateStr}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMsg('קובץ הגיבוי הורד בהצלחה למחשבך!');
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה בייצוא הגיבוי');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setStatusMsg('');

    try {
      const text = await file.text();
      const data: BackupData = JSON.parse(text);

      if (!data.version || !data.households || !Array.isArray(data.households)) {
        throw new Error('קובץ הגיבוי אינו בפורמט תקין של HOME OS (חסר מבנה תקני)');
      }

      // Present confirmation gate to prevent silent overwrite
      setPendingBackupData(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה בקריאת קובץ הגיבוי: פורמט שגוי');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingBackupData) return;
    if (!currentUser) { setErrorMsg('יש להתחבר לפני שחזור גיבוי'); return; }
    setIsProcessing(true);
    setErrorMsg('');

    try {
      await db.importFullBackup(
        pendingBackupData,
        currentUser.id,
        currentUser.email,
        true // Explicit user confirmation!
      );

      setStatusMsg('הנתונים שוחזרו בהצלחה מתוך קובץ הגיבוי!');
      setPendingBackupData(null);
      setTimeout(() => {
        onDataRestored();
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה בשחזור הנתונים');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div
        className="w-full max-w-lg rounded-xl border shadow-xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: activeTheme.bgCard,
          borderColor: activeTheme.borderSubtle,
          color: activeTheme.textPrimary,
        }}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 opacity-80" />
            <div>
              <h3 className="font-serif text-base font-semibold">גיבוי ושחזור נתונים (JSON)</h3>
              <p className="text-xs opacity-75">שמירת עותק מקומי מלא או שחזור במחשב אחר</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 opacity-70" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {statusMsg && (
            <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pending Overwrite Confirmation Box */}
          {pendingBackupData && (
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-serif font-bold text-sm">אזהרה: שחזור נתונים ידרוס מידע קיים!</h4>
                  <p className="text-xs mt-1 leading-relaxed">
                    קובץ הגיבוי מכיל <strong>{pendingBackupData.households?.length || 0}</strong> משקי בית,{' '}
                    <strong>{pendingBackupData.persons?.length || 0}</strong> בני בית, ו-
                    <strong>{pendingBackupData.auditLogs?.length || 0}</strong> רשומות ביקורת (יוצא בתאריך{' '}
                    {new Date(pendingBackupData.exportedAt).toLocaleDateString('he-IL')}).
                    <br />
                    שחזור זה יעדכן את מסד הנתונים של הדפדפן.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-amber-200 dark:border-amber-900/60">
                <button
                  type="button"
                  onClick={() => setPendingBackupData(null)}
                  className="px-3 py-1.5 rounded border border-amber-400 dark:border-amber-700 hover:bg-black/5 text-xs"
                >
                  בטל שחזור
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmRestore}
                  className="px-4 py-1.5 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm transition-all"
                >
                  {isProcessing ? 'משחזר...' : 'כן, אשר שחזור מלא'}
                </button>
              </div>
            </div>
          )}

          {/* Export Box */}
          <div
            className="p-4 rounded-lg border space-y-2"
            style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif font-semibold text-sm">ייצוא גיבוי מלא</h4>
                <p className="text-[11px] opacity-75 mt-0.5">
                  מייצא את כל נתוני משק הבית "{household.name}", משתמשים, בני בית, הרשאות ויומני ביקורת
                </p>
              </div>
              <button
                onClick={handleExport}
                disabled={isProcessing || pendingBackupData !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: activeTheme.accent }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>הורד JSON</span>
              </button>
            </div>
          </div>

          {/* Import Box */}
          <div
            className="p-4 rounded-lg border space-y-2"
            style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-serif font-semibold text-sm">שחזור מתוך גיבוי קיים</h4>
                <p className="text-[11px] opacity-75 mt-0.5">
                  טעינת קובץ גיבוי של HOME OS ושחזור מלא של כל הרשומות לתוך הדפדפן (כולל אזהרת אישור מוקדמת)
                </p>
              </div>
              <div>
                <input
                  type="file"
                  accept=".json,application/json"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing || pendingBackupData !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border hover:bg-black/5 dark:hover:bg-white/5 transition-colors disabled:opacity-50"
                  style={{ borderColor: activeTheme.borderSubtle }}
                >
                  <Upload className="w-3.5 h-3.5 opacity-70" />
                  <span>בחר קובץ</span>
                </button>
              </div>
            </div>
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
