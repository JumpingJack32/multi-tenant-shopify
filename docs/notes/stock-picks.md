# Notes

[•] No problem at all. Your package.json correctly specifies "packageManager": "pnpm@11.9.0" and "node": ">=22.0.0" — only thing missing is the / in >=22.0.0 should be >=22.0.0. Wait, it already is. That's fine.

[•] The errors you saw were from a CI setup that doesn't exist in this repo yet. If you add a GitHub Actions workflow later, just use pnpm/action-setup@v4 without a version key (it reads from package.json), and pin to actions/checkout@v4 with node-version: 22. Want me to set that up?

Twicpics:
    -   Uses `jumpingjackboxx@gmail.com` and `JumpingJack32/multi-tenant-shopify`

Cloudinary:
    -   Uses `george.gunnee@gmail.com`