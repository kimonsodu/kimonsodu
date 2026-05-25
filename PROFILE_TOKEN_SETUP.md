# Profile Summary Cards token setup

This workflow uses a GitHub Actions secret named `PROFILE_TOKEN`.

## Where to get it

1. Open GitHub and go to your account settings.
2. Open `Developer settings`.
3. Open `Personal access tokens`.
4. Create a token, then copy the value once GitHub shows it.

## Where to put it

Add the token as a repository secret:

1. Open this repository on GitHub.
2. Go to `Settings`.
3. Open `Secrets and variables` -> `Actions`.
4. Create a new repository secret named `PROFILE_TOKEN`.
5. Paste the token value and save.

## What to use

Use a classic personal access token if you want the least friction. This workflow just needs a GitHub token that can read your account and push the generated files back to the repo.

Fine-grained tokens can also work, but they are easier to misconfigure because you must explicitly grant the repo and the needed permissions. If you choose that route, make sure the token can write to this repository.

The token is only used by the workflow in `.github/workflows/profile-summary-cards.yml` and is not meant to live in the repo.

If you want, you can also rename the secret in the workflow later, but the current file already expects `PROFILE_TOKEN`.