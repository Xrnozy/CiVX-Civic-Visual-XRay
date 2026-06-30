const path = require('path');

// Share infra/.env with web + backend (EXPO_PUBLIC_* vars)
require('dotenv').config({ path: path.resolve(__dirname, '../infra/.env') });

module.exports = require('./app.json');
