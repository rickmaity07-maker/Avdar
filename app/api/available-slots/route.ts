import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// Public, PII-free view of upcoming appointments — just enough to compute
// slot availability client-side. Uses the Admin SDK (bypasses Firestore
// rules) but deliberately returns only date/time/stylist/duration/status —
// never name, phone, notes, userId, or reference images.
export async function GET() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

    const snap = await adminDb
      .collection("appointments")
      .where("date", ">=", todayStr)
      .where("status", "in", ["confirmed", "pending", "proposed", "blocked"])
      .get();

    const slots = snap.docs.map((d) => {
      const data = d.data();
      return {
        date: data.date,
        time: data.time,
        stylist: data.stylist,
        totalDurationMins: data.totalDurationMins || 60,
        status: data.status,
        proposedTime: data.proposedTime || null,
      };
    });

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("🚨 /api/available-slots error:", error);
    // Return empty slots instead of 500 so the client doesn't crash
    return NextResponse.json({ slots: [] }, { status: 200 });
  }
}