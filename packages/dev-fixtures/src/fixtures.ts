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

/**
 * Fake-but-typed domain objects used by the dev Screen Gallery to render
 * param-dependent screens in a reviewable state. Values are intentionally
 * fake — only shaped well enough for a screen to render. This lives in the
 * logic layer (packages) so the UI/screen layer carries no mock-data code.
 */

import type {
    Algo25Account,
    HDWalletAccount,
    WalletAccount,
    WatchAccount,
} from '@perawallet/wallet-core-accounts'
import type { Contact } from '@perawallet/wallet-core-contacts'
import type { ASAInbox } from '@perawallet/wallet-core-messages'
import type {
    ArbitraryDataSignRequest,
    PeraArbitraryDataMessage,
} from '@perawallet/wallet-core-signing'

// --- primitives ---

export const MOCK_ADDRESS =
    'RP35URKAEVP6PA3WIJGDGA3FZKNV76E7Y2QZPEJ4TDLV72T326B3IOFX7A'
export const MOCK_ADDRESS_2 =
    'T2A7FPKQ3YON2JT5A5CSN4JWNDMUGJY6WX4H6HEH2UPKWSPSPBG5O7X4UM'
export const MOCK_ASSET_ID = '10458941'
export const MOCK_GROUP_ID = 'mockGroupId000000000000000000000000000000000'
export const MOCK_TX_ID =
    'MOCKTXID0000000000000000000000000000000000000000000000'

// --- accounts ---

export const mockAlgo25Account: Algo25Account = {
    id: 'mock-algo25',
    type: 'algo25',
    address: MOCK_ADDRESS,
    keyPairId: 'mock-keypair-algo25',
    name: 'Mock Algo25 account',
}

export const mockHdAccount: HDWalletAccount = {
    id: 'mock-hd',
    type: 'hdWallet',
    address: MOCK_ADDRESS_2,
    keyPairId: 'mock-keypair-hd',
    name: 'Mock HD account',
    hdWalletDetails: {
        account: 0,
        change: 0,
        keyIndex: 0,
        derivationType: 9,
    },
}

export const mockWatchAccount: WatchAccount = {
    id: 'mock-watch',
    type: 'watch',
    address: MOCK_ADDRESS,
    name: 'Mock watch account',
}

export const mockAccounts: WalletAccount[] = [mockAlgo25Account, mockHdAccount]

// --- contacts (20 items, store-seedable) ---

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const CONTACT_BODY = 'MOCKDEVCONTACTADDRESSFORGALLERYREVIEWONLYDONOTSEND'

// Synthetic but distinct, plausibly-formatted 58-char base32 addresses. The
// contact UI only truncates/formats the address (never decodes it), so these
// render correctly without needing real checksums.
const mockContactAddress = (index: number): string =>
    (B32[index % 32] + B32[(index * 5 + 3) % 32] + CONTACT_BODY)
        .padEnd(58, 'A')
        .slice(0, 58)

// Edge-case names to stress the row layout: empty/min, very long, no-space
// overflow, emoji, CJK, RTL, accents, symbols, numbers, multiline, padded
// whitespace, and long/short NFDs.
const MOCK_CONTACT_SPECS: Array<{ name: string; nfd?: string }> = [
    { name: '' },
    { name: 'A' },
    {
        name: 'Maximilian Alexander Christopherson III, Keeper Of The Exceedingly Long Contact Name',
    },
    { name: 'THISISAVERYLONGUPPERCASESINGLEWORDCONTACTNAMEWITHNOSPACESATALL' },
    { name: '🚀🌙 Moon Wallet 💎🙌🔥' },
    { name: 'José Ñoño Müller-Štrauß' },
    { name: '测试钱包联系人名称' },
    { name: 'محفظة الاختبار طويلة' },
    { name: 'Acct #1 — (main) / savings & more! 100%' },
    { name: '1234567890 0987654321' },
    { name: '   leading & trailing spaces   ' },
    { name: 'Line one\nLine two\nLine three' },
    {
        name: 'NFD Whale',
        nfd: 'an-extremely-long-nfd-domain-name-for-testing.algo',
    },
    { name: 'Alice', nfd: 'alice.algo' },
    { name: 'Bob 🤝' },
    { name: 'Charlie' },
    { name: 'Dana' },
    { name: 'Evan' },
    { name: 'Fiona' },
    { name: 'Grace' },
]

