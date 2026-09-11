const fs = require('fs');
const path = require('path');

const appJson = require('./app.json');

const googleServicesPath = path.join(__dirname, 'google-services.json');
const expo = {
  ...appJson.expo,
  updates: {
    url: 'https://u.expo.dev/9c573ec4-4c8a-49eb-a723-f629296b4565',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
};

if (fs.existsSync(googleServicesPath)) {
  expo.android = {
    ...expo.android,
    googleServicesFile: './google-services.json',
  };
}

module.exports = { expo };
