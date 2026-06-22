# README

## Doppler copy a varible to a new name

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
