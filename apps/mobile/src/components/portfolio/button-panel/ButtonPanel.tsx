import { useStyles } from './styles';
import PeraView from '../../view/PeraView';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import RoundButton from '../../round-button/RoundButton';

import SwapIcon from '../../../../assets/icons/swap.svg';
import BuyIcon from '../../../../assets/icons/buy.svg';
import StakeIcon from '../../../../assets/icons/stake.svg';
import SendIcon from '../../../../assets/icons/send.svg';
import { Alert } from 'react-native';
import { useTheme } from '@rneui/themed';

const ButtonPanel = () => {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const themeStyle = useStyles();

  const goToRootPage = (name: string) => {
    navigation.replace('Home', { screen: name });
  };

  const notImplemented = () => {
    Alert.alert('Not Implemented');
  };

  return (
    <PeraView style={themeStyle.container}>
      <RoundButton
        buttonStyle={themeStyle.blackButton}
        title="Swap"
        icon={<SwapIcon color={theme.colors.buttonHelperText} />}
        onPress={() => goToRootPage('Swap')}
      />
      <RoundButton
        title="Buy"
        icon={<BuyIcon color={theme.colors.textMain} />}
        onPress={notImplemented}
      />
      <RoundButton
        title="Stake"
        icon={<StakeIcon color={theme.colors.textMain} />}
        onPress={() => goToRootPage('Staking')}
      />
      <RoundButton
        title="Send"
        icon={<SendIcon color={theme.colors.textMain} />}
        onPress={notImplemented}
      />
    </PeraView>
  );
};

export default ButtonPanel;
