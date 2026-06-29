export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', lineHeight: 1.7, color: '#333' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Last updated: June 29, 2026</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>1. Introduction</h2>
      <p>
        Omon CRM ("we", "our", or "us") operates a customer relationship management platform
        for travel agencies. This Privacy Policy explains how we collect, use, and protect
        information when you use our services or interact with our Instagram integration.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>2. Information We Collect</h2>
      <p>We collect the following types of information:</p>
      <ul>
        <li><strong>Instagram messages:</strong> When you message our Instagram business account, we receive your Instagram user ID and message content to respond to your inquiry.</li>
        <li><strong>Contact information:</strong> Name, phone number, and travel preferences you provide through our chat bot.</li>
        <li><strong>Usage data:</strong> How you interact with our platform.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>3. How We Use Your Information</h2>
      <p>We use collected information to:</p>
      <ul>
        <li>Respond to your travel inquiries</li>
        <li>Create and manage customer records in our CRM system</li>
        <li>Connect you with our travel agents</li>
        <li>Improve our services</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>4. Instagram Data</h2>
      <p>
        We use the Instagram Graph API to receive messages sent to our business Instagram account.
        We only access messages directed to our account. We do not access your personal Instagram
        profile, followers, or any other data beyond direct messages you send to us.
      </p>
      <p>
        Instagram message data is stored securely in our database and used solely to respond
        to your travel inquiries. We do not sell or share your Instagram data with third parties.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>5. Data Retention</h2>
      <p>
        We retain your information for as long as necessary to provide our services.
        You may request deletion of your data by contacting us.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>6. Data Security</h2>
      <p>
        We implement appropriate security measures to protect your personal information
        against unauthorized access, alteration, disclosure, or destruction.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>7. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access your personal data</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Opt out of communications</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>8. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, please contact us at:<br />
        <strong>Email:</strong> admin@demo.uz<br />
        <strong>Platform:</strong> Omon CRM — Travel Agency Management System
      </p>

      <p style={{ marginTop: 48, color: '#999', fontSize: 14 }}>
        © 2026 Omon CRM. All rights reserved.
      </p>
    </div>
  );
}