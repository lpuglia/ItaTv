const cheerio = require('cheerio');
const {request_url} = require('./scrapermanager');

catalogs = []

async function scrape(cache, fullsearch){
    await scrape_tglira(cache, 'itatv_tg');
}

async function scrape_tglira(cache, catalog_id) {
    try{
        const id_programma = 'tglira';
        let response = await request_url("https://www.liratv.it/programmi/liratg-cronaca/");
        let $ = cheerio.load(response.data);
        first_article = $('article a').first().attr('href')
        response = await request_url(first_article);
        $ = cheerio.load(response.data);

        cache.update_catalogs(catalog_id, `${catalog_id}:${id_programma}`, {
            "id": `${catalog_id}:${id_programma}`,
            "type": "series",
            "name": "Lira TG",
            "description": "Tutte le notizie a cura della redazione giornalistica di LiraTV",
            "poster": $('video').first().attr('poster'),
            "background": $('video').first().attr('poster'),
            "posterShape" : "landscape"
        });

        episode = {
            "id": `${catalog_id}:${id_programma}::1`,
            "episode": 1,
            "title": $('h1').first().text(),
            "released": new Date(),
            "overview": "Tutte le notizie a cura della redazione giornalistica di LiraTV",
            "thumbnail": $('video').first().attr('poster'),
            "video_url": [{"title" : "MP3 URL (.m3u8)", "url" : $('video source').first().attr('src')}]
        }

        await cache.update_videos(`${catalog_id}:${id_programma}`, episode.id, episode);
    
    }catch (error){
        console.error(error.message);
        // throw error
    }
}

module.exports = { catalogs, scrape };