const path = require('path');

// Share infra/.env with web + backend (EXPO_PUBLIC_* vars)
require('dotenv').config({ path: path.resolve(__dirname, '../infra/.env') });

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  expo: {
    name: 'CiVX',
    slug: 'civx',
    version: '1.0.0',
    orientation: 'portrait',
    scheme: 'civx',
    userInterfaceStyle: 'light',
    plugins: [
      'expo-router',
      'expo-asset',
      ['expo-camera', {
        cameraPermission: 'Allow CiVX to take photos for civic reports.',
        barcodeScannerEnabled: true,
      }],
      ['expo-location', { locationPermission: 'Allow CiVX to attach GPS to reports and validate attendance.' }],
    ],
    android: {
      package: 'com.anonymous.civx',
    },
  },
};
