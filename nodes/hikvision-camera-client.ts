import * as request from 'request'
import * as fs from 'fs'
import * as net from 'net'
import NetKeepAlive from 'net-keepalive'
import { EventEmitter } from 'events'

interface HikvisionCameraServerSettings {
  host: string
  username: string
  password: string
}

interface HikvisionCameraClientSettings {
  reconnect_delay_ms: number
}

type HikvisionCameraClientEvent = 'connected' | 'connectFailed' | 'data' | 'error' | 'closed' | 'disconnected'
type HikvisionEventPictures = string[]

export class HikvisionCameraClient {
  constructor(
    private serverSettings: HikvisionCameraServerSettings,
    private clientSettings: HikvisionCameraClientSettings
  ) {}

  private req?: request.Request
  private socket?: net.Socket
  private timeout?: NodeJS.Timeout

  private emitter = new EventEmitter()

  connect(): void {
    const url = `http://${this.serverSettings.host}/ISAPI/event/notification/alertStream`
    try {
      this.req = request.get(url, {
        auth: {
          user: this.serverSettings.username,
          pass: this.serverSettings.password,
          sendImmediately: false,
        },
        headers: {
          Accept: 'multipart/x-mixed-replace',
        },
      })

      this.req.on('complete', (resp) => {
        if (resp.statusCode == 401) {
          this.emitter.emit('connectFailed')
        } else {
          this.emitter.emit('closed')
          this.info(`socket closed, reconnecting...`)
          this.timeout = setTimeout(() => this.connect(), this.clientSettings.reconnect_delay_ms)
        }
        this.info(`complete, statusCode: ${resp.statusCode}, body: ${resp.body}`)
      })

      this.req.on('socket', (socket) => {
        this.socket = socket
        socket.setKeepAlive(true, 1000)
        NetKeepAlive.setKeepAliveInterval(socket, 5000)
        NetKeepAlive.setKeepAliveProbes(socket, 12)

        socket.on('data', (data) => this.handleData(data))
        socket.on('error', (e) => this.emitter.emit('error', e.message))
        this.emitter.emit('connected')
      })
    } catch (e) {
      this.error(e)
      this.emitter.emit('connectFailed')
    }
  }

  disconnect(): void {
    this.socket?.destroy()
    this.req?.abort()
    if (this.timeout) {
      clearTimeout(this.timeout)
    }
    this.req = undefined
    this.socket = undefined
    this.timeout = undefined
    this.emitter.emit('disconnected')
  }

  on(event: 'connected', listener: () => void): void
  on(event: 'connectFailed', listener: () => void): void
  on(event: 'data', listener: (data: Hikvision.Event, pictures: HikvisionEventPictures) => void): void
  on(event: 'error', listener: (output: string) => void): void
  on(event: 'closed', listener: () => void): void
  on(event: 'disconnected', listener: () => void): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: HikvisionCameraClientEvent, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener)
  }

  private pictureFilename: string | undefined = undefined
  private pictureBuffer = ''
  private pictureContentLength: number | undefined = undefined
  private picturesCount = 0
  private pictures: HikvisionEventPictures = []
  private reservedEvent: Hikvision.Event | undefined = undefined

  private handleData(data: Buffer | string): void {
    data
      .toString('binary')
      .split('--MIME_boundary\r\n')
      .forEach((chunk) => this.handleChunk(chunk))
  }

  private handleChunk(chunk: string): void {
    const lines: (string | undefined)[] = chunk.split('\r\n')

    if (lines[0]?.match(/Content-Type\:\sapplication\/json/)) {
      this.reset()

      const body = lines[3]
      if (!body) return
      const utf8string = Buffer.from(body, 'binary').toString()
      const json = JSON.parse(utf8string) as Hikvision.Event
      this.picturesCount = json.AccessControllerEvent?.picturesNumber ?? 0
      if (this.picturesCount > 0) {
        this.reservedEvent = json
      } else {
        this.emitter.emit('data', json, [])
      }
    } else {
      if (lines[0]?.match(/Content-Disposition\:\sform-data/)) {
        this.pictureFilename = lines[0]?.match(/filename=\"([a-zA-Z0-9\.]+)\"/)?.[1]
        const countStr = lines[2]?.match(/Content-Length:\s(\d+)/)?.[1]
        const body = lines[5] ?? ''
        if (countStr) {
          this.pictureContentLength = parseInt(countStr)
        }
        this.pictureBuffer = body
      } else {
        this.pictureBuffer += chunk
      }

      if (
        this.pictureFilename &&
        this.pictureContentLength &&
        Buffer.byteLength(this.pictureBuffer, 'binary') >= this.pictureContentLength
      ) {
        const path = `${__dirname}/${this.pictureFilename}`
        fs.writeFileSync(path, this.pictureBuffer, 'binary')
        this.info(`${path} wrote.`)
        this.pictures.push(path)
        this.pictureBuffer = ''
        this.pictureContentLength = undefined
      }

      if (this.pictures.length == this.picturesCount) {
        this.sendReserved()
        this.reset()
      }
    }
  }

  private sendReserved() {
    if (this.reservedEvent) {
      this.emitter.emit('data', this.reservedEvent, this.pictures)
    }
  }

  private reset() {
    this.reservedEvent = undefined
    this.pictureFilename = undefined
    this.pictureContentLength = undefined
    this.pictureBuffer = ''
    this.pictures = []
    this.picturesCount = 0
  }

  private info(str: string) {
    console.info(`[hikvision-camera-client] ${str}`)
  }

  private error(str: string) {
    console.error(`[hikvision-camera-client] ${str}`)
  }
}
