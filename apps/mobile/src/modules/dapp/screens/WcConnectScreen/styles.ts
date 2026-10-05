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

// Only the requester rows live here; everything shared with
// ConnectionApprovalView comes from its stylesheet so the two cannot drift.
// Mobile pairs by QR or deeplink, so it has no requesting tab to attribute.
import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    // The requesting tab is not the site the peer claims: a warning box,
    // shaped like the ARC-60 sign-in origin warning, in place of the url link.
    mismatchWarning: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        backgroundColor: theme.colors.negativeLighter,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
        marginTop: theme.spacing.sm,
    },
    mismatchWarningText: {
        flex: 1,
        color: theme.colors.negative,
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
