const cheerio = require('cheerio');
const {request_url} = require('./scrapermanager');
// const { SingleBar } = require('cli-progress');

catalogs = [
                {
                    "id": "itatv_la7", "type": "series", "name": "La7 Programmi",
                    "extra": [
                        { "name": "search", "isRequired": false },
                        { "name": "skip", "isRequired": false }
                    ]
                }
            ]

async function scrape(cache, fullsearch){
    await scrape_la7(cache, 'itatv_la7', "https://www.la7.it/programmi", fullsearch);
    await scrape_la7(cache, 'itatv_la7', "https://www.la7.it/programmi-la7d", fullsearch);
    await scrape_tgla7(cache, 'itatv_tg');
}

async function scrape_tgla7(cache, catalog_id) {
    try{
        const id_programma = 'tgla7';
        const response = await request_url("https://tg.la7.it/ultime-edizioni-del-tgla7");
        const $ = cheerio.load(response.data);

        element = $('.tgla7-news').first()
        const href = $(element).find('.news-img a').attr('href');

        episode = await get_edizione("https://tg.la7.it"+href)
        if (episode === undefined) return;

        await cache.update_catalogs(catalog_id, `${catalog_id}:${id_programma}`, {
            "id": `${catalog_id}:${id_programma}`,
            "type": "series",
            "name": "TG La7",
            "description": "Tg La7",
            "poster": "https://kdam.iltrovatore.it/p/103/sp/10300/thumbnail/entry_id/0_xo6rfmcv/type/5/width/1024/quality/100/name/0_xo6rfmcv.jpg",
            "background": "https://kdam.iltrovatore.it/p/103/sp/10300/thumbnail/entry_id/0_xo6rfmcv/type/5/width/1024/quality/100/name/0_xo6rfmcv.jpg",
            "posterShape" : "landscape"
        });

        episode.id = `${catalog_id}:${id_programma}:${episode.season}:${episode.episode}`

        await cache.deleteOldVideos(`${catalog_id}:${id_programma}`, 8)
        await cache.update_videos(`${catalog_id}:${id_programma}`, episode.id, episode);

    }catch (error){
        console.error(error.message);
        // throw error
    }
}


async function get_edizione(url) {
    try{
        const response = await request_url(url);

        const $ = cheerio.load(response.data);
        video_url = parseVideoSources(response.data.replace("m3u8:",'"m3u8":').replace("mp4:",'"mp4":').replace('.mp4",','.mp4"'))

        const thumbnail = /poster:\s*"([^"]+)"/.exec(response.data)[1];
        const releaseDate = new Date(parseInt(/date:\s*(\d+),/.exec(response.data)[1], 10));
        return {
                    "season": releaseDate.getFullYear(),
                    "episode": parseInt(url.split('=')[1]),
                    "title": $('.tgla7-news-details-wrapper h1.tgla7-title').text(),
                    "overview": $('.tgla7-descrizione').text().trim(),
                    "released" : releaseDate,
                    "thumbnail":  thumbnail,
                    "video_url": video_url
                }
    }
    catch (error){
        console.error(error.message);
        return undefined
    }

}

async function scrape_la7(cache, catalog_id, la7url, fullsearch) {
    try {
        let response = undefined
        response = await request_url(la7url);
        let $ = cheerio.load(response.data);

        const containerDiv = $('#container-programmi-list');
        const shows = [];
        containerDiv.find('div.list-item').each((index, element) => {
            const anchor = $(element).find('a')
            if (anchor.length !== 0){
                const name = anchor.attr('href').substring(1)
                poster = $(element).find('div.image-bg').attr('data-background-image');
                if(!poster.startsWith("https://"))
                    poster = "https://www.la7.it/" + poster
    
                shows.push({name, poster});
            }
        });

        for (const show of shows) {
            console.log(show.name)
            // if(show.name==='otto-e-mezzo'){
                await get_episodes(catalog_id, show, cache, fullsearch)
            // }
        };


    } catch (error) {
        console.error(error.message);
        // throw error
    }
}

