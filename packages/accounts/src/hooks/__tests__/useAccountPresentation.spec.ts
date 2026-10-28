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

// @vitest-environment jsdom
import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    i18nKey,
    type ChainDescriptor,
    type ChainId,
} from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useAccountsStore } from '../../store'
import { testAccount } from '../../__tests__/accountFactory'
import {
    FAKE_CHAIN_ID,
    MAINNET_SCOPE,
    TESTNET_SCOPE,
    fakeAccountsChain,
    fakePresentationOf,
} from '../../__tests__/fakeAccountsChain'
import { accountKindId } from '../../chain-adapter'
import { eligibleChains } from '../../credentials/eligibility'
import { accountPresentationChainAdapters } from '../../presentation-adapter'
import {
    accountKindGlyph,
    accountKindIdOf,
    authorityTransitionLabel,
    firstUnreachableChainsNote,
    unreachableChainsNoteOf,
    useAccountPresentation,
} from '../useAccountPresentation'

vi.mock('../../credentials/eligibility', async importOriginal => ({
    ...(await importOriginal<typeof import('../../credentials/eligibility')>()),
    eligibleChains: vi.fn(),
}))

describe('useAccountPresentation', () => {
    beforeEach(() => {
        useAccountsStore.getState().resetState()
    })

    it("describes the account's kind the way its chain does", () => {
        const account = testAccount('watch', 'WATCH')
        useAccountsStore.getState().setAccounts([account])

        const { result } = renderHook(() =>
            useAccountPresentation(account, MAINNET_SCOPE),
        )

        expect(result.current).toEqual(fakePresentationOf(account))
        expect(fakeAccountsChain().presentation.describe).toHaveBeenCalledWith(
            'fake.watch',
            { canSign: false },
        )
    })

    it('tells the chain whether a held account signs for it on the scope', () => {
        const account = testAccount('multisig', 'MSIG')
        const other = testAccount('local', 'LOCAL')
        useAccountsStore.getState().setAccounts([account, other])
        const { adapter, presentation } = fakeAccountsChain()
        vi.mocked(adapter.resolveSigner).mockReturnValue({
            kind: 'ok',
            signer: other,
        })

        renderHook(() => useAccountPresentation(account, MAINNET_SCOPE))

        expect(adapter.resolveSigner).toHaveBeenCalledWith(
            account,
            [account, other],
            MAINNET_SCOPE,
        )
        expect(presentation.describe).toHaveBeenCalledWith('fake.multisig', {
            canSign: true,
        })
    })

    it('describes the account again on a network switch', () => {
        const account = testAccount('multisig', 'MSIG')
        useAccountsStore.getState().setAccounts([account])
        const { resolveSigner } = fakeAccountsChain().adapter
        const { rerender } = renderHook(
            ({ scope }) => useAccountPresentation(account, scope),
            { initialProps: { scope: MAINNET_SCOPE } },
        )

        rerender({ scope: TESTNET_SCOPE })

        expect(resolveSigner).toHaveBeenLastCalledWith(
            account,
            [account],
            TESTNET_SCOPE,
        )
    })

    it('is null for no account', () => {
        const { result } = renderHook(() =>
            useAccountPresentation(null, MAINNET_SCOPE),
        )

        expect(result.current).toBeNull()
        expect(fakeAccountsChain().presentation.describe).not.toHaveBeenCalled()
    })

    it('is null on a chain that registers no presentation', () => {
        accountPresentationChainAdapters.reset()
        const account = testAccount('watch', 'WATCH')

        const { result } = renderHook(() =>
            useAccountPresentation(account, MAINNET_SCOPE),
        )

        expect(result.current).toBeNull()
    })

    it('is null for a kind the chain does not describe', () => {
        vi.mocked(fakeAccountsChain().adapter.kindIdOf).mockReturnValue(
            accountKindId('unknown'),
        )

        const { result } = renderHook(() =>
            useAccountPresentation(
                testAccount('watch', 'WATCH'),
                MAINNET_SCOPE,
            ),
        )

        expect(result.current).toBeNull()
    })
})

describe('accountKindIdOf', () => {
    it("is the chain's kind id for the account", () => {
        expect(
            accountKindIdOf(testAccount('hardware', 'HW'), FAKE_CHAIN_ID),
        ).toBe('fake.hardware')
    })
})

describe('accountKindGlyph', () => {
    it('is the glyph the chain gives the kind', () => {
        expect(
            accountKindGlyph(accountKindId('fake.watch'), FAKE_CHAIN_ID),
        ).toBe('fake-glyph-watch')
    })

    it('is undefined for a kind the chain does not describe', () => {
        expect(
            accountKindGlyph(accountKindId('unknown'), FAKE_CHAIN_ID),
        ).toBeUndefined()
    })

    it('is undefined on a chain that registers no presentation', () => {
        accountPresentationChainAdapters.reset()

        expect(
            accountKindGlyph(accountKindId('fake.watch'), FAKE_CHAIN_ID),
        ).toBeUndefined()
    })
})

