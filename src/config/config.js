const fs = require('fs')
const dotenv = require("dotenv")

if (fs.existsSync(__dirname + "/../../.env")) {
    dotenv.config({ path: __dirname + "/../../.env"})
}
