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

import { makeStyles } from '@rneui/themed'

export const useStyles = makeStyles(theme => ({
    container: {
        flexGrow: 1,
    },
    messageContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        gap: theme.spacing.lg,
    },
    section: {
        gap: theme.spacing.xs,
    },
    sectionLabel: {
        color: theme.colors.textGray,
    },
    dataBox: {
        backgroundColor: theme.colors.layerGrayLighter,
        borderRadius: theme.borderRadius.md,
        padding: theme.spacing.md,
    },
    untrustedLabel: {
        color: theme.colors.textGray,
    },
    untrustedMessage: {
        color: theme.colors.textGray,
    },
    accountContainer: {
        alignItems: 'center',
        gap: theme.spacing.md,
        marginTop: theme.spacing.xxl,
    },
    onBehalfOf: {
        textAlign: 'center',
    },
    detailsContainer: {
        alignItems: 'flex-start',
    },
}))
