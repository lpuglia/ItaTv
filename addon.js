const stringSimilarity = require('string-similarity');
const { addonBuilder } = require("stremio-addon-sdk")
const request = require('sync-request');
const la7 = require('./scraper/la7');
const MetaDictionary = require('./mongodictionary');

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
manifest.catalogs.push(...la7.catalogs);

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


builder.defineCatalogHandler(({type, id, extra}) => {
    function isSimilar(str1, str2, threshold) {
        const similarity = stringSimilarity.compareTwoStrings(str1, str2);
        return similarity >= threshold;
    }
    
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

cache = new MetaDictionary(process.env.VERBOSE)
async function startAddon() {
    while (true) {
        await la7.scrape(cache)
    }
}

startAddon();
module.exports = builder.getInterface()
