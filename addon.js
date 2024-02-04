const scraper = require('./scraper');
const MongoDictionary = require('./mongodictionary');
const stringSimilarity = require('string-similarity');

const { addonBuilder } = require("stremio-addon-sdk")
const request = require('sync-request');

function getPublicIpSync() {
  try {
    const response = request('GET', 'https://httpbin.org/ip');
    const publicIp = JSON.parse(response.getBody('utf-8')).origin;

    return publicIp;
  } catch (error) {
    throw new Error('Error fetching public IP: ' + error.message);
  }
}

var manifest = {
    "id": "it.itatv",
    "version": "0.1.0",
    "logo": "https://i.imgur.com/UFmjxIQ.png",
    "background": "https://i.imgur.com/zoEMlhv.png",

    "catalogs": [
        {
            "id": "seriesCatalog", "type": "series", "name": "Ita TV 007",
            "extra": [
                { "name": "search", "isRequired": false }
            ]
        }
    ],
    "resources": [
		"catalog",
		{
			"name": "meta",
			"types": ["series"],
			"idPrefixes": ["itatv_"]
		},
		"stream"
	],
    "types": [
        "series"
    ],
    "name": "Ita TV",
    "description": `Selected Italian TV streams (${getPublicIpSync()})`
}

cache = new MongoDictionary('cache', process.env.VERBOSE)

const builder = new addonBuilder(manifest)

builder.defineStreamHandler(({type, id}) => {
 
    switch(type) {
        case 'series':
            if(id.startsWith("itatv_")){
                results = cache.getStream(id.split(':')[0], id)
            }else{
                results = Promise.resolve( [] )
            }
            break
        default:
            results = Promise.resolve( [] )
            break
    }
    return results.then(streams => ({streams}))
})

builder.defineMetaHandler(({type, id}) => {

    let results;
	switch(type) {
        case 'series':
            results = cache.getMeta(id)
            break
        default:
            results = null
            break
    }
    return results.then(meta => ({meta}))
})

function isSimilar(str1, str2, threshold) {
    const similarity = stringSimilarity.compareTwoStrings(str1, str2);
    return similarity >= threshold;
}

builder.defineCatalogHandler(({type, id, extra}) => {
    let results;

    switch(type) {
        case "series":
            results = cache.getCatalog()
            break
        default:
            results = Promise.resolve( [] )
            break
    }
    if(extra.search) {
        return results.then(items => ({
            metas: items.filter(meta => isSimilar(meta.name.toLowerCase(), extra.search.toLowerCase(), 0.5))
        }))
    }

    const skip = extra.skip || 0;
    return results.then(items => ({
        metas: items.slice(skip, skip + 100)
    }))
 })

async function startAddon() {
    await cache.connect()
    while (true) {
      try {
        await scraper.scrape_la7(cache);
      } catch (error) {
        console.error('An error occurred while scraping:', error);
      }
    }
}

startAddon();
module.exports = builder.getInterface()
