const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function scrape_la7() {

    try {
        let response = await axios.get("https://www.la7.it/programmi#P");
        let $ = cheerio.load(response.data);

        const containerDiv = $('#container-programmi-list');
        const programmi = [];
        containerDiv.find('div.list-item').each((index, element) => {
            const anchor = $(element).find('a')
            if (anchor.length !== 0){
                const name = anchor.attr('href').substring(1)
                const poster = $(element).find('div.image-bg').attr('data-background-image');
                programmi.push({name, poster});
            }
        });

        catalog = {}

        try {
            catalog = JSON.parse(fs.readFileSync('catalog/catalog.json', 'utf8'))
        } catch (error) {
            console.error(error.message)
        }

        for (const meta of programmi) {
            console.log(meta)
            result = await get_episodes(meta)
            if(result !== undefined){
                catalog[result.id] = result
            }
            fs.writeFileSync('catalog/catalog.json', JSON.stringify(catalog, null, 2), (err) => {});
        };


    } catch (error) {
        // console.error(error.message);
        throw error;
    }
}

async function get_episodes(meta){

    setTimeout(() => {}, 500);
    let response = await axios.get("https://www.la7.it/" + meta.name);
    let $ = cheerio.load(response.data);

    const match = $('#headerProperty').attr('style').match(/background-image\s*:\s*url\s*\(\s*'([^']*)'\s*\)/);
    const background = match && match[1];
    const name = $('.fascia_banner .in-fascia-banner').eq(0).text().trim();
    const info = $('.fascia_banner .in-fascia-banner').eq(1).text().trim();
    const description = $('.fascia_banner .testo p').text().trim();

    id_programma = "itatv_" + meta.name
    const metas = {
        "id": id_programma,
        "type": "series",
        "name": name,
        "description": description,
        "poster": meta.poster,
        "background": background,
        "videos": {} // this must be converted to a list when serving it as a meta
    };

    try {
        metas['videos'] = JSON.parse(fs.readFileSync('catalog/shows/'+id_programma+'.json', 'utf8'))['videos']
    } catch (error) {
        console.error(error.message)
        // throw error;
    }
    
    const url = "https://www.la7.it/" + meta.name + '/rivedila7'
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
        
        // index = 0
        for (const episodeUrl of episodeUrls) {
            if (episodeUrl in metas['videos']) continue
            episode = await getEpisode(id_programma, episodeUrl)

            episode['url_id'] = episodeUrl
            episode['video_url'] = episode['video_url']

            metas['videos'][episodeUrl] = episode
            // if(index>4) break
            // index += 1
            console.log('added '+episodeUrl)
            fs.writeFileSync('catalog/shows/'+id_programma+'.json', JSON.stringify(metas, null, 2), (err) => {});
        }
        
    } catch (error) {
        console.error(error.message);
        // throw error;
    }


    if(Object.keys(metas.videos).length === 0){
        return
    }
    delete metas['videos']
    return metas
}

async function getEpisode(id_programma, url) {
    setTimeout(() => {}, 500);
    const response = await axios.get(url);

    const $ = cheerio.load(response.data);

    const dateVideo = $("div.dateVideo").text().trim();
    const dateParts = dateVideo.split("/");
    const date = new Date(dateParts[2] +"-"+ dateParts[1] +"-"+ dateParts[0])

    // const duration = parseInt(response.data.split(',videoDuration : "')[1].split('",')[0]) * 1000; //ms

    season = +dateParts[2]
    episode = parseInt(dateParts[1].padStart(2, '0') + dateParts[0].padStart(2, '0'))
    return episode = {
        "season": season,
        "episode": episode,
        "id": id_programma+":"+season+":"+episode,
        "title": $("div.infoVideoRow > h1").text(),
        "released": date,
        "overview": $("div.occhiello").text(),
        "thumbnail": "https:" + $("div.contextProperty img").attr("src").replace("http:", ""),
        "video_url" : "https://awsvodpkg.iltrovatore.it/local/dash/" + 
                      response.data.split("http://la7-vh.akamaihd.net/i")[1].split("csmil/master.m3u8")[0] +
                      "urlset/manifest.mpd"
    }
}

module.exports = {
    scrape_la7: scrape_la7
};