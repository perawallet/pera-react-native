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

// Evaluating these packages costs seconds on a mid-range Android phone, and a
// static import ran that before the first frame of every launch. Loading them
// here defers it to the first WalletConnect v2 use.
const load = async () => {
    const [core, walletKit, utils] = await Promise.all([
        import('@walletconnect/core'),
        import('@reown/walletkit'),
        import('@walletconnect/utils'),
    ])
    return {
        Core: core.Core,
        // Core's own name for the event, read from the SDK rather than spelled
        // out, so a rename cannot leave the wallet listening for a frame
        // nothing emits.
        expirerExpiredEvent: core.EXPIRER_EVENTS.expired,
        WalletKit: walletKit.WalletKit,
        buildApprovedNamespaces: utils.buildApprovedNamespaces,
        getSdkError: utils.getSdkError,
    }
}

export type WalletConnectSdk = Awaited<ReturnType<typeof load>>

let pending: Promise<WalletConnectSdk> | null = null

export const loadWalletConnectSdk = (): Promise<WalletConnectSdk> => {
    pending ??= load().catch((error: unknown) => {
        // A failed load is retried on the next initialize rather than cached.
        pending = null
        throw error
    })
    return pending
}
