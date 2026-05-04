const fs = require("fs");
const { randomUUID } = require("crypto");
const { URL } = require("url");

function normalizeText(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function ensureFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}

function readJson(filePath, fallback) {
  ensureFile(filePath, fallback);
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function validateAlert(input) {
  const movie = String(input.movie || "").trim();
  const city = String(input.city || "").trim();
  const theatre = String(input.theatre || "").trim();
  const sourceUrl = String(input.sourceUrl || "").trim();
  const notes = String(input.notes || "").trim();
  const email = String(input.email || "").trim();
  const showDate = String(input.showDate || "").trim();
  const showTime = String(input.showTime || "").trim();

  if (!movie) {
    throw new Error("Movie name is required.");
  }

  if (!city) {
    throw new Error("City is required.");
  }

  if (sourceUrl) {
    try {
      new URL(sourceUrl);
    } catch (error) {
      throw new Error("Source URL must be a valid web address.");
    }
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Email must be valid.");
  }

  return { movie, city, theatre, sourceUrl, notes, email, showDate, showTime };
}

function createAlertStore({ alertsPath, mockAvailabilityPath }) {
  let alerts = readJson(alertsPath, []);
  let mockAvailability = readJson(mockAvailabilityPath, [
    {
      id: "sample-1",
      movie: "Example Movie",
      city: "Hyderabad",
      theatre: "AMB Cinemas",
      bookingOpen: false,
      bookingUrl: "https://in.bookmyshow.com",
      lastCheckedAt: null,
    },
  ]);

  function persistAlerts() {
    writeJson(alertsPath, alerts);
  }

  function persistMockAvailability() {
    writeJson(mockAvailabilityPath, mockAvailability);
  }

  function getAlerts() {
    return alerts
      .slice()
      .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt));
  }

  function getMockAvailability() {
    return mockAvailability;
  }

  function saveMockAvailability(entries) {
    mockAvailability = entries.map((entry, index) => ({
      id: entry.id || `mock-${index + 1}`,
      movie: String(entry.movie || "").trim(),
      city: String(entry.city || "").trim(),
      theatre: String(entry.theatre || "").trim(),
      bookingOpen: Boolean(entry.bookingOpen),
      bookingUrl: String(entry.bookingUrl || "https://in.bookmyshow.com").trim(),
      lastCheckedAt: entry.lastCheckedAt || null,
    }));
    persistMockAvailability();
    return mockAvailability;
  }

  function createAlert(input) {
    const validated = validateAlert(input);
    const alert = {
      id: randomUUID(),
      ...validated,
      provider: validated.sourceUrl ? "bookmyshow-page" : "mock",
      status: "watching",
      isOpen: false,
      matchedTheatre: null,
      bookingUrl: validated.sourceUrl || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastCheckedAt: null,
      lastOpenedAt: null,
      lastNotifiedAt: null,
      lastError: null,
      lastEmailError: null,
    };

    alerts = [alert, ...alerts];
    persistAlerts();
    return alert;
  }

  function updateAlert(id, updater) {
    let updatedAlert = null;

    alerts = alerts.map((alert) => {
      if (alert.id !== id) {
        return alert;
      }

      updatedAlert = {
        ...alert,
        ...updater(alert),
        updatedAt: new Date().toISOString(),
      };
      return updatedAlert;
    });

    if (!updatedAlert) {
      const error = new Error("Alert not found.");
      error.statusCode = 404;
      throw error;
    }

    persistAlerts();
    return updatedAlert;
  }

  function deleteAlert(id) {
    const nextAlerts = alerts.filter((alert) => alert.id !== id);
    if (nextAlerts.length === alerts.length) {
      const error = new Error("Alert not found.");
      error.statusCode = 404;
      throw error;
    }
    alerts = nextAlerts;
    persistAlerts();
  }

  function markAlertOpen(id) {
    return updateAlert(id, (alert) => ({
      status: "open",
      isOpen: true,
      matchedTheatre: alert.theatre || "Matched theatre",
      lastCheckedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      lastNotifiedAt: new Date().toISOString(),
      lastError: null,
    }));
  }

  function findMatchingMockEntry(alert) {
    const movie = normalizeText(alert.movie);
    const city = normalizeText(alert.city);
    const theatre = normalizeText(alert.theatre);

    return mockAvailability.find((entry) => {
      const movieMatches = normalizeText(entry.movie).includes(movie);
      const cityMatches = normalizeText(entry.city).includes(city);
      const theatreMatches = theatre
        ? normalizeText(entry.theatre).includes(theatre)
        : true;
      return movieMatches && cityMatches && theatreMatches;
    });
  }

  function savePolledResult(id, result) {
    return updateAlert(id, (alert) => {
      const now = new Date().toISOString();
      const becameOpen = !alert.isOpen && Boolean(result.isOpen);

      return {
        status: result.isOpen ? "open" : "watching",
        isOpen: Boolean(result.isOpen),
        matchedTheatre: result.matchedTheatre || null,
        bookingUrl: result.bookingUrl || alert.bookingUrl,
        lastCheckedAt: now,
        lastOpenedAt: result.isOpen ? alert.lastOpenedAt || now : alert.lastOpenedAt,
        lastNotifiedAt: becameOpen ? now : alert.lastNotifiedAt,
        lastError: result.error || null,
      };
    });
  }

  function saveEmailResult(id, emailError) {
    return updateAlert(id, () => ({
      lastEmailError: emailError || null,
    }));
  }

  return {
    getAlerts,
    getMockAvailability,
    saveMockAvailability,
    createAlert,
    deleteAlert,
    markAlertOpen,
    findMatchingMockEntry,
    savePolledResult,
    saveEmailResult,
  };
}

module.exports = {
  createAlertStore,
};
