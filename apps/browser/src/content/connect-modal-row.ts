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

// Pure DOM decision logic + injection for the connect-modal extension row.
// Deliberately has no `chrome` usage and sends no messages — a later task
// wires the onClick callback to the service worker. This lets the module be
// fully exercised in jsdom.
//
// Unlike discover-main.ts and native's peraConnectJS, this module does NOT
// remove the dApp's modal or auto-pair: the modal stays intact, every
// existing option keeps working, and nothing happens until the user clicks
// the injected row.
import { extractUriFromConnectModal, isWcUri } from './connect-modal-uri'

export const INJECTED_ROW_ID = 'pera-extension-injected-row'

// The button inside the expanded panel that actually starts the pairing.
// Distinct from the SDK's own `pera-wallet-connect-extension-launch-button`:
// that id is bound by the desktop-mode element's constructor to call
// `window.onExtensionConnect()`, which is exactly the transport we know is
// absent whenever this row is injected at all.
export const LAUNCH_BUTTON_ID = 'pera-extension-injected-launch-button'

const ACCORDION_ITEM_CLASS = 'pera-wallet-accordion-item'
const ACCORDION_ITEM_ACTIVE_CLASS = 'pera-wallet-accordion-item--active'

// The container the SDK appends its own connect options to
// (`desktopModeDefaultView` in PeraWalletConnectModalDesktopMode.ts). Kept as
// a list so connect DOM drift across 1.x versions degrades to "no row"
// rather than a throw — same tolerance posture as
// extractUriFromConnectModal's fallbacks.
const ACCORDION_CONTAINER_SELECTORS = [
    '.pera-wallet-connect-modal-desktop-mode__default-view',
    '.pera-wallet-accordion',
]

// Tag of the desktop-mode custom element the container lives inside (its
// class name — `pera-wallet-connect-modal-desktop-mode__default-view` —
// disagrees with this tag name; they are genuinely different strings in the
// SDK, not a typo). See PeraWalletModalDesktopMode in
// PeraWalletConnectModalDesktopMode.ts.
const DESKTOP_MODE_TAG = 'pera-wallet-modal-desktop-mode'

const modalElement = (wrapper: Element): Element | null =>
    wrapper.querySelector('pera-wallet-connect-modal')

// The real @perawallet/connect DOM nests two OPEN shadow roots deep:
//
//   <pera-wallet-connect-modal>                    shadow root #1
//   └── <pera-wallet-modal-desktop-mode>           shadow root #2
//       └── .pera-wallet-connect-modal-desktop-mode__default-view
//
// `querySelector` never pierces a shadow boundary, so the accordion
// container can only be reached by explicitly stepping into shadow root #2.
// On mobile the outer modal renders `<pera-wallet-modal-touch-screen-mode>`
// instead — there is no desktop-mode element and thus no container at all,
// which this degrades to `null` for, same as any other absent level.
const desktopModeShadowRoot = (modal: Element): ShadowRoot | null =>
    modal.shadowRoot?.querySelector(DESKTOP_MODE_TAG)?.shadowRoot ?? null

/**
 * Whether the page's own @perawallet/connect instance can already drive the
 * ARC-0027 extension transport. `window.onExtensionConnect` is installed by
 * PeraWalletConnect.connect() only when the dApp passed `experimental: true`
 * AND discovery found us — and the modal's own "Connect with Extension"
 * button does nothing but call it. So its presence means the dApp owns the
 * flow and we must stay out; its absence means the SDK never built an
 * extension transport for this connect() call, so ARC-0027 is unreachable
 * from outside and WC pairing off the `uri` attribute is the only mechanism.
 *
 * Only observable from the MAIN world — this is a page global.
 */
const pageCanDriveArc0027 = (): boolean =>
    typeof (globalThis as { onExtensionConnect?: unknown })
        .onExtensionConnect === 'function'

