# README

## Doppler copy a varible to a new name

```zsh
doppler secrets set CLERK_PUBLISHABLE_KEY "$(doppler secrets get NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY --plain)"
```
