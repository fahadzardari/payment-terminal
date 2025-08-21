import nodemailer from "nodemailer";
import { config } from "dotenv";
config();


export const transporter = nodemailer.createTransport({
  //service: "gmail",
  host: process.env.MAIL_HOST,
  port: process.env.MAIL_PORT,
  // secure: process.env.MAIL_SECURE, 
  auth: {
    user: process.env.EMAIL, 
    pass: process.env.EMAIL_PASSWORD
  },
  debug: true,
  logger: true
});
