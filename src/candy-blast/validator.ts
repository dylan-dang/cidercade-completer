import { Blowfish } from "egoroof-blowfish";

/** Base64-encoded Blowfish key from game.js (`ig.Validator` vsk). */
export const CANDY_BLAST_HANG_VSK =
  "V0RVcUpYdzM3eVluTllHVHJxNkxMUFFVWWFaZGtKc204cTdkRTRYenVhanF3c0hQcXAzSlFnUlY=";

export const DEFAULT_PROJECT_ID = "marketjs-hang";
export const DEFAULT_VALIDATOR_ID = "candy-blast-hang";

export interface ValidatorCryptoOptions {
  vsk: string;
  sk?: string;
  projectId: string;
  validatorId: string;
}

export interface ValidatorRequestBody {
  project_id: string;
  validator_id: string;
  payload: string;
}

export interface UserAction {
  timestamp: number;
  action: string;
}

/** `/api/start` inner payload shape. */
export interface ValidatorStartPayload {
  project_id: string;
  validator_id: string;
  brand_id: string;
  campaign_id: string;
  tournament_id: string;
  game_id: string;
  level_number: string | null;
  token: string;
  level: number;
  custom_payload_01: string;
  custom_payload_02: string;
  custom_payload_03: string | null;
  custom_payload_04: string | null;
  custom_payload_05: boolean | number;
  env: string;
}

/** `/api/progress` inner payload shape. */
export interface ValidatorProgressPayload {
  project_id: string;
  validator_id: string;
  brand_id: string;
  tournament_id: string;
  campaign_id: string;
  game_id: string;
  level_number: string | null;
  token: string;
  game_time: number;
  user_score: number;
  user_action: string;
  custom_payload_01: string;
  custom_payload_02: string;
  custom_payload_03: string | number | null;
  custom_payload_04: string | null;
  custom_payload_05: boolean | number;
  level: number;
}

/** `/api/end` inner payload shape. */
export interface ValidatorEndPayload {
  level_number: number;
  token: string;
  game_id: string;
  tournament_id: string;
  brand_id: string;
  campaign_id: string;
  score: number;
  time_spent_in_mins: string;
  game_time: number;
  win: number;
  user_score: number;
  user_action: string;
  level: number;
  custom_payload_01: string;
  custom_payload_02: string;
  custom_payload_03: string;
  custom_payload_04: string | null;
  custom_payload_05: number;
}

export interface DecryptOptions {
  vsk: string;
  sk?: string;
}

function decodeKey(keyBase64: string): string {
  return Buffer.from(keyBase64, "base64").toString("ascii");
}

function createCipher(keyBase64: string): Blowfish {
  return new Blowfish(
    decodeKey(keyBase64),
    Blowfish.MODE.ECB,
    Blowfish.PADDING.NULL,
  );
}

/** Blowfish-ECB encrypt plaintext and return base64 ciphertext. */
export function blowfishEncryptBase64(
  plaintext: string,
  keyBase64: string,
): string {
  const encrypted = createCipher(keyBase64).encode(plaintext);
  return Buffer.from(encrypted).toString("base64");
}

/** Blowfish-ECB decrypt base64 ciphertext and return plaintext. */
export function blowfishDecryptBase64(
  ciphertextBase64: string,
  keyBase64: string,
): string {
  const decrypted = createCipher(keyBase64).decode(
    Buffer.from(ciphertextBase64, "base64"),
    Blowfish.TYPE.STRING,
  );
  return decrypted.replace(/\0+$/g, "");
}

/** Content-Type used by `ig.Validator.callXHR` / `getContentType`. */
export function getValidatorContentType(
  sk?: string,
): "application/json" | "text/plain" {
  return sk ? "text/plain" : "application/json";
}

/** Encrypt inner JSON and return the `{ project_id, validator_id, payload }` wrapper. */
export function encryptRequestBody<T>(
  data: T,
  options: ValidatorCryptoOptions,
): ValidatorRequestBody {
  const payload = blowfishEncryptBase64(JSON.stringify(data), options.vsk);
  return {
    project_id: options.projectId,
    validator_id: options.validatorId,
    payload,
  };
}

/**
 * Encrypt a validator payload the same way `ig.Validator.getEnc()` does.
 * Returns the raw HTTP request body string sent by `callXHR`.
 */
