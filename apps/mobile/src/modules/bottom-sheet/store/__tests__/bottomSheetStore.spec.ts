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

// @vitest-environment node

import { createElement } from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
    registerBottomSheet,
    clearBottomSheetRegistryForTests,
} from '../../registry/registry'

// Override the global vitest.setup mock that returns a constant id —
// the store relies on generateOrderedUniqueId for unique ids.
vi.mock('@perawallet/wallet-core-shared', async () => {
    const actual = await vi.importActual<
        typeof import('@perawallet/wallet-core-shared')
    >('@perawallet/wallet-core-shared')
    let counter = 0
    return {
        ...actual,
        generateOrderedUniqueId: () => `id-${++counter}`,
    }
})

import { useBottomSheetStore } from '../bottomSheetStore'

describe('bottomSheetStore', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
        useBottomSheetStore.getState().registerBottomSheetHost()
    })

    it('starts with an empty stack', () => {
        expect(useBottomSheetStore.getState().requests).toEqual([])
    })

    it('request() adds a visible entry and returns a promise', async () => {
        const promise = useBottomSheetStore.getState().request({
            contents: 'A',
        })
        const { requests } = useBottomSheetStore.getState()
        expect(requests).toHaveLength(1)
        expect(requests[0].contents).toBe('A')
        expect(requests[0].isVisible).toBe(true)
        expect(typeof requests[0].id).toBe('string')
        expect(promise).toBeInstanceOf(Promise)
    })

    it('request() generates unique ids when none supplied', () => {
        useBottomSheetStore.getState().request({ contents: 'A' })
        useBottomSheetStore.getState().request({ contents: 'B' })
        const ids = useBottomSheetStore.getState().requests.map(r => r.id)
        expect(new Set(ids).size).toBe(2)
    })

    it('request() honours a caller-supplied id', () => {
        useBottomSheetStore.getState().request({
            id: 'my-id',
            contents: 'A',
        })
        expect(useBottomSheetStore.getState().requests[0].id).toBe('my-id')
    })

    it('resolve(id, value) marks the request invisible without removing it', () => {
        useBottomSheetStore.getState().request({ id: 'x', contents: 'A' })
        useBottomSheetStore.getState().resolve('x', 'confirm')
        const { requests } = useBottomSheetStore.getState()
        expect(requests).toHaveLength(1)
        expect(requests[0].isVisible).toBe(false)
    })

    it('dismiss(id) marks the request invisible without removing it', () => {
        useBottomSheetStore.getState().request({ id: 'x', contents: 'A' })
        useBottomSheetStore.getState().dismiss('x')
        const { requests } = useBottomSheetStore.getState()
        expect(requests).toHaveLength(1)
        expect(requests[0].isVisible).toBe(false)
    })

    it('dismiss() with no id targets the top of the stack', () => {
        useBottomSheetStore.getState().request({ id: 'A', contents: 'A' })
        useBottomSheetStore.getState().request({ id: 'B', contents: 'B' })
        useBottomSheetStore.getState().dismiss()
        const { requests } = useBottomSheetStore.getState()
        expect(requests.find(r => r.id === 'A')?.isVisible).toBe(true)
        expect(requests.find(r => r.id === 'B')?.isVisible).toBe(false)
    })

    it('remove(id) pops the entry and resolves the promise with the captured value', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'x', contents: 'A' })
        useBottomSheetStore.getState().resolve('x', 'confirm')
        useBottomSheetStore.getState().remove('x')
        expect(useBottomSheetStore.getState().requests).toHaveLength(0)
        await expect(promise).resolves.toBe('confirm')
    })

    it('remove(id) after dismiss resolves the promise with undefined', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'x', contents: 'A' })
        useBottomSheetStore.getState().dismiss('x')
        useBottomSheetStore.getState().remove('x')
        await expect(promise).resolves.toBeUndefined()
    })

    it('remove(id) on a never-resolved request still resolves with undefined (gesture close)', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'x', contents: 'A' })
        useBottomSheetStore.getState().remove('x')
        await expect(promise).resolves.toBeUndefined()
    })

    it('dismissAll() marks every request invisible', () => {
        useBottomSheetStore.getState().request({ id: 'A', contents: 'A' })
        useBottomSheetStore.getState().request({ id: 'B', contents: 'B' })
        useBottomSheetStore.getState().dismissAll()
        const { requests } = useBottomSheetStore.getState()
        expect(requests.every(r => !r.isVisible)).toBe(true)
        expect(requests).toHaveLength(2)
    })

    it('resolve/dismiss/remove on unknown ids are no-ops', () => {
        expect(() => {
            useBottomSheetStore.getState().resolve('nope', 1)
            useBottomSheetStore.getState().dismiss('nope')
            useBottomSheetStore.getState().remove('nope')
        }).not.toThrow()
    })

    it('resetState empties the stack synchronously (no close animation)', () => {
        useBottomSheetStore.getState().request({ id: 'A', contents: 'A' })
        useBottomSheetStore.getState().resetState()
        expect(useBottomSheetStore.getState().requests).toEqual([])
    })

    it('resetState() resolves pending promises with undefined so callers do not hang', async () => {
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'x', contents: 'A' })
        useBottomSheetStore.getState().resetState()
        await expect(promise).resolves.toBeUndefined()
    })

    it('requestByType pushes the registered component with given props', () => {
        const Fake = ({ label }: { label: string }) =>
            createElement('span', null, label)
        // augmentation is type-only; cast for the test
        registerBottomSheet('fake' as never, Fake as never)
        useBottomSheetStore
            .getState()
            .requestByType('fake' as never, { label: 'Hi' } as never)
        const { requests } = useBottomSheetStore.getState()
        expect(requests).toHaveLength(1)
        // contents is a React element of the registered component
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element = requests[0].contents as any
        expect(element.type).toBe(Fake)
        expect(element.props).toEqual({ label: 'Hi' })
        clearBottomSheetRegistryForTests()
    })

    it('requestByType throws synchronously when the type is unknown', () => {
        expect(() =>
            useBottomSheetStore
                .getState()
                .requestByType('not-registered' as never, {} as never),
        ).toThrow(/not registered/i)
    })
})

