import { useState } from 'react'
import {
  useAllAccounts,
  getAccountDisplayName,
  WalletAccount,
  useUpdateAccount,
  useCreateAccount,
} from '@perawallet/wallet-core-accounts'
import { useLanguage } from '@hooks/useLanguage'
import { useToast } from '@hooks/useToast'
import { usePreferences } from '@perawallet/wallet-core-settings'
import { UserPreferences } from '@constants/user-preferences'
import { useRoute, RouteProp } from '@react-navigation/native'
import { OnboardingStackParamList } from '../../routes'
import { useAppNavigation } from '@hooks/useAppNavigation'


type NameAccountScreenRouteProp = RouteProp<OnboardingStackParamList, 'NameAccount'>

export const useNameAccountScreen = () => {
  const navigation = useAppNavigation()
  const route = useRoute<NameAccountScreenRouteProp>()

  const accounts = useAllAccounts()
  const updateAccount = useUpdateAccount()
  const createAccount = useCreateAccount()
  const { t } = useLanguage()
  const { showToast } = useToast()
  const { deletePreference } = usePreferences()

  const routeAccount = route.params?.account

  const [account] = useState<WalletAccount | undefined>(routeAccount)
  const numWallets = accounts.length

  const initialWalletName = account
    ? getAccountDisplayName(account)
    : t('onboarding.name_account.wallet_label', { count: numWallets + 1 })

  const [walletDisplay, setWalletDisplay] = useState<string>(initialWalletName)
  const [isCreating, setIsCreating] = useState(false)

  const handleNameChange = (value: string) => {
    setWalletDisplay(value)
  }

  const handleFinish = async () => {
    if (isCreating) return

    try {
      setIsCreating(true)

      let targetAccount: WalletAccount

      if (account) {
        targetAccount = account
      } else {
        targetAccount = await createAccount({ account: 0, keyIndex: 0 })
      }

      targetAccount.name = walletDisplay
      updateAccount(targetAccount)

      deletePreference(UserPreferences.isCreatingAccount)
      navigation.replace('TabBar', {
        screen: 'Home',
        params: {
          screen: 'AccountDetails',
          params: { playConfetti: true },
        },
      })

    } catch (error) {
      showToast({
        title: t('onboarding.create_account.error_title'),
        body: t('onboarding.create_account.error_message', {
          error: `${error}`,
        }),
        type: 'error',
      })
    } finally {
      setIsCreating(false)
    }
  }

  return {
    walletDisplay,
    isCreating,
    handleNameChange,
    handleFinish,
    numWallets
  }
}
