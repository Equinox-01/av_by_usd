/**
 * @typedef {Object} GetRateResponse
 * @property {boolean} ok
 * @property {number} [bynPerUsd] How many BYN per 1 USD; present when ok is true
 * @property {string} [rateDate] YYYY-MM-DD from NBRB
 * @property {boolean} [fromCache] True when the rate was read from storage without refetch
 * @property {string} [error] Set when ok is false
 */
(function (g) {
  "use strict";
  g.AvByUsdMessageType = Object.freeze({ GET_RATE: "GET_RATE" });
})(typeof globalThis !== "undefined" ? globalThis : self);
