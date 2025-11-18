export const EMAIL_CHANGED_CONFIRMATION_TEMPLATE_HTML = (firstName: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Successfully Updated</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(to right, #4CAF50, #388E3C); padding: 20px; text-align: center;">
    <h1 style="color: white; margin: 0;">Email Successfully Updated</h1>
  </div>
  <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">
    <p>Hello ${firstName},</p>
    <p>This is a confirmation that the email address associated with your account has been successfully updated.</p>
    <p>If you made this change, no further action is required.</p>
    <p>If you did <strong>not</strong> request this change, please contact our support team immediately to secure your account.</p>
    <p>Best regards,<br>Your App Team</p>
  </div>
  <div style="text-align: center; margin-top: 20px; color: #888; font-size: 0.8em;">
    <p>This is an automated message, please do not reply to this email.</p>
  </div>
</body>
</html>
`
export const EMAIL_CHANGED_CONFIRMATION_TEMPLATE_TEXT = (firstName: string) => `
Email Successfully Updated
Hello ${firstName},

This is a confirmation that the email address associated with your account has been successfully updated.

If you made this change, no further action is required.
If you did NOT request this change, please contact our support team immediately to secure your account.

Best regards,
Your App Team

This is an automated message, please do not reply to this email.
`
