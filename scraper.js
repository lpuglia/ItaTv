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
            console.log(maxRequestsPerSecond)
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
                await sleep(10000/maxRequestsPerSecond);
            }else{
                console.error(error.message);
            }
            // throw error
        }
    }
}

async function scrape_la7(catalog_cache, meta_cache, stream_cache, visited_urls) {
    try {
        console.log(Object.keys(catalog_cache).length, Object.keys(meta_cache).length, Object.keys(stream_cache).length, visited_urls.size)
        
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
            await get_episodes(show, catalog_cache, meta_cache, stream_cache, visited_urls)
        };


    } catch (error) {
        console.error(error.message);
        // throw error
    }
}

async function get_episodes(show, catalog_cache, meta_cache, stream_cache, visited_urls){

    try {
        let response = await request_url("https://www.la7.it/" + show.name);
        let $ = cheerio.load(response.data);

        const match = $('#headerProperty').attr('style').match(/background-image\s*:\s*url\s*\(\s*'([^']*)'\s*\)/);
        const background = match && match[1];
        const name = $('.fascia_banner .in-fascia-banner').eq(0).text().trim();
        // const info = $('.fascia_banner .in-fascia-banner').eq(1).text().trim();
        const description = $('.fascia_banner .testo p').text().trim();

        id_programma = "itatv_" + show.name
        if(!(id_programma in meta_cache)){
            meta_cache[id_programma] = {
                "id": id_programma,
                "type": "series",
                "name": name,
                "description": description,
                "poster": show.poster,
                "background": background,
                "videos": []
            };
            catalog_cache[id_programma] = {
                "id": id_programma,
                "type": "series",
                "name": name,
                "description": description,
                "poster": show.poster,
                "background": background
            };
        }
        
        const url = "https://www.la7.it/" + show.name + '/rivedila7'

        response = await request_url(url);
        $ = cheerio.load(response.data);
    
        // List to store episode URLs
        const episodeUrls = [];
    
        // Check for La Settimana
        $("div.subcontent div.hidden-prev a").each((index, element) => {
          episodeUrls.push("https://www.la7.it" + $(element).attr("href"));
        });
    
        let counter = 1;
    
        while (true) {
          const episodeLinks = $("div.common-item > a");
          if (episodeLinks.length === 0) break;
    
          episodeLinks.each((index, element) => {
            episodeUrls.push("https://www.la7.it" + $(element).attr("href"));
          });
          counter += 1;

          response = await request_url(url + "?page=" + counter);
          $ = cheerio.load(response.data);
        }
        
        index = 0
        for (const episodeUrl of episodeUrls) {
            if (visited_urls.has(episodeUrl)) continue
            [episode, video_url] = await get_episode(episodeUrl)
            if(video_url==="") continue

            episode.id = id_programma+":"+episode.season+":"+episode.episode,
            meta_cache[id_programma].videos.push(episode)
            stream_cache[episode.id] = [{"title": 'Web MPEG-Dash', "url": video_url}]
            visited_urls.add(episodeUrl)

            if(index>10) break // cache 10 episodes by most recent at a time
            index += 1
            // console.log('added '+episodeUrl)
        }

        if(meta_cache[id_programma].videos.length === 0){
            delete catalog_cache[id_programma]
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
        return [
                {
                    "season": season,
                    "episode": episode_number,
                    "title": $("div.infoVideoRow > h1").text(),
                    "released": date,
                    "overview": $("div.occhiello").text(),
                    "thumbnail": "https:" + $("div.contextProperty img").attr("src").replace("http:", ""),
                },
                "https://awsvodpkg.iltrovatore.it/local/dash/" + 
                response.data.split("http://la7-vh.akamaihd.net/i")[1].split("csmil/master.m3u8")[0] +
                "urlset/manifest.mpd"
            ]
    }
    catch (error){
        console.error(error.message);
        return [{},""]
    }

}

module.exports = {
    scrape_la7: scrape_la7
};