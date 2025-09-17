/**
 * @format
 */
import { install } from 'react-native-quick-crypto';
import 'reflect-metadata'
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

install();

AppRegistry.registerComponent(appName, () => App);
