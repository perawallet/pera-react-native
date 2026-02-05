import { TransactionWarning } from "@perawallet/wallet-core-signing"
import { useStyles } from "./styles"
import { useTheme } from "@rneui/themed"
import { useLanguage } from "@hooks/useLanguage"
import { PWDivider, PWRoundIcon, PWText, PWView } from "@components/core"
import { truncateAlgorandAddress } from "@perawallet/wallet-core-shared"
import { LONG_ADDRESS_FORMAT } from "@constants/ui"

type WarningItemProps = {
    warning: TransactionWarning
    showDivider: boolean
    isGroup: boolean
}

export const WarningItem = ({ warning, showDivider, isGroup }: WarningItemProps) => {
    const styles = useStyles()
    const { theme } = useTheme()
    const { t } = useLanguage()

    const isClose = warning.type === 'close'
    const isRekey = warning.type === 'rekey'
    const icon = isClose ? 'trash' : 'rekey'
    const messageKey = isClose
        ? isGroup
            ? 'transactions.warning.close_group_warning'
            : 'transactions.warning.close_warning'
        : isGroup
            ? 'transactions.warning.rekey_group_warning'
            : 'transactions.warning.rekey_warning'

    return (
        <>
            {showDivider && (
                <PWDivider
                    style={styles.divider}
                    color={theme.colors.layerGray}
                />
            )}
            <PWView style={styles.warningSection}>
                <PWView style={styles.warningSectionIconContainer}>
                    <PWRoundIcon
                        icon={icon}
                        size='md'
                        variant='secondary'
                    />
                    <PWView style={styles.warningMessageContainer}>
                        <PWText style={styles.warningMessage}>
                            {t(messageKey, {
                                address: truncateAlgorandAddress(
                                    warning.targetAddress,
                                    LONG_ADDRESS_FORMAT,
                                ),
                            })}
                        </PWText>
                        {isRekey && (
                            <PWText variant='h4'>
                                {t('transactions.warning.rekey_warning_bold')}
                            </PWText>
                        )}
                        <PWText
                            variant='caption'
                            style={styles.senderText}
                        >
                            {t('transactions.warning.from_account', {
                                address: truncateAlgorandAddress(
                                    warning.senderAddress,
                                    LONG_ADDRESS_FORMAT,
                                ),
                            })}
                        </PWText>
                    </PWView>
                </PWView>
            </PWView>
        </>
    )
}