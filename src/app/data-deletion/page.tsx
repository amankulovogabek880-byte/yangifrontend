export default function DataDeletionPage() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 24px', fontFamily: 'sans-serif', lineHeight: 1.7, color: '#333' }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Data Deletion Instructions</h1>
      <p style={{ color: '#666', marginBottom: 32 }}>Last updated: July 7, 2026</p>

      <p>
        If you would like to request deletion of any personal data collected by Omon CRM through
        our Facebook, Instagram, or WhatsApp integrations (such as messages, lead form submissions,
        or contact information), please follow the steps below.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>How to request deletion</h2>
      <ol>
        <li>Send an email to our support address with the subject line &quot;Data Deletion Request&quot;.</li>
        <li>
          Include the phone number, email address, or Instagram/Facebook profile you used when
          contacting us, so we can locate your records.
        </li>
        <li>
          We will locate and permanently delete the associated records from our database within
          30 days of receiving your request.
        </li>
        <li>We will send a confirmation email once the deletion is complete.</li>
      </ol>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>What gets deleted</h2>
      <p>
        Upon a valid request, we delete the customer record, message history, and any lead data
        associated with your contact information from our CRM database. Data required to be kept
        for legal or accounting purposes (such as completed booking/payment records) may be retained
        as required by applicable law.
      </p>

      <h2 style={{ fontSize: 20, marginTop: 32 }}>Contact</h2>
      <p>
        For any data deletion request or question, please reach out via the contact information
        provided on our{' '}
        <a href="/privacy">Privacy Policy</a> page.
      </p>
    </div>
  );
}