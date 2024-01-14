const fs = require('fs');
const scraper = require('./scraper'); // Importing the module
const stringSimilarity = require('string-similarity');

const { addonBuilder } = require("stremio-addon-sdk")

var manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

// Populate the catalog from somewhere
function getSeriesCatalog(catalogName) {
    let catalog;

    switch(catalogName) {
        case "seriesCatalog":
            catalog = JSON.parse(fs.readFileSync('catalog/catalog.json', 'utf8'))
            catalog = Object.values(catalog) // convert dict to a list of its values
        default:
            catalog = []
            break
    }

    return Promise.resolve(catalog)
}

function getSeriesMeta(id){
    meta = JSON.parse(fs.readFileSync('catalog/shows/'+id+'.json', 'utf8'))
    meta['videos'] = Object.values(meta['videos']) // convert dict to a list of its values
    return Promise.resolve(meta || null)
}

const builder = new addonBuilder(manifest)

builder.defineStreamHandler(({type, id}) => {

    let results;

    // this magically works because there is a streams field in the meta
    switch(type) {
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
            results = getSeriesMeta(id)
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

scraper.scrape_la7()