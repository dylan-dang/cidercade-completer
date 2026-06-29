import type { WOTDAttempt } from "..";
import { filterRemainingWords, selectGuessCandidates } from "./filter";
import { calculateEntropy, precomputeCodes, wordToCodes } from "./pattern";
import { ALL_WORDS, WORDLE_ANSWERS, WORDLE_ANSWERS_SET } from "./words";

const PATTERN_COUNTS = new Int32Array(243);

function getSolutionPool(matched: readonly string[]): string[] {
  const answers = matched.filter((word) => WORDLE_ANSWERS_SET.has(word));
  return answers.length > 0 ? answers : [...matched];
}

export function getBestGuess(
  attempts: WOTDAttempt[],
  options?: { maxWordsToScore?: number; wordList?: readonly string[] },
): string | null {
  const wordList = options?.wordList ?? ALL_WORDS;
  const maxWordsToScore = options?.maxWordsToScore ?? 300;

  // optimization
  if (
    attempts.length === 0 ||
    attempts.every((attempt) => attempt.letter_deltas === null)
  ) {
    return "TARSE";
  }

  const matched = filterRemainingWords(attempts, wordList);

  if (matched.length === 0) {
    return null;
  }

  if (matched.length === 1) {
    const guess = matched[0];
    return guess?.toUpperCase() ?? null;
  }

  const solutions = getSolutionPool(matched);
  const wordsToScore = selectGuessCandidates(
    matched,
    solutions,
    WORDLE_ANSWERS_SET,
    maxWordsToScore,
  );
  const solutionCodesList = precomputeCodes(solutions);
  const matchedSet = new Set(solutions);

  let bestGuess: string | null = null;
  let bestEntropy = -Infinity;
  let bestExpectedRemaining = Infinity;
  let bestIsSolution = false;

  for (const guess of wordsToScore) {
    const guessCodes = wordToCodes(guess);
    const result = calculateEntropy(
      guessCodes,
      solutionCodesList,
      PATTERN_COUNTS,
    );
    const isValidSolution = matchedSet.has(guess);

    if (bestGuess === null || result.entropy > bestEntropy + 1e-9) {
      bestGuess = guess;
      bestEntropy = result.entropy;
      bestExpectedRemaining = result.expectedRemaining;
      bestIsSolution = isValidSolution;
      continue;
    }

    if (Math.abs(result.entropy - bestEntropy) <= 1e-9) {
      if (isValidSolution !== bestIsSolution) {
        if (isValidSolution) {
          bestGuess = guess;
          bestEntropy = result.entropy;
          bestExpectedRemaining = result.expectedRemaining;
          bestIsSolution = isValidSolution;
        }
        continue;
      }
      if (result.expectedRemaining < bestExpectedRemaining) {
        bestGuess = guess;
        bestEntropy = result.entropy;
        bestExpectedRemaining = result.expectedRemaining;
        bestIsSolution = isValidSolution;
      }
    }
  }

  return bestGuess?.toUpperCase() ?? null;
}

export { ALL_WORDS, WORDLE_ANSWERS };
