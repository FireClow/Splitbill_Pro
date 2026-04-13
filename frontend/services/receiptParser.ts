export interface ParsedReceiptItem {
  name: string;
  price: number;
}

export interface ParsedReceiptResult {
  total: number | null;
  items: ParsedReceiptItem[];
}

const TOTAL_KEYWORD_REGEX = /\b(grand\s*total|total\s*due|total)\b/i;
const EXCLUDED_TOTAL_LINE_REGEX = /\b(sub\s*total|subtotal|total\s*qty|qty\s*total)\b/i;
const PRICE_TOKEN_REGEX = /(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?)/gi;
const NOISE_LINE_REGEX = /\b(tax|ppn|service|charge|tip|change|cash|payment|debit|credit|discount|promo)\b/i;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, " ").trim();

const parsePriceToken = (raw: string): number | null => {
  const cleaned = raw.replace(/[^\d.,-]/g, "").trim();
  if (!cleaned) {
    return null;
  }

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  let normalized = cleaned;

  if (hasComma && hasDot) {
    // Keep decimal separator as the rightmost symbol and strip others as thousands separators.
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasComma) {
    const parts = cleaned.split(",");
    if (parts.length > 1 && parts[parts.length - 1].length === 2) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (hasDot) {
    const parts = cleaned.split(".");
    if (!(parts.length > 1 && parts[parts.length - 1].length === 2)) {
      normalized = cleaned.replace(/\./g, "");
    }
  }

  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Number.parseFloat(parsed.toFixed(2));
};

const extractLinePrices = (line: string): number[] => {
  const matches = [...line.matchAll(PRICE_TOKEN_REGEX)];
  return matches
    .map((match) => parsePriceToken(match[1]))
    .filter((value): value is number => value !== null);
};

const cleanItemName = (line: string): string => {
  let name = line;
  name = name.replace(PRICE_TOKEN_REGEX, " ");
  name = name.replace(/^\s*\d+\s*[xX]\s*/, "");
  name = normalizeWhitespace(name);
  return name;
};

export const parseReceipt = (text: string): ParsedReceiptResult => {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeWhitespace(line))
    .filter((line) => line.length > 0);

  let detectedTotal: number | null = null;
  const allPrices: number[] = [];

  lines.forEach((line) => {
    const prices = extractLinePrices(line);
    allPrices.push(...prices);

    if (
      prices.length > 0 &&
      TOTAL_KEYWORD_REGEX.test(line) &&
      !EXCLUDED_TOTAL_LINE_REGEX.test(line)
    ) {
      detectedTotal = prices[prices.length - 1] ?? detectedTotal;
    }
  });

  if (detectedTotal === null && allPrices.length > 0) {
    // Fallback for messy OCR: pick the highest value as likely total.
    detectedTotal = Math.max(...allPrices);
  }

  const items: ParsedReceiptItem[] = [];
  const seen = new Set<string>();

  lines.forEach((line) => {
    if (TOTAL_KEYWORD_REGEX.test(line) || NOISE_LINE_REGEX.test(line)) {
      return;
    }

    const prices = extractLinePrices(line);
    if (prices.length === 0) {
      return;
    }

    const price = prices[prices.length - 1];
    if (price <= 0) {
      return;
    }

    const name = cleanItemName(line);
    if (!name || name.length < 2 || /^\d+$/.test(name)) {
      return;
    }

    const signature = `${name.toLowerCase()}::${price}`;
    if (seen.has(signature)) {
      return;
    }

    seen.add(signature);
    items.push({ name, price });
  });

  return {
    total: detectedTotal,
    items: items.slice(0, 30),
  };
};
