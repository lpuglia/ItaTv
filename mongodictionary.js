const { MongoClient, ServerApiVersion } = require('mongodb');

class MongoDictionary {
    constructor(collectionName, verbose=true) {
        const uri = `mongodb+srv://${process.env.USR}:${process.env.PWD}@${process.env.SRVR}/${process.env.DB}?retryWrites=true&w=majority`;

        this.client = new MongoClient(uri, {
            serverApi: {
            version: ServerApiVersion.v1,
            strict: true,
            deprecationErrors: true,
            }
        });
        this.verbose = verbose
        this.collectionName = collectionName;
        this.dictionary = null; // Will hold the MongoDB collection reference
  }

  log(message) {
    if (this.verbose) {
        console.log(message);
    }
  }

  async connect() {
    try {
        await this.client.connect();
        const database = this.client.db();
        this.dictionary = database.collection(this.collectionName);
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

  async set(key, value) {
    const result = await this.dictionary.updateOne({ key }, { $set: { value } }, { upsert: true });
    this.log(`Set key '${key}' in MongoDB`);
    return result;
  }

  async update_field(key, fieldName, subKey, value) {
    const updateFields = {};
    updateFields[`${fieldName}.${subKey}`] = value;
    
    const result = await this.dictionary.updateOne(
        { key },
        { $set: updateFields },
        { upsert: true }
    );
    
    this.log(`Updated field '${fieldName}.${subKey}' for key '${key}' in MongoDB`);
    return result;
  }
  
  async has_subkey(key, fieldName, subKey) {
    const query = {};
    query[`${fieldName}.${subKey}`] = { $exists: true };

    const result = await this.dictionary.countDocuments({ key, ...query });
    this.log(`Check if subkey '${fieldName}.${subKey}' exists for key '${key}' in MongoDB`);
    return result > 0;
  }

  async getCatalog() {
      const values = await this.dictionary.find().map(doc => doc.value).toArray();
      this.log('Retrieved all values from MongoDB');
      return values;
  }

  async getMeta(key) {
    const meta = (await this.dictionary.findOne({ key }, { projection: { _id: 0, value: 1 } })).value;

    const videos = await this.dictionary.aggregate([
        { $match: { key } },
        { $project: { _id: 0, videos: { $objectToArray: '$videos' } } },
        { $unwind: '$videos' },
        { $replaceRoot: { newRoot: '$videos.v' } },
        { $unset: 'video_url' } // Remove the video_url field
      ]).toArray();
    
    meta.videos = videos

    this.log('Retrieved all values from MongoDB');
    return meta;
  }

  async getStream(key, video_key){
    let streams = await this.dictionary.findOne(
        { key: key, [`videos.${video_key}.video_url`]: { $exists: true } },
        { projection: { [`videos.${video_key}.video_url`]: 1, _id: 0 } }
      );
    streams = streams.videos[video_key].video_url
    return streams
  }

}

module.exports = MongoDictionary;