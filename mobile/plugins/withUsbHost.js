const { withAndroidManifest, AndroidConfig } = require('@expo/config-plugins');

module.exports = function withUsbHost(config) {
  return withAndroidManifest(config, (config) => {
    AndroidConfig.Manifest.addUsesFeature(config.modResults, {
      name: 'android.hardware.usb.host',
      required: false,
    });
    return config;
  });
};
