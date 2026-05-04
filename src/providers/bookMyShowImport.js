const { withBookMyShowPage } = require("../playwrightClient");

function decodeHtml(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function cleanLine(text) {
  return decodeHtml(text)
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalize(text) {
  return cleanLine(text).toLowerCase();
}

function isNoiseLine(line) {
  const value = normalize(line);
  if (!value) {
    return true;
  }

  const blocked = [
    "bookmyshow",
    "available",
    "fast filling",
    "subtitles language",
    "see showtimes in other nearby cinemas",
    "movies now showing",
    "details",
    "home",
    "cinemas in",
    "select price range",
    "select show timings",
    "food court",
    "parking facility",
    "m-ticket",
    "wheel chair facility",
    "f&b",
  ];

  return blocked.some((item) => value === item || value.startsWith(`${item} `));
}

function isTimeLine(line) {
  return /\b\d{1,2}:\d{2}\s?(am|pm)\b/i.test(line);
}

function isFormatLine(line) {
  const value = normalize(line);
  return /(2d|3d|imax|4dx|dolby|hindi|telugu|tamil|english|malayalam|kannada|marathi)/i.test(
    value,
  );
}

function toMovieTitle(line) {
  return cleanLine(line).replace(/\((ua|u|a|ua\d+\+)[^)]+\)$/i, "").trim();
}

function isMovieCandidate(line) {
  const value = cleanLine(line);
  if (!value || isNoiseLine(value) || isTimeLine(value) || isFormatLine(value)) {
    return false;
  }

  if (value.length < 2 || value.length > 90) {
    return false;
  }

  if (!/[a-z]/i.test(value)) {
    return false;
  }

  return /[A-Z]/.test(value) || /\(/.test(value);
}

function extractTitle(html) {
  const match = html.match(/<title>([\s\S]*?)<\/title>/i);
  return cleanLine(match ? match[1] : "");
}

function inferLocationFromTitle(title) {
  const parts = title.split("|")[0].split(",").map((item) => item.trim()).filter(Boolean);
  const theatre = parts[0] || "";
  const city = parts[1] || "";
  return { theatre, city };
}

function parseShowsFromText(text, pageUrl, title = "") {
  const lines = String(text || "")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const inferred = inferLocationFromTitle(title);
  const shows = [];
  let currentMovie = "";
  let currentFormat = "";

  for (const line of lines) {
    if (isNoiseLine(line)) {
      continue;
    }

    if (isMovieCandidate(line)) {
      currentMovie = toMovieTitle(line);
      currentFormat = "";
      continue;
    }

    if (isFormatLine(line)) {
      currentFormat = cleanLine(line);
      continue;
    }

    if (isTimeLine(line) && currentMovie) {
      const match = line.match(/\b\d{1,2}:\d{2}\s?(AM|PM)\b/i);
      shows.push({
        movie: currentMovie,
        time: match ? match[0].toUpperCase() : cleanLine(line),
        format: currentFormat,
        theatre: inferred.theatre,
        city: inferred.city,
        bookingUrl: pageUrl,
      });
    }
  }

  const uniqueShows = shows.filter((show, index) => {
    const key = `${show.movie}::${show.time}::${show.format}`;
    return (
      shows.findIndex((candidate) => {
        return `${candidate.movie}::${candidate.time}::${candidate.format}` === key;
      }) === index
    );
  });

  return {
    theatre: inferred.theatre,
    city: inferred.city,
    title,
    shows: uniqueShows,
  };
}

function parseShowsFromHtml(html, pageUrl) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n");
  const title = extractTitle(html);
  return parseShowsFromText(stripped, pageUrl, title);
}

async function importBookMyShowTheatrePage(sourceUrl) {
  if (!sourceUrl) {
    throw new Error("A BookMyShow theatre page URL is required.");
  }

  let url;
  try {
    url = new URL(sourceUrl);
  } catch (error) {
    throw new Error("BookMyShow URL must be valid.");
  }

  try {
    const parsed = await withBookMyShowPage(url.toString(), async (page) => {
      const title = await page.title();
      const bodyText = await page.locator("body").innerText();
      return parseShowsFromText(bodyText, url.toString(), title);
    });

    if (!parsed.shows.length) {
      throw new Error("Could not extract movies and showtimes from that BookMyShow page.");
    }

    return parsed;
  } catch (error) {
    throw new Error(
      `BookMyShow import failed. ${error.message || "The page could not be loaded in the browser."}`,
    );
  }
}

module.exports = {
  importBookMyShowTheatrePage,
  parseShowsFromHtml,
  parseShowsFromText,
};
