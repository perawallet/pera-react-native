import { Alert } from 'react-native';
import PeraView from '../../components/view/PeraView';
import PeraButton from '../../components/button/PeraButton';
import MainScreenLayout from '../../layouts/MainScreenLayout';
import { Text } from '@rneui/themed';

const PortfolioScreen = () => {
  const showAlert = () => {
    Alert.alert('Hello', 'You clicked a button!');
  };

  return (
    <MainScreenLayout>
      <PeraView>
        <Text>This will be the portfolio screen</Text>
        <PeraButton variant="primary" title="test me" onPress={showAlert} />
      </PeraView>
    </MainScreenLayout>
  );
};

export default PortfolioScreen;
