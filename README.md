# Payble

Payble is a full-stack smart bill reminder and payment-tracking application. Users can
create and manage bills, view upcoming and overdue payments, receive email reminders,
make payments through Razorpay, and review financial insights.

The project is split into two deployable applications:

- `frontend-deploy` - React, TypeScript, Vite, Tailwind CSS, and shadcn/ui PWA
- `backend-deploy` - Node.js, Express, MongoDB, Supabase authentication, Brevo email, and Razorpay

## Features

- Supabase email/password authentication
- User profile synchronization to MongoDB
- Create, list, update, delete, and mark bill reminders as paid
- One-time, monthly, quarterly, and yearly reminder frequencies
- Dashboard with calendar, upcoming, overdue, and notification views
- Financial insights and profile budget information
- Automated email notifications for newly created and upcoming bills
- Razorpay order creation and payment-signature verification
- Installable Progressive Web App (PWA)

## Architecture

```text
Browser
  |
  | React/Vite frontend
  | Supabase session and access token
  v
Express backend
  |-- MongoDB Atlas: reminders and synced user records
  |-- Supabase Auth: identity and token verification
  |-- Brevo SMTP API: transactional email
  |-- Razorpay: order creation and payment verification
```

The frontend uses the Supabase session to obtain an access token. Protected backend
requests send that token as a Bearer token in the `Authorization` header.

## Prerequisites

- Node.js 18 or newer
- npm
- A MongoDB Atlas database
- A Supabase project with authentication enabled
- A Brevo API key and verified sender
- Razorpay test or live API credentials

## Repository structure

```text
.
├── backend-deploy/
│   ├── middleware/verifyUser.js
│   ├── models/reminder.js
│   ├── routes/
│   ├── utils/emailService.js
│   ├── server.js
│   └── package.json
├── frontend-deploy/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── integrations/supabase/
│   │   ├── pages/
│   │   └── components/
│   ├── vite.config.ts
│   └── package.json
└── README.md
```

## Backend setup

```bash
cd backend-deploy
npm install
npm run dev
```

For a production-style local start:

```bash
npm start
```

The backend listens on `PORT`, or port `5001` when `PORT` is not set.

### Backend environment variables

Create `backend-deploy/.env`. Never commit this file or paste real credentials into
documentation.

```env
PORT=5001
BASE_URL=https://your-backend.example.com

MONGO_URI=mongodb+srv://<user>:<password>@<cluster>/<database>

SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key

BREVO_API_KEY=your-brevo-api-key

RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
RAZORPAY_WEBHOOK_SECRET=your-razorpay-webhook-secret
```

`RAZORPAY_WEBHOOK_SECRET` is optional in the current implementation; if it is not
provided, the webhook falls back to `RAZORPAY_KEY_SECRET`. Use a separate webhook
secret in production.

### Backend API

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/api/users` | Create or synchronize a user record |
| `POST` | `/api/reminders` | Create a bill reminder |
| `GET` | `/api/reminders/:user_id` | List a user's reminders |
| `GET` | `/api/reminders/today/:user_id` | List unpaid reminders due today |
| `DELETE` | `/api/reminders/:id` | Delete a reminder |
| `PUT` | `/api/reminders/:id/mark-paid` | Mark a reminder as paid |
| `GET` | `/api/notifications` | Get due, overdue, and payment notifications |
| `POST` | `/api/emails/send-due-reminders` | Send reminders due within `daysAhead` days |
| `GET` | `/api/emails/test` | Check that the email route is reachable |
| `POST` | `/api/payments/create-order` | Create a Razorpay order |
| `POST` | `/api/payments/verify` | Verify a Razorpay payment signature |
| `POST` | `/api/payments/webhook` | Receive Razorpay webhook events |
| `GET` | `/test-email` | Send a backend email smoke test |

Requests to `/api/notifications` require a valid Supabase Bearer token. The user
route also requires authentication. The frontend currently sends authenticated
tokens for reminder operations as well.

### Email reminder schedule

After MongoDB connects, the backend schedules a daily job at **09:00 according to
the server's timezone**. The job calls:

```text
POST {BASE_URL}/api/emails/send-due-reminders
```

with `{ "daysAhead": 7 }`. Ensure `BASE_URL` points to the deployed backend and that
the hosting platform keeps the service running.

## Frontend setup

```bash
cd frontend-deploy
npm install
npm run dev
```

The Vite development server uses port `8080`. To create and preview a production
build:

```bash
npm run build
npm run preview
```

### Frontend environment variables

Create `frontend-deploy/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:5001
VITE_API_URL=http://localhost:5001

VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

`VITE_API_URL` and `VITE_API_BASE_URL` are both supported by the current frontend;
keep them pointed at the same backend URL to avoid inconsistent requests.

For a deployed frontend, replace the local backend URL with the public backend URL,
for example:

```env
VITE_API_BASE_URL=https://your-backend.example.com
VITE_API_URL=https://your-backend.example.com
```

Only public Supabase URL and anon-key values belong in the frontend environment.
Never expose MongoDB, Brevo, or Razorpay secret values in `VITE_*` variables.

## Deployment

### Backend on Render

1. Create a Render Web Service connected to `backend-deploy`.
2. Set the build command to `npm install`.
3. Set the start command to `npm start`.
4. Add all backend environment variables in the Render dashboard.
5. Confirm the service URL is used as `BASE_URL` and as the frontend API URL.
6. Configure Razorpay's webhook URL as:
   `https://your-backend.example.com/api/payments/webhook`.

### Frontend on Vercel, Netlify, or Render Static Site

1. Create a site using `frontend-deploy` as the project root.
2. Set the build command to `npm run build`.
3. Set the publish/output directory to `dist`.
4. Add the four frontend environment variables.
5. Add the deployed frontend origin to the backend CORS allowlist if it is not a
   `vercel.app` domain.

Because the app uses `BrowserRouter`, configure the hosting provider to rewrite
unknown routes to `index.html`; otherwise direct navigation to `/dashboard`,
`/reminders`, or `/profile` may return a 404.

## Development checks

Run the frontend lint and production build before deployment:

```bash
cd frontend-deploy
npm run lint
npm run build
```

The backend currently provides `npm test` only as a placeholder and does not include
automated tests. Verify the following manually after deployment:

1. Sign up and sign in through Supabase.
2. Confirm the user is synchronized to MongoDB.
3. Create and delete a reminder.
4. Confirm dashboard and notification data load.
5. Test Razorpay using test credentials.
6. Trigger the email endpoint with a small `daysAhead` value.

## Security and production notes

- Keep `.env`, `.env.local`, MongoDB credentials, Brevo keys, and Razorpay secrets out
  of Git.
- Restrict MongoDB Atlas network access and use a least-privilege database user.
- Use separate Razorpay test and live credentials.
- Keep payment signature verification on the backend; never trust a success result
  generated only by the browser.
- Restrict CORS to the actual deployed frontend origin instead of broad domain
  matching when moving to production.
- Protect reminder mutation and payment endpoints with authenticated-user checks and
  confirm that the requested reminder belongs to the authenticated user.
- Configure a verified Brevo sender and move sender details to environment variables
  before production use.
- Monitor the scheduled email job and avoid exposing test-email endpoints publicly.

## License

No project license is currently declared. Add a license file before distributing
the project publicly.

