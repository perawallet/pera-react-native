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

import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// A sentinel rather than `{}`: the assertion below is reference identity, so
// it fails on a `subtle` that is merely present but not the engine's.
const rnqc = vi.hoisted(() => ({ subtle: { __pera: 'subtle-sentinel' } }))
vi.mock('react-native-quick-crypto', () => ({ subtle: rnqc.subtle }))

vi.mock('@perawallet/wallet-extension-ledger-react-native', () => ({
    WithLedgerExtension: () => ({}),
}))
vi.mock('@perawallet/wallet-extension-ledger-react-native-usb', () => ({
    WithLedgerUsbExtension: () => ({}),
}))

/**
 * Captures the options `singleton.ts` hands to `WithKeyStore`, which is the one
 * place `subtle` can reach upstream's migration context: it builds that context
 * as `subtle: options.keystore.subtle`
 * (`react-native-keystore@canary.19/dist/extension.js:88-96`).
 *
 * The real `WithKeyStore` cannot be loaded off device — its module graph
 * reaches `storage/state.js` → `react-native-mmkv` → `react-native`'s
 * Flow-typed `index.js`, which the test transformer refuses, and the package is
 * externalised so `vi.mock` does not reach inside it. So this stands in for it
 * and records what it was given. What is asserted is a runtime VALUE, not
 * source text: the previous version of this test grepped `singleton.ts` for the
 * string `subtle` over a slice that also contained a comment using the word
 * three times, and stayed green with the wiring deleted.
 */
const captured = vi.hoisted(() => ({
    keystoreOptions: undefined as { subtle?: unknown } | undefined,
}))
vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: (
        _provider: unknown,
        options: { keystore: { subtle?: unknown } },
    ) => {
        captured.keystoreOptions = options.keystore
        return { key: { store: {} } }
    },
    createReactNativeKeyStore: () => ({
        ready: Promise.resolve(),
        clear: vi.fn(),
    }),
    decode: vi.fn(),
    METADATA_PREFIX: 'k/',
    readMasterKey: vi.fn(),
    storage: { getAllKeys: () => [], getString: () => undefined },
}))

describe('keystore provider options', () => {
    it('passes the engine subtle into options.keystore, where upstream reads its migration context from', async () => {
        const { subtle } = await import('../keystore/subtle')
        await import('../singleton')

        expect(captured.keystoreOptions).toBeDefined()
        expect(captured.keystoreOptions?.subtle).toBe(subtle)
        expect(subtle).toBe(rnqc.subtle)
    })

    // `singleton.ts` has no `.web.ts` twin and `index.ts` exports it
    // unconditionally for both platforms, so it must never pull in a
    // react-native-only runtime import — `react-native-quick-crypto` is
    // externalised in vite.config.ts and survives unresolved into web dist.
    it('does not import react-native-quick-crypto directly', () => {
        const source = readFileSync(
            resolve(__dirname, '../singleton.ts'),
            'utf8',
        )

        expect(source).not.toContain('react-native-quick-crypto')
    })

    // The native/`.web.ts` split for `subtle` must actually exist, or the
    // check above is vacuous.
    it('sources subtle from a platform-split module', () => {
        const source = readFileSync(
            resolve(__dirname, '../singleton.ts'),
            'utf8',
        )

        expect(source).toContain("from './keystore/subtle'")

        const native = readFileSync(
            resolve(__dirname, '../keystore/subtle.ts'),
            'utf8',
        )
        const web = readFileSync(
            resolve(__dirname, '../keystore/subtle.web.ts'),
            'utf8',
        )

        expect(native).toContain('react-native-quick-crypto')
        expect(web).not.toContain('react-native-quick-crypto')
    })
})
