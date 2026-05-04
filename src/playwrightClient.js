const { chromium } = require("playwright");

let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium.launch({
      headless: true,
    });
  }

  return browserPromise;
}

async function withBookMyShowPage(sourceUrl, handler) {
  const browser = await getBrowser();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 2200 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
  });

  try {
    await page.goto(sourceUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(5000);
    return await handler(page);
  } finally {
    await page.close();
  }
}

async function shutdownBrowser() {
  if (!browserPromise) {
    return;
  }

  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

for (const eventName of ["SIGINT", "SIGTERM", "beforeExit"]) {
  process.once(eventName, () => {
    shutdownBrowser().catch(() => {});
  });
}

module.exports = {
  withBookMyShowPage,
  shutdownBrowser,
};
