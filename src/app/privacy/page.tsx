export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', lineHeight: 1.7, color: '#333' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Last updated: July 21, 2026</p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>1. Introduction</h2>
      <p>
        Omon CRM ("we", "our", or "us") operates a customer relationship management platform
        for travel agencies. This Privacy Policy explains how we collect, use, and protect
        information when you use our services or interact with our Facebook, Instagram, or
        WhatsApp integrations.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>2. Information We Collect</h2>
      <p>We collect the following types of information:</p>
      <ul>
        <li><strong>Facebook Lead Ads data:</strong> When you submit a Facebook Instant Form (Lead Ad) connected to one of our travel-agency customers' Facebook Pages, we receive the information you submitted in that form — typically your full name, phone number, email address, and city — via the Facebook Graph API leadgen webhook.</li>
        <li><strong>Instagram messages:</strong> When you message our Instagram business account, we receive your Instagram user ID and message content to respond to your inquiry.</li>
        <li><strong>Contact information:</strong> Name, phone number, and travel preferences you provide through our chat bot.</li>
        <li><strong>Usage data:</strong> How you interact with our platform.</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>3. Facebook Lead Ads Data</h2>
      <p>
        Omon CRM uses the Facebook Graph API and the Facebook Lead Ads webhook (leadgen) to
        automatically import leads submitted through Facebook Instant Forms into our customers'
        (travel agencies') CRM accounts. We access only the lead fields the person submitted in
        the form (e.g. name, phone number, email, city) and the Page's own lead-generation data —
        we do not access the lead's personal Facebook profile, friends list, or any other data
        beyond what was submitted in the form.
      </p>
      <p>
        This data is used solely so the travel agency that owns the Facebook Page can follow up
        with the person who submitted the form. It is stored securely, is only visible to the
        travel agency's own staff within their isolated CRM account, and is never sold or shared
        with third parties or with other travel agencies using Omon CRM.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>4. How We Use Your Information</h2>
      <p>We use collected information to:</p>
      <ul>
        <li>Respond to your travel inquiries</li>
        <li>Create and manage customer records in our CRM system</li>
        <li>Connect you with our travel agents</li>
        <li>Improve our services</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>5. Instagram Data</h2>
      <p>
        We use the Instagram Graph API to receive messages sent to our business Instagram account.
        We only access messages directed to our account. We do not access your personal Instagram
        profile, followers, or any other data beyond direct messages you send to us.
      </p>
      <p>
        Instagram message data is stored securely in our database and used solely to respond
        to your travel inquiries. We do not sell or share your Instagram data with third parties.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>6. Data Retention</h2>
      <p>
        We retain your information for as long as necessary to provide our services.
        You may request deletion of your data by contacting us.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>7. Data Security</h2>
      <p>
        We implement appropriate security measures to protect your personal information
        against unauthorized access, alteration, disclosure, or destruction.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>8. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access your personal data</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Opt out of communications</li>
      </ul>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>9. Contact Us</h2>
      <p>
        If you have questions about this Privacy Policy, please contact us at:<br />
        <strong>Email:</strong> amankulovogabek880@gmail.com<br />
        <strong>Platform:</strong> Omon CRM — Travel Agency Management System
      </p>

      <p style={{ marginTop: 48, color: '#999', fontSize: 14 }}>
        © 2026 Omon CRM. All rights reserved.
      </p>
    </div>
  );
}