import { transporter } from "../config/mail.js";
import { config } from "dotenv";
import logger from "../utils/logger.js"; // Import logger

config();

export const sendMail = (lead) => {
  logger.info(`Preparing to send lead notification email to: ${lead.sendTo}`, {
    brandName: lead.brandName,
    leadName: lead.name,
    leadEmail: lead.email
  });

  const mailOptions = {
    from: process.env.MAIL,
    to: lead.sendTo,
    subject: `New Lead for ${lead.brandName || 'Your Brand'}`,
    html: `
      <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
            }
            .container {
              background-color: #fff;
              padding: 20px;
              border-radius: 5px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            }
            h1 {
              color: #333;
            }
            p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>New Lead for ${lead.brandName || 'Your Brand'}</h1>
            <p><strong>Lead Name:</strong> ${lead.name}</p>
            <p><strong>Lead Email:</strong> ${lead.email}</p>
            <p><strong>Lead Phone:</strong> ${lead.phone}</p>
            <p><strong>Message:</strong> ${lead.message}</p>
            ${lead.country ? `<p><strong>Country:</strong> ${lead.country}</p>` : ''}
            ${lead.budget ? `<p><strong>Budget:</strong> ${lead.budget}</p>` : ''}
            ${lead.services ? `<p><strong>Services:</strong> ${lead.services}</p>` : ''}
            ${lead.timeline ? `<p><strong>Timeline:</strong> ${lead.timeline}</p>` : ''}
          </div>
        </body>
      </html>
    `,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      logger.error(`Failed to send lead notification email: ${error.message}`, {
        error: error,
        recipient: lead.sendTo,
        leadEmail: lead.email
      });
    } else {
      logger.info(`Lead notification email sent successfully to ${lead.sendTo}`, {
        messageId: info.messageId,
        leadEmail: lead.email
      });
    }
  });
};