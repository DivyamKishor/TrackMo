import 'dotenv/config';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  AuthRequest,
  createLocalAuthToken,
  requireAuth,
} from './src/middleware/auth.ts';
import {
  authenticateEmailUser,
  getOrCreateUser,
  registerEmailUser,
  updateUserName,
} from './src/db/users.ts';
import {
  addSavedFamilyLink,
  createCustomCategory,
  createTransaction,
  deleteCustomCategory,
  deleteTransactionForUser,
  disableShareLink,
  enableOrCreateShareLink,
  getPublicLedgerByToken,
  getUserCategories,
  getUserSavedFamilyLinks,
  getUserShareLink,
  getUserTransactions,
  regenerateShareLink,
  removeSavedFamilyLink,
  updateTransactionForUser,
} from './src/db/repository.ts';

function serializeUser(u: {
  id: number;
  uid: string;
  name: string;
  email: string;
  profileImage: string | null;
  createdAt: Date;
}) {
  return {
    id: u.id,
    uid: u.uid,
    name: u.name,
    email: u.email,
    profileImage: u.profileImage,
    createdAt: u.createdAt.toISOString(),
  };
}

async function resolveDbUser(req: AuthRequest) {
  if (!req.user || !req.user.uid) {
    throw new Error('Unauthorized');
  }
  const email = req.user.email || `${req.user.uid}@trackmo.user`;
  return getOrCreateUser(
    req.user.uid,
    email,
    req.user.name,
    req.user.picture || null
  );
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // ---------------------------------------------------------------------------
  // Authentication Routes (Email/Password fallback & Profile sync)
  // ---------------------------------------------------------------------------
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password } = req.body || {};
      if (!name || typeof name !== 'string' || name.trim().length < 1) {
        return res.status(400).json({ error: 'Please enter your name.' });
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address.' });
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        return res
          .status(400)
          .json({ error: 'Password must be at least 6 characters.' });
      }

      const user = await registerEmailUser(name, email, password);
      const token = createLocalAuthToken({
        uid: user.uid,
        email: user.email,
        name: user.name,
      });

      return res.status(201).json({
        token,
        user: serializeUser(user),
      });
    } catch (error: any) {
      return res
        .status(400)
        .json({ error: error.message || 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: 'Please enter both email and password.' });
      }

      const user = await authenticateEmailUser(email, password);
      const token = createLocalAuthToken({
        uid: user.uid,
        email: user.email,
        name: user.name,
      });

      return res.json({
        token,
        user: serializeUser(user),
      });
    } catch (error: any) {
      return res.status(401).json({ error: error.message || 'Sign-in failed.' });
    }
  });

  app.get('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await resolveDbUser(req);
      return res.json({ user: serializeUser(user) });
    } catch (error: any) {
      console.error('GET /api/me error:', error);
      return res
        .status(500)
        .json({ error: error.message || 'Failed to load profile.' });
    }
  });

  app.put('/api/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await resolveDbUser(req);
      const { name } = req.body || {};
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({ error: 'Name cannot be empty.' });
      }
      const updated = await updateUserName(user.id, name);
      return res.json({ user: serializeUser(updated) });
    } catch (error: any) {
      console.error('PUT /api/me error:', error);
      return res
        .status(500)
        .json({ error: error.message || 'Failed to update profile.' });
    }
  });

  // ---------------------------------------------------------------------------
  // Main Ledger & Transactions Routes (Strictly scoped to authenticated user)
  // ---------------------------------------------------------------------------
  app.get('/api/ledger', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await resolveDbUser(req);
      const [transactions, categories, shareLink, savedFamilyLinks] =
        await Promise.all([
          getUserTransactions(user.id),
          getUserCategories(user.id),
          getUserShareLink(user.id),
          getUserSavedFamilyLinks(user.id),
        ]);

      return res.json({
        user: serializeUser(user),
        transactions,
        categories,
        shareLink,
        savedFamilyLinks,
      });
    } catch (error: any) {
      console.error('GET /api/ledger error:', error);
      return res
        .status(500)
        .json({ error: error.message || 'Failed to load ledger data.' });
    }
  });

  app.post('/api/transactions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await resolveDbUser(req);
      const { type, amount, category, source, note, date, paymentMethod } =
        req.body || {};

      if (type !== 'income' && type !== 'expense') {
        return res
          .status(400)
          .json({ error: 'Transaction type must be income or expense.' });
      }

      const numericAmount = Number(amount);
      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0 ||
        numericAmount > 100000000
      ) {
        return res
          .status(400)
          .json({ error: 'Please enter a valid positive amount.' });
      }

      if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'Please select a valid date.' });
      }

      const resolvedCategory =
        type === 'income'
          ? 'Money Received'
          : category && typeof category === 'string' && category.trim()
            ? category.trim()
            : 'Other';

      const resolvedSource =
        type === 'income'
          ? source && typeof source === 'string' && source.trim()
            ? source.trim()
            : 'Dad'
          : null;

      const created = await createTransaction(user.id, {
        type,
        amount: Math.round(numericAmount * 100) / 100,
        category: resolvedCategory,
        source: resolvedSource,
        note: note && typeof note === 'string' ? note.trim() : null,
        date,
        paymentMethod:
          paymentMethod && typeof paymentMethod === 'string'
            ? paymentMethod.trim()
            : null,
      });

      return res.status(201).json({ transaction: created });
    } catch (error: any) {
      console.error('POST /api/transactions error:', error);
      return res
        .status(500)
        .json({ error: error.message || 'Could not save transaction.' });
    }
  });

  app.put(
    '/api/transactions/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const user = await resolveDbUser(req);
        const txId = parseInt(req.params.id, 10);
        if (Number.isNaN(txId)) {
          return res.status(400).json({ error: 'Invalid transaction ID.' });
        }

        const { type, amount, category, source, note, date, paymentMethod } =
          req.body || {};

        if (type !== 'income' && type !== 'expense') {
          return res
            .status(400)
            .json({ error: 'Transaction type must be income or expense.' });
        }

        const numericAmount = Number(amount);
        if (
          !Number.isFinite(numericAmount) ||
          numericAmount <= 0 ||
          numericAmount > 100000000
        ) {
          return res
            .status(400)
            .json({ error: 'Please enter a valid positive amount.' });
        }

        if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return res.status(400).json({ error: 'Please select a valid date.' });
        }

        const resolvedCategory =
          type === 'income'
            ? 'Money Received'
            : category && typeof category === 'string' && category.trim()
              ? category.trim()
              : 'Other';

        const resolvedSource =
          type === 'income'
            ? source && typeof source === 'string' && source.trim()
              ? source.trim()
              : 'Dad'
            : null;

        const updated = await updateTransactionForUser(user.id, txId, {
          type,
          amount: Math.round(numericAmount * 100) / 100,
          category: resolvedCategory,
          source: resolvedSource,
          note: note && typeof note === 'string' ? note.trim() : null,
          date,
          paymentMethod:
            paymentMethod && typeof paymentMethod === 'string'
              ? paymentMethod.trim()
              : null,
        });

        if (!updated) {
          return res.status(404).json({ error: 'Transaction not found.' });
        }

        return res.json({ transaction: updated });
      } catch (error: any) {
        console.error('PUT /api/transactions/:id error:', error);
        return res
          .status(500)
          .json({ error: error.message || 'Could not update transaction.' });
      }
    }
  );

  app.delete(
    '/api/transactions/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const user = await resolveDbUser(req);
        const txId = parseInt(req.params.id, 10);
        if (Number.isNaN(txId)) {
          return res.status(400).json({ error: 'Invalid transaction ID.' });
        }

        const deleted = await deleteTransactionForUser(user.id, txId);
        if (!deleted) {
          return res.status(404).json({ error: 'Transaction not found.' });
        }

        return res.json({ success: true });
      } catch (error: any) {
        console.error('DELETE /api/transactions/:id error:', error);
        return res
          .status(500)
          .json({ error: error.message || 'Could not delete transaction.' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Custom Categories Routes
  // ---------------------------------------------------------------------------
  app.post('/api/categories', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await resolveDbUser(req);
      const { name, icon } = req.body || {};
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Please enter a category name.' });
      }
      const created = await createCustomCategory(
        user.id,
        name.trim(),
        icon && typeof icon === 'string' ? icon.trim() : '🏷️'
      );
      return res.status(201).json({ category: created });
    } catch (error: any) {
      console.error('POST /api/categories error:', error);
      return res
        .status(500)
        .json({ error: error.message || 'Could not create category.' });
    }
  });

  app.delete(
    '/api/categories/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const user = await resolveDbUser(req);
        const catId = parseInt(req.params.id, 10);
        if (Number.isNaN(catId)) {
          return res.status(400).json({ error: 'Invalid category ID.' });
        }
        const deleted = await deleteCustomCategory(user.id, catId);
        if (!deleted) {
          return res
            .status(404)
            .json({ error: 'Custom category not found or cannot be deleted.' });
        }
        return res.json({ success: true });
      } catch (error: any) {
        console.error('DELETE /api/categories/:id error:', error);
        return res
          .status(500)
          .json({ error: error.message || 'Could not delete category.' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Family Sharing Link Routes
  // ---------------------------------------------------------------------------
  app.post('/api/share/enable', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await resolveDbUser(req);
      const shareLink = await enableOrCreateShareLink(user.id);
      return res.json({ shareLink });
    } catch (error: any) {
      console.error('POST /api/share/enable error:', error);
      return res
        .status(500)
        .json({ error: error.message || 'Could not enable sharing link.' });
    }
  });

  app.post('/api/share/disable', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await resolveDbUser(req);
      const shareLink = await disableShareLink(user.id);
      return res.json({ shareLink });
    } catch (error: any) {
      console.error('POST /api/share/disable error:', error);
      return res
        .status(500)
        .json({ error: error.message || 'Could not disable sharing link.' });
    }
  });

  app.post(
    '/api/share/regenerate',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const user = await resolveDbUser(req);
        const shareLink = await regenerateShareLink(user.id);
        return res.json({ shareLink });
      } catch (error: any) {
        console.error('POST /api/share/regenerate error:', error);
        return res
          .status(500)
          .json({ error: error.message || 'Could not regenerate sharing link.' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Optional Saved Family Links (Family Dashboard)
  // ---------------------------------------------------------------------------
  app.post('/api/family-links', requireAuth, async (req: AuthRequest, res) => {
    try {
      const user = await resolveDbUser(req);
      const { linkOrToken, label } = req.body || {};
      if (!linkOrToken || typeof linkOrToken !== 'string' || !linkOrToken.trim()) {
        return res
          .status(400)
          .json({ error: 'Please paste a valid shared link or token.' });
      }
      const saved = await addSavedFamilyLink(user.id, linkOrToken, label);
      return res.status(201).json({ familyMember: saved });
    } catch (error: any) {
      return res
        .status(400)
        .json({ error: error.message || 'Could not add family link.' });
    }
  });

  app.delete(
    '/api/family-links/:id',
    requireAuth,
    async (req: AuthRequest, res) => {
      try {
        const user = await resolveDbUser(req);
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) {
          return res.status(400).json({ error: 'Invalid ID.' });
        }
        await removeSavedFamilyLink(user.id, id);
        return res.json({ success: true });
      } catch (error: any) {
        return res
          .status(500)
          .json({ error: error.message || 'Could not remove family link.' });
      }
    }
  );

  // ---------------------------------------------------------------------------
  // Public Read-Only Shared View Endpoint (No Auth Required)
  // ---------------------------------------------------------------------------
  app.get('/api/public/view/:token', async (req, res) => {
    try {
      const { token } = req.params;
      if (!token || token.trim().length < 6) {
        return res.status(404).json({
          error:
            'This shared ledger link is invalid, disabled, or has been regenerated by the owner.',
        });
      }

      const data = await getPublicLedgerByToken(token);
      if (!data) {
        return res.status(404).json({
          error:
            'This shared ledger link is invalid, disabled, or has been regenerated by the owner.',
        });
      }

      return res.json(data);
    } catch (error: any) {
      console.error('GET /api/public/view/:token error:', error);
      return res
        .status(500)
        .json({ error: 'Unable to load shared ledger right now.' });
    }
  });

  // ---------------------------------------------------------------------------
  // Vite Middleware (Development) & Static Serving (Production)
  // ---------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TrackMo server running on http://localhost:${PORT}`);
  });
}

startServer();
