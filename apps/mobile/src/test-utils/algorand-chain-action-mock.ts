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

type BuildSpy = (params: unknown) => unknown

/**
 * Stubs the AlgoKit keyreg build under the Algorand deeplink adapter, so a
 * spec runs the real chain action and sees the params it builds with. Pair it
 * with `algorandUnsignedTransactionMock` so the stub's result is enqueued as is.
 *
 * `vi.mock('@packages/chain-algorand/src/transactions/builders', async () => (await import('@test-utils/algorand-chain-action-mock')).algorandKeyregBuilderMock(onOffline, onOnline))`
 */
export const algorandKeyregBuilderMock = (
    onOffline: BuildSpy,
    onOnline: BuildSpy,
) => ({
    buildKeyRegistrationTx: (params: { kind: string }) =>
        params.kind === 'offline' ? onOffline(params) : onOnline(params),
})

export const algorandUnsignedTransactionMock = () => ({
    toUnsignedAlgorandTransaction: (transaction: unknown) => transaction,
})
