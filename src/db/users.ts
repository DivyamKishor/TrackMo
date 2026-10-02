import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { users } from './schema.ts';
import { hashPassword, verifyPassword } from '../middleware/auth.ts';

function deriveDefaultName(email: string, providedName?: string): string {
  if (providedName && providedName.trim().length > 0) {
    return providedName.trim();
  }
  const prefix = email.split('@')[0] || 'Family Member';
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

export async function getOrCreateUser(
  uid: string,
  email: string,
  name?: string,
  profileImage?: string | null
) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const resolvedName = deriveDefaultName(normalizedEmail, name);

    // Check if a user already exists with this email (e.g. previously registered via email/password)
    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail.length > 0 && existingByEmail[0].uid !== uid) {
      const updated = await db
        .update(users)
        .set({
          uid,
          profileImage: profileImage || existingByEmail[0].profileImage,
        })
        .where(eq(users.id, existingByEmail[0].id))
        .returning();
      return updated[0];
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        name: resolvedName,
        profileImage: profileImage || null,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          ...(profileImage ? { profileImage } : {}),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Unable to synchronize user account. Please try again.', {
      cause: error,
    });
  }
}

export async function registerEmailUser(
  name: string,
  email: string,
  password: string
) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      throw new Error('ACCOUNT_EXISTS');
    }

    const uid = `local_${crypto.randomBytes(12).toString('hex')}`;
    const passwordHash = hashPassword(password);

    const inserted = await db
      .insert(users)
      .values({
        uid,
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        profileImage: null,
      })
      .returning();

    return inserted[0];
  } catch (error: any) {
    if (error?.message === 'ACCOUNT_EXISTS') {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }
    console.error('Database query failed in registerEmailUser:', error);
    throw new Error('Could not create account. Please try again.', {
      cause: error,
    });
  }
}

export async function authenticateEmailUser(email: string, password: string) {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length === 0) {
      throw new Error('INVALID_CREDENTIALS');
    }

    const user = existing[0];
    if (!user.passwordHash) {
      throw new Error('GOOGLE_ACCOUNT_ONLY');
    }

    const isValid = verifyPassword(password, user.passwordHash);
    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    return user;
  } catch (error: any) {
    if (error?.message === 'INVALID_CREDENTIALS') {
      throw new Error('Invalid email or password.');
    }
    if (error?.message === 'GOOGLE_ACCOUNT_ONLY') {
      throw new Error(
        'This email uses Google Sign-In. Please click "Continue with Google".'
      );
    }
    console.error('Database query failed in authenticateEmailUser:', error);
    throw new Error('Sign-in failed. Please try again.', { cause: error });
  }
}

export async function updateUserName(userId: number, newName: string) {
  try {
    const updated = await db
      .update(users)
      .set({ name: newName.trim() })
      .where(eq(users.id, userId))
      .returning();
    return updated[0];
  } catch (error) {
    console.error('Database query failed in updateUserName:', error);
    throw new Error('Could not update profile name.', { cause: error });
  }
}
