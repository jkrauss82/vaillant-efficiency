import State from './interfaces/State'
import { getValueFromJsonByPath } from './helper'
import dotenv from 'dotenv'
import { execSync } from 'child_process'

let currentState: State = null

const ebusdSetTempCmd = `ebusctl write -s ${process.env.QQ} -c ${process.env.CIRCUIT} ${process.env.ITEM}`

async function fetchStatus(): Promise<State> {
    console.log('Requesting state from '+`http://${process.env.EBUSD_HOST}:${process.env.EBUSD_PORT}/data`)
    let res = await fetch(`http://${process.env.EBUSD_HOST}:${process.env.EBUSD_PORT}/data`)
    try {
        const json = await res.json()
        const state: State = {
            currentTemperature: getValueFromJsonByPath(json, process.env.PATH_TRACKED_TEMP),
            currentMinTemperatureSet: getValueFromJsonByPath(json, process.env.PATH_MINIMUM_TEMP),
            desiredTemperature: getValueFromJsonByPath(json, process.env.PATH_DESIRED_TEMP),
            isHeating: getValueFromJsonByPath(json, process.env.PATH_ACTIVE) > 0,
            isAdjusted: getValueFromJsonByPath(json, process.env.PATH_MINIMUM_TEMP) > process.env.MINIMUM_TEMP
        }

        console.log(new Date().toISOString()+`: --- Current State ---`)
        console.log(state)
        console.log('')

        return state

    } catch (err) {
        console.error(err)
        return null
    }
}

async function control(): Promise<void> {
    const newState = await fetchStatus()

    // check if heating has started and mark time
    if (newState.isHeating == true && (currentState.isHeating == false || currentState.cycleStartedAt == null)) {
        newState.cycleStartedAt = Date.now()
    } else if (newState.isHeating) {
        newState.cycleStartedAt = null
    }

    // increase minimum temperature if heating, not reached target cycle length and threshold reached
    if (
        newState.isHeating &&
        newState.desiredTemperature > 0 && // sanity check: when running warm water, this value is set to zero by the Vaillant controller
        Date.now() - newState.cycleStartedAt < parseInt(process.env.CYCLE_LENGTH) &&
        newState.desiredTemperature - newState.currentTemperature <= parseFloat(process.env.THRESHOLD)
    ) {
        const command = `${ebusdSetTempCmd} ${(newState.desiredTemperature +1)}`
        console.log(new Date().toISOString+`: Increasing minimum temperature to ${(newState.desiredTemperature +1)} °C.\n\tCommand: ${command}`)
        const ret = execSync(command)
        console.log(new Date().toISOString+`: ebusctl output: ${(ret+'').trim()}`)
        newState.isAdjusted = true
    }
    // reset minimum temperature if cycle length has reached target length
    else if (
        newState.isHeating &&
        newState.desiredTemperature > 0 && // sanity check: when running warm water, this value is set to zero by the Vaillant controller
        Date.now() - newState.cycleStartedAt >= parseInt(process.env.CYCLE_LENGTH) &&
        newState.isAdjusted == true
    ) {
        const command = `${ebusdSetTempCmd} ${process.env.MINIMUM_TEMP}`
        console.log(new Date().toISOString+`: Reset of minimum temperature at target cycle length reached.\n\tCommand: ${command}`)
        const ret = execSync(command)
        console.log(new Date().toISOString+`: ebusctl output: ${(ret+'').trim()}`)
        newState.isAdjusted = false
    }

    currentState = newState
}

async function init() {
    await dotenv.config({ path: __dirname + "/../.env"})

    currentState = await fetchStatus()

    setInterval(control, 10000)
}

async function shutdown() {
    if (currentState.isAdjusted == true) {
        try {
            const command = `${ebusdSetTempCmd} ${process.env.MINIMUM_TEMP}`
            console.log(new Date().toISOString+`: Reset of minimum temperature on shutdown.\n\tCommand: ${command}`)
            const ret = execSync(command)
            console.log(new Date().toISOString+`: ebusctl output: ${(ret+'').trim()}`)
            process.exit(0)
        } catch (err) {
            console.error(err)
            process.exit(1)
        }
    }
    else {
        process.exit(0)
    }
}

process.on('SIGINT', shutdown) // ctrl + c

init()
