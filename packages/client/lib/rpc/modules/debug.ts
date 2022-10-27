import { bigIntToHex, toBuffer } from '@ethereumjs/util'

import { INTERNAL_ERROR } from '../error-code'
import { middleware, validators } from '../validation'

import type { EthereumClient } from '../..'
import type { FullEthereumService } from '../../service'

/**
 * web3_* RPC module
 * @memberof module:rpc/modules
 */
export class Debug {
  private service: FullEthereumService
  /**
   * Create debug_* RPC module
   * @param client Client to which the module binds
   */
  constructor(client: EthereumClient) {
    this.service = client.services.find((s) => s.name === 'eth') as FullEthereumService
    this.traceTransaction = middleware(this.traceTransaction.bind(this), 1, [[validators.hex]])
  }

  /**
   * Returns a call trace for the requested transaction or null if not available
   * @param params string representing the transaction hash
   */
  async traceTransaction(params: [string]) {
    const [txHash] = params
    try {
      if (!this.service.execution.receiptsManager) throw new Error('missing receiptsManager')
      const result = await this.service.execution.receiptsManager.getReceiptByTxHash(
        toBuffer(txHash)
      )
      if (!result) return null
      const [_receipt, blockHash, txIndex] = result
      const block = await this.service.chain.getBlock(blockHash)
      const parentBlock = await this.service.chain.getBlock(block.header.parentHash)
      const tx = block.transactions[txIndex]

      // Copy VM so as to not modify state when running transactions being traced
      const vmCopy = await this.service.execution.vm.copy()
      await vmCopy.stateManager.setStateRoot(parentBlock.header.stateRoot)
      for (let x = 0; x < txIndex; x++) {
        // Run all txns in the block prior to the traced transaction
        await vmCopy.runTx({ tx: block.transactions[x], block })
      }

      const res = await vmCopy.runTx({ tx, block })

      return {
        type: 'CALL',
        from: tx.getSenderAddress().toString(),
        to: tx.to?.toString(),
        value: bigIntToHex(tx.value),
        gas: bigIntToHex(tx.gasLimit),
        gasUsed: bigIntToHex(res.totalGasSpent),
        input: '0x' + tx.data.toString('hex'),
        output: '0x' + res.execResult.returnValue.toString('hex'),
        error: res.execResult.exceptionError?.error,
        revertReason: res.execResult.exceptionError?.error,
        calls: [],
      }
    } catch (err: any) {
      throw {
        code: INTERNAL_ERROR,
        message: err.message.toString(),
      }
    }
  }
}
