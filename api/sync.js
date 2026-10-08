import { endpoint, method, user } from '../server/http.js'
import { sync } from '../server/memory.js'
export default endpoint(async (req, res) => {
  method(req, 'GET')
  const account = await user(req)
  res.json(await sync(account.id, String(req.query.cursor || '0')))
})
