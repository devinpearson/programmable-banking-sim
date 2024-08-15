import { server, port } from './app.js'

server.listen(port, () =>
  console.log(`Programmable banking sim listening on port ${port}!`),
)
