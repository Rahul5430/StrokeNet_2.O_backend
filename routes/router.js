const express = require('express');
const router = express.Router();
const User = require('../models/UserCollection');
const {getCenters,getHubs,globalSettings} = require("../controller/GlobalController");
const {signup,login} = require("../controller/authController");

router.post('/auth/signup',signup);
router.post('/auth/login',login);
router.get('/get_hubs',getHubs);
router.get('/get_centers',getCenters);
router.get('/get_global_settings',globalSettings);

module.exports = router;