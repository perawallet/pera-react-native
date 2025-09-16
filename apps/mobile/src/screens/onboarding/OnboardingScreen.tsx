import { ParamListBase, useNavigation } from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import { useStyles } from './styles';
import { Text } from '@rneui/themed';
import PeraView from '../../components/view/PeraView';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import PanelButton from '../../components/panel-button/PanelButton';

import WelcomeImage from '../../../assets/images/welcome-background.svg'
import WalletIcon from '../../../assets/icons/wallet.svg'
import KeyIcon from '../../../assets/icons/key.svg'
import ChevronNext from '../../../assets/icons/chevron-right.svg'

const OnboardingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const styles = useStyles()
  
  const showAlert = () => {
    navigation.replace('Home')
  };

  return (
    <MainScreenLayout style={styles.layout} fullScreen>
      <PeraView>
        <PeraView style={styles.headerContainer}>
          <Text style={styles.headerTitle} h1>Welcome to {"\n"} Pera Wallet</Text>
          <WelcomeImage style={styles.headerImage}/>
        </PeraView>
        <PeraView style={styles.mainContainer}>
          <Text style={styles.buttonTitle} h4>New to Algorand?</Text>
          <PanelButton title="Create a new wallet" onPress={showAlert} leftIcon={<WalletIcon />} rightIcon={<ChevronNext />} />
          
          <Text style={styles.buttonTitle} h4>Already have an account?</Text>
          <PanelButton title="Import an account" onPress={showAlert} leftIcon={<KeyIcon />} rightIcon={<ChevronNext />} />
        </PeraView>
      </PeraView>
    </MainScreenLayout>
  );
};

export default OnboardingScreen;
