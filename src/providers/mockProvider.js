function checkMockAvailability(store, alert) {
  const match = store.findMatchingMockEntry(alert);

  return {
    isOpen: Boolean(match && match.bookingOpen),
    matchedTheatre: match ? match.theatre : null,
    bookingUrl: match ? match.bookingUrl : alert.bookingUrl,
    error: null,
  };
}

module.exports = {
  checkMockAvailability,
};
