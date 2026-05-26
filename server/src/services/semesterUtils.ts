// Swap Supabase for your database pool
import { db } from '../db';

/**
 * Returns the semester date range (ISO strings) for a given date.
 * Semester 1: Jan 1 – Jun 30
 * Semester 2: Jul 1 – Dec 31
 */
export function getSemesterRange(date: Date): { start: string; end: string } {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-indexed

    if (month <= 5) {
        // Jan–Jun
        return {
            start: `${year}-01-01T00:00:00.000Z`,
            end: `${year}-06-30T23:59:59.999Z`,
        };
    }
    // Jul–Dec
    return {
        start: `${year}-07-01T00:00:00.000Z`,
        end: `${year}-12-31T23:59:59.999Z`,
    };
}

/**
 * Counts the number of distinct co-curricular events (by batch_id) for a given
 * club within a semester range. Bookings with status 'rejected' are excluded.
 *
 * @param excludeBookingId  Optional booking id to exclude (useful when editing
 * an existing booking so it doesn't count against itself).
 */
export async function countCoCurricularBookings(
    clubId: string,
    semesterStart: string,
    semesterEnd: string,
    excludeBookingId?: string,
): Promise<number> {
    
    // 1. Build the base query
    let queryStr = `
        SELECT batch_id 
        FROM bookings 
        WHERE club_id = $1 
          AND event_type = 'co_curricular' 
          AND status != 'rejected' 
          AND start_time >= $2 
          AND start_time <= $3
    `;
    const values: any[] = [clubId, semesterStart, semesterEnd];

    // 2. Dynamically append the exclude ID if it was provided
    if (excludeBookingId) {
        values.push(excludeBookingId);
        queryStr += ` AND id != $${values.length}`;
    }

    try {
        // 3. Execute the query
        const { rows } = await db.query(queryStr, values);

        // Each event may span multiple venues (same batch_id), so we count unique
        // batch_ids. Bookings without a batch_id are treated as individual events.
        const batchIds = new Set<string>();
        let noBatchCount = 0;
        
        for (const row of rows) {
            if (row.batch_id) {
                batchIds.add(row.batch_id);
            } else {
                noBatchCount++;
            }
        }

        return batchIds.size + noBatchCount;
    } catch (error: any) {
        throw new Error(`Failed to count co-curricular bookings: ${error.message}`);
    }
}

export const CO_CURRICULAR_LIMIT = 2;