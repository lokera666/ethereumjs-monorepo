import * as tape from 'tape'

import { baseRequest, createClient, createManager, params, startRPC } from '../helpers'

const method = 'net_peerCount'

tape(`${method}: call`, async (t) => {
  const manager = createManager(createClient({ opened: true, includeVM: true }))
  const server = startRPC(manager.getMethods())

  const req = params(method, [])
  const expectRes = (res: any) => {
    const { result } = res.body
    const msg = 'result should be a hex number'
    t.equal(result.substring(0, 2), '0x', msg)
  }
  await baseRequest(t, server, req, 200, expectRes)
})
