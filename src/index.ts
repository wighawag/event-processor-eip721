import {
  EventWithId,
  Database,
  SingleEventProcessorWithBatchSupport,
  Dependency,
  SyncDB,
  fromSingleEventProcessorWithBatchSupportObject,
} from 'ethereum-indexer-processors';

import { logs } from 'named-logs';
import { Token } from './database';

import eip721 from './eip721.json';

const console = logs('ERC721EventProcessor');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function dbIDForToken(tokenContract: string, tokenID: string): string {
  return `Token_${tokenContract}_${tokenID}`;
}

const ERC721EventProcessor: SingleEventProcessorWithBatchSupport & any = {
  async setup(db: Database): Promise<void> {
    await db.setup({
      indexes: [
        {
          fields: ['eventID'], // required by RevertableDatabase
        },
        {
          fields: ['endBlock'], // required by RevertableDatabase
        },
        { fields: ['kind'] },
        {
          fields: ['tokenContract', 'tokenID', 'owner'], // Token
        },
        {
          fields: ['address'], // Owner & TokenContract
        },
      ],
    });
  },

  onTransfer: {
    // return the list of ids to fetch from DB
    // this will be executed for all events received in batch
    // allow the processor to batch fetch before processing, speeding up the whole operation
    // it return an array composed of id or function that can fetch further id
    // DO no support recusrive depndencies yet
    dependencies(event: EventWithId): Dependency[] {
      const tokenID = event.args.id as string;
      const tokenContract = event.address;
      const id = `Token_${tokenContract}_${tokenID}`;
      return [id];
    },
    // do the actual process and it operate synchronously
    processEvent(db: SyncDB, event: EventWithId) {
      const to = event.args.to as string;

      const tokenID = event.args.id as string;
      const tokenContract = event.address;
      const id = dbIDForToken(tokenContract, tokenID);

      let token = db.get<Token>(id);

      if (!token) {
        console.info(`new token ${id}: with owner: ${to}`);
        token = {
          _id: id,
          kind: 'Token',
          owner: to,
          tokenID,
          tokenContract,
        };
      } else {
        console.info(`token ${id} already exists`);
        if (to === ZERO_ADDRESS) {
          console.info(`deleting it...`);
          db.delete(id);
          return;
        } else {
          console.info(`setting new owner: ${to}`);
          token.owner = to;
        }
      }

      db.put(token);
    },
  },
};

// we export a factory function called processor
// the helper "fromSingleEventProcessorObject" will transform the single event processor...
// ... into the processor type expected by ethereum-indexer-server
export const processor = fromSingleEventProcessorWithBatchSupportObject(() => ERC721EventProcessor);

// we expose contractsData as generic to be used on any chain
export const contractsData = {
  eventsABI: eip721,
};
// we also expose a object keyed by chainId and provide a block to start indexing from for optimization purpose
export const contractsDataPerChain = { 1: { ...contractsData, startBlock: 5806610 } };