export const shouldInjectRow = (wrapper: Element): boolean => {
    if (pageCanDriveArc0027()) return false
    const modal = modalElement(wrapper)
    // Gate on is-extension-enabled, not is-extension-available.
    // is-extension-enabled tracks the dApp's `experimental` constructor
    // option and is set whenever the SDK renders an extension row at all —
    // either "Connect with Extension" (is-extension-available="true", when
    // discovery resolved) or "Install Pera Extension" (is-extension-available
    // absent/false, when it hasn't). is-extension-available alone tracks only
    // discovery success, so gating on it lets both an SDK "Install Pera
    // Extension" row and our row render together whenever discovery is still
    // pending. Gating on is-extension-enabled instead means we never show two
    // extension rows, at the accepted cost that in that state the user sees
    // only the SDK's stale install prompt and not our row, even though the
    // extension is in fact installed.
    if (modal?.getAttribute('is-extension-enabled') === 'true') return false
    return isWcUri(extractUriFromConnectModal(wrapper))
}

// Inline SVGs, never chrome.runtime.getURL() references — those would leak
// the extension ID into the page and require a web_accessible_resources
// manifest entry. The SDK's own templates use `<img src="${ArrowRight}">` /
// `PeraWalletIcon` imports, which resolve to bundler-emitted asset URLs we
// have no equivalent of here.
//
// Brand glyph for the expanded panel's logo wrapper (a 72px circle), sized to
// match the SDK's own `PeraWalletIcon` inside it.
const PERA_ICON_SVG = `<svg width="40" height="40" viewBox="0 0 32 35" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path d="M18.2837 5.09271C19.0234 8.12325 18.7827 10.7913 17.7463 11.0519C16.7098 11.3126 15.27 9.06712 14.5304 6.03657C13.7908 3.00603 14.0315 0.337996 15.0679 0.0773547C16.1044 -0.183287 17.5441 2.06216 18.2837 5.09271Z" fill="currentColor"/>
<path d="M30.376 7.66915C28.7507 5.95537 25.5271 6.42918 23.1759 8.72745C20.8247 11.0257 20.2361 14.2781 21.8614 15.9919C23.4866 17.7057 26.7102 17.2319 29.0614 14.9336C31.4127 12.6354 32.0012 9.38294 30.376 7.66915Z" fill="currentColor"/>
<path d="M17.5511 34.0071C18.5876 33.7465 18.7914 30.9276 18.0064 27.711C17.2214 24.4945 15.7448 22.0982 14.7084 22.3589C13.6719 22.6195 13.4681 25.4383 14.2531 28.6549C15.0381 31.8715 16.5147 34.2677 17.5511 34.0071Z" fill="currentColor"/>
<path d="M6.91617 9.3015C9.9105 10.1763 12.1008 11.7187 11.8083 12.7466C11.5158 13.7745 8.85126 13.8986 5.85693 13.0239C2.8626 12.1491 0.672334 10.6067 0.964835 9.57881C1.25734 8.5509 3.92184 8.42674 6.91617 9.3015Z" fill="currentColor"/>
<path d="M26.3656 20.8508C29.5437 21.7793 31.883 23.3652 31.5905 24.3932C31.298 25.4211 28.4845 25.5017 25.3063 24.5732C22.1282 23.6448 19.7889 22.0588 20.0814 21.0309C20.3739 20.003 23.1874 19.9224 26.3656 20.8508Z" fill="currentColor"/>
<path d="M10.3069 18.7365C9.56299 17.9692 7.13209 19.0948 4.87736 21.2506C2.62264 23.4064 1.39791 25.776 2.14185 26.5432C2.8858 27.3105 5.3167 26.1849 7.57143 24.0291C9.82615 21.8733 11.0509 19.5037 10.3069 18.7365Z" fill="currentColor"/>
</svg>`

