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

/** The slice of a zustand persist-middleware store this helper needs. */
export type HydratableStore = {
    persist: {
        hasHydrated: () => boolean
        onFinishHydration: (callback: () => void) => () => void
    }
}

/**
 * Resolve once `store` has rehydrated, or once `timeoutMs` elapses.
 *
 * The timeout is not a nicety: zustand's persist middleware never fires
 * `onFinishHydration` if rehydration rejects (corrupt persisted JSON, storage
 * read failure) and `hasHydrated()` stays false forever. An unguarded wait
 * would hang whatever bootstrap branch awaits it — and with it the splash gate
 * — with no recovery short of a reinstall. Timing out just means this launch
 * reads the store's defaults instead of saved values.
 */
export const waitForStoreHydration = (
    store: HydratableStore,
    timeoutMs: number,
): Promise<void> => {
    if (store.persist.hasHydrated()) return Promise.resolve()

    return new Promise(resolve => {
        let settled = false
        const finish = () => {
            if (settled) return
            settled = true
            resolve()
        }
        const unsubscribe = store.persist.onFinishHydration(() => {
            unsubscribe()
            finish()
        })
        setTimeout(() => {
            unsubscribe()
            finish()
        }, timeoutMs)
    })
}
