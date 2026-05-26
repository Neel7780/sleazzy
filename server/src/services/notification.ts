import { db } from '../db';

export type NotificationType = 'booking_pending' | 'booking_approved' | 'booking_rejected' | 'booking_deleted' | 'general';

export interface CreateNotificationParams {
    type: NotificationType;
    title: string;
    message: string;
    userId?: string | null;
    metadata?: Record<string, any>;
}

/**
 * Create a notification record in the database.
 * These are shown in the admin notifications panel.
 */
export async function createNotification(params: CreateNotificationParams) {
    const { type, title, message, userId, metadata } = params;

    try {
        await db.query(
            `INSERT INTO notifications (type, title, message, user_id, metadata, is_read) 
             VALUES ($1, $2, $3, $4, $5, false)`,
            [
                type, 
                title, 
                message, 
                userId || null, 
                metadata || {}
            ]
        );
    } catch (error: any) {
        console.error('Failed to create notification:', error.message);
    }
}

/**
 * Create notifications for pending booking approvals.
 * Called alongside the email notification.
 */
export async function createBookingPendingNotifications(
    items: { venueName: string; eventName: string; startTime: string; endTime: string; clubName?: string }[]
) {
    if (items.length === 0) return;

    try {
        const values: any[] = [];
        const placeholders: string[] = [];
        let paramIndex = 1;

        // Dynamically build the placeholders and flat values array for bulk insert
        for (const item of items) {
            placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, false)`);
            values.push(
                'booking_pending', // type
                'New Booking Request', // title
                `"${item.eventName}" at ${item.venueName} by ${item.clubName || 'Unknown'} — ${item.startTime} to ${item.endTime}`, // message
                null, // user_id
                { venue: item.venueName, event: item.eventName, club: item.clubName } // metadata
            );
        }

        const queryStr = `
            INSERT INTO notifications (type, title, message, user_id, metadata, is_read)
            VALUES ${placeholders.join(', ')}
        `;

        await db.query(queryStr, values);
    } catch (error: any) {
        console.error('Failed to create booking pending notifications:', error.message);
    }
}