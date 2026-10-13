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
    detectImportKind,
    importFormatsFor,
    keyKindOptionsOf,
    localKeyKindOf,
    offeredLocalKeyKinds,
    postQuantumKeyKindOf,
} from '../import-formats'
import {
    accountPresentationChainAdapters,
    type LocalKeyKindOptions,
} from '../presentation-adapter'
import {
    FAKE_CHAIN_ID,
    FAKE_EXPLICIT_SEED,
    FAKE_HD_SEED,
    FAKE_LOCAL_KEY_KINDS,
    FAKE_SINGLE_SEED,
    registerFakeAccountsChain,
} from './fakeAccountsChain'

const HD_OPTIONS: LocalKeyKindOptions = {
    recover: {
        id: 'fake_hd',
        titleKey: 'fake.recover.title',
        chipKey: 'fake.recover.chip',
        descriptionKey: 'fake.recover.description',
        mnemonicInfoKey: 'fake.recover.info',
        isSuggested: true,
        analyticsEvent: 'fake_recover',
    },
}

const EXPLICIT_OPTIONS: LocalKeyKindOptions = {
    import: {
        id: 'fake_explicit',
        titleKey: 'fake.import.title',
        descriptionKey: 'fake.import.description',
        icon: 'wallet',
    },
}

// Offers the HD and explicit kinds only, so the single kind has no rows.
const registerOfferingPresentation = (): void => {
    const presentation = accountPresentationChainAdapters.get(FAKE_CHAIN_ID)
    accountPresentationChainAdapters.reset()
    accountPresentationChainAdapters.register({
        ...presentation,
        keyKindOptions: seed =>
            seed === FAKE_HD_SEED
                ? HD_OPTIONS
                : seed === FAKE_EXPLICIT_SEED
                  ? EXPLICIT_OPTIONS
                  : undefined,
    })
}

const words = (count: number) =>
    Array.from({ length: count }, (_, i) => `w${i}`).join(' ')

describe('importFormatsFor', () => {
    it("lists the chain's local key kinds in its detection order", () => {
        expect(importFormatsFor(FAKE_CHAIN_ID)).toBe(FAKE_LOCAL_KEY_KINDS)
    })
})

describe('detectImportKind', () => {
    it('detects the HD kind from 24 words', () => {
        expect(detectImportKind(FAKE_CHAIN_ID, words(24))).toEqual({
            success: true,
            seed: FAKE_HD_SEED,
        })
    })

    it('detects the first auto-detected kind among those sharing 25 words', () => {
        expect(detectImportKind(FAKE_CHAIN_ID, words(25))).toEqual({
            success: true,
            seed: FAKE_SINGLE_SEED,
        })
    })

    it('never detects a kind that opts out of detection, even when it is the only match', () => {
        registerFakeAccountsChain({
            localKeyKinds: FAKE_LOCAL_KEY_KINDS.filter(
                kind => kind.seed !== FAKE_SINGLE_SEED,
            ),
        })

        expect(detectImportKind(FAKE_CHAIN_ID, words(25))).toEqual({
            success: false,
            wordCount: 25,
        })
    })

    it('fails with the word count for a count no kind takes', () => {
        expect(detectImportKind(FAKE_CHAIN_ID, words(13))).toEqual({
            success: false,
            wordCount: 13,
        })
    })

    it('counts words across any whitespace', () => {
        expect(
            detectImportKind(
                FAKE_CHAIN_ID,
                `  ${words(12).replace(/ /g, '\n  ')} `,
            ),
        ).toEqual({ success: true, seed: FAKE_HD_SEED })
    })
})

describe('localKeyKindOf', () => {
    it('finds the kind a seed is stored under, or none', () => {
        expect(localKeyKindOf(FAKE_CHAIN_ID, FAKE_EXPLICIT_SEED)).toBe(
            FAKE_LOCAL_KEY_KINDS[2],
        )
        registerFakeAccountsChain({ localKeyKinds: [FAKE_LOCAL_KEY_KINDS[0]] })
        expect(
            localKeyKindOf(FAKE_CHAIN_ID, FAKE_EXPLICIT_SEED),
        ).toBeUndefined()
    })
})

describe('postQuantumKeyKindOf', () => {
    it('finds the kind that signs post-quantum, or none', () => {
        expect(postQuantumKeyKindOf(FAKE_CHAIN_ID)).toBe(
            FAKE_LOCAL_KEY_KINDS[2],
        )
        registerFakeAccountsChain({
            localKeyKinds: FAKE_LOCAL_KEY_KINDS.slice(0, 2),
        })
        expect(postQuantumKeyKindOf(FAKE_CHAIN_ID)).toBeUndefined()
    })
})

describe('keyKindOptionsOf', () => {
    it("returns the presentation's options for a kind it offers", () => {
        registerFakeAccountsChain()
        registerOfferingPresentation()

        expect(keyKindOptionsOf(FAKE_CHAIN_ID, FAKE_HD_SEED)).toBe(HD_OPTIONS)
        expect(
            keyKindOptionsOf(FAKE_CHAIN_ID, FAKE_SINGLE_SEED),
        ).toBeUndefined()
    })

    it('offers nothing on a chain whose presentation declares no options', () => {
        registerFakeAccountsChain()

        expect(keyKindOptionsOf(FAKE_CHAIN_ID, FAKE_HD_SEED)).toBeUndefined()
    })

    it('offers nothing on a chain with no presentation', () => {
        registerFakeAccountsChain()
        accountPresentationChainAdapters.reset()

        expect(keyKindOptionsOf(FAKE_CHAIN_ID, FAKE_HD_SEED)).toBeUndefined()
    })
})

describe('offeredLocalKeyKinds', () => {
    it('pairs each offered kind with its options, in detection order', () => {
        registerFakeAccountsChain()
        registerOfferingPresentation()

        expect(offeredLocalKeyKinds(FAKE_CHAIN_ID)).toEqual([
            { kind: FAKE_LOCAL_KEY_KINDS[0], options: HD_OPTIONS },
            { kind: FAKE_LOCAL_KEY_KINDS[2], options: EXPLICIT_OPTIONS },
        ])
    })

    it('lists no kind for a chain with no presentation', () => {
        registerFakeAccountsChain()
        accountPresentationChainAdapters.reset()

        expect(offeredLocalKeyKinds(FAKE_CHAIN_ID)).toEqual([])
    })
})
