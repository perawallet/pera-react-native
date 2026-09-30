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
import type { SettingsBackupPayload, SettingsDocument } from '../../models'
import { canonicalJson } from '../canonicalize'
import {
    mergeRemoteSettings,
    observeLocalSettings,
    settingsDocumentHash,
    settingsDocumentToPayload,
} from '../settingsDocument'
import { TEST_SETTINGS } from './testSettings'

const observed = (value: unknown) => canonicalJson(value)

const synced = (updatedAt = 5): SettingsDocument =>
    observeLocalSettings(
        mergeRemoteSettings(undefined, remoteOf(updatedAt)).doc,
        TEST_SETTINGS,
        updatedAt,
    ).doc

const remoteOf = (updatedAt: number): SettingsBackupPayload => ({
    currency: { value: TEST_SETTINGS.currency, updatedAt },
    language: { value: TEST_SETTINGS.language, updatedAt },
    confirmationMode: { value: TEST_SETTINGS.confirmationMode, updatedAt },
    launchAccount: { value: TEST_SETTINGS.launchAccount, updatedAt },
})

describe('observeLocalSettings', () => {
    it('stamps a field seen for the first time 0, so a default never outranks a remote choice', () => {
        const { doc, hasChanged } = observeLocalSettings(
            undefined,
            TEST_SETTINGS,
            100,
        )

        expect(hasChanged).toBe(true)
        expect(doc.language).toEqual({
            value: 'system',
            updatedAt: 0,
            observed: observed('system'),
        })
    })

    it('stamps an edited field now and leaves the others alone', () => {
        const { doc, hasChanged } = observeLocalSettings(
            synced(5),
            { ...TEST_SETTINGS, language: 'tr' },
            100,
        )

        expect(hasChanged).toBe(true)
        expect(doc.language).toEqual({
            value: 'tr',
            updatedAt: 100,
            observed: observed('tr'),
        })
        expect(doc.currency?.updatedAt).toBe(5)
    })

    it('reports no change when nothing moved', () => {
        const doc = synced(5)

        const result = observeLocalSettings(doc, TEST_SETTINGS, 100)

        expect(result.hasChanged).toBe(false)
        expect(result.doc).toEqual(doc)
    })

    it('takes an unobserved field as the baseline rather than as an edit', () => {
        const { doc: imported } = mergeRemoteSettings(synced(5), {
            ...remoteOf(5),
            language: { value: 'de', updatedAt: 50 },
        })

        const { doc, hasChanged } = observeLocalSettings(
            imported,
            { ...TEST_SETTINGS, language: 'de' },
            100,
        )

        expect(hasChanged).toBe(false)
        expect(doc.language).toEqual({
            value: 'de',
            updatedAt: 50,
            observed: observed('de'),
        })
    })

    // The accounts store refuses a launch account this device does not hold,
    // so the device's own value stays put under the remote one.
    it('keeps a remote value this device declined to apply', () => {
        const pinned = { mode: 'specific', address: 'ELSEWHERE' }
        const { doc: imported } = mergeRemoteSettings(synced(5), {
            ...remoteOf(5),
            launchAccount: { value: pinned, updatedAt: 50 },
        })

        const baseline = observeLocalSettings(imported, TEST_SETTINGS, 100)
        const next = observeLocalSettings(baseline.doc, TEST_SETTINGS, 200)

        expect(baseline.hasChanged).toBe(false)
        expect(next.hasChanged).toBe(false)
        expect(next.doc.launchAccount?.value).toEqual(pinned)
    })
})

describe('mergeRemoteSettings', () => {
    it('adopts a newer remote field and asks for it to be applied', () => {
        const { doc, toApply, isRemoteBehind } = mergeRemoteSettings(
            synced(5),
            {
                ...remoteOf(5),
                currency: {
                    value: { preferred: 'EUR', fallback: 'ALGO' },
                    updatedAt: 50,
                },
            },
        )

        expect(toApply).toEqual({
            currency: { preferred: 'EUR', fallback: 'ALGO' },
        })
        expect(doc.currency).toEqual({
            value: { preferred: 'EUR', fallback: 'ALGO' },
            updatedAt: 50,
            observed: null,
        })
        expect(isRemoteBehind).toBe(false)
    })

    it('keeps both sides of edits to different fields', () => {
        const local = observeLocalSettings(
            synced(5),
            { ...TEST_SETTINGS, language: 'tr' },
            100,
        ).doc

        const { doc, toApply, isRemoteBehind } = mergeRemoteSettings(local, {
            ...remoteOf(5),
            currency: {
                value: { preferred: 'EUR', fallback: 'ALGO' },
                updatedAt: 90,
            },
        })

        expect(doc.language?.value).toBe('tr')
        expect(doc.currency?.value).toEqual({
            preferred: 'EUR',
            fallback: 'ALGO',
        })
        expect(toApply).toEqual({
            currency: { preferred: 'EUR', fallback: 'ALGO' },
        })
        expect(isRemoteBehind).toBe(true)
    })

    it('keeps a strictly newer local edit to the same field', () => {
        const local = observeLocalSettings(
            synced(5),
            { ...TEST_SETTINGS, language: 'tr' },
            100,
        ).doc

        const { doc, toApply, isRemoteBehind } = mergeRemoteSettings(local, {
            ...remoteOf(5),
            language: { value: 'de', updatedAt: 90 },
        })

        expect(doc.language?.value).toBe('tr')
        expect(toApply).toEqual({})
        expect(isRemoteBehind).toBe(true)
    })

    it('gives a tie to the remote', () => {
        const local = observeLocalSettings(
            undefined,
            { ...TEST_SETTINGS, language: 'tr' },
            100,
        ).doc

        const { toApply, isRemoteBehind } = mergeRemoteSettings(local, {
            ...remoteOf(0),
            language: { value: 'de', updatedAt: 0 },
        })

        expect(toApply).toEqual({ language: 'de' })
        expect(isRemoteBehind).toBe(false)
    })

    it('reports the remote behind when it lacks a field this device holds', () => {
        const { language: _dropped, ...remote } = remoteOf(5)

        const { doc, isRemoteBehind } = mergeRemoteSettings(synced(5), remote)

        expect(doc.language?.value).toBe('system')
        expect(isRemoteBehind).toBe(true)
    })

    it('applies nothing when the remote matches', () => {
        const { toApply, isRemoteBehind } = mergeRemoteSettings(
            synced(5),
            remoteOf(5),
        )

        expect(toApply).toEqual({})
        expect(isRemoteBehind).toBe(false)
    })
})

describe('settingsDocumentToPayload', () => {
    it('carries values and timestamps but never the local observation', () => {
        const payload = settingsDocumentToPayload(synced(5))

        expect(payload).toEqual(remoteOf(5))
    })

    it('hashes the same document identically however it was observed', () => {
        const merged = mergeRemoteSettings(undefined, remoteOf(5)).doc

        expect(settingsDocumentHash(merged)).toBe(
            settingsDocumentHash(synced(5)),
        )
    })
})
