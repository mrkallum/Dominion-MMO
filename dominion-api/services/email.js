import nodemailer from 'nodemailer';

// Create transporter
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Send OTP email
export const sendOTPEmail = async (email, otp) => {
    const mailOptions = {
        from: process.env.SMTP_FROM || 'noreply@dominion.com',
        to: email,
        subject: 'Your Dominion OTP Code',
        text: `Your verification code is: ${otp}. It expires in 10 minutes.`,
        html: `<p>Your verification code is: <strong>${otp}</strong></p><p>It expires in 10 minutes.</p>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('OTP email sent to', email);
    } catch (err) {
        console.error('Error sending OTP email:', err);
        throw err;
    }
};