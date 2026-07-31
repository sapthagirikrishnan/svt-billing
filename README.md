# GST BillBook — GST Billing Application

A self-contained, offline-first GST billing app (invoices, products, customers,
GST/CGST/SGST/IGST calculation, reports, multi-user login) that runs locally
on your computer in a browser tab. All data is stored in your browser's
local storage on this machine — nothing is sent to a server.

## Requirements

- **Node.js** (LTS version, 18 or newer). Download and install from
  https://nodejs.org if you don't already have it. Node.js includes `npm`,
  which is what actually installs and runs this app.

## Install & Run (Windows, Command Prompt)

1. Unzip this folder anywhere, e.g. `C:\GSTBillingApp`.
2. Open the folder in **File Explorer**.
3. Double-click **`install.bat`**. This runs `npm install` and downloads
   the packages the app needs (React, Tailwind, charts, icons, etc.).
   Only needs to be done once. Requires an internet connection.
4. Once install finishes, double-click **`start.bat`**.
5. Your browser will open automatically at **http://localhost:5000** with
   the app running.
6. Log in with the default account:
   - **User ID:** `admin`
   - **Password:** `admin123`
   (Change this, or add more users, from Settings → Users after logging in.)

To stop the app, close the black command-prompt window that `start.bat`
opened (or press `Ctrl+C` inside it).

## Install & Run (manual, any OS)

If you prefer typing commands yourself instead of using the `.bat` files:

```
cd path\to\gst-billing-app
npm install
npm run dev
```

Then open http://localhost:5000 in your browser.

## Building a static, offline copy (optional)

If you want a version you can open without running a dev server every time:

```
npm run build
```

This creates a `dist/` folder containing plain HTML/CSS/JS. You can serve
that folder with any static file server, or open `dist/index.html` directly
in a browser (some features like PDF export require serving it over
`http://`, not `file://`, so a simple local server is recommended — e.g.
`npx serve dist`).

## Notes

- Your data (invoices, products, customers, users) is saved to this
  browser's local storage on this computer. Using a different browser or
  clearing browsing data will start you over with the sample data.
- PDF export downloads two small libraries (`html2canvas`, `jsPDF`) from a
  CDN the first time you use it — this requires an internet connection for
  that feature specifically; everything else works fully offline.
- Default login: `admin` / `admin123`. Please change this after first login.

## Troubleshooting

- **"node is not recognized..."** — Node.js isn't installed or isn't in your
  PATH. Install it from https://nodejs.org, then close and reopen Command
  Prompt before trying again.
- **`npm install` fails with permission errors** — try running Command
  Prompt as Administrator, or make sure the folder isn't inside a
  OneDrive-synced/locked directory.
- **Port 5000 already in use** — close whatever else is using it, or edit
  `vite.config.js` and change `port: 5000` to another number (e.g. 5173).
