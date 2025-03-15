import { sleep, fileExistsAsync } from "./src/utils.js";
import { readAccountsFromFile, ACCOUNT_STATUS } from "./src/accounts.js";
import { login, sendKeepAlive, getReferralPoints } from "./src/api.js";
import { Dashboard } from "./src/dashboard.js";
import { KEEPALIVE_INTERVAL, PATHS } from "./src/config.js";
import logger from "./src/logger.js";
import fs from "fs/promises";

async function ensureTokensFileExists() {
  try {
    const exists = await fileExistsAsync(PATHS.TOKENS);
    if (!exists) {
      logger.info(`Creating new tokens file at ${PATHS.TOKENS}`);
      await fs.writeFile(PATHS.TOKENS, "[]");
      return;
    }

    try {
      const content = await fs.readFile(PATHS.TOKENS, "utf8");
      if (content.trim() === "") {
        await fs.writeFile(PATHS.TOKENS, "[]");
      } else {
        JSON.parse(content);
      }
    } catch (error) {
      logger.warning(
        `Tokens file exists but contains invalid JSON. Backing up and creating new file.`
      );
      const backupPath = `${PATHS.TOKENS}.backup.${Date.now()}`;
      await fs.copyFile(PATHS.TOKENS, backupPath);
      logger.info(`Backed up existing file to ${backupPath}`);

      await fs.writeFile(PATHS.TOKENS, "[]");
    }
  } catch (error) {
    logger.error(`Error initializing tokens file: ${error.message}`);
  }
}

async function loginWithMaxRetries(account, accountManager, maxAttempts = 10) {
  const { username } = account;

  logger.info(
    `Starting login process with max ${maxAttempts} attempts`,
    username
  );

  let attempts = 0;
  while (
    account.status !== ACCOUNT_STATUS.LOGGED_IN &&
    attempts < maxAttempts
  ) {
    attempts++;
    logger.info(`Login attempt #${account.loginAttempts + 1}`, username);

    try {
      const success = await login(account, accountManager);

      if (success) {
        logger.success(
          `Login successful on attempt #${account.loginAttempts}`,
          username
        );

        await fetchReferralPoints(account, accountManager);

        startKeepAlive(account, accountManager);
        return true;
      }

      logger.warning(
        `Login attempt #${account.loginAttempts} failed`,
        username
      );
    } catch (error) {
      logger.error(
        `Exception during login attempt: ${error.message}`,
        username
      );
    }

    if (attempts < maxAttempts) {
      logger.info(`Waiting 3 seconds before next attempt...`, username);
      await sleep(3000);
    } else {
      logger.error(
        `Maximum login attempts (${maxAttempts}) reached for ${username}`,
        username
      );
      accountManager.updateAccountStatus(username, ACCOUNT_STATUS.FAILED);
    }
  }

  return account.status === ACCOUNT_STATUS.LOGGED_IN;
}

async function fetchReferralPoints(account, accountManager) {
  try {
    await getReferralPoints(account, accountManager);
  } catch (error) {
    logger.error(
      `Error fetching referral points: ${error.message}`,
      account.username
    );
  }
}

async function handleTokenExpiration(account, accountManager) {
  const { username } = account;

  if (
    account.status === ACCOUNT_STATUS.LOGGED_IN &&
    account.isTokenExpiring()
  ) {
    logger.warning(
      `Token for ${username} is expiring soon, initiating re-login`,
      username
    );

    if (account.keepAliveInterval) {
      clearInterval(account.keepAliveInterval);
      account.keepAliveInterval = null;
    }

    account.resetForRelogin();

    return await loginWithMaxRetries(account, accountManager, 10);
  }

  return account.status === ACCOUNT_STATUS.LOGGED_IN;
}

function startKeepAlive(account, accountManager) {
  const { username } = account;

  if (account.keepAliveInterval) {
    clearInterval(account.keepAliveInterval);
  }

  sendKeepAlive(account, accountManager).catch((error) => {
    logger.error(`Initial keepalive failed: ${error.message}`, username);
  });

  account.keepAliveInterval = setInterval(async () => {
    try {
      const isLoggedIn = await handleTokenExpiration(account, accountManager);

      if (isLoggedIn) {
        await sendKeepAlive(account, accountManager);

        if (account.stats.totalKeepAlives % 5 === 0) {
          await fetchReferralPoints(account, accountManager);
        }
      }
    } catch (error) {
      logger.error(`Interval processing failed: ${error.message}`, username);
    }
  }, KEEPALIVE_INTERVAL);

  logger.info(
    `Keepalive service started (every ${KEEPALIVE_INTERVAL / 1000}s)`,
    username
  );

  const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
  account.tokenExpiryCheckInterval = setInterval(async () => {
    try {
      await handleTokenExpiration(account, accountManager);
    } catch (error) {
      logger.error(`Token expiry check failed: ${error.message}`, username);
    }
  }, THREE_HOURS_MS);

  logger.info(`Token expiry check scheduled (every 3 hours)`, username);
}

async function main() {
  try {
    logger.info("Starting Dawn Login Automation with Dashboard");

    await ensureTokensFileExists();

    const accountManager = await readAccountsFromFile();
    const accounts = accountManager.getAllAccounts();

    if (accounts.length === 0) {
      logger.error("No accounts found in account.key file");
      return;
    }

    logger.info(`Found ${accounts.length} accounts in account.key file`);

    const dashboard = new Dashboard(accountManager);

    for (let i = 0; i < accounts.length; i++) {
      const account = accounts[i];
      logger.info(
        `Processing account ${i + 1}/${accounts.length}: ${account.username}`,
        account.username
      );

      try {
        const success = await loginWithMaxRetries(account, accountManager, 10);

        if (!success) {
          logger.warning(
            `Failed to login account: ${account.username}, continuing to next account`,
            account.username
          );
        }
      } catch (error) {
        logger.error(
          `Critical error processing account ${account.username}: ${error.message}`,
          account.username
        );
      }

      if (i < accounts.length - 1) {
        logger.info(
          `Waiting 5 seconds before processing next account...`,
          account.username
        );
        await sleep(5000);
      }
    }

    const loggedInAccounts = accounts.filter(
      (account) => account.status === ACCOUNT_STATUS.LOGGED_IN
    ).length;

    logger.success(
      `Processing completed. ${loggedInAccounts}/${accounts.length} accounts logged in successfully`
    );
    if (loggedInAccounts > 0) {
      logger.info("Keepalive services are running in the background");
      logger.info(
        "Tokens will be automatically refreshed before they expire (7 days)"
      );
    } else {
      logger.warning("No accounts were successfully logged in");
    }

    process.on("SIGINT", async () => {
      logger.warning("Stopping all keepalive services...");

      for (const account of accounts) {
        if (account.keepAliveInterval) {
          clearInterval(account.keepAliveInterval);
          logger.info(`Stopped keepalive for ${account.username}`);
        }
        if (account.tokenExpiryCheckInterval) {
          clearInterval(account.tokenExpiryCheckInterval);
          logger.info(`Stopped token expiry checks for ${account.username}`);
        }
      }

      logger.info("All services stopped");
      process.exit(0);
    });
  } catch (error) {
    logger.error(`Error in main function: ${error.message}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
