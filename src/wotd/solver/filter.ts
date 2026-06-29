import type { WOTDAttempt } from "..";
import {
  attemptToGuess,
  deltasToPattern,
  getPatternFast,
  wordToCodes,
} from "./pattern";
import { ALL_WORDS } from "./words";

export function getCompletedAttempts(
  attempts: WOTDAttempt[],
): Array<{ guess: string; pattern: number }> {
  const completed: Array<{ guess: string; pattern: number }> = [];

  for (const attempt of attempts) {
    const guess = attemptToGuess(attempt);
    if (!guess || !attempt.letter_deltas) continue;
    completed.push({
      guess,
      pattern: deltasToPattern(attempt.letter_deltas),
    });
  }

  return completed;
}

export function filterWordsByAttempts(
  words: readonly string[],
  attempts: WOTDAttempt[],
): string[] {
  const completed = getCompletedAttempts(attempts);
  if (completed.length === 0) {
    return [...words];
  }

  return words.filter((word) => {
    const solutionCodes = wordToCodes(word);

    return completed.every(({ guess, pattern }) => {
      const guessCodes = wordToCodes(guess);
      return getPatternFast(guessCodes, solutionCodes) === pattern;
    });
  });
}

export function filterRemainingWords(
  attempts: WOTDAttempt[],
  wordList: readonly string[] = ALL_WORDS,
): string[] {
  return filterWordsByAttempts(wordList, attempts);
}

function addLetterFrequencyScore(
  matched: readonly string[],
): Array<[string, number]> {
  const letterStats: Record<string, number> = {};

  for (const word of matched) {
    const seen = new Set<string>();
    for (const letter of word) {
      if (!seen.has(letter)) {
        seen.add(letter);
        letterStats[letter] = (letterStats[letter] ?? 0) + 1;
      }
      letterStats[letter] = (letterStats[letter] ?? 0) + 1;
    }
  }

  const scores = matched.map((word) => {
    let score = 0;
    const seen = new Set<string>();
    for (const letter of word) {
      if (!seen.has(letter)) {
        seen.add(letter);
        score += letterStats[letter] ?? 0;
      }
      score += letterStats[letter] ?? 0;
    }
    return [word, score] as [string, number];
  });

  scores.sort((a, b) => b[1] - a[1]);
  return scores;
}

export function selectGuessCandidates(
  matched: readonly string[],
  solutions: readonly string[],
  wordleAnswers: ReadonlySet<string>,
  maxWordsToScore = 300,
): string[] {
  if (matched.length <= 1) {
    const onlyMatch = matched[0];
    return onlyMatch ? [onlyMatch] : [];
  }

  const answersInPool = solutions.filter((word) => wordleAnswers.has(word));

  if (answersInPool.length > 0 && answersInPool.length <= maxWordsToScore) {
    const wordsToScore = Array.from(wordleAnswers);
    for (const word of solutions) {
      if (!wordleAnswers.has(word)) {
        wordsToScore.push(word);
      }
    }
    return wordsToScore;
  }

  if (matched.length > maxWordsToScore) {
    return addLetterFrequencyScore(matched)
      .slice(0, maxWordsToScore)
      .map(([word]) => word);
  }

  return [...matched];
}
