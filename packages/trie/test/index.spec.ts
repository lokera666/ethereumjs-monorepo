// explicitly import buffer,
// needed for karma-typescript bundling
import { RLP } from '@ethereumjs/rlp'
import { KECCAK256_NULL, KECCAK256_RLP_S, bufArrToArr } from '@ethereumjs/util'
import { Buffer } from 'buffer'
import { blake2b } from 'ethereum-cryptography/blake2b'
import { keccak256 } from 'ethereum-cryptography/keccak'
import * as tape from 'tape'

import { LeafNode, Trie } from '../src'
import { bufferToNibbles } from '../src/util/nibbles'

import type { HashKeysFunction } from '../src'

tape('simple save and retrieve', function (tester) {
  const it = tester.test

  it('should not crash if given a non-existent root', async function (t) {
    const root = Buffer.from(
      '3f4399b08efe68945c1cf90ffe85bbe3ce978959da753f9e649f034015b8817d',
      'hex'
    )
    const trie = new Trie({ root })
    const value = await trie.get(Buffer.from('test'))
    t.equal(value, null)
    t.end()
  })

  const trie = new Trie()

  it('save a value', async function (t) {
    await trie.put(Buffer.from('test'), Buffer.from('one'))
    t.end()
  })

  it('should get a value', async function (t) {
    const value = await trie.get(Buffer.from('test'))
    t.equal(value!.toString(), 'one')
    t.end()
  })

  it('should update a value', async function (t) {
    await trie.put(Buffer.from('test'), Buffer.from('two'))
    const value = await trie.get(Buffer.from('test'))
    t.equal(value!.toString(), 'two')
    t.end()
  })

  it('should delete a value', async function (t) {
    await trie.del(Buffer.from('test'))
    const value = await trie.get(Buffer.from('test'))
    t.notok(value)
    t.end()
  })

  it('should recreate a value', async function (t) {
    await trie.put(Buffer.from('test'), Buffer.from('one'))
    t.end()
  })

  it('should get updated a value', async function (t) {
    const value = await trie.get(Buffer.from('test'))
    t.equal(value!.toString(), 'one')
    t.end()
  })

  it('should create a branch here', async function (t) {
    await trie.put(Buffer.from('doge'), Buffer.from('coin'))
    t.equal(
      'de8a34a8c1d558682eae1528b47523a483dd8685d6db14b291451a66066bf0fc',
      trie.root().toString('hex')
    )
    t.end()
  })

  it('should get a value that is in a branch', async function (t) {
    const value = await trie.get(Buffer.from('doge'))
    t.equal(value!.toString(), 'coin')
    t.end()
  })

  it('should delete from a branch', async function (t) {
    await trie.del(Buffer.from('doge'))
    const value = await trie.get(Buffer.from('doge'))
    t.equal(value, null)
    t.end()
  })

  tape('storing longer values', async function (tester) {
    const it = tester.test
    const trie = new Trie()
    const longString = 'this will be a really really really long value'
    const longStringRoot = 'b173e2db29e79c78963cff5196f8a983fbe0171388972106b114ef7f5c24dfa3'

    it('should store a longer string', async function (t) {
      await trie.put(Buffer.from('done'), Buffer.from(longString))
      await trie.put(Buffer.from('doge'), Buffer.from('coin'))
      t.equal(longStringRoot, trie.root().toString('hex'))
      t.end()
    })

    it('should retrieve a longer value', async function (t) {
      const value = await trie.get(Buffer.from('done'))
      t.equal(value!.toString(), longString)
      t.end()
    })

    it('should when being modified delete the old value', async function (t) {
      await trie.put(Buffer.from('done'), Buffer.from('test'))
      t.end()
    })
  })

  tape('testing extensions and branches', function (tester) {
    const it = tester.test
    const trie = new Trie()

    it('should store a value', async function (t) {
      await trie.put(Buffer.from('doge'), Buffer.from('coin'))
      t.end()
    })

    it('should create extension to store this value', async function (t) {
      await trie.put(Buffer.from('do'), Buffer.from('verb'))
      t.equal(
        'f803dfcb7e8f1afd45e88eedb4699a7138d6c07b71243d9ae9bff720c99925f9',
        trie.root().toString('hex')
      )
      t.end()
    })

    it('should store this value under the extension', async function (t) {
      await trie.put(Buffer.from('done'), Buffer.from('finished'))
      t.equal(
        '409cff4d820b394ed3fb1cd4497bdd19ffa68d30ae34157337a7043c94a3e8cb',
        trie.root().toString('hex')
      )
      t.end()
    })
  })

  tape('testing extensions and branches - reverse', function (tester) {
    const it = tester.test
    const trie = new Trie()

    it('should create extension to store this value', async function (t) {
      await trie.put(Buffer.from('do'), Buffer.from('verb'))
      t.end()
    })

    it('should store a value', async function (t) {
      await trie.put(Buffer.from('doge'), Buffer.from('coin'))
      t.end()
    })

    it('should store this value under the extension', async function (t) {
      await trie.put(Buffer.from('done'), Buffer.from('finished'))
      t.equal(
        '409cff4d820b394ed3fb1cd4497bdd19ffa68d30ae34157337a7043c94a3e8cb',
        trie.root().toString('hex')
      )
      t.end()
    })
  })
})

