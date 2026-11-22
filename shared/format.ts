/** Formatting shared by the web UI and the MCP tool summaries. */
export const formatMoney = (cents: number): string => `€${(cents / 100).toFixed(2)}`;
