import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { adminAuth } from '@/lib/firebaseAdmin';
import { validateRequest, smsRequestSchema, createAuditLog, logAudit } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;
  let userRole: string | undefined;

  try {
    // Verify Firebase ID Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const auditLog = createAuditLog(req, undefined, undefined, 'sms_send', undefined, 'appointment', false, 'Missing or invalid Authorization header');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (!decodedToken) {
      const auditLog = createAuditLog(req, undefined, undefined, 'sms_send', undefined, 'appointment', false, 'Invalid token');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 403 });
    }

    userId = decodedToken.uid;
    userRole = decodedToken.admin ? 'admin' : 'user';

    // Validate request body
    const body = await req.json();
    const validation = validateRequest(smsRequestSchema, body);

    if (!validation.success) {
      const auditLog = createAuditLog(req, userId, userRole, 'sms_send', undefined, 'appointment', false, 'Validation failed', { errors: validation.errors.flatten() });
      logAudit(auditLog);
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.flatten() },
        { status: 400 }
      );
    }

    const { phone, message } = validation.data;

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !twilioPhone) {
      const auditLog = createAuditLog(req, userId, userRole, 'sms_send', undefined, 'appointment', false, 'Twilio credentials not configured');
      logAudit(auditLog);
      return NextResponse.json({ error: 'SMS service not configured' }, { status: 503 });
    }

    const client = twilio(accountSid, authToken);

    // Sanitize message - prevent injection
    const sanitizedMessage = message.replace(/[\r\n]+/g, ' ').trim();

    const response = await client.messages.create({
      body: sanitizedMessage,
      from: twilioPhone,
      to: phone,
    });

    const auditLog = createAuditLog(req, userId, userRole, 'sms_send', response.sid, 'message', true, undefined, {
      to: phone.replace(/\d(?=\d{4})/g, '*'), // Mask phone in logs
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    return NextResponse.json({ success: true, sid: response.sid }, { status: 200 });
  } catch (error: any) {
    const auditLog = createAuditLog(req, userId, userRole, 'sms_send', undefined, 'appointment', false, error.message || 'Failed to send SMS', {
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    // Don't expose internal error details
    const status = error.code === 21211 ? 400 : // Invalid phone number
                   error.code === 21614 ? 400 : // Not a valid mobile number
                   500;

    return NextResponse.json(
      { error: status === 400 ? error.message : 'Failed to send SMS' },
      { status }
    );
  }
}