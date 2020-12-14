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
      client.on('error', (output) => this.log(`HikvisionCameraEvent error: ${output}`))
      client.on('failedStart', () => {
        this.error('error: failed to connect.')
        this.status({ fill: 'red', text: 'error: failed to connect.' })
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
