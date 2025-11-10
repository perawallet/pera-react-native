import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import useToast from './toast';

type LinkSource = 'qr' | 'deeplink';

export const useDeepLink = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const { showToast } = useToast();

  const isValidDeepLink = (_: string, __: LinkSource) => {
    //TODO implement fully
    return true;
  };

  const handleDeepLink = async (
    url: string,
    replaceCurrentScreen: boolean = false,
    source: LinkSource,
    onError?: () => void,
    onSuccess?: () => void,
  ) => {
    if (isValidDeepLink(url, source)) {
      //TODO implement fully
      const destination = 'TabBar';
      const params = {
        screen: 'Home',
      };

      if (replaceCurrentScreen) {
        navigation.replace(destination, params);
      } else {
        navigation.navigate(destination, params);
      }

      showToast({
        title: 'Not Implemented Yet',
        body: "Deeplinking hasn't been implemented fully yet",
        type: 'info',
      });
      onSuccess?.();
    } else {
      showToast({
        title: 'Invalid Link',
        body: 'The detected link does not appear to be valid',
        type: 'error',
      });
      onError?.();
    }
  };

  return {
    isValidDeepLink,
    handleDeepLink,
  };
};