// Right-pointing chevron, used in both places the SDK uses one: the
// collapsed-header indicator (which the modal's own stylesheet rotates 90deg
// via `.pera-wallet-accordion-item--active .pera-wallet-accordion-icon`, so it
// points down while expanded) and the launch button's trailing glyph.
const chevronIconSvg = (className?: string): string =>
    `<svg ${className ? `class="${className}" ` : ''}width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<path fill-rule="evenodd" clip-rule="evenodd" d="M13.0892 9.41009C13.4147 9.73553 13.4147 10.2632 13.0892 10.5886L8.08924 15.5886C7.7638 15.914 7.23616 15.914 6.91072 15.5886C6.58529 15.2632 6.58529 14.7355 6.91072 14.4101L11.3215 9.99935L6.91073 5.5886C6.58529 5.26317 6.58529 4.73553 6.91073 4.41009C7.23616 4.08466 7.7638 4.08466 8.08924 4.41009L13.0892 9.41009Z" fill="currentColor"/>
</svg>`

/**
 * Builds the item's inner markup as a faithful reproduction of the SDK's own
 * `extensionWalletOption` template (PeraWalletConnectModalDesktopMode.ts's
 * `getConnectOptions`), so the injected option is indistinguishable from the
 * one the SDK renders itself when a dApp passes `experimental: true`: a
 * collapsible accordion item whose expanded panel holds the brand glyph, a
 * one-line description and a launch button.
 *
 * Two structural details are deliberate rather than incidental:
 *
 * 1. `.pera-wallet-accordion-toggle__button` — the invisible full-size
 *    overlay — IS reproduced, together with the SDK's two-level
 *    `.pera-wallet-accordion-item` > `.pera-wallet-accordion-toggle` split.
 *    That class name is what the modal's delegated shadowRoot click handler
 *    (`handleAccordion`, PeraWalletConnectModalDesktopMode.ts:370-395, wired
 *    at :257) matches on, and it walks up via
 *    `event.target.parentElement.parentElement` to find the item to expand.
 *    Reproducing both levels satisfies that walk exactly, so collapse and
 *    expand — including collapsing whichever sibling was open — come from the
 *    SDK's own handler with no listener of ours. (An earlier revision merged
 *    both roles onto one node and had to omit the overlay precisely because
 *    that walk would then land on the container instead of an item.)
 *
 * 2. The bare `<div>` wrapping the logo and description inside
 *    `.pera-wallet-connect-modal-desktop-mode__web-wallet` is load-bearing,
 *    not stray. That class is `display:flex; flex-direction:column;
 *    justify-content:space-between`, so it needs exactly two children —
 *    text-block and button — to push the launch button to the bottom. The SDK
 *    gets the same shape via a typo (`<div class="…__web-wallet"><div>`, an
 *    unclosed second div the parser fixes up); this writes the resulting tree
 *    explicitly instead of copying malformed markup.
 *
 * `shouldDisplayNewBadge` mirrors the SDK's own `should-display-new-badge`
 * handling: it renders the badge, then hides it when the attribute is
 * "false". Omitting the element outright is equivalent and avoids the
 * inline style.
 */
const buildRowMarkup = ({
    shouldDisplayNewBadge,
}: {
    shouldDisplayNewBadge: boolean
}): string => `
<a class="pera-wallet-accordion-toggle">
  <button class="pera-wallet-accordion-toggle__button" aria-label="Show Pera Extension connect options"></button>

  ${chevronIconSvg('pera-wallet-accordion-icon')}

  <div class="pera-wallet-accordion-toggle__content-with-label">
    <div class="pera-wallet-accordion-toggle__content-with-label__text">
      Connect With
      <span class="pera-wallet-accordion-toggle__bold-color">Pera Extension</span>
    </div>
    ${
        shouldDisplayNewBadge
            ? '<span class="pera-wallet-accordion-toggle__label">NEW</span>'
            : ''
    }
  </div>
</a>

<div class="pera-wallet-accordion-item__content">
  <div class="pera-wallet-connect-modal-desktop-mode__web-wallet">
    <div>
      <div class="pera-wallet-connect-modal-desktop-mode__web-wallet__logo-wrapper">
        ${PERA_ICON_SVG}
      </div>

      <p class="pera-wallet-connect-modal-desktop-mode__web-wallet__description">
        Pera Extension detected in your browser
      </p>
    </div>

    <button id="${LAUNCH_BUTTON_ID}" type="button" class="pera-wallet-connect-modal-desktop-mode__web-wallet__launch-button">
      Connect with Extension
      ${chevronIconSvg()}
    </button>
  </div>
</div>
`

