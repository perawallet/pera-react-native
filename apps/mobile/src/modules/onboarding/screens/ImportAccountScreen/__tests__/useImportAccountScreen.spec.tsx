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

import { renderHook, act } from '@testing-library/react'
import * as Clipboard from 'expo-clipboard'
import { useRoute } from '@react-navigation/native'
import { mnemonicFromSeed } from 'algosdk'
import {
    consumePendingImportMnemonic,
    useImportAccount,
} from '@perawallet/wallet-core-accounts'
import { useMarkMnemonicBackupComplete } from '@perawallet/wallet-core-backup'
import { useImportAccountScreen } from '../useImportAccountScreen'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockShowToast = vi.fn()
const mockErrorToast = vi.fn()
const mockReplace = vi.fn()
const mockPush = vi.fn()
const mockGoBack = vi.fn()
const mockImportAccount = vi.fn()
const mockMarkBackupComplete = vi.fn()

vi.mock('react-native', () => ({
    Keyboard: {
        addListener: vi.fn(() => ({
            remove: vi.fn(),
        })),
        dismiss: vi.fn(),
    },
    Platform: {
        OS: 'ios',
    },
}))

vi.mock('@react-navigation/native', () => ({
    useRoute: vi.fn(() => ({
        params: { accountType: 'hdWallet' },
    })),
}))

vi.mock('@hooks/useAppNavigation', () => ({
    useAppNavigation: vi.fn(() => ({
        replace: mockReplace,
        push: mockPush,
        goBack: mockGoBack,
    })),
}))

vi.mock('@perawallet/wallet-core-accounts', () => ({
    useImportAccount: vi.fn(),
    consumePendingImportMnemonic: vi.fn(),
    MNEMONIC_WORD_COUNT: {
        hdWallet: 24,
        algo25: 25,
        quantum: 25,
    },
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useMarkMnemonicBackupComplete: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-shared', () => ({
    deferToNextCycle: (fn: () => void) => fn(),
    logger: {
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
    },
}))

const { MOCK_WORDLIST } = vi.hoisted(() => ({
    MOCK_WORDLIST: [
        'abandon',
        'ability',
        'able',
        'about',
        'above',
        'absent',
        'absorb',
        'abstract',
        'absurd',
        'abuse',
        'zoo',
        // Real BIP39 words backing the seed-derived mnemonic used by the
        // wordlist-gating tests below (mnemonicFromSeed(fill(7))).
        'thought',
        'bright',
        'logic',
        'idea',
        'asthma',
        'scrub',
        'deal',
        'alpha',
        'crisp',
    ],
}))

vi.mock('@perawallet/wallet-core-kms', () => ({
    MNEMONIC_WORDLIST: MOCK_WORDLIST,
    // Same contract as the real codec, over the mocked wordlist: null when
    // any word is unknown, indices otherwise.
    mnemonicWordsToIndices: (words: string[]) => {
        const out = new Uint16Array(words.length)
        for (let i = 0; i < words.length; i++) {
            const index = MOCK_WORDLIST.indexOf(words[i])
            if (index < 0) return null
            out[i] = index
        }
        return out
    },
    zeroBytes: (...buffers: Array<Uint16Array | null>) =>
        buffers.forEach(buffer => buffer?.fill(0)),
}))

vi.mock('@hooks/useToast', () => ({
    useToast: vi.fn(() => ({
        showToast: mockShowToast,
        errorToast: mockErrorToast,
    })),
}))

vi.mock('@hooks/useLanguage', () => ({
    useLanguage: vi.fn(() => ({
        t: (key: string) => key,
    })),
}))

vi.mock('@hooks/useDeepLink', () => ({
    useDeepLink: vi.fn(() => ({
        parseDeeplink: vi.fn(),
    })),
}))

const { mockRequestBottomSheet } = vi.hoisted(() => ({
    mockRequestBottomSheet: vi.fn(),
}))

