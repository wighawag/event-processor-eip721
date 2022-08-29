import { FromDB } from 'ethereum-indexer-processors';

export type Owner = FromDB<{
  kind: 'Owner';
  address: string;
}>;

export type Token = FromDB<{
  kind: 'Token';
  owner: string;
  tokenID: string;
  tokenContract: string;
}>;

export type TokenContract = FromDB<{
  kind: 'TokenContract';
  address: string;
}>;
