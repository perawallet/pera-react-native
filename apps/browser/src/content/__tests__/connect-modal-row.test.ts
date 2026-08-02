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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    INJECTED_ROW_ID,
    LAUNCH_BUTTON_ID,
    injectExtensionRow,
    shouldInjectRow,
} from '../connect-modal-row'
import { CONNECT_MODAL_WRAPPER_ID } from '../connect-modal-uri'

const VALID_URI =
    'wc:topic@1?bridge=https%3A%2F%2Fb.example&key=00&algorand=true'

const PRIMARY_CONTAINER_CLASS =
    'pera-wallet-connect-modal-desktop-mode__default-view'
const FALLBACK_CONTAINER_CLASS = 'pera-wallet-accordion'

// Builds a wrapper mirroring the REAL @perawallet/connect DOM, which nests
// two shadow roots deep (see connect-modal-row.ts's module comment and the
// SDK sources it cites):
//
//   #pera-wallet-connect-modal-wrapper                  (light DOM)
//   └── <pera-wallet-connect-modal>                     shadow root #1 (open)
//       └── <pera-wallet-modal-desktop-mode>             shadow root #2 (open)
//           └── .pera-wallet-connect-modal-desktop-mode__default-view  ← container
//
// The container does NOT live directly in shadow root #1 — that was the
// fixture bug that let the two-shadow-root regression ship green.
//
// `containerClassName`: defaults to the SDK's primary container class.
// Pass the fallback class to exercise ACCORDION_CONTAINER_SELECTORS' second
// entry, or `null` to build a modal with no matching container at all.
const makeModal = (
    options: {
        uri?: string
        extensionEnabled?: boolean
        extensionAvailable?: boolean
        containerClassName?: string | null
        skipDesktopMode?: boolean
        shouldDisplayNewBadge?: boolean
    } = {},
): HTMLDivElement => {
    const wrapper = document.createElement('div')
    wrapper.id = CONNECT_MODAL_WRAPPER_ID
    const modal = document.createElement('pera-wallet-connect-modal')
    if (options.uri) modal.setAttribute('uri', options.uri)
    if (options.shouldDisplayNewBadge === false) {
        modal.setAttribute('should-display-new-badge', 'false')
    }
    if (options.extensionEnabled) {
        modal.setAttribute('is-extension-enabled', 'true')
    }
    if (options.extensionAvailable) {
        modal.setAttribute('is-extension-available', 'true')
    }
    const root = modal.attachShadow({ mode: 'open' })
    if (!options.skipDesktopMode) {
        const desktopMode = document.createElement(
            'pera-wallet-modal-desktop-mode',
        )
        const desktopRoot = desktopMode.attachShadow({ mode: 'open' })
        const containerClassName =
            options.containerClassName === undefined
                ? PRIMARY_CONTAINER_CLASS
                : options.containerClassName
        if (containerClassName !== null) {
            const list = document.createElement('div')
            list.className = containerClassName
            desktopRoot.appendChild(list)
        }
        root.appendChild(desktopMode)
    }
    wrapper.appendChild(modal)
    document.body.appendChild(wrapper)
    return wrapper
}

// Shadow root #2 — the desktop-mode element's own shadow root, where the
// injected row and the accordion container actually live.
const getDesktopModeRoot = (wrapper: Element): ShadowRoot | null => {
    const modal = wrapper.querySelector('pera-wallet-connect-modal')
    const desktopMode = modal?.shadowRoot?.querySelector(
        'pera-wallet-modal-desktop-mode',
    )
    return desktopMode?.shadowRoot ?? null
}

const getContainer = (
    wrapper: Element,
    containerClassName = PRIMARY_CONTAINER_CLASS,
): Element => {
    const container = getDesktopModeRoot(wrapper)?.querySelector(
        `.${containerClassName}`,
    )
    if (!container) throw new Error('test fixture is missing its container')
    return container
}

