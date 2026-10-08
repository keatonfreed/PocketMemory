export default function Policy({ terms = false }) {
  return <article className="policy">
    <h1>{terms ? 'Terms of use' : 'Privacy policy'}</h1>
    <p className="muted">Updated October 7, 2026</p>
    {terms ? <>
      <h2>Your personal memory</h2><p>Pocket Memory helps you keep information, recall it, and prepare useful work. You retain ownership of your content. Use the service only for information you are entitled to provide and lawful purposes.</p>
      <h2>AI and reminders</h2><p>AI interpretations and answers can be wrong. Review important information and correct it when needed. The app does not send emails, change calendars, or act on external accounts. Research uses external sources that may be incomplete or outdated. Reminders depend on device permissions, scheduling limits, and device settings; do not rely on them for emergencies or safety-critical tasks.</p>
      <h2>Your account</h2><p>Keep your Apple account secure. You can export your information and delete your account from Settings. Service access may be limited to protect availability or address misuse. Changes to these terms will be reflected here before they take effect.</p>
      <h2>Contact</h2><p>For support or questions, use <a href="mailto:keaton@mfreed.com">Contact support</a>.</p>
    </> : <>
      <h2>What is stored</h2><p>Pocket Memory stores what you submit, your original history, assistant replies, interpreted memories and revisions, reminders, and your Apple account identifier and available name or email. Apple’s Hide My Email is supported.</p>
      <h2>On your phone and in the cloud</h2><p>The iPhone app stores a local copy and unsynced entries in SQLite so you can read and capture offline. Session credentials are stored in iOS Keychain. Content syncs to Neon through the backend hosted on Vercel. Network requests use HTTPS. This is not end-to-end encrypted storage.</p>
      <h2>AI processing is your choice</h2><p>With your permission, OpenAI processes your entry and relevant stored information to interpret memories and answer requests. TypeSafe processes your entry and recent context using JEV for classification. Processing happens on their servers. Declining or withdrawing consent stops new AI processing; you can still read, edit, export, and delete stored information. Queued entries are processed when you enable AI and reconnect.</p>
      <h2>Research</h2><p>Research is off by default for each request. When you enable it, the assistant may use OpenAI web search, including search queries derived from your request and relevant context. Links to returned sources are shown with the answer.</p>
      <h2>Notifications and permissions</h2><p>Notifications are optional and requested when you enable reminders on your phone. Reminder text can appear on your lock screen according to your iPhone notification settings. We do not access your contacts, calendar, email, photos, or microphone. You may use the iPhone keyboard’s dictation feature under Apple’s controls.</p>
      <h2>Retention and control</h2><p>Content is retained until you delete it or your account. Deleting a history entry removes that entry; separately derived memories remain until you delete them. Deleting a memory removes its revisions. Account deletion removes your account and associated app data from the active database and revokes Apple access. Hosting and database backups may retain data until their configured retention periods expire. Export your information from Settings before deletion if you want a copy.</p>
      <h2>Service providers</h2><p>Apple provides sign-in and device services; Vercel hosts the backend; Neon stores cloud data; OpenAI and TypeSafe provide AI processing. Their applicable terms and data-retention policies also apply to processing by those providers. This app includes no advertising or analytics trackers and does not sell your personal information.</p>
      <h2>Contact</h2><p>For privacy or deletion questions, contact <a href="mailto:keaton@mfreed.com">Contact support</a>.</p>
    </>}
  </article>
}
