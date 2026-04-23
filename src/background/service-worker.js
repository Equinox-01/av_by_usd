/**
 * Service worker (MV3): NBRB USD rate, cache, alarms, replies to the content script.
 */
"use strict";

importScripts(chrome.runtime.getURL("src/shared/messages.js"));

const NBRB_USD_URL = "https://api.nbrb.by/exrates/rates/USD?parammode=2";
const ALARM_NAME = "avbyusd-refresh-nbrb";
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const ALARM_PERIOD_MINUTES = 360;
const FETCH_TIMEOUT_MS = 15_000;
const LOG_PREFIX = "[av-by-usd]";

const STORAGE_KEYS = {
  bynPerUsd: "bynPerUsd",
  rateDate: "rateDate",
  updatedAt: "updatedAt",
};

/**
 * @param {unknown} data
 * @returns {{ bynPerUsd: number, rateDate: string }}
 * @see https://api.nbrb.by/exrates/rates/USD?parammode=2
 */
function parseRatePayload(data) {
  if (
    !data ||
    typeof data !== "object" ||
    typeof data.Cur_OfficialRate !== "number" ||
    typeof data.Cur_Scale !== "number"
  ) {
    throw new Error("Unexpected NBRB response shape");
  }
  const scale = data.Cur_Scale;
  if (scale <= 0) throw new Error("Invalid Cur_Scale");
  const bynPerUsd = data.Cur_OfficialRate / scale;
  if (!(bynPerUsd > 0)) throw new Error("Invalid rate");
  const dateRaw = data.Date || "";
  const rateDate = typeof dateRaw === "string" ? dateRaw.split("T")[0] : "";
  return { bynPerUsd, rateDate };
}

async function fetchNbrbUsd() {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(NBRB_USD_URL, { cache: "no-store", signal: ac.signal });
    if (!res.ok) throw new Error(`NBRB HTTP ${res.status}`);
    const data = await res.json();
    return parseRatePayload(data);
  } finally {
    clearTimeout(t);
  }
}

function readCache() {
  return chrome.storage.local.get([
    STORAGE_KEYS.bynPerUsd,
    STORAGE_KEYS.rateDate,
    STORAGE_KEYS.updatedAt,
  ]);
}

async function writeCache(bynPerUsd, rateDate) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.bynPerUsd]: bynPerUsd,
    [STORAGE_KEYS.rateDate]: rateDate,
    [STORAGE_KEYS.updatedAt]: Date.now(),
  });
}

async function refreshRateFromNetwork() {
  const parsed = await fetchNbrbUsd();
  await writeCache(parsed.bynPerUsd, parsed.rateDate);
  return parsed;
}

/**
 * If cache is not older than CACHE_MAX_AGE_MS, use it; else fetch. If the NBRB API is unavailable on
 * refresh, return ok: false (site prices stay in BYN; the content script does not substitute; no stale rate).
 * @returns {Promise<GetRateResponse>}
 */
async function getRateForMessage() {
  const cache = await readCache();
  const byn = cache[STORAGE_KEYS.bynPerUsd];
  const updatedAt = cache[STORAGE_KEYS.updatedAt];
  const rateDate = cache[STORAGE_KEYS.rateDate];
  const fresh =
    typeof byn === "number" &&
    typeof updatedAt === "number" &&
    Date.now() - updatedAt < CACHE_MAX_AGE_MS;

  if (fresh) {
    return { ok: true, bynPerUsd: byn, rateDate: rateDate || "", fromCache: true };
  }

  try {
    const live = await refreshRateFromNetwork();
    return {
      ok: true,
      bynPerUsd: live.bynPerUsd,
      rateDate: live.rateDate,
      fromCache: false,
    };
  } catch (e) {
    const err = e instanceof Error ? e.message : String(e);
    return { ok: false, error: err };
  }
}

function scheduleAlarm() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleAlarm();
  refreshRateFromNetwork().catch((e) => {
    console.debug(LOG_PREFIX, "NBRB refresh on install failed", e);
  });
});

chrome.runtime.onStartup.addListener(() => {
  scheduleAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  refreshRateFromNetwork().catch((e) => {
    console.debug(LOG_PREFIX, "NBRB refresh on alarm failed", e);
  });
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== AvByUsdMessageType.GET_RATE) return;
  getRateForMessage()
    .then(sendResponse)
    .catch((e) => {
      const err = e instanceof Error ? e.message : String(e);
      sendResponse({ ok: false, error: err });
    });
  return true;
});
