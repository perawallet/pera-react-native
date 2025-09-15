import React from 'react';
import { render, screen } from '@testing-library/react-native';
import App from '../App';

test('renders correctly', async () => {
  render(<App />);
  expect(screen.getAllByText('Porfolio')).toBeOnTheScreen();
});
