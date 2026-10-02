import crypto from 'crypto';
import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { db } from './index.ts';
import {
  categories,
  savedFamilyLinks,
  shareLinks,
  transactions,
  users,
} from './schema.ts';
import {
  calculateMonthlySummary,
  getCurrentMonthKey,
} from '../shared/calculations.ts';
import {
  CategoryItem,
  SavedFamilyMember,
  ShareLinkInfo,
  TransactionItem,
} from '../shared/types.ts';

function generateSecureToken(): string {
  return crypto.randomBytes(12).toString('hex');
}

export async function getUserTransactions(userId: number): Promise<TransactionItem[]> {
  try {
    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date), desc(transactions.id));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      type: r.type === 'income' ? 'income' : 'expense',
      amount: Number(r.amount),
      category: r.category,
      source: r.source,
      note: r.note,
      date: r.date,
      paymentMethod: r.paymentMethod,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));
  } catch (error) {
    console.error('Database query failed in getUserTransactions:', error);
    throw new Error('Failed to load transactions. Please try again.', {
      cause: error,
    });
  }
}

export async function getUserCategories(userId: number): Promise<CategoryItem[]> {
  try {
    const rows = await db
      .select()
      .from(categories)
      .where(or(isNull(categories.userId), eq(categories.userId, userId)));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      name: r.name,
      icon: r.icon,
    }));
  } catch (error) {
    console.error('Database query failed in getUserCategories:', error);
    throw new Error('Failed to load categories.', { cause: error });
  }
}

export async function createTransaction(
  userId: number,
  input: {
    type: 'income' | 'expense';
    amount: number;
    category: string;
    source?: string | null;
    note?: string | null;
    date: string;
    paymentMethod?: string | null;
  }
): Promise<TransactionItem> {
  try {
    const inserted = await db
      .insert(transactions)
      .values({
        userId,
        type: input.type,
        amount: input.amount,
        category: input.category,
        source: input.source || null,
        note: input.note || null,
        date: input.date,
        paymentMethod: input.paymentMethod || null,
      })
      .returning();

    const r = inserted[0];
    return {
      id: r.id,
      userId: r.userId,
      type: r.type === 'income' ? 'income' : 'expense',
      amount: Number(r.amount),
      category: r.category,
      source: r.source,
      note: r.note,
      date: r.date,
      paymentMethod: r.paymentMethod,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in createTransaction:', error);
    throw new Error('Could not save transaction. Please try again.', {
      cause: error,
    });
  }
}

export async function updateTransactionForUser(
  userId: number,
  transactionId: number,
  input: {
    type: 'income' | 'expense';
    amount: number;
    category: string;
    source?: string | null;
    note?: string | null;
    date: string;
    paymentMethod?: string | null;
  }
): Promise<TransactionItem | null> {
  try {
    const updated = await db
      .update(transactions)
      .set({
        type: input.type,
        amount: input.amount,
        category: input.category,
        source: input.source || null,
        note: input.note || null,
        date: input.date,
        paymentMethod: input.paymentMethod || null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId)
        )
      )
      .returning();

    if (updated.length === 0) return null;
    const r = updated[0];
    return {
      id: r.id,
      userId: r.userId,
      type: r.type === 'income' ? 'income' : 'expense',
      amount: Number(r.amount),
      category: r.category,
      source: r.source,
      note: r.note,
      date: r.date,
      paymentMethod: r.paymentMethod,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in updateTransactionForUser:', error);
    throw new Error('Could not update transaction. Please try again.', {
      cause: error,
    });
  }
}

export async function deleteTransactionForUser(
  userId: number,
  transactionId: number
): Promise<boolean> {
  try {
    const deleted = await db
      .delete(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.userId, userId)
        )
      )
      .returning();

    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in deleteTransactionForUser:', error);
    throw new Error('Could not delete transaction. Please try again.', {
      cause: error,
    });
  }
}