describe('host registration (fail-loud request)', () => {
    beforeEach(() => {
        // Undo the outer describe's registerBottomSheetHost() so each of
        // these tests controls hostCount explicitly.
        useBottomSheetStore.getState().resetState()
    })

    it('rejects request() when no BottomSheetManager host is mounted', async () => {
        await expect(
            useBottomSheetStore.getState().request({ contents: null }),
        ).rejects.toThrow(/no BottomSheetManager/)
    })

    it('resolves normally when a host is registered', async () => {
        useBottomSheetStore.getState().registerBottomSheetHost()
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'x', contents: null })
        useBottomSheetStore.getState().resolve('x', 'value')
        useBottomSheetStore.getState().remove('x')
        await expect(promise).resolves.toBe('value')
    })

    it('rejects again after the last host unregisters', async () => {
        useBottomSheetStore.getState().registerBottomSheetHost()
        useBottomSheetStore.getState().unregisterBottomSheetHost()
        await expect(
            useBottomSheetStore.getState().request({ contents: null }),
        ).rejects.toThrow(/no BottomSheetManager/)
    })

    it('settles a pending request with undefined (dismissal, not rejection) when the last host unmounts', async () => {
        useBottomSheetStore.getState().registerBottomSheetHost()
        const promise = useBottomSheetStore
            .getState()
            .request<string>({ id: 'x', contents: null })
        useBottomSheetStore.getState().unregisterBottomSheetHost()
        await expect(promise).resolves.toBeUndefined()
        expect(useBottomSheetStore.getState().requests).toEqual([])
    })
})

describe('presentation holds', () => {
    beforeEach(() => {
        useBottomSheetStore.getState().resetState()
    })

    it('stays held until every owner releases', () => {
        const { setPresentationHeld } = useBottomSheetStore.getState()

        setPresentationHeld(true, 'app-lock')
        setPresentationHeld(true, 'blocking-prompt')
        setPresentationHeld(false, 'blocking-prompt')

        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(true)

        setPresentationHeld(false, 'app-lock')

        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(false)
    })

    it('ignores a repeated hold from the same owner', () => {
        const { setPresentationHeld } = useBottomSheetStore.getState()

        setPresentationHeld(true, 'app-lock')
        setPresentationHeld(true, 'app-lock')

        // Not refcounted, and not duplicated: one release must clear it.
        expect(useBottomSheetStore.getState().presentationHolds).toEqual([
            'app-lock',
        ])

        setPresentationHeld(false, 'app-lock')

        expect(useBottomSheetStore.getState().isPresentationHeld).toBe(false)
    })
})
