const mongoose = require('mongoose');



const countSchema = new mongoose.Schema({
    count:Number,
})

 const Count = mongoose.model("count", countSchema)


 module.exports={Count}