export async function createCustomCategory(
  userId: number,
  name: string,
  icon: string
): Promise<CategoryItem> {
  try {
    const inserted = await db
      .insert(categories)
      .values({
        userId,
        name: name.trim(),
        icon: icon.trim() || '🏷️',
      })
      .returning();

    const r = inserted[0];
    return {
      id: r.id,
      userId: r.userId,
      name: r.name,
      icon: r.icon,
    };
  } catch (error) {
    console.error('Database query failed in createCustomCategory:', error);
    throw new Error('Could not add custom category.', { cause: error });
  }
}

export async function deleteCustomCategory(
  userId: number,
  categoryId: number
): Promise<boolean> {
  try {
    const deleted = await db
      .delete(categories)
      .where(
        and(eq(categories.id, categoryId), eq(categories.userId, userId))
      )
      .returning();
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in deleteCustomCategory:', error);
    throw new Error('Could not delete custom category.', { cause: error });
  }
}

export async function getUserShareLink(userId: number): Promise<ShareLinkInfo | null> {
  try {
    const rows = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.userId, userId))
      .limit(1);

    if (rows.length === 0) return null;
    return {
      id: rows[0].id,
      token: rows[0].token,
      isActive: rows[0].isActive,
      updatedAt: rows[0].updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in getUserShareLink:', error);
    throw new Error('Failed to load sharing settings.', { cause: error });
  }
}

export async function enableOrCreateShareLink(userId: number): Promise<ShareLinkInfo> {
  try {
    const existing = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(shareLinks)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(shareLinks.userId, userId))
        .returning();
      return {
        id: updated[0].id,
        token: updated[0].token,
        isActive: updated[0].isActive,
        updatedAt: updated[0].updatedAt.toISOString(),
      };
    }

    const token = generateSecureToken();
    const inserted = await db
      .insert(shareLinks)
      .values({
        userId,
        token,
        isActive: true,
      })
      .returning();

    return {
      id: inserted[0].id,
      token: inserted[0].token,
      isActive: inserted[0].isActive,
      updatedAt: inserted[0].updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in enableOrCreateShareLink:', error);
    throw new Error('Failed to enable family sharing link.', { cause: error });
  }
}

export async function disableShareLink(userId: number): Promise<ShareLinkInfo | null> {
  try {
    const updated = await db
      .update(shareLinks)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(shareLinks.userId, userId))
      .returning();

    if (updated.length === 0) return null;
    return {
      id: updated[0].id,
      token: updated[0].token,
      isActive: updated[0].isActive,
      updatedAt: updated[0].updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in disableShareLink:', error);
    throw new Error('Failed to disable family sharing link.', { cause: error });
  }
}

export async function regenerateShareLink(userId: number): Promise<ShareLinkInfo> {
  try {
    const newToken = generateSecureToken();
    const existing = await db
      .select()
      .from(shareLinks)
      .where(eq(shareLinks.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const updated = await db
        .update(shareLinks)
        .set({
          token: newToken,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(shareLinks.userId, userId))
        .returning();

      return {
        id: updated[0].id,
        token: updated[0].token,
        isActive: updated[0].isActive,
        updatedAt: updated[0].updatedAt.toISOString(),
      };
    }

    const inserted = await db
      .insert(shareLinks)
      .values({
        userId,
        token: newToken,
        isActive: true,
      })
      .returning();

    return {
      id: inserted[0].id,
      token: inserted[0].token,
      isActive: inserted[0].isActive,
      updatedAt: inserted[0].updatedAt.toISOString(),
    };
  } catch (error) {
    console.error('Database query failed in regenerateShareLink:', error);
    throw new Error('Failed to regenerate family sharing link.', {
      cause: error,
    });
  }
}

export async function getPublicLedgerByToken(token: string) {
  try {
    const cleanToken = token.trim();
    const linkRows = await db
      .select()
      .from(shareLinks)
      .where(
        and(eq(shareLinks.token, cleanToken), eq(shareLinks.isActive, true))
      )
      .limit(1);

    if (linkRows.length === 0) {
      return null;
    }

    const shareRow = linkRows[0];
    const ownerRows = await db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, shareRow.userId))
      .limit(1);

    if (ownerRows.length === 0) {
      return null;
    }

    const owner = ownerRows[0];
    const [txs, cats] = await Promise.all([
      getUserTransactions(owner.id),
      getUserCategories(owner.id),
    ]);

    return {
      ownerName: owner.name,
      token: shareRow.token,
      updatedAt: shareRow.updatedAt.toISOString(),
      transactions: txs,
      categories: cats,
    };
  } catch (error) {
    console.error('Database query failed in getPublicLedgerByToken:', error);
    throw new Error('Failed to load shared ledger.', { cause: error });
  }
}

