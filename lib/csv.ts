/** CSV generation and sanitisation utility.
 * Implements RFC 4180 escaping and mitigates CSV formula injection (CWE-1236).
 */

const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r", "%"];

/**
 * Escapes and sanitises a single CSV field value.
 * - Encloses strings containing commas, newlines, or double quotes in double quotes.
 * - Doubles internal double quotes (" -> "").
 * - Neutralises spreadsheet formula injection by prepending an apostrophe (').
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // CSV Formula Injection mitigation (CWE-1236)
  // If the string starts with a formula trigger character, prepend a single quote (')
  if (typeof value === "string" && FORMULA_PREFIXES.some((prefix) => str.startsWith(prefix))) {
    str = `'${str}`;
  }

  // RFC 4180: If the string contains comma, quote, or newline, escape quotes and wrap in quotes
  if (str.includes('"') || str.includes(",") || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * Formats an array of cell values into a single RFC 4180 compliant CSV row.
 */
export function toCsvRow(cells: unknown[]): string {
  return cells.map(escapeCsvCell).join(",");
}

/**
 * Generates full CSV content from headers and rows.
 */
export function generateCsv(headers: string[], rows: unknown[][]): string {
  const lines: string[] = [];
  if (headers.length > 0) {
    lines.push(toCsvRow(headers));
  }
  for (const row of rows) {
    lines.push(toCsvRow(row));
  }
  return lines.join("\r\n") + "\r\n";
}

export interface TransactionExportRow {
  id: number;
  date: string;
  customerName: string;
  amountPaise: number;
  pointsEarned: number;
  status: string;
  idempotencyKey?: string;
}

/**
 * Formats a list of transactions for CSV export.
 */
export function formatTransactionsCsv(transactions: TransactionExportRow[]): string {
  const headers = [
    "Transaction ID",
    "Date",
    "Customer Name",
    "Amount (INR)",
    "Points Earned",
    "Status",
    "Idempotency Key",
  ];

  const rows = transactions.map((tx) => [
    tx.id,
    tx.date,
    tx.customerName,
    (tx.amountPaise / 100).toFixed(2),
    tx.pointsEarned,
    tx.status,
    tx.idempotencyKey ?? "",
  ]);

  return generateCsv(headers, rows);
}

export interface CustomerExportRow {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  totalSpendPaise: number;
  pointsBalance: number;
  tier: string;
  joinedAt?: string;
}

/**
 * Formats a list of customers for CSV export.
 */
export function formatCustomersCsv(customers: CustomerExportRow[]): string {
  const headers = [
    "Customer ID",
    "Name",
    "Email",
    "Phone",
    "Lifetime Spend (INR)",
    "Points Balance",
    "Loyalty Tier",
    "Joined Date",
  ];

  const rows = customers.map((c) => [
    c.id,
    c.name,
    c.email,
    c.phone ?? "",
    (c.totalSpendPaise / 100).toFixed(2),
    c.pointsBalance,
    c.tier,
    c.joinedAt ?? "",
  ]);

  return generateCsv(headers, rows);
}
