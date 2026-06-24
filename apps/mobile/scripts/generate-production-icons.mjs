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

// Rasterizes the native Android brand-mark vector into the two PNG sources
// Expo's icon fields need. The vector's `pathData` strings are SVG path data,
// so we wrap them in an <svg>, render with sharp, trim to a tight mark, then
// place the mark at platform-specific scales:
//   - Android adaptive foreground: black mark on transparent, sized for the
//     adaptive safe zone (so the launcher mask never clips it).
//   - iOS marketing icon: black mark on opaque #FFEE55, framed like the App
//     Store icon. Verify against pera-ios Icon.png; tune *_MARK_FRACTION.
// Re-run with: pnpm --filter mobile generate:production-icons

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const here = path.dirname(fileURLToPath(import.meta.url))
const ASSETS = path.join(here, '..', 'assets', 'production')
const SRC_VECTOR = path.join(ASSETS, 'source', 'ic_launcher_foreground.xml')

const CANVAS = 1024
const ANDROID_MARK_FRACTION = 0.56 // fraction of canvas width occupied by the mark
const IOS_MARK_FRACTION = 0.7
const YELLOW = { r: 255, g: 238, b: 85, alpha: 1 } // #FFEE55

function vectorToSvg(xml) {
    const vw = /android:viewportWidth="([\d.]+)"/.exec(xml)?.[1] ?? '108'
    const vh = /android:viewportHeight="([\d.]+)"/.exec(xml)?.[1] ?? '108'
    const paths = [...xml.matchAll(/android:pathData="([^"]+)"/g)].map(m =>
        m[1].trim(),
    )
    const fills = [...xml.matchAll(/android:fillColor="([^"]+)"/g)].map(
        m => m[1],
    )
    if (paths.length === 0) {
        throw new Error(`No pathData found in ${SRC_VECTOR}`)
    }
    const body = paths
        .map((d, i) => `<path d="${d}" fill="${fills[i] ?? '#000000'}"/>`)
        .join('')
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}">${body}</svg>`
}

async function tightMarkPng() {
    const svg = vectorToSvg(fs.readFileSync(SRC_VECTOR, 'utf8'))
    return sharp(Buffer.from(svg), { density: 512 })
        .resize(CANVAS, CANVAS, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .trim()
        .toBuffer()
}

async function scaledMark(mark, fraction) {
    const size = Math.round(CANVAS * fraction)
    return sharp(mark)
        .resize(size, size, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .toBuffer()
}

async function generate() {
    const mark = await tightMarkPng()

    await sharp({
        create: {
            width: CANVAS,
            height: CANVAS,
            channels: 4,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
    })
        .composite([
            { input: await scaledMark(mark, ANDROID_MARK_FRACTION), gravity: 'center' },
        ])
        .png()
        .toFile(path.join(ASSETS, 'icon-android-foreground.png'))

    await sharp({
        create: {
            width: CANVAS,
            height: CANVAS,
            channels: 4,
            background: YELLOW,
        },
    })
        .composite([
            { input: await scaledMark(mark, IOS_MARK_FRACTION), gravity: 'center' },
        ])
        .flatten({ background: YELLOW })
        .removeAlpha() // App Store icons must be fully opaque (no alpha channel)
        .png()
        .toFile(path.join(ASSETS, 'icon-ios.png'))

    console.log('Generated icon-android-foreground.png and icon-ios.png')
}

generate().catch(error => {
    console.error(error)
    process.exit(1)
})
