const axios = require('axios');
const rateLimit = require('axios-rate-limit');

let maxRequestsPerSecond = 1;

let limitedAxios = rateLimit(axios.create(), {
  maxRequests: maxRequestsPerSecond,
  perMilliseconds: 1000,
});

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

async function request_url(url){
    while (true) {
        try{
            let response = await limitedAxios.get(url);
            limitedAxios = rateLimit(axios.create(), {
                maxRequests: maxRequestsPerSecond,
                perMilliseconds: 1000,
            });

            // if(maxRequestsPerSecond<11) maxRequestsPerSecond*=2
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
                await sleep(10000);
            }else{
                console.error(error.message);
                throw error
            }
        }
    }
}

module.exports = {
    request_url: request_url
};