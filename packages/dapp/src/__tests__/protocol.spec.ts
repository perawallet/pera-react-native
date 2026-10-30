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

import { describe, expect, it } from 'vitest'
import {
    DAPP_APPROVAL_TTL_MS,
    DAPP_KIND,
    DAPP_METHODS,
    DAPP_NOTIFICATIONS,
    DAPP_PAGE_TIMEOUT_MS,
    DAPP_PROVIDER_VERSION,
    DAPP_PROVIDERS,
    DAPP_REQUEST_TTL_MS,
    DAPP_QUEUED_PAGE_TIMEOUT_MS,
    dappPageTimeoutMs,
    isDappProvider,
} from '../protocol'

// These strings are the wire contract a shipped dApp integration compiles
// against; changing one silently breaks every page already using it.
describe('dapp protocol constants', () => {
    it('pins the kind, method set and notification names', () => {
        expect(DAPP_KIND).toBe('dapp')
        expect([...DAPP_METHODS]).toEqual([
            'connect',
            'disconnect',
            'getAddresses',
            'getEmptySignatures',
            'requestTransactionSigning',
            'requestDataSigning',
        ])
        expect(DAPP_NOTIFICATIONS).toEqual({
            accountsChanged: 'accountsChanged',
            networkChanged: 'networkChanged',
            disconnect: 'disconnect',
        })
        expect(DAPP_PROVIDER_VERSION).toBe('1')
    })

    it('tags each page provider and recognises only those tags', () => {
        expect([...DAPP_PROVIDERS]).toEqual(['pera', 'eip1193'])
        expect(isDappProvider('eip1193')).toBe(true)
        expect(isDappProvider('ethereum')).toBe(false)
        expect(isDappProvider(undefined)).toBe(false)
    })

    it('leaves the page backstop losing the race to the handler expiry', () => {
        expect(DAPP_PAGE_TIMEOUT_MS).toBeGreaterThan(DAPP_REQUEST_TTL_MS)
        expect(DAPP_QUEUED_PAGE_TIMEOUT_MS).toBeGreaterThan(
            DAPP_REQUEST_TTL_MS + DAPP_APPROVAL_TTL_MS,
        )
    })

    it('gives only queued EIP-1193 methods the queued backstop', () => {
        expect(dappPageTimeoutMs('eip1193', 'eth_sendTransaction')).toBe(
            DAPP_QUEUED_PAGE_TIMEOUT_MS,
        )
        expect(dappPageTimeoutMs('eip1193', 'wallet_switchEthereumChain')).toBe(
            DAPP_QUEUED_PAGE_TIMEOUT_MS,
        )
        expect(dappPageTimeoutMs('eip1193', 'eth_signTypedData')).toBe(
            DAPP_QUEUED_PAGE_TIMEOUT_MS,
        )
        expect(dappPageTimeoutMs('eip1193', 'eth_chainId')).toBe(
            DAPP_PAGE_TIMEOUT_MS,
        )
        expect(dappPageTimeoutMs('pera', 'eth_sendTransaction')).toBe(
            DAPP_PAGE_TIMEOUT_MS,
        )
    })
})
