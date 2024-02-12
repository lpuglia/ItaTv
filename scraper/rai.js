const cheerio = require('cheerio');
const {request_url} = require('./scrapermanager');

catalogs = [
                {
                    "id": "itatv_rai_programmi", "type": "series", "name": "Rai Programmi",
                    "extra": [{ "name": "search", "isRequired": false }]
                }
            ]

async function scrape(cache){
    await scrape_rai_programmi(cache, 'itatv_rai_programmi');
}

async function scrape_rai_programmi(cache, catalog_id) {
    urls_programmi = [
                        'https://www.raiplay.it/genere/PROGRAMMI---Costume-e-Societa-8875c1f7-799b-402b-92f9-791bde8fb141.html',
                        'https://www.raiplay.it/genere/Programmi---Crime-d8b77fff-5018-4ad6-9d4d-40d7dc548086.html',
                        'https://www.raiplay.it/genere/Giochi--Quiz-ad635fda-4dd5-445f-87ff-64d60404f1ca.html',
                        'https://www.raiplay.it/genere/Programmi---Inchieste-e-Reportage-18990102-8310-47ac-9976-07467ffc6924.html',
                        'https://www.raiplay.it/genere/Programmi---Intrattenimento-373672aa-a1d2-4da7-a7c7-52a3fc1fda6d.html',
                        'https://www.raiplay.it/genere/Programmi---Lifestyle-f247c5a8-1272-42cf-81c3-462f585ed0ab.html',
                        'https://www.raiplay.it/genere/PROGRAMMI---Musica-09030aa3-7cae-4e46-babb-30e7b8c5d47a.html',
                        'https://www.raiplay.it/genere/Programmi---News--Approfondimento-b903d33d-956f-47cb-95be-58b955eb5bb5.html',
                        'https://www.raiplay.it/genere/Programmi---Reality--Factual-c0e8c78b-9a3e-4bd9-845f-f5dcfe2742a7.html',
                        'https://www.raiplay.it/genere/Programmi---Scienza--Natura-c0d75968-a8d6-43e8-97c0-f4b85d89e99e.html',
                        'https://www.raiplay.it/genere/Programmi---Sport-2a822ae2-cc29-4cac-b813-74be6d2d249f.html',
                        'https://www.raiplay.it/genere/Programmi---Scienza--Natura-c0d75968-a8d6-43e8-97c0-f4b85d89e99e.html',
                        'https://www.raiplay.it/genere/Programmi---Sport-2a822ae2-cc29-4cac-b813-74be6d2d249f.html',
                        'https://www.raiplay.it/genere/Programmi---Storia--Arte-ea281d79-9ffb-4aaa-a86d-33f7391650e7.html',
                        'https://www.raiplay.it/genere/Programmi---Talk-Show-2d2c3d6d-1aec-4d41-b926-cea21b88b245.html',
                        'https://www.raiplay.it/genere/Programmi---Viaggi-e-Avventure-640ff485-ac26-4cff-8214-d9370664ffe2.html',
                    ]
    try {
        for(url_programmi of urls_programmi){
            const response = await request_url(url_programmi);

            const $ = cheerio.load(response.data);

            const shows = [];
            $('div.card-item').each(function() {
                const url = $(this).find('a').attr('href');
                const name = $(this).find('img').attr('alt').replace(" - RaiPlay", "");
                const poster = $(this).find('img').attr('src');
        
                shows.push({ url, name, poster });
            });

            for (const show of shows) {
                console.log(show.name)
                // if(show.name==="Blob"){
                await get_episodes(catalog_id, show, cache)
                // }
            };
        }
    } catch (error) {
        console.error(error.message);
        throw error
    }
}

async function get_episodes(catalog_id, show, cache){
    try {
        console.log(`https://www.raiplay.it${show.url}.json`)
        const response = await request_url(`https://www.raiplay.it${show.url}.json`);

        const id_programma = show.url
        const jsonData = response.data;
        const episode_lists = [];

        // Check if blocks exist and iterate over them
        if (jsonData.blocks) {
            jsonData.blocks.forEach((block) => {
                block.sets.forEach((set) => {
                    const episodes_url = `https://www.raiplay.it${show.url}/${block.id}/${set.id}/episodes.json`;
                    const name = [block.name, set.name]
                    if (block.name.includes("Puntate") || set.name.includes("Puntate") || block.sets.length==1) {
                        episode_lists.push({episodes_url,name});
                    }
                });
            });
        }
        const episode_urls = [];
        if (episode_lists.length>0) {
            for (const episode_list of episode_lists) {
                // console.log(episode_list.episodes_url)
                const response = await request_url(episode_list.episodes_url);
                episodes_json = response.data

                for (let season of episodes_json.seasons) {
                    for (let episode of season.episodes) {
                        if (episode.cards && episode.cards.length > 0) {
                            // Extract information from each card
                            for (let card of episode.cards) {
                                episode_urls.push(`https://www.raiplay.it${card.path_id}`);
                            }
                        }
                    }
                }
            };

            initialized = false
            // index = 0
            for(let episode_url of episode_urls){
                if (await cache.has_subkey(episode_url)) continue
                episode = await get_episode(episode_url)
                if(episode.video_url === undefined) continue

                if(!initialized){
                    await cache.update_catalogs(catalog_id, `${catalog_id}:${id_programma}`, {
                        "id": `${catalog_id}:${id_programma}`,
                        "type": "series",
                        "name": jsonData.name,
                        "description": jsonData.program_info.description,
                        "poster": `https://www.raiplay.it${jsonData.program_info.images.portrait_logo}` || '',
                        "background": `https://www.raiplay.it${jsonData.program_info.images.landscape_logo}` || '',
                    })
                    initialized = true
                }

                episode.id = `${catalog_id}:${id_programma}:${episode.season}:${episode.episode}`,
                await cache.update_videos(`${catalog_id}:${id_programma}`, episode.id, episode);
                await cache.update_visited(episode_url, new Date());

                // if(index>10) break // cache 10 episodes by most recent at a time
                // index += 1
            }
        }
    } catch (error) {
        console.error(error.message);
        throw error
    }
}

async function get_episode(url) {
    try{
        // console.log(url)
        const response = await request_url(url);
        const jsonData = response.data

        // const [year, month, day] = jsonData.track_info.update_date.split("-")
        const [day, month, year] = jsonData.date_published.split("-")
        const [hour, minute] = jsonData.time_published.split(":")
        season = +year
        episode_number = parseInt(month.padStart(2, '0') + day.padStart(2, '0') + hour.padStart(2, '0') + minute.padStart(2, '0'))

        return {
                "season": season,
                "episode": episode_number,
                "title": jsonData.episode_title || '',
                "released": new Date(`${jsonData.track_info.update_date.split("-").join("-")}T${jsonData.time_published}:00`),
                // "released": new Date(`${jsonData.date_published.split("-").reverse().join("-")}T${jsonData.time_published}:00`),
                "overview": jsonData.description || '',
                "thumbnail": `https://www.raiplay.it${jsonData.images.landscape}` || '',
                "video_url": [{"title": "MP3 URL (.m3u8)", "url": jsonData.video.content_url}]
            }
    }
    catch (error){
        console.error(error.message);
        return {}
    }

}
module.exports = { catalogs, scrape };