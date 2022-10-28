import { bigIntToHex, bufferToHex, isZeroAddress, toBuffer } from '@ethereumjs/util'

import { INTERNAL_ERROR, INVALID_PARAMS } from '../error-code'
import { middleware, validators } from '../validation'

import type { EthereumClient } from '../..'
import type { FullEthereumService } from '../../service'

interface tracerOpts {
  disableStack?: boolean
  disableStorage?: boolean
  enableMemory?: boolean
  enableReturnData?: boolean
}
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
  async traceTransaction(params: [string, tracerOpts]) {
    const [txHash, opts] = params
    try {
      if (!this.service.execution.receiptsManager) throw new Error('missing receiptsManager')
      const result = await this.service.execution.receiptsManager.getReceiptByTxHash(
        toBuffer(txHash)
      )
      if (!result) return null
      const [_, blockHash, txIndex] = result
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

      const trace: any = {
        gas: '',
        returnValue: '',
        failed: false,
        structLogs: [],
      }
      vmCopy.evm.events?.on('step', async (step, next) => {
        if (opts.disableStorage === false) {
          throw {
            code: INVALID_PARAMS,
            message: 'storage retrieval not implemented',
          }
        }

        const memory = []
        if (opts.enableMemory === true) {
          for (let x = 0; x < step.memoryWordCount; x++) {
            const word = bufferToHex(step.memory.slice(x * 32, 32))
            memory.push(word)
          }
        }
        const log = {
          pc: step.pc,
          op: step.opcode.name,
          gasCost: step.opcode.fee + Number(step.opcode.dynamicFee),
          gas: Number(step.gasLeft),
          depth: step.depth,
          error: null,
          stack:
            opts.disableStack !== true ? step.stack.map((entry) => bigIntToHex(entry)) : undefined,
          storage: {},
          memory,
          returnData:
            opts.enableReturnData === true
              ? step.returnStack.map((entry) => bigIntToHex(entry))
              : undefined,
        }
        trace.structLogs.push(log)
        next?.()
      })

      vmCopy.evm.events?.on('afterMessage', (data, next) => {
        if (data.execResult.exceptionError !== undefined && trace.structLogs.length > 0) {
          // Mark last opcode trace as error if exception occurs
          trace.structLogs[trace.structLogs.length - 1].error = true
        }
        next?.()
      })
      const res = await vmCopy.runTx({ tx, block })
      trace.gas = bigIntToHex(res.totalGasSpent)
      trace.failed = res.execResult.exceptionError !== undefined
      trace.returnValue = bufferToHex(res.execResult.returnValue)
      return trace
    } catch (err: any) {
      console.log('EEERRRROOOR', err)
      throw {
        code: INTERNAL_ERROR,
        message: err.message.toString(),
      }
    }
  }
}
