/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

export type ExpandedFlow = 'add-account' | 'backup-wallet' | 'scan'

const FLOWS: readonly string[] = ['add-account', 'backup-wallet', 'scan']

/**
 * Finds an already-open expanded tab, if any, so re-triggering a
 * blur-fragile flow focuses it instead of stacking a duplicate tab.
 * Querying by URL for the extension's own pages doesn't require the `tabs`
 * permission — that's only needed to read url/title of tabs the extension
 * doesn't own.
 */
const findExpandedTab = async (): Promise<chrome.tabs.Tab | undefined> => {
    const tabs = await chrome.tabs.query({
        url: `${chrome.runtime.getURL('expanded.html')}*`,
    })
    return tabs[0]
}

/**
 * Opens (or deep-links into) the full-tab surface. Blur-fragile flows —
 * onboarding, mnemonic backup, account import — must not run inside the
 * 360x600 toolbar popup (design spec); Chrome auto-closes the popup when the
 * created tab takes focus, which is the intended hand-off.
 *
 * If an expanded tab is already open, it's focused and re-pointed at the new
 * `?flow=` instead of stacking a second tab.
 */
export const openExpandedTab = async (flow?: ExpandedFlow): Promise<void> => {
    const path = flow ? `expanded.html?flow=${flow}` : 'expanded.html'
    const url = chrome.runtime.getURL(path)

    const existing = await findExpandedTab()
    if (existing?.id !== undefined) {
        await chrome.tabs.update(existing.id, { active: true, url })
        if (existing.windowId !== undefined) {
            await chrome.windows.update(existing.windowId, { focused: true })
        }
        return
    }

    await chrome.tabs.create({ url })
}

/** Opens an arbitrary external URL in a new browser tab (webview pushWebView
 * → real tab on web; the injected ARC-0027 provider supplies connect/sign). */
export const openExternalTab = (url: string): void => {
    void chrome.tabs.create({ url })
}

/**
 * Closes the tab hosting the calling extension page. `window.close()`
 * can't close a chrome.tabs.create'd tab, but tabs.getCurrent/remove can,
 * and neither needs the `tabs` permission for the extension's own page.
 */
export const closeCurrentTab = async (): Promise<void> => {
    const tab = await chrome.tabs.getCurrent()
    if (tab?.id !== undefined) await chrome.tabs.remove(tab.id)
}

let consumed = false

const readSearch = (): string => {
    const testSeam = (globalThis as { __PERA_TEST_SEARCH__?: string })
        .__PERA_TEST_SEARCH__
    if (typeof testSeam === 'string') return testSeam
    const loc = (globalThis as { location?: { search?: string } }).location
    return loc?.search ?? ''
}

/**
 * Strips `?flow=` from the address bar after it's been consumed, so a manual
 * reload of the expanded tab can't re-trigger the same navigation. Best
 * effort: silently no-ops if `location`/`history` aren't present (e.g. the
 * `__PERA_TEST_SEARCH__` seam has no matching fake location installed).
 */
const stripFlowFromUrl = (): void => {
    const loc = (globalThis as { location?: { href?: string } }).location
    const historyObj = (
        globalThis as {
            history?: {
                replaceState: (
                    data: unknown,
                    title: string,
                    url?: string,
                ) => void
            }
        }
    ).history
    if (!loc?.href || typeof historyObj?.replaceState !== 'function') return
    const url = new URL(loc.href)
    url.searchParams.delete('flow')
    historyObj.replaceState(null, '', url.toString())
}

/**
 * One-shot read of the ?flow= deep-link param the popup passed to
 * expanded.html. Consumed exactly once so re-renders/HMR can't re-trigger a
 * navigation, and the param is stripped from the URL so a manual tab reload
 * doesn't re-trigger it either.
 */
export const consumeInitialExpandedFlow = (): ExpandedFlow | null => {
    if (consumed) return null
    consumed = true
    const flow = new URLSearchParams(readSearch()).get('flow')
    if (flow === null || !FLOWS.includes(flow)) return null
    stripFlowFromUrl()
    return flow as ExpandedFlow
}
