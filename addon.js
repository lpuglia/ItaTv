const fs = require('fs');
const scraper = require('./scraper'); // Importing the module
const stringSimilarity = require('string-similarity');

const { addonBuilder } = require("stremio-addon-sdk")

var manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

catalog_cache = {} 
meta_cache = {}
stream_cache = {}
visited_urls = new Set

// Populate the catalog from somewhere
function getSeriesCatalog(catalogName) {
    let catalog;

    switch(catalogName) {
        case "seriesCatalog":
            catalog = Object.values(catalog_cache) // convert dict to a list of its values
            break
        default:
            catalog = []
            break
    }

    return Promise.resolve(catalog)
}

const builder = new addonBuilder(manifest)

builder.defineStreamHandler(({type, id}) => {
 
    switch(type) {
        case 'series':
            if(id.startsWith("itatv_")){
                results = Promise.resolve( stream_cache[id] )
            }else{
                results = Promise.resolve( [] )
            }
            break
        default:
            results = Promise.resolve( [] )
            break
    }
    // console.log(results)
    return results.then(streams => ({streams}))
})

builder.defineMetaHandler(({type, id}) => {

    let results;
	switch(type) {
        case 'series':
            results = Promise.resolve( meta_cache[id] )
            break
        default:
            results = null
            break
    }
    // console.log(results)
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
            results = getSeriesCatalog(id)
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

module.exports = builder.getInterface()
async function startScraping() {
    while (true) {
      try {
        await scraper.scrape_la7(catalog_cache, meta_cache, stream_cache, visited_urls);
        // Add any additional logic or delay if needed
      } catch (error) {
        console.error('An error occurred while scraping:', error);
        // Handle the error as needed
        // throw error
      }
    }
}

startScraping();