vi.mock('@modules/bottom-sheet', () => ({
    useBottomSheet: () => ({
        request: mockRequestBottomSheet,
        requestByType: vi.fn(),
        dismiss: vi.fn(),
        dismissAll: vi.fn(),
    }),
}))

describe('useImportAccountScreen', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        // Re-establish the default route params so a per-test override (e.g.
        // prefilledMnemonic) can't leak into the next test.
        vi.mocked(useRoute).mockReturnValue({
            params: { accountType: 'hdWallet' },
        } as never)
        vi.mocked(useImportAccount).mockReturnValue(mockImportAccount)
        vi.mocked(useMarkMnemonicBackupComplete).mockReturnValue(
            mockMarkBackupComplete,
        )
        // Default: nothing pending, so the screen starts with empty word slots.
        vi.mocked(consumePendingImportMnemonic).mockReturnValue(null)
        mockRequestBottomSheet.mockResolvedValue(undefined)
    })

    it('initializes with empty words', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        expect(result.current.words).toHaveLength(24)
        expect(result.current.words.every(w => w === '')).toBe(true)
    })

    it('pre-fills the passphrase words on mount from the pending-import store', () => {
        // 'abandon' (not 'word') so canImport, now gated on wordlist
        // membership, is genuinely true rather than incidentally passing.
        const mnemonic = new Array(24).fill('abandon').join(' ')
        vi.mocked(consumePendingImportMnemonic).mockReturnValue(mnemonic)

        const { result } = renderHook(() => useImportAccountScreen())

        expect(consumePendingImportMnemonic).toHaveBeenCalledTimes(1)
        expect(result.current.words.every(w => w === 'abandon')).toBe(true)
        expect(result.current.canImport).toBe(true)
    })

    it('updates a single word at a specific index', () => {
        const { result } = renderHook(() => useImportAccountScreen())

        act(() => {
            result.current.updateWord('apple', 5)
        })

        expect(result.current.words[5]).toBe('apple')
    })

    it('fills all slots when a full mnemonic is pasted into any slot', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const mnemonic = new Array(24).fill('word').join(' ')

        act(() => {
            result.current.updateWord(mnemonic, 5)
        })

        expect(result.current.words.every(w => w === 'word')).toBe(true)
    })

    it('fills sequential slots when a partial mnemonic is pasted into any slot and fits', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const mnemonic = 'word1 word2 word3'

        act(() => {
            result.current.updateWord(mnemonic, 20)
        })

        expect(result.current.words[20]).toBe('word1')
        expect(result.current.words[21]).toBe('word2')
        expect(result.current.words[22]).toBe('word3')
        expect(result.current.words[23]).toBe('')
    })

    it('shows insufficient slots toast if partial mnemonic does not fit in remaining slots', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const mnemonic = 'word1 word2 word3'

        act(() => {
            result.current.updateWord(mnemonic, 22)
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'onboarding.import_account.insufficient_slots_title',
            'onboarding.import_account.insufficient_slots_body',
        )
        expect(result.current.words[22]).toBe('')
    })

    it('shows a toast and does not update words if too many words are pasted', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const mnemonic = new Array(25).fill('word').join(' ')

        act(() => {
            result.current.updateWord(mnemonic, 0)
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'onboarding.import_account.invalid_mnemonic_title',
            'onboarding.import_account.invalid_mnemonic_body',
        )
        expect(result.current.words[0]).toBe('')
    })

    it('fills all slots when a newline-separated full mnemonic is pasted', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const mnemonic = new Array(24).fill('word').join('\n')

        act(() => {
            result.current.updateWord(mnemonic, 0)
        })

        expect(result.current.words.every(w => w === 'word')).toBe(true)
    })

    it('fills all slots when a mnemonic with extra newlines is pasted', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const mnemonic = new Array(24).fill('word').join('\n\n')

        act(() => {
            result.current.updateWord(mnemonic, 0)
        })

        expect(result.current.words.every(w => w === 'word')).toBe(true)
    })

    it('fills all slots when a mnemonic with mixed whitespace is pasted', () => {
        const { result } = renderHook(() => useImportAccountScreen())
        const words = new Array(24).fill('word')
        // Join with a mix of spaces, newlines, double newlines, and \r\n
        const mnemonic = [
            words.slice(0, 3).join('\n'),
            words.slice(3, 6).join('\n\n'),
            words.slice(6, 10).join('\r\n'),
            words.slice(10, 24).join(' '),
        ].join('\n')

        act(() => {
            result.current.updateWord(mnemonic, 0)
        })

        expect(result.current.words.every(w => w === 'word')).toBe(true)
    })

    it('treats spaces at the end of a single word as a single word update', () => {
        const { result } = renderHook(() => useImportAccountScreen())

        act(() => {
            result.current.updateWord('apple ', 0)
        })

        expect(result.current.words[0]).toBe('apple')
        expect(result.current.words[1]).toBe('')
    })

    it('shows error toast when handleQRScannerSuccess is called with invalid QR content', () => {
        const { result } = renderHook(() => useImportAccountScreen())

        act(() => {
            result.current.handleQRScannerSuccess('invalid-url')
        })

        expect(mockErrorToast).toHaveBeenCalledWith(
            'onboarding.import_account.invalid_mnemonic_title',
            'onboarding.import_account.invalid_mnemonic_body',
        )
    })

    describe('suggestions', () => {
        it('returns empty suggestions when no prefix is typed', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            expect(result.current.suggestions).toEqual([])
        })

        it('returns matching suggestions based on typed prefix', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord('ab', 0)
                result.current.setFocused(0)
            })

            expect(result.current.suggestions).toEqual([
                'abandon',
                'ability',
                'able',
                'about',
            ])
        })

        it('returns empty suggestions when word exactly matches a BIP39 word and is the only match', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord('zoo', 0)
                result.current.setFocused(0)
            })

            expect(result.current.suggestions).toEqual([])
        })

        it('limits suggestions to 4', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord('ab', 0)
                result.current.setFocused(0)
            })

            expect(result.current.suggestions.length).toBeLessThanOrEqual(4)
        })

        it('returns suggestions for the focused word only', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord('ab', 0)
                result.current.updateWord('zo', 1)
                result.current.setFocused(1)
            })

            expect(result.current.suggestions).toEqual(['zoo'])
        })
    })

    describe('handleSelectSuggestion', () => {
        it('fills the focused word with the selected suggestion', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.setFocused(5)
            })

            act(() => {
                result.current.handleSelectSuggestion('abandon')
            })

            expect(result.current.words[5]).toBe('abandon')
        })

        it('advances focused index to the next input after selection', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.setFocused(5)
            })

            act(() => {
                result.current.handleSelectSuggestion('abandon')
            })

            expect(result.current.focused).toBe(6)
        })

        it('does not advance past the last word index', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.setFocused(23)
            })

            act(() => {
                result.current.handleSelectSuggestion('abandon')
            })

            expect(result.current.words[23]).toBe('abandon')
            expect(result.current.focused).toBe(23)
        })
    })

    describe('handleWordChange', () => {
        it('uses clipboard content when paste is detected and clipboard has more words', async () => {
            const { result } = renderHook(() => useImportAccountScreen())

            vi.mocked(Clipboard.getStringAsync).mockResolvedValue(
                'help inhale music device trap calm',
            )

            await act(async () => {
                await result.current.handleWordChange(
                    'helpinhale music device trap calm',
                    0,
                )
            })

            expect(result.current.words[0]).toBe('help')
            expect(result.current.words[1]).toBe('inhale')
            expect(result.current.words[2]).toBe('music')
            expect(result.current.words[3]).toBe('device')
            expect(result.current.words[4]).toBe('trap')
            expect(result.current.words[5]).toBe('calm')
        })

        it('falls back to received text when clipboard has same number of words', async () => {
            const { result } = renderHook(() => useImportAccountScreen())

            vi.mocked(Clipboard.getStringAsync).mockResolvedValue(
                'apple banana cherry',
            )

            await act(async () => {
                await result.current.handleWordChange('apple banana cherry', 0)
            })

            expect(result.current.words[0]).toBe('apple')
            expect(result.current.words[1]).toBe('banana')
            expect(result.current.words[2]).toBe('cherry')
        })

        it('does not read clipboard for single character changes (typing)', async () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord('appl', 0)
            })

            await act(async () => {
                await result.current.handleWordChange('apple', 0)
            })

            expect(Clipboard.getStringAsync).not.toHaveBeenCalled()
            expect(result.current.words[0]).toBe('apple')
        })

        it('falls back to received text when clipboard read fails', async () => {
            const { result } = renderHook(() => useImportAccountScreen())

            vi.mocked(Clipboard.getStringAsync).mockRejectedValue(
                new Error('Permission denied'),
            )

            await act(async () => {
                await result.current.handleWordChange('helpinhale music', 0)
            })

            expect(result.current.words[0]).toBe('helpinhale')
            expect(result.current.words[1]).toBe('music')
        })

        it('uses clipboard for full 24-word mnemonic paste with newline corruption', async () => {
            const { result } = renderHook(() => useImportAccountScreen())
            const fullMnemonic = new Array(24).fill('word').join(' ')

            vi.mocked(Clipboard.getStringAsync).mockResolvedValue(fullMnemonic)

            const mangledText =
                'wordword ' + new Array(22).fill('word').join(' ')

            await act(async () => {
                await result.current.handleWordChange(mangledText, 0)
            })

            expect(result.current.words.every(w => w === 'word')).toBe(true)
        })

        it('uses clipboard when clipboard has newline-separated words with extra newlines', async () => {
            const { result } = renderHook(() => useImportAccountScreen())

            vi.mocked(Clipboard.getStringAsync).mockResolvedValue(
                'help\n\ninhale\n\nmusic\n\ndevice\n\ntrap\n\ncalm',
            )

            await act(async () => {
                await result.current.handleWordChange(
                    'helpinhale music device trap calm',
                    0,
                )
            })

            expect(result.current.words[0]).toBe('help')
            expect(result.current.words[1]).toBe('inhale')
            expect(result.current.words[2]).toBe('music')
            expect(result.current.words[3]).toBe('device')
            expect(result.current.words[4]).toBe('trap')
            expect(result.current.words[5]).toBe('calm')
        })
    })

    describe('handleImportAccount', () => {
        it('navigates to SearchAccounts in import mode for HD imports without marking backup complete', async () => {
            mockImportAccount.mockResolvedValue({
                type: 'hdWallet',
                walletKeyId: 'WALLET1',
                derivationType: 9,
            })

            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord(
                    new Array(24).fill('abandon').join(' '),
                    0,
                )
            })

            await act(async () => {
                result.current.handleImportAccount()
                // Allow deferred microtask + promise chain to resolve
                await new Promise(resolve => setTimeout(resolve, 0))
            })

            expect(mockImportAccount).toHaveBeenCalled()
            expect(mockReplace).toHaveBeenCalledWith('SearchAccounts', {
                mode: 'import',
                walletKeyId: 'WALLET1',
                derivationType: 9,
            })
            // markBackupComplete is NOT called yet — the user hasn't committed addresses.
            expect(mockMarkBackupComplete).not.toHaveBeenCalled()
        })
    })

    describe('quantum account type', () => {
        beforeEach(() => {
            vi.mocked(useRoute).mockReturnValue({
                params: { accountType: 'quantum' },
            } as never)
        })

        it('uses a 25-word grid for quantum imports', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            expect(result.current.mnemonicLength).toBe(25)
            expect(result.current.words).toHaveLength(25)
        })

        it('forwards the explicit quantum type to importAccount', async () => {
            mockImportAccount.mockResolvedValue({ type: 'quantum' })
            const mnemonic = new Array(25).fill('abandon').join(' ')

            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord(mnemonic, 0)
            })

            await act(async () => {
                result.current.handleImportAccount()
                await new Promise(resolve => setTimeout(resolve, 0))
            })

            expect(mockImportAccount).toHaveBeenCalledWith({
                mnemonicIndices: expect.any(Uint16Array),
                type: 'quantum',
            })
        })

        it('exposes quantum title and info note keys', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            expect(result.current.titleKey).toBe(
                'onboarding.import_account.quantum_title',
            )
            expect(result.current.infoNoteKey).toBe(
                'onboarding.import_account.quantum_info_note',
            )
        })
    })

    describe('algo25 account type', () => {
        beforeEach(() => {
            vi.mocked(useRoute).mockReturnValue({
                params: { accountType: 'algo25' },
            } as never)
        })

        it('forwards the explicit algo25 type to importAccount and uses generic copy', async () => {
            mockImportAccount.mockResolvedValue({ type: 'algo25' })
            const mnemonic = new Array(25).fill('abandon').join(' ')

            const { result } = renderHook(() => useImportAccountScreen())

            act(() => {
                result.current.updateWord(mnemonic, 0)
            })

            await act(async () => {
                result.current.handleImportAccount()
                await new Promise(resolve => setTimeout(resolve, 0))
            })

            expect(mockImportAccount).toHaveBeenCalledWith({
                mnemonicIndices: expect.any(Uint16Array),
                type: 'algo25',
            })
            expect(result.current.titleKey).toBe(
                'onboarding.import_account.title',
            )
            expect(result.current.infoNoteKey).toBeNull()
        })
    })

    describe('wordlist gating', () => {
        const VALID_25_WORDS = mnemonicFromSeed(
            new Uint8Array(32).fill(7),
        ).split(' ')

        beforeEach(() => {
            vi.mocked(useRoute).mockReturnValue({
                params: { accountType: 'algo25' },
            } as never)
        })

        it('keeps import disabled while a slot holds a non-wordlist word', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => result.current.updateWord(VALID_25_WORDS.join(' '), 0))
            act(() => result.current.updateWord('zzzz', 0))

            expect(result.current.canImport).toBe(false)
            expect(result.current.invalidWordIndices.has(0)).toBe(true)
        })

        it('enables import once every slot holds a wordlist word', () => {
            const { result } = renderHook(() => useImportAccountScreen())

            act(() => result.current.updateWord(VALID_25_WORDS.join(' '), 0))

            expect(result.current.canImport).toBe(true)
            expect(result.current.invalidWordIndices.size).toBe(0)
        })

        it('submits the normalized mnemonic when the user typed it capitalized', async () => {
            // Snapshot at call time: the hook zeroes the index buffer in its
            // finally, so inspecting the stored mock arg would see zeros.
            let submitted: number[] | null = null
            mockImportAccount.mockImplementation(
                async ({
                    mnemonicIndices,
                }: {
                    mnemonicIndices: Uint16Array
                }) => {
                    submitted = Array.from(mnemonicIndices)
                    return { type: 'algo25' }
                },
            )
            const { result } = renderHook(() => useImportAccountScreen())
            const capitalized = VALID_25_WORDS.map(
                w => w.charAt(0).toUpperCase() + w.slice(1),
            ).join(' ')

            act(() => result.current.updateWord(capitalized, 0))

            await act(async () => {
                result.current.handleImportAccount()
                await new Promise(resolve => setTimeout(resolve, 0))
            })

            expect(submitted).toEqual(
                VALID_25_WORDS.map(w => MOCK_WORDLIST.indexOf(w)),
            )
        })
    })
})
