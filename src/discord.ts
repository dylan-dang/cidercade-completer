import type { CandyBlastGame } from "./candy-blast";
import {
  formatLootRewardSummary,
  type LootBoxRewardResponse,
} from "./loot-box";
import type { WOTDResponse } from "./wotd";

const DISCORD_USERNAME = "Cidercade";
const DISCORD_AVATAR_URL =
  "https://play-lh.googleusercontent.com/R_OXYCUKoLu2iNUeIrHYxPP6aajlXR5K1icPAWt_cunCJXcPHZzl6TXO2Uu6UEQrQ5jFUkC1lDaCicvEmu64=w240-h480";

const COLOR_SUCCESS = 0x57f287;
const COLOR_FAILURE = 0xed4245;
const COLOR_PARTIAL = 0xfee75c;

export type GameResult<T> = T & {
  alreadyCompleted?: boolean;
};

export function markAlreadyCompleted<T>(value: T): GameResult<T> {
  return { ...value, alreadyCompleted: true };
}

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
      const guess = deltas
        .map((delta) => delta.provided.toUpperCase())
        .join("");
      const tiles = deltas
        .map((delta) =>
          delta.position_correct ? "🟩" : delta.found_in_word ? "🟨" : "⬛",
        )
        .join("");
      return `${tiles} ${guess}`;
    });

  return lines.length > 0 ? lines.join("\n") : "_No guesses recorded_";
}

function isGameSuccess<T>(
  outcome: TaskOutcome<GameResult<T>>,
  isSuccessful: (data: GameResult<T>) => boolean = () => true,
) {
  return outcome.ok && outcome.data !== undefined && isSuccessful(outcome.data);
}

function getGameFieldValue<T>(
  outcome: TaskOutcome<GameResult<T>>,
  isSuccessful: (data: GameResult<T>) => boolean = () => true,
  failureMessage = "Failed",
) {
  if (!outcome.ok) {
    return `❌ ${outcome.error ?? "Failed"}`;
  }

  if (outcome.data?.alreadyCompleted) {
    return "♻️";
  }

  if (outcome.data && isSuccessful(outcome.data)) {
    return "✅";
  }

  return `❌ ${failureMessage}`;
}

function buildDescription(
  wotd: TaskOutcome<GameResult<WOTDResponse>>,
  wotdSuccess: boolean,
  candyBlastSuccess: boolean,
  lootBoxes: TaskOutcome<LootBoxRewardResponse[]>,
) {
  const status =
    wotdSuccess && candyBlastSuccess
      ? "All tasks completed"
      : wotdSuccess || candyBlastSuccess
        ? "Completed with errors"
        : "All tasks failed";

  const parts = [status];

  if (wotd.ok && wotd.data) {
    parts.push("", formatWotdGuesses(wotd.data));
  }

  if (lootBoxes.ok && lootBoxes.data) {
    const lootSummary = formatLootRewardSummary(lootBoxes.data);
    if (lootSummary) {
      parts.push(lootSummary);
    }
  }

  return parts.join("\n");
}

function buildSummaryEmbed(
  wotd: TaskOutcome<GameResult<WOTDResponse>>,
  candyBlast: TaskOutcome<GameResult<CandyBlastGame>>,
  lootBoxes: TaskOutcome<LootBoxRewardResponse[]>,
) {
  const wotdSuccess = isGameSuccess(wotd, (data) => data.solved === true);
  const candyBlastSuccess = isGameSuccess(candyBlast);

  return {
    title: "Cidercade Daily Run",
    description: buildDescription(
      wotd,
      wotdSuccess,
      candyBlastSuccess,
      lootBoxes,
    ),
    color:
      wotdSuccess && candyBlastSuccess
        ? COLOR_SUCCESS
        : wotdSuccess || candyBlastSuccess
          ? COLOR_PARTIAL
          : COLOR_FAILURE,
    fields: [
      {
        name: "Word of the Day",
        value: `${getGameFieldValue(wotd, (data) => data.solved === true, "Failed to solve")} (${formatDuration(wotd.durationMs)})`,
        inline: true,
      },
      {
        name: "Candy Blast",
        value: `${getGameFieldValue(candyBlast)} (${formatDuration(candyBlast.durationMs)})`,
        inline: true,
      },
    ],
  };
}

export async function postRunSummary(
  wotd: TaskOutcome<GameResult<WOTDResponse>>,
  candyBlast: TaskOutcome<GameResult<CandyBlastGame>>,
  lootBoxes: TaskOutcome<LootBoxRewardResponse[]>,
) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn(
      "DISCORD_WEBHOOK_URL is not set; skipping Discord notification",
    );
    return;
  }

  const payload = {
    username: DISCORD_USERNAME,
    avatar_url: DISCORD_AVATAR_URL,
    embeds: [buildSummaryEmbed(wotd, candyBlast, lootBoxes)],
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
