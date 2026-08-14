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

import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

// Honours `before`/publishes the same protective `.catch()` the real engine
// does (see `@algorandfoundation/react-native-keystore/dist/engine.js`), so
// these tests exercise the real gating contract instead of a mock that
// discards it and passes vacuously.
vi.mock('@algorandfoundation/react-native-keystore', () => ({
    WithKeyStore: () => ({ key: { store: {} } }),
    createReactNativeKeyStore: (opts: { before?: Promise<unknown> }) => {
        const driverReady = Promise.resolve()
        const ready = Promise.resolve(opts.before).then(() => driverReady)
        ready.catch(() => {
            /* surfaced through `ready` to whoever awaits it */
        })
        return { ready, clear: vi.fn() }
    },
    decode: vi.fn(),
    storage: { getAllKeys: vi.fn(() => []), getString: vi.fn() },
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native', () => ({
    WithLedgerExtension: () => ({}),
}))

vi.mock('@perawallet/wallet-extension-ledger-react-native-usb', () => ({
    WithLedgerUsbExtension: () => ({}),
}))

// Overrides the global mock from `vitest.setup.ts` for this file only, so
// individual tests can make it throw to simulate an unrelated extension
// failing during construction.
const platformMock = vi.hoisted(() => ({
    impl: vi.fn(() => ({})),
}))
vi.mock('@perawallet/wallet-extension-platform-driver', () => ({
    WithPlatformExtension: (...args: unknown[]) => platformMock.impl(...args),
}))

// A controllable stand-in for the real `WithMigrations`: exposes the same
// `provider.migrations.ready` shape, but lets each test decide exactly when
// (and whether) it settles, so the deferred-promise wiring in `singleton.ts`
// can be driven deterministically instead of racing the real engine's
// microtask-scheduled `applyMigrations` run.
const migrationsMock = vi.hoisted(() => ({
    controller: null as null | {
        resolve: (report: unknown) => void
        reject: (error: unknown) => void
    },
}))
vi.mock('@algorandfoundation/provider-migrations', () => ({
    WithMigrations: (
        _provider: unknown,
        options?: { migrations?: { ledger?: unknown } },
    ) => {
        if (!options?.migrations?.ledger) {
            throw new Error('MissingLedgerError')
        }
        let resolve!: (report: unknown) => void
        let reject!: (error: unknown) => void
        const ready = new Promise((res, rej) => {
            resolve = res
            reject = rej
        })
        ready.catch(() => {
            /* surfaced through `ready` to whoever awaits it */
        })
        migrationsMock.controller = { resolve, reject }
        return {
            migrations: {
                ready,
                register: () => {},
                run: () => ready,
                hooks: {},
            },
        }
    },
    // `migrationsLedger.ts` (Task 1) calls this to build the real ledger
    // `singleton.ts` passes as `migrations.ledger` — irrelevant to what these
    // tests assert, but it must exist for the module graph to load.
    keyValueLedger: (kv: { get: (key: string) => unknown }) => ({
        read: async () => ({}),
        write: async () => {},
        kv,
    }),
}))

describe('singleton migrations construction wiring', () => {
    beforeEach(() => {
        vi.resetModules()
        migrationsMock.controller = null
        platformMock.impl.mockReset()
        platformMock.impl.mockImplementation(() => ({}))
    })

    it('threads the deferred into the keystore as `before`, resolving it once provider.migrations.ready settles', async () => {
        const { getKeystore, getMigrationsReady } = await import('../singleton')

        const order: string[] = []
        const keystoreReady = getKeystore().ready.then(() => {
            order.push('hydrated')
        })

        // Flush pending microtasks without settling anything: if `before` were
        // ever dropped, `keystoreReady` would already have resolved by now.
        await new Promise(resolve => setTimeout(resolve, 0))
        order.push('migrations settled')

        const report = { applied: [], failed: [], ahead: [] }
        migrationsMock.controller?.resolve(report)

        await keystoreReady
        expect(order).toEqual(['migrations settled', 'hydrated'])
        await expect(getMigrationsReady()).resolves.toEqual(report)
    })

    it('propagates a provider.migrations.ready rejection through the deferred to keystore.ready', async () => {
        const { getKeystore, getMigrationsReady } = await import('../singleton')

        const error = new Error('migration failed')
        migrationsMock.controller?.reject(error)

        await expect(getMigrationsReady()).rejects.toBe(error)
        await expect(getKeystore().ready).rejects.toBe(error)
    })

    // The deferred is created, then handed to the keystore as `before`, before
    // `new PeraProvider(...)` runs. If any extension in that synchronous
    // constructor chain throws for an unrelated reason — simulated here via
    // `WithPlatformExtension`, but the same applies to `WithMigrations` itself
    // or to `createPeraKeystore` throwing even earlier — the module never
    // finishes evaluating, so `instance.migrations.ready.then(...)` never runs
    // and the deferred is left permanently unsettled. That is only safe
    // because nothing downstream can ever obtain a handle to it: the whole
    // `import('../singleton')` rejects instead, so a caller sees a loud
    // failure rather than an app silently parked on an unsettled `before`.
    it('fails the module import loudly instead of leaving the deferred unsettled when construction throws', async () => {
        platformMock.impl.mockImplementationOnce(() => {
            throw new Error('boom')
        })

        await expect(import('../singleton')).rejects.toThrow('boom')
    })
})
