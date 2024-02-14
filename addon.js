const stringSimilarity = require('string-similarity');
const { addonBuilder } = require("stremio-addon-sdk")
const request = require('sync-request');
const la7 = require('./scraper/la7');
const rai = require('./scraper/rai');
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
    "version": "0.1.6",
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
manifest.catalogs.push(...rai.catalogs);
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


function getConsecutiveWordSets(inputString, n) {
    const words = inputString.split(' ');
    return words.length < Math.max(n,4) ? [] : Array.from({length: words.length - n + 1}, (_, i) => words.slice(i, i + n).join(' '));
}

builder.defineCatalogHandler(({type, id, extra}) => {
    function isSimilarTitle(str1, str2, threshold) {
        const similarity = stringSimilarity.compareTwoStrings(str1, str2);
        return similarity >= threshold;
    }
    function isSimilarDesc(str1, str2, threshold) {
        for(word of getConsecutiveWordSets(str1, str2.split(" ").length)){
            if(stringSimilarity.compareTwoStrings(word, str2) >= threshold){
                return true
            }
        }
        return false
    }
    
    const isIdInCatalog = (manifest, idToCheck) => manifest.catalogs.some(catalog => catalog.id === idToCheck);
    let results;

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
            metas: items.filter(meta => isSimilarTitle(meta.name.toLowerCase(), extra.search.toLowerCase(), 0.5) || isSimilarDesc(meta.description.toLowerCase(), extra.search.toLowerCase(), 0.8))
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
        fullsearch = process.env.FULLSEARCH===undefined ? false : process.env.FULLSEARCH;
        // remove videos   db.videos.deleteMany({ "key": /^itatv_la7/ });
        // remove visited  db.visited.deleteMany({ "key": /^https:\/\/www.la7/ });
        await rai.scrape(cache, fullsearch)
        await la7.scrape(cache, fullsearch)
    }
}
startAddon();

module.exports = builder.getInterface()
