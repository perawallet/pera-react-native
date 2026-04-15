/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { createActor } from 'xstate'
import type {
    WalletAccount,
    AuthAddressLookup,
} from '@perawallet/wallet-core-accounts'
import type { SignRequest } from '../models'
import type { SigningMachineDeps } from './context'
import { signingMachine } from './signingMachine'

/**
 * Creates a configured signingMachine actor for a single SignRequest.
 *
 * Called from useSigningRequest (Phase 6) where all runtime deps
 * (KMS functions, AlgoKit client, etc.) are available via React hooks.
 *
 * @param request       The sign request to process
 * @param allAccounts   All user accounts (for signer resolution and analysis)
 * @param authAddresses On-chain auth-address lookup captured at request time
 * @param deps          Runtime dependencies injected from the React hook layer
 */
export const createSigningMachine = (
    request: SignRequest,
    allAccounts: WalletAccount[],
    authAddresses: AuthAddressLookup,
    deps: SigningMachineDeps,
) =>
    createActor(signingMachine, {
        id: request.id,
        input: { request, allAccounts, authAddresses, ...deps },
    })
