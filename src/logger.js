import { formatLogEntry, limitArraySize } from "./utils.js";
import { UI } from "./config.js";

class Logger {
  constructor() {
    this.logs = [];
    this.listeners = new Set();
  }

  log(type, message, account = null) {
    const logEntry = formatLogEntry(type, message);

    if (account) {
      logEntry.account = account;
    }

    logEntry.message = message.replace(/\n/g, " ").replace(/\s+/g, " ").trim();

    if (logEntry.message.length > 100) {
      logEntry.message = logEntry.message.substring(0, 97) + "...";
    }

    this.logs.push(logEntry);
    this.logs = limitArraySize(this.logs, UI.MAX_LOG_LINES);
    this.notifyListeners(logEntry);

    console.log(
      `[${logEntry.timestamp}] [${type.toUpperCase()}]${
        account ? ` [${account}]` : ""
      } ${message}`
    );
  }

  info(message, account = null) {
    this.log("info", message, account);
  }

  success(message, account = null) {
    this.log("success", message, account);
  }

  error(message, account = null) {
    this.log("error", message, account);
  }

  warning(message, account = null) {
    this.log("warning", message, account);
  }

  addListener(listener) {
    this.listeners.add(listener);
  }

  removeListener(listener) {
    this.listeners.delete(listener);
  }

  notifyListeners(logEntry) {
    for (const listener of this.listeners) {
      try {
        listener(logEntry);
      } catch (error) {
        console.error("Error in log listener:", error);
      }
    }
  }

  getLogs(filter = null) {
    if (!filter) return this.logs;

    return this.logs.filter((log) => {
      if (filter.type && log.type !== filter.type) return false;
      if (filter.account && log.account !== filter.account) return false;
      if (filter.search && !log.message.includes(filter.search)) return false;
      return true;
    });
  }

  clear() {
    this.logs = [];
    this.notifyListeners({ type: "clear" });
  }
}

const logger = new Logger();
export default logger;
