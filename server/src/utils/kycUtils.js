const CNIC_PATTERN = /^\d{5}-\d{7}-\d$/;

const normalizeSpace = (value) => String(value || "").replace(/\s+/g, " ").trim();

export const normalizeName = (value) =>
  normalizeSpace(value)
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const normalizeCnic = (value) => {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length !== 13) {
    return "";
  }

  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
};

export const isValidCnic = (value) => CNIC_PATTERN.test(String(value || ""));

export const normalizeDob = (value) => {
  if (!value) {
    return "";
  }

  const text = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  if (/^\d{2}[./-]\d{2}[./-]\d{4}$/.test(text)) {
    const [day, month, year] = text.split(/[./-]/).map((part) => Number(part));
    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;
  }

  return "";
};

export const isSameDate = (left, right) => normalizeDob(left) !== "" && normalizeDob(left) === normalizeDob(right);

export const parseCnicText = (text) => {
  const raw = String(text || "");
  const normalized = raw.replace(/\r/g, "");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const cnicMatch = normalized.match(/\b\d{5}-?\d{7}-?\d\b/);
  const dobMatch = normalized.match(/\b\d{2}[./-]\d{2}[./-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/);

  const excludedKeywords = [
    "identity",
    "card",
    "national",
    "pakistan",
    "gender",
    "father",
    "husband",
    "signature",
    "expiry",
    "issue",
    "cnic",
    "dob",
    "birth",
  ];

  let name = "";

  for (const line of lines) {
    const lowered = line.toLowerCase();

    if (line.length < 3 || /\d/.test(line)) {
      continue;
    }

    if (excludedKeywords.some((keyword) => lowered.includes(keyword))) {
      continue;
    }

    if (/^[a-z\s.]+$/i.test(line)) {
      name = normalizeSpace(line);
      break;
    }
  }

  return {
    name,
    cnic: cnicMatch ? normalizeCnic(cnicMatch[0]) : "",
    dob: dobMatch ? normalizeDob(dobMatch[0]) : "",
    rawText: normalized,
  };
};

export const isNameMatch = (inputName, extractedName) => {
  const left = normalizeName(inputName);
  const right = normalizeName(extractedName);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  const leftTokens = new Set(left.split(" ").filter(Boolean));
  const rightTokens = new Set(right.split(" ").filter(Boolean));

  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      overlap += 1;
    }
  }

  const minTokenCount = Math.min(leftTokens.size, rightTokens.size);
  return minTokenCount > 0 && overlap / minTokenCount >= 0.7;
};
