async function sendAlertEmail(alert) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM_EMAIL;

  if (!alert.email) {
    return { ok: false, error: "No email address is set for this alert." };
  }

  if (!apiKey || !from) {
    return {
      ok: false,
      error: "Email is not configured. Set RESEND_API_KEY and ALERT_FROM_EMAIL.",
    };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [alert.email],
      subject: `Tickets open: ${alert.movie} at ${alert.theatre || "your selected theatre"}`,
      html: [
        `<p>Your BookMyShow alert is live.</p>`,
        `<p><strong>Movie:</strong> ${alert.movie}</p>`,
        `<p><strong>City:</strong> ${alert.city}</p>`,
        `<p><strong>Theatre:</strong> ${alert.theatre || alert.matchedTheatre || "Matched theatre"}</p>`,
        `<p><strong>Showtime:</strong> ${alert.showDate || "Selected date"} ${alert.showTime || ""}</p>`,
        `<p><a href="${alert.bookingUrl || alert.sourceUrl || "https://in.bookmyshow.com"}">Open BookMyShow</a></p>`,
      ].join(""),
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      error: `Email delivery failed: ${response.status} ${text}`.slice(0, 280),
    };
  }

  return { ok: true, error: null };
}

module.exports = {
  sendAlertEmail,
};
