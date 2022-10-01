export default interface State {
    isHeating: boolean
    currentTemperature: number
    currentMinTemperatureSet: number
    desiredTemperature: number
    cycleStartedAt?: number
    isAdjusted: boolean
}
