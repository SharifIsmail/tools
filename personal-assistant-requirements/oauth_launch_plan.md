# OAuth Launch Plan (Google Drive)

Goal: ship internally first (no external users), defer Google verification until the app is feature-complete.

## Phase 1 — Internal Only (now)
- OAuth app type: **Internal** to your Google Workspace or **Testing** with whitelisted accounts (<100 users).
- Scopes: `drive.readonly`, `drive.file`, `drive.labels` as currently specified.
- Flow: PKCE in SPA; tokens stored in session/local storage; no refresh beyond test users.
- Deliverables: working product features, stable Drive integration, no external distribution.

## Phase 2 — Pre-Verification Prep (after features are done)
- Security review: confirm minimal scopes, enforce HTTPS, review token storage/expiry/refresh.
- UX review: consent screen copy/screenshots, error handling for expired tokens, clear scope rationale.
- Compliance assets: privacy policy URL, terms URL, support contact, branding assets (logo).
- Risk mitigations: ensure app does not email users, limit data retention, document data flows.

## Phase 3 — External Launch + Google Verification
- Switch OAuth app to **External**; add production domain origins/redirects.
- Submit for verification for sensitive scopes; respond to Google’s proof requests (screen captures, videos).
- Rollout plan: staged allowlisting, monitoring of quota/403 errors, fallback for token failures.