export const mockContacts: Contact[] = MOCK_CONTACT_SPECS.map(
    (spec, index) => ({
        name: spec.name,
        address: mockContactAddress(index),
        ...(spec.nfd ? { nfd: spec.nfd } : {}),
    }),
)

// --- onboarding / import ---

export const MOCK_IMPORT_RESULT = {
    importedCount: 3,
    skippedDuplicateCount: 1,
    failedCount: 0,
}

// --- multisig invitation (Messages → MultisigInvitationName) ---

export const MOCK_MULTISIG_INVITATION = {
    customId: 'mock-invitation',
    createdAt: new Date().toISOString(),
    address: MOCK_ADDRESS,
    version: 1,
    threshold: 2,
    participantAddresses: [MOCK_ADDRESS, MOCK_ADDRESS_2],
}

// --- inbox (Messages → AssetTransferRequests) ---

export const mockAsaInbox: ASAInbox = {
    address: MOCK_ADDRESS,
    inboxAddress: MOCK_ADDRESS_2,
    requestCount: 2,
}

// --- notifications (raw API response shape, served via dev MSW) ---

export type MockNotification = {
    id: string
    account_address: string
    message: string
    url: string
    creation_datetime: string
    is_unread?: boolean
    icon?: { logo: string; shape: 'circle' | 'rectangle' } | null
}

export type MockNotificationsResponse = {
    results: MockNotification[]
    next: string | null
    previous: string | null
}

// Edge-case messages to stress the notification row layout.
const NOTIFICATION_MESSAGES: string[] = [
    '',
    'Sent',
    'You received 1,000,000.123456 ALGO from an exceptionally long sender label that should truncate or wrap gracefully inside the notification row without breaking the layout',
    '🎉 Your transaction was confirmed 🚀💰🙌',
    'تم استلام الأصول بنجاح في محفظتك',
    '测试通知消息内容显示是否正常',
    'José sent you USDC — café fund ☕ (München)',
    'Line one\nLine two\nLine three of a multiline notification',
    'Reward of 0.000001 ALGO credited',
    'A short one',
    'Opt-in request for ASA #31566704 (USDC) is awaiting your approval right now',
    'NoSpacesVeryLongSingleTokenMessageeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    'Price alert: ALGO is up 12.5% today 📈',
    'Your gift card purchase is complete 🎁',
    'Security: a new device signed in',
    'Staking rewards are ready to claim',
    'Welcome to Pera Wallet!',
    'Your watch account was updated',
    '⚠️ Suspicious transaction blocked',
    'Final notification in the list',
]

export const mockNotificationsResponse: MockNotificationsResponse = {
    results: NOTIFICATION_MESSAGES.map((message, index) => ({
        id: `mock-notification-${index}`,
        account_address: index % 2 === 0 ? MOCK_ADDRESS : MOCK_ADDRESS_2,
        message,
        url: 'https://perawallet.app',
        creation_datetime: new Date(
            Date.now() - index * 3_600_000,
        ).toISOString(),
        is_unread: index % 3 !== 0,
        icon:
            index % 4 === 0
                ? null
                : {
                      logo: 'https://perawallet.app/favicon.png',
                      shape: index % 2 === 0 ? 'circle' : 'rectangle',
                  },
    })),
    next: null,
    previous: null,
}

// --- signing: arbitrary data (plain-object request, safely mockable) ---

export const mockArbitraryDataMessage: PeraArbitraryDataMessage = {
    signer: MOCK_ADDRESS,
    // base64("Sign this message to review the arbitrary-data screen")
    data: 'U2lnbiB0aGlzIG1lc3NhZ2UgdG8gcmV2aWV3',
    message: 'Sign this message to review the arbitrary-data screen',
    chainId: 416001,
}

export const mockArbitraryDataSignRequest: ArbitraryDataSignRequest = {
    id: 'mock-arbitrary-sign-request',
    type: 'arbitrary-data',
    transport: 'algod',
    data: [mockArbitraryDataMessage],
}
