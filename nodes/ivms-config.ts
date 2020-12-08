import { Node, NodeAPI, NodeDef } from 'node-red'

export interface IvmsConfigNode extends Node {
  host: string
  port: number
  username: string
  password: string
}

interface IvmsConfigDef extends NodeDef {
  host: string
  port: number
  username: string
  password: string
}

module.exports = (RED: NodeAPI) => {
  function IvmsConfigNode(this: IvmsConfigNode, props: IvmsConfigDef) {
    RED.nodes.createNode(this, props)
    this.host = props.host
    this.port = props.port
    this.username = props.username
    this.password = props.password
  }
  RED.nodes.registerType('ivms-config', IvmsConfigNode)
}
