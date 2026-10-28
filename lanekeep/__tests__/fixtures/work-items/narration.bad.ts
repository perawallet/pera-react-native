// This used to retry twice before giving up
export const a = 1 // the sheet that used to open here
/*
 * The reset used
 * to be synchronous.
 */
export const b = 2
// Previously the hook read every page
// The helper was renamed from loadAll
// formerly the default export
// Retries once (#1234)
// pre-#1400 the poll never stopped
// One run sat 75s for a screen a second tap opened
// The cold import takes ~5s under coverage
// p95 was ~2.1s on a Galaxy S22
export const c = 3
