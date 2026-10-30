# Edan website

The public website and member space for Edan. It is a static multi-page site (plain HTML, CSS and JavaScript) backed by Supabase for accounts, memberships, admin tools and the community chat, with Paystack for membership and Stay room payments, and Supabase Edge Functions for server-side payment handling.

---

## 1. Running the site

### Option A: Docker

Requirements: Docker Desktop (or Docker Engine on Linux).

```bash
docker build -t edan-site .
docker run --rm -p 8080:80 edan-site
```

Open http://localhost:8080 in your browser.

The image is an nginx web server that serves the project files as they are. The Dockerfile copies the whole project into the image, except the items listed in `.dockerignore` (such as `supabase/`, `node_modules/` and `.env`).

### Option B: Node.js (for development)

Requirements: Node.js 20 or newer.

```bash
npm install
npm run dev        # development server with live reload
npm run build      # production build into dist/
npm run preview    # serve the built dist/ folder
```

Note that the Vite build only bundles `index.html`. The other pages (`/gather/`, `/members/`, `/dashboard/` and so on) are plain files, so use the Docker option or any static file server when you need them all to work.

### Important: the site can only be opened over HTTP

Pages load their shared header and footer through `js/include.js`, which fetches partial files. Opening `index.html` directly from disk (`file://`) will not show the header or footer. Always use a web server.

---

## 2. Connecting to Supabase

The site talks to one Supabase project. The public URL and the publishable (anon) key are written directly in these files:

- `js/supabase-client.js`
- `js/account.js`
- `js/members.js`
- `js/members-chat.js`
- `js/nav.js`

The publishable key is designed to be public. Access control is enforced by Row Level Security in the database, not by hiding the key.

