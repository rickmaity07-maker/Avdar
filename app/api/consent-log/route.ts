import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// Proof-of-consent log (Art. 7(1) GDPR: "the controller shall be able to
// demonstrate that the data subject has consented"). Server-only write via
// the Admin SDK — see firestore.rules for the matching deny-all client rule.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    await adminDb.collection("consentLogs").add({
      necessary: body.necessary ?? true,
      analytics: body.analytics ?? false,
      consentVersion: body.version ?? null,
      consentedAt: body.timestamp ?? new Date().toISOString(),
      userAgent: body.userAgent ?? null,
      url: body.url ?? null,
      loggedAt: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Never let a logging failure be visible to the visitor — consent was
    // still saved locally regardless of whether this audit copy succeeds.
    console.error("[consent-log] failed to write:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}