tape('testing deletion cases', function (tester) {
  const it = tester.test
  const trieSetup = {
    trie: new Trie(),
    msg: 'without DB delete',
  }

  it('should delete from a branch->branch-branch', async function (t) {
    await trieSetup.trie.put(Buffer.from([11, 11, 11]), Buffer.from('first'))
    await trieSetup.trie.put(Buffer.from([12, 22, 22]), Buffer.from('create the first branch'))
    await trieSetup.trie.put(Buffer.from([12, 34, 44]), Buffer.from('create the last branch'))

    await trieSetup.trie.del(Buffer.from([12, 22, 22]))
    const val = await trieSetup.trie.get(Buffer.from([12, 22, 22]))
    t.equal(null, val, trieSetup.msg)
    t.end()
  })

  it('should delete from a branch->branch-extension', async function (t) {
    await trieSetup.trie.put(Buffer.from([11, 11, 11]), Buffer.from('first'))
    await trieSetup.trie.put(Buffer.from([12, 22, 22]), Buffer.from('create the first branch'))
    await trieSetup.trie.put(Buffer.from([12, 33, 33]), Buffer.from('create the middle branch'))
    await trieSetup.trie.put(Buffer.from([12, 34, 44]), Buffer.from('create the last branch'))

    await trieSetup.trie.del(Buffer.from([12, 22, 22]))
    const val = await trieSetup.trie.get(Buffer.from([12, 22, 22]))
    t.equal(null, val, trieSetup.msg)

    t.end()
  })

  it('should delete from a extension->branch-extension', async function (t) {
    await trieSetup.trie.put(Buffer.from([11, 11, 11]), Buffer.from('first'))
    await trieSetup.trie.put(Buffer.from([12, 22, 22]), Buffer.from('create the first branch'))
    await trieSetup.trie.put(Buffer.from([12, 33, 33]), Buffer.from('create the middle branch'))
    await trieSetup.trie.put(Buffer.from([12, 34, 44]), Buffer.from('create the last branch'))

    // delete the middle branch
    await trieSetup.trie.del(Buffer.from([11, 11, 11]))
    const val = await trieSetup.trie.get(Buffer.from([11, 11, 11]))
    t.equal(null, val, trieSetup.msg)

    t.end()
  })

  it('should delete from a extension->branch-branch', async function (t) {
    await trieSetup.trie.put(Buffer.from([11, 11, 11]), Buffer.from('first'))
    await trieSetup.trie.put(Buffer.from([12, 22, 22]), Buffer.from('create the first branch'))
    await trieSetup.trie.put(Buffer.from([12, 33, 33]), Buffer.from('create the middle branch'))
    await trieSetup.trie.put(Buffer.from([12, 34, 44]), Buffer.from('create the last branch'))
    // delete the middle branch
    await trieSetup.trie.del(Buffer.from([11, 11, 11]))
    const val = await trieSetup.trie.get(Buffer.from([11, 11, 11]))
    t.equal(null, val, trieSetup.msg)

    t.end()
  })
})

tape('shall handle the case of node not found correctly', async (t) => {
  const trie = new Trie()
  await trie.put(Buffer.from('a'), Buffer.from('value1'))
  await trie.put(Buffer.from('aa'), Buffer.from('value2'))
  await trie.put(Buffer.from('aaa'), Buffer.from('value3'))

  /* Setups a trie which consists of
    ExtensionNode ->
    BranchNode -> value1
    ExtensionNode ->
    BranchNode -> value2
    LeafNode -> value3
  */

  let path = await trie.findPath(Buffer.from('aaa'))

  t.ok(path.node !== null, 'findPath should find a node')

  const { stack } = await trie.findPath(Buffer.from('aaa'))
  // @ts-expect-error
  await trie._db.del(Buffer.from(keccak256(stack[1].serialize()))) // delete the BranchNode -> value1 from the DB

  path = await trie.findPath(Buffer.from('aaa'))

  t.ok(path.node === null, 'findPath should not return a node now')
  t.ok(
    path.stack.length === 1,
    'findPath should find the first extension node which is still in the DB'
  )

  t.end()
})

