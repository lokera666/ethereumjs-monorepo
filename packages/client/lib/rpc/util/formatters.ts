import { bigIntToHex, bufferToHex, intToHex } from '@ethereumjs/util'

import type { Chain } from '../../blockchain'
import type { Block, JsonRpcBlock } from '@ethereumjs/block'
import type { Log } from '@ethereumjs/evm'
import type { JsonRpcTx, TypedTransaction } from '@ethereumjs/tx'
import type { Address } from '@ethereumjs/util'
import type { PostByzantiumTxReceipt, PreByzantiumTxReceipt, TxReceipt } from '@ethereumjs/vm'

export type GetLogsParams = {
  fromBlock?: string // QUANTITY, block number or "earliest" or "latest" (default: "latest")
  toBlock?: string // QUANTITY, block number or "latest" (default: "latest")
  address?: string // DATA, 20 Bytes, contract address from which logs should originate
  topics?: string[] // DATA, array, topics are order-dependent
  blockHash?: string // DATA, 32 Bytes. With the addition of EIP-234,
  // blockHash restricts the logs returned to the single block with
  // the 32-byte hash blockHash. Using blockHash is equivalent to
  // fromBlock = toBlock = the block number with hash blockHash.
  // If blockHash is present in in the filter criteria, then
  // neither fromBlock nor toBlock are allowed.
}

export type JsonRpcReceipt = {
  transactionHash: string // DATA, 32 Bytes - hash of the transaction.
  transactionIndex: string // QUANTITY - integer of the transactions index position in the block.
  blockHash: string // DATA, 32 Bytes - hash of the block where this transaction was in.
  blockNumber: string // QUANTITY - block number where this transaction was in.
  from: string // DATA, 20 Bytes - address of the sender.
  to: string | null // DATA, 20 Bytes - address of the receiver. null when it's a contract creation transaction.
  cumulativeGasUsed: string // QUANTITY  - The total amount of gas used when this transaction was executed in the block.
  effectiveGasPrice: string // QUANTITY - The final gas price per gas paid by the sender in wei.
  gasUsed: string // QUANTITY - The amount of gas used by this specific transaction alone.
  contractAddress: string | null // DATA, 20 Bytes - The contract address created, if the transaction was a contract creation, otherwise null.
  logs: JsonRpcLog[] // Array - Array of log objects, which this transaction generated.
  logsBloom: string // DATA, 256 Bytes - Bloom filter for light clients to quickly retrieve related logs.
  // It also returns either:
  root?: string // DATA, 32 bytes of post-transaction stateroot (pre Byzantium)
  status?: string // QUANTITY, either 1 (success) or 0 (failure)
}
export type JsonRpcLog = {
  removed: boolean // TAG - true when the log was removed, due to a chain reorganization. false if it's a valid log.
  logIndex: string | null // QUANTITY - integer of the log index position in the block. null when it's pending.
  transactionIndex: string | null // QUANTITY - integer of the transactions index position log was created from. null when it's pending.
  transactionHash: string | null // DATA, 32 Bytes - hash of the transactions this log was created from. null when it's pending.
  blockHash: string | null // DATA, 32 Bytes - hash of the block where this log was in. null when it's pending.
  blockNumber: string | null // QUANTITY - the block number where this log was in. null when it's pending.
  address: string // DATA, 20 Bytes - address from which this log originated.
  data: string // DATA - contains one or more 32 Bytes non-indexed arguments of the log.
  topics: string[] // Array of DATA - Array of 0 to 4 32 Bytes DATA of indexed log arguments.
  // (In solidity: The first topic is the hash of the signature of the event
  // (e.g. Deposit(address,bytes32,uint256)), except you declared the event with the anonymous specifier.)
}

/**
 * Returns tx formatted to the standard JSON-RPC fields
 */
export const jsonRpcTx = (tx: TypedTransaction, block?: Block, txIndex?: number): JsonRpcTx => {
  const txJSON = tx.toJSON()
  return {
    blockHash: block ? bufferToHex(block.hash()) : null,
    blockNumber: block ? bigIntToHex(block.header.number) : null,
    from: tx.getSenderAddress().toString(),
    gas: txJSON.gasLimit!,
    gasPrice: txJSON.gasPrice ?? txJSON.maxFeePerGas!,
    maxFeePerGas: txJSON.maxFeePerGas,
    maxPriorityFeePerGas: txJSON.maxPriorityFeePerGas,
    type: intToHex(tx.type),
    accessList: txJSON.accessList,
    chainId: txJSON.chainId,
    hash: bufferToHex(tx.hash()),
    input: txJSON.data!,
    nonce: txJSON.nonce!,
    to: tx.to?.toString() ?? null,
    transactionIndex: txIndex !== undefined ? intToHex(txIndex) : null,
    value: txJSON.value!,
    v: txJSON.v!,
    r: txJSON.r!,
    s: txJSON.s!,
  }
}

