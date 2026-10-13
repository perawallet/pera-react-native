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

/**
 * The v2 handler's own entry, reached as
 * `@perawallet/wallet-core-walletconnect/v2`. Kept out of the package barrel
 * on purpose: `apps/browser` imports the barrel, and one re-export from here
 * would put `@reown/walletkit` and `@walletconnect/core` in its graph for a
 * handler it never registers.
 *
 * Only what a composition root needs — the record guards and CAIP-2 helpers
 * are barrel exports already, because they carry no transport.
 */

export {
    createWalletConnectV2Handler,
    type CreateWalletConnectV2HandlerOptions,
} from './handler'
