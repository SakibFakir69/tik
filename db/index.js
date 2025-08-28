

const url = process.env.DB_URL;


const mongoess = require("mongoose")

// iife

if(url)
{
    throw new Error("invalid ")
}

(
    async() => {


        try {

            await mongoess.connect(url)
            console.log("conected")

            
        } catch (error) {

            console.log(error)
            
        }



    }
)()