import type { CandyBlastGame } from "./candy-blast";
import type { WOTDResponse } from "./wotd";

const DISCORD_USERNAME = "Cidercade";
const DISCORD_AVATAR_URL =
  "https://play-lh.googleusercontent.com/R_OXYCUKoLu2iNUeIrHYxPP6aajlXR5K1icPAWt_cunCJXcPHZzl6TXO2Uu6UEQrQ5jFUkC1lDaCicvEmu64=w240-h480";

const COLOR_SUCCESS = 0x57f287;
const COLOR_FAILURE = 0xed4245;
const COLOR_PARTIAL = 0xfee75c;

export type TaskOutcome<T> = {
  name: string;
  ok: boolean;
  durationMs: number;
  data?: T;
  error?: string;
};

function formatDuration(durationMs: number) {
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function formatWotdGuesses(wotd: WOTDResponse) {
  const lines = wotd.attempts
    .filter((attempt) => attempt.letter_deltas !== null)
    .map((attempt) => {
      const deltas = attempt.letter_deltas ?? [];
      const guess = deltas.map((delta) => delta.provided.toUpperCase()).join("");
      const tiles = deltas
        .map((delta) =>
          delta.position_correct ? "🟩" : delta.found_in_word ? "🟨" : "⬛",
        )
        .join("");
      return `${tiles} ${guess}`;
    });

  return lines.length > 0 ? lines.join("\n") : "_No guesses recorded_";
}

function isWotdSuccess(outcome: TaskOutcome<WOTDResponse>) {
  return outcome.ok && outcome.data?.solved === true;
}

function isCandyBlastSuccess(outcome: TaskOutcome<CandyBlastGame>) {
  return outcome.ok;
}

function getWotdFieldValue(outcome: TaskOutcome<WOTDResponse>) {
  if (!outcome.ok) {
    return `❌ ${outcome.error ?? "Failed"}`;
  }

  if (outcome.data?.solved) {
    return "✅";
  }

  return "❌ Failed to solve";
}

function buildDescription(
  wotd: TaskOutcome<WOTDResponse>,
  allSucceeded: boolean,
  wotdSuccess: boolean,
  candyBlastSuccess: boolean,
  lootSummary = "",
) {
  const status = allSucceeded
    ? "All tasks completed"
    : wotdSuccess || candyBlastSuccess
      ? "Completed with errors"
      : "All tasks failed";

  const parts = [status];

  if (wotd.ok && wotd.data) {
    parts.push("", formatWotdGuesses(wotd.data));
  }

  if (lootSummary) {
    parts.push(lootSummary);
  }

  return parts.join("\n");
}

function buildSummaryEmbed(
  wotd: TaskOutcome<WOTDResponse>,
  candyBlast: TaskOutcome<CandyBlastGame>,
  lootSummary = "",
) {
  const wotdSuccess = isWotdSuccess(wotd);
  const candyBlastSuccess = isCandyBlastSuccess(candyBlast);
  const allSucceeded = wotdSuccess && candyBlastSuccess;

  return {
    title: "Cidercade Daily Run",
    description: buildDescription(
      wotd,
      allSucceeded,
      wotdSuccess,
      candyBlastSuccess,
      lootSummary,
    ),
    color: allSucceeded
      ? COLOR_SUCCESS
      : wotdSuccess || candyBlastSuccess
        ? COLOR_PARTIAL
        : COLOR_FAILURE,
    fields: [
      {
        name: "Word of the Day",
        value: `${getWotdFieldValue(wotd)} (${formatDuration(wotd.durationMs)})`,
        inline: true,
      },
      {
        name: "Candy Blast",
        value: `${candyBlastSuccess ? "✅" : `❌ ${candyBlast.error ?? "Failed"}`} (${formatDuration(candyBlast.durationMs)})`,
        inline: true,
      },
    ],
  };
}

export async function postRunSummary(
  wotd: TaskOutcome<WOTDResponse>,
  candyBlast: TaskOutcome<CandyBlastGame>,
  lootSummary = "",
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn("DISCORD_WEBHOOK_URL is not set; skipping Discord notification");
    return;
  }

  const payload = {
    username: DISCORD_USERNAME,
    avatar_url: DISCORD_AVATAR_URL,
    embeds: [buildSummaryEmbed(wotd, candyBlast, lootSummary)],
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord webhook failed (${res.status}): ${body}`);
  }
}
