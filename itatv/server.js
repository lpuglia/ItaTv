#!/usr/bin/env node

const { serveHTTP, publishToCentral } = require("stremio-addon-sdk")
const addonInterface = require("./addon")
serveHTTP(addonInterface, { port: 80 })

// when you've deployed your addon, un-comment this line
// publishToCentral("https://prova-sr3g.onrender.com/manifest.json")
// for more information on deploying, see: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/deploying/README.md
