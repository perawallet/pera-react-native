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

import { describe, it, expect } from 'vitest'
import { getSocialMediaDeeplink } from '../social-media-deeplinks'

describe('getSocialMediaDeeplink', () => {
    describe('twitter', () => {
        it.each([
            'https://twitter.com/PeraAlgoWallet',
            'https://www.twitter.com/PeraAlgoWallet',
            'https://m.twitter.com/PeraAlgoWallet',
            'https://mobile.twitter.com/PeraAlgoWallet',
            'https://x.com/PeraAlgoWallet',
            'https://www.x.com/PeraAlgoWallet',
            'http://twitter.com/PeraAlgoWallet',
        ])('maps a profile link to the app deeplink: %s', url => {
            expect(getSocialMediaDeeplink(url)).toEqual({
                service: 'twitter',
                url: 'twitter://user?screen_name=PeraAlgoWallet',
            })
        })

        it('normalizes a twitter:// scheme link', () => {
            expect(
                getSocialMediaDeeplink('twitter://user?screen_name=tinyman'),
            ).toEqual({
                service: 'twitter',
                url: 'twitter://user?screen_name=tinyman',
            })
        })

        it.each([
            'home',
            'explore',
            'search',
            'notifications',
            'messages',
            'settings',
            'i',
            'intent',
            'hashtag',
        ])('excludes the reserved path %s', reserved => {
            expect(
                getSocialMediaDeeplink(`https://twitter.com/${reserved}`),
            ).toBeNull()
            expect(
                getSocialMediaDeeplink(
                    `twitter://user?screen_name=${reserved}`,
                ),
            ).toBeNull()
        })

        it('excludes reserved paths case-insensitively', () => {
            expect(
                getSocialMediaDeeplink('https://twitter.com/Home'),
            ).toBeNull()
        })

        it('ignores multi-segment paths (tweets, sub-pages)', () => {
            expect(
                getSocialMediaDeeplink(
                    'https://twitter.com/PeraAlgoWallet/status/123',
                ),
            ).toBeNull()
        })

        it('ignores a twitter:// link with a non-user host', () => {
            expect(
                getSocialMediaDeeplink('twitter://users?screen_name=tinyman'),
            ).toBeNull()
        })

        it('ignores a twitter:// user link without a screen_name', () => {
            expect(getSocialMediaDeeplink('twitter://user')).toBeNull()
        })
    })

    describe('telegram', () => {
        it.each(['https://t.me/PeraWallet', 'https://telegram.me/PeraWallet'])(
            'maps a channel link to the app deeplink: %s',
            url => {
                expect(getSocialMediaDeeplink(url)).toEqual({
                    service: 'telegram',
                    url: 'tg://resolve?domain=PeraWallet',
                })
            },
        )

        it('normalizes a tg:// scheme link', () => {
            expect(
                getSocialMediaDeeplink('tg://resolve?domain=tinymanofficial'),
            ).toEqual({
                service: 'telegram',
                url: 'tg://resolve?domain=tinymanofficial',
            })
        })

        it('ignores multi-segment paths', () => {
            expect(
                getSocialMediaDeeplink('https://t.me/PeraWallet/Test'),
            ).toBeNull()
        })

        it('ignores a tg:// link with a non-resolve host', () => {
            expect(
                getSocialMediaDeeplink('tg://resolve2?domain=tinymanofficial'),
            ).toBeNull()
        })

        it('ignores a tg://resolve link without a domain', () => {
            expect(
                getSocialMediaDeeplink('tg://resolve?domain2=tinymanofficial'),
            ).toBeNull()
        })
    })

    describe('discord', () => {
        it('maps a discord.com invite to the app deeplink', () => {
            expect(
                getSocialMediaDeeplink('https://discord.com/invite/gR2UdkCTXQ'),
            ).toEqual({
                service: 'discord',
                url: 'com.hammerandchisel.discord://discord.com/invite/gR2UdkCTXQ',
            })
        })

        it('maps a discord.gg short invite to the app deeplink', () => {
            expect(
                getSocialMediaDeeplink('https://discord.gg/gR2UdkCTXQ'),
            ).toEqual({
                service: 'discord',
                url: 'com.hammerandchisel.discord://discord.com/invite/gR2UdkCTXQ',
            })
        })

        it('normalizes a discord app-scheme invite', () => {
            expect(
                getSocialMediaDeeplink(
                    'com.hammerandchisel.discord://discord.com/invite/wvHnAdmEv6',
                ),
            ).toEqual({
                service: 'discord',
                url: 'com.hammerandchisel.discord://discord.com/invite/wvHnAdmEv6',
            })
        })

        it.each([
            'https://discord.com/invites/gR2UdkCTXQ',
            'https://discord.com/gR2UdkCTXQ',
            'https://discord.com/channels/123/456',
            'com.hammerandchisel.discord://discord.com/invite/wvHnAdmEv6/test',
        ])('ignores non-invite paths: %s', url => {
            expect(getSocialMediaDeeplink(url)).toBeNull()
        })
    })

    describe('non-matching URLs', () => {
        it.each([
            'https://dapp.example/sign',
            'https://perawallet.app/qr/perawallet/app/swap',
            'https://twitter.com.evil.com/PeraAlgoWallet',
            'https://sub.t.me/PeraWallet',
            'https://twitter.com/',
            'mailto:support@example.com',
            'wc:topic@1?bridge=https%3A%2F%2Fbridge.example&key=abc',
            'not a url',
        ])('returns null for %s', url => {
            expect(getSocialMediaDeeplink(url)).toBeNull()
        })
    })
})
