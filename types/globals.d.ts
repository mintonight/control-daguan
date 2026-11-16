// Vendor scripts stay classic scripts; the FSRS adapter uses the installed package's real API types.
declare global {
  var FSRS: typeof import('ts-fsrs');
}
export {};