/**
 * Returns block formatted to the standard JSON-RPC fields
 */
export const jsonRpcBlock = async (
  block: Block,
  chain: Chain,
  includeTransactions: boolean
): Promise<JsonRpcBlock> => {
  const json = block.toJSON()
  const header = json!.header!
  const transactions = block.transactions.map((tx, txIndex) =>
    includeTransactions ? jsonRpcTx(tx, block, txIndex) : bufferToHex(tx.hash())
  )
  const td = await chain.getTd(block.hash(), block.header.number)
  return {
    number: header.number!,
    hash: bufferToHex(block.hash()),
    parentHash: header.parentHash!,
    mixHash: header.mixHash,
    nonce: header.nonce!,
    sha3Uncles: header.uncleHash!,
    logsBloom: header.logsBloom!,
    transactionsRoot: header.transactionsTrie!,
    stateRoot: header.stateRoot!,
    receiptsRoot: header.receiptTrie!,
    miner: header.coinbase!,
    difficulty: header.difficulty!,
    totalDifficulty: bigIntToHex(td),
    extraData: header.extraData!,
    size: intToHex(Buffer.byteLength(JSON.stringify(json))),
    gasLimit: header.gasLimit!,
    gasUsed: header.gasUsed!,
    timestamp: header.timestamp!,
    transactions,
    uncles: block.uncleHeaders.map((uh) => bufferToHex(uh.hash())),
    baseFeePerGas: header.baseFeePerGas,
  }
}

/**
 * Returns log formatted to the standard JSON-RPC fields
 */
export const jsonRpcLog = async (
  log: Log,
  block?: Block,
  tx?: TypedTransaction,
  txIndex?: number,
  logIndex?: number
): Promise<JsonRpcLog> => ({
  removed: false, // TODO implement
  logIndex: logIndex !== undefined ? intToHex(logIndex) : null,
  transactionIndex: txIndex !== undefined ? intToHex(txIndex) : null,
  transactionHash: tx ? bufferToHex(tx.hash()) : null,
  blockHash: block ? bufferToHex(block.hash()) : null,
  blockNumber: block ? bigIntToHex(block.header.number) : null,
  address: bufferToHex(log[0]),
  topics: log[1].map((t) => bufferToHex(t as Buffer)),
  data: bufferToHex(log[2]),
})

/**
 * Returns receipt formatted to the standard JSON-RPC fields
 */
export const jsonRpcReceipt = async (
  receipt: TxReceipt,
  gasUsed: bigint,
  effectiveGasPrice: bigint,
  block: Block,
  tx: TypedTransaction,
  txIndex: number,
  logIndex: number,
  contractAddress?: Address
): Promise<JsonRpcReceipt> => ({
  transactionHash: bufferToHex(tx.hash()),
  transactionIndex: intToHex(txIndex),
  blockHash: bufferToHex(block.hash()),
  blockNumber: bigIntToHex(block.header.number),
  from: tx.getSenderAddress().toString(),
  to: tx.to?.toString() ?? null,
  cumulativeGasUsed: bigIntToHex(receipt.cumulativeBlockGasUsed),
  effectiveGasPrice: bigIntToHex(effectiveGasPrice),
  gasUsed: bigIntToHex(gasUsed),
  contractAddress: contractAddress?.toString() ?? null,
  logs: await Promise.all(
    receipt.logs.map((l, i) => jsonRpcLog(l, block, tx, txIndex, logIndex + i))
  ),
  logsBloom: bufferToHex(receipt.bitvector),
  root: Buffer.isBuffer((receipt as PreByzantiumTxReceipt).stateRoot)
    ? bufferToHex((receipt as PreByzantiumTxReceipt).stateRoot)
    : undefined,
  status: Buffer.isBuffer((receipt as PostByzantiumTxReceipt).status)
    ? intToHex((receipt as PostByzantiumTxReceipt).status)
    : undefined,
})
