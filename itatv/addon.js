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
            break
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

function getMovieStreams(id) {
    const streams = {
        tt1254207: [
            { "title": "HTTP location", "yt_ID": "aqz-KE-bpKQ"}
        ],
        itatv_jellyfish: [
            { "title": "Web, 3 MBps, HD", "url": "https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8" },
            { "title": "Web 15 MBps, HD", "url": "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd" },
            { "title": "Web, 120 MBps, 4K", "url": "https://vodpkg.iltrovatore.it/local/dash//,/content/entry/data/0/596/0_vmgx8vey_0_3as0bobl_1,/content/entry/data/0/596/0_vmgx8vey_0_0t0j8m98_1,.mp4.urlset/manifest.mpd" }
        ]
    }
    return Promise.resolve(streams[id] || [])
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