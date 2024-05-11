const stringSimilarity = require('string-similarity');
const { addonBuilder } = require("stremio-addon-sdk")
const request = require('sync-request');
const la7 = require('./scraper/la7');
const rai = require('./scraper/rai');
const lira = require('./scraper/lira');
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
    "version": "0.3.1",
    "logo": "https://i.imgur.com/UFmjxIQ.png",
    "background": "https://i.imgur.com/zoEMlhv.png",

    "catalogs": [
        {
            "id": "itatv_tg", "type": "series", "name": "ITA TG Edizioni",
            "extra": [
                { "name": "search", "isRequired": false },
                { "name": "skip", "isRequired": false }
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
manifest.catalogs.push(...rai.catalogs);
manifest.catalogs.push(...la7.catalogs);
manifest.catalogs.push(...lira.catalogs);

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
        if (!str2) {
            return false;
        }
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
            metas: items.filter(meta => {
            const search = extra.search ? extra.search.toLowerCase() : "";
            const name = meta.name ? meta.name.toLowerCase() : "";
            const description = meta.description ? meta.description.toLowerCase() : "";
            return isSimilarTitle(name, search, 0.5) || isSimilarDesc(description, search, 0.8);
            })
        }))
    }

    const skip = extra.skip || 0;
    return results.then(items => ({
        metas: items.slice(skip, skip + 100)
    }))
 })

cache = new MetaDictionary(process.env.VERBOSE)

async function startAddon() {
    no_search = process.env.NOSEARCH===undefined ? false : (process.env.NOSEARCH === 'true');
    console.log(typeof(no_search), typeof(!no_search))
    if(!no_search){
        fullsearch = process.env.FULLSEARCH===undefined ? false : (process.env.FULLSEARCH === 'true');
        while (true) {
            // remove videos   db.videos.deleteMany({ "key": /^itatv_la7/ });
            // remove visited  db.visited.deleteMany({ "key": /^https:\/\/www.la7/ });
            await la7.scrape(cache, fullsearch)
            await rai.scrape(cache, fullsearch)
            await lira.scrape(cache, fullsearch)
            if(fullsearch) break
        }
    }
}
startAddon();

module.exports = builder.getInterface()
