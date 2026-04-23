/**
 * av.by content script: replace displayed BYN prices with USD.
 * Depends on `src/shared/messages.js`, `src/rate.js` (global `AvByUsdRate`); order is set in the manifest.
 */
"use strict";

const DEBOUNCE_MS = 80;
const LOG_PREFIX = "[av-by-usd]";

/** Selector: class contains "price" (including e.g. "prices", "price-primary"). */
const PRICE_CLASS_SEL = '[class*="price"], [class*="Price"]';

const ATTRS_WITH_TEXT = ["data-title", "data-text", "aria-label", "title", "placeholder"];

const SKIP_ANCESTOR_SEL = "script, style, textarea, noscript";
const SKIP_HOST_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "NOSCRIPT"]);

const rateApi = typeof AvByUsdRate !== "undefined" ? AvByUsdRate : null;

function looksLikePriceText(raw) {
  return !!(raw && /(р|BYN|руб|p\.)/i.test(raw));
}

/**
 * @param {Element} el
 * @returns {boolean} True if this node or its subtree should not be rewritten.
 */
function isSkippedDomLocation(el) {
  if (!el) return true;
  if (SKIP_HOST_TAGS.has(el.tagName)) return true;
  if (el.closest(SKIP_ANCESTOR_SEL)) return true;
  if (el.isContentEditable) return true;
  if (el.closest("[contenteditable='true']")) return true;
  return false;
}

function hasInteractiveFormFields(el) {
  if (!el?.querySelectorAll) return false;
  const fields = el.querySelectorAll("input, select, textarea");
  for (const n of fields) {
    if (n.tagName === "INPUT" && n.type === "hidden") continue;
    return true;
  }
  return false;
}

/**
 * @param {Text} node
 * @returns {boolean}
 */
function skipTextNode(node) {
  return isSkippedDomLocation(node.parentElement);
}

/**
 * @param {string} text
 * @param {number} bynPerUsd
 * @returns {string|null}
 */
function transformText(text, bynPerUsd) {
  if (!rateApi || !text) return null;
  const next = rateApi.bynTextToUsdString(text, bynPerUsd);
  return next === text ? null : next;
}

function walkAndConvert(bynPerUsd) {
  if (!bynPerUsd || !rateApi || !document.body) return;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
  const nodes = [];
  let node;
  while ((node = walker.nextNode())) {
    nodes.push(node);
  }
  for (const textNode of nodes) {
    if (skipTextNode(textNode)) continue;
    const t = textNode.nodeValue;
    if (!t || !looksLikePriceText(t)) continue;
    const updated = transformText(t, bynPerUsd);
    if (updated !== null) textNode.nodeValue = updated;
  }
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
function skipListingElement(el) {
  if (!el?.closest) return true;
  return isSkippedDomLocation(el);
}

/**
 * "Leaf" elements with a *price* class: skip wrappers that contain nested *price* (e.g. + leasing).
 */
function convertPriceClassBlocks(bynPerUsd) {
  if (!bynPerUsd || !rateApi || !document.body) return;
  const all = document.querySelectorAll(PRICE_CLASS_SEL);
  const leaves = [];
  for (const el of all) {
    if (skipListingElement(el)) continue;
    if (hasInteractiveFormFields(el)) continue;
    if (el.querySelector?.(PRICE_CLASS_SEL)) continue;
    leaves.push(el);
  }
  for (const el of leaves) {
    const raw = el.textContent;
    if (!looksLikePriceText(raw)) continue;
    const next = transformText(raw, bynPerUsd);
    if (next !== null) el.textContent = next;
  }
}

function convertPriceAttributes(bynPerUsd) {
  if (!bynPerUsd || !rateApi || !document.body) return;
  const nodes = document.querySelectorAll(
    "[data-title], [data-text], [aria-label], [title], [placeholder]"
  );
  for (const el of nodes) {
    if (skipListingElement(el)) continue;
    for (const name of ATTRS_WITH_TEXT) {
      if (!el.hasAttribute(name)) continue;
      const raw = el.getAttribute(name);
      if (!raw || !looksLikePriceText(raw)) continue;
      const next = transformText(raw, bynPerUsd);
      if (next !== null) el.setAttribute(name, next);
    }
  }
}

function requestRateAndRun() {
  if (!chrome.runtime?.sendMessage) return;
  chrome.runtime.sendMessage({ type: AvByUsdMessageType.GET_RATE }, (res) => {
    if (chrome.runtime.lastError) {
      console.debug(LOG_PREFIX, "sendMessage failed", chrome.runtime.lastError.message);
      return;
    }
    if (!res?.ok || typeof res.bynPerUsd !== "number") {
      console.debug(LOG_PREFIX, "no rate; keeping BYN", res);
      return;
    }
    convertPriceClassBlocks(res.bynPerUsd);
    convertPriceAttributes(res.bynPerUsd);
    walkAndConvert(res.bynPerUsd);
  });
}

let debounceTimer = null;
let rafId = 0;

function scheduleRun() {
  if (rafId) return;
  rafId = requestAnimationFrame(() => {
    rafId = 0;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      requestRateAndRun();
    }, DEBOUNCE_MS);
  });
}

function start() {
  requestRateAndRun();
  const mo = new MutationObserver(() => {
    scheduleRun();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
}

if (document.body) {
  start();
} else {
  document.addEventListener("DOMContentLoaded", start);
}
