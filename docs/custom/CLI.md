```zsh
╭─ ~/WebstormProjects/multi-tenant-shopify  on main *1 !10 ?6                                                             1 ✘  at 16:59:47 ─╮
╰─ DOPPLER_TOKEN="$(doppler configure get token --plain)" \
─╯
DOPPLER_PROJECT="$(doppler configure get project --plain)" \
DOPPLER_CONFIG="$(doppler configure get config --plain)" \
SERVICE_TOKEN=$(curl -sS --request POST \
  --url <https://api.doppler.com/v3/configs/config/tokens> \
  --header 'Content-Type: application/json' \
  --header "api-key: $DOPPLER_TOKEN" \
  --data "{\"project\":\"$DOPPLER_PROJECT\",\"config\":\"$DOPPLER_CONFIG\",\"name\":\"$DOPPLER_PROJECT VS Code Dev Container\"}" \
  | jq -r '.token.key')

echo "DOPPLER_TOKEN=$SERVICE_TOKEN"

DOPPLER_TOKEN=dp.st.dev.Q4U4RBsEssQKcxFm5jzgplKB4MHilKPzNX4paFVacO5
```

## 1. Get your CLI / personal token (for scripting the Doppler API itself) ￼

This is the token tied to your user account (more privileges; don’t use it in prod apps).

**From the CLI:**

```zsh
doppler configure get token --plain
```

That prints your personal/CLI token, which you can then use to script against the Doppler API, or to programmatically create service tokens (like in that gist you starred):

```zsh
DOPPLER_TOKEN="$(doppler configure get token --plain)" \
DOPPLER_PROJECT="$(doppler configure get project --plain)" \
DOPPLER_CONFIG="$(doppler configure get config --plain)" \
SERVICE_TOKEN=$(curl -sS --request POST \
  --url <https://api.doppler.com/v3/configs/config/tokens> \
  --header 'Content-Type: application/json' \
  --header "api-key: $DOPPLER_TOKEN" \
  --data "{\"project\":\"$DOPPLER_PROJECT\",\"config\":\"$DOPPLER_CONFIG\",\"name\":\"$DOPPLER_PROJECT VS Code Dev Container\"}" \
  | jq -r '.token.key')

echo "DOPPLER_TOKEN=$SERVICE_TOKEN"
```