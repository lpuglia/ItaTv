const cheerio = require('cheerio');
const axios = require('axios');

const {request_url} = require('./scrapermanager');

catalogs = [
                {
                    "id": "itatv_rai_programmi", "type": "series", "name": "Rai Programmi",
                    "extra": [
                        { "name": "search", "isRequired": false },
                        { "name": "skip", "isRequired": false }
                    ]
                }
            ]

async function scrape(cache, fullsearch){
    await scrape_rai_tg(cache, 'itatv_tg');
    await scrape_rai_programmi(cache, 'itatv_rai_programmi', fullsearch);
}

async function getLocationHeader(url) {
    try {
      const response = await axios.get(url, {
        maxRedirects: 0, // Prevent axios from following redirects automatically
        validateStatus: function (status) {
          return status >= 200 && status < 303; // Accept all 2xx and 3xx statuses to prevent axios from throwing an error on redirects (3xx status codes)
        }
      });
      return response.headers.location.split('?')[0]; // Extract the Location header
    } catch (error) {
      if (error.response && error.response.headers.location) {
        return error.response.headers.location; // Return Location header from the error response if available
      }
      // Handle other errors (e.g., no response, no Location header, etc.)
      console.error('Error fetching Location header:', error.message);
      return null;
    }
  }

async function scrape_rai_tg(cache, catalog_id) {
    tg_pages = ["https://www.rainews.it/notiziari/tg1",
                "https://www.rainews.it/notiziari/tg2",
                "https://www.rainews.it/notiziari/tg3"]
    for(tg_page of tg_pages){
        try {
            const id_programma = tg_page.split('/')[4];
            const response = await request_url(tg_page);
            const $ = cheerio.load(response.data);
            const player_data = JSON.parse($('rainews-player').attr('data'))

            cache.update_catalogs(catalog_id, `${catalog_id}:${id_programma}`, {
                "id": `${catalog_id}:${id_programma}`,
                "type": "series",
                "name": player_data.track_info.title,
                "description": player_data.track_info.episode_title,
                "poster": "https://www.rainews.it/"+player_data.image,
                "background": "https://www.rainews.it/"+player_data.image,
                "posterShape" : "landscape"
            });

            episode = {
                "id": `${catalog_id}:${id_programma}::1`,
                "episode": 1,
                "title": player_data.track_info.episode_title,
                "released": new Date(),
                "overview": player_data.track_info.episode_title,
                "thumbnail": "https://www.rainews.it/"+player_data.image,
                "video_url": [{"title" : "MP3 URL (.m3u8)", "url" : await getLocationHeader( player_data.content_url)}]
            }

            await cache.update_videos(`${catalog_id}:${id_programma}`, episode.id, episode);
        } catch (error) {
            console.log(error)
        }
    }
}

async function scrape_rai_programmi(cache, catalog_id, fullsearch) {
    urls_programmi = [
                        'https://www.raiplay.it/raccolta/Programmi-in-esclusiva-f62a210b-d5a5-4b0d-ae73-1625c1da15b6.html',
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
                // console.log(show.name)
                // if(show.name==="Dal mito alla Storia"){
                    await get_episodes(catalog_id, show, cache, fullsearch)
                // }
            };
        }
    } catch (error) {
        console.error(error.message);
        throw error
    }
}

async function get_episodes(catalog_id, show, cache, fullsearch){
    try {
        // console.log(`https://www.raiplay.it${show.url}.json`)
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
                    if (block.name.includes("Puntate") || set.name.includes("Puntate") || block.length==1) {
                        episode_lists.push({episodes_url,name});
                    }
                });
            });
        }

        if (episode_lists.length>0) {
            const episode_urls = [];
            for (const episode_list of episode_lists) {
                // console.log(episode_list.episodes_url)
                const response = await request_url(episode_list.episodes_url);
                if (typeof response.data === 'string') {
                    episodes_json = JSON.parse(response.data.replace(/[\x00-\x1F\x7F-\x9F]/g, ""));
                }else{
                    episodes_json = response.data
                }

                for (let season of episodes_json.seasons) {
                    for (let episode of season.episodes) {
                        if (episode.cards && episode.cards.length > 0) {
                            // Extract information from each card
                            for (let card of episode.cards) {
                                episode_urls.push(`https://www.raiplay.it${card.path_id}`);
                                if(!fullsearch) break
                            }
                        }
                        if(!fullsearch && episode_urls.length>0) break
                    }
                    if(!fullsearch && episode_urls.length>0) break
                }
            };

            initialized = false
            // index = 0
            episode_list = []
            for(const episode_url of episode_urls){
                if (await cache.has_subkey(episode_url)) continue
                episode = await get_episode(episode_url)
                // console.log(episode)
                if(episode.video_url === undefined) continue

                if(!initialized){
                    await cache.update_catalogs(catalog_id, `${catalog_id}:${id_programma}`, {
                        "id": `${catalog_id}:${id_programma}`,
                        "type": "series",
                        "name": jsonData.name,
                        "description": jsonData.program_info.description,
                        "poster": "https://www.raiplay.it" + (jsonData.program_info.images.portrait_logo || jsonData.program_info.images.portrait || ''),
                        "background": "https://www.raiplay.it" + (jsonData.program_info.images.landscape_logo || jsonData.program_info.images.landscape || ''),
                    })
                    initialized = true
                }

                episode.id = `${catalog_id}:${id_programma}:${episode.season}:${episode.episode}`
                episode.url = episode_url
                episode_list.push(episode)
                // if(index>10) break // cache 10 episodes by most recent at a time
                // index += 1
            }
            // console.log(episode_list)
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
            // console.log(episode_list)
        }
    } catch (error) {
        console.error(error.message);
        // throw error
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
                "title": jsonData.episode_title || jsonData.toptitle || '',
                "released": new Date(`${jsonData.track_info.update_date.split("-").join("-")}T${jsonData.time_published}:00`),
                // "released": new Date(`${jsonData.date_published.split("-").reverse().join("-")}T${jsonData.time_published}:00`),
                "overview": jsonData.description || '',
                "thumbnail": "https://www.raiplay.it"+ (jsonData.images.landscape || "/resizegd/275x-/dl/components/img/raiplay-search-landscape.jpg"),
                "video_url": [{"title": "MP3 URL (.m3u8)", "url": await getLocationHeader(jsonData.video.content_url)}]
            }
    }
    catch (error){
        console.error(error.message);
        return {}
    }

}
module.exports = { catalogs, scrape };