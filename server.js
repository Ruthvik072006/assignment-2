const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");
const { URL } = require("url");

const publicDir = path.join(__dirname, "public");
const dataDir = path.join(__dirname, "data");
const statePath = path.join(dataDir, "erp-state.json");
const port = process.env.PORT || 3000;

const DEFAULT_STATE = {
  studentName: "My ERP Dashboard",
  semesterLabel: "Current semester",
  courses: [
    {
      id: randomUUID(),
      name: "Database Systems",
      code: "CSE301",
      attended: 42,
      conducted: 54,
      remainingExpected: 12,
      notes: "Sample subject",
    },
    {
      id: randomUUID(),
      name: "Operating Systems",
      code: "CSE302",
      attended: 38,
      conducted: 50,
      remainingExpected: 10,
      notes: "Sample subject",
    },
  ],
};

fs.mkdirSync(dataDir, { recursive: true });

function ensureStateFile() {
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(statePath, JSON.stringify(DEFAULT_STATE, null, 2));
  }
}

function readState() {
  ensureStateFile();
  return JSON.parse(fs.readFileSync(statePath, "utf-8"));
}

function writeState(state) {
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function clampNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function parseIntField(value, fieldName) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldName} must be a non-negative number.`);
  }
  return Math.floor(parsed);
}

function normalizeText(value) {
  return String(value || "").trim();
}

function getRecordValue(record, ...keys) {
  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key];
    }
    const lowerKey = String(key).toLowerCase();
    if (record[lowerKey] !== undefined) {
      return record[lowerKey];
    }
  }
  return undefined;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPercent(attended, conducted) {
  if (!conducted) {
    return null;
  }
  return (attended / conducted) * 100;
}

function classesNeededIfAllFutureAttended(attended, conducted, targetPercent) {
  if (!conducted && !attended) {
    return 0;
  }

  const target = targetPercent / 100;
  const current = getPercent(attended, conducted);
  if (current !== null && current >= targetPercent) {
    return 0;
  }

  const denominator = 1 - target;
  const required = (target * conducted - attended) / denominator;
  return Math.max(0, Math.ceil(required));
}

function requiredAttendanceInRemaining(attended, conducted, remainingExpected, targetPercent) {
  const remaining = clampNumber(remainingExpected, 0);
  if (!remaining) {
    return {
      mustAttend: null,
      canMiss: null,
    };
  }

  const required = Math.ceil(((targetPercent / 100) * (conducted + remaining)) - attended);
  const mustAttend = Math.max(0, Math.min(remaining, required));
  return {
    mustAttend,
    canMiss: Math.max(0, remaining - mustAttend),
  };
}

function summarizeCourse(course) {
  const attended = clampNumber(course.attended, 0);
  const conducted = clampNumber(course.conducted, 0);
  const remainingExpected = clampNumber(course.remainingExpected, 0);
  const currentPercent = getPercent(attended, conducted);

  return {
    ...course,
    attended,
    conducted,
    remainingExpected,
    currentPercent,
    requiredNow: {
      75: classesNeededIfAllFutureAttended(attended, conducted, 75),
      80: classesNeededIfAllFutureAttended(attended, conducted, 80),
    },
    remainingPlan: {
      75: requiredAttendanceInRemaining(attended, conducted, remainingExpected, 75),
      80: requiredAttendanceInRemaining(attended, conducted, remainingExpected, 80),
    },
  };
}

function summarizeState(state) {
  const courses = (state.courses || []).map(summarizeCourse);
  const totals = courses.reduce(
    (acc, course) => {
      acc.attended += course.attended;
      acc.conducted += course.conducted;
      acc.remainingExpected += course.remainingExpected;
      return acc;
    },
    { attended: 0, conducted: 0, remainingExpected: 0 },
  );

  return {
    studentName: state.studentName || "My ERP Dashboard",
    semesterLabel: state.semesterLabel || "Current semester",
    courses,
    totals: {
      ...totals,
      currentPercent: getPercent(totals.attended, totals.conducted),
      requiredNow: {
        75: classesNeededIfAllFutureAttended(totals.attended, totals.conducted, 75),
        80: classesNeededIfAllFutureAttended(totals.attended, totals.conducted, 80),
      },
      remainingPlan: {
        75: requiredAttendanceInRemaining(
          totals.attended,
          totals.conducted,
          totals.remainingExpected,
          75,
        ),
        80: requiredAttendanceInRemaining(
          totals.attended,
          totals.conducted,
          totals.remainingExpected,
          80,
        ),
      },
    },
  };
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let inQuotes = false;

  function pushCell() {
    row.push(current.trim());
    current = "";
  }

  function pushRow() {
    if (row.length || current.length) {
      if (current.length) {
        pushCell();
      }
      rows.push(row);
    }
    row = [];
    current = "";
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (!inQuotes && char === ",") {
      pushCell();
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      pushRow();
      continue;
    }

    current += char;
  }

  if (current.length || row.length) {
    pushCell();
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((cell) => cell.length));
}

function courseFromRecord(record, index) {
  const name = normalizeText(getRecordValue(record, "name", "course", "subject", "title"));
  const code = normalizeText(getRecordValue(record, "code", "subjectCode", "id") || "");
  const attended = parseIntField(
    getRecordValue(record, "attended", "attendance", "present"),
    "attended",
  );
  const conducted = parseIntField(
    getRecordValue(record, "conducted", "total", "classes"),
    "conducted",
  );
  const remainingExpected = clampNumber(
    getRecordValue(record, "remainingExpected", "remaining", "futureClasses"),
    0,
  );
  const notes = normalizeText(getRecordValue(record, "notes", "note") || "");

  if (!name) {
    throw new Error(`Row ${index + 1}: subject name is required.`);
  }

  if (!conducted) {
    throw new Error(`Row ${index + 1}: conducted classes must be greater than zero.`);
  }

  if (attended > conducted) {
    throw new Error(`Row ${index + 1}: attended classes cannot exceed conducted classes.`);
  }

  return {
    id: record.id || randomUUID(),
    name,
    code,
    attended,
    conducted,
    remainingExpected,
    notes,
  };
}

function importCoursesFromText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    throw new Error("Paste ERP data as CSV or JSON first.");
  }

  let records;
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed);
    records = Array.isArray(parsed) ? parsed : parsed.courses;
    if (!Array.isArray(records)) {
      throw new Error("JSON import must be an array or an object with a courses array.");
    }
  } else {
    const rows = parseCsv(trimmed);
    if (!rows.length) {
      throw new Error("Could not read any rows from the pasted CSV.");
    }

    const headers = rows[0].map((header) => header.trim().toLowerCase());
    records = rows.slice(1).map((row) => {
      const entry = {};
      headers.forEach((header, index) => {
        entry[header] = row[index] || "";
      });
      return entry;
    });
  }

  return records.map((record, index) => courseFromRecord(record, index));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";

    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("Payload too large."));
      }
    });

    request.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(new Error("Invalid JSON payload."));
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function serveStatic(requestPath, response) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.join(publicDir, safePath);
  const normalized = path.normalize(filePath);

  if (!normalized.startsWith(publicDir)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(normalized, (error, content) => {
    if (error) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    const ext = path.extname(normalized);
    const mimeTypes = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".svg": "image/svg+xml",
    };

    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "text/plain; charset=utf-8",
    });
    response.end(content);
  });
}

function createServer() {
  return http.createServer(async (request, response) => {
    const parsedUrl = new URL(request.url, `http://${request.headers.host}`);
    const { pathname } = parsedUrl;

    try {
      if (request.method === "GET" && pathname === "/api/state") {
        sendJson(response, 200, { state: summarizeState(readState()) });
        return;
      }

      if (request.method === "POST" && pathname === "/api/profile") {
        const payload = await readBody(request);
        const state = readState();
        state.studentName = normalizeText(payload.studentName) || state.studentName;
        state.semesterLabel = normalizeText(payload.semesterLabel) || state.semesterLabel;
        writeState(state);
        sendJson(response, 200, { state: summarizeState(state) });
        return;
      }

      if (request.method === "POST" && pathname === "/api/courses") {
        const payload = await readBody(request);
        const state = readState();
        const course = courseFromRecord(payload, state.courses.length);
        state.courses = [course, ...state.courses];
        writeState(state);
        sendJson(response, 201, { course: summarizeCourse(course), state: summarizeState(state) });
        return;
      }

      if (request.method === "PATCH" && pathname.startsWith("/api/courses/")) {
        const id = pathname.split("/").pop();
        const payload = await readBody(request);
        const state = readState();
        const index = state.courses.findIndex((course) => course.id === id);
        if (index < 0) {
          const error = new Error("Course not found.");
          error.statusCode = 404;
          throw error;
        }

        const existing = state.courses[index];
        const updated = courseFromRecord(
          {
            ...existing,
            ...payload,
            id: existing.id,
          },
          index,
        );
        state.courses[index] = updated;
        writeState(state);
        sendJson(response, 200, { course: summarizeCourse(updated), state: summarizeState(state) });
        return;
      }

      if (request.method === "DELETE" && pathname.startsWith("/api/courses/")) {
        const id = pathname.split("/").pop();
        const state = readState();
        const nextCourses = state.courses.filter((course) => course.id !== id);
        if (nextCourses.length === state.courses.length) {
          const error = new Error("Course not found.");
          error.statusCode = 404;
          throw error;
        }
        state.courses = nextCourses;
        writeState(state);
        sendJson(response, 200, { ok: true, state: summarizeState(state) });
        return;
      }

      if (request.method === "POST" && pathname === "/api/import") {
        const payload = await readBody(request);
        const importedCourses = importCoursesFromText(payload.text);
        const state = readState();
        const mode = normalizeText(payload.mode).toLowerCase() === "append" ? "append" : "replace";

        state.courses = mode === "append" ? [...importedCourses, ...state.courses] : importedCourses;
        if (payload.studentName) {
          state.studentName = normalizeText(payload.studentName);
        }
        if (payload.semesterLabel) {
          state.semesterLabel = normalizeText(payload.semesterLabel);
        }

        writeState(state);
        sendJson(response, 200, {
          imported: importedCourses.length,
          state: summarizeState(state),
        });
        return;
      }

      if (request.method === "POST" && pathname === "/api/reset") {
        writeState(DEFAULT_STATE);
        sendJson(response, 200, { state: summarizeState(readState()) });
        return;
      }

      serveStatic(pathname, response);
    } catch (error) {
      const status = error.statusCode || 400;
      sendJson(response, status, {
        error: error.message || "Something went wrong",
      });
    }
  });
}

if (require.main === module) {
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`ERP analyzer running on http://localhost:${port}`);
  });
}

module.exports = {
  createServer,
  summarizeState,
  summarizeCourse,
  importCoursesFromText,
  parseCsv,
};
