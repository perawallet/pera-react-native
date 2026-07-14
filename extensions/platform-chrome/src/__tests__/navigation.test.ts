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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../test-utils/chrome'
import { openExpandedTab } from '../navigation'

describe('openExpandedTab', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('opens expanded.html without a flow', async () => {
        await openExpandedTab()
        expect(fake.createdTabs).toEqual([
            { url: 'chrome-extension://test-extension-id/expanded.html' },
        ])
    })

    it('opens expanded.html with a flow query param', async () => {
        await openExpandedTab('backup-wallet')
        expect(fake.createdTabs[0].url).toBe(
            'chrome-extension://test-extension-id/expanded.html?flow=backup-wallet',
        )
    })

    it('creates a new tab when no expanded tab is already open', async () => {
        await openExpandedTab('add-account')

        expect(fake.createdTabs).toEqual([
            {
                url: 'chrome-extension://test-extension-id/expanded.html?flow=add-account',
            },
        ])
        expect(fake.tabUpdates).toEqual([])
        expect(fake.windowUpdates).toEqual([])
    })

    it('focuses and re-points an already-open expanded tab instead of creating a new one', async () => {
        fake.openTabs.push({
            id: 7,
            url: 'chrome-extension://test-extension-id/expanded.html',
            windowId: 42,
        })

        await openExpandedTab('add-account')

        expect(fake.createdTabs).toEqual([])
        expect(fake.tabUpdates).toEqual([
            {
                id: 7,
                changes: {
                    active: true,
                    url: 'chrome-extension://test-extension-id/expanded.html?flow=add-account',
                },
            },
        ])
        expect(fake.windowUpdates).toEqual([
            { windowId: 42, changes: { focused: true } },
        ])
    })

    it('focuses an existing expanded tab regardless of which flow it currently shows', async () => {
        fake.openTabs.push({
            id: 3,
            url: 'chrome-extension://test-extension-id/expanded.html?flow=backup-wallet',
            windowId: 9,
        })

        await openExpandedTab()

        expect(fake.createdTabs).toEqual([])
        expect(fake.tabUpdates).toEqual([
            {
                id: 3,
                changes: {
                    active: true,
                    url: 'chrome-extension://test-extension-id/expanded.html',
                },
            },
        ])
    })
})

describe('consumeInitialExpandedFlow', () => {
    // `consumed` is one-shot module state by design (that's the feature
    // under test) — reset the module between tests so each test gets its
    // own fresh "not yet consumed" instance instead of inheriting whatever
    // a previous test left behind.
    beforeEach(() => {
        vi.resetModules()
    })

    afterEach(() => {
        delete (globalThis as { __PERA_TEST_SEARCH__?: string })
            .__PERA_TEST_SEARCH__
        delete (globalThis as { location?: unknown }).location
        delete (globalThis as { history?: unknown }).history
    })

    it('returns a valid flow exactly once', async () => {
        ;(
            globalThis as { __PERA_TEST_SEARCH__?: string }
        ).__PERA_TEST_SEARCH__ = '?flow=add-account'
        const { consumeInitialExpandedFlow } = await import('../navigation')
        expect(consumeInitialExpandedFlow()).toBe('add-account')
        expect(consumeInitialExpandedFlow()).toBeNull()
    })

    it('rejects unknown flows', async () => {
        ;(
            globalThis as { __PERA_TEST_SEARCH__?: string }
        ).__PERA_TEST_SEARCH__ = '?flow=evil'
        const { consumeInitialExpandedFlow } = await import('../navigation')
        expect(consumeInitialExpandedFlow()).toBeNull()
    })

    it('strips ?flow= from the URL via history.replaceState after consuming a valid flow', async () => {
        ;(
            globalThis as { __PERA_TEST_SEARCH__?: string }
        ).__PERA_TEST_SEARCH__ = '?flow=add-account'
        ;(globalThis as { location?: { href: string } }).location = {
            href: 'chrome-extension://test-extension-id/expanded.html?flow=add-account',
        }
        const replaceState = vi.fn()
        ;(
            globalThis as {
                history?: {
                    replaceState: (
                        data: unknown,
                        title: string,
                        url?: string,
                    ) => void
                }
            }
        ).history = { replaceState }
        const { consumeInitialExpandedFlow } = await import('../navigation')

        expect(consumeInitialExpandedFlow()).toBe('add-account')

        expect(replaceState).toHaveBeenCalledTimes(1)
        expect(replaceState).toHaveBeenCalledWith(
            null,
            '',
            'chrome-extension://test-extension-id/expanded.html',
        )
    })

    it('does not touch the URL when the flow is invalid (nothing was consumed)', async () => {
        ;(
            globalThis as { __PERA_TEST_SEARCH__?: string }
        ).__PERA_TEST_SEARCH__ = '?flow=evil'
        ;(globalThis as { location?: { href: string } }).location = {
            href: 'chrome-extension://test-extension-id/expanded.html?flow=evil',
        }
        const replaceState = vi.fn()
        ;(
            globalThis as {
                history?: {
                    replaceState: (
                        data: unknown,
                        title: string,
                        url?: string,
                    ) => void
                }
            }
        ).history = { replaceState }
        const { consumeInitialExpandedFlow } = await import('../navigation')

        expect(consumeInitialExpandedFlow()).toBeNull()
        expect(replaceState).not.toHaveBeenCalled()
    })
})
