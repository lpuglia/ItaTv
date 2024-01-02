#!/usr/bin/env node

const { serveHTTP, publishToCentral } = require("stremio-addon-sdk")
console.log('asdasdasasdasdasdasded')
const addonInterface = require("./addon")
serveHTTP(addonInterface, 80)

// when you've deployed your addon, un-comment this line
// publishToCentral("https://my-addon.awesome/manifest.json")
// for more information on deploying, see: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deploying/README.md
