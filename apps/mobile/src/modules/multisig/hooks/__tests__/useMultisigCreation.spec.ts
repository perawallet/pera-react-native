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

import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMultisigCreationStore } from '../useMultisigCreation'

describe('useMultisigCreationStore', () => {
    beforeEach(() => {
        const { result } = renderHook(() => useMultisigCreationStore())
        act(() => {
            result.current.resetState()
        })
    })

    it('starts with empty participants and default threshold', () => {
        const { result } = renderHook(() => useMultisigCreationStore())

        expect(result.current.participants).toEqual([])
        expect(result.current.threshold).toBe(2)
        expect(result.current.accountName).toBe('')
    })

    it('adds a participant', () => {
        const { result } = renderHook(() => useMultisigCreationStore())

        act(() => {
            result.current.addParticipant({
                address: 'ADDR1',
                name: 'Account 1',
                isLocal: true,
            })
        })

        expect(result.current.participants).toHaveLength(1)
        expect(result.current.participants[0].address).toBe('ADDR1')
    })

    it('removes a participant by address', () => {
        const { result } = renderHook(() => useMultisigCreationStore())

        act(() => {
            result.current.addParticipant({
                address: 'ADDR1',
                isLocal: true,
            })
            result.current.addParticipant({
                address: 'ADDR2',
                isLocal: false,
            })
        })

        act(() => {
            result.current.removeParticipant('ADDR1')
        })

        expect(result.current.participants).toHaveLength(1)
        expect(result.current.participants[0].address).toBe('ADDR2')
    })

    it('sets the threshold', () => {
        const { result } = renderHook(() => useMultisigCreationStore())

        act(() => {
            result.current.setThreshold(3)
        })

        expect(result.current.threshold).toBe(3)
    })

    it('sets the account name', () => {
        const { result } = renderHook(() => useMultisigCreationStore())

        act(() => {
            result.current.setAccountName('My Joint Account')
        })

        expect(result.current.accountName).toBe('My Joint Account')
    })

    it('resets state to initial values', () => {
        const { result } = renderHook(() => useMultisigCreationStore())

        act(() => {
            result.current.addParticipant({
                address: 'ADDR1',
                isLocal: true,
            })
            result.current.setThreshold(5)
            result.current.setAccountName('Test')
        })

        act(() => {
            result.current.resetState()
        })

        expect(result.current.participants).toEqual([])
        expect(result.current.threshold).toBe(2)
        expect(result.current.accountName).toBe('')
    })
})
