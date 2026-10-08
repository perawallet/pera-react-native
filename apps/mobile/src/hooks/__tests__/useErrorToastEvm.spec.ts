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

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
    EvmError,
    EvmErrorCode,
    toEvmError,
} from '@perawallet/wallet-core-chain-ethereum'
import en from '../../i18n/locales/en.json'
import { useErrorToast } from '../useErrorToast'

const { mockShowToast } = vi.hoisted(() => ({ mockShowToast: vi.fn() }))

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { debugEnabled: false },
    registerCustomNetworkSource: vi.fn(() => () => undefined),
}))

vi.mock('../useToast', () => ({
    useToast: () => ({ showToast: mockShowToast }),
}))

vi.mock('../useAlgodErrorMessage', () => ({
    useAlgodErrorMessage: () => ({ getMessage: vi.fn() }),
}))

// Resolves against the REAL en.json rather than echoing keys back, so a
// missing key or an unfilled placeholder fails here.
vi.mock('../useLanguage', async () => {
    const bundle = (
        await vi.importActual<{ default: Record<string, unknown> }>(
            '../../i18n/locales/en.json',
        )
    ).default
    const lookup = (key: string): string => {
        const value = key
            .split('.')
            .reduce<unknown>(
                (node, part) =>
                    typeof node === 'object' && node !== null
                        ? (node as Record<string, unknown>)[part]
                        : undefined,
                bundle,
            )
        return typeof value === 'string' ? value : key
    }
    return {
        useLanguage: () => ({
            t: (key: string, values?: Record<string, unknown>) =>
                lookup(key).replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
                    values && name in values ? String(values[name]) : match,
                ),
        }),
    }
})

const evmCopy = en.errors.evm

const showError = (error: unknown): void => {
    const { result } = renderHook(() => useErrorToast())
    act(() => {
        result.current.showError(error)
    })
}

describe('useErrorToast with EVM errors', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it.each([
        EvmErrorCode.REVERTED,
        EvmErrorCode.OUT_OF_GAS,
        EvmErrorCode.NONCE_TOO_LOW,
        EvmErrorCode.REPLACEMENT_UNDERPRICED,
        EvmErrorCode.INSUFFICIENT_FUNDS,
        EvmErrorCode.RATE_LIMITED,
    ] as const)('renders the translated %s toast', code => {
        showError(new EvmError(code))

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: evmCopy[code].title,
                body: evmCopy[code].body,
                type: 'error',
            },
            undefined,
        )
    })

    it('fills the revert reason into the translated toast', () => {
        showError(
            new EvmError(EvmErrorCode.REVERTED_WITH_REASON, {
                reason: 'Ownable: caller is not the owner',
            }),
        )

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: evmCopy.reverted_with_reason.title,
                body: 'The contract returned: Ownable: caller is not the owner',
                type: 'error',
            },
            undefined,
        )
    })

    it('keeps the generic blockchain copy for an unknown error', () => {
        showError(toEvmError(new Error('socket hang up')))

        expect(mockShowToast).toHaveBeenCalledWith(
            {
                title: en.errors.transaction.title,
                body: en.errors.blockchain.generic,
                type: 'error',
            },
            undefined,
        )
    })
})
