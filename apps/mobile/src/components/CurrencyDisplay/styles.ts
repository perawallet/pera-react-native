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
import { CurrencyDisplayProps } from './CurrencyDisplay'

export const useStyles = makeStyles((theme, props: CurrencyDisplayProps) => {
    const variantSizes = {
        h1: theme.spacing['3xl'],
        h2: theme.spacing.xxl,
        h3: theme.spacing.xl,
        h4: theme.spacing.lg,
        body: theme.spacing.lg,
        caption: theme.spacing.md,
    }

    const size = variantSizes[props.variant ?? 'body']

    return {
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'flex-start',
            backgroundColor: 'transparent',
        },
        skeleton: {
            maxWidth: 150,
            height: size,
        },
        textContainer: {
            alignItems: props.alignRight ? 'flex-end' : 'flex-start',
        },
        algoIcon: {
            width: size,
            height: size,
        },
    }
})
