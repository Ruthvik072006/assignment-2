const { checkMockAvailability } = require("./providers/mockProvider");
const { checkBookMyShowPage } = require("./providers/bookMyShowProvider");
const { sendAlertEmail } = require("./emailer");

const POLL_INTERVAL_MS = 60 * 1000;

async function pollOnce(store) {
  const alerts = store.getAlerts();

  for (const alert of alerts) {
    let result;

    if (alert.provider === "bookmyshow-page") {
      result = await checkBookMyShowPage(alert);
    } else {
      result = checkMockAvailability(store, alert);
    }

    const updated = store.savePolledResult(alert.id, result);

    if (!alert.isOpen && updated.isOpen && updated.email) {
      const emailResult = await sendAlertEmail(updated);
      store.saveEmailResult(updated.id, emailResult.error);
    }
  }
}

function startPolling(store) {
  pollOnce(store).catch((error) => {
    console.error("Initial polling failed:", error);
  });

  setInterval(() => {
    pollOnce(store).catch((error) => {
      console.error("Polling failed:", error);
    });
  }, POLL_INTERVAL_MS);
}

module.exports = {
  startPolling,
};
