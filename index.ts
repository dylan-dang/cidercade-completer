import assert from "node:assert";

import {
  findHighestEntropyGuess,
  getAvailableWordsFromMultipleFeedbacks,
  LetterState,
  type GuessFeedback,
  type GuessWithFeedback,
} from "@gueripep/wordle-solver";

const Authorization = `Token ${process.env.TOKEN}`;

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  "Content-Type": "application/json",
  "X-Brand-Host": "rewards.cidercade.com",
  Authorization,
  "X-Brand-Subdomain": "",
};

type WOTDResponse = {
  solved: boolean;
  next_start_at: number;
  attempts: Array<{
    locked: boolean;
    letter_deltas: Array<{
      provided: string;
      found_in_word: boolean;
      position_correct: boolean;
    }> | null;
  }>;
  period: string;
};

const BASE_URL = "https://loyalty-api.hang.com/api/v2/end-users/";

async function postEndUsers(path: string, body?: unknown) {
  const url = new URL(path, BASE_URL).toString();
  return fetch(url, {
    credentials: "include",
    headers,
    method: "POST",
    mode: "cors",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

async function solveWOTD() {
  const wotd = await postEndUsers("wotd");

  const wotdData: WOTDResponse = (await wotd.json()) as WOTDResponse;
  if (wotdData.solved) return;

  if (wotdData.attempts.some((attempt) => attempt.locked)) {
    await postEndUsers("wotd/check-in", { lat: 30.252545, lng: -97.74123199 });
  }

  let history: GuessWithFeedback[] = buildHistory(wotdData);

  while (history.length < 5) {
    const attempt = await postEndUsers("wotd/attempt", {
      guess: makeGuess(history),
    });
    history = buildHistory((await attempt.json()) as WOTDResponse);
  }
}

function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

function buildHistory(wotdData: WOTDResponse) {
  return wotdData.attempts
    .map((attempt) => attempt.letter_deltas)
    .filter(nonNullable)
    .map((deltas) => ({
      guess: deltas.map((delta) => delta.provided).join(""),
      feedback: deltas.map((delta) => ({
        letter: delta.provided,
        state: delta.position_correct
          ? LetterState.CORRECT
          : delta.found_in_word
            ? LetterState.PRESENT
            : LetterState.ABSENT,
      })) as GuessFeedback,
    }));
}

function makeGuess(history: GuessWithFeedback[]) {
  if (history.length === 0) {
    return "TARSE";
  }
  const availableWords = getAvailableWordsFromMultipleFeedbacks(history);
  if (availableWords.length === 1) {
    assert(availableWords[0]);
    return availableWords[0].toUpperCase();
  }
  return findHighestEntropyGuess(availableWords).guess.toUpperCase();
}

solveWOTD();
