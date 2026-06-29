import type { CandyBlastGame } from "./candy-blast";
import type { TaskOutcome } from "./discord";
import type { WOTDResponse } from "./wotd";

const ADMISSION_PIECES_REQUIRED = 4;

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

function isWotdCompleted(outcome: TaskOutcome<WOTDResponse>) {
  return outcome.ok && outcome.data?.solved === true;
}

function isCandyBlastCompleted(outcome: TaskOutcome<CandyBlastGame>) {
  return outcome.ok;
}

export function countCompletedTasks(
  wotd: TaskOutcome<WOTDResponse>,
  candyBlast: TaskOutcome<CandyBlastGame>,
) {
  let count = 0;
  if (isWotdCompleted(wotd)) count++;
  if (isCandyBlastCompleted(candyBlast)) count++;
  return count;
}

function isLootBoxUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Allocated loot box not found or already redeemed");
}

export async function openLootBoxes(
  count: number,
  open: () => Promise<LootBoxRewardResponse>,
) {
  const outcomes: LootBoxRewardResponse[] = [];

  for (let i = 0; i < count; i++) {
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

function isAdmissionPuzzle(name: string) {
  return name.toLowerCase().includes("admission");
}

function groupEarnedPieces(outcomes: LootBoxRewardResponse[]) {
  const counts = new Map<string, number>();

  for (const outcome of outcomes) {
    const label = getPieceLabel(outcome.loot_box_reward_outcome);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return counts;
}

function getAdmissionProgress(outcomes: LootBoxRewardResponse[]) {
  const puzzle = [...outcomes]
    .reverse()
    .map((outcome) => outcome.loot_box_reward_outcome.reward.puzzle)
    .find((candidate) => candidate && isAdmissionPuzzle(candidate.name));

  if (!puzzle) return null;

  const completedPieces = puzzle.pieces.filter(
    (piece) => piece.is_complete,
  ).length;
  const totalPieces = puzzle.pieces.length || ADMISSION_PIECES_REQUIRED;
  const remaining = Math.max(totalPieces - completedPieces, 0);

  if (remaining === 0) {
    return null;
  }

  return `${remaining} more admission piece${remaining === 1 ? "" : "s"} needed (${completedPieces}/${totalPieces})`;
}

function getNewlyCompletedPuzzles(outcomes: LootBoxRewardResponse[]) {
  const puzzles = new Map<string, Puzzle>();

  for (const outcome of outcomes) {
    const puzzle = outcome.loot_box_reward_outcome.reward.puzzle;
    if (puzzle) {
      puzzles.set(puzzle.id, puzzle);
    }
  }

  const completed: string[] = [];

  for (const puzzle of puzzles.values()) {
    const totalPieces = puzzle.pieces.length;
    const completedPieces = puzzle.pieces.filter(
      (piece) => piece.is_complete,
    ).length;
    const earnedThisRun = outcomes.filter(
      (outcome) =>
        outcome.loot_box_reward_outcome.reward.puzzle?.id === puzzle.id,
    ).length;

    if (
      totalPieces > 0 &&
      completedPieces === totalPieces &&
      earnedThisRun > 0 &&
      completedPieces - earnedThisRun < totalPieces
    ) {
      completed.push(puzzle.name);
    }
  }

  return completed;
}

export function formatLootRewardSummary(outcomes: LootBoxRewardResponse[]) {
  if (outcomes.length === 0) {
    return "";
  }

  const lines = ["", "**You earned**"];
  const earnedPieces = groupEarnedPieces(outcomes);

  for (const [label, count] of earnedPieces) {
    const prefix = count > 1 ? `${count}x ` : "";
    lines.push(`- ${prefix}${label} 🧩`);
  }

  const admissionProgress = getAdmissionProgress(outcomes);
  if (admissionProgress) {
    lines.push("", admissionProgress);
  }

  for (const puzzleName of getNewlyCompletedPuzzles(outcomes)) {
    lines.push("", `🎉 **${puzzleName} puzzle complete!**`);
  }

  return lines.join("\n");
}
