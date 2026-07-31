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

import type { Nullable } from '@perawallet/wallet-core-shared'

export type SocialMediaService = 'twitter' | 'telegram' | 'discord'

export type SocialMediaDeeplink = {
    service: SocialMediaService
    url: string
}

const TWITTER_SCHEME = 'twitter'
const TELEGRAM_SCHEME = 'tg'
const DISCORD_SCHEME = 'com.hammerandchisel.discord'

const TWITTER_HOSTS = new Set([
    'twitter.com',
    'www.twitter.com',
    'm.twitter.com',
    'mobile.twitter.com',
    'x.com',
    'www.x.com',
    'm.x.com',
    'mobile.x.com',
])

// App sections, not usernames — a conservative superset of the reserved
// paths pera-ios's SocialMediaDeeplinkRouter excludes.
const TWITTER_RESERVED_PATHS = new Set([
    'home',
    'explore',
    'search',
    'notifications',
    'messages',
    'settings',
    'i',
    'intent',
    'hashtag',
])

const TELEGRAM_HOSTS = new Set(['t.me', 'telegram.me'])

const DISCORD_HOST = 'discord.com'
const DISCORD_INVITE_HOST = 'discord.gg'

/**
 * Representative URL per service for `Linking.canOpenURL` install checks.
 * iOS matches on scheme alone; Android intent resolution also sees host/path,
 * so each probe mirrors the shape of the deeplinks this module produces.
 */
export const SOCIAL_MEDIA_APP_PROBES: Record<SocialMediaService, string> = {
    twitter: `${TWITTER_SCHEME}://user`,
    telegram: `${TELEGRAM_SCHEME}://resolve`,
    discord: `${DISCORD_SCHEME}://${DISCORD_HOST}/invite`,
}

const safeDecode = (value: string): string => {
    try {
        return decodeURIComponent(value)
    } catch {
        return value
    }
}

const pathSegments = (pathname: string): string[] =>
    pathname.split('/').filter(Boolean).map(safeDecode)

const twitterDeeplink = (
    username: Nullable<string>,
): Nullable<SocialMediaDeeplink> => {
    if (!username || TWITTER_RESERVED_PATHS.has(username.toLowerCase())) {
        return null
    }
    return {
        service: 'twitter',
        url: `${TWITTER_SCHEME}://user?screen_name=${encodeURIComponent(username)}`,
    }
}

const telegramDeeplink = (
    name: Nullable<string>,
): Nullable<SocialMediaDeeplink> => {
    if (!name) {
        return null
    }
    return {
        service: 'telegram',
        url: `${TELEGRAM_SCHEME}://resolve?domain=${encodeURIComponent(name)}`,
    }
}

const discordDeeplink = (
    inviteId: Nullable<string>,
): Nullable<SocialMediaDeeplink> => {
    if (!inviteId) {
        return null
    }
    return {
        service: 'discord',
        url: `${DISCORD_SCHEME}://${DISCORD_HOST}/invite/${encodeURIComponent(inviteId)}`,
    }
}

/**
 * Maps a social-media web URL or app-scheme URL to the canonical native app
 * deeplink — a port of pera-ios's `SocialMediaDeeplinkRouter` rule set:
 * - `twitter.com/<user>` (incl. m/www/mobile subdomains and the x.com
 *   equivalents) and `twitter://user?screen_name=<user>` →
 *   `twitter://user?screen_name=<user>`, excluding reserved app sections.
 * - `t.me/<name>`, `telegram.me/<name>` and `tg://resolve?domain=<name>` →
 *   `tg://resolve?domain=<name>`.
 * - `discord.com/invite/<id>`, `discord.gg/<id>` and the Discord app scheme →
 *   `com.hammerandchisel.discord://discord.com/invite/<id>`.
 *
 * Anything else — including profile sub-pages, reserved paths, and URLs that
 * fail to parse — returns null so callers leave the navigation untouched.
 */
export const getSocialMediaDeeplink = (
    url: string,
): Nullable<SocialMediaDeeplink> => {
    let parsed: URL
    try {
        parsed = new URL(url)
    } catch {
        return null
    }

    const scheme = parsed.protocol.slice(0, -1)
    const segments = pathSegments(parsed.pathname)

    switch (scheme) {
        case TWITTER_SCHEME: {
            return parsed.hostname === 'user'
                ? twitterDeeplink(parsed.searchParams.get('screen_name'))
                : null
        }
        case TELEGRAM_SCHEME: {
            return parsed.hostname === 'resolve'
                ? telegramDeeplink(parsed.searchParams.get('domain'))
                : null
        }
        case DISCORD_SCHEME: {
            return segments.length === 2 && segments[0] === 'invite'
                ? discordDeeplink(segments[1])
                : null
        }
        case 'http':
        case 'https': {
            break
        }
        default: {
            return null
        }
    }

    const host = parsed.hostname

    if (TWITTER_HOSTS.has(host)) {
        return segments.length === 1 ? twitterDeeplink(segments[0]) : null
    }

    if (TELEGRAM_HOSTS.has(host)) {
        return segments.length === 1 ? telegramDeeplink(segments[0]) : null
    }

    if (host === DISCORD_HOST) {
        return segments.length === 2 && segments[0] === 'invite'
            ? discordDeeplink(segments[1])
            : null
    }

    if (host === DISCORD_INVITE_HOST) {
        return segments.length === 1 ? discordDeeplink(segments[0]) : null
    }

    return null
}
