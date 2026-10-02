import {
  CategoryBreakdownItem,
  CategoryItem,
  MonthlySummary,
  TransactionItem,
} from './types.ts';

export const DEFAULT_CATEGORIES: Array<{ name: string; icon: string }> = [
  { name: 'Food', icon: '🍔' },
  { name: 'Groceries', icon: '🛒' },
  { name: 'Travel', icon: '🚕' },
  { name: 'Rent / Hostel', icon: '🏠' },
  { name: 'Education', icon: '📚' },
  { name: 'Technology', icon: '💻' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Health', icon: '💊' },
  { name: 'Bills', icon: '💳' },
  { name: 'Gifts', icon: '🎁' },
  { name: 'Other', icon: '📦' },
];

export const COMMON_SOURCES = ['Dad', 'Mom', 'Parents', 'Brother', 'Sister', 'Grandparents'];

export const PAYMENT_METHODS = ['UPI', 'Cash', 'Card', 'Other'];

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const SHORT_MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function getCurrentMonthKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  const date = new Date(year, monthIndex + deltaMonths, 1);
  const newYear = date.getFullYear();
  const newMonth = String(date.getMonth() + 1).padStart(2, '0');
  return `${newYear}-${newMonth}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  const monthName = MONTH_NAMES[monthIndex] || monthStr;
  return `${monthName} ${year}`;
}

export function formatShortDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${SHORT_MONTH_NAMES[monthIndex] || parts[1]} ${day}`;
}

export function formatFullDayHeader(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const monthIndex = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return `${MONTH_NAMES[monthIndex] || parts[1]} ${day}`;
}

/**
 * Formats an amount in Indian Rupee format (e.g., ₹18,450 or ₹2,50,000)
 */
export function formatINR(amount: number, showPlusSign = false): string {
  const isNegative = amount < 0;
  const absVal = Math.abs(amount);
  const hasDecimals = Math.round(absVal * 100) % 100 !== 0;

  const formattedNumber = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(absVal);

  if (isNegative) {
    return `-₹${formattedNumber}`;
  }
  if (showPlusSign && absVal > 0) {
    return `+₹${formattedNumber}`;
  }
  return `₹${formattedNumber}`;
}

export function getCategoryIcon(categoryName: string, categories: CategoryItem[], type?: string): string {
  if (type === 'income' || categoryName === 'Money Received') {
    return '🟢';
  }
  const found = categories.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  if (found) return found.icon;

  const fallback = DEFAULT_CATEGORIES.find(
    (c) => c.name.toLowerCase() === categoryName.toLowerCase()
  );
  return fallback ? fallback.icon : '📦';
}

/**
 * Core Balance & Carry-Forward Calculation
 *
 * Rule:
 * - Starting balance for month YYYY-MM = sum of all income before YYYY-MM-01 minus sum of all expenses before YYYY-MM-01
 * - Received this month = sum of all income during YYYY-MM
 * - Spent this month = sum of all expenses during YYYY-MM
 * - Remaining balance = Starting balance + Received this month - Spent this month
 */
export function calculateMonthlySummary(
  allTransactions: TransactionItem[],
  monthKey: string,
  categories: CategoryItem[] = []
): MonthlySummary {
  const monthStart = `${monthKey}-01`;

  let startingBalance = 0;
  let receivedThisMonth = 0;
  let spentThisMonth = 0;
  const monthTransactions: TransactionItem[] = [];
  const categoryTotals = new Map<string, { amount: number; count: number }>();

  for (const tx of allTransactions) {
    const amt = Number(tx.amount) || 0;
    if (tx.date < monthStart) {
      if (tx.type === 'income') {
        startingBalance += amt;
      } else {
        startingBalance -= amt;
      }
    } else if (tx.date.startsWith(monthKey)) {
      monthTransactions.push(tx);
      if (tx.type === 'income') {
        receivedThisMonth += amt;
      } else {
        spentThisMonth += amt;
        const catKey = tx.category || 'Other';
        const existing = categoryTotals.get(catKey) || { amount: 0, count: 0 };
        categoryTotals.set(catKey, {
          amount: existing.amount + amt,
          count: existing.count + 1,
        });
      }
    }
  }

  // Sort transactions within the month: newest date first, then newest id first
  monthTransactions.sort((a, b) => {
    if (a.date !== b.date) {
      return b.date.localeCompare(a.date);
    }
    return b.id - a.id;
  });

  // Round to 2 decimal places to avoid floating-point drift
  startingBalance = Math.round(startingBalance * 100) / 100;
  receivedThisMonth = Math.round(receivedThisMonth * 100) / 100;
  spentThisMonth = Math.round(spentThisMonth * 100) / 100;
  const remainingBalance =
    Math.round((startingBalance + receivedThisMonth - spentThisMonth) * 100) / 100;

  const categoryBreakdown: CategoryBreakdownItem[] = Array.from(
    categoryTotals.entries()
  )
    .map(([category, stats]) => ({
      category,
      icon: getCategoryIcon(category, categories, 'expense'),
      amount: Math.round(stats.amount * 100) / 100,
      count: stats.count,
      percentage:
        spentThisMonth > 0
          ? Math.round((stats.amount / spentThisMonth) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey),
    startingBalance,
    receivedThisMonth,
    spentThisMonth,
    remainingBalance,
    transactions: monthTransactions,
    categoryBreakdown,
  };
}

/**
 * Groups sorted transactions by date (YYYY-MM-DD)
 */
export function groupTransactionsByDate(
  transactions: TransactionItem[]
): Array<{ date: string; label: string; items: TransactionItem[] }> {
  const groups: Array<{ date: string; label: string; items: TransactionItem[] }> = [];
  const map = new Map<string, TransactionItem[]>();

  for (const tx of transactions) {
    const existing = map.get(tx.date);
    if (existing) {
      existing.push(tx);
    } else {
      const arr = [tx];
      map.set(tx.date, arr);
      groups.push({
        date: tx.date,
        label: formatFullDayHeader(tx.date),
        items: arr,
      });
    }
  }

  return groups;
}
