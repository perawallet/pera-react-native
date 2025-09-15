import PeraButton from '../../components/button/PeraButton';
import { ParamListBase, useNavigation } from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import { useStyles } from './styles';
import { Text } from '@rneui/themed';
import PeraView from '../../components/view/PeraView';
import MainScreenLayout from '../../layouts/MainScreenLayout';

const OnboardingScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<ParamListBase>>();
  const styles = useStyles()
  
  const showAlert = () => {
    navigation.replace('Home')
  };

  return (
    <MainScreenLayout>
      <PeraView>
        <Text h1>Onboarding!</Text>
        <PeraButton variant="primary" title="create account" onPress={showAlert} />
        <PeraButton variant="secondary" title="import account" onPress={showAlert} />
      </PeraView>
    </MainScreenLayout>
  );
};

export default OnboardingScreen;
