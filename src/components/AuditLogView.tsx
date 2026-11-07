import React, { useState } from 'react';
import { History, Search, Filter, ShieldAlert, Clock, User as UserIcon } from 'lucide-react';
import { AuditLog } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';
import { WorkspacePageHeader } from './WorkspacePageHeader.tsx';

interface AuditLogViewProps {
  logs: AuditLog[];
  activeTheme: ThemeConfig;
  onRefresh: () => void;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs, activeTheme, onRefresh }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('all');

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDomain = selectedDomain === 'all' || log.domain.toLowerCase() === selectedDomain.toLowerCase();

    return matchesSearch && matchesDomain;
  });

  const uniqueDomains = Array.from(new Set(logs.map((l) => l.domain)));

  return (
    <div className="homeos-audit-view homeos-workspace-page space-y-4">
      <WorkspacePageHeader
        eyebrow="SYSTEM / ACTIVITY & SECURITY"
        title="יומן פעילות ובקרה"
        description="עקבות הפעולות שבוצעו במערכת — מי שינה, מתי ובאיזה תחום."
        meta={<><span>{logs.length} אירועים אחרונים</span><span>{uniqueDomains.length} תחומים</span></>}
      />
      {/* Filters */}
      <div className="homeos-audit-toolbar">
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 opacity-50" />
            <input
              type="text"
              placeholder="חיפוש ביומן..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-8 pl-3 py-1.5 text-xs rounded border focus:outline-none w-44 sm:w-56"
              style={{
                backgroundColor: activeTheme.bgCard,
                borderColor: activeTheme.borderSubtle,
                color: activeTheme.textPrimary,
              }}
            />
          </div>

          {/* Domain Filter */}
          <select
            value={selectedDomain}
            onChange={(e) => setSelectedDomain(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded border focus:outline-none"
            style={{
              backgroundColor: activeTheme.bgCard,
              borderColor: activeTheme.borderSubtle,
              color: activeTheme.textPrimary,
            }}
          >
            <option value="all">כל התחומים ({logs.length})</option>
            {uniqueDomains.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="border rounded-lg overflow-hidden" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgCard }}>
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b font-serif" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
              <th className="px-4 py-2.5 font-semibold">זמן</th>
              <th className="px-4 py-2.5 font-semibold">משתמש מבצע</th>
              <th className="px-4 py-2.5 font-semibold">פעולה</th>
              <th className="px-4 py-2.5 font-semibold">תחום</th>
              <th className="px-4 py-2.5 font-semibold">פרטי האירוע</th>
            </tr>
          </thead>
          <tbody className="divide-y font-mono" style={{ borderColor: activeTheme.borderSubtle }}>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center opacity-60 font-sans">
                  לא נמצאו רשומות ביקורת תואמות
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5 opacity-70 whitespace-nowrap text-[11px] tabular-nums">
                    {new Date(log.timestamp).toLocaleString('he-IL', {
                      dateStyle: 'short',
                      timeStyle: 'medium',
                    })}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-[11px]">
                    <div className="flex items-center gap-1.5 font-sans">
                      <UserIcon className="w-3 h-3 opacity-60" />
                      <span className="truncate max-w-[140px]">{log.userEmail}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: activeTheme.bgSurface,
                        border: `1px solid ${activeTheme.borderSubtle}`,
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-sans text-[11px]">
                    <span className="opacity-75">{log.domain}</span>
                  </td>
                  <td className="px-4 py-2.5 font-sans text-xs">
                    <span style={{ color: activeTheme.textPrimary }}>{log.details}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
