import State from './interfaces/State'
import { getValueFromJsonByPath } from './helper'
import dotenv from 'dotenv'
import { execSync } from 'child_process'

// variables are set in init()
let currentState: State = null
let cycleLength: number = null
let threshold: number = null

let ebusdSetTempCmd: string = null
let ebusdReadMinTemp: string = null

async function fetchStatus(onInit: boolean): Promise<State> {
    console.log('Requesting state from '+`http://${process.env.EBUSD_HOST}:${process.env.EBUSD_PORT}/data`)
    let res = await fetch(`http://${process.env.EBUSD_HOST}:${process.env.EBUSD_PORT}/data`)
    try {
        const json = await res.json()
        const state: State = {
            currentTemperature: getValueFromJsonByPath(json, process.env.PATH_TRACKED_TEMP),
            currentMinTemperatureSet: onInit ? getValueFromJsonByPath(json, process.env.PATH_MINIMUM_TEMP) : currentState.currentMinTemperatureSet,
            desiredTemperature: getValueFromJsonByPath(json, process.env.PATH_DESIRED_TEMP),
            isHeating: getValueFromJsonByPath(json, process.env.PATH_ACTIVE) > 0,
            isAdjusted: (onInit ? getValueFromJsonByPath(json, process.env.PATH_MINIMUM_TEMP) : currentState.currentMinTemperatureSet) > process.env.MINIMUM_TEMP,
            cycleStartedAt: onInit ? null : currentState?.cycleStartedAt || null
        }

        console.log(`${new Date().toISOString()}: --- Current State ---`)
        console.log(`   currentTemperature: ${state.currentTemperature}`)
        console.log(`   currentMinTemperatureSet: ${state.currentMinTemperatureSet}`)
        console.log(`   desiredTemperature: ${state.desiredTemperature}`)
        console.log(`   isHeating: ${state.isHeating}`)
        if (state.isHeating && state.cycleStartedAt != null) console.log(`   cycleStartedAt: ${new Date(state.cycleStartedAt).toISOString()}`)
        console.log(`   isAdjusted: ${state.isAdjusted}`)
        console.log('')

        return state

    } catch (err) {
        console.error(err)
        return null
    }
}

async function control(): Promise<void> {
    const newState = await fetchStatus(false)

    // check if heating has started and mark time
    if (newState.isHeating == true && (currentState.isHeating == false || !currentState.cycleStartedAt)) {
        newState.cycleStartedAt = Date.now()
        console.log(new Date().toISOString()+` Setting cycleStart to ${new Date(newState.cycleStartedAt).toISOString()}\n`)
    } else if (!newState.isHeating) {
        newState.cycleStartedAt = null
    }

    // increase minimum temperature if heating, not reached target cycle length and threshold reached
    if (
        newState.isHeating &&
        newState.desiredTemperature > 0 && // sanity check: when running warm water, this value is set to zero by the Vaillant controller
        Date.now() - newState.cycleStartedAt < cycleLength &&
        newState.desiredTemperature - newState.currentTemperature <= threshold
    ) {
        const newTemp = Math.floor(newState.desiredTemperature +1)
        const command = `${ebusdSetTempCmd} ${newTemp}`
        console.log(new Date().toISOString()+`: Increasing minimum temperature to ${newTemp} °C.\n\tCommand: ${command}`)
        const ret = await ebusTcp(command)
        console.log(new Date().toISOString()+`: ebusctl output: ${(ret+'').trim()}`)
        newState.isAdjusted = true
        newState.currentMinTemperatureSet = newTemp
        // need to sleep to have ebusd check on the desired temp
        await new Promise(r => setTimeout(r, 60000))
    }
    // reset minimum temperature if cycle length has reached target length
    else if (
        newState.desiredTemperature > 0 && // sanity check: when running warm water, this value is set to zero by the Vaillant controller
        Date.now() - newState.cycleStartedAt >= cycleLength &&
        newState.isAdjusted == true
    ) {
        const command = `${ebusdSetTempCmd} ${process.env.MINIMUM_TEMP}`
        console.log(new Date().toISOString()+`: Reset of minimum temperature at target cycle length reached.\n\tCommand: ${command}`)
        const ret = await ebusTcp(command)
        console.log(new Date().toISOString()+`: ebusctl output: ${(ret+'').trim()}`)
        newState.isAdjusted = false
        newState.currentMinTemperatureSet = parseFloat(process.env.MINIMUM_TEMP)
    }

    currentState = newState

    setTimeout(control, 10000)
}

async function ebusTcp(command: string): Promise<string> {
    let ret = execSync(ebusdReadMinTemp)
    // make sure we have the correct response when reading, otherwise we "fire and forget"
    if (command.indexOf('ebusctl read') != -1) {
        while ((ret+'').trim() == '') {
            await new Promise(r => setTimeout(r, 2000))
            ret = execSync(ebusdReadMinTemp)
        }
    }
    return (ret+'')
}

async function init() {
    await dotenv.config({ path: __dirname + "/../.env"})

    ebusdSetTempCmd = `ebusctl write -s ${process.env.QQ} -c ${process.env.CIRCUIT} ${process.env.ITEM}`
    ebusdReadMinTemp = `ebusctl read -s ${process.env.QQ} -c ${process.env.CIRCUIT} -f ${process.env.ITEM}`

    cycleLength = parseInt(process.env.CYCLE_LENGTH) * 1000
    threshold = parseFloat(process.env.THRESHOLD)

    // get initial value of current minimum temperature
    const ret = await ebusTcp(ebusdReadMinTemp)
    console.log(`Init of vaillant-efficiency: Read current setting of minimum temperature from ebus: ${(ret+'').trim()}`)

    // sleep two seconds to have ebusd update with the minimum temperature value
    await new Promise(r => setTimeout(r, 2000))

    currentState = await fetchStatus(true)

    control()
}

async function shutdown() {
    if (currentState.isAdjusted == true) {
        try {
            const command = `${ebusdSetTempCmd} ${process.env.MINIMUM_TEMP}`
            console.log(new Date().toISOString()+`: Reset of minimum temperature on shutdown.\n\tCommand: ${command}`)
            const ret = await ebusTcp(command)
            console.log(new Date().toISOString()+`: ebusctl output: ${(ret+'').trim()}`)
            process.exit(0)
        } catch (err) {
            console.error(err)
            process.exit(1)
        }
    }
    else {
        console.log('Exit without re-adjusting min temp.')
        process.exit(0)
    }
}

process.on('SIGINT', shutdown) // ctrl + c

init()
