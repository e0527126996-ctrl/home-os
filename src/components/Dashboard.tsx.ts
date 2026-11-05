import React, { useState, useEffect } from 'react';
import { HomeOSData, Account } from '../types/homeos';
import { getCleanEmptyData, computeAccountBalances } from '../services/storage';
import { formatCents } from '../utils/currency';

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<HomeOSData>(getCleanEmptyData());

  useEffect(() => {
    // חישוב יתרות החשבונות לפי העסקאות הקיימות
    const updatedAccounts = computeAccountBalances(data.accounts, data.transactions);
    setData((prev) => ({ ...prev, accounts: updatedAccounts }));
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', direction: 'rtl' }}>
      <h1>{data.householdName} - לוח בקרה</h1>
      
      <h2>חשבונות בנק וכרטיסים</h2>
      {data.accounts.length === 0 ? (
        <p>אין חשבונות מוזנים כרגע.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {data.accounts.map((acc: Account) => (
            <li key={acc.id} style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
              <strong>{acc.name}</strong> ({acc.institution}): {' '}
              {formatCents(acc.currentBalanceCents ?? acc.openingBalanceCents)}
            </li>
          ))}
        </ul>
      )}

      <h2>תקציבים חודשיים</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {data.budgets.map((b, idx) => (
          <li key={idx} style={{ padding: '5px 0' }}>
            {b.category}: עד {formatCents(b.monthlyLimitCents)}
          </li>
        ))}
      </ul>
    </div>
  );
};