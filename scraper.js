const axios = require('axios');
const rateLimit = require('axios-rate-limit');
const cheerio = require('cheerio');

let maxRequestsPerSecond = 2;

let limitedAxios = rateLimit(axios.create(), {
  maxRequests: maxRequestsPerSecond,
  perMilliseconds: 10000,
});

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

async function request_url(url){
    while (true) {
        try{
            limitedAxios = rateLimit(axios.create(), {
                maxRequests: maxRequestsPerSecond,
                perMilliseconds: 10000,
            });

            let response = await limitedAxios.get(url);
            if(maxRequestsPerSecond<100) maxRequestsPerSecond*=2
            return response
        }catch (error){
            if (error.response) {
                console.error('HTTP status code:', error.response.status);
                if(error.response.status===429){
                    if(maxRequestsPerSecond>2) maxRequestsPerSecond/=2
                }
                if(error.response.status===404){
                    throw error
                }
                await sleep(10000/maxRequestsPerSecond);
            }else{
                console.error(error.message);
            }
            // throw error
        }
    }
}

async function scrape_la7(cache) {
    try {
        let response = await request_url("https://www.la7.it/programmi#P");
        let $ = cheerio.load(response.data);

        const containerDiv = $('#container-programmi-list');
        const shows = [];
        containerDiv.find('div.list-item').each((index, element) => {
            const anchor = $(element).find('a')
            if (anchor.length !== 0){
                const name = anchor.attr('href').substring(1)
                const poster = $(element).find('div.image-bg').attr('data-background-image');
                shows.push({name, poster});
            }
        });

        for (const show of shows) {
            console.log(show.name)
            await get_episodes(show, cache)
        };


    } catch (error) {
        console.error(error.message);
        // throw error
    }
}

async function get_episodes(show, cache){

    try {
        let response = await request_url("https://www.la7.it/" + show.name);
        let $ = cheerio.load(response.data);

        const match = $('#headerProperty').attr('style').match(/background-image\s*:\s*url\s*\(\s*'([^']*)'\s*\)/);
        const background = match && match[1];
        const name = $('.fascia_banner .in-fascia-banner').eq(0).text().trim();
        // const info = $('.fascia_banner .in-fascia-banner').eq(1).text().trim();
        const description = $('.fascia_banner .testo p').text().trim();

        id_programma = "itatv_" + show.name
        const url = "https://www.la7.it/" + show.name + '/rivedila7'

        response = await request_url(url);
        $ = cheerio.load(response.data);
    
        // List to store episode URLs
        const episodeUrls = [];
    
        // Check for La Settimana
        $("div.subcontent div.hidden-prev a").each((index, element) => {
          episodeUrls.push($(element).attr("href"));
        });
    
        let counter = 1;
    
        while (true) {
          const episodeLinks = $("div.common-item > a");
          if (episodeLinks.length === 0) break;
    
          episodeLinks.each((index, element) => {
            episodeUrls.push($(element).attr("href"));
          });
          counter += 1;

          response = await request_url(url + "?page=" + counter);
          $ = cheerio.load(response.data);
        }
        
        initialized = false
        index = 0
        for (const episodeUrl of episodeUrls) {
            if (await cache.has_subkey(id_programma, 'visited', episodeUrl)) continue
            episode = await get_episode("https://www.la7.it/"+episodeUrl)
            if(episode.video_url === undefined) continue

            if(!initialized){
                await cache.set(id_programma, {
                    "id": id_programma,
                    "type": "series",
                    "name": name,
                    "description": description,
                    "poster": show.poster,
                    "background": background,
                });
                initialized = true
            }

            episode.id = id_programma+":"+episode.season+":"+episode.episode,

            await cache.update_field(id_programma, 'videos', episode.id, episode);
            await cache.update_field(id_programma, 'visited', episodeUrl, new Date());

            if(index>10) break // cache 10 episodes by most recent at a time
            index += 1
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


        const regex = /src:\s*({[^}]+})/;
        const match = response.data.match(regex);
        try {
            const video_sources = match && match[1] ? JSON.parse(match[1]) : undefined;
            video_url = video_sources?.m3u8 || video_sources?.dash;
            video_url = ['mp4', 'dash', 'm3u8'].reduce((acc, key) => {
                if (video_sources[key]) { acc[key] = video_sources[key]; } return acc;
            }, {});

            // create a dictionary with the available sources, exclude not available sources, if none set undefined
            const keysToInclude = ['mp4', 'm3u8'];
            const includedKeys = keysToInclude.filter(key => video_sources[key]);
            video_url = includedKeys.length ? includedKeys.reduce((acc, key) => { acc[key] = video_sources[key]; return acc;}, {}) : undefined;
            if(video_url.m3u8 && video_url.m3u8.includes('csmil')){
                video_url.mpd = video_url.m3u8.replace("http://la7-vh.akamaihd.net/i", "https://awsvodpkg.iltrovatore.it/local/dash/").replace("csmil/master.m3u8", "urlset/manifest.mpd")
            }
            if(video_url!==undefined){
                const convertKey = key => ({
                    "mp4": "MPEG-4 (.mp4)",
                    "mpd": "MPEG-Dash (.mpd)",
                    "m3u8": "MP3 URL (.m3u8)"
                }[key]);
                
                video_url = Object.entries(video_url).map(([key, url]) => ({title: convertKey(key), url}));
            }

        } catch (error) {
            console.error(`Error parsing JSON in '${url}': `, error);
            video_url = undefined;
        }

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
        return [{},""]
    }

}

module.exports = {
    scrape_la7: scrape_la7
};