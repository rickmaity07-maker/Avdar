import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Avdar",
  description: "How Avdar collects, uses, and protects your data.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-serif text-gold-400 mb-3">{title}</h2>
      <div className="text-zinc-300 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-black text-white px-6 md:px-8 py-24">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs uppercase tracking-widest text-zinc-500 hover:text-gold-400 transition-colors">
          ← Back to Avdar
        </Link>

        <h1 className="text-3xl md:text-4xl font-serif mt-6 mb-2">Privacy Policy</h1>
        <p className="text-zinc-500 text-xs uppercase tracking-widest mb-12">Last updated — [add date before publishing]</p>

        <div className="mb-12 p-4 border border-gold-700/60 bg-gold-900/20 text-gold-200 text-xs leading-relaxed">
          This page was drafted from what the Avdar booking site actually collects and sends, to replace a
          broken link. It is a starting point, not legal advice — have it reviewed against German/EU law
          (DSGVO, TTDSG) before treating it as final, and fill in the bracketed placeholders.
        </div>

        <Section title="Who this covers">
          <p>
            This policy applies to the Avdar website and booking system at [your domain], operated by
            [Avdar — legal name / owner, business address]. For questions about this policy or your data,
            contact [privacy contact email].
          </p>
        </Section>

        <Section title="What we collect">
          <p><strong className="text-white font-normal">Account &amp; booking data:</strong> name, email, phone number, and — if you choose to add them — appointment notes or special requests, when you register or book an appointment.</p>
          <p><strong className="text-white font-normal">Sign-in data:</strong> if you sign in with Google or Facebook, we receive your name, email, and profile photo from that provider via Firebase Authentication.</p>
          <p><strong className="text-white font-normal">Reference images:</strong> photos you optionally upload with a booking (e.g. a haircut reference).</p>
          <p><strong className="text-white font-normal">Cookies:</strong> a necessary cookie to remember your consent choice, and — only if you accept them — analytics cookies. See the cookie banner for details; necessary cookies cannot be disabled.</p>
        </Section>

        <Section title="How we use it">
          <p>To create and manage your account, take and manage bookings, send you booking confirmations and reminders by email and SMS, and — for admins — to run the salon&apos;s day-to-day scheduling.</p>
          <p>Interface text may be translated automatically via DeepL when you switch languages; this only sends interface labels, not your personal data.</p>
        </Section>

        <Section title="Who we share it with">
          <p>We use the following processors to run the service. Each only receives what it needs to do its job:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Google Firebase (authentication, database, file storage) — [region, if configured]</li>
            <li>Twilio (SMS booking notifications)</li>
            <li>Google Workspace / Gmail (email booking notifications, via SMTP)</li>
            <li>DeepL (interface translation)</li>
          </ul>
          <p>We do not sell your data, and we do not share it with advertisers.</p>
        </Section>

        <Section title="How long we keep it">
          <p>[Fill in: e.g. &quot;Account and booking data for as long as your account is active, plus X years for bookkeeping, then deleted.&quot;] Cookie consent records are kept for [12 months] to prove consent was given.</p>
        </Section>

        <Section title="Your rights">
          <p>Under the GDPR you can access, correct, or delete your data, and export a copy of it. You can do the last two yourself, any time, from your profile:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong className="text-white font-normal">Export your data</strong> — Profile → Export my data</li>
            <li><strong className="text-white font-normal">Delete your account</strong> — Profile → Delete my account</li>
          </ul>
          <p>For anything else — objecting to processing, or a complaint to your local data protection authority — contact us at [privacy contact email].</p>
        </Section>

        <Section title="Cookies">
          <p>We use a necessary cookie to remember your cookie preference, and — only with your consent — analytics cookies. You can change your choice at any time by clearing your browser&apos;s local storage for this site or via [add a &quot;manage cookie settings&quot; trigger if you want one in-page].</p>
        </Section>

        <Section title="Contact">
          <p>[Avdar — legal name], [address], [email], [phone]. If you&apos;ve appointed a Datenschutzbeauftragter (data protection officer), name them here.</p>
        </Section>
      </div>
    </main>
  );
}
