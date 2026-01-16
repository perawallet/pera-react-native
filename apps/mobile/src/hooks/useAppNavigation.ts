import { useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { RootStackParamList } from '@routes/types'

export type AppNavigationProp = NativeStackNavigationProp<RootStackParamList>

export const useAppNavigation = () => {
  const navigation = useNavigation<AppNavigationProp>()

  return {
    navigate: <RouteName extends keyof RootStackParamList>(
      ...args: undefined extends RootStackParamList[RouteName]
        ? [RouteName] | [RouteName, RootStackParamList[RouteName]]
        : [RouteName, RootStackParamList[RouteName]]
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigation.navigate as any)(...args)
    },
    push: <RouteName extends keyof RootStackParamList>(
      ...args: undefined extends RootStackParamList[RouteName]
        ? [RouteName] | [RouteName, RootStackParamList[RouteName]]
        : [RouteName, RootStackParamList[RouteName]]
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigation.push as any)(...args)
    },
    replace: <RouteName extends keyof RootStackParamList>(
      ...args: undefined extends RootStackParamList[RouteName]
        ? [RouteName] | [RouteName, RootStackParamList[RouteName]]
        : [RouteName, RootStackParamList[RouteName]]
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (navigation.replace as any)(...args)
    },
    goBack: () => navigation.goBack(),
    setOptions: navigation.setOptions,
    addListener: navigation.addListener,
    canGoBack: navigation.canGoBack,
    getParent: navigation.getParent,
    getState: navigation.getState,
    dispatch: navigation.dispatch,
    isFocused: navigation.isFocused,
    reset: navigation.reset,
  }
}