export const injectExtensionRow = (
    wrapper: Element,
    onClick: (uri: string) => void,
): boolean => {
    if (!shouldInjectRow(wrapper)) return false

    const modal = modalElement(wrapper)
    if (!modal) return false
    const root = desktopModeShadowRoot(modal)
    if (!root) return false

    // Idempotent: callers may re-invoke this on every relevant DOM mutation.
    if (root.getElementById(INJECTED_ROW_ID)) return false

    const container = ACCORDION_CONTAINER_SELECTORS.map(selector =>
        root.querySelector(selector),
    ).find((element): element is Element => element !== null)
    if (!container) return false

    const uri = extractUriFromConnectModal(wrapper)
    if (!isWcUri(uri)) return false

    const row = document.createElement('div')
    row.id = INJECTED_ROW_ID
    // A `<div>`, matching the SDK's own accordion items, so the stylesheet's
    // `:not(:last-of-type) { margin-bottom: 20px }` sibling spacing applies
    // to it by tag type. (An earlier revision used a `<button>` and had to
    // set that margin inline, because a lone `<button>` among `<div>`s is
    // both first- and last-of-type for its own tag and the rule never
    // matched.)
    //
    // Starts expanded, exactly as the SDK renders its own extension option
    // when `is-extension-available` is true — and the sibling it strips
    // `--active` from below is the same one the SDK would have left
    // collapsed, since the mobile/web templates only claim `--active` when
    // `!isExtensionAvailable`. Expanded-by-default also means the launch
    // button is reachable even if the SDK's `handleAccordion` never fires
    // (DOM drift), so expansion is an enhancement rather than a dependency.
    row.className = `${ACCORDION_ITEM_CLASS} ${ACCORDION_ITEM_ACTIVE_CLASS}`
    row.innerHTML = buildRowMarkup({
        shouldDisplayNewBadge:
            modal.getAttribute('should-display-new-badge') !== 'false',
    })

    // The pairing is driven by the launch button in the expanded panel, not
    // by a click anywhere on the item: a header click has to stay free for
    // the SDK's own collapse/expand handler.
    row.querySelector(`#${LAUNCH_BUTTON_ID}`)?.addEventListener('click', () => {
        // Re-read at click time rather than closing over the injection-time
        // `uri`. A dApp that reuses the same modal element across two
        // connect() calls updates the attribute in place — no childList
        // mutation, so the watcher doesn't re-inject and the id guard above
        // would keep the stale row. Pairing against a dead handshake topic
        // fails silently (page-initiated pairs are deliberately outcome-less),
        // which is the worst kind of failure to ship.
        const current = extractUriFromConnectModal(wrapper)
        onClick(isWcUri(current) ? current : uri)
    })

    // Only ever reached once every guard above has passed, so a modal we
    // decline to inject into is never left with its open option collapsed.
    // Scoped to the container rather than the whole shadow root (which is
    // what handleAccordion sweeps): sibling options only ever live here.
    container
        .querySelectorAll(`.${ACCORDION_ITEM_ACTIVE_CLASS}`)
        .forEach(item => item.classList.remove(ACCORDION_ITEM_ACTIVE_CLASS))

    // Prepended, not appended: the SDK lists its own extension option first
    // when extension support is enabled (renderConnectOptions appends
    // extensionWalletOption before the mobile/web options).
    container.prepend(row)
    return true
}
