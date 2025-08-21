# Payment Terminal

A payment processing system built with Express.js and Prisma ORM that allows agents to create payment links, manage brands, and handle customer contact requests. The system integrates with PayPal for secure payment processing.

## Features

- **Authentication System**: JWT-based authentication for agents and administrators
- **Payment Processing**: Integration with PayPal API
- **Brand Management**: Create and manage multiple brands with custom logos
- **Payment Links**: Generate unique payment links for customers
- **Contact Request Management**: Handle and track customer inquiries
- **Invoice Generation**: View and print invoices for completed payments
- **File Upload**: Brand logo upload functionality

## Quick Start (Local Development)

1. **Clone and install:**

   ```bash
   git clone https://github.com/sunaiddetho/payment-terminal.git
   cd payment-terminal
   npm install
   ```

2. **Configure environment:**

   ```bash
   cp .env.example .env
   # Edit .env file with your database and PayPal credentials
   ```

3. **Set up database:**

   ```bash
   npx prisma migrate dev
   #run this step to seed initial data (if the seed is done in previous command skip this step)
   npx prisma db seed
   ```

4. **Start development server:**

   ```bash
   npm run dev
   ```

5. **Access the application:**
   Open `http://localhost:3000/login` with credentials:
   - Email: admin@payment-terminal.com
   - Password: aDMin@54321!

## Deployment Guide

### Environment Variables

| Variable               | Description          | Example                                                                            |
| ---------------------- | -------------------- | ---------------------------------------------------------------------------------- |
| `NODE_ENV`             | Environment setting  | `production`                                                                       |
| `PORT`                 | Server port          | `3000`                                                                             |
| `DATABASE_URL`         | MySQL connection     | `mysql://user:pass@localhost:3306/payment_db`                                      |
| `PAYPAL_CLIENT_ID`     | PayPal API ID        | From PayPal Developer Dashboard                                                    |
| `PAYPAL_CLIENT_SECRET` | PayPal API secret    | From PayPal Developer Dashboard                                                    |
| `PAYPAL_MODE`          | PayPal environment   | `sandbox` or `live`                                                                |
| `FRONTEND_URL`         | Application URL      | `This will be url on which this api is hosted i.e: (to be decided)` |
| `JWT_SECRET`           | Token encryption key | Random secure string                                                               |

### Deployment Steps

1. **Server setup:**

   - Install Node.js (v14+) and MySQL

2. **Application setup:**

   ```bash
   git clone https://github.com/sunaiddetho/payment-terminal.git
   cd payment-terminal
   npm install --production
   ```

3. **Environment configuration:**

   ```bash
   cp .env.example .env
   # Edit .env file with your production values (see Environment Variables table above)
   ```

4. **Database setup:**

   ```bash
   npx prisma migrate deploy
      #run this step to seed initial data (if the seed is done in previous command skip this step)
   npx prisma db seed  # Creates admin user and starting brands
   ```

5. **Configure as service with PM2:**
   ```bash
   npm install -g pm2
   pm2 start npm --name payment-terminal -- start
   pm2 startup
   pm2 save
   ```

### File Permissions (This will ensure the application can write to necessary directories)

Ensure upload directory has proper permissions:

```bash
chmod -R 755 src/public/brand-logos
chown -R node:node src/public/brand-logos  # If using node user
```

### Backups (optional but recommended)

Set up database backups:

```bash
# Add to crontab
(crontab -l; echo "0 2 * * * mysqldump -u user -p'password' payment_db > /backups/db-$(date +\%Y\%m\%d).sql") | crontab -
```

## Contact

For any questions or support, please contact developer (fahadzardari111@gmail.com).
