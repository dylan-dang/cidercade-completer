# Cidercade Completer

Automatically completes your daily [Cidercade Rewards](https://rewards.cidercade.com) tasks and posts a summary to Discord.

Each day it:

1. Solves **Word of the Day**
2. Completes **Candy Blast** levels
3. Opens available **loot boxes**
4. Sends a summary to **Discord** (optional)

---

## Running using GitHub Actions (recommended)

This is the easiest way to setup cidercade complete and you do not need to install anything on your computer. GitHub will run the script for you every day at **9 AM Central** (14:00 UTC).

### What you need

- A free [GitHub](https://github.com) account
- A [Cidercade Rewards](https://rewards.cidercade.com) account
- (Optional) A Discord server where you can create a webhook

### Step 1: Fork this repo

1. Open the fork page: [Fork this repository](https://github.com/dylan-dang/cidercade-completer/fork)
2. Keep the defaults and click **Create fork**

You now have your own copy of the project.

### Step 2: Get your Cidercade token

1. Log in at [rewards.cidercade.com](https://rewards.cidercade.com)
2. Press `F12` (or right-click → **Inspect**) to open developer tools
3. Open the **Console** tab
4. Paste this and press Enter:

```js
copy(document.cookie.match(/(^| )jwt=([^;]+)/)?.[2])
```

1. Your token is now on your clipboard, keep it for the next step

> Tokens last about a month. If runs start failing, grab a fresh one the same way.

### Step 3 (Optional): Create a Discord webhook

Skip this if you do not want Discord notifications.

1. Open your Discord server
2. Go to **Server Settings** → **Integrations** → **Webhooks**
3. Click **New Webhook**
4. Name it (e.g. `Cidercade`) and choose a channel
5. Click **Copy Webhook URL**

### Step 4: Add secrets to your fork

Secrets store your private values so the script can acccess your Cidercade account.

1. On **your fork**, go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each row below:


| Secret name           | What to paste                                   |
| --------------------- | ----------------------------------------------- |
| `TOKEN`               | Your Cidercade token from Step 2                |
| `DISCORD_WEBHOOK_URL` | Your Discord webhook URL from Step 3 (optional) |


### Step 5: Allow the keep-alive workflow to commit

GitHub turns off scheduled workflows after 60 days of no activity. A small “keep-alive” job prevents that, but it needs write access:

1. On your fork: **Settings** → **Actions** → **General**
2. Under **Workflow permissions**, choose **Read and write permissions**
3. Click **Save**

### Step 6: Enable Actions on your fork

GitHub disables workflows on forks by default. You must turn them on once, then enable each workflow individually:

1. Open the **Actions** tab on your fork
2. Click **I understand my workflows, go ahead and enable them**
3. In the left sidebar, click **Daily Cidercade**, then click **Enable workflow**
4. Do the same for **Keep GitHub Actions alive**

### Step 7: Run it once to test

1. Still on the **Actions** tab, select **Daily Cidercade** in the left sidebar
2. Click **Run workflow** → **Run workflow**
3. Wait for the run to finish

If there is a green check, then the script succeeded.
Check Discord for the summary embed (if you set up a webhook).

### That’s it

After this, **Daily Cidercade** runs automatically every day. You only need to refresh `TOKEN` when it expires (about once a month).

---

## Troubleshooting


| Problem                                | What to try                                                               |
| -------------------------------------- | ------------------------------------------------------------------------- |
| Auth / 401 errors                      | Refresh your `TOKEN` secret with a new value from the browser             |
| No Discord message                     | Confirm `DISCORD_WEBHOOK_URL` is set, or check the Actions log            |
| Scheduled runs stopped after ~2 months | Confirm **Read and write permissions** (Step 5) so keep-alive can work    |


> Free-tier scheduled workflows can be a few minutes late. That is normal.

---

## Running locally

Only needed if you want to develop or run the script on your own machine.

### Requirements

- [Bun](https://bun.sh)
- A [Cidercade Rewards](https://rewards.cidercade.com) account
- (Optional) A Discord server where you can create a webhook

### Setup

```bash
git clone https://github.com/dylan-dang/cidercade-completer.git
cd cidercade-clent
bun install
```

Create a `.env` file in the project root or set up environment variables from within your shell:

```env
TOKEN=your_api_token
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
```

Then run:

```bash
bun start
```


| Command                           | Description                                  |
| --------------------------------- | -------------------------------------------- |
| `bun start`                       | Run all daily tasks                          |
| `bun run test:wotd-solver <word>` | Test the Wordle solver against a target word |


From there, you can set up a cron job (on Unix-like systems) or use Windows Task Scheduler to automate running the script at your preferred intervals.

For example, with a cron job you might add:
```cron
0 8 * * * cd /path/to/cidercade-completer && bun start
```
Or on Windows, you can create a scheduled task to run `bun start` daily at a specific time.

---

## Disclaimer

This is an unofficial automation tool. Use at your own risk and in line with Cidercade's terms of service.