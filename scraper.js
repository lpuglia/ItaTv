const axios = require('axios');
const cheerio = require('cheerio');

async function scrape_la7(catalog_cache, meta_cache, stream_cache, visited_urls) {

    try {
        let response = await axios.get("https://www.la7.it/programmi#P");
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
            console.log(show)
            await get_episodes(show, catalog_cache, meta_cache, stream_cache, visited_urls)
        };


    } catch (error) {
        console.error(error.message);
        // throw error;
    }
}

async function get_episodes(show, catalog_cache, meta_cache, stream_cache, visited_urls){

    setTimeout(() => {}, 500);
    let response = await axios.get("https://www.la7.it/" + show.name);
    let $ = cheerio.load(response.data);

    const match = $('#headerProperty').attr('style').match(/background-image\s*:\s*url\s*\(\s*'([^']*)'\s*\)/);
    const background = match && match[1];
    const name = $('.fascia_banner .in-fascia-banner').eq(0).text().trim();
    const info = $('.fascia_banner .in-fascia-banner').eq(1).text().trim();
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
    try {
        let response = await axios.get(url);
        let $ = cheerio.load(response.data);
    
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

          setTimeout(() => {}, 500);
          response = await axios.get(url + "?page=" + counter);
          $ = cheerio.load(response.data);
        }
        
        index = 0
        for (const episodeUrl of episodeUrls) {
            if (visited_urls.has(episodeUrl)) continue
            [episode, video_url] = await getEpisode(episodeUrl)

            episode.id = id_programma+":"+episode.season+":"+episode.episode,
            meta_cache[id_programma].videos.push(episode)
            stream_cache[episode.id] = [{"title": 'Web MPEG-Dash', "url": video_url}]
            visited_urls.add(episodeUrl)

            if(index>10) break // cache 10 episodes by most recent at a time
            index += 1
            // console.log('added '+episodeUrl)
        }
        
    } catch (error) {
        console.error(error.message);
        // throw error;
    }

    if(meta_cache[id_programma].videos.length === 0){
        delete catalog_cache[id_programma]
   }
}

async function getEpisode(url) {
    setTimeout(() => {}, 500);
    const response = await axios.get(url);

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

module.exports = {
    scrape_la7: scrape_la7
};