const express = require('express');
const router = express.Router();
const User = require('../models/UserCollection');
const {getCenters,getHubs,globalSettings} = require("../controller/GlobalController");

console.log("router loaded !!");

router.post('/create-user',(req,res)=>{
    console.log(req)
    const userData = req.body;
    console.log(req.body);
    // User.insertMany(userData);

    return res.redirect('back');
});

router.get('/',async (req,res)=>{
    console.log("Entered");
    var arr = [];
    const users = await User.find({"center_id.short_name":"JAL12J"})

    for(let user of users){
        arr.push(user["center_id"])
    }
    
    return res.send(arr);
});

router.get('/get_hubs',getHubs);
router.get('/get_centers',getCenters);
router.get('/get_global_settings',globalSettings);

module.exports = router;