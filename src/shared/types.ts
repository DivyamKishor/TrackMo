export type TransactionType = 'income' | 'expense';

export interface UserProfile {
  id: number;
  uid: string;
  name: string;
  email: string;
  profileImage: string | null;
  createdAt: string;
}

export interface TransactionItem {
  id: number;
  userId: number;
  type: TransactionType;
  amount: number;
  category: string;
  source: string | null;
  note: string | null;
  date: string; // YYYY-MM-DD
  paymentMethod: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryItem {
  id: number;
  userId: number | null;
  name: string;
  icon: string;
}

export interface ShareLinkInfo {
  id: number;
  token: string;
  isActive: boolean;
  updatedAt: string;
}

export interface SavedFamilyMember {
  id: number;
  label: string;
  token: string;
  ownerName: string | null;
  isActive: boolean;
  availableBalance: number;
  receivedThisMonth: number;
  spentThisMonth: number;
}

export interface LedgerResponse {
  user: UserProfile;
  transactions: TransactionItem[];
  categories: CategoryItem[];
  shareLink: ShareLinkInfo | null;
  savedFamilyLinks: SavedFamilyMember[];
}

export interface PublicSharedLedgerResponse {
  ownerName: string;
  token: string;
  updatedAt: string;
  transactions: TransactionItem[];
  categories: CategoryItem[];
}

export interface CategoryBreakdownItem {
  category: string;
  icon: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface MonthlySummary {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g. "October 2026"
  startingBalance: number;
  receivedThisMonth: number;
  spentThisMonth: number;
  remainingBalance: number;
  transactions: TransactionItem[];
  categoryBreakdown: CategoryBreakdownItem[];
}
