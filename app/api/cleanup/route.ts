import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { createAuditLog, logAudit } from '@/lib/validation';

const CLEANUP_SECRET = process.env.CLEANUP_API_SECRET;

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let deletedCount = 0;

  try {
    const authHeader = req.headers.get('x-cleanup-secret');
    if (CLEANUP_SECRET && authHeader !== CLEANUP_SECRET) {
      const auditLog = createAuditLog(req, undefined, undefined, 'cleanup', undefined, 'system', false, 'Invalid cleanup secret');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgoDate = new Date(ninetyDaysAgo).toISOString().split('T')[0];

    // 1. Delete cancelled appointments where appointment date is older than 90 days
    // (Appointment type doesn't have createdAt, so we use the appointment date)
    const cancelledApptsSnap = await adminDb
      .collection('appointments')
      .where('status', '==', 'cancelled')
      .where('date', '<', ninetyDaysAgoDate)
      .get();

    const batch1 = adminDb.batch();
    cancelledApptsSnap.docs.forEach(doc => {
      batch1.delete(doc.ref);
      deletedCount++;
    });
    if (!cancelledApptsSnap.empty) await batch1.commit();

    // 2. Delete read alerts older than 30 days
    const readAlertsSnap = await adminDb
      .collection('alerts')
      .where('isRead', '==', true)
      .where('createdAt', '<', thirtyDaysAgo)
      .get();

    const batch2 = adminDb.batch();
    readAlertsSnap.docs.forEach(doc => {
      batch2.delete(doc.ref);
      deletedCount++;
    });
    if (!readAlertsSnap.empty) await batch2.commit();

    // 3. Delete waitlist entries older than 30 days (expired)
    const waitlistSnap = await adminDb
      .collection('waitlist')
      .where('createdAt', '<', thirtyDaysAgo)
      .get();

    const batch3 = adminDb.batch();
    waitlistSnap.docs.forEach(doc => {
      batch3.delete(doc.ref);
      deletedCount++;
    });
    if (!waitlistSnap.empty) await batch3.commit();

    const auditLog = createAuditLog(req, undefined, undefined, 'cleanup', undefined, 'system', true, undefined, {
      deletedCount,
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    return NextResponse.json({ success: true, deletedCount, durationMs: Date.now() - startTime });
  } catch (error: any) {
    console.error('Cleanup API Error:', error);
    const auditLog = createAuditLog(req, undefined, undefined, 'cleanup', undefined, 'system', false, error.message || 'Cleanup failed', {
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    return NextResponse.json(
      { error: 'Cleanup failed' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}