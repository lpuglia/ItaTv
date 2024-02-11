const scraper = require('./scraper');
const MetaDictionary = require('./mongodictionary');

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
    "version": "0.1.1",
    "logo": "https://i.imgur.com/UFmjxIQ.png",
    "background": "https://i.imgur.com/zoEMlhv.png",

    "catalogs": [
        {
            "id": "itatv_la7", "type": "series", "name": "La7 Programmi",
            "extra": [{ "name": "search", "isRequired": false }]
        },
        {
            "id": "itatv_la7d", "type": "series", "name": "La7D Programmi",
            "extra": [{ "name": "search", "isRequired": false }]
        },
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

cache = new MetaDictionary(process.env.VERBOSE)

const builder = new addonBuilder(manifest)

builder.defineStreamHandler(({type, id}) => {
 
    switch(type) {
        case 'series':
            if(id.startsWith("itatv_")){
                results = cache.getStream(...id.split(':'))
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
    // console.log(type, id)
    let results;
	switch(type) {
        case 'series':
            results = cache.getMeta(...id.split(':'))
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
    const isIdInCatalog = (manifest, idToCheck) => manifest.catalogs.some(catalog => catalog.id === idToCheck);
    let results;
    // console.log(type, id, extra)
    switch(type) {
        case "series":
            if(isIdInCatalog(manifest, id)){
                results = cache.getCatalog(id)
            }else{
                results = Promise.resolve( [] )
            }
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
    while (true) {
        await scraper.scrape_la7(cache, 'itatv_la7', la7d=false);
        await scraper.scrape_la7(cache, 'itatv_la7d', la7d=true);
    }
}

startAddon();
module.exports = builder.getInterface()
