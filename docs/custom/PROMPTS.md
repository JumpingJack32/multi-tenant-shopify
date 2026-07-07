To properly enforce tenant isolation in a FastAPI/SQLModel application, you need a two-pronged approach:

**1. Context Management via Python's contextvars**

In FastAPI, requests are handled asynchronously. Using Python's built-in contextvars allows you to store the tenant_id safely across async boundaries without risking data leaks between concurrent requests.

Next.js Integration: Your Next.js frontend (likely using Server Actions or Middleware) passes a JWT or a custom header (e.g., X-Tenant-ID) to FastAPI.

FastAPI Middleware/Dependency: A FastAPI dependency extracts this ID, verifies it, and sets it in a ContextVar.

**2. Database-Level Enforcement via SQLModel / SQLAlchemy**

Manual filtering (where(Model.tenant_id == tenant_id)) is a ticking time bomb for data leaks. Human error guarantees a developer will eventually forget a .where() clause.

SQLAlchemy 2.0 Advanced Features: SQLModel is built on top of SQLAlchemy. You can use SQLAlchemy's do_orm_execute event listener or the newer with_loader_criteria global option to automatically inject the tenant filter into every select statement executed during that request.

--------
I strongly recommend **Option B**, but with one important clarification: you should use **Clerk's hosted sign-in for *all* authentication methods** (including email/password, if you want it).

Here is why Option B is the correct architectural choice, and why Options A and C contain a dangerous trap.

### The Trap: Why not A or C?

The red flag in Options A and C is the phrase: *"Credentials verified against your database."*

If you are using Clerk as your identity provider, **you should never build a custom login form that checks passwords against your own database.** Doing so creates a "split-brain" authentication system where normal users use Clerk, but super admins use a custom, home-grown auth flow. This means you are suddenly responsible for password hashing, brute-force protection, and MFA for your most critical accounts—defeating the entire purpose of paying for an auth provider like Clerk.

### Why Option B (Clerk Hosted Sign-In) Wins

To Clerk, a "Super OWNER" is just a regular user. The "Super" designation is purely an **application-level authorization** concept, not an authentication concept.

1. **Unified Security**: Your super admins get the exact same enterprise-grade security (MFA, bot protection, secure password storage) as your regular users, managed entirely by Clerk.
2. **Zero Custom Auth Code**: You don't have to write, test, or maintain a custom login page, password reset flow, or session management logic for admins.
3. **Single Source of Identity**: Every user in your system, from a standard tenant to the platform owner, has a single `userId` managed by Clerk. This makes your database joins and audit logs infinitely cleaner.

### How to handle the "Backup Access" concern (from Option C)

If you want the Super OWNER to have a backup way to log in (e.g., if they lose access to their Google account), **do not build a custom email/password form**. Instead:

1. Go into your Clerk Dashboard.
2. Enable **Email Address** and **Password** as sign-in factors alongside Google OAuth.
3. Clerk's hosted UI will automatically present the user with options to sign in via Google *or* Email/Password.

### The Ideal Super OWNER Login Flow

1. **Initiation**: The Super OWNER navigates to your app's `/admin/login` route.
2. **Redirect**: Your app redirects them to Clerk's hosted sign-in page (using Clerk's pre-built `<Show when='signed-in'>` component or redirect URL).
3. **Authentication**: The user authenticates via Google OR Email/Password *entirely within Clerk's secure environment*.
4. **Callback**: Clerk redirects back to your app with a valid Clerk session token.
5. **Authorization (The Hybrid Step)**: Your backend/middleware takes the Clerk `userId`, queries your database, and checks if `is_platform_superuser == true`.
6. **Access Granted**: If true, you proceed to mint the app-specific JWT (with the `is_platform_superuser` claim) or grant access to the admin dashboard. If false, you redirect them to a "403 Unauthorized" page.

By keeping authentication 100% inside Clerk, you keep your codebase clean, your security tight, and your architecture consistent.

___________________;

# You can treat OpenCode a bit like a junior dev who knows your repo inside out. The trick is to be concrete about what “status” means and to point it at the right scope. STATUS REPORT OF PROJECT

# Here’s a simple template you can use in a prompt:

“OpenCode, analyse the current project and give me a status report. Summarise:

- what features are implemented and working

- what features are partially implemented

- what’s still TODO

- any failing tests or obvious errors

- any high‑risk or messy areas of code I should know about”

Then refine it depending on what you want:

# If you want a high-level roadmap check:

“Scan the codebase and existing issues in /opencode.json Compare what’s implemented against the roadmap or TODOs and tell me:

- which planned features are complete

- which are in progress

- which aren’t started yet

- Include file/dir references for each item.”

# If you care about tests and build health:

“Run/inspect the test setup and CI config and tell me:

- whether tests exist and how many there are

- which tests are failing or flaky

- whether the build passes in CI

- any missing test coverage for critical paths (auth, billing, multi‑tenant isolation).”

# If you want per-module status (e.g. for your FastAPI/Next stack):

“Give me a status summary by layer:

- backend (FastAPI, SQLModel, RLS, tenants)

- frontend admin

- storefront

For each, list: done, in progress, not started, and any architectural or security concerns.” Look in /opencode,json for guidance.

“You have permission to inspect all files and configs. Focus on correctness, security (especially multi‑tenant isolation), and missing pieces. Be blunt about problems.”

That’s usually enough to make it surface a clear state-of-play rather than just describing single files.

>Opencode "Review the README.md file in the root of this project. Read the main source files to understand what the project does, then rewrite the README to improve its structure, clarity, and formatting. Ensure it includes standard sections like Overview, Installation, Usage, and Contributing." Prompt me before overwriting the README.md.


> “Give me a status summary by layer:

> - backend (FastAPI, SQLModel, RLS, tenants)
> - frontend admin
> - storefront
> For each, list: done, in progress, not started, and any architectural or security concerns.”
> And one thing that helps a lot: explicitly grant it permission and priority, e.g.:
> “You have permission to inspect all files and configs. > Focus on correctness, security (especially multi‑tenant isolation), and missing pieces. Be blunt about problems.”
> That’s usually enough to make it surface a clear state-of-play rather than just describing single files.
