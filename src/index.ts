import { server, port } from './app.js'
import { sandboxDate } from './clock.js'
import { runDueUpTo } from './schedules.js'

server.listen(port, () =>
  console.log(`Programmable banking sim listening on port ${port}!`),
)

// Real days pass too: run anything due (schedules, holds to settle) at
// startup and every minute. Advancing the clock runs them straight away.
const runDue = () =>
  runDueUpTo(sandboxDate()).catch(error => console.log('Error running schedules:', error))
void runDue()
setInterval(runDue, 60_000).unref()
