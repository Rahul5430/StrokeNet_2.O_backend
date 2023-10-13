const express = require('express')
const db = require('./config/mongoose')
const bodyParser = require('body-parser');

const app = express()
const port = 7000;

app.use(express.urlencoded())

// using routes
app.use('/',require('./routes'))



app.listen(port,(err)=>{
    if(err){
        console.log(`error in running the server : ${err}`);
    }

    console.log(`Server is running on ${port}`)
})
