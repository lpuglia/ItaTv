const { MongoClient, ServerApiVersion } = require('mongodb');

class DictClient {
    static client = null;
    static database = null;
    static isConnected = false;
    static collectionCache = {};

    static async connect() {
        if (!this.isConnected) {
            const uri = `mongodb+srv://${process.env.USR}:${process.env.PASSWD}@${process.env.SRVR}/${process.env.DB}?retryWrites=true&w=majority`;
            this.client = new MongoClient(uri, {
                serverApi: {
                    version: ServerApiVersion.v1,
                    strict: true,
                    deprecationErrors: true,
                }
            });
            try {
                await this.client.connect();
                this.database = this.client.db();
                this.isConnected = true;
            } catch (error) {
                console.error("Failed to connect to MongoDB:", error);
                this.isConnected = false;
                throw error; // Rethrow to handle upstream
            }
        }
    }

    static async close() {
        if (this.isConnected && this.client) {
            await this.client.close();
            this.isConnected = false;
            this.client = null;
            this.database = null;
            this.collectionCache = {}; // Clear cache on close
        }
    }

    static async get_collection(collectionName) {
        if (!this.isConnected) {
            console.log("Detected disconnected state, attempting to reconnect...");
            await this.connect();
        }

        if (this.collectionCache[collectionName]) {
            return this.collectionCache[collectionName];
        }

        try {
            const collection = this.database.collection(collectionName);
            this.collectionCache[collectionName] = collection;
            return collection;
        } catch (error) {
            console.error(`Failed to access collection: ${collectionName}, due to error: ${error.message}`);
            console.log("Attempting to reconnect due to error...");
            this.isConnected = false; // Reset connection status
            await this.connect(); // Attempt reconnection

            // Retry the operation after reconnection
            try {
                const collection = this.database.collection(collectionName);
                this.collectionCache[collectionName] = collection;
                return collection;
            } catch (retryError) {
                console.error(`Failed to access collection: ${collectionName}, after reconnection attempt, due to error: ${retryError.message}`);
                throw retryError; // Rethrow if still failing after reconnection attempt
            }
        }
    }
}

module.exports = DictClient;