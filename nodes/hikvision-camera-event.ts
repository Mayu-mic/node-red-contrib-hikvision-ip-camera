import { Node, NodeAPI, NodeDef } from 'node-red'
import { HikvisionCameraConfigNode } from './hikvision-camera-config'
import { HikvisionCameraClient } from './hikvision-camera-client'

const DELAY = 10000

interface HikvisionCameraEventNodeDef extends NodeDef {
  camera: string
}

export interface HikvisionCameraEventNode extends Node {
  config: HikvisionCameraConfigNode
}

interface Payload extends Hikvision.Event {
  picturePaths: string[]
}

module.exports = (RED: NodeAPI) => {
  function HikvisionCameraEventNode(this: HikvisionCameraEventNode, props: HikvisionCameraEventNodeDef) {
    RED.nodes.createNode(this, props)
    this.config = RED.nodes.getNode(props.camera) as HikvisionCameraConfigNode

    this.status({ fill: 'yellow', text: 'connecting...' })

    setTimeout(() => {
      const client = new HikvisionCameraClient(this.config)
      client.on('afterStart', () => this.status({ fill: 'green', text: 'camera connected.' }))
      client.on('data', (data, picturePaths) => {
        const payload: Payload = { ...data, picturePaths }
        this.send({ payload })
      })
      client.on('error', (output) => this.log(`error: ${output}`))
      client.on('failedStart', (statusCode, statusMessage) => {
        this.error(`failed to connect. statusCode: ${statusCode} statusMessage: ${statusMessage}`)
        this.status({ fill: 'red', text: `failed to connect. statusCode: ${statusCode}` })
      })
      client.on('close', () => {
        this.status({ fill: 'yellow', text: 'reconnect in 10s' })
        this.log('socket timeout. reconnect in 10s')
        setTimeout(() => client.connect(), DELAY)
      })

      client.connect()

      this.on('close', () => {
        client.disconnect()
        this.status({ fill: 'yellow', text: 'closed.' })
      })
    }, DELAY)
  }
  RED.nodes.registerType('hikvision-camera-event', HikvisionCameraEventNode)
}
