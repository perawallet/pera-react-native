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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import {
    canSignArbitraryData,
    useAllAccounts,
} from '@perawallet/wallet-core-accounts'
import {
    ChainAdapterNotRegisteredError,
    LEGACY_CHAIN_ID,
} from '@perawallet/wallet-core-chain-contract'
import { encodeToBase64 } from '@perawallet/wallet-core-shared'
import {
    isAuthDataWirePayload,
    type ArbitraryDataSignRequest,
    type AuthDataSignRequest,
} from '@perawallet/wallet-core-signing'
import { useDataSigningHandler } from '../useDataSigningHandler'
import {
    TRUSTED,
    bridgeMessage,
    createMockWebview,
    injectedScript,
    languageMockValue,
} from './fixtures'

vi.mock('react-native-webview', () => ({ default: {} }))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: () => languageMockValue(),
}))

const mockShowError = vi.fn()
vi.mock('@hooks/useErrorToast', () => ({
    useErrorToast: () => ({ showError: mockShowError }),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    canSignArbitraryData: vi.fn(),
    findAccountByAddressOn: (
        accounts: { chains: Record<string, { address: string }> }[],
        chainId: string,
        address: string,
    ) => accounts.find(a => a.chains[chainId]?.address === address),
    useAllAccounts: vi.fn(),
}))

const mockCanSignAuthData = vi.fn()

const mockAddSignRequest = vi.fn()
// The auth-data discriminator is the real one: it decides the dApp-visible answers
// under test. Parsing is stubbed because the
// global shared mock lacks its byte helpers; its own spec covers the shapes.
vi.mock('@perawallet/wallet-core-signing', async () => {
    const wire = await vi.importActual<
        typeof import('../../../../../../../../packages/chain-algorand/src/signing/message/arc60-wire')
    >(
        '../../../../../../../../packages/chain-algorand/src/signing/message/arc60-wire',
    )
    const legacyWire = await vi.importActual<
        typeof import('../../../../../../../../packages/signing/src/utils/arbitrary-data-wire')
    >('../../../../../../../../packages/signing/src/utils/arbitrary-data-wire')
    return {
        isAuthDataWirePayload: vi.fn((_chainId: string, params: unknown) =>
            wire.isArc60WirePayload(params),
        ),
        legacyArbitraryDataWireSchema: legacyWire.legacyArbitraryDataWireSchema,
        parseAuthDataWireRequest: vi.fn(
            (
                _chainId: string,
                params: { authenticatorData: string; metadata: unknown },
            ) => {
                if (params.authenticatorData.length < 44) {
                    throw new Error('authenticatorData: too short')
                }
                return {
                    authData: {
                        ...params,
                        authenticatorData: new Uint8Array([1, 2, 3]),
                    },
                    metadata: params.metadata,
                }
            },
        ),
        messageSignerChainAdapters: {
            get: () => ({
                canSign: (account: unknown, kind: string) =>
                    kind === 'authData' && mockCanSignAuthData(account),
            }),
        },
        useSigningRequest: () => ({
            addSignRequest: mockAddSignRequest,
        }),
    }
})

const SOURCE_URL = 'https://discover-mobile.perawallet.app/'
const metadata = { name: 'Test dApp' }
const legacyParams = {
    data: { data: 'AQID', message: 'Sign this', signer: 'addr1' },
    metadata,
}
const arc60Params = {
    data: 'AQID',
    signer: 'addr1',
    domain: 'discover-mobile.perawallet.app',
    authenticatorData: 'A'.repeat(44),
    metadata: { scope: 1, encoding: 'base64' },
}

const lastSignRequest = <T>(): T =>
    mockAddSignRequest.mock.calls.at(-1)?.[0] as T

