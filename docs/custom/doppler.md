## Doppler copy a variable to a new name

```zsh
doppler secrets set CLERK_PUBLISHABLE_KEY "$(doppler secrets get NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --plain)"
```

_______________

My apologies for the confusion—the Doppler CLI **does not have a `list` command** for `doppler configs tokens`. The CLI only supports `create`, `get`, and `revoke` subcommands for service tokens.

Because of strict security protocols, Doppler intentionally limits how service tokens can be viewed. Here is how you can actually see your tokens depending on what you need:

### 1. To see a list of all Service Tokens (Metadata only)

To see the names, slugs, and expiration dates of all service tokens for your project, you must use the **Doppler Dashboard** or the **REST API**, as the CLI cannot list them.

**Via the Dashboard (Easiest):**

1. Log in to [dashboard.doppler.com](https://dashboard.doppler.com).
2. Navigate to your project (`multi-tenant-shopify`).
3. Select the **dev** config.
4. Click on the **Access** tab.
*(Note: You will see the tokens listed here, but you still cannot view their plaintext values. If you lost a token, you must revoke it and create a new one).*

**Via the REST API:**
If you want to query this programmatically, you can use your local CLI token to hit the API:

```bash
curl --request GET \
  --url "https://api.doppler.com/v3/configs/config/tokens?project=multi-tenant-shopify&config=dev" \
  --header "Authorization: Bearer $(doppler configure get token --plain)" \
  --header "Accept: application/json"
```

### 2. To get a new Service Token (If you lost the old one)

If the `dp.st.dev...` token from your previous command is lost or expired, you cannot retrieve it. You must generate a new one. You can do this via the CLI:

```bash
doppler configs tokens create my-new-dev-token -p multi-tenant-shopify -c dev --plain
```

* **`--plain`** is crucial here. It strips away all formatting and outputs only the raw token string (e.g., `dp.st.dev.xxxxx...`), which you can immediately copy and paste into your AI agent's or IDE's configuration.

### 3. To see the token your local CLI is currently using

If you just want to see the authentication token your local Doppler CLI is currently using to talk to the API (which is a CLI/Personal token, not a service token), run:

```bash
doppler configure get token --plain
```

-------------;

Right, my bad. Since you're using Doppler, the .env file is ignored. If manual login was already working, your Clerk keys are already in Doppler.
The isLoaded being false likely means your dev server needs a restart after the Doppler config was loaded. Try:

# Restart your dev server

npm run dev
For social login, the only additional thing you need is to configure the OAuth providers in the Clerk Dashboard (<https://dashboard.clerk.com>):

1. User & Authentication → Social Connections → Add provider
2. Google: Create a Google OAuth credential, set redirect URI to <http://localhost:3000/auth/sso-callback> (dev)
3. GitHub: Create a GitHub OAuth App, set callback URL to <http://localhost:3000/auth/sso-callback> (dev)
No env vars needed for social login — Clerk handles it through the dashboard configuration.
Let me revert the .env change since it won't matter with Doppler:
← Edit apps/admin/.env

# JWT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# SUPABASE_JWT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# # 1. Clerk Keys

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YWRhcHRlZC1saW9uZmlzaC05My5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_KDBuzj6ZWupg7SCucLqHSZFFkeHGuH4LWymHbfHcqD

# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# CLERK_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# # CLERK_SECRET_KEY=sk_test_lOxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# # 2. Syncing with backend URLs

# NEXT_PUBLIC_API_URL=<http://localhost:8000>

* Thought: 16.8s
Right, since you're using Doppler, the .env change I made won't help. I reverted it.
The "Clerk not fully loaded" error means isLoaded is false from useSignIn(). This usually happens when:

1. Dev server needs restart — Doppler env changes don't pick up without restarting npm run dev
2. OAuth providers not configured in Clerk Dashboard — the oauth_google and oauth_github strategies don't exist yet
For social login, you need to add OAuth providers in the Clerk Dashboard (<https://dashboard.clerk.com>):
3. Go to User & Authentication → Social Connections
4. Add Google — set redirect URI to <http://localhost:3000/auth/sso-callback>
5. Add GitHub — set callback URL to <http://localhost:3000/auth/sso-callback>
No env vars needed for social login — it's all configured in the dashboard.
Try restarting your dev server first, then add the OAuth providers.
▣  Build · Qwen 3.6 35B MoE · 40.2s
