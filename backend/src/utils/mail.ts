import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
  port: parseInt(process.env.SMTP_PORT || '2525'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendMail = async (to: string, subject: string, html: string) => {
  try {
    await transporter.sendMail({
      from: '"VET - Clínica Veterinária" <noreply@vetclinic.com>',
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('[MAIL ERROR]:', error);
    // Em dev, apenas logamos o conteúdo para o desenvolvedor ver o código
    console.log('--- MOCK EMAIL ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Content:', html);
    console.log('------------------');
  }
};
