import dotenv from "dotenv";
import { HttpsProxyAgent } from "https-proxy-agent";

dotenv.config();

export const APP_ID = "67d5987fede3e379578664b6";
export const EXTENSION_ID = "fpdkjdnhkakefebpekbdhillbhonfjjp";
export const APP_VERSION = "1.1.3";
export const API_BASE_URL = "https://www.aeropres.in";
export const ENDPOINTS = {
  GET_PUZZLE: "/chromeapi/dawn/v1/puzzle/get-puzzle",
  GET_PUZZLE_IMAGE: "/chromeapi/dawn/v1/puzzle/get-puzzle-image",
  LOGIN: "/chromeapi/dawn/v1/user/login/v2",
  KEEPALIVE: "/chromeapi/dawn/v1/userreward/keepalive",
  GET_REFERRAL_POINTS: "/api/atom/v1/userreferral/getpoint",
};

export const PROXY_URL = process.env.PROXY_URL;
export const httpsAgent = PROXY_URL ? new HttpsProxyAgent(PROXY_URL) : null;
export const ANTICAPTCHA_API_KEY = process.env.ANTICAPTCHA_API_KEY;
export const getCommonHeaders = () => ({
  Accept: "*/*",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Accept-Language": "en-US,en;q=0.9",
  Origin: `chrome-extension://${EXTENSION_ID}`,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
  "Sec-Ch-Ua":
    '"Chromium";v="134", "Not-A.Brand";v="24", "Google Chrome";v="134"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
});

export const KEEPALIVE_INTERVAL = 180000;
export const UI = {
  COLORS: {
    SUCCESS: "green",
    ERROR: "red",
    INFO: "blue",
    WARNING: "yellow",
    HIGHLIGHT: "cyan",
  },
  REFRESH_RATE: 1000,
  MAX_LOG_LINES: 500,
};

export const PATHS = {
  ACCOUNTS: "./account.key",
  TOKENS: "./tokens.json",
  TEMP_CAPTCHA: "./temp_captcha.png",
};

export const msToTime = (ms) => {
  const seconds = Math.floor((ms / 1000) % 60);
  const minutes = Math.floor((ms / (1000 * 60)) % 60);
  const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));

  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
};
