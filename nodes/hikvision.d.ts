declare namespace Hikvision {
  export interface RegionCoordinates {
    positionX: number
    positionY: number
  }

  export interface AccessControllerEvent {
    deviceName: string
    majorEventType: number
    subEventType?: number
    name: string
    reportChannel: number
    cardReaderKind: number
    cardReaderNo: number
    verifyNo: number
    employeeNoString: string
    serialNo: number
    currentVerifyMode: string
    currentEvent: boolean
    thermometryUnit: string
    currTemperature: number
    bodyMaxTemperatureValue: number
    isAbnomalTemperature: boolean
    RegionCoordinates: RegionCoordinates
    mask: string
    frontSerialNo: number
    attendanceStatus: string
    statusValue: number
    picturesNumber: number
  }

  export interface Event {
    ipAddress: string
    portNo: number
    channelID: number
    dateTime: Date
    activePostCount: number
    eventType: string
    eventState: string
    eventDescription: string
    AccessControllerEvent?: AccessControllerEvent
  }
}
