---
name: Email environment pitfalls
description: How this app's emails behave across dev/prod — URL selection and dev redirect — and past incidents caused by getting it wrong.
---

# Email environment pitfalls

- **Email links must never use the dev domain in production.** `getAppUrl()` in `server/email.ts` must resolve to the published domain (custom domain `https://cbl-strat.me`) whenever `REPLIT_DEPLOYMENT` or `NODE_ENV=production` is set.
  **Why:** In Aug 2026, production emails linked members to the sleeping `.replit.dev` preview ("Run this app" page); members reported it as "can't approve trades." `REPLIT_DEPLOYMENT_DOMAIN` was not set in the deployment, so the code silently fell back to `REPLIT_DEV_DOMAIN`.
  **How to apply:** When touching email templates or URL construction, verify against `getDeploymentInfo()` (production URL is the custom domain, not `.replit.app`), never env-var guesses.

- **Dev/test emails are redirected, not suppressed.** Outside production, if `DEV_EMAIL_RECIPIENT` is set, every outgoing email is rerouted there with a `[DEV → original]` subject prefix. League-wide sends (e.g. trade-completed emails to ~28 members) therefore flood that one inbox — expected behavior, alarming to the user. Testing agents accepting trades in their isolated environments trigger this.

- **Trade-accept flow safety:** roster validation must run before marking a trade accepted, and a failed roster swap must revert the trade to pending. Commissioners/super admins may respond to trades but never to their own proposals.
