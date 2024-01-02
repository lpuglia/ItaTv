const { addonBuilder } = require("stremio-addon-sdk")

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/responses/manifest.md
const manifest = {
    "id": "community.helloworld",
    "version": "0.0.1",
    "catalogs": [
        {
            "type": "movie",
            "id": "top"
        }
    ],
    "resources": [
		"catalog",
		{
			"name": "meta",
			"types": ["movie"],
			"idPrefixes": ["hiwrld_"]
		},
		"stream"
	],
    "types": [
        "movie",
        "series"
    ],
    "name": "he",
    "description": "f"
}

// Populate the catalog from somewhere
function getMoviesCatalog(catalogName) {
    let catalog;

    switch(catalogName) {
        case "top":
            catalog = [
                { "type": "movie", "id": "tt0032138", "name": "The Wizard of Oz", "poster": "https://images.metahub.space/poster/medium/tt0032138/img", "genres": ["Adventure", "Family", "Fantasy", "Musical"] },
                { "type": "movie", "id": "tt0017136", "name": "Metropolis", "poster": "https://images.metahub.space/poster/medium/tt0017136/img", "genres": ["Drama", "Sci-Fi"] },
                {
                    id: "tt1254207",
                    type: "movie",
                    name: "The Big Buck Bunny",
                    poster: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Big_buck_bunny_poster_big.jpg/220px-Big_buck_bunny_poster_big.jpg",
                    genres: [ "Animation", "Short", "Comedy" ]
                },
				{
					id: "hiwrld_jellyfish",
					type: "movie",
					name: "Jellyfish",
					poster: "https://images.unsplash.com/photo-1496108493338-3b30de66f9be",
					genres: ["Demo", "Nature"]
				}
            ]
            break
        default:
            catalog = []
            break
    }

    return Promise.resolve(catalog)
}


function getMovieMeta(id) {
    const metas = {
        hiwrld_jellyfish: {
            id: "hiwrld_jellyfish",
            type: "movie",
            name: "Jellyfish",
            poster: "https://images.unsplash.com/photo-1496108493338-3b30de66f9be",
            genres: ["Demo", "Nature"],
            description: "A .mkv video clip useful for testing the network streaming and playback performance of media streamers & HTPCs.",
            cast: ["Some random jellyfishes"],
            director: ["ScottAllyn"],
            logo: "https://b.kisscc0.com/20180705/yee/kisscc0-art-forms-in-nature-jellyfish-recapitulation-theor-jellyfish-5b3dcabcb00692.802484341530776252721.png",
            background: "https://images.unsplash.com/photo-1461783470466-185038239ee3",
            runtime: "30 sec"
        },
    }
	return Promise.resolve(metas[id] || null)
}

function getMovieStreams(id) {
    const streams = {
        tt1254207: [
            { "title": "HTTP location", "yt_ID": "aqz-KE-bpKQ"}
        ],
        hiwrld_jellyfish: [
            { "title": "Web, 3 MBps, HD", "url": "https://download.samplelib.com/mp4/sample-5s.mp4" },
            { "title": "Web 15 MBps, HD", "url": "https://download.samplelib.com/mp4/sample-5s.mp4" },
            { "title": "Web, 120 MBps, 4K", "url": "https://download.samplelib.com/mp4/sample-5s.mp4" }
        ]
    }
    return Promise.resolve(streams[id] || [])
}


// http://192.168.1.100:53558/manifest.json
const builder = new addonBuilder(manifest)

builder.defineStreamHandler(({type, id}) => {
    // Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineStreamHandler.md
    let results;

    switch(type) {
        case 'movie':
            results = getMovieStreams(id)
            break
       default:
            results = Promise.resolve( [] )
            break
    }
    return results.then(streams => ({streams}))
})

builder.defineMetaHandler(({type, id}) => {
    // Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineMetaHandler.md
    let results;
	switch(type) {
        case 'movie':
            results = getMovieMeta(id)
            break
       default:
            results = null
            break
    }
    return results.then(meta => ({meta}))

})

// Docs: https://github.com/Stremio/stremio-addon-sdk/blob/master/docs/api/requests/defineCatalogHandler.md
builder.defineCatalogHandler(({type, id, extra}) => {
    let results;

    switch(type) {
        case "movie":
            results = getMoviesCatalog(id)
            break
       default:
            results = Promise.resolve( [] )
            break
    }
    if(extra.search) {
        return results.then(items => {
            metas: items.filter(meta => meta.name
            .toLowercase()
            .includes(extra.search.toLowercase()))
        })
    } else if(extra.genre) {
        return results.then(items => ({
            metas: items.filter(meta => meta.genres
            .includes(extra.genre))
        }))
    }

    const skip = extra.skip || 0;
    return results.then(items => ({
        metas: items.slice(skip, skip + 100)
    }))
 })

module.exports = builder.getInterface()