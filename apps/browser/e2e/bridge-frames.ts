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

import type { Frame, Page } from '@playwright/test'

// The mounts the manifest declares the bridge content scripts on. Frames are
// found by host because the relay scrubs the bridge token off the frame's URL
// once the handshake lands.
const DISCOVER_HOSTS = [
    'discover-mobile.perawallet.app',
    'discover-mobile-staging.perawallet.app',
]
const BIDALI_HOST_SUFFIX = '.bidali.com'

const hostnameOf = (url: string): string => {
    try {
        return new URL(url).hostname
    } catch {
        return ''
    }
}

export const findDiscoverFrame = (page: Page): Frame | undefined =>
    page
        .frames()
        .find(frame => DISCOVER_HOSTS.includes(hostnameOf(frame.url())))

export const findBidaliFrame = (page: Page): Frame | undefined =>
    page
        .frames()
        .find(frame => hostnameOf(frame.url()).endsWith(BIDALI_HOST_SUFFIX))
