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

// An ethereum: link reaches the wallet from the OS (cold and warm start) and
// from a page in the in-app browser; each entry point applies its own policy.

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { Linking } from 'react-native'
import { Notifier } from 'react-native-notifier'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import type { Optional } from '@perawallet/wallet-core-shared'
import { render } from '@test-utils/render'
import { useBottomSheetStore } from '@modules/bottom-sheet'
import { ConnectionsProvider } from '@modules/connections/shell'
import {
    resetDeeplinkListenerStateForTesting,
    useDeeplinkListener,
} from '@modules/deeplink/hooks/useDeeplinkListener'
import { useSendFundsStore } from '@modules/transactions'
import { SendFundsContent } from '@modules/transactions/routes'
import { useWebViewNavigationGuard } from '@modules/webview/components/PWWebView/useWebViewNavigationGuard'
import { registerAppBottomSheets } from '../bootstrap/bottom-sheet-registrations'

import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

// Hardhat accounts #0 and #1, from the public test mnemonic, and USDC.
const SENDER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const RECEIVER = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

const ETHER_LINK = `ethereum:${RECEIVER}@1?value=1`
const APPROVE_LINK = `ethereum:${TOKEN}@1/approve?address=${RECEIVER}&uint256=1`

const ETHEREUM_SENDER: WalletAccount = {
    id: 'eth-sender',
    custody: { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
    chains: { ethereum: { address: SENDER, keyPairId: 'eth-key' } },
    name: 'Eth sender',
} as WalletAccount

type UrlListener = (event: { url: string }) => void
const captured: {
    urlListener: Optional<UrlListener>
    shouldStartLoad: Optional<(request: ShouldStartLoadRequest) => boolean>
} = { urlListener: undefined, shouldStartLoad: undefined }

const OsLinkListener = () => {
    useDeeplinkListener()
    return null
}

const BrowserPage = ({ isTrustedOrigin }: { isTrustedOrigin: boolean }) => {
    captured.shouldStartLoad = useWebViewNavigationGuard({
        isTrustedOrigin,
        pageUrl: isTrustedOrigin
            ? 'https://discover-mobile.perawallet.app/'
            : 'https://evil.example/',
    }).onShouldStartLoadWithRequest
    return null
}

const openedSheets = () =>
    useBottomSheetStore
        .getState()
        .requests.map(request => (request.contents as { type: unknown }).type)

const expectToastTitled = (title: string) =>
    waitFor(() =>
        expect(Notifier.showNotification).toHaveBeenCalledWith(
            expect.objectContaining({ title }),
        ),
    )

const expectPrefilledEtherSend = () => {
    expect(useAccountsStore.getState().selectedAccountId).toBe('eth-sender')
    const send = useSendFundsStore.getState()
    expect(send.selectedAsset).toEqual({
        chainId: 'ethereum',
        assetId: 'native',
    })
    expect(send.destination).toBe(RECEIVER)
    expect(openedSheets()).toEqual([SendFundsContent])
}

const clickInPage = (url: string, isTopFrame = true): boolean =>
    captured.shouldStartLoad!({
        url,
        isTopFrame,
        navigationType: 'click',
    } as ShouldStartLoadRequest)

describe('Flow: ethereum: links from outside the app', () => {
    beforeAll(() => {
        registerAppBottomSheets()
    })

    beforeEach(() => {
        resetDeeplinkListenerStateForTesting()
        captured.urlListener = undefined
        captured.shouldStartLoad = undefined
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
        useSendFundsStore.getState().reset()
        vi.mocked(Notifier.showNotification).mockClear()
        vi.mocked(Linking.getInitialURL).mockResolvedValue(null)
        // The browser guard probes for social apps on mount.
        vi.mocked(Linking.canOpenURL).mockResolvedValue(false)
        vi.mocked(Linking.addEventListener).mockImplementation(((
            _type: string,
            listener: UrlListener,
        ) => {
            captured.urlListener = listener
            return { remove: vi.fn() }
        }) as unknown as typeof Linking.addEventListener)
        useAccountsStore.getState().setAccounts([ETHEREUM_SENDER])
        useAccountsStore.getState().setSelectedAccountId('eth-sender')
    })

    describe('Given the OS hands Pera an ethereum: link', () => {
        const mountListener = async () => {
            render(
                <ConnectionsProvider>
                    <OsLinkListener />
                </ConnectionsProvider>,
            )
            await waitFor(() => expect(captured.urlListener).toBeTruthy())
        }

        it('When the app cold-starts from the link, then a prefilled send opens', async () => {
            vi.mocked(Linking.getInitialURL).mockResolvedValue(ETHER_LINK)

            await mountListener()

            await waitFor(() => expectPrefilledEtherSend(), { timeout: 3000 })
        })

        it('When the running app receives the link, then a prefilled send opens', async () => {
            await mountListener()

            captured.urlListener!({ url: ETHER_LINK })

            await waitFor(() => expectPrefilledEtherSend())
        })

        it('When the link asks for an approve, then it shows the not-supported error and opens nothing', async () => {
            await mountListener()

            captured.urlListener!({ url: APPROVE_LINK })

            await expectToastTitled('deeplink.error.title_unsupported')
            expect(openedSheets()).toEqual([])
            expect(useSendFundsStore.getState().destination).toBeUndefined()
        })
    })

    describe('Given a page in the in-app browser fires an ethereum: link', () => {
        const mountPage = async (isTrustedOrigin: boolean) => {
            render(
                <ConnectionsProvider>
                    <BrowserPage isTrustedOrigin={isTrustedOrigin} />
                </ConnectionsProvider>,
            )
            await waitFor(() => expect(captured.shouldStartLoad).toBeTruthy())
        }

        it('When the page is the trusted Discover origin, then a prefilled send opens', async () => {
            await mountPage(true)

            expect(clickInPage(ETHER_LINK)).toBe(false)

            await waitFor(() => expectPrefilledEtherSend())
        })

        it('When the page is any other origin, then the link is refused and nothing opens', async () => {
            await mountPage(false)

            expect(clickInPage(ETHER_LINK)).toBe(false)

            await expectToastTitled('errors.deeplink.blocked_origin_title')
            expect(openedSheets()).toEqual([])
            expect(useSendFundsStore.getState().destination).toBeUndefined()
        })

        it('When an iframe on the trusted origin fires it, then the link is refused', async () => {
            await mountPage(true)

            expect(clickInPage(ETHER_LINK, false)).toBe(false)

            await expectToastTitled('errors.deeplink.blocked_origin_title')
            expect(openedSheets()).toEqual([])
        })

        it('When the link asks for an approve, then it shows the not-supported error from any origin', async () => {
            await mountPage(false)

            expect(clickInPage(APPROVE_LINK)).toBe(false)

            await expectToastTitled('deeplink.error.title_unsupported')
            expect(openedSheets()).toEqual([])
        })
    })
})
