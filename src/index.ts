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

export async function postEndUsers<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  const url = new URL(path, BASE_URL).toString();
  const res = await fetch(url, {
    credentials: "include",
    headers,
    method: "POST",
    mode: "cors",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return (await res.json()) as T;
}
