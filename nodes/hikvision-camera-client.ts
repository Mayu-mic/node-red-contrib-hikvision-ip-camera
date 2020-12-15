import * as request from 'request'
import * as net from 'net'
import * as fs from 'fs'
import { EventEmitter } from 'events'
import NetKeepAlive from 'net-keepalive'

interface HikvisionCameraClientOptions {
  host: string
  username: string
  password: string
}

type HikvisionCameraClientEvent = 'beforeStart' | 'afterStart' | 'failedStart' | 'data' | 'error' | 'stop'
type HikvisionEventPictures = string[]

export class HikvisionCameraClient {
  constructor(private options: HikvisionCameraClientOptions) {}

  private socket?: net.Socket

  private emitter = new EventEmitter()

  connect(): void {
    this.emitter.emit('beforeStart')

    const url = `http://${this.options.host}/ISAPI/event/notification/alertStream`
    const req = request.get(url, {
      auth: {
        user: this.options.username,
        pass: this.options.password,
        sendImmediately: false,
      },
      headers: {
        Accept: 'multipart/x-mixed-replace',
      },
    })

    req.on('complete', (resp) => {
      if (resp.statusCode == 404) {
        this.emitter.emit('failedStart')
      }
    })

    req.on('socket', (socket) => {
      this.socket = socket
      socket.setKeepAlive(true)
      NetKeepAlive.setKeepAliveInterval(socket, 5000)
      NetKeepAlive.setKeepAliveProbes(socket, 1)

      this.emitter.emit('afterStart')

      socket.on('data', (data) => this.handleData(data))
      socket.on('error', (e) => this.emitter.emit('error', e.message))
    })
  }

  disconnect(): void {
    this.emitter.emit('stop')
    this.socket?.destroy()
  }

  on(event: 'beforeStart', listener: () => void): void
  on(event: 'afterStart', listener: () => void): void
  on(event: 'failedStart', listener: () => void): void
  on(event: 'data', listener: (data: Hikvision.Event, pictures: HikvisionEventPictures) => void): void
  on(event: 'error', listener: (output: string) => void): void
  on(event: 'stop', listener: () => void): void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: HikvisionCameraClientEvent, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener)
  }

  private filename: string | undefined = undefined
  private pictureBuffer = ''
  private pictureContentLength: number | undefined = undefined
  private picturesCount = 0
  private pictures: HikvisionEventPictures = []
  private reservedEvent: Hikvision.Event | undefined = undefined

  private handleData(data: Buffer): void {
    data
      .toString('binary')
      .split('--MIME_boundary\r\n')
      .forEach((chunk) => this.handleChunk(chunk))
  }

  private handleChunk(chunk: string): void {
    const lines = chunk.split('\r\n')

    if (lines[0].match(/Content-Type\:\sapplication\/json/)) {
      const utf8string = Buffer.from(lines[3], 'binary').toString()
      const json = JSON.parse(utf8string) as Hikvision.Event
      this.picturesCount = json.AccessControllerEvent?.picturesNumber ?? 0
      if (this.picturesCount > 0) {
        this.reservedEvent = json
      } else {
        // 何らかの要因で、画像が受信できなかった場合に、前のデータをemitする
        this.sendAndReset()
        this.emitter.emit('data', json, [])
      }
    } else {
      if (lines[0].match(/Content-Disposition\:\sform-data/)) {
        this.filename = lines[0].match(/filename=\"([a-zA-Z0-9\.]+)\"/)?.[1]
        const countStr = lines[2].match(/Content-Length:\s(\d+)/)?.[1]
        if (countStr) {
          this.pictureContentLength = parseInt(countStr)
        }
        this.pictureBuffer = lines[5]
      } else {
        this.pictureBuffer += chunk
      }

      if (
        this.filename &&
        this.pictureContentLength &&
        Buffer.byteLength(this.pictureBuffer, 'binary') >= this.pictureContentLength
      ) {
        const path = `${__dirname}/${this.filename}`
        fs.writeFileSync(path, this.pictureBuffer, 'binary')
        console.log(`${path} wrote.`)
        this.pictures.push(path)
        this.pictureBuffer = ''
        this.pictureContentLength = undefined
      }

      if (this.pictures.length == this.picturesCount) {
        this.sendAndReset()
      }
    }
  }

  private sendAndReset() {
    if (this.reservedEvent) {
      this.emitter.emit('data', this.reservedEvent, this.pictures)
    }
    this.filename = undefined
    this.pictureContentLength = undefined
    this.reservedEvent = undefined
    this.pictureBuffer = ''
    this.pictures = []
    this.picturesCount = 0
  }
}
