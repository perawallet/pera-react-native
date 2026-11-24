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
import { describe, test, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { readCloudBackupCredentials, useCloudBackupStore } from '../store'

beforeEach(() => {
    act(() => useCloudBackupStore.getState().resetState())
})

describe('useCloudBackupStore', () => {
    test('starts unconfigured', () => {
        const { result } = renderHook(() => useCloudBackupStore())
        expect(result.current.isConfigured()).toBe(false)
        expect(result.current.backupId).toBeNull()
    })

    test('setConfigured stores identity and flips isConfigured', () => {
        const { result } = renderHook(() => useCloudBackupStore())
        act(() =>
            result.current.setConfigured({
                backupId: 'did:pera:abc',
                salt: 'c2FsdA==',
                deviceId: 'device-123',
                credentialsConfirmed: true,
            }),
        )
        expect(result.current.backupId).toBe('did:pera:abc')
        expect(result.current.salt).toBe('c2FsdA==')
        expect(result.current.isConfigured()).toBe(true)
    })

    test('starts unconfirmed and needs no confirmation while unconfigured', () => {
        const { result } = renderHook(() => useCloudBackupStore())
        expect(result.current.credentialsConfirmed).toBe(false)
        expect(result.current.needsCredentialsConfirmation()).toBe(false)
    })

    test('an unconfirmed backup needs confirmation until confirmCredentials runs', () => {
        const { result } = renderHook(() => useCloudBackupStore())
        act(() =>
            result.current.setConfigured({
                backupId: 'did:pera:abc',
                salt: 'c2FsdA==',
                deviceId: 'device-123',
                credentialsConfirmed: false,
            }),
        )
        expect(result.current.needsCredentialsConfirmation()).toBe(true)

        act(() => result.current.confirmCredentials())

        expect(result.current.credentialsConfirmed).toBe(true)
        expect(result.current.needsCredentialsConfirmation()).toBe(false)
    })

    test('a confirmed backup needs no confirmation', () => {
        const { result } = renderHook(() => useCloudBackupStore())
        act(() =>
            result.current.setConfigured({
                backupId: 'did:pera:abc',
                salt: 'c2FsdA==',
                deviceId: 'device-123',
                credentialsConfirmed: true,
            }),
        )
        expect(result.current.needsCredentialsConfirmation()).toBe(false)
    })

    test('resetState clears the confirmation', () => {
        const { result } = renderHook(() => useCloudBackupStore())
        act(() =>
            result.current.setConfigured({
                backupId: 'did:pera:abc',
                salt: 'c2FsdA==',
                deviceId: 'device-123',
                credentialsConfirmed: true,
            }),
        )
        act(() => result.current.resetState())
        expect(result.current.credentialsConfirmed).toBe(false)
    })

    // Persisted `version` stays 1: bumping it without a `migrate` would
    // quarantine the store and silently turn the backup off.
    test('a stored blob without the flag loads configured and unconfirmed', async () => {
        getProvider().keyValueStorage.setItem(
            'cloud-backup-store',
            JSON.stringify({
                state: {
                    backupId: 'did:pera:abc',
                    salt: 'c2FsdA==',
                    deviceId: 'device-123',
                },
                version: 1,
            }),
        )

        await useCloudBackupStore.persist.rehydrate()

        expect(useCloudBackupStore.getState().isConfigured()).toBe(true)
        expect(useCloudBackupStore.getState().credentialsConfirmed).toBe(false)
    })

    test('the confirmation survives a rehydrate', async () => {
        useCloudBackupStore.getState().setConfigured({
            backupId: 'did:pera:abc',
            salt: 'c2FsdA==',
            deviceId: 'device-123',
            credentialsConfirmed: true,
        })

        await useCloudBackupStore.persist.rehydrate()

        expect(useCloudBackupStore.getState().credentialsConfirmed).toBe(true)
    })

    test('resetState clears identity', () => {
        const { result } = renderHook(() => useCloudBackupStore())
        act(() =>
            result.current.setConfigured({
                backupId: 'did:pera:abc',
                salt: 'c2FsdA==',
                deviceId: 'device-123',
                credentialsConfirmed: true,
            }),
        )
        act(() => result.current.resetState())
        expect(result.current.isConfigured()).toBe(false)
    })

    test('readCloudBackupCredentials is null until configured, then follows the store', () => {
        expect(readCloudBackupCredentials()).toEqual({
            backupId: null,
            salt: null,
        })

        useCloudBackupStore.getState().setConfigured({
            backupId: 'did:pera:abc',
            salt: 'c2FsdA==',
            deviceId: 'device-123',
            credentialsConfirmed: true,
        })

        expect(readCloudBackupCredentials()).toEqual({
            backupId: 'did:pera:abc',
            salt: 'c2FsdA==',
        })
    })
})
