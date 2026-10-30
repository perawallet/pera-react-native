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

// An EVM dApp in the in-app browser: its page posts EIP-1193 requests to the
// WebView transport, which the registry's injected-provider handler answers
// through the real connection sheet, signing adapter and review sheet.

import React, { useEffect, useRef } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { server, setSuiteUnhandledRequestMode } from '@test-utils/msw-server'
import { setCapabilityOverrides } from '@test-utils/capability-overrides'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import { getAllPressables, isElementDisabled } from '@test-utils/rnw'
import { useSigningStore } from '@packages/signing/src/store'
import { __resetSigningActorRegistryForTests } from '@packages/signing/src/hooks/useSigningActorLifecycle'
import {
    SENDER,
    SIGNER_KEY_PAIR_ID,
    VIEM_HELLO_WORLD,
    vectorSignature,
} from '@packages/chain-ethereum/src/__tests__/testing'
import {
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { resetConnectionPairingStateForTesting } from '@perawallet/wallet-core-connections'
import { kmsCore } from '@perawallet/wallet-core-kms'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { useRemoteConfigStore } from '@perawallet/wallet-core-remote-config'
import type { Optional } from '@perawallet/wallet-core-shared'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { ConnectionsProvider } from '@modules/connections/shell'
import { SigningOverlays } from '@modules/signing/shell'
import { webViewDappTransport } from '@modules/webview'

vi.mock('@perawallet/wallet-core-config', async importOriginal => {
    const actual =
        await importOriginal<typeof import('@perawallet/wallet-core-config')>()
    return {
        ...actual,
        config: {
            ...actual.config,
            reownProjectId: 'integration-project-id',
            chains: { enabled: ['algorand', 'ethereum'], capabilities: {} },
        },
    }
})

const ORIGIN = 'https://app.uniswap.org'
const CONNECTION_ID = `dapp-eip1193:${ORIGIN}`
const HELLO_WORLD_HEX = '0x68656c6c6f20776f726c64'
const CONFIRM_SLIDE = 'message-signing-confirm-slide'

const ETHEREUM_ACCOUNT: WalletAccount = {
    id: 'inapp-eth-account',
    custody: {
        kind: 'local',
        seed: 'bip39',
        hd: { account: 0, keyIndex: 0 },
    },
    chains: { ethereum: { address: SENDER, keyPairId: SIGNER_KEY_PAIR_ID } },
    name: 'Ether',
}

const inject = vi.fn()
const page = { currentUrl: () => `${ORIGIN}/swap`, inject }

// The once-per-device request FAQ is pre-acknowledged so it cannot open a
// competing sheet.
const ConnectionsWithSigning = () => {
    const { setPreference } = usePreferences()
    const acknowledged = useRef(false)
    useEffect(() => {
        if (acknowledged.current) return
        acknowledged.current = true
        setPreference('hasSeenTransactionRequestFAQ', true)
    }, [setPreference])

    return (
        <ConnectionsProvider>
            <SigningOverlays />
        </ConnectionsProvider>
    )
}

const findButton = (label: string): Optional<HTMLButtonElement> =>
    getAllPressables().find(button =>
        (button.textContent ?? '').includes(label),
    ) as Optional<HTMLButtonElement>

type Answer = {
    id: string
    result?: unknown
    error?: { code: number; message: string }
}

const answers = (): Answer[] =>
    inject.mock.calls.flatMap(([script]) => {
        const match = /deliver\((\{.*\})\);/.exec(String(script))
        return match ? [JSON.parse(match[1]) as Answer] : []
    })

const answerOf = (id: string): Promise<Answer> =>
    waitFor(
        () => {
            const answer = answers().find(candidate => candidate.id === id)
            if (!answer) throw new Error(`no answer for ${id}`)
            return answer
        },
        { timeout: 15_000 },
    )

const request = (
    id: string,
    method: string,
    params: unknown[] = [],
    hasUserActivation = true,
) =>
    act(() => {
        webViewDappTransport.receive(
            page,
            {
                provider: 'eip1193',
                token: 'unused',
                hasUserActivation,
                request: { jsonrpc: '2.0', id, method, params },
            },
            `${ORIGIN}/swap`,
        )
    })

const connect = async () => {
    request('connect', 'eth_requestAccounts')
    await waitFor(() => {
        expect(findButton('common.connect.label')).toBeTruthy()
    })
    const row = `wc_account_row_${ETHEREUM_ACCOUNT.id}`
    await waitFor(() => expect(screen.getByTestId(row)).toBeTruthy(), {
        timeout: 5000,
    })
    fireEvent.click(screen.getByTestId(row))
    await waitFor(() => {
        expect(isElementDisabled(findButton('common.connect.label')!)).toBe(
            false,
        )
    })
    fireEvent.click(findButton('common.connect.label')!)
    return answerOf('connect')
}

describe('Flow: an EVM dApp in the in-app browser', () => {
    setSuiteUnhandledRequestMode('bypass')
    let detach: () => void

    beforeEach(async () => {
        __resetSigningActorRegistryForTests()
        useSigningStore.getState().resetState()
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([ETHEREUM_ACCOUNT])
        await getProvider().connections.store.clear()
        resetConnectionPairingStateForTesting()
        vi.clearAllMocks()
        setCapabilityOverrides({ dappConnect: true }, 'ethereum')
        vi.spyOn(kmsCore, 'sign').mockImplementation(async (_id, payload) =>
            vectorSignature(payload),
        )
        server.use(http.get('*/v1/projects/', () => HttpResponse.json([])))
        detach = webViewDappTransport.attach(page)
        renderWithNavigation(ConnectionsWithSigning, 'ConnectionsWithSigning')
    })

    afterEach(async () => {
        detach()
        vi.restoreAllMocks()
        await getProvider().connections.store.clear()
        useAccountsStore.getState().setAccounts([])
        useRemoteConfigStore.getState().resetState()
    })

    it('Given a tap on Connect, when the user picks the EVM account, then the page is told that account and the site is recorded', async () => {
        const answer = await connect()

        expect(answer.result).toEqual([SENDER])
        expect(
            await getProvider().connections.store.get(CONNECTION_ID),
        ).toMatchObject({
            kind: 'dapp-eip1193',
            accounts: [SENDER],
        })
    })

    it('Given no user gesture, when the page asks for accounts, then it is answered 4100 and no sheet opens', async () => {
        request('quiet', 'eth_requestAccounts', [], false)

        const answer = await answerOf('quiet')

        expect(answer.error?.code).toBe(4100)
        expect(findButton('common.connect.label')).toBeUndefined()
    })

    it('Given a connected site, when it asks to switch to a chain Pera does not serve, then it is answered 4902 without a sheet', async () => {
        await connect()

        request('switch', 'wallet_switchEthereumChain', [{ chainId: '0x82' }])

        expect((await answerOf('switch')).error?.code).toBe(4902)
        expect(findButton('common.connect.label')).toBeUndefined()
    })

    it('Given a connected site, when it asks for personal_sign and the user slides to confirm, then the page receives the signature', async () => {
        await connect()

        request('sign', 'personal_sign', [HELLO_WORLD_HEX, SENDER])
        await waitFor(
            () => expect(screen.getByTestId(CONFIRM_SLIDE)).toBeTruthy(),
            { timeout: 15_000 },
        )
        fireEvent.click(screen.getByTestId(CONFIRM_SLIDE))

        expect((await answerOf('sign')).result).toBe(VIEM_HELLO_WORLD)
    })
})
