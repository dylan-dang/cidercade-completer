import { completeLevels } from "./candy-blast";
import { postRunSummary, type TaskOutcome } from "./discord";
import { type LootBoxRewardResponse, redeemAllLootBoxes } from "./loot-box";
import { solveWOTD } from "./wotd";

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

const BASE_URL = "https://loyalty-api.hang.com/api/v2/end-users/";

type ApiErrorBody = {
  error?: string;
  message?: string;
};

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function getApiErrorMessage(body: unknown, status: number) {
  if (body && typeof body === "object") {
    const apiError = body as ApiErrorBody;
    if (apiError.error) return apiError.error;
    if (apiError.message) return apiError.message;
  }

  return `Request failed with status ${status}`;
}

export async function fetchEndUsers<T = unknown>(
  method: "POST" | "GET",
  path: string,
  body?: unknown,
): Promise<T> {
  const url = new URL(path, BASE_URL).toString();
  const res = await fetch(url, {
    credentials: "include",
    headers,
    method,
    mode: "cors",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(
      `${method} ${path} returned a non-JSON response (${res.status})`,
    );
  }

  if (!res.ok) {
    throw new Error(
      `${method} ${path}: ${getApiErrorMessage(json, res.status)}`,
    );
  }

  if (json && typeof json === "object" && "error" in json) {
    const message = (json as ApiErrorBody).error;
    if (message) {
      throw new Error(`${method} ${path}: ${message}`);
    }
  }

  return json as T;
}

export async function postEndUsers<T = unknown>(path: string, body?: unknown) {
  return fetchEndUsers<T>("POST", path, body);
}

export async function getEndUsers<T = unknown>(path: string) {
  return fetchEndUsers<T>("GET", path);
}

async function runTask<T>(
  name: string,
  task: () => Promise<T>,
): Promise<TaskOutcome<T>> {
  const startedAt = Date.now();

  try {
    const data = await task();
    return {
      name,
      ok: true,
      data,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message = formatError(error);
    console.error(`[${name}] ${message}`);
    return {
      name,
      ok: false,
      error: message,
      durationMs: Date.now() - startedAt,
    };
  }
}

const LOOT_BOX_PATH = "loot-boxes/3a623991-6a4e-448e-9a11-40cc53e3b9fb/open";
const TASK_COMPLETION_DELAY_MS = 1500;

async function main() {
  if (!process.env.TOKEN) {
    throw new Error("TOKEN is not set in the environment");
  }

  const wotd = await runTask("Word of the Day", solveWOTD);
  const candyBlast = await runTask("Candy Blast", completeLevels);

  await Bun.sleep(TASK_COMPLETION_DELAY_MS);

  const lootBoxes = await runTask("Loot boxes", () =>
    redeemAllLootBoxes(() =>
      postEndUsers<LootBoxRewardResponse>(LOOT_BOX_PATH),
    ),
  );

  try {
    await postRunSummary(wotd, candyBlast, lootBoxes);
  } catch (error) {
    console.error(`Discord notification failed: ${formatError(error)}`);
  }

  if (!wotd.ok || !wotd.data?.solved || !candyBlast.ok) {
    process.exit(1);
  }
}

await main();
