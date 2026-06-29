import type { LetterDelta, WOTDAttempt } from "..";

const PATTERN_MULTIPLIERS = [81, 27, 9, 3, 1] as const;
type WordCodes = readonly [number, number, number, number, number];
type PatternPositions = readonly [number, number, number, number, number];

function encodePattern(positions: PatternPositions): number {
  return (
    positions[0] * PATTERN_MULTIPLIERS[0] +
    positions[1] * PATTERN_MULTIPLIERS[1] +
    positions[2] * PATTERN_MULTIPLIERS[2] +
    positions[3] * PATTERN_MULTIPLIERS[3] +
    positions[4] * PATTERN_MULTIPLIERS[4]
  );
}

export function wordToCodes(
  word: string,
): [number, number, number, number, number] {
  return [
    word.charCodeAt(0),
    word.charCodeAt(1),
    word.charCodeAt(2),
    word.charCodeAt(3),
    word.charCodeAt(4),
  ];
}

export function getPatternFast(
  guessCodes: WordCodes,
  solutionCodes: WordCodes,
): number {
  let used = 0;
  const positions: [number, number, number, number, number] = [0, 0, 0, 0, 0];

  for (let i = 0; i < 5; i++) {
    if (guessCodes[i] === solutionCodes[i]) {
      positions[i] = 2;
      used |= 1 << i;
    }
  }

  for (let i = 0; i < 5; i++) {
    if (positions[i] !== 0) continue;
    const g = guessCodes[i];
    for (let j = 0; j < 5; j++) {
      if (!(used & (1 << j)) && g === solutionCodes[j]) {
        positions[i] = 1;
        used |= 1 << j;
        break;
      }
    }
  }

  return encodePattern(positions);
}

export function deltasToPattern(deltas: LetterDelta[]): number {
  const positions: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  for (let i = 0; i < 5; i++) {
    const delta = deltas[i];
    if (!delta) continue;
    positions[i] = delta.position_correct ? 2 : delta.found_in_word ? 1 : 0;
  }

  return encodePattern(positions);
}

export function attemptToGuess(attempt: WOTDAttempt): string | null {
  if (attempt.letter_deltas?.length !== 5) {
    return null;
  }

  const guess = attempt.letter_deltas
    .map((delta) => delta.provided.toLowerCase())
    .join("");
  return /^[a-z]{5}$/.test(guess) ? guess : null;
}

export function precomputeCodes(
  words: readonly string[],
): Array<[number, number, number, number, number]> {
  return words.map(wordToCodes);
}

export function calculateEntropy(
  guessCodes: WordCodes,
  solutionCodesList: ReadonlyArray<WordCodes>,
  patternCounts: Int32Array,
): { entropy: number; expectedRemaining: number; uniquePatterns: number } {
  patternCounts.fill(0);

  const numSolutions = solutionCodesList.length;
  let uniquePatterns = 0;

  for (let i = 0; i < numSolutions; i++) {
    const solutionCodes = solutionCodesList[i];
    if (!solutionCodes) continue;

    const pattern = getPatternFast(guessCodes, solutionCodes);
    if (patternCounts[pattern] === 0) {
      uniquePatterns++;
    }
    patternCounts[pattern] = (patternCounts[pattern] ?? 0) + 1;
  }

  let entropy = 0;
  let expectedRemaining = 0;

  for (let p = 0; p < 243; p++) {
    const count = patternCounts[p] ?? 0;
    if (count > 0) {
      const probability = count / numSolutions;
      entropy -= probability * Math.log2(probability);
      expectedRemaining += probability * count;
    }
  }

  return { entropy, expectedRemaining, uniquePatterns };
}
