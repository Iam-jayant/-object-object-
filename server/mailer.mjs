import nodemailer from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || SMTP_USER || '';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

let transporter;

function requireMailConfig() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
    throw new Error('SMTP config missing. Set SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM');
  }
}

function getTransporter() {
  requireMailConfig();
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendReportAlertMail({
  toEmail,
  batchId,
  reason,
  reporter,
  reporterEmail,
  manufacturerName,
  manufacturerWallet,
  txHash,
}) {
  const tx = getTransporter();

  const subject = `MediProof Report Alert: ${batchId}`;
  const verifyUrl = `${APP_URL.replace(/\/$/, '')}/verify`;

  const text = [
    `A new issue report was submitted for batch ${batchId}.`,
    '',
    `Manufacturer: ${manufacturerName} (${manufacturerWallet})`,
    `Reporter Wallet: ${reporter}`,
    `Reporter Email: ${reporterEmail || 'N/A'}`,
    `Reason: ${reason}`,
    `Transaction: ${txHash || 'N/A'}`,
    '',
    `Review batch details: ${verifyUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.5; color:#111;">
      <h2 style="margin-bottom:8px;">MediProof Report Alert</h2>
      <p style="margin-top:0;">A new issue report was submitted for batch <strong>${batchId}</strong>.</p>
      <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
        <tr><td style="padding:6px 0; color:#555;">Manufacturer</td><td style="padding:6px 0;"><strong>${manufacturerName}</strong><br/><span style="font-family: monospace; font-size:12px;">${manufacturerWallet}</span></td></tr>
        <tr><td style="padding:6px 0; color:#555;">Reporter Wallet</td><td style="padding:6px 0; font-family: monospace; font-size:12px;">${reporter}</td></tr>
        <tr><td style="padding:6px 0; color:#555;">Reporter Email</td><td style="padding:6px 0;">${reporterEmail || 'N/A'}</td></tr>
        <tr><td style="padding:6px 0; color:#555;">Reason</td><td style="padding:6px 0;">${reason}</td></tr>
        <tr><td style="padding:6px 0; color:#555;">Transaction</td><td style="padding:6px 0; font-family: monospace; font-size:12px;">${txHash || 'N/A'}</td></tr>
      </table>
      <p style="margin-top:16px;"><a href="${verifyUrl}" style="color:#0b63f6;">Open verification portal</a></p>
    </div>
  `;

  await tx.sendMail({
    from: MAIL_FROM,
    to: toEmail,
    subject,
    text,
    html,
  });
}
