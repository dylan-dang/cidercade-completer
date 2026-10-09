import { getEndUsers } from ".";

export const PIECES_PER_ADMISSION = 4;

const STATE_NAME = "ADMISSION_PIECES";
const LOCAL_STATE_PATH = ".admission-pieces.json";
const GITHUB_API_URL = "https://api.github.com/repos/";

type Activity = {
  date: number;
  type: string;
  description?: string;
};

type ActivityResponse = {
  activity_history: Activity[];
};

export type AdmissionPieceState = {
  count: number;
  /** Pieces earned since tracking started, ignoring any consumed. */
  totalEarned: number;
  /** Unix seconds; ledger activity after this has not been applied yet. */
  updatedAt: number;
};

type StateStore = {
  load(): Promise<string | undefined>;
  save(value: string): Promise<void>;
};

function createGitHubVariableStore(repo: string, token: string): StateStore {
  function request(method: string, path: string, body?: unknown) {
    return fetch(new URL(`${repo}/actions/variables${path}`, GITHUB_API_URL), {
      method,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  }

  async function assertOk(res: Response, action: string) {
    if (!res.ok) {
      throw new Error(
        `Failed to ${action} ${STATE_NAME} variable (${res.status}): ${await res.text()}`,
      );
    }
  }

  return {
    async load() {
      const res = await request("GET", `/${STATE_NAME}`);
      if (res.status === 404) return undefined;
      await assertOk(res, "read");
      const { value } = (await res.json()) as { value: string };
      return value;
    },
    async save(value) {
      const body = { name: STATE_NAME, value };
      const updated = await request("PATCH", `/${STATE_NAME}`, body);
      if (updated.status !== 404) {
        await assertOk(updated, "update");
        return;
      }
      await assertOk(await request("POST", "", body), "create");
    },
  };
}

function createFileStore(path: string): StateStore {
  return {
    async load() {
      const file = Bun.file(path);
      return (await file.exists()) ? file.text() : undefined;
    },
    async save(value) {
      await Bun.write(path, value);
    },
  };
}

function getStateStore() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_PAT;

  if (repo && token) {
    return createGitHubVariableStore(repo, token);
  }

  // On GitHub Actions the runner is wiped after each run, so tracking is
  // opt-in by setting GH_PAT.
  if (process.env.GITHUB_ACTIONS === "true") {
    return undefined;
  }

  return createFileStore(LOCAL_STATE_PATH);
}

function parseState(value: string): AdmissionPieceState {
  const state = JSON.parse(value) as Partial<AdmissionPieceState>;
  if (typeof state.count !== "number" || typeof state.updatedAt !== "number") {
    throw new Error(
      `${STATE_NAME} must look like {"count":0,"totalEarned":0,"updatedAt":0}, got ${value}`,
    );
  }
  return {
    count: state.count,
    // States saved before totalEarned existed only know the current count.
    totalEarned: state.totalEarned ?? state.count,
    updatedAt: state.updatedAt,
  };
}

function isAdmissionPieceRedemption(activity: Activity) {
  return (
    activity.type === "redemption" &&
    /admission.*puzzle piece/i.test(activity.description ?? "")
  );
}

async function countPiecesConsumedSince(since: number) {
  const { activity_history } = await getEndUsers<ActivityResponse>("activity");
  return activity_history.filter(
    (activity) => activity.date > since && isAdmissionPieceRedemption(activity),
  ).length;
}

type StartedPuzzle = {
  name: string;
  pieces: { is_complete: boolean }[];
};

/** Pieces already placed on the in-progress puzzle, before this run's loot boxes. */
export async function readUnsetAdmissionBase() {
  const store = getStateStore();
  if (!store || (await store.load())) return 0;

  const { puzzles } = await getEndUsers<{ puzzles: StartedPuzzle[] }>(
    "puzzles?started=true",
  );
  const admission = puzzles.find((puzzle) => /admission/i.test(puzzle.name));
  const complete =
    admission?.pieces.filter((piece) => piece.is_complete).length ?? 0;
  // A full puzzle is claimable, not leftover inventory, and 0 means nothing started.
  return complete >= 1 && complete < PIECES_PER_ADMISSION ? complete : 0;
}

/** Resolves to `undefined` when tracking is not enabled. */
export async function updateAdmissionPieces(earned: number, unsetBase = 0) {
  const store = getStateStore();
  if (!store) return undefined;

  const saved = await store.load();
  const checkedAt = Math.floor(Date.now() / 1000);

  let count = unsetBase + earned;
  let totalEarned = earned;
  if (saved) {
    const previous = parseState(saved);
    const consumed = await countPiecesConsumedSince(previous.updatedAt);
    // Pieces consumed beyond our count were earned before tracking started.
    count = Math.max(previous.count - consumed, 0) + earned;
    totalEarned = previous.totalEarned + earned;
  }

  const state: AdmissionPieceState = {
    count,
    totalEarned,
    updatedAt: checkedAt,
  };
  await store.save(JSON.stringify(state));
  return state;
}
