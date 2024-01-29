#!/usr/bin/env node

const { serveHTTP, publishToCentral } = require("stremio-addon-sdk")
const addonInterface = require("./addon")
serveHTTP(addonInterface, { port: process.env.PORT || 80 })

publishToCentral("https://6ef53e8aac88-itatv.baby-beamup.club/manifest.json")