describe('authorityTransitionLabel', () => {
    it("words the transition between the accounts' kinds the way the chain does", () => {
        const from = testAccount('watch', 'FROM')
        const to = testAccount('hardware', 'TO')

        expect(authorityTransitionLabel({ from, to }, FAKE_CHAIN_ID)).toEqual({
            labelKey: 'fake.transition.label',
            signerKey: 'fake.hardware.signer',
            descriptionKey: 'fake.transition.watch_to_hardware',
        })
        expect(
            fakeAccountsChain().presentation.transitionLabel,
        ).toHaveBeenCalledWith('fake.watch', 'fake.hardware')
    })

    it('is null on a chain whose presentation words no transition', () => {
        accountPresentationChainAdapters.reset()
        accountPresentationChainAdapters.register({
            chainId: FAKE_CHAIN_ID,
            describe: () => undefined,
        })

        expect(
            authorityTransitionLabel(
                {
                    from: testAccount('watch', 'FROM'),
                    to: testAccount('hardware', 'TO'),
                },
                FAKE_CHAIN_ID,
            ),
        ).toBeNull()
    })

    it('is null on a chain that registers no presentation', () => {
        accountPresentationChainAdapters.reset()

        expect(
            authorityTransitionLabel(
                {
                    from: testAccount('watch', 'FROM'),
                    to: testAccount('hardware', 'TO'),
                },
                FAKE_CHAIN_ID,
            ),
        ).toBeNull()
    })
})

describe('unreachableChainsNoteOf', () => {
    const OTHER_CHAIN_ID = 'other' as ChainId
    const NOTE = i18nKey('fake.local.unreachable_note')

    const registerChain = (id: ChainId) =>
        getProvider().chains.register(
            { id, networks: [] } as unknown as ChainDescriptor,
            {} as never,
        )

    beforeEach(() => {
        registerChain(FAKE_CHAIN_ID)
        registerChain(OTHER_CHAIN_ID)
        vi.mocked(eligibleChains).mockReturnValue([FAKE_CHAIN_ID])
        vi.mocked(fakeAccountsChain().presentation.describe).mockImplementation(
            kindId => ({
                labelKey: i18nKey(`${kindId}.label`),
                infoTitleKey: i18nKey(`${kindId}.info_title`),
                infoBodyKey: i18nKey(`${kindId}.info_body`),
                glyph: 'glyph',
                ...(kindId.startsWith('fake.local')
                    ? { unreachableChainsNoteKey: NOTE }
                    : {}),
            }),
        )
    })

    it("is the kind's note when a registered chain is out of the account's reach", () => {
        const account = testAccount('local')

        expect(
            unreachableChainsNoteOf(account, [FAKE_CHAIN_ID, OTHER_CHAIN_ID]),
        ).toBe(NOTE)
    })

    it('is null when every chain is in reach', () => {
        vi.mocked(eligibleChains).mockReturnValue([
            FAKE_CHAIN_ID,
            OTHER_CHAIN_ID,
        ])

        expect(
            unreachableChainsNoteOf(testAccount('local'), [OTHER_CHAIN_ID]),
        ).toBeNull()
    })

    it('is null for no chains', () => {
        expect(unreachableChainsNoteOf(testAccount('local'), [])).toBeNull()
    })

    it('ignores a chain that is not registered', () => {
        expect(
            unreachableChainsNoteOf(testAccount('local'), [
                'unregistered' as ChainId,
            ]),
        ).toBeNull()
    })

    it('is null when the kind gives no note', () => {
        expect(
            unreachableChainsNoteOf(testAccount('watch'), [OTHER_CHAIN_ID]),
        ).toBeNull()
    })

    it("is null when the account's chain registers no presentation", () => {
        accountPresentationChainAdapters.reset()

        expect(
            unreachableChainsNoteOf(testAccount('local'), [OTHER_CHAIN_ID]),
        ).toBeNull()
    })

    it("firstUnreachableChainsNote is the first account's note, in order", () => {
        const accounts = [testAccount('watch'), testAccount('local')]

        expect(firstUnreachableChainsNote(accounts, [OTHER_CHAIN_ID])).toBe(
            NOTE,
        )
        expect(firstUnreachableChainsNote([], [OTHER_CHAIN_ID])).toBeNull()
    })

    it('firstUnreachableChainsNote gives no note when another held account can reach the chain', () => {
        const local = testAccount('local')
        const reaching = testAccount('hardware')
        vi.mocked(eligibleChains).mockImplementation(account =>
            account === reaching
                ? [FAKE_CHAIN_ID, OTHER_CHAIN_ID]
                : [FAKE_CHAIN_ID],
        )

        expect(
            firstUnreachableChainsNote([local, reaching], [OTHER_CHAIN_ID]),
        ).toBeNull()
    })

    it("firstUnreachableChainsNote still gives the kind's note when only a watch account reaches the chain", () => {
        const local = testAccount('local')
        const watch = testAccount('watch')
        vi.mocked(eligibleChains).mockImplementation(account =>
            account === watch
                ? [FAKE_CHAIN_ID, OTHER_CHAIN_ID]
                : [FAKE_CHAIN_ID],
        )

        expect(
            firstUnreachableChainsNote([local, watch], [OTHER_CHAIN_ID]),
        ).toBe(NOTE)
    })
})
