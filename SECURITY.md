# Before this app touches real client data

Firestore/Storage security rules are included (`firestore.rules`,
`storage.rules`, `firebase.json`) but **they only protect anything once
deployed** to your actual Firebase project. Creating a new Firebase project
via the console gives you either fully-open "test mode" rules (30 days, then
fully locked) or fully-locked "production mode" rules — either way, not the
rules in this repo, until you push them:

```bash
npm install -g firebase-tools   # if you don't have it
firebase login
firebase use --add                     # select/create the Avdar Firebase project
firebase deploy --only firestore:rules,storage:rules
```

## What the rules actually protect

- `users/{userId}` — a client can only read/write their own profile; admins
  can read/write any.
- `clientNotes/{userId}` — private staff notes about a client. **Admin
  only**, on both read and write. This is intentionally a separate
  collection from `users/{userId}` rather than a field on it, specifically
  so a client can never pull their own profile and see notes staff wrote
  about them.
- `appointments/{apptId}` — clients can create their own bookings and
  respond to a proposed reschedule; only admins can confirm/edit/delete
  freely, or create a booking on someone else's behalf (walk-ins).
- `stylists`, `services`, `settings`, `translations` — public read, admin
  write.
- `waitlist` — admin read/manage; a client can only add themselves.
- Firebase Storage `reference-images/{userId}/{appointmentId}/...` — only
  the owning client or an admin can read/write, capped at 5MB, images only.

## Data subject requests (GDPR/CCPA-style rights)

Already wired into the client profile page (My Account → Data & Privacy):

- **Export** — downloads a JSON of the client's own profile, appointments,
  and notifications.
- **Delete** — permanently deletes the client's Firestore data and their
  Firebase Auth account, after a typed confirmation and password re-check.

Note: deleting an account does **not** currently touch that client's
`clientNotes` doc or their uploaded `reference-images`. If you want those
cleaned up as part of account deletion too, that's a small addition to
`AccountDeletionModal`'s deletion pipeline — say the word and I'll add it.

## Also worth doing

Cloud Storage lifecycle rules or a periodic Cloud Function to enforce a data
retention window (e.g. auto-delete appointment records N years after the
visit) aren't set up here — that needs a scheduled Cloud Function, which is
outside what a static Next.js app can do on its own. Worth adding once the
business has settled on a retention policy.
