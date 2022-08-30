import {
  EventWithId,
  Database,
  GenericSingleEventProcessor,
  PutAndGetDatabase,
  fromSingleEventProcessor,
} from 'ethereum-indexer-processors';

import { logs } from 'named-logs';
import { Token } from './database';

import eip721 from './eip721.json';

const console = logs('ERC721EventProcessor');

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export class ERC721EventProcessor extends GenericSingleEventProcessor {
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
  }

  async onTransfer(event: EventWithId): Promise<void> {
    const to = event.args.to as string;
    const from = event.args.from as string;
    const tokenID = event.args.id as string;
    const tokenContract = event.address;
    const id = `Token_${tokenContract}_${tokenID}`;

    let token = await this.db.get<Token>(id);

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
        await this.db.delete(id);
        return;
      } else {
        console.info(`setting new owner: ${to}`);
        token.owner = to;
      }
    }

    await this.db.put(token);
  }
}

// we export a factory function called processor
// the helper "fromSingleEventProcessor" will transform the single event processor...
// ... into the processor type expected by ethereum-indexer-server
export const processor = fromSingleEventProcessor(() => new ERC721EventProcessor());

// we expose contractsData as generic to be used on any chain
export const contractsData = {
  eventsABI: eip721,
};
// we also expose a object keyed by chainId and provide a block to start indexing from for optimization purpose
export const contractsDataPerChain = { 1: { ...contractsData, startBlock: 5806610 } };
