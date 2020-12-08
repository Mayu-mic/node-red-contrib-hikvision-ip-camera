import vm from 'vm'
import { spawn, ChildProcessByStdio } from 'child_process'
import { Readable } from 'stream'
import path from 'path'
import { EventEmitter } from 'events'

const BASE_DIR = path.resolve(__dirname, '../..')

interface ClientConfig {
  host: string
  port: number
  username: string
  password: string
}

type Event = 'beforeStart' | 'afterStart' | 'failedStart' | 'message' | 'error' | 'stop'

interface EventMessage {
  alermType: string
  employeeId: number
  temperature: number
  isTemperatureAbnormal: boolean
  picturePaths: {
    picture: string | null
    thermal: string | null
    visibleLight: string | null
  }
}

const parseMessage = (chunk: Buffer): EventMessage | undefined => {
  const chunkStr = chunk.toString()

  if (!chunkStr.match(/^\[MSG_SEND\]/)) return

  const extracted = chunkStr.replace(/^\[MSG_SEND\]\s+(.+)\n?/, '$1')
  const [
    alermType,
    employeeId,
    temperature,
    isTemperatureAbnormalNum,
    picturePath,
    thermalPicturePath,
    visibleLightPicturePath,
  ] = extracted.split(',')
  return {
    alermType,
    employeeId: parseInt(employeeId),
    temperature: parseFloat(temperature),
    isTemperatureAbnormal: isTemperatureAbnormalNum === '1',
    picturePaths: {
      picture: picturePath ? picturePath : null,
      thermal: thermalPicturePath ? thermalPicturePath : null,
      visibleLight: visibleLightPicturePath ? visibleLightPicturePath : null,
    },
  }
}

export class Client {
  private process: ChildProcessByStdio<null, Readable, Readable> | undefined = undefined
  private emitter: EventEmitter = new EventEmitter()

  constructor(private config: ClientConfig) {}

  listen(): void {
    try {
      this.process = this.runAndHandle()
    } catch (e) {
      console.error(e)
      this.emitter.emit('failedStart')
    }
  }

  stop(): void {
    this.process?.kill('SIGINT')
  }

  on(event: 'beforeStart', listener: () => void): void
  on(event: 'afterStart', listener: (process: ChildProcessByStdio<null, Readable, Readable> | undefined) => void): void
  on(event: 'failedStart', listener: () => void): void
  on(event: 'message', listener: (message: EventMessage, raw: string) => void): void
  on(event: 'error', listener: (output: string) => void): void
  on(event: 'stop', listener: (code: number) => void): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: Event, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener)
  }

  private runAndHandle(): ChildProcessByStdio<null, Readable, Readable> {
    const context = vm.createContext({
      spawn,
      emitter: this.emitter,
      config: this.config,
      parseMessage,
      io: {
        process: undefined,
      },
    })

    const code = `
      emitter.emit('beforeStart')
      io.process = spawn(
        './sdkTest',
        [config.host, config.port.toString(), config.username, config.password],
        {
          cwd: "${BASE_DIR}/client/linux64/lib",
        }
      )
      emitter.emit('afterStart', io.process)
      io.process.stdout.on('data', (chunk) => {
        const message = parseMessage(chunk)
        if (message) {
          emitter.emit('message', message, chunk.toString())
        }
      })
      io.process.stderr.on('data', (chunk) => emitter.emit('error', chunk.toString()))
      io.process.on('close', (code) => emitter.emit('stop', code))
    `
    vm.runInContext(code, context)
    return context.io.process
  }
}
