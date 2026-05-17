let createClient;
try {
  ({ createClient } = require('redis'));
} catch (error) {
  createClient = null;
}

let clientPromise = null;
let unavailableLogged = false;

async function getRedisClient() {
  const redisUrl = String(process.env.REDIS_URL || '').trim();
  if (!redisUrl || !createClient) return null;

  if (!clientPromise) {
    clientPromise = (async () => {
      const client = createClient({ url: redisUrl });
      client.on('error', (error) => {
        if (!unavailableLogged) {
          unavailableLogged = true;
          console.error('Redis unavailable, falling back to local memory:', error.message);
        }
      });

      try {
        await client.connect();
        return client;
      } catch (error) {
        if (!unavailableLogged) {
          unavailableLogged = true;
          console.error('Redis connect failed, falling back to local memory:', error.message);
        }
        clientPromise = null;
        try {
          await client.disconnect();
        } catch (disconnectError) {}
        return null;
      }
    })();
  }

  return clientPromise;
}

module.exports = {
  getRedisClient
};
