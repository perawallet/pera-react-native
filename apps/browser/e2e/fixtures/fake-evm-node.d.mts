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

// Hand-written declaration for the plain-JS fixture (fake-evm-node.mjs), for
// the same reason as fake-wc-bridge.d.mts.
export type FakeEvmNode = {
    /** Every `eth_sendRawTransaction` payload, in arrival order. */
    rawTransactions: string[]
    unansweredMethods: string[]
    /** Every JSON-RPC method received, in arrival order. */
    methods: string[]
    setChainId: (chainId: number) => void
    respond: (body: unknown) => unknown
    reply: (body: unknown) => Promise<unknown>
    /** Records broadcasts on arrival but answers none until the returned release is called. */
    holdBroadcasts: () => () => void
}

export declare const evmTxHashOf: (raw: string) => string

export declare const createFakeEvmNode: () => FakeEvmNode

export declare const E2E_EVM_RPC_PORT: number
export declare const E2E_EVM_RPC_URL: string

export declare const serveFakeEvmNode: (
    node: FakeEvmNode,
    options: { port: number },
) => Promise<{ url: string; close: () => Promise<void> }>
