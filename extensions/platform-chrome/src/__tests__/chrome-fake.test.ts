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

import { beforeEach, describe, expect, it } from 'vitest'
import { createChromeFake, type ChromeFake } from '../test-utils/chrome'

describe('chrome fake: session storage', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('round-trips values and keeps them out of the local area', async () => {
        await chrome.storage.session.set({ 'a:b': 'value' })

        expect(await chrome.storage.session.get('a:b')).toEqual({
            'a:b': 'value',
        })
        expect(fake.sessionData.get('a:b')).toBe('value')
        expect(fake.data.has('a:b')).toBe(false)
    })

    it('removes values', async () => {
        await chrome.storage.session.set({ 'a:b': 'value' })
        await chrome.storage.session.remove('a:b')

        expect(await chrome.storage.session.get('a:b')).toEqual({})
    })

    it('records setAccessLevel calls', async () => {
        await chrome.storage.session.setAccessLevel({
            accessLevel: 'TRUSTED_CONTEXTS',
        })

        expect(fake.accessLevels).toEqual(['TRUSTED_CONTEXTS'])
    })

    it('emits onChanged with the session area name', async () => {
        const seen: Array<{ keys: string[]; areaName: string }> = []
        chrome.storage.onChanged.addListener((changes, areaName) => {
            seen.push({ keys: Object.keys(changes), areaName })
        })

        await chrome.storage.session.set({ 'a:b': 'value' })

        expect(seen).toEqual([{ keys: ['a:b'], areaName: 'session' }])
    })
})

describe('chrome fake: alarms', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('records created alarms and clears them', async () => {
        await chrome.alarms.create('tick', { periodInMinutes: 5 })
        expect(fake.alarms.get('tick')).toEqual({ periodInMinutes: 5 })

        await chrome.alarms.clear('tick')
        expect(fake.alarms.has('tick')).toBe(false)
    })

    it('surfaces periodInMinutes for a created alarm via getAll', async () => {
        await chrome.alarms.create('tick', { periodInMinutes: 5 })

        expect(await chrome.alarms.getAll()).toEqual([
            { name: 'tick', periodInMinutes: 5 },
        ])
    })

    it('drives onAlarm listeners via fireAlarm', async () => {
        const fired: string[] = []
        chrome.alarms.onAlarm.addListener(alarm => {
            fired.push(alarm.name)
        })

        await chrome.alarms.create('tick', { periodInMinutes: 5 })
        await fake.fireAlarm('tick')

        expect(fired).toEqual(['tick'])
    })

    it('does not fire listeners for an alarm that was never created', async () => {
        const fired: string[] = []
        chrome.alarms.onAlarm.addListener(alarm => {
            fired.push(alarm.name)
        })

        await fake.fireAlarm('never-created')

        expect(fired).toEqual([])
    })
})
