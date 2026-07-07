export default function TermsPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', lineHeight: 1.7, color: '#333' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Last updated: July 7, 2026</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>1. Overview</h2>
      <p>
        Omon CRM (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) provides a customer relationship
        management platform for travel agencies, including integrations with Facebook, Instagram,
        and WhatsApp to help agencies manage customer inquiries and leads.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>2. Use of the Service</h2>
      <p>
        By using Omon CRM, you agree to use the platform only for lawful business purposes related
        to managing customer relationships, leads, and bookings for travel agency operations.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>3. Facebook / Instagram Integration</h2>
      <p>
        When you connect a Facebook Page or Instagram account to Omon CRM, you authorize us to
        receive messages and lead form submissions sent to that Page on your behalf, solely for
        the purpose of managing those conversations and leads within the CRM. You are responsible
        for ensuring you have the appropriate rights and permissions on the connected Page.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>4. Account Responsibility</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials and
        for all activity that occurs under your account.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>5. Data</h2>
      <p>
        Our collection and use of data is described in our{' '}
        <a href="/privacy">Privacy Policy</a>.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>6. Changes</h2>
      <p>
        We may update these Terms from time to time. Continued use of the service after changes
        constitutes acceptance of the updated Terms.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>7. Contact</h2>
      <p>
        If you have questions about these Terms, please contact us through the CRM support channel.
      </p>
    </div>
  );
}