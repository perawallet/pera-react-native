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

// Only the verified-requester row lives here; everything shared with
// ConnectionApprovalView comes from its stylesheet so the two cannot drift.
// Mobile pairs by QR or deeplink, so it has no requesting tab to attribute.
import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    // Column, not row: normally the badge alone sits centred under the dApp
    // url, and in the mismatch case the origin line stacks above it. Centring
    // is what makes the badge read as qualifying the url directly above.
    verifiedRow: {
        flexDirection: 'column',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    // `textMain`, NOT `verifiedBannerContent`: at `caption` (11px) that colour
    // only clears 3.82:1 against the light background, below WCAG AA's 4.5:1.
    // It stays reserved for the badge below.
    requesterOrigin: {
        color: theme.colors.textMain,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xs,
    },
    verifiedBadgeText: {
        color: theme.colors.verifiedBannerContent,
    },
    // No mobile counterpart: this window has lost the service worker's pending
    // entry and can only tell the user to start the request again from the site.
    deliveryError: {
        color: theme.colors.negative,
        textAlign: 'center',
        paddingHorizontal: theme.spacing.xl,
        paddingBottom: theme.spacing.md,
    },
}))
