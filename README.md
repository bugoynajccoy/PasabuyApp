# Deploy to GitHub Pages
1. Push this project to a GitHub repository (branch `main`).
2. In the repo: **Settings > Pages > Build and deployment > Source: GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which builds with the right base path (`/<repo-name>/`, or `/` for a `<user>.github.io` repo) and publishes `dist/`. The site appears at `https://<user>.github.io/<repo-name>/`.

Pages hosts the frontend only, in demo mode (data lives in each browser's localStorage). To share data between devices, host `server/sync-server.mjs` somewhere that runs Node and build with `VITE_SYNC_URL=https://your-server`. `npm run build` also writes `dist/404.html` so refreshing a deep link such as `/messages` still loads the app.

# Pasabuy Marketplace (React + Vite, Express + MySQL + Socket.IO)

## Status (read this first)
| Part | State |
|---|---|
| Original UI, all 6 pages as React | Done. Pixel-compared against the HTML prototype (desktop + phone): identical |
| Login / register / role-based routes / admin screens | Done (frontend, localStorage demo auth) |
| `src/services/*` (auth, posts, offers, transactions, messages, notifications, reviews, reports, admin) | Done. **65/65 workflow tests pass** (`node tools/service-workflow.test.mjs` after bundling with esbuild) |
| `backend/` Express + MySQL + Socket.IO API | **Written and syntax-checked, NOT executed** (no MySQL/network where it was built). Expect to debug on first run |
| **Identity verification** (ID + selfie, admin review, badge) | Done in demo mode: `node tools/verification.test.mjs` (39 checks). API routes written + syntax-checked, **not executed** |
| Frontend wired to the API | **Not yet.** UI still reads localStorage services. Dynamic feed / post forms / messages / notifications / profile pages are the next step |

## User interaction (messages, posts, notifications, profiles)
Every account (including ones that registered but have not logged in yet) can be found, messaged and have its profile opened. Feed avatars/usernames, the chat header and the Search sheet ("People") all open profiles; Search can start a chat with anyone. Bell and chat icons show live unread counts.
Test: `node tools/interaction.test.mjs` (22 checks). Note: in demo mode all data lives in one browser's localStorage, so two users only see each other in the same browser. Real cross-device interaction needs the frontend wired to the API (see table above).
Conversation controls (send, transaction form, mute, pin, report, block, delete): `node tools/conversation.test.mjs` (27 checks).
`tools/service-workflow.test.mjs` is out of date against the current seed (empty posts, jerume unverified) and fails before and after this change.

## Payment hold process (simulated)
No real money moves and no payment gateway is called. Every payment is a **hold record** (`payments` store / table) tied to one transaction:
1. Both sides approve the form (the approver must be verified).
2. **Requester taps Pay**, picks GCash / Maya / Bank transfer (labels only, no Cash on Delivery), ticks the consent box and taps **Hold ₱X**. A held payment is created with a reference (PB-XXXXXX) and the traveler is notified.
3. Traveler starts delivery, then marks delivered. This starts a **48-hour auto-release clock**.
4. **Requester confirms receipt -> released** to the traveler. If the requester does nothing for 48 hours after delivery, the hold **releases itself** and both people are notified.
5. Either person can **open a dispute** while the payment is held. The hold stays held and auto-release stops until an admin chooses **Release to traveler** or **Refund requester** (admin > Payments).
Status flow: `held -> released` or `held -> disputed -> released | refunded`. A failed payment (bad method) changes nothing. Users cannot block each other while a hold is active.
Chat card shows amount, method, reference, status and the auto-release time. Admin > **Payments** shows totals (held / in dispute / released / refunded) and every hold.
Test: `node tools/payment.test.mjs` (26 checks). Demo mode releases overdue holds whenever transactions are read; the backend does it in `backend/src/jobs.js` every 5 minutes. Backend pieces (`payments` + `payment_events` tables, `GET /transactions/:id/payment`, `POST /transactions/:id/pay {method}`, `GET /admin/payments`) are written and syntax-checked but, like the rest of `backend/`, **not executed**. Run `npm run db:init` again to create the new tables.

## Likes and comments (Instagram-style post footer)
Under every post: a heart (like / unlike, double-click the photo to like), a comment bubble (opens the comments sheet) and a paper plane (message the author about the post, hidden on your own posts). Below them: "N likes", the caption, and "View all N comments" / "Add a comment…".
Comments sheet: bottom sheet on phones, centered card on desktop. Add a comment (500 chars max), **Reply** (one level deep; replying to a reply still lands under the top-level comment with an @mention), like a comment, **Delete** (the commenter, the post owner or an admin; deleting a comment also removes its replies and likes). Post owners and the people replied to get notifications; liking your own post or comment notifies nobody; unliking never notifies. Blocked pairs cannot like or comment on each other's posts.
Test: `node tools/engage.test.mjs` (26 checks). Backend (`comments` + `reactions` tables, `backend/src/routes/engage.js`: `GET /post-stats`, `POST /reactions`, `GET|POST /posts/:id/comments`, `DELETE /comments/:id`) is written and syntax-checked, **not executed**; the frontend still uses the localStorage service until it is wired to the API. Run `npm run db:init` again for the new tables. Block checks are not in the backend routes yet.

## Identity verification
How a user gets the verified badge:
1. **User** opens their own profile. Unverified users see a "Get verified" card. They pick an ID type, type the name on the ID, add a photo of the ID and a selfie holding it, tick the consent box and submit. Status becomes **Under review**.
2. **Admin** sees a count on **ID Verifications** (admin sidebar / "More" on phones). The review screen shows account name next to the name on the ID, both photos (tap to enlarge) and a short checklist. **Approve** grants the badge. **Reject** requires a reason (quick-pick reasons provided).
3. **User** is notified either way. Approved users get the badge and can approve transaction forms (the existing "only verified users" rule). Rejected users see the reason on their profile and can submit again.

Status flow: `unverified -> pending -> verified | rejected -> (submit again) pending`. Only one request can be pending per user.
Privacy: photos exist only while a request is pending; approving or rejecting erases them (only the decision, reason and timestamps remain). Users never get their photos back from the API, and only admins can list requests (checked server-side in the service and in `backend/src/routes/admin.js`).
The admin Users table now shows each account's verification status, and its manual "Give badge / Remove badge" action updates both user stores, so it can no longer disagree with the feed.

**Demo-mode warning:** ID photos sit in localStorage (and in the optional sync server's `data.json`, because `pb2_verifications` is synced so an admin on another device can review). That is fine for a prototype and wrong for production: real deployments must store them in private, access-controlled storage. Still to add before production: document-quality/liveness checks, rate limits on submissions, retention policy and a data-privacy notice (Philippine Data Privacy Act), and optional email/phone confirmation.

## Run the frontend (demo mode, no backend)
    npm install
    npm run dev          # http://localhost:5173
Demo logins: admin / Admin@123 (at /admin/login), jake.b / User@123.

## Run the backend (MySQL 8+ required)
    cd backend
    cp .env.example .env        # set DB_*, JWT_SECRET (long random), ADMIN_PASSWORD
    npm install
    npm run db:init             # creates tables + the first admin
    npm run dev                 # API + Socket.IO on :4000

## API summary (all under /api, JWT in httpOnly cookie)
auth: POST register, login, logout, change-password; GET me
posts: GET /posts?type&q&destination&status, GET/PUT/DELETE /posts/:id, POST /posts
offers: POST /posts/:id/offers, GET /posts/:id/offers (owner), GET /offers/mine, POST /offers/:id/accept|reject|cancel
transactions: GET /transactions, GET /transactions/:id, GET /transactions/:id/payment, POST /transactions/:id/{approve|cancel|pay {method}|ship|deliver|confirm|dispute}
messages: GET /conversations, GET /conversations/:otherId/messages, POST /messages  (+ Socket.IO `message:new`, `notification:new`)
notifications: GET /notifications, POST /notifications/read-all, POST /notifications/:id/read
profile/reviews/reports: GET /users/:id, PUT /users/me, GET /users/:id/reviews, POST /reviews, POST /reports
verification (logged in): GET /verification/me, POST /verification {idType, nameOnId, idImage, selfieImage, consent}
admin (role=admin, enforced server-side): GET /admin/verifications, POST /admin/verifications/:id/approve|reject {reason}, GET /admin/stats|users|posts|transactions|payments|reports|logs, POST /admin/users/:id/verify|suspend, DELETE /admin/posts/:id, POST /admin/transactions/:id/resolve, POST /admin/reports/:id/resolve|dismiss

Payments are SIMULATED (hold/release/refund are ledger records only). No COD, no payment gateway.
Security notes: bcrypt-hashed passwords, role and suspension re-checked from the DB on each request, admin cannot be registered publicly. Still to add before production: rate-limiting, helmet, HTTPS, CSRF protection for cookie auth, image upload limits/storage.
