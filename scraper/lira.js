const cheerio = require('cheerio');
const {request_url} = require('./scrapermanager');

catalogs = []

async function scrape(cache, fullsearch){

    id_programma = 'tglira'
    catalog_id = 'itatv_tg'
    cache.update_catalogs(catalog_id, `${catalog_id}:${id_programma}`, {
        "id": `${catalog_id}:${id_programma}`,
        "type": "series",
        "name": "Lira TV",
        "description": "LiraTV... E sei protagonista",
        "poster": "https://www.liratv.it/wp-content/uploads/2024/05/1714825800_LIRATG-Cronaca-04052024_1714826439-585x329.jpg",
        "background": "https://www.liratv.it/wp-content/uploads/2024/05/1714825800_LIRATG-Cronaca-04052024_1714826439-585x329.jpg",
        "posterShape" : "landscape"
    });

    await scrape_tglira(cache, catalog_id, id_programma, "https://www.liratv.it/programmi/liratg-cronaca/");
    await scrape_tglira(cache, catalog_id, id_programma, "https://www.liratv.it/programmi/buongiorno-lira//");
    await scrape_tglira(cache, catalog_id, id_programma, "https://www.liratv.it/programmi/liratg-sport/");
    await scrape_tglira(cache, catalog_id, id_programma, "https://www.liratv.it/programmi/liratg-sera-cronaca/");
    await scrape_tglira(cache, catalog_id, id_programma, "https://www.liratv.it/programmi/liratg-sera-sport/");
    await scrape_tglira(cache, catalog_id, id_programma, "https://www.liratv.it/programmi/campania-regione-europea/");
    await cache.deleteOldVideos(`${catalog_id}:${id_programma}`, 8)
}

async function scrape_tglira(cache, catalog_id, id_programma, url_programma) {
    try{
        let response = await request_url(url_programma);
        let $ = cheerio.load(response.data);
        first_article = $('article a').first().attr('href')
        response = await request_url(first_article);
        $ = cheerio.load(response.data);
        publishedDate = new Date($('time').attr('datetime'))

        const month = (publishedDate.getMonth() + 1).toString().padStart(2, '0');
        const day = publishedDate.getDate().toString().padStart(2, '0');
        const hour = publishedDate.getHours().toString().padStart(2, '0');
        const minute = publishedDate.getMinutes().toString().padStart(2, '0');

        const episode_number = parseInt(`${month}${day}${hour}${minute}`, 10);
        const season = publishedDate.getFullYear();

        poster = response.data.match(/"poster"\s*:\s*"([^"]+)"/)[1]
        episode = {
            "id": `${catalog_id}:${id_programma}:${season}:${episode_number}`,
            "episode": episode_number,
            "season": season,
            "title": $('h1').first().text(),
            "released": publishedDate,
            "overview": $('article .post-entry p').first().text(),
            "thumbnail": poster,
            "video_url": [{"title" : "MP3 URL (.m3u8)", "url" : response.data.match(/"sd"\s*:\s*"([^"]+)"/)[1]}]
        }
        await cache.update_videos(`${catalog_id}:${id_programma}`, episode.id, episode);
        
    }catch (error){
        console.error(error.message);
        // throw error
    }
}

module.exports = { catalogs, scrape };