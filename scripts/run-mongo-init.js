import dotenv from 'dotenv';
import fs from 'fs';
import { MongoClient } from 'mongodb';
import vm from 'vm';

dotenv.config();

const initScriptPath = new URL(
  '../docs/mongodb-init.mongodb.js',
  import.meta.url,
);

if (!process.env.MONGO_URI) {
  throw new Error('MONGO_URI is missing');
}

const client = new MongoClient(process.env.MONGO_URI);

const createDbProxy = (database) =>
  new Proxy(database, {
    get(target, prop) {
      if (prop === 'getSiblingDB') {
        return (name) => createDbProxy(client.db(name));
      }

      if (prop === 'getCollectionNames') {
        return async () =>
          (await target.listCollections().toArray()).map((item) => item.name);
      }

      if (prop === 'runCommand') {
        return (command) => target.command(command);
      }

      if (prop === 'createCollection') {
        return (name, options) => target.createCollection(name, options);
      }

      if (typeof prop === 'string') {
        return target.collection(prop);
      }

      return target[prop];
    },
  });

const run = async () => {
  await client.connect();

  const script = fs.readFileSync(initScriptPath, 'utf8');
  const context = vm.createContext({
    db: createDbProxy(client.db()),
    console,
  });

  const wrappedScript = `(async () => { ${script} })()`;
  await vm.runInContext(wrappedScript, context, {
    filename: 'mongodb-init.mongodb.js',
  });

  console.log('MongoDB init completed');
};

try {
  await run();
} finally {
  await client.close();
}
