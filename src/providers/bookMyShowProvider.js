const { withBookMyShowPage } = require("../playwrightClient");
const { parseShowsFromText } = require("./bookMyShowImport");

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function includesAny(text, candidates) {
  return candidates.some((candidate) => text.includes(normalizeText(candidate)));
}

async function checkBookMyShowPage(alert) {
  if (!alert.sourceUrl) {
    return {
      isOpen: false,
      matchedTheatre: null,
      bookingUrl: null,
      error: "No BookMyShow URL was provided.",
    };
  }

  try {
    const parsed = await withBookMyShowPage(alert.sourceUrl, async (page) => {
      const title = await page.title();
      const bodyText = await page.locator("body").innerText();
      return parseShowsFromText(bodyText, alert.sourceUrl, title);
    });

    const content = normalizeText(JSON.stringify(parsed));
    const movieMatches = includesAny(content, [alert.movie]);
    const cityMatches = includesAny(content, [alert.city]);
    const theatreMatches = alert.theatre ? includesAny(content, [alert.theatre]) : true;
    const showTimeMatches = alert.showTime ? includesAny(content, [alert.showTime]) : true;
    const exactShow = parsed.shows.find((show) => {
      const movieOk = normalizeText(show.movie) === normalizeText(alert.movie);
      const theatreOk = alert.theatre
        ? normalizeText(show.theatre).includes(normalizeText(alert.theatre))
        : true;
      const timeOk = alert.showTime
        ? normalizeText(show.time) === normalizeText(alert.showTime)
        : true;
      return movieOk && theatreOk && timeOk;
    });

    const isOpen =
      movieMatches &&
      cityMatches &&
      theatreMatches &&
      showTimeMatches &&
      Boolean(exactShow || (!alert.showTime && parsed.shows.length));

    return {
      isOpen,
      matchedTheatre: exactShow ? exactShow.theatre : theatreMatches ? alert.theatre || "Matched on page" : null,
      bookingUrl: alert.sourceUrl,
      error: null,
    };
  } catch (error) {
    return {
      isOpen: false,
      matchedTheatre: null,
      bookingUrl: alert.sourceUrl,
      error: `BookMyShow page check failed. ${error.message || "The site may be blocking automated requests."}`,
    };
  }
}

module.exports = {
  checkBookMyShowPage,
};