export async function getUserSavedFamilyLinks(
  userId: number
): Promise<SavedFamilyMember[]> {
  try {
    const savedRows = await db
      .select()
      .from(savedFamilyLinks)
      .where(eq(savedFamilyLinks.userId, userId))
      .orderBy(desc(savedFamilyLinks.createdAt));

    const currentMonthKey = getCurrentMonthKey();
    const results: SavedFamilyMember[] = [];

    for (const item of savedRows) {
      const publicData = await getPublicLedgerByToken(item.token);
      if (publicData) {
        const summary = calculateMonthlySummary(
          publicData.transactions,
          currentMonthKey,
          publicData.categories
        );
        results.push({
          id: item.id,
          label: item.label || publicData.ownerName,
          token: item.token,
          ownerName: publicData.ownerName,
          isActive: true,
          availableBalance: summary.remainingBalance,
          receivedThisMonth: summary.receivedThisMonth,
          spentThisMonth: summary.spentThisMonth,
        });
      } else {
        results.push({
          id: item.id,
          label: item.label,
          token: item.token,
          ownerName: null,
          isActive: false,
          availableBalance: 0,
          receivedThisMonth: 0,
          spentThisMonth: 0,
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Database query failed in getUserSavedFamilyLinks:', error);
    throw new Error('Failed to load saved family links.', { cause: error });
  }
}

export async function addSavedFamilyLink(
  userId: number,
  rawTokenOrUrl: string,
  customLabel?: string
): Promise<SavedFamilyMember> {
  try {
    let token = rawTokenOrUrl.trim();
    const match = token.match(/\/view\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      token = match[1];
    } else if (token.includes('view=')) {
      const urlObj = new URL(token, 'http://localhost');
      token = urlObj.searchParams.get('view') || token;
    }

    const publicData = await getPublicLedgerByToken(token);
    if (!publicData) {
      throw new Error('INVALID_LINK');
    }

    const label =
      customLabel && customLabel.trim().length > 0
        ? customLabel.trim()
        : publicData.ownerName;

    const inserted = await db
      .insert(savedFamilyLinks)
      .values({
        userId,
        label,
        token,
      })
      .returning();

    const summary = calculateMonthlySummary(
      publicData.transactions,
      getCurrentMonthKey(),
      publicData.categories
    );

    return {
      id: inserted[0].id,
      label: inserted[0].label,
      token: inserted[0].token,
      ownerName: publicData.ownerName,
      isActive: true,
      availableBalance: summary.remainingBalance,
      receivedThisMonth: summary.receivedThisMonth,
      spentThisMonth: summary.spentThisMonth,
    };
  } catch (error: any) {
    if (error?.message === 'INVALID_LINK') {
      throw new Error(
        'Could not find an active shared ledger with that link or token.'
      );
    }
    console.error('Database query failed in addSavedFamilyLink:', error);
    throw new Error('Could not save family link.', { cause: error });
  }
}

export async function removeSavedFamilyLink(
  userId: number,
  id: number
): Promise<boolean> {
  try {
    const deleted = await db
      .delete(savedFamilyLinks)
      .where(
        and(
          eq(savedFamilyLinks.id, id),
          eq(savedFamilyLinks.userId, userId)
        )
      )
      .returning();
    return deleted.length > 0;
  } catch (error) {
    console.error('Database query failed in removeSavedFamilyLink:', error);
    throw new Error('Could not remove family link.', { cause: error });
  }
}