tape('it should create the genesis state root from ethereum', function (tester) {
  const it = tester.test
  const trie4 = new Trie()

  const g = Buffer.from('8a40bfaa73256b60764c1bf40675a99083efb075', 'hex')
  const j = Buffer.from('e6716f9544a56c530d868e4bfbacb172315bdead', 'hex')
  const v = Buffer.from('1e12515ce3e0f817a4ddef9ca55788a1d66bd2df', 'hex')
  const a = Buffer.from('1a26338f0d905e295fccb71fa9ea849ffa12aaf4', 'hex')

  const storageRoot = Buffer.alloc(32)
  storageRoot.fill(0)

  const startAmount = Buffer.alloc(26)
  startAmount.fill(0)
  startAmount[0] = 1

  const account = [startAmount, 0, storageRoot, KECCAK256_NULL]
  const rlpAccount = Buffer.from(RLP.encode(bufArrToArr(account as Buffer[])))
  const cppRlp =
    'f85e9a010000000000000000000000000000000000000000000000000080a00000000000000000000000000000000000000000000000000000000000000000a0c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470'

  const genesisStateRoot = '2f4399b08efe68945c1cf90ffe85bbe3ce978959da753f9e649f034015b8817d'
  tester.equal(cppRlp, rlpAccount.toString('hex'))

  it('shall match the root', async function (t) {
    await trie4.put(g, rlpAccount)
    await trie4.put(j, rlpAccount)
    await trie4.put(v, rlpAccount)
    await trie4.put(a, rlpAccount)
    t.equal(trie4.root().toString('hex'), genesisStateRoot)
    t.end()
  })
})

tape('setting back state root (deleteFromDB)', async (t) => {
  const k1 = Buffer.from('1')
  /* Testing with longer value due to `rlpNode.length >= 32` check in `_formatNode()`
   * Reasoning from https://ethereum.org/en/developers/docs/data-structures-and-encoding/patricia-merkle-trie/:
   * "When one node is referenced inside another node, what is included is `H(rlp.encode(x))`,
   * where `H(x) = sha3(x) if len(x) >= 32 else x`"
   */
  const v1 = Buffer.from('this-is-some-longer-value-to-test-the-delete-operation-value1')
  const k2 = Buffer.from('2')
  const v2 = Buffer.from('this-is-some-longer-value-to-test-the-delete-operation-value2')

  const rootAfterK1 = Buffer.from(
    '809e75931f394603657e113eb7244794f35b8d326cff99407111d600722e9425',
    'hex'
  )

  const trieSetup = {
    trie: new Trie(),
    expected: v1,
    msg: 'should return v1 when setting back the state root when deleteFromDB=false',
  }

  await trieSetup.trie.put(k1, v1)
  await trieSetup.trie.put(k2, v2)
  await trieSetup.trie.del(k1)
  t.equal(
    await trieSetup.trie.get(k1),
    null,
    'should return null on latest state root independently from deleteFromDB setting'
  )

  trieSetup.trie.root(rootAfterK1)
  t.deepEqual(await trieSetup.trie.get(k1), trieSetup.expected, trieSetup.msg)

  t.end()
})

tape('dummy hash', async (t) => {
  const useKeyHashingFunction: HashKeysFunction = (msg) => {
    const hashLen = 32
    if (msg.length <= hashLen - 5) {
      return Buffer.concat([Buffer.from('hash_'), Buffer.alloc(hashLen - msg.length, 0), msg])
    } else {
      return Buffer.concat([Buffer.from('hash_'), msg.slice(0, hashLen - 5)])
    }
  }

  const [k, v] = [Buffer.from('foo'), Buffer.from('bar')]
  const expectedRoot = Buffer.from(
    useKeyHashingFunction(new LeafNode(bufferToNibbles(k), v).serialize())
  )

  const trie = new Trie({ useKeyHashingFunction })
  await trie.put(k, v)
  t.equal(trie.root().toString('hex'), expectedRoot.toString('hex'))

  t.end()
})

tape('blake2b256 trie root', async (t) => {
  const trie = new Trie({ useKeyHashingFunction: (msg) => blake2b(msg, 32) })
  await trie.put(Buffer.from('foo'), Buffer.from('bar'))

  t.equal(
    trie.root().toString('hex'),
    'e118db4e01512253df38daafa16fc1d69e03e755595b5847d275d7404ebdc74a'
  )
  t.end()
})

tape('empty root', async (t) => {
  const trie = new Trie()

  t.equal(trie.root().toString('hex'), KECCAK256_RLP_S)
  t.end()
})
