/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { expect } from '@playwright/test'
import type { BrowserContext, Page } from '@playwright/test'

/** The toolbar popup's real dimensions. */
const POPUP_VIEWPORT = { width: 360, height: 600 }

const APPROVAL_WINDOW_URL = 'approval.html?requestId='

export type ApprovalSurfaceKind = 'popup' | 'window'

export type OpenedApprovalSurface = {
    approvalPage: Page
    approvalErrors: Error[]
    /** Which surface the service worker actually opened. */
    surface: ApprovalSurfaceKind
}

/**
 * Without this, module-eval crashes in the bundle surface as bare selector
 * timeouts with no sign of the real cause.
 */
export const trackPageErrors = (targetPage: Page): Error[] => {
    const errors: Error[] = []
    targetPage.on('pageerror', error => errors.push(error))
    return errors
}

/**
 * Asks the service worker whether a *popup-surfaced* approval is pending.
 * `get-current-approval` deliberately skips entries whose surface is 'window'
 * (approval-bridge.ts), so this stays null for the whole window path.
 */
const pendingPopupApproval = (page: Page): Promise<unknown> =>
    page.evaluate(
        scope =>
            new Promise<unknown>(resolve => {
                const runtime = (
                    globalThis as unknown as {
                        chrome?: {
                            runtime?: {
                                sendMessage?: (
                                    message: unknown,
                                    callback: (r: unknown) => void,
                                ) => void
                            }
                        }
                    }
                ).chrome?.runtime
                if (!runtime?.sendMessage) {
                    resolve(null)
                    return
                }
                runtime.sendMessage(
                    { scope, kind: 'get-current-approval' },
                    resolve,
                )
            }),
        'pera-dapp-approval',
    )

/**
 * Waits for an approval surface to open and returns it, accepting whichever
 * one the service worker actually produced.
 *
 * Both are legitimate product paths, and which one we get is not ours to
 * choose: ApprovalWindowBridge.openViaPopupOrWindow tries
 * `chrome.action.openPopup()` first and only marks the entry
 * `surface: 'popup'` if that resolves true, otherwise falling back to
 * `chrome.windows.create('approval.html?...')` and `surface: 'window'`.
 * openPopup rejects when the toolbar popup is dismissed before finishing its
 * first load, which on a headless CI runner with no window manager it
 * routinely is — so requiring the popup surface made these specs fail on the
 * environment rather than on the product. It failed *permanently* rather than
 * slowly, too: once the entry is 'window', `get-current-approval` filters it
 * out forever, so no timeout or retry could ever turn that null into a value.
 *
 * Both surfaces mount the same DappRequestRoutes.web.tsx and route on
 * `approval.kind`, so every screen testID is identical either way.
 *
 * Callers that specifically assert one surface should keep driving it
 * directly — see walletconnect.spec.ts's window-fallback test, which closes
 * every page first so openPopup has nothing to attach to.
 */
export const openApprovalSurface = async ({
    context,
    page,
    extensionId,
    timeout = 20_000,
}: {
    context: BrowserContext
    /**
     * A live extension page to poll the service worker through. The window
     * surface is observable without it, but the popup surface is not.
     */
    page: Page
    extensionId: string
    timeout?: number
}): Promise<OpenedApprovalSurface> => {
    if (page.isClosed()) {
        throw new Error(
            'openApprovalSurface: `page` is closed, so the popup surface cannot be polled for — pass a live extension page.',
        )
    }

    // The window may have opened before this call (the approval is triggered
    // by the caller), so read the page list rather than only waiting for the
    // next 'page' event.
    let windowPage: Page | undefined
    // WCDIAG: temporary instrumentation, remove before commit.
    const seenUrls = new Set<string>()
    const t0 = Date.now()
    const timeline: string[] = []
    try {
        await expect
            .poll(
                async () => {
                    for (const candidate of context.pages()) {
                        const u = candidate.url()
                        if (!seenUrls.has(u)) {
                            seenUrls.add(u)
                            timeline.push(`+${Date.now() - t0}ms page: ${u}`)
                        }
                    }
                    windowPage = context
                        .pages()
                        .find(candidate =>
                            candidate.url().includes(APPROVAL_WINDOW_URL),
                        )
                    if (windowPage) return 'window'
                    return (await pendingPopupApproval(page)) === null
                        ? null
                        : 'popup'
                },
                { timeout },
            )
            .not.toBeNull()
    } catch (error) {
        console.log('[WCDIAG] openApprovalSurface TIMED OUT after', timeout)
        console.log('[WCDIAG] page-url timeline:\n  ' + timeline.join('\n  '))
        console.log(
            '[WCDIAG] final pages:\n  ' +
                context
                    .pages()
                    .map(p => `${p.isClosed() ? '(closed) ' : ''}${p.url()}`)
                    .join('\n  '),
        )
        const swState = await page
            .evaluate(
                scope =>
                    new Promise(resolve => {
                        const rt = (
                            globalThis as unknown as {
                                chrome?: {
                                    runtime?: {
                                        sendMessage?: (
                                            m: unknown,
                                            cb: (r: unknown) => void,
                                        ) => void
                                        getContexts?: (
                                            f: unknown,
                                        ) => Promise<unknown>
                                    }
                                }
                            }
                        ).chrome?.runtime
                        if (!rt?.sendMessage) {
                            resolve('no chrome.runtime')
                            return
                        }
                        void Promise.resolve(
                            rt.getContexts?.({}) ?? 'getContexts unavailable',
                        ).then(ctxs => {
                            rt.sendMessage!(
                                { scope, kind: 'get-current-approval' },
                                cur => {
                                    resolve({
                                        currentApproval: cur,
                                        contexts: ctxs,
                                    })
                                },
                            )
                        })
                    }),
                'pera-dapp-approval',
            )
            .catch((e: unknown) => `evaluate failed: ${String(e)}`)
        console.log('[WCDIAG] SW state:', JSON.stringify(swState, null, 2))
        throw error
    }

    if (windowPage) {
        await windowPage.waitForLoadState('domcontentloaded')
        // Attached after load because the service worker opened this page, not
        // us — the same trade-off the window-fallback test already makes.
        return {
            approvalPage: windowPage,
            approvalErrors: trackPageErrors(windowPage),
            surface: 'window',
        }
    }

    // Playwright can neither click the toolbar icon nor see its popup as a
    // 'page', so drive the popup surface by navigating a fresh tab straight to
    // popup.html — the same surface and get-current-approval discovery path
    // the real toolbar popup uses.
    const approvalPage = await context.newPage()
    await approvalPage.setViewportSize(POPUP_VIEWPORT)
    // Before navigation, so module-eval crashes on load are caught.
    const approvalErrors = trackPageErrors(approvalPage)
    await approvalPage.goto(`chrome-extension://${extensionId}/popup.html`)
    await approvalPage.waitForLoadState('domcontentloaded')
    return { approvalPage, approvalErrors, surface: 'popup' }
}

/** Asserts the page is one of the two approval surfaces. */
export const expectApprovalSurfaceUrl = (approvalPage: Page): void => {
    expect(approvalPage.url()).toMatch(/(popup|approval)\.html/)
}
