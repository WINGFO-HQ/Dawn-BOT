import fs from "fs/promises";
import { PATHS } from "./config.js";
import logger from "./logger.js";
import { saveJsonToFile } from "./utils.js";

export const ACCOUNT_STATUS = {
  IDLE: "idle",
  LOGGING_IN: "logging_in",
  LOGGED_IN: "logged_in",
  FAILED: "failed",
};

export class Account {
  constructor(username, password) {
    this.username = username;
    this.password = password;
    this.status = ACCOUNT_STATUS.IDLE;
    this.token = null;
    this.userId = null;
    this.loginAttempts = 0;
    this.lastKeepAlive = null;
    this.keepAliveInterval = null;
    this.tokenExpiryCheckInterval = null;
    this.loginTime = null;
    this.uptime = 0;
    this.tokenExpiryTime = null;
    this.stats = {
      totalKeepAlives: 0,
      successfulKeepAlives: 0,
      failedKeepAlives: 0,
    };
    this.points = {
      total: 0,
      twitter: 0,
      discord: 0,
      telegram: 0,
      lastUpdated: null,
    };
  }

  setStatus(status) {
    this.status = status;
    return this;
  }

  setLoginSuccess(token, userId) {
    this.token = token;
    this.userId = userId;
    this.status = ACCOUNT_STATUS.LOGGED_IN;
    this.loginTime = Date.now();
    this.setTokenExpiry();

    return this;
  }

  setTokenExpiry() {
    const SIX_AND_HALF_DAYS_MS = 6.5 * 24 * 60 * 60 * 1000;
    this.tokenExpiryTime = Date.now() + SIX_AND_HALF_DAYS_MS;
    logger.info(
      `Token expiry set for ${new Date(this.tokenExpiryTime).toLocaleString()}`,
      this.username
    );
    return this;
  }

  isTokenExpiring() {
    if (!this.tokenExpiryTime) return false;

    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    return Date.now() > this.tokenExpiryTime - SIX_HOURS_MS;
  }

  resetForRelogin() {
    logger.info(`Token expiring soon, preparing for re-login`, this.username);
    this.token = null;
    this.userId = null;
    this.tokenExpiryTime = null;
    this.status = ACCOUNT_STATUS.IDLE;
    return this;
  }

  updateUptime() {
    if (this.loginTime) {
      this.uptime = Date.now() - this.loginTime;
    }
    return this.uptime;
  }

  recordKeepAlive(success) {
    this.lastKeepAlive = Date.now();
    this.stats.totalKeepAlives++;

    if (success) {
      this.stats.successfulKeepAlives++;
    } else {
      this.stats.failedKeepAlives++;
    }

    return this;
  }

  updatePoints(pointsData) {
    if (!pointsData) return this;

    try {
      if (pointsData.data && pointsData.data.rewardPoint) {
        const rewardPoint = pointsData.data.rewardPoint;

        this.points = {
          total: rewardPoint.points || 0,
          twitter: rewardPoint.twitter_x_id_points || 0,
          discord: rewardPoint.discordid_points || 0,
          telegram: rewardPoint.telegramid_points || 0,
          lastUpdated: Date.now(),
        };
      }
    } catch (error) {
      console.error(`Error updating points for ${this.username}:`, error);
    }

    return this;
  }

  async saveToken(loginData) {
    if (!this.token) return;

    try {
      const tokenInfo = {
        username: this.username,
        token: this.token,
        user_id: this.userId,
        timestamp: new Date().toISOString(),
        expiresAt: this.tokenExpiryTime
          ? new Date(this.tokenExpiryTime).toISOString()
          : null,
        account: {
          email: loginData?.data?.email || this.username,
          firstname: loginData?.data?.firstname || "",
          lastname: loginData?.data?.lastname || "",
          referralCode: loginData?.data?.referralCode || "",
        },
        wallet: null,
      };

      if (loginData?.data?.wallet) {
        tokenInfo.wallet = {
          address: loginData.data.wallet.wallet_address,
          private_key: loginData.data.wallet.wallet_private_key,
          mnemonic: loginData.data.wallet.wallet_details?.Mnemonic || "",
          createdAt: loginData.data.wallet.createdAt,
        };
      }

      const success = await saveJsonToFile(PATHS.TOKENS, tokenInfo, true);

      if (success) {
        logger.info(
          `Token and wallet data saved to ${PATHS.TOKENS}`,
          this.username
        );
      }
    } catch (error) {
      logger.error(`Error saving token data: ${error.message}`, this.username);
    }
  }
}

export class AccountManager {
  constructor() {
    this.accounts = new Map();
    this.listeners = new Set();
  }

  addAccount(username, password) {
    const account = new Account(username, password);
    this.accounts.set(username, account);
    return account;
  }

  getAccount(username) {
    return this.accounts.get(username);
  }

  getAllAccounts() {
    return Array.from(this.accounts.values());
  }

  updateAccountStatus(username, status) {
    const account = this.getAccount(username);
    if (account) {
      account.setStatus(status);
      this.notifyListeners();
    }
    return account;
  }

  setAccountLoginSuccess(username, token, userId) {
    const account = this.getAccount(username);
    if (account) {
      account.setLoginSuccess(token, userId);
      this.notifyListeners();
    }
    return account;
  }

  recordKeepAlive(username, success) {
    const account = this.getAccount(username);
    if (account) {
      account.recordKeepAlive(success);
      this.notifyListeners();
    }
    return account;
  }

  setAccountPoints(username, pointsData) {
    const account = this.getAccount(username);
    if (account) {
      account.updatePoints(pointsData);
      this.notifyListeners();
    }
    return account;
  }

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.getAllAccounts());
      } catch (error) {
        console.error("Error in account listener:", error);
      }
    }
  }

  updateAllUptimes() {
    for (const account of this.getAllAccounts()) {
      account.updateUptime();
    }
    this.notifyListeners();
  }
}

export async function readAccountsFromFile(filePath = PATHS.ACCOUNTS) {
  try {
    const data = await fs.readFile(filePath, "utf8");
    const accountManager = new AccountManager();
    const lines = data
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    lines.forEach((line, index) => {
      let cleanedLine = line;
      if (cleanedLine.endsWith(",")) {
        cleanedLine = cleanedLine.slice(0, -1).trim();
      }

      const parts = cleanedLine.split(":");

      if (parts.length >= 2) {
        const username = parts[0].trim();
        const password = parts.slice(1).join(":").trim();

        if (username && password) {
          accountManager.addAccount(username, password);
        } else {
          logger.warning(
            `Invalid account format at line ${index + 1}: ${username}:****`
          );
        }
      } else {
        logger.warning(
          `Skipping invalid line ${index + 1} (missing delimiter)`
        );
      }
    });

    const totalAccounts = accountManager.getAllAccounts().length;
    logger.info(`Loaded ${totalAccounts} accounts from ${filePath}`);

    return accountManager;
  } catch (error) {
    logger.error(`Error reading accounts file: ${error.message}`);
    return new AccountManager();
  }
}