// Builds a sibling accordion item matching the SDK's own two-level
// item/toggle structure (PeraWalletConnectModalDesktopMode.ts's
// mobileWalletOption / webWalletOption templates), closely enough to prove
// the injected row leaves real siblings alone.
const appendAccordionItem = (
    container: Element,
    { id, active }: { id: string; active: boolean },
): HTMLDivElement => {
    const item = document.createElement('div')
    item.id = id
    item.className = active
        ? 'pera-wallet-accordion-item pera-wallet-accordion-item--active'
        : 'pera-wallet-accordion-item'
    item.setAttribute('data-fixture-marker', 'keep-me')

    const toggle = document.createElement('a')
    toggle.className = 'pera-wallet-accordion-toggle'
    const button = document.createElement('button')
    button.className = 'pera-wallet-accordion-toggle__button'
    toggle.appendChild(button)
    const text = document.createElement('div')
    text.className = 'pera-wallet-accordion-toggle__text'
    text.textContent = 'Connect With Pera Mobile'
    toggle.appendChild(text)
    item.appendChild(toggle)

    const content = document.createElement('div')
    content.className = 'pera-wallet-accordion-item__content'
    item.appendChild(content)

    container.appendChild(item)
    return item
}

// Faithful translation of the SDK's own delegated shadowRoot click handler
// (../connect/src/modal/mode/desktop/PeraWalletConnectModalDesktopMode.ts,
// handleAccordion at lines 370-395, wired via shadowRoot.addEventListener at
// line 257). Used so the accordion regression tests exercise the real bug
// mechanism instead of a fake that only encodes our own assumption about it.
const attachRealHandleAccordion = (root: ShadowRoot): void => {
    root.addEventListener('click', event => {
        if (!(event.target instanceof Element)) return
        if (
            !event.target.classList.contains(
                'pera-wallet-accordion-toggle__button',
            )
        ) {
            return
        }

        const accordionItem = event.target.parentElement?.parentElement
        if (!accordionItem) return

        if (
            accordionItem.classList.contains(
                'pera-wallet-accordion-item--active',
            )
        ) {
            return
        }

        const activeItems = root.querySelectorAll(
            '.pera-wallet-accordion-item.pera-wallet-accordion-item--active',
        )
        activeItems.forEach(activeItem => {
            activeItem.classList.remove('pera-wallet-accordion-item--active')
        })
        accordionItem.classList.toggle('pera-wallet-accordion-item--active')
    })
}

// The innermost descendant of `element` — i.e. the node a real click at any
// point inside it would resolve to once CSS has laid it out, not the outer
// wrapper `.click()` would target directly.
const deepestChild = (element: Element): Element => {
    let current = element
    while (current.firstElementChild) current = current.firstElementChild
    return current
}

describe('shouldInjectRow', () => {
    beforeEach(() => {
        document.body.innerHTML = ''
        delete (globalThis as { onExtensionConnect?: unknown })
            .onExtensionConnect
    })

    it('does not inject when the page already has onExtensionConnect', () => {
        ;(globalThis as { onExtensionConnect?: unknown }).onExtensionConnect =
            () => {}
        expect(shouldInjectRow(makeModal({ uri: VALID_URI }))).toBe(false)
    })

    it('injects when onExtensionConnect is a non-function truthy value', () => {
        // A page setting a truthy non-function must not be able to suppress
        // our row: the check is `typeof … === 'function'`, not truthiness.
        ;(globalThis as { onExtensionConnect?: unknown }).onExtensionConnect =
            'yes'
        expect(shouldInjectRow(makeModal({ uri: VALID_URI }))).toBe(true)
    })

    it('does not inject when is-extension-enabled is true, regardless of is-extension-available', () => {
        expect(
            shouldInjectRow(
                makeModal({ uri: VALID_URI, extensionEnabled: true }),
            ),
        ).toBe(false)
        expect(
            shouldInjectRow(
                makeModal({
                    uri: VALID_URI,
                    extensionEnabled: true,
                    extensionAvailable: true,
                }),
            ),
        ).toBe(false)
    })

    it('does not inject when the SDK rendered its "Install Pera Extension" row (enabled but discovery has not resolved)', () => {
        // is-extension-enabled="true" + is-extension-available unset is
        // exactly the state that used to render two extension rows: the
        // SDK's own stale install prompt, plus ours. The owner's chosen fix
        // suppresses ours here, accepting the SDK's stale prompt as the cost.
        expect(
            shouldInjectRow(
                makeModal({
                    uri: VALID_URI,
                    extensionEnabled: true,
                    extensionAvailable: false,
                }),
            ),
        ).toBe(false)
    })

    it('injects when is-extension-available is true but is-extension-enabled is not (guards against reintroducing the old gate)', () => {
        expect(
            shouldInjectRow(
                makeModal({ uri: VALID_URI, extensionAvailable: true }),
            ),
        ).toBe(true)
    })

    it('does not inject when no URI can be extracted', () => {
        expect(shouldInjectRow(makeModal())).toBe(false)
    })

    it('injects for an un-upgraded modal with a valid URI', () => {
        expect(shouldInjectRow(makeModal({ uri: VALID_URI }))).toBe(true)
    })
})

