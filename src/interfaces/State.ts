export default interface State {
    isHeating: boolean
    currentTemperature: number
    desiredTemperature: number
    cycleStartedAt?: number
    isAdjusted: boolean
}
