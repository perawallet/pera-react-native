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
import { renderHook } from '@testing-library/react'
import { useHardwareSigning } from '../useHardwareSigning'
import { useHardwareSigningStore } from '../../store/hardwareSigningStore'

describe('useHardwareSigning', () => {
    beforeEach(() => {
        useHardwareSigningStore.getState().resetState()
    })

    it('isActive is false when status is "idle"', () => {
        const { result } = renderHook(() => useHardwareSigning())
        expect(result.current.isActive).toBe(false)
        expect(result.current.status).toBe('idle')
    })

    it('isActive is false during the silent-scan phase ("searching")', () => {
        useHardwareSigningStore.getState().start('req-1', 'Nano X')
        const { result } = renderHook(() => useHardwareSigning())
        expect(result.current.status).toBe('searching')
        expect(result.current.isActive).toBe(false)
    })

    it('isActive is true once the device is awaiting approval', () => {
        const store = useHardwareSigningStore.getState()
        store.start('req-1', 'Nano X')
        store.setStatus('awaitingApproval')
        const { result } = renderHook(() => useHardwareSigning())
        expect(result.current.isActive).toBe(true)
    })

    it('isActive is true while signing', () => {
        const store = useHardwareSigningStore.getState()
        store.start('req-1', 'Nano X')
        store.setStatus('signing')
        const { result } = renderHook(() => useHardwareSigning())
        expect(result.current.isActive).toBe(true)
    })

    it('isActive is true on error', () => {
        const store = useHardwareSigningStore.getState()
        store.start('req-1', 'Nano X')
        store.setError({ kind: 'app_not_open' })
        const { result } = renderHook(() => useHardwareSigning())
        expect(result.current.isActive).toBe(true)
    })

    it('passes deviceName through', () => {
        useHardwareSigningStore.getState().start('req-1', 'Nano X')
        const { result } = renderHook(() => useHardwareSigning())
        expect(result.current.deviceName).toBe('Nano X')
    })

    it('passes null deviceName through', () => {
        useHardwareSigningStore.getState().start('req-1', null)
        const { result } = renderHook(() => useHardwareSigning())
        expect(result.current.deviceName).toBeNull()
    })

    it('passes error payload through', () => {
        const store = useHardwareSigningStore.getState()
        store.start('req-1', 'Nano X')
        store.setError({ kind: 'connection_failed' })
        const { result } = renderHook(() => useHardwareSigning())
        expect(result.current.error?.kind).toBe('connection_failed')
    })

    it('error is null when no error has been set', () => {
        useHardwareSigningStore.getState().start('req-1', 'Nano X')
        const { result } = renderHook(() => useHardwareSigning())
        expect(result.current.error).toBeNull()
    })

    it('resolveActiveRequest returns the request whose id matches', () => {
        useHardwareSigningStore.getState().start('req-7', 'Nano X')
        const { result } = renderHook(() => useHardwareSigning())
        const active = result.current.resolveActiveRequest([
            { id: 'req-3' } as never,
            { id: 'req-7' } as never,
        ])
        expect(active?.id).toBe('req-7')
    })

    it('dismiss calls reset on the store', () => {
        const store = useHardwareSigningStore.getState()
        store.start('req-1', 'Nano X')
        store.setStatus('awaitingApproval')
        const { result } = renderHook(() => useHardwareSigning())
        result.current.dismiss()
        expect(useHardwareSigningStore.getState().status).toBe('idle')
    })
})