export function encryptValidatorPayload<T>(
  data: T,
  options: ValidatorCryptoOptions = createDefaultCryptoOptions(),
): string {
  const wrapper = JSON.stringify(encryptRequestBody(data, options));
  if (!options.sk) {
    return wrapper;
  }
  return blowfishEncryptBase64(wrapper, options.sk);
}

/** Parse a captured request body into wrapper metadata + ciphertext. */
export function parseValidatorInput(input: string | ValidatorRequestBody): {
  wrapper: ValidatorRequestBody | null;
  ciphertext: string;
} {
  if (typeof input === "object" && input !== null) {
    if (typeof input.payload !== "string") {
      throw new Error("Request body is missing a string `payload` field.");
    }
    return { wrapper: input, ciphertext: input.payload };
  }

  const trimmed = input.trim();

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      const body = parsed as Partial<ValidatorRequestBody>;
      if (typeof body.payload === "string") {
        return {
          wrapper: {
            project_id: String(body.project_id ?? ""),
            validator_id: String(body.validator_id ?? ""),
            payload: body.payload,
          },
          ciphertext: body.payload,
        };
      }
      throw new Error(
        "JSON input has no string `payload` field. Pass the encrypted payload or full request body.",
      );
    }
    if (typeof parsed === "string") {
      return { wrapper: null, ciphertext: parsed };
    }
  } catch {
    // Not JSON — treat as raw base64 payload.
  }

  return { wrapper: null, ciphertext: trimmed };
}

/** Decrypt the inner JSON object from a captured validator request. */
export function decryptValidatorPayload<T = unknown>(
  input: string | ValidatorRequestBody,
  options: DecryptOptions,
): T {
  let text = typeof input === "string" ? input : JSON.stringify(input);

  if (options.sk) {
    text = blowfishDecryptBase64(text.trim(), options.sk);
  }

  const { ciphertext } = parseValidatorInput(text);
  const innerText = blowfishDecryptBase64(ciphertext, options.vsk);
  return JSON.parse(innerText) as T;
}

/** Decrypt and return both wrapper metadata and inner payload. */
export function decryptValidatorRequest<T = unknown>(
  input: string | ValidatorRequestBody,
  options: DecryptOptions,
): { wrapper: ValidatorRequestBody | null; data: T } {
  let text = typeof input === "string" ? input : JSON.stringify(input);

  if (options.sk) {
    text = blowfishDecryptBase64(text.trim(), options.sk);
  }

  const { wrapper, ciphertext } = parseValidatorInput(text);
  const innerText = blowfishDecryptBase64(ciphertext, options.vsk);
  return {
    wrapper,
    data: JSON.parse(innerText) as T,
  };
}

/** Parse `user_action` from progress/end payloads. */
export function parseUserActions(userAction: string): UserAction[] {
  return JSON.parse(userAction) as UserAction[];
}

/** Default crypto options matching this game's `ig.Validator` init. */
export function createDefaultCryptoOptions(
  overrides: Partial<ValidatorCryptoOptions> = {},
): ValidatorCryptoOptions {
  return {
    vsk: CANDY_BLAST_HANG_VSK,
    projectId: DEFAULT_PROJECT_ID,
    validatorId: DEFAULT_VALIDATOR_ID,
    ...overrides,
  };
}

type ValidatorPayloadMap = {
  start: ValidatorStartPayload;
  end: ValidatorEndPayload;
  progress: ValidatorProgressPayload;
};

export interface ValidatorStartResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  session_id: string;
}

export interface ValidatorProgressResponse {
  ping_validated: boolean;
  rc: string;
}

export interface ValidatorEndResponse {
  session_validated?: boolean;
  message?: string;
  rc: string;
}

export type ValidatorReponseMap = {
  start: ValidatorStartResponse;
  progress: ValidatorProgressResponse;
  end: ValidatorEndResponse;
};

export const VALIDATOR_BASE_URL =
  "https://validator.marketjs-cloud.com:8443/api/";
export async function postGame<T extends keyof ValidatorPayloadMap>(
  path: T,
  payload: ValidatorPayloadMap[T],
  bearerToken?: string,
): Promise<ValidatorReponseMap[T]> {
  const res = await fetch(new URL(path, VALIDATOR_BASE_URL), {
    method: "POST",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) Gecko/20100101 Firefox/152.0",
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerToken}`,
    },
    body: encryptValidatorPayload(payload),
  });
  return (await res.json()) as ValidatorReponseMap[T];
}
