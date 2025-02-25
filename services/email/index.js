import 'dotenv/config'; // Load environment variables
// Load environment variables
import { MailerSend, EmailParams, Sender, Recipient } from 'mailersend';

// Initialize MailerSend with API key from environment variable
const mailerSend = new MailerSend({
  apiKey: process.env.MS_KEY,
});

// Function to send OTP email using MailerSend
async function sendMail({email, name, content, subject, setText}) {
  const sentFrom = new Sender("no-reply@cvconnect.app", "CVConnect NoReply");
  const recipients = [new Recipient(email, `${name}`)];
  const emailParams = new EmailParams()
    .setFrom(sentFrom)
    .setTo(recipients)
    .setReplyTo(sentFrom)
    .setSubject(subject)
    .setHtml(content)
    .setText(setText);

  try {
    await mailerSend.email.send(emailParams);
    console.log('Welcome email sent successfully');
  } catch (error) {
    console.error('Error sending OTP email:', error);
  }
}

export { sendMail };