describe('useDataSigningHandler', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockAddSignRequest.mockImplementation(() => {})
        vi.mocked(useAllAccounts).mockReturnValue([
            {
                id: 'account-1',
                chains: { [LEGACY_CHAIN_ID]: { address: 'addr1' } },
                custody: {
                    kind: 'local',
                    seed: 'bip39',
                    hd: { account: 0, keyIndex: 0 },
                },
            },
        ] as never)
        vi.mocked(canSignArbitraryData).mockReturnValue(true)
        mockCanSignAuthData.mockReturnValue(true)
    })

    const render = () => {
        const webview = createMockWebview()
        const { result } = renderHook(() =>
            useDataSigningHandler(webview, SOURCE_URL),
        )
        return { webview, handle: result.current }
    }

    describe('legacy arbitrary data', () => {
        it('queues a webview request for the single item with the page metadata and verified origin', () => {
            const { handle } = render()

            handle(
                bridgeMessage('14', 'requestDataSigning', legacyParams),
                TRUSTED,
            )

            expect(mockAddSignRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'arbitrary-data',
                    transport: 'callback',
                    sourceType: 'webview',
                    transportId: '14',
                    data: [legacyParams.data],
                    sourceMetadata: metadata,
                    verifiedOrigin: SOURCE_URL,
                }),
            )
        })

        it('answers approval with base64 signatures', async () => {
            const { webview, handle } = render()
            handle(
                bridgeMessage('14', 'requestDataSigning', legacyParams),
                TRUSTED,
            )
            const signature = new Uint8Array([4, 5, 6])

            await lastSignRequest<ArbitraryDataSignRequest>().approve!([
                { signature, signer: 'addr1' },
            ])

            const sent = injectedScript(webview)
            expect(sent).toContain('"id":"14"')
            expect(sent).toContain(`"result":["${encodeToBase64(signature)}"]`)
        })

        it('rejects before the review sheet when the signer cannot sign arbitrary data', () => {
            // Ledger/watch signers would fail only AFTER the user slides to
            // confirm, so the preflight matches the WC transport's gate.
            vi.mocked(canSignArbitraryData).mockReturnValue(false)
            const { webview, handle } = render()

            handle(
                bridgeMessage(
                    '14-preflight',
                    'requestDataSigning',
                    legacyParams,
                ),
                TRUSTED,
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(injectedScript(webview)).toContain(
                '"error":{"code":-32602,"message":"Signer cannot sign arbitrary data"}',
            )
        })

        it('rejects before the review sheet when the signer is not a wallet account', () => {
            const { webview, handle } = render()

            handle(
                bridgeMessage('14-unknown', 'requestDataSigning', {
                    data: { data: 'AQID', signer: 'not-a-wallet-address' },
                    metadata,
                }),
                TRUSTED,
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(injectedScript(webview)).toContain('"code":-32602')
        })

        it('answers InvalidParams naming the signer when it is missing', () => {
            const { webview, handle } = render()

            handle(
                bridgeMessage('14-no-signer', 'requestDataSigning', {
                    data: { data: 'AQID' },
                    metadata,
                }),
                TRUSTED,
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(injectedScript(webview)).toContain(
                '"error":{"code":-32602,"message":"errors.webview.invalid_params"}',
            )
        })

        it.each([
            ['is not a string', { nested: true }],
            ['is not base64', '!!!!'],
            ['exceeds the size cap', 'A'.repeat(128 * 1024)],
        ])('answers InvalidParams when the data %s', (_, data) => {
            const { webview, handle } = render()

            handle(
                bridgeMessage('14-bad-data', 'requestDataSigning', {
                    data: { data, signer: 'addr1' },
                    metadata,
                }),
                TRUSTED,
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(injectedScript(webview)).toContain(
                '"error":{"code":-32602,"message":"Invalid arbitrary data payload"}',
            )
        })

        it('answers InvalidParams when metadata is missing', () => {
            const { webview, handle } = render()

            handle(
                bridgeMessage('24', 'requestDataSigning', { data: 'AQID' }),
                TRUSTED,
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(injectedScript(webview)).toContain('"code":-32602')
        })

        it('answers InternalError and tells the user when the queue refuses the request', () => {
            const error = new Error('Data sign limit exceeded')
            mockAddSignRequest.mockImplementation(() => {
                throw error
            })
            const { webview, handle } = render()

            handle(
                bridgeMessage('31', 'requestDataSigning', legacyParams),
                TRUSTED,
            )

            expect(injectedScript(webview)).toContain(
                '"error":{"code":-32603,"message":"An error occurred during signing"}',
            )
            expect(mockShowError).toHaveBeenCalledWith(
                error,
                'errors.signing.title',
            )
        })
    })

    describe('ARC-60', () => {
        it('queues the parsed request bound to the per-message verified origin', () => {
            const { handle } = render()

            handle(
                bridgeMessage('14-arc60', 'requestDataSigning', arc60Params),
                {
                    securedConnection: true,
                    sourceUrl: 'https://per-message.example/',
                },
            )

            const request = lastSignRequest<AuthDataSignRequest>()
            expect(request).toMatchObject({
                type: 'auth-data',
                sourceType: 'webview',
                transportId: '14-arc60',
                // The verified origin, not dApp-asserted metadata, is what
                // the analyzer checks the SIWA domain against.
                sourceMetadata: { url: 'https://per-message.example/' },
                verifiedOrigin: 'https://per-message.example/',
                metadata: arc60Params.metadata,
            })
            expect(request.authData.signer).toBe('addr1')
            expect(request.authData.authenticatorData).toBeInstanceOf(
                Uint8Array,
            )
        })

        it('rejects a signer that cannot sign ARC-60 before the review sheet', () => {
            // An ARC-60 signature verifies against the signer's own key, so a
            // keyless rekeyed signer is refused even if its auth key is held.
            mockCanSignAuthData.mockReturnValue(false)
            const { webview, handle } = render()

            handle(
                bridgeMessage(
                    '14-arc60-rekeyed',
                    'requestDataSigning',
                    arc60Params,
                ),
                TRUSTED,
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            expect(injectedScript(webview)).toContain(
                '"error":{"code":-32602,"message":"errors.webview.invalid_params"}',
            )
        })

        it('answers InvalidParams for a malformed ARC-60 payload', () => {
            const { webview, handle } = render()

            handle(
                bridgeMessage('14-arc60-bad', 'requestDataSigning', {
                    ...arc60Params,
                    authenticatorData: 'short',
                }),
                TRUSTED,
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            const sent = injectedScript(webview)
            expect(sent).toContain('"id":"14-arc60-bad"')
            expect(sent).toContain('"code":-32602')
        })

        it('answers the page when the chain has no message signer registered', () => {
            vi.mocked(isAuthDataWirePayload).mockImplementationOnce(() => {
                throw new ChainAdapterNotRegisteredError(
                    'message-signer',
                    LEGACY_CHAIN_ID,
                )
            })
            const { webview, handle } = render()

            handle(
                bridgeMessage(
                    '14-arc60-unregistered',
                    'requestDataSigning',
                    arc60Params,
                ),
                TRUSTED,
            )

            expect(mockAddSignRequest).not.toHaveBeenCalled()
            const sent = injectedScript(webview)
            expect(sent).toContain('"id":"14-arc60-unregistered"')
            expect(sent).toContain('"code":-32602')
        })
    })

    // The lifecycle is shared by both payload shapes; the dApp-visible answers
    // are what this path owns.
    describe.each([
        ['legacy', legacyParams],
        ['ARC-60', arc60Params],
    ])('%s request outcome', (_kind, params) => {
        const enqueue = () => {
            const rendered = render()
            rendered.handle(
                bridgeMessage('out', 'requestDataSigning', params),
                TRUSTED,
            )
            return {
                ...rendered,
                request: lastSignRequest<ArbitraryDataSignRequest>(),
            }
        }

        it('answers a user reject as InternalError "User rejected"', async () => {
            const { webview, request } = enqueue()

            await request.reject!()

            expect(injectedScript(webview)).toContain(
                '"error":{"code":-32603,"message":"User rejected"}',
            )
        })

        it('answers a failure with sanitized InternalError copy', async () => {
            const { webview, request } = enqueue()

            await request.error!(new Error('Unauthorized'))

            expect(injectedScript(webview)).toContain(
                '"error":{"code":-32603,"message":"An error occurred during signing"}',
            )
        })
    })
})
