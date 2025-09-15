import { Alert, Text, View } from 'react-native';
import { styles } from './styles';
import { SafeAreaView } from 'react-native-safe-area-context';
import PeraButton from '../../components/button/PeraButton';

const PortfolioScreen = () => {
  const showAlert = () => {
    Alert.alert('Hello', 'You clicked a button!');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View>
        <Text>This will be the portfolio screen</Text>
        <PeraButton variant="primary" title="test me" onPress={showAlert} />
      </View>
    </SafeAreaView>
  );
};

export default PortfolioScreen;
