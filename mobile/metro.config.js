const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
// The web and native profile screens share their API contract and pure helpers.
config.watchFolders = [path.resolve(__dirname, '../shared')];
module.exports = config;
