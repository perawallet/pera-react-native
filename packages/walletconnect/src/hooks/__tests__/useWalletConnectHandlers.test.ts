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

import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import useWalletConnectHandlers from '../useWalletConnectHandlers'
import { useWalletConnectStore } from '../../store'
import { useSigningRequest } from '@perawallet/wallet-core-blockchain'
import { useNetwork } from '@perawallet/wallet-core-platform-integration'
import { Networks } from '@perawallet/wallet-core-shared'
import {
    WalletConnectInvalidNetworkError,
    WalletConnectInvalidSessionError,
    WalletConnectSignRequestError,
} from '../../errors'

// Mock dependencies
vi.mock('../../store', () => ({
    useWalletConnectStore: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useSigningRequest: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-platform-integration', () => ({
    useNetwork: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual('@perawallet/wallet-core-shared')
    return {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(actual as any),
        logger: {
            debug: vi.fn(),
            error: vi.fn(),
        },
    }
})

describe('useWalletConnectHandlers', () => {
    const mockAddSignRequest = vi.fn()
    const mockSessions = [
        {
            session: {
                clientId: 'test-client-id',
                chainId: 4160,
            },
        },
    ]

    beforeEach(() => {
        vi.clearAllMocks()
        ;(useSigningRequest as any).mockReturnValue({
            addSignRequest: mockAddSignRequest,
        })
        ;(useNetwork as any).mockReturnValue({
            network: Networks.mainnet,
        })
        ;(useWalletConnectStore as any).mockImplementation((selector: any) =>
            selector({ walletConnectSessions: mockSessions }),
        )
    })

    describe('handleSignData', () => {
        it('should call addSignRequest with correct params when request is valid', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
            }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        data: 'somedata',
                    },
                ],
            }

            result.current.handleSignData(connector as any, null, payload)

            expect(mockAddSignRequest).toHaveBeenCalledWith({
                type: 'arbitrary-data',
                transport: 'walletconnect',
                transportId: 'test-client-id',
                message: 'Sign me',
                addresses: ['addr1'],
                data: 'somedata',
            })
        })

        it('should throw WalletConnectSignRequestError if error is present', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const error = new Error('Some error')

            expect(() =>
                result.current.handleSignData(connector as any, error, {}),
            ).toThrow(WalletConnectSignRequestError)
        })

        it('should throw WalletConnectInvalidSessionError if session not found', () => {
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) => selector({ walletConnectSessions: [] }),
            )
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }

            expect(() =>
                result.current.handleSignData(connector as any, null, {}),
            ).toThrow(WalletConnectInvalidSessionError)
        })

        it('should throw WalletConnectInvalidNetworkError if chainId mismatches', () => {
            const mockSessionsMismatch = [
                {
                    session: {
                        clientId: 'test-client-id',
                        chainId: 999999,
                    },
                },
            ]
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) =>
                    selector({ walletConnectSessions: mockSessionsMismatch }),
            )
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }

            expect(() =>
                result.current.handleSignData(connector as any, null, {}),
            ).toThrow(WalletConnectInvalidNetworkError)
        })

        it('should throw WalletConnectSignRequestError if param is missing', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const payload = { params: [] }

            expect(() =>
                result.current.handleSignData(connector as any, null, payload),
            ).toThrow(WalletConnectSignRequestError)
        })

        it('should throw WalletConnectSignRequestError if data is missing', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }
            const payload = {
                params: [
                    {
                        message: 'Sign me',
                        // data is missing
                    },
                ],
            }

            expect(() =>
                result.current.handleSignData(connector as any, null, payload),
            ).toThrow(WalletConnectSignRequestError)
        })
    })

    describe('handleSignTransaction', () => {
        it('should call addSignRequest with correct params when request is valid', () => {
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = {
                clientId: 'test-client-id',
                accounts: ['addr1'],
            }
            const payload = {
                params: [
                    {
                        message: 'Sign tx',
                        txn: 'encodedTxn',
                    },
                ],
            }

            result.current.handleSignTransaction(
                connector as any,
                null,
                payload,
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith({
                type: 'transactions',
                transport: 'walletconnect',
                transportId: 'test-client-id',
                message: 'Sign tx',
                addresses: ['addr1'],
                txs: ['encodedTxn'],
            })
        })

        it('should throw WalletConnectInvalidSessionError if session not found', () => {
            ;(useWalletConnectStore as any).mockImplementation(
                (selector: any) => selector({ walletConnectSessions: [] }),
            )
            const { result } = renderHook(() => useWalletConnectHandlers())
            const connector = { clientId: 'test-client-id' }

            expect(() =>
                result.current.handleSignTransaction(
                    connector as any,
                    null,
                    {},
                ),
            ).toThrow(WalletConnectInvalidSessionError)
        })
    })
})
