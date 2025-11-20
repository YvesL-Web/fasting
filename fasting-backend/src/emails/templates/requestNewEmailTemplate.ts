export const REQUEST_NEW_EMAIL_TEMPLATE_HTML = (code: string, name: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your New Email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #2196F3, #1976D2); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Confirm Your New Email</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello ${name},</p>
    <p>We received a request to change the email address associated with your account.</p>
    <p>If you made this request, please use the confirmation code below to verify your new email address:</p>
    <div style="text-align: center; margin: 30px 0;">
      <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #2196F3;">${code}</span>
    </div>
    <p>This code will expire in 15 minutes for security reasons.</p>
    <p>If you didn’t request to change your email, please ignore this message. Your current email will remain unchanged.</p>
    <p>Best regards,<br>Your App Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`

export const REQUEST_NEW_EMAIL_TEMPLATE_TEXT = (code: string, name: string) => `
Confirm Your New Email
Hello ${name},
We received a request to change the email address associated with your account.

If you made this request, please use the confirmation code below to verify your new email address:
Code: ${code}

This code will expire in 15 minutes for security reasons.

If you didn’t request to change your email, please ignore this message. Your current email will remain unchanged.

Best regards,
Your App Team

This is an automated message, please do not reply to this email.
`
