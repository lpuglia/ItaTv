const DictClient = require('./dictclient');

class MetaDictionary {
    constructor(verbose) {
        if(verbose===undefined) verbose = false
            this.verbose = verbose
    }

    log(message) {
        if (this.verbose==="true") {
            console.log(message);
        }
    }
  
    async update_catalogs(key, subKey, value) {
        const updateFields = {};
        updateFields[`metas.${subKey}`] = value;
        const catalogs = await DictClient.get_collection("catalogs")
        const result = await catalogs.updateOne(
            { key },
            { $set: updateFields },
            { upsert: true }
        );
        this.log(`Updated field '${subKey}' for key '${key}' in MongoDB`);
        return result;
    }

    async update_videos(key, subKey, value) {
        const updateFields = {};
        updateFields[`videos.${subKey}`] = value;
        const videos = await DictClient.get_collection("videos")
        const result = await videos.updateOne(
            { key },
            { $set: updateFields },
            { upsert: true }
        );

        this.log(`Updated field '${subKey}' for key '${key}' in MongoDB`);
        return result;
    }

    async update_visited(key, value) {
        const visited = await DictClient.get_collection("visited")
        const result = await visited.updateOne(
            { key },
            { $set: { timestamp: value } },
            { upsert: true }
        );
        
        this.log(`Updated visited '${key}' in MongoDB`);
        return result;
    }

    async has_subkey(subKey) {
        const visited = await DictClient.get_collection("visited")
        const count = await visited.countDocuments({ "key": subKey });
        this.log(`Check if subkey '${subKey}' is visited in MongoDB`);
        return count > 0;
    }

    async getCatalog(catalog_id) {
        const catalogs = await DictClient.get_collection("catalogs")
        const catalog = await catalogs.aggregate([
            { $match: { key: catalog_id } },
            { $project: { _id: 0, metas: { $objectToArray: '$metas' } } },
            { $unwind: '$metas' },
            { $replaceRoot: { newRoot: '$metas.v' } }
        ]).toArray();
        try{
            catalog[0].name = `${new Date()}`
        }catch (error) {
            console.error(error.message, catalog_id, catalog[0]);
            throw error
        }
        return catalog
    }

    async getMeta(catalog_id, meta_key) {
        const fullkey = [catalog_id, meta_key].join(":")
        const catalogs = await DictClient.get_collection("catalogs")
        let meta = await catalogs.findOne(
            { key: catalog_id, [`metas.${fullkey}`]: { $exists: true } },
            { projection: { [`metas.${fullkey}`]: 1, _id: 0 } }
        )
        meta = meta.metas[fullkey];
        const videos_collection = await DictClient.get_collection("videos")
        const videos = await videos_collection.aggregate([
            { $match: { key: fullkey } },
            { $project: { _id: 0, videos: { $objectToArray: '$videos' } } },
            { $unwind: '$videos' },
            { $replaceRoot: { newRoot: '$videos.v' } },
            { $unset: 'video_url' } // Remove the video_url field
        ]).toArray();
        
        meta.videos = videos
        this.log('Retrieved all values from MongoDB');
        return meta
    }

    async getStream(catalog_id, meta_key, season, episode){
        const metakey = [catalog_id, meta_key].join(":")
        const fullkey = [catalog_id, meta_key, season, episode].join(":")
        const videos = await DictClient.get_collection("videos")
        let streams = await videos.findOne(
            { key: metakey, [`videos.${fullkey}.video_url`]: { $exists: true } },
            { projection: { [`videos.${fullkey}.video_url`]: 1, _id: 0 } }
        );
        // console.log(streams)
        streams = streams.videos[fullkey].video_url
        return streams
    }

}

module.exports = MetaDictionary