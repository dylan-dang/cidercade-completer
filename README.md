# Cidercade Completer

Automates daily tasks on [Cidercade Rewards](https://rewards.cidercade.com) and posts a summary to Discord.

Each run:

1. **Word of the Day** - solves the daily Wordle puzzle using an entropy-based solver
2. **Candy Blast** - completes available game levels
3. **Loot boxes** - opens up to two boxes per day
4. **Discord** - sends an embed with task completion and rewards

## Requirements

- [Bun](https://bun.sh)
- A Cidercade Rewards account
- (Optional) A Discord server with permission to create webhooks

## Local setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd cidercade-clent
bun install
```

### 2. Create a `.env` file

Create `.env` in the project root (this file is gitignored):

```env
TOKEN=your_api_token
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

### 3. Get your API token

1. Log in to [rewards.cidercade.com](https://rewards.cidercade.com)
2. Open your browser's developer tools → **Network** tab
3. Find a request to `loyalty-api.hang.com`
4. Copy the `Authorization` header value — use only the token part after `Token `

Example: if the header is `Token eyJhbGci...`, put `eyJhbGci...` in `.env`.

> Tokens expire. If runs start failing with auth errors, grab a fresh token from the browser.

### 4. Run locally

```bash
bun start
```

## Discord webhook setup

### Create a webhook

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Name it (e.g. `Cidercade`) and pick a channel
5. Click **Copy Webhook URL**
6. Paste the URL into `.env` as `DISCORD_WEBHOOK_URL`

If `DISCORD_WEBHOOK_URL` is not set, the script still runs but skips the notification.

## Using GitHub Actions (daily cron)

The repo includes a workflow at `.github/workflows/daily.yml` that runs automatically every day at **14:00 UTC** (9 AM CT / 8 AM CST). You can also trigger it manually from the Actions tab.

### 1. Push the repo to GitHub

Make sure `.github/workflows/daily.yml` is on your default branch.

### 2. Add repository secrets

Secrets are **not** stored in the workflow file. Add them in GitHub:

1. Open your repo on GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each:

| Secret name | Value |
|---|---|
| `TOKEN` | Your Hang API token (same as local `.env`) |
| `DISCORD_WEBHOOK_URL` | Your Discord webhook URL |

### 3. Run manually (optional)

1. Go to the **Actions** tab
2. Select **Daily Cidercade**
3. Click **Run workflow**

### 4. Check results

- **Actions** tab - build logs if something fails
- **Discord** - daily summary embed in your webhook channel

> Scheduled workflows only run on the default branch and may be delayed by a few minutes on free-tier GitHub.

### Keep workflows alive

GitHub disables scheduled workflows after **60 days** without commits on the repo. A separate workflow at `.github/workflows/keep-alive.yml` runs daily at **00:00 UTC** and pushes an empty commit when the repo is close to that limit.

**Required setting:** In **Settings** → **Actions** → **General**, set **Workflow permissions** to **Read and write permissions** so the keep-alive job can commit.

You can also run it manually from the Actions tab under **Keep GitHub Actions alive**.

## Scripts

| Command | Description |
|---|---|
| `bun start` | Run all daily tasks |
| `bun run test:wotd-solver <word>` | Test the Wordle solver against a target word |

## Disclaimer

This is an unofficial automation tool. Use at your own risk and in line with Cidercade's terms of service.
