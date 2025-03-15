import axios from "axios";
import {
  API_BASE_URL,
  ENDPOINTS,
  APP_ID,
  EXTENSION_ID,
  APP_VERSION,
  getCommonHeaders,
  httpsAgent,
} from "./config.js";
import { solveCaptcha } from "./captcha.js";
import { safelyCheckResponse, isLoginSuccessful } from "./utils.js";
import logger from "./logger.js";
import { ACCOUNT_STATUS } from "./accounts.js";

export async function login(account, accountManager) {
  const { username, password } = account;
  account.loginAttempts++;
  accountManager.updateAccountStatus(username, ACCOUNT_STATUS.LOGGING_IN);

  try {
    const headers = getCommonHeaders();

    logger.info("Fetching puzzle...", username);

    let response;
    try {
      response = await axios.get(
        `${API_BASE_URL}${ENDPOINTS.GET_PUZZLE}?appid=${APP_ID}`,
        {
          headers: headers,
          ...(httpsAgent && { httpsAgent }),
        }
      );
    } catch (error) {
      logger.error(`Puzzle request failed: ${error.message}`, username);
      accountManager.updateAccountStatus(username, ACCOUNT_STATUS.FAILED);
      return false;
    }

    const puzzleData = safelyCheckResponse(response);

    if (!puzzleData.success) {
      logger.error(`Error getting puzzle: ${puzzleData.message}`, username);
      accountManager.updateAccountStatus(username, ACCOUNT_STATUS.FAILED);
      return false;
    }

    const puzzleId = puzzleData.puzzle_id;
    logger.info(`Got puzzle ID: ${puzzleId}`, username);

    logger.info("Fetching puzzle image...", username);

    let imageResponse;
    try {
      imageResponse = await axios.get(
        `${API_BASE_URL}${ENDPOINTS.GET_PUZZLE_IMAGE}?puzzle_id=${puzzleId}&appid=${APP_ID}`,
        {
          headers: headers,
          ...(httpsAgent && { httpsAgent }),
        }
      );
    } catch (error) {
      logger.error(`Puzzle image request failed: ${error.message}`, username);
      accountManager.updateAccountStatus(username, ACCOUNT_STATUS.FAILED);
      return false;
    }

    const imageData = safelyCheckResponse(imageResponse);

    if (!imageData.success) {
      logger.error(
        `Error getting puzzle image: ${imageData.message}`,
        username
      );
      accountManager.updateAccountStatus(username, ACCOUNT_STATUS.FAILED);
      return false;
    }

    logger.info("Successfully retrieved puzzle image", username);

    const captchaSolution = await solveCaptcha(imageData.imgBase64, username);

    if (!captchaSolution) {
      logger.error("Failed to get captcha solution", username);
      accountManager.updateAccountStatus(username, ACCOUNT_STATUS.FAILED);
      return false;
    }

    logger.info(`Attempting login with solution: ${captchaSolution}`, username);
    const currentDateTime = new Date().toISOString();
    const loginPayload = {
      username: username,
      password: password,
      ans: captchaSolution,
      appid: APP_ID,
      logindata: {
        _v: {
          version: APP_VERSION,
        },
        datetime: currentDateTime,
      },
      datetime: currentDateTime,
      _v: {
        version: APP_VERSION,
      },
      puzzle_id: puzzleId,
    };

    const loginHeaders = {
      ...headers,
      "Content-Type": "application/json",
    };

    let loginResponse;
    try {
      loginResponse = await axios.post(
        `${API_BASE_URL}${ENDPOINTS.LOGIN}?appid=${APP_ID}`,
        loginPayload,
        {
          headers: loginHeaders,
          ...(httpsAgent && { httpsAgent }),
        }
      );
    } catch (error) {
      logger.error(`Login request failed: ${error.message}`, username);
      accountManager.updateAccountStatus(username, ACCOUNT_STATUS.FAILED);
      return false;
    }

    const loginData = safelyCheckResponse(loginResponse);
    logger.info("Login response received", username);

    if (isLoginSuccessful(loginData)) {
      let token = null;
      let userId = null;

      if (loginData.data && loginData.data.token) {
        token = loginData.data.token;
        userId = loginData.data.user_id || loginData.data._id;

        accountManager.setAccountLoginSuccess(username, token, userId);

        logger.info("Saving token and wallet data to file...", username);
        try {
          await account.saveToken(loginData);
          logger.success("Token and wallet data saved successfully", username);
        } catch (error) {
          logger.error(`Failed to save token data: ${error.message}`, username);
        }

        logger.success("Login successful", username);
        logger.success(
          `Login successful on attempt #${account.loginAttempts}`,
          username
        );
        return true;
      } else {
        logger.error("Login response missing token", username);
        accountManager.updateAccountStatus(username, ACCOUNT_STATUS.FAILED);
        return false;
      }
    } else {
      logger.error(
        `Login failed: ${loginData.message || "Unknown error"}`,
        username
      );
      accountManager.updateAccountStatus(username, ACCOUNT_STATUS.FAILED);
      return false;
    }
  } catch (error) {
    logger.error(`Error during login process: ${error.message}`, username);
    accountManager.updateAccountStatus(username, ACCOUNT_STATUS.FAILED);
    return false;
  }
}

export async function sendKeepAlive(account, accountManager) {
  const { username, token } = account;

  if (!token) {
    logger.error("Cannot send keepalive: No token available", username);
    return false;
  }

  try {
    logger.info("Sending keepalive...", username);

    const headers = {
      ...getCommonHeaders(),
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const payload = {
      username: username,
      extensionid: EXTENSION_ID,
      _v: APP_VERSION,
    };

    let response;
    try {
      response = await axios.post(
        `${API_BASE_URL}${ENDPOINTS.KEEPALIVE}?appid=${APP_ID}`,
        payload,
        {
          headers: headers,
          ...(httpsAgent && { httpsAgent }),
        }
      );
    } catch (error) {
      logger.error(`Keepalive request failed: ${error.message}`, username);
      accountManager.recordKeepAlive(username, false);
      return false;
    }

    const data = safelyCheckResponse(response);

    const success = data.success || (data.data && data.data.success);
    accountManager.recordKeepAlive(username, success);

    if (success) {
      logger.success("Keepalive successful", username);
    } else {
      logger.warning("Keepalive may have failed", username);
    }

    return success;
  } catch (error) {
    logger.error(`Keepalive failed: ${error.message}`, username);
    accountManager.recordKeepAlive(username, false);
    return false;
  }
}

export async function getReferralPoints(account, accountManager) {
  const { username, token } = account;

  if (!token) {
    logger.error("Cannot get referral points: No token available", username);
    return null;
  }

  try {
    logger.info("Fetching referral points...", username);

    const headers = {
      ...getCommonHeaders(),
      Authorization: `Bearer ${token}`,
    };

    let response;
    try {
      response = await axios.get(
        `${API_BASE_URL}${ENDPOINTS.GET_REFERRAL_POINTS}?appid=${APP_ID}`,
        {
          headers: headers,
          ...(httpsAgent && { httpsAgent }),
        }
      );
    } catch (error) {
      logger.error(
        `Referral points request failed: ${error.message}`,
        username
      );
      return null;
    }

    const data = safelyCheckResponse(response);

    if (data && data.status) {
      logger.success("Referral points fetched successfully", username);

      if (accountManager) {
        accountManager.setAccountPoints(username, data);
      }

      return data;
    } else {
      logger.warning("Failed to get valid referral points data", username);
      return null;
    }
  } catch (error) {
    logger.error(`Failed to get referral points: ${error.message}`, username);
    return null;
  }
}
