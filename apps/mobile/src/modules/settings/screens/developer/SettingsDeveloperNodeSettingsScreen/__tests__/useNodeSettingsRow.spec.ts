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

import { describe, test, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { Networks } from '@perawallet/wallet-core-shared'
import { useNodeSettingsRow } from '../useNodeSettingsRow'
import type { NetworkRow } from '../useSettingsDeveloperNodeSettingsScreen'

const makeRow = (overrides: Partial<NetworkRow> = {}): NetworkRow => ({
    network: Networks.fnet,
    labelKey: 'settings.developer.node_settings.fnet_label',
    isSelected: false,
    algodUrl: 'https://fnet-api.4160.nodely.dev',
    indexerUrl: 'https://fnet-idx.4160.nodely.dev',
    isOverridden: false,
    ...overrides,
})

describe('useNodeSettingsRow', () => {
    test('initializes the draft inputs from the row endpoints', () => {
        const row = makeRow()

        const { result } = renderHook(() =>
            useNodeSettingsRow({ row, onSave: vi.fn(), onReset: vi.fn() }),
        )

        expect(result.current.algodUrlInput).toBe(row.algodUrl)
        expect(result.current.indexerUrlInput).toBe(row.indexerUrl)
        expect(result.current.algodUrlError).toBe(false)
        expect(result.current.indexerUrlError).toBe(false)
    })

    test('typing clears a previously-shown field error immediately', () => {
        const row = makeRow()
        const { result } = renderHook(() =>
            useNodeSettingsRow({ row, onSave: vi.fn(), onReset: vi.fn() }),
        )

        act(() => {
            result.current.handleAlgodUrlChange('not-a-url')
        })
        act(() => {
            result.current.handleSave()
        })
        expect(result.current.algodUrlError).toBe(true)

        act(() => {
            result.current.handleAlgodUrlChange('http://10.0.0.5:4001')
        })

        expect(result.current.algodUrlInput).toBe('http://10.0.0.5:4001')
        expect(result.current.algodUrlError).toBe(false)
    })

    test('saving a single edited field forwards only that field', () => {
        const onSave = vi.fn()
        const row = makeRow()
        const { result } = renderHook(() =>
            useNodeSettingsRow({ row, onSave, onReset: vi.fn() }),
        )

        act(() => {
            result.current.handleIndexerUrlChange('http://10.0.0.5:8980')
        })
        act(() => {
            result.current.handleSave()
        })

        // algodUrl was never touched — must NOT be forwarded, or it would
        // get pinned to whatever it happened to read at save time (defeating
        // per-field overrides: an untouched field should keep tracking the
        // baked default, or a separately-set override, indefinitely).
        expect(onSave).toHaveBeenCalledWith({
            indexerUrl: 'http://10.0.0.5:8980',
        })
        expect(result.current.algodUrlError).toBe(false)
        expect(result.current.indexerUrlError).toBe(false)
    })

    test('saving a malformed algod URL flags only that field, and forwards only that field', () => {
        const onSave = vi.fn()
        const row = makeRow()
        const { result } = renderHook(() =>
            useNodeSettingsRow({ row, onSave, onReset: vi.fn() }),
        )

        act(() => {
            result.current.handleAlgodUrlChange('not-a-url')
        })
        act(() => {
            result.current.handleSave()
        })

        expect(result.current.algodUrlError).toBe(true)
        expect(result.current.indexerUrlError).toBe(false)
        // The screen-level hook independently re-validates and drops the bad
        // field before it ever reaches the store — this hook only decides
        // what to show inline, so it forwards the raw (changed) draft either
        // way. The untouched indexerUrl must not ride along.
        expect(onSave).toHaveBeenCalledWith({ algodUrl: 'not-a-url' })
    })

    test('never validates or forwards an untouched field, even if its current value is invalid', () => {
        const onSave = vi.fn()
        // Contrived: a pre-existing "invalid" value the developer never
        // touches this save. In practice baked/previously-saved values are
        // always valid by construction, but the contract must hold either
        // way — an untouched field is not this save's business.
        const row = makeRow({ algodUrl: 'not-a-url' })
        const { result } = renderHook(() =>
            useNodeSettingsRow({ row, onSave, onReset: vi.fn() }),
        )

        act(() => {
            result.current.handleIndexerUrlChange('http://10.0.0.5:8980')
        })
        act(() => {
            result.current.handleSave()
        })

        expect(result.current.algodUrlError).toBe(false)
        expect(onSave).toHaveBeenCalledWith({
            indexerUrl: 'http://10.0.0.5:8980',
        })
    })

    test('does nothing when neither field has changed', () => {
        const onSave = vi.fn()
        const row = makeRow()
        const { result } = renderHook(() =>
            useNodeSettingsRow({ row, onSave, onReset: vi.fn() }),
        )

        act(() => {
            result.current.handleSave()
        })

        expect(onSave).not.toHaveBeenCalled()
        expect(result.current.algodUrlError).toBe(false)
        expect(result.current.indexerUrlError).toBe(false)
    })

    test('reset delegates to the caller', () => {
        const onReset = vi.fn()
        const row = makeRow({ isOverridden: true })
        const { result } = renderHook(() =>
            useNodeSettingsRow({ row, onSave: vi.fn(), onReset }),
        )

        act(() => {
            result.current.handleReset()
        })

        expect(onReset).toHaveBeenCalledOnce()
    })

    test('re-syncs the drafts and clears errors once the committed endpoints change', () => {
        const row = makeRow()
        const { result, rerender } = renderHook(
            ({ row }: { row: NetworkRow }) =>
                useNodeSettingsRow({ row, onSave: vi.fn(), onReset: vi.fn() }),
            { initialProps: { row } },
        )

        act(() => {
            result.current.handleAlgodUrlChange('not-a-url')
        })
        act(() => {
            result.current.handleSave()
        })
        expect(result.current.algodUrlError).toBe(true)

        // Simulate a reset resolving upstream: the store clears the override,
        // the parent recomputes `networks`, and this row gets a fresh `row`
        // prop back with the baked endpoint restored.
        rerender({ row: makeRow({ algodUrl: 'https://baked.example' }) })

        expect(result.current.algodUrlInput).toBe('https://baked.example')
        expect(result.current.algodUrlError).toBe(false)
    })
})
