// Play-Store listing URL, supplied at build time via VITE_PLAY_STORE_URL once
// the listing is live (the deploy sets it alongside VITE_SYNC_ENGINE). When it
// is unset (null) the share row shows a "coming soon" note instead of a dead
// link, so nothing is hardcoded to a placeholder.
export const PLAY_STORE_URL = import.meta.env.VITE_PLAY_STORE_URL || null
