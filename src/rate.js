/**
 * Parse and format BYN → USD for the content script.
 * Exposes API on `globalThis.AvByUsdRate` (no bundler).
 */
(function initAvByUsdRate(global) {
  "use strict";

  /**
   * Minimum whole BYN amount to convert; smaller matches are left as-is.
   * @type {number}
   */
  const MIN_BYN = 1;

  /** Normal and narrow/figure spaces (av.by often uses U+00A0). */
  const THOU_SEP = "[ \\u00A0\\u202F\\u2007\\u2008\\u2009\\u200A]";

  /**
   * Integer + optional 1–2 digit decimal (site may use `,` or `.`).
   * Order matters: e.g. `2.29` before bare `2` to avoid `29` matching separately.
   * Allows `1 234,56` (space groups), `1.234,50` (dot groups) on edge cases.
   */
  const NUM_PART =
    `(?:` +
    `\\d{1,3}[.,]\\d{1,2}` +
    `|` +
    `\\d{1,3}(?:${THOU_SEP}\\d{3})+(?:[.,]\\d{1,2})?` +
    `|` +
    `\\d{1,3}(?:\\.\\d{3})+(?:[.,]\\d{1,2})?` +
    `|` +
    `\\d{4,8}(?:[.,]\\d{1,2})?` +
    `|` +
    `\\d{1,3}` +
    `)`;

  /**
   * BYN labels; longer spellings before the short "р" in the alternation.
   * `NUM_PART` is kept here so a single `2.29` (not `2` + `29`) matches before the currency.
   */
  const PRICE_PATTERN = new RegExp(
    `(${NUM_PART})` + `\\s*(?:рублей|рубля|руб\\.?|р\\.?|BYN|p\\.)(?=\\s|$|[,.;:!?\\"'«»]|\\)|\\])`,
    "gi"
  );

  const DIGIT_GROUP_STRIP = /[ \u00A0\u202F\u2007\u2008\u2009\u200A]/g;

  /**
   * @param {string} fragment
   * @returns {number}
   */
  function parseBynNumber(fragment) {
    let s = String(fragment).trim().replace(DIGIT_GROUP_STRIP, "");
    if (!s) return NaN;

    if (/^\d{1,3}(?:\.\d{3})+(?:[.,]\d{1,2})?$/.test(s)) {
      s = s.replace(/\./g, "");
      s = s.replace(/,(\d{1,2})$/, ".$1");
    }

    if (/^\d+,\d{1,2}$/.test(s)) {
      s = s.replace(/,/g, ".");
    } else {
      s = s.replace(DIGIT_GROUP_STRIP, "");
    }

    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : NaN;
    }
    if (/^\d+\.\d{1,2}$/.test(s)) {
      const f = parseFloat(s);
      return Number.isFinite(f) ? f : NaN;
    }
    const f = parseFloat(s.replace(/,/g, "."));
    return Number.isFinite(f) ? f : NaN;
  }

  /**
   * Round up to a whole dollar.
   * @param {number} amount
   * @returns {string}
   */
  function formatUsd(amount) {
    const dollars = Math.ceil(amount);
    const s = String(Math.abs(dollars));
    return `~$${s.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
  }

  /**
   * @param {string} text
   * @param {number} bynPerUsd — how many BYN per 1 USD (NBRB rate)
   * @returns {string}
   */
  function bynTextToUsdString(text, bynPerUsd) {
    if (!bynPerUsd || bynPerUsd <= 0) return text;
    PRICE_PATTERN.lastIndex = 0;
    return text.replace(PRICE_PATTERN, (match, numPart) => {
      const byn = parseBynNumber(numPart);
      if (!Number.isFinite(byn) || byn < MIN_BYN) return match;
      return formatUsd(byn / bynPerUsd);
    });
  }

  global.AvByUsdRate = {
    MIN_BYN,
    parseBynNumber,
    formatUsd,
    bynTextToUsdString,
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
