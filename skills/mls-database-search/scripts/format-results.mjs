function display(value, fallback = "N/A") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}

function money(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "N/A";
  return `$${Math.round(Number(value)).toLocaleString("en-US")}`;
}

/** Format active rows into compact cards suitable for terminal or WhatsApp. */
export function formatActiveListingCards(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "No active listings matched those filters.";
  return rows.map((row, index) => {
    const address = [row.L_Address, row.L_City, row.L_Zip].filter(Boolean).join(", ");
    const agent = [row.LA1_UserFirstName, row.LA1_UserLastName].filter(Boolean).join(" ");
    return [
      `${index + 1}. ${address || "Address unavailable"}`,
      `   ${money(row.price)} | ${display(row.beds)} bd / ${display(row.baths)} ba | ${display(row.sqft)} sqft`,
      `   ${display(row.type)} | ${display(row.DaysOnMarket)} DOM | ${display(row.PhotoCount, "0")} photos`,
      `   MLS: ${display(row.L_DisplayId || row.L_ListingID)} | Agent: ${agent || "N/A"}`,
    ].join("\n");
  }).join("\n\n");
}

/** Format sold rows without implying that historical comps are active. */
export function formatSoldCompCards(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return "No sold comps matched that city and date range.";
  return rows.map((row, index) => [
    `${index + 1}. ${display(row.UnparsedAddress)}, ${display(row.City)} ${display(row.PostalCode, "")}`.trim(),
    `   Closed ${display(row.CloseDate)} for ${money(row.ClosePrice)}`,
    `   ${display(row.BedroomsTotal)} bd / ${display(row.BathroomsTotalInteger)} ba | ${display(row.LivingArea)} sqft`,
    `   ${display(row.PropertySubType || row.PropertyType)} | ${display(row.DaysOnMarket)} DOM | Listing ${display(row.ListingKey)}`,
  ].join("\n")).join("\n\n");
}