async function get_episodes(catalog_id, show, cache, fullsearch){
    try {
        let response = await request_url("https://www.la7.it/" + show.name);
        let $ = cheerio.load(response.data);

        const match = $('#headerProperty').attr('style').match(/background-image\s*:\s*url\s*\(\s*'([^']*)'\s*\)/);
        let background = match && match[1];
        if(!background.startsWith("https://"))
            background = "https://www.la7.it/" + background
        const name = $('.fascia_banner .in-fascia-banner').eq(0).text().trim();
        // const info = $('.fascia_banner .in-fascia-banner').eq(1).text().trim();
        const description = $('.fascia_banner .testo p').text().trim();

        id_programma = show.name
        const url = "https://www.la7.it/" + show.name + '/rivedila7'

        response = await request_url(url);
        $ = cheerio.load(response.data);
    
        // using set to avoid duplicates
        const episode_urls = new Set();

        // Check for Ultima Puntata
        const aTag = $('.ultima_puntata a');
        if (aTag.length) {
            episode_urls.add("https://www.la7.it/"+aTag.attr('href'));
        }
    
        // Check for La Settimana
        const elements = $("div.subcontent div.hidden-prev a");
        for (const element of elements) {
            episode_urls.add("https://www.la7.it/"+$(element).attr("href"));
            if(!fullsearch) break
        }
    
        let counter = 1;
    
        while (true) {
            const episodeLinks = $("div.common-item > a");
            if (episodeLinks.length === 0) break;
            for(episodeLink of episodeLinks){
                episode_urls.add("https://www.la7.it/"+$(episodeLink).attr("href"));
                if(!fullsearch) break
            }
            if(!fullsearch) break
            counter += 1;

            response = await request_url(url + "?page=" + counter);
            $ = cheerio.load(response.data);
        }
        
        initialized = false
        episode_list = []
        // const progressBar = new SingleBar({
        //     format: '{bar} {percentage}% | ETA: {eta}s | {value}/{total}',
        //     barCompleteChar: '\u2588',
        //     barIncompleteChar: '\u2591',
        //     hideCursor: true
        // });
        // progressBar.start(episode_urls.length, 0);

        const episode_url_list = Array.from(episode_urls);
        for (const episode_url of episode_url_list) {
            if (await cache.has_subkey(episode_url)) continue
            episode = await get_episode(episode_url)
            if(episode.video_url === undefined) continue

            if(!initialized){
                await cache.update_catalogs(catalog_id, `${catalog_id}:${id_programma}`, {
                    "id": `${catalog_id}:${id_programma}`,
                    "type": "series",
                    "name": name,
                    "description": description,
                    "poster": show.poster,
                    "background": background,
                });
                initialized = true
            }
            episode.id = `${catalog_id}:${id_programma}:${episode.season}:${episode.episode}`
            episode.url = episode_url
            episode_list.push(episode)
            // progressBar.increment();
        }

        // progressBar.stop();
        id_set = new Set();
        for(let episode of episode_list){
            while(id_set.has(episode.id)){
                episode.episode+=1
                episode.id = `${catalog_id}:${id_programma}:${episode.season}:${episode.episode}`
            }
            id_set.add(episode.id)
            const episode_url = episode.url;
            delete episode.url;
            await cache.update_videos(`${catalog_id}:${id_programma}`, episode.id, episode);
            await cache.update_visited(episode_url, new Date());
        }
        
    } catch (error) {
        console.error(error.message);
        // throw error
    }

}

async function get_episode(url) {
    try{
        const response = await request_url(url);

        const $ = cheerio.load(response.data);

        const dateVideo = $("div.dateVideo").text().trim();
        const dateParts = dateVideo.split("/");
        const date = new Date(dateParts[2] +"-"+ dateParts[1] +"-"+ dateParts[0])

        // const duration = parseInt(response.data.split(',videoDuration : "')[1].split('",')[0]) * 1000; //ms

        season = +dateParts[2]
        episode_number = parseInt(dateParts[1].padStart(2, '0') + dateParts[0].padStart(2, '0'))

        video_url = parseVideoSources(response.data)

        return {
                    "season": season,
                    "episode": episode_number,
                    "title": $("div.infoVideoRow > h1").text(),
                    "released": date,
                    "overview": $("div.occhiello").text(),
                    "thumbnail": "https:" + $("div.contextProperty img").attr("src").replace("http:", ""),
                    "video_url": video_url
                }
    }
    catch (error){
        console.error(error.message);
        return {}
    }

}

function parseVideoSources(responseData) {
    let videoUrl;
    const regex = /src:\s*({[^}]+})/;
    const match = responseData.match(regex);

    try {
        const videoSources = match && match[1] ? JSON.parse(match[1]) : undefined;
        // Initially, trying to set videoUrl to a specific format if available
        videoUrl = videoSources?.m3u8 || videoSources?.dash;

        // Redefining videoUrl to include all available sources, excluding the not available ones
        videoUrl = ['mp4', 'dash', 'm3u8'].reduce((acc, key) => {
            if (videoSources && videoSources[key]) {
                acc[key] = videoSources[key];
            }
            return acc;
        }, {});

        // Further refining videoUrl to include only specified keys, if any are available
        const keysToInclude = ['m3u8', 'mp4'];
        const includedKeys = keysToInclude.filter(key => videoSources && videoSources[key]);
        videoUrl = includedKeys.length ? includedKeys.reduce((acc, key) => {
            acc[key] = videoSources[key];
            return acc;
        }, {}) : undefined;

        // Special handling for m3u8 sources that contain 'csmil' in their URL
        if (videoUrl && videoUrl.m3u8 && videoUrl.m3u8.includes('csmil')) {
            videoUrl.mpd  = videoUrl.m3u8.replace("http://la7-vh.akamaihd.net/i/", "https://awsvodpkg.iltrovatore.it/local/dash/").replace("csmil/master.m3u8", "urlset/manifest.mpd");
            videoUrl.m3u8 = videoUrl.m3u8.replace("http://la7-vh.akamaihd.net/i/", "https://awsvodpkg.iltrovatore.it/local/hls/").replace("csmil/master.m3u8", "urlset/master.m3u8");
        }

        // Final transformation of videoUrl to include titles for each video format
        if (videoUrl !== undefined) {
            const keyOrder = ["mpd", "m3u8", "mp4"];
            const convertKey = key => ({
                "mpd": "MPEG-Dash (.mpd)",
                "m3u8": "MP3 URL (.m3u8)",
                "mp4": "MPEG-4 (.mp4)",
            }[key]);

            videoUrl = keyOrder
                .filter(key => videoUrl[key] !== undefined) // Remove entries where URL is undefined
                .map(key => ({ title: convertKey(key), url: videoUrl[key] }));
        }

        return videoUrl;
    } catch (error) {
        console.error(`Error parsing JSON: `, error);
        return undefined;
    }
}

module.exports = { catalogs, scrape };