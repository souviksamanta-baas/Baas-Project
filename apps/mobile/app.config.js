const fs = require('fs');
const path = require('path');

const appJson = require('./app.json');

const googleServicesPath = path.join(__dirname, 'google-services.json');
const expo = { ...appJson.expo };

if (fs.existsSync(googleServicesPath)) {
  expo.android = {
    ...expo.android,
    googleServicesFile: './google-services.json',
  };
}

module.exports = { expo };
