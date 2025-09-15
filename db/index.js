require('dotenv').config();
const mongoess = require("mongoose");
const url = process.env.DB_URL;

console.log(url);
console.log("on gogiasdm");
if(!url) throw new Error("invalid ");

(async () => {
    try {
        await mongoess.connect(url)
        console.log("conected", url)
    } catch (error) {
        console.log(error)
    }
})();
