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

const SPINNER_CIRCLE_SIZE = 60

export const useStyles = makeStyles(theme => ({
    contentContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    spinnerCircle: {
        width: SPINNER_CIRCLE_SIZE,
        height: SPINNER_CIRCLE_SIZE,
        borderRadius: SPINNER_CIRCLE_SIZE / 2,
        backgroundColor: theme.colors.buttonHelperBg,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    animation: {
        width: theme.spacing['3xl'],
        height: theme.spacing['3xl'],
    },
    title: {
        marginTop: theme.spacing.xl,
    },
    subtitle: {
        marginTop: theme.spacing.sm,
        color: theme.colors.textGray,
        textAlign: 'center',
    },
}))
