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

import { describe, it, expect } from 'vitest'
import { resolveMediaImageUri, type MediaItem } from '../resolveMediaImageUri'

const FALLBACK = 'https://example.com/fallback.png'

describe('resolveMediaImageUri', () => {
    it('prefers previewUrl for static images', () => {
        const item: MediaItem = {
            type: 'image',
            previewUrl: 'https://example.com/preview.png',
            downloadUrl: 'https://example.com/raw.png',
            extension: '.png',
        }
        expect(resolveMediaImageUri(item, FALLBACK)).toBe(
            'https://example.com/preview.png',
        )
    })

    it('prefers downloadUrl for GIFs so the animated file is shown, not the static preview', () => {
        const item: MediaItem = {
            type: 'image',
            previewUrl: 'https://example.com/ipfs-thumbnails/cid',
            downloadUrl: 'https://example.com/ipfs/cid.gif',
            extension: '.gif',
        }
        expect(resolveMediaImageUri(item, FALLBACK)).toBe(
            'https://example.com/ipfs/cid.gif',
        )
    })

    it('matches the GIF extension case-insensitively', () => {
        const item: MediaItem = {
            type: 'image',
            previewUrl: 'https://example.com/preview.gif',
            downloadUrl: 'https://example.com/raw.gif',
            extension: '.GIF',
        }
        expect(resolveMediaImageUri(item, FALLBACK)).toBe(
            'https://example.com/raw.gif',
        )
    })

    it('falls back to previewUrl for a GIF with no downloadUrl', () => {
        const item: MediaItem = {
            type: 'image',
            previewUrl: 'https://example.com/preview.gif',
            extension: '.gif',
        }
        expect(resolveMediaImageUri(item, FALLBACK)).toBe(
            'https://example.com/preview.gif',
        )
    })

    it('never uses downloadUrl for model items, even with a gif extension hint', () => {
        const item: MediaItem = {
            type: 'model',
            previewUrl: 'https://example.com/poster.png',
            downloadUrl: 'https://example.com/model.glb',
            extension: '.glb',
        }
        expect(resolveMediaImageUri(item, FALLBACK)).toBe(
            'https://example.com/poster.png',
        )
    })

    it('returns the fallback when the item has no URLs', () => {
        const item: MediaItem = { type: 'image', extension: '.png' }
        expect(resolveMediaImageUri(item, FALLBACK)).toBe(FALLBACK)
        expect(resolveMediaImageUri(undefined, FALLBACK)).toBe(FALLBACK)
    })
})
