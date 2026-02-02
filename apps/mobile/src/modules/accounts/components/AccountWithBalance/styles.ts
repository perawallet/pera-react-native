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

type StyleProps = {
    isHighlighted?: boolean
}

export const useStyles = makeStyles((theme, { isHighlighted }: StyleProps) => {
    return {
        container: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing.sm,
            width: '100%',
            backgroundColor: theme.colors.layerGrayLightest,
            borderWidth: 1,
            borderColor: isHighlighted
                ? theme.colors.buttonSquareText
                : theme.colors.layerGray,
            borderRadius: theme.spacing.lg,
            padding: theme.spacing.md,
        },
        balanceContainer: {
            gap: theme.spacing.xs,
            alignItems: 'flex-end',
        },
        algoBalance: {},
        fiatBalance: {
            color: theme.colors.textGray,
        },
    }
})
