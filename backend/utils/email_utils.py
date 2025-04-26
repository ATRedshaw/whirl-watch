"""
backend/utils/email_utils.py
────────────────────────────
Utility responsible for formatting and sending every verification or
password-reset email.  Nothing has been simplified or removed; the HTML,
CSS, and plain-text bodies are identical to your original code – the
only difference is that we now pull config / logger from
`flask.current_app`.
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from flask import current_app


def send_verification_email(to_email: str,
                            code: str,
                            username: str,
                            purpose: str = "password_reset") -> bool:
    """
    Send a richly-formatted HTML email with the 6-digit verification
    code.  Returns True on success, False on any exception.

    :param to_email:  Destination email address
    :param code:      Six-character alphanumeric code
    :param username:  Recipient’s username (for personalisation)
    :param purpose:   'email_verification' | 'password_reset'
    """
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = current_app.config["MAIL_USERNAME"]
        msg["To"] = to_email

        # ─────────────────────────── CSS ─────────────────────────── #
        styles = """
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #e2e8f0;
                max-width: 600px;
                margin: 0 auto;
                background-color: #0f172a;
            }
            .container {
                background: #1e293b;
                padding: 32px;
                border-radius: 12px;
                border: 1px solid #334155;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
            }
            .logo {
                font-size: 32px;
                font-weight: bold;
                color: #38bdf8;
                margin-bottom: 16px;
            }
            .subtitle {
                color: #cbd5e1;
                font-size: 18px;
            }
            .code {
                background-color: #0f172a;
                padding: 20px;
                border-radius: 8px;
                font-size: 32px;
                font-weight: bold;
                text-align: center;
                letter-spacing: 8px;
                margin: 24px 0;
                color: #38bdf8;
                border: 1px solid #334155;
            }
            .footer {
                text-align: center;
                margin-top: 32px;
                padding-top: 24px;
                border-top: 1px solid #334155;
                color: #cbd5e1;
                font-size: 14px;
            }
            .warning {
                background-color: #0f172a;
                border: 1px solid #334155;
                border-radius: 8px;
                padding: 16px;
                color: #cbd5e1;
                font-style: italic;
                margin-top: 24px;
                font-size: 14px;
            }
            .heading {
                color: #38bdf8;
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 16px;
            }
            .signature {
                color: #38bdf8;
                font-weight: bold;
            }
            p {
                color: #e2e8f0;
                margin-bottom: 16px;
            }
        """

        # ────────────────────── HTML template ────────────────────── #
        if purpose == "email_verification":
            msg["Subject"] = f"Welcome to WhirlWatch, {username}! – Verify Your Account"
            html = f"""
            <html>
                <head><style>{styles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">🎬 WhirlWatch</div>
                            <div class="subtitle">Track, Share, and Discover Together</div>
                        </div>

                        <div class="heading">Welcome, {username}!</div>

                        <p>Thank you for joining WhirlWatch. To start tracking your favourite movies and TV shows, please verify your account using this code:</p>

                        <div class="code">{code}</div>

                        <p>This verification code will expire in 15 minutes for security purposes.</p>

                        <div class="warning">
                            If you didn't create an account with WhirlWatch, you can safely ignore this email.
                        </div>

                        <div class="footer">
                            <p>Best regards,<br>
                            <span class="signature">Alex Redshaw</span><br>
                            WhirlWatch Developer</p>
                            <p>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                </body>
            </html>
            """
        else:  # password_reset
            msg["Subject"] = f"WhirlWatch – Password Reset Request for {username}"
            html = f"""
            <html>
                <head><style>{styles}</style></head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">🎬 WhirlWatch</div>
                            <div class="subtitle">Account Security</div>
                        </div>

                        <div class="heading">Password Reset Request for {username}</div>

                        <p>We received a request to reset your WhirlWatch password. Use this verification code to complete the process:</p>

                        <div class="code">{code}</div>

                        <p>This verification code will expire in 15 minutes for security purposes.</p>

                        <div class="warning">
                            If you didn't request this password reset, please ignore this email and ensure your account is secure.
                        </div>

                        <div class="footer">
                            <p>Best regards,<br>
                            <span class="signature">Alex Redshaw</span><br>
                            WhirlWatch Developer</p>
                            <p>This is an automated message, please do not reply.</p>
                        </div>
                    </div>
                </body>
            </html>
            """

        # ───────────────────── Plain-text fallback ─────────────────── #
        text_content = (
            f"Welcome to WhirlWatch, {username}!\n\n"
            if purpose == "email_verification"
            else f"WhirlWatch – Password Reset for {username}\n\n"
        )
        text_content += (
            f"Your verification code is: {code}\n\n"
            "This code will expire in 15 minutes.\n\n"
        )
        text_content += (
            "If you didn't create an account with WhirlWatch, please ignore this email.\n\n"
            if purpose == "email_verification"
            else "If you didn't request this password reset, please ignore this email and ensure your account is secure.\n\n"
        )
        text_content += (
            "Best regards,\n"
            "Alex Redshaw\n"
            "WhirlWatch Developer\n"
        )

        # Attach both versions
        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html, "html"))

        # ───────────────────────── SMTP send ───────────────────────── #
        server = smtplib.SMTP("smtp.gmail.com", 587)
        server.starttls()

        try:
            server.login(
                current_app.config["MAIL_USERNAME"],
                current_app.config["MAIL_PASSWORD"],
            )
        except smtplib.SMTPAuthenticationError as e:
            current_app.logger.error(f"SMTP Authentication Error: {e}")
            raise Exception("Email authentication failed – check credentials")

        server.send_message(msg)
        server.quit()
        return True

    # ─────────────────────── error handling ──────────────────────── #
    except Exception as e:
        current_app.logger.error(f"Email error: {e}")
        return False