To use your own Supabase project, change the URL and key in all five files, then apply the migrations in `supabase/migrations/` in filename order (for example with the Supabase dashboard's SQL editor, or the Supabase CLI).

### Server-side secrets

The Edge Functions in `supabase/functions/` need these secrets set in your Supabase project (Project Settings, Edge Functions, Secrets):

| Secret | Used by | Purpose |
|---|---|---|
| `PAYSTACK_SECRET_KEY` | `paystack-webhook`, `stay-payment`, `stay-paystack-webhook` | Checks webhook signatures, starts Stay checkouts and verifies payments with Paystack |
| `RESEND_API_KEY` | `paystack-webhook` | Sends the payment receipt email |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge Functions.

Deploy the functions from `supabase/functions/` and keep the `verify_jwt` settings in `supabase/config.toml`. `paystack-webhook` and `stay-paystack-webhook` are public because Paystack calls them. `payment-receipt` and `stay-payment` require a signed-in user; `stay-payment` also checks the user itself.

### Paystack

The client needs a Paystack public key (`pk_...`) in `js/gather.js` (the `PAYSTACK_PUBLIC_KEY` constant). It is currently a placeholder, so online payment is disabled until a real key is added. In the Paystack dashboard, set the webhook URL to `https://<your-project>.supabase.co/functions/v1/paystack-webhook` for memberships, and to `https://<your-project>.supabase.co/functions/v1/stay-paystack-webhook` for Stay bookings. The Stay checkout window needs no public key, because the server gets a checkout access code from Paystack for each booking.

---

## 3. Roles

- **Visitor:** can browse all public pages.
- **Member:** a signed-in user. Can apply for membership, pay, download their receipt, and open the member space.
- **Active member:** a member whose membership has been approved by an admin and has not expired. Gets the member benefits and the community chat.
- **Admin:** a user whose ID is listed in the `admins` table. Gets the Dashboard link and can manage videos and applications.

Admin status and membership are enforced in the database. The page checks in `js/` only decide what to show.

---

## 4. Page-by-page guide

Paths are relative to the site root.

### Home (`/`, `index.html`)
- Full-screen hero video from the `site-videos` storage bucket.
- `js/video-views.js` records one row in `video_views` the first time the hero video starts playing.
- Public. No sign-in needed.

### About (`/about/`)
- Founder and team profiles, story chapters and the circular-design section.
- `js/behind-scenes.js` runs decorative sketch animations when sections scroll into view.
- Static content, no backend.

### Account (`/account/`) and Login (`/login/`)
- Both pages run `js/account.js`.
- **Sign up:** name, email, password (at least 8 characters, entered twice). Creates a Supabase account and sends a confirmation email.
- **Sign in:** email and password. Redirects to the membership page if a plan was chosen, or to the stay page otherwise.
- **Forgot password:** sends a reset email that returns to `/login/?mode=recovery`. The new-password form is not built yet.
- The `?plan=monthly` or `?plan=annual` parameter carries the chosen plan through sign-in to the Gather page.
- The `?next=` parameter sends the guest back after sign-in. Only paths under `/stay/` are accepted.

Known issue: the sign-up form on `/account/` does not match the script (it has no confirm-password field and uses a different name field), so sign-up there always reports that the passwords do not match. The same form on `/login/` works.

### Gather (`/gather/`): membership
- Shows two plans: Monthly (GH₵1000 per month) and Annual (GH₵8000 per year).
- Clicking a plan without a session sends the visitor to `/account/?plan=...`. Clicking with a session opens the application dialog.
- Payment flow: see section 5.
- Scripts: `js/gather.js`, Paystack's inline checkout script.

### Stay (`/stay/`)
- Marketing page with a booking dialog for dates, guests and rate. Rooms: room only GH₵650 per night, with breakfast GH₵700 per night. Up to two guests, minimum one night, check-in 3:00 PM, check-out 11:00 AM.
- The dialog shows nights times the rate for display (rates are also set in the script). The database sets the price that is actually charged. Check-in cannot be in the past.
- Guests check live availability, pick a free room, enter their details and pay through the Paystack checkout window (section 5.6). A chosen room is kept in the browser's session storage only while the guest signs in, then cleared when the selection resumes.
- The booking status panel also opens when Paystack returns the guest to `/stay/?stay_booking=...`.
- Scripts: `js/stay.js` (dates and room list), `js/stay-checkout.js` (guest details, payment and status), `js/stay-api.js` (calls to the database and Edge Functions). Paystack's inline checkout script is loaded on the page.

### Eat (`/eat/`)
- Café menu with category filters, a featured carousel and a basket.
- Menu items and prices are sample data in `js/eat.js`.
- The basket lives in memory and is lost on reload.
- The checkout form collects name, phone and dine-in or takeaway details. Online payment is marked as not yet enabled.
- Nothing is sent to the backend from this page. Check `js/eat.js` before relying on checkout.

### Grow (`/grow/`)
- Garden and living-lab marketing page with static images and field notes.
- No script beyond the shared header and footer, no backend.

### Labs (`/labs/`)
- Interactive four-field map (sonic, ground, AI, fabric) with tabs and a readout. Script: `js/labs.js`.
- Known bug: the script looks for an element with the ID `readout-link`, which is not on the page. This throws an error after the text updates, so the "Enter this lab" link is not set and keyboard focus does not move. The map still works visually.
- Dossier fields still say "to be confirmed".

### Contact (`/contact/`)
- Contact details and an enquiry form that is posted to FormSubmit, which emails the address set in the form. The address is currently hardcoded in the page. Confirm it before launch.
- Social links and some contact details are still placeholders.
- Script: `js/contact.js`.

### Members (`/members/`)
- Requires a session. Without one, the visitor is sent to `/account/?next=members`.
- Shows the member's tier and status. Benefits sections are hidden unless the membership is active and not expired (`js/members.js`).
- The annual section is shown to monthly members as a teaser, and the annual features only to annual members.
- **Receipt:** if the member has a successful payment, a "Download receipt (PDF)" button appears. It calls the `payment-receipt` Edge Function for the most recent successful payment.
- **Community chat:** a realtime message board for active members (`js/members-chat.js`). Members pick a username (3 to 24 letters, numbers or underscores), then post messages of up to 1000 characters. New messages appear live. Chat access is checked in the browser only.

### Dashboard (`/dashboard/`), admin only
- Shows the team dashboard: totals for members, homepage video views and video uploads.
- **Homepage video:** an admin uploads an MP4 up to 50 MB. It replaces the file in the `site-videos` bucket and is logged in `video_uploads`.
- **Applications:** lists membership applications. Review opens a dialog to set the tier and start and end dates, then approve or reject. Approval sets the member to active. Rejection asks for confirmation first.
- **Members:** lists the 100 most recent memberships.
- Scripts: `js/admin.js`, `js/admin-memberships.js`, `js/admin-table.js`.
- Non-admins see an "access restricted" message. The real protection is the database, so admin actions still fail for non-admins even if the page is changed.

---

## 5. How the algorithms work

### 5.1 Membership payment (end to end)

1. A signed-in visitor chooses a plan on `/gather/` and fills in the application dialog.
2. `js/gather.js` inserts a row into `membership_applications` with status `pending`, the plan, and the applicant's email. Row Level Security only allows this for the signed-in user's own application.
3. The script builds a unique reference (`edan-<plan>-<uuid>`) and opens the Paystack checkout. The amount is set in the browser.
4. Paystack sends a `charge.success` event to `paystack-webhook`.
5. The webhook checks the request signature (HMAC-SHA512 of the raw body with the secret key). Requests with a bad signature are rejected with 401.
6. The webhook stores a hash of the request body in `paystack_events`. Repeat deliveries of the same event are then recognised and ignored.
7. The webhook asks Paystack to verify the transaction. Only a verified `success` status is accepted.
8. The `record_paystack_event` database function locks the matching `payment_transactions` row. It records success only if the row has not already succeeded and the amount and currency match. This is what prevents duplicate or fake payments from being recorded twice.
9. On success, the webhook sends a receipt email once. A conditional update sets `receipt_sent_at` first, so two deliveries cannot both send it. If sending fails, the timestamp is cleared so the next delivery can retry.

Payment never approves a membership. An admin still reviews the application and approves it on the dashboard, which sets the membership dates.

**Current gap:** nothing in this repository creates the `payment_transactions` row that step 8 needs. Until a server step (or an insert from the checkout) creates a `pending` row with the reference, the webhook returns `unmatched` and no payment is recorded. This must be built before live payments work.

### 5.2 Receipt download

1. The member page finds the latest successful payment for the signed-in user.
2. Clicking the button sends the user's session token to `payment-receipt`.
3. The function asks Supabase Auth who the token belongs to, then loads only that user's successful payment.
4. It returns a PDF with the plan, applicant email, application date, amount, payment date and reference.

### 5.3 Admin approval

1. The dashboard checks `is_edan_admin()`. Non-admins see the restricted message.
2. Approve calls `approve_membership_application` with the tier and dates. The database confirms the caller is an admin, then sets the membership to active.
3. Reject calls `reject_membership_application` in the same way.

### 5.4 Homepage video

1. An admin picks an MP4 under 50 MB. The browser checks the type and size.
2. The file is uploaded to `site-videos/hero/edan-hero.mp4`, replacing the old one.
3. A row is added to `video_uploads`. The homepage shows the new video after its cache expires, about a minute.

### 5.5 Community chat

1. The chat checks the member's status in `memberships`.
2. It loads the last 60 messages and the usernames from `member_chat_profiles`.
3. New messages arrive through a realtime subscription on `member_chat_messages`.
4. Messages are inserted with the user's ID and shown as plain text.

### 5.6 Stay room booking (end to end)

1. The guest chooses dates, guests and a rate, then clicks Check availability. `js/stay.js` asks the database for free rooms (`stay_room_availability`). A room is free when no confirmed or completed stay overlaps the dates, no unexpired hold overlaps them, and no closure from the dashboard covers them.
2. Choosing a room while signed out saves the choice in the browser and sends the guest to `/login/`. After signing in, they return to `/stay/?resume=1` and the choice continues.
3. The guest enters name, email and phone, then clicks Continue to payment. `create_stay_hold` creates a `pending_payment` booking that holds the room for 15 minutes. The database sets the price (GH₵650 room only, GH₵700 with breakfast, per night).
4. `stay-payment` (action `initialize`) locks the booking, re-checks the dates (`prepare_stay_payment`), and asks Paystack to start a transaction with reference `EDNSTAY-...`, the amount in pesewas and currency GHS. It saves Paystack's access code on the booking. Repeated requests reuse the saved code.
5. `js/stay-checkout.js` opens Paystack's checkout window on the page with that access code. If the window is closed, Continue to payment reopens it while the hold lasts.
6. Paystack sends `charge.success` to `stay-paystack-webhook`. The webhook checks the HMAC-SHA512 signature, logs the event in `stay_payment_events` (repeats are harmless), verifies the transaction with Paystack, and calls `confirm_stay_payment`. That function confirms the booking only if the reference, amount (total x 100 pesewas), currency and dates still match.
7. If the amount or currency does not match, or a date conflict appears, the booking is cancelled and marked Refund required. No refund is issued automatically; an admin must refund it.
8. After a successful checkout window, the page asks `stay-payment` (action `verify`) to check with Paystack directly, so the guest sees the result without waiting for the webhook. The same check runs for `/stay/?stay_booking=...`.
9. A hold that is not paid within 15 minutes becomes `payment_failed` and releases the room.

---

## 6. Database overview

| Table | Purpose | Who can read | Who can write |
|---|---|---|---|
| `admins` | Admin user IDs | Own row only | Nobody from the client |
| `memberships` | One membership per member | Own row; admins | Only the approval functions |
| `membership_applications` | Applications from `/gather/` | Own rows; admins | Own rows, insert only, status must be pending |
| `payment_transactions` | One row per payment | Own rows; admins | Server only |
| `paystack_events` | Webhook log for duplicate detection | Nobody from the client | Server only |
| `stay_rooms` | Bookable rooms | Admins | Admins (rename, open or close) |
| `stay_bookings` | Stay reservations, holds and payments | Own bookings (guests); admins | Server (online bookings); admins (manual bookings, status changes) |
| `stay_room_blocks` | Dates a room is closed | Admins | Admins |
| `stay_payment_events` | Stay webhook log | Nobody from the client | Server only |
| `video_views` | Homepage video plays | Admins | Anyone (insert only) |
| `video_uploads` | Admin video upload log | Admins | Admins |
| `site-videos` (bucket) | Homepage video file | Public | Admins |

Functions: `is_edan_admin`, `approve_membership_application`, `reject_membership_application` (admins), `record_paystack_event` (server only).

Stay functions: `stay_room_availability` (anyone), `create_stay_hold` (signed-in guests), `admin_create_manual_booking`, `admin_block_room` and `admin_set_booking_status` (admins), and `prepare_stay_payment`, `confirm_stay_payment` and `mark_stay_payment_failed` (server only).

Tables `member_chat_messages` and `member_chat_profiles` are used by the chat, but no migration in this repository creates them. Create them before enabling the chat on a new project.

---

## 7. Project layout

```
index.html              homepage
about/ account/ contact/ dashboard/ eat/ gather/ grow/ labs/ login/ members/ stay/
css/                    shared styles (base, tokens, footer) and css/pages/ per page
js/                     browser scripts, one per page or feature
partials/               shared header and footer
images/                 photos and graphics
supabase/migrations/    database schema, in filename order
supabase/functions/     Edge Functions: paystack-webhook, payment-receipt, stay-payment, stay-paystack-webhook
supabase/config.toml    Edge Function settings
Dockerfile              container image for the static site
```

---

## 8. Known issues before launch

- Paystack public key is a placeholder, so online payment is disabled.
- `payment_transactions` rows are not created anywhere, so payments cannot be recorded (see 5.1).
- Chat tables are not in the migrations.
- Sign-up on `/account/` mismatches its script.
- Labs script throws an error on load (see the Labs section).
- Stay page links to `about.html`, `eat.html` and `labs.html` point to non-existent paths under `/stay/`.
- Eat checkout does not send orders to any backend.
- Contact form goes to a hardcoded personal address.
- Placeholder links remain in the footer and contact page.
- Stay online booking has not been tested with Paystack. It needs a Paystack test secret key in the `PAYSTACK_SECRET_KEY` secret before payments can run.
- Stay refunds for mismatched or conflicting payments are manual. The booking is marked Refund required, and no admin screen for this exists yet.
