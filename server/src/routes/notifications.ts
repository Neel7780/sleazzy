import express from 'express';
// Swap Supabase for your database pool
import { db } from '../db';
import authMiddleware from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// Get all notifications (newest first), with optional ?unread_only=true
router.get('/', async (req, res) => {
    const unreadOnly = req.query.unread_only === 'true';

    try {
        // We use 1=1 as a base so we can safely append AND clauses
        let queryStr = 'SELECT * FROM notifications WHERE 1=1';
        const values: any[] = [];

        if (unreadOnly) {
            values.push(false);
            queryStr += ` AND is_read = $${values.length}`;
        }

        // Admins see all notifications
        // Clubs only see their own
        if (req.user?.role === 'club') {
            values.push(req.user.id);
            queryStr += ` AND user_id = $${values.length}`;
        }

        queryStr += ' ORDER BY created_at DESC LIMIT 50';

        const { rows } = await db.query(queryStr, values);
        return res.json(rows);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// Get unread count
router.get('/unread-count', async (req, res) => {
    try {
        let queryStr = 'SELECT COUNT(*) FROM notifications WHERE is_read = false';
        const values: any[] = [];

        if (req.user?.role === 'club') {
            values.push(req.user.id);
            queryStr += ` AND user_id = $${values.length}`;
        }

        const { rows } = await db.query(queryStr, values);
        
        // node-postgres returns COUNT() as a string, so we parse it
        const count = parseInt(rows[0].count, 10);
        return res.json({ count: isNaN(count) ? 0 : count });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// Mark one notification as read
router.patch('/:id/read', async (req, res) => {
    const { id } = req.params;

    try {
        let queryStr = 'UPDATE notifications SET is_read = true WHERE id = $1';
        const values: any[] = [id];

        if (req.user?.role === 'club') {
            values.push(req.user.id);
            queryStr += ` AND user_id = $${values.length}`;
        }

        await db.query(queryStr, values);
        return res.json({ success: true });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

// Mark all notifications as read
router.patch('/read-all', async (req, res) => {
    try {
        let queryStr = 'UPDATE notifications SET is_read = true WHERE is_read = false';
        const values: any[] = [];

        if (req.user?.role === 'club') {
            values.push(req.user.id);
            queryStr += ` AND user_id = $${values.length}`;
        }

        await db.query(queryStr, values);
        return res.json({ success: true });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;