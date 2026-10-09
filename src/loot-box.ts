import { postEndUsers } from ".";
import {
  type AdmissionPieceState,
  PIECES_PER_ADMISSION,
  readUnsetAdmissionBase,
  updateAdmissionPieces,
} from "./admission-tracker";
import { formatError, type Task } from "./task";

const LOOT_BOX_PATH = "loot-boxes/3a623991-6a4e-448e-9a11-40cc53e3b9fb/open";
/** Loot boxes earned by earlier tasks take a moment to become redeemable. */
const LOOT_BOX_SETTLE_DELAY_MS = 1500;

type PuzzlePiece = {
  reward_id: number;
  slot: number;
  is_complete: boolean;
};

type Puzzle = {
  id: string;
  name: string;
  description: string;
  pieces: PuzzlePiece[];
  earn_instructions: string;
  image_url: string;
  rewards: unknown[];
  loot_boxes: unknown[];
  status: string;
  archived_at: string | number | null;
  published_at: string;
};

type Reward = {
  id: number;
  uuid: string;
  name: string;
  puzzle: Puzzle;
};

type LootBoxRewardChoice = {
  id: string;
  title: string;
  subtitle: string;
};

export type LootBoxRewardOutcome = {
  allocated_loot_box_id: string;
  loot_box_reward_choice: LootBoxRewardChoice;
  reward: Reward;
  rewards: Reward[];
};

export type LootBoxRewardResponse = {
  loot_box_reward_outcome: LootBoxRewardOutcome;
  rewards: Reward[];
};

type LootBoxResult = {
  outcomes: LootBoxRewardResponse[];
  admissionPieces?: AdmissionPieceState | { error: string };
};

function isLootBoxUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Allocated loot box not found or already redeemed");
}

export async function redeemAllLootBoxes(
  open: () => Promise<LootBoxRewardResponse>,
) {
  const outcomes: LootBoxRewardResponse[] = [];

  while (true) {
    try {
      outcomes.push(await open());
    } catch (error) {
      if (isLootBoxUnavailable(error)) {
        break;
      }

      throw error;
    }
  }

  return outcomes;
}

function getPieceLabel(outcome: LootBoxRewardOutcome) {
  return (
    outcome.reward.puzzle?.name ??
    outcome.reward.name ??
    outcome.loot_box_reward_choice.title
  );
}

function groupEarnedPieces(outcomes: LootBoxRewardResponse[]) {
  const counts = new Map<string, number>();

  for (const outcome of outcomes) {
    const label = getPieceLabel(outcome.loot_box_reward_outcome);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return counts;
}

function isAdmissionPiece(outcome: LootBoxRewardResponse) {
  return /admission/i.test(getPieceLabel(outcome.loot_box_reward_outcome));
}

function formatAdmissionPieces(
  state: NonNullable<LootBoxResult["admissionPieces"]>,
) {
  if ("error" in state) {
    return `⚠️ Could not update admission piece count: ${state.error}`;
  }

  const admissions = Math.floor(state.count / PIECES_PER_ADMISSION);
  return [
    `You have **${state.count}** admission puzzle ${pluralize(state.count, "piece")} (**${admissions}** ${pluralize(admissions, "admission")})`,
    `**${state.totalEarned}** ${pluralize(state.totalEarned, "piece")} earned in total since tracking started`,
  ].join("\n");
}

function pluralize(count: number, word: string) {
  return count === 1 ? word : `${word}s`;
}

function formatEarnedPieces(outcomes: LootBoxRewardResponse[]) {
  const lines = ["**You earned**"];
  for (const [label, count] of groupEarnedPieces(outcomes)) {
    const prefix = count > 1 ? `${count}x ` : "";
    lines.push(`- ${prefix}${label} 🧩`);
  }
  return lines.join("\n");
}

function formatLootRewardSummary({ outcomes, admissionPieces }: LootBoxResult) {
  const sections: string[] = [];

  if (outcomes.length > 0) {
    sections.push(formatEarnedPieces(outcomes));
  }

  if (admissionPieces) {
    sections.push(formatAdmissionPieces(admissionPieces));
  }

  return sections.length > 0 ? sections.join("\n\n") : undefined;
}

async function trackAdmissionPieces(
  outcomes: LootBoxRewardResponse[],
  unsetBase: number,
) {
  try {
    return await updateAdmissionPieces(
      outcomes.filter(isAdmissionPiece).length,
      unsetBase,
    );
  } catch (error) {
    const message = formatError(error);
    console.error(`[Admission pieces] ${message}`);
    return { error: message };
  }
}

export const lootBoxTask: Task<LootBoxResult> = {
  name: "Loot Boxes",
  async run() {
    await Bun.sleep(LOOT_BOX_SETTLE_DELAY_MS);
    let unsetBase = 0;
    try {
      unsetBase = await readUnsetAdmissionBase();
    } catch (error) {
      console.error(`[Admission pieces] ${formatError(error)}`);
    }
    const outcomes = await redeemAllLootBoxes(() =>
      postEndUsers<LootBoxRewardResponse>(LOOT_BOX_PATH),
    );
    return {
      outcomes,
      admissionPieces: await trackAdmissionPieces(outcomes, unsetBase),
    };
  },
  formatSummary: formatLootRewardSummary,
};
