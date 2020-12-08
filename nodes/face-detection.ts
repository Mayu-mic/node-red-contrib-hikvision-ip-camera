import { Node, NodeAPI, NodeDef } from 'node-red'
import { spawn, ChildProcessByStdio } from 'child_process'
import { Readable } from 'stream'
import { IvmsConfigNode } from './ivms-config'
import path from 'path'
import vm from 'vm'
import { Context } from 'vm'

const DELAY = 2000
const BASE_DIR = path.resolve(__dirname, '../..')

interface FaceDetectionNodeDef extends NodeDef {
  server: string
}

interface FaceDetectionNode extends Node {
  config: IvmsConfigNode
}

interface Payload {
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

const sendMessage = (node: Node, chunkedMessage: string): void => {
  if (!chunkedMessage.match(/^\[MSG_SEND\]/)) return

  const extracted = chunkedMessage.replace(/^\[MSG_SEND\]\s+(.+)\n?/, '$1')
  node.log(`FaceDetection received: ${extracted}`)
  const [
    alermType,
    employeeId,
    temperature,
    isTemperatureAbnormalNum,
    picturePath,
    thermalPicturePath,
    visibleLightPicturePath,
  ] = extracted.split(',')
  const payload: Payload = {
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
  if (payload) {
    node.send({ payload })
  }
}

const runAndHandle = (node: FaceDetectionNode): Context => {
  const context = vm.createContext({
    sendMessage,
    spawn,
    node,
    io: {
      process: null,
    },
  })

  const code = `
    io.process = spawn(
      './sdkTest',
      [node.config.host, node.config.port.toString(), node.config.username, node.config.password],
      {
        cwd: "${BASE_DIR}/client/linux64/lib",
      }
    )
    node.log(\`FaceDetection client process id: \${io.process.pid}\`)
    node.status({ fill: 'green', text: 'server connected.' })

    io.process.stdout.on('data', (chunk) => {
      sendMessage(node, chunk.toString())
    })
    io.process.stderr.on('data', (chunk) => {
      node.log(chunk.toString())
    })
    io.process.on('close', (code) => {
      if (code !== 0) {
        node.error('error: failed to connect.')
        node.status({ fill: 'red', text: 'error: failed to connect.' })
      }
    })
  `
  vm.runInContext(code, context)

  return context
}

module.exports = (RED: NodeAPI) => {
  function FaceDetectionNode(this: FaceDetectionNode, props: FaceDetectionNodeDef) {
    RED.nodes.createNode(this, props)
    this.config = RED.nodes.getNode(props.server) as IvmsConfigNode

    setTimeout(() => {
      this.status({ fill: 'yellow', text: 'connecting...' })

      try {
        const context = runAndHandle(this)
        this.on('close', () => {
          const process = context.io.process as ChildProcessByStdio<null, Readable, Readable> | null
          process?.kill('SIGINT')
          this.status({ fill: 'yellow', text: 'closed.' })
        })
      } catch {
        this.status({ fill: 'red', text: 'error: failed to connect.' })
        this.error(`error: failed to connect.`)
      }
    }, DELAY)
  }
  RED.nodes.registerType('face-detection', FaceDetectionNode)
}
