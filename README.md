# Dawn Login Automation

A Node.js automation tool for managing and maintaining Dawn accounts with automatic login, keepalive, and token management features.

## Features

- **Multi-Account Support**: Manage multiple Dawn accounts simultaneously
- **Automatic Login**: Handles login process with captcha solving
- **Keepalive Management**: Sends periodic keepalive requests to maintain session
- **Token Management**: Automatically refreshes tokens before expiration
- **Points Tracking**: Monitors referral points from various platforms
- **Interactive Dashboard**: Real-time monitoring of account status, statistics, and logs

## Requirements

- Node.js 14.x or higher
- NPM or Yarn
- AntiCaptcha API key (for solving captchas)
- Internet connection

## Installation

1. Clone the repository:

```bash
git clone https://github.com/WINGFO-HQ/Dawn-BOT.git
cd Dawn-BOT
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory with the following content:

```
ANTICAPTCHA_API_KEY=your_anticaptcha_api_key
PROXY_URL=your_proxy_url_if_needed
```

4. Create an `account.key` file in the root directory with your accounts (one per line):

```
username1:password1
username2:password2
username3:password3
```

## Usage

Run the application:

```bash
node main.js
```

The dashboard will start, and the application will begin processing accounts automatically.

### Dashboard Controls

- `q` or `Ctrl+C`: Quit the application
- `r`: Refresh the dashboard
- `c`: Clear logs
- `f`: Follow logs (auto-scroll)
- `↑/↓`: Scroll logs
- `PgUp/PgDown`: Scroll logs by page

## Dashboard Sections

- **Header**: Shows the application title and community links
- **Accounts**: Displays status, login attempts, uptime, and points for each account
- **Statistics**: Shows overall account status, keepalive success rates, and runtime
- **Logs**: Real-time log output from the application
- **Help**: Quick reference for keyboard shortcuts

## File Structure

- `main.js`: Application entry point
- `src/accounts.js`: Account and account manager classes
- `src/api.js`: API interaction functions
- `src/captcha.js`: Captcha solving implementation
- `src/config.js`: Application configuration
- `src/dashboard.js`: Terminal UI implementation
- `src/logger.js`: Logging functionality
- `src/utils.js`: Utility functions

## Community Links

- Telegram Channel: [https://t.me/infomindao](https://t.me/infomindao)
- Telegram Group: [https://t.me/WINGFO_DAO](https://t.me/WINGFO_DAO)

## License

MIT

## Disclaimer

This tool is provided for educational purposes only. Use at your own risk and responsibility.
