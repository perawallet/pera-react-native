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

import { makeStyles } from '@rneui/themed'

// PWSheetLayout owns the horizontal padding + bottom safe-area inset, so this
// only styles the rows and the KYC-status text colours.
export const useStyles = makeStyles(theme => ({
    rows: {
        gap: theme.spacing.md,
    },
    value: {
        color: theme.colors.textMain,
    },
    kycVerified: {
        color: theme.colors.positive,
    },
    kycPending: {
        color: theme.colors.warningText,
    },
    kycRejected: {
        color: theme.colors.negative,
    },
    kycUnverified: {
        color: theme.colors.textGray,
    },
}))
