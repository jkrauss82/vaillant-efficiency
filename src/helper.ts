export function getValueFromJsonByPath(json: any, path: string) {
    const parts = path.split('.')
    let curPart = json

    parts.forEach(field => {
        // omit root
        if (field != '$' && curPart != null) {
            // console.log(curPart, field)
            if (curPart[field] !== undefined) {
                curPart = curPart[field]
            } else {
                curPart = null
            }
        }
    })

    return curPart
}
