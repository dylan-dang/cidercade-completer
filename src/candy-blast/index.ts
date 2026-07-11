import { getEndUsers } from "..";
import { type GameResult, markAlreadyCompleted } from "../discord";
import {
  DEFAULT_PROJECT_ID,
  DEFAULT_VALIDATOR_ID,
  postGame,
} from "./validator";

export type CandyBlastResponse = {
  game: {
    url: string;
    prize: string;
    prize_description: string;
    prize_image: string;
    period: string;
    levels: Array<{
      level: number;
      completed: boolean;
      game_results?: {
        won: boolean;
        score: number;
        time_spent: number;
      };
      level_number_displayed: number;
    }>;
    game_name_logo: string;
    splash_screen_background_image: string;
    game_name: string;
    next_start_at: number;
    completed: boolean;
    won: boolean;
  };
};

export type CandyBlastGame = CandyBlastResponse["game"];

async function fetchCandyBlast(): Promise<CandyBlastGame> {
  const response = await getEndUsers<CandyBlastResponse>(
    "market-js-games/candy-blast",
  );

  if (!response.game) {
    throw new Error("Candy Blast response did not include game data");
  }

  return response.game;
}

const POLL_INTERVAL_MS = 1000;
const POLL_TIMEOUT_MS = 60_000;

async function pollNewCandyBlastUrl(previousUrl: string) {
  const startedAt = Date.now();
  let game = await fetchCandyBlast();

  while (!game.completed && game.url === previousUrl) {
    if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
      throw new Error(
        `Timed out waiting for new Candy Blast URL after ${POLL_TIMEOUT_MS / 1000}s`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    game = await fetchCandyBlast();
  }

  return game;
}

export async function completeLevels(): Promise<GameResult<CandyBlastGame>> {
  let game = await fetchCandyBlast();

  if (game.completed) {
    return markAlreadyCompleted(game);
  }

  while (!game.completed) {
    const url = new URL(game.url);

    const token = url.searchParams.get("token") ?? "";
    const game_id = url.searchParams.get("game_id") ?? "";
    const brand_id = url.searchParams.get("brand_id") ?? "";
    const campaign_id = url.searchParams.get("campaign_id") ?? "";
    const level_number = url.searchParams.get("level_number") ?? "";

    const { access_token } = await postGame("start", {
      project_id: DEFAULT_PROJECT_ID,
      validator_id: DEFAULT_VALIDATOR_ID,
      brand_id,
      campaign_id,
      tournament_id: campaign_id,
      game_id,
      level_number,
      token,
      level: 1,
      custom_payload_01: token,
      custom_payload_02: brand_id,
      custom_payload_03: 0 as unknown as string,
      custom_payload_04: level_number,
      custom_payload_05: false,
      env: "null",
    });

    // simulate game results
    const score = getRandomScore(5000, 25000);
    const game_time = Math.floor(Math.random() * 10_000);
    const time_spent_in_mins = new Date(game_time).toLocaleTimeString("en-US", {
      minute: "2-digit",
      second: "2-digit",
    });

    await postGame(
      "end",
      {
        level_number: 1,
        token,
        game_id,
        tournament_id: campaign_id,
        brand_id,
        campaign_id,
        score,
        time_spent_in_mins,
        game_time,
        win: 1,
        user_score: score,
        user_action: "[]",
        level: 1,
        custom_payload_01: token,
        custom_payload_02: brand_id,
        custom_payload_03: time_spent_in_mins,
        custom_payload_04: level_number,
        custom_payload_05: 1,
      },
      access_token,
    );

    game = await pollNewCandyBlastUrl(game.url);
  }

  return game;
}

/**
 * Returns a random number >= min and <= max, ending with 0 or 5
 */
function getRandomScore(min: number, max: number): number {
  const interval = 5;
  const count = Math.floor((max - min) / interval) + 1;
  const n = Math.floor(Math.random() * count);
  return min + n * interval;
}
