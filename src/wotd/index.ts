import { postEndUsers } from "..";
import { getBestGuess } from "./solver";

export type LetterDelta = {
  provided: string;
  found_in_word: boolean;
  position_correct: boolean;
};

export type WOTDAttempt = {
  locked: boolean;
  letter_deltas: LetterDelta[] | null;
};

export type WOTDResponse = {
  solved: boolean;
  next_start_at: number;
  attempts: WOTDAttempt[];
  period: string;
};

export async function solve() {
  let wotd = await postEndUsers<WOTDResponse>("wotd");

  // check in if attempts are locked
  if (wotd.attempts.some((attempt) => attempt.locked)) {
    await postEndUsers("wotd/check-in", { lat: 30.252545, lng: -97.74123199 });
  }

  while (
    !wotd.solved &&
    wotd.attempts.some((attempt) => attempt.letter_deltas === null)
  ) {
    wotd = await postEndUsers<WOTDResponse>("wotd/attempt", {
      guess: getBestGuess(wotd.attempts),
    });
  }

  return wotd;
}
