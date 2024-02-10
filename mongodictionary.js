const { MongoClient, ServerApiVersion } = require('mongodb');

class DictClient {
    constructor(){
        const uri = `mongodb+srv://${process.env.USR}:${process.env.PASSWD}@${process.env.SRVR}/${process.env.DB}?retryWrites=true&w=majority`;
        // console.log(uri)
        this.client = new MongoClient(uri, {
            serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
            }
        });
    }
    
    async connect() {
        try {
            await this.client.connect();
            this.database = this.client.db();
        } catch (error) {
            console.error('Error connecting to MongoDB:', error);
        }
    }

    async close() {
        try {
            await this.client.close();
        } catch (error) {
            console.error('Error closing MongoDB connection:', error);
        }
    }

    get_collection(collectionName){
        return this.database.collection(collectionName);
    }
}


class MetaDictionary {
    constructor(verbose) {
      if(verbose===undefined) verbose = false
        this.verbose = verbose
        this.meta = null; // Will hold the MongoDB collection reference
        this.catalogs = null; // Will hold the MongoDB collection reference
  }

  log(message) {
    if (this.verbose==="true") {
        console.log(message);
    }
  }
  
  async get_collection(client){
    this.videos = await client.get_collection("videos");
    this.catalogs = await client.get_collection("catalogs");
    this.visited = await client.get_collection("visited");
  }

//   async set(key, value) {
//     const result = await this.catalogs.updateOne({ key }, { $set: { value } }, { upsert: true });
//     this.log(`Set key '${key}' in Catalog`);
//     return result;
//   }

//   async update_field(key, fieldName, subKey, value) {
//     const updateFields = {};
//     updateFields[`${fieldName}.${subKey}`] = value;
    
//     const result = await this.dictionary.updateOne(
//         { key },
//         { $set: updateFields },
//         { upsert: true }
//     );
    
//     this.log(`Updated field '${fieldName}.${subKey}' for key '${key}' in MongoDB`);
//     return result;
//   }
  
    async update_catalogs(key, subKey, value) {
        const updateFields = {};
        updateFields[`metas.${subKey}`] = value;

        const result = await this.catalogs.updateOne(
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

        const result = await this.videos.updateOne(
            { key },
            { $set: updateFields },
            { upsert: true }
        );

        this.log(`Updated field '${subKey}' for key '${key}' in MongoDB`);
        return result;
    }

  async update_visited(key, value) {

    const result = await this.visited.updateOne(
        { key },
        { $set: { timestamp: value } },
        { upsert: true }
    );
    
    this.log(`Updated visited '${key}' in MongoDB`);
    return result;
  }

  async has_subkey(subKey) {
    const count = await this.visited.countDocuments({ [subKey]: { $exists: true } });

    this.log(`Check if subkey '${subKey}' is visited in MongoDB`);
    return count > 0;
  }

//   async getCatalog() {
//       this.log('Retrieving all values from MongoDB');
//       const values = await this.catalogs.find().map(doc => doc.value).toArray();
//       this.log('Retrieved all values from MongoDB');
//       // console.log(values)
//       values[0].name = `${new Date()}`
//       return values;
//   }
    async getCatalog(catalog_id) {
        const catalog = await this.catalogs.aggregate([
            { $match: { key: catalog_id } },
            { $project: { _id: 0, metas: { $objectToArray: '$metas' } } },
            { $unwind: '$metas' },
            { $replaceRoot: { newRoot: '$metas.v' } }
        ]).toArray();
        catalog[0].name = `${new Date()}`
        return catalog
    }

    async getMeta(catalog_id, meta_key) {
        const fullkey = [catalog_id, meta_key].join(":")
        // const meta = (await this.catalogs.findOne({ key }, { projection: { _id: 0, value: 1 } })).value;
        let meta = await this.catalogs.findOne(
            { key: catalog_id, [`metas.${fullkey}`]: { $exists: true } },
            { projection: { [`metas.${fullkey}`]: 1, _id: 0 } }
        )
        meta = meta.metas[fullkey];
        const videos = await this.videos.aggregate([
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
    let streams = await this.videos.findOne(
        { key: metakey, [`videos.${fullkey}.video_url`]: { $exists: true } },
        { projection: { [`videos.${fullkey}.video_url`]: 1, _id: 0 } }
      );
    // console.log(streams)
    streams = streams.videos[fullkey].video_url
    return streams
  }

}

module.exports = {DictClient,MetaDictionary};