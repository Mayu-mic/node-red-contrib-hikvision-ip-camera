import { Node, NodeAPI, NodeDef } from 'node-red'

export interface HikvisionCameraConfigNode extends Node {
  host: string
  username: string
  password: string
}

interface HikvisionCameraConfigDef extends NodeDef {
  host: string
  username: string
  password: string
}

module.exports = (RED: NodeAPI) => {
  function HikvisionCameraConfigNode(this: HikvisionCameraConfigNode, props: HikvisionCameraConfigDef) {
    RED.nodes.createNode(this, props)
    this.host = props.host
    this.username = props.username
    this.password = props.password
  }
  RED.nodes.registerType('hikvision-camera-config', HikvisionCameraConfigNode)
}
