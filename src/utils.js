import fs from "fs/promises";
import { UI } from "./config.js";

export function safelyCheckResponse(response) {
  const contentType = response.headers["content-type"] || "";
  const data = response.data;

  if (
    contentType.includes("text/html") ||
    (typeof data === "string" &&
      (data.trim().startsWith("<!DOCTYPE") || data.trim().startsWith("<html")))
  ) {
    throw new Error("Server returned HTML instead of JSON");
  }

  return response.data;
}

export function sanitizeResponse(data) {
  if (!data) return data;

  const sanitizedData = JSON.parse(JSON.stringify(data));

  if (sanitizedData.data && sanitizedData.data.wallet) {
    if (sanitizedData.data.wallet.wallet_private_key) {
      sanitizedData.data.wallet.wallet_private_key = "[REDACTED]";
    }
    if (sanitizedData.data.wallet.wallet_details) {
      if (sanitizedData.data.wallet.wallet_details.PrivateKey) {
        sanitizedData.data.wallet.wallet_details.PrivateKey = "[REDACTED]";
      }
      if (sanitizedData.data.wallet.wallet_details.Mnemonic) {
        sanitizedData.data.wallet.wallet_details.Mnemonic = "[REDACTED]";
      }
    }
  }

  return sanitizedData;
}

export async function saveJsonToFile(filePath, data, append = false) {
  try {
    let existingData = [];

    if (append) {
      try {
        const fileExists = await fileExistsAsync(filePath);

        if (fileExists) {
          const fileContent = await fs.readFile(filePath, "utf8");

          if (fileContent.trim() !== "") {
            try {
              existingData = JSON.parse(fileContent);
            } catch (parseError) {
              try {
                const normalizedContent = fileContent.trim().startsWith("[")
                  ? fileContent.replace(/,\s*$/, "") + "]"
                  : `[${fileContent.replace(/,\s*$/, "")}]`;

                existingData = JSON.parse(normalizedContent);
              } catch (normalizeError) {
                console.error(
                  "Failed to parse existing JSON file, starting fresh",
                  normalizeError
                );
                existingData = [];
              }
            }
          }
        }
      } catch (error) {
        console.log(`No existing file found at ${filePath}, creating new file`);
        existingData = [];
      }
    }

    if (!Array.isArray(existingData)) {
      existingData = [existingData];
    }

    if (Array.isArray(data)) {
      existingData = [...existingData, ...data];
    } else {
      existingData.push(data);
    }

    await fs.writeFile(filePath, JSON.stringify(existingData, null, 2));
    return true;
  } catch (error) {
    console.error(`Error saving data to ${filePath}:`, error.message);
    return false;
  }
}

export async function fileExistsAsync(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace("T", " ").substring(0, 19);
}

export function formatLogEntry(type, message) {
  const timestamp = getTimestamp();
  let color;

  switch (type.toLowerCase()) {
    case "error":
      color = UI.COLORS.ERROR;
      break;
    case "success":
      color = UI.COLORS.SUCCESS;
      break;
    case "info":
      color = UI.COLORS.INFO;
      break;
    case "warning":
      color = UI.COLORS.WARNING;
      break;
    default:
      color = "white";
  }

  return { timestamp, type, message, color };
}

export function limitArraySize(array, maxSize) {
  if (array.length > maxSize) {
    return array.slice(array.length - maxSize);
  }
  return array;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isLoginSuccessful(loginData) {
  return (
    loginData.status === true ||
    loginData.success === true ||
    (loginData.message && loginData.message.includes("Successfully logged in"))
  );
}