describe('injectExtensionRow', () => {
    beforeEach(() => {
        document.body.innerHTML = ''
        delete (globalThis as { onExtensionConnect?: unknown })
            .onExtensionConnect
    })

    it('injects a row into the desktop-mode element’s shadow root', () => {
        const wrapper = makeModal({ uri: VALID_URI })
        expect(injectExtensionRow(wrapper, vi.fn())).toBe(true)

        expect(
            getDesktopModeRoot(wrapper)?.getElementById(INJECTED_ROW_ID),
        ).not.toBeNull()
    })

    it('is idempotent across repeated calls', () => {
        const wrapper = makeModal({ uri: VALID_URI })
        expect(injectExtensionRow(wrapper, vi.fn())).toBe(true)
        expect(injectExtensionRow(wrapper, vi.fn())).toBe(false)

        const rows = getDesktopModeRoot(wrapper)?.querySelectorAll(
            `#${INJECTED_ROW_ID}`,
        )
        expect(rows?.length).toBe(1)
    })

    it('calls onClick with the extracted URI when the launch button is clicked', () => {
        const wrapper = makeModal({ uri: VALID_URI })
        const onClick = vi.fn()
        injectExtensionRow(wrapper, onClick)

        const launch =
            getDesktopModeRoot(wrapper)?.getElementById(LAUNCH_BUTTON_ID)
        ;(launch as HTMLElement).click()

        expect(onClick).toHaveBeenCalledWith(VALID_URI)
    })

    it('does not pair when the header is clicked — that click belongs to the SDK’s expand/collapse handler', () => {
        const wrapper = makeModal({ uri: VALID_URI })
        const onClick = vi.fn()
        injectExtensionRow(wrapper, onClick)

        const root = getDesktopModeRoot(wrapper) as ShadowRoot
        const overlay = root.querySelector(
            '.pera-wallet-accordion-toggle__button',
        ) as HTMLElement
        overlay.dispatchEvent(new MouseEvent('click', { bubbles: true }))

        expect(onClick).not.toHaveBeenCalled()
    })

    it('does not call onClick before the launch button is clicked', () => {
        const wrapper = makeModal({ uri: VALID_URI })
        const onClick = vi.fn()
        injectExtensionRow(wrapper, onClick)
        expect(onClick).not.toHaveBeenCalled()
    })

    it('renders the SDK’s own expandable-option structure, expanded, with the launch button in the panel', () => {
        // Mirrors extensionWalletOption in
        // ../connect/src/modal/mode/desktop/PeraWalletConnectModalDesktopMode.ts:
        // a two-level item/toggle split whose overlay button drives the SDK's
        // handleAccordion, plus a content panel holding the launch button.
        const wrapper = makeModal({ uri: VALID_URI })
        injectExtensionRow(wrapper, vi.fn())

        const row = getDesktopModeRoot(wrapper)?.getElementById(
            INJECTED_ROW_ID,
        ) as HTMLElement

        expect(row.tagName).toBe('DIV')
        expect(row.classList.contains('pera-wallet-accordion-item')).toBe(true)
        // Expanded on arrival, as the SDK renders its own extension option
        // when the extension is available.
        expect(
            row.classList.contains('pera-wallet-accordion-item--active'),
        ).toBe(true)

        const toggle = row.querySelector('.pera-wallet-accordion-toggle')
        expect(
            toggle?.querySelector('.pera-wallet-accordion-toggle__button')
                ?.parentElement?.parentElement,
        ).toBe(row)

        // The launch button lives inside the collapsible panel, not the header.
        const panel = row.querySelector('.pera-wallet-accordion-item__content')
        expect(panel?.querySelector(`#${LAUNCH_BUTTON_ID}`)).not.toBeNull()
    })

    it('honours the SDK’s should-display-new-badge attribute', () => {
        const withBadge = makeModal({ uri: VALID_URI })
        injectExtensionRow(withBadge, vi.fn())
        expect(
            getDesktopModeRoot(withBadge)
                ?.getElementById(INJECTED_ROW_ID)
                ?.querySelector('.pera-wallet-accordion-toggle__label'),
        ).not.toBeNull()

        document.body.innerHTML = ''
        const withoutBadge = makeModal({
            uri: VALID_URI,
            shouldDisplayNewBadge: false,
        })
        injectExtensionRow(withoutBadge, vi.fn())
        expect(
            getDesktopModeRoot(withoutBadge)
                ?.getElementById(INJECTED_ROW_ID)
                ?.querySelector('.pera-wallet-accordion-toggle__label'),
        ).toBeNull()
    })

    it('returns false when there is no shadow root to inject into', () => {
        const wrapper = document.createElement('div')
        const modal = document.createElement('pera-wallet-connect-modal')
        modal.setAttribute('uri', VALID_URI)
        wrapper.appendChild(modal)
        expect(injectExtensionRow(wrapper, vi.fn())).toBe(false)
    })

    it('returns false without throwing when there is no desktop-mode element (mobile renders touch-screen-mode instead)', () => {
        const wrapper = makeModal({ uri: VALID_URI, skipDesktopMode: true })
        expect(() => injectExtensionRow(wrapper, vi.fn())).not.toThrow()
        expect(injectExtensionRow(wrapper, vi.fn())).toBe(false)
    })

    it('returns false without throwing when the desktop-mode element has no shadow root', () => {
        const wrapper = makeModal({ uri: VALID_URI, skipDesktopMode: true })
        const modal = wrapper.querySelector(
            'pera-wallet-connect-modal',
        ) as Element
        // A desktop-mode element that exists but never got its own shadow
        // root (e.g. upgraded before `attachShadow` ran) must degrade the
        // same as its absence, not throw.
        modal.shadowRoot?.appendChild(
            document.createElement('pera-wallet-modal-desktop-mode'),
        )
        expect(() => injectExtensionRow(wrapper, vi.fn())).not.toThrow()
        expect(injectExtensionRow(wrapper, vi.fn())).toBe(false)
    })

    it('injects into the fallback accordion container when the primary selector does not match', () => {
        const wrapper = makeModal({
            uri: VALID_URI,
            containerClassName: FALLBACK_CONTAINER_CLASS,
        })
        expect(injectExtensionRow(wrapper, vi.fn())).toBe(true)

        const container = getContainer(wrapper, FALLBACK_CONTAINER_CLASS)
        expect(container.querySelector(`#${INJECTED_ROW_ID}`)).not.toBeNull()
    })

    it('returns false without throwing when no accordion container matches any selector', () => {
        const wrapper = makeModal({ uri: VALID_URI, containerClassName: null })
        expect(() => injectExtensionRow(wrapper, vi.fn())).not.toThrow()
        expect(injectExtensionRow(wrapper, vi.fn())).toBe(false)
    })

    it('takes its sibling spacing from the SDK’s stylesheet rather than an inline style', () => {
        // The SDK spaces siblings with
        // `.pera-wallet-accordion-item:not(:last-of-type) { margin-bottom:
        // 20px }` — a same-TAG-type selector. Matching the siblings' `<div>`
        // is what makes that rule apply, so no inline margin is needed (an
        // earlier `<button>` revision had to set one, being the only button
        // among divs and therefore always last-of-type for its own tag).
        const wrapper = makeModal({ uri: VALID_URI })
        injectExtensionRow(wrapper, vi.fn())

        const row = getDesktopModeRoot(wrapper)?.getElementById(
            INJECTED_ROW_ID,
        ) as HTMLElement

        expect(row.tagName).toBe('DIV')
        expect(row.style.marginBottom).toBe('')
    })

    it('does not remove an already-injected row when onExtensionConnect appears afterward', () => {
        // Current behaviour: nothing retroactively removes a row that was
        // injected before the page later defines onExtensionConnect. This is
        // defensible — the row is already inert until clicked, so leaving it
        // costs at most a redundant option, never a wrong action — but it is
        // deliberate, not an oversight, so it is pinned here.
        const wrapper = makeModal({ uri: VALID_URI })
        const onClick = vi.fn()
        expect(injectExtensionRow(wrapper, onClick)).toBe(true)

        ;(globalThis as { onExtensionConnect?: unknown }).onExtensionConnect =
            () => {}

        // shouldInjectRow now reports false, so a re-invocation injects
        // nothing new — but it also does not touch the existing row.
        expect(injectExtensionRow(wrapper, onClick)).toBe(false)

        const row = getDesktopModeRoot(wrapper)?.getElementById(INJECTED_ROW_ID)
        expect(row).not.toBeNull()

        getDesktopModeRoot(wrapper)
            ?.getElementById(LAUNCH_BUTTON_ID)
            ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        expect(onClick).toHaveBeenCalledWith(VALID_URI)
    })

    describe('restraint: preserves the SDK-rendered siblings exactly', () => {
        it('prepends the injected row and leaves existing sibling rows untouched', () => {
            const wrapper = makeModal({ uri: VALID_URI })
            const container = getContainer(wrapper)

            const mobileItem = appendAccordionItem(container, {
                id: 'mobile-wallet-option',
                active: true,
            })
            const webItem = appendAccordionItem(container, {
                id: 'web-wallet-option',
                active: false,
            })

            expect(injectExtensionRow(wrapper, vi.fn())).toBe(true)

            const children = Array.from(container.children)
            expect(children).toHaveLength(3)

            // Prepended: the injected row is first, matching where the SDK
            // places its own extension option (renderConnectOptions appends
            // extensionWalletOption before the mobile/web options).
            expect(children[0].id).toBe(INJECTED_ROW_ID)

            // Original order preserved, and these are the very same nodes —
            // not lookalikes rebuilt from scratch.
            expect(children[1]).toBe(mobileItem)
            expect(children[2]).toBe(webItem)

            // The sibling nodes keep their own identity and attributes. The
            // ONE thing deliberately taken from them is the `--active`
            // modifier (see the expanded-by-default block below) — the base
            // class and every attribute survive.
            expect(mobileItem.getAttribute('data-fixture-marker')).toBe(
                'keep-me',
            )
            expect(
                mobileItem.classList.contains('pera-wallet-accordion-item'),
            ).toBe(true)
            expect(webItem.className).toBe('pera-wallet-accordion-item')
            expect(webItem.getAttribute('data-fixture-marker')).toBe('keep-me')
        })
    })

    // Supersedes the earlier "does not disturb the SDK's own accordion state"
    // behaviour. Owner decision, 2026-07-30: the injected option should look
    // exactly like the one the SDK renders under `experimental: true`, and
    // there the extension option is the `--active` one — the mobile/web
    // templates only claim `--active` when
    // `!isExtensionAvailable` (getConnectOptions in
    // ../connect/src/modal/mode/desktop/PeraWalletConnectModalDesktopMode.ts).
    // Leaving a sibling expanded alongside ours would show two open panels at
    // once, which the SDK's own markup can never produce.
    describe('expanded by default, mirroring the SDK’s extension option', () => {
        it('claims the open slot from a pre-expanded sibling', () => {
            const wrapper = makeModal({ uri: VALID_URI })
            const container = getContainer(wrapper)
            const mobileItem = appendAccordionItem(container, {
                id: 'mobile-wallet-option',
                active: true,
            })

            expect(injectExtensionRow(wrapper, vi.fn())).toBe(true)

            const row = getDesktopModeRoot(wrapper)?.getElementById(
                INJECTED_ROW_ID,
            ) as Element
            expect(
                row.classList.contains('pera-wallet-accordion-item--active'),
            ).toBe(true)
            expect(
                mobileItem.classList.contains(
                    'pera-wallet-accordion-item--active',
                ),
            ).toBe(false)
        })

        it('leaves a pre-expanded sibling alone when it declines to inject', () => {
            // The active-class transfer sits behind every guard, so a modal
            // we reject must come out untouched — otherwise a dApp driving
            // ARC-0027 itself would have its open panel collapsed by us for
            // no reason.
            ;(
                globalThis as { onExtensionConnect?: unknown }
            ).onExtensionConnect = () => {}
            const wrapper = makeModal({ uri: VALID_URI })
            const container = getContainer(wrapper)
            const mobileItem = appendAccordionItem(container, {
                id: 'mobile-wallet-option',
                active: true,
            })

            expect(injectExtensionRow(wrapper, vi.fn())).toBe(false)

            expect(
                mobileItem.classList.contains(
                    'pera-wallet-accordion-item--active',
                ),
            ).toBe(true)
        })

        it('hands header clicks to the SDK’s real handleAccordion instead of pairing', () => {
            const wrapper = makeModal({ uri: VALID_URI })
            // handleAccordion is wired on the desktop-mode element's OWN
            // shadow root (shadow root #2), not the outer modal's shadow
            // root #1 — see PeraWalletConnectModalDesktopMode.ts's
            // constructor (`this.shadowRoot.addEventListener(...)`).
            const root = getDesktopModeRoot(wrapper) as ShadowRoot
            attachRealHandleAccordion(root)

            const container = getContainer(wrapper)
            const mobileItem = appendAccordionItem(container, {
                id: 'mobile-wallet-option',
                active: false,
            })

            const onClick = vi.fn()
            expect(injectExtensionRow(wrapper, onClick)).toBe(true)

            // A real click doesn't land on the outer row element — it lands
            // on whatever's actually under the pointer, which for the header
            // is the SDK's full-size overlay button.
            const row = root.getElementById(INJECTED_ROW_ID) as Element
            const clickTarget = deepestChild(row)
            expect(
                clickTarget.classList.contains(
                    'pera-wallet-accordion-toggle__button',
                ),
            ).toBe(true)

            // Our row starts expanded, so handleAccordion early-returns on it.
            // Expanding the sibling is what proves the real handler is
            // reaching our two-level structure and walking it correctly.
            const siblingTarget = deepestChild(mobileItem)
            siblingTarget.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            )

            expect(onClick).not.toHaveBeenCalled()
            expect(
                mobileItem.classList.contains(
                    'pera-wallet-accordion-item--active',
                ),
            ).toBe(true)
            expect(
                row.classList.contains('pera-wallet-accordion-item--active'),
            ).toBe(false)

            // Now the regression that the flat single-node revision caused:
            // handleAccordion walks `target.parentElement.parentElement` from
            // the overlay. On a flat row that landed on the shared CONTAINER,
            // so every sibling lost `--active` and nothing gained it. With the
            // SDK's two-level item/toggle split reproduced, the walk resolves
            // to our own item — so clicking our header re-expands US and
            // collapses the sibling, which is ordinary accordion behaviour.
            clickTarget.dispatchEvent(
                new MouseEvent('click', { bubbles: true }),
            )

            expect(
                row.classList.contains('pera-wallet-accordion-item--active'),
            ).toBe(true)
            expect(
                mobileItem.classList.contains(
                    'pera-wallet-accordion-item--active',
                ),
            ).toBe(false)
            expect(container.children.length).toBe(2)
            expect(onClick).not.toHaveBeenCalled()
        })
    })
})
