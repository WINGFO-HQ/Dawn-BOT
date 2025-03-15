import blessed from "blessed";
import { UI, msToTime } from "./config.js";
import { ACCOUNT_STATUS } from "./accounts.js";
import logger from "./logger.js";

export class Dashboard {
  constructor(accountManager) {
    this.accountManager = accountManager;
    this.screen = null;
    this.accountsBox = null;
    this.logsBox = null;
    this.statsBox = null;
    this.accountManager.addListener(this.updateAccounts.bind(this));
    this.logs = [];
    this.setupScreen();
  }

  setupScreen() {
    this.screen = blessed.screen({
      smartCSR: true,
      title: "Dawn Login Automation Dashboard",
      dockBorders: true,
      fullUnicode: true,
    });

    this.headerBox = blessed.box({
      top: 0,
      left: 0,
      width: "100%",
      height: 3,
      content: " Dawn Automation Dashboard ",
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        bg: "blue",
        border: {
          fg: "blue",
        },
      },
    });

    this.linksBox = blessed.box({
      top: 3,
      left: 0,
      width: "100%",
      height: 3,
      content:
        " Channel: https://t.me/infomindao | Group: https://t.me/WINGFO_DAO ",
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        bg: "cyan",
        border: {
          fg: "cyan",
        },
      },
    });

    this.accountsBox = blessed.box({
      top: 6,
      left: 0,
      width: "70%",
      height: "57%",
      label: " Accounts ",
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        track: {
          bg: "gray",
        },
        style: {
          inverse: true,
        },
      },
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        border: {
          fg: "white",
        },
      },
    });

    this.statsBox = blessed.box({
      top: 6,
      right: 0,
      width: "30%",
      height: "30%",
      label: " Statistics ",
      tags: true,
      scrollable: true,
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        border: {
          fg: "white",
        },
      },
    });

    this.logsBox = blessed.box({
      top: "63%",
      left: 0,
      width: "70%",
      height: "37%",
      label: " Logs ",
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        ch: " ",
        track: {
          bg: "gray",
        },
        style: {
          inverse: true,
        },
      },
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        border: {
          fg: "white",
        },
      },
    });

    this.helpBox = blessed.box({
      top: "36%",
      right: 0,
      width: "30%",
      height: "64%",
      label: " Help ",
      tags: true,
      border: {
        type: "line",
      },
      style: {
        fg: "white",
        border: {
          fg: "white",
        },
      },
      content:
        "{bold}Keyboard Shortcuts:{/bold}\n\n" +
        "q, Ctrl-C: Quit\n" +
        "r: Refresh\n" +
        "c: Clear logs\n" +
        "f: Follow logs\n" +
        "↑/↓: Scroll logs\n" +
        "PgUp/PgDown: Scroll logs\n",
    });

    this.screen.append(this.headerBox);
    this.screen.append(this.linksBox);
    this.screen.append(this.accountsBox);
    this.screen.append(this.statsBox);
    this.screen.append(this.logsBox);
    this.screen.append(this.helpBox);
    this.screen.key(["escape", "q", "C-c"], () => process.exit(0));
    this.screen.key(["r"], () => this.refreshAll());
    this.screen.key(["c"], () => this.clearLogs());
    this.screen.key(["f"], () => this.followLogs());
    this.logsBox.key(["up"], () => this.logsBox.scroll(-1));
    this.logsBox.key(["down"], () => this.logsBox.scroll(1));
    this.logsBox.key(["pageup"], () =>
      this.logsBox.scroll(-this.logsBox.height)
    );
    this.logsBox.key(["pagedown"], () =>
      this.logsBox.scroll(this.logsBox.height)
    );

    logger.addListener(this.addLog.bind(this));

    setInterval(() => this.updateStats(), UI.REFRESH_RATE);
    setInterval(() => this.accountManager.updateAllUptimes(), 1000);

    this.refreshAll();
    this.screen.render();
  }

  updateAccounts() {
    const accounts = this.accountManager.getAllAccounts();
    let content = "";

    accounts.forEach((account, index) => {
      const {
        username,
        status,
        loginAttempts,
        loginTime,
        uptime,
        lastKeepAlive,
        stats,
        points,
        tokenExpiryTime,
      } = account;
      let statusColor;

      switch (status) {
        case ACCOUNT_STATUS.LOGGED_IN:
          statusColor = UI.COLORS.SUCCESS;
          break;
        case ACCOUNT_STATUS.LOGGING_IN:
          statusColor = UI.COLORS.WARNING;
          break;
        case ACCOUNT_STATUS.FAILED:
          statusColor = UI.COLORS.ERROR;
          break;
        default:
          statusColor = UI.COLORS.INFO;
      }

      content += `{bold}${
        index + 1
      }. ${username}{/bold} - Status: {${statusColor}-fg}${status}{/${statusColor}-fg}\n`;

      content += `   Attempts: ${loginAttempts} | `;
      if (loginTime) {
        content += `Uptime: ${msToTime(uptime)}`;
      } else {
        content += "Not logged in";
      }
      content += "\n";

      if (tokenExpiryTime && status === ACCOUNT_STATUS.LOGGED_IN) {
        const timeUntilExpiry = tokenExpiryTime - Date.now();
        const timeLeftColor =
          timeUntilExpiry < 24 * 60 * 60 * 1000
            ? UI.COLORS.WARNING
            : UI.COLORS.INFO;
        content += `   Token expires in: {${timeLeftColor}-fg}${msToTime(
          timeUntilExpiry
        )}{/${timeLeftColor}-fg}\n`;
      }

      if (points && points.lastUpdated) {
        content += `   Points: {${UI.COLORS.HIGHLIGHT}-fg}${points.total}{/${UI.COLORS.HIGHLIGHT}-fg} | `;
        content += `Twitter: ${points.twitter} | Discord: ${points.discord} | Telegram: ${points.telegram}\n`;
      }

      if (lastKeepAlive) {
        const lastKeepAliveTime = new Date(lastKeepAlive)
          .toTimeString()
          .slice(0, 8);
        content += `   Last Keepalive: ${lastKeepAliveTime} | `;
        content += `Success: {green-fg}${stats.successfulKeepAlives}{/green-fg} | `;
        content += `Failed: {red-fg}${stats.failedKeepAlives}{/red-fg}\n`;
      }

      content += "\n";
    });

    this.accountsBox.setContent(content);
    this.screen.render();
  }

  updateStats() {
    const accounts = this.accountManager.getAllAccounts();
    const totalAccounts = accounts.length;
    const loggedInAccounts = accounts.filter(
      (account) => account.status === ACCOUNT_STATUS.LOGGED_IN
    ).length;
    const failedAccounts = accounts.filter(
      (account) => account.status === ACCOUNT_STATUS.FAILED
    ).length;

    const totalKeepalives = accounts.reduce(
      (sum, account) => sum + account.stats.totalKeepAlives,
      0
    );
    const successfulKeepalives = accounts.reduce(
      (sum, account) => sum + account.stats.successfulKeepAlives,
      0
    );

    const now = new Date();
    const dateTimeStr = now.toISOString().replace("T", " ").slice(0, 19);

    let content = "";
    content += `{bold}Accounts:{/bold}\n`;
    content += `Total: ${totalAccounts}\n`;
    content += `Logged In: {green-fg}${loggedInAccounts}{/green-fg}\n`;
    content += `Failed: {${
      failedAccounts > 0 ? "red" : "white"
    }-fg}${failedAccounts}{/${failedAccounts > 0 ? "red" : "white"}-fg}\n\n`;

    content += `{bold}Keepalives:{/bold}\n`;
    content += `Total: ${totalKeepalives}\n`;

    const successRate = totalKeepalives
      ? Math.round((successfulKeepalives / totalKeepalives) * 100)
      : 0;
    let rateColor = "white";
    if (successRate > 80) rateColor = "green";
    else if (successRate > 50) rateColor = "yellow";
    else if (successRate > 0) rateColor = "red";

    content += `Success Rate: {${rateColor}-fg}${successRate}%{/${rateColor}-fg}\n\n`;
    content += `{bold}Token Management:{/bold}\n`;
    content += `Auto-refresh: {green-fg}Active{/green-fg}\n`;
    content += `Checks: Every 3h\n\n`;
    content += `{bold}Runtime:{/bold}\n`;
    content += `${msToTime(process.uptime() * 1000)}\n`;
    content += `[${dateTimeStr}]`;

    this.statsBox.setContent(content);
    this.screen.render();
  }

  addLog(logEntry) {
    if (logEntry.type === "clear") {
      this.clearLogs();
      return;
    }

    const { timestamp, type, message, color, account } = logEntry;
    const formattedTime = timestamp.replace(/^\d+-\d+-\d+ /, "");

    let logText = `[${formattedTime}] `;

    if (account) {
      logText += `[${account}] `;
    }

    logText += `{${color}-fg}[${type.toUpperCase()}]{/${color}-fg} `;

    logText +=
      type === "error" || type === "success" || type === "warning"
        ? `{${color}-fg}${message}{/${color}-fg}`
        : message;

    this.logs.push(logText);

    if (this.logs.length > UI.MAX_LOG_LINES) {
      this.logs = this.logs.slice(this.logs.length - UI.MAX_LOG_LINES);
    }

    const contentWidth = this.logsBox.width - 2;

    const formattedLogs = this.logs.map((log) => {
      if (log.length > contentWidth) {
        return log;
      }
      return log;
    });

    this.logsBox.setContent(formattedLogs.join("\n"));

    if (this.logsBox.getScrollPerc() >= 90) {
      this.logsBox.setScrollPerc(100);
    }

    this.screen.render();
  }

  clearLogs() {
    this.logs = [];
    this.logsBox.setContent("");
    this.screen.render();
  }

  followLogs() {
    this.logsBox.setScrollPerc(100);
    this.screen.render();
  }

  refreshAll() {
    this.updateAccounts();
    this.updateStats();
    this.screen.render();
  }
}
