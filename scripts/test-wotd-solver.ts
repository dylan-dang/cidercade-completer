import assert from "node:assert";

import type { LetterDelta, WOTDAttempt } from "../src/wotd";
import { getBestGuess } from "../src/wotd/solver";

const MAX_GUESSES = 6;

function getSolutionFromArg(): string {
  const solution = process.argv[2]?.toLowerCase();
  assert(solution, "expected a target word argument");
  assert(/^[a-z]{5}$/.test(solution), "target word must be exactly 5 letters");
  return solution;
}

function buildLetterDeltas(guess: string, solution: string): LetterDelta[] {
  const normalizedGuess = guess.toLowerCase();
  const normalizedSolution = solution.toLowerCase();
  const deltas: LetterDelta[] = normalizedGuess.split("").map((provided) => ({
    provided,
    found_in_word: false,
    position_correct: false,
  }));
  const remainingLetters = normalizedSolution.split("");

  for (let i = 0; i < normalizedGuess.length; i++) {
    if (normalizedGuess[i] === normalizedSolution[i]) {
      const delta = deltas[i];
      if (!delta) continue;

      delta.position_correct = true;
      delta.found_in_word = true;
      remainingLetters[i] = "";
    }
  }

  for (let i = 0; i < normalizedGuess.length; i++) {
    const delta = deltas[i];
    const letter = normalizedGuess[i];
    if (!delta || !letter || delta.position_correct) continue;

    const matchIndex = remainingLetters.indexOf(letter);
    if (matchIndex !== -1) {
      delta.found_in_word = true;
      remainingLetters[matchIndex] = "";
    }
  }

  return deltas;
}

function buildAttempt(guess: string, solution: string): WOTDAttempt {
  return {
    locked: false,
    letter_deltas: buildLetterDeltas(guess, solution),
  };
}

function runSolverTest(solution: string) {
  const attempts: WOTDAttempt[] = [];
  const guesses: string[] = [];

  while (guesses.length < MAX_GUESSES) {
    const guess = getBestGuess(attempts);
    assert(guess, "solver returned no guess");

    guesses.push(guess);
    attempts.push(buildAttempt(guess, solution));

    if (guess.toLowerCase() === solution) {
      console.log(
        `Solved ${solution.toUpperCase()} in ${guesses.length} guesses`,
      );
      console.log(
        guesses
          .map((word, index) => `${index + 1}. ${word.toUpperCase()}`)
          .join("\n"),
      );
      return;
    }
  }

  throw new Error(
    `Solver did not find ${solution.toUpperCase()} within ${MAX_GUESSES} guesses: ${guesses.join(", ")}`,
  );
}

runSolverTest(getSolutionFromArg());
