import fs from "fs/promises";
import ac from "@antiadmin/anticaptchaofficial";
import { ANTICAPTCHA_API_KEY, PATHS } from "./config.js";
import logger from "./logger.js";

ac.setAPIKey(ANTICAPTCHA_API_KEY);
ac.setSoftId(0);
ac.shutUp();

export async function solveCaptcha(imageBase64, username) {
  try {
    logger.info("Solving captcha...", username);

    const tempImagePath = PATHS.TEMP_CAPTCHA;
    await fs.writeFile(tempImagePath, Buffer.from(imageBase64, "base64"));

    const captchaFileContent = await fs.readFile(tempImagePath, {
      encoding: "base64",
    });

    logger.info("Sending captcha to Anti-Captcha service...", username);
    const captchaSolution = await ac.solveImage(captchaFileContent, true);

    await fs.unlink(tempImagePath).catch(() => {});

    logger.success(`Captcha solution found: ${captchaSolution}`, username);
    return captchaSolution;
  } catch (error) {
    logger.error(`Error solving captcha: ${error.message}`, username);
    return null;
  }
}
