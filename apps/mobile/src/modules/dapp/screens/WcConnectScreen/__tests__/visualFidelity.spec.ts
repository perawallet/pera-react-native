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

// Guards the ONE promise the web twin makes: it looks like mobile's
// ConnectionView. Phase one deliberately duplicates that component rather than
// refactoring it (owner decision, 2026-07-30), and a duplicate with nothing
// holding it to its original silently drifts — the twin gets a tweak, mobile
// doesn't, and "make it look the same" quietly stops being true.
//
// Source-scanning rather than rendering, for the same reason
// webConnectorOwnership.test.ts scans source: the claim is about what the code
// references, which a render can't observe. A snapshot would pin the twin to
// itself, not to mobile — exactly the drift this needs to catch.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const MOBILE_DIR = join(
    __dirname,
    '../../../../walletconnect/components/ConnectionView',
)
const TWIN_DIR = join(__dirname, '..')

const read = (path: string): string => readFileSync(path, 'utf8')

const mobileHeader = read(join(MOBILE_DIR, 'ConnectionViewHeader.tsx'))
const mobileView = read(join(MOBILE_DIR, 'ConnectionView.tsx'))
const twinHeader = read(join(TWIN_DIR, 'WcConnectHeader.tsx'))
const twinView = read(join(TWIN_DIR, 'WcConnectScreen.tsx'))
const twinStyles = read(join(TWIN_DIR, 'styles.ts'))

// `styles.foo` / `styles.foo` inside template positions — the style keys a
// component actually applies.
const styleKeys = (source: string): Set<string> =>
    new Set([...source.matchAll(/\bstyles\.([A-Za-z0-9_]+)/g)].map(m => m[1]))

// i18n keys, both plain and template-literal forms.
const i18nKeys = (source: string): Set<string> =>
    new Set([...source.matchAll(/\bt\(\s*[`']([^`'$]+)[`']/g)].map(m => m[1]))

describe('WcConnectScreen visual fidelity with mobile ConnectionView', () => {
    it('applies no style key that mobile does not, so nothing is styled ad hoc', () => {
        const mobileKeys = new Set([
            ...styleKeys(mobileHeader),
            ...styleKeys(mobileView),
        ])
        // The requester row has no mobile counterpart (mobile pairs by QR, so
        // there is no verified requesting tab to attribute) and lives in the
        // twin's own small stylesheet.
        const localKeys = styleKeys(twinStyles.replace(/\bstyles\./g, ''))
        const twinKeys = new Set([
            ...styleKeys(twinHeader),
            ...styleKeys(twinView),
        ])

        const extra = [...twinKeys].filter(
            key => !mobileKeys.has(key) && !localKeys.has(key),
        )
        expect(extra).toEqual([])
    })

    it('takes those styles from ConnectionView’s own stylesheet instead of redeclaring them', () => {
        const shared =
            "from '@modules/walletconnect/components/ConnectionView/styles'"
        expect(twinHeader).toContain(shared)
        expect(twinView).toContain(shared)

        // The twin's local stylesheet must stay limited to the requester row.
        // Anything else appearing here is a value copied out of mobile's, which
        // is how the two drift on spacing or colour.
        const localDeclared = [
            ...twinStyles.matchAll(/^\s{4}([A-Za-z0-9_]+):\s*\{/gm),
        ].map(m => m[1])
        expect(localDeclared.sort()).toEqual([
            'requesterOrigin',
            'verifiedBadge',
            'verifiedBadgeText',
            'verifiedRow',
        ])
    })

    it('renders mobile’s header copy, apart from the network badges the extension shows globally', () => {
        // Catches a dropped permissions panel title or the "{{name}} wants to
        // connect" headline — each would leave the twin looking materially
        // different from the screen it copies.
        //
        // The network badges are the documented exception (owner report,
        // 2026-07-30): TestnetIndicator already states the active network at
        // the top of every extension surface and lands in the same spot, so a
        // badge here both collided with it and repeated it. See the comment at
        // the top of WcConnectHeader's returned tree.
        const SHOWN_GLOBALLY_BY_TESTNET_INDICATOR = [
            'walletconnect.request.networks_mainnet',
            'walletconnect.request.networks_testnet',
        ]

        const missing = [...i18nKeys(mobileHeader)].filter(
            key =>
                !twinHeader.includes(key) &&
                !SHOWN_GLOBALLY_BY_TESTNET_INDICATOR.includes(key),
        )
        expect(missing).toEqual([])
    })

    it('does not render a network badge at all, so it cannot collide with the global indicator', () => {
        // Guards the fix rather than only the copy list above: re-adding
        // PWBadge here would put the collision straight back.
        expect(twinHeader).not.toContain('PWBadge')
        expect(twinHeader).not.toContain('networksContainer')
    })

    it('keeps mobile’s body and footer copy, apart from the retry path web cannot have', () => {
        // Mobile keeps its sheet open on an approve-delivery failure and toasts
        // so Connect can be retried in place. The extension can't: `approve()`
        // settles the approval and the bridge closes the window, and delivery
        // to the socket happens afterwards in offscreen — fire-and-forget by
        // design (see the headless-WC spec's Error handling). So these two keys
        // have no counterpart here. Listed explicitly rather than loosening the
        // check to the two button labels, so a future dropped key still fails.
        const WEB_HAS_NO_IN_PLACE_RETRY = [
            'walletconnect.request.error_sheet_title',
            'walletconnect.connection.approve_delivery_failed',
        ]

        const missing = [...i18nKeys(mobileView)].filter(
            key =>
                !twinView.includes(key) &&
                !WEB_HAS_NO_IN_PLACE_RETRY.includes(key),
        )
        expect(missing).toEqual([])
    })

    it('reuses mobile’s leaf components rather than reimplementing them', () => {
        // These carry the look of the permissions list and the account rows.
        for (const component of [
            'PermissionItem',
            'TitledExpandablePanel',
            'ProjectVerificationIcon',
        ]) {
            expect(twinHeader).toContain(component)
        }
        expect(twinView).toContain('AccountDisplay')
        expect(twinView).toContain('PWCheckbox')
    })
})
