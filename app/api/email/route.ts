import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { adminAuth } from '@/lib/firebaseAdmin';
import { validateRequest, emailRequestSchema, createAuditLog, logAudit } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;
  let userRole: string | undefined;

  try {
    // Verify Firebase ID Token
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const auditLog = createAuditLog(req, undefined, undefined, 'email_send', undefined, 'notification', false, 'Missing or invalid Authorization header');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(idToken);

    if (!decodedToken) {
      const auditLog = createAuditLog(req, undefined, undefined, 'email_send', undefined, 'notification', false, 'Invalid token');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 403 });
    }

    userId = decodedToken.uid;
    userRole = decodedToken.admin ? 'admin' : 'user';

    // Validate request body
    const body = await req.json();
    const validation = validateRequest(emailRequestSchema, body);

    if (!validation.success) {
      const auditLog = createAuditLog(req, userId, userRole, 'email_send', undefined, 'notification', false, 'Validation failed', { errors: validation.errors.flatten() });
      logAudit(auditLog);
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors.flatten() },
        { status: 400 }
      );
    }

    const { email, subject, message, fromEmail, fromName } = validation.data;

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      const auditLog = createAuditLog(req, userId, userRole, 'email_send', undefined, 'notification', false, 'Email credentials not configured');
      logAudit(auditLog);
      return NextResponse.json({ error: 'Email service not configured' }, { status: 503 });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      // Security: enforce TLS
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2',
      },
    });

    // Sanitize inputs to prevent header injection
    const sanitizedSubject = subject.replace(/[\r\n]/g, ' ').trim();
    const sanitizedMessage = message.replace(/[\r\n]+/g, '\n').trim();
    const sanitizedFromName = (fromName || 'Avdar').replace(/[\r\n]/g, ' ').trim();

    await transporter.sendMail({
      from: `"${sanitizedFromName}" <${fromEmail || emailUser}>`,
      to: email,
      subject: sanitizedSubject,
      text: sanitizedMessage,
      // HTML version for better formatting
      html: sanitizedMessage.replace(/\n/g, '<br>'),
    });

    const auditLog = createAuditLog(req, userId, userRole, 'email_send', undefined, 'notification', true, undefined, {
      to: email.replace(/(.{2})(.*)(@.*)/, '$1***$3'), // Mask email in logs
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    return NextResponse.json({ success: true, message: 'Email sent successfully' }, { status: 200 });
  } catch (error: any) {
    const auditLog = createAuditLog(req, userId, userRole, 'email_send', undefined, 'notification', false, error.message || 'Failed to send email', {
      durationMs: Date.now() - startTime,
    });
    logAudit(auditLog);

    // Don't expose internal error details
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    );
  }
}