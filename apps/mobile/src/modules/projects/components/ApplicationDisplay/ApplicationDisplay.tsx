import { PWText, PWView } from '@components/core'
import { useApplicationQuery } from '@perawallet/wallet-core-projects'
import { useStyles } from './styles'
import { useLanguage } from '@hooks/useLanguage'
import { ProjectVerificationIcon } from '../ProjectVerificationIcon'
import { LoadingView } from '@components/LoadingView'

type ApplicationDisplayProps = {
    applicationId: string
    valueOnlyOnFallback?: boolean
}

export const ApplicationDisplay = ({
    applicationId,
    valueOnlyOnFallback = false,
}: ApplicationDisplayProps) => {
    const styles = useStyles()
    const { t } = useLanguage()
    const { data: application, isLoading } = useApplicationQuery({
        applicationId: applicationId,
        isEnabled: !!applicationId,
    })

    return (
        <LoadingView
            variant='skeleton'
            isLoading={isLoading}
        >
            {application ? (
                <PWView style={styles.container}>
                    <PWView style={styles.row}>
                        <PWText variant='h4'>{application.name}</PWText>
                        {!!application?.project?.verificationTier && (
                            <ProjectVerificationIcon
                                tier={application.project.verificationTier}
                                size='sm'
                            />
                        )}
                    </PWView>
                    <PWText
                        variant='caption'
                        style={styles.caption}
                    >
                        {t('transactions.summary.app_id', {
                            id: applicationId,
                        })}
                    </PWText>
                </PWView>
            ) : (
                <PWText variant='h4'>
                    {valueOnlyOnFallback
                        ? applicationId
                        : t('transactions.summary.app_id', {
                              id: applicationId,
                          })}
                </PWText>
            )}
        </LoadingView>
    )
}
