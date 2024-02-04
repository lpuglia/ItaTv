#!/usr/bin/env node
const axios = require('axios');

async function getPublicIP() {
  try {
    const response = await axios.get('https://httpbin.org/ip');
    const publicIP = response.data.origin;
    console.log('Your public IP address is:', publicIP);
  } catch (error) {
    console.error('Error fetching public IP:', error.message);
  }
}

getPublicIP();


const { serveHTTP, publishToCentral } = require("stremio-addon-sdk")
const addonInterface = require("./addon")
serveHTTP(addonInterface, { port: process.env.PORT || 80 })

// publishToCentral("https://6ef53e8aac88-itatv.baby-beamup.club/manifest.json")
