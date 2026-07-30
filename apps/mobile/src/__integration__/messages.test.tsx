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

import {
    afterAll,
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest'
import { cleanup, screen, waitFor } from '@testing-library/react'

import { server } from '@test-utils/msw-server'
import { renderWithNavigation } from '@test-utils/renderWithNavigation'
import { resetTestKeystore } from '@test-utils/algorand-keystore-test'
import {
    AccountTypes,
    useAccountsStore,
    type WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useDeviceStore } from '@perawallet/wallet-core-device'
import {
    mockInbox,
    mockMessageStatus,
    mockNotificationList,
} from '@perawallet/wallet-core-messages/test-handlers'
import { InboxScreen } from '@modules/messages/screens/InboxScreen/InboxScreen'
import { NotificationsScreen } from '@modules/messages/screens/NotificationsScreen/NotificationsScreen'

import { ALGO25_TEST_ADDRESS, HD_TEST_ADDRESS } from './__fixtures__/onboarding'

const DEVICE_ID = 'test-device-id'

// The inbox query is enabled only when the wallet holds at least one signing
// account (its addresses scope the request) and a device id is registered.
const SIGNER: WalletAccount = {
    id: 'signer-1',
    type: AccountTypes.algo25,
    address: ALGO25_TEST_ADDRESS,
    keyPairId: 'signer-key',
    name: 'Trading',
}

const EMPTY_INBOX = {
    joint_account_import_requests: [],
    joint_account_sign_requests: [],
    asa_inboxes: [],
}

// NotificationsScreen renders the unread badge through useInboxStatus, which
// polls message-status and the inbox list whatever the scenario under test.
// Unmocked they escape to the real backend, 403 through Cloudflare, and
// error-log after this file has finished — racing vitest's worker teardown
// ("Closing rpc while onUserConsoleLog was pending") and failing an otherwise
// all-green run. A successful message-status also keeps useInboxStatus off its
// legacy notification-status fallback, which escapes the same way.
//
// All flags false is the badge state these tests already saw (the failed query
// fell back to false), so nothing new fires — notably not the mark-as-read
// mutation NotificationsScreen sends on unmount when notifications are unread.
const UNREAD_BADGE_HANDLERS = [
    mockMessageStatus({
        deviceID: DEVICE_ID,
        response: {
            hasUnreadItems: false,
            hasUnreadNotifications: false,
            hasUnreadInboxItems: false,
            unreadInboxCount: 0,
        },
    }),
    mockInbox({ deviceID: DEVICE_ID, response: EMPTY_INBOX }),
]

const SLOW_TEST_TIMEOUT_MS = 30_000

describe('Flow: Messages — inbox & notifications lists', () => {
    beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
    // Unmount before dropping the handlers: vitest runs describe-level
    // afterEach hooks before the file-level RTL auto-cleanup, so resetting
    // first leaves the inbox/notification polls running against an empty MSW
    // registry. The resulting unhandled-request warning lands during worker
    // teardown as `EnvironmentTeardownError: Closing rpc while
    // "onUserConsoleLog" was pending`, failing the run with every test passing.
    afterEach(() => {
        cleanup()
        server.resetHandlers()
    })
    afterAll(() => server.close())

    beforeEach(() => {
        resetTestKeystore()
        useAccountsStore.getState().setAccounts([SIGNER])
        useAccountsStore.getState().setSelectedAccountAddress(SIGNER.address)
        useDeviceStore.getState().resetState()
        useDeviceStore.getState().setDeviceID('mainnet', DEVICE_ID)
        useDeviceStore.getState().setDeviceID('testnet', DEVICE_ID)
    })

    it(
        'Given the inbox endpoint returns one ASA request, when InboxScreen mounts, then the ASA request row renders',
        async () => {
            server.use(
                mockInbox({
                    deviceID: DEVICE_ID,
                    response: {
                        ...EMPTY_INBOX,
                        asa_inboxes: [
                            {
                                address: HD_TEST_ADDRESS,
                                inbox_address: null,
                                request_count: 3,
                            },
                        ],
                    },
                }),
            )

            renderWithNavigation(InboxScreen, 'Inbox')

            // AsaInboxItem titles the row with `messages.inbox.asa_requests`;
            // i18n falls back to the raw key under the integration setup.
            await waitFor(() => {
                expect(
                    screen.getAllByText((_, node) =>
                        (node?.textContent ?? '').includes(
                            'messages.inbox.asa_requests',
                        ),
                    ).length,
                ).toBeGreaterThan(0)
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the inbox endpoint returns no requests, when InboxScreen mounts, then the empty state renders',
        async () => {
            server.use(
                mockInbox({ deviceID: DEVICE_ID, response: EMPTY_INBOX }),
            )

            renderWithNavigation(InboxScreen, 'Inbox')

            await waitFor(() => {
                expect(
                    screen.getAllByText((_, node) =>
                        (node?.textContent ?? '').includes(
                            'messages.inbox.empty_title',
                        ),
                    ).length,
                ).toBeGreaterThan(0)
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the notifications endpoint returns two notifications, when NotificationsScreen mounts, then both messages render',
        async () => {
            server.use(
                ...UNREAD_BADGE_HANDLERS,
                mockNotificationList({
                    deviceID: DEVICE_ID,
                    response: {
                        next: null,
                        previous: null,
                        results: [
                            {
                                id: '101',
                                type: 'transaction',
                                account_address: ALGO25_TEST_ADDRESS,
                                message: 'You received 5 ALGO',
                                url: null,
                                creation_datetime: '2024-01-02T00:00:00Z',
                                is_unread: true,
                                icon: null,
                            },
                            {
                                id: '100',
                                type: 'transaction',
                                account_address: ALGO25_TEST_ADDRESS,
                                message: 'You sent 2 ALGO',
                                url: null,
                                creation_datetime: '2024-01-01T00:00:00Z',
                                is_unread: false,
                                icon: null,
                            },
                        ],
                    },
                }),
            )

            renderWithNavigation(NotificationsScreen, 'Notifications')

            // NotificationItem renders `item.message` directly as text.
            await waitFor(() => {
                expect(screen.getByText('You received 5 ALGO')).toBeTruthy()
            })
            expect(screen.getByText('You sent 2 ALGO')).toBeTruthy()
        },
        SLOW_TEST_TIMEOUT_MS,
    )

    it(
        'Given the notifications endpoint returns nothing, when NotificationsScreen mounts, then the empty state renders',
        async () => {
            server.use(
                ...UNREAD_BADGE_HANDLERS,
                mockNotificationList({
                    deviceID: DEVICE_ID,
                    response: { next: null, previous: null, results: [] },
                }),
            )

            renderWithNavigation(NotificationsScreen, 'Notifications')

            await waitFor(() => {
                expect(
                    screen.getAllByText((_, node) =>
                        (node?.textContent ?? '').includes(
                            'notifications.empty_title',
                        ),
                    ).length,
                ).toBeGreaterThan(0)
            })
        },
        SLOW_TEST_TIMEOUT_MS,
    )
})
