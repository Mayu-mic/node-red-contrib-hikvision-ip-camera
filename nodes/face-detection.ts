import { Node, NodeAPI, NodeDef } from 'node-red'
import { IvmsConfigNode } from './ivms-config'
import { Client } from './client'

const DELAY = 2000

interface FaceDetectionNodeDef extends NodeDef {
  server: string
}

export interface FaceDetectionNode extends Node {
  config: IvmsConfigNode
}

const error = (node: FaceDetectionNode) => {
  node.error('error: failed to connect.')
  node.status({ fill: 'red', text: 'error: failed to connect.' })
}

module.exports = (RED: NodeAPI) => {
  function FaceDetectionNode(this: FaceDetectionNode, props: FaceDetectionNodeDef) {
    RED.nodes.createNode(this, props)
    this.config = RED.nodes.getNode(props.server) as IvmsConfigNode

    setTimeout(() => {
      this.status({ fill: 'yellow', text: 'connecting...' })

      const client = new Client(this.config)

      client.on('message', (message, raw) => {
        this.log(`FaceDetection received: ${raw}`)
        this.send({ payload: message })
      })
      client.on('afterStart', (process) => {
        this.log(`FaceDetection client process id: ${process?.pid}`)
        this.status({ fill: 'green', text: 'server connected.' })
      })
      client.on('error', (output) => {
        this.log(output)
      })
      client.on('stop', (code) => {
        if (code !== 0) {
          error(this)
        }
      })
      client.on('failedStart', () => {
        error(this)
      })

      client.listen()

      this.on('close', () => {
        client.stop()
        this.status({ fill: 'yellow', text: 'closed.' })
      })
    }, DELAY)
  }
  RED.nodes.registerType('face-detection', FaceDetectionNode